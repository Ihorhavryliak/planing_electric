import type {
  ElectricalPointType,
  PublicPoint,
  UpdatePointInput,
} from '@drawmyplace/contracts';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommitField } from './commit-field';
import { formatFieldNumber, parseOptionalNumber } from './point-fields';
import { POINT_SYMBOL_LIST, POINT_SYMBOLS } from './point-symbols';

interface PointPropertiesPanelProps {
  point: PublicPoint;
  onChange: (patch: UpdatePointInput) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function PointPropertiesPanel({
  point,
  onChange,
  onDuplicate,
  onDelete,
}: PointPropertiesPanelProps) {
  const symbol = POINT_SYMBOLS[point.type];

  function commitNumber(
    raw: string,
    label: string,
    min: number,
    max: number,
    apply: (value: number | null) => UpdatePointInput | null,
  ): string | null {
    const parsed = parseOptionalNumber(raw, { label, min, max });

    if (!parsed.ok) {
      return parsed.error;
    }

    const patch = apply(parsed.value);

    if (patch) {
      onChange(patch);
    }

    return null;
  }

  function commitCoordinate(raw: string, axis: 'x' | 'y'): string | null {
    const parsed = parseOptionalNumber(raw, {
      label: `Coordinate ${axis.toUpperCase()}`,
      min: -10_000_000,
      max: 10_000_000,
    });

    if (!parsed.ok) {
      return parsed.error;
    }

    if (parsed.value === null) {
      return 'Coordinate is required.';
    }

    onChange(axis === 'x' ? { x: parsed.value } : { y: parsed.value });

    return null;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: symbol.color }}
        />
        <h2 className="text-sm font-semibold text-white">{symbol.label}</h2>
      </div>

      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="text-xs text-slate-400">Type</span>
          <select
            className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-sm text-slate-100 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
            value={point.type}
            onChange={(event) =>
              onChange({ type: event.target.value as ElectricalPointType })
            }
          >
            {POINT_SYMBOL_LIST.map((item) => (
              <option key={item.type} value={item.type}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <CommitField
          key={`${point.id}-label-${point.label ?? ''}`}
          label="Label"
          initial={point.label ?? ''}
          placeholder="e.g. S1"
          maxLength={60}
          onCommit={(raw) => {
            onChange({ label: raw.trim() === '' ? null : raw.trim() });
            return null;
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <CommitField
            key={`${point.id}-height-${point.mountingHeight ?? ''}`}
            label="Mounting height"
            hint="m"
            inputMode="decimal"
            initial={formatFieldNumber(point.mountingHeight)}
            placeholder="not set"
            onCommit={(raw) =>
              commitNumber(raw, 'Mounting height', 0, 100, (value) => ({
                mountingHeight: value,
              }))
            }
          />
          <CommitField
            key={`${point.id}-drop-${point.properties.verticalDropMeters ?? ''}`}
            label="Vertical drop"
            hint="m"
            inputMode="decimal"
            initial={formatFieldNumber(point.properties.verticalDropMeters)}
            placeholder="type default"
            onCommit={(raw) =>
              commitNumber(raw, 'Vertical drop', 0, 100, (value) => {
                const { verticalDropMeters: _previous, ...rest } =
                  point.properties;

                return {
                  properties:
                    value === null ? rest : { ...rest, verticalDropMeters: value },
                };
              })
            }
          />
        </div>

        <CommitField
          key={`${point.id}-rotation-${point.rotation}`}
          label="Rotation"
          hint="degrees"
          inputMode="decimal"
          initial={formatFieldNumber(point.rotation)}
          onCommit={(raw) =>
            commitNumber(raw, 'Rotation', -360, 360, (value) => ({
              rotation: value ?? 0,
            }))
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <CommitField
            key={`${point.id}-x-${point.x}`}
            label="X"
            hint="plan units"
            inputMode="decimal"
            initial={formatFieldNumber(point.x)}
            onCommit={(raw) => commitCoordinate(raw, 'x')}
          />
          <CommitField
            key={`${point.id}-y-${point.y}`}
            label="Y"
            hint="plan units"
            inputMode="decimal"
            initial={formatFieldNumber(point.y)}
            onCommit={(raw) => commitCoordinate(raw, 'y')}
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        The vertical drop is added to a cable route only when the route end
        sits exactly on this point. Leave it empty to use the type default.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
          Duplicate
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
    </section>
  );
}
