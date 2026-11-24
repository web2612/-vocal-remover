# VocalRemover.group – Open-Source Client-Side AI Vocal Remover

> **Website:** [https://vocalremover.group/](https://vocalremover.group/)  
> **Brand:** VocalRemover.group  
> **Hosting & Deployment Target:** Cloudflare Pages (Free Tier)  
> **DNS Management:** Cloudflare  
> **Architecture:** Browser-first machine learning with optional Cloudflare processing. [Deployment guide](DEPLOYMENT.md)  
> **Repository:** Local / GitHub Ready  

---

## 🌟 Overview

**VocalRemover.group** is a privacy-first, zero-cost, open-source audio source separation web application. It isolates singing voices and musical accompaniment directly in the user's browser without uploading audio files to cloud servers, collecting user telemetry, or relying on paid third-party APIs.

Unlike commercial alternatives that enforce paywalls, cloud upload queues, and server-side data retention, VocalRemover.group executes deep neural network inference directly on the client device using **Meta AI's Hybrid Transformer Demucs v4 (HTDemucs)** architecture powered by **ONNX Runtime Web**.

---

## 🚀 Key Features & Audio Engineering

### 🎧 Core Audio Separation Engine
- **Two-Stem Deep Neural Separation:** Extracts isolated **Vocals** (lead and backing vocals) and **Instrumentals** (drums, bass, guitars, keyboards, synthesizers).
- **Zero Server Uploads (100% Client-Side):** Audio decoding, Short-Time Fourier Transform (STFT), neural mask inference, and inverse STFT (iSTFT) overlap-add resynthesis run exclusively inside browser memory.
- **Hardware Acceleration with Fallback:**
  - Automatic hardware inspection via `navigator.gpu.requestAdapter()`.
  - Primary inference on **WebGPU** using GPU compute shaders for fast parallel execution.
  - Automatic fallback to multi-threaded **WebAssembly (WASM)** with SIMD acceleration for broad device compatibility.
- **Bandlimited Sinc Resampling:** Audio is resampled to the model's required 44.1 kHz linear stereo PCM using browser-native `OfflineAudioContext` polyphase sinc interpolation, backed by a cubic Hermite polynomial mathematical interpolation fallback. Zero nearest-neighbor aliasing.
- **Header & Magic-Byte Validation:** Inspects raw file signatures (`RIFF...WAVE` for WAV; `ID3` or MPEG frame sync `0xFF 0xE0` for MP3) before attempting decode. Rejects corrupt or spoofed payloads with descriptive user-facing diagnostics.
- **Lossless Master WAV Export:** Encodes authentic 16-bit 44.1 kHz linear PCM stereo WAV files with accurate RIFF headers, valid block alignment, and uncompressed sample chunks. Direct import ready for any DAW (Ableton Live, FL Studio, Logic Pro, Pro Tools, Audacity).
- **Flexible Processing Modes:**
  - **Full Song:** Comprehensive separation across the entire track duration (up to 10 minutes).
  - **Fast 30s Preview:** Rapid sample audition for quick verification on low-spec hardware.
  - **60s Sample:** Balanced preview capturing verse, bridge, and chorus sections.
- **Reliable Local Model Caching:**
  - Model weights (~180.5 MB) are streamed from official CDNs and stored in browser `CacheStorage`.
  - Verifies the fixed model length and SHA-256 before use.
  - Retries the pinned upstream download if a configured mirror is unavailable.
  - Reuses the verified model from CacheStorage and keeps the working inference session warm briefly.
- **Interactive Dual-Stem Console:**
  - Synchronized dual-track playback with real-time scrubbable seekbar.
  - Real-time animated HTML5 canvas waveform and frequency visualizers.
  - Independent vocal and instrumental volume sliders for customized balance and karaoke rehearsal.
  - Dedicated Solo Vocals and Solo Instrumental audition buttons with mute toggles.
  - Full memory reclamation: revokes object URLs and releases `AudioBuffer` allocations on reset.
- **Integrated 20-Second AI Promotional Video:**
  - Original 20.00-second H.264 High-Profile video (`public/promo-20s.mp4`, 1.08 MB) positioned right below the main uploader workbench.
  - Features three natural neural AI voices (Christopher, Guy, Jenny) introducing the client-side neural engine.
  - Integrated custom player (`PromoVideoPlayer.tsx`) with play/pause, seek scrubber, volume control, replay, and one-click voice jump selector pills.

---

## 📂 Information Architecture & Published Routes

All published routes are statically prerendered with custom metadata, Open Graph cards, self-referencing canonical URLs, and structured JSON-LD schemas:

| Route | Status | Semantic Intent & Target Keywords |
|---|---|---|
| `/` | **Production** | Primary tool: AI vocal remover, separate vocals and instrumentals online, client-side vocal isolation. |
| `/vocal-remover/` | **Production** | Dedicated vocal isolation tool: extract lead and backing vocals for acapella production and sampling. |
| `/instrumental-maker/` | **Production** | Backing track generator: remove vocals while preserving bass, percussion, and melodic instruments. |
| `/acapella-extractor/` | **Production** | DJ remix and mashup vocal extractor: clean vocal stem isolation. |
| `/karaoke-maker/` | **Production** | Singing practice and rehearsal backing tracks with custom vocal attenuation. |
| `/how-to-remove-vocals/` | **Production** | Comprehensive technical guide on audio source separation, phase cancellation, and AI spectral masking. |
| `/blog/` | **Production** | Audio engineering publication, research benchmarks, and browser DSP tutorials. |
| `/blog/demucs-v4-browser-vocal-isolation/` | **Production** | In-depth technical breakdown of porting HTDemucs to ONNX Runtime WebGPU. |
| `/blog/phase-cancellation-vs-ai-source-separation/` | **Production** | Acoustic analysis of OOPS center-channel cancellation vs. deep neural network masking. |
| `/blog/karaoke-backing-tracks-guide/` | **Production** | Vocalist preparation guide for creating rehearsal stems and performance tracks. |
| `/blog/mp3-vs-wav-for-ai-audio-processing/` | **Production** | Audio codec comparison: psychoacoustic compression artifacts in neural separation. |
| `/blog/why-vocal-separation-leaves-artifacts/` | **Production** | Spectral leakage, phase interference, and reverb smearing in source separation. |
| `/about/` | **Production** | Company mission, open-source tech stack, and zero-data-collection philosophy. |
| `/contact/` | **Production** | Support channels, browser troubleshooting, and open-source contributions. |
| `/privacy-policy/` | **Production** | Complete privacy disclosures verifying 100% on-device processing and CacheStorage usage. |
| `/terms/` | **Production** | Fair-use terms of service and copyright compliance guidelines. |
| `/video-vocal-remover/` | *Roadmap* | Clearly marked in-development feature. Explains WebCodecs container demuxing architecture. |
| `/noise-remover/` | *R&D* | Clearly marked research feature. Explains speech enhancement and spectral subtraction roadmap. |

---

## 🛠️ Technology Stack

- **Frontend Framework:** React 19 + TypeScript
- **Bundler & Build Tool:** Vite 8 with custom Rollup asset exclusion plugins
- **Styling:** Tailwind CSS v4 (Pure `#ffffff` white theme, high-contrast `#0f172a` slate typography, `#6366f1` indigo and `#06b6d4` cyan accents)
- **Promotional Video:** 20.0s H.264/AAC MP4 (`public/promo-20s.mp4`, 1.08 MB) featuring 3 distinct neural AI voiceovers (Christopher, Guy, Jenny), dynamic waveform visualization, and accessible player controls
- **AI Inference Engine:** `onnxruntime-web` (WebGPU + WebAssembly JSEP)
- **Neural Model:** Meta AI Hybrid Transformer Demucs v4 (`htdemucs_embedded.onnx`, 180.5 MB)
- **Digital Signal Processing (DSP):**
  - In-place Radix-2 Cooley-Tukey Fast Fourier Transform (FFT) and Inverse FFT (iSTFT)
  - Periodic Hann windowing with overlap-add (COLA) time-domain synthesis
  - Symmetric reflect boundary padding (`reflectPad`)
  - Polyphase sinc and cubic Hermite resampling to 44.1 kHz
- **Binary Audio Encoders:** Custom 16-bit linear PCM stereo WAV encoder with RIFF chunk management
- **Static Site Generation (SSG):** Custom Node.js prerender pipeline (`scripts/prerender.ts`) emitting HTML files for all routes
- **Icons:** `lucide-react`
- **Hosting Target:** Cloudflare Pages for the browser tool. Optional cloud processing uses Workers Paid and Containers.

---

## 🔍 Technical SEO & Accessibility Hygiene

1. **Static HTML Prerendering:** Every route generates a distinct `index.html` file in `dist/` containing unique `<title>`, `<meta name="description">`, self-referencing canonical tag, Open Graph metadata, Twitter Cards, and semantic fallback content inside `<div id="root">` for non-JavaScript crawlers.
2. **Cannibalization Elimination:** Strict intent differentiation between `/` (broad online vocal remover) and `/vocal-remover/` (dedicated acapella extraction tool).
3. **Structured Data (JSON-LD):**
   - `WebSite` and `Organization` schemas across all pages.
   - `WebApplication` schema applied strictly to genuine working tools (`/`, `/vocal-remover/`, `/instrumental-maker/`, `/acapella-extractor/`, `/karaoke-maker/`).
   - `FAQPage` schema on routes featuring question-and-answer sections.
4. **Crawlable Navigation:** All header, tools grid, and footer links are semantic `<a href="...">` elements enabling search engine spiders to traverse the full site graph without JavaScript execution.
5. **Asset Optimization for Cloudflare Pages:**
   - Bundled heavy `.wasm` binaries are excluded from static output via custom Vite plugin; `onnxruntime-web` dynamically fetches binaries from the official jsDelivr CDN (`ort.env.wasm.wasmPaths`).
   - Total build output directory `dist/` is under **1.5 MB**, ensuring lightning-fast deployments and complete compliance with Cloudflare Pages' 25 MiB asset limit.
6. **Security Headers (`public/_headers`):**
   - `Cross-Origin-Opener-Policy: same-origin` (required for high-performance `SharedArrayBuffer` threading)
   - `Cross-Origin-Embedder-Policy: require-corp`
   - `X-Frame-Options: SAMEORIGIN`
   - `X-Content-Type-Options: nosniff`

---

## 💻 Local Development & Verification

### Prerequisites
- Node.js 18+ (tested on Node v20 and v24)
- npm 9+

### Commands

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Type check codebase with TypeScript
npm run typecheck

# 4. Run automated test suite (10 unit/integration tests)
npm test

# 5. Run linter (oxlint)
npm run lint

# 6. Build for production (TypeScript + Vite + Static Prerender)
npm run build

# 7. Preview production build locally
npm run preview
```

---

## 🧪 Automated Test Suite

Our automated test suite (`tests/audio-and-seo.test.ts`) validates:
1. **WAV Encoder:** Generates compliant 16-bit linear PCM stereo WAV files with correct byte rates and sample counts.
2. **FFT / IFFT Roundtrip:** Verifies that time-domain signals reconstruct accurately through forward and inverse transforms ($x \approx \text{ifft}(\text{fft}(x))$).
3. **Hann Window:** Confirms periodic symmetry and boundedness within $[0, 1]$.
4. **ReflectPad:** Validates boundary reflection padding for spectral frame overlap.
5. **Demucs DSP STFT/iSTFT:** Validates spectral transformation and overlap-add resynthesis.
6. **Stem Mathematical Conservation:** Confirms that $\text{Vocals} + \text{Instrumental} = \text{Mix}$ within floating-point tolerance.
7. **Video Demuxer MP4Box:** Validates MP4Box container parsing and audio track discovery.
8. **Supported Formats Registry:** Verifies MIME type and extension mappings.
9. **Social Image Integrity:** Confirms `public/og-image.jpg` exists, has standard 1200x630 dimensions, and starts with valid JPEG header bytes (`0xFF 0xD8`).
10. **SEO & Metadata Integrity:** Confirms all 18 routes have unique titles, distinct meta descriptions, and valid canonical URLs matching `https://vocalremover.group/`.

---

## ☁️ Cloudflare Pages Free-Tier Deployment

Deploying VocalRemover.group to Cloudflare Pages is completely free and requires zero servers:

1. **Push to GitHub:** Commit and push the project to a private or public GitHub repository.
2. **Connect to Cloudflare Pages:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
   - Select your repository.
3. **Build Settings:**
   - **Framework preset:** `None` (or `Vite`)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION` = `20.18.0`
4. **Custom Domain:**
   - Add `vocalremover.group` under Custom Domains.
   - Cloudflare provisions free SSL and proxies traffic through their global Anycast CDN.

---

## 🔒 Privacy & Open Source Ethics

- **Zero Audio Uploads:** Audio is processed exclusively on the client machine.
- **Zero Third-Party Trackers:** No Google Analytics, no Facebook Pixels, no data brokers.
- **Transparent AI Weights:** Demucs v4 model weights are loaded directly into browser cache with open cryptographic checksum verification.
- **Fair Use:** VocalRemover.group encourages responsible and legal audio source separation for practice, remixing, and research.
