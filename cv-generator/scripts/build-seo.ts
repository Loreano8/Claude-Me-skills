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
:root{--brand:#2549eb;--brand-dark:#1e3a8a;--ink:#0f172a;--text:#334155;--muted:#64748b;--line:#e2e8f0;--soft:#eff4ff;--bg:#f8fafc}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,Inter,Arial,sans-serif;-webkit-text-size-adjust:100%}
a{color:var(--brand)}
.top{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.95);backdrop-filter:blur(6px);border-bottom:1px solid var(--line)}
.top .in{max-width:960px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:12px}
.logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--ink);font-weight:800;font-size:18px}
.logo img{width:30px;height:30px}.logo b{color:var(--brand)}
.top nav{margin-left:auto;display:flex;align-items:center;gap:6px}
.top nav a{text-decoration:none;font-weight:600;font-size:14px;color:var(--text);padding:8px 10px;border-radius:10px;white-space:nowrap}
.btn{display:inline-block;background:var(--brand);color:#fff!important;text-decoration:none;font-weight:700;border-radius:12px;padding:12px 20px}
.top .btn{padding:8px 14px;font-size:14px}
main{max-width:760px;margin:0 auto;padding:20px 16px 40px}
.crumbs{font-size:13px;color:var(--muted);margin:4px 0 14px}.crumbs a{color:var(--muted)}
h1{color:var(--ink);font-size:30px;line-height:1.2;letter-spacing:-.02em;margin:0 0 14px}
h2{color:var(--ink);font-size:21px;line-height:1.3;margin:30px 0 10px}
h3{color:var(--ink);font-size:17px;margin:0 0 6px}
p{margin:0 0 12px}
ul{margin:0 0 12px;padding-left:22px}li{margin:4px 0}
.lead{font-size:18px;color:var(--ink)}
.cta{margin:26px 0;padding:20px;border-radius:18px;background:var(--soft);border:1px solid #c7d7fe}
.cta p{margin:0 0 12px;color:var(--ink)}
.ex{margin:16px 0;padding:16px 18px;border-radius:14px;background:#fff;border:1px solid var(--line);border-left:4px solid var(--brand)}
.ex .t{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:6px}
.ex ul{list-style:none;padding:0;margin:0}.ex ul.lines li:first-child{font-weight:700;color:var(--ink)}
.note{font-size:14px;color:var(--muted);margin-top:8px}
details{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 16px;margin:8px 0}
summary{cursor:pointer;font-weight:600;color:var(--ink)}
details p{margin:8px 0 0}
.grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));margin:10px 0 20px}
.grid a{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;text-decoration:none;color:var(--ink);font-weight:600}
.grid a:hover,.top nav a:hover{background:var(--soft)}
footer{border-top:1px solid var(--line);background:#fff;font-size:14px}
footer .in{max-width:960px;margin:0 auto;padding:24px 16px;display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
footer h4{margin:0 0 6px;color:var(--ink);font-size:14px}footer ul{list-style:none;padding:0;margin:0}footer a{color:var(--text);text-decoration:none}
@media (max-width:520px){h1{font-size:25px}.top nav .hide-sm{display:none}}
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

function guidePage(g: Guide): string {
  const sections = g.sections
    .map(
      (s) =>
        `<h2>${esc(s.h)}</h2>${(s.p ?? []).map((p) => `<p>${esc(p)}</p>`).join('')}${s.list ? `<ul>${s.list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}`,
    )
    .join('\n');
  const example = g.example
    ? `<div class="ex"><div class="t">${esc(g.example.title)}</div><ul${g.example.lines.length > 1 ? ' class="lines"' : ''}>${g.example.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${g.example.note ? `<p class="note">${esc(g.example.note)}</p>` : ''}</div>`
    : '';
  const middle = Math.min(2, g.sections.length);
  const [first, rest] = [sections.split('\n').slice(0, middle).join('\n'), sections.split('\n').slice(middle).join('\n')];
  const faq = g.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  const path = `/${g.slug}/`;
  return `${head({
    title: g.title,
    description: g.description,
    path,
    jsonld: [crumbsLd([{ name: 'Accueil', path: '/' }, { name: 'Guides', path: '/guides/' }, { name: g.label, path }]), faqLd(g.faq)],
  })}
<body>
${topBar('guide-' + g.slug)}
<main>
<div class="crumbs"><a href="/">Accueil</a> › <a href="/guides/">Guides</a> › ${esc(g.label)}</div>
<article>
<h1>${esc(g.h1)}</h1>
${g.intro.map((p, i) => `<p${i === 0 ? ' class="lead"' : ''}>${esc(p)}</p>`).join('')}
${first}
${example}
${cta(g, g.kind === 'lettre' ? 'Une lettre personnalisée pour chaque offre, à partir de votre CV et de vos réponses.' : 'Racontez votre parcours en vrac, à l’écrit ou au micro : CVCasa le met en forme dans un CV clair. Gratuit, sans compte.')}
${rest}
<h2>Questions fréquentes</h2>
${faq}
${cta(g, 'Collez une offre d’emploi : votre CV est adapté au poste, avec la lettre qui va avec.')}
</article>
<h2>À lire aussi</h2>
<div class="grid">${related(g)
    .map((r) => `<a href="/${r.slug}/">${esc(r.label)}</a>`)
    .join('')}</div>
</main>
${footer()}
</body>
</html>
`;
}

function hubPage(): string {
  const groups = KINDS.map(
    (k) => `<h2>${KIND_LABEL[k]}</h2><div class="grid">${GUIDES.filter((g) => g.kind === k)
      .map((g) => `<a href="/${g.slug}/">${esc(g.label)}</a>`)
      .join('')}</div>`,
  ).join('\n');
  return `${head({
    title: 'Guides CV et lettre de motivation : modèles et conseils | CVCasa',
    description: 'Des guides concrets pour faire votre CV par métier ou selon votre situation, et écrire une lettre de motivation qui donne envie de vous rencontrer.',
    path: '/guides/',
    jsonld: [crumbsLd([{ name: 'Accueil', path: '/' }, { name: 'Guides', path: '/guides/' }])],
  })}
<body>
${topBar('guides')}
<main>
<div class="crumbs"><a href="/">Accueil</a> › Guides</div>
<h1>Guides pour votre CV et votre lettre de motivation</h1>
<p class="lead">Des conseils concrets, des exemples et les erreurs à éviter, métier par métier.</p>
${groups}
<div class="cta"><p>Prêt à vous lancer ? Votre CV est gratuit, sans compte.</p><a class="btn" href="${appLink('guides')}">Créer mon CV</a></div>
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
