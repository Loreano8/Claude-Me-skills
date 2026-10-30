// Après `vite build` : pages de guides en HTML statique (dist/<slug>/index.html), page /guides/,
// texte de l'accueil lisible sans JavaScript (remplacé par l'application au chargement),
// balisage FAQ pour Google, et plan du site complet.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FAQ } from '../src/lib/faq.ts';
import { GUIDES, KIND_LABEL, type Guide, type GuideKind } from '../seo/guides.ts';

const SITE = (process.env.VITE_PUBLIC_SITE || 'https://cvcasa.com').replace(/\/$/, '');
const DIST = join(import.meta.dirname, '..', 'dist');
const KINDS: GuideKind[] = ['metier', 'pays', 'situation', 'lettre'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');
/** Lien vers l'outil : la provenance (?src=) permet de voir dans l'admin quels guides amènent des inscrits. */
const appLink = (from: string, tab = 'infos') => `/?src=${encodeURIComponent(from)}#${tab}`;

const CSS = `
:root{--brand:#2549eb;--brand-dark:#1e3a8a;--ink:#0f172a;--text:#334155;--muted:#64748b;--line:#e2e8f0;--soft:#eef3ff;--bg:#f8fafc}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.7 system-ui,-apple-system,"Segoe UI",Roboto,Inter,Arial,sans-serif;-webkit-text-size-adjust:100%}
a{color:var(--brand)}
a:focus-visible,summary:focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:8px}
.top{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.top .in{max-width:1040px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:12px}
.logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--ink);font-weight:800;font-size:18px;letter-spacing:-.01em}
.logo img{width:30px;height:30px}.logo b{color:var(--brand)}
.top nav{margin-left:auto;display:flex;align-items:center;gap:6px}
.top nav a{text-decoration:none;font-weight:600;font-size:14px;color:var(--text);padding:8px 10px;border-radius:10px;white-space:nowrap}
.top nav a:not(.btn):hover{background:var(--soft);color:var(--brand)}
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--brand);color:#fff!important;text-decoration:none;font-weight:700;border-radius:12px;padding:12px 20px;box-shadow:0 1px 2px rgba(15,23,42,.08);transition:background .15s,transform .15s}
.btn:hover{background:var(--brand-dark)}.btn:active{transform:translateY(1px)}
.top .btn{padding:8px 14px;font-size:14px}
.hero{background:linear-gradient(180deg,#e8efff 0%,var(--bg) 100%);border-bottom:1px solid var(--line)}
.hero .in{max-width:1040px;margin:0 auto;padding:18px 16px 30px}
.crumbs{font-size:13px;color:var(--muted);margin:0 0 18px}.crumbs a{color:var(--muted);text-decoration:none}.crumbs a:hover{color:var(--brand)}
.badge{display:inline-block;font-size:12px;font-weight:700;color:var(--brand);background:#fff;border:1px solid #c7d7fe;border-radius:999px;padding:3px 10px;letter-spacing:.03em;text-transform:uppercase}
h1{color:var(--ink);font-size:34px;line-height:1.15;letter-spacing:-.025em;margin:12px 0 12px;max-width:760px}
.lead{font-size:18px;color:#1e293b;max-width:720px;margin:0}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-top:18px;font-size:14px;color:var(--muted)}
.meta .btn{font-size:15px}
.wrap{max-width:1040px;margin:0 auto;padding:28px 16px 48px;display:grid;gap:40px}
@media (min-width:980px){.wrap{grid-template-columns:minmax(0,1fr) 270px}}
article{max-width:720px}
h2{color:var(--ink);font-size:22px;line-height:1.3;letter-spacing:-.01em;margin:34px 0 10px;scroll-margin-top:80px}
article > p:first-child{margin-top:0}
p{margin:0 0 12px}
article ul{margin:0 0 12px;padding-left:0;list-style:none}
article ul li{position:relative;padding-left:22px;margin:7px 0}
article ul li::before{content:"";position:absolute;left:4px;top:.72em;width:7px;height:7px;border-radius:99px;background:var(--brand);opacity:.75}
.side{display:none}
@media (min-width:980px){.side{display:block}}
.side .box{position:sticky;top:80px;display:grid;gap:14px}
.toc{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px}
.toc .t,.cv .t{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.toc ol{list-style:none;margin:0;padding:0;counter-reset:s}
.toc li{counter-increment:s;margin:2px 0}
.toc a{display:flex;gap:8px;padding:6px 8px;border-radius:8px;text-decoration:none;color:var(--text);font-size:14px;line-height:1.4}
.toc a::before{content:counter(s);color:var(--brand);font-weight:700;min-width:12px}
.toc a:hover{background:var(--soft);color:var(--ink)}
.mini{background:var(--ink);color:#fff;border-radius:16px;padding:18px}
.mini p{margin:0 0 12px;font-weight:600;line-height:1.5}
.mini .btn{width:100%;justify-content:center}
.cv{margin:22px 0;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 10px 30px -12px rgba(15,23,42,.18)}
.cv .bar{height:6px;background:linear-gradient(90deg,var(--brand),#60a5fa)}
.cv .body{padding:18px 22px}
.cv .role{font-weight:700;color:var(--ink);margin:0 0 8px}
.cv ul{margin:0}
.cv blockquote{margin:0;padding-left:14px;border-left:3px solid #c7d7fe;color:#1e293b;font-style:italic}
.cv .note{font-size:14px;color:var(--muted);margin:12px 0 0;padding-top:12px;border-top:1px dashed var(--line)}
.cta{margin:30px 0;padding:24px;border-radius:20px;background:linear-gradient(135deg,var(--brand) 0%,var(--brand-dark) 100%);color:#fff;display:grid;gap:14px}
.cta p{margin:0;font-size:17px;font-weight:600;line-height:1.5;color:#fff}
.cta .btn{background:#fff;color:var(--brand)!important;justify-self:start}
.cta .btn:hover{background:#eef3ff}
details{background:#fff;border:1px solid var(--line);border-radius:14px;padding:0;margin:10px 0}
summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:12px;padding:14px 16px;font-weight:600;color:var(--ink)}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";color:var(--brand);font-size:22px;line-height:1;transition:transform .2s}
details[open] summary::after{transform:rotate(45deg)}
details p{margin:0;padding:0 16px 14px}
.grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));margin:12px 0 8px}
.grid a{display:flex;flex-direction:column;gap:2px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;text-decoration:none;color:var(--ink);font-weight:600;transition:border-color .15s,box-shadow .15s,transform .15s}
.grid a small{font-size:12px;font-weight:600;color:var(--muted)}
.grid a:hover{border-color:#a5b8fc;box-shadow:0 6px 18px -8px rgba(37,73,235,.35);transform:translateY(-1px)}
.related{max-width:1040px;margin:0 auto;padding:0 16px 48px}
.related h2{margin-top:0}
footer{border-top:1px solid var(--line);background:#fff;font-size:14px}
footer .in{max-width:1040px;margin:0 auto;padding:28px 16px;display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
footer h4{margin:0 0 8px;color:var(--ink);font-size:14px}footer ul{list-style:none;padding:0;margin:0}footer li{margin:0}footer a{display:inline-block;padding:7px 0;color:var(--text);text-decoration:none}footer a:hover{color:var(--brand)}
@media (max-width:560px){h1{font-size:27px}.lead{font-size:17px}.top nav .hide-sm{display:none}.cta{padding:20px}}
`;

function head(o: { title: string; description: string; path: string; jsonld: unknown[] }): string {
  const url = SITE + o.path;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#2549eb">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<meta property="og:site_name" content="CVCasa">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
${o.jsonld.map((j) => `<script type="application/ld+json">${json(j)}</script>`).join('\n')}
<style>${CSS}</style>
</head>`;
}

function topBar(from: string): string {
  return `<header class="top"><div class="in">
<a class="logo" href="/"><img src="/icons/icon.svg" alt="" width="30" height="30"><span>CV<b>Casa</b></span></a>
<nav><a class="hide-sm" href="/guides/">Guides</a><a class="btn" href="${appLink(from)}">Créer mon CV</a></nav>
</div></header>`;
}

function footer(): string {
  const cols = KINDS.map(
    (k) => `<div><h4>${KIND_LABEL[k]}</h4><ul>${GUIDES.filter((g) => g.kind === k)
      .map((g) => `<li><a href="/${g.slug}/">${esc(g.label)}</a></li>`)
      .join('')}</ul></div>`,
  ).join('');
  return `<footer><div class="in">${cols}<div><h4>CVCasa</h4><ul><li><a href="/">Accueil</a></li><li><a href="/guides/">Tous les guides</a></li><li><a href="/#confidentialite">Confidentialité</a></li><li><a href="/#contact">Nous contacter</a></li></ul></div></div></footer>`;
}

const faqLd = (items: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

const crumbsLd = (items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.path })),
});

function cta(g: Guide, text: string): string {
  const tab = g.kind === 'lettre' ? 'lettre' : 'infos';
  const label = g.kind === 'lettre' ? 'Rédiger ma lettre' : 'Créer mon CV gratuitement';
  return `<div class="cta"><p>${esc(text)}</p><a class="btn" href="${appLink('guide-' + g.slug, tab)}">${label}</a></div>`;
}

function related(g: Guide): Guide[] {
  const same = GUIDES.filter((x) => x.kind === g.kind && x.slug !== g.slug);
  const other = GUIDES.filter((x) => x.kind !== g.kind);
  return [...same.slice(0, 3), ...other.slice(0, 3)];
}

const slugify = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Temps de lecture estimé (200 mots par minute). */
function readingMinutes(g: Guide): number {
  const text = [...g.intro, ...g.sections.flatMap((s) => [s.h, ...(s.p ?? []), ...(s.list ?? [])]), ...(g.example?.lines ?? []), ...g.faq.flatMap((f) => [f.q, f.a])].join(' ');
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}

function exampleBlock(g: Guide): string {
  if (!g.example) return '';
  const { title, lines, note } = g.example;
  const body =
    lines.length > 1
      ? `<p class="role">${esc(lines[0])}</p><ul>${lines.slice(1).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`
      : `<blockquote>${esc(lines[0])}</blockquote>`;
  return `<figure class="cv"><div class="bar"></div><div class="body"><div class="t">${esc(title)}</div>${body}${note ? `<p class="note">${esc(note)}</p>` : ''}</div></figure>`;
}

function guidePage(g: Guide): string {
  const blocks = g.sections.map(
    (s) =>
      `<h2 id="${slugify(s.h)}">${esc(s.h)}</h2>${(s.p ?? []).map((p) => `<p>${esc(p)}</p>`).join('')}${s.list ? `<ul>${s.list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}`,
  );
  const middle = Math.min(2, blocks.length);
  const faq = g.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  const toc = [...g.sections.map((s) => ({ id: slugify(s.h), h: s.h })), { id: 'questions-frequentes', h: 'Questions fréquentes' }];
  const path = `/${g.slug}/`;
  const tab = g.kind === 'lettre' ? 'lettre' : 'infos';
  const action = g.kind === 'lettre' ? 'Rédiger ma lettre' : 'Créer mon CV gratuitement';
  const from = 'guide-' + g.slug;
  return `${head({
    title: g.title,
    description: g.description,
    path,
    jsonld: [crumbsLd([{ name: 'Accueil', path: '/' }, { name: 'Guides', path: '/guides/' }, { name: g.label, path }]), faqLd(g.faq)],
  })}
<body>
${topBar(from)}
<header class="hero"><div class="in">
<nav class="crumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a> › <a href="/guides/">Guides</a> › ${esc(g.label)}</nav>
<span class="badge">${KIND_LABEL[g.kind]}</span>
<h1>${esc(g.h1)}</h1>
<p class="lead">${esc(g.intro[0])}</p>
<div class="meta"><a class="btn" href="${appLink(from, tab)}">${action}</a><span>Lecture : ${readingMinutes(g)} min · Gratuit, sans compte</span></div>
</div></header>
<div class="wrap">
<article>
${g.intro.slice(1).map((p) => `<p>${esc(p)}</p>`).join('')}
${blocks.slice(0, middle).join('\n')}
${exampleBlock(g)}
${cta(g, g.kind === 'lettre' ? 'Une lettre personnalisée pour chaque offre, à partir de votre CV et de vos réponses.' : 'Racontez votre parcours en vrac, à l’écrit ou au micro : CVCasa le met en forme dans un CV clair. Gratuit, sans compte.')}
${blocks.slice(middle).join('\n')}
<h2 id="questions-frequentes">Questions fréquentes</h2>
${faq}
${cta(g, 'Collez une offre d’emploi : votre CV est adapté au poste, avec la lettre qui va avec.')}
</article>
<aside class="side" aria-label="Sur cette page"><div class="box">
<nav class="toc"><div class="t">Sur cette page</div><ol>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.h)}</a></li>`).join('')}</ol></nav>
<div class="mini"><p>Votre CV prêt en quelques minutes, à partir de vos mots.</p><a class="btn" href="${appLink(from, tab)}">${action}</a></div>
</div></aside>
</div>
<section class="related"><h2>À lire aussi</h2>
<div class="grid">${related(g)
    .map((r) => `<a href="/${r.slug}/"><small>${KIND_LABEL[r.kind]}</small>${esc(r.label)}</a>`)
    .join('')}</div></section>
${footer()}
</body>
</html>
`;
}

function hubPage(): string {
  const groups = KINDS.map(
    (k) => `<h2 id="${k}">${KIND_LABEL[k]}</h2><div class="grid">${GUIDES.filter((g) => g.kind === k)
      .map((g) => `<a href="/${g.slug}/"><small>${readingMinutes(g)} min de lecture</small>${esc(g.label)}</a>`)
      .join('')}</div>`,
  ).join('\n');
  return `${head({
    title: 'Guides CV et lettre de motivation : modèles et conseils | CVCasa',
    description: 'Des guides concrets pour faire votre CV par métier, par pays ou selon votre situation, et écrire une lettre de motivation qui donne envie de vous rencontrer.',
    path: '/guides/',
    jsonld: [crumbsLd([{ name: 'Accueil', path: '/' }, { name: 'Guides', path: '/guides/' }])],
  })}
<body>
${topBar('guides')}
<header class="hero"><div class="in">
<nav class="crumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a> › Guides</nav>
<span class="badge">${GUIDES.length} guides gratuits</span>
<h1>Guides pour votre CV et votre lettre de motivation</h1>
<p class="lead">Des conseils concrets, des exemples et les erreurs à éviter, métier par métier et pays par pays.</p>
<div class="meta"><a class="btn" href="${appLink('guides')}">Créer mon CV gratuitement</a></div>
</div></header>
<main class="related" style="padding-top:28px">
${groups}
${'<div class="cta"><p>Prêt à vous lancer ? Votre CV est gratuit, sans compte.</p><a class="btn" href="' + appLink('guides') + '">Créer mon CV</a></div>'}
</main>
${footer()}
</body>
</html>
`;
}

/** Texte de l'accueil, servi tel quel à Google et aux connexions lentes ; l'application le remplace au chargement. */
function landingStatic(): string {
  const links = KINDS.map(
    (k) => `<h2 style="color:#0f172a;font-size:21px;font-weight:700;margin:28px 0 8px">${KIND_LABEL[k]}</h2><ul style="list-style:disc;padding-left:22px">${GUIDES.filter((g) => g.kind === k)
      .map((g) => `<li><a href="/${g.slug}/">${esc(g.label)}</a></li>`)
      .join('')}</ul>`,
  ).join('');
  return `<div id="seo-static" style="max-width:760px;margin:0 auto;padding:40px 16px;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#334155">
<h1 style="color:#0f172a;font-size:30px;font-weight:800;line-height:1.2;margin:0 0 12px">Votre CV gratuit, adapté à chaque offre, en quelques minutes</h1>
<p>Écrivez votre parcours en vrac, collez l’annonce : CVCasa met en forme un CV aux normes actuelles, adapté au poste, avec la lettre de motivation et la préparation de l’entretien.</p>
<p style="margin:16px 0"><a href="/#infos" style="display:inline-block;background:#2549eb;color:#fff;text-decoration:none;font-weight:700;border-radius:12px;padding:12px 20px">Créer mon CV gratuitement</a></p>
<h2 style="color:#0f172a;font-size:21px;font-weight:700;margin:28px 0 8px">Comment ça marche</h2>
<ol style="list-style:decimal;padding-left:22px"><li>Écrivez ou dictez votre parcours, ou importez votre ancien CV (PDF ou photo).</li><li>Collez l’offre : vous obtenez un CV adapté au poste et un score de compatibilité.</li><li>Téléchargez en PDF et postulez, avec la lettre de motivation qui va avec.</li></ol>
<h2 style="color:#0f172a;font-size:21px;font-weight:700;margin:28px 0 8px">Questions fréquentes</h2>
${FAQ.map((f) => `<h3 style="font-size:17px;font-weight:600;color:#0f172a;margin:14px 0 4px">${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}
${links}
</div>`;
}

function sitemap(): string {
  const day = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', pr: '1.0' },
    { loc: '/guides/', pr: '0.8' },
    ...GUIDES.map((g) => ({ loc: `/${g.slug}/`, pr: '0.7' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u.loc}</loc><lastmod>${day}</lastmod><priority>${u.pr}</priority></url>`).join('\n')}
</urlset>
`;
}

for (const g of GUIDES) {
  mkdirSync(join(DIST, g.slug), { recursive: true });
  writeFileSync(join(DIST, g.slug, 'index.html'), guidePage(g));
}
mkdirSync(join(DIST, 'guides'), { recursive: true });
writeFileSync(join(DIST, 'guides', 'index.html'), hubPage());
writeFileSync(join(DIST, 'sitemap.xml'), sitemap());

const indexPath = join(DIST, 'index.html');
const index = readFileSync(indexPath, 'utf8');
if (!index.includes('<div id="root"></div>')) throw new Error('index.html : <div id="root"></div> introuvable');
writeFileSync(
  indexPath,
  index
    .replace('<div id="root"></div>', `<div id="root">${landingStatic()}</div>`)
    .replace('</head>', `<script type="application/ld+json">${json(faqLd(FAQ))}</script>\n  </head>`),
);

console.log(`SEO : ${GUIDES.length} guides, page /guides/, accueil statique, plan du site (${GUIDES.length + 2} adresses).`);
