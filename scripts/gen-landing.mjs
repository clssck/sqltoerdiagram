// Generates all programmatic SEO pages + the example gallery + the sitemap.
//   node scripts/gen-landing.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { PAGES } from './landing-data.mjs';
import { GALLERY } from './gallery-data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://sqltoerdiagram.com';
const GH = 'https://github.com/royalbhati/sqltoerdiagram';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// mirror src/share.js encodeShare(): deflate-raw + base64url, 'z' flag
function encodeShare(obj) {
  const bytes = deflateRawSync(Buffer.from(JSON.stringify(obj), 'utf8'));
  const b64 = bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return 'z' + b64;
}
const shareHash = (sql, dialect = 'postgres') => '#s=' + encodeShare({ app: 'dbdiga', version: 1, sql, dialect });

const STYLE = `<style>
    :root { --bg:#0e1116; --panel:#161b22; --border:#262d38; --text:#e8edf4; --muted:#9aa4b2; --accent:#5aa7ff; }
    * { box-sizing:border-box; }
    html,body { margin:0; }
    body { background:var(--bg); color:var(--text); font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; line-height:1.6; -webkit-font-smoothing:antialiased; }
    a { color:var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .wrap { max-width:820px; margin:0 auto; padding:0 22px; }
    header { border-bottom:1px solid var(--border); }
    header .wrap { display:flex; align-items:center; gap:10px; height:58px; }
    header svg { width:22px; height:22px; color:var(--accent); }
    header .brand { font-weight:700; color:var(--text); }
    header nav { margin-left:auto; display:flex; gap:20px; font-size:14px; }
    .crumb { font-size:13px; color:var(--muted); padding:16px 0 0; }
    .hero { padding:26px 0 36px; }
    h1 { font-size:42px; line-height:1.1; letter-spacing:-.02em; margin:0 0 16px; }
    h1 .a { color:var(--accent); }
    .lead { font-size:19px; color:var(--muted); max-width:660px; margin:0 0 28px; }
    .cta { display:inline-block; background:var(--accent); color:#fff; font-weight:600; font-size:16px; padding:13px 24px; border-radius:10px; }
    .cta:hover { filter:brightness(1.08); text-decoration:none; }
    .cta.alt { background:transparent; color:var(--accent); border:1px solid var(--border); margin-left:8px; }
    .note { margin-top:14px; font-size:13px; color:var(--muted); }
    section { padding:30px 0; border-top:1px solid var(--border); }
    h2 { font-size:24px; letter-spacing:-.01em; margin:0 0 14px; }
    h3 { font-size:17px; margin:22px 0 4px; }
    p { color:#c4ccd6; }
    ol,ul { color:#c4ccd6; padding-left:22px; }
    li { margin:6px 0; }
    code { background:var(--panel); border:1px solid var(--border); border-radius:5px; padding:1px 5px; font-size:.92em; }
    pre { background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:16px; overflow:auto; font-size:13px; line-height:1.5; color:#cdd6e0; font-family:ui-monospace,Menlo,Consolas,monospace; }
    pre code { background:none; border:0; padding:0; }
    .frame { width:100%; height:480px; border:1px solid var(--border); border-radius:12px; background:var(--panel); }
    .badges { display:flex; flex-wrap:wrap; gap:8px; margin:18px 0 0; }
    .badge { font-size:13px; color:#cdd6e0; background:var(--panel); border:1px solid var(--border); border-radius:999px; padding:6px 12px; }
    .related { display:flex; flex-wrap:wrap; gap:8px 18px; }
    .cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; padding:0; list-style:none; }
    .card { display:block; padding:16px; background:var(--panel); border:1px solid var(--border); border-radius:12px; }
    .card:hover { border-color:var(--accent); text-decoration:none; }
    .card .t { font-weight:600; color:var(--text); margin-bottom:4px; }
    .card .d { font-size:13px; color:var(--muted); }
    footer { border-top:1px solid var(--border); padding:26px 0 50px; color:var(--muted); font-size:14px; }
    footer .wrap { display:flex; gap:18px; flex-wrap:wrap; }
  </style>`;

const HEADER = `<header>
    <div class="wrap">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>
      <a class="brand" href="/">SQL to ER Diagram</a>
      <nav>
        <a href="/">Open tool</a>
        <a href="/examples/">Examples</a>
        <a href="${GH}" target="_blank" rel="noopener">GitHub</a>
      </nav>
    </div>
  </header>`;

const FOOTER = `<footer>
    <div class="wrap">
      <a href="/">SQL to ER Diagram</a>
      <a href="/examples/">Schema examples</a>
      <a href="${GH}" target="_blank" rel="noopener">Open source on GitHub</a>
      <span>Free · runs in your browser</span>
    </div>
  </footer>`;

function doc({ title, description, keywords, url, jsonld, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="keywords" content="${esc(keywords)}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${ORIGIN}/og.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:image" content="${ORIGIN}/og.png" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
${jsonld.map((j) => `  <script type="application/ld+json">\n  ${j}\n  </script>`).join('\n')}
  ${STYLE}
</head>
<body>
  ${HEADER}
  ${body}
  ${FOOTER}
</body>
</html>
`;
}

const faqJsonLd = (faq) => JSON.stringify({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});
const crumbJsonLd = (name, url) => JSON.stringify({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'SQL to ER Diagram', item: `${ORIGIN}/` },
    { '@type': 'ListItem', position: 2, name, item: url },
  ],
});

// ---------- landing page ----------
function landingPage(p) {
  const url = `${ORIGIN}/${p.slug}/`;
  const steps = p.steps.map((s) => `        <li>${s}</li>`).join('\n');
  const why = p.why.map((s) => `        <li>${s}</li>`).join('\n');
  const badges = p.badges.map((b) => `<span class="badge">${b}</span>`).join('');
  const faqHtml = p.faq.map((f) => `      <h3>${esc(f.q)}</h3>\n      <p>${f.a}</p>`).join('\n');
  const related = p.related.map((r) => `<a href="${r.href}">${r.label}</a>`).join('');
  const example2 = p.example2 ? `      <p>${p.example2label || '…becomes:'}</p>\n      <pre>${esc(p.example2)}</pre>\n` : '';
  const body = `<main class="wrap">
    <div class="crumb"><a href="/">Home</a> › ${esc(p.crumb)}</div>
    <div class="hero">
      <h1>${p.h1}</h1>
      <p class="lead">${p.lead}</p>
      <a class="cta" href="/">Open the diagram tool →</a>
      <div class="note">No signup · nothing uploaded · export PNG / SVG / Mermaid / DBML · shareable link</div>
    </div>
    <section><h2>How it works</h2><ol>
${steps}
    </ol></section>
    <section><h2>Example</h2>
      <p>${p.exampleIntro}</p>
      <pre>${esc(p.example)}</pre>
${example2}      <p>${p.exampleAfter} <a href="/">Try it with your own &rarr;</a></p>
    </section>
    <section><h2>Why use it</h2><ul>
${why}
    </ul><div class="badges">${badges}</div></section>
    <section><h2>FAQ</h2>
${faqHtml}
    </section>
    <section><h2>Related</h2><div class="related">${related}</div></section>
  </main>`;
  return doc({ title: p.title, description: p.description, keywords: p.keywords, url, jsonld: [faqJsonLd(p.faq), crumbJsonLd(p.crumb, url)], body });
}

// ---------- gallery example page ----------
function galleryPage(g) {
  const url = `${ORIGIN}/examples/${g.slug}/`;
  const hash = shareHash(g.sql);
  const others = GALLERY.filter((x) => x.slug !== g.slug).map((x) => `<a href="/examples/${x.slug}/">${x.name}</a>`).join('');
  const jsonld = [crumbJsonLd(g.name + ' schema', url), JSON.stringify({
    '@context': 'https://schema.org', '@type': 'TechArticle',
    headline: g.title, description: g.description, url,
  })];
  const body = `<main class="wrap">
    <div class="crumb"><a href="/">Home</a> › <a href="/examples/">Examples</a> › ${esc(g.name)}</div>
    <div class="hero">
      <h1>${esc(g.name)} <span class="a">Schema</span></h1>
      <p class="lead">${g.lead}</p>
      <a class="cta" href="/${hash}">Open this schema in the editor →</a>
      <a class="cta alt" href="/examples/">All examples</a>
    </div>
    <section>
      <h2>Interactive diagram</h2>
      <iframe class="frame" src="/?embed=1${hash}" loading="lazy" title="${esc(g.name)} ER diagram"></iframe>
      <p class="note">Drag to pan, scroll to zoom. <a href="/${hash}">Open it in the full editor</a> to edit, rearrange and export.</p>
    </section>
    <section><h2>About this schema</h2><p>${g.about}</p></section>
    <section><h2>Schema (SQL)</h2><pre>${esc(g.sql)}</pre>
      <p><a href="/${hash}">Open in the editor →</a> to export it as PNG, SVG, Mermaid or DBML.</p>
    </section>
    <section><h2>More examples</h2><div class="related">${others}</div></section>
  </main>`;
  return doc({ title: g.title, description: g.description, keywords: g.keywords, url, jsonld, body });
}

// ---------- gallery index ----------
function galleryIndex() {
  const url = `${ORIGIN}/examples/`;
  const cards = GALLERY.map((g) =>
    `<li><a class="card" href="/examples/${g.slug}/"><div class="t">${esc(g.name)}</div><div class="d">${esc(g.description.split(' — ')[0])}</div></a></li>`).join('\n      ');
  const itemList = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: GALLERY.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.name + ' schema', url: `${ORIGIN}/examples/${g.slug}/` })),
  });
  const body = `<main class="wrap">
    <div class="crumb"><a href="/">Home</a> › Examples</div>
    <div class="hero">
      <h1>Database Schema <span class="a">Examples</span></h1>
      <p class="lead">Ready-made example database schemas — e-commerce, blog, SaaS, social, and more — each as an interactive ER diagram you can open, edit and export.</p>
    </div>
    <section><ul class="cards">
      ${cards}
    </ul></section>
  </main>`;
  return doc({
    title: 'Database Schema Examples — Interactive ER Diagrams',
    description: 'A gallery of example database schemas (e-commerce, blog, SaaS, social network, project management, inventory) as interactive ER diagrams you can open and edit for free.',
    keywords: 'database schema examples, example er diagrams, sample database design, database schema templates',
    url, jsonld: [itemList, crumbJsonLd('Examples', url)], body,
  });
}

// ---------- write everything ----------
const sitemapUrls = [{ loc: `${ORIGIN}/`, priority: '1.0' }, { loc: `${ORIGIN}/prisma/`, priority: '0.8' }];

for (const p of PAGES) {
  const dir = join(ROOT, 'public', p.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), landingPage(p));
  sitemapUrls.push({ loc: `${ORIGIN}/${p.slug}/`, priority: '0.7' });
  console.log('wrote public/' + p.slug + '/index.html');
}

mkdirSync(join(ROOT, 'public', 'examples'), { recursive: true });
writeFileSync(join(ROOT, 'public', 'examples', 'index.html'), galleryIndex());
sitemapUrls.push({ loc: `${ORIGIN}/examples/`, priority: '0.7' });
console.log('wrote public/examples/index.html');
GALLERY.forEach((g) => {
  const dir = join(ROOT, 'public', 'examples', g.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), galleryPage(g));
  sitemapUrls.push({ loc: `${ORIGIN}/examples/${g.slug}/`, priority: '0.6' });
  console.log('wrote public/examples/' + g.slug + '/index.html');
});

const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemapUrls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n') +
  '\n</urlset>\n';
writeFileSync(join(ROOT, 'public', 'sitemap.xml'), sitemap);
console.log(`\nwrote public/sitemap.xml (${sitemapUrls.length} urls)`);
console.log(`${PAGES.length} landing pages + ${GALLERY.length} gallery pages.`);
