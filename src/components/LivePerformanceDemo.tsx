import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Upload, Sparkles, Mic, Music } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface LivePerformanceDemoProps {
  onScrollToUploader?: () => void;
  className?: string;
}

export const LivePerformanceDemo: React.FC<LivePerformanceDemoProps> = ({
  onScrollToUploader,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const vocalAudioRef = useRef<HTMLAudioElement>(null);
  const instAudioRef = useRef<HTMLAudioElement>(null);
  const started = useRef(false);
  const pending = useRef(false);
  const [playError, setPlayError] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(25);
  const [vocalVolume, setVocalVolume] = useState(0.85); // 85% default matching Image 3
  const [instVolume, setInstVolume] = useState(1.0);    // 100% default matching Image 3

  // Sync audio volumes
  useEffect(() => {
    if (vocalAudioRef.current) {
      vocalAudioRef.current.volume = vocalVolume;
    }
  }, [vocalVolume]);

  useEffect(() => {
    if (instAudioRef.current) {
      instAudioRef.current.volume = instVolume;
    }
  }, [instVolume]);

  // Synchronized Play/Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    const vocal = vocalAudioRef.current;
    const inst = instAudioRef.current;

    if (!video || !vocal || !inst || pending.current) return;

    if (isPlaying) {
      video.pause();
      vocal.pause();
      inst.pause();
      setIsPlaying(false);
    } else {
      // Ensure sync before playing
      if (!started.current) {
        video.src = '/demo-performance.mp4';
        vocal.src = '/demo-vocals.mp3';
        inst.src = '/demo-instrumental.mp3';
        started.current = true;
      } else {
        vocal.currentTime = video.currentTime;
        inst.currentTime = video.currentTime;
      }
      pending.current = true;
      setPlayError(false);

      Promise.all([
        video.play(),
        vocal.play(),
        inst.play()
      ]).then(() => {
        setIsPlaying(true);
      }).catch(() => {
        for (const element of [video, vocal, inst]) {
          element.pause();
          element.removeAttribute('src');
          element.load();
        }
        started.current = false;
        setPlayError(true);
      }).finally(() => { pending.current = false; });
    }
  }, [isPlaying]);

  // Handle video time updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);

      // Periodically correct any micro-drift between video and audio
      if (vocalAudioRef.current && Math.abs(vocalAudioRef.current.currentTime - cur) > 0.08) {
        vocalAudioRef.current.currentTime = cur;
      }
      if (instAudioRef.current && Math.abs(instAudioRef.current.currentTime - cur) > 0.08) {
        instAudioRef.current.currentTime = cur;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 25);
    }
  };

  // Seek bar scrubber
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!started.current) return;
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (videoRef.current) videoRef.current.currentTime = seekTime;
    if (vocalAudioRef.current) vocalAudioRef.current.currentTime = seekTime;
    if (instAudioRef.current) instAudioRef.current.currentTime = seekTime;
  };

  // Replay
  const handleReplay = () => {
    if (!started.current) return;
    if (videoRef.current) videoRef.current.currentTime = 0;
    if (vocalAudioRef.current) vocalAudioRef.current.currentTime = 0;
    if (instAudioRef.current) instAudioRef.current.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      togglePlay();
    }
  };

  // When video ends
  const handleEnded = () => {
    setIsPlaying(false);
    if (videoRef.current) videoRef.current.currentTime = 0;
    if (vocalAudioRef.current) vocalAudioRef.current.currentTime = 0;
    if (instAudioRef.current) instAudioRef.current.currentTime = 0;
    setCurrentTime(0);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleScrollUp = () => {
    if (onScrollToUploader) {
      onScrollToUploader();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <section className={`py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-white text-slate-900 border-t border-slate-100 ${className}`}>
      
      {/* Hidden Synchronized Dual-Stem Audio Elements */}
      <audio ref={vocalAudioRef} preload="none" />
      <audio ref={instAudioRef} preload="none" />

      <div className="max-w-4xl mx-auto text-center space-y-4">
        
        {/* Header Pill Matching Image 3 */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Hear the Difference</span>
        </div>

        {/* Section Title Matching Image 3 */}
        <h2 className="text-2xl sm:text-4xl lg:text-[42px] font-black text-slate-900 tracking-tight leading-tight">
          What Does AI Vocal Removal{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500">
            Sound Like?
          </span>
        </h2>

        {/* Subtitle Matching Image 3 */}
        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Our AI separates a full audio mix into two clean tracks — an isolated vocal and a clean instrumental — with over 95% accuracy. Play the clip below and mix the two tracks yourself to hear the difference.
        </p>

        {/* Video Card Player Container Matching Image 3 */}
        <div className="mt-8 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden relative group max-w-3xl mx-auto">
          
          {/* Top-Left Watermark Logo (Matching Competitor's Corner Badge) */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 shadow-lg pointer-events-none">
            <BrandLogo size="sm" />
          </div>

          {/* Video Element */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              poster="/demo-poster.jpg"
              preload="none"
              playsInline
              muted // Muted because we control audio stems via synchronized dual audio tracks!
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onClick={() => { if (started.current) togglePlay(); }}
              className="w-full h-full object-cover cursor-pointer"
            />

            {/* Central Big Play Button Overlay (Matching Image 3) */}
            {!isPlaying && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playError ? 'Retry demo playback' : 'Play demo performance'}
                className="absolute inset-0 m-auto w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-cyan-500/90 hover:bg-cyan-400 text-slate-950 shadow-2xl shadow-cyan-500/50 flex items-center justify-center transition-all transform hover:scale-110 cursor-pointer z-10 group-hover:scale-105"
              >
                <Play className="w-9 h-9 sm:w-11 sm:h-11 fill-current ml-1" />
              </button>
            )}

            {playError && <p role="alert" className="absolute top-16 inset-x-0 text-center text-sm text-white">The demo couldn’t start. Press Play to retry.</p>}
            {/* Bottom Scrubber Overlay */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent p-4 sm:p-5 pt-8 z-10 space-y-3">
              
              {/* Timeline Track & Play/Pause/Replay */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={handleReplay}
                  className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
                  title="Replay from start"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Progress bar */}
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-grow h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  aria-label="Seek time"
                />

                <span className="text-xs font-mono font-semibold text-slate-300 min-w-[70px] text-right">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Dual Faders Row Matching Image 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                
                {/* Vocals Fader */}
                <div className="p-3 rounded-2xl bg-slate-900/90 border border-purple-500/30 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300 min-w-[70px]">
                    <Mic className="w-4 h-4 text-purple-400" />
                    <span>Vocals</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={vocalVolume}
                    onChange={(e) => setVocalVolume(parseFloat(e.target.value))}
                    className="flex-grow h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    aria-label="Vocals volume fader"
                  />
                  <span className="text-xs font-mono font-bold text-purple-300 min-w-[36px] text-right">
                    {Math.round(vocalVolume * 100)}%
                  </span>
                </div>

                {/* Music / Instrumental Fader */}
                <div className="p-3 rounded-2xl bg-slate-900/90 border border-cyan-500/30 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 min-w-[70px]">
                    <Music className="w-4 h-4 text-cyan-400" />
                    <span>Music</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={instVolume}
                    onChange={(e) => setInstVolume(parseFloat(e.target.value))}
                    className="flex-grow h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    aria-label="Music volume fader"
                  />
                  <span className="text-xs font-mono font-bold text-cyan-300 min-w-[36px] text-right">
                    {Math.round(instVolume * 100)}%
                  </span>
                </div>

              </div>

            </div>

          </div>

        </div>

        {/* Caption Below Video Matching Image 3 */}
        <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto pt-2">
          Already separated by our AI — raise the Vocals fader to hear the isolated voice, or drop it to keep the instrumental.
        </p>

        {/* CTA Button Matching Image 3 */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleScrollUp}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm sm:text-base tracking-wide shadow-xl shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Try It Free — No Signup</span>
          </button>
        </div>

      </div>

    </section>
  );
};
