// Tournage de la démo CV Studio : une vidéo par scène, écran de téléphone (390×844, rendu ×2).
// Usage : serveur de démo (DEMO_DELAY_MS=1800 npx tsx tests/demo-server.ts) + Vite (port 5173), puis
//   node scripts/record-demo.cjs <dossier>/clips   (skew.jpg, doc-photo.jpg et emily/cv.pdf attendus dans <dossier>).
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
  for (const h of ['accueil', 'infos', 'apercu', 'offre', 'lettre', 'scanner', 'documents']) {
    await w.goto(APP + '/#' + h);
    await w.waitForTimeout(1500);
  }
  await w.evaluate(async () => { await import('/src/lib/dossier.ts'); await import('/src/pdf/render.tsx'); });
  await w.evaluate((r) => localStorage.setItem('cv-studio-account', JSON.stringify({ state: { token: r.token, user: r.user }, version: 0 })), reg);
  await w.waitForTimeout(1000);
  let state = await warm.storageState();
  await warm.close();

  // 1. Accueil
  state = await scene(browser, '01-accueil', state, async (p) => {
    await p.goto(APP + '/#accueil'); await pause(p, 2500);
    await smoothScroll(p, 700); await pause(p, 1200);
    await smoothScroll(p, -700); await pause(p, 800);
  });

  // 2. Saisie rapide
  state = await scene(browser, '02-saisie', state, async (p) => {
    await p.goto(APP + '/#infos'); await pause(p, 1500);
    const box = p.getByPlaceholder(/Écrivez tout/);
    await box.click();
    await box.pressSequentially(PARCOURS, { delay: 12 });
    await pause(p, 600);
    await p.getByRole('button', { name: 'Générer mon CV' }).click();
    await p.getByText(/Ajoutez un lien LinkedIn/).waitFor({ timeout: 20000 });
    await pause(p, 1200);
    await smoothScroll(p, 900, 40); await pause(p, 1500);
  });

  // 3. Aperçu : modèle, « Recommandé »
  state = await scene(browser, '03-apercu', state, async (p) => {
    await p.goto(APP + '/#apercu'); await pause(p, 2500);
    await smoothScroll(p, 600, 30); await pause(p, 1200);
    const el = p.getByText('Élégant', { exact: true }).first();
    if (await el.count()) { await el.scrollIntoViewIfNeeded(); await pause(p, 500); await el.click(); await pause(p, 1500); }
    const reco = p.getByRole('button', { name: 'Recommandé' });
    if (await reco.count()) { await reco.scrollIntoViewIfNeeded(); await pause(p, 700); await reco.click(); await pause(p, 1500); }
    await p.getByRole('button', { name: /PDF/ }).first().scrollIntoViewIfNeeded(); await pause(p, 1500);
  });

  // 4. Offre : texte de l'annonce, questions, CV adapté avec le score
  state = await scene(browser, '04-offre', state, async (p) => {
    await p.goto(APP + '/#offre'); await pause(p, 1500);
    const area = p.getByPlaceholder(/Ou collez ici le texte/);
    await area.click();
    await area.fill(OFFER); await pause(p, 1200);
    await p.getByRole('button', { name: 'Adapter mon CV à l’offre' }).click();
    await p.getByText('Avant d’adapter votre CV', { exact: true }).waitFor({ timeout: 20000 });
    await pause(p, 1800);
    await p.getByRole('button', { name: 'Comptable', exact: true }).click(); await pause(p, 900);
    await p.getByRole('button', { name: 'Adapter mon CV (1 crédit)' }).click();
    await p.getByText('Analyse de l’offre').waitFor({ timeout: 20000 });
    await p.getByText('Analyse de l’offre').scrollIntoViewIfNeeded(); await pause(p, 2500);
    await smoothScroll(p, 500, 30); await pause(p, 1800);
  });

  // 5. Lettre
  state = await scene(browser, '05-lettre', state, async (p) => {
    await p.goto(APP + '/#lettre'); await pause(p, 1500);
    await p.getByRole('button', { name: 'Générer la lettre' }).click();
    await pause(p, 3500);
    await smoothScroll(p, 900, 40); await pause(p, 1500);
    await smoothScroll(p, 700, 30); await pause(p, 1500);
  });

  // 6. Scanner : photo de travers, recadrage, PDF
  state = await scene(browser, '06-scanner', state, async (p) => {
    await p.goto(APP + '/#infos'); await pause(p, 1000);
    await p.getByRole('button', { name: 'Scanner un document en PDF' }).click(); await pause(p, 1500);
    await p.locator('input[capture=environment]').setInputFiles(S + '/skew.jpg');
    await pause(p, 2500);
    await p.getByRole('button', { name: 'Recadrer la page' }).first().click();
    const img = p.getByAltText('Page à recadrer'); await img.waitFor(); await pause(p, 1200);
    const b = await img.boundingBox();
    const target = [[0.217, 0.113], [0.817, 0.163], [0.883, 0.887], [0.117, 0.831]];
    const names = ['Coin haut gauche', 'Coin haut droit', 'Coin bas droit', 'Coin bas gauche'];
    for (let i = 0; i < 4; i++) {
      const h = await p.getByRole('button', { name: names[i] }).boundingBox();
      await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await p.mouse.down();
      await p.mouse.move(b.x + target[i][0] * b.width, b.y + target[i][1] * b.height, { steps: 15 }); await p.mouse.up();
      await pause(p, 250);
    }
    await pause(p, 800);
    await p.getByRole('button', { name: 'Valider' }).click(); await pause(p, 2500);
    // Aperçu de la page redressée, en grand
    const src = await p.locator('li img').first().getAttribute('src');
    await p.evaluate((u) => { const d = document.createElement('div'); d.id = 'zoom'; d.style.cssText = 'position:fixed;inset:0;z-index:99;background:rgba(15,23,42,.92);display:flex;align-items:center;justify-content:center;padding:24px'; d.innerHTML = `<img src="${u}" style="max-width:100%;max-height:100%;border-radius:8px;box-shadow:0 10px 40px #0008">`; document.body.appendChild(d); }, src);
    await pause(p, 2500);
    await p.evaluate(() => document.getElementById('zoom')?.remove());
    await p.getByRole('button', { name: /Créer le PDF/ }).scrollIntoViewIfNeeded(); await pause(p, 800);
    await p.getByRole('button', { name: /Créer le PDF/ }).click(); await pause(p, 2000);
  });

  // 7. Mes documents et coffre-fort
  state = await scene(browser, '07-documents', state, async (p) => {
    await p.goto(APP + '/#documents'); await pause(p, 2500);
    await p.getByRole('button', { name: 'Coffre-fort' }).click(); await pause(p, 1500);
    await p.getByRole('button', { name: 'Protéger par un code (recommandé)' }).click(); await pause(p, 700);
    await p.getByLabel('Code (4 à 6 chiffres)').pressSequentially('1234', { delay: 120 });
    await p.getByLabel('Confirmez le code').pressSequentially('1234', { delay: 120 });
    await p.getByRole('button', { name: 'Créer mon coffre-fort' }).click(); await pause(p, 1500);
    await p.locator('input[capture=environment]').setInputFiles(S + '/doc-photo.jpg'); await pause(p, 1200);
    await p.getByRole('button', { name: 'Diplôme' }).click(); await pause(p, 400);
    await p.locator('input[type=file][multiple]').setInputFiles(S + '/emily/cv.pdf'); await pause(p, 2500);
  });

  // 8. Crédits et paiement MoMo
  await scene(browser, '08-credits', state, async (p) => {
    await p.goto(APP + '/#apercu'); await pause(p, 1200);
    await p.getByTitle('Mes crédits').click(); await pause(p, 3500);
    await smoothScroll(p, 300, 20); await pause(p, 1500);
  });

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
