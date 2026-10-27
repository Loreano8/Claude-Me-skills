// Tournage de la démo CV Studio : une vidéo par scène, écran de téléphone (390×844, rendu ×2).
// Scènes ajoutées : « Écrire comme moi » (02b) et la lettre avec questions et relecture (05). Même usage que record-demo.cjs.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.argv[2];
const S = path.dirname(path.dirname(OUT));
const APP = 'http://localhost:5173';
const API = 'http://localhost:8787';
const VIEW = { width: 390, height: 844 };

const OFFER = `Groupe Logistique Ouest recrute à Cotonou :
1) Responsable comptable (CDI)
2) Contrôleur de gestion (CDI)

Missions du responsable comptable : tenue de la comptabilité SYSCOHADA, déclarations fiscales, clôtures mensuelles, encadrement d'une équipe de 3 personnes.
Profil : Bac+5 en comptabilité, 5 ans d'expérience, maîtrise d'un ERP.
Dossier : CV + lettre de motivation à recrutement@glo.bj`;

const PARCOURS = `Awa Diallo, comptable, 07 00 00 00 00, awa.diallo@email.com. Master en finance en 2020. Depuis 2021 comptable dans une société de transport : déclarations fiscales, paie de 120 salariés, j'ai réduit les retards de paiement de 30 %. Avant : stage de 6 mois en cabinet d'audit. Excel, Sage. Français, anglais courant.`;

const pause = (p, ms) => p.waitForTimeout(ms);

async function smoothScroll(p, dy, steps = 30) {
  for (let i = 0; i < steps; i++) {
    await p.mouse.wheel(0, dy / steps);
    await p.waitForTimeout(25);
  }
}

async function scene(browser, name, state, run) {
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    storageState: state ?? undefined,
    acceptDownloads: true,
  });
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept());
  p.on('pageerror', (e) => console.log(name, 'ERREUR', e.message));
  // Capture d'écran en continu (nette, en pixels réels du téléphone), assemblée ensuite en vidéo.
  const dir = path.join(OUT, 'frames-' + name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  let recording = true;
  let started = false;
  const t0 = Date.now();
  const loop = (async () => {
    while (recording) {
      try {
        const buf = await p.screenshot({ type: 'jpeg', quality: 88, timeout: 5000 });
        if (!started) { started = true; }
        const file = String(frames.length).padStart(5, '0') + '.jpg';
        fs.writeFileSync(path.join(dir, file), buf);
        frames.push({ file, t: Date.now() });
      } catch { await new Promise((r) => setTimeout(r, 50)); }
    }
  })();
  await run(p);
  recording = false;
  await loop;
  const next = await ctx.storageState();
  await ctx.close();
  // Liste ffconcat : chaque image dure jusqu'à la suivante.
  let list = 'ffconcat version 1.0\n';
  frames.forEach((f, i) => {
    const d = ((frames[i + 1]?.t ?? f.t + 70) - f.t) / 1000;
    list += 'file ' + f.file + '\nduration ' + d.toFixed(3) + '\n';
  });
  list += 'file ' + frames[frames.length - 1].file + '\n';
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  require('child_process').execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'scale=780:1688,setsar=1,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', path.join(OUT, name + '.mp4')]);
  fs.rmSync(dir, { recursive: true, force: true });
  const secs = (frames[frames.length - 1].t - frames[0].t) / 1000;
  console.log(name, secs.toFixed(2) + ' s', (frames.length / secs).toFixed(1) + ' i/s');
  return next;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // Compte de démonstration avec des crédits.
  const id = 'awa.demo' + Date.now() + '@gmail.com';
  const reg = await (await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-device-id': 'device-demo-' + Date.now() }, body: JSON.stringify({ identifier: id, password: 'secret12', name: 'Awa' }) })).json();
  await fetch(API + '/api/admin/credits', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer demo' }, body: JSON.stringify({ identifier: id, credits: 24 }) });

  // Échauffement (Vite prépare ses fichiers au premier passage) et session enregistrée.
  const warm = await browser.newContext({ viewport: VIEW });
  const w = await warm.newPage();
  for (const h of ['infos', 'offre', 'lettre']) {
    await w.goto(APP + '/#' + h);
    await w.waitForTimeout(1500);
  }
  await w.evaluate((r) => localStorage.setItem('cv-studio-account', JSON.stringify({ state: { token: r.token, user: r.user }, version: 0 })), reg);
  await w.waitForTimeout(1000);
  // CV et offre préparés hors caméra (déjà montrés dans les scènes existantes).
  await w.goto(APP + '/#infos'); await w.reload(); await w.waitForTimeout(2000);
  await w.getByPlaceholder(/Écrivez tout/).fill(PARCOURS);
  await w.getByRole('button', { name: 'Générer mon CV' }).click();
  await w.getByText(/Ajoutez un lien LinkedIn/).waitFor({ timeout: 20000 });
  await w.goto(APP + '/#offre'); await w.waitForTimeout(1500);
  await w.getByPlaceholder(/Ou collez ici le texte/).fill(OFFER); await w.waitForTimeout(800);
  let state = await warm.storageState();
  await warm.close();

  const STYLE_TEXT = "Madame, Monsieur, je travaille comme comptable depuis 2021. Je tiens les comptes, je suis les paiements clients chaque semaine. Je reste disponible pour un échange.";

  // 2 bis. Écrire comme moi
  state = await scene(browser, '02b-style', state, async (p) => {
    await p.goto(APP + '/#infos'); await pause(p, 1200);
    const line = p.getByText('Écrire comme moi').first();
    await line.scrollIntoViewIfNeeded(); await smoothScroll(p, -150, 10); await pause(p, 1200);
    await p.getByRole('button', { name: 'Configurer' }).first().click(); await pause(p, 1500);
    const box = p.getByPlaceholder(/Ou collez ici un texte/);
    await box.click();
    await box.pressSequentially(STYLE_TEXT, { delay: 8 });
    await pause(p, 600);
    await p.getByRole('button', { name: 'Retenir ma façon d’écrire' }).click();
    await p.getByText('Ton direct').first().waitFor({ timeout: 20000 });
    await pause(p, 600);
    await p.getByText('Ton direct').first().scrollIntoViewIfNeeded(); await smoothScroll(p, 220, 15); await pause(p, 2500);
  });

  // 5. Lettre : questions, lettre, relecture naturelle
  state = await scene(browser, '05-lettre', state, async (p) => {
    await p.goto(APP + '/#lettre'); await pause(p, 1200);
    await p.getByRole('button', { name: 'Générer la lettre' }).scrollIntoViewIfNeeded(); await pause(p, 600);
    await p.getByRole('button', { name: 'Générer la lettre' }).click();
    await p.getByText('Pour une lettre qui vous ressemble').waitFor({ timeout: 20000 });
    await p.getByText('Pour une lettre qui vous ressemble').scrollIntoViewIfNeeded(); await pause(p, 1500);
    const a = p.getByLabel('Qu’est-ce qui vous attire dans cette entreprise ?');
    await a.click();
    await a.pressSequentially('Je travaille déjà avec des transporteurs et je connais vos clients.', { delay: 14 });
    await pause(p, 800);
    await p.getByRole('button', { name: 'Générer la lettre' }).click();
    await p.getByLabel('Corps de la lettre').waitFor(); await pause(p, 3500);
    await smoothScroll(p, 900, 40); await pause(p, 1200);
    await p.getByText('Relecture naturelle').scrollIntoViewIfNeeded(); await smoothScroll(p, 200, 10); await pause(p, 2500);
  });

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
