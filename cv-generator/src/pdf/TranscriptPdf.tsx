import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { FONT } from './theme.ts';
import { transcriptBlocks } from './transcriptText.ts';

// Document manuscrit retranscrit en texte tapé (service payant : pas de mention CV Studio).

const s = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: 11, color: '#111827', lineHeight: 1.5, paddingVertical: 56, paddingHorizontal: 60 },
  title: { fontSize: 15, fontWeight: 700, textAlign: 'center', marginBottom: 22 },
  paragraph: { marginBottom: 10 },
  bullet: { flexDirection: 'row', marginBottom: 4, paddingLeft: 6 },
});

export function TranscriptPdf({ title, text }: { title: string; text: string }) {
  return (
    <Document title={title || 'Document retranscrit'} creator="CV Studio">
      <Page size="A4" style={s.page}>
        {title ? <Text style={s.title}>{title}</Text> : null}
        {transcriptBlocks(text).map((b, i) =>
          b.kind === 'li' ? (
            <View key={i} style={s.bullet} wrap={false}>
              <Text style={{ width: 12 }}>•</Text>
              <Text style={{ flex: 1 }}>{b.text}</Text>
            </View>
          ) : (
            <Text key={i} style={s.paragraph}>
              {b.text}
            </Text>
          ),
        )}
      </Page>
    </Document>
  );
}
