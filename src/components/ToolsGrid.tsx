import React from 'react';
import { Mic, Music, Disc3, Radio, Video, AudioWaveform, ArrowRight } from 'lucide-react';

interface ToolsGridProps {
  onNavigate: (path: string) => void;
  currentSlug?: string;
}

export const ToolsGrid: React.FC<ToolsGridProps> = ({ onNavigate, currentSlug }) => {
  const tools = [
    {
      slug: 'vocal-remover',
      path: '/vocal-remover/',
      title: 'Vocal Extractor',
      desc: 'Extract clean voice tracks and isolated vocal stems from stereo music.',
      icon: Mic,
      color: 'from-purple-500 to-indigo-500',
      status: 'Implemented',
    },
    {
      slug: 'instrumental-maker',
      path: '/instrumental-maker/',
      title: 'Instrumental Maker',
      desc: 'Create clean backing tracks with original bass, drums, and synths intact.',
      icon: Music,
      color: 'from-sky-500 to-indigo-500',
      status: 'Implemented',
    },
    {
      slug: 'acapella-extractor',
      path: '/acapella-extractor/',
      title: 'Acapella Extractor',
      desc: 'Extract studio acapellas for DJ bootlegs, remixes, and mashups.',
      icon: Disc3,
      color: 'from-violet-500 to-fuchsia-500',
      status: 'Implemented',
    },
    {
      slug: 'karaoke-maker',
      path: '/karaoke-maker/',
      title: 'Karaoke Maker',
      desc: 'Generate karaoke versions with authentic studio mix quality to sing along.',
      icon: Radio,
      color: 'from-indigo-500 to-emerald-500',
      status: 'Implemented',
    },
    {
      slug: 'video-vocal-remover',
      path: '/video-vocal-remover/',
      title: 'Video Vocal Remover',
      desc: 'Video speech extraction and dialogue isolation in testing.',
      icon: Video,
      color: 'from-slate-700 to-slate-800',
      status: 'Roadmap',
    },
    {
      slug: 'noise-remover',
      path: '/noise-remover/',
      title: 'Audio Noise Remover',
      desc: 'Speech enhancement and background hiss reduction research.',
      icon: AudioWaveform,
      color: 'from-slate-700 to-slate-800',
      status: 'R&D',
    },
  ];

  return (
    <section className="w-full max-w-6xl mx-auto py-12 px-4 sm:px-6">
      <div className="text-center space-y-2 mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Explore Our Audio Separation Tools
        </h2>
        <p className="text-sm text-slate-600 max-w-xl mx-auto">
          Honest, high-performance tools engineered with modern browser-native deep learning.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isCurrent = tool.slug === currentSlug;
          return (
            <a
              key={tool.slug}
              href={tool.path}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(tool.path);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`p-6 rounded-3xl border transition-all group flex flex-col justify-between ${
                isCurrent
                  ? 'bg-indigo-50/70 border-indigo-300 shadow-md ring-2 ring-indigo-500/10'
                  : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${tool.color} p-0.5 shadow-sm flex items-center justify-center`}>
                    <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition duration-200" />
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    tool.status === 'Implemented'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {tool.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {tool.desc}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-2 flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700 transition">
                <span>{tool.status === 'Implemented' ? 'Use Tool' : 'View Status'}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
};
