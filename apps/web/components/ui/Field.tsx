"use client";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";

const control =
  "w-full rounded-control border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] text-sm px-3 transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent disabled:opacity-60";

interface FieldShell {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

function Shell({ id, label, hint, error, required, className = "", children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-ink">
          {label}
          {required && <span aria-hidden className="text-danger"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ label, hint, error, required, className, id: givenId, ...rest }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const id = givenId ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <input id={id} className={`${control} h-10`} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} required={required} {...rest} />
    </Shell>
  );
}

export function Select({ label, hint, error, required, className, id: givenId, children, ...rest }: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const id = givenId ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <select id={id} className={`${control} h-10`} aria-invalid={!!error || undefined} required={required} {...rest}>
        {children}
      </select>
    </Shell>
  );
}

export function Textarea({ label, hint, error, required, className, id: givenId, ...rest }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const id = givenId ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea id={id} className={`${control} min-h-[96px] py-2`} aria-invalid={!!error || undefined} required={required} {...rest} />
    </Shell>
  );
}

export function Checkbox({ label, className = "", id: givenId, ...rest }: { label: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const id = givenId ?? auto;
  return (
    <label htmlFor={id} className={`inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2 ${className}`}>
      <input id={id} type="checkbox" className="h-4 w-4 rounded border-line-strong accent-[var(--accent)]" {...rest} />
      {label}
    </label>
  );
}
