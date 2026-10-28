import {
  DEVICE_LIBRARY,
  DEVICE_SUBTYPES,
  type Circuit,
  type DeviceSubtype,
  type ElectricalPointType,
} from '@drawmyplace/contracts';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { useI18n } from '@/features/i18n/i18n-context';

export interface AddElementResult {
  type: ElectricalPointType;
  subtype: DeviceSubtype | null;
  productId: string | null;
  circuitId: string | null;
}

interface AddElementDialogProps {
  open: boolean;
  initialType: ElectricalPointType;
  initialSubtype: DeviceSubtype | null;
  circuits: readonly Circuit[];
  onClose: () => void;
  onConfirm: (result: AddElementResult) => void;
}

const POINT_TYPES: ElectricalPointType[] = [
  'socket',
  'switch',
  'light',
  'panel',
  'junction',
  'custom',
];

const TYPE_LABEL_KEYS: Record<ElectricalPointType, string> = {
  socket: 'editor.point.socket',
  switch: 'editor.point.switch',
  light: 'editor.point.light',
  panel: 'editor.point.board',
  junction: 'editor.point.junction',
  custom: 'editor.point.custom',
};

export function AddElementDialog({
  open,
  initialType,
  initialSubtype,
  circuits,
  onClose,
  onConfirm,
}: AddElementDialogProps) {
  const { t } = useI18n();
  const [type, setType] = useState<ElectricalPointType>(initialType);
  const [subtype, setSubtype] = useState<DeviceSubtype | null>(initialSubtype);
  const [productId, setProductId] = useState<string>('');
  const [circuitId, setCircuitId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setSubtype(initialSubtype);
    setProductId('');
    setCircuitId('');
  }, [open, initialType, initialSubtype]);

  const subtypes = useMemo(
    () => DEVICE_SUBTYPES.filter((item) => item.type === type),
    [type],
  );
  const products = useMemo(() => {
    const allowed = new Set(
      subtypes.map((item) => item.id as DeviceSubtype),
    );
    return DEVICE_LIBRARY.filter((product) =>
      subtype ? product.subtype === subtype : allowed.has(product.subtype),
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [subtype, subtypes]);

  function changeType(next: ElectricalPointType) {
    setType(next);
    setSubtype(null);
    setProductId('');
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('editor.addElement.title')}
      description={t('editor.addElement.description')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('editor.cancel')}
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                type,
                subtype,
                productId: productId || null,
                circuitId: circuitId || null,
              })
            }
          >
            {t('editor.addElement.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-xs text-muted-foreground">
          {t('editor.addElement.type')}
          <Select
            value={type}
            onChange={(event) =>
              changeType(event.target.value as ElectricalPointType)
            }
            className="mt-1"
          >
            {POINT_TYPES.map((item) => (
              <option key={item} value={item}>
                {t(TYPE_LABEL_KEYS[item])}
              </option>
            ))}
          </Select>
        </label>

        <label className="block text-xs text-muted-foreground">
          {t('editor.addElement.subtype')}
          <Select
            value={subtype ?? ''}
            onChange={(event) => {
              setSubtype((event.target.value || null) as DeviceSubtype | null);
              setProductId('');
            }}
            className="mt-1"
          >
            <option value="">{t('editor.addElement.basePoint')}</option>
            {subtypes.map((item) => (
              <option key={item.id} value={item.id}>
                {t(`devices.subtype.${item.id}`)}
              </option>
            ))}
          </Select>
        </label>

        <label className="block text-xs text-muted-foreground">
          {t('editor.addElement.article')}
          <Select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="mt-1"
          >
            <option value="">{t('editor.addElement.noArticle')}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.manufacturer} · {product.name} · {product.article}
              </option>
            ))}
          </Select>
        </label>

        <label className="block text-xs text-muted-foreground">
          {t('editor.addElement.circuit')}
          <Select
            value={circuitId}
            onChange={(event) => setCircuitId(event.target.value)}
            className="mt-1"
          >
            <option value="">{t('editor.addElement.unassigned')}</option>
            {circuits.map((circuit) => (
              <option key={circuit.id} value={circuit.id}>
                {circuit.id} · {circuit.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
    </Dialog>
  );
}
