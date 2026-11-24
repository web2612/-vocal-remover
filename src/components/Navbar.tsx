import React, { useState } from 'react';
import { Music2, Cpu, Menu, X, ChevronDown, ShieldCheck, HelpCircle, BookOpen } from 'lucide-react';
import { checkBrowserDeviceSupport } from '../lib/audio/audioConfig';
import { BrandLogo } from './BrandLogo';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const deviceSupport = checkBrowserDeviceSupport();

  const handleLinkClick = (path: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    onNavigate(path);
    setIsToolsOpen(false);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const tools = [
    { name: 'Vocal Extractor', path: '/vocal-remover/', desc: 'Extract crisp vocal tracks & stems', active: true },
    { name: 'Instrumental Maker', path: '/instrumental-maker/', desc: 'Remove singing, keep full instruments', active: true },
    { name: 'Acapella Extractor', path: '/acapella-extractor/', desc: 'Extract pure vocal hooks for DJ remixes', active: true },
    { name: 'Karaoke Maker', path: '/karaoke-maker/', desc: 'Create karaoke backing tracks to sing along', active: true },
    { name: 'Video Vocal Remover', path: '/video-vocal-remover/', desc: 'Video speech extraction (in qualification)', active: false, badge: 'Roadmap' },
    { name: 'Noise Remover', path: '/noise-remover/', desc: 'Speech enhancement & background hiss cleaning', active: false, badge: 'R&D' },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#070a13]/90 border-b border-slate-800/80 transition-all shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <a
              href="/"
              onClick={(e) => handleLinkClick('/', e)}
              className="group focus:outline-none flex items-center"
            >
              <BrandLogo size="md" />
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {/* Tools Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsToolsOpen(!isToolsOpen)}
                  onBlur={() => setTimeout(() => setIsToolsOpen(false), 200)}
                  aria-expanded={isToolsOpen}
                  className={`flex items-center gap-1.5 text-sm font-bold transition py-2 cursor-pointer ${
                    currentPath.startsWith('/') &&
                    currentPath !== '/' &&
                    currentPath !== '/about/' &&
                    currentPath !== '/contact/' &&
                    currentPath !== '/blog/' &&
                    currentPath !== '/how-to-remove-vocals/'
                      ? 'text-cyan-400'
                      : 'text-white hover:text-cyan-300'
                  }`}
                >
                  <Music2 className="w-4 h-4 text-indigo-400" />
                  <span>Tools</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isToolsOpen ? 'rotate-180' : ''}`} />
                </button>

                {isToolsOpen && (
                  <div className="absolute top-full left-0 w-72 mt-2 bg-[#0c101d] border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-white uppercase tracking-wider">
                      Audio Separation Tools
                    </div>
                    {tools.map((tool) => (
                      <a
                        key={tool.path}
                        href={tool.path}
                        onClick={(e) => handleLinkClick(tool.path, e)}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800/60 transition flex flex-col group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white group-hover:text-cyan-400">
                            {tool.name}
                          </span>
                          {tool.badge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                              {tool.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                          {tool.desc}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <a
                href="/instrumental-maker/"
                onClick={(e) => handleLinkClick('/instrumental-maker/', e)}
                className={`text-sm font-bold transition ${
                  currentPath === '/instrumental-maker/' ? 'text-cyan-400' : 'text-white hover:text-cyan-300'
                }`}
              >
                Instrumental
              </a>

              <a
                href="/karaoke-maker/"
                onClick={(e) => handleLinkClick('/karaoke-maker/', e)}
                className={`text-sm font-bold transition ${
                  currentPath === '/karaoke-maker/' ? 'text-cyan-400' : 'text-white hover:text-cyan-300'
                }`}
              >
                Karaoke
              </a>

              <a
                href="/how-to-remove-vocals/"
                onClick={(e) => handleLinkClick('/how-to-remove-vocals/', e)}
                className={`text-sm font-bold transition ${
                  currentPath === '/how-to-remove-vocals/' ? 'text-cyan-400' : 'text-white hover:text-cyan-300'
                }`}
              >
                How It Works
              </a>

              <a
                href="/blog/"
                onClick={(e) => handleLinkClick('/blog/', e)}
                className={`text-sm font-bold transition ${
                  currentPath.startsWith('/blog') ? 'text-cyan-400' : 'text-white hover:text-cyan-300'
                }`}
              >
                Blog
              </a>
            </nav>

            {/* Hardware / Privacy Badge */}
            <div className="hidden sm:flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowDeviceModal(true)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                  deviceSupport.webgpu
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/60'
                    : 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30 hover:bg-indigo-900/60'
                }`}
                title="Click for hardware & privacy inspection"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>{deviceSupport.webgpu ? 'WebGPU Active' : 'WASM Accelerated'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition cursor-pointer"
              >
                Upload File
              </button>
            </div>

            {/* Mobile menu trigger */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeviceModal(true)}
                className="p-1.5 text-slate-300 hover:text-white"
                aria-label="Device information"
              >
                <Cpu className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-white hover:text-cyan-300"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile menu drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#0c101d] border-b border-slate-800 px-4 pt-3 pb-6 space-y-3 animate-in fade-in duration-150">
            <div className="text-xs font-bold text-white uppercase tracking-wider px-2 pt-1">
              Audio Separation Tools
            </div>
            <div className="grid grid-cols-1 gap-1">
              {tools.map((tool) => (
                <a
                  key={tool.path}
                  href={tool.path}
                  onClick={(e) => handleLinkClick(tool.path, e)}
                  className="w-full text-left px-3 py-2 rounded-xl text-white hover:bg-slate-800/80 hover:text-cyan-300 flex items-center justify-between text-sm font-semibold"
                >
                  <span>{tool.name}</span>
                  {tool.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700 font-medium">
                      {tool.badge}
                    </span>
                  )}
                </a>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-1">
              <div className="text-xs font-bold text-white uppercase tracking-wider px-2 pt-2">
                Guides & Information
              </div>
              <a
                href="/how-to-remove-vocals/"
                onClick={(e) => handleLinkClick('/how-to-remove-vocals/', e)}
                className="w-full text-left px-3 py-2 rounded-xl text-white hover:bg-slate-800/80 hover:text-cyan-300 text-sm font-semibold flex items-center gap-2"
              >
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                <span>How It Works</span>
              </a>
              <a
                href="/blog/"
                onClick={(e) => handleLinkClick('/blog/', e)}
                className="w-full text-left px-3 py-2 rounded-xl text-white hover:bg-slate-800/80 hover:text-cyan-300 text-sm font-semibold flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>Blog & Research</span>
              </a>
              <a
                href="/about/"
                onClick={(e) => handleLinkClick('/about/', e)}
                className="w-full text-left px-3 py-2 rounded-xl text-white hover:bg-slate-800/80 hover:text-cyan-300 text-sm font-semibold flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>About & Privacy Architecture</span>
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Hardware / Privacy Modal */}
      {showDeviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0c101d] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-white">
            <button
              type="button"
              onClick={() => setShowDeviceModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-950 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Client Device Intelligence</h3>
                <p className="text-xs text-slate-400">Hardware environment inspection</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-300">
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">WebGPU Acceleration:</span>
                <span className={`font-bold ${deviceSupport.webgpu ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {deviceSupport.webgpu ? '✓ Enabled' : '✗ Unavailable (WASM used)'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">WebAssembly (WASM):</span>
                <span className={`font-bold ${deviceSupport.wasm ? 'text-emerald-400' : 'text-red-400'}`}>
                  {deviceSupport.wasm ? '✓ Available' : '✗ Unsupported'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Processing Privacy:</span>
                <span className="font-bold text-emerald-400">100% Local (0 bytes uploaded)</span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed pt-1">
                {deviceSupport.reason} Browser processing keeps your audio on this device.
              </p>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowDeviceModal(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-bold text-white text-sm transition cursor-pointer shadow-md shadow-indigo-600/30"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
