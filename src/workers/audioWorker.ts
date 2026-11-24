import { getVerifiedModel } from '../lib/audio/modelCache';
import { encodeWAV } from '../lib/audio/wavEncoder';
import type { ProgressInfo } from '../lib/audio/audioConfig';
import type { DemucsAudioEngine } from '../lib/audio/demucsProcessor';

let engine: DemucsAudioEngine | undefined;
const progress = (info: ProgressInfo) => self.postMessage({ type: 'PROGRESS', payload: info });

async function loadEngine() {
  const model = getVerifiedModel(percent => progress({
    phase: 'model-download', percent: Math.round(5 + percent * 0.32),
    message: 'Downloading and verifying the separation model…',
  }));
  const [bytes, ort, { DemucsAudioEngine }] = await Promise.all([
    model, import('onnxruntime-web/webgpu'), import('../lib/audio/demucsProcessor'),
  ]);
  progress({ phase: 'model-loading', percent: 39, message: 'Starting the local separation engine…' });
  ort.env.wasm.wasmPaths = import.meta.env.VITE_ORT_WASM_BASE || 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
  ort.env.wasm.numThreads = self.crossOriginIsolated
    ? Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)) : 1;
  let session;
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    const adapter = await gpu?.requestAdapter();
    session = await ort.InferenceSession.create(bytes, {
      executionProviders: adapter ? ['webgpu', 'wasm'] : ['wasm'], graphOptimizationLevel: 'basic',
    });
  } catch {
    session = await ort.InferenceSession.create(bytes, {
      executionProviders: ['wasm'], graphOptimizationLevel: 'basic',
    });
  }
  return new DemucsAudioEngine(session, ort.Tensor);
}

self.onmessage = async ({ data }) => {
  try {
    engine ??= await loadEngine();
    const { left, right, sampleRate } = data;
    const result = await engine.separate(left, right, sampleRate, info => progress({
      ...info, phase: info.phase === 'complete' ? 'synthesizing' : info.phase,
      percent: 43 + Math.round(info.percent * 0.51),
    }));
    progress({ phase: 'synthesizing', percent: 96, message: 'Encoding stereo WAV files…' });
    const vocalsBlob = encodeWAV(result.vocals.left, result.vocals.right, sampleRate);
    const instrumentalBlob = encodeWAV(result.instrumental.left, result.instrumental.right, sampleRate);
    self.postMessage({ type: 'SUCCESS', payload: { vocalsBlob, instrumentalBlob } });
  } catch (error) {
    self.postMessage({ type: 'ERROR', payload: error instanceof Error ? error.message : 'Local separation failed.' });
  }
};
