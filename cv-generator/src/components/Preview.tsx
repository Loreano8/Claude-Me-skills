import { lazy, Suspense } from 'react';
import type { PdfSource } from './PdfPane.tsx';

const PdfPane = lazy(() => import('./PdfPane.tsx'));

export function Preview({ source }: { source: PdfSource }) {
  return (
    <Suspense fallback={<div className="aspect-[1/1.414] w-full animate-pulse rounded-sm bg-white shadow-md ring-1 ring-slate-200" />}>
      <PdfPane source={source} />
    </Suspense>
  );
}
