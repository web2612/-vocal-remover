export const DEMUCS_CONSTANTS = {
  SAMPLE_RATE: 44100,
  FFT_SIZE: 4096,
  HOP_SIZE: 1024,
  TRAINING_SAMPLES: 343980,
  MODEL_SPEC_BINS: 2048,
  MODEL_SPEC_FRAMES: 336,
  SEGMENT_OVERLAP: 0.25,
  TRACKS: ['drums', 'bass', 'other', 'vocals'] as const,
};

export interface ProgressInfo {
  phase: 'init' | 'model-download' | 'model-loading' | 'preparing-audio' | 'validating' | 'uploading' | 'queued' | 'separating' | 'synthesizing' | 'complete';
  percent: number;
  currentSegment?: number;
  totalSegments?: number;
  message: string;
}

export interface DeviceSupport {
  webgpu: boolean;
  wasm: boolean;
  recommendedProvider: 'webgpu' | 'wasm';
  reason: string;
}

export async function validateWebGpuHardware(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

export function checkBrowserDeviceSupport(): DeviceSupport {
  const hasWasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

  if (hasWebGPU) {
    return {
      webgpu: true,
      wasm: hasWasm,
      recommendedProvider: 'webgpu',
      reason: 'Hardware WebGPU acceleration is supported on this browser.'
    };
  }

  if (hasWasm) {
    return {
      webgpu: false,
      wasm: true,
      recommendedProvider: 'wasm',
      reason: 'WebGPU is unavailable. WebAssembly CPU inference will be used.'
    };
  }

  return {
    webgpu: false,
    wasm: false,
    recommendedProvider: 'wasm',
    reason: 'Neither WebGPU nor WebAssembly is supported on this browser.'
  };
}

