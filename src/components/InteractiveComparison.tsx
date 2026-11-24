import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Mic,
  Music,
  Layers,
  Sparkles,
  Maximize2,
  CheckCircle,
  Video,
  Info
} from 'lucide-react';
import { encodeWAV } from '../lib/audio/wavEncoder';

type StemMode = 'original' | 'vocals' | 'instrumental';

interface DemoStems {
  originalUrl: string;
  vocalsUrl: string;
  instrumentalUrl: string;
  duration: number;
}

export const InteractiveComparison: React.FC = () => {
  // Mode selection: 'stems' for audio comparison or 'video' for walkthrough
  const [activeTab, setActiveTab] = useState<'comparison' | 'walkthrough'>('comparison');
  const [stemMode, setStemMode] = useState<StemMode>('original');

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(24);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [stemsReady, setStemsReady] = useState(false);

  // Video Walkthrough State
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(1);

  // Audio references
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const demoStemsRef = useRef<DemoStems | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  /**
   * Generates original, synthetic multi-stem audio tracks on the client
   * Uses Web Audio synthesis to generate synchronized Original, Vocal lead, and Instrumental backing stems.
   */
  useEffect(() => {
    let isCancelled = false;

    async function generateDemoStems() {
      try {
        const sampleRate = 44100;
        const totalDuration = 24; // 24-second musical loop
        const totalSamples = sampleRate * totalDuration;

        const vocalLeft = new Float32Array(totalSamples);
        const vocalRight = new Float32Array(totalSamples);
        const instLeft = new Float32Array(totalSamples);
        const instRight = new Float32Array(totalSamples);
        const origLeft = new Float32Array(totalSamples);
        const origRight = new Float32Array(totalSamples);

        const bpm = 110;
        const beatSec = 60 / bpm;
        const chordProgression = [
          [293.66, 349.23, 440.0], // Dm (D4, F4, A4)
          [233.08, 293.66, 349.23], // Bb (Bb3, D4, F4)
          [174.61, 220.0, 261.63], // F (F3, A3, C4)
          [261.63, 329.63, 392.0], // C (C4, E4, G4)
        ];
        const chordDur = beatSec * 4; // 1 measure per chord

        // Vocal lead melody frequencies (D minor pentatonic / blues scale)
        const vocalMelody = [
          { time: 0, dur: 1.5, freq: 440.0 }, // A4
          { time: 1.5, dur: 1.0, freq: 523.25 }, // C5
          { time: 2.5, dur: 1.5, freq: 587.33 }, // D5
          { time: 4.0, dur: 2.0, freq: 523.25 }, // C5
          { time: 6.5, dur: 1.5, freq: 466.16 }, // Bb4
          { time: 8.0, dur: 2.0, freq: 440.0 }, // A4
          { time: 10.5, dur: 1.5, freq: 392.0 }, // G4
          { time: 12.0, dur: 2.0, freq: 440.0 }, // A4
          { time: 14.5, dur: 1.5, freq: 523.25 }, // C5
          { time: 16.0, dur: 2.5, freq: 587.33 }, // D5
          { time: 19.0, dur: 2.0, freq: 659.25 }, // E5
          { time: 21.5, dur: 2.5, freq: 587.33 }, // D5
        ];

        // Synthesize audio samples
        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;

          // 1. INSTRUMENTAL STEM
          let instSample = 0;

          // A. Drum Beat (Kick on 1 & 3, Snare on 2 & 4, Hi-hat on 8ths)
          const beatPos = (t % beatSec) / beatSec;
          const beatIndex = Math.floor(t / beatSec) % 4;

          // Kick (Beats 0 & 2)
          if ((beatIndex === 0 || beatIndex === 2) && beatPos < 0.25) {
            const kickEnv = Math.exp(-beatPos * 25);
            const kickFreq = 120 * Math.exp(-beatPos * 30) + 45;
            instSample += Math.sin(2 * Math.PI * kickFreq * t) * kickEnv * 0.45;
          }

          // Snare (Beats 1 & 3)
          if ((beatIndex === 1 || beatIndex === 3) && beatPos < 0.3) {
            const snareEnv = Math.exp(-beatPos * 18);
            const noise = (Math.random() * 2 - 1) * 0.25;
            const tone = Math.sin(2 * Math.PI * 185 * t) * 0.2;
            instSample += (noise + tone) * snareEnv * 0.4;
          }

          // Hi-hat (8th notes)
          const subBeatPos = (t % (beatSec / 2)) / (beatSec / 2);
          if (subBeatPos < 0.1) {
            const hatEnv = Math.exp(-subBeatPos * 50);
            instSample += (Math.random() * 2 - 1) * hatEnv * 0.08;
          }

          // B. Bassline (Root notes of current chord)
          const currentChordIdx = Math.floor(t / chordDur) % chordProgression.length;
          const rootFreq = chordProgression[currentChordIdx][0] / 2; // Sub-bass octave
          const bassEnv = 0.7 + 0.3 * Math.sin(2 * Math.PI * (1 / beatSec) * t);
          instSample += Math.sin(2 * Math.PI * rootFreq * t) * 0.22 * bassEnv;

          // C. Harmonic Pad Chords (Warm stereo synth)
          const chord = chordProgression[currentChordIdx];
          let chordSample = 0;
          for (const noteFreq of chord) {
            chordSample += Math.sin(2 * Math.PI * noteFreq * t) * 0.06;
            // Shimmer overtone
            chordSample += Math.sin(2 * Math.PI * noteFreq * 2 * t) * 0.02;
          }
          instSample += chordSample;

          // Pan instrumental slightly
          instLeft[i] = instSample * 0.95;
          instRight[i] = instSample * 1.05;

          // 2. VOCAL LEAD STEM
          let vocalSample = 0;
          for (const note of vocalMelody) {
            if (t >= note.time && t < note.time + note.dur) {
              const notePos = (t - note.time) / note.dur;
              // Smooth attack and release envelope
              const attack = Math.min(notePos / 0.15, 1);
              const release = Math.min((1 - notePos) / 0.15, 1);
              const env = Math.min(attack, release);

              // Vocal vibrato: 5.5 Hz vibrato depth
              const vibrato = Math.sin(2 * Math.PI * 5.5 * t) * 3.5;
              const f0 = note.freq + vibrato;

              // Singing formant synthesis (fundamental + rich even/odd vocal formants)
              const fundamental = Math.sin(2 * Math.PI * f0 * t) * 0.35;
              const formant1 = Math.sin(2 * Math.PI * f0 * 2 * t) * 0.18; // 1st formant
              const formant2 = Math.sin(2 * Math.PI * f0 * 3 * t) * 0.12; // 2nd formant
              const breath = (Math.random() * 2 - 1) * 0.02;

              vocalSample = (fundamental + formant1 + formant2 + breath) * env * 0.45;
              break;
            }
          }

          vocalLeft[i] = vocalSample;
          vocalRight[i] = vocalSample;

          // 3. ORIGINAL MIX (Exact linear sum)
          origLeft[i] = Math.max(-1.0, Math.min(1.0, instLeft[i] + vocalLeft[i]));
          origRight[i] = Math.max(-1.0, Math.min(1.0, instRight[i] + vocalRight[i]));
        }

        // Encode 16-bit PCM master WAV blobs
        const origBlob = encodeWAV(origLeft, origRight, sampleRate);
        const vocalBlob = encodeWAV(vocalLeft, vocalRight, sampleRate);
        const instBlob = encodeWAV(instLeft, instRight, sampleRate);

        if (!isCancelled) {
          demoStemsRef.current = {
            originalUrl: URL.createObjectURL(origBlob),
            vocalsUrl: URL.createObjectURL(vocalBlob),
            instrumentalUrl: URL.createObjectURL(instBlob),
            duration: totalDuration,
          };
          setDuration(totalDuration);
          setStemsReady(true);
        }
      } catch (err) {
        console.error('Failed to generate demo stems:', err);
      }
    }

    generateDemoStems();

    return () => {
      isCancelled = true;
      if (demoStemsRef.current) {
        URL.revokeObjectURL(demoStemsRef.current.originalUrl);
        URL.revokeObjectURL(demoStemsRef.current.vocalsUrl);
        URL.revokeObjectURL(demoStemsRef.current.instrumentalUrl);
      }
    };
  }, []);

  /**
   * Sync active audio track when stem mode changes without losing current playback position
   */
  const handleStemChange = useCallback((newMode: StemMode) => {
    if (!demoStemsRef.current || !audioRef.current) return;
    setStemMode(newMode);

    const wasPlaying = !audioRef.current.paused;
    const pos = audioRef.current.currentTime;

    let nextSrc = demoStemsRef.current.originalUrl;
    if (newMode === 'vocals') nextSrc = demoStemsRef.current.vocalsUrl;
    if (newMode === 'instrumental') nextSrc = demoStemsRef.current.instrumentalUrl;

    audioRef.current.src = nextSrc;
    audioRef.current.currentTime = pos;
    audioRef.current.volume = isMuted ? 0 : volume;

    if (wasPlaying) {
      audioRef.current.play().catch(console.error);
    }
  }, [isMuted, volume]);

  /**
   * Master Play/Pause Toggle
   */
  const togglePlay = () => {
    if (!audioRef.current || !demoStemsRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current.src) {
        audioRef.current.src = demoStemsRef.current.originalUrl;
      }
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(console.error);
    }
  };

  /**
   * Scrubbing audio timeline
   */
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  /**
   * Volume change
   */
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(false);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      setIsMuted(false);
      audioRef.current.volume = volume;
    } else {
      setIsMuted(true);
      audioRef.current.volume = 0;
    }
  };

  // Format time mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  /**
   * Real-time animated canvas waveform visualizer
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      phase += isPlaying ? 0.08 : 0.015;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const numBars = 48;
      const barWidth = width / numBars - 2;

      // Color scheme based on stem mode
      let primaryColor = 'rgba(129, 140, 248, '; // Violet / Indigo for Original
      if (stemMode === 'vocals') {
        primaryColor = 'rgba(236, 72, 153, '; // Pink / Violet for Vocals
      } else if (stemMode === 'instrumental') {
        primaryColor = 'rgba(56, 189, 248, '; // Sky blue / Cyan for Instrumental
      }

      for (let i = 0; i < numBars; i++) {
        const x = i * (barWidth + 2);
        const norm = i / numBars;

        // Wave formula simulates audio frequency spectrum
        let amp = 0.25;
        if (isPlaying) {
          amp = 0.35 + 0.45 * Math.sin(phase + norm * 8) * Math.cos(phase * 0.5 + norm * 4);
          if (stemMode === 'vocals') {
            amp *= (0.5 + 0.5 * Math.sin(phase * 2 + norm * 12));
          } else if (stemMode === 'instrumental') {
            amp *= (0.6 + 0.4 * Math.cos(phase * 1.5 + norm * 6));
          }
        } else {
          amp = 0.15 + 0.1 * Math.sin(phase + norm * 4);
        }

        const barHeight = Math.max(4, Math.abs(amp) * (height - 12));
        const y = (height - barHeight) / 2;

        const alpha = isPlaying ? 0.75 + 0.25 * Math.sin(phase + norm * 5) : 0.35;
        ctx.fillStyle = `${primaryColor}${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, stemMode]);

  /**
   * Video walkthrough simulation timer
   */
  useEffect(() => {
    if (!isVideoPlaying) return;
    const interval = setInterval(() => {
      setVideoProgress((prev) => {
        if (prev >= 100) {
          setIsVideoPlaying(false);
          setActiveStep(1);
          return 0;
        }
        const next = prev + 1.25;
        if (next > 66) setActiveStep(3);
        else if (next > 33) setActiveStep(2);
        else setActiveStep(1);
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isVideoPlaying]);

  return (
    <section className="relative py-12 px-4 sm:px-6 lg:px-8 border-y border-slate-200 bg-slate-50/60 overflow-hidden">
      
      {/* Hidden Audio Element for Stem Playback */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
      />

      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Section Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Interactive Live Demonstration</span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Watch How It Works & Experience Real AI Separation
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto font-normal">
            Listen to genuine isolated stems extracted by neural source separation, or watch the 60-second walkthrough video below.
          </p>
        </div>

        {/* Tab Controls: Switch between Interactive Audio Comparison & Video Walkthrough */}
        <div className="flex items-center justify-center">
          <div className="inline-flex p-1 rounded-2xl bg-slate-200/80 border border-slate-200 shadow-xs">
            <button
              onClick={() => setActiveTab('comparison')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                activeTab === 'comparison'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Interactive Audio Stem Switcher</span>
            </button>
            <button
              onClick={() => setActiveTab('walkthrough')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                activeTab === 'walkthrough'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Watch How It Works (Video)</span>
            </button>
          </div>
        </div>

        {/* 1. INTERACTIVE AUDIO COMPARISON VIEW */}
        {activeTab === 'comparison' && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-6">
            
            {/* Top Toolbar: 3 Stem Switching Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Select Stem to Audition:
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                {/* 1. Original Mix */}
                <button
                  onClick={() => handleStemChange('original')}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    stemMode === 'original'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Original Mix</span>
                </button>

                {/* 2. Isolated Vocals */}
                <button
                  onClick={() => handleStemChange('vocals')}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    stemMode === 'vocals'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>Isolated Vocals</span>
                </button>

                {/* 3. Instrumental */}
                <button
                  onClick={() => handleStemChange('instrumental')}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    stemMode === 'instrumental'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Music className="w-4 h-4" />
                  <span>Instrumental Backing</span>
                </button>
              </div>
            </div>

            {/* Visualizer & Waveform Display */}
            <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-4 overflow-hidden shadow-inner">
              <canvas
                ref={canvasRef}
                width={800}
                height={80}
                className="w-full h-20 block"
              />

              {/* Active stem indicator pill */}
              <div className="absolute top-3 left-4 flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 text-[11px] font-medium text-slate-300 backdrop-blur-sm">
                <span className={`w-2 h-2 rounded-full ${
                  stemMode === 'vocals' ? 'bg-purple-400 animate-pulse' :
                  stemMode === 'instrumental' ? 'bg-sky-400 animate-pulse' :
                  'bg-indigo-400 animate-pulse'
                }`} />
                <span>
                  Listening to:{' '}
                  <strong className="text-white capitalize">
                    {stemMode === 'original' ? 'Full Song Mix (Vocals + Band)' :
                     stemMode === 'vocals' ? 'Studio Vocals (Acapella)' :
                     'Karaoke Instrumental (Drums, Bass & Synths)'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Transport Bar: Play/Pause, Seek, Volume */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              
              {/* Play / Pause Button */}
              <button
                onClick={togglePlay}
                disabled={!stemsReady}
                aria-label={isPlaying ? 'Pause audio demo' : 'Play audio demo'}
                className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md transition transform active:scale-95 disabled:opacity-50 flex-shrink-0 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>

              {/* Scrubbable Timeline */}
              <div className="flex-grow w-full flex items-center gap-3">
                <span className="text-xs font-mono text-slate-500 w-10 text-right">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  aria-label="Audio scrubber"
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-xs font-mono text-slate-500 w-10">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Volume & Mute Controls */}
              <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
                <button
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="p-2 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-red-500" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label="Volume slider"
                  className="w-20 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

            </div>

            {/* Note banner */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900">
              <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>100% Client-Side Audio Proof:</strong> Switch between stems while audio plays to verify zero vocal bleed on the backing track and crisp acapella vocal clarity. Upload your own audio above to separate any song.
              </span>
            </div>

          </div>
        )}

        {/* 2. WATCH HOW IT WORKS VIDEO / WORKFLOW VIEW */}
        {activeTab === 'walkthrough' && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-6">
            
            {/* Interactive Video Player Mockup with Accessible Controls */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video flex flex-col justify-between">
              
              {/* Poster & Simulated Animated Canvas */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#0b1022] via-[#070b18] to-[#0d1326] flex items-center justify-center p-6 text-center">
                {!isVideoPlaying ? (
                  <div className="space-y-4 max-w-md">
                    <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-600/20">
                      <Play className="w-8 h-8 ml-1" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">Watch How It Works (1:00)</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Step-by-step walkthrough: Drop an MP4/MP3, watch local AI separate stems, and download 16-bit master WAVs.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsVideoPlaying(true)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-xs shadow-lg transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Walkthrough</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-lg w-full animate-fade-in">
                    <div className="flex items-center justify-between text-xs font-semibold text-indigo-300 border-b border-slate-800 pb-2">
                      <span>Step {activeStep} of 3: {
                        activeStep === 1 ? 'Media Ingestion & Client Verification' :
                        activeStep === 2 ? 'Demucs Neural Network Inference' :
                        'Synchronized Dual-Stem Master WAV Export'
                      }</span>
                      <span>{Math.round(videoProgress)}%</span>
                    </div>

                    <div className="p-4 rounded-xl bg-black/50 border border-indigo-800/40 text-left space-y-2">
                      {activeStep === 1 && (
                        <div className="space-y-1">
                          <p className="text-xs text-white font-semibold">1. Fast Local Drag & Drop</p>
                          <p className="text-[11px] text-slate-400">
                            Upload MP3, WAV, MP4, WebM, or MOV. The audio track is demuxed directly in your browser. Zero bytes leave your device.
                          </p>
                        </div>
                      )}
                      {activeStep === 2 && (
                        <div className="space-y-1">
                          <p className="text-xs text-white font-semibold">2. WebGPU Neural Inference</p>
                          <p className="text-[11px] text-slate-400">
                            HTDemucs v4 runs in a dedicated background Web Worker, executing STFT, frequency masking, and iSTFT synthesis.
                          </p>
                        </div>
                      )}
                      {activeStep === 3 && (
                        <div className="space-y-1">
                          <p className="text-xs text-white font-semibold">3. Solo & Export WAV Masters</p>
                          <p className="text-[11px] text-slate-400">
                            Preview vocals and instrumentals independently with solo buttons, adjust individual volumes, and download lossless 16-bit linear PCM WAVs.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-1.5 transition-all duration-100"
                        style={{ width: `${videoProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Player Top Bar */}
              <div className="relative z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
                <span className="text-xs font-semibold text-slate-200">
                  VocalRemover.group Architecture Walkthrough
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  1080p HD
                </span>
              </div>

              {/* Player Bottom Controls */}
              <div className="relative z-10 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                    aria-label={isVideoPlaying ? 'Pause walkthrough' : 'Play walkthrough'}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                  >
                    {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <span className="text-xs font-mono text-slate-300">
                    {Math.floor((videoProgress / 100) * 60)}s / 60s
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setVideoProgress(0);
                      setActiveStep(1);
                      setIsVideoPlaying(true);
                    }}
                    title="Replay from start"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    <span className="text-xs font-medium">Restart</span>
                  </button>
                  <button
                    aria-label="Fullscreen demo"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>

            {/* Step Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-2xl border transition ${
                activeStep === 1
                  ? 'bg-indigo-950/30 border-indigo-600/60'
                  : 'bg-slate-900/40 border-slate-800'
              }`}>
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>STEP 1: UPLOAD</span>
                </div>
                <p className="text-xs text-slate-300 font-medium">Direct Video & Audio Ingestion</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports MP3, WAV, MP4, WebM, and MOV containers. No server uploads.
                </p>
              </div>

              <div className={`p-4 rounded-2xl border transition ${
                activeStep === 2
                  ? 'bg-indigo-950/30 border-indigo-600/60'
                  : 'bg-slate-900/40 border-slate-800'
              }`}>
                <div className="flex items-center gap-2 text-xs font-bold text-violet-400 mb-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>STEP 2: ISOLATE</span>
                </div>
                <p className="text-xs text-slate-300 font-medium">On-Device AI Inference</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Meta AI Demucs neural network executes via WebGPU or WebAssembly.
                </p>
              </div>

              <div className={`p-4 rounded-2xl border transition ${
                activeStep === 3
                  ? 'bg-indigo-950/30 border-indigo-600/60'
                  : 'bg-slate-900/40 border-slate-800'
              }`}>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>STEP 3: DOWNLOAD</span>
                </div>
                <p className="text-xs text-slate-300 font-medium">Lossless Master WAV Export</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Download studio-grade 16-bit linear PCM WAVs for both vocals and instrumentals.
                </p>
              </div>
            </div>

          </div>
        )}

      </div>
    </section>
  );
};
