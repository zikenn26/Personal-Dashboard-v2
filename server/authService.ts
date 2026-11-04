import type { Express, Request, Response } from "express";
import { pool } from "./db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_fallback_key";

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: "Missing email or password" });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanId = cleanEmail.replace(/[^a-z0-9]/g, "_");

      const authKey = `account_auth_${cleanId}`;
      const { rows } = await pool.query("SELECT * FROM workspaces WHERE user_identifier = $1", [authKey]);

      if (rows.length > 0) {
        return res.status(400).json({ success: false, message: "Email already registered." });
      }

      const passHash = await bcrypt.hash(password, 10);
      const nowMs = Date.now();
      const user = {
        id: `usr_${cleanId}_${nowMs}`,
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        createdAt: nowMs,
        lastLoginAt: nowMs,
        provider: 'local',
      };

      const nowIso = new Date().toISOString();

      await pool.query(
        `INSERT INTO workspaces (user_identifier, user_email, workspace_data, updated_at, sync_version)
         VALUES ($1, $2, $3, $4, $5)`,
        [authKey, cleanEmail, JSON.stringify({ account: { user, passHash, createdAt: nowMs, updatedAt: nowMs } }), nowIso, nowMs]
      );

      return res.status(200).json({ success: true, message: "Registered successfully" });
    } catch (err: any) {
      console.error("[AuthService] Register error:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: "Missing credentials" });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanId = cleanEmail.replace(/[^a-z0-9]/g, "_");

      const authKey = `account_auth_${cleanId}`;
      const { rows } = await pool.query("SELECT * FROM workspaces WHERE user_identifier = $1", [authKey]);

      if (rows.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid email or password." });
      }

      const accountData = rows[0].workspace_data?.account;
      if (!accountData || !accountData.passHash) {
        return res.status(400).json({ success: false, message: "Invalid account data." });
      }

      const isValid = await bcrypt.compare(password, accountData.passHash);
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Invalid email or password." });
      }

      const token = jwt.sign({ id: accountData.user.id, email: cleanEmail }, JWT_SECRET, { expiresIn: "7d" });
      const generation = Date.now();

      return res.status(200).json({
        success: true,
        user: accountData.user,
        token,
        generation
      });
    } catch (err: any) {
      console.error("[AuthService] Login error:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };

      const { current_password, new_password } = req.body;

      const cleanEmail = decoded.email.trim().toLowerCase();
      const cleanId = cleanEmail.replace(/[^a-z0-9]/g, "_");
      const authKey = `account_auth_${cleanId}`;

      const { rows } = await pool.query("SELECT * FROM workspaces WHERE user_identifier = $1", [authKey]);
      if (rows.length === 0) {
        return res.status(400).json({ success: false, message: "User not found." });
      }

      const workspace = rows[0];
      const accountData = workspace.workspace_data?.account;

      const isValid = await bcrypt.compare(current_password, accountData.passHash);
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Incorrect current password." });
      }

      const newPassHash = await bcrypt.hash(new_password, 10);
      workspace.workspace_data.account.passHash = newPassHash;
      workspace.workspace_data.account.updatedAt = Date.now();

      await pool.query(
        "UPDATE workspaces SET workspace_data = $1, updated_at = $2 WHERE user_identifier = $3",
        [JSON.stringify(workspace.workspace_data), new Date().toISOString(), authKey]
      );

      return res.status(200).json({ success: true, message: "Password updated successfully." });
    } catch (err: any) {
      console.error("[AuthService] Change password error:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    return res.status(200).json({ success: true });
  });

  app.get("/api/auth/verify", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      jwt.verify(token, JWT_SECRET);

      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
  });
}
