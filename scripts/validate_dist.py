#!/usr/bin/env python3
"""
Portable HTML & SEO Distribution Validator for VocalRemover.group
Validates prerendered HTML output, metadata uniqueness, canonical tags,
Open Graph, Twitter cards, JSON-LD structured data, H1 tag hierarchy,
and XML sitemap compliance.
"""

import sys
import os
import re
import json
import xml.etree.ElementTree as ET
from pathlib import Path

# 1. Resolve dist directory portably relative to this script location
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
DIST_DIR = PROJECT_DIR / "dist"

print(f"Validator running from: {SCRIPT_DIR}")
print(f"Target distribution:    {DIST_DIR}\n")

if not DIST_DIR.exists():
    print(f"❌ FATAL ERROR: Distribution directory does not exist at '{DIST_DIR}'.")
    print("Run 'npm run build' before executing the validator.")
    sys.exit(1)

# 2. Discover all generated HTML files
html_files = sorted(DIST_DIR.rglob("*.html"))
if not html_files:
    print(f"❌ FATAL ERROR: Zero HTML files found in '{DIST_DIR}'. Prerendering failed or did not run.")
    sys.exit(1)

print(f"Discovered {len(html_files)} HTML files in dist/:\n")

errors = []
titles = {}
descriptions = {}
canonicals = {}
twitter_urls = {}

EXPECTED_INDEXABLE_COUNT = 16
NOINDEX_ROUTES = {
    "404.html",
    "video-vocal-remover/index.html",
    "noise-remover/index.html",
}

# 3. Audit each HTML file
for path in html_files:
    rel_path = path.relative_to(DIST_DIR).as_posix()
    html = path.read_text(encoding="utf-8")

    # A. Title Tag
    m_title = re.search(r"<title>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
    title = m_title.group(1).strip() if m_title else ""
    if not title:
        errors.append(f"{rel_path}: Missing or empty <title> tag.")

    # B. Meta Description
    m_desc = re.search(r'<meta\s+name="description"\s+content="(.*?)"', html, re.IGNORECASE)
    desc = m_desc.group(1).strip() if m_desc else ""
    if not desc:
        errors.append(f"{rel_path}: Missing or empty <meta name=\"description\"> tag.")

    # C. H1 Heading (Check one H1 per indexable page)
    h1_matches = re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.DOTALL | re.IGNORECASE)
    h1_count = len(h1_matches)
    if h1_count == 0:
        errors.append(f"{rel_path}: Missing <h1> tag. Every page must have exactly one primary <h1>.")
    elif h1_count > 1:
        errors.append(f"{rel_path}: Found {h1_count} <h1> tags. Expected exactly 1.")

    # D. Canonical URL
    m_canon = re.search(r'<link\s+rel="canonical"\s+href="(.*?)"', html, re.IGNORECASE)
    canon = m_canon.group(1).strip() if m_canon else ""
    if not canon:
        errors.append(f"{rel_path}: Missing <link rel=\"canonical\"> tag.")
    elif not canon.startswith("https://vocalremover.group/"):
        errors.append(f"{rel_path}: Canonical URL '{canon}' does not use production domain https://vocalremover.group/")

    # E. Open Graph URL
    m_og_url = re.search(r'<meta\s+property="og:url"\s+content="(.*?)"', html, re.IGNORECASE)
    og_url = m_og_url.group(1).strip() if m_og_url else ""
    if not og_url:
        errors.append(f"{rel_path}: Missing <meta property=\"og:url\"> tag.")
    elif og_url != canon:
        errors.append(f"{rel_path}: Open Graph URL '{og_url}' does not match Canonical URL '{canon}'.")

    # F. Twitter URL
    m_tw_url = re.search(r'<meta\s+name="twitter:url"\s+content="(.*?)"', html, re.IGNORECASE)
    tw_url = m_tw_url.group(1).strip() if m_tw_url else ""
    if not tw_url:
        errors.append(f"{rel_path}: Missing <meta name=\"twitter:url\"> tag.")
    elif tw_url != canon:
        errors.append(f"{rel_path}: Twitter URL '{tw_url}' does not match Canonical URL '{canon}'.")

    # G. Robots Directives
    m_robots = re.search(r'<meta\s+name="robots"\s+content="(.*?)"', html, re.IGNORECASE)
    robots = m_robots.group(1).strip() if m_robots else ""

    if rel_path in NOINDEX_ROUTES:
        if robots != "noindex, nofollow":
            errors.append(f"{rel_path}: Expected 'noindex, nofollow' robots directive, found '{robots}'.")
    else:
        if robots != "index, follow":
            errors.append(f"{rel_path}: Expected 'index, follow' robots directive, found '{robots}'.")

        # H. Uniqueness checks across indexable production pages
        if title in titles:
            errors.append(f"Duplicate title between '{rel_path}' and '{titles[title]}': '{title}'")
        else:
            titles[title] = rel_path

        if desc in descriptions:
            errors.append(f"Duplicate meta description between '{rel_path}' and '{descriptions[desc]}': '{desc}'")
        else:
            descriptions[desc] = rel_path

        if canon in canonicals:
            errors.append(f"Duplicate canonical URL between '{rel_path}' and '{canonicals[canon]}': '{canon}'")
        else:
            canonicals[canon] = rel_path

        if tw_url in twitter_urls:
            errors.append(f"Duplicate twitter:url between '{rel_path}' and '{twitter_urls[tw_url]}': '{tw_url}'")
        else:
            twitter_urls[tw_url] = rel_path

    # I. Parse JSON-LD Structured Data
    m_schema = re.search(r'<script\s+type="application/ld\+json"\s+id="jsonld-schema">(.*?)</script>', html, re.DOTALL)
    schema_types = []
    if m_schema:
        schema_raw = m_schema.group(1).strip()
        try:
            parsed = json.loads(schema_raw)
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict) and "@type" in item:
                        stype = item["@type"]
                        schema_types.append(stype)

                        # BlogPosting validation
                        if stype == "BlogPosting":
                            if not item.get("headline"):
                                errors.append(f"{rel_path}: BlogPosting missing 'headline'.")
                            if not item.get("datePublished"):
                                errors.append(f"{rel_path}: BlogPosting missing required 'datePublished'.")
                            if not item.get("image"):
                                errors.append(f"{rel_path}: BlogPosting missing 'image' for rich results.")
                            if not item.get("author"):
                                errors.append(f"{rel_path}: BlogPosting missing 'author'.")
                            if not item.get("publisher"):
                                errors.append(f"{rel_path}: BlogPosting missing 'publisher'.")
            else:
                errors.append(f"{rel_path}: Root JSON-LD must be an array of schemas.")
        except json.JSONDecodeError as jde:
            errors.append(f"{rel_path}: Invalid JSON in ld+json script tag: {jde}")

    # Print route audit status
    status_icon = "🔒 NOINDEX" if rel_path in NOINDEX_ROUTES else "📄 INDEX"
    print(f"[{status_icon}] {rel_path}")
    print(f"  Title ({len(title)}c):       {title}")
    print(f"  Description ({len(desc)}c): {desc[:80]}...")
    print(f"  Canonical / Social: {canon}")
    print(f"  Robots:             {robots}")
    print(f"  Schemas Found:      {schema_types}")
    print()

# 4. Sitemap Validation
sitemap_path = DIST_DIR / "sitemap.xml"
print(f"Verifying XML Sitemap at: {sitemap_path}")
if not sitemap_path.exists():
    errors.append(f"sitemap.xml does not exist at {sitemap_path}")
else:
    try:
        tree = ET.parse(str(sitemap_path))
        root = tree.getroot()
        # XML namespace handling
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = [loc.text.strip() for loc in root.findall("sm:url/sm:loc", ns)]
        lastmods = {
            url.find("sm:loc", ns).text.strip(): (url.find("sm:lastmod", ns).text.strip() if url.find("sm:lastmod", ns) is not None else None)
            for url in root.findall("sm:url", ns)
        }

        print(f"  Total URLs in sitemap: {len(urls)}")

        if len(urls) != EXPECTED_INDEXABLE_COUNT:
            errors.append(f"sitemap.xml contains {len(urls)} URLs. Expected exactly {EXPECTED_INDEXABLE_COUNT}.")

        # Check for banned URLs in sitemap
        for banned in ["/video-vocal-remover/", "/noise-remover/", "404"]:
            for u in urls:
                if banned in u:
                    errors.append(f"sitemap.xml must not include noindex/error route: '{u}'")

        # Verify all 16 indexable canonicals are present
        for canon_url in canonicals.keys():
            if canon_url not in urls:
                errors.append(f"Indexable page '{canon_url}' is missing from sitemap.xml.")

        # Check lastmod sanity
        dates = [d for d in lastmods.values() if d is not None]
        unique_dates = set(dates)
        print(f"  Sitemap URLs with lastmod: {len(dates)} / {len(urls)}")
        print(f"  Distinct modification dates: {sorted(unique_dates)}")
        if len(unique_dates) == 1 and len(dates) == len(urls):
            errors.append("All sitemap URLs share the identical lastmod date. Real modification dates must be used or omitted where unknown.")

    except Exception as e:
        errors.append(f"Failed to parse sitemap.xml: {e}")

# 5. Summary and Exit Code
print("=" * 60)
print(f"VALIDATION AUDIT SUMMARY:")
print(f"  Total HTML Files Checked:    {len(html_files)}")
print(f"  Indexable Production Pages:  {len(canonicals)}")
print(f"  Noindex / Fallback Pages:    {len(NOINDEX_ROUTES)}")
print(f"  Total Errors Encountered:    {len(errors)}")
print("=" * 60)

if errors:
    print("\n❌ VALIDATION ERRORS DETECTED:")
    for err in errors:
        print(f"  • {err}")
    print("\nValidator failed. Exiting with status code 1.")
    sys.exit(1)
else:
    print("\n✅ ALL PRODUCTION HTML, SEO, METADATA, AND SITEMAP CHECKS PASSED PERFECTLY!")
    sys.exit(0)
