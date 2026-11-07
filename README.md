# Ephphatha (“Be Opened” — Mark 7:34)
**Enterprise Local-First "Bible in a Year" Progressive Web Application (PWA)**  
*English (RSV-CE / WEB) • Malayalam (`മലയാളം — പി.ഒ.സി. ബൈബിൾ`) • Latin (`Nova Vulgata`)*

---

## 🏛️ Architectural Highlights (v3.0.0-ENTERPRISE)

1. **Zero-Latency Local-First State Engine (`<5ms` IndexedDB Commits)**
   - Every user action (marking Day 1–365 complete, bookmarking verses, writing encrypted prayer reflections, or sending `🙏 Amen` encouragements in Fellowship cohorts) commits immediately to an optimistic memory mirror + `IndexedDB` (`EphphathaLocalVault_v3`) in **<5ms**.
   - Asynchronous background outbox (`sync_outbox`) batches mutations with **HMAC-SHA256** signatures + replay nonces and syncs with **LWW-Element-Set CRDT** conflict resolution.

2. **12 Chronological Periods of Salvation History (Dynamic Theme Engine)**
   - Selecting any of the 12 periods (`01 Early World` through `12 The Church`) dynamically morphs `--period-color` and `--period-bg-soft` across the entire application.

3. **Eye-Soothing "Warm Dusk" Dark Mode & Senior-First Ergonomics**
   - Strictly avoids harsh `#000000` black or `#FFFFFF` glare to eliminate astigmatism halation:
     - **Warm Dusk Dark Mode**: `#1E2430` background / `#272F3E` elevated slate card / `#EAE6DF` warm linen text.
     - **Warm Parchment Light Mode**: `#FAF7F2` alabaster parchment / `#1C1917` deep espresso ink.
   - **1-Tap `AA` Font Scaler**: Cycles between `100% (16px)`, `112% (18px)`, and `125% (20px)` with $\ge 48 \times 48\text{px}$ tap targets.
   - **Malayalam (`മലയാളം`) Typography**: Uses `Noto Sans Malayalam` & `Manjari` with `line-height: 1.85` so complex conjuncts (`കൂട്ടക്ഷരങ്ങൾ`) never clip.

4. **4-Tier Circuit-Breaker Bible Text Failover Pipeline (99.999% Availability)**
   - **Tier 1**: Primary Online Multilingual Gateway (`1800ms` timeout)
   - **Tier 2**: Secondary Public Scripture Mirror (`2000ms` timeout)
   - **Tier 3**: Google Drive Cloud Text Mirror (`data/scripture_fallback_vault.json`)
   - **Tier 4**: Local IndexedDB & Service Worker Offline Vault (`0ms` with `"Offline Ready"` badge)

5. **Hardened Cybersecurity & Passwordless Device Biometric Login**
   - **Passwordless Login**: W3C **WebAuthn Platform Passkeys** (FaceID, TouchID, Windows Hello PIN/Biometrics, Android Biometric Prompt) + **OAuth 2.0 PKCE (`S256`)**.
   - **Encryption at Rest**: Personal prayer reflections are encrypted in the browser via **Web Crypto API (`AES-GCM` 256-bit + `PBKDF2` 100,000 iterations)** before touching `IndexedDB`.
   - **Zero Secret Exposure Edge Proxy**: Streams Google Drive `.m4a` audio via `https://ephphatha-edge-proxy.jimmymj.workers.dev/audio/<FILE_ID>` with `HTTP 206 Partial Content` (`Accept-Ranges: bytes`) and 30 req/min Token-Bucket rate limiting.

---

## 📂 Project Structure (Hexagonal Clean Architecture)

```text
Ephphatha/
├── index.html                          # Main PWA Sanctuary App Shell
├── setup-guide.html                    # Interactive Cloud, Google Drive & GitHub Operations Manual
├── manifest.webmanifest                # Installable Mobile/Desktop PWA Manifest
├── sw.js                               # Stale-While-Revalidate Offline Service Worker
├── server.js                           # Zero-Dependency Local HTTP Server (Port 3080)
├── wrangler.toml                       # Cloudflare Edge Worker Deployment Config
├── data/
│   ├── schedule_manifest_v3.json       # Dynamic 365-Day Schedule & 12 Periods Metadata
│   └── scripture_fallback_vault.json   # Tier-3/4 Bilingual (EN + POC Malayalam + Latin) Vault
├── src/
│   ├── domain/
│   │   ├── periods.js                  # 12 Periods State Machine & Grace-First Streak Engine
│   │   ├── securityEngine.js           # WebAuthn Passkeys, AES-256-GCM, HMAC-SHA256, XSS Guard
│   │   └── crdtEngine.js               # HLC CRDT Merger, 1080x1080 Verse Card Canvas, Lectio Divina
│   ├── adapters/
│   │   ├── indexedDbRepo.js            # <5ms Local-First Optimistic IndexedDB Repository
│   │   ├── bibleFailoverGateway.js     # 4-Tier Circuit-Breaker Scripture Failover Orchestrator
│   │   ├── audioEngine.js              # HTTP 206 Edge Audio Streamer + Contemplative Synth
│   │   └── syncWorkerClient.js         # Debounced Outbox Queue & Sharded AppData Sync
│   ├── ui/
│   │   └── appController.js            # Reactive UI Controller & Telemetry Inspector
│   └── styles/
│       └── main.css                    # Warm Parchment & Warm Dusk (#1E2430) Design System
└── scripts/
    ├── provision-google-drive.gs       # 1-Click Google Apps Script for Drive Folders & Master Sheet
    ├── cloudflare-edge-worker.js       # Cloudflare Worker for HTTP 206 Audio & Rate Limiting
    └── deploy-github.ps1               # PowerShell GitHub Repository Deployment Script
```

---

## 🚀 Quick Start

```powershell
# Start the local Sanctuary Server on http://localhost:3080
node server.js
```

- **App URL**: `http://localhost:3080`
- **Cloud & Google Drive Setup Manual**: `http://localhost:3080/setup-guide.html`

