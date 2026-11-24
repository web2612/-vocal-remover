import React, { useEffect } from 'react';
import type { RouteContent } from '../data/routesData';

interface SEOHeadProps {
  route: RouteContent;
}

export const SEOHead: React.FC<SEOHeadProps> = ({ route }) => {
  useEffect(() => {
    // 1. Title
    document.title = route.title;

    // Helper to set or create meta tags
    const setMeta = (nameAttr: 'name' | 'property', attrValue: string, content: string) => {
      let el = document.querySelector(`meta[${nameAttr}="${attrValue}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(nameAttr, attrValue);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    // 2. Meta description, keywords, & robots
    setMeta('name', 'description', route.metaDescription);
    setMeta('name', 'robots', route.noIndex ? 'noindex, nofollow' : 'index, follow');
    if (route.keywords && route.keywords.length > 0) {
      setMeta('name', 'keywords', route.keywords.join(', '));
    }

    // 3. Open Graph
    setMeta('property', 'og:title', route.title);
    setMeta('property', 'og:description', route.metaDescription);
    setMeta('property', 'og:url', route.canonical);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:image', 'https://vocalremover.group/og-image.jpg');

    // 4. Twitter Cards
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:url', route.canonical);
    setMeta('name', 'twitter:title', route.title);
    setMeta('name', 'twitter:description', route.metaDescription);
    setMeta('name', 'twitter:image', 'https://vocalremover.group/og-image.jpg');

    // 5. Canonical Link
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = route.canonical;

    // 6. JSON-LD Schemas
    let scriptTag = document.getElementById('jsonld-schema') as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'jsonld-schema';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }

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
      if (route.datePublished) {
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

    scriptTag.textContent = JSON.stringify(schemas);
  }, [route]);

  return null;
};
