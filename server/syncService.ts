import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { pool, initDb } from "./db.js";

interface StoredWorkspace {
  user_identifier: string;
  user_email: string;
  workspace_data: any;
  updated_at: string;
  sync_version: number;
}

interface DeviceSession {
  id: string;
  user_email: string;
  user_identifier: string;
  device_name: string;
  platform: string; // 'android_apk' | 'web_browser' | 'ai_studio_preview' | 'other'
  environment: string;
  app_version?: string;
  created_at: number;
  last_active: number;
  ip_address?: string;
  user_agent?: string;
  is_revoked?: boolean;
}

/**
 * Safely parses and normalizes timestamp / sync version values.
 * Handles nanosecond (19-20 digits) or microsecond timestamps from Android or other devices,
 * converting them to standard milliseconds and ensuring they fit safely in PostgreSQL and JavaScript.
 */
export function safeTimestamp(val: any, fallback = Date.now()): number {
  if (val === null || val === undefined) return fallback;
  let num: number;
  if (typeof val === 'number') {
    num = val;
  } else {
    const cleaned = String(val).trim().replace(/[^0-9.-]/g, '');
    num = parseFloat(cleaned);
  }

  if (isNaN(num) || !isFinite(num) || num <= 0) return fallback;

  // Nanoseconds (e.g. 17936315551501115000 >= 1e16)
  if (num > 1e16) {
    num = Math.floor(num / 1000000);
  } else if (num > 1e14) {
    // Microseconds (>= 1e14)
    num = Math.floor(num / 1000);
  }

  // Cap to safe integer (9,007,199,254,740,991)
  const MAX_SAFE = 9007199254740991;
  if (num > MAX_SAFE) {
    num = MAX_SAFE;
  }

  return Math.floor(num);
}

/**
 * Reconciles expense lists ensuring Android Native APK transactions (like the ₹2.53 lakh dataset)
 * remain authoritative and are never lost when merging with web client records.
 */
function reconcileExpenses(
  incomingExpenses: any[],
  existingExpenses: any[],
  isIncomingFromApk: boolean,
  deletedIds: Set<string>
): any[] {
  const expenseMap = new Map<string, any>();
  const refMap = new Map<string, string>(); // refId -> expenseId

  const addExp = (e: any, isMaster: boolean) => {
    if (!e || !e.id) return;
    const id = String(e.id).trim();
    if (deletedIds.has(id)) return;

    const ref = (e.smsReferenceId || e.referenceId || e.upiReference || "").trim().toUpperCase();
    if (ref && ref.length >= 4 && refMap.has(ref)) {
      const existingId = refMap.get(ref)!;
      const prev = expenseMap.get(existingId);
      if (prev) {
        if (isMaster) {
          expenseMap.set(id, e);
          if (existingId !== id) expenseMap.delete(existingId);
          refMap.set(ref, id);
        }
        return;
      }
    }

    if (expenseMap.has(id)) {
      const prev = expenseMap.get(id);
      if (isMaster) {
        expenseMap.set(id, e);
      } else {
        const prevTs = Number(prev.updatedAt || prev.createdAt || prev.date || 0);
        const newTs = Number(e.updatedAt || e.createdAt || e.date || 0);
        if (newTs > prevTs) {
          expenseMap.set(id, { ...prev, ...e });
        }
      }
    } else {
      expenseMap.set(id, e);
      if (ref && ref.length >= 4) {
        refMap.set(ref, id);
      }
    }
  };

  if (isIncomingFromApk) {
    existingExpenses.forEach((e) => addExp(e, false));
    incomingExpenses.forEach((e) => addExp(e, true));
  } else {
    existingExpenses.forEach((e) => {
      const isApkItem =
        e.source === "sms_auto" ||
        e.source === "sms_rescan" ||
        String(e.id).startsWith("exp-sms-") ||
        Boolean(e.rawSmsText || e.smsReferenceId || e.upiReference);
      addExp(e, isApkItem);
    });
    incomingExpenses.forEach((e) => addExp(e, false));
  }

  return Array.from(expenseMap.values());
}

export async function handleGetWorkspace(req: any, res: any): Promise<void> {
  try {
    const userIdentifier = ((req.query?.user_identifier || "") as string).trim();
    const userEmail = ((req.query?.user_email || "") as string).trim().toLowerCase();

    if (!userIdentifier && !userEmail) {
      return res.status(400).json({
        success: false,
        error: "Missing user_identifier or user_email query parameter",
      });
    }

    let record = null;
    if (userIdentifier && userEmail) {
      const { rows } = await pool.query(
        "SELECT * FROM workspaces WHERE user_identifier = $1 OR LOWER(user_email) = $2 ORDER BY updated_at DESC LIMIT 1",
        [userIdentifier, userEmail]
      );
      record = rows[0];
    } else if (userIdentifier) {
      const { rows } = await pool.query(
        "SELECT * FROM workspaces WHERE user_identifier = $1 ORDER BY updated_at DESC LIMIT 1",
        [userIdentifier]
      );
      record = rows[0];
    } else if (userEmail) {
      const { rows } = await pool.query(
        "SELECT * FROM workspaces WHERE LOWER(user_email) = $1 ORDER BY updated_at DESC LIMIT 1",
        [userEmail]
      );
      record = rows[0];
    }

    // Fallback: check user_workspaces table if workspaces table didn't have it
    if (!record || !record.workspace_data) {
      if (userIdentifier && userEmail) {
        const { rows } = await pool.query(
          "SELECT * FROM user_workspaces WHERE user_identifier = $1 OR LOWER(user_email) = $2 ORDER BY updated_at DESC LIMIT 1",
          [userIdentifier, userEmail]
        );
        record = rows[0];
      } else if (userIdentifier) {
        const { rows } = await pool.query(
          "SELECT * FROM user_workspaces WHERE user_identifier = $1 ORDER BY updated_at DESC LIMIT 1",
          [userIdentifier]
        );
        record = rows[0];
      } else if (userEmail) {
        const { rows } = await pool.query(
          "SELECT * FROM user_workspaces WHERE LOWER(user_email) = $1 ORDER BY updated_at DESC LIMIT 1",
          [userEmail]
        );
        record = rows[0];
      }
    }

    if (!record || !record.workspace_data) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: "No remote workspace snapshot exists yet",
        workspace_data: null,
        updated_at: null,
        sync_version: 0,
      });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      user_identifier: record.user_identifier,
      user_email: record.user_email,
      workspace_data: record.workspace_data,
      updated_at: record.updated_at,
      sync_version: record.sync_version,
    });
  } catch (err: any) {
    console.error("[SyncService] Error retrieving workspace:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function handlePostWorkspace(req: any, res: any): Promise<void> {
  try {
    const {
      user_identifier,
      user_email,
      workspace_data,
      updated_at,
      sync_version,
      is_apk,
    } = req.body || {};

    if (!user_identifier || !workspace_data) {
      return res.status(400).json({
        success: false,
        error: "Missing user_identifier or workspace_data in request body",
      });
    }

    const activeKey = user_identifier.trim();
    const cleanEmail = (user_email || "").trim().toLowerCase();
    const isFromApk = Boolean(
      is_apk ||
      workspace_data?._meta?.apkInstalled ||
      workspace_data?._meta?.isNativeAndroid
    );

    const { rows } = await pool.query("SELECT * FROM workspaces WHERE user_identifier = $1", [activeKey]);
    const existingRecord = rows[0];
    const now = new Date().toISOString();
    const incomingVersion = safeTimestamp(sync_version || Date.now());

    let mergedWorkspace = { ...workspace_data };
    let reconciledExpenses: any[] = [];
    const deletedIds = new Set<string>();

    if (existingRecord && existingRecord.workspace_data) {
      const existingData = existingRecord.workspace_data;

      if (Array.isArray(existingData?._meta?.deletedExpenseIds)) {
        existingData._meta.deletedExpenseIds.forEach((id: string) => deletedIds.add(id));
      }
      if (Array.isArray(workspace_data?._meta?.deletedExpenseIds)) {
        workspace_data._meta.deletedExpenseIds.forEach((id: string) => deletedIds.add(id));
      }

      const existingExpenses = Array.isArray(existingData.expenses) ? existingData.expenses : [];
      const incomingExpenses = Array.isArray(workspace_data.expenses) ? workspace_data.expenses : [];

      reconciledExpenses = reconcileExpenses(
        incomingExpenses,
        existingExpenses,
        isFromApk,
        deletedIds
      );

      mergedWorkspace.expenses = reconciledExpenses;

      const existingDevices = Array.isArray(existingData.devices) ? existingData.devices : [];
      const incomingDevices = Array.isArray(workspace_data.devices) ? workspace_data.devices : [];
      const devMap = new Map<string, any>();
      existingDevices.forEach((d) => d?.id && devMap.set(d.id, d));
      incomingDevices.forEach((d) => {
        if (d?.id) {
          const ex = devMap.get(d.id);
          devMap.set(d.id, ex ? { ...ex, ...d, lastActive: Math.max(ex.lastActive || 0, d.lastActive || 0) } : d);
        }
      });
      mergedWorkspace.devices = Array.from(devMap.values());

      if (!isFromApk && existingData.screenTime && (existingData.screenTime.isFromApk || existingData.screenTime.isNativeAndroid)) {
        mergedWorkspace.screenTime = existingData.screenTime;
      }
      if (!isFromApk && existingData.screenTimeHistory) {
        mergedWorkspace.screenTimeHistory = {
          ...existingData.screenTimeHistory,
          ...(mergedWorkspace.screenTimeHistory || {}),
        };
      }
    } else {
      reconciledExpenses = Array.isArray(workspace_data.expenses) ? workspace_data.expenses : [];
    }

    const existingVer = existingRecord ? safeTimestamp(existingRecord.sync_version, 0) : 0;
    const finalVersion = Math.max(
      incomingVersion,
      existingRecord ? existingVer + 1 : safeTimestamp(Date.now())
    );

    if (!mergedWorkspace._meta) mergedWorkspace._meta = {};
    mergedWorkspace._meta.syncVersion = finalVersion;
    mergedWorkspace._meta.serverSyncedAt = now;

    const upsertQuery = `
      INSERT INTO workspaces (user_identifier, user_email, workspace_data, updated_at, sync_version)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_identifier)
      DO UPDATE SET
        user_email = EXCLUDED.user_email,
        workspace_data = EXCLUDED.workspace_data,
        updated_at = EXCLUDED.updated_at,
        sync_version = EXCLUDED.sync_version
    `;

    await pool.query(upsertQuery, [
      activeKey,
      cleanEmail || existingRecord?.user_email || "",
      JSON.stringify(mergedWorkspace),
      updated_at || now,
      finalVersion
    ]);

    // Mirror individual reconciled transactions into Neon `transactions` table
    if (Array.isArray(reconciledExpenses) && reconciledExpenses.length > 0) {
      try {
        for (const exp of reconciledExpenses) {
          if (!exp || !exp.id) continue;
          const expId = String(exp.id).trim();
          const amount = Number(exp.amount) || 0;
          const name = String(exp.name || 'Expense').trim();
          const category = String(exp.category || 'Other').trim();
          const date = String(exp.date || now.split('T')[0]);
          const direction = String(exp.direction || 'DEBIT').toUpperCase();

          const upsertTxQuery = `
            INSERT INTO transactions (
              id, workspace_identifier, user_email, name, amount, category, date, time,
              direction, payment_method, billing_cycle, notes, bank_name, masked_account,
              account_last4, reference_id, sms_reference_id, upi_reference, raw_sms_text,
              merchant, payee, source, source_file, import_batch_id, active, is_deleted,
              client_updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8,
              $9, $10, $11, $12, $13, $14,
              $15, $16, $17, $18, $19,
              $20, $21, $22, $23, $24, $25, $26,
              $27
            )
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              amount = EXCLUDED.amount,
              category = EXCLUDED.category,
              date = EXCLUDED.date,
              time = EXCLUDED.time,
              direction = EXCLUDED.direction,
              payment_method = EXCLUDED.payment_method,
              billing_cycle = EXCLUDED.billing_cycle,
              notes = EXCLUDED.notes,
              bank_name = EXCLUDED.bank_name,
              masked_account = EXCLUDED.masked_account,
              account_last4 = EXCLUDED.account_last4,
              reference_id = EXCLUDED.reference_id,
              sms_reference_id = EXCLUDED.sms_reference_id,
              upi_reference = EXCLUDED.upi_reference,
              raw_sms_text = EXCLUDED.raw_sms_text,
              merchant = EXCLUDED.merchant,
              payee = EXCLUDED.payee,
              source = EXCLUDED.source,
              active = EXCLUDED.active,
              is_deleted = EXCLUDED.is_deleted,
              client_updated_at = EXCLUDED.client_updated_at,
              updated_at = CURRENT_TIMESTAMP
          `;

          await pool.query(upsertTxQuery, [
            expId,
            activeKey,
            cleanEmail || existingRecord?.user_email || '',
            name,
            amount,
            category,
            date,
            exp.time || null,
            direction,
            exp.paymentMethod || null,
            exp.billingCycle || null,
            exp.notes || null,
            exp.bankName || exp.bank || null,
            exp.maskedAccount || null,
            exp.accountLast4 || null,
            exp.referenceId || null,
            exp.smsReferenceId || null,
            exp.upiReference || null,
            exp.rawSmsText || null,
            exp.merchant || null,
            exp.payee || null,
            exp.source || (isFromApk ? 'sms_auto' : 'manual'),
            exp.sourceFile || null,
            exp.importBatchId || null,
            exp.active !== false,
            Boolean(exp.isDeleted),
            safeTimestamp(exp.clientUpdatedAt || exp.updatedAt || exp.createdAt || Date.now()),
          ]);
        }
      } catch (txErr) {
        console.warn('[SyncService] Notice syncing individual transactions into Neon:', txErr);
      }
    }

    // Process tombstoned/deleted expense IDs in Neon
    if (deletedIds && deletedIds.size > 0) {
      try {
        await pool.query(
          "UPDATE transactions SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE workspace_identifier = $1 AND id = ANY($2)",
          [activeKey, Array.from(deletedIds)]
        );
      } catch (delErr) {
        console.warn('[SyncService] Notice marking deleted transactions in Neon:', delErr);
      }
    }

    // Update expense authority records for Android Native APK source transactions
    if (isFromApk && Array.isArray(reconciledExpenses)) {
      try {
        for (const exp of reconciledExpenses) {
          if (!exp || !exp.id) continue;
          await pool.query(`
            INSERT INTO expense_authority (
              expense_id, workspace_identifier, source_device_type, is_synced_to_all_devices
            ) VALUES ($1, $2, 'apk', true)
            ON CONFLICT (expense_id) DO UPDATE SET
              is_synced_to_all_devices = true,
              updated_at = CURRENT_TIMESTAMP
          `, [String(exp.id).trim(), activeKey]);
        }
      } catch (authErr) {
        console.warn('[SyncService] Notice updating expense_authority:', authErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Workspace successfully synchronized with Neon Serverless Postgres",
      updated_at: now,
      sync_version: finalVersion,
      expense_count: Array.isArray(mergedWorkspace.expenses) ? mergedWorkspace.expenses.length : 0,
    });
  } catch (err: any) {
    console.error("[SyncService] Error saving workspace:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function handleGetDevices(req: any, res: any): Promise<void> {
  try {
    const email = ((req.query?.user_email || "") as string).trim().toLowerCase();
    const identifier = ((req.query?.user_identifier || "") as string).trim();

    const now = Date.now();
    const TWO_MINUTES_MS = 2 * 60 * 1000;

    let query = "SELECT * FROM devices WHERE is_revoked = false";
    const queryParams: any[] = [];
    if (email) {
      query += " AND user_email = $1";
      queryParams.push(email);
    } else if (identifier) {
      query += " AND user_identifier = $1";
      queryParams.push(identifier);
    }

    const { rows } = await pool.query(query, queryParams);

    const devices = rows.map((d) => ({
      ...d,
      isOnline: now - Number(d.last_active) <= TWO_MINUTES_MS,
    }))
    .sort((a, b) => Number(b.last_active) - Number(a.last_active));

    return res.status(200).json({
      success: true,
      devices,
      count: devices.length,
      active_count: devices.filter((d) => d.isOnline).length,
    });
  } catch (err: any) {
    console.error("[SyncService] Error listing devices:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function handlePostHeartbeat(req: any, res: any): Promise<void> {
  try {
    const {
      device_id,
      user_email,
      user_identifier,
      device_name,
      platform,
      environment,
      app_version,
    } = req.body || {};

    if (!device_id) {
      return res.status(400).json({ success: false, error: "Missing device_id" });
    }

    const id = String(device_id).trim();
    const now = Date.now();
    const cleanEmail = (user_email || "").trim().toLowerCase();
    const cleanIdentifier = (user_identifier || "").trim();

    const { rows } = await pool.query("SELECT * FROM devices WHERE id = $1", [id]);
    const existing = rows[0];

    const upsertQuery = `
      INSERT INTO devices (id, user_email, user_identifier, device_name, platform, environment, app_version, created_at, last_active, ip_address, user_agent, is_revoked)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
      ON CONFLICT (id)
      DO UPDATE SET
        user_email = EXCLUDED.user_email,
        user_identifier = EXCLUDED.user_identifier,
        device_name = EXCLUDED.device_name,
        platform = EXCLUDED.platform,
        environment = EXCLUDED.environment,
        app_version = EXCLUDED.app_version,
        last_active = EXCLUDED.last_active,
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        is_revoked = false
    `;

    await pool.query(upsertQuery, [
      id,
      cleanEmail || existing?.user_email || "",
      cleanIdentifier || existing?.user_identifier || "user_guest",
      device_name || existing?.device_name || "Active Session",
      platform || existing?.platform || "web_browser",
      environment || existing?.environment || "Web Browser",
      app_version || existing?.app_version || "1.0.0",
      existing ? existing.created_at : now,
      now,
      req.ip || req.socket?.remoteAddress || undefined,
      (req.headers?.["user-agent"] as string) || undefined,
    ]);

    // Also update connected_devices table
    try {
      await pool.query(`
        INSERT INTO connected_devices (id, user_email, user_identifier, device_name, platform, environment, app_version, created_at, last_active, ip_address, user_agent, is_revoked)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
        ON CONFLICT (id) DO UPDATE SET
          user_email = EXCLUDED.user_email,
          user_identifier = EXCLUDED.user_identifier,
          device_name = EXCLUDED.device_name,
          platform = EXCLUDED.platform,
          environment = EXCLUDED.environment,
          app_version = EXCLUDED.app_version,
          last_active = EXCLUDED.last_active,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent,
          is_revoked = false
      `, [
        id,
        cleanEmail || existing?.user_email || "",
        cleanIdentifier || existing?.user_identifier || "user_guest",
        device_name || existing?.device_name || "Active Session",
        platform || existing?.platform || "web_browser",
        environment || existing?.environment || "Web Browser",
        app_version || existing?.app_version || "1.0.0",
        existing ? existing.created_at : now,
        now,
        req.ip || req.socket?.remoteAddress || undefined,
        (req.headers?.["user-agent"] as string) || undefined,
      ]);
    } catch {
      // Non-fatal if connected_devices is a view
    }

    return res.status(200).json({
      success: true,
      message: "Heartbeat recorded successfully",
      device_id: id,
      timestamp: now,
    });
  } catch (err: any) {
    console.error("[SyncService] Error recording heartbeat:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function handleDeleteDevice(req: any, res: any): Promise<void> {
  try {
    const deviceId = req.params?.deviceId || req.url?.split("/").pop();
    if (deviceId) {
      await pool.query("UPDATE devices SET is_revoked = true WHERE id = $1", [deviceId]);
      try {
        await pool.query("UPDATE connected_devices SET is_revoked = true WHERE id = $1", [deviceId]);
      } catch {}
    }
    return res.status(200).json({ success: true, message: "Device revoked" });
  } catch (err: any) {
    console.error("[SyncService] Error revoking device:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function handleGetTransactions(req: any, res: any): Promise<void> {
  try {
    const workspaceId = ((req.query?.workspace_identifier || req.query?.user_identifier || "") as string).trim();
    if (!workspaceId) {
      return res.status(400).json({ success: false, error: "Missing workspace_identifier" });
    }

    const { rows } = await pool.query(
      "SELECT * FROM transactions WHERE workspace_identifier = $1 AND is_deleted = false ORDER BY date DESC, created_at DESC",
      [workspaceId]
    );

    return res.status(200).json({
      success: true,
      transactions: rows,
      count: rows.length,
    });
  } catch (err: any) {
    console.error("[SyncService] Error retrieving transactions:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function handlePostTransactions(req: any, res: any): Promise<void> {
  try {
    const { workspace_identifier, user_email, transactions: incomingTxs, is_apk } = req.body || {};
    if (!workspace_identifier || !Array.isArray(incomingTxs)) {
      return res.status(400).json({ success: false, error: "Invalid payload format" });
    }

    const activeKey = String(workspace_identifier).trim();
    const cleanEmail = (user_email || "").trim().toLowerCase();

    for (const exp of incomingTxs) {
      if (!exp || !exp.id) continue;
      const expId = String(exp.id).trim();
      const amount = Number(exp.amount) || 0;
      const name = String(exp.name || 'Expense').trim();
      const category = String(exp.category || 'Other').trim();
      const date = String(exp.date || new Date().toISOString().split('T')[0]);

      await pool.query(`
        INSERT INTO transactions (
          id, workspace_identifier, user_email, name, amount, category, date, time,
          direction, payment_method, billing_cycle, notes, bank_name, masked_account,
          account_last4, reference_id, sms_reference_id, upi_reference, raw_sms_text,
          merchant, payee, source, active, is_deleted, client_updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          date = EXCLUDED.date,
          direction = EXCLUDED.direction,
          bank_name = EXCLUDED.bank_name,
          sms_reference_id = EXCLUDED.sms_reference_id,
          upi_reference = EXCLUDED.upi_reference,
          active = EXCLUDED.active,
          is_deleted = EXCLUDED.is_deleted,
          client_updated_at = EXCLUDED.client_updated_at,
          updated_at = CURRENT_TIMESTAMP
      `, [
        expId,
        activeKey,
        cleanEmail,
        name,
        amount,
        category,
        date,
        exp.time || null,
        exp.direction || 'DEBIT',
        exp.paymentMethod || null,
        exp.billingCycle || null,
        exp.notes || null,
        exp.bankName || exp.bank || null,
        exp.maskedAccount || null,
        exp.accountLast4 || null,
        exp.referenceId || null,
        exp.smsReferenceId || null,
        exp.upiReference || null,
        exp.rawSmsText || null,
        exp.merchant || null,
        exp.payee || null,
        exp.source || (is_apk ? 'sms_auto' : 'manual'),
        exp.active !== false,
        Boolean(exp.isDeleted),
        safeTimestamp(exp.clientUpdatedAt || exp.updatedAt || exp.createdAt || Date.now()),
      ]);
    }

    return res.status(200).json({ success: true, count: incomingTxs.length });
  } catch (err: any) {
    console.error("[SyncService] Error posting transactions:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

/**
 * Bidirectional Timestamp-Based Delta Sync endpoint (/api/sync).
 * Accepts last_sync_timestamp and modified/new client outbox records.
 * PUSH logic: Upserts records using UUID. If record exists, only overwrites if incoming updated_at > server's updated_at.
 * PULL logic: Queries records where updated_at > last_sync_timestamp (including soft-deletes).
 */
export async function handleDeltaSync(req: any, res: any): Promise<void> {
  try {
    const isGet = (req.method || "").toUpperCase() === "GET";
    const body = isGet ? req.query || {} : req.body || {};

    const rawWorkspace = body.workspace_identifier || body.user_identifier || req.query?.workspace_identifier || req.query?.user_identifier || "";
    const rawEmail = body.user_email || body.email || req.query?.user_email || req.query?.email || "";
    const workspaceId = String(rawWorkspace).trim();
    const userEmail = String(rawEmail).trim().toLowerCase();

    if (!workspaceId && !userEmail) {
      return res.status(400).json({
        success: false,
        error: "Missing workspace_identifier or user_email",
      });
    }

    // 1. Parse last_sync_timestamp
    let lastSyncDate: Date;
    const rawTimestamp = body.last_sync_timestamp || req.query?.last_sync_timestamp;
    if (rawTimestamp) {
      if (typeof rawTimestamp === "number" || !isNaN(Number(rawTimestamp))) {
        lastSyncDate = new Date(Number(rawTimestamp));
      } else {
        lastSyncDate = new Date(String(rawTimestamp));
      }
      if (isNaN(lastSyncDate.getTime())) {
        lastSyncDate = new Date(0);
      }
    } else {
      lastSyncDate = new Date(0);
    }

    // 2. PUSH PHASE: Process incoming records / client outbox
    const incomingRecords = Array.isArray(body.records)
      ? body.records
      : Array.isArray(body.outbox)
      ? body.outbox
      : [];

    let pushedCount = 0;
    const appliedIds: string[] = [];
    const skippedIds: string[] = [];

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    for (const item of incomingRecords) {
      if (!item) continue;
      const record = item.payload || item.data || item;
      let recId = String(record.id || item.expenseId || item.id || "").trim();

      if (!uuidRegex.test(recId)) {
        recId = crypto.randomUUID();
      }

      const isDeleted = Boolean(
        record.is_deleted === true ||
        record.isDeleted === true ||
        record.deleted === true ||
        item.action === "delete"
      );

      let clientUpdatedAtMs: number;
      const rawUpdatedAt = record.updated_at || record.updatedAt || item.timestamp || record.date;
      if (rawUpdatedAt) {
        const d = typeof rawUpdatedAt === "number" || !isNaN(Number(rawUpdatedAt))
          ? new Date(Number(rawUpdatedAt))
          : new Date(String(rawUpdatedAt));
        clientUpdatedAtMs = !isNaN(d.getTime()) ? d.getTime() : Date.now();
      } else {
        clientUpdatedAtMs = Date.now();
      }
      const clientUpdatedAtIso = new Date(clientUpdatedAtMs).toISOString();

      const amount = Number(record.amount) || 0;
      const name = String(record.name || record.payee || record.merchant || "Expense").trim();
      const category = String(record.category || "Other").trim();
      const date = String(record.date || new Date().toISOString().split("T")[0]);
      const isCredit =
        record.direction === "CREDIT" ||
        record.transactionType === "CREDIT" ||
        record.transactionType === "income" ||
        record.type === "income";
      const direction = isCredit ? "CREDIT" : "DEBIT";

      const upsertQuery = `
        INSERT INTO transactions (
          id, workspace_identifier, user_email, name, amount, category, date, time,
          direction, payment_method, billing_cycle, notes, bank_name, masked_account,
          account_last4, reference_id, sms_reference_id, upi_reference, raw_sms_text,
          merchant, payee, source, active, is_deleted, deleted_at, client_updated_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          date = EXCLUDED.date,
          time = EXCLUDED.time,
          direction = EXCLUDED.direction,
          payment_method = EXCLUDED.payment_method,
          billing_cycle = EXCLUDED.billing_cycle,
          notes = EXCLUDED.notes,
          bank_name = EXCLUDED.bank_name,
          masked_account = EXCLUDED.masked_account,
          account_last4 = EXCLUDED.account_last4,
          reference_id = EXCLUDED.reference_id,
          sms_reference_id = EXCLUDED.sms_reference_id,
          upi_reference = EXCLUDED.upi_reference,
          raw_sms_text = EXCLUDED.raw_sms_text,
          merchant = EXCLUDED.merchant,
          payee = EXCLUDED.payee,
          source = EXCLUDED.source,
          active = EXCLUDED.active,
          is_deleted = EXCLUDED.is_deleted,
          deleted_at = CASE WHEN EXCLUDED.is_deleted THEN COALESCE(transactions.deleted_at, CURRENT_TIMESTAMP) ELSE NULL END,
          client_updated_at = EXCLUDED.client_updated_at,
          updated_at = CURRENT_TIMESTAMP
        WHERE EXCLUDED.client_updated_at > COALESCE(NULLIF(transactions.client_updated_at, 0), (EXTRACT(EPOCH FROM transactions.updated_at) * 1000)::bigint)
        RETURNING id;
      `;

      try {
        const result = await pool.query(upsertQuery, [
          recId,
          workspaceId || `usr_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
          userEmail || null,
          name,
          amount,
          category,
          date,
          record.time || null,
          direction,
          record.paymentMethod || record.payment_method || null,
          record.billingCycle || record.billing_cycle || null,
          record.notes || null,
          record.bankName || record.bank_name || null,
          record.maskedAccount || record.masked_account || null,
          record.accountLast4 || record.account_last4 || null,
          record.referenceId || record.reference_id || null,
          record.smsReferenceId || record.sms_reference_id || null,
          record.upiReference || record.upi_reference || null,
          record.rawSmsText || record.raw_sms_text || null,
          record.merchant || null,
          record.payee || null,
          record.source || "sync",
          record.active !== false,
          isDeleted,
          isDeleted ? clientUpdatedAtIso : null,
          clientUpdatedAtMs,
        ]);

        if (result.rowCount && result.rowCount > 0) {
          pushedCount++;
          appliedIds.push(recId);
        } else {
          skippedIds.push(recId);
        }
      } catch (insertErr) {
        console.error(`[DeltaSync] Error upserting transaction ${recId}:`, insertErr);
      }
    }

    // 3. Capture current database server timestamp (synchronous with Neon Postgres clock)
    const { rows: tsRows } = await pool.query("SELECT CURRENT_TIMESTAMP AS now");
    const serverTimestamp = tsRows[0]?.now ? new Date(tsRows[0].now).toISOString() : new Date().toISOString();

    // 4. PULL PHASE: Query records where updated_at > last_sync_timestamp
    const pullQuery = `
      SELECT
        id, workspace_identifier, user_email, name, amount, category, date, time,
        direction, payment_method, billing_cycle, notes, bank_name, masked_account,
        account_last4, reference_id, sms_reference_id, upi_reference, raw_sms_text,
        merchant, payee, source, active, is_deleted, deleted_at, created_at, updated_at
      FROM transactions
      WHERE (workspace_identifier = $1 OR ($2 != '' AND LOWER(user_email) = $2))
        AND updated_at > $3
      ORDER BY updated_at ASC;
    `;

    const { rows: pulledRows } = await pool.query(pullQuery, [
      workspaceId,
      userEmail,
      lastSyncDate.toISOString(),
    ]);

    const formattedPulled = pulledRows.map((r: any) => ({
      id: r.id,
      name: r.name,
      amount: Number(r.amount),
      category: r.category,
      date: r.date,
      time: r.time,
      direction: r.direction,
      transactionType: r.direction,
      paymentMethod: r.payment_method,
      billingCycle: r.billing_cycle,
      notes: r.notes,
      bankName: r.bank_name,
      maskedAccount: r.masked_account,
      accountLast4: r.account_last4,
      referenceId: r.reference_id,
      smsReferenceId: r.sms_reference_id,
      upiReference: r.upi_reference,
      rawSmsText: r.raw_sms_text,
      merchant: r.merchant,
      payee: r.payee,
      source: r.source,
      active: r.active,
      is_deleted: Boolean(r.is_deleted),
      isDeleted: Boolean(r.is_deleted),
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : serverTimestamp,
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
      created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
    }));

    return res.status(200).json({
      success: true,
      server_timestamp: serverTimestamp,
      pulled_records: formattedPulled,
      pushed_count: pushedCount,
      pulled_count: formattedPulled.length,
      applied_ids: appliedIds,
      skipped_ids: skippedIds,
    });
  } catch (err: any) {
    console.error("[SyncService] Error in handleDeltaSync:", err);
    return res.status(500).json({ success: false, error: err?.message || "Internal server error" });
  }
}

export function registerSyncRoutes(app: Express): void {
  // Bidirectional timestamp delta sync
  app.post("/api/sync", handleDeltaSync);
  app.get("/api/sync", handleDeltaSync);
  app.post("/api/sync/delta", handleDeltaSync);
  app.get("/api/sync/delta", handleDeltaSync);

  app.get("/api/sync/workspace", handleGetWorkspace);
  app.post("/api/sync/workspace", handlePostWorkspace);
  app.get("/api/sync/transactions", handleGetTransactions);
  app.post("/api/sync/transactions", handlePostTransactions);
  app.get("/api/sync/devices", handleGetDevices);
  app.post("/api/sync/devices/heartbeat", handlePostHeartbeat);
  app.delete("/api/sync/devices/:deviceId", handleDeleteDevice);
}

/**
 * Vite plugin for dev server support so /api/sync/* routes respond immediately in development mode.
 */
export function syncVitePlugin() {
  return {
    name: "sync-vite-plugin",
    configureServer(server: any) {
      void initDb().catch((err) => console.warn('[SyncService] Neon DB init notice:', err?.message || err));

      server.middlewares.use(async (req: any, res: any, next: any) => {
        let pathname = "";
        try {
          const rawUrl = req.url || "";
          pathname = rawUrl.startsWith("/")
            ? rawUrl.split("?")[0]
            : new URL(rawUrl, "http://localhost").pathname;
        } catch {
          pathname = (req.url || "").split("?")[0];
        }

        pathname = pathname.replace(/\/+$/, "") || "/";

        if (!pathname.startsWith("/api/sync")) {
          return next();
        }

        const enhancedRes = Object.assign(res, {
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(data: any) {
            if (!this.headersSent) {
              this.setHeader("Content-Type", "application/json");
            }
            this.end(JSON.stringify(data));
          },
        });

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS, HEAD");
        res.setHeader("Access-Control-Allow-Headers", "*");

        const method = (req.method || "").toUpperCase();
        if (method === "OPTIONS") {
          res.statusCode = 204;
          return res.end();
        }

        const urlObj = new URL(req.url || "", "http://localhost");
        const query: Record<string, string> = {};
        urlObj.searchParams.forEach((val, key) => {
          query[key] = val;
        });
        req.query = query;

        if (method === "POST") {
          let bodyData = "";
          for await (const chunk of req) {
            bodyData += chunk;
          }
          try {
            req.body = bodyData ? JSON.parse(bodyData) : {};
          } catch {
            req.body = {};
          }
        }

        if (pathname === "/api/sync/workspace" && method === "GET") {
          return handleGetWorkspace(req, enhancedRes);
        }

        if ((pathname === "/api/sync" || pathname === "/api/sync/delta") && (method === "POST" || method === "GET")) {
          return handleDeltaSync(req, enhancedRes);
        }

        if (pathname === "/api/sync/workspace" && method === "POST") {
          return handlePostWorkspace(req, enhancedRes);
        }

        if (pathname === "/api/sync/transactions" && method === "GET") {
          return handleGetTransactions(req, enhancedRes);
        }

        if (pathname === "/api/sync/transactions" && method === "POST") {
          return handlePostTransactions(req, enhancedRes);
        }

        if (pathname === "/api/sync/devices" && method === "GET") {
          return handleGetDevices(req, enhancedRes);
        }

        if (pathname === "/api/sync/devices/heartbeat" && method === "POST") {
          return handlePostHeartbeat(req, enhancedRes);
        }

        if (pathname.startsWith("/api/sync/devices/") && method === "DELETE") {
          req.params = { deviceId: pathname.replace("/api/sync/devices/", "") };
          return handleDeleteDevice(req, enhancedRes);
        }

        return next();
      });
    },
  };
}
