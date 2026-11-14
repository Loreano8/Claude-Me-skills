import type { CvDocument } from '../types.ts';
import { FitContext } from './fit.tsx';
import { resolveStyle } from './catalog.ts';
import { ClassicTemplate } from './templates/Classic.tsx';
import { ElegantTemplate } from './templates/Elegant.tsx';
import { ModernTemplate } from './templates/Modern.tsx';
import { StudioTemplate } from './templates/Studio.tsx';
import { PremiumTemplate } from './templates/Premium.tsx';
import { CollectionTemplate } from './templates/Collection.tsx';
import { PureTemplate } from './templates/Pure.tsx';

export function CvPdf({ cv, fit = 1 }: { cv: CvDocument; fit?: number }) {
  return <FitContext.Provider value={fit}>{template(cv)}</FitContext.Provider>;
}

function template(cv: CvDocument) {
  switch (cv.settings.template) {
    case 'classique':
      return <ClassicTemplate cv={cv} />;
    case 'elegant':
      return <ElegantTemplate cv={cv} />;
    case 'moderne':
      return <ModernTemplate cv={cv} />;
    case 'prestige':
    case 'horizon':
    case 'atelier':
    case 'signature':
      return <PremiumTemplate cv={cv} id={cv.settings.template} />;
    case 'simple':
    case 'bicolore':
    case 'compact':
    case 'ardoise':
    case 'galerie':
    case 'cadre':
    case 'mosaique':
      return <CollectionTemplate cv={cv} id={cv.settings.template} />;
    case 'clarte':
    case 'epure':
    case 'ligne':
    case 'nord':
    case 'pastel':
      return <PureTemplate cv={cv} id={cv.settings.template} />;
    default: {
      const style = resolveStyle(cv.settings);
      return style ? <StudioTemplate cv={cv} style={style} /> : <ModernTemplate cv={cv} />;
    }
  }
}
