import {
  ArrowLeft,
  Check,
  CircleAlert,
  Info,
  Moon,
  Palette,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Popover } from '@/components/ui/popover';
import { Tabs } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { useTheme } from '@/features/theme/theme-context';
import { cn } from '@/lib/utils';

const COLOR_TOKENS = [
  ['--dmp-color-brand', 'Brand'],
  ['--dmp-color-brand-strong', 'Brand strong'],
  ['--dmp-color-surface', 'Surface'],
  ['--dmp-color-surface-raised', 'Surface raised'],
  ['--dmp-color-border', 'Border'],
  ['--dmp-color-text', 'Text'],
  ['--dmp-color-text-muted', 'Text muted'],
  ['--dmp-color-text-subtle', 'Text subtle'],
  ['--dmp-color-success', 'Success'],
  ['--dmp-color-warning', 'Warning'],
  ['--dmp-color-danger', 'Danger'],
  ['--dmp-color-info', 'Info'],
] as const;

const TYPE_TOKENS = [
  ['--dmp-text-2xs', '2xs · 11 px'],
  ['--dmp-text-xs', 'xs · 12 px'],
  ['--dmp-text-sm', 'sm · 14 px'],
  ['--dmp-text-md', 'md · 16 px'],
  ['--dmp-text-lg', 'lg · 20 px'],
  ['--dmp-text-xl', 'xl · 28 px'],
  ['--dmp-text-2xl', '2xl · 32 px'],
] as const;

const SPACE_TOKENS = [
  ['--dmp-space-1', '4'],
  ['--dmp-space-2', '8'],
  ['--dmp-space-3', '12'],
  ['--dmp-space-4', '16'],
  ['--dmp-space-6', '24'],
  ['--dmp-space-8', '32'],
  ['--dmp-space-12', '48'],
] as const;

const RADIUS_TOKENS = [
  ['--dmp-radius-sm', 'sm'],
  ['--dmp-radius-md', 'md'],
  ['--dmp-radius-lg', 'lg'],
  ['--dmp-radius-xl', 'xl'],
  ['--dmp-radius-2xl', '2xl'],
] as const;

const SHADOW_TOKENS = [
  ['--dmp-shadow-0', 'elevation 0'],
  ['--dmp-shadow-1', 'elevation 1'],
  ['--dmp-shadow-2', 'elevation 2'],
  ['--dmp-shadow-3', 'elevation 3'],
  ['--dmp-shadow-4', 'elevation 4'],
] as const;

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="app-panel p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function DesignPage() {
  const { resolved, toggle } = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<'overview' | 'tokens'>('overview');

  const values = useMemo(() => {
    if (typeof window === 'undefined') return {} as Record<string, string>;
    const styles = window.getComputedStyle(document.documentElement);

    return Object.fromEntries(
      [...COLOR_TOKENS, ...TYPE_TOKENS, ...SPACE_TOKENS, ...RADIUS_TOKENS, ...SHADOW_TOKENS].map(
        ([token]) => [token, styles.getPropertyValue(token).trim()],
      ),
    );
  }, [resolved]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
            <span className="text-slate-700">/</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
              <Palette className="h-4 w-4 text-amber-300" />
              Design tokens
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">
              {resolved}
            </span>
            <Button variant="outline" size="sm" onClick={toggle}>
              {resolved === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              Toggle theme
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-amber-300/80">
              Dev catalog
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              DrawMyPlace design system
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Live tokens from <code className="text-amber-200">@drawmyplace/ui</code>.
              Use <code>VITE_ENABLE_DESIGN=true</code> outside development.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
            <Sparkles className="h-3.5 w-3.5" />
            Semantic tokens
          </span>
        </div>

        <Section
          title="Colors"
          hint="Brand, surfaces, text and status colors are remapped for the light theme."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {COLOR_TOKENS.map(([token, label]) => (
              <div
                key={token}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-2"
              >
                <span
                  className="h-9 w-9 shrink-0 rounded-lg border border-white/10"
                  style={{ background: `var(${token})` }}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-200">
                    {label}
                  </p>
                  <p className="truncate font-mono text-[10px] text-slate-500">
                    {token} · {values[token]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Typography" hint="Six-step scale, tight and normal leading.">
            <div className="space-y-2">
              {TYPE_TOKENS.map(([token, label]) => (
                <p
                  key={token}
                  className="text-slate-200"
                  style={{ fontSize: `var(${token})` }}
                >
                  The quick brown fox · {label}
                </p>
              ))}
            </div>
          </Section>

          <Section title="Spacing" hint="4 / 8 / 12 / 16 / 24 / 32 / 48 px.">
            <div className="space-y-2">
              {SPACE_TOKENS.map(([token, label]) => (
                <div key={token} className="flex items-center gap-3">
                  <span className="w-8 text-right text-[10px] tabular-nums text-slate-500">
                    {label}
                  </span>
                  <span
                    className="h-2 rounded-full bg-amber-400/70"
                    style={{ width: `var(${token})` }}
                  />
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Radii" hint="Rounded corners from controls to panels.">
            <div className="grid grid-cols-5 gap-2">
              {RADIUS_TOKENS.map(([token, label]) => (
                <div key={token} className="text-center">
                  <div
                    className="mx-auto h-16 w-full border border-white/15 bg-white/[0.04]"
                    style={{ borderRadius: `var(${token})` }}
                  />
                  <p className="mt-1 text-[10px] text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Elevation" hint="Four levels plus flat surfaces.">
            <div className="grid grid-cols-5 gap-2">
              {SHADOW_TOKENS.map(([token, label]) => (
                <div key={token} className="text-center">
                  <div
                    className="mx-auto h-16 w-full rounded-xl border border-white/10 bg-slate-900"
                    style={{ boxShadow: `var(${token})` }}
                  />
                  <p className="mt-1 text-[10px] text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>


        <Section
          title="Components"
          hint="Token-driven primitives with sm/md/lg sizes and primary, secondary, ghost and danger variants."
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="link">Link</Button>
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Input" />
              <Select defaultValue="a">
                <option value="a">Option A</option>
                <option value="b">Option B</option>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Neutral</Badge>
              <Badge variant="brand">Brand</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
              <Badge variant="info">Info</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Tabs
                ariaLabel="Design tabs"
                value={tab}
                onChange={setTab}
                items={[
                  { id: 'overview', label: 'Overview' },
                  { id: 'tokens', label: 'Tokens', badge: '12' },
                ]}
              />
              <Popover trigger={<Button variant="outline" size="sm">Popover</Button>}>
                <p className="px-1 py-1 text-xs text-slate-300">
                  Popover content uses the raised surface token.
                </p>
              </Popover>
              <Tooltip label="Tooltip content">
                <Button variant="ghost" size="sm">Hover me</Button>
              </Tooltip>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                Open dialog
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Card title</CardTitle>
                  <CardDescription>Compact card for panels and summaries.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="brand">Ready</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Second card</CardTitle>
                  <CardDescription>Same primitives in both themes.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm">Action</Button>
                </CardContent>
              </Card>
            </div>
          </div>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Dialog primitive"
            description="Scale + fade in 180 ms, Escape and backdrop close."
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
              </>
            }
          >
            <Input placeholder="Dialog field" />
          </Dialog>
        </Section>

        <Section title="Motion" hint="Durations and easing for interactions and dialogs.">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ['--dmp-duration-fast', 'Fast · 120 ms'],
              ['--dmp-duration-base', 'Base · 180 ms'],
              ['--dmp-duration-slow', 'Slow · 240 ms'],
            ].map(([token, label]) => (
              <div
                key={token}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
              >
                <p className="text-xs text-slate-200">{label}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-500">
                  {token}
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full w-1/2 rounded-full bg-sky-400"
                    style={{
                      animation: `design-pulse var(${token}) var(--dmp-ease-standard) infinite alternate`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <style>{`@keyframes design-pulse { from { transform: translateX(0); } to { transform: translateX(100%); } }`}</style>
        </Section>

        <Section title="Controls" hint="Button variants, sizes, inputs and status badges.">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primary</Button>
            <Button variant="outline">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button size="sm">Small</Button>
            <Button size="icon" aria-label="Icon button">
              <Check className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Text input" />
            <Input placeholder="Disabled input" disabled />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200">
              <Check className="h-3 w-3" /> Success
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">
              <CircleAlert className="h-3 w-3" /> Warning
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-[11px] text-rose-200">
              <CircleAlert className="h-3 w-3" /> Danger
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[11px] text-sky-200">
              <Info className="h-3 w-3" /> Info
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              <Sparkles className="h-4 w-4" />
              buttonVariants
            </span>
          </div>
        </Section>
      </main>
    </div>
  );
}
