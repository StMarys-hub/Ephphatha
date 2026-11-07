# ANTIGRAVITY AI SYSTEM SPECIFICATION: EPHPHATHA ("BE OPENED")
**Document Version:** 3.0.0-ENTERPRISE  
**Target AI Engine:** Antigravity Autonomous Full-Stack Engineering System  
**Application Name:** Ephphatha (Aramaic: *“Be Opened”* — Mark 7:34)  
**Platform:** Progressive Web Application (PWA) & Hybrid Mobile Web Shell (iOS / Android / Desktop)  
**Architecture Paradigm:** Local-First Optimistic UI + Edge-Cached Google Drive Cloud Storage + Multi-Tier Online Failover Mesh  

---

## 0. META-PROMPT DIRECTIVE FOR ANTIGRAVITY AI
> **SYSTEM INSTRUCTION:** You are Principal Enterprise Systems Architect, Staff UI/UX Accessibility Designer, and Lead Application Security Engineer. Ingest this entire specification to build **Ephphatha**, a high-performance, zero-latency, enterprise-hardened "Bible in a Year" web and mobile application. Every architectural component, color token, failover pipeline, Google Drive folder node, and security control defined below is **non-negotiable** and must be implemented with production-grade rigor, strict type safety, and modular maintainability.

---

## 1. CORE ARCHITECTURAL PILLARS (NON-NEGOTIABLE MANDATES)

### 1.1 Pillar I: Ultra-Performance & Zero-Latency Sync (<50ms UI Response)
1. **Local-First Optimistic State Engine:**
   - All user interactions (marking a day complete, saving audio playback timestamps, highlighting verses, writing prayer reflections, or adding Fellowship members) MUST write immediately to client-side `IndexedDB` (via a structured wrapper) in **<5ms**.
   - The UI must never block on network I/O or display blocking spinners during routine interactions.
2. **Asynchronous Background Sync Queue (`BackgroundSync API` + `sendBeacon`):**
   - Mutations are queued in an encrypted local outbox and flushed asynchronously in debounced batches (every 15 seconds or on page visibility change) to the Google Drive Database API endpoint.
3. **HTTP 206 Byte-Range Edge Audio Streaming:**
   - Audio files stored in Google Drive must stream through an edge proxy worker (Cloudflare Worker / Edge Function) that enforces `Accept-Ranges: bytes`, enabling instant scrubbing, zero-buffer startup, and automatic Service Worker pre-caching of Day $N+1$ while Day $N$ is playing.

### 1.2 Pillar II: Elastic Scalability (Zero-Bottleneck Cloud Storage)
1. **Sharded User AppData Isolation:**
   - Rather than funneling 100,000+ users into a single rate-limited Google Sheet for every read/write, each authenticated user’s personal progress (`progress_log.json`, `bookmarks.json`, `journals.json`) is stored in their isolated Google Drive `appDataFolder` (which carries independent per-user quota) and asynchronously aggregated into the central `Ephphatha_Master_DB` sheet via a queued worker.
2. **Dynamic Online Curriculum & Schedule Ingestion:**
   - The 365-day reading plan, daily titles, period mappings, and scripture references are fetched dynamically at boot from an online CDN/Drive JSON endpoint (`schedule_manifest_v3.json`), using `Stale-While-Revalidate` caching so curriculum updates propagate globally without requiring app store binary updates.

### 1.3 Pillar III: Enterprise Maintainability & Modular Clean Architecture
1. **Strict Separation of Concerns (Hexagonal / Clean Architecture):**
   - `domain/`: Pure TypeScript business logic (12 Time Periods state machine, Grace Streak calculator, verse parser).
   - `adapters/data/`: Multi-tier Bible API failover orchestrator, Google Drive V3 API client, IndexedDB repository.
   - `ui/`: Accessible, theme-aware reactive components using strict CSS custom properties.
2. **Observability & Self-Healing Telemetry:**
   - Structured client-side telemetry logs every sync operation, API failover switch, and security integrity check without exposing Personally Identifiable Information (PII).

---

## 2. CONTENT & DYNAMIC ONLINE SCHEDULE ARCHITECTURE

### 2.1 Dynamic Online Curriculum Ingestion (`schedule_manifest_v3.json`)
The app must NOT hardcode the 365 days statically without an online update mechanism. On startup, the app queries the primary online curriculum endpoint to retrieve:
- `day_number` ($1 \dots 365$)
- `period_id` ($1 \dots 12$)
- `episode_title` (Multilingual support: English & Malayalam)
- `readings`: `{ narrative: string, supplemental: string, psalm_wisdom: string }`
- `gdrive_audio_file_id`: Pre-indexed Google Drive file ID for 0ms lookup
- `historical_context`: `{ era_date: string, geography: string, lineage: string, summary: string, reflection_prompt: string }`

### 2.2 The 12 Periods of Salvation History (Dynamic Theme Engine)
The curriculum divides the Bible into 12 chronological chapters. Selecting any day or period morphs the application's semantic accent tokens (`--period-color` and `--period-bg-soft`):

| Period ID | Period Name | Biblical Narrative Span | Thematic Focus | Primary Accent Hex | Google Drive Folder Node |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | **Early World** | Genesis 1–11 | Creation & Fall | `#2B8CBE` (Teal Blue) | `/01_Early_World/` |
| **02** | **Patriarchs** | Genesis 12–50 | Covenant Fathers | `#8E2430` (Burgundy) | `/02_Patriarchs/` |
| **03** | **Egypt & Exodus** | Exodus 1–40 | Liberation & Law | `#C62828` (Crimson) | `/03_Egypt_And_Exodus/` |
| **04** | **Desert Wanderings** | Numbers 1–36 | Wilderness Testing | `#A47551` (Warm Ochre) | `/04_Desert_Wanderings/` |
| **05** | **Conquest & Judges** | Joshua, Judges, 1 Sam 1–8 | Promised Land | `#2E7D32` (Forest Green) | `/05_Conquest_And_Judges/` |
| **06** | **Royal Kingdom** | 1 Sam 9–31, 2 Sam, 1 Kgs 1–11 | Davidic Throne | `#6A1B9A` (Royal Purple) | `/06_Royal_Kingdom/` |
| **07** | **Divided Kingdom** | 1 Kgs 12–22, 2 Kgs 1–16 | North vs. South | `#475569` (Slate Charcoal) | `/07_Divided_Kingdom/` |
| **08** | **Exile** | 2 Kings 17–25 | Captivity & Hope | `#0284C7` (Cerulean) | `/08_Exile/` |
| **09** | **Return** | Ezra, Nehemiah | Rebuilding Jerusalem | `#D97706` (Warm Amber) | `/09_Return/` |
| **10** | **Maccabean Revolt** | 1 Maccabees | Heroic Fidelity | `#EA580C` (Burnt Orange) | `/10_Maccabean_Revolt/` |
| **11** | **Messianic Fulfillment** | Luke & The Four Gospels | Christ the Redeemer | `#B4831E` (Liturgical Gold) | `/11_Messianic_Fulfillment/` |
| **12** | **The Church** | Acts, Epistles, Revelation | Holy Spirit & Mission | `#3B82F6` (Apostolic Blue) | `/12_The_Church/` |

---

## 3. MULTI-TIER ONLINE BIBLE TEXT FAILOVER ARCHITECTURE

To guarantee **99.999% availability** when loading daily reading passages (full passage text in English, Malayalam POC Bible, and additional languages), implement an automated **4-Tier Circuit-Breaker Failover Pipeline**:

```text
[User Requests Daily Scripture Text (Day N: Narrative / Supplemental / Psalm)]
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TIER 1: Primary Online Multilingual Bible API Gateway (Timeout: 1800ms) │
│ • Fetches structured JSON verses (English + Malayalam POC Unicode)      │
└──────┬──────────────────────────────────────────────────────────────────┘
       │ (If HTTP 5xx, Rate-Limited 429, Timeout > 1.8s, or CORS Error)
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TIER 2: Secondary Public Scripture Mirror API (bible-api.com / Bolls)   │
│ • Secondary REST fetch with automatic schema normalization (Timeout: 2s)│
└──────┬──────────────────────────────────────────────────────────────────┘
       │ (If Secondary API Unreachable)
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TIER 3: Google Drive Cloud Text Mirror (/00_System_Manifest_And_DB/)    │
│ • Fetches pre-packaged period scripture JSON directly from Drive CDN    │
└──────┬──────────────────────────────────────────────────────────────────┘
       │ (If Device is 100% Offline / Airplane Mode)
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TIER 4: Local IndexedDB & Service Worker Offline Scripture Vault        │
│ • Serves pre-cached bilingual verses in 0ms with "Offline Ready" badge  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Verse-by-Verse Reader & Malayalam (POC) Typography Requirements
- **Default Languages:** **English** and **Malayalam (`മലയാളം — POC Bible`)**, supporting Single-Language view or **Parallel Bilingual Verse-by-Verse** view, plus extensible support for Hindi, Spanish, and Latin.
- **Malayalam Font Optimization:** Load Google Fonts `Noto Sans Malayalam` (weights 400, 500, 700) and `Manjari`. Enforce `line-height: 1.85` and `letter-spacing: 0.01em` so complex Malayalam conjunct characters (`കൂട്ടക്ഷരങ്ങൾ`) never clip or crowd on mobile viewports.
- **Interactive Verse Navigation:** Provide a horizontal `"Go to Verse"` quick-jump pill bar (`v.1`, `v.2`, `v.3`...) and 1-tap verse bookmarking synced to Google Drive.

---

## 4. UI/UX DESIGN SYSTEM & RICH and EYE-SOOTHING "WARM DUSK" DARK MODE

### 4.1 Color Palette: Eye-Friendly Sanctuary (NO Harsh Midnight #000000 Black)
Harsh pure-black (`#000000`) or ultra-dark midnight backgrounds cause **halations (astigmatism blurring)** and severe eye fatigue during extended scripture reading. Ephphatha enforces a soothing, low-glare **"Warm Dusk / Soft Evening Slate"** dark mode alongside its **"Warm Parchment"** light mode:

| Semantic Token | Light Mode ("Warm Parchment") | Dark Mode ("Warm Dusk Sanctuary" — Easy on Eyes) | Contrast Purpose |
| :--- | :--- | :--- | :--- |
| `--bg-primary` | `#FAF7F2` (Warm Alabaster Parchment) | `#1E2430` (Soft Evening Twilight Slate — *Never #000*) | Eliminates halation & eye strain |
| `--bg-elevated-card` | `#FFFFFF` (Pure Ivory Card) | `#272F3E` (Warm Mineral Slate Card) | Gentle depth separation |
| `--bg-subtle-surface`| `#F3EDE2` (Sandstone) | `#313B4E` (Muted Dusk Surface) | Verse containers & input fields |
| `--text-primary` | `#1C1917` (Deep Espresso Ink) | `#EAE6DF` (Warm Cream / Soft Linen — *Never #FFF*) | Prevents white-on-black glare |
| `--text-secondary` | `#57534E` (Warm Stone Gray) | `#B8B2A6` (Muted Warm Pewter) | Subtitles, verse metadata |
| `--border-subtle` | `#E6DEC8` (Warm Parchment Rule) | `#3A4559` (Soft Slate Hairline) | Non-intrusive card borders |

### 4.2 Senior-First Ergonomics ("Anybody Can Use It")
- **1-Tap Font Scaler (`AA` Button):** Cycles root font scale between `100% (16px)`, `112% (18px - Large)`, and `125% (20px - Senior Comfort)` while proportionally scaling touch targets.
- **Thumb-Zone Architecture:** Primary Play/Pause, 15s Skip, Mark Complete, and Tab Navigation are anchored in the bottom 60% of the viewport with $\ge 48 \times 48\text{px}$ tap targets.

---

## 5. GOOGLE DRIVE FOLDER & DATABASE OPTIMIZATION

### 5.1 Optimal Google Drive Hierarchy
```text
📁 Ephphatha_Cloud_Root/
 ├── 📁 00_System_Manifest_And_DB/
 │    ├── 📄 schedule_manifest_v3.json        <-- Dynamic Online 365-Day Schedule & File IDs
 │    ├── 📄 scripture_fallback_vault.json    <-- Tier-3 Offline/Cloud Bilingual Verse Backup
 │    └── 📊 Ephphatha_Master_DB (Sheet)      <-- Relational aggregation (Users, Fellowships, Logs)
 ├── 📁 01_Early_World/                       <-- Days 001–004 (64kbps HE-AAC .m4a)
 ├── 📁 02_Patriarchs/                        <-- Days 005–026
 ├── ... (Folders 03 through 11)
 └── 📁 12_The_Church/                        <-- Days 336–365
```

### 5.2 Fellowship Community & Cohort Schema
- Users can create custom **Fellowship Communities**, generate 6-character alphanumeric invite codes, copy shareable deep-links, and add/invite family or parish members by Name + Email/WhatsApp.
- Member status (`Completed Today`, `Listening Now`, `Grace Shield Active`) and 1-tap `"🙏 Amen"` prayer encouragements sync via the `Fellowship_Cohorts` table in `Ephphatha_Master_DB`.

---

## 6. HARDENED CYBERSECURITY ARCHITECTURE & THREAT MATRIX

To protect user data, prevent unauthorized manipulation of the Google Drive backend, and defend against malicious web attacks, implement the following **Defense-in-Depth Security Architecture**:

### 6.1 Explicit Threat Matrix & Engineering Countermeasures

| Threat Vector / Attack Type | Severity | Concrete Engineering Safeguard & Mitigation |
| :--- | :--- | :--- |
| **1. Cross-Site Scripting (XSS) via User Reflections, Fellowship Names, or Online Bible APIs** | **CRITICAL** | • Enforce a strict **Content Security Policy (CSP)** header (`default-src 'self'; script-src 'self'; object-src 'none'`).<br>• Sanitize all user inputs (Prayer Journals, Fellowship Member Names) and external Bible API payloads using strict HTML entity encoding / DOMPurify before rendering.<br>• Never use unsafe `eval()` or unescaped HTML injection for user-supplied strings. |
| **2. Google Drive API Key / Service Account Credential Leakage** | **CRITICAL** | • **Zero Client-Side Secret Exposure:** Never embed raw Google Cloud Service Account private keys in client-side JavaScript.<br>• Route all Drive audio streams and Master Sheet writes through a hardened **Edge API Gateway / Proxy Worker** that holds secrets in encrypted environment variables and validates user JWTs. |
| **3. Unauthorized Database Tampering / IDOR (Insecure Direct Object Reference)** | **HIGH** | • Enforce **OAuth 2.0 + PKCE (Proof Key for Code Exchange)** for user authentication.<br>• Store private user journals and progress inside the user's isolated Google Drive `appDataFolder` (accessible only by that authenticated user's OAuth token).<br>• Sign all sync payloads with **HMAC-SHA256** request signatures and timestamp nonces to prevent replay attacks. |
| **4. DDoS, Bot Scraping & API Quota Exhaustion on Google Drive Audio/DB** | **HIGH** | • Implement **Token-Bucket Rate Limiting** at the Edge Worker layer (max 30 requests/minute per IP/User ID).<br>• Cache audio byte-ranges and `schedule_manifest_v3.json` at the CDN Edge (`Cache-Control: public, max-age=86400, s-maxage=604800`) so 98% of requests never hit Google Drive's origin quota. |
| **5. Man-in-the-Middle (MitM) & Local Storage Tampering** | **MEDIUM** | • Enforce **HTTPS / HSTS** (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`).<br>• Encrypt sensitive personal prayer reflections at rest in `IndexedDB` using the browser's native **Web Crypto API (`AES-GCM` 256-bit)** keyed to the user's session credential. |
| **6. Supply-Chain & Third-Party Bible API Poisoning** | **MEDIUM** | • Validate all incoming online schedule and Bible verse JSON payloads against a strict **JSON Schema / Zod validator** before rendering or caching.<br>• Use **Subresource Integrity (SRI)** hashes on all external scripts and font stylesheets. |
Include a user login option to allow users to track their reading, listening, and other activities beyond a guest profile. No password is required; instead, users should be able to log in automatically using their device's native system login (such as their mobile or laptop biometrics/PIN). Architect the best option for this implementation.


---

## 7. ANTIGRAVITY AI EXECUTION CHECKLIST
1. **Generate Core App Shell:** Responsive Mobile-First Viewport + Desktop Telemetry & Security Companion Inspector.
2. **Initialize Eye-Friendly Theme Engine:** Configure Light Mode (`#FAF7F2` Parchment) and Eye-Soothing Dark Mode (`#1E2430` Warm Dusk Slate — strictly avoiding harsh `#000000` black).
3. **Wire Dynamic Online Schedule & 4-Tier Scripture Failover:** Implement live online schedule hydration (`schedule_manifest_v3.json`) and the 4-tier Bible text failover switch (Primary Online API $\rightarrow$ Secondary Mirror $\rightarrow$ Google Drive Vault $\rightarrow$ Local IndexedDB).
4. **Mount Bilingual Verse-by-Verse Reader:** Render English and Malayalam (`Noto Sans Malayalam` / `Manjari`) scripture verses with quick-jump pills and tap-to-bookmark persistence.
5. **Mount Fellowship Community Engine:** Enable creating Fellowship cohorts, generating invite codes, and adding/inviting members with input sanitization.
6. **Activate Security Guardrails:** Enable input sanitization, Web Crypto payload signing simulation, rate-limit protection, and live security posture telemetry.

This project can be push into github Ephphatha repo and publish to share and execute. 
Build an html document for manual steps, scripts if manual execution required like setup Google drive folder structure, or anything like that.