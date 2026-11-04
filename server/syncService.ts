import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { pool, initDb } from "./db.js";

export async function handleGetDevices(req: any, res: any): Promise<void> {
  try {
    const token = readBearerToken(req);
    if (!token) return res.status(401).json({ success: false, error: "Authenticated session required" });
    const sessionResult = await pool.query(`
      SELECT s.user_email, s.created_at
      FROM user_active_sessions s
      JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
      JOIN app_users u ON LOWER(u.email) = LOWER(s.user_email)
      WHERE s.token = $1 LIMIT 1
    `, [token]);
    const session = sessionResult.rows[0];
    if (!session || Number(session.created_at) + SESSION_TTL_MS <= Date.now()) {
      return res.status(401).json({ success: false, error: "Invalid or expired session" });
    }

    const now = Date.now();
    const TWO_MINUTES_MS = 2 * 60 * 1000;
    const { rows } = await pool.query(
      "SELECT * FROM devices WHERE LOWER(user_email) = LOWER($1) AND is_revoked = false",
      [session.user_email]
    );

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
  const token = readBearerToken(req);
  if (!token) return res.status(401).json({ success: false, error: "Authenticated session required" });
  const client = await pool.connect();
  try {
    const body = req.body || {};
    await client.query("BEGIN");
    await client.query("SELECT generation FROM app_state WHERE singleton = TRUE FOR SHARE");
    const result = await client.query(`
      SELECT s.user_email, s.device_id, s.device_name, s.created_at, u.id
      FROM user_active_sessions s
      JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
      JOIN app_users u ON LOWER(u.email) = LOWER(s.user_email)
      WHERE s.token = $1 LIMIT 1 FOR SHARE OF s
    `, [token]);
    const session = result.rows[0];
    if (!session || Number(session.created_at) + SESSION_TTL_MS <= Date.now()) {
      await client.query("ROLLBACK");
      return res.status(401).json({ success: false, error: "Invalid or expired session" });
    }
    const id = String(session.device_id);
    const now = Date.now();
    const cleanEmail = String(session.user_email).trim().toLowerCase();
    const cleanIdentifier = `user_usr_${cleanEmail.replace(/[^a-z0-9]/g, "_")}`;

    const { rows } = await client.query("SELECT * FROM devices WHERE id = $1", [id]);
    const existing = rows[0];

    // Reject heartbeat if device was revoked by a newer login
    if (existing && existing.is_revoked) {
      await client.query("ROLLBACK");
      return res.status(401).json({
        success: false,
        revoked: true,
        message: "Device session has been revoked because your account was signed in on another device",
      });
    }

    const deviceName = parseReadableDeviceName(req, String(body.device_name || body.deviceName || session.device_name || "").trim());
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

    await client.query(upsertQuery, [
      id,
      cleanEmail,
      cleanIdentifier,
      deviceName,
      body.platform || existing?.platform || "web_browser",
      body.environment || existing?.environment || "Web Browser",
      body.app_version || existing?.app_version || "1.0.0",
      existing ? existing.created_at : now,
      now,
      req.ip || req.socket?.remoteAddress || undefined,
      (req.headers?.["user-agent"] as string) || undefined,
    ]);

    // Also update connected_devices table
    try {
      await client.query(`
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
        deviceName,
        body.platform || existing?.platform || "web_browser",
        body.environment || existing?.environment || "Web Browser",
        body.app_version || existing?.app_version || "1.0.0",
        existing ? existing.created_at : now,
        now,
        req.ip || req.socket?.remoteAddress || undefined,
        (req.headers?.["user-agent"] as string) || undefined,
      ]);
    } catch {
      // Non-fatal if connected_devices is a view
    }
    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Heartbeat recorded successfully",
      device_id: id,
      timestamp: now,
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[SyncService] Error recording heartbeat:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  } finally {
    client.release();
  }
}

export async function handleDeleteDevice(req: any, res: any): Promise<void> {
  const token = readBearerToken(req);
  if (!token) return res.status(401).json({ success: false, error: "Authenticated session required" });
  const client = await pool.connect();
  try {
    const deviceId = req.params?.deviceId || req.url?.split("/").pop();
    if (!deviceId) return res.status(400).json({ success: false, error: "Missing device ID" });
    await client.query("BEGIN");
    await client.query("SELECT generation FROM app_state WHERE singleton = TRUE FOR SHARE");
    const result = await client.query(`
      SELECT s.user_email, s.device_id, s.created_at
      FROM user_active_sessions s
      JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
      JOIN app_users u ON LOWER(u.email) = LOWER(s.user_email)
      WHERE s.token = $1 LIMIT 1 FOR SHARE OF s
    `, [token]);
    const session = result.rows[0];
    if (!session || Number(session.created_at) + SESSION_TTL_MS <= Date.now()) {
      await client.query("ROLLBACK");
      return res.status(401).json({ success: false, error: "Invalid or expired session" });
    }
    await client.query("UPDATE devices SET is_revoked = TRUE WHERE LOWER(user_email) = LOWER($1) AND id = $2", [session.user_email, deviceId]);
    await client.query("UPDATE connected_devices SET is_revoked = TRUE WHERE LOWER(user_email) = LOWER($1) AND id = $2", [session.user_email, deviceId]);
    if (String(deviceId) === String(session.device_id)) {
      await client.query("DELETE FROM user_active_sessions WHERE token = $1", [token]);
      const cachedSession = activeSessions.get(token);
      if (cachedSession) {
        cachedSession.revoked = true;
        cachedSession.revokedReason = "device_revoked";
        cachedSession.revokedByDevice = "the account owner";
      }
    }
    await client.query("COMMIT");
    return res.status(200).json({ success: true, message: "Device revoked" });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[SyncService] Error revoking device:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  } finally {
    client.release();
  }
}

/**
 * Versioned operation sync API. Mutations use optimistic entity revisions and
 * stable IDs; pulls use a server sequence cursor rather than client timestamps.
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
    const expectedWorkspaceId = `user_usr_${userEmail.replace(/[^a-z0-9]/g, "_")}`;
    if (workspaceId !== expectedWorkspaceId) {
      return res.status(403).json({ success: false, error: "Workspace does not belong to this account" });
    }
    await client.query("BEGIN");
    await client.query("SELECT generation FROM app_state WHERE singleton = TRUE FOR SHARE");
    const sessionResult = await client.query(
      `SELECT s.device_id FROM user_active_sessions s
       JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
       JOIN app_users u ON LOWER(u.email) = LOWER(s.user_email)
       WHERE s.token = $1 AND LOWER(s.user_email) = $2`,
      [bearerToken, userEmail]
    );
    if (!sessionResult.rows.length || sessionResult.rows[0].device_id !== deviceId) {
      await client.query("ROLLBACK");
      return res.status(401).json({ success: false, error: "Session is not active on this device" });
    }
    if (mutations.length > 250) {
      await client.query("ROLLBACK");
      return res.status(413).json({ success: false, error: "A sync batch may contain at most 250 mutations" });
    }
    if (body.snapshot === true) {
      const entity = await client.query(
        "SELECT payload, revision FROM sync_entities WHERE workspace_identifier = $1 AND user_email = $2 AND module = 'workspace' AND entity_id = 'root' AND is_deleted = false",
        [workspaceId, userEmail]
      );
      let snapshot = entity.rows.length
        ? { payload: entity.rows[0].payload, revision: Number(entity.rows[0].revision) }
        : null;
      const latest = await client.query("SELECT COALESCE(MAX(server_cursor), 0)::text AS cursor FROM sync_mutations WHERE workspace_identifier = $1 AND user_email = $2", [workspaceId, userEmail]);
      await client.query("COMMIT");
      return res.status(200).json({ success: true, snapshot, next_cursor: String(latest.rows[0]?.cursor || "0"), changes: [], has_more: false, accepted_mutation_ids: [], conflicts: [] });
    }

    const accepted: string[] = [];
    const conflicts: any[] = [];
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
      // Maintain the transaction table as a derived compatibility projection.
      // Reads and writes still use sync_entities and its ordered mutation log.
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
const expiredSessionTokens = new Map<string, number>();
// Maps user_email to their single active token
const userActiveTokens = new Map<string, string>();
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function pruneExpiredSessions(now = Date.now()): void {
  for (const [token, session] of activeSessions) {
    if (session.expiresAt <= now) {
      activeSessions.delete(token);
      expiredSessionTokens.set(token, now + SESSION_TTL_MS);
    }
  }
  for (const [token, retainUntil] of expiredSessionTokens) {
    if (retainUntil <= now) expiredSessionTokens.delete(token);
  }
  while (expiredSessionTokens.size > 10_000) {
    const oldest = expiredSessionTokens.keys().next().value;
    if (oldest === undefined) break;
    expiredSessionTokens.delete(oldest);
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
    const iterations = Number(parsed.iterations) || 100000;
    const derived = crypto.pbkdf2Sync(attemptedPass, saltBuf, iterations, 32, "sha256");
    const derivedB64 = derived.toString("base64");
    return crypto.timingSafeEqual(Buffer.from(derivedB64), Buffer.from(parsed.hash));
  } catch {
    return false;
  }
}

export async function handleAuthRegister(req: any, res: any): Promise<void> {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const displayName = String(req.body?.name || email.split("@")[0]).trim().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return res.status(400).json({ success: false, message: "A valid email and password of at least 8 characters are required." });
  }
  const salt = crypto.randomBytes(16);
  const iterations = 100000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const passwordRecord = { version: 2, algorithm: "PBKDF2-SHA256", iterations, salt: salt.toString("base64"), hash: hash.toString("base64") };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT generation FROM app_state WHERE singleton = TRUE FOR SHARE");
    const existing = await client.query("SELECT id FROM app_users WHERE LOWER(email) = $1 LIMIT 1", [email]);
    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "An account with this email already exists. Sign in instead." });
    }
    const id = crypto.randomUUID();
    await client.query(
      "INSERT INTO app_users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4::jsonb)",
      [id, email, displayName, JSON.stringify(passwordRecord)]
    );
    const workspaceId = `user_usr_${email.replace(/[^a-z0-9]/g, "_")}`;
    await client.query(
      "INSERT INTO workspaces (user_identifier, user_email, workspace_data, updated_at, sync_version) VALUES ($1, $2, '{}'::jsonb, CURRENT_TIMESTAMP::text, 0)",
      [workspaceId, email]
    );
    await client.query("COMMIT");
    return res.status(201).json({ success: true, user: { id, email, name: displayName, provider: "neon", createdAt: Date.now() } });
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {});
    const duplicateEmail = error?.code === "23505" &&
      ["app_users_email_lower_unique", "app_users_email_key"].includes(String(error?.constraint));
    console.error("[AUTH] Registration database failure", { code: error?.code, constraint: error?.constraint, detail: error?.detail });
    return res.status(duplicateEmail ? 409 : 500).json({ success: false, message: duplicateEmail ? "An account with this email already exists. Sign in instead." : "Account registration failed. Please retry, and contact support if it continues." });
  } finally {
    client.release();
  }
}

function readBearerToken(req: any): string {
  const header = String(req.headers?.authorization || req.headers?.Authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export async function handleAuthChangePassword(req: any, res: any): Promise<void> {
  const token = readBearerToken(req);
  const currentPassword = String(req.body?.current_password || "");
  const newPassword = String(req.body?.new_password || "");
  if (!token || currentPassword.length === 0 || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: "Current password and a new password of at least 8 characters are required." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT generation FROM app_state WHERE singleton = TRUE FOR SHARE");
    const result = await client.query(`
      SELECT u.id, u.email, u.password_hash FROM app_users u
      JOIN user_active_sessions s ON LOWER(s.user_email) = LOWER(u.email)
      JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
      WHERE s.token = $1 LIMIT 1 FOR UPDATE OF u
    `, [token]);
    if (!result.rows.length || !verifyPasswordRecord(result.rows[0].password_hash, currentPassword)) {
      await client.query("ROLLBACK");
      return res.status(401).json({ success: false, message: "Current password is incorrect or the session has expired." });
    }
    const salt = crypto.randomBytes(16);
    const iterations = 100000;
    const hash = crypto.pbkdf2Sync(newPassword, salt, iterations, 32, "sha256");
    const passwordRecord = { version: 2, algorithm: "PBKDF2-SHA256", iterations, salt: salt.toString("base64"), hash: hash.toString("base64") };
    await client.query("UPDATE app_users SET password_hash = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [result.rows[0].id, JSON.stringify(passwordRecord)]);
    await client.query("COMMIT");
    return res.status(200).json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ success: false, message: "Password update failed." });
  } finally {
    client.release();
  }
}

export async function handleStorageDiagnostic(req: any, res: any): Promise<void> {
  const token = readBearerToken(req);
  if (!token) return res.status(401).json({ success: false, message: "Authenticated session required." });
  try {
    const result = await pool.query(`
      SELECT s.generation, s.created_at, a.schema_version, current_database() AS database,
             current_user AS role
      FROM user_active_sessions s
      JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
      JOIN app_users u ON LOWER(u.email) = LOWER(s.user_email)
      WHERE s.token = $1 LIMIT 1
    `, [token]);
    if (!result.rows.length) return res.status(401).json({ success: false, message: "Invalid or revoked session." });
    const row = result.rows[0];
    const createdAt = Number(row.created_at);
    if (!Number.isFinite(createdAt) || createdAt + SESSION_TTL_MS <= Date.now()) {
      return res.status(401).json({ success: false, message: "Expired session." });
    }
    const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.NEON_DB_URL || "";
    const host = connectionString ? new URL(connectionString).hostname : "unknown";
    const fingerprint = crypto.createHash("sha256")
      .update(`${host.toLowerCase()}|${row.database}|${row.role}`)
      .digest("hex").slice(0, 20);
    return res.status(200).json({ success: true, database_fingerprint: fingerprint,
      schema_version: Number(row.schema_version), generation: Number(row.generation) });
  } catch (error: any) {
    return res.status(503).json({ success: false, message: "Storage diagnostic unavailable." });
  }
}

export async function handleAuthLogin(req: any, res: any): Promise<void> {
  let authClient: any;
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

    // Hold a shared generation lock until the singleton session is committed.
    // A global reset takes the matching exclusive lock, so a login racing with
    // reset is either cleared by it or observes the post-reset user table.
    authClient = await pool.connect();
    await authClient.query("BEGIN");
    const state = await authClient.query("SELECT generation FROM app_state WHERE singleton = TRUE FOR SHARE");
    const generation = Number(state.rows[0]?.generation || 1);
    const { rows } = await authClient.query(
      `SELECT id, email, display_name, password_hash, created_at
       FROM app_users WHERE LOWER(email) = $1 LIMIT 1`,
      [emailVariant]
    );
    const account = rows[0];
    const matchedUser = account && verifyPasswordRecord(account.password_hash, password)
      ? {
          id: account.id,
          email: account.email,
          name: account.display_name,
          createdAt: new Date(account.created_at).getTime(),
          lastLoginAt: Date.now(),
          provider: "neon",
        }
      : null;

    if (!matchedUser) {
      await authClient.query("ROLLBACK");
      return res.status(401).json({ success: false, message: "Invalid email/username or password" });
    }

    // Singleton session enforcement: extract device identifier & human-readable name
    const deviceId = String(body.device_id || body.deviceId || "").trim() || `device_${crypto.randomBytes(6).toString("hex")}`;
    const deviceName = parseReadableDeviceName(req, String(body.device_name || body.deviceName || "").trim());

    const userEmail = (matchedUser.email || emailVariant).toLowerCase().trim();
    const userId = String(matchedUser.id || `usr_${cleanId}`).trim();

    // Generate a secure session token and persist it with the current generation.
    const token = `neon_tok_${crypto.randomBytes(32).toString("hex")}`;
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;
    await authClient.query(
      "UPDATE devices SET is_revoked = true WHERE LOWER(user_email) = $1 AND id != $2",
      [userEmail, deviceId]
    );
    await authClient.query(
      "UPDATE connected_devices SET is_revoked = true WHERE LOWER(user_email) = $1 AND id != $2",
      [userEmail, deviceId]
    );
    await authClient.query("UPDATE devices SET is_revoked = false WHERE LOWER(user_email) = $1 AND id = $2", [userEmail, deviceId]);
    await authClient.query("UPDATE connected_devices SET is_revoked = false WHERE LOWER(user_email) = $1 AND id = $2", [userEmail, deviceId]);
    await authClient.query(`
      INSERT INTO user_active_sessions (user_email, token, device_id, device_name, created_at, updated_at, generation)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
      ON CONFLICT (user_email) DO UPDATE SET
        token = EXCLUDED.token,
        device_id = EXCLUDED.device_id,
        device_name = EXCLUDED.device_name,
        created_at = EXCLUDED.created_at,
        updated_at = CURRENT_TIMESTAMP,
        generation = EXCLUDED.generation
    `, [userEmail, token, deviceId, deviceName, now, generation]);
    await authClient.query("COMMIT");

    for (const sess of activeSessions.values()) {
      if ((sess.user?.email || "").toLowerCase().trim() === userEmail && sess.deviceId !== deviceId) {
        sess.revoked = true;
        sess.revokedReason = "new_login";
        sess.revokedByDevice = deviceName;
      }
    }
    activeSessions.set(token, { user: matchedUser, token, deviceId, deviceName, createdAt: now, expiresAt });
    userActiveTokens.set(userEmail, token);
    userActiveTokens.set(userId, token);
    console.info(`[SyncService] Singleton session established for ${userEmail} on ${deviceName} (${deviceId})`);

    return res.status(200).json({
      success: true,
      token,
      user: matchedUser,
      device_id: deviceId,
      device_name: deviceName,
      generation,
      message: "Signed in successfully via Neon DB pool",
    });
  } catch (err: any) {
    if (authClient) await authClient.query("ROLLBACK").catch(() => {});
    console.error("[SyncService] handleAuthLogin error:", err);
    return res.status(500).json({ success: false, message: "Internal authentication error" });
  } finally {
    authClient?.release();
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

    const cachedSession = activeSessions.get(token);
    if (cachedSession?.revoked) {
      return res.status(401).json({ success: false, valid: false, revoked: true,
        newDeviceName: cachedSession.revokedByDevice || "another device",
        message: `Logged out because your account was signed in on ${cachedSession.revokedByDevice || "another device"}` });
    }
    if (expiredSessionTokens.has(token) || (cachedSession && cachedSession.expiresAt <= Date.now())) {
      activeSessions.delete(token);
      expiredSessionTokens.set(token, Date.now() + SESSION_TTL_MS);
      return res.status(401).json({ success: false, valid: false, message: "Expired token" });
    }

    // Never trust process memory as proof of an active session: another server
    // instance or a global reset must revoke tokens immediately everywhere.
    const { rows } = await pool.query(`
      SELECT s.user_email, s.device_id, s.device_name, s.created_at,
             u.id, u.display_name, u.created_at AS user_created_at, s.generation
      FROM user_active_sessions s
      JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
      JOIN app_users u ON LOWER(u.email) = LOWER(s.user_email)
      WHERE s.token = $1
      LIMIT 1
    `, [token]);
    if (!rows.length) {
      activeSessions.delete(token);
      return res.status(401).json({ success: false, valid: false, message: "Invalid, revoked, or reset session" });
    }
    const sessionRow = rows[0];
    const createdAt = Number(sessionRow.created_at);
    if (!Number.isFinite(createdAt) || createdAt + SESSION_TTL_MS <= Date.now()) {
      activeSessions.delete(token);
      return res.status(401).json({ success: false, valid: false, message: "Expired token" });
    }
    return res.status(200).json({ success: true, valid: true, generation: Number(sessionRow.generation),
      user: { id: sessionRow.id, email: sessionRow.user_email, name: sessionRow.display_name,
        createdAt: new Date(sessionRow.user_created_at).getTime(), provider: "neon" } });
  } catch (err: any) {
    return res.status(500).json({ success: false, valid: false, error: err?.message });
  }
}

/** Revoke only the bearer session presented by this device. */
export async function handleAuthLogout(req: any, res: any): Promise<void> {
  const token = readBearerToken(req);
  if (!token) return res.status(200).json({ success: true });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT generation FROM app_state WHERE singleton = TRUE FOR SHARE");
    const session = await client.query(
      "SELECT user_email, device_id FROM user_active_sessions WHERE token = $1 LIMIT 1",
      [token],
    );
    if (session.rows.length) {
      const { user_email: email, device_id: deviceId } = session.rows[0];
      await client.query("DELETE FROM user_active_sessions WHERE token = $1", [token]);
      await client.query("UPDATE devices SET is_revoked = TRUE WHERE LOWER(user_email) = LOWER($1) AND id = $2", [email, deviceId]);
      await client.query("UPDATE connected_devices SET is_revoked = TRUE WHERE LOWER(user_email) = LOWER($1) AND id = $2", [email, deviceId]);
    }
    await client.query("COMMIT");
    const cachedSession = activeSessions.get(token);
    if (cachedSession) {
      cachedSession.revoked = true;
      cachedSession.revokedReason = "signed_out";
      cachedSession.revokedByDevice = "this device";
    }
    return res.status(200).json({ success: true });
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(503).json({ success: false, message: "Could not revoke the session right now." });
  } finally {
    client.release();
  }
}

export function registerSyncRoutes(app: Express): void {
  // Auth routes powered by Neon DB pool
  app.post("/api/auth/register", handleAuthRegister);
  app.post("/api/auth/login", handleAuthLogin);
  app.post("/api/auth/logout", handleAuthLogout);
  app.post("/api/auth/change-password", handleAuthChangePassword);
  app.get("/api/auth/verify", handleAuthVerify);
  app.post("/api/auth/verify", handleAuthVerify);
  app.get("/api/storage/diagnostic", handleStorageDiagnostic);

  // Revisioned sync is the only workspace data protocol.
  app.post("/api/sync/v2", handleSyncV2);
  app.get("/api/sync/v2", handleSyncV2);

  // Device presence remains an auxiliary session service, not a data store.
  app.get("/api/sync/devices", handleGetDevices);
  app.post("/api/sync/devices/heartbeat", handlePostHeartbeat);
  app.delete("/api/sync/devices/:deviceId", handleDeleteDevice);
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
        if (pathname === "/api/auth/register" && method === "POST") {
          return handleAuthRegister(req, enhancedRes);
        }
        if (pathname === "/api/auth/login" && method === "POST") {
          return handleAuthLogin(req, enhancedRes);
        }
        if (pathname === "/api/auth/logout" && method === "POST") {
          return handleAuthLogout(req, enhancedRes);
        }
        if (pathname === "/api/auth/change-password" && method === "POST") {
          return handleAuthChangePassword(req, enhancedRes);
        }

        if (pathname === "/api/auth/verify" && (method === "GET" || method === "POST")) {
          return handleAuthVerify(req, enhancedRes);
        }

        if (pathname === "/api/storage/diagnostic" && method === "GET") {
          return handleStorageDiagnostic(req, enhancedRes);
        }

        // Sync endpoints
        if (pathname === "/api/sync/v2" && (method === "POST" || method === "GET")) {
          return handleSyncV2(req, enhancedRes);
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
