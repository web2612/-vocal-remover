export const MAX_FILE_BYTES = 100_000_000;
export const MAX_DURATION = 600;
export const SAMPLE_RATE = 44_100;
export const PART_BYTES = 8 * 1024 * 1024;
export const FILE_TTL = 5 * 60 * 1000;
export const PREVIEW_SECONDS = { full: MAX_DURATION, 'preview-30s': 30, 'preview-60s': 60 } as const;

export type SupportedAudioFormat = 'mp3' | 'wav';
export type ProcessingMode = keyof typeof PREVIEW_SECONDS;

const read = async (file: Blob, offset: number, length: number) =>
  new DataView(await file.slice(offset, offset + length).arrayBuffer());

function isTag(view: DataView, offset: number, text: string) {
  return offset + text.length <= view.byteLength &&
    Array.from(text).every((character, index) => view.getUint8(offset + index) === character.charCodeAt(0));
}

async function waveDuration(file: Blob, header: DataView): Promise<number> {
  if (!isTag(header, 0, 'RIFF') || !isTag(header, 8, 'WAVE') ||
      header.getUint32(4, true) + 8 !== file.size) return 0;

  let bytesPerFrame = 0;
  let sampleRate = 0;
  let audioBytes = 0;
  let offset = 12;
  for (let chunks = 0; offset + 8 <= file.size && chunks < 256; chunks++) {
    const chunk = await read(file, offset, 8);
    const length = chunk.getUint32(4, true);
    const end = offset + 8 + length + (length % 2);
    if (end > file.size) return 0;
    if (isTag(chunk, 0, 'fmt ')) {
      if (bytesPerFrame || length < 16) return 0;
      const format = await read(file, offset + 8, Math.min(length, 40));
      let codec = format.getUint16(0, true);
      if (codec === 0xfffe) {
        if (format.byteLength < 40 || format.getUint32(28, true) !== 0x00100000 ||
            format.getUint32(32, false) !== 0x800000aa || format.getUint32(36, false) !== 0x00389b71) return 0;
        codec = format.getUint32(24, true);
      }
      const channels = format.getUint16(2, true);
      sampleRate = format.getUint32(4, true);
      bytesPerFrame = format.getUint16(12, true);
      const bits = format.getUint16(14, true);
      const supportedBits = codec === 1 ? [8, 16, 24, 32] : codec === 3 ? [32, 64] : [];
      if (!supportedBits.includes(bits) || channels < 1 || channels > 8 ||
          sampleRate < 8000 || sampleRate > 192000 || bytesPerFrame !== channels * bits / 8 ||
          format.getUint32(8, true) !== bytesPerFrame * sampleRate) return 0;
    } else if (isTag(chunk, 0, 'data')) {
      if (audioBytes || !bytesPerFrame || length % bytesPerFrame) return 0;
      audioBytes = length;
    }
    offset = end;
  }
  return offset === file.size && audioBytes ? audioBytes / bytesPerFrame / sampleRate : 0;
}

const MPEG1_RATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG2_RATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

async function mp3Duration(file: Blob, header: DataView): Promise<number> {
  let offset = 0;
  if (isTag(header, 0, 'ID3')) {
    const version = header.getUint8(3);
    if (version < 2 || version > 4) return 0;
    offset = 10 + (version === 4 && (header.getUint8(5) & 16) ? 10 : 0);
    let tagSize = 0;
    for (let index = 6; index <= 9; index++) {
      const byte = header.getUint8(index);
      if (byte >= 128) return 0;
      tagSize = tagSize * 128 + byte;
    }
    offset += tagSize;
  }
  let end = file.size;
  if (end >= 128 && isTag(await read(file, end - 128, 3), 0, 'TAG')) end -= 128;
  let blockStart = -1;
  let block = header;
  let duration = 0;
  let frames = 0;
  while (offset + 4 <= end) {
    if (blockStart < 0 || offset + 4 > blockStart + block.byteLength) {
      blockStart = offset;
      block = await read(file, offset, Math.min(256 * 1024, end - offset));
    }
    const frame = block.getUint32(offset - blockStart);
    const version = (frame >>> 19) & 3;
    const rateIndex = (frame >>> 10) & 3;
    if ((frame >>> 21) !== 0x7ff || version === 1 || ((frame >>> 17) & 3) !== 1 || rateIndex === 3) return 0;
    const sampleRate = [44100, 48000, 32000][rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
    const bitRate = (version === 3 ? MPEG1_RATES : MPEG2_RATES)[(frame >>> 12) & 15];
    if (!bitRate) return 0;
    const samples = version === 3 ? 1152 : 576;
    offset += Math.floor(samples * bitRate * 1000 / (8 * sampleRate)) + ((frame >>> 9) & 1);
    duration += samples / sampleRate;
    frames++;
    if (duration > MAX_DURATION) return duration;
  }
  return offset === end && frames > 1 ? duration : 0;
}

export async function inspectAudioFile(file: Blob, format: SupportedAudioFormat) {
  if (file.size > MAX_FILE_BYTES) throw new Error('The file exceeds the 100 MB limit.');
  if (file.size < 12) throw new Error('Choose a valid MP3 or WAV file.');
  const header = await read(file, 0, 12);
  const duration = await (format === 'wav' ? waveDuration(file, header) : mp3Duration(file, header));
  if (!duration) throw new Error('The audio is corrupt or does not match its MP3 or WAV extension.');
  if (duration < 1 || duration > MAX_DURATION) throw new Error('Choose audio between 1 second and 10 minutes.');
  return duration;
}
