// Aperçus des modèles de l'accueil (public/modeles/*.webp et public/modeles/en/*.webp).
// À lancer avec le site de démo démarré (npm run demo) : node scripts/template-previews.cjs
// Exemple de CV bien rempli (une page pleine) et silhouette à la place d'une photo : aucun vrai visage ni vrai nom.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const APP = 'http://localhost:5173';
const ROOT = path.join(__dirname, '..', 'public', 'modeles');
const IDS = ['moderne', 'classique', 'elegant', 'prestige', 'horizon', 'atelier', 'signature', 'finance', 'ingenieur', 'creatif', 'canada', 'europass', 'concours', 'etudiant', 'executif', 'sante', 'minimal'];
const NO_PHOTO = ['classique', 'canada'];
const u = () => Math.random().toString(36).slice(2, 10);

const FR = {
  personal: { firstName: 'Prénom', lastName: 'Nom', title: 'Responsable comptable', email: 'prenom.nom@email.com', phone: '+229 01 00 00 00 00', address: 'Quartier Cadjèhoun', city: 'Cotonou', country: 'Bénin', birthDate: '14/03/1994', nationality: 'Béninoise', drivingLicense: 'Permis B', linkedin: '', website: '' },
  summary: 'Comptable avec 7 ans d’expérience dans le transport et la logistique. Je fiabilise les clôtures mensuelles, la paie et les déclarations fiscales, et j’encadre une équipe de 3 personnes. Habitué(e) au SYSCOHADA et aux audits annuels.',
  experiences: [
    { position: 'Responsable comptable', company: 'Société de transport et logistique', location: 'Cotonou', startDate: '01/2021', endDate: '', current: true, achievements: 'Encadrer une équipe de 3 comptables et organiser les clôtures mensuelles\nPréparer les déclarations fiscales (TVA, IS) sans aucune pénalité depuis 2021\nRéduire de 30 % les retards de paiement fournisseurs grâce à un circuit de validation\nGérer la paie mensuelle de 120 salariés' },
    { position: 'Comptable', company: 'Groupe de distribution', location: 'Cotonou', startDate: '03/2018', endDate: '12/2020', current: false, achievements: 'Tenir la comptabilité générale et analytique de 4 magasins\nMettre en place un tableau de bord mensuel de trésorerie suivi par la direction\nPréparer les dossiers de l’audit annuel avec le commissaire aux comptes' },
    { position: 'Auditeur junior', company: 'Cabinet d’audit et de conseil', location: 'Cotonou', startDate: '09/2016', endDate: '02/2018', current: false, achievements: 'Participer à 12 missions d’audit légal dans le commerce et l’industrie\nContrôler les rapprochements bancaires et les inventaires de fin d’année' },
  ],
  education: [
    { degree: 'Master Comptabilité, Contrôle, Audit', school: 'Université d’Abomey-Calavi', location: 'Abomey-Calavi', startDate: '2014', endDate: '2016', details: 'Mention bien' },
    { degree: 'Licence en sciences de gestion', school: 'Université d’Abomey-Calavi', location: 'Abomey-Calavi', startDate: '2011', endDate: '2014', details: '' },
  ],
  skills: ['SYSCOHADA', 'Fiscalité', 'Paie', 'Clôtures mensuelles', 'Sage 100', 'Excel avancé', 'Contrôle de gestion'],
  softSkills: ['Rigueur', 'Encadrement', 'Sens de l’organisation'],
  languages: [{ name: 'Français', level: 'Courant (C2)' }, { name: 'Anglais', level: 'Professionnel (B2)' }, { name: 'Fon', level: 'Langue maternelle' }],
  certifications: [{ name: 'Certificat Sage Comptabilité', issuer: 'Sage', date: '2022' }, { name: 'Formation IFRS', issuer: 'Ordre des experts-comptables', date: '2023' }],
  interests: ['Basket (club amateur)', 'Bénévolat associatif', 'Lecture'],
};

const EN = {
  personal: { firstName: 'First', lastName: 'Last', title: 'Senior Accountant', email: 'first.last@email.com', phone: '+44 20 7946 0000', address: '12 High Street', city: 'London', country: 'United Kingdom', birthDate: '', nationality: '', drivingLicense: 'Full driving licence', linkedin: '', website: '' },
  summary: 'Accountant with 7 years of experience in transport and logistics. I make month-end close, payroll and tax filings faster and more reliable, and I lead a team of three. Used to annual audits and multi-site reporting.',
  experiences: [
    { position: 'Senior Accountant', company: 'City Transport & Logistics', location: 'London', startDate: '01/2021', endDate: '', current: true, achievements: 'Lead a team of 3 accountants and run the monthly close\nPrepare VAT and corporate tax returns with no penalties since 2021\nCut supplier payment delays by 30% with a new approval workflow\nRun monthly payroll for 120 employees' },
    { position: 'Accountant', company: 'Retail Distribution Group', location: 'London', startDate: '03/2018', endDate: '12/2020', current: false, achievements: 'Kept the general and cost accounts of 4 stores\nBuilt a monthly cash dashboard used by the management team\nPrepared the annual audit files with the external auditors' },
    { position: 'Audit Assistant', company: 'Audit & Advisory Partners', location: 'London', startDate: '09/2016', endDate: '02/2018', current: false, achievements: 'Took part in 12 statutory audits in retail and manufacturing\nChecked bank reconciliations and year-end stock counts' },
  ],
  education: [
    { degree: 'MSc Accounting, Control and Audit', school: 'University of Manchester', location: 'Manchester', startDate: '2014', endDate: '2016', details: 'Graduated with merit' },
    { degree: 'BSc Business Management', school: 'University of Leeds', location: 'Leeds', startDate: '2011', endDate: '2014', details: '' },
  ],
  skills: ['IFRS', 'Tax', 'Payroll', 'Month-end close', 'Sage 50', 'Advanced Excel', 'Management reporting'],
  softSkills: ['Attention to detail', 'Team leadership', 'Organised'],
  languages: [{ name: 'English', level: 'Native' }, { name: 'French', level: 'Fluent (C1)' }, { name: 'Spanish', level: 'Intermediate (B1)' }],
  certifications: [{ name: 'Sage Accounting Certificate', issuer: 'Sage', date: '2022' }, { name: 'IFRS training', issuer: 'ICAEW', date: '2023' }],
  interests: ['Basketball (amateur club)', 'Community volunteering', 'Reading'],
};

const withIds = (d) => ({
  ...d,
  experiences: d.experiences.map((e) => ({ id: u(), ...e })),
  education: d.education.map((e) => ({ id: u(), ...e })),
  languages: d.languages.map((e) => ({ id: u(), ...e })),
  certifications: d.certifications.map((e) => ({ id: u(), ...e })),
});

async function run(browser, lang, photo) {
  const out = lang === 'en' ? path.join(ROOT, 'en') : ROOT;
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'modeles-'));
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 1100 }, deviceScaleFactor: 2, locale: lang === 'en' ? 'en-GB' : 'fr-FR' })).newPage();
  p.on('pageerror', (e) => console.log('ERREUR', e.message));
  await p.goto(`${APP}/?lang=${lang}#accueil`);
  await p.evaluate(({ lang, photo: withPhoto, data }) => {
    localStorage.setItem('cvcasa-lang', lang);
    localStorage.setItem('cvcasa-tours', JSON.stringify(['accueil', 'infos', 'apercu', 'offre', 'lettre', 'suivi', 'documents', 'scanner', 'dossier', 'plus', 'veille', 'reglages', 'ambassadeur']));
    // Silhouette neutre dessinée à la volée (aucun visage).
    const c = document.createElement('canvas');
    c.width = c.height = 400;
    const g = c.getContext('2d');
    g.fillStyle = '#dbe3ee'; g.fillRect(0, 0, 400, 400);
    g.fillStyle = '#94a3b8';
    g.beginPath(); g.arc(200, 160, 78, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(200, 410, 150, 150, 0, Math.PI, 0); g.fill();
    const photo = c.toDataURL('image/jpeg', 0.9);
    const settings = { template: 'moderne', accent: '#1d4ed8', headingLang: lang, showPhoto: withPhoto, photoShape: 'round', showBirthDate: lang === 'fr', showNationality: false, showSignature: false, signaturePlace: '', signatureDate: '' };
    const cv = { id: 'demo-' + lang, label: lang === 'en' ? 'My CV' : 'Mon CV', updatedAt: Date.now(), ...data, photo, signature: null, settings, unlocked: { at: Date.now() } };
    localStorage.setItem('cv-studio', JSON.stringify({ state: { cvs: [cv], activeId: cv.id }, version: 2 }));
  }, { lang, photo, data: withIds(lang === 'en' ? EN : FR) });
  await p.goto(`${APP}/#apercu`); await p.reload(); await p.waitForTimeout(2500);
  const btns = p.locator('button:has(div.aspect-\\[1\\/1\\.25\\])');
  const count = await btns.count();
  if (count !== IDS.length) throw new Error(`${count} modèles affichés, ${IDS.length} attendus`);
  for (let i = 0; i < IDS.length; i++) {
    if (NO_PHOTO.includes(IDS[i]) === photo) continue;
    await btns.nth(i).click(); await p.waitForTimeout(2800);
    const png = path.join(tmp, IDS[i] + '.png');
    await p.locator('[data-tour="preview"] canvas').first().screenshot({ path: png });
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', 'scale=560:792', '-quality', '82', path.join(out, IDS[i] + '.webp')]);
  }
  console.log(lang, photo ? 'avec photo' : 'sans photo', 'ok');
}

(async () => {
  const browser = await chromium.launch();
  for (const lang of ['fr', 'en']) for (const photo of [true, false]) await run(browser, lang, photo);
  await browser.close();
})();
