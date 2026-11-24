import React from 'react';
import { Cpu, Lock } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

const CURRENT_YEAR = 2026;

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const handleLink = (path: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    onNavigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#070a13] border-t border-slate-800 text-slate-300 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center">
              <BrandLogo size="md" />
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
              An open-source, privacy-first audio source separation platform. Separate vocals and instrumentals directly inside your browser with WebGPU and deep neural networks. Zero server uploads, zero subscription costs.
            </p>

            <div className="flex items-center gap-3 pt-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-white shadow-2xs font-semibold">
                <Lock className="w-3.5 h-3.5 text-emerald-400" /> Local Processing Available
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-white shadow-2xs font-semibold">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" /> On-Device AI
              </span>
            </div>
          </div>

          {/* Audio Tools Column */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">
              Audio Tools
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a
                  href="/vocal-remover/"
                  onClick={(e) => handleLink('/vocal-remover/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  Vocal Extractor
                </a>
              </li>
              <li>
                <a
                  href="/instrumental-maker/"
                  onClick={(e) => handleLink('/instrumental-maker/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  Instrumental Maker
                </a>
              </li>
              <li>
                <a
                  href="/acapella-extractor/"
                  onClick={(e) => handleLink('/acapella-extractor/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  Acapella Extractor
                </a>
              </li>
              <li>
                <a
                  href="/karaoke-maker/"
                  onClick={(e) => handleLink('/karaoke-maker/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  Karaoke Maker
                </a>
              </li>
              <li>
                <a
                  href="/video-vocal-remover/"
                  onClick={(e) => handleLink('/video-vocal-remover/', e)}
                  className="text-slate-300 hover:text-white transition flex items-center gap-1.5 font-medium"
                >
                  <span>Video Remover</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold">Roadmap</span>
                </a>
              </li>
              <li>
                <a
                  href="/noise-remover/"
                  onClick={(e) => handleLink('/noise-remover/', e)}
                  className="text-slate-300 hover:text-white transition flex items-center gap-1.5 font-medium"
                >
                  <span>Noise Remover</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold">R&D</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Guides & Research Column */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">
              Knowledge & Guides
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a
                  href="/how-to-remove-vocals/"
                  onClick={(e) => handleLink('/how-to-remove-vocals/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  How to Remove Vocals
                </a>
              </li>
              <li>
                <a
                  href="/blog/"
                  onClick={(e) => handleLink('/blog/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  Audio AI Blog
                </a>
              </li>
              <li>
                <a
                  href="/blog/demucs-v4-browser-vocal-isolation/"
                  onClick={(e) => handleLink('/blog/demucs-v4-browser-vocal-isolation/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  Demucs v4 in Browser
                </a>
              </li>
              <li>
                <a
                  href="/blog/phase-cancellation-vs-ai-source-separation/"
                  onClick={(e) => handleLink('/blog/phase-cancellation-vs-ai-source-separation/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  Phase vs AI Separation
                </a>
              </li>
              <li>
                <a
                  href="/blog/karaoke-backing-tracks-guide/"
                  onClick={(e) => handleLink('/blog/karaoke-backing-tracks-guide/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  Karaoke Tracks Guide
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & About Column */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">
              Organization & Legal
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a
                  href="/about/"
                  onClick={(e) => handleLink('/about/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  href="/contact/"
                  onClick={(e) => handleLink('/contact/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  Contact & Support
                </a>
              </li>
              <li>
                <a
                  href="/privacy-policy/"
                  onClick={(e) => handleLink('/privacy-policy/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms/"
                  onClick={(e) => handleLink('/terms/', e)}
                  className="text-slate-300 hover:text-white transition font-medium"
                >
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Line */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {CURRENT_YEAR} Vocal Remover. All rights reserved. Open-source on-device AI.</p>
          <div className="flex items-center gap-6">
            <span className="text-slate-400">Deployed on Cloudflare Pages</span>
            <span>•</span>
            <span className="text-slate-400">Zero Server Uploads</span>
            <span>•</span>
            <a
              href="/admin/"
              onClick={(e) => handleLink('/admin/', e)}
              className="text-slate-500 hover:text-indigo-400 transition"
            >
              API Manager
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
