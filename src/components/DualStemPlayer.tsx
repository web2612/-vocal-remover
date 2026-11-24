import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Download, Volume2, VolumeX, Mic, Music, CheckCircle2, Film } from 'lucide-react';
import type { PipelineOutputs } from '../lib/audio/audioPipeline';

interface DualStemPlayerProps {
  outputs: PipelineOutputs;
  onReset: () => void;
}

export const DualStemPlayer: React.FC<DualStemPlayerProps> = ({ outputs, onReset }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(outputs.duration || 0);
  const [expired, setExpired] = useState(false);

  // Volume states (0 to 1)
  const [vocalVolume, setVocalVolume] = useState(1.0);
  const [instrumentalVolume, setInstrumentalVolume] = useState(1.0);

  // Solo states
  const [isVocalSolo, setIsVocalSolo] = useState(false);
  const [isInstrumentalSolo, setIsInstrumentalSolo] = useState(false);

  // Audio & Video refs
  const vocalAudioRef = useRef<HTMLAudioElement | null>(null);
  const instrumentalAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!outputs.expiresAt) return;
    const expire = () => {
      vocalAudioRef.current?.pause();
      instrumentalAudioRef.current?.pause();
      setIsPlaying(false);
      setExpired(true);
    };
    const timer = window.setTimeout(expire, Math.max(0, outputs.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [outputs.expiresAt]);

  // Sync duration once metadata loads
  const handleLoadedMetadata = () => {
    if (vocalAudioRef.current && vocalAudioRef.current.duration) {
      setDuration(vocalAudioRef.current.duration);
    }
  };

  // Synchronized Play/Pause
  const togglePlay = () => {
    if (!vocalAudioRef.current || !instrumentalAudioRef.current) return;

    if (isPlaying) {
      vocalAudioRef.current.pause();
      instrumentalAudioRef.current.pause();
      if (videoRef.current) videoRef.current.pause();
      setIsPlaying(false);
    } else {
      // Synchronize playheads
      const syncTime = vocalAudioRef.current.currentTime;
      instrumentalAudioRef.current.currentTime = syncTime;
      if (videoRef.current) videoRef.current.currentTime = syncTime;

      vocalAudioRef.current.play().catch(console.error);
      instrumentalAudioRef.current.play().catch(console.error);
      if (videoRef.current) videoRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  // Scrubbing
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);

    if (vocalAudioRef.current) vocalAudioRef.current.currentTime = targetTime;
    if (instrumentalAudioRef.current) instrumentalAudioRef.current.currentTime = targetTime;
    if (videoRef.current) videoRef.current.currentTime = targetTime;
  };

  // Time update listener
  const handleTimeUpdate = () => {
    if (vocalAudioRef.current) {
      setCurrentTime(vocalAudioRef.current.currentTime);
      if (vocalAudioRef.current.ended) {
        setIsPlaying(false);
      }
    }
  };

  // Update volumes based on sliders & solo toggles
  useEffect(() => {
    if (!vocalAudioRef.current || !instrumentalAudioRef.current) return;

    if (isVocalSolo) {
      vocalAudioRef.current.volume = vocalVolume;
      instrumentalAudioRef.current.volume = 0;
    } else if (isInstrumentalSolo) {
      vocalAudioRef.current.volume = 0;
      instrumentalAudioRef.current.volume = instrumentalVolume;
    } else {
      vocalAudioRef.current.volume = vocalVolume;
      instrumentalAudioRef.current.volume = instrumentalVolume;
    }
  }, [vocalVolume, instrumentalVolume, isVocalSolo, isInstrumentalSolo]);

  // Handle Solo Vocals
  const toggleSoloVocals = () => {
    if (isVocalSolo) {
      setIsVocalSolo(false);
    } else {
      setIsVocalSolo(true);
      setIsInstrumentalSolo(false);
    }
  };

  // Handle Solo Instrumental
  const toggleSoloInstrumental = () => {
    if (isInstrumentalSolo) {
      setIsInstrumentalSolo(false);
    } else {
      setIsInstrumentalSolo(true);
      setIsVocalSolo(false);
    }
  };

  // Animated visualizer waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || expired) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const animate = isPlaying && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Draw subtle background bars
      const numBars = 64;
      const barWidth = width / numBars - 2;

      for (let i = 0; i < numBars; i++) {
        const x = i * (barWidth + 2);
        const progressRatio = currentTime / (duration || 1);
        const isPast = i / numBars <= progressRatio;

        let barHeight = 8 + Math.sin(i * 0.2 + phase) * 12;
        if (isPlaying) {
          barHeight = 12 + Math.abs(Math.sin(i * 0.3 + phase * 2)) * 32;
        }

        // Color gradient
        if (isPast) {
          ctx.fillStyle = isVocalSolo ? '#c084fc' : isInstrumentalSolo ? '#38bdf8' : '#818cf8';
        } else {
          ctx.fillStyle = '#1e293b';
        }

        ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
      }

      if (animate) {
        phase += 0.08;
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, duration, isVocalSolo, isInstrumentalSolo, expired]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Download Trigger
  const triggerDownload = (url: string, suffix: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${outputs.fileName}_${suffix}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (expired) return (
    <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 text-slate-900">
      <p role="status">Your temporary cloud files have expired.</p>
      <button type="button" onClick={onReset} className="mt-3 min-h-11 rounded-lg bg-indigo-700 px-4 text-white">
        Process another file
      </button>
    </div>
  );

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      
      {/* Hidden Synchronized HTML5 Audio Elements */}
      <audio
        ref={vocalAudioRef}
        src={outputs.vocalsUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
      <audio
        ref={instrumentalAudioRef}
        src={outputs.instrumentalUrl}
        preload="metadata"
      />

      {/* Main Console Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-6 text-slate-900">
        
        {/* Top Bar with Title & Reset */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                Separated Stems Ready
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs sm:max-w-md">
              {outputs.fileName} {outputs.processingMode !== 'full' ? `(${outputs.processingMode.replace('preview-', '')} sample)` : ''}
            </p>
          </div>

          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Process Another</span>
          </button>
        </div>

        {/* Video Preview if media was Video */}
        {(outputs as any).videoUrl && (
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-black aspect-video max-h-72 mx-auto relative group">
            <video
              ref={videoRef}
              src={(outputs as any).videoUrl}
              muted={true}
              playsInline={true}
              className="w-full h-full object-contain mx-auto"
            />
            <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-[11px] font-semibold text-sky-400 flex items-center gap-1.5">
              <Film className="w-3 h-3" />
              <span>Synchronized Video Preview (Audio driven by isolated stems below)</span>
            </div>
          </div>
        )}

        {/* Dynamic Waveform Canvas Visualizer */}
        <div className="relative rounded-2xl bg-slate-950 p-4 border border-slate-800 overflow-hidden shadow-inner">
          <canvas
            ref={canvasRef}
            width={600}
            height={60}
            className="w-full h-15 block"
          />

          {/* Scrubbable Seek Range */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-transparent cursor-pointer accent-indigo-400 mt-3"
            aria-label="Audio scrubber"
          />

          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Central Master Transport Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25 transition transform active:scale-95 cursor-pointer"
            aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-white" />
            ) : (
              <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-white ml-0.5" />
            )}
          </button>
        </div>

        {/* Dual Stems Control Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Stem 1: Vocals / Voice Track */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition ${
            isVocalSolo
              ? 'bg-purple-50/80 border-purple-400 shadow-md ring-2 ring-purple-400/20'
              : 'bg-purple-50/30 border-purple-100 hover:border-purple-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {(outputs as any).mediaType === 'video' ? 'Voice / Dialogue' : 'Vocal Stem'}
                  </h4>
                  <span className="text-[10px] text-purple-700 font-semibold">Isolated Speech & Singing</span>
                </div>
              </div>

              <button
                onClick={toggleSoloVocals}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                  isVocalSolo
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Solo
              </button>
            </div>

            {/* Volume Slider */}
            <div className="space-y-1 my-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  {vocalVolume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-purple-600" />}
                  Volume
                </span>
                <span className="font-mono font-semibold">{Math.round(vocalVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={vocalVolume}
                onChange={(e) => setVocalVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                aria-label="Vocal volume"
              />
            </div>

            {/* Download Button */}
            <button
              onClick={() => triggerDownload(outputs.vocalsUrl, 'vocals')}
              className="w-full mt-3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Vocals (.wav)</span>
            </button>
          </div>

          {/* Stem 2: Instrumental / Background Track */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition ${
            isInstrumentalSolo
              ? 'bg-sky-50/80 border-sky-400 shadow-md ring-2 ring-sky-400/20'
              : 'bg-sky-50/30 border-sky-100 hover:border-sky-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700">
                  <Music className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {(outputs as any).mediaType === 'video' ? 'Background Audio' : 'Instrumental Stem'}
                  </h4>
                  <span className="text-[10px] text-sky-700 font-semibold">Backing Track & Music</span>
                </div>
              </div>

              <button
                onClick={toggleSoloInstrumental}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                  isInstrumentalSolo
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Solo
              </button>
            </div>

            {/* Volume Slider */}
            <div className="space-y-1 my-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  {instrumentalVolume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-sky-600" />}
                  Volume
                </span>
                <span className="font-mono font-semibold">{Math.round(instrumentalVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={instrumentalVolume}
                onChange={(e) => setInstrumentalVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                aria-label="Instrumental volume"
              />
            </div>

            {/* Download Button */}
            <button
              onClick={() => triggerDownload(outputs.instrumentalUrl, 'instrumental')}
              className="w-full mt-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Music (.wav)</span>
            </button>
          </div>

        </div>

        {/* Master Lossless Export Notice */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Master 16-bit 44.1 kHz linear PCM stereo WAV files encoded directly in-browser.</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            DAW Compatible
          </span>
        </div>

      </div>
    </div>
  );
};
