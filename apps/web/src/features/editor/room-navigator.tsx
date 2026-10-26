import type { PublicRoom } from '@drawmyplace/contracts';
import { DoorOpen } from 'lucide-react';
import { useI18n } from '@/features/i18n/i18n-context';

interface RoomNavigatorProps {
  rooms: readonly PublicRoom[];
  selectedRoomId?: string | null;
  onSelect: (roomId: string) => void;
}

export function RoomNavigator({
  rooms,
  selectedRoomId,
  onSelect,
}: RoomNavigatorProps) {
  const { t } = useI18n();

  return (
    <section className="editor-panel p-4">
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
        <ul className="mt-2 space-y-1">
          {rooms.map((room) => (
            <li key={room.id}>
              <button
                type="button"
                onClick={() => onSelect(room.id)}
                aria-pressed={room.id === selectedRoomId}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                  room.id === selectedRoomId
                    ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                    : 'border-white/5 bg-white/[0.02] text-slate-300 hover:border-white/15 hover:bg-white/[0.06]'
                }`}
              >
                <DoorOpen className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span className="truncate">{room.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
