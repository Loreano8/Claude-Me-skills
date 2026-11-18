// Tournage du tutoriel CVCasa (version 3 : parcours express, portfolio, synchronisation) en version ordinateur (1440×900) : une vidéo par chapitre, curseur visible.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.argv[2];
const S = path.dirname(__dirname);
const APP = 'http://localhost:5173';
const API = 'http://localhost:8787';
const VIEW = { width: 1440, height: 900 };
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
// TUTO_LANG=en : version anglaise (à filmer avec le serveur de démo lancé en DEMO_LANG=en).
const EN = process.env.TUTO_LANG === 'en';
const L = (fr, en) => (EN ? en : fr);

const OFFER_FR = `Groupe Logistique Ouest recrute à Cotonou :
1) Responsable comptable (CDI)
2) Contrôleur de gestion (CDI)

Missions du responsable comptable : tenue de la comptabilité SYSCOHADA, déclarations fiscales, clôtures mensuelles, encadrement d'une équipe de 3 personnes.
Profil : Bac+5 en comptabilité, 5 ans d'expérience, maîtrise d'un ERP.
Dossier : CV + lettre de motivation à recrutement@glo.bj`;
const OFFER_EN = `West Logistics Group is hiring in Cotonou:
1) Chief Accountant (permanent)
2) Management Controller (permanent)

Chief Accountant duties: SYSCOHADA bookkeeping, tax returns, monthly closings, leading a team of 3.
Profile: Master's in accounting, 5 years of experience, ERP skills.
Apply: CV + cover letter to recrutement@glo.bj`;
const OFFER = L(OFFER_FR, OFFER_EN);

const PARCOURS = `Prénom Nom, comptable, 01 00 00 00 00, prenom.nom@email.com. Master en finance en 2020. Depuis 2021 comptable dans une société de transport : déclarations fiscales, paie de 120 salariés, j'ai réduit les retards de paiement de 30 %. Avant : stage de 6 mois en cabinet d'audit. Excel, Sage. Français, anglais courant.`;

const ALL_TOURS = ['infos', 'apercu', 'offre', 'lettre', 'suivi', 'documents', 'scanner', 'dossier', 'veille', 'plus', 'reglages', 'accueil', 'portfolio'];

// Curseur dessiné dans la page (les captures d'écran n'affichent pas le vrai) et onde au clic.
const CURSOR = `
(() => {
  const add = () => {
    if (document.getElementById('demo-cursor')) return;
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M3 2 L3 24 L9 18.5 L13 27.5 L17 25.7 L13 17 L21 17 Z" fill="#0f172a" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(' + (window.__cx ?? 720) + 'px,' + (window.__cy ?? 450) + 'px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))';
    document.body.appendChild(c);
    addEventListener('mousemove', (e) => { window.__cx = e.clientX; window.__cy = e.clientY; c.style.transform = 'translate(' + (e.clientX - 3) + 'px,' + (e.clientY - 2) + 'px)'; }, true);
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;left:' + (e.clientX - 22) + 'px;top:' + (e.clientY - 22) + 'px;width:44px;height:44px;border-radius:50%;background:rgba(37,73,235,.35);border:2px solid rgba(37,73,235,.8);transform:scale(.3);opacity:1;transition:transform .45s ease-out,opacity .45s ease-out';
      document.body.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.3)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 500);
    }, true);
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
})();`;

const pause = (p, ms) => p.waitForTimeout(ms);

let mouse = { x: 720, y: 450 };
async function moveTo(p, x, y, ms = 650) {
  const steps = Math.max(8, Math.round(ms / 16));
  const from = { ...mouse };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await p.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await p.waitForTimeout(16);
  }
  mouse = { x, y };
}
/** Fait défiler jusqu'à l'élément si besoin, y amène le curseur, puis clique. */
async function click(p, loc, { scroll = true, wait = 250 } = {}) {
  loc = loc.first();
  if (scroll) await reveal(p, loc);
  const b = await loc.boundingBox();
  await moveTo(p, b.x + b.width / 2, b.y + b.height / 2);
  await pause(p, wait);
  await p.mouse.down(); await pause(p, 90); await p.mouse.up();
}
/** Amène l'élément vers le milieu de l'écran par un défilement doux. */
async function reveal(p, loc, at = 0.45) {
  const b = await loc.boundingBox();
  const target = VIEW.height * at - b.height / 2;
  const dy = b.y - Math.max(90, target);
  if (b.y > 80 && b.y + b.height < VIEW.height - 20 && Math.abs(dy) < 260) return;
  await smoothScroll(p, dy);
}
async function smoothScroll(p, dy, ms = 700) {
  const steps = Math.max(10, Math.round(ms / 16));
  const y0 = await p.evaluate(() => scrollY);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await p.evaluate((y) => scrollTo(0, y), y0 + dy * e);
    await p.waitForTimeout(16);
  }
}
async function type(p, loc, text, delay = 18) {
  await click(p, loc);
  await loc.first().pressSequentially(text, { delay });
}

async function scene(browser, name, state, run) {
  const saved = path.join(OUT, 'state-' + name + '.json');
  if (ONLY && !ONLY.includes(name)) return fs.existsSync(saved) ? JSON.parse(fs.readFileSync(saved, 'utf8')) : state;
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, storageState: state ?? undefined, acceptDownloads: true });
  await ctx.addInitScript(CURSOR);
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept());
  p.on('pageerror', (e) => console.log(name, 'ERREUR', e.message));
  mouse = { x: 720, y: 450 };
  const dir = path.join(OUT, 'frames-' + name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  let recording = true;
  const loop = (async () => {
    while (recording) {
      try {
        const buf = await p.screenshot({ type: 'jpeg', quality: 90, timeout: 5000 });
        const file = String(frames.length).padStart(5, '0') + '.jpg';
        fs.writeFileSync(path.join(dir, file), buf);
        frames.push({ file, t: Date.now() });
      } catch { await new Promise((r) => setTimeout(r, 50)); }
    }
  })();
  try { await run(p); } catch (e) { await p.screenshot({ path: path.join(OUT, name + '-err.png') }); throw e; }
  recording = false;
  await loop;
  const next = await ctx.storageState();
  fs.writeFileSync(saved, JSON.stringify(next));
  await ctx.close();
  let list = 'ffconcat version 1.0\n';
  frames.forEach((f, i) => {
    const d = ((frames[i + 1]?.t ?? f.t + 70) - f.t) / 1000;
    list += 'file ' + f.file + '\nduration ' + d.toFixed(3) + '\n';
  });
  list += 'file ' + frames[frames.length - 1].file + '\n';
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  require('child_process').execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', path.join(OUT, name + '.mp4')]);
  fs.rmSync(dir, { recursive: true, force: true });
  const secs = (frames[frames.length - 1].t - frames[0].t) / 1000;
  console.log(name, secs.toFixed(2) + ' s', (frames.length / secs).toFixed(1) + ' i/s');
  return next;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // Un « ancien CV » en PDF à importer (le serveur de démonstration renvoie un CV fictif, sans nom réel).
  const pdfFile = path.join(OUT, 'ancien-cv.pdf');
  { const mk = await browser.newPage(); await mk.setContent('<h1>CV</h1><p>Comptable</p>'); await mk.pdf({ path: pdfFile }); await mk.close(); }

  const id = 'demo.web' + Date.now() + '@email.com';
  const reg = await (await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-device-id': 'device-web-' + Date.now() }, body: JSON.stringify({ identifier: id, password: 'secret12', name: L('Prénom', 'First') }) })).json();
  await fetch(API + '/api/admin/credits', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer demo' }, body: JSON.stringify({ identifier: id, credits: 24 }) });

  const warm = await browser.newContext({ viewport: VIEW });
  const w = await warm.newPage();
  await w.goto(APP + '/?lang=' + L('fr', 'en') + '#accueil');
  await w.evaluate(([t, lang]) => {
    localStorage.setItem('cvcasa-tours', JSON.stringify(t));
    localStorage.setItem('cvcasa-lang', lang);
    localStorage.setItem('cvcasa-pays', JSON.stringify({ country: 'BJ', at: Date.now() }));
    localStorage.setItem('cvcasa-sync', JSON.stringify({ state: { enabled: true, announced: true, deleted: {}, owner: null, lastSync: null }, version: 0 }));
  }, [ALL_TOURS, L('fr', 'en')]);
  for (const h of ['accueil', 'apercu', 'offre', 'lettre', 'veille', 'suivi', 'portfolio', 'reglages']) {
    await w.goto(APP + '/#' + h);
    await w.waitForTimeout(1500);
  }
  await w.evaluate(async () => { await import('/src/pdf/render.tsx'); await import('/src/portfolio/PortfolioView.tsx'); });
  await w.evaluate((r) => localStorage.setItem('cv-studio-account', JSON.stringify({ state: { token: r.token, user: r.user }, version: 0 })), reg);
  await w.waitForTimeout(800);
  let state = await warm.storageState();
  await warm.close();

  // 1. Accueil : la promesse, le portfolio, les modèles, puis « Importer mon ancien CV »
  state = await scene(browser, 'w1-accueil', state, async (p) => {
    await p.goto(APP + '/#accueil'); await pause(p, 2200);
    await moveTo(p, 900, 560, 800); await pause(p, 400);
    await reveal(p, p.locator('#portfolio-titre'), 0.2); await pause(p, 2800);
    await reveal(p, p.locator('#modeles-titre'), 0.12); await pause(p, 2000);
    await smoothScroll(p, -9000, 900); await pause(p, 600);
    await click(p, p.getByRole('button', { name: L('Importer mon ancien CV', 'Import my old CV') }).first());
    await pause(p, 1200);
  });

  // 2. Mon CV : importer l'ancien CV, le nouveau est prêt tout seul
  state = await scene(browser, 'w2-cv', state, async (p) => {
    await p.goto(APP + '/#infos'); await pause(p, 1600);
    const imp = p.getByRole('button', { name: L(/Importer mon ancien CV/, /Import my old CV/) }).first();
    await reveal(p, imp); const b = await imp.boundingBox();
    await moveTo(p, b.x + b.width / 2, b.y + b.height / 2); await pause(p, 300);
    await p.mouse.down(); await pause(p, 90); await p.mouse.up();
    await p.locator('input[type=file]').first().setInputFiles(pdfFile);
    await p.getByText(L('Votre CV est prêt.', 'Your CV is ready.')).waitFor({ timeout: 25000 });
    await pause(p, 2400);
    await moveTo(p, 980, 420, 800); await pause(p, 1200);
    await smoothScroll(p, 500, 1300); await pause(p, 1400);
  });

  // 3. Modèle, couleur, PDF
  state = await scene(browser, 'w3-modele', state, async (p) => {
    await p.goto(APP + '/#apercu'); await pause(p, 1500);
    await click(p, p.getByRole('button', { name: L(/Changer de modèle ou de couleur/, /Change the template or colour/) })); await pause(p, 1000);
    await click(p, p.getByText('Finance', { exact: true })); await pause(p, 1800);
    await click(p, p.getByText(L('Élégant', 'Elegant'), { exact: true })); await pause(p, 1800);
    await smoothScroll(p, -3000, 800); await pause(p, 400);
    await click(p, p.getByRole('button', { name: L('PDF gratuit', 'Free PDF'), exact: true })); await pause(p, 2200);
  });

  // 4. Offre : coller l'annonce, une question, CV adapté et score
  state = await scene(browser, 'w4-offre', state, async (p) => {
    await p.goto(APP + '/#offre'); await pause(p, 1300);
    const area = p.getByPlaceholder(L(/Ou collez ici le texte/, /Or paste the job text/));
    await click(p, area); await pause(p, 300);
    await area.fill(OFFER); await pause(p, 1300);
    await click(p, p.getByRole('button', { name: L('Adapter mon CV à l’offre', 'Tailor my CV to the job') }));
    await p.getByText(L('Avant d’adapter votre CV', 'Before tailoring your CV'), { exact: true }).waitFor({ timeout: 20000 });
    await reveal(p, p.getByText(L('Avant d’adapter votre CV', 'Before tailoring your CV'), { exact: true }), 0.3); await pause(p, 1500);
    await click(p, p.getByRole('button', { name: L('Comptable', 'Accountant'), exact: true })); await pause(p, 700);
    await click(p, p.getByRole('button', { name: L(/^Adapter mon CV\W*1 crédit$/, /^Tailor my CV\W*1 credit$/) }));
    await p.getByText(L('Analyse de l’offre', 'Job analysis')).waitFor({ timeout: 20000 });
    await reveal(p, p.getByText(L('Analyse de l’offre', 'Job analysis')), 0.2); await pause(p, 2300);
    await smoothScroll(p, 450, 1000); await pause(p, 1800);
  });

  // 5. Lettre
  state = await scene(browser, 'w5-lettre', state, async (p) => {
    await p.goto(APP + '/#lettre'); await pause(p, 1300);
    await click(p, p.getByRole('button', { name: L('Générer la lettre', 'Generate the letter') }));
    await p.getByText(L('Pour une lettre qui vous ressemble', 'For a letter that sounds like you')).waitFor({ timeout: 20000 });
    await reveal(p, p.getByText(L('Pour une lettre qui vous ressemble', 'For a letter that sounds like you')), 0.25); await pause(p, 1200);
    await type(p, p.getByLabel(L('Qu’est-ce qui vous attire dans cette entreprise ?', 'What attracts you to this company?')), L('Je travaille déjà avec des transporteurs et je connais vos clients.', 'I already work with carriers and I know your clients.'), 14);
    await pause(p, 600);
    await click(p, p.getByRole('button', { name: L('Générer la lettre', 'Generate the letter') }));
    await p.getByLabel(L('Corps de la lettre', 'Body of the letter')).waitFor(); await pause(p, 2200);
    await moveTo(p, 1100, 560, 700); await pause(p, 1200);
    await smoothScroll(p, 600, 1200); await pause(p, 1500);
  });

  // 6. Veille emploi
  state = await scene(browser, 'w6-veille', state, async (p) => {
    await p.goto(APP + '/#veille'); await pause(p, 1800);
    for (const name of L(['CDI', 'CDD', 'Bénin'], ['Permanent', 'Fixed-term', 'Benin'])) {
      const chip = p.getByRole('button', { name, exact: true }).first();
      if ((await chip.getAttribute('aria-pressed')) === 'true') { await reveal(p, chip); const b = await chip.boundingBox(); await moveTo(p, b.x + b.width / 2, b.y + b.height / 2, 450); }
      else await click(p, chip);
      await pause(p, 500);
    }
    await click(p, p.getByRole('button', { name: L(/Chercher maintenant/, /Search now/) }));
    await p.getByText(L('Vos offres', 'Your offers'), { exact: true }).waitFor({ timeout: 20000 });
    await reveal(p, p.getByText(L('Vos offres', 'Your offers'), { exact: true }), 0.15); await pause(p, 2600);
    await smoothScroll(p, 380, 900); await pause(p, 1500);
    const daily = p.getByText(L('Chaque matin, vers 7 h 30', 'Every morning, around 7:30 am'));
    await click(p, daily); await pause(p, 800);
    await click(p, p.getByRole('button', { name: L('Activer ma veille', 'Turn on my alerts') }));
    await pause(p, 2400);
  });

  // 7. Portfolio en ligne : choisir un design (simples, animés), publier, lien et QR code
  state = await scene(browser, 'w7-portfolio', state, async (p) => {
    await p.goto(APP + '/#portfolio'); await pause(p, 2600);
    await click(p, p.getByRole('button', { name: L(/Changer/, /Change/) })); await pause(p, 700);
    for (const name of L(['Pastel', 'Bento', 'Soleil', 'Classique'], ['Pastel', 'Bento', 'Sunshine', 'Classic'])) {
      await click(p, p.getByRole('radio', { name: new RegExp('^' + name) })); await pause(p, 1700);
    }
    await click(p, p.getByRole('button', { name: L(/Fermer/, /Close/) })); await pause(p, 500);
    await click(p, p.getByRole('button', { name: L(/Publier mon portfolio/, /Publish my portfolio/) }));
    await p.getByText(L('Votre portfolio est en ligne', 'Your portfolio is live')).waitFor({ timeout: 30000 });
    // Le serveur de démonstration tourne en local : on affiche l'adresse réelle du site.
    await p.evaluate(() => document.querySelectorAll('a').forEach((el) => { if (el.textContent?.includes('localhost:5173')) el.textContent = el.textContent.replace('localhost:5173', 'cvcasa.com'); }));
    await pause(p, 600);
    await smoothScroll(p, -3000, 800); await pause(p, 2600);
  });

  // 8. Suivi des candidatures
  state = await scene(browser, 'w8-suivi', state, async (p) => {
    await p.goto(APP + '/#suivi'); await pause(p, 2000);
    await moveTo(p, 760, 380, 700); await pause(p, 600);
    await click(p, p.getByRole('button', { name: L('Envoyée', 'Sent'), exact: true })); await pause(p, 1600);
    await click(p, p.getByRole('button', { name: L('Entretien', 'Interview'), exact: true })); await pause(p, 1400);
    await click(p, p.getByRole('button', { name: L('Notes et date', 'Notes and date') })); await pause(p, 2000);
  });

  // 9. Sur tous vos appareils (synchronisation) et crédits
  await scene(browser, 'w9-partout', state, async (p) => {
    await p.goto(APP + '/#reglages'); await pause(p, 1500);
    await reveal(p, p.locator('#sync-title'), 0.3); await pause(p, 1200);
    const t = p.locator('section[aria-labelledby="sync-title"]');
    const b = await t.boundingBox(); await moveTo(p, b.x + 120, b.y + b.height - 40, 700); await pause(p, 2200);
    await click(p, p.getByTitle(L('Mes crédits', 'My credits')), { scroll: false }); await pause(p, 3000);
  });

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
