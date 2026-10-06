'use client';

import Link from 'next/link';
import { forwardRef, useId } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';

export function cn(...parts: (string | number | bigint | false | null | undefined)[]): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');
}

/* ─── Button ───────────────────────────────────────────────────────────── */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-sm',
  secondary: 'bg-surface text-fg border border-line hover:bg-surface-2 shadow-sm',
  outline: 'border border-line-strong text-fg hover:bg-surface-2',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger text-white hover:opacity-90',
};
const SIZES: Record<Size, string> = {
  xs: 'h-7 px-2 text-xs gap-1 rounded-md',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-lg',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = 'secondary',
  size = 'md',
  className,
  children,
  external,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const cls = cn(
    'inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
  if (external)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

/* ─── Card ─────────────────────────────────────────────────────────────── */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface shadow-sm', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3 border-b border-line px-4 py-3', className)}>
      {icon && <div className="mt-0.5 text-subtle">{icon}</div>}
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-subtle">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

/* ─── Form fields ──────────────────────────────────────────────────────── */

const inputBase =
  'w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-subtle shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(inputBase, 'h-9', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(inputBase, 'py-2 font-mono text-[13px] leading-relaxed', className)} {...rest} />;
  },
);

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select className={cn(inputBase, 'h-9 cursor-pointer pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-muted">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

/** Compact numeric input with an optional unit suffix. */
export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  unit,
  label,
  className,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn('relative', className)}>
      {label && (
        <label htmlFor={id} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-subtle">
          {label}
        </label>
      )}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ''}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className={cn(inputBase, 'tabular h-8 text-right text-[13px]', label ? 'pl-7' : '', unit ? 'pr-7' : 'pr-2')}
      />
      {unit && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-subtle">{unit}</span>}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 text-sm', disabled && 'cursor-not-allowed opacity-60')}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong accent-[var(--accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="text-fg">{label}</span>
        {description && <span className="block text-xs text-subtle">{description}</span>}
      </span>
    </label>
  );
}

/* ─── Segmented control / tabs ─────────────────────────────────────────── */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  fullWidth,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode; disabled?: boolean }[];
  size?: 'sm' | 'md';
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <div role="tablist" className={cn('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', fullWidth && 'flex w-full', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-40',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
            fullWidth && 'flex-1',
            value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-subtle hover:text-fg',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Badge ────────────────────────────────────────────────────────────── */

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  accent: 'bg-accent-soft text-accent border-accent-line',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none', TONES[tone], className)}>
      {children}
    </span>
  );
}

/* ─── Callout ──────────────────────────────────────────────────────────── */

export function Callout({
  tone = 'neutral',
  title,
  children,
  className,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : tone === 'danger' ? XCircle : Info;
  const color =
    tone === 'success'
      ? 'bg-success-soft text-success'
      : tone === 'warning'
        ? 'bg-warning-soft text-warning'
        : tone === 'danger'
          ? 'bg-danger-soft text-danger'
          : 'bg-surface-2 text-muted';
  return (
    <div className={cn('flex gap-2.5 rounded-lg px-3 py-2.5 text-[13px]', color, className)} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-fg/80 [&_a]:underline')}>{children}</div>}
      </div>
    </div>
  );
}

/* ─── Stats, progress, misc ────────────────────────────────────────────── */

export function Stat({
  label,
  value,
  unit,
  hint,
  tone,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  tone?: 'success' | 'warning' | 'danger';
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface px-3 py-2.5', className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">{label}</p>
      <p
        className={cn(
          'tabular mt-1 text-lg font-semibold leading-none',
          tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : 'text-fg',
        )}
      >
        {value}
        {unit && <span className="ml-1 text-xs font-medium text-subtle">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-[11px] text-subtle">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ value, indeterminate, className }: { value?: number; indeterminate?: boolean; className?: string }) {
  return (
    <div className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      {indeterminate ? (
        <div className="animate-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-accent" />
      ) : (
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
      )}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-subtle', className)} />;
}

export function EmptyState({
  icon,
  title,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      {icon && <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-subtle">{icon}</div>}
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <div className="mt-1 max-w-sm text-[13px] text-subtle">{children}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">{children}</kbd>;
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-[11px] font-semibold uppercase tracking-wider text-subtle', className)}>{children}</p>;
}
