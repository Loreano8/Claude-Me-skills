import type { CvDocument } from '../types.ts';
import { ClassicTemplate } from './templates/Classic.tsx';
import { ElegantTemplate } from './templates/Elegant.tsx';
import { ModernTemplate } from './templates/Modern.tsx';

export function CvPdf({ cv }: { cv: CvDocument }) {
  switch (cv.settings.template) {
    case 'classique':
      return <ClassicTemplate cv={cv} />;
    case 'elegant':
      return <ElegantTemplate cv={cv} />;
    default:
      return <ModernTemplate cv={cv} />;
  }
}
