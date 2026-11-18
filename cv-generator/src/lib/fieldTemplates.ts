import type { PortfolioField } from '../../shared/portfolio.ts';
import { t } from '../i18n.ts';

// Modèle de CV conseillé selon le métier détecté : un offert (appliqué d'office au premier CV) et un Pro, plus travaillé.
// Le CV reste sobre (pas de motifs en fond : il est imprimé et lu par les logiciels de tri) ; c'est le choix du modèle
// et de sa couleur qui « sent » le métier.

export const FIELD_TEMPLATES: Record<PortfolioField, { free: string; pro: string }> = {
  sante: { free: 'elegant', pro: 'sante' },
  tech: { free: 'simple', pro: 'ingenieur' },
  design: { free: 'clarte', pro: 'creatif' },
  finance: { free: 'classique', pro: 'finance' },
  education: { free: 'compact', pro: 'cadre' },
  btp: { free: 'simple', pro: 'ingenieur' },
  commerce: { free: 'moderne', pro: 'atelier' },
  juridique: { free: 'classique', pro: 'cadre' },
  hotellerie: { free: 'bicolore', pro: 'horizon' },
  logistique: { free: 'moderne', pro: 'ardoise' },
  general: { free: 'moderne', pro: 'prestige' },
};

export const FIELD_LABELS: Record<PortfolioField, string> = {
  sante: t('Santé, soins'),
  tech: t('Informatique, développement'),
  design: t('Design, création'),
  finance: t('Finance, comptabilité'),
  education: t('Enseignement, formation'),
  btp: t('BTP, ingénierie, technique'),
  commerce: t('Commerce, marketing'),
  juridique: t('Droit, juridique'),
  hotellerie: t('Hôtellerie, restauration'),
  logistique: t('Logistique, transport'),
  general: t('Général'),
};
