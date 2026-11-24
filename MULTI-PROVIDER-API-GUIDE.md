# VocalRemover.group – Multi-Provider AI Vocal Remover Architecture & API Guide

## 1. Executive Summary

This document describes the complete architecture, provider specifications, quota management, resilience mechanisms, and deployment instructions for the **Multi-Provider AI Vocal Remover API Manager** on [VocalRemover.group](https://vocalremover.group/).

The system provides a **unified, resilient vocal removal pipeline**:
1. Users upload audio through a single consistent frontend interface.
2. The orchestrator checks real-time quotas, circuit breaker health, audio container format, duration limits, and priority scores.
3. Audio is automatically routed to the optimal third-party provider.
4. If a provider reaches rate limits (HTTP 429), exhausts its quota (HTTP 402), or encounters transient server errors (HTTP 5xx), the circuit breaker trips and **automatically rotates to the next available provider** without user intervention.
5. Client-side Demucs v4 (WebGPU/WASM) remains fully functional as a private, on-device alternative.
6. If all third-party providers are exhausted or unavailable, the system displays:
   `"Audio processing is temporarily busy. Please try again shortly."`

---

## 2. Integrated API Providers Summary

| # | Provider Name | Method & Endpoint | Format / Content-Type | Quota Tracking | Status |
|---|---|---|---|---|---|
| **1** | **SplitBeat (RapidAPI)** | `POST /Upload_audio` | `multipart/form-data` (`input_audio`) | 100/day, 3,000/mo (Ledger) | **Integrated & Ready** |
| **2** | **Voice Separation API (RapidAPI)** | `POST /api/rapidapi/separate-audio` | `application/octet-stream` (binary) | 100/day, 3,000/mo (Ledger) | **Integrated & Ready** |
| **3** | **Disband** | `POST /separations`<br>`GET /separations/{id}`<br>`GET /usage` | Binary audio body, Bearer auth | Dynamic via `GET /usage` endpoint | **Integrated & Ready** |
| **4** | **Karadeo** | `POST /api/vocal-remover` | JSON `{ fileUrl, outputFormat: "mp3" }` | 50/day, 1,000/mo (Ledger + Header) | **Integrated & Ready** |
| **5** | **StemConsole** | `POST /v1/tasks`<br>`GET /v1/tasks/{id}` | Multipart / Bearer auth | 5 songs monthly (Free tier) | **Integrated & Ready** |
| **6** | **AudioShake** | Standby Adapter | Modular contract | Pending enterprise credentials | **Standby (Disabled)** |

### Excluded APIs (Explicitly Ignored)
As specified in requirements, the following endpoints are NOT used:
- AI Music Generator song-status endpoint
- StemSplit YouTube jobs listing
- Cat Meowing API
- Cat Translator API

---

## 3. Provider Details & Integration Contracts

### Provider 1: SplitBeat (RapidAPI)
- **Host**: `splitbeat-vocal-remover-music-splitter.p.rapidapi.com`
- **Endpoint**: `https://splitbeat-vocal-remover-music-splitter.p.rapidapi.com/Upload_audio`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Parameter**: `input_audio` (CURLFile containing MP3 or WAV)
- **Headers**:
  ```http
  x-rapidapi-host: splitbeat-vocal-remover-music-splitter.p.rapidapi.com
  x-rapidapi-key: <RAPIDAPI_KEY>
  Accept: application/json
  ```
- **Response Handling**: Extracts `vocal_path` / `music_path`, downloads binary stems, and saves to secure local storage.

### Provider 2: Voice Separation API (RapidAPI)
- **Host**: `voice-separation-api.p.rapidapi.com`
- **Endpoint**: `https://voice-separation-api.p.rapidapi.com/api/rapidapi/separate-audio`
- **Method**: `POST`
- **Content-Type**: `application/octet-stream`
- **Body**: Raw audio file bytes
- **Headers**:
  ```http
  x-rapidapi-host: voice-separation-api.p.rapidapi.com
  x-rapidapi-key: <RAPIDAPI_KEY>
  Accept: application/json
  ```
- **Response Handling**: Parses JSON stem URLs (`vocalUrl`, `instrumentalUrl`), streams binary audio to disk.

### Provider 3: Disband
- **Base URL**: `https://api.disband.io/v1`
- **Auth**: `Authorization: Bearer <DISBAND_KEY>`
- **Live Quota Endpoint**: `GET /usage` -> returns `{ quota, used, remaining, reset_at }`. The ledger updates confirmed metrics dynamically.
- **Separation Endpoint**: `POST /separations?stems=vocals,instrumental` with binary audio body.
- **Status Check**: `GET /separations/{id}` polled every 3s until status is `completed`.

### Provider 4: Karadeo
- **Endpoint**: `https://karadeo.com/api/vocal-remover`
- **Method**: `POST`
- **Auth**: `Authorization: Bearer <KARADEO_API_KEY>`
- **Request Body**:
  ```json
  {
    "fileUrl": "https://vocalremover.group/api/v1/temporary-input/<signed-token>",
    "outputFormat": "mp3"
  }
  ```
- **Security & Auto-Cleanup**: Generates a tamper-proof HMAC-SHA256 signed URL with a 30-minute expiration. Immediately purges the temporary input file once separation completes.

### Provider 5: StemConsole
- **Base URL**: `https://api.stemconsole.ai/v1`
- **Documentation**: `https://stemconsole.ai/developers/`
- **Plan**: 5 songs free monthly tier.
- **Workflow**: `POST /tasks` with stems `vocals,instrumental`, polls task status, downloads stems.

### Provider 6: AudioShake
- Kept in standby mode (`enabled: false`). Complete modular adapter structure implemented and ready for credential activation.

---

## 4. Quota Ledger & Circuit Breaker Architecture

### Atomic Quota Ledger (`VocalRemover\Ledger\QuotaLedger`)
- **Concurrency Protection**: Uses filesystem `flock(LOCK_EX)` or database transaction locks to guarantee zero race conditions during simultaneous user requests.
- **Confirmed vs Estimated**:
  - Confirmed Quota: Obtained from official provider endpoints (e.g. Disband `/usage`).
  - Estimated Quota: Atomic decrements against configured limits when endpoints do not expose remaining balance headers.
- **Reset Cycles**:
  - Daily resets at `00:00 UTC`.
  - Monthly resets on the 1st of each calendar month at `00:00 UTC`.

### Circuit Breaker (`VocalRemover\Engine\CircuitBreaker`)
- **HTTP 429 (Rate Limited)**: Provider enters a 60-second cooldown period.
- **HTTP 402 / Quota Exhausted**: Provider enters cooldown until next UTC midnight reset.
- **HTTP 401 / 403 (Invalid Credentials)**: Provider enters 1-hour backoff to prevent log spam.
- **HTTP 5xx / Network Timeout**: Trips circuit breaker after 3 consecutive failures for 2 minutes.

---

## 5. Deployment & Configuration

### Environment Variables (`.env`)
```bash
APP_ENV=production
APP_URL=https://vocalremover.group
ADMIN_SECRET_KEY=your_secure_admin_key_here
STORAGE_SIGNING_KEY=your_secure_signing_secret_here

# RapidAPI Key (Shared by SplitBeat & Voice Separation)
RAPIDAPI_KEY=your_rapidapi_key_here

# Disband
DISBAND_KEY=your_disband_bearer_token

# Karadeo
KARADEO_API_KEY=your_karadeo_key

# StemConsole
STEMCONSOLE_API_KEY=your_stemconsole_key
```

### Running the Diagnostic CLI
```bash
php backend-php/bin/test_providers.php
```

### Running the PHP Automated Test Suite
```bash
php backend-php/tests/run_tests.php
```

### Cloudflare Worker Bridge
To route Cloudflare Worker jobs to the PHP gateway, set the secret in `wrangler.jsonc`:
```jsonc
"vars": {
  "PROVIDER_GATEWAY_URL": "https://api.vocalremover.group",
  "ADMIN_SECRET_KEY": "your_secure_admin_key_here"
}
```

---

## 6. Admin Management Dashboard

Accessible at `/admin/` in the web application (protected by `ADMIN_SECRET_KEY`).

### Dashboard Features:
1. **Aggregated System Metrics**:
   - Total Configured (6), Total Active (5), Total Standby (1).
   - Daily & Monthly request meters.
   - Real-time success rate and failover counters.
2. **Interactive Provider Cards**:
   - Priority reordering (Up / Down arrows).
   - Quota usage vs capacity bars.
   - Status indicators: Active (Green), Cooldown (Yellow), Disabled (Grey).
   - Instant "Test Connection" button with millisecond latency measurement.
   - One-click Enable / Disable toggle switch.
   - Circuit breaker manual reset button.
3. **Audit & Rotation Logs**:
   - Live stream of provider attempts, failover trails, and error codes.
4. **Security**:
   - All API keys masked (`••••••••`). Plaintext secrets are never exposed over the network.
