import { Image as PdfImage, Page as PdfPage, Text as PdfText, View as PdfView } from '@react-pdf/renderer';
import { createContext, useContext, type ComponentProps } from 'react';

/**
 * Resserrage d'un CV qui déborde un peu sur une 2e page : on réduit légèrement les tailles de texte
 * et les espaces verticaux (jamais les largeurs), sans toucher au contenu. 1 = taille normale.
 */
export const FitContext = createContext(1);

const VERTICAL = ['fontSize', 'paddingTop', 'paddingBottom', 'paddingVertical', 'marginTop', 'marginBottom', 'marginVertical', 'gap', 'rowGap'] as const;

type Style = Record<string, unknown>;

function scaleStyle(style: unknown, k: number): unknown {
  if (k === 1 || !style) return style;
  if (Array.isArray(style)) return style.map((s) => scaleStyle(s, k));
  if (typeof style !== 'object') return style;
  const src = style as Style;
  const out: Style = { ...src };
  // Un « padding » ou « margin » global garde son côté horizontal, seul le vertical est resserré.
  for (const key of ['padding', 'margin'] as const) {
    if (typeof src[key] === 'number') {
      const v = src[key] as number;
      delete out[key];
      out[`${key}Horizontal`] ??= v;
      out[`${key}Vertical`] ??= v;
    }
  }
  for (const key of VERTICAL) {
    if (typeof out[key] === 'number') out[key] = Math.round((out[key] as number) * k * 100) / 100;
  }
  // Une hauteur de ligne en points (et non en multiple) suit la taille du texte.
  if (typeof out.lineHeight === 'number' && out.lineHeight > 3) out.lineHeight = Math.round(out.lineHeight * k * 100) / 100;
  return out;
}

function useFit<P extends { style?: unknown }>(props: P): P {
  const k = useContext(FitContext);
  return k === 1 || !props.style ? props : { ...props, style: scaleStyle(props.style, k) };
}

export const View = (props: ComponentProps<typeof PdfView>) => <PdfView {...useFit(props)} />;
export const Text = (props: ComponentProps<typeof PdfText>) => <PdfText {...useFit(props)} />;
export const Page = (props: ComponentProps<typeof PdfPage>) => <PdfPage {...useFit(props)} />;
export const Image = PdfImage;
