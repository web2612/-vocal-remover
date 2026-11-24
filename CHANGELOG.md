# Changelog — VocalRemover.group

All notable technical changes, architectural fixes, SEO optimizations, and audio processing upgrades are documented in this file.

---

## [1.5.0] — 2026-11-23

### 📚 Authoritative Blog Content Expansion (800–1200 Words per Article)
- **Deep Technical Content Enhancement:**
  - Expanded all five blog articles from ~130–170 words to 980–1,250 words of technically accurate, original, and practical audio engineering content.
  - Sourced and incorporated legitimate scientific literature and engineering specifications from IEEE, AES, W3C, Meta AI, and Fraunhofer IIS.
  - Eliminated arbitrary reading times; updated reading estimates dynamically based on actual word counts (5 to 6 min read at ~200 wpm).
  - Added structured subheadings (H2s), mathematical formulas (STFT, COLA, $L - R$ phase difference), acoustic frequency band analyses (Hz/kHz), and actionable DAW post-processing workflows.
  - Embedded contextual internal links to relevant tools ([AI Vocal Remover](/), [Vocal Extractor](/vocal-remover/), [Instrumental Maker](/instrumental-maker/), [Acapella Extractor](/acapella-extractor/), [Karaoke Maker](/karaoke-maker/)).
- **Blog Article Directory:**
  1. `demucs-v4-browser-vocal-isolation` (1,251 words): Deep dive into Meta AI HTDemucs hybrid U-Net/Transformer architecture, ONNX Runtime WebGPU shader compilation, and streaming 10s chunk memory management.
  2. `phase-cancellation-vs-ai-source-separation` (984 words): Center-channel subtraction ($L-R$) acoustics, phantom center destruction, reverb diffusion, and spectrogram machine audition.
  3. `karaoke-backing-tracks-guide` (1,032 words): Professional backing track creation, lead vs backing harmony isolation, DAW EQ cavity restoration, and EBU R128 loudness normalization.
  4. `mp3-vs-wav-for-ai-audio-processing` (1,120 words): Linear PCM 16-bit/44.1 kHz vs lossy MDCT perceptual coding, 16 kHz low-pass cutoff, pre-echo ringing, and convolutional filter distortion.
  5. `why-vocal-separation-leaves-artifacts` (1,153 words): Ill-posed inverse problem acoustics, spectral collision in STFT bins, diffuse reverb phase decay, soft vs hard masking, and dynamic EQ cleanup.

### 🛡️ Portable SEO & HTML Distribution Validator (`scripts/validate_dist.py`)
- **Resolved Platform Hardcoding:**
  - Replaced hardcoded Windows directory paths with portable path resolution using Python's `pathlib.Path(__file__).resolve().parent.parent / "dist"`.
- **Comprehensive Quality Assurance Rules:**
  - Enforces non-zero exit code (`sys.exit(1)`) if zero HTML files are generated or any validation checks fail.
  - Verifies exact 1:1 H1 tag hierarchy on all indexable pages.
  - Audits metadata uniqueness (title, description, canonical, twitter:url, og:url).
  - Validates `robots` directives (`noindex, nofollow` on 3 unindexed routes, `index, follow` on 16 production routes).
  - Validates JSON-LD syntax and checks `BlogPosting` schema compliance (`headline`, `image`, `datePublished`, `dateModified`, `author`, `publisher`).
  - Verifies XML sitemap compliance (16 indexable URLs, 0 banned routes, accurate non-arbitrary `lastmod` dates).

### 🗺️ Sitemap `lastmod` Normalization
- Updated `public/sitemap.xml` and `dist/sitemap.xml` with verified modification dates:
  - `2026-11-23` for recently revised pages (homepage, blog index, 5 expanded blog posts).
  - `2026-11-22` for retargeted `/vocal-remover/`.
  - `2026-11-21` for unmodified tools and guides.
  - Omitted `lastmod` on static informational and legal pages (`/about/`, `/contact/`, `/privacy-policy/`, `/terms/`).

---

## [1.4.0] — 2026-11-23

### 🎬 Professional 1080p Demo Video & Color Grading (Preserving 4 Female Singers)
- **Genuine Full HD 1080p Source Footage:**
  - Upgraded homepage demo video (`public/demo-performance.mp4`) from low-resolution 480p (854x480) to genuine Full HD 1080p (1920x1080 @ 23.98 fps).
  - Explicitly preserved all **four original female singers** from the studio performance, retaining the exact 24-second timeline, scene progression, camera angles, and choreography without artificial AI replacement footage.
- **Cinematic Color Grading & Exposure Balance:**
  - Neutralized previous excessive warm/yellow tint ($R - B$ color differential reduced from $+39$ points down to $+8$ points), achieving natural skin tones and clean neutral whites on white clothing and studio acoustics.
  - Applied soft-knee highlight compression (`curves=all='0/0 0.15/0.14 0.4/0.38 0.65/0.63 0.85/0.80 1/0.90'`) to recover highlight details and prevent blown-out studio backlights.
  - Encoded with high-fidelity H.264 High Profile @ Level 4.1, CRF 19, `yuv420p`, and `+faststart` atom placement for zero-buffering web streaming (9.98 MB, well within Cloudflare Pages 25 MiB file size limit).
- **Matching High-Resolution Poster & File Parity:**
  - Generated crisp 1920x1080 poster image (`public/demo-poster.jpg`, 221 KB) directly from the newly graded footage at $t=2.0\text{s}$.
  - Verified SHA-256 byte-for-byte identity between `public/` and `dist/` for both video and poster assets.
- **Separation of Promotional Assets:**
  - Kept `public/promo-20s.mp4` (1080p Full HD AI promotional showcase with dark studio theme `#080C16`) strictly separated from the homepage live performance demo, ensuring no secondary video clutter on the homepage.

### 🔍 Technical SEO & Schema Hygiene Finalization
- **Dynamic BlogPosting Publication & Modification Dates:**
  - Eliminated hardcoded fallback dates (such as `2026-11-18`) from `scripts/prerender.ts` and `src/components/SEOHead.tsx`.
  - Structured data now strictly binds to verified `datePublished` and `dateModified` fields directly from the content registry (`BLOG_POSTS`).
- **404 Social Graph Metadata:**
  - Corrected `og:url` and `twitter:url` in `dist/404.html` to point to `https://vocalremover.group/404.html` while preserving `noindex, nofollow` indexing directives and Cloudflare Pages SPA fallback.
- **Keyword Cannibalization Resolution:**
  - Homepage (`/`) primary keyword: **AI Vocal Remover** (broad multi-format removal and dual-stem mixer).
  - Tool page (`/vocal-remover/`) primary keyword: **Vocal Extractor** (targeted voice track isolation and acapella extraction).
- **Automated Validation:**
  - All 18 routes + `404.html` prerendered with valid self-referencing canonical URLs and Twitter URLs.
  - Excluded roadmap routes (`/video-vocal-remover/` and `/noise-remover/`) from `sitemap.xml`.
  - 11/11 automated unit and DSP tests passing; 0 TypeScript errors; 0 linter errors.

---

## [1.3.0] — 2026-11-21

### 🎬 Professional 20-Second AI Promotional Video (Requirement 14)
- **High-Quality AI-Generated Video Asset:**
  - Built an original, high-definition (1280x720 @ 30 fps) 20.00-second promotional video (`public/promo-20s.mp4`, 1.08 MB) encoded in H.264 High Profile with AAC 192 kbps 44.1 kHz stereo audio and `+faststart` atom placement for instantaneous streaming.
  - Generates realistic animated audio waveform pulses, dual-stem channel isolation visualizers (cyan vocals and violet instrumental), feature highlights, and DAW player mockups.
  - Concludes with the brand message: *"Remove Vocals. Keep the Music. Powered by AI."*
- **Three Natural Neural AI Voiceovers:**
  - Generated and mixed three distinct Microsoft neural AI voices with calibrated timing and speech rates:
    1. **Christopher** (`en-US-ChristopherNeural`, deep/confident): Segments 0.4s – 5.3s.
    2. **Guy** (`en-US-GuyNeural`, clear/energetic): Segments 5.7s – 11.4s.
    3. **Jenny** (`en-US-JennyNeural`, friendly/smooth): Segments 11.8s – 19.4s.
  - Balanced low-volume ambient chord progression background music bed (`master_audio_20s.wav`) synthesized without vocal overlap.
- **Accessible Video Player Component (`PromoVideoPlayer.tsx`):**
  - Integrated directly below the hero workbench without obstructing drag-and-drop file uploads.
  - Full playback controls: Play/Pause overlay, scrubbing seek bar, time display (`0:00 / 0:20`), Mute/Volume slider, Replay button, and Fullscreen toggle.
  - Interactive Voice Selection Pills: One-click jump buttons to jump straight to Christopher (0s), Guy (5.7s), and Jenny (11.8s) with real-time active speaker badge indicators.
  - Verified lightweight file size ($1.08\text{ MB} \ll 25\text{ MiB}$ Cloudflare Pages per-file upload limit).

---

### 🎨 Clean Pure White Design System Redesign (Requirement 15)
- **Pure White Background & High Contrast Typography:**
  - Modernized the entire website visual architecture from dark aesthetic to a clean, crisp pure white (`#FFFFFF`) background (`--bg-main: #ffffff`) with slate-900 high-contrast body text.
  - Standardized subtle light borders (`border-slate-200`, `bg-slate-50`, `shadow-xs`/`shadow-xl`) while preserving signature brand purple, indigo, and cyan accents.
- **Component-Wide White Styling:**
  - **Navbar:** Clean semi-transparent frosted white header (`bg-white/90 border-slate-200/80 shadow-xs`) with dark text, indigo brand mark, and light device capability modal.
  - **Hero & Workbench:** High-contrast 2-line hero title with vibrant gradient accents, clean file dropzone (`bg-slate-50/70 border-slate-300 hover:border-indigo-500 hover:bg-slate-50`), and prominent upload CTA button.
  - **Audio Processing Console:** Clean white progress card (`bg-white border-slate-200 shadow-xl`) with animated indigo spinner, real-time memory indicators, and clear cancellation trigger.
  - **Dual Stem Player:** Pristine white console card with dark-contrast DAW waveform display (`bg-slate-950`), light purple vocal stem card, light sky instrumental stem card, and prominent lossless WAV export buttons.
  - **Interactive Comparison:** Clean white audio switcher card, dark canvas visualizer, and clear stem toggles.
  - **Tools Grid, FAQ & Blog:** White interactive cards with slate-200 borders, subtle hover shadows, and accordion styling.
  - **Footer:** Light slate footer (`bg-slate-50 border-t border-slate-200 text-slate-600`) with dark headings and accessible navigation links.
  - **Prerender Static Fallbacks:** Updated `scripts/prerender.ts` static HTML fallbacks and 404 page to pure white backgrounds with slate-900 typography.

---

## [1.2.0] — 2026-11-21

### 🎧 AI Engine & Audio Processing
- **Upgraded Resampling to Bandlimited Polyphase Sinc:**
  - *Previous Issue:* Resampling used naive nearest-neighbor sample skipping (`Math.floor(i * ratio)`), introducing aliasing distortion and high-frequency spectral artifacts into the neural network input.
  - *Fix:* Implemented browser-native `OfflineAudioContext` high-quality polyphase sinc interpolation to resample arbitrary audio to 44.1 kHz stereo PCM, with a cubic Hermite polynomial interpolation fallback for offline or worker contexts.
- **Implemented Magic-Byte & Header Verification:**
  - *Previous Issue:* File validation relied purely on client MIME type and file extension strings, which allowed corrupt or misnamed files to trigger unhandled `AudioContext.decodeAudioData` crashes.
  - *Fix:* Added `inspectAudioHeader` in `audioPipeline.ts` to inspect raw binary headers:
    - WAV: Validates ASCII `RIFF` header, 4-byte chunk size, and `WAVE` format marker.
    - MP3: Validates ID3v2 header (`ID3` tag) or MPEG audio frame sync marker (`0xFF 0xE0`).
- **Enhanced WebGPU Hardware Inspection:**
  - *Previous Issue:* WebGPU capability check assumed `navigator.gpu` was sufficient, failing on systems where GPU adapters were unavailable, disabled, or blacklisted.
  - *Fix:* Added `validateWebGpuHardware()` executing `await navigator.gpu.requestAdapter()`. Automatically falls back to multi-threaded WebAssembly (WASM) when an adapter is unavailable.
- **Model Checksum & Multi-Mirror Caching:**
  - *Previous Issue:* Cache validation only checked cache key presence; truncated downloads could permanently break processing.
  - *Fix:* Implemented expected byte size (`180,534,758` bytes) and HTTP `ETag` validation. Added automatic cache invalidation on size mismatch and a 3-attempt exponential backoff retry loop with multi-mirror CDN failover.
- **Worker Cancellation & Memory Leak Elimination:**
  - *Previous Issue:* Triggering cancellation terminated the Web Worker without resolving or rejecting pending Promises, leaving the application in a hanging state.
  - *Fix:* Explicitly stored and rejected pending Promises with a clear `CancellationError`, terminated worker threads, and ensured all `AudioBuffer` and Object URLs are revoked immediately on reset.

---

### 🌐 Cloudflare Pages Asset Limit Compliance (Critical Fix)
- **Resolved 25 MiB File Size Limit Collision:**
  - *Critical Discovery:* Vite's default bundler copied `ort-wasm-simd-threaded.jsep.wasm` (29.5 MB) and `public/wasm` contained binaries up to 28.7 MB. Because Cloudflare Pages free tier enforces a strict 25 MiB (26,214,400 bytes) per-asset upload limit, deployments would fail immediately with `Asset too large`.
  - *Fix:*
    1. Removed local duplicate wasm files from `public/wasm/`.
    2. Configured `ort.env.wasm.wasmPaths` to point to the official jsDelivr CDN (`https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/`).
    3. Created a custom Vite rollup plugin `excludeOnnxWasm` in `vite.config.ts` to strip heavy `.wasm` binaries from `dist/assets/`.
    4. Reduced total production `dist/` directory size from 88 MB to **1.41 MB** (largest file is 772 KB), ensuring 100% smooth deployment on Cloudflare Pages free tier.

---

### 🔍 Technical SEO & Schema Hygiene
- **Eliminated Keyword Cannibalization:**
  - *Previous Issue:* Homepage `/` and `/vocal-remover/` targeted identical titles and keyword sets ("AI Vocal Remover"), competing against each other in Google search indices.
  - *Fix:* Differentiated semantic search intent:
    - `/`: Broad online vocal remover targeting "AI Vocal Remover – Remove Vocals from Songs & Videos".
    - `/vocal-remover/`: Dedicated vocal extraction tool targeting "Vocal Extractor – Isolate Singing Voice & Acapellas".
- **Corrected Schema Application (`WebApplication`):**
  - *Previous Issue:* `WebApplication` structured data was inadvertently injected into all pages, including informational articles, blog posts, and legal pages.
  - *Fix:* Updated `prerender.ts` and `routesData.ts` so `WebApplication` is strictly rendered on genuine working tools (`/`, `/vocal-remover/`, `/instrumental-maker/`, `/acapella-extractor/`, `/karaoke-maker/`). Informational pages now only render `WebSite`, `Organization`, and `FAQPage` schemas.
- **Converted Simulated Links to Semantic `<a>` Elements:**
  - *Previous Issue:* Navigation menu, dropdown items, tools grid cards, and footer links used `<button onClick=...>` elements, preventing search engine crawlers from discovering and traversing site routes.
  - *Fix:* Replaced all navigational buttons with semantic `<a href="...">` links with SPA navigation handlers and `rel` attributes, ensuring full site crawlability.
- **Sitemap Cleanliness:**
  - *Fix:* Excluded experimental roadmap routes (`/video-vocal-remover/`, `/noise-remover/`) from `sitemap.xml`, keeping only the 16 fully functional, high-quality indexable routes. Updated `lastmod` timestamps to `2026-11-21`.
- **Social Graph Metadata Asset:**
  - *Fix:* Created a branded, 1200x630 pixel `public/og-image.jpg` with valid JPEG header bytes (`0xFF 0xD8`), resolving 404 social preview image errors.
- **Added In-Depth Audio Engineering Content:**
  - Added two extensive, technical blog posts with semantic HTML prerendering:
    1. `/blog/mp3-vs-wav-for-ai-audio-processing/`: Explaining psychoacoustic compression artifacts in neural separation.
    2. `/blog/why-vocal-separation-leaves-artifacts/`: Explaining spectral leakage, phase smearing, and reverb tail extraction.

---

### 🎨 UI/UX & Accessibility Enhancements
- **Refined Compact Hero:**
  - Replaced oversized, 4-line H1 with compact 2-line heading (`AI Vocal Remover – Remove Vocals from Songs & Videos`) with violet accent gradient, bringing the upload tool directly above the fold on all standard viewports.
- **Added Interactive Audio Comparison Console:**
  - Created an interactive 3-stem preview player (Original Mix, Isolated Vocals, Pure Instrumental) with real-time waveform visualization, animated frequency spectrum canvas, and zero-latency timestamp synchronization.
- **Honest Feature Demarcation:**
  - Clearly marked Video Vocal Remover as `Roadmap` and Noise Remover as `R&D` in the Tools Grid and dedicated routes, preventing false claims and building user trust.
- **Enhanced Contrast & Keyboard Navigation:**
  - Verified WCAG AAA color contrast across dark backgrounds and interactive violet/cyan controls. Ensured visible focus rings on all interactive elements.

---

### ⚙️ Build System & Quality Assurance
- Added `npm run typecheck` (`tsc -b`) script to `package.json`.
- Cleaned all `oxlint` warnings across the codebase (0 warnings, 0 errors).
- Built comprehensive automated test suite (`tests/audio-and-seo.test.ts`) covering DSP, FFT roundtrips, stem summation, WAV header encoding, MP4Box demuxing, and SEO uniqueness. 10/10 tests passing.
- Verified in-browser execution with real browser testing: 0 console errors, 0 failed network requests.
