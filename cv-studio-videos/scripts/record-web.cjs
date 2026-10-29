// Tournage du tutoriel CVCasa en version ordinateur (1440×900) : une vidéo par chapitre, curseur visible.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.argv[2];
const S = path.dirname(__dirname);
const APP = 'http://localhost:5173';
const API = 'http://localhost:8787';
const VIEW = { width: 1440, height: 900 };
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;

const OFFER = `Groupe Logistique Ouest recrute à Cotonou :
1) Responsable comptable (CDI)
2) Contrôleur de gestion (CDI)

Missions du responsable comptable : tenue de la comptabilité SYSCOHADA, déclarations fiscales, clôtures mensuelles, encadrement d'une équipe de 3 personnes.
Profil : Bac+5 en comptabilité, 5 ans d'expérience, maîtrise d'un ERP.
Dossier : CV + lettre de motivation à recrutement@glo.bj`;

const PARCOURS = `Awa Diallo, comptable, 07 00 00 00 00, awa.diallo@email.com. Master en finance en 2020. Depuis 2021 comptable dans une société de transport : déclarations fiscales, paie de 120 salariés, j'ai réduit les retards de paiement de 30 %. Avant : stage de 6 mois en cabinet d'audit. Excel, Sage. Français, anglais courant.`;

const ALL_TOURS = ['infos', 'apercu', 'offre', 'lettre', 'suivi', 'documents', 'scanner', 'dossier'];

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

  const id = 'awa.web' + Date.now() + '@gmail.com';
  const reg = await (await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-device-id': 'device-web-' + Date.now() }, body: JSON.stringify({ identifier: id, password: 'secret12', name: 'Awa' }) })).json();
  await fetch(API + '/api/admin/credits', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer demo' }, body: JSON.stringify({ identifier: id, credits: 24 }) });

  const warm = await browser.newContext({ viewport: VIEW });
  const w = await warm.newPage();
  await w.goto(APP + '/#accueil');
  await w.evaluate((t) => localStorage.setItem('cvcasa-tours', JSON.stringify(t)), ALL_TOURS.filter((t) => t !== 'infos'));
  for (const h of ['accueil', 'apercu', 'offre', 'lettre', 'scanner', 'documents']) {
    await w.goto(APP + '/#' + h);
    await w.waitForTimeout(1500);
  }
  await w.evaluate(async () => { await import('/src/lib/dossier.ts'); await import('/src/pdf/render.tsx'); });
  await w.evaluate((r) => localStorage.setItem('cv-studio-account', JSON.stringify({ state: { token: r.token, user: r.user }, version: 0 })), reg);
  await w.waitForTimeout(800);
  let state = await warm.storageState();
  await warm.close();

  // 1. Accueil
  state = await scene(browser, 'w1-accueil', state, async (p) => {
    await p.goto(APP + '/#accueil'); await pause(p, 2200);
    await moveTo(p, 900, 560, 900); await pause(p, 400);
    await smoothScroll(p, 650, 1200); await pause(p, 1400);
    await smoothScroll(p, -650, 900); await pause(p, 500);
    await click(p, p.getByRole('button', { name: 'Créer mon CV gratuitement' }));
    await pause(p, 1200);
  });

  // 2. Mes infos : le guide, puis la saisie rapide et le CV en direct
  state = await scene(browser, 'w2-infos', state, async (p) => {
    await p.goto(APP + '/#infos');
    await p.locator('#tour-title').waitFor({ timeout: 10000 }); await pause(p, 2200);
    await click(p, p.locator('[data-next]'), { scroll: false }); await pause(p, 2000);
    await click(p, p.locator('[data-next]'), { scroll: false }); await pause(p, 1800);
    await click(p, p.getByRole('button', { name: 'Passer', exact: true }), { scroll: false }); await pause(p, 900);
    await type(p, p.getByPlaceholder(/Écrivez tout/), PARCOURS, 10);
    await pause(p, 700);
    await click(p, p.getByRole('button', { name: 'Générer mon CV' }));
    await p.getByText(/Ajoutez un lien LinkedIn/).waitFor({ timeout: 20000 });
    await pause(p, 2500);
    await moveTo(p, 1150, 500, 700); await pause(p, 1500);
    await smoothScroll(p, 700, 1200); await pause(p, 2000);
  });

  // 3. Aperçu : modèle, réglages recommandés, téléchargement
  state = await scene(browser, 'w3-apercu', state, async (p) => {
    await p.goto(APP + '/#apercu'); await pause(p, 2500);
    await click(p, p.getByText('Finance', { exact: true })); await pause(p, 2200);
    await click(p, p.getByText('Élégant', { exact: true })); await pause(p, 2200);
    const reco = p.getByRole('button', { name: 'Recommandé' });
    if (await reco.count()) { await click(p, reco); await pause(p, 1800); }
    await smoothScroll(p, -2000, 800); await pause(p, 400);
    await click(p, p.getByRole('button', { name: 'PDF gratuit', exact: true })); await pause(p, 2500);
  });

  // 4. Offre : coller l'annonce, une question, CV adapté et score
  state = await scene(browser, 'w4-offre', state, async (p) => {
    await p.goto(APP + '/#offre'); await pause(p, 1500);
    const area = p.getByPlaceholder(/Ou collez ici le texte/);
    await click(p, area); await pause(p, 300);
    await area.fill(OFFER); await pause(p, 1500);
    await click(p, p.getByRole('button', { name: 'Adapter mon CV à l’offre' }));
    await p.getByText('Avant d’adapter votre CV', { exact: true }).waitFor({ timeout: 20000 });
    await reveal(p, p.getByText('Avant d’adapter votre CV', { exact: true }), 0.3); await pause(p, 1800);
    await click(p, p.getByRole('button', { name: 'Comptable', exact: true })); await pause(p, 800);
    await click(p, p.getByRole('button', { name: 'Adapter mon CV (1 crédit)' }));
    await p.getByText('Analyse de l’offre').waitFor({ timeout: 20000 });
    await reveal(p, p.getByText('Analyse de l’offre'), 0.2); await pause(p, 2500);
    await smoothScroll(p, 450, 1000); await pause(p, 2200);
  });

  // 5. Lettre : questions, lettre, téléchargement
  state = await scene(browser, 'w5-lettre', state, async (p) => {
    await p.goto(APP + '/#lettre'); await pause(p, 1500);
    await click(p, p.getByRole('button', { name: 'Générer la lettre' }));
    await p.getByText('Pour une lettre qui vous ressemble').waitFor({ timeout: 20000 });
    await reveal(p, p.getByText('Pour une lettre qui vous ressemble'), 0.25); await pause(p, 1500);
    await type(p, p.getByLabel('Qu’est-ce qui vous attire dans cette entreprise ?'), 'Je travaille déjà avec des transporteurs et je connais vos clients.', 16);
    await pause(p, 700);
    await click(p, p.getByRole('button', { name: 'Générer la lettre' }));
    await p.getByLabel('Corps de la lettre').waitFor(); await pause(p, 2500);
    await moveTo(p, 1100, 560, 700); await pause(p, 1500);
    await smoothScroll(p, 600, 1200); await pause(p, 1800);
    await click(p, p.getByRole('button', { name: 'PDF gratuit', exact: true })); await pause(p, 2000);
  });

  // 6. Scanner : photo, recadrage, PDF
  state = await scene(browser, 'w6-scanner', state, async (p) => {
    await p.goto(APP + '/#infos'); await pause(p, 1000);
    await click(p, p.getByRole('button', { name: 'Scanner un document en PDF' }), { scroll: false }); await pause(p, 1500);
    const add = p.getByRole('button', { name: 'Scanner un document', exact: true });
    const b = await add.boundingBox(); await moveTo(p, b.x + b.width / 2, b.y + b.height / 2); await pause(p, 300);
    await p.mouse.down(); await p.mouse.up();
    await p.locator('input[capture=environment]').setInputFiles(S + '/skew.jpg');
    await pause(p, 2500);
    await click(p, p.getByRole('button', { name: 'Recadrer la page' }));
    const img = p.getByAltText('Page à recadrer'); await img.waitFor(); await pause(p, 1200);
    const box = await img.boundingBox();
    const target = [[0.217, 0.113], [0.817, 0.163], [0.883, 0.887], [0.117, 0.831]];
    const names = ['Coin haut gauche', 'Coin haut droit', 'Coin bas droit', 'Coin bas gauche'];
    for (let i = 0; i < 4; i++) {
      const h = await p.getByRole('button', { name: names[i] }).boundingBox();
      await moveTo(p, h.x + h.width / 2, h.y + h.height / 2, 400); await p.mouse.down();
      await moveTo(p, box.x + target[i][0] * box.width, box.y + target[i][1] * box.height, 450); await p.mouse.up();
      await pause(p, 200);
    }
    await pause(p, 700);
    await click(p, p.getByRole('button', { name: 'Valider' }), { scroll: false }); await pause(p, 2500);
    await click(p, p.getByRole('button', { name: /Créer le PDF/ })); await pause(p, 2500);
  });

  // 7. Mes documents
  state = await scene(browser, 'w7-documents', state, async (p) => {
    await p.goto(APP + '/#documents'); await pause(p, 2500);
    await moveTo(p, 760, 420, 800); await pause(p, 1200);
    await click(p, p.getByRole('button', { name: 'Coffre-fort' })); await pause(p, 2500);
  });

  // 8. Crédits
  await scene(browser, 'w8-credits', state, async (p) => {
    await p.goto(APP + '/#apercu'); await pause(p, 1200);
    await click(p, p.getByTitle('Mes crédits'), { scroll: false }); await pause(p, 3500);
  });

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
