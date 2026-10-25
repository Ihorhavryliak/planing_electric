import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';

interface CommitFieldProps {
  label: string;
  initial: string;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: 'text' | 'decimal';
  /** Returns an error message, or null when the value was accepted. */
  onCommit: (raw: string) => string | null;
}

/**
 * Text field that saves on blur / Enter instead of on every keystroke, so a
 * request is not sent for each typed character. Escape restores the saved
 * value. Remount it (via `key`) when the saved value changes.
 */
export function CommitField({
  label,
  initial,
  hint,
  placeholder,
  maxLength,
  inputMode = 'text',
  onCommit,
}: CommitFieldProps) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function commit() {
    if (draft === initial) {
      setError(null);
      return;
    }

    setError(onCommit(draft));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setDraft(initial);
      setError(null);
      event.currentTarget.blur();
    }
  }

  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs text-slate-400">
        {label}
        {hint ? <span className="text-slate-500">{hint}</span> : null}
      </span>
      <Input
        className="mt-1 h-9"
        value={draft}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
      {error ? (
        <span role="alert" className="mt-1 block text-[11px] text-rose-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}
