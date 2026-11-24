import React, { useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, Sparkles, Mic, Layers, Download } from 'lucide-react';

interface PromoVideoPlayerProps {
  className?: string;
}

export const PromoVideoPlayer: React.FC<PromoVideoPlayerProps> = ({ className = '' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef(0);
  const [playError, setPlayError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(20);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [activeSpeaker, setActiveSpeaker] = useState<number>(1);

  // Sync state with HTML5 video events
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    // Update active speaker highlight based on exact voiceover timestamps
    if (cur < 5.7) {
      setActiveSpeaker(1);
    } else if (cur < 11.8) {
      setActiveSpeaker(2);
    } else {
      setActiveSpeaker(3);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 20);
      videoRef.current.currentTime = pendingSeek.current;
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      const video = videoRef.current;
      if (!video.hasAttribute('src')) video.src = '/promo-20s.mp4';
      setPlayError(false);
      video.play().then(() => setIsPlaying(true)).catch(() => {
        video.removeAttribute('src');
        video.load();
        setPlayError(true);
      });
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
      setIsMuted(v === 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    pendingSeek.current = targetTime;
    setCurrentTime(targetTime);
    if (videoRef.current?.hasAttribute('src')) {
      videoRef.current.currentTime = targetTime;
    }
  };

  const handleReplay = () => {
    if (!videoRef.current?.hasAttribute('src')) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const jumpToSpeaker = (startTime: number, speakerIndex: number) => {
    if (!videoRef.current) return;
    pendingSeek.current = startTime;
    setCurrentTime(startTime);
    setActiveSpeaker(speakerIndex);
    if (!videoRef.current.hasAttribute('src')) return;
    videoRef.current.currentTime = startTime;
    if (!isPlaying) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <section className={`w-full max-w-4xl mx-auto px-4 py-8 ${className}`}>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Watch 20-Second AI Video Overview</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-[11px]">
                  3 Natural AI Voices
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Listen to three distinct AI narrators introduce the client-side source separation engine.
              </p>
            </div>
          </div>

          {/* Quick Voice Jump Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => jumpToSpeaker(0, 1)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                activeSpeaker === 1 && isPlaying
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Mic className="w-3 h-3" />
              <span>Voice 1: Christopher</span>
            </button>
            <button
              type="button"
              onClick={() => jumpToSpeaker(5.7, 2)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                activeSpeaker === 2 && isPlaying
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Voice 2: Guy</span>
            </button>
            <button
              type="button"
              onClick={() => jumpToSpeaker(11.8, 3)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                activeSpeaker === 3 && isPlaying
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Download className="w-3 h-3" />
              <span>Voice 3: Jenny</span>
            </button>
          </div>
        </div>

        {/* Video Screen Container */}
        <div className="relative aspect-video w-full bg-slate-950 group">
          <video
            ref={videoRef}
            poster="/promo-poster.jpg"
            preload="none"
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onClick={() => { if (videoRef.current?.hasAttribute('src')) togglePlay(); }}
            className="w-full h-full object-contain cursor-pointer"
          />

          {/* Big Center Play Overlay Button when paused */}
          {!isPlaying && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] transition cursor-pointer"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-indigo-600 shadow-xl flex items-center justify-center transition-transform transform group-hover:scale-105">
                <Play className="w-8 h-8 sm:w-10 sm:h-10 translate-x-0.5 fill-indigo-600 text-indigo-600" />
              </div>
            </div>
          )}

          {/* Live Speaker Overlay Indicator (Bottom Left of Video) */}
          {isPlaying && (
            <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {activeSpeaker === 1 && '🎙️ Speaking: Christopher (AI Overview)'}
                {activeSpeaker === 2 && '🎙️ Speaking: Guy (Browser Neural Engine)'}
                {activeSpeaker === 3 && '🎙️ Speaking: Jenny (Master WAV Export)'}
              </span>
            </div>
          )}
        </div>

        {/* Video Control Bar */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-100 flex flex-col gap-2.5">
          {/* Progress Scrubber */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-medium text-slate-500 w-10">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 20}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              aria-label="Video scrubber"
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <span className="text-xs font-mono font-medium text-slate-500 w-10 text-right">
              {formatTime(duration)}
            </span>
          </div>

          {/* Buttons and Volume */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause video' : playError ? 'Retry video playback' : 'Play video'}
                className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button
                type="button"
                onClick={handleReplay}
                aria-label="Replay from start"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                title="Replay from start"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Volume & Mute */}
              <div className="flex items-center gap-2 ml-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label="Volume slider"
                  className="w-16 sm:w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-xs font-semibold text-slate-500">
                "Remove Vocals. Keep the Music. Powered by AI."
              </span>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Fullscreen"
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
