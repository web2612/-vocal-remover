import React from 'react';
import { Loader2, XCircle, Cpu, ShieldCheck, Sparkles } from 'lucide-react';
import type { ProgressInfo } from '../lib/audio/demucsProcessor';

interface ProcessingProgressProps {
  progress: ProgressInfo | null;
  onCancel: () => void;
  fileName: string;
  cloud: boolean;
}

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  progress,
  onCancel,
  fileName,
  cloud,
}) => {
  const percent = progress?.percent || 0;
  const message = progress?.message || 'Preparing audio processing pipeline...';
  const phase = progress?.phase || 'init';

  const getPhaseTitle = () => {
    switch (phase) {
      case 'validating':
        return 'Verifying audio';
      case 'uploading':
        return 'Uploading audio';
      case 'queued':
        return 'Waiting for cloud processing';
      case 'model-download':
        return 'Downloading Neural Network Weights';
      case 'model-loading':
        return 'Initializing WebGPU / WASM Inference Engine';
      case 'preparing-audio':
        return 'Executing Fourier Transform (STFT)';
      case 'separating':
        return 'Extracting Acoustic Stems via Deep Learning';
      case 'synthesizing':
        return 'Synthesizing 16-bit PCM WAV Audio';
      case 'complete':
        return 'Separation Complete!';
      default:
        return 'Processing Audio...';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-6 text-slate-900">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Loader2 className="w-5 h-5 motion-safe:animate-spin" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {getPhaseTitle()}
            </h3>
            <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-md">
              {fileName}
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="min-h-11 flex items-center gap-1.5 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:text-red-600 hover:border-red-200 bg-slate-50 hover:bg-red-50 transition cursor-pointer"
        >
          <XCircle className="w-4 h-4" />
          <span>Cancel</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2" aria-live="polite">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-slate-700">{message}</span>
          <span className="font-mono text-indigo-600 font-bold">{percent}%</span>
        </div>

        <div role="progressbar" aria-label="Separation progress" aria-valuenow={percent}
          className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
          <div
            className="h-full bg-indigo-600 rounded-full motion-safe:transition-all shadow-sm"
            style={{ width: `${Math.max(4, percent)}%` }}
          />
        </div>
      </div>

      {/* Real-Time Processing Details */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
          <Cpu className="w-4 h-4 text-sky-600 flex-shrink-0" />
          <div>
            <span className="text-slate-500 block">Execution Mode</span>
            <span className="text-slate-800 font-medium">{cloud ? 'Cloudflare' : 'Browser'}</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <div>
            <span className="text-slate-500 block">Data Privacy</span>
            <span className="text-slate-800 font-medium">{cloud ? 'Temporary private storage' : 'Audio stays on this device'}</span>
          </div>
        </div>
      </div>

      <div className="pt-2 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
        <span>{cloud ? 'Download results within 15 minutes of completion.' : 'Separation runs on this device.'}</span>
      </div>

    </div>
  );
};
