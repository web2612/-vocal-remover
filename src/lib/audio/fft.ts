/**
 * Fast Fourier Transform (FFT), STFT and iSTFT utilities for AI Audio Processing
 */

// Precompute Hann window
export function createHannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  const factor = (2 * Math.PI) / size;
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos(factor * i));
  }
  return window;
}

// Symmetric reflection padding
export function reflectPad(signal: Float32Array, leftPad: number, rightPad: number): Float32Array {
  const padded = new Float32Array(signal.length + leftPad + rightPad);
  const len = signal.length;

  // Left reflection
  for (let i = 0; i < leftPad; i++) {
    padded[i] = signal[leftPad - i];
  }

  // Copy center signal
  padded.set(signal, leftPad);

  // Right reflection
  for (let i = 0; i < rightPad; i++) {
    padded[leftPad + len + i] = signal[len - 2 - i];
  }

  return padded;
}

// In-place Radix-2 Cooley-Tukey FFT
export function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if ((n & (n - 1)) !== 0) {
    throw new Error('FFT length must be a power of 2');
  }

  // Bit reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = real[i];
      real[i] = real[j];
      real[j] = tempR;

      const tempI = imag[i];
      imag[i] = imag[j];
      imag[j] = tempI;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly updates
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wR = 1.0;
      let wI = 0.0;
      for (let k = 0; k < halfLen; k++) {
        const uR = real[i + k];
        const uI = imag[i + k];
        const vR = real[i + k + halfLen] * wR - imag[i + k + halfLen] * wI;
        const vI = real[i + k + halfLen] * wI + imag[i + k + halfLen] * wR;

        real[i + k] = uR + vR;
        imag[i + k] = uI + vI;
        real[i + k + halfLen] = uR - vR;
        imag[i + k + halfLen] = uI - vI;

        const nextWR = wR * wStepR - wI * wStepI;
        const nextWI = wR * wStepI + wI * wStepR;
        wR = nextWR;
        wI = nextWI;
      }
    }
  }
}

// Inverse FFT
export function ifft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  // Conjugate complex input
  for (let i = 0; i < n; i++) {
    imag[i] = -imag[i];
  }

  fft(real, imag);

  // Conjugate again and divide by n
  const invN = 1.0 / n;
  for (let i = 0; i < n; i++) {
    real[i] = real[i] * invN;
    imag[i] = -imag[i] * invN;
  }
}

export interface STFTResult {
  real: Float32Array;
  imag: Float32Array;
  numFrames: number;
  numBins: number;
}

// Short-Time Fourier Transform
export function stft(signal: Float32Array, fftSize: number, hopSize: number): STFTResult {
  const window = createHannWindow(fftSize);
  const numBins = (fftSize >> 1) + 1;
  const numFrames = Math.floor((signal.length - fftSize) / hopSize) + 1;

  const realOut = new Float32Array(numFrames * numBins);
  const imagOut = new Float32Array(numFrames * numBins);

  const frameReal = new Float32Array(fftSize);
  const frameImag = new Float32Array(fftSize);

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;

    // Apply window
    for (let i = 0; i < fftSize; i++) {
      frameReal[i] = signal[start + i] * window[i];
      frameImag[i] = 0.0;
    }

    fft(frameReal, frameImag);

    // Save one-sided spectrum (0 to numBins - 1)
    for (let b = 0; b < numBins; b++) {
      realOut[f * numBins + b] = frameReal[b];
      imagOut[f * numBins + b] = frameImag[b];
    }
  }

  return { real: realOut, imag: imagOut, numFrames, numBins };
}

// Inverse Short-Time Fourier Transform with Overlap-Add
export function istft(
  real: Float32Array,
  imag: Float32Array,
  numFrames: number,
  numBins: number,
  fftSize: number,
  hopSize: number,
  targetLength: number
): Float32Array {
  const window = createHannWindow(fftSize);
  const output = new Float32Array(targetLength);
  const windowWeight = new Float32Array(targetLength);

  const frameReal = new Float32Array(fftSize);
  const frameImag = new Float32Array(fftSize);

  for (let f = 0; f < numFrames; f++) {
    // Reconstruct two-sided Hermitian symmetric spectrum
    for (let b = 0; b < numBins; b++) {
      const idx = f * numBins + b;
      frameReal[b] = real[idx];
      frameImag[b] = imag[idx];
    }
    for (let b = 1; b < fftSize - numBins + 1; b++) {
      frameReal[fftSize - b] = frameReal[b];
      frameImag[fftSize - b] = -frameImag[b];
    }

    ifft(frameReal, frameImag);

    const start = f * hopSize;
    for (let i = 0; i < fftSize && start + i < targetLength; i++) {
      const w = window[i];
      output[start + i] += frameReal[i] * w;
      windowWeight[start + i] += w * w;
    }
  }

  // Normalize by window weights
  for (let i = 0; i < targetLength; i++) {
    if (windowWeight[i] > 1e-4) {
      output[i] /= windowWeight[i];
    }
  }

  return output;
}
