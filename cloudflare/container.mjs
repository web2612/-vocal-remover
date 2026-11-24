import { spawn } from 'node:child_process';
import { createWriteStream, openAsBlob } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as ort from 'onnxruntime-node';
import { DemucsAudioEngine } from '../src/lib/audio/demucsProcessor.ts';
import { inspectAudioFile, MAX_DURATION, MAX_FILE_BYTES, PART_BYTES, PREVIEW_SECONDS, SAMPLE_RATE } from '../src/lib/audio/filePolicy.ts';
import { encodeWAV } from '../src/lib/audio/wavEncoder.ts';

const FRAME_BYTES = 2 * Float32Array.BYTES_PER_ELEMENT;
const MAX_PCM_BYTES = MAX_DURATION * SAMPLE_RATE * FRAME_BYTES;
let engine;
let busy = false;

class InvalidAudio extends Error {}

async function send(base, path, signal, options = {}) {
  const response = await fetch(base + path, { ...options, signal });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('The private job gateway rejected a request.');
  }
  return response;
}

function capBytes(limit) {
  let total = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;
      if (total > limit) callback(new InvalidAudio('Audio exceeded its byte limit.'));
      else callback(null, chunk);
    },
  });
}

async function decode(input, raw, format, signal) {
  const child = spawn('/usr/bin/ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-xerror', '-err_detect', 'explode',
    '-max_alloc', '67108864', '-filter_threads', '1',
    '-protocol_whitelist', 'file,pipe', '-threads', '1', '-f', format, '-i', input,
    '-map', '0:a:0', '-vn', '-sn', '-dn',
    '-ac', '2', '-ar', String(SAMPLE_RATE), '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1',
  ], { signal, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'] });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new InvalidAudio('The decoder rejected this audio.')));
  });
  try {
    await Promise.all([exited, pipeline(child.stdout, capBytes(MAX_PCM_BYTES), createWriteStream(raw), { signal })]);
  } finally {
    if (child.exitCode === null) child.kill('SIGKILL');
    await exited.catch(() => {});
  }
}

async function uploadStem(base, stem, blob, signal) {
  const path = '/stem/' + stem;
  await send(base, path + '/0', signal, { method: 'POST' });
  for (let offset = 0, number = 1; offset < blob.size; offset += PART_BYTES, number++) {
    const part = blob.slice(offset, offset + PART_BYTES);
    await send(base, path + '/' + number, signal, {
      method: 'PUT', headers: { 'X-Part-Bytes': String(part.size) }, body: part,
    });
  }
  await send(base, path + '/-1', signal, { method: 'POST' });
}

async function separate(attempt) {
  const { id, lease, size, format, mode, deadline } = attempt;
  const base = 'http://audio.internal/' + id + '/' + lease;
  const cancellation = new AbortController();
  const signal = AbortSignal.any([cancellation.signal, AbortSignal.timeout(Math.max(1, deadline - Date.now()))]);
  const directory = await mkdtemp(join(tmpdir(), 'separation-'));
  let checking = false;
  let progressWrites = Promise.resolve();
  const monitor = setInterval(async () => {
    if (checking || signal.aborted) return;
    checking = true;
    try {
      const response = await fetch(base + '/active', { signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) });
      if (response.status === 410) cancellation.abort();
      await response.body?.cancel();
    } catch {
      // The attempt still has an independent deadline.
    } finally {
      checking = false;
    }
  }, 2000);

  function progress(state, percent) {
    return send(base, '/progress', signal, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, percent }),
    });
  }

  const abortEngine = () => engine?.requestAbort();
  signal.addEventListener('abort', abortEngine, { once: true });
  try {
    const input = join(directory, 'input');
    const raw = join(directory, 'stereo.pcm');
    await progress('validating', 26);
    const response = await send(base, '/input', signal);
    await pipeline(Readable.fromWeb(response.body), capBytes(size), createWriteStream(input), { signal });
    const file = await openAsBlob(input);
    if (file.size !== size) throw new InvalidAudio('The upload is incomplete.');
    try {
      await inspectAudioFile(file, format);
    } catch {
      throw new InvalidAudio('The file is invalid.');
    }
    await decode(input, raw, format, signal);
    const pcm = await openAsBlob(raw);
    if (pcm.size < SAMPLE_RATE * FRAME_BYTES || pcm.size % FRAME_BYTES) {
      throw new InvalidAudio('The decoded audio is invalid.');
    }

    const sampleCount = Math.min(pcm.size / FRAME_BYTES, PREVIEW_SECONDS[mode] * SAMPLE_RATE);
    const samples = new Float32Array(await pcm.slice(0, sampleCount * FRAME_BYTES).arrayBuffer());
    const left = new Float32Array(sampleCount);
    const right = new Float32Array(sampleCount);
    for (let index = 0; index < sampleCount; index++) {
      left[index] = samples[index * 2];
      right[index] = samples[index * 2 + 1];
    }
    if (!engine) {
      const session = await ort.InferenceSession.create('/opt/models/htdemucs.onnx', {
        executionProviders: ['cpu'], graphOptimizationLevel: 'basic', intraOpNumThreads: 2, interOpNumThreads: 1,
      });
      engine = new DemucsAudioEngine(session, ort.Tensor);
    }
    await progress('processing', 30);
    signal.throwIfAborted();
    let previousPercent = 30;
    const result = await engine.separate(left, right, SAMPLE_RATE, info => {
      const percent = Math.min(94, 30 + Math.floor(info.percent * 0.64));
      if (percent <= previousPercent) return;
      previousPercent = percent;
      progressWrites = progressWrites.then(() => progress('processing', percent)).catch(() => {});
    });
    signal.throwIfAborted();
    await progressWrites;
    await progress('exporting', 95);
    await uploadStem(base, 'vocals', encodeWAV(result.vocals.left, result.vocals.right, SAMPLE_RATE), signal);
    await progress('exporting', 97);
    await uploadStem(base, 'instrumental', encodeWAV(result.instrumental.left, result.instrumental.right, SAMPLE_RATE), signal);
    return { duration: sampleCount / SAMPLE_RATE };
  } finally {
    clearInterval(monitor);
    signal.removeEventListener('abort', abortEngine);
    await rm(directory, { recursive: true, force: true });
  }
}

function attemptIsValid(attempt) {
  return attempt && /^[a-f0-9]{64}$/.test(attempt.id) && /^[a-f0-9-]{36}$/.test(attempt.lease) &&
    ['mp3', 'wav'].includes(attempt.format) && Object.hasOwn(PREVIEW_SECONDS, attempt.mode) &&
    Number.isInteger(attempt.size) && attempt.size >= 12 && attempt.size <= MAX_FILE_BYTES &&
    Number.isSafeInteger(attempt.deadline) && attempt.deadline > Date.now();
}

const server = createServer(async (request, response) => {
  if (request.url === '/health' && request.method === 'GET') {
    response.writeHead(204).end();
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  if (request.url !== '/separate' || request.method !== 'POST') {
    response.writeHead(404).end('{}');
    return;
  }
  if (busy) {
    response.writeHead(409).end(JSON.stringify({ code: 'processor_unavailable' }));
    return;
  }
  busy = true;
  try {
    let body = '';
    request.setEncoding('utf8');
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 1024) throw new Error('Invalid job request.');
    }
    const attempt = JSON.parse(body);
    if (!attemptIsValid(attempt)) throw new Error('Invalid job request.');
    const result = await separate(attempt);
    response.writeHead(200).end(JSON.stringify(result));
  } catch (error) {
    const code = error instanceof InvalidAudio ? 'invalid_audio' : 'processor_unavailable';
    if (!(error instanceof InvalidAudio)) console.error('Audio processing stopped');
    response.writeHead(422).end(JSON.stringify({ code }));
  } finally {
    busy = false;
  }
});
server.listen(8080, '0.0.0.0');
