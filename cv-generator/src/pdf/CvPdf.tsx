import type { CvDocument } from '../types.ts';
import { resolveStyle } from './catalog.ts';
import { ClassicTemplate } from './templates/Classic.tsx';
import { ElegantTemplate } from './templates/Elegant.tsx';
import { ModernTemplate } from './templates/Modern.tsx';
import { StudioTemplate } from './templates/Studio.tsx';

export function CvPdf({ cv }: { cv: CvDocument }) {
  switch (cv.settings.template) {
    case 'classique':
      return <ClassicTemplate cv={cv} />;
    case 'elegant':
      return <ElegantTemplate cv={cv} />;
    case 'moderne':
      return <ModernTemplate cv={cv} />;
    default: {
      const style = resolveStyle(cv.settings);
      return style ? <StudioTemplate cv={cv} style={style} /> : <ModernTemplate cv={cv} />;
    }
  }
}
