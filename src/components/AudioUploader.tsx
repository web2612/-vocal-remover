import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileAudio,
  AlertCircle,
  CheckCircle2,
  Zap,
  Clock,
  Sparkles,
  ShieldCheck,
  Film
} from 'lucide-react';
import { AudioPipelineService, type ValidatedAudioFile, type ProcessingMode } from '../lib/audio/audioPipeline';
import { clearRecentFile, restoreRecentFile, storeRecentFile } from '../lib/audio/recentFile';

interface AudioUploaderProps {
  onStartProcessing: (file: ValidatedAudioFile, mode: ProcessingMode, cloud?: boolean) => void;
  selectedFile: ValidatedAudioFile | null;
  onFileChange: (file: ValidatedAudioFile | null) => void;
  isProcessing: boolean;
  pipelineService: AudioPipelineService;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onStartProcessing,
  selectedFile: validatedFile,
  onFileChange,
  isProcessing,
  pipelineService,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [cloudConsent, setCloudConsent] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ProcessingMode>('full');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selection = useRef(0);

  useEffect(() => {
    const revision = selection.current;
    let mounted = true;
    if (!validatedFile) void restoreRecentFile().then(file => {
      if (file && mounted && revision === selection.current) onFileChange(file);
    });
    return () => { mounted = false; };
  }, [validatedFile, onFileChange]);

  const handleFile = async (file: File) => {
    const revision = ++selection.current;
    setErrorMsg(null);
    setValidating(true);
    setCloudConsent(false);
    onFileChange(null);
    void clearRecentFile();
    try {
      const inspected = await pipelineService.validateAndInspectFile(file);
      if (revision !== selection.current) return;
      onFileChange(inspected);
      void storeRecentFile(inspected);
    } catch (err: any) {
      if (revision === selection.current) setErrorMsg(err?.message || 'Could not verify the audio file.');
    } finally {
      if (revision === selection.current) setValidating(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / 1_000_000).toFixed(2) + ' MB';
  };

  const supportedFormats = ['MP3', 'WAV'];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      
      {/* Upload Dropzone Card - Styled Exactly Matching Competitor Image 2 */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !validatedFile && fileInputRef.current?.click()}
        className={`relative rounded-3xl border-2 border-dashed p-7 sm:p-10 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-indigo-400 bg-indigo-950/40 shadow-2xl shadow-indigo-500/20 scale-[1.01]'
            : validatedFile
            ? 'border-indigo-500/60 bg-[#0d1222]/95 shadow-xl shadow-indigo-950/50'
            : 'border-indigo-500/35 hover:border-indigo-400/70 bg-[#0c101c]/90 hover:bg-[#0f1424]/95 shadow-2xl shadow-indigo-950/60'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileInputChange}
          accept=".mp3,.wav,audio/mpeg,audio/wav"
          className="hidden"
          id="audio-upload-input"
          aria-label="Choose an MP3 or WAV audio file"
        />

        {!validatedFile ? (
          <div className="space-y-4">
            {/* Tray Upload Icon */}
            <div className="w-16 h-16 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center text-indigo-400 group-hover:scale-105 group-hover:text-indigo-300 group-hover:border-indigo-400/80 shadow-lg shadow-indigo-900/40 transition mx-auto">
              <Upload className="w-8 h-8" />
            </div>

            {/* Main Title & Subtitle */}
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Drop your MP3 or WAV file here, or click to browse
              </h3>
              <p className="text-xs text-slate-300" role="status">
                {validating ? 'Verifying audio…' : 'Maximum file size 100 MB'}
              </p>
            </div>

            {/* Format Badges Chips (Matching Image 2) */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-3 max-w-xl mx-auto">
              {supportedFormats.map((fmt) => (
                <span
                  key={fmt}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-indigo-950/50 border border-indigo-700/40 text-indigo-300"
                >
                  {fmt}
                </span>
              ))}
            </div>

            {/* CTA Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Browse Files</span>
              </button>
            </div>
          </div>
        ) : (
          /* File Inspected & Validation Ready State */
          <div className="space-y-5 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-[#13182b] border border-indigo-500/30">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-indigo-400 flex-shrink-0">
                  <FileAudio className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-white text-sm sm:text-base truncate">
                    {validatedFile.file.name}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                    <span className="font-mono text-indigo-300 font-semibold uppercase">
                      {validatedFile.format}
                    </span>
                    <span>•</span>
                    <span>{formatDuration(validatedFile.duration)}</span>
                    <span>•</span>
                    <span>{formatFileSize(validatedFile.file.size)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  selection.current++;
                  onFileChange(null);
                  setCloudConsent(false);
                  void clearRecentFile();
                }}
                className="min-h-11 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Change File
              </button>
            </div>

            {/* Processing Mode Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Select AI Separation Mode:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  aria-pressed={selectedMode === 'full'}
                  onClick={() => setSelectedMode('full')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    selectedMode === 'full'
                      ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-xs'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Full Song</span>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Complete track ({formatDuration(validatedFile.duration)})
                  </span>
                </button>

                <button
                  type="button"
                  aria-pressed={selectedMode === 'preview-30s'}
                  onClick={() => setSelectedMode('preview-30s')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    selectedMode === 'preview-30s'
                      ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-xs'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>30s Fast Preview</span>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Instant neural test audition
                  </span>
                </button>

                <button
                  type="button"
                  aria-pressed={selectedMode === 'preview-60s'}
                  onClick={() => setSelectedMode('preview-60s')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    selectedMode === 'preview-60s'
                      ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-xs'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>60s Extended</span>
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Verse + chorus preview
                  </span>
                </button>
              </div>
            </div>

            {/* Launch Processing Action */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onStartProcessing(validatedFile, selectedMode)}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-extrabold text-sm sm:text-base tracking-wide transition shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-5 h-5 fill-current" />
              <span>Separate Vocals & Music Now</span>
            </button>
            {import.meta.env.VITE_ENABLE_CLOUD === 'true' && (
              <div className="space-y-2 text-sm text-slate-200">
                {cloudConsent && (
                  <p id="cloud-storage-notice">
                    Cloud processing uploads this file to Cloudflare. The input is deleted when the job ends.
                    Download the stems within 15 minutes.
                  </p>
                )}
                <button
                  type="button"
                  disabled={isProcessing}
                  aria-describedby={cloudConsent ? 'cloud-storage-notice' : undefined}
                  onClick={() => cloudConsent ? onStartProcessing(validatedFile, selectedMode, true) : setCloudConsent(true)}
                  className="min-h-11 px-4 rounded-lg border border-indigo-400 text-indigo-200 hover:bg-indigo-950"
                >
                  {cloudConsent ? 'Upload and separate in the cloud' : 'Use cloud processing'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Validation Error Banner */}
      {errorMsg && (
        <div role="alert" className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">{errorMsg}</p>
        </div>
      )}

      {/* 4 Trust Badges Directly Below Upload Box (Matching Image 2) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-300 pt-1">
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#0d1222]/70 border border-indigo-500/20">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="font-medium truncate">Private & Encrypted</span>
        </div>
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#0d1222]/70 border border-indigo-500/20">
          <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="font-medium truncate">Under 10s Processing</span>
        </div>
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#0d1222]/70 border border-indigo-500/20">
          <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <span className="font-medium truncate">No Signup to Preview</span>
        </div>
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#0d1222]/70 border border-indigo-500/20">
          <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <span className="font-medium truncate">Audio & Video Files</span>
        </div>
      </div>

    </div>
  );
};
