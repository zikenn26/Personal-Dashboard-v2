import { neon } from "@neondatabase/serverless";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface EventContext {
  request: Request;
  env: Record<string, string | undefined>;
  params: Record<string, string | string[]>;
  waitUntil: (promise: Promise<any>) => void;
  next: () => Promise<Response>;
}

// Default pooled connection string fallback if not present in Cloudflare Pages environment variables
const FALLBACK_DATABASE_URL =
  "postgresql://neondb_owner:npg_v9iZcBo7zKup@ep-curly-glitter-b4fsklnq-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

function getDatabaseUrl(env: Record<string, string | undefined>): string {
  const envUrl = env?.DATABASE_URL || env?.NEON_DATABASE_URL || env?.NEON_DB_URL;
  if (envUrl && envUrl.startsWith("postgres") && !envUrl.includes("[USER]")) {
    return envUrl;
  }
  return FALLBACK_DATABASE_URL;
}

function getDb(env: Record<string, string | undefined>) {
  const url = getDatabaseUrl(env);
  return neon(url);
}

function interpolateSql(text: string, params: any[]): string {
  if (!params || params.length === 0) return text;
  return text.replace(/\$(\d+)/g, (_, idx) => {
    const val = params[parseInt(idx, 10) - 1];
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    const escaped = String(val).replace(/'/g, "''");
    return `'${escaped}'`;
  });
}

async function query(sql: any, text: string, params: any[] = []): Promise<any[]> {
  if (!sql) {
    throw new Error("Neon DB client is null or undefined");
  }

  // 1. If sql is an object with a query method (or Vitest mock)
  if (typeof sql.query === "function") {
    try {
      const res = await sql.query(text, params);
      return Array.isArray(res) ? res : (res?.rows || []);
    } catch (err: any) {
      // If error is about tagged-template usage, fall through to tagged template
      if (!err?.message?.includes("tagged-template")) {
        throw err;
      }
    }
  }

  // 2. Neon serverless tagged template invocation
  const rawSql = interpolateSql(text, params);

  if (typeof sql.unsafe === "function") {
    const res = await sql.unsafe(rawSql);
    return Array.isArray(res) ? res : (res?.rows || []);
  }

  if (typeof sql === "function") {
    const templateStrings: any = [rawSql];
    templateStrings.raw = [rawSql];
    const res = await sql(templateStrings);
    return Array.isArray(res) ? res : (res?.rows || []);
  }

  throw new Error("Neon client does not support query execution");
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-gemini-api-key",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data: any, status = 200, request?: Request): Response {
  const headers = new Headers(request ? corsHeaders(request) : { "Access-Control-Allow-Origin": "*" });
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { status, headers });
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function getRandomHex(byteLength: number): string {
  const bytes = getRandomBytes(byteLength);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function derivePbkdf2Hash(
  password: string,
  salt: Uint8Array,
  iterations = 100000
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return uint8ArrayToBase64(new Uint8Array(derivedBits));
}

async function verifyPasswordRecord(
  record: any,
  attemptedPass: string
): Promise<boolean> {
  try {
    let parsed = record;
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    if (!parsed || !parsed.salt || !parsed.hash) return false;
    const saltBytes = base64ToUint8Array(parsed.salt);
    const iterations = Number(parsed.iterations) || 100000;
    const derivedB64 = await derivePbkdf2Hash(attemptedPass, saltBytes, iterations);
    if (derivedB64.length !== parsed.hash.length) return false;
    let diff = 0;
    for (let i = 0; i < derivedB64.length; i++) {
      diff |= derivedB64.charCodeAt(i) ^ parsed.hash.charCodeAt(i);
    }
    return diff === 0;
  } catch (err) {
    console.error("[CF Auth] verifyPasswordRecord error:", err);
    return false;
  }
}

async function sha256Hex(data: string): Promise<string> {
  const buffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readBearerToken(request: Request): string {
  const header = request.headers.get("Authorization") || request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function parseReadableDeviceName(request: Request, explicitName?: string): string {
  if (explicitName && explicitName.trim()) {
    return explicitName.trim();
  }
  const ua = request.headers.get("user-agent") || "";
  if (/Android/i.test(ua)) return "Android APK App";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Macintosh|Mac OS/i.test(ua)) return "Safari on macOS";
  if (/Windows/i.test(ua)) return "Google Chrome on Windows";
  if (/Linux/i.test(ua)) return "Browser on Linux";
  return "Web Browser";
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

async function handleRegister(request: Request, env: Record<string, string | undefined>): Promise<Response> {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, message: "Invalid JSON body" }, 400, request);
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const displayName = String(body?.name || email.split("@")[0]).trim().slice(0, 120);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return jsonResponse(
      { success: false, message: "A valid email and password of at least 8 characters are required." },
      400,
      request
    );
  }

  const sql = getDb(env);

  try {
    const existing = await query(sql, "SELECT id FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
    if (existing.length > 0) {
      return jsonResponse(
        { success: false, message: "An account with this email already exists. Sign in instead." },
        409,
        request
      );
    }

    const saltBytes = getRandomBytes(16);
    const iterations = 100000;
    const hashB64 = await derivePbkdf2Hash(password, saltBytes, iterations);
    const passwordRecord = {
      version: 2,
      algorithm: "PBKDF2-SHA256",
      iterations,
      salt: uint8ArrayToBase64(saltBytes),
      hash: hashB64,
    };

    const id = crypto.randomUUID();
    await query(
      sql,
      "INSERT INTO app_users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4::jsonb)",
      [id, email, displayName, JSON.stringify(passwordRecord)]
    );

    const workspaceId = `user_usr_${email.replace(/[^a-z0-9]/g, "_")}`;
    await query(
      sql,
      "INSERT INTO workspaces (user_identifier, user_email, workspace_data, updated_at, sync_version) VALUES ($1, $2, '{}'::jsonb, CURRENT_TIMESTAMP::text, 0) ON CONFLICT (user_identifier) DO NOTHING",
      [workspaceId, email]
    );

    return jsonResponse(
      {
        success: true,
        user: {
          id,
          email,
          name: displayName,
          provider: "neon",
          createdAt: Date.now(),
        },
      },
      201,
      request
    );
  } catch (error: any) {
    const duplicateEmail =
      error?.code === "23505" &&
      ["app_users_email_lower_unique", "app_users_email_key"].includes(String(error?.constraint));
    console.error("[CF Auth] Registration database failure:", error);
    return jsonResponse(
      {
        success: false,
        message: duplicateEmail
          ? "An account with this email already exists. Sign in instead."
          : "Account registration failed. Please retry, and contact support if it continues.",
        debug_error: String(error?.stack || error?.message || error),
      },
      duplicateEmail ? 409 : 500,
      request
    );
  }
}

async function handleLogin(request: Request, env: Record<string, string | undefined>): Promise<Response> {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, message: "Invalid JSON body" }, 400, request);
  }

  const identifier = String(body.email || body.username || body.identifier || "").trim().toLowerCase();
  const password = String(body.password || "").trim();

  if (!identifier || !password) {
    return jsonResponse({ success: false, message: "Missing email/username or password" }, 400, request);
  }

  const cleanId = identifier.replace(/[^a-z0-9]/g, "_");
  const emailVariant = identifier.includes("@") ? identifier : `${cleanId}@workspace.local`;

  const sql = getDb(env);

  try {
    const stateRows = await query(sql, "SELECT generation FROM app_state WHERE singleton = TRUE LIMIT 1");
    const generation = Number(stateRows[0]?.generation || 1);

    const userRows = await query(
      sql,
      "SELECT id, email, display_name, password_hash, created_at FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [emailVariant]
    );

    const account = userRows[0];
    if (!account) {
      return jsonResponse({ success: false, message: "Invalid email/username or password" }, 401, request);
    }

    const isPasswordValid = await verifyPasswordRecord(account.password_hash, password);
    if (!isPasswordValid) {
      return jsonResponse({ success: false, message: "Invalid email/username or password" }, 401, request);
    }

    const matchedUser = {
      id: account.id,
      email: account.email,
      name: account.display_name,
      createdAt: new Date(account.created_at).getTime(),
      lastLoginAt: Date.now(),
      provider: "neon",
    };

    const deviceId =
      String(body.device_id || body.deviceId || "").trim() || `device_${getRandomHex(6)}`;
    const deviceName = parseReadableDeviceName(request, String(body.device_name || body.deviceName || "").trim());

    const userEmail = (matchedUser.email || emailVariant).toLowerCase().trim();
    const token = `neon_tok_${getRandomHex(32)}`;
    const now = Date.now();

    // Check if another device or session was previously active for this user
    let hadOtherSession = false;
    try {
      const activeRows = await query(
        sql,
        "SELECT token, device_id, device_name FROM user_active_sessions WHERE LOWER(user_email) = LOWER($1) LIMIT 1",
        [userEmail]
      );
      if (activeRows.length > 0 && (activeRows[0].device_id !== deviceId || activeRows[0].token !== token)) {
        hadOtherSession = true;
        // Record revoked session so old device receives precise notification
        await query(
          sql,
          `CREATE TABLE IF NOT EXISTS revoked_session_tokens (
             token TEXT PRIMARY KEY,
             user_email TEXT NOT NULL,
             revoked_at NUMERIC(30, 0) NOT NULL,
             reason TEXT NOT NULL,
             new_device_name TEXT
           )`
        ).catch(() => []);
        await query(
          sql,
          `INSERT INTO revoked_session_tokens (token, user_email, revoked_at, reason, new_device_name)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (token) DO UPDATE SET
             revoked_at = EXCLUDED.revoked_at,
             reason = EXCLUDED.reason,
             new_device_name = EXCLUDED.new_device_name`,
          [
            activeRows[0].token,
            userEmail,
            now,
            "Logged out because your account was signed in on another device",
            deviceName,
          ]
        ).catch(() => []);
      }
    } catch (checkErr) {
      console.warn("[CF Auth] Previous session check notice:", checkErr);
    }

    // Revoke previous sessions on other devices
    await query(
      sql,
      "UPDATE devices SET is_revoked = true WHERE LOWER(user_email) = LOWER($1) AND id != $2",
      [userEmail, deviceId]
    );
    await query(
      sql,
      "UPDATE connected_devices SET is_revoked = true WHERE LOWER(user_email) = LOWER($1) AND id != $2",
      [userEmail, deviceId]
    );
    await query(
      sql,
      "UPDATE devices SET is_revoked = false WHERE LOWER(user_email) = LOWER($1) AND id = $2",
      [userEmail, deviceId]
    );
    await query(
      sql,
      "UPDATE connected_devices SET is_revoked = false WHERE LOWER(user_email) = LOWER($1) AND id = $2",
      [userEmail, deviceId]
    );

    await query(
      sql,
      `INSERT INTO user_active_sessions (user_email, token, device_id, device_name, created_at, updated_at, generation)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
       ON CONFLICT (user_email) DO UPDATE SET
         token = EXCLUDED.token,
         device_id = EXCLUDED.device_id,
         device_name = EXCLUDED.device_name,
         created_at = EXCLUDED.created_at,
         updated_at = CURRENT_TIMESTAMP,
         generation = EXCLUDED.generation`,
      [userEmail, token, deviceId, deviceName, now, generation]
    );

    return jsonResponse(
      {
        success: true,
        token,
        user: matchedUser,
        device_id: deviceId,
        device_name: deviceName,
        generation,
        had_previous_session: hadOtherSession,
        message: "Signed in successfully via Neon DB pool",
      },
      200,
      request
    );
  } catch (err: any) {
    console.error("[CF Auth] Login error:", err);
    return jsonResponse({ success: false, message: "Internal authentication error" }, 500, request);
  }
}

async function handleVerify(request: Request, env: Record<string, string | undefined>): Promise<Response> {
  let token = readBearerToken(request);
  const url = new URL(request.url);

  if (!token) {
    token = url.searchParams.get("token") || "";
  }

  if (!token && request.method === "POST") {
    try {
      const body: any = await request.clone().json();
      token = String(body?.token || "");
    } catch {}
  }

  if (!token) {
    return jsonResponse({ success: false, valid: false, message: "Missing token" }, 401, request);
  }

  const sql = getDb(env);

  try {
    const rows = await query(
      sql,
      `SELECT s.user_email, s.device_id, s.device_name, s.created_at,
              u.id, u.display_name, u.created_at AS user_created_at, s.generation
       FROM user_active_sessions s
       JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
       JOIN app_users u ON LOWER(u.email) = LOWER(s.user_email)
       WHERE s.token = $1
       LIMIT 1`,
      [token]
    );

    if (!rows.length) {
      let revokedReason = "Logged out because your account was signed in on another device";
      let newDeviceName: string | undefined;

      try {
        const revokedRows = await query(
          sql,
          "SELECT reason, new_device_name FROM revoked_session_tokens WHERE token = $1 LIMIT 1",
          [token]
        );
        if (revokedRows.length > 0) {
          revokedReason = revokedRows[0].reason || revokedReason;
          newDeviceName = revokedRows[0].new_device_name || undefined;
        }
      } catch {}

      return jsonResponse(
        {
          success: false,
          valid: false,
          message: revokedReason,
          revoked: true,
          newDeviceName,
        },
        401,
        request
      );
    }

    const session = rows[0];
    const createdAt = Number(session.created_at);
    if (!Number.isFinite(createdAt) || createdAt + SESSION_TTL_MS <= Date.now()) {
      return jsonResponse({ success: false, valid: false, message: "Expired token" }, 401, request);
    }

    return jsonResponse(
      {
        success: true,
        valid: true,
        user: {
          id: session.id,
          email: session.user_email,
          name: session.display_name,
          createdAt: new Date(session.user_created_at).getTime(),
          provider: "neon",
        },
        device_id: session.device_id,
        device_name: session.device_name,
        generation: Number(session.generation),
      },
      200,
      request
    );
  } catch (err: any) {
    console.error("[CF Auth] Verify error:", err);
    return jsonResponse({ success: false, valid: false, message: "Verification failed" }, 500, request);
  }
}

async function handleLogout(request: Request, env: Record<string, string | undefined>): Promise<Response> {
  const token = readBearerToken(request);
  if (token) {
    const sql = getDb(env);
    try {
      await query(sql, "DELETE FROM user_active_sessions WHERE token = $1", [token]);
    } catch (err) {
      console.error("[CF Auth] Logout delete error:", err);
    }
  }
  return jsonResponse({ success: true }, 200, request);
}

async function handleChangePassword(request: Request, env: Record<string, string | undefined>): Promise<Response> {
  const token = readBearerToken(request);
  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const currentPassword = String(body?.current_password || "");
  const newPassword = String(body?.new_password || "");

  if (!token || currentPassword.length === 0 || newPassword.length < 8) {
    return jsonResponse(
      { success: false, message: "Current password and a new password of at least 8 characters are required." },
      400,
      request
    );
  }

  const sql = getDb(env);

  try {
    const rows = await query(
      sql,
      `SELECT u.id, u.email, u.password_hash FROM app_users u
       JOIN user_active_sessions s ON LOWER(s.user_email) = LOWER(u.email)
       JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
       WHERE s.token = $1 LIMIT 1`,
      [token]
    );

    if (!rows.length || !(await verifyPasswordRecord(rows[0].password_hash, currentPassword))) {
      return jsonResponse(
        { success: false, message: "Current password is incorrect or the session has expired." },
        401,
        request
      );
    }

    const saltBytes = getRandomBytes(16);
    const iterations = 100000;
    const hashB64 = await derivePbkdf2Hash(newPassword, saltBytes, iterations);
    const passwordRecord = {
      version: 2,
      algorithm: "PBKDF2-SHA256",
      iterations,
      salt: uint8ArrayToBase64(saltBytes),
      hash: hashB64,
    };

    await query(
      sql,
      "UPDATE app_users SET password_hash = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [rows[0].id, JSON.stringify(passwordRecord)]
    );

    return jsonResponse({ success: true, message: "Password updated successfully." }, 200, request);
  } catch (error) {
    console.error("[CF Auth] Password update failed:", error);
    return jsonResponse({ success: false, message: "Password update failed." }, 500, request);
  }
}

async function handleStorageDiagnostic(request: Request, env: Record<string, string | undefined>): Promise<Response> {
  const token = readBearerToken(request);
  if (!token) {
    return jsonResponse({ success: false, message: "Authenticated session required." }, 401, request);
  }

  const sql = getDb(env);

  try {
    const rows = await query(
      sql,
      `SELECT s.generation, s.created_at, a.schema_version, current_database() AS database,
              current_user AS role
       FROM user_active_sessions s
       JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
       JOIN app_users u ON LOWER(u.email) = LOWER(s.user_email)
       WHERE s.token = $1 LIMIT 1`,
      [token]
    );

    if (!rows.length) {
      return jsonResponse({ success: false, message: "Logged out because your account was signed in on another device", revoked: true }, 401, request);
    }

    const row = rows[0];
    const createdAt = Number(row.created_at);
    if (!Number.isFinite(createdAt) || createdAt + SESSION_TTL_MS <= Date.now()) {
      return jsonResponse({ success: false, message: "Expired session." }, 401, request);
    }

    const connectionString = getDatabaseUrl(env);
    let host = "unknown";
    try {
      host = new URL(connectionString).hostname;
    } catch {}

    const rawFingerprint = `${host.toLowerCase()}|${row.database}|${row.role}`;
    const hashHex = await sha256Hex(rawFingerprint);
    const fingerprint = hashHex.slice(0, 20);

    return jsonResponse(
      {
        success: true,
        database_fingerprint: fingerprint,
        schema_version: Number(row.schema_version),
        generation: Number(row.generation),
      },
      200,
      request
    );
  } catch (error) {
    console.error("[CF Storage] Diagnostic error:", error);
    return jsonResponse({ success: false, message: "Storage diagnostic unavailable." }, 503, request);
  }
}

async function handleSyncV2(request: Request, env: Record<string, string | undefined>): Promise<Response> {
  let body: any = {};
  if (request.method !== "GET") {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  const url = new URL(request.url);
  const workspaceId = String(body.workspace_identifier || body.user_identifier || "").trim();
  const userEmail = String(body.user_email || "").trim().toLowerCase();
  const deviceId = String(body.device_id || "").trim();
  const cursorText = String(body.cursor ?? url.searchParams.get("cursor") ?? "0");
  const cursor = /^\d+$/.test(cursorText) ? cursorText : "0";
  const mutations = Array.isArray(body.mutations) ? body.mutations : [];

  if (!workspaceId || !deviceId) {
    return jsonResponse({ success: false, error: "workspace_identifier and device_id are required" }, 400, request);
  }

  const bearerToken = readBearerToken(request);
  if (!bearerToken || !userEmail) {
    return jsonResponse(
      { success: false, error: "An authenticated session and user_email are required" },
      401,
      request
    );
  }

  const expectedWorkspaceId = `user_usr_${userEmail.replace(/[^a-z0-9]/g, "_")}`;
  if (workspaceId !== expectedWorkspaceId) {
    return jsonResponse({ success: false, error: "Workspace does not belong to this account" }, 403, request);
  }

  const sql = getDb(env);

  try {
    const sessionRows = await query(
      sql,
      `SELECT s.device_id FROM user_active_sessions s
       JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
       JOIN app_users u ON LOWER(u.email) = LOWER(s.user_email)
       WHERE s.token = $1 AND LOWER(s.user_email) = LOWER($2)`,
      [bearerToken, userEmail]
    );

    if (!sessionRows.length || sessionRows[0].device_id !== deviceId) {
      return jsonResponse({ success: false, error: "Logged out because your account was signed in on another device", revoked: true }, 401, request);
    }

    if (mutations.length > 250) {
      return jsonResponse({ success: false, error: "A sync batch may contain at most 250 mutations" }, 413, request);
    }

    if (body.snapshot === true) {
      const entityRows = await query(
        sql,
        "SELECT payload, revision FROM sync_entities WHERE workspace_identifier = $1 AND user_email = $2 AND module = 'workspace' AND entity_id = 'root' AND is_deleted = false",
        [workspaceId, userEmail]
      );
      const snapshot = entityRows.length
        ? { payload: entityRows[0].payload, revision: Number(entityRows[0].revision) }
        : null;

      const latestRows = await query(
        sql,
        "SELECT COALESCE(MAX(server_cursor), 0)::text AS cursor FROM sync_mutations WHERE workspace_identifier = $1 AND user_email = $2",
        [workspaceId, userEmail]
      );

      return jsonResponse(
        {
          success: true,
          snapshot,
          next_cursor: String(latestRows[0]?.cursor || "0"),
          changes: [],
          has_more: false,
          accepted_mutation_ids: [],
          conflicts: [],
        },
        200,
        request
      );
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

      if (
        !mutationId ||
        mutationId.length > 128 ||
        !/^[a-z0-9_.-]{1,64}$/i.test(moduleName) ||
        !entityId ||
        entityId.length > 256 ||
        !["upsert", "delete"].includes(operation) ||
        !Number.isSafeInteger(baseRevision) ||
        baseRevision < 0
      ) {
        return jsonResponse({ success: false, error: "Invalid mutation envelope" }, 400, request);
      }

      const payload = mutation?.payload && typeof mutation.payload === "object" ? mutation.payload : {};

      const canonical = (value: any): any =>
        Array.isArray(value)
          ? value.map(canonical)
          : value && typeof value === "object"
            ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]))
            : value;

      const payloadHash = await sha256Hex(
        JSON.stringify(canonical({ moduleName, entityId, operation, baseRevision, payload }))
      );

      const duplicateRows = await query(
        sql,
        "SELECT workspace_identifier, payload_hash FROM sync_mutations WHERE mutation_id = $1",
        [mutationId]
      );

      if (duplicateRows.length > 0) {
        if (
          duplicateRows[0].workspace_identifier !== workspaceId ||
          duplicateRows[0].payload_hash !== payloadHash
        ) {
          return jsonResponse({ success: false, error: "Mutation ID was reused with different content" }, 409, request);
        }
        accepted.push(mutationId);
        continue;
      }

      const currentRows = await query(
        sql,
        "SELECT user_email, revision, payload, is_deleted FROM sync_entities WHERE workspace_identifier = $1 AND module = $2 AND entity_id = $3",
        [workspaceId, moduleName, entityId]
      );

      const current = currentRows[0];
      if (current && String(current.user_email).toLowerCase() !== userEmail) {
        return jsonResponse({ success: false, error: "Workspace is not owned by this signed-in account" }, 403, request);
      }

      const currentRevision = current ? Number(current.revision) : 0;
      if (currentRevision !== baseRevision) {
        conflicts.push({
          mutation_id: mutationId,
          module: moduleName,
          entity_id: entityId,
          expected_revision: baseRevision,
          current_revision: currentRevision,
          current: current ? { payload: current.payload, is_deleted: current.is_deleted } : null,
        });
        continue;
      }

      const nextRevision = currentRevision + 1;
      const isDeleted = operation === "delete";

      await query(
        sql,
        `INSERT INTO sync_entities (workspace_identifier, user_email, module, entity_id, revision, payload, is_deleted, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, CURRENT_TIMESTAMP)
         ON CONFLICT (workspace_identifier, module, entity_id) DO UPDATE SET
           revision = EXCLUDED.revision,
           payload = EXCLUDED.payload,
           is_deleted = EXCLUDED.is_deleted,
           updated_at = CURRENT_TIMESTAMP`,
        [workspaceId, userEmail, moduleName, entityId, nextRevision, JSON.stringify(payload), isDeleted]
      );

      if (moduleName === "expenses") {
        const amount = Math.round(Math.abs(Number(payload.amount) || 0) * 100) / 100;
        const name = String(payload.name || payload.payee || payload.merchant || "Expense").trim();
        const category = String(payload.category || "Other").trim();
        const date = String(payload.date || new Date().toISOString().slice(0, 10));
        const direction = String(payload.direction || "DEBIT").toUpperCase() === "CREDIT" ? "CREDIT" : "DEBIT";

        await query(
          sql,
          `INSERT INTO transactions (
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
             updated_at = CURRENT_TIMESTAMP`,
          [
            entityId,
            workspaceId,
            userEmail,
            name,
            amount,
            category,
            date,
            payload.time || null,
            direction,
            payload.paymentMethod || payload.payment_method || null,
            payload.billingCycle || payload.billing_cycle || null,
            payload.notes || null,
            payload.bankName || payload.bank_name || null,
            payload.maskedAccount || payload.masked_account || null,
            payload.accountLast4 || payload.account_last4 || null,
            payload.referenceId || payload.reference_id || null,
            payload.smsReferenceId || payload.sms_reference_id || null,
            payload.upiReference || payload.upi_reference || null,
            payload.rawSmsText || payload.raw_sms_text || null,
            payload.merchant || null,
            payload.payee || null,
            payload.source || "sync",
            payload.active !== false,
            isDeleted,
            Date.now(),
          ]
        );
      } else if (moduleName === "workspace" && entityId === "root") {
        await query(
          sql,
          `INSERT INTO workspaces (user_identifier, user_email, workspace_data, updated_at, sync_version)
           VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP::text, $4)
           ON CONFLICT (user_identifier) DO UPDATE SET
             user_email = EXCLUDED.user_email,
             workspace_data = EXCLUDED.workspace_data,
             updated_at = EXCLUDED.updated_at,
             sync_version = EXCLUDED.sync_version`,
          [workspaceId, userEmail, JSON.stringify(payload), nextRevision]
        );
      }

      await query(
        sql,
        `INSERT INTO sync_mutations
           (mutation_id, workspace_identifier, user_email, device_id, module, entity_id, operation, base_revision, revision, payload, payload_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)`,
        [
          mutationId,
          workspaceId,
          userEmail,
          deviceId,
          moduleName,
          entityId,
          operation,
          baseRevision,
          nextRevision,
          JSON.stringify(payload),
          payloadHash,
        ]
      );

      accepted.push(mutationId);
    }

    const pulledRows = await query(
      sql,
      `SELECT server_cursor, mutation_id, device_id, module, entity_id, operation, base_revision, revision, payload
       FROM sync_mutations
       WHERE workspace_identifier = $1 AND user_email = $2 AND server_cursor > $3
       ORDER BY server_cursor ASC LIMIT 1000`,
      [workspaceId, userEmail, cursor]
    );

    const latestRows = await query(
      sql,
      "SELECT COALESCE(MAX(server_cursor), 0)::text AS cursor FROM sync_mutations WHERE workspace_identifier = $1 AND user_email = $2",
      [workspaceId, userEmail]
    );

    return jsonResponse(
      {
        success: true,
        accepted_mutation_ids: accepted,
        conflicts,
        changes: pulledRows.map((row: any) => ({
          cursor: String(row.server_cursor),
          mutation_id: row.mutation_id,
          device_id: row.device_id,
          module: row.module,
          entity_id: row.entity_id,
          operation: row.operation,
          base_revision: Number(row.base_revision || 0),
          revision: Number(row.revision),
          payload: row.payload,
        })),
        next_cursor: pulledRows.length
          ? String(pulledRows[pulledRows.length - 1].server_cursor)
          : String(latestRows[0]?.cursor || cursor),
        has_more: pulledRows.length === 1000,
      },
      200,
      request
    );
  } catch (err: any) {
    console.error("[CF Sync] handleSyncV2 error:", err);
    return jsonResponse({ success: false, error: err?.message || "Sync protocol error" }, 500, request);
  }
}

async function handleGetDevices(request: Request, env: Record<string, string | undefined>): Promise<Response> {
  const token = readBearerToken(request);
  if (!token) {
    return jsonResponse({ success: false, error: "Authenticated session required" }, 401, request);
  }

  const sql = getDb(env);

  try {
    const sessionRows = await query(
      sql,
      `SELECT s.user_email, s.created_at
       FROM user_active_sessions s
       JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
       JOIN app_users u ON LOWER(u.email) = LOWER(s.user_email)
       WHERE s.token = $1 LIMIT 1`,
      [token]
    );

    const session = sessionRows[0];
    if (!session || Number(session.created_at) + SESSION_TTL_MS <= Date.now()) {
      return jsonResponse({ success: false, error: "Invalid or expired session" }, 401, request);
    }

    const now = Date.now();
    const TWO_MINUTES_MS = 2 * 60 * 1000;
    const rows = await query(
      sql,
      "SELECT * FROM devices WHERE LOWER(user_email) = LOWER($1) AND is_revoked = false",
      [session.user_email]
    );

    const devices = rows
      .map((d: any) => ({
        ...d,
        isOnline: now - Number(d.last_active) <= TWO_MINUTES_MS,
      }))
      .sort((a: any, b: any) => Number(b.last_active) - Number(a.last_active));

    return jsonResponse(
      {
        success: true,
        devices,
        count: devices.length,
        active_count: devices.filter((d: any) => d.isOnline).length,
      },
      200,
      request
    );
  } catch (err: any) {
    console.error("[CF Devices] Error listing devices:", err);
    return jsonResponse({ success: false, error: "Internal server error" }, 500, request);
  }
}

async function handlePostHeartbeat(request: Request, env: Record<string, string | undefined>): Promise<Response> {
  const token = readBearerToken(request);
  if (!token) {
    return jsonResponse({ success: false, error: "Authenticated session required" }, 401, request);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const sql = getDb(env);

  try {
    const sessionRows = await query(
      sql,
      `SELECT s.user_email, s.device_id, s.device_name, s.created_at, u.id
       FROM user_active_sessions s
       JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
       JOIN app_users u ON LOWER(u.email) = LOWER(s.user_email)
       WHERE s.token = $1 LIMIT 1`,
      [token]
    );

    const session = sessionRows[0];
    if (!session || Number(session.created_at) + SESSION_TTL_MS <= Date.now()) {
      return jsonResponse({ success: false, error: "Invalid or expired session" }, 401, request);
    }

    const id = String(session.device_id);
    const now = Date.now();
    const cleanEmail = String(session.user_email).trim().toLowerCase();
    const cleanIdentifier = `user_usr_${cleanEmail.replace(/[^a-z0-9]/g, "_")}`;

    const existingRows = await query(sql, "SELECT * FROM devices WHERE id = $1", [id]);
    const existing = existingRows[0];

    if (existing && existing.is_revoked) {
      return jsonResponse(
        {
          success: false,
          revoked: true,
          message: "Device session has been revoked because your account was signed in on another device",
        },
        401,
        request
      );
    }

    const deviceName = parseReadableDeviceName(
      request,
      String(body.device_name || body.deviceName || session.device_name || "").trim()
    );

    await query(
      sql,
      `INSERT INTO devices (id, user_email, user_identifier, device_name, platform, environment, app_version, created_at, last_active, ip_address, user_agent, is_revoked)
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
         is_revoked = false`,
      [
        id,
        cleanEmail,
        cleanIdentifier,
        deviceName,
        body.platform || existing?.platform || "web_browser",
        body.environment || existing?.environment || "Web Browser",
        body.app_version || existing?.app_version || "1.0.0",
        existing ? existing.created_at : now,
        now,
        request.headers.get("cf-connecting-ip") || undefined,
        request.headers.get("user-agent") || undefined,
      ]
    );

    await query(
      sql,
      `INSERT INTO connected_devices (id, user_email, user_identifier, device_name, platform, environment, app_version, created_at, last_active, ip_address, user_agent, is_revoked)
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
         is_revoked = false`,
      [
        id,
        cleanEmail,
        cleanIdentifier,
        deviceName,
        body.platform || existing?.platform || "web_browser",
        body.environment || existing?.environment || "Web Browser",
        body.app_version || existing?.app_version || "1.0.0",
        existing ? existing.created_at : now,
        now,
        request.headers.get("cf-connecting-ip") || undefined,
        request.headers.get("user-agent") || undefined,
      ]
    );

    return jsonResponse({ success: true, timestamp: now }, 200, request);
  } catch (err: any) {
    console.error("[CF Devices] Heartbeat error:", err);
    return jsonResponse({ success: false, error: "Internal server error" }, 500, request);
  }
}

async function handleDeleteDevice(
  request: Request,
  deviceId: string,
  env: Record<string, string | undefined>
): Promise<Response> {
  const token = readBearerToken(request);
  if (!token) {
    return jsonResponse({ success: false, error: "Authenticated session required" }, 401, request);
  }

  const sql = getDb(env);

  try {
    const sessionRows = await query(
      sql,
      `SELECT s.user_email, s.created_at
       FROM user_active_sessions s
       JOIN app_state a ON a.singleton = TRUE AND s.generation = a.generation
       JOIN app_users u ON LOWER(u.email) = LOWER(s.user_email)
       WHERE s.token = $1 LIMIT 1`,
      [token]
    );

    const session = sessionRows[0];
    if (!session || Number(session.created_at) + SESSION_TTL_MS <= Date.now()) {
      return jsonResponse({ success: false, error: "Invalid or expired session" }, 401, request);
    }

    await query(
      sql,
      "UPDATE devices SET is_revoked = true WHERE id = $1 AND LOWER(user_email) = LOWER($2)",
      [deviceId, session.user_email]
    );
    await query(
      sql,
      "UPDATE connected_devices SET is_revoked = true WHERE id = $1 AND LOWER(user_email) = LOWER($2)",
      [deviceId, session.user_email]
    );

    return jsonResponse({ success: true, message: "Device revoked" }, 200, request);
  } catch (err: any) {
    console.error("[CF Devices] Error revoking device:", err);
    return jsonResponse({ success: false, error: "Internal server error" }, 500, request);
  }
}

async function handleWeather(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const queryString = url.search ? url.search : "";
    const targetUrl = `https://api.open-meteo.com/v1/forecast${queryString}`;
    const upstreamRes = await fetch(targetUrl);
    const data = await upstreamRes.json();
    return jsonResponse(data, upstreamRes.status, request);
  } catch (err) {
    console.error("[CF Weather] error:", err);
    return jsonResponse({ error: "Upstream service unavailable" }, 502, request);
  }
}

// ---------------------------------------------------------------------------
// Main Cloudflare Pages Function onRequest Dispatcher
// ---------------------------------------------------------------------------

export async function onRequest(context: EventContext): Promise<Response> {
  const { request, env } = context;

  // Handle CORS preflight for all routes
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  try {
    // 1. Auth routes
    if (pathname === "/api/auth/register" && request.method === "POST") {
      return await handleRegister(request, env);
    }
    if (pathname === "/api/auth/login" && request.method === "POST") {
      return await handleLogin(request, env);
    }
    if (pathname === "/api/auth/verify" && (request.method === "GET" || request.method === "POST")) {
      return await handleVerify(request, env);
    }
    if (pathname === "/api/auth/logout" && request.method === "POST") {
      return await handleLogout(request, env);
    }
    if (pathname === "/api/auth/change-password" && request.method === "POST") {
      return await handleChangePassword(request, env);
    }

    // 2. Storage diagnostic
    if (pathname === "/api/storage/diagnostic" && request.method === "GET") {
      return await handleStorageDiagnostic(request, env);
    }

    // 3. Sync v2 protocol
    if (pathname === "/api/sync/v2" && (request.method === "POST" || request.method === "GET")) {
      return await handleSyncV2(request, env);
    }

    // 4. Device routes
    if (
      (pathname === "/api/sync/devices" || pathname === "/api/devices/active") &&
      request.method === "GET"
    ) {
      return await handleGetDevices(request, env);
    }
    if (
      (pathname === "/api/sync/devices/heartbeat" || pathname === "/api/devices/heartbeat") &&
      request.method === "POST"
    ) {
      return await handlePostHeartbeat(request, env);
    }
    if (pathname.startsWith("/api/sync/devices/") && request.method === "DELETE") {
      const deviceId = decodeURIComponent(pathname.replace("/api/sync/devices/", ""));
      return await handleDeleteDevice(request, deviceId, env);
    }
    if (pathname === "/api/devices/revoke" && request.method === "POST") {
      let body: any = {};
      try {
        body = await request.json();
      } catch {}
      const deviceId = String(body.deviceId || body.device_id || "");
      return await handleDeleteDevice(request, deviceId, env);
    }

    // 5. Weather proxy
    if (pathname.startsWith("/api/weather") && request.method === "GET") {
      return await handleWeather(request);
    }

    // Diagnostics / Debug ping for Neon DB reachability
    if (pathname === "/api/db-check" && request.method === "GET") {
      try {
        const sql = getDb(env);
        const t0 = Date.now();
        const testRes = await query(sql, "SELECT NOW() AS now, count(*)::text AS user_count FROM app_users");

        return jsonResponse({
          version: "d052305_check",
          success: true,
          elapsedMs: Date.now() - t0,
          result: testRes
        }, 200, request);
      } catch (dbErr: any) {
        return jsonResponse({
          success: false,
          error: String(dbErr?.message || dbErr),
          stack: String(dbErr?.stack || ""),
          env_keys: Object.keys(env || {})
        }, 500, request);
      }
    }

    // Fallback for undefined API routes
    return jsonResponse({ error: "API endpoint not found", path: pathname }, 404, request);
  } catch (err: any) {
    console.error("[CF API] Unhandled error:", err);
    return jsonResponse({ error: "Internal server error" }, 500, request);
  }
}
