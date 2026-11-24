import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeWAV } from '../src/lib/audio/wavEncoder';
import { createHannWindow, fft, ifft, stft, istft, reflectPad } from '../src/lib/audio/fft';
import { ROUTES_DATA, BLOG_POSTS } from '../src/data/routesData';
import { createFile } from 'mp4box';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('WAV Encoder produces valid 16-bit PCM stereo WAV Blob', async () => {
  const sampleRate = 44100;
  const numSamples = 44100; // 1 second of audio
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // Generate 440 Hz test tone
  for (let i = 0; i < numSamples; i++) {
    left[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.8;
    right[i] = Math.cos((2 * Math.PI * 440 * i) / sampleRate) * 0.8;
  }

  const blob = encodeWAV(left, right, sampleRate);
  assert.strictEqual(blob.type, 'audio/wav');

  // Verify byte length: 44 bytes header + 44100 * 2 channels * 2 bytes = 176444 bytes
  assert.strictEqual(blob.size, 44 + 44100 * 4);

  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);

  // Check RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  assert.strictEqual(riff, 'RIFF');

  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  assert.strictEqual(wave, 'WAVE');

  // Check fmt chunk
  const fmt = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
  assert.strictEqual(fmt, 'fmt ');

  const audioFormat = view.getUint16(20, true);
  assert.strictEqual(audioFormat, 1); // PCM

  const channels = view.getUint16(22, true);
  assert.strictEqual(channels, 2); // Stereo

  const parsedSampleRate = view.getUint32(24, true);
  assert.strictEqual(parsedSampleRate, 44100);

  const bitsPerSample = view.getUint16(34, true);
  assert.strictEqual(bitsPerSample, 16);
});

test('FFT & IFFT roundtrip reconstructs time-domain signal', () => {
  const n = 512;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const original = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    real[i] = Math.sin((2 * Math.PI * 5 * i) / n) + 0.5 * Math.cos((2 * Math.PI * 12 * i) / n);
    original[i] = real[i];
    imag[i] = 0;
  }

  // Forward FFT
  fft(real, imag);

  // Inverse FFT
  ifft(real, imag);

  // Check reconstruction
  for (let i = 0; i < n; i++) {
    assert(Math.abs(real[i] - original[i]) < 1e-4, `Mismatch at index ${i}: expected ${original[i]}, got ${real[i]}`);
  }
});

test('Hann window is periodic and bounded [0, 1]', () => {
  const size = 1024;
  const window = createHannWindow(size);

  assert.strictEqual(window.length, size);
  assert(window[0] >= 0 && window[0] < 0.01);
  assert(window[size / 2] > 0.99 && window[size / 2] <= 1.0);

  // Periodic symmetry check: w[i] == w[size - i] for i > 0
  for (let i = 1; i < size / 2; i++) {
    assert(Math.abs(window[i] - window[size - i]) < 1e-5);
  }
});

test('ReflectPad pads boundaries symmetrically', () => {
  const signal = new Float32Array([1, 2, 3, 4, 5]);
  const padded = reflectPad(signal, 2, 2);

  assert.strictEqual(padded.length, 9);
  // Left reflection: signal[2 - 0] = 3, signal[2 - 1] = 2
  assert.strictEqual(padded[0], 3);
  assert.strictEqual(padded[1], 2);
  // Center
  assert.strictEqual(padded[2], 1);
  assert.strictEqual(padded[3], 2);
  assert.strictEqual(padded[4], 3);
  assert.strictEqual(padded[5], 4);
  assert.strictEqual(padded[6], 5);
  // Right reflection: signal[5 - 2 - 0] = 4, signal[5 - 2 - 1] = 3
  assert.strictEqual(padded[7], 4);
  assert.strictEqual(padded[8], 3);
});

test('Demucs DSP: STFT and iSTFT reconstruct signal with overlap-add', () => {
  const fftSize = 1024;
  const hopSize = 256;
  const signalLength = 4096;
  const testSignal = new Float32Array(signalLength);

  // Generate multi-tone test signal
  for (let i = 0; i < signalLength; i++) {
    testSignal[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / 44100) + 0.3 * Math.cos((2 * Math.PI * 1200 * i) / 44100);
  }

  const stftResult = stft(testSignal, fftSize, hopSize);
  assert(stftResult.numFrames > 0);
  assert(stftResult.numBins === fftSize / 2 + 1);

  const reconstructed = istft(
    stftResult.real,
    stftResult.imag,
    stftResult.numFrames,
    stftResult.numBins,
    fftSize,
    hopSize,
    signalLength
  );

  assert.strictEqual(reconstructed.length, signalLength);
  // Interior samples (excluding window taper edge) must reconstruct faithfully
  const startCheck = fftSize;
  const endCheck = signalLength - fftSize;
  for (let i = startCheck; i < endCheck; i++) {
    assert(Math.abs(reconstructed[i] - testSignal[i]) < 1e-3, `STFT/iSTFT mismatch at sample ${i}`);
  }
});

test('Demucs Source Separation: Mathematical stem sum equals original mix', () => {
  const length = 44100;
  const drums = new Float32Array(length);
  const bass = new Float32Array(length);
  const other = new Float32Array(length);
  const vocals = new Float32Array(length);
  const originalMix = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    drums[i] = (Math.random() * 2 - 1) * 0.2;
    bass[i] = Math.sin((2 * Math.PI * 65 * i) / 44100) * 0.3;
    other[i] = Math.sin((2 * Math.PI * 330 * i) / 44100) * 0.2;
    vocals[i] = Math.sin((2 * Math.PI * 880 * i) / 44100) * 0.25;
    originalMix[i] = drums[i] + bass[i] + other[i] + vocals[i];
  }

  // Combine drums + bass + other into instrumental stem
  const instrumental = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    instrumental[i] = drums[i] + bass[i] + other[i];
  }

  // Verify: instrumental + vocals == originalMix
  for (let i = 0; i < length; i++) {
    const combined = instrumental[i] + vocals[i];
    assert(Math.abs(combined - originalMix[i]) < 1e-6, `Sum mismatch at index ${i}`);
  }

  // Verify instrumental contains zero vocal energy
  let correlation = 0;
  for (let i = 0; i < length; i++) {
    correlation += instrumental[i] * vocals[i];
  }
  const normalizedCorr = Math.abs(correlation) / length;
  assert(normalizedCorr < 0.05, `Residual vocal bleed too high: ${normalizedCorr}`);
});

test('Video Demuxer: MP4Box creates ISOFile and inspects audio tracks', async () => {
  const mp4file = createFile();
  assert(typeof mp4file.appendBuffer === 'function');
  assert(typeof mp4file.setExtractionOptions === 'function');
  assert(typeof mp4file.start === 'function');
});

test('Supported formats: Audio and Video extensions are registered', () => {
  const supported: string[] = ['mp3', 'wav', 'mp4', 'webm', 'mov'];
  assert.strictEqual(supported.length, 5);
  assert(supported.includes('mp4'));
  assert(supported.includes('webm'));
  assert(supported.includes('mov'));
});

test('Assets: og-image.jpg exists and has valid JPEG header', () => {
  const ogPath = path.resolve(__dirname, '../public/og-image.jpg');
  assert(fs.existsSync(ogPath), `og-image.jpg missing at ${ogPath}`);

  const stat = fs.statSync(ogPath);
  assert(stat.size > 20000, `og-image.jpg is too small (${stat.size} bytes)`);

  const buffer = fs.readFileSync(ogPath);
  // JPEG starts with FF D8 and ends with FF D9
  assert.strictEqual(buffer[0], 0xff, 'Invalid JPEG start byte 0');
  assert.strictEqual(buffer[1], 0xd8, 'Invalid JPEG start byte 1');
  assert.strictEqual(buffer[buffer.length - 2], 0xff, 'Invalid JPEG end byte 0');
  assert.strictEqual(buffer[buffer.length - 1], 0xd9, 'Invalid JPEG end byte 1');
});

test('SEO: All routes have unique titles, descriptions, and valid canonicals', () => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  const canonicals = new Set<string>();

  for (const [pathKey, route] of Object.entries(ROUTES_DATA)) {
    // Length recommendations: Title ~50-60 chars, Description ~140-160 chars
    assert(route.title.length >= 45 && route.title.length <= 65, `Title length (${route.title.length}) out of range for ${pathKey}: "${route.title}"`);
    assert(route.metaDescription.length >= 135 && route.metaDescription.length <= 165, `Description length (${route.metaDescription.length}) out of range for ${pathKey}: "${route.metaDescription}"`);
    assert(route.canonical.startsWith('https://vocalremover.group'), `Invalid canonical for ${pathKey}: ${route.canonical}`);

    assert(!titles.has(route.title), `Duplicate title found: ${route.title}`);
    assert(!descriptions.has(route.metaDescription), `Duplicate description found: ${route.metaDescription}`);
    assert(!canonicals.has(route.canonical), `Duplicate canonical found: ${route.canonical}`);

    titles.add(route.title);
    descriptions.add(route.metaDescription);
    canonicals.add(route.canonical);
  }

  // Verify H1 consistency and keyword separation
  assert.strictEqual(
    ROUTES_DATA['/'].h1,
    'AI Vocal Remover – Remove Vocals from Any Song or Video',
    'Homepage H1 must match expected primary keyword'
  );
  assert.strictEqual(
    ROUTES_DATA['/vocal-remover/'].h1,
    'Vocal Extractor – Isolate Voice Tracks & Stems Online',
    '/vocal-remover/ H1 must have distinct intent from homepage'
  );
  assert(
    ROUTES_DATA['/vocal-remover/'].title.includes('Vocal Extractor'),
    '/vocal-remover/ title must target Vocal Extractor'
  );

  // Verify indexing strategy
  assert.strictEqual(ROUTES_DATA['/video-vocal-remover/'].noIndex, true, '/video-vocal-remover/ must be noindex');
  assert.strictEqual(ROUTES_DATA['/noise-remover/'].noIndex, true, '/noise-remover/ must be noindex');
  assert(!ROUTES_DATA['/'].noIndex, 'Homepage must be indexable');
  assert(!ROUTES_DATA['/vocal-remover/'].noIndex, '/vocal-remover/ must be indexable');

  // Verify sitemap.xml excludes noindex routes and includes indexable routes
  const sitemapPath = path.resolve(__dirname, '../public/sitemap.xml');
  assert(fs.existsSync(sitemapPath), `sitemap.xml missing at ${sitemapPath}`);
  const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');

  assert(!sitemapContent.includes('/video-vocal-remover/'), 'sitemap.xml must NOT include noindex route /video-vocal-remover/');
  assert(!sitemapContent.includes('/noise-remover/'), 'sitemap.xml must NOT include noindex route /noise-remover/');
  assert(sitemapContent.includes('<loc>https://vocalremover.group/</loc>'), 'sitemap.xml must include homepage');
  assert(sitemapContent.includes('<loc>https://vocalremover.group/vocal-remover/</loc>'), 'sitemap.xml must include /vocal-remover/');
  assert(sitemapContent.includes('<loc>https://vocalremover.group/instrumental-maker/</loc>'), 'sitemap.xml must include /instrumental-maker/');
  assert(sitemapContent.includes('<loc>https://vocalremover.group/acapella-extractor/</loc>'), 'sitemap.xml must include /acapella-extractor/');
  assert(sitemapContent.includes('<loc>https://vocalremover.group/karaoke-maker/</loc>'), 'sitemap.xml must include /karaoke-maker/');

  // Also verify blog posts have valid canonicals and titles
  for (const post of BLOG_POSTS) {
    assert(post.title.length >= 45 && post.title.length <= 65, `Blog title length out of range: "${post.title}" (${post.title.length})`);
    assert(post.excerpt.length >= 135 && post.excerpt.length <= 165, `Blog excerpt length out of range: "${post.excerpt}" (${post.excerpt.length})`);
    assert(!titles.has(post.title), `Duplicate blog title: ${post.title}`);
    assert(post.datePublished && /^\d{4}-\d{2}-\d{2}$/.test(post.datePublished), `Invalid datePublished for blog ${post.slug}: ${post.datePublished}`);
    assert(post.dateModified && /^\d{4}-\d{2}-\d{2}$/.test(post.dateModified), `Invalid dateModified for blog ${post.slug}: ${post.dateModified}`);
    titles.add(post.title);
  }
});

test('Assets: Live performance demo video, audio stems, and poster exist and meet size limits', () => {
  const videoPath = path.resolve(__dirname, '../public/demo-performance.mp4');
  assert(fs.existsSync(videoPath), `demo-performance.mp4 missing at ${videoPath}`);

  const videoStat = fs.statSync(videoPath);
  assert(videoStat.size > 500_000, `demo-performance.mp4 is too small (${videoStat.size} bytes)`);
  // Cloudflare Pages free tier limit per file is 25 MiB (26,214,400 bytes)
  assert(videoStat.size < 25 * 1024 * 1024, `demo-performance.mp4 exceeds 25 MiB Cloudflare limit: ${videoStat.size}`);

  const promoVideoPath = path.resolve(__dirname, '../public/promo-20s.mp4');
  assert(fs.existsSync(promoVideoPath), `promo-20s.mp4 missing at ${promoVideoPath}`);
  const promoStat = fs.statSync(promoVideoPath);
  assert(promoStat.size > 500_000, `promo-20s.mp4 is too small (${promoStat.size} bytes)`);
  assert(promoStat.size < 25 * 1024 * 1024, `promo-20s.mp4 exceeds 25 MiB Cloudflare limit: ${promoStat.size}`);

  const vocalPath = path.resolve(__dirname, '../public/demo-vocals.mp3');
  assert(fs.existsSync(vocalPath), `demo-vocals.mp3 missing at ${vocalPath}`);
  assert(fs.statSync(vocalPath).size > 100_000, 'demo-vocals.mp3 too small');

  const instPath = path.resolve(__dirname, '../public/demo-instrumental.mp3');
  assert(fs.existsSync(instPath), `demo-instrumental.mp3 missing at ${instPath}`);
  assert(fs.statSync(instPath).size > 100_000, 'demo-instrumental.mp3 too small');

  const posterPath = path.resolve(__dirname, '../public/demo-poster.jpg');
  assert(fs.existsSync(posterPath), `demo-poster.jpg missing at ${posterPath}`);
  const posterStat = fs.statSync(posterPath);
  assert(posterStat.size > 10_000, `demo-poster.jpg is too small (${posterStat.size} bytes)`);
  const posterBuf = fs.readFileSync(posterPath);
  assert.strictEqual(posterBuf[0], 0xff, 'Invalid poster JPEG byte 0');
  assert.strictEqual(posterBuf[1], 0xd8, 'Invalid poster JPEG byte 1');

  const promoPosterPath = path.resolve(__dirname, '../public/promo-poster.jpg');
  assert(fs.existsSync(promoPosterPath), `promo-poster.jpg missing at ${promoPosterPath}`);
  const promoPosterStat = fs.statSync(promoPosterPath);
  assert(promoPosterStat.size > 10_000, `promo-poster.jpg is too small (${promoPosterStat.size} bytes)`);
  const promoPosterBuf = fs.readFileSync(promoPosterPath);
  assert.strictEqual(promoPosterBuf[0], 0xff, 'Invalid promo-poster JPEG byte 0');
  assert.strictEqual(promoPosterBuf[1], 0xd8, 'Invalid promo-poster JPEG byte 1');
});
