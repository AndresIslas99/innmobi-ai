// Build static multi-page site from docs/_src/ into docs/<slug>/index.html
// Usage: node scripts/build-site.mjs
//
// - Reads data/pages.json (site metadata + page list + posts)
// - Reads docs/_src/layout.html + partials (head/header/footer)
// - For each page: docs/_src/pages/<slug>.html (or pages/index.html for "")
// - Writes docs/<slug>/index.html (URL-clean)
// - Generates docs/sitemap.xml from pages + posts
// - Copies assets: images/ → docs/assets/images/, brochure/brochure.pdf → docs/assets/brochure.pdf

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'docs', '_src');
const OUT = path.join(ROOT, 'docs');
const DATA = path.join(ROOT, 'data', 'pages.json');

async function main() {
  console.log('Innmobi.ai — Building site');
  const data = JSON.parse(await fs.readFile(DATA, 'utf-8'));
  const layout = await fs.readFile(path.join(SRC, 'layout.html'), 'utf-8');
  const partials = {
    head: await fs.readFile(path.join(SRC, 'partials', 'head.html'), 'utf-8'),
    header: await fs.readFile(path.join(SRC, 'partials', 'header.html'), 'utf-8'),
    footer: await fs.readFile(path.join(SRC, 'partials', 'footer.html'), 'utf-8'),
  };

  // Copy assets to docs/assets/
  await copyAssets();

  // Build pages
  const allPages = [...data.pages, ...data.posts];
  for (const page of allPages) {
    await renderPage(page, layout, partials, data);
  }

  // Generate sitemap.xml
  await writeSitemap(allPages, data.site.url);

  console.log(`✅ Built ${allPages.length} pages → docs/`);
}

async function renderPage(page, layout, partials, data) {
  const slug = page.slug;
  const srcPath = path.join(SRC, 'pages', slug === '' ? 'index.html' : `${slug}.html`);
  let content;
  try {
    content = await fs.readFile(srcPath, 'utf-8');
  } catch {
    console.warn(`  ⚠ skipping ${slug || '<root>'} (no source at ${path.relative(ROOT, srcPath)})`);
    return;
  }

  const canonicalPath = slug === '' ? '/' : `/${slug}/`;
  const outDir = slug === '' ? OUT : path.join(OUT, slug);
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'index.html');

  const isPost = data.posts.some((p) => p.slug === slug);
  const ogType = isPost ? 'article' : (slug === '' ? 'website' : 'website');

  const vars = {
    title: page.title,
    description: page.description,
    siteUrl: data.site.url,
    canonicalPath,
    ogImage: page.ogImage || '/og/home.png',
    ogType,
    extraHead: page.extraHead || '',
    bodyClass: page.bodyClass || `page-${slug.replace(/\//g, '-') || 'home'}`,
    jsonLd: buildJsonLd(page, data, isPost),
    content,
  };

  let html = layout;
  // partials first
  html = html.replace(/\{\{>\s*head\s*\}\}/g, partials.head);
  html = html.replace(/\{\{>\s*header\s*\}\}/g, partials.header);
  html = html.replace(/\{\{>\s*footer\s*\}\}/g, partials.footer);
  // variables
  html = html.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (m, key) =>
    vars[key] !== undefined ? String(vars[key]) : ''
  );

  await fs.writeFile(outFile, html, 'utf-8');
  console.log(`  ✓ ${path.relative(ROOT, outFile)}`);
}

function buildJsonLd(page, data, isPost) {
  const url = `${data.site.url}${page.slug === '' ? '/' : `/${page.slug}/`}`;
  const blocks = [];

  if (page.slug === '') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Innmobi.ai',
      url: data.site.url,
      logo: `${data.site.url}/assets/images/logo-innmobi-ai.svg`,
      sameAs: [data.site.social.linkedin, data.site.social.x, data.site.social.instagram].filter(Boolean),
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: data.site.email,
        telephone: `+${data.site.whatsapp}`,
        areaServed: 'MX',
        availableLanguage: ['es-MX'],
      },
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Ciudad de México',
        addressCountry: 'MX',
      },
    });
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Innmobi.ai',
      description: data.site.description,
      brand: { '@type': 'Brand', name: 'Innmobi.ai' },
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'MXN',
        availability: 'https://schema.org/InStock',
        url: `${data.site.url}/precios/`,
      },
    });
  }

  if (page.slug && page.slug !== '') {
    const breadcrumbItems = [{ name: 'Inicio', url: data.site.url + '/' }];
    const parts = page.slug.split('/');
    let acc = '';
    for (const p of parts) {
      acc += p + '/';
      breadcrumbItems.push({ name: titleCase(p.replace(/-/g, ' ')), url: data.site.url + '/' + acc });
    }
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbItems.map((b, i) => ({
        '@type': 'ListItem', position: i + 1, name: b.name, item: b.url,
      })),
    });
  }

  if (isPost) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: page.title,
      description: page.description,
      datePublished: page.publishedAt,
      author: { '@type': 'Organization', name: 'Innmobi.ai' },
      publisher: {
        '@type': 'Organization',
        name: 'Innmobi.ai',
        logo: { '@type': 'ImageObject', url: `${data.site.url}/assets/images/logo-innmobi-ai.svg` },
      },
      image: `${data.site.url}${page.ogImage || '/og/home.png'}`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    });
  }

  return blocks
    .map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`)
    .join('\n');
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function writeSitemap(pages, siteUrl) {
  const urls = pages
    .map((p) => `  <url>
    <loc>${siteUrl}${p.slug === '' ? '/' : `/${p.slug}/`}</loc>
    <priority>${p.priority ?? 0.5}</priority>
    ${p.publishedAt ? `<lastmod>${p.publishedAt}</lastmod>` : ''}
  </url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  await fs.writeFile(path.join(OUT, 'sitemap.xml'), xml, 'utf-8');
  console.log(`  ✓ docs/sitemap.xml (${pages.length} URLs)`);
}

async function copyAssets() {
  const tasks = [
    { from: path.join(ROOT, 'images'), to: path.join(OUT, 'assets', 'images'), kind: 'dir' },
    { from: path.join(ROOT, 'screenshots'), to: path.join(OUT, 'assets', 'screenshots'), kind: 'dir' },
    { from: path.join(ROOT, 'brochure', 'brochure.pdf'), to: path.join(OUT, 'assets', 'brochure.pdf'), kind: 'file' },
  ];
  for (const t of tasks) {
    if (t.kind === 'dir') {
      await copyDir(t.from, t.to);
    } else {
      try {
        await fs.mkdir(path.dirname(t.to), { recursive: true });
        await fs.copyFile(t.from, t.to);
      } catch (e) {
        console.warn(`  ⚠ skip copy ${path.relative(ROOT, t.from)}: ${e.message}`);
      }
    }
  }
  console.log('  ✓ assets copied to docs/assets/');
}

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const items = await fs.readdir(src, { withFileTypes: true });
  for (const item of items) {
    const sp = path.join(src, item.name);
    const dp = path.join(dst, item.name);
    if (item.isDirectory()) await copyDir(sp, dp);
    else await fs.copyFile(sp, dp);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
