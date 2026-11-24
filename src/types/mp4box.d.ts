declare module 'mp4box' {
  export interface MP4AudioTrack {
    id: number;
    name: string;
    codec: string;
    bitrate: number;
    duration: number;
    timescale: number;
    audio: {
      sample_rate: number;
      channel_count: number;
      sample_size: number;
    };
  }

  export interface MP4VideoTrack {
    id: number;
    name: string;
    codec: string;
    bitrate: number;
    duration: number;
    timescale: number;
    video: {
      width: number;
      height: number;
    };
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    isFragmented: boolean;
    tracks: Array<MP4AudioTrack | MP4VideoTrack>;
    audioTracks: MP4AudioTrack[];
    videoTracks: MP4VideoTrack[];
  }

  export interface MP4Sample {
    track_id: number;
    data: Uint8Array;
    size: number;
    cts: number;
    dts: number;
    duration: number;
    is_sync: boolean;
    timescale: number;
  }

  export interface ISOFile {
    onReady?: (info: MP4Info) => void;
    onError?: (err: any) => void;
    onSamples?: (trackId: number, ref: any, samples: MP4Sample[]) => void;
    appendBuffer(data: ArrayBuffer & { fileStart?: number }): number;
    start(): void;
    stop(): void;
    flush(): void;
    setExtractionOptions(trackId: number, ref?: any, options?: { nbSamples?: number }): void;
    getTrackById(trackId: number): any;
  }

  export function createFile(): ISOFile;
  export class DataStream {
    constructor(buffer?: ArrayBuffer, byteOffset?: number, endianness?: boolean);
  }
}
