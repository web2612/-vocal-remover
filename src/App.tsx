import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AudioUploader } from './components/AudioUploader';
import { ProcessingProgress } from './components/ProcessingProgress';
import { DualStemPlayer } from './components/DualStemPlayer';
import { LivePerformanceDemo } from './components/LivePerformanceDemo';
import { FAQSection } from './components/FAQSection';
import { ToolsGrid } from './components/ToolsGrid';
import { SEOHead } from './components/SEOHead';
import { ROUTES_DATA, BLOG_POSTS, type RouteContent } from './data/routesData';
import { AudioPipelineService, type ValidatedAudioFile, type PipelineOutputs } from './lib/audio/audioPipeline';
import type { ProgressInfo } from './lib/audio/demucsProcessor';
import { clearRecentFile } from './lib/audio/recentFile';
import { ArrowRight, Music, AlertCircle } from 'lucide-react';
import { AdminProvidersDashboard } from './components/AdminProvidersDashboard';

// Helper to render markdown links [text](url) inside body paragraphs as semantic SPA links
const renderParagraphWithLinks = (text: string, onNavigate: (path: string) => void) => {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  if (!linkRegex.test(text)) {
    return text;
  }
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  linkRegex.lastIndex = 0;
  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const linkText = match[1];
    const linkUrl = match[2];
    parts.push(
      <a
        key={match.index}
        href={linkUrl}
        target={linkUrl.startsWith('http') ? '_blank' : undefined}
        rel={linkUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
        onClick={(e) => {
          if (linkUrl.startsWith('/')) {
            e.preventDefault();
            onNavigate(linkUrl);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        className="text-indigo-600 hover:text-indigo-800 underline font-semibold transition"
      >
        {linkText}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts;
};

// Lookup route content helper
const getRouteContent = (currentPath: string): RouteContent => {
  if (ROUTES_DATA[currentPath]) {
    return ROUTES_DATA[currentPath];
  }
  // Check if it's a blog post
  if (currentPath.startsWith('/blog/')) {
    const slug = currentPath.replace('/blog/', '').replace('/', '');
    const post = BLOG_POSTS.find((p) => p.slug === slug);
    if (post) {
      return {
        slug: post.slug,
        path: currentPath,
        title: post.title,
        metaDescription: post.excerpt,
        h1: post.title,
        h2s: post.sections ? post.sections.map((s) => s.heading) : [],
        canonical: `https://vocalremover.group${currentPath}`,
        keywords: ['audio AI', 'vocal separation', 'music technology', 'Demucs'],
        isToolImplemented: false,
        toolType: 'blog',
        leadParagraph: post.excerpt,
        datePublished: post.datePublished,
        dateModified: post.dateModified || post.datePublished,
        author: post.author,
        readTime: post.readTime,
        bodySections: post.sections || [
          {
            heading: 'Article Contents',
            content: post.content
          }
        ],
        faqs: [],
        noIndex: false
      };
    }
  }

  // Admin Management Dashboard Route
  if (currentPath.startsWith('/admin')) {
    return {
      slug: 'admin',
      path: currentPath,
      title: 'API Provider Management Dashboard | VocalRemover.group',
      metaDescription: 'Administrative dashboard for monitoring and managing VocalRemover multi-provider APIs, quotas, and failover status.',
      h1: 'API Management Dashboard',
      h2s: [],
      canonical: 'https://vocalremover.group/admin/',
      keywords: [],
      isToolImplemented: false,
      toolType: 'page',
      leadParagraph: 'Multi-provider AI vocal remover administration interface.',
      bodySections: [],
      faqs: [],
      noIndex: true
    };
  }

  // Dedicated 404 Route handling (prevents soft-200 indexing on client)
  return {
    slug: '404',
    path: currentPath,
    title: 'Page Not Found (404) | VocalRemover.group',
    metaDescription: 'The requested page could not be found on VocalRemover.group. Return to the homepage to use our free AI vocal remover.',
    h1: '404 – Page Not Found',
    h2s: [],
    canonical: 'https://vocalremover.group/404.html',
    keywords: [],
    isToolImplemented: false,
    toolType: 'page',
    leadParagraph: 'We could not find the page you were looking for. It may have been moved, renamed, or deleted.',
    bodySections: [],
    faqs: [],
    noIndex: true
  };
};

export const App: React.FC = () => {
  // Routing state
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      return p.endsWith('/') ? p : `${p}/`;
    }
    return '/';
  });

  // Audio Pipeline state
  const pipelineService = useMemo(() => new AudioPipelineService(), []);
  const [selectedFile, setSelectedFile] = useState<ValidatedAudioFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCloud, setIsCloud] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [outputs, setOutputs] = useState<PipelineOutputs | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync with browser back/forward buttons
  useEffect(() => {
    const onPopState = () => {
      const p = window.location.pathname;
      setCurrentPath(p.endsWith('/') ? p : `${p}/`);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Handle client-side navigation
  const handleNavigate = (path: string) => {
    const formatted = path.endsWith('/') ? path : `${path}/`;
    window.history.pushState({}, '', formatted);
    setCurrentPath(formatted);
  };

  // Lookup route content
  const currentRoute = getRouteContent(currentPath);

  // Start audio separation
  const handleStartProcessing = async (
    fileData: ValidatedAudioFile,
    mode: 'full' | 'preview-30s' | 'preview-60s',
    forceBrowser = false,
  ) => {
    setSelectedFile(fileData);
    setIsProcessing(true);
    setIsCloud(!forceBrowser);
    setProgress(null);
    setErrorMsg(null);
    setOutputs(null);

    try {
      const result = await pipelineService.processAudio(
        fileData,
        mode,
        (info: ProgressInfo) => {
          setProgress(info);
        },
        forceBrowser,
      );
      setOutputs(result);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Audio processing encountered an error. Please verify your browser supports WebAssembly/WebGPU.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel processing
  const handleCancelProcessing = () => {
    pipelineService.cancelProcessing();
  };

  // Reset session
  const handleReset = () => {
    pipelineService.cleanupUrls();
    setOutputs(null);
    setSelectedFile(null);
    void clearRecentFile();
    setProgress(null);
    setErrorMsg(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pipelineService.dispose();
    };
  }, [pipelineService]);

  const isToolPage = currentRoute.toolType === 'vocal-remover' ||
    currentRoute.toolType === 'instrumental-maker' ||
    currentRoute.toolType === 'acapella-extractor' ||
    currentRoute.toolType === 'karaoke-maker' ||
    currentRoute.path === '/';

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 selection:bg-indigo-100 selection:text-indigo-800">
      
      {/* Dynamic SEO Meta Tags & JSON-LD */}
      <SEOHead route={currentRoute} />

      {/* Header */}
      <Navbar currentPath={currentPath} onNavigate={handleNavigate} />

      {/* Main Content Area */}
      <main className="flex-grow">
        {currentPath.startsWith('/admin') ? (
          <div className="bg-[#070a13] min-h-[80vh] py-8 text-white">
            <AdminProvidersDashboard />
          </div>
        ) : (
          <>
            {/* HERO SECTION - SLEEK DARK THEME MATCHING COMPETITOR IMAGE 2 */}
        <section className="relative pt-10 pb-14 px-4 sm:px-6 lg:px-8 bg-[#070a13] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/50 via-[#0a0e1a] to-[#070a13] text-white border-b border-slate-850">
          
          <div className="max-w-4xl mx-auto text-center space-y-4">
            {/* Main Primary H1 (Consistent with Prerender & SEO Data) */}
            <h1 className="text-3xl sm:text-5xl lg:text-[56px] font-black tracking-tight text-white leading-[1.12] max-w-4xl mx-auto">
              {currentPath === '/' ? (
                <>
                  AI Vocal Remover – Remove Vocals<br />
                  from Any{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400">
                    Song or Video
                  </span>
                </>
              ) : (
                currentRoute.h1
              )}
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
              {currentPath === '/'
                ? 'Isolate voice from music with our studio-grade AI vocal separation tool. Get a clean vocal track and instrumental in seconds. Preview free, no signup required.'
                : currentRoute.leadParagraph}
            </p>

            {/* Blog Post Meta Byline */}
            {currentRoute.toolType === 'blog' && currentPath.startsWith('/blog/') && currentPath !== '/blog/' && (
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-300 pt-2 font-medium">
                <span className="text-indigo-300">By {currentRoute.author || 'Audio Engineering Team'}</span>
                <span>•</span>
                <span>Published {currentRoute.datePublished}</span>
                {currentRoute.dateModified && currentRoute.dateModified !== currentRoute.datePublished && (
                  <>
                    <span>•</span>
                    <span>Updated {currentRoute.dateModified}</span>
                  </>
                )}
                {currentRoute.readTime && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-400">{currentRoute.readTime}</span>
                  </>
                )}
              </div>
            )}


          </div>

          {/* INTERACTIVE WORKBENCH DIRECTLY VISIBLE ABOVE THE FOLD */}
          <div className="mt-8">
            {currentRoute.slug === '404' ? (
              <div className="max-w-xl mx-auto p-8 rounded-3xl bg-[#0c101d]/90 border border-slate-800 text-center space-y-4 shadow-xl text-white">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-2xl font-black">
                  404
                </div>
                <h2 className="text-2xl font-extrabold text-white">Page Not Found</h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  The page you are looking for does not exist or may have moved. Return to the homepage to isolate vocals and instrumentals.
                </p>
                <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href="/"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigate('/');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-bold text-white text-sm transition shadow-md shadow-indigo-600/30"
                  >
                    Return to AI Vocal Remover
                  </a>
                  <a
                    href="/vocal-remover/"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigate('/vocal-remover/');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-sm hover:bg-slate-700 hover:text-white transition"
                  >
                    Vocal Remover Tool
                  </a>
                </div>
              </div>
            ) : isToolPage ? (
              <div>
                {/* 1. Inactive / Upload State */}
                {!isProcessing && !outputs && (
                  <AudioUploader
                    onStartProcessing={handleStartProcessing}
                    isProcessing={isProcessing}
                    pipelineService={pipelineService}
                    selectedFile={selectedFile}
                    onFileChange={setSelectedFile}
                  />
                )}

                {/* 2. Real-time Inference Progress State */}
                {isProcessing && (
                  <ProcessingProgress
                    progress={progress}
                    cloud={isCloud}
                    onCancel={handleCancelProcessing}
                    fileName={selectedFile?.file.name || 'Media Track'}
                  />
                )}

                {/* 3. Completed Dual-Stem Player Console */}
                {outputs && (
                  <DualStemPlayer
                    outputs={outputs}
                    onReset={handleReset}
                  />
                )}

                {/* Error Banner */}
                {errorMsg && (
                  <div className="max-w-2xl mx-auto mt-4 p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-200 text-sm flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-200">Processing Error</h4>
                      <p className="text-xs text-red-300/90 mt-0.5">{errorMsg}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : currentRoute.toolType === 'noise-remover' || currentRoute.toolType === 'video-vocal-remover' ? (
              /* Roadmap / R&D Notice Card */
              <div className="max-w-2xl mx-auto p-8 rounded-3xl bg-[#0c101c]/90 border border-slate-800 text-center space-y-4 shadow-xl text-white">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Music className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-white">
                  {currentRoute.h1}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  We believe in 100% honest engineering. Rather than presenting an untested or simulated interface, this feature is currently in active research & development across browser environments.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => handleNavigate('/vocal-remover/')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-semibold text-white text-sm transition cursor-pointer shadow-md shadow-indigo-600/30"
                  >
                    <span>Use Working Audio Vocal Remover (MP3 & WAV)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

        </section>

        {/* INTERACTIVE VIDEO PERFORMANCE DEMO (MATCHING IMAGE 3) */}
        {currentPath === '/' && (
          <LivePerformanceDemo onScrollToUploader={() => window.scrollTo({
            top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
          })} />
        )}

        {/* DETAILED ORIGINAL SEO BODY CONTENT */}
        <section className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-12">
          {currentRoute.bodySections && currentRoute.bodySections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {section.heading}
              </h2>
              <div className="space-y-3 text-slate-600 leading-relaxed text-sm sm:text-base">
                {section.content.map((p, pIdx) => (
                  <p key={pIdx} className="leading-relaxed">
                    {renderParagraphWithLinks(p, handleNavigate)}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {/* Blog Index Listing if on /blog/ (Semantic Anchor Tags with Descriptive Text) */}
          {currentPath === '/blog/' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              {BLOG_POSTS.map((post) => (
                <a
                  key={post.slug}
                  href={`/blog/${post.slug}/`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate(`/blog/${post.slug}/`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition cursor-pointer flex flex-col justify-between group block text-left"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{post.date}</span>
                      <span>{post.readTime}</span>
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition">
                      {post.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {post.excerpt}
                    </p>
                  </div>
                  <div className="pt-4 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                    <span>Read full article: {post.title}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* FREQUENTLY ASKED QUESTIONS */}
        {currentRoute.faqs && currentRoute.faqs.length > 0 && (
          <FAQSection faqs={currentRoute.faqs} />
        )}

        {/* EXPLORE TOOLS GRID */}
        <ToolsGrid onNavigate={handleNavigate} currentSlug={currentRoute.slug} />

          </>
        )}
      </main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />

    </div>
  );
};

export default App;
