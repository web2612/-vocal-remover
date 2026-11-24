# Deploy VocalRemover.group

This document outlines the deployment architecture for both the **React Frontend (Cloudflare Pages)** and the **Multi-Provider AI Backend (PHP 8.2+ / Nginx / Docker)**.

---

## 1. High-Level Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │          Cloudflare CDN / Edge         │
                      │        (https://vocalremover.group)    │
                      └──────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
      Static Routes & Assets                           /api/v1/* API Traffic
                 │                                               │
                 ▼                                               ▼
    ┌───────────────────────────┐                 ┌───────────────────────────┐
    │     Cloudflare Pages      │                 │  Pages Function Proxy     │
    │  - React 19 Frontend      │                 │  functions/api/[[catchall]]│
    │  - Client-Side Demucs v4  │                 │  OR Cloudflare Worker     │
    │  - WebAssembly & WebGPU   │                 └──────────────┬────────────┘
    └───────────────────────────┘                                │
                                                                 │ Reverse Proxy
                                                                 ▼
                                                  ┌───────────────────────────┐
                                                  │    PHP Provider Gateway   │
                                                  │  - ProviderManager Engine │
                                                  │  - Quota & CircuitBreaker │
                                                  │  - AudioInspector Binary  │
                                                  │  - SQLite Audit Database  │
                                                  └──────────────┬────────────┘
                                                                 │
                                  ┌──────────────────────────────┴──────────────────────────────┐
                                  │                                                             │
                                  ▼                                                             ▼
                     Provider 1: SplitBeat                                         Provider 3: Disband
                     Provider 2: Voice Separation                                  Provider 4: Karadeo
                                                                                   Provider 5: StemConsole
```

---

## 2. Option A: Unified Domain Deployment (Recommended)

In this setup, your frontend and backend share the single domain `https://vocalremover.group`. Cloudflare Pages serves the frontend static build, while `/api/*` requests are transparently reverse-proxied to your PHP backend origin without CORS complications.

### A. Deploy Frontend to Cloudflare Pages
1. Build the production bundle:
   ```bash
   npm run build
   ```
2. In the Cloudflare Dashboard, create a **Pages** project pointing to the `dist` directory (or use Git integration).
3. Set the following **Environment Variables** in Cloudflare Pages Settings:
   - `PROVIDER_GATEWAY_URL`: `https://api-origin.yourdomain.com` (your PHP server's public origin URL)
   - `ADMIN_SECRET_KEY`: `your_secure_random_64_char_key`
4. Deploy. The included `functions/api/[[catchall]].ts` automatically proxies all `/api/*` traffic directly to your PHP backend.

---

## 3. Option B: Decoupled API Subdomain Deployment

In this setup, your PHP backend is hosted on a dedicated subdomain (e.g. `https://api.vocalremover.group`).

1. Build the frontend with the API base URL configured:
   ```bash
   VITE_API_BASE_URL="https://api.vocalremover.group" npm run build
   ```
2. The frontend directly makes cross-origin requests to `https://api.vocalremover.group/api/v1/jobs`.
3. The PHP backend automatically issues permissive and credentialed CORS headers for `https://vocalremover.group`.

---

## 4. PHP Backend Hosting Setup

### Prerequisites
- PHP 8.2 or higher
- Extensions: `curl`, `json`, `sqlite3`, `fileinfo`, `mbstring`, `openssl`
- Web server: Nginx or Apache with `mod_rewrite`

### Method 1: Docker Container (Easiest)
Use the included `Dockerfile`:
```bash
# Build the container
docker build -t vocalremover-backend -f Dockerfile .

# Run with persistent volume for SQLite and stems storage
docker run -d \
  -p 8000:80 \
  -v $(pwd)/backend-php/data:/var/www/html/backend-php/data \
  -v $(pwd)/backend-php/storage:/var/www/html/backend-php/storage \
  --env-file .env \
  --name vocalremover-api \
  vocalremover-backend
```

### Method 2: Nginx + PHP-FPM Configuration
```nginx
server {
    listen 80;
    server_name api.vocalremover.group;
    root /var/www/vocalremover/backend-php/public;
    index index.php;

    client_max_body_size 100M;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/var/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_read_timeout 300s;
    }

    # Deny access to sensitive files
    location ~* \.(env|json|lock|sqlite|sqlite3|db|log|sh|md)$ {
        deny all;
    }
}
```

### Method 3: Apache Configuration
Point Apache `DocumentRoot` to `backend-php/public`. The included `.htaccess` will automatically rewrite requests to `index.php` and enforce security rules.

---

## 5. Environment Configuration (.env)

Copy `.env.example` to `.env` on your PHP server and configure credentials:
```bash
# Core Security
ADMIN_SECRET_KEY=generate_a_secure_random_64_char_admin_key
STORAGE_SIGNING_KEY=generate_a_secure_random_64_char_signing_key

# RapidAPI Credentials
RAPIDAPI_KEY=your_rapidapi_key_with_splitbeat_and_voice_separation_subscription

# Disband
DISBAND_KEY=your_disband_bearer_token

# Karadeo
KARADEO_API_KEY=your_karadeo_api_key

# StemConsole
STEMCONSOLE_API_KEY=your_stemconsole_api_key
```

---

## 6. Verification and Health Monitoring

1. **Verify Backend Health:**
   ```bash
   curl https://api.vocalremover.group/api/v1/health
   # Returns: {"status":"healthy","service":"VocalRemover API Manager","version":"2.0.0"}
   ```
2. **Access Admin Dashboard:**
   Navigate to `/admin/` on your site and enter your `ADMIN_SECRET_KEY`.
   - Inspect provider connectivity.
   - Adjust failover priority.
   - View atomic quota consumption and real audio durations.
3. **Run Self-Contained Test Suite:**
   ```bash
   php backend-php/tests/run_tests.php
   # Expected: 15 Passed, 0 Failed
   ```

---

## 7. Legacy Cloudflare Container Option

The frontend is static React/Vite with prerendered routes. Browser processing works on Pages by itself. Cloud separation is an optional same-origin API backed by a Worker, Durable Objects, Queues, a private R2 bucket, and two on-demand CPU containers. Keep cloud disabled until staging passes the release checks. Containers require Workers Paid.

## 1. Stage the browser tool

Use Node 24, the locked npm dependencies, and current Wrangler with Durable Object Container support when deploying the API. For the frontend, leave `VITE_ENABLE_CLOUD` unset. The Pages output directory is `dist`.

```powershell
npm ci
npm run build
npx wrangler@4.167.0 pages project create vocalremover-group-staging --production-branch main
npx wrangler@4.167.0 pages deploy dist --project-name vocalremover-group-staging --branch main
```

Create the staging project only if it does not already exist. Attach `staging.vocalremover.group` to that project before testing the same-origin API. Keep staging out of search indexes and restrict access while evaluating cloud jobs. Keep `public/_headers` with its COOP and COEP directives and retain the existing canonical domain and redirects. Use a separate Pages project for production once the domain mapping is confirmed.

## 2. Publish runtime assets

Use a separate R2 bucket named `vocalremover-runtime` with custom domain `assets.vocalremover.group`. Apply `cloudflare/runtime-cors.json` and enable CDN caching for the versioned paths. Upload `ort-wasm-simd-threaded.jsep.wasm` and `ort-wasm-simd-threaded.jsep.mjs` from the distribution of `onnxruntime-web@1.31.1` to `ort/1.31.1/`. Use `application/wasm` and `text/javascript` for their respective media types. Set `Cache-Control: public, max-age=31536000, immutable` and `VITE_ORT_WASM_BASE=https://assets.vocalremover.group/ort/1.31.1/` for the Pages build. Builds without this variable use the pinned jsDelivr distribution.

The browser and Docker image use the same Hugging Face revision and SHA-256. Keep the pinned browser download until redistribution rights are confirmed. If mirrored later, use a versioned object key and point `VITE_DEMUCS_MODEL_URL` at it. The hash check remains in effect. The runtime asset bucket must contain only public release assets.

## 3. Deploy the staging API

Docker must be available to build the Linux/amd64 container image. Deploy only to the account that owns the intended staging and production routes. Create the staging R2 bucket and both queues once. Leave public access off for the job bucket.

```powershell
npx wrangler@4.167.0 r2 bucket create vocalremover-private-staging
npx wrangler@4.167.0 r2 bucket lifecycle add vocalremover-private-staging temporary-jobs jobs/ --expire-days 1 --abort-multipart-days 1
npx wrangler@4.167.0 queues create vocalremover-audio-staging
npx wrangler@4.167.0 queues create vocalremover-audio-staging-dead
npx wrangler@4.167.0 deploy --config wrangler.jsonc --var CLOUD_ENABLED:true
```

Build and deploy the staging frontend with `VITE_ENABLE_CLOUD=true` only after the same-origin route is available. The browser prompts for explicit upload consent before opening a cloud session. The API accepts MP3 and WAV up to 100,000,000 bytes and up to 10 minutes of decoded audio. Job deletion runs immediately or through the scheduled sweeper, with the R2 lifecycle rule as a backstop.

Create the corresponding production bucket and queues before using `wrangler.production.jsonc`. Its checked-in server feature switch is off. Configure a rate limit for `POST /api/v1/jobs` at the edge before making the API public. The application also limits admission to one active upload or job per browser session and 20 new jobs per UTC day.

## 4. Release gates and rollback

- Capture browser-only and cloud timings separately using the same files. Record initial compressed JavaScript, model download, upload, queue, cold start, separation, and first playable stem. Compare browser and cloud output duration, sample alignment, and quality.
- Inspect the homepage network log through load, scroll, and Play. Demo sources should first appear after Play. Model and runtime requests should first appear when local processing starts. Check keyboard and touch behavior on desktop and mobile.
- Exercise the 100 MB limit, bad headers, file expiry and refresh, storage restrictions, cross-session access, interrupted parts, duplicate start, cancellation, ranges, and expired downloads. Confirm that cleanup deletes the R2 input and both outputs and aborts abandoned uploads.
- Keep Cloudflare request-body logging off. Monitor job latency, execution and dispatch errors, queue backlog and dead-letter messages, container spend, and cleanup warnings. Keep the stage isolated until the cloud path helps on a low-powered device.
- Disable new cloud jobs with `CLOUD_ENABLED=false` on the Worker and remove the UI option in the next Pages deployment. Leave existing job routes and cleanup available while outstanding jobs expire. Roll back the Pages artifact independently if necessary.

[Cloudflare Containers deployment](https://developers.cloudflare.com/containers/get-started/) · [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/) · [R2 lifecycle rules](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
