/**
 * Pure TypeScript 16-bit PCM WAV Audio Encoder
 * Encodes stereo Float32Array channels (-1.0 to 1.0) into a standard WAV Blob.
 */

export function encodeWAV(
  leftChannel: Float32Array,
  rightChannel: Float32Array,
  sampleRate: number = 44100
): Blob {
  const numChannels = 2;
  const numSamples = leftChannel.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataByteLength = numSamples * blockAlign;
  const headerByteLength = 44;
  const totalLength = headerByteLength + dataByteLength;

  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // 1. RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true); // chunkSize = 36 + SubChunk2Size
  writeString(8, 'WAVE');

  // 2. fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);          // Subchunk1Size = 16 for PCM
  view.setUint16(20, 1, true);           // AudioFormat = 1 (linear PCM)
  view.setUint16(22, numChannels, true); // NumChannels = 2
  view.setUint32(24, sampleRate, true);  // SampleRate
  view.setUint32(28, byteRate, true);    // ByteRate
  view.setUint16(32, blockAlign, true);  // BlockAlign
  view.setUint16(34, 16, true);          // BitsPerSample = 16

  // 3. data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  // Interleave and quantize samples into 16-bit signed PCM [-32768, 32767]
  let offset = headerByteLength;
  for (let i = 0; i < numSamples; i++) {
    // Left channel
    let leftSample = Math.max(-1, Math.min(1, leftChannel[i]));
    let leftInt16 = leftSample < 0 ? leftSample * 0x8000 : leftSample * 0x7FFF;
    view.setInt16(offset, leftInt16, true);
    offset += 2;

    // Right channel
    let rightSample = Math.max(-1, Math.min(1, rightChannel[i]));
    let rightInt16 = rightSample < 0 ? rightSample * 0x8000 : rightSample * 0x7FFF;
    view.setInt16(offset, rightInt16, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
