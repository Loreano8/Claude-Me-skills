import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  ai: 'bg-gradient-to-r from-violet-600 to-brand-600 text-white hover:from-violet-700 hover:to-brand-700 shadow-sm',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'text-red-600 hover:bg-red-50',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' && 'px-2.5 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-5 py-3 text-base',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Card({ title, subtitle, actions, children, className }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Section({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</span>
        <span className="flex-1 font-semibold text-slate-900">{title}</span>
        {badge}
        <ChevronDown className={cx('size-5 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-slate-100 px-4 pt-4 pb-5 sm:px-5">{children}</div>}
    </section>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none';

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
  list,
  className,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  list?: string;
  className?: string;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        list={list}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  hint,
  className,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputClass, 'resize-y leading-relaxed')}
      />
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  return <div className={cx('rounded-xl border px-3.5 py-2.5 text-sm', tones[tone])}>{children}</div>;
}

export function Chip({ children, tone = 'slate', onRemove }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'brand'; onRemove?: () => void }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-900',
    brand: 'bg-brand-50 text-brand-800',
  };
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm', tones[tone])}>
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-1 rounded-full px-1 text-current opacity-60 hover:opacity-100" aria-label="Retirer">
          ×
        </button>
      )}
    </span>
  );
}
