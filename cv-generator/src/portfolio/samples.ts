import type { PortfolioData } from '../../shared/portfolio.ts';

// Exemples de démonstration (noms fictifs, aucune vraie personne) : page « Voir un exemple » et aperçus de l'accueil.

/** Vignette de projet dessinée (aucune vraie capture) : une interface stylisée aux couleurs données. */
function thumb(bg: string, fg: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${fg}"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><rect x="90" y="70" width="620" height="360" rx="22" fill="#ffffff" opacity=".96"/><rect x="90" y="70" width="620" height="54" rx="22" fill="${accent}"/><rect x="120" y="160" width="230" height="22" rx="11" fill="#0f172a" opacity=".85"/><rect x="120" y="200" width="320" height="14" rx="7" fill="#94a3b8"/><rect x="120" y="226" width="280" height="14" rx="7" fill="#cbd5e1"/><rect x="120" y="280" width="150" height="44" rx="12" fill="${accent}"/><rect x="460" y="160" width="220" height="230" rx="16" fill="${bg}" opacity=".35"/><circle cx="570" cy="250" r="54" fill="${accent}" opacity=".9"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export const SAMPLE_NURSE: PortfolioData = {
  lang: 'fr',
  name: 'Prénom Nom',
  title: 'Infirmière diplômée d’État · Soins intensifs',
  location: 'Cotonou, Bénin · Ouverte à la mobilité',
  pitch: '6 ans en réanimation et aux urgences. Je prends en charge les patients instables, je forme les nouvelles recrues et j’améliore les protocoles de soins du service.',
  photo: '',
  email: 'prenom.nom@email.com',
  phone: '',
  links: [],
  badges: ['Licence d’exercice à jour', 'BLS · ACLS', 'Français · Anglais'],
  stats: [
    { value: '6 ans', label: 'd’expérience clinique' },
    { value: '5', label: 'certifications' },
    { value: '120 h', label: 'de formation continue' },
  ],
  wins: [
    { value: '−35 %', title: 'Escarres en réanimation', text: 'Protocole de retournement mis en place en 6 mois.' },
    { value: '23', title: 'Soignants formés', text: 'Nouveaux infirmiers et étudiants accompagnés.' },
  ],
  credentials: [
    { name: 'Diplôme d’État d’infirmier', issuer: 'École nationale des infirmiers', date: '2019' },
    { name: 'Licence d’exercice infirmier', issuer: 'Ordre national des infirmiers', date: 'valide jusqu’en 2027' },
    { name: 'BLS (réanimation de base)', issuer: 'Organisme agréé', date: '2024' },
    { name: 'ACLS (réanimation avancée)', issuer: 'Organisme agréé', date: '2024' },
  ],
  experiences: [
    { position: 'Infirmière en réanimation', company: 'Centre hospitalier universitaire', location: 'Cotonou', dates: '2022 – aujourd’hui', points: ['Surveillance de patients ventilés, jusqu’à 3 patients par poste', 'Tutrice de 9 infirmiers et 14 étudiants', 'Référente du chariot d’urgence'] },
    { position: 'Infirmière aux urgences', company: 'Hôpital de zone', location: 'Abomey-Calavi', dates: '2020 – 2022', points: ['Tri à l’accueil, 60 passages par jour', 'Prise en charge des urgences vitales'] },
  ],
  education: [{ degree: 'Diplôme d’État d’infirmier', school: 'École nationale des infirmiers', dates: '2016 – 2019' }],
  skills: [
    { group: 'Soins techniques', items: ['Ventilation mécanique', 'Voies veineuses centrales', 'Gaz du sang', 'Pansements complexes'] },
    { group: 'Qualités', items: ['Sang-froid', 'Tutorat', 'Transmissions ciblées'] },
  ],
  languages: ['Français · Courant', 'Anglais · Professionnel (B2)'],
  projects: [],
  cvUrl: 'https://cvcasa.com/',
  video: '',
  accent: '',
  field: 'sante',
};

export const SAMPLE_DESIGNER: PortfolioData = {
  lang: 'en',
  name: 'First Last',
  title: 'Product Designer · Mobile & Web',
  location: 'Austin, TX · Open to remote',
  pitch: 'I design simple mobile products for people who are not tech-savvy. Five years shipping banking and health apps used by over 2 million people.',
  photo: '',
  email: 'first.last@email.com',
  phone: '',
  links: [{ label: 'LinkedIn', url: 'linkedin.com/in/first-last' }, { label: 'Dribbble', url: 'dribbble.com/firstlast' }],
  badges: ['Google UX Certificate', 'Figma · Prototyping', 'English · French'],
  stats: [
    { value: '5 yrs', label: 'of experience' },
    { value: '2M+', label: 'users of shipped apps' },
    { value: '14', label: 'products launched' },
  ],
  wins: [
    { value: '+42%', title: 'Sign-up completion', text: 'Redesigned onboarding for a mobile bank.' },
    { value: '−30%', title: 'Support tickets', text: 'Clearer payment flow in a health app.' },
  ],
  credentials: [{ name: 'Google UX Design Certificate', issuer: 'Google', date: '2022' }],
  experiences: [
    { position: 'Senior Product Designer', company: 'Fintech startup', location: 'Austin, TX', dates: '2022 – Present', points: ['Lead designer for the mobile app (iOS & Android)', 'Built the design system used by 4 product teams'] },
    { position: 'Product Designer', company: 'Digital health company', location: 'Remote', dates: '2020 – 2022', points: ['Designed appointment booking used by 300 clinics'] },
  ],
  education: [{ degree: 'BA, Graphic Design', school: 'State University', dates: '2015 – 2019' }],
  skills: [
    { group: 'Design', items: ['UX research', 'Prototyping', 'Design systems', 'Accessibility'] },
    { group: 'Tools', items: ['Figma', 'Framer', 'Maze'] },
  ],
  languages: ['English · Native', 'French · Fluent'],
  projects: [
    { title: 'Mobile banking onboarding', text: 'Cut sign-up from 9 steps to 4. Completion went up 42% in two months.', link: 'dribbble.com/firstlast/bank', image: thumb('#1e3a8a', '#3b82f6', '#2563eb') },
    { title: 'Clinic booking app', text: 'Booking in under a minute, built with nurses and front-desk staff.', link: 'dribbble.com/firstlast/clinic', image: thumb('#065f46', '#34d399', '#059669') },
    { title: 'Design system', text: 'Components and guidelines shared by four product teams.', link: '', image: thumb('#7c2d12', '#fb923c', '#ea580c') },
    { title: 'Accessibility audit', text: 'Made a public service website usable with a screen reader.', link: '', image: thumb('#4c1d95', '#a78bfa', '#7c3aed') },
  ],
  cvUrl: 'https://cvcasa.com/',
  video: '',
  accent: '',
  field: 'design',
};
