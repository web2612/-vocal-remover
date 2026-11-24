import type { InferenceSession, Tensor } from 'onnxruntime-web';
import { stft, istft, reflectPad, type STFTResult } from './fft';
import { DEMUCS_CONSTANTS, type ProgressInfo } from './audioConfig';
export type { ProgressInfo } from './audioConfig';

export interface DemucsSeparationResult {
  vocals: { left: Float32Array; right: Float32Array };
  instrumental: { left: Float32Array; right: Float32Array };
  drums?: { left: Float32Array; right: Float32Array };
  bass?: { left: Float32Array; right: Float32Array };
  other?: { left: Float32Array; right: Float32Array };
  sampleRate: number;
  duration: number;
}

/**
 * Frequency output to complex spectrogram per stem
 */
function standaloneMask(freqOutput: Float32Array) {
  const numTracks = 4;
  const numChannels = 4;
  const numBins = DEMUCS_CONSTANTS.MODEL_SPEC_BINS;
  const numFrames = DEMUCS_CONSTANTS.MODEL_SPEC_FRAMES;
  const result = [];

  for (let t = 0; t < numTracks; t++) {
    const trackSpec = {
      leftReal: new Float32Array(numBins * numFrames),
      leftImag: new Float32Array(numBins * numFrames),
      rightReal: new Float32Array(numBins * numFrames),
      rightImag: new Float32Array(numBins * numFrames)
    };

    for (let f = 0; f < numFrames; f++) {
      for (let b = 0; b < numBins; b++) {
        const baseIdx = t * numChannels * numBins * numFrames;
        const outIdx = b * numFrames + f;
        trackSpec.leftReal[outIdx] = freqOutput[baseIdx + b * numFrames + f];
        trackSpec.leftImag[outIdx] = freqOutput[baseIdx + 1 * numBins * numFrames + b * numFrames + f];
        trackSpec.rightReal[outIdx] = freqOutput[baseIdx + 2 * numBins * numFrames + b * numFrames + f];
        trackSpec.rightImag[outIdx] = freqOutput[baseIdx + 3 * numBins * numFrames + b * numFrames + f];
      }
    }
    result.push(trackSpec);
  }

  return result;
}

/**
 * Inverse STFT for complex spectrogram output
 */
function standaloneIspec(
  trackSpec: { leftReal: Float32Array; leftImag: Float32Array; rightReal: Float32Array; rightImag: Float32Array },
  targetLength: number
) {
  const numBins = DEMUCS_CONSTANTS.MODEL_SPEC_BINS;
  const numFrames = DEMUCS_CONSTANTS.MODEL_SPEC_FRAMES;
  const hopLength = DEMUCS_CONSTANTS.HOP_SIZE;
  const paddedBins = numBins + 1;
  const paddedFrames = numFrames + 4;

  const padChannel = (real: Float32Array, imag: Float32Array) => {
    const paddedReal = new Float32Array(paddedFrames * paddedBins);
    const paddedImag = new Float32Array(paddedFrames * paddedBins);

    for (let f = 0; f < numFrames; f++) {
      for (let b = 0; b < numBins; b++) {
        const srcIdx = b * numFrames + f;
        const dstFrame = f + 2;
        const dstIdx = dstFrame * paddedBins + b;
        paddedReal[dstIdx] = real[srcIdx];
        paddedImag[dstIdx] = imag[srcIdx];
      }
    }
    return { real: paddedReal, imag: paddedImag };
  };

  const leftPadded = padChannel(trackSpec.leftReal, trackSpec.leftImag);
  const rightPadded = padChannel(trackSpec.rightReal, trackSpec.rightImag);

  const centerPad = DEMUCS_CONSTANTS.FFT_SIZE / 2;
  const pad = Math.floor(hopLength / 2) * 3;
  const istftLength = (paddedFrames - 1) * hopLength + DEMUCS_CONSTANTS.FFT_SIZE;

  const leftOut = istft(leftPadded.real, leftPadded.imag, paddedFrames, paddedBins, DEMUCS_CONSTANTS.FFT_SIZE, hopLength, istftLength);
  const rightOut = istft(rightPadded.real, rightPadded.imag, paddedFrames, paddedBins, DEMUCS_CONSTANTS.FFT_SIZE, hopLength, istftLength);

  const totalOffset = centerPad + pad;
  const left = leftOut.subarray(totalOffset, totalOffset + targetLength);
  const right = rightOut.subarray(totalOffset, totalOffset + targetLength);

  return { left: new Float32Array(left), right: new Float32Array(right) };
}

/**
 * Prepares model input (waveform + STFT magSpec)
 */
function prepareModelInput(leftChannel: Float32Array, rightChannel: Float32Array) {
  const inputLength = DEMUCS_CONSTANTS.TRAINING_SAMPLES;

  const paddedLeft = new Float32Array(inputLength);
  const paddedRight = new Float32Array(inputLength);
  const copyLen = Math.min(leftChannel.length, inputLength);
  paddedLeft.set(leftChannel.subarray(0, copyLen));
  paddedRight.set(rightChannel.subarray(0, copyLen));

  const le = Math.ceil(inputLength / DEMUCS_CONSTANTS.HOP_SIZE);
  const pad = Math.floor(DEMUCS_CONSTANTS.HOP_SIZE / 2) * 3;
  const padRight = pad + le * DEMUCS_CONSTANTS.HOP_SIZE - inputLength;

  const stftInputLeft = reflectPad(paddedLeft, pad, padRight);
  const stftInputRight = reflectPad(paddedRight, pad, padRight);

  const centerPad = DEMUCS_CONSTANTS.FFT_SIZE / 2;
  const centeredLeft = reflectPad(stftInputLeft, centerPad, centerPad);
  const centeredRight = reflectPad(stftInputRight, centerPad, centerPad);

  const stftLeft: STFTResult = stft(centeredLeft, DEMUCS_CONSTANTS.FFT_SIZE, DEMUCS_CONSTANTS.HOP_SIZE);
  const stftRight: STFTResult = stft(centeredRight, DEMUCS_CONSTANTS.FFT_SIZE, DEMUCS_CONSTANTS.HOP_SIZE);

  const numBins = DEMUCS_CONSTANTS.MODEL_SPEC_BINS;
  const numFrames = DEMUCS_CONSTANTS.MODEL_SPEC_FRAMES;
  const frameOffset = 2;

  const magSpec = new Float32Array(4 * numBins * numFrames);

  for (let f = 0; f < numFrames; f++) {
    const srcFrame = f + frameOffset;
    for (let b = 0; b < numBins; b++) {
      const srcIdx = srcFrame * stftLeft.numBins + b;
      magSpec[b * numFrames + f] = stftLeft.real[srcIdx];
      magSpec[1 * numBins * numFrames + b * numFrames + f] = stftLeft.imag[srcIdx];
      magSpec[2 * numBins * numFrames + b * numFrames + f] = stftRight.real[srcIdx];
      magSpec[3 * numBins * numFrames + b * numFrames + f] = stftRight.imag[srcIdx];
    }
  }

  const waveform = new Float32Array(2 * inputLength);
  waveform.set(paddedLeft, 0);
  waveform.set(paddedRight, inputLength);

  return { waveform, magSpec };
}

export class DemucsAudioEngine {
  private abortRequested: boolean = false;

  public requestAbort() {
    this.abortRequested = true;
  }

  private readonly session: InferenceSession;
  private readonly FloatTensor: typeof Tensor;

  public constructor(session: InferenceSession, FloatTensor: typeof Tensor) {
    this.session = session;
    this.FloatTensor = FloatTensor;
  }

  public async separate(
    leftChannel: Float32Array,
    rightChannel: Float32Array,
    sampleRate: number = 44100,
    onProgress?: (info: ProgressInfo) => void
  ): Promise<DemucsSeparationResult> {
    this.abortRequested = false;
    const totalSamples = leftChannel.length;
    const trainingSamples = DEMUCS_CONSTANTS.TRAINING_SAMPLES;
    const stride = Math.floor(trainingSamples * (1 - DEMUCS_CONSTANTS.SEGMENT_OVERLAP));
    const numSegments = Math.max(1, Math.ceil(totalSamples / stride));

    const numTracks = 4;
    const outputs = [
      { left: new Float32Array(totalSamples), right: new Float32Array(totalSamples) }, // drums
      { left: new Float32Array(totalSamples), right: new Float32Array(totalSamples) }, // bass
      { left: new Float32Array(totalSamples), right: new Float32Array(totalSamples) }, // other
      { left: new Float32Array(totalSamples), right: new Float32Array(totalSamples) }, // vocals
    ];
    const weights = new Float32Array(totalSamples);

    let segmentIdx = 0;

    for (let start = 0; start < totalSamples; start += stride) {
      if (this.abortRequested) {
        throw new Error('Processing cancelled by user.');
      }

      const end = Math.min(start + trainingSamples, totalSamples);
      const segmentLength = end - start;

      const segLeft = new Float32Array(trainingSamples);
      const segRight = new Float32Array(trainingSamples);

      for (let i = 0; i < segmentLength; i++) {
        segLeft[i] = leftChannel[start + i];
        segRight[i] = rightChannel[start + i];
      }

      onProgress?.({
        phase: 'preparing-audio',
        percent: Math.round(((segmentIdx) / numSegments) * 100),
        currentSegment: segmentIdx + 1,
        totalSegments: numSegments,
        message: `Analyzing audio frequencies for chunk ${segmentIdx + 1} of ${numSegments}...`
      });

      const input = prepareModelInput(segLeft, segRight);

      const waveformTensor = new this.FloatTensor('float32', input.waveform, [1, 2, trainingSamples]);
      const magSpecTensor = new this.FloatTensor('float32', input.magSpec, [
        1,
        4,
        DEMUCS_CONSTANTS.MODEL_SPEC_BINS,
        DEMUCS_CONSTANTS.MODEL_SPEC_FRAMES
      ]);

      // Map inputs robustly by tensor shape and model input name
      const feeds: Record<string, Tensor> = {};
      for (const name of this.session.inputNames) {
        const lower = name.toLowerCase();
        if (lower.includes('spec') || lower.includes('mag') || lower.includes('freq')) {
          feeds[name] = magSpecTensor;
        } else if (lower.includes('mix') || lower.includes('wave') || lower.includes('time') || lower.includes('audio')) {
          feeds[name] = waveformTensor;
        }
      }
      if (Object.keys(feeds).length < this.session.inputNames.length) {
        if (this.session.inputNames.length === 1) {
          feeds[this.session.inputNames[0]] = waveformTensor;
        } else if (this.session.inputNames.length >= 2) {
          feeds[this.session.inputNames[0]] = waveformTensor;
          feeds[this.session.inputNames[1]] = magSpecTensor;
        }
      }

      onProgress?.({
        phase: 'separating',
        percent: Math.round(((segmentIdx + 0.3) / numSegments) * 100),
        currentSegment: segmentIdx + 1,
        totalSegments: numSegments,
        message: `Running neural network source separation on chunk ${segmentIdx + 1} of ${numSegments}...`
      });

      const inferResults = await this.session.run(feeds);

      let timeData: Float32Array | null = null;
      let timeShape: readonly number[] | null = null;
      let freqData: Float32Array | null = null;

      for (const name of this.session.outputNames) {
        const tensor = inferResults[name];
        if (tensor.dims.length === 4 && tensor.dims[2] === 2) {
          timeData = tensor.data as Float32Array;
          timeShape = tensor.dims;
        } else if (tensor.dims.length === 5 && tensor.dims[2] === 4) {
          freqData = tensor.data as Float32Array;
        }
      }

      if (!timeData || !timeShape) {
        throw new Error('Model inference did not produce expected time-domain tensor.');
      }

      let combinedOutputs: { left: Float32Array; right: Float32Array }[] | null = null;
      if (freqData) {
        const trackSpecs = standaloneMask(freqData);
        combinedOutputs = [];

        for (let t = 0; t < 4; t++) {
          const freqOutput = standaloneIspec(trackSpecs[t], trainingSamples);
          const numChannels = timeShape[2];
          const samples = timeShape[3];
          const timeLeft = new Float32Array(samples);
          const timeRight = new Float32Array(samples);

          for (let i = 0; i < samples; i++) {
            timeLeft[i] = timeData[t * numChannels * samples + i];
            timeRight[i] = timeData[t * numChannels * samples + 1 * samples + i];
          }

          const combined = {
            left: new Float32Array(samples),
            right: new Float32Array(samples)
          };
          for (let i = 0; i < samples; i++) {
            combined.left[i] = timeLeft[i] + (freqOutput.left[i] || 0);
            combined.right[i] = timeRight[i] + (freqOutput.right[i] || 0);
          }
          combinedOutputs.push(combined);
        }
      }

      const channelsCount = timeShape[2];
      const samplesCount = timeShape[3];

      // Overlap blend window
      const overlapWindow = new Float32Array(segmentLength);
      const halfStride = stride * 0.5;
      for (let i = 0; i < segmentLength; i++) {
        const fadeIn = Math.min(i / halfStride, 1);
        const fadeOut = Math.min((segmentLength - i) / halfStride, 1);
        overlapWindow[i] = Math.min(fadeIn, fadeOut);
      }

      for (let t = 0; t < numTracks; t++) {
        for (let i = 0; i < segmentLength && start + i < totalSamples; i++) {
          let leftVal: number;
          let rightVal: number;
          if (combinedOutputs) {
            leftVal = combinedOutputs[t].left[i];
            rightVal = combinedOutputs[t].right[i];
          } else {
            const leftIdx = t * channelsCount * samplesCount + i;
            const rightIdx = t * channelsCount * samplesCount + 1 * samplesCount + i;
            leftVal = timeData[leftIdx];
            rightVal = timeData[rightIdx];
          }
          outputs[t].left[start + i] += leftVal * overlapWindow[i];
          outputs[t].right[start + i] += rightVal * overlapWindow[i];
        }
      }

      for (let i = 0; i < segmentLength && start + i < totalSamples; i++) {
        weights[start + i] += overlapWindow[i];
      }

      segmentIdx++;
    }

    onProgress?.({
      phase: 'synthesizing',
      percent: 95,
      message: 'Synthesizing clean stems and reconstructing stereo channels...'
    });

    // Normalize weights
    for (let t = 0; t < numTracks; t++) {
      for (let i = 0; i < totalSamples; i++) {
        if (weights[i] > 1e-4) {
          outputs[t].left[i] /= weights[i];
          outputs[t].right[i] /= weights[i];
        }
      }
    }

    // Drums (0), Bass (1), Other (2), Vocals (3)
    const drums = outputs[0];
    const bass = outputs[1];
    const other = outputs[2];
    const vocals = outputs[3];

    // Combine drums + bass + other into instrumental with anti-clipping protection
    const instrumentalLeft = new Float32Array(totalSamples);
    const instrumentalRight = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      const rawLeft = drums.left[i] + bass.left[i] + other.left[i];
      const rawRight = drums.right[i] + bass.right[i] + other.right[i];
      instrumentalLeft[i] = Math.max(-1.0, Math.min(1.0, rawLeft));
      instrumentalRight[i] = Math.max(-1.0, Math.min(1.0, rawRight));
      vocals.left[i] = Math.max(-1.0, Math.min(1.0, vocals.left[i]));
      vocals.right[i] = Math.max(-1.0, Math.min(1.0, vocals.right[i]));
    }

    onProgress?.({
      phase: 'complete',
      percent: 100,
      message: 'Vocal separation completed successfully!'
    });

    return {
      vocals,
      instrumental: { left: instrumentalLeft, right: instrumentalRight },
      drums,
      bass,
      other,
      sampleRate,
      duration: totalSamples / sampleRate
    };
  }
}
