import type {
  Circuit,
  PublicPoint,
  PublicRoom,
  PublicRoute,
} from '@drawmyplace/contracts';
import { DoorOpen, Zap } from 'lucide-react';
import { useI18n } from '@/features/i18n/i18n-context';
import { pointInPolygon, polygonArea } from './structure-geometry';

interface RoomNavigatorProps {
  rooms: readonly PublicRoom[];
  points?: readonly PublicPoint[];
  routes?: readonly PublicRoute[];
  circuits?: readonly Circuit[];
  metersPerUnit?: number | null;
  selectedRoomId?: string | null;
  onSelect: (roomId: string) => void;
}

export function RoomNavigator({
  rooms,
  points = [],
  routes = [],
  circuits = [],
  metersPerUnit = null,
  selectedRoomId,
  onSelect,
}: RoomNavigatorProps) {
  const { t } = useI18n();

  return (
    <section className="editor-panel p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          {t('rooms.navigate')}
        </h2>
        <span className="text-xs text-slate-500">{rooms.length}</span>
      </div>

      {rooms.length === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {t('rooms.navigateEmpty')}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rooms.map((room) => {
            const roomPoints = points.filter((point) =>
              pointInPolygon(point, room.boundary),
            );
            const roomRoutes = routes.filter((route) =>
              route.geometry.some((vertex) =>
                pointInPolygon(vertex, room.boundary),
              ),
            );
            const circuitIds = [
              ...new Set(
                [
                  ...roomPoints.map(
                    (point) => point.properties.circuitId ?? null,
                  ),
                  ...roomRoutes.map((route) => route.circuitId),
                ].filter((id): id is string => Boolean(id)),
              ),
            ];
            const area = polygonArea(room.boundary);
            const areaLabel =
              metersPerUnit !== null
                ? `${(area * metersPerUnit * metersPerUnit).toFixed(1)} m²`
                : t('rooms.noScale');

            return (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => onSelect(room.id)}
                  aria-pressed={room.id === selectedRoomId}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                    room.id === selectedRoomId
                      ? 'border-[var(--dmp-color-brand)]/40 bg-[var(--dmp-color-brand)]/10'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <DoorOpen className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200">
                      {room.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-500 tabular-nums">
                      {areaLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-5 text-[10px] text-slate-500">
                    {roomPoints.length} {t('rooms.devicesShort')}
                  </p>
                  {circuitIds.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1 pl-5">
                      {circuitIds.slice(0, 3).map((id) => {
                        const circuit = circuits.find((item) => item.id === id);
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-1 py-0.5 text-[9px] text-slate-400"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor: circuit?.color ?? '#2f6bd8',
                              }}
                            />
                            {circuit?.id ?? id}
                          </span>
                        );
                      })}
                      {circuitIds.length > 3 ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-500">
                          <Zap className="h-2.5 w-2.5" />+
                          {circuitIds.length - 3}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
