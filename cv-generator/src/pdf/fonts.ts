import { Font } from '@react-pdf/renderer';
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff?url';
import inter400i from '@fontsource/inter/files/inter-latin-400-italic.woff?url';
import inter500 from '@fontsource/inter/files/inter-latin-500-normal.woff?url';
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff?url';
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff?url';

export const FONT = 'Inter';

let registered = false;

export function registerFonts(): void {
  if (registered) return;
  registered = true;
  Font.register({
    family: FONT,
    fonts: [
      { src: inter400, fontWeight: 400 },
      { src: inter400i, fontWeight: 400, fontStyle: 'italic' },
      { src: inter500, fontWeight: 500 },
      { src: inter600, fontWeight: 600 },
      { src: inter700, fontWeight: 700 },
    ],
  });
  // Pas de césure automatique (les règles anglaises coupent mal les mots français).
  Font.registerHyphenationCallback((word) => [word]);
}
