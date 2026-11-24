/**
 * High-Level Audio Separation Pipeline Service
 * Coordinates file validation, format inspection, high-quality audio resampling,
 * Web Worker lifecycle management, cancellation, and master 16-bit WAV encoding.
 */

import { checkBrowserDeviceSupport, type DeviceSupport, type ProgressInfo } from './audioConfig';
import { inspectAudioFile, MAX_DURATION, SAMPLE_RATE, PREVIEW_SECONDS, type ProcessingMode, type SupportedAudioFormat } from './filePolicy';
export type { ProcessingMode, SupportedAudioFormat } from './filePolicy';

export interface ValidatedAudioFile {
  file: File;
  name: string;
  size: number;
  format: SupportedAudioFormat;
  duration: number;
}

export interface PipelineOutputs {
  vocalsBlob?: Blob;
  vocalsUrl: string;
  instrumentalBlob?: Blob;
  instrumentalUrl: string;
  originalUrl: string;
  expiresAt?: number;
  duration: number;
  sampleRate: number;
  fileName: string;
  processingMode: ProcessingMode;
}

/**
 * Validates audio file magic bytes (RIFF/WAVE or ID3/MPEG sync)
 */
export function inspectAudioHeader(buffer: ArrayBuffer): { format: SupportedAudioFormat; valid: boolean; reason?: string } {
  if (!buffer || buffer.byteLength < 12) {
    return { format: 'mp3', valid: false, reason: 'File is empty or too small to be a valid audio file.' };
  }
  const view = new DataView(buffer);

  // Check WAV: 'RIFF' at offset 0, 'WAVE' at offset 8
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (riff === 'RIFF' && wave === 'WAVE') {
    return { format: 'wav', valid: true };
  }

  // Check MP3: ID3 header at offset 0 ('ID3')
  const id3 = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2));
  if (id3 === 'ID3') {
    return { format: 'mp3', valid: true };
  }

  // Check MP3 raw frame sync: 11 consecutive bits set (0xFF followed by 0xFB, 0xF3, 0xF2, 0xFA, etc.)
  const scanLimit = Math.min(buffer.byteLength - 2, 512);
  for (let i = 0; i < scanLimit; i++) {
    if (view.getUint8(i) === 0xff && (view.getUint8(i + 1) & 0xe0) === 0xe0) {
      return { format: 'mp3', valid: true };
    }
  }

  return {
    format: 'wav',
    valid: false,
    reason: 'File does not contain valid MP3 or WAV audio stream headers.',
  };
}

/**
 * Cubic Hermite polynomial interpolation for bandlimited resampling
 */
function hermiteInterpolate(y0: number, y1: number, y2: number, y3: number, t: number): number {
  const c0 = y1;
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * t + c2) * t + c1) * t + c0;
}

/**
 * High-Quality Resampling to 44.1kHz Stereo
 * Uses native OfflineAudioContext polyphase sinc resampling when available,
 * with high-fidelity cubic Hermite interpolation fallback.
 */
export async function resampleToStereo44100(
  audioBuffer: AudioBuffer,
  maxDurationSeconds?: number
): Promise<{ left: Float32Array; right: Float32Array; duration: number }> {
  const targetSampleRate = SAMPLE_RATE; // 44100 Hz
  const originalDuration = audioBuffer.duration;
  const effectiveDuration = maxDurationSeconds ? Math.min(originalDuration, maxDurationSeconds) : originalDuration;
  const totalSamples = Math.floor(effectiveDuration * targetSampleRate);

  // 1. If sample rate is already 44.1kHz and stereo, perform clean copy
  if (audioBuffer.sampleRate === targetSampleRate && audioBuffer.numberOfChannels === 2) {
    const left = new Float32Array(totalSamples);
    const right = new Float32Array(totalSamples);
    left.set(audioBuffer.getChannelData(0).subarray(0, totalSamples));
    right.set(audioBuffer.getChannelData(1).subarray(0, totalSamples));
    return { left, right, duration: effectiveDuration };
  }

  // 2. High-Quality Web Audio Native Polyphase Sinc Resampling via OfflineAudioContext
  if (typeof window !== 'undefined' && (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)) {
    try {
      const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      const offlineCtx = new OfflineCtxClass(2, totalSamples, targetSampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const left = new Float32Array(totalSamples);
      const right = new Float32Array(totalSamples);
      left.set(renderedBuffer.getChannelData(0).subarray(0, totalSamples));
      right.set(
        renderedBuffer.numberOfChannels > 1
          ? renderedBuffer.getChannelData(1).subarray(0, totalSamples)
          : renderedBuffer.getChannelData(0).subarray(0, totalSamples)
      );
      return { left, right, duration: effectiveDuration };
    } catch (e) {
      console.warn('OfflineAudioContext polyphase resampling failed, using Hermite fallback:', e);
    }
  }

  // 3. Cubic Hermite Interpolation Fallback
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);
  const srcLeft = audioBuffer.getChannelData(0);
  const srcRight = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : srcLeft;
  const ratio = audioBuffer.sampleRate / targetSampleRate;

  for (let i = 0; i < totalSamples; i++) {
    const srcPos = i * ratio;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;

    // Left channel
    const l0 = srcLeft[Math.max(0, idx - 1)];
    const l1 = srcLeft[Math.min(srcLeft.length - 1, idx)];
    const l2 = srcLeft[Math.min(srcLeft.length - 1, idx + 1)];
    const l3 = srcLeft[Math.min(srcLeft.length - 1, idx + 2)];
    left[i] = hermiteInterpolate(l0, l1, l2, l3, frac);

    // Right channel
    const r0 = srcRight[Math.max(0, idx - 1)];
    const r1 = srcRight[Math.min(srcRight.length - 1, idx)];
    const r2 = srcRight[Math.min(srcRight.length - 1, idx + 1)];
    const r3 = srcRight[Math.min(srcRight.length - 1, idx + 2)];
    right[i] = hermiteInterpolate(r0, r1, r2, r3, frac);
  }

  return { left, right, duration: effectiveDuration };
}

export class AudioPipelineService {
  private worker: Worker | null = null;
  private idle: ReturnType<typeof setTimeout> | undefined;
  private operation: AbortController | undefined;
  private cloudJob: string | undefined;
  private localUrls: string[] = [];

  public getDeviceSupport(): DeviceSupport {
    return checkBrowserDeviceSupport();
  }

  public async validateAndInspectFile(file: File): Promise<ValidatedAudioFile> {
    const format = file.name.split('.').pop()?.toLowerCase();
    if (format !== 'mp3' && format !== 'wav') throw new Error('Choose an MP3 or WAV audio file.');
    const duration = await inspectAudioFile(file, format);
    return { file, name: file.name.replace(/\.[^/.]+$/, ''), size: file.size, format, duration };
  }

  public async processAudio(
    media: ValidatedAudioFile,
    mode: ProcessingMode = 'full',
    onProgress?: (info: ProgressInfo) => void,
    forceBrowser = false,
  ): Promise<PipelineOutputs> {
    if (this.operation) throw new Error('Audio separation is already running.');
    this.cleanupUrls();
    const controller = new AbortController();
    this.operation = controller;
    const signal = controller.signal;
    try {
      // 1. Primary path: Route upload to Multi-Provider AI Backend
      if (!forceBrowser) {
        try {
          onProgress?.({ phase: 'uploading', percent: 5, message: 'Connecting to AI separation engine…' });
          const { separateViaApiManager } = await import('./cloudClient');
          const result = await separateViaApiManager(media, mode, signal, onProgress);
          signal.throwIfAborted();
          return {
            ...result,
            originalUrl: this.objectUrl(media.file),
            fileName: media.name,
            sampleRate: SAMPLE_RATE,
            processingMode: mode,
          };
        } catch (serverError: any) {
          if (signal.aborted) throw serverError;
          console.warn('Multi-provider server busy or unavailable, falling back to on-device Demucs AI:', serverError);
          onProgress?.({
            phase: 'preparing-audio',
            percent: 10,
            message: 'Server busy. Switching to on-device AI separation…',
          });
        }
      }

      // 2. Working Fallback: On-Device Browser Demucs v4 Processing
      const maxDuration = Math.min(media.duration, PREVIEW_SECONDS[mode]);
      const estimatedMemory = Math.round(maxDuration * SAMPLE_RATE * 2 * 4 * 3 / 1024 ** 2 + 140);
      if (estimatedMemory > 550) {
        throw new Error('This track exceeds the browser memory limit. Choose a 30-second or 60-second preview, or use cloud processing when available.');
      }
      onProgress?.({ phase: 'preparing-audio', percent: 2, message: 'Decoding and preparing your audio…' });
      const Context = window.AudioContext || (window as any).webkitAudioContext;
      const context = new Context({ sampleRate: SAMPLE_RATE }) as AudioContext;
      let decoded: AudioBuffer;
      try {
        const bytes = await media.file.arrayBuffer();
        signal.throwIfAborted();
        decoded = await context.decodeAudioData(bytes);
      } catch (error) {
        signal.throwIfAborted();
        throw new Error('Could not decode this MP3 or WAV file.', { cause: error });
      } finally {
        await context.close().catch(() => {});
      }
      signal.throwIfAborted();
      if (decoded.duration < 1 || decoded.duration > MAX_DURATION) {
        throw new Error('Choose audio between 1 second and 10 minutes.');
      }
      const { left, right, duration } = await resampleToStereo44100(decoded, PREVIEW_SECONDS[mode]);
      signal.throwIfAborted();
      const { vocalsBlob, instrumentalBlob } = await this.separate(left, right, signal, onProgress);
      signal.throwIfAborted();
      onProgress?.({ phase: 'complete', percent: 100, message: 'Your WAV stems are ready.' });
      return {
        vocalsBlob, instrumentalBlob, duration, sampleRate: SAMPLE_RATE, processingMode: mode, fileName: media.name,
        vocalsUrl: this.objectUrl(vocalsBlob), instrumentalUrl: this.objectUrl(instrumentalBlob),
        originalUrl: this.objectUrl(media.file),
      };
    } finally {
      this.operation = undefined;
    }
  }

  private separate(left: Float32Array, right: Float32Array, signal: AbortSignal, onProgress?: (info: ProgressInfo) => void) {
    clearTimeout(this.idle);
    const worker = this.worker ??= new Worker(new URL('../../workers/audioWorker.ts', import.meta.url), { type: 'module' });
    return new Promise<{ vocalsBlob: Blob; instrumentalBlob: Blob }>((resolve, reject) => {
      const cleanup = () => {
        worker.removeEventListener('message', message);
        worker.removeEventListener('error', failed);
        signal.removeEventListener('abort', cancelled);
      };
      const failed = () => {
        cleanup();
        this.releaseWorker();
        reject(new Error('The separation worker stopped. Try a preview or cloud processing.'));
      };
      const cancelled = () => {
        cleanup();
        this.releaseWorker();
        reject(signal.reason);
      };
      const message = ({ data }: MessageEvent) => {
        if (data.type === 'PROGRESS') {
          onProgress?.(data.payload);
          return;
        }
        cleanup();
        if (data.type === 'SUCCESS') {
          this.idle = setTimeout(() => this.releaseWorker(), 120_000);
          resolve(data.payload);
        } else {
          this.releaseWorker();
          reject(new Error(data.payload));
        }
      };
      worker.addEventListener('message', message);
      worker.addEventListener('error', failed);
      signal.addEventListener('abort', cancelled, { once: true });
      try {
        worker.postMessage({ left, right, sampleRate: SAMPLE_RATE }, [left.buffer as ArrayBuffer, right.buffer as ArrayBuffer]);
      } catch {
        failed();
      }
    });
  }

  private releaseWorker() {
    clearTimeout(this.idle);
    this.worker?.terminate();
    this.worker = null;
  }

  public cancelProcessing() {
    this.operation?.abort(new Error('Audio separation was cancelled.'));
  }

  private objectUrl(blob: Blob) {
    const url = URL.createObjectURL(blob);
    this.localUrls.push(url);
    return url;
  }

  public cleanupUrls() {
    for (const url of this.localUrls) URL.revokeObjectURL(url);
    this.localUrls = [];
    const job = this.cloudJob;
    this.cloudJob = undefined;
    if (job) void import('./cloudClient').then(({ removeCloudJob }) => removeCloudJob(job));
  }

  public dispose() {
    this.cancelProcessing();
    this.releaseWorker();
    this.cleanupUrls();
  }
}
