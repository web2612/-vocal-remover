import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTES_DATA, BLOG_POSTS, type RouteContent } from '../src/data/routesData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

function generatePrerenderedHTML() {
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    console.error('dist/index.html does not exist. Run vite build first.');
    process.exit(1);
  }

  const baseHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

  // Helper to escape HTML characters
  const esc = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Helper to convert markdown links [text](url) into semantic anchor tags
  const renderLinksInText = (str: string) => {
    return esc(str).replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-indigo-600 hover:underline font-semibold">$1</a>'
    );
  };

  // All routes to render
  const routesToRender: RouteContent[] = Object.values(ROUTES_DATA);

  // Add individual blog posts
  for (const post of BLOG_POSTS) {
    routesToRender.push({
      slug: `blog/${post.slug}`,
      path: `/blog/${post.slug}/`,
      title: post.title,
      metaDescription: post.excerpt,
      h1: post.title,
      h2s: post.sections ? post.sections.map((s) => s.heading) : ['Article Highlights', 'Related Audio Concepts'],
      canonical: `https://vocalremover.group/blog/${post.slug}/`,
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
          heading: post.title,
          content: post.content
        }
      ],
      faqs: [],
      noIndex: false
    });
  }

  console.log(`Prerendering ${routesToRender.length} SEO routes...`);

  for (const route of routesToRender) {
    let html = baseHtml;

    // 1. Replace title
    html = html.replace(/<title>.*?<\/title>/s, `<title>${esc(route.title)}</title>`);

    // 2. Replace meta description
    html = html.replace(
      /<meta\s+name="description"\s+content=".*?"\s*\/?>/s,
      `<meta name="description" content="${esc(route.metaDescription)}" />`
    );

    // 3. Inject / Replace robots directive
    const robotsContent = route.noIndex ? 'noindex, nofollow' : 'index, follow';
    if (/<meta\s+name="robots"\s+content=".*?"\s*\/?>/s.test(html)) {
      html = html.replace(
        /<meta\s+name="robots"\s+content=".*?"\s*\/?>/s,
        `<meta name="robots" content="${robotsContent}" />`
      );
    } else {
      html = html.replace(
        '</head>',
        `    <meta name="robots" content="${robotsContent}" />\n  </head>`
      );
    }

    // 4. Replace canonical
    html = html.replace(
      /<link\s+rel="canonical"\s+href=".*?"\s*\/?>/s,
      `<link rel="canonical" href="${esc(route.canonical)}" />`
    );

    // 5. Replace Open Graph tags
    html = html.replace(
      /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/s,
      `<meta property="og:title" content="${esc(route.title)}" />`
    );
    html = html.replace(
      /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/s,
      `<meta property="og:description" content="${esc(route.metaDescription)}" />`
    );
    html = html.replace(
      /<meta\s+property="og:url"\s+content=".*?"\s*\/?>/s,
      `<meta property="og:url" content="${esc(route.canonical)}" />`
    );

    // 6. Replace Twitter tags
    if (/<meta\s+name="twitter:url"\s+content=".*?"\s*\/?>/s.test(html)) {
      html = html.replace(
        /<meta\s+name="twitter:url"\s+content=".*?"\s*\/?>/s,
        `<meta name="twitter:url" content="${esc(route.canonical)}" />`
      );
    } else {
      html = html.replace(
        '</head>',
        `    <meta name="twitter:url" content="${esc(route.canonical)}" />\n  </head>`
      );
    }
    html = html.replace(
      /<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/s,
      `<meta name="twitter:title" content="${esc(route.title)}" />`
    );
    html = html.replace(
      /<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/s,
      `<meta name="twitter:description" content="${esc(route.metaDescription)}" />`
    );

    // 7. JSON-LD Schemas
    const schemas: any[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': 'https://vocalremover.group/#website',
        name: 'VocalRemover.group',
        url: 'https://vocalremover.group/',
        description: 'Free client-side AI vocal remover and stem separation tool online.',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': 'https://vocalremover.group/#organization',
        name: 'VocalRemover.group',
        url: 'https://vocalremover.group/',
        logo: {
          '@type': 'ImageObject',
          url: 'https://vocalremover.group/logo.svg',
        },
      }
    ];

    // BreadcrumbList for non-homepage routes
    if (route.path !== '/') {
      const breadcrumbItems: any[] = [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://vocalremover.group/',
        }
      ];

      if (route.path.startsWith('/blog/') && route.path !== '/blog/') {
        breadcrumbItems.push(
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: 'https://vocalremover.group/blog/',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: route.h1,
            item: route.canonical,
          }
        );
      } else {
        breadcrumbItems.push({
          '@type': 'ListItem',
          position: 2,
          name: route.h1,
          item: route.canonical,
        });
      }

      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      });
    }

    // WebApplication for verified working tools
    if (route.isToolImplemented) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: route.h1,
        url: route.canonical,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'All (Modern Web Browser with WebAssembly / WebGPU)',
        browserRequirements: 'Requires JavaScript and WebAssembly or WebGPU',
        description: route.metaDescription,
        offers: {
          '@type': 'Offer',
          price: '0.00',
          priceCurrency: 'USD',
        }
      });
    }

    // BlogPosting schema for articles
    if (route.toolType === 'blog' && route.path.startsWith('/blog/') && route.path !== '/blog/') {
      if (!route.datePublished) {
        throw new Error(`Missing required datePublished for blog route ${route.path}. Publication dates must never be invented.`);
      }
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: route.h1,
        description: route.metaDescription,
        image: ['https://vocalremover.group/og-image.jpg'],
        datePublished: route.datePublished,
        dateModified: route.dateModified || route.datePublished,
        author: {
          '@type': 'Organization',
          name: `VocalRemover.group ${route.author || 'Audio Engineering Team'}`,
          url: 'https://vocalremover.group/about/',
        },
        publisher: {
          '@type': 'Organization',
          name: 'VocalRemover.group',
          url: 'https://vocalremover.group/',
          logo: {
            '@type': 'ImageObject',
            url: 'https://vocalremover.group/og-image.jpg',
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': route.canonical,
        },
      });
    }

    if (route.faqs && route.faqs.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: route.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          }
        }))
      });
    }

    html = html.replace(
      /<script\s+type="application\/ld\+json"\s+id="jsonld-schema">.*?<\/script>/s,
      `<script type="application/ld+json" id="jsonld-schema">${JSON.stringify(schemas)}</script>`
    );

    // 8. Inject Semantic Static Fallback HTML into #root
    let semanticBody = `
      <header class="p-8 text-center bg-slate-50 border-b border-slate-200 text-slate-900">
        <h1 class="text-4xl font-extrabold text-slate-900 mb-4">${esc(route.h1)}</h1>
        <p class="text-lg text-slate-600 max-w-2xl mx-auto">${renderLinksInText(route.leadParagraph)}</p>
        ${route.toolType === 'blog' && route.path.startsWith('/blog/') && route.path !== '/blog/' ? `
          <div class="mt-4 text-xs font-semibold text-slate-500 flex flex-wrap items-center justify-center gap-3">
            <span>By ${esc(route.author || 'Audio Engineering Team')}</span>
            <span>•</span>
            <span>Published ${esc(route.datePublished || '')}</span>
            ${route.dateModified && route.dateModified !== route.datePublished ? `<span>•</span><span>Updated ${esc(route.dateModified)}</span>` : ''}
            ${route.readTime ? `<span>•</span><span class="text-indigo-600">${esc(route.readTime)}</span>` : ''}
          </div>
        ` : ''}
      </header>
      <main class="max-w-4xl mx-auto p-6 space-y-8 text-slate-700">
    `;

    if (route.bodySections && route.bodySections.length > 0) {
      for (const section of route.bodySections) {
        semanticBody += `
          <section class="space-y-3">
            <h2 class="text-2xl font-bold text-slate-900">${esc(section.heading)}</h2>
            ${section.content.map((p) => `<p class="leading-relaxed">${renderLinksInText(p)}</p>`).join('')}
          </section>
        `;
      }
    }

    if (route.faqs && route.faqs.length > 0) {
      semanticBody += `
        <section class="space-y-4 pt-6 border-t border-slate-200">
          <h2 class="text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
          <dl class="space-y-4">
            ${route.faqs
              .map(
                (faq) => `
              <div class="space-y-1">
                <dt class="font-semibold text-slate-900">${esc(faq.question)}</dt>
                <dd class="text-sm text-slate-600">${esc(faq.answer)}</dd>
              </div>
            `
              )
              .join('')}
          </dl>
        </section>
      `;
    }

    semanticBody += `
      </main>
      <footer class="p-8 border-t border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
        <p>© ${new Date().getFullYear()} VocalRemover.group – Client-Side AI Audio Source Separation.</p>
        <nav class="mt-2 space-x-4">
          <a href="/" class="text-indigo-600 hover:underline">AI Vocal Remover</a>
          <a href="/vocal-remover/" class="text-indigo-600 hover:underline">Vocal Extractor</a>
          <a href="/instrumental-maker/" class="text-indigo-600 hover:underline">Instrumental Maker</a>
          <a href="/acapella-extractor/" class="text-indigo-600 hover:underline">Acapella Extractor</a>
          <a href="/karaoke-maker/" class="text-indigo-600 hover:underline">Karaoke Maker</a>
          <a href="/how-to-remove-vocals/" class="text-indigo-600 hover:underline">How It Works</a>
          <a href="/privacy-policy/" class="text-indigo-600 hover:underline">Privacy Policy</a>
          <a href="/terms/" class="text-indigo-600 hover:underline">Terms of Service</a>
        </nav>
      </footer>
    `;

    html = html.replace(
      /<div id="root">.*?<\/div>/s,
      `<div id="root"><noscript>${semanticBody}</noscript></div>`
    );

    // Target file path
    let targetPath = path.join(distDir, 'index.html');
    if (route.path !== '/') {
      const cleanSlug = route.path.replace(/^\/|\/$/g, '');
      const outDir = path.join(distDir, cleanSlug);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      targetPath = path.join(outDir, 'index.html');
    }

    fs.writeFileSync(targetPath, html, 'utf-8');
    console.log(`  ✓ Prerendered ${route.path} -> ${path.relative(distDir, targetPath)}`);
  }

  // Also write 404.html with noindex directive, accurate social metadata, and modern design
  const notFoundTitle = 'Page Not Found (404) | VocalRemover.group';
  const notFoundDesc = 'The requested page could not be found on VocalRemover.group. Return to the homepage to use our free AI vocal remover.';
  const notFoundCanonical = 'https://vocalremover.group/404.html';

  let notFoundHtml = baseHtml
    .replace(/<title>.*?<\/title>/s, `<title>${esc(notFoundTitle)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content=".*?"\s*\/?>/s,
      `<meta name="description" content="${esc(notFoundDesc)}" />`
    )
    .replace(
      /<link\s+rel="canonical"\s+href=".*?"\s*\/?>/s,
      `<link rel="canonical" href="${esc(notFoundCanonical)}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/s,
      `<meta property="og:title" content="${esc(notFoundTitle)}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/s,
      `<meta property="og:description" content="${esc(notFoundDesc)}" />`
    )
    .replace(
      /<meta\s+property="og:url"\s+content=".*?"\s*\/?>/s,
      `<meta property="og:url" content="${esc(notFoundCanonical)}" />`
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/s,
      `<meta name="twitter:title" content="${esc(notFoundTitle)}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/s,
      `<meta name="twitter:description" content="${esc(notFoundDesc)}" />`
    )
    .replace(
      /<meta\s+name="twitter:url"\s+content=".*?"\s*\/?>/s,
      `<meta name="twitter:url" content="${esc(notFoundCanonical)}" />`
    )
    .replace(
      /<script\s+type="application\/ld\+json"\s+id="jsonld-schema">.*?<\/script>/s,
      ''
    )
    .replace(
      /<div id="root">.*?<\/div>/s,
      `<div id="root">
        <div class="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#070a13] text-white">
          <div class="w-16 h-16 rounded-2xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-6 text-2xl font-black">
            404
          </div>
          <h1 class="text-3xl sm:text-4xl font-extrabold text-white mb-3">Page Not Found</h1>
          <p class="text-slate-300 max-w-md mb-8 text-sm leading-relaxed">
            The page you are looking for does not exist or may have been moved. Return to the homepage to separate your music with our free AI tool.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-3">
            <a href="/" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm shadow-md hover:from-violet-500 hover:to-indigo-500 transition">
              Return to AI Vocal Remover
            </a>
            <a href="/vocal-remover/" class="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-sm hover:bg-slate-700 hover:text-white transition">
              Vocal Extractor Tool
            </a>
          </div>
        </div>
      </div>`
    );

  if (/<meta\s+name="robots"\s+content=".*?"\s*\/?>/s.test(notFoundHtml)) {
    notFoundHtml = notFoundHtml.replace(
      /<meta\s+name="robots"\s+content=".*?"\s*\/?>/s,
      '<meta name="robots" content="noindex, nofollow" />'
    );
  } else {
    notFoundHtml = notFoundHtml.replace(
      '</head>',
      '    <meta name="robots" content="noindex, nofollow" />\n  </head>'
    );
  }

  fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml, 'utf-8');
  console.log('  ✓ Generated 404.html (with noindex, nofollow)');

  console.log('Prerendering completed successfully!');
}

generatePrerenderedHTML();
