import { PART_BYTES, type ProcessingMode } from './filePolicy';
import type { ValidatedAudioFile } from './audioPipeline';
import type { ProgressInfo } from './audioConfig';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const JOBS = `${API_BASE}/api/v1/jobs`;
type JobState = {
  state: 'uploading' | 'queued' | 'validating' | 'processing' | 'exporting' | 'complete' | 'failed' | 'cancelled' | 'expired';
  percent: number;
  duration?: number;
  expiresAt?: number;
  code?: string;
};

const messages: Record<string, string> = {
  invalid_audio: 'The server could not decode this MP3 or WAV file.',
  capacity: 'Audio processing is temporarily busy. Please try again shortly.',
  disabled: 'Audio processing is temporarily busy. Please try again shortly.',
  timeout: 'Audio processing is temporarily busy. Please try again shortly.',
  too_large: 'The file exceeds the 100 MB limit.',
  expired: 'The temporary cloud job has expired. Start a new separation.',
  unavailable: 'Audio processing is temporarily busy. Please try again shortly.',
  quota_exhausted: 'Audio processing is temporarily busy. Please try again shortly.',
  rate_limited: 'Audio processing is temporarily busy. Please try again shortly.',
  processor_unavailable: 'Audio processing is temporarily busy. Please try again shortly.',
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = messages[body.code] || 'Audio processing is temporarily busy. Please try again shortly.';
    throw new CloudError(message, response.status);
  }
  return response.status === 204 ? undefined as T : response.json();
}

class CloudError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function pause(signal: AbortSignal, duration: number) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, duration);
    signal.addEventListener('abort', abort, { once: true });
  });
}

async function requestWithRetry<T>(url: string, init: RequestInit, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await request<T>(url, { ...init, signal });
    } catch (error) {
      if (attempt >= 2 || error instanceof CloudError && error.status < 500) throw error;
      await pause(signal, 500 * 2 ** attempt);
    }
  }
}

export function removeCloudJob(id: string) {
  void fetch(`${JOBS}/${id}`, { method: 'DELETE', keepalive: true }).catch(() => {});
}

/**
 * Direct separation via the Multi-Provider API Gateway
 */
export async function separateViaApiManager(
  media: ValidatedAudioFile,
  mode: ProcessingMode,
  signal: AbortSignal,
  onProgress?: (info: ProgressInfo) => void,
) {
  onProgress?.({ phase: 'uploading', percent: 10, message: 'Uploading audio to AI separation engine…' });

  const formData = new FormData();
  formData.append('audio', media.file, media.name);
  formData.append('mode', mode);

  const response = await fetch(JOBS, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.message || messages[errorData.code] || 'Audio processing is temporarily busy. Please try again shortly.';
    throw new CloudError(errorMsg, response.status);
  }

  onProgress?.({ phase: 'separating', percent: 75, message: 'Separating stems across AI providers…' });
  const data = await response.json();
  onProgress?.({ phase: 'complete', percent: 100, message: 'Your WAV stems are ready.' });

  const normalizeStemUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
    return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return {
    duration: data.duration ?? media.duration,
    expiresAt: data.expiresAt,
    vocalsUrl: normalizeStemUrl(data.vocalsUrl),
    instrumentalUrl: normalizeStemUrl(data.instrumentalUrl),
  };
}

export async function separateInCloud(
  media: ValidatedAudioFile,
  mode: ProcessingMode,
  signal: AbortSignal,
  onJob: (id: string) => void,
  onProgress?: (info: ProgressInfo) => void,
) {
  await requestWithRetry('/api/v1/session', {}, signal);
  const { id } = await requestWithRetry<{ id: string }>(JOBS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ size: media.size, format: media.format, mode }),
  }, signal);
  onJob(id);
  const path = `${JOBS}/${id}`;
  try {
    for (let offset = 0; offset < media.size; offset += PART_BYTES) {
      const end = Math.min(offset + PART_BYTES, media.size);
      const part = media.file.slice(offset, end, 'application/octet-stream');
      const url = `${path}/parts/${offset / PART_BYTES + 1}`;
      await requestWithRetry(url, { method: 'PUT', body: part }, signal);
      onProgress?.({ phase: 'uploading', percent: Math.round(25 * end / media.size), message: 'Uploading audio to Cloudflare…' });
    }
    await requestWithRetry(`${path}/start`, { method: 'POST' }, signal);
    while (true) {
      const job = await requestWithRetry<JobState>(path, {}, signal);
      if (job.state === 'complete') {
        return {
          duration: job.duration ?? media.duration,
          expiresAt: job.expiresAt,
          vocalsUrl: `${path}/stems/vocals`,
          instrumentalUrl: `${path}/stems/instrumental`,
        };
      }
      if (['failed', 'cancelled', 'expired'].includes(job.state)) {
        throw new Error(messages[job.code ?? job.state] || 'Cloud separation ended. Try again or use browser processing.');
      }
      const phase = job.state === 'validating' ? 'validating' : job.state === 'processing' ? 'separating'
        : job.state === 'exporting' ? 'synthesizing' : 'queued';
      const message = { validating: 'Verifying audio on the server…', separating: 'Separating audio in the cloud…',
        synthesizing: 'Saving WAV stems…', queued: 'Waiting for an available cloud worker…' }[phase];
      onProgress?.({ phase, percent: Math.max(25, job.percent), message });
      await pause(signal, document.hidden ? 5000 : 2000);
    }
  } catch (error) {
    removeCloudJob(id);
    throw error;
  }
}
