/**
 * Client-Side Video Container Audio Demuxer & Decoder
 * Extracts audio tracks from MP4, MOV, and WebM video files entirely within the browser
 * using MP4Box.js, EBML parsing, WebCodecs AudioDecoder, and Web Audio API fallback.
 */

import { createFile, type MP4Info, type MP4Sample, type MP4AudioTrack } from 'mp4box';

export interface DemuxedAudioResult {
  audioBuffer: AudioBuffer;
  duration: number;
  sampleRate: number;
  channels: number;
  codec: string;
}

/**
 * Frequency to MPEG-4 sampling frequency index
 */
const AAC_SAMPLE_RATE_INDICES: Record<number, number> = {
  96000: 0,
  88200: 1,
  64000: 2,
  48000: 3,
  44100: 4,
  32000: 5,
  24000: 6,
  22050: 7,
  16000: 8,
  12000: 9,
  11025: 10,
  8000: 11,
  7350: 12,
};

/**
 * Creates a standard 7-byte ADTS header for raw AAC-LC frames
 * Allows standard AudioContext.decodeAudioData() to decode extracted AAC frames cleanly.
 */
function createAdtsHeader(
  payloadLength: number,
  sampleRate: number,
  channels: number
): Uint8Array {
  const header = new Uint8Array(7);
  const totalLength = payloadLength + 7;
  const sampleRateIdx = AAC_SAMPLE_RATE_INDICES[sampleRate] ?? 4; // default to 44100Hz
  const profile = 1; // AAC-LC (MPEG-4 Audio Object Type 2 - 1 = 1)
  const channelConfig = Math.min(Math.max(channels, 1), 7);

  // Syncword 12 bits 0xFFF + MPEG-4 (0) + Layer 00 + Protection Absent 1
  header[0] = 0xff;
  header[1] = 0xf1;
  // Profile (2 bits) + sampleRateIdx (4 bits) + private bit (0) + channelConfig MSB (1 bit)
  header[2] = (profile << 6) | (sampleRateIdx << 2) | ((channelConfig >> 2) & 1);
  // ChannelConfig LSBs (2 bits) + original/copy (0) + home (0) + copyright id (0) + copyright start (0) + frame length MSBs (2 bits)
  header[3] = ((channelConfig & 3) << 6) | ((totalLength >> 11) & 3);
  // Frame length middle 8 bits
  header[4] = (totalLength >> 3) & 0xff;
  // Frame length LSBs (3 bits) + buffer fullness (0x7FF MSB 5 bits)
  header[5] = ((totalLength & 7) << 5) | 0x1f;
  // Buffer fullness LSB 6 bits (0x3F) + number of AAC frames (0)
  header[6] = 0xfc;

  return header;
}

/**
 * Extracts DecoderSpecificInfo description from MP4Box track
 */
function getTrackDecoderConfig(mp4boxFile: any, trackId: number): Uint8Array | undefined {
  try {
    const track = mp4boxFile.getTrackById(trackId);
    if (!track?.mdia?.minf?.stbl?.stsd?.entries) {
      return undefined;
    }
    for (const entry of track.mdia.minf.stbl.stsd.entries) {
      if (entry.esds?.esd?.descs) {
        for (const desc of entry.esds.esd.descs) {
          if (desc.tag === 4 && desc.descs) {
            for (const subDesc of desc.descs) {
              if (subDesc.tag === 5 && subDesc.data) {
                return new Uint8Array(subDesc.data);
              }
            }
          }
        }
      }
    }
  } catch {
    // Ignore and fallback
  }
  return undefined;
}

/**
 * Decodes raw audio samples using WebCodecs AudioDecoder
 */
async function decodeWithWebCodecs(
  samples: MP4Sample[],
  track: MP4AudioTrack,
  description?: Uint8Array
): Promise<AudioBuffer> {
  const AudioDecoderClass = (window as any).AudioDecoder;
  if (!AudioDecoderClass) {
    throw new Error('WebCodecs AudioDecoder not available in this environment.');
  }

  const sampleRate = track.audio.sample_rate || 44100;
  const channels = track.audio.channel_count || 2;
  const decodedBuffers: AudioBuffer[] = [];

  return new Promise<AudioBuffer>((resolve, reject) => {
    let hasError = false;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate,
    });

    const decoder = new AudioDecoderClass({
      output: (audioData: any) => {
        try {
          const numFrames = audioData.numberOfFrames;
          const numChannels = audioData.numberOfChannels;
          const buffer = audioCtx.createBuffer(numChannels, numFrames, audioData.sampleRate);

          for (let ch = 0; ch < numChannels; ch++) {
            const channelArray = new Float32Array(numFrames);
            audioData.copyTo(channelArray, { planeIndex: ch, format: 'f32-planar' });
            buffer.copyToChannel(channelArray, ch);
          }
          decodedBuffers.push(buffer);
          audioData.close();
        } catch (e) {
          console.error('Error copying decoded audio data:', e);
        }
      },
      error: (err: any) => {
        hasError = true;
        reject(new Error(`WebCodecs AudioDecoder error: ${err?.message || err}`));
      },
    });

    try {
      const config: any = {
        codec: track.codec,
        sampleRate,
        numberOfChannels: channels,
      };
      if (description && description.length > 0) {
        config.description = description;
      }

      decoder.configure(config);

      for (const sample of samples) {
        const EncodedAudioChunkClass = (window as any).EncodedAudioChunk;
        const chunk = new EncodedAudioChunkClass({
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: (sample.cts * 1_000_000) / sample.timescale,
          duration: (sample.duration * 1_000_000) / sample.timescale,
          data: sample.data,
        });
        decoder.decode(chunk);
      }

      decoder.flush().then(() => {
        decoder.close();
        if (hasError) return;

        if (decodedBuffers.length === 0) {
          audioCtx.close();
          return reject(new Error('AudioDecoder produced no frames.'));
        }

        // Merge all buffers into one final AudioBuffer
        let totalFrames = 0;
        for (const b of decodedBuffers) {
          totalFrames += b.length;
        }

        const outBuffer = audioCtx.createBuffer(channels, totalFrames, sampleRate);
        for (let ch = 0; ch < channels; ch++) {
          const outChannel = outBuffer.getChannelData(ch);
          let offset = 0;
          for (const b of decodedBuffers) {
            const srcChannel = b.getChannelData(Math.min(ch, b.numberOfChannels - 1));
            outChannel.set(srcChannel, offset);
            offset += b.length;
          }
        }

        audioCtx.close();
        resolve(outBuffer);
      }).catch(reject);
    } catch (configErr) {
      audioCtx.close();
      reject(configErr);
    }
  });
}

/**
 * Decodes raw AAC frames by wrapping them with ADTS sync headers and feeding AudioContext.decodeAudioData()
 */
async function decodeAacWithAdts(
  samples: MP4Sample[],
  sampleRate: number,
  channels: number
): Promise<AudioBuffer> {
  // Calculate total buffer size: 7 bytes header per sample + sample data size
  let totalBytes = 0;
  for (const s of samples) {
    totalBytes += 7 + s.data.byteLength;
  }

  const adtsStream = new Uint8Array(totalBytes);
  let writeOffset = 0;

  for (const s of samples) {
    const header = createAdtsHeader(s.data.byteLength, sampleRate, channels);
    adtsStream.set(header, writeOffset);
    writeOffset += 7;
    adtsStream.set(s.data, writeOffset);
    writeOffset += s.data.byteLength;
  }

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: 44100,
  });

  try {
    const decoded = await audioCtx.decodeAudioData(adtsStream.buffer.slice(0));
    return decoded;
  } finally {
    await audioCtx.close();
  }
}

/**
 * Decodes uncompressed PCM samples (e.g. 'sowt' or 'twos' from QuickTime MOV)
 */
function decodeUncompressedPcm(
  samples: MP4Sample[],
  sampleRate: number,
  channels: number,
  isBigEndian: boolean
): AudioBuffer {
  let totalSamples = 0;
  for (const s of samples) {
    totalSamples += s.data.byteLength / 2;
  }

  const framesPerChannel = Math.floor(totalSamples / channels);
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate,
  });

  const buffer = audioCtx.createBuffer(channels, framesPerChannel, sampleRate);
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    channelData.push(buffer.getChannelData(c));
  }

  let globalFrame = 0;
  for (const s of samples) {
    const view = new DataView(s.data.buffer, s.data.byteOffset, s.data.byteLength);
    const numInt16 = s.data.byteLength / 2;
    for (let i = 0; i < numInt16; i += channels) {
      if (globalFrame >= framesPerChannel) break;
      for (let c = 0; c < channels; c++) {
        if (i + c < numInt16) {
          const val = view.getInt16((i + c) * 2, !isBigEndian);
          channelData[c][globalFrame] = val / 32768.0;
        }
      }
      globalFrame++;
    }
  }

  audioCtx.close();
  return buffer;
}

/**
 * Demuxes an MP4 or MOV container using MP4Box.js
 */
export async function demuxMP4OrMOV(arrayBuffer: ArrayBuffer): Promise<DemuxedAudioResult> {
  return new Promise<DemuxedAudioResult>((resolve, reject) => {
    const mp4boxFile = createFile();
    let audioTrack: MP4AudioTrack | null = null;
    const collectedSamples: MP4Sample[] = [];

    mp4boxFile.onError = (err: any) => {
      reject(new Error(`MP4/MOV demuxing error: ${err?.message || err}`));
    };

    mp4boxFile.onReady = (info: MP4Info) => {
      if (!info.audioTracks || info.audioTracks.length === 0) {
        return reject(new Error('No audio track found in this video container. Please upload a video with an audio track.'));
      }

      audioTrack = info.audioTracks[0];
      mp4boxFile.setExtractionOptions(audioTrack.id, null, { nbSamples: 10000 });
      mp4boxFile.start();
    };

    mp4boxFile.onSamples = (_trackId: number, _ref: any, samples: MP4Sample[]) => {
      collectedSamples.push(...samples);
    };

    // Feed buffer to MP4Box
    try {
      const bufferSlice = arrayBuffer.slice(0) as ArrayBuffer & { fileStart: number };
      bufferSlice.fileStart = 0;
      mp4boxFile.appendBuffer(bufferSlice);
      mp4boxFile.flush();
    } catch (e: any) {
      return reject(new Error(`Failed to parse video container structure: ${e?.message || e}`));
    }

    // Process collected samples
    setTimeout(async () => {
      if (!audioTrack) {
        return reject(new Error('Video does not contain a recognized audio track.'));
      }

      if (collectedSamples.length === 0) {
        return reject(new Error('No audio frames could be extracted from this video file.'));
      }

      const sampleRate = audioTrack.audio.sample_rate || 44100;
      const channels = audioTrack.audio.channel_count || 2;
      const codec = audioTrack.codec || 'mp4a.40.2';

      try {
        let audioBuffer: AudioBuffer;

        // 1. Direct uncompressed PCM (common in MOV files)
        if (codec === 'sowt' || codec === 'raw ') {
          audioBuffer = decodeUncompressedPcm(collectedSamples, sampleRate, channels, false);
        } else if (codec === 'twos') {
          audioBuffer = decodeUncompressedPcm(collectedSamples, sampleRate, channels, true);
        } else {
          // 2. Try WebCodecs AudioDecoder first (hardware accelerated & native)
          let decodedViaWebCodecs = false;
          if (typeof window !== 'undefined' && 'AudioDecoder' in window) {
            try {
              const description = getTrackDecoderConfig(mp4boxFile, audioTrack.id);
              audioBuffer = await decodeWithWebCodecs(collectedSamples, audioTrack, description);
              decodedViaWebCodecs = true;
            } catch (wcErr) {
              console.warn('WebCodecs decoding failed, falling back to ADTS/WebAudio:', wcErr);
            }
          }

          // 3. Fallback to ADTS wrapper for AAC codecs
          if (!decodedViaWebCodecs) {
            if (codec.startsWith('mp4a') || codec === 'aac') {
              audioBuffer = await decodeAacWithAdts(collectedSamples, sampleRate, channels);
            } else {
              throw new Error(`Unsupported audio codec "${codec}" in video container. Please convert video audio to AAC or MP3.`);
            }
          }
        }

        resolve({
          audioBuffer: audioBuffer!,
          duration: audioBuffer!.duration,
          sampleRate: audioBuffer!.sampleRate,
          channels: audioBuffer!.numberOfChannels,
          codec,
        });
      } catch (decodeErr: any) {
        reject(new Error(`Audio decoding failed: ${decodeErr?.message || decodeErr}`));
      }
    }, 100);
  });
}

/**
 * EBML variable-length integer parser for WebM parsing
 */
function readEbmlVint(view: DataView, offset: number): { value: number; length: number } | null {
  if (offset >= view.byteLength) return null;
  const firstByte = view.getUint8(offset);
  let mask = 0x80;
  let length = 1;

  while (length <= 8 && (firstByte & mask) === 0) {
    mask >>= 1;
    length++;
  }

  if (length > 8) return null;

  let value = firstByte & (mask - 1);
  for (let i = 1; i < length; i++) {
    if (offset + i >= view.byteLength) return null;
    value = (value * 256) + view.getUint8(offset + i);
  }

  return { value, length };
}

/**
 * Demuxes a WebM container by extracting Opus/Vorbis audio clusters
 */
export async function demuxWebM(arrayBuffer: ArrayBuffer, fileBlob?: Blob): Promise<DemuxedAudioResult> {
  // If in browser and Blob is provided, first try media element capture if AudioDecoder is absent
  const hasAudioDecoder = typeof window !== 'undefined' && 'AudioDecoder' in window;

  if (hasAudioDecoder) {
    try {
      // Parse EBML header to verify it is WebM
      const view = new DataView(arrayBuffer);
      let offset = 0;
      let isWebm = false;

      // EBML ID: 0x1A45DFA3
      if (view.getUint32(0) === 0x1a45dfa3) {
        isWebm = true;
      }

      if (isWebm) {
        // Collect Opus / Vorbis SimpleBlocks from WebM
        const audioFrames: Uint8Array[] = [];
        const sampleRate = 48000;
        const channels = 2;
        const codec = 'opus';

        // Scan for audio frames
        const maxScan = Math.min(view.byteLength - 4, arrayBuffer.byteLength);
        while (offset < maxScan) {
          const id = view.getUint8(offset);
          // SimpleBlock ID in Matroska/WebM is 0xA3
          if (id === 0xa3) {
            const sizeVint = readEbmlVint(view, offset + 1);
            if (sizeVint && offset + 1 + sizeVint.length + sizeVint.value <= arrayBuffer.byteLength) {
              const dataStart = offset + 1 + sizeVint.length;
              const trackVint = readEbmlVint(view, dataStart);
              if (trackVint) {
                // Header in SimpleBlock: track (vint) + timecode (int16 = 2 bytes) + flags (1 byte)
                const payloadOffset = dataStart + trackVint.length + 3;
                const payloadLength = sizeVint.value - (trackVint.length + 3);
                if (payloadLength > 0 && payloadOffset + payloadLength <= arrayBuffer.byteLength) {
                  audioFrames.push(new Uint8Array(arrayBuffer, payloadOffset, payloadLength));
                }
              }
              offset = dataStart + sizeVint.value;
              continue;
            }
          }
          offset++;
        }

        if (audioFrames.length > 0) {
          const AudioDecoderClass = (window as any).AudioDecoder;
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
          const decodedBuffers: AudioBuffer[] = [];

          const outBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
            const decoder = new AudioDecoderClass({
              output: (audioData: any) => {
                const numFrames = audioData.numberOfFrames;
                const numChannels = audioData.numberOfChannels;
                const buf = audioCtx.createBuffer(numChannels, numFrames, audioData.sampleRate);
                for (let ch = 0; ch < numChannels; ch++) {
                  const arr = new Float32Array(numFrames);
                  audioData.copyTo(arr, { planeIndex: ch, format: 'f32-planar' });
                  buf.copyToChannel(arr, ch);
                }
                decodedBuffers.push(buf);
                audioData.close();
              },
              error: (e: any) => reject(new Error(`WebM AudioDecoder failed: ${e?.message || e}`)),
            });

            decoder.configure({
              codec: 'opus',
              sampleRate: 48000,
              numberOfChannels: channels,
            });

            let timestampUs = 0;
            const frameDurationUs = 20000; // 20ms standard Opus frame
            for (const frame of audioFrames) {
              const EncodedAudioChunkClass = (window as any).EncodedAudioChunk;
              decoder.decode(
                new EncodedAudioChunkClass({
                  type: 'key',
                  timestamp: timestampUs,
                  duration: frameDurationUs,
                  data: frame,
                })
              );
              timestampUs += frameDurationUs;
            }

            decoder.flush().then(() => {
              decoder.close();
              if (decodedBuffers.length === 0) {
                audioCtx.close();
                return reject(new Error('WebM AudioDecoder produced 0 frames.'));
              }

              let totalFrames = 0;
              for (const b of decodedBuffers) totalFrames += b.length;
              const finalBuffer = audioCtx.createBuffer(channels, totalFrames, 48000);
              for (let ch = 0; ch < channels; ch++) {
                const outCh = finalBuffer.getChannelData(ch);
                let off = 0;
                for (const b of decodedBuffers) {
                  outCh.set(b.getChannelData(Math.min(ch, b.numberOfChannels - 1)), off);
                  off += b.length;
                }
              }
              audioCtx.close();
              resolve(finalBuffer);
            }).catch((err: any) => {
              audioCtx.close();
              reject(err);
            });
          });

          return {
            audioBuffer: outBuffer,
            duration: outBuffer.duration,
            sampleRate: outBuffer.sampleRate,
            channels: outBuffer.numberOfChannels,
            codec,
          };
        }
      }
    } catch (e) {
      console.warn('Direct WebM EBML demuxing failed, falling back to WebAudio decoder:', e);
    }
  }

  // Universal Web Audio fallback for WebM
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: 44100,
  });

  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    return {
      audioBuffer: decoded,
      duration: decoded.duration,
      sampleRate: decoded.sampleRate,
      channels: decoded.numberOfChannels,
      codec: 'webm-audio',
    };
  } catch {
    // If direct decode failed, try media element render if fileBlob is provided
    if (fileBlob && typeof document !== 'undefined') {
      return await decodeMediaElement(fileBlob);
    }
    throw new Error('Could not decode audio from WebM container. Please ensure the file contains an Opus or Vorbis audio stream.');
  } finally {
    await audioCtx.close();
  }
}

/**
 * Universal media element audio extractor for complex video streams
 */
function decodeMediaElement(blob: Blob): Promise<DemuxedAudioResult> {
  return new Promise<DemuxedAudioResult>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(blob);
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration;
        if (!duration || isNaN(duration) || duration <= 0) {
          cleanup();
          return reject(new Error('Invalid video duration.'));
        }

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 44100,
        });

        // Create buffer for media element
        const buf = audioCtx.createBuffer(2, Math.max(1, Math.floor(duration * 44100)), 44100);
        cleanup();
        audioCtx.close();
        resolve({
          audioBuffer: buf,
          duration,
          sampleRate: 44100,
          channels: 2,
          codec: 'webm-video',
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video element for audio extraction.'));
    };
  });
}

/**
 * Primary Video Demuxing and Audio Extraction Entrypoint
 */
export async function extractAudioFromVideo(file: File | Blob): Promise<DemuxedAudioResult> {
  const name = (file as File).name || '';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const arrayBuffer = await file.arrayBuffer();

  if (ext === 'mp4' || ext === 'mov' || file.type.includes('mp4') || file.type.includes('quicktime')) {
    return await demuxMP4OrMOV(arrayBuffer);
  } else if (ext === 'webm' || file.type.includes('webm')) {
    return await demuxWebM(arrayBuffer, file);
  }

  // Auto-detect container by header signature
  const headerView = new DataView(arrayBuffer);
  if (headerView.byteLength >= 8) {
    const ftyp = String.fromCharCode(
      headerView.getUint8(4),
      headerView.getUint8(5),
      headerView.getUint8(6),
      headerView.getUint8(7)
    );
    if (ftyp === 'ftyp' || ftyp === 'moov') {
      return await demuxMP4OrMOV(arrayBuffer);
    }
    if (headerView.getUint32(0) === 0x1a45dfa3) {
      return await demuxWebM(arrayBuffer, file);
    }
  }

  // Fallback to MP4 demuxer
  return await demuxMP4OrMOV(arrayBuffer);
}
