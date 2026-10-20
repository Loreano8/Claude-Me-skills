import { useState } from 'react';
import { Chip } from './ui.tsx';

/** Liste de mots-clés : on tape puis Entrée (ou virgule) pour ajouter. */
export function TagInput({
  label,
  values,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState('');

  function add(raw: string) {
    const parts = raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (parts.length) onChange([...values, ...parts]);
    setDraft('');
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
        {values.map((v, i) => (
          <Chip key={`${v}-${i}`} tone="brand" onRemove={() => onChange(values.filter((_, j) => j !== i))}>
            {v}
          </Chip>
        ))}
        <input
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,;]$/.test(v)) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={values.length ? '' : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-[15px] outline-none placeholder:text-slate-400"
        />
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
