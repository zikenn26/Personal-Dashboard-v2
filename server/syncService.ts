import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { pool, initDb } from "./db.js";
import { broadcastWorkspaceUpdate, setupSyncWebSocket, getSyncWsStats, revokePreviousUserSessions } from "./syncWebSocket.js";

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

    // Broadcast real-time update to all connected WebSocket clients in the user's room
    try {
      broadcastWorkspaceUpdate(activeKey, {
        type: "WORKSPACE_UPDATED",
        userIdentifier: activeKey,
        module: "all",
        action: "UPSERT",
        fullWorkspace: mergedWorkspace,
        vectorTimestamp: finalVersion,
        syncVersion: finalVersion,
        sourceDeviceId: req.body?.device_id || (isFromApk ? "apk_device" : "web_device"),
        timestamp: now,
      });
    } catch (wsErr) {
      console.warn("[SyncService] Notice broadcasting to WebSocket clients:", wsErr);
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

    // Reject heartbeat if device was revoked by a newer login
    if (existing && existing.is_revoked) {
      return res.status(200).json({
        success: false,
        revoked: true,
        message: "Device session has been revoked because your account was signed in on another device",
      });
    }

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
    const acceptedMutationIds: string[] = [];
    const rejectedMutationIds: string[] = [];

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
          if (item.mutation_id) acceptedMutationIds.push(String(item.mutation_id));
          await appendLegacyExpenseMutation(workspaceId, userEmail, String(body.device_id || "legacy-device"), recId);
        } else {
          skippedIds.push(recId);
          if (item.mutation_id) rejectedMutationIds.push(String(item.mutation_id));
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
      accepted_mutation_ids: acceptedMutationIds,
      rejected_mutation_ids: rejectedMutationIds,
    });
  } catch (err: any) {
    console.error("[SyncService] Error in handleDeltaSync:", err);
    return res.status(500).json({ success: false, error: err?.message || "Internal server error" });
  }
}

/** Bridge accepted legacy expense writes into the revisioned change stream. */
async function appendLegacyExpenseMutation(workspaceId: string, userEmail: string, deviceId: string, expenseId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [workspaceId, `expenses:${expenseId}`]);
    const transaction = await client.query(
      "SELECT * FROM transactions WHERE workspace_identifier = $1 AND id = $2",
      [workspaceId, expenseId]
    );
    if (!transaction.rows.length) {
      await client.query("ROLLBACK");
      return;
    }
    const row = transaction.rows[0];
    const payload = {
      id: row.id, name: row.name, amount: Number(row.amount), category: row.category,
      date: row.date, time: row.time, direction: row.direction, paymentMethod: row.payment_method,
      billingCycle: row.billing_cycle, notes: row.notes, bankName: row.bank_name,
      maskedAccount: row.masked_account, accountLast4: row.account_last4,
      referenceId: row.reference_id, smsReferenceId: row.sms_reference_id,
      upiReference: row.upi_reference, rawSmsText: row.raw_sms_text,
      merchant: row.merchant, payee: row.payee, source: row.source,
      active: row.active, is_deleted: Boolean(row.is_deleted),
    };
    const current = await client.query(
      "SELECT revision FROM sync_entities WHERE workspace_identifier = $1 AND module = 'expenses' AND entity_id = $2 FOR UPDATE",
      [workspaceId, expenseId]
    );
    const baseRevision = Number(current.rows[0]?.revision || 0);
    const revision = baseRevision + 1;
    const mutationId = `legacy-${crypto.randomUUID()}`;
    const payloadHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    await client.query(`
      INSERT INTO sync_entities (workspace_identifier, user_email, module, entity_id, revision, payload, is_deleted, updated_at)
      VALUES ($1, $2, 'expenses', $3, $4, $5::jsonb, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (workspace_identifier, module, entity_id) DO UPDATE SET
        user_email = EXCLUDED.user_email, revision = EXCLUDED.revision, payload = EXCLUDED.payload,
        is_deleted = EXCLUDED.is_deleted, updated_at = CURRENT_TIMESTAMP
    `, [workspaceId, userEmail, expenseId, revision, JSON.stringify(payload), Boolean(row.is_deleted)]);
    await client.query(`
      INSERT INTO sync_mutations
        (mutation_id, workspace_identifier, user_email, device_id, module, entity_id, operation, base_revision, revision, payload, payload_hash)
      VALUES ($1, $2, $3, $4, 'expenses', $5, $6, $7, $8, $9::jsonb, $10)
    `, [mutationId, workspaceId, userEmail, deviceId, expenseId, row.is_deleted ? "delete" : "upsert",
      baseRevision, revision, JSON.stringify(payload), payloadHash]);
    await client.query("COMMIT");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.warn("[SyncService] Legacy expense change bridge notice:", err);
  } finally {
    client.release();
  }
}

/**
 * Versioned operation sync API. Mutations use optimistic entity revisions and
 * stable IDs; pulls use a server sequence cursor rather than client timestamps.
 * The legacy snapshot and timestamp endpoints remain available during migration.
 */
export async function handleSyncV2(req: any, res: any): Promise<void> {
  let client: any;
  try {
    client = await pool.connect();
    const body = req.body || {};
    const workspaceId = String(body.workspace_identifier || body.user_identifier || "").trim();
    const userEmail = String(body.user_email || "").trim().toLowerCase();
    const deviceId = String(body.device_id || "").trim();
    const cursorText = String(body.cursor ?? req.query?.cursor ?? "0");
    const cursor = /^\d+$/.test(cursorText) ? cursorText : "0";
    const mutations = Array.isArray(body.mutations) ? body.mutations : [];

    if (!workspaceId || !deviceId) {
      return res.status(400).json({ success: false, error: "workspace_identifier and device_id are required" });
    }
    const authorization = String(req.headers?.authorization || "");
    const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!bearerToken || !userEmail) {
      return res.status(401).json({ success: false, error: "An authenticated session and user_email are required" });
    }
    const sessionResult = await pool.query(
      "SELECT device_id FROM user_active_sessions WHERE token = $1 AND LOWER(user_email) = $2",
      [bearerToken, userEmail]
    );
    if (!sessionResult.rows.length || sessionResult.rows[0].device_id !== deviceId) {
      return res.status(401).json({ success: false, error: "Session is not active on this device" });
    }
    if (mutations.length > 250) {
      return res.status(413).json({ success: false, error: "A sync batch may contain at most 250 mutations" });
    }
    if (body.snapshot === true) {
      const entity = await pool.query(
        "SELECT payload, revision FROM sync_entities WHERE workspace_identifier = $1 AND user_email = $2 AND module = 'workspace' AND entity_id = 'root' AND is_deleted = false",
        [workspaceId, userEmail]
      );
      let snapshot = entity.rows.length
        ? { payload: entity.rows[0].payload, revision: Number(entity.rows[0].revision) }
        : null;
      if (!snapshot) {
        const legacy = await pool.query(
          "SELECT workspace_data FROM workspaces WHERE user_identifier = $1 AND LOWER(user_email) = $2",
          [workspaceId, userEmail]
        );
        if (legacy.rows.length) snapshot = { payload: legacy.rows[0].workspace_data, revision: 0 };
      }
      const latest = await pool.query("SELECT COALESCE(MAX(server_cursor), 0)::text AS cursor FROM sync_mutations WHERE workspace_identifier = $1 AND user_email = $2", [workspaceId, userEmail]);
      return res.status(200).json({ success: true, snapshot, next_cursor: String(latest.rows[0]?.cursor || "0"), changes: [], has_more: false, accepted_mutation_ids: [], conflicts: [] });
    }

    const accepted: string[] = [];
    const conflicts: any[] = [];
    await client.query("BEGIN");
    const orderedMutations = [...mutations].sort((a: any, b: any) =>
      `${a?.module || ""}:${a?.entity_id || ""}:${a?.mutation_id || ""}`.localeCompare(
        `${b?.module || ""}:${b?.entity_id || ""}:${b?.mutation_id || ""}`
      )
    );
    for (const mutation of orderedMutations) {
      const mutationId = String(mutation?.mutation_id || "").trim();
      const moduleName = String(mutation?.module || "").trim();
      const entityId = String(mutation?.entity_id || "").trim();
      const operation = String(mutation?.operation || "").trim().toLowerCase();
      const baseRevision = Number(mutation?.base_revision ?? 0);
      if (!mutationId || mutationId.length > 128 || !/^[a-z0-9_.-]{1,64}$/i.test(moduleName) ||
          !entityId || entityId.length > 256 || !["upsert", "delete"].includes(operation) ||
          !Number.isSafeInteger(baseRevision) || baseRevision < 0) {
        throw Object.assign(new Error("Invalid mutation envelope"), { statusCode: 400 });
      }

      const payload = mutation?.payload && typeof mutation.payload === "object" ? mutation.payload : {};
      const canonical = (value: any): any => Array.isArray(value)
        ? value.map(canonical)
        : value && typeof value === "object"
          ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
          : value;
      const payloadHash = crypto.createHash("sha256").update(JSON.stringify(canonical({ moduleName, entityId, operation, baseRevision, payload }))).digest("hex");
      // Serialize same-ID retries and same-entity writes, including first creates
      // where SELECT FOR UPDATE alone cannot lock a row that does not exist yet.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [workspaceId, `mutation:${mutationId}`]);
      const duplicate = await client.query(
        "SELECT workspace_identifier, payload_hash FROM sync_mutations WHERE mutation_id = $1",
        [mutationId]
      );
      if (duplicate.rows.length) {
        if (duplicate.rows[0].workspace_identifier !== workspaceId || duplicate.rows[0].payload_hash !== payloadHash) {
          throw Object.assign(new Error("Mutation ID was reused with different content"), { statusCode: 409 });
        }
        accepted.push(mutationId);
        continue;
      }

      await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [workspaceId, `${moduleName}:${entityId}`]);
      const currentResult = await client.query(
        "SELECT user_email, revision, payload, is_deleted FROM sync_entities WHERE workspace_identifier = $1 AND module = $2 AND entity_id = $3 FOR UPDATE",
        [workspaceId, moduleName, entityId]
      );
      const current = currentResult.rows[0];
      if (current && String(current.user_email).toLowerCase() !== userEmail) {
        throw Object.assign(new Error("Workspace is not owned by this signed-in account"), { statusCode: 403 });
      }
      const currentRevision = current ? Number(current.revision) : 0;
      if (currentRevision !== baseRevision) {
        conflicts.push({ mutation_id: mutationId, module: moduleName, entity_id: entityId,
          expected_revision: baseRevision, current_revision: currentRevision,
          current: current ? { payload: current.payload, is_deleted: current.is_deleted } : null });
        continue;
      }

      const nextRevision = currentRevision + 1;
      const isDeleted = operation === "delete";
      await client.query(`
        INSERT INTO sync_entities (workspace_identifier, user_email, module, entity_id, revision, payload, is_deleted, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, CURRENT_TIMESTAMP)
        ON CONFLICT (workspace_identifier, module, entity_id) DO UPDATE SET
          revision = EXCLUDED.revision, payload = EXCLUDED.payload,
          is_deleted = EXCLUDED.is_deleted, updated_at = CURRENT_TIMESTAMP
      `, [workspaceId, userEmail, moduleName, entityId, nextRevision, JSON.stringify(payload), isDeleted]);
      // Keep the established transaction table current while old app versions
      // still read it. This makes v2 expense writes visible to legacy clients.
      if (moduleName === "expenses") {
        const amount = Math.round(Math.abs(Number((payload as any).amount) || 0) * 100) / 100;
        const name = String((payload as any).name || (payload as any).payee || (payload as any).merchant || "Expense").trim();
        const category = String((payload as any).category || "Other").trim();
        const date = String((payload as any).date || new Date().toISOString().slice(0, 10));
        const direction = String((payload as any).direction || "DEBIT").toUpperCase() === "CREDIT" ? "CREDIT" : "DEBIT";
        await client.query(`
          INSERT INTO transactions (
            id, workspace_identifier, user_email, name, amount, category, date, time, direction,
            payment_method, billing_cycle, notes, bank_name, masked_account, account_last4,
            reference_id, sms_reference_id, upi_reference, raw_sms_text, merchant, payee,
            source, active, is_deleted, deleted_at, client_updated_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
            $22, $23, $24, CASE WHEN $24 THEN CURRENT_TIMESTAMP ELSE NULL END,
            $25, CURRENT_TIMESTAMP
          ) ON CONFLICT (id) DO UPDATE SET
            workspace_identifier = EXCLUDED.workspace_identifier, user_email = EXCLUDED.user_email,
            name = EXCLUDED.name, amount = EXCLUDED.amount, category = EXCLUDED.category,
            date = EXCLUDED.date, time = EXCLUDED.time, direction = EXCLUDED.direction,
            payment_method = EXCLUDED.payment_method, billing_cycle = EXCLUDED.billing_cycle,
            notes = EXCLUDED.notes, bank_name = EXCLUDED.bank_name, masked_account = EXCLUDED.masked_account,
            account_last4 = EXCLUDED.account_last4, reference_id = EXCLUDED.reference_id,
            sms_reference_id = EXCLUDED.sms_reference_id, upi_reference = EXCLUDED.upi_reference,
            raw_sms_text = EXCLUDED.raw_sms_text, merchant = EXCLUDED.merchant, payee = EXCLUDED.payee,
            source = EXCLUDED.source, active = EXCLUDED.active, is_deleted = EXCLUDED.is_deleted,
            deleted_at = EXCLUDED.deleted_at, client_updated_at = EXCLUDED.client_updated_at,
            updated_at = CURRENT_TIMESTAMP
        `, [entityId, workspaceId, userEmail, name, amount, category, date, (payload as any).time || null,
          direction, (payload as any).paymentMethod || (payload as any).payment_method || null,
          (payload as any).billingCycle || (payload as any).billing_cycle || null, (payload as any).notes || null,
          (payload as any).bankName || (payload as any).bank_name || null, (payload as any).maskedAccount || (payload as any).masked_account || null,
          (payload as any).accountLast4 || (payload as any).account_last4 || null, (payload as any).referenceId || (payload as any).reference_id || null,
          (payload as any).smsReferenceId || (payload as any).sms_reference_id || null, (payload as any).upiReference || (payload as any).upi_reference || null,
          (payload as any).rawSmsText || (payload as any).raw_sms_text || null, (payload as any).merchant || null, (payload as any).payee || null,
          (payload as any).source || "sync", (payload as any).active !== false, isDeleted, Date.now()]);
      } else if (moduleName === "workspace" && entityId === "root") {
        await client.query(`
          INSERT INTO workspaces (user_identifier, user_email, workspace_data, updated_at, sync_version)
          VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP::text, $4)
          ON CONFLICT (user_identifier) DO UPDATE SET
            user_email = EXCLUDED.user_email, workspace_data = EXCLUDED.workspace_data,
            updated_at = EXCLUDED.updated_at, sync_version = EXCLUDED.sync_version
        `, [workspaceId, userEmail, JSON.stringify(payload), nextRevision]);
      }
      await client.query(`
        INSERT INTO sync_mutations
          (mutation_id, workspace_identifier, user_email, device_id, module, entity_id, operation, base_revision, revision, payload, payload_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
      `, [mutationId, workspaceId, userEmail, deviceId, moduleName, entityId, operation, baseRevision, nextRevision, JSON.stringify(payload), payloadHash]);
      accepted.push(mutationId);
    }
    await client.query("COMMIT");

    for (const mutation of orderedMutations) {
      const mutationId = String(mutation?.mutation_id || "");
      if (!accepted.includes(mutationId)) continue;
      if (String(mutation?.module) === "workspace" && String(mutation?.entity_id) === "root") {
        broadcastWorkspaceUpdate(workspaceId, {
          type: "WORKSPACE_UPDATED", userIdentifier: workspaceId, module: "all", action: "UPSERT",
          fullWorkspace: mutation.payload, sourceDeviceId: deviceId, timestamp: new Date().toISOString(),
        });
      } else if (String(mutation?.module) === "expenses") {
        const payload = mutation.payload && typeof mutation.payload === "object" ? mutation.payload : {};
        broadcastWorkspaceUpdate(workspaceId, {
          type: "WORKSPACE_UPDATED", userIdentifier: workspaceId, module: "expenses",
          action: String(mutation.operation) === "delete" ? "DELETE" : "UPSERT",
          fullWorkspace: String(mutation.operation) === "delete"
            ? { deletedExpenseIds: [String(mutation.entity_id)] }
            : { expenses: [payload] },
          sourceDeviceId: deviceId, timestamp: new Date().toISOString(),
        });
      }
    }

    const pulled = await pool.query(`
      SELECT server_cursor, mutation_id, device_id, module, entity_id, operation, base_revision, revision, payload
      FROM sync_mutations WHERE workspace_identifier = $1 AND user_email = $2 AND server_cursor > $3
      ORDER BY server_cursor ASC LIMIT 1000
    `, [workspaceId, userEmail, cursor]);
    const latest = await pool.query("SELECT COALESCE(MAX(server_cursor), 0)::text AS cursor FROM sync_mutations WHERE workspace_identifier = $1 AND user_email = $2", [workspaceId, userEmail]);
    return res.status(200).json({
      success: true,
      accepted_mutation_ids: accepted,
      conflicts,
      changes: pulled.rows.map((row: any) => ({
        cursor: String(row.server_cursor), mutation_id: row.mutation_id, device_id: row.device_id,
        module: row.module, entity_id: row.entity_id, operation: row.operation,
        base_revision: Number(row.base_revision || 0), revision: Number(row.revision), payload: row.payload,
      })),
      next_cursor: pulled.rows.length ? String(pulled.rows[pulled.rows.length - 1].server_cursor) : String(latest.rows[0]?.cursor || cursor),
      has_more: pulled.rows.length === 1000,
    });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch {}
    const status = Number(err?.statusCode) || 500;
    return res.status(status).json({ success: false, error: err?.message || "Sync protocol error" });
  } finally {
    client?.release();
  }
}

// Session cache for issued Neon DB bearer tokens with singleton device enforcement
interface SessionData {
  user: any;
  token: string;
  deviceId: string;
  deviceName: string;
  createdAt: number;
  expiresAt: number;
  revoked?: boolean;
  revokedReason?: string;
  revokedByDevice?: string;
}
const activeSessions = new Map<string, SessionData>();
// Maps user_email to their single active token
const userActiveTokens = new Map<string, string>();
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function pruneExpiredSessions(now = Date.now()): void {
  for (const [token, session] of activeSessions) {
    if (session.expiresAt <= now) activeSessions.delete(token);
  }
}

function parseReadableDeviceName(req: any, explicitName?: string): string {
  if (explicitName && explicitName.trim()) {
    return explicitName.trim();
  }
  const ua = String(req.headers?.["user-agent"] || "");
  if (/Android/i.test(ua)) return "Android APK App";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Macintosh|Mac OS/i.test(ua)) return "Safari on macOS";
  if (/Windows/i.test(ua)) return "Google Chrome on Windows";
  if (/Linux/i.test(ua)) return "Browser on Linux";
  return "Web Browser";
}

function verifyPasswordRecord(record: any, attemptedPass: string): boolean {
  try {
    let parsed = record;
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    if (!parsed || !parsed.salt || !parsed.hash) return false;
    const saltBuf = Buffer.from(parsed.salt, "base64");
    const iterations = Number(parsed.iterations) || 210000;
    const derived = crypto.pbkdf2Sync(attemptedPass, saltBuf, iterations, 32, "sha256");
    const derivedB64 = derived.toString("base64");
    return crypto.timingSafeEqual(Buffer.from(derivedB64), Buffer.from(parsed.hash));
  } catch {
    return false;
  }
}

export async function handleAuthLogin(req: any, res: any): Promise<void> {
  try {
    pruneExpiredSessions();
    const body = req.body || {};
    const identifier = String(body.email || body.username || body.identifier || "").trim().toLowerCase();
    const password = String(body.password || "").trim();

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Missing email/username or password" });
    }

    const cleanId = identifier.replace(/[^a-z0-9]/g, "_");
    const emailVariant = identifier.includes("@") ? identifier : `${cleanId}@workspace.local`;

    let matchedUser: any = null;

    // 1. Try querying Neon DB workspaces for account record
    try {
      const { rows } = await pool.query(
        `SELECT workspace_data, user_email, user_identifier FROM workspaces 
         WHERE user_identifier = $1 OR user_identifier = $2 OR LOWER(user_email) = $3 
         LIMIT 1`,
        [`account_auth_${cleanId}`, `account_auth_${identifier}`, identifier]
      );

      if (rows && rows.length > 0) {
        const wsData = typeof rows[0].workspace_data === "string" 
          ? JSON.parse(rows[0].workspace_data) 
          : rows[0].workspace_data;
        const account = wsData?.account;
        if (account && account.passHash) {
          const isValid = verifyPasswordRecord(account.passHash, password);
          if (isValid) {
            matchedUser = {
              id: account.user?.id || `usr_${cleanId}`,
              email: rows[0].user_email || emailVariant,
              name: account.user?.name || identifier.split("@")[0],
              avatarUrl: account.user?.avatarUrl || "",
              createdAt: account.user?.createdAt || Date.now(),
              lastLoginAt: Date.now(),
              provider: "neon",
            };
          }
        }
      }
    } catch (dbErr: any) {
      console.warn("[SyncService] DB lookup error during login:", dbErr?.message);
    }

    // 2. Authoritative default account fallback (e.g. gknayak@gmail.com / Gulshan@12345!)
    if (!matchedUser) {
      const isGkn = identifier === "gknayak@gmail.com" || identifier === "gknayak";
      const isArpita = identifier === "arpitapri125@gmail.com" || identifier === "arpitapri125";
      if ((isGkn || isArpita) && password === "Gulshan@12345!") {
        matchedUser = {
          id: isGkn ? "036fe7d3-6a13-4740-b028-afb55e81e00e" : "usr_arpitapri125_gmail_com",
          email: isGkn ? "gknayak@gmail.com" : "arpitapri125@gmail.com",
          name: isGkn ? "Gulshan Kumar Nayak" : "Arpita Priyadar",
          provider: "neon",
          avatarUrl: isGkn ? "https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp" : "",
          createdAt: 1788945035065,
          lastLoginAt: Date.now(),
        };
      }
    }

    if (!matchedUser) {
      return res.status(401).json({ success: false, message: "Invalid email/username or password" });
    }

    // Singleton session enforcement: extract device identifier & human-readable name
    const deviceId = String(body.device_id || body.deviceId || "").trim() || `device_${crypto.randomBytes(6).toString("hex")}`;
    const deviceName = parseReadableDeviceName(req, String(body.device_name || body.deviceName || "").trim());

    const userEmail = (matchedUser.email || emailVariant).toLowerCase().trim();
    const userId = String(matchedUser.id || `usr_${cleanId}`).trim();

    // 1. Invalidate older sessions for this user in-memory
    for (const [existingTok, sess] of activeSessions.entries()) {
      const sessEmail = (sess.user?.email || "").toLowerCase().trim();
      const sessId = String(sess.user?.id || "").trim();
      if ((sessEmail === userEmail || sessId === userId) && sess.deviceId !== deviceId) {
        sess.revoked = true;
        sess.revokedReason = "new_login";
        sess.revokedByDevice = deviceName;
      }
    }

    // 2. Revoke older devices for this user in Neon PostgreSQL
    try {
      await pool.query(
        "UPDATE devices SET is_revoked = true WHERE (LOWER(user_email) = $1 OR user_identifier = $2) AND id != $3",
        [userEmail, userId, deviceId]
      );
      await pool.query(
        "UPDATE connected_devices SET is_revoked = true WHERE (LOWER(user_email) = $1 OR user_identifier = $2) AND id != $3",
        [userEmail, userId, deviceId]
      ).catch(() => {});
    } catch (dbErr: any) {
      console.warn("[SyncService] Notice revoking older devices in DB:", dbErr?.message);
    }

    // 3. Forcefully revoke any active WebSockets for this user on other devices immediately
    try {
      revokePreviousUserSessions(
        [userEmail, userId, `account_auth_${cleanId}`, `account_auth_${identifier}`],
        deviceId,
        deviceName
      );
    } catch (wsErr: any) {
      console.warn("[SyncService] Notice revoking WebSocket connections:", wsErr?.message);
    }

    // Generate secure session bearer token
    const token = `neon_tok_${crypto.randomBytes(32).toString("hex")}`;
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;
    activeSessions.set(token, {
      user: matchedUser,
      token,
      deviceId,
      deviceName,
      createdAt: now,
      expiresAt,
    });
    userActiveTokens.set(userEmail, token);
    if (userId) userActiveTokens.set(userId, token);

    // 4. Record new active singleton session in Neon DB
    try {
      await pool.query(`
        INSERT INTO user_active_sessions (user_email, token, device_id, device_name, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (user_email) DO UPDATE SET
          token = EXCLUDED.token,
          device_id = EXCLUDED.device_id,
          device_name = EXCLUDED.device_name,
          created_at = EXCLUDED.created_at,
          updated_at = CURRENT_TIMESTAMP
      `, [userEmail, token, deviceId, deviceName, now]);
    } catch (sessDbErr: any) {
      console.warn("[SyncService] Notice recording user_active_sessions:", sessDbErr?.message);
    }

    console.info(`[SyncService] Singleton session established for ${userEmail} on ${deviceName} (${deviceId})`);

    return res.status(200).json({
      success: true,
      token,
      user: matchedUser,
      device_id: deviceId,
      device_name: deviceName,
      message: "Signed in successfully via Neon DB pool",
    });
  } catch (err: any) {
    console.error("[SyncService] handleAuthLogin error:", err);
    return res.status(500).json({ success: false, message: "Internal authentication error" });
  }
}

export async function handleAuthVerify(req: any, res: any): Promise<void> {
  try {
    pruneExpiredSessions();
    let token = "";
    const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (req.query?.token) {
      token = String(req.query.token).trim();
    } else if (req.body?.token) {
      token = String(req.body.token).trim();
    }

    if (!token) {
      return res.status(401).json({ success: false, valid: false, message: "Missing token" });
    }

    const session = activeSessions.get(token);
    if (session) {
      if (session.revoked) {
        return res.status(401).json({
          success: false,
          valid: false,
          revoked: true,
          newDeviceName: session.revokedByDevice || "another device",
          message: `Logged out because your account was signed in on ${session.revokedByDevice || "another device"}`,
        });
      }
      return res.status(200).json({ success: true, valid: true, user: session.user });
    }

    // Check against Neon DB user_active_sessions
    try {
      const userEmail = String(req.query?.user_email || req.body?.user_email || "").trim().toLowerCase();
      if (userEmail) {
        const { rows } = await pool.query(
          "SELECT token, device_id, device_name, created_at FROM user_active_sessions WHERE LOWER(user_email) = $1",
          [userEmail]
        );
        if (rows.length > 0) {
          const activeRow = rows[0];
          const createdAt = Number(activeRow.created_at);
          if (Number.isFinite(createdAt) && createdAt > 0 && createdAt + SESSION_TTL_MS <= Date.now()) {
            return res.status(401).json({ success: false, valid: false, message: "Expired token" });
          }
          if (activeRow.token && activeRow.token !== token) {
            return res.status(401).json({
              success: false,
              valid: false,
              revoked: true,
              newDeviceName: activeRow.device_name || "another device",
              message: `Logged out because your account was signed in on ${activeRow.device_name || "another device"}`,
            });
          }
          if (activeRow.token === token) {
            return res.status(200).json({ success: true, valid: true, message: "Session active" });
          }
        }
      } else {
        const { rows } = await pool.query(
          "SELECT user_email, token, device_name, created_at FROM user_active_sessions WHERE token = $1",
          [token]
        );
        if (rows.length > 0) {
          const createdAt = Number(rows[0].created_at);
          if (Number.isFinite(createdAt) && createdAt > 0 && createdAt + SESSION_TTL_MS <= Date.now()) {
            return res.status(401).json({ success: false, valid: false, message: "Expired token" });
          }
          return res.status(200).json({ success: true, valid: true, message: "Session active" });
        }
      }
    } catch (dbErr: any) {
      console.warn("[SyncService] DB verify error:", dbErr?.message);
    }

    // Unknown tokens fail closed when the database is unavailable. Token shape alone
    // cannot establish that a session is active or has not been revoked.
    return res.status(401).json({ success: false, valid: false, message: "Invalid or expired token" });
  } catch (err: any) {
    return res.status(500).json({ success: false, valid: false, error: err?.message });
  }
}

export function registerSyncRoutes(app: Express): void {
  // Auth routes powered by Neon DB pool
  app.post("/api/auth/login", handleAuthLogin);
  app.get("/api/auth/verify", handleAuthVerify);
  app.post("/api/auth/verify", handleAuthVerify);

  // Bidirectional timestamp delta sync
  app.post("/api/sync", handleDeltaSync);
  app.get("/api/sync", handleDeltaSync);
  app.post("/api/sync/delta", handleDeltaSync);
  app.get("/api/sync/delta", handleDeltaSync);
  app.post("/api/sync/v2", handleSyncV2);
  app.get("/api/sync/v2", handleSyncV2);

  app.get("/api/sync/workspace", handleGetWorkspace);
  app.post("/api/sync/workspace", handlePostWorkspace);
  app.get("/api/sync/transactions", handleGetTransactions);
  app.post("/api/sync/transactions", handlePostTransactions);
  app.get("/api/sync/devices", handleGetDevices);
  app.post("/api/sync/devices/heartbeat", handlePostHeartbeat);
  app.delete("/api/sync/devices/:deviceId", handleDeleteDevice);
  app.get("/api/sync/ws-status", (_req, res) => {
    res.json(getSyncWsStats());
  });
}

/**
 * Vite plugin for dev server support so /api/sync/* and /api/auth/* routes respond immediately in development mode.
 */
export function syncVitePlugin() {
  return {
    name: "sync-vite-plugin",
    configureServer(server: any) {
      if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
        void initDb().catch((err) => console.warn('[SyncService] Neon DB init notice:', err?.message || err));
      }
      if (server.httpServer) {
        setupSyncWebSocket(server.httpServer);
      }

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

        if (!pathname.startsWith("/api/sync") && !pathname.startsWith("/api/auth")) {
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

        // Auth endpoints
        if (pathname === "/api/auth/login" && method === "POST") {
          return handleAuthLogin(req, enhancedRes);
        }

        if (pathname === "/api/auth/verify" && (method === "GET" || method === "POST")) {
          return handleAuthVerify(req, enhancedRes);
        }

        // Sync endpoints
        if (pathname === "/api/sync/v2" && (method === "POST" || method === "GET")) {
          return handleSyncV2(req, enhancedRes);
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

        if (pathname === "/api/sync/ws-status" && method === "GET") {
          return enhancedRes.json(getSyncWsStats());
        }

        return next();
      });
    },
  };
}
