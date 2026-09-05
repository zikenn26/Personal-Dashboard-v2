# Personal Dashboard & Life OS

An ultra-performant, private-first personal dashboard, life operating system, and portfolio application built with React, TypeScript, Tailwind CSS, and Web Cryptography.

---

## 🌟 Application Architecture & Modules

The application is structured into interconnected personal productivity and organization modules:

- **🏠 Home / Today**: Centralized daily command center featuring quick capture, daily progress indicators, active habits checklist, priority tasks overview, and motivational quotes.
- **☑️ Tasks & Kanban**: Flexible kanban workflow supporting four progress states (*To Do*, *In Progress*, *In Review*, *Complete*), priority categorization (*Urgent*, *High*, *Medium*, *Low*), categories, and due dates.
- **🔥 Habits Tracker**: 7-day interactive habit completion matrix with automatic streak counters and category tagging.
- **🎯 Goals & Milestones**: Objective tracking with dynamic progress percentages (0–100%), milestone checklists, and target completion dates.
- **🗺️ Life Map & Timeline**: Chronological interactive milestone roadmap detailing career, personal, academic, and life achievements.
- **💼 Portfolio & Workfolio**: Comprehensive showcase of engineering projects, tech stack badges, live links, GitHub repositories, education credentials, and resume documents.
- **📖 Dear Diary / Journal**: Reflective personal journal with mood tracking, weather indicators, energy levels, thematic canvas backgrounds (*Parchment*, *Midnight*, *Lavender*, *Lined*, *Dotted*, *Grid*), and PIN-locked private entries.
- **💬 Quotes**: Curated repository of inspiration with author attribution and copy-to-clipboard actions.
- **🎬 Library / Media**: Entertainment and learning tracker for books, movies, games, and series with five-star ratings, status filtering, and review notes.
- **💳 Spending & Subscriptions**: Financial transaction tracker with expense categorization, payment method tracking, and recurring billing cycles (*Monthly*, *Yearly*, *One-time*).
- **🔐 Encrypted Password Vault**: Client-side encrypted credential repository with PIN authentication, strength analyzer, and cryptographically secure random password generator.
- **💾 Cloud & Local Storage Engine**: Full JSON backup export/import engine and real-time Supabase cloud synchronization.
- **⌘K Command Palette**: Fast keyboard-driven fuzzy search to navigate between all workspace sections instantly.

---

## 🔐 Security Architecture & Encryption Technology

The Password Vault is engineered with client-side zero-knowledge cryptography using the native browser **Web Cryptography API** (`window.crypto.subtle`):

### Cryptographic Specifications
- **Cipher**: **AES-GCM-256** (Advanced Encryption Standard in Galois/Counter Mode with 256-bit symmetric key).
- **Key Derivation**: **PBKDF2** (Password-Based Key Derivation Function 2) using **HMAC-SHA-256**.
- **KDF Iterations**: **210,000 iterations**, strictly adhering to OWASP recommendations to prevent brute-force attacks.
- **Salt Generation**: 16-byte cryptographically secure pseudorandom salt generated per encryption via `crypto.getRandomValues()`.
- **Initialization Vector (IV)**: 12-byte unique IV generated for every encryption pass to prevent replay attacks and ciphertext pattern leakage.
- **Ciphertext Integrity**: AES-GCM is an Authenticated Encryption with Associated Data (AEAD) scheme. Any tampering with ciphertext or incorrect PIN entry causes authentication verification failure and immediate decryption rejection.

### Zero-Knowledge Persistence & Cloud Backups
- **Decrypted in Memory Only**: Credentials are only held in decrypted memory during an active, unlocked browser session.
- **Local Storage Security**: Local storage only ever receives the encrypted payload:
  ```json
  {
    "version": 1,
    "algorithm": "AES-GCM-256/PBKDF2-SHA-256",
    "iterations": 210000,
    "salt": "<base64-encoded-salt>",
    "iv": "<base64-encoded-iv>",
    "ciphertext": "<base64-encoded-ciphertext>"
  }
  ```
- **Safe Cloud Synchronization**: When workspace data is synchronized to Supabase or exported to a JSON backup, only the `vaultEncrypted` payload is transmitted. Plaintext passwords never leave the client device or touch remote databases.

---

## 🗄️ Database Structure & Supabase Integration

The app supports a dual-tier persistence model: **Local-First (LocalStorage)** with optional **Supabase Cloud Sync**.

### Supabase Schema (`public.user_workspaces`)
```sql
CREATE TABLE IF NOT EXISTS public.user_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_identifier TEXT UNIQUE NOT NULL,
    user_email TEXT,
    workspace_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security (RLS)
ALTER TABLE public.user_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
    ON public.user_workspaces FOR SELECT USING (true);

CREATE POLICY "Allow public insert/update access"
    ON public.user_workspaces FOR ALL USING (true) WITH CHECK (true);
```

- **Conflict Handling**: Synchronizations use `.upsert(payload, { onConflict: 'user_identifier' })` to safely synchronize workspaces across devices.
- **Realtime Channels**: Listens to changes on `user_workspaces` where `user_identifier = active_workspace` to propagate updates without page reload.

---

## 💾 Backup & Restore System

- **Export**: Exports complete workspace state into an indented JSON file (`Notion_LifeOS_Backup_<YYYY-MM-DD>.json`) containing version `4.0.0`, profile data, tasks, habits, goals, milestones, journal, media, financial records, and the encrypted vault payload.
- **Import Validation**: Validates the payload structure before applying changes, rejecting empty, malformed, or unrecognized JSON structures.
- **Vault Re-encryption**: Changing the Master PIN in Account Settings automatically re-encrypts stored secrets with the updated credentials.

---

## 🛠️ Development & Testing

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Starts the Vite development server on `http://0.0.0.0:3000`.

### Production Build
```bash
npm run build
```
Builds the client bundle with Vite and bundles the Node server with esbuild to `dist/`.

### Testing
```bash
npx vitest run
```
Runs the automated test suite verifying client-side cryptography, backup integrity, and Supabase client configuration.
