import { BookOpen, BriefcaseBusiness, ChartNoAxesCombined, Code2, HardHat, Palette, Scale, ShoppingBag, Stethoscope, Truck, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import type { PortfolioField } from '../../shared/portfolio.ts';

// Motifs du métier, en filigrane derrière le haut du portfolio : un portfolio d'infirmière « sent » la santé,
// celui d'un développeur sent le code. Dessins simples au trait (motif répété de 160 × 160), colorés par la couleur
// du design grâce à un masque CSS : ils restent discrets et lisibles sur tous les designs.

const S = 'fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';

const TILES: Record<PortfolioField, string> = {
  // Tracé d'électrocardiogramme, croix de soin, cœur.
  sante: `<path ${S} d="M0 40h34l8-16 10 34 9-26 6 8h93"/><path ${S} d="M114 96v20M104 106h20"/><path ${S} d="M36 128c-6-7-16-5-16 4 0 8 16 16 16 16s16-8 16-16c0-9-10-11-16-4z"/><circle ${S} cx="132" cy="140" r="3"/>`,
  // Balises et accolades.
  tech: `<path ${S} d="M28 30l-14 14 14 14M58 30l14 14-14 14M50 26l-12 36"/><path ${S} d="M108 92c-8 0-8 4-8 10s0 8-6 8c6 0 6 2 6 8s0 10 8 10M138 92c8 0 8 4 8 10s0 8 6 8c-6 0-6 2-6 8s0 10-8 10"/><path ${S} d="M20 118h26M20 130h40M20 142h18"/>`,
  // Formes, plume, gribouillis.
  design: `<circle ${S} cx="34" cy="36" r="16"/><path ${S} d="M96 20l22 38H74z"/><rect ${S} x="22" y="98" width="30" height="30" rx="4" transform="rotate(12 37 113)"/><path ${S} d="M88 120c10-18 20 18 30 0s20 18 30 0"/><path ${S} d="M130 64l12 12-30 30-14 2 2-14z"/>`,
  // Barres, courbe qui monte, pourcentage.
  finance: `<path ${S} d="M20 70V52M36 70V40M52 70V30M68 70V46"/><path ${S} d="M90 64l18-16 14 10 26-28M136 30h12v12"/><path ${S} d="M26 140l24-30"/><circle ${S} cx="28" cy="114" r="5"/><circle ${S} cx="48" cy="136" r="5"/><path ${S} d="M96 104h48M96 120h36M96 136h44"/>`,
  // Livre ouvert, crayon, toque.
  education: `<path ${S} d="M20 34c14-6 26-6 38 2 12-8 24-8 38-2v40c-14-6-26-6-38 2-12-8-24-8-38-2zM58 36v40"/><path ${S} d="M114 100l26-26 10 10-26 26-14 4z"/><path ${S} d="M20 120l34-14 34 14-34 14zM34 126v14c12 8 28 8 40 0v-14"/>`,
  // Quadrillage de plan, équerre, casque.
  btp: `<path ${S} d="M10 20h60M10 40h60M10 60h60M20 10v60M40 10v60M60 10v60" stroke-opacity=".5"/><path ${S} d="M96 24v50h50z"/><path ${S} d="M106 54v10h10"/><path ${S} d="M24 140h56M32 140c0-18 12-28 20-28s20 10 20 28M52 112v-6"/><path ${S} d="M106 112l40 30M106 142l40-30" stroke-opacity=".5"/>`,
  // Sac, étiquette, flèche qui monte.
  commerce: `<path ${S} d="M22 44h44l-4 36H26zM34 44v-6a10 10 0 0 1 20 0v6"/><path ${S} d="M96 30h30l20 20-26 26-24-24zM110 44h.01"/><path ${S} d="M28 140l30-30 14 14 30-30M86 94h16v16"/>`,
  // Balance, paragraphe.
  juridique: `<path ${S} d="M52 22v54M30 32h44M30 32l-12 26h24zM74 32l-12 26h24zM40 76h24"/><path ${S} d="M116 96c-10 0-12 14 0 16s10 18-2 18c-6 0-10-4-10-4M116 96c6 0 10 4 10 4M108 112c-8 4-6 16 6 18"/><path ${S} d="M20 134h40M20 146h28"/>`,
  // Cloche, couverts, étoiles.
  hotellerie: `<path ${S} d="M20 70h64M28 70a24 24 0 0 1 48 0M52 44v-6"/><path ${S} d="M106 24v30M100 24v12a6 6 0 0 0 12 0V24M130 24c8 6 8 22 0 28v20"/><path ${S} d="M40 104l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z"/><path ${S} d="M116 112l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>`,
  // Carton, camion, route en pointillés.
  logistique: `<path ${S} d="M20 40l26-12 26 12-26 12zM20 40v30l26 12 26-12V40M46 52v30"/><path ${S} d="M92 112h34v-22H92zM126 98h14l8 10v4h-22"/><circle ${S} cx="102" cy="116" r="5"/><circle ${S} cx="138" cy="116" r="5"/><path ${S} d="M14 140c20-10 40 10 60 0s40 10 60 0" stroke-dasharray="6 8"/>`,
  // Points réguliers.
  general: `<circle cx="20" cy="20" r="2.4"/><circle cx="60" cy="60" r="2.4"/><circle cx="100" cy="20" r="2.4"/><circle cx="140" cy="60" r="2.4"/><circle cx="20" cy="100" r="2.4"/><circle cx="60" cy="140" r="2.4"/><circle cx="100" cy="100" r="2.4"/><circle cx="140" cy="140" r="2.4"/>`,
};

/** Image du motif (à utiliser comme masque CSS), ou null sans domaine. */
export function motifUrl(field: PortfolioField | ''): string | null {
  if (!field) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">${TILES[field]}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/** Pictogramme du métier, posé devant le titre. */
export const FIELD_ICONS: Record<PortfolioField, LucideIcon> = {
  sante: Stethoscope,
  tech: Code2,
  design: Palette,
  finance: ChartNoAxesCombined,
  education: BookOpen,
  btp: HardHat,
  commerce: ShoppingBag,
  juridique: Scale,
  hotellerie: UtensilsCrossed,
  logistique: Truck,
  general: BriefcaseBusiness,
};
