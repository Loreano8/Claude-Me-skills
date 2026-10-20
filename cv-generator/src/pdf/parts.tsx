import { Image, Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { CvDocument } from '../types.ts';
import { fullName } from '../lib/cv.ts';
import type { Labels } from './labels.ts';
import { signatureLine } from './theme.ts';

export function Bullets({ items, color, style }: { items: string[]; color: string; style?: Style }) {
  return (
    <View style={{ marginTop: 3 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 2, ...style }}>
          <Text style={{ width: 9, color }}>•</Text>
          <Text style={{ flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function Photo({ cv, size, border }: { cv: CvDocument; size: number; border?: string }) {
  if (!cv.settings.showPhoto || !cv.photo) return null;
  return (
    <Image
      src={cv.photo}
      style={{
        width: size,
        height: size,
        borderRadius: cv.settings.photoShape === 'round' ? size / 2 : 6,
        objectFit: 'cover',
        ...(border ? { borderWidth: 3, borderColor: border } : {}),
      }}
    />
  );
}

export function SignatureBlock({ cv, L, align = 'right' }: { cv: CvDocument; L: Labels; align?: 'left' | 'right' }) {
  if (!cv.settings.showSignature || !cv.signature) return null;
  const line = signatureLine(cv, L);
  return (
    <View wrap={false} style={{ marginTop: 18, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {line ? <Text style={{ fontSize: 9, color: '#4b5563' }}>{line}</Text> : null}
      <Image src={cv.signature} style={{ height: 42, maxWidth: 160, objectFit: 'contain', marginTop: 4 }} />
      <Text style={{ fontSize: 9, fontWeight: 600, marginTop: 2 }}>{fullName(cv.personal)}</Text>
    </View>
  );
}
