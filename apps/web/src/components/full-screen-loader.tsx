import { LoaderCircle } from 'lucide-react';

export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center gap-3 text-sm text-slate-400"
      role="status"
    >
      <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
      {label}
    </div>
  );
}
