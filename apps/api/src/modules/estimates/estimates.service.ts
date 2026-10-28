import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import {
  buildPanelSchedule,
  buildSignalingTakeoff,
  calculateElectrical,
} from '@drawmyplace/calculations';

const UK_DEVICE_TYPE_LABELS: Record<string, string> = {
  socket: 'Розетка',
  switch: 'Вимикач',
  light: 'Світло',
  panel: 'Розподільний щит',
  junction: 'З’єднувальна коробка',
  custom: 'Точка',
};

const UK_DEVICE_SUBTYPE_LABELS: Record<string, string> = {
  'main-board': 'Головний щит',
  'sub-board': 'Поверховий щит',
  'circuit-origin': 'Точка кола',
  'junction-box': 'З’єднувальна коробка',
  'ceiling-junction-box': 'Стельова з’єднувальна коробка',
  'floor-box': 'Підлогова коробка',
  'socket-single': 'Розетка одинарна',
  'socket-double': 'Розетка подвійна',
  'socket-triple': 'Розетка потрійна',
  'socket-kitchen': 'Розетка кухонна',
  'socket-dedicated': 'Розетка виділена',
  'socket-three-phase': 'Розетка трифазна',
  'socket-floor': 'Розетка підлогова',
  'socket-outdoor': 'Розетка зовнішня',
  'switch-single': 'Вимикач одинарний',
  'switch-double': 'Вимикач подвійний',
  'switch-two-way': 'Вимикач прохідний',
  'switch-intermediate': 'Вимикач проміжний',
  dimmer: 'Диммер',
  'motion-sensor': 'Датчик руху',
  'blind-controller': 'Контролер жалюзі',
  thermostat: 'Термостат',
  'smart-switch': 'Розумний вимикач',
  'light-ceiling': 'Стельове світло',
  'light-wall': 'Настінне світло',
  'light-pendant': 'Підвісне світло',
  'light-led-strip': 'LED-стрічка',
  'light-emergency': 'Аварійне світло',
  'light-outdoor': 'Зовнішнє світло',
  'data-lan': 'LAN-точка',
  'data-tv': 'TV-точка',
  'data-satellite': 'Супутникова точка',
  'data-intercom': 'Домофон',
  'data-alarm': 'Тривожна кнопка',
  'data-camera': 'Відеоточка',
  'data-speaker': 'Аудіоточка',
  'data-smart-home': 'Розумний дім',
  'smoke-detector': 'Димовий датчик',
  'heat-detector': 'Тепловий датчик',
  'smoke-heat-detector': 'Комбінований датчик',
  'manual-call-point': 'Ручна точка виклику',
  'door-contact': 'Контакт дверей',
  'glass-break': 'Датчик розбиття скла',
  'water-leak': 'Датчик протікання',
  'vibration-detector': 'Вібраційний датчик',
  'loop-expander': 'Розширювач шлейфу',
  'siren-internal': 'Внутрішня сирена',
  'siren-external': 'Зовнішня сирена',
  strobe: 'Стробоскоп',
  'exit-sign': 'Вихідний знак',
  'voice-alarm': 'Голосове оповіщення',
  'fire-panel': 'Пожежний щит',
  keypad: 'Клавіатура',
  'card-reader': 'Зчитувач карток',
  'relay-module': 'Релейний модуль',
  'power-supply': 'Блок живлення',
  battery: 'Акумулятор',
  'gsm-communicator': 'GSM-комунікатор',
  dialer: 'Дозвонювач',
  'patch-panel': 'Патч-панель',
  'network-switch': 'Мережевий комутатор',
  'ip-camera': 'IP-камера',
  nvr: 'Відеореєстратор',
};

const UK_LOOP_TYPE_LABELS: Record<string, string> = {
  power: 'живлення',
  fire: 'пожежне',
  security: 'охоронне',
  access: 'доступ',
  cctv: 'відео',
  pa: 'оповіщення',
  data: 'дані',
};

function ukDeviceLabel(type: string, subtype: string | null): string {
  if (subtype) {
    return (
      UK_DEVICE_SUBTYPE_LABELS[subtype] ??
      `${UK_DEVICE_TYPE_LABELS[type] ?? 'Пристрій'} (${subtype.replace(/-/g, ' ')})`
    );
  }
  return UK_DEVICE_TYPE_LABELS[type] ?? 'Пристрій';
}

interface PriceMaterial {
  id: string;
  code: string;
  unit: string;
  unitPrice: number | null;
}

interface DeviceEstimateItem {
  materialId: string | null;
  description: string;
  unit: string;
  quantity: number;
  purchaseQuantity: number | null;
  unitPrice: number | null;
  subtotal: number | null;
  note: string | null;
}

/**
 * Groups placed devices into estimate lines. Every socket, switch, board,
 * junction box or detector becomes a countable line with its article price.
 */
function buildPowerDeviceItems(
  points: readonly PublicPoint[],
  materialByCode: ReadonlyMap<string, PriceMaterial>,
): DeviceEstimateItem[] {
  const groups = new Map<
    string,
    {
      productId: string | null;
      type: string;
      subtype: string | null;
      count: number;
      circuits: Set<string>;
    }
  >();

  for (const point of points) {
    const productId = point.properties.productId ?? null;
    const subtype = point.properties.subtype ?? null;
    const key =
      productId ?? (subtype ? `subtype:${subtype}` : `type:${point.type}`);
    const group = groups.get(key);

    if (group) {
      group.count += 1;
    } else {
      groups.set(key, {
        productId,
        type: point.type,
        subtype,
        count: 1,
        circuits: new Set(),
      });
    }
    const circuitId = point.properties.circuitId;
    if (circuitId) groups.get(key)?.circuits.add(circuitId);
  }

  return [...groups.values()]
    .map((group) => {
      const product = deviceProduct(group.productId);
      const material = product?.catalogCode
        ? materialByCode.get(product.catalogCode)
        : undefined;
      const unitPrice = product?.unitPrice ?? material?.unitPrice ?? null;
      const label = ukDeviceLabel(group.type, group.subtype);
      const description = product
        ? `${label} — ${product.manufacturer} ${product.article} · ${product.name}`
        : label;
      const circuits = [...group.circuits].sort();

      return {
        materialId: material?.id ?? null,
        description,
        unit: product?.unit ?? 'pcs',
        quantity: group.count,
        purchaseQuantity: group.count,
        unitPrice,
        subtotal: unitPrice === null ? null : group.count * unitPrice,
        note: circuits.length > 0 ? `Коло: ${circuits.join(', ')}` : null,
        label,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'uk'))
    .map(({ label: _label, ...item }) => item);
}

import { deviceProduct } from '@drawmyplace/contracts';
import type {
  ElectricalSettings,
  EstimateType,
  PlanCalculation,
  PublicEstimate,
  PublicPoint,
  SignalingLoop,
} from '@drawmyplace/contracts';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { DrawingService } from '../drawing/drawing.service';
import { FloorsRepository } from '../editor/floors.repository';
import { PlansRepository } from '../editor/plans.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { MaterialsService } from '../materials/materials.service';
import { MaterialsRepository } from '../materials/materials.repository';
import { EstimatesRepository } from './estimates.repository';

@Injectable()
export class EstimatesService {
  constructor(
    @Inject(ActivityLogService) private readonly activity: ActivityLogService,
    @Inject(DrawingService) private readonly drawing: DrawingService,
    @Inject(PlansRepository) private readonly plans: PlansRepository,
    @Inject(FloorsRepository) private readonly floors: FloorsRepository,
    @Inject(ProjectsRepository) private readonly projects: ProjectsRepository,
    @Inject(MaterialsService) private readonly materials: MaterialsService,
    @Inject(MaterialsRepository) private readonly materialsRepo: MaterialsRepository,
    @Inject(EstimatesRepository) private readonly estimates: EstimatesRepository,
  ) {}

  async generate(
    ownerId: string,
    planId: string,
    type: EstimateType = 'power',
  ): Promise<PublicEstimate> {
    const plan = await this.plans.findById(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const floor = await this.floors.findById(plan.floorId);
    if (!floor) {
      throw new Error('Floor not found');
    }

    const calculation: PlanCalculation = await this.drawing.calculate(
      ownerId,
      planId,
    );

    const catalog = await this.materials.list();
    const defaultCable =
      catalog.find((item) => item.category === 'cable') ?? catalog[0] ?? null;
    const materialById = new Map(catalog.map((item) => [item.id, item]));
    const materialByCode = new Map(catalog.map((item) => [item.code, item]));

    // Re-read the plan's routes to pick up the assigned cable type (materialId).
    const drawing = await this.drawing.getDrawing(ownerId, planId);
    const routeMaterialById = new Map(
      (drawing?.routes ?? []).map((route) => [route.id, route.materialId]),
    );

    // Critical electrical mismatches (overload, undersized cable, insufficient
    // breaking capacity) must be fixed before an estimate can be issued.
    const planSettings = (plan.calculationSettings ?? {}) as {
      circuits?: { id: string; name: string }[];
      electrical?: ElectricalSettings;
      signaling?: { loops?: SignalingLoop[] };
    };
    const routeLengths = new Map(
      calculation.routes.map((route) => [route.routeId, route.requiredLength]),
    );
    const circuitLengths: Record<string, number> = {};
    for (const route of drawing?.routes ?? []) {
      if (!route.circuitId) continue;
      circuitLengths[route.circuitId] =
        (circuitLengths[route.circuitId] ?? 0) +
        (routeLengths.get(route.id) ?? 0);
    }


    if (type === 'signaling') {
      if (!drawing) {
        throw new BadRequestException({
          code: 'NO_DRAWING',
          message: 'Create the plan drawing before generating a signaling estimate.',
        });
      }

      const loops = planSettings.signaling?.loops ?? [];
      if (loops.length === 0) {
        throw new BadRequestException({
          code: 'NO_SIGNALING_LOOPS',
          message:
            'Add at least one signaling loop before generating a signaling estimate.',
        });
      }

      const takeoff = buildSignalingTakeoff({
        loops,
        points: drawing.points.map((point) => {
          const product = deviceProduct(point.properties.productId ?? null);

          return {
            id: point.id,
            subtype: point.properties.subtype ?? null,
            loopId: point.properties.loopId ?? null,
            address: point.properties.address ?? null,
            zone: point.properties.zone ?? null,
            x: point.x,
            y: point.y,
            standbyA: product?.currentStandbyA ?? 0,
            alarmA: product?.currentAlarmA ?? 0,
            coverageAreaM2: product?.coverageAreaM2,
            coverageRadiusM: product?.coverageRadiusM,
            coverageAngleDeg: product?.coverageAngleDeg ?? null,
            rotation: point.rotation,
          };
        }),
        routes: drawing.routes.map((route) => ({
          id: route.id,
          system:
            (route.settings.system as
              | 'power'
              | 'security'
              | 'fire'
              | 'access'
              | 'cctv'
              | 'pa'
              | 'data'
              | undefined) ?? 'power',
          loopId: route.settings.loopId ?? null,
          mounting: route.settings.mounting ?? null,
          geometry: route.geometry,
          requiredLength: routeLengths.get(route.id) ?? null,
        })),
        rooms: drawing.rooms,
        metersPerUnit: calculation.metersPerUnit,
      });

      const critical = takeoff.issues.filter(
        (issue) => issue.severity === 'error',
      );
      if (critical.length > 0) {
        throw new BadRequestException({
          code: 'SIGNALING_COORDINATION',
          message:
            'Fix critical signaling issues before generating a signaling estimate.',
          issues: critical,
        });
      }

      const grouped = new Map<
        string,
        {
          productId: string | null;
          type: string;
          subtype: string | null;
          count: number;
          loopCodes: Set<string>;
        }
      >();

      for (const point of drawing.points) {
        const loopId = point.properties.loopId;
        if (!loopId) continue;
        const loop = loops.find((item) => item.id === loopId);
        if (!loop) continue;
        const productId = point.properties.productId ?? null;
        const subtype = point.properties.subtype ?? point.type;
        const key = productId ?? `subtype:${subtype}`;
        const group = grouped.get(key);
        if (group) {
          group.count += 1;
          group.loopCodes.add(loop.code);
        } else {
          grouped.set(key, {
            productId,
            type: point.type,
            subtype,
            count: 1,
            loopCodes: new Set([loop.code]),
          });
        }
      }

      const items: Array<{
        materialId: string | null;
        description: string;
        unit: string;
        quantity: number;
        purchaseQuantity: number | null;
        unitPrice: number | null;
        subtotal: number | null;
        note: string | null;
      }> = [];

      for (const group of grouped.values()) {
        const product = deviceProduct(group.productId);
        const material = product?.catalogCode
          ? materialByCode.get(product.catalogCode)
          : undefined;
        const unitPrice = product?.unitPrice ?? material?.unitPrice ?? null;
        const quantity = group.count;

        items.push({
          materialId: material?.id ?? null,
          description: product
            ? `${ukDeviceLabel(group.type, group.subtype)} — ${product.manufacturer} ${product.article} · ${product.name}`
            : ukDeviceLabel(group.type, group.subtype),
          unit: product?.unit ?? 'pcs',
          quantity,
          purchaseQuantity: quantity,
          unitPrice,
          subtotal: unitPrice === null ? null : quantity * unitPrice,
          note: `Коло ${[...group.loopCodes].join(', ')}`,
        });
      }

      for (const result of takeoff.loops) {
        if (result.cableMeters <= 0) continue;
        const loop = loops.find((item) => item.id === result.id);
        const material = loop?.cableMaterialId
          ? materialById.get(loop.cableMaterialId)
          : defaultCable;
        const unitPrice = material?.unitPrice ?? null;
        const purchaseQuantity = Math.ceil(result.cableMeters);

        items.push({
          materialId: material?.id ?? null,
          description: `Сигналізаційний кабель ${result.code} (${UK_LOOP_TYPE_LABELS[loop?.type ?? ''] ?? loop?.type ?? 'сигналізація'})`,
          unit: material?.unit ?? 'm',
          quantity: result.cableMeters,
          purchaseQuantity,
          unitPrice,
          subtotal: unitPrice === null ? null : purchaseQuantity * unitPrice,
          note: `${result.deviceCount} пристроїв · ${result.addresses.length} адрес`,
        });
      }

      if (takeoff.battery.batteries > 0) {
        const battery = deviceProduct('yuasa-battery-7ah');
        const quantity = takeoff.battery.batteries;
        const unitPrice = battery?.unitPrice ?? null;

        items.push({
          materialId: null,
          description: 'Акумулятор 12 В 7 А·год',
          unit: battery?.unit ?? 'pcs',
          quantity,
          purchaseQuantity: quantity,
          unitPrice,
          subtotal: unitPrice === null ? null : quantity * unitPrice,
          note: `Розрахунок АКБ: потрібно ${takeoff.battery.requiredAh} А·год, рекомендовано ${takeoff.battery.recommendedAh} А·год`,
        });
      }

      const created = await this.estimates.create(
        floor.projectId,
        ownerId,
        items,
        [
          ...calculation.warnings,
          `Сигналізація: ${takeoff.loops.length} шлейфів, ${takeoff.totalDevices} пристроїв, ${takeoff.totalCableMeters} м кабелю, ${takeoff.battery.recommendedAh} А·год акумулятор.`,
          ...takeoff.issues.slice(0, 20).map((issue) => {
            const params = issue.params
              ? Object.entries(issue.params)
                  .map(([key, value]) => `${key}=${value}`)
                  .join(', ')
              : '';

            return `Signaling warning ${issue.code}${params ? ` (${params})` : ''}.`;
          }),
        ],
        'signaling',
      );

      const result = await this.getById(ownerId, created.id);

      if (!result) {
        throw new Error('Failed to load estimate');
      }

      await this.activity.record({
        projectId: floor.projectId,
        actorId: ownerId,
        action: 'estimate.generated',
        resourceType: 'estimate',
        resourceId: created.id,
      });

      return result;
    }

    const electrical = calculateElectrical({
      circuits: (planSettings.circuits ?? []).map((circuit) => ({
        id: circuit.id,
        name: circuit.name,
      })),
      devices: (drawing?.points ?? []).map((point) => ({
        id: point.id,
        circuitId: point.properties.circuitId ?? null,
        subtype: point.properties.subtype ?? null,
        type: point.type,
      })),
      settings: planSettings.electrical ?? null,
      lengthsByCircuit: circuitLengths,
      calibrated: calculation.metersPerUnit !== null,
    });
    const criticalElectrical = electrical.issues.filter(
      (issue) => issue.severity === 'error',
    );

    const panel = buildPanelSchedule(electrical);
    if (panel.issues.some((issue) => issue.code === 'panelOverflow')) {
      throw new BadRequestException({
        code: 'PANEL_OVERFLOW',
        message:
          'The panel schedule overflows. Reduce circuits or increase board ways before generating an estimate.',
        issues: panel.issues,
      });
    }

    if (criticalElectrical.length > 0) {
      throw new BadRequestException({
        code: 'ELECTRICAL_COORDINATION',
        message:
          'Fix critical electrical mismatches before generating an estimate.',
        issues: criticalElectrical,
      });
    }

    const cableItems = calculation.routes.map((route) => {
      const quantity = route.requiredLength ?? 0;
      const assignedId = routeMaterialById.get(route.routeId) ?? null;
      const material =
        (assignedId ? materialById.get(assignedId) : null) ?? defaultCable;
      const unitPrice = material?.unitPrice ?? null;
      const purchaseQuantity = Math.ceil(quantity);
      const subtotal =
        unitPrice === null ? null : purchaseQuantity * unitPrice;

      return {
        materialId: material?.id ?? null,
        description: route.circuitId
          ? `Кабельна траса ${route.circuitId}`
          : 'Кабельна траса',
        unit: material?.unit ?? 'm',
        quantity,
        purchaseQuantity: quantity > 0 ? purchaseQuantity : 0,
        unitPrice,
        subtotal,
        note: null,
      };
    });

    const deviceItems = buildPowerDeviceItems(
      drawing?.points ?? [],
      materialByCode,
    );
    const items = [...deviceItems, ...cableItems];

    const electricalWarnings =
      electrical.circuits.length > 0
        ? [
            `Електричне навантаження: ${(electrical.totalConnectedPowerW / 1_000).toFixed(2)} кВт встановленої, ` +
              `${(electrical.totalDemandPowerW / 1_000).toFixed(2)} кВт розрахункової потужності, ` +
              `${electrical.maxPhaseCurrentA.toFixed(1)} А розрахунковий струм.`,
          ]
        : [];

    const created = await this.estimates.create(
      floor.projectId,
      ownerId,
      items,
      [...calculation.warnings, ...electricalWarnings],
    );

    const result = await this.getById(ownerId, created.id);

    if (!result) {
      throw new Error('Failed to load estimate');
    }

    await this.activity.record({
      projectId: floor.projectId,
      actorId: ownerId,
      action: 'estimate.generated',
      resourceType: 'estimate',
      resourceId: created.id,
    });

    return result;
  }

  async listForUser(ownerId: string): Promise<PublicEstimate[]> {
    const projects = await this.projects.listByOwner(ownerId, 'all');
    const projectIds = projects.map((project) => project.id);
    const estimates = await this.estimates.listByProjectIds(projectIds);
    const results: PublicEstimate[] = [];
    for (const estimate of estimates) {
      const mapped = await this.getById(ownerId, estimate.id);
      if (mapped) results.push(mapped);
    }
    return results;
  }

  async listByProject(ownerId: string, projectId: string): Promise<PublicEstimate[]> {
    const project = await this.projects.findAccessibleById(projectId, ownerId);
    if (!project) {
      return [];
    }
    const estimates = await this.estimates.listByProject(projectId);
    const results: PublicEstimate[] = [];
    for (const estimate of estimates) {
      const mapped = await this.getById(ownerId, estimate.id);
      if (mapped) results.push(mapped);
    }
    return results;
  }

  async updateItem(
    ownerId: string,
    itemId: string,
    input: {
      quantity?: number;
      purchaseQuantity?: number | null;
      unitPrice?: number | null;
      note?: string | null;
      isOverridden?: boolean;
    },
  ): Promise<PublicEstimate | null> {
    const item = await this.estimates.findItemById(itemId);
    if (!item) return null;
    const loaded = await this.estimates.findById(item.estimateId);
    if (!loaded) return null;
    const project = await this.projects.findAccessibleById(
      loaded.estimate.projectId,
      ownerId,
    );
    if (!project) return null;

    const patch: Parameters<EstimatesRepository['updateItem']>[1] = {};
    if (input.quantity !== undefined) patch.quantity = input.quantity;
    if (input.purchaseQuantity !== undefined)
      patch.purchaseQuantity = input.purchaseQuantity;
    if (input.unitPrice !== undefined) patch.unitPrice = input.unitPrice;
    if (input.note !== undefined) patch.note = input.note;
    if (input.isOverridden !== undefined) patch.isOverridden = input.isOverridden;

    // Recompute subtotal when quantity/price changed unless explicitly overridden? Simple: recompute.
    const nextQuantity =
      input.quantity !== undefined ? input.quantity : Number(item.quantity);
    const nextPurchase =
      input.purchaseQuantity !== undefined
        ? input.purchaseQuantity
        : item.purchaseQuantity === null
          ? null
          : Number(item.purchaseQuantity);
    const nextPrice =
      input.unitPrice !== undefined ? input.unitPrice : 
        item.unitPrice === null ? null : Number(item.unitPrice);
    const qtyForSubtotal = nextPurchase ?? nextQuantity;
    if (nextPrice !== null) {
      patch.subtotal = qtyForSubtotal * nextPrice;
    }
    patch.isOverridden = input.isOverridden ?? true;

    await this.estimates.updateItem(itemId, patch);
    return this.getById(ownerId, loaded.estimate.id);
  }

  async updateStatus(
    ownerId: string,
    estimateId: string,
    status: 'draft' | 'final',
  ): Promise<PublicEstimate | null> {
    const loaded = await this.estimates.findById(estimateId);
    if (!loaded) return null;
    const project = await this.projects.findAccessibleById(
      loaded.estimate.projectId,
      ownerId,
    );
    if (!project) return null;
    await this.estimates.updateStatus(estimateId, status);
    return this.getById(ownerId, estimateId);
  }

  async getById(ownerId: string, estimateId: string): Promise<PublicEstimate | null> {
    const result = await this.estimates.findById(estimateId);
    if (!result) {
      return null;
    }

    const project = await this.projects.findAccessibleById(result.estimate.projectId, ownerId);
    if (!project) {
      return null;
    }

    const { estimate, items } = result;
    return {
      id: estimate.id,
      projectId: estimate.projectId,
      version: estimate.version,
      type: estimate.type as 'power' | 'signaling',
      status: estimate.status as 'draft' | 'final',
      calculationSettings: (estimate.calculationSettings ?? {}) as Record<
        string,
        unknown
      >,
      warnings: estimate.warnings ?? [],
      items: items.map((item) => ({
        id: item.id,
        estimateId: item.estimateId,
        materialId: item.materialId,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity),
        purchaseQuantity:
          item.purchaseQuantity === null ? null : Number(item.purchaseQuantity),
        unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
        subtotal: item.subtotal === null ? null : Number(item.subtotal),
        isOverridden: item.isOverridden,
        note: item.note,
        createdAt: item.createdAt.toISOString(),
      })),
      createdAt: estimate.createdAt.toISOString(),
      updatedAt: estimate.updatedAt.toISOString(),
    };
  }

  async toPdf(ownerId: string, estimateId: string): Promise<Buffer> {
    const estimate = await this.getById(ownerId, estimateId);
    if (!estimate) {
      throw new Error('Estimate not found');
    }
    const project = await this.projects.findAccessibleById(
      estimate.projectId,
      ownerId,
    );

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      info: {
        Title: `Кошторис · версія ${estimate.version}`,
        Author: 'DrawMyPlace',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const assets = path.join(__dirname, '..', '..', '..', 'assets');
    doc.registerFont(
      'Regular',
      path.join(assets, 'LiberationSans-Regular.ttf'),
    );
    doc.registerFont('Bold', path.join(assets, 'LiberationSans-Bold.ttf'));

    const margin = 40;
    const pageWidth = 595.28;
    const contentWidth = pageWidth - margin * 2;
    const columns = [
      { label: '№', width: 24, align: 'left' as const },
      { label: 'Найменування', width: 250, align: 'left' as const },
      { label: 'Од.', width: 36, align: 'center' as const },
      { label: 'К-сть', width: 52, align: 'right' as const },
      { label: 'Ціна', width: 72, align: 'right' as const },
      { label: 'Сума', width: 81, align: 'right' as const },
    ];

    const unitLabel = (unit: string) =>
      ({ m: 'м', pcs: 'шт', kg: 'кг', l: 'л' })[unit] ?? unit;
    const number = (value: number) =>
      new Intl.NumberFormat('uk-UA', {
        maximumFractionDigits: 2,
      }).format(value);
    const money = (value: number | null) =>
      value === null
        ? '—'
        : new Intl.NumberFormat('uk-UA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(value);

    let y = margin;
    doc
      .font('Bold')
      .fontSize(18)
      .fillColor('#0f172a')
      .text('Кошторис', margin, y);
    y += 26;
    doc
      .font('Regular')
      .fontSize(9)
      .fillColor('#475569')
      .text(`Проєкт: ${project?.name ?? estimate.projectId}`, margin, y);
    doc.text(
      `Версія: ${estimate.version} · ${
        estimate.status === 'final' ? 'затверджено' : 'чернетка'
      } · ${
        estimate.type === 'signaling' ? 'сигналізація' : 'силове'
      }`,
      margin + 260,
      y,
      { width: contentWidth - 260, align: 'right' },
    );
    y += 14;
    doc.text(
      `Дата: ${new Date(estimate.createdAt).toLocaleDateString('uk-UA')}`,
      margin,
      y,
    );
    y += 22;

    const drawHeader = () => {
      doc.rect(margin, y, contentWidth, 22).fill('#eef2f6');
      doc.fillColor('#0f172a').font('Bold').fontSize(9);
      let x = margin;
      for (const column of columns) {
        doc.text(column.label, x + 4, y + 7, {
          width: column.width - 8,
          align: column.align,
        });
        x += column.width;
      }
      doc
        .strokeColor('#cbd5e1')
        .lineWidth(0.6)
        .rect(margin, y, contentWidth, 22)
        .stroke();
      y += 22;
    };

    drawHeader();

    estimate.items.forEach((item, index) => {
      doc.font('Regular').fontSize(8.5);
      const descriptionHeight = doc.heightOfString(item.description, {
        width: columns[1]!.width - 8,
      });
      const rowHeight = Math.max(19, descriptionHeight + 8);

      if (y + rowHeight > 790) {
        doc.addPage();
        y = margin;
        drawHeader();
      }

      if (index % 2 === 1) {
        doc.rect(margin, y, contentWidth, rowHeight).fill('#f8fafc');
      }

      const values = [
        String(index + 1),
        item.description,
        unitLabel(item.unit),
        number(item.quantity),
        money(item.unitPrice),
        money(item.subtotal),
      ];
      doc.fillColor('#0f172a').font('Regular').fontSize(8.5);
      let x = margin;
      columns.forEach((column, columnIndex) => {
        doc.text(values[columnIndex] ?? '', x + 4, y + 5, {
          width: column.width - 8,
          align: column.align,
          lineBreak: columnIndex === 1,
          ellipsis: columnIndex !== 1,
        });
        x += column.width;
      });

      doc
        .strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .moveTo(margin, y + rowHeight)
        .lineTo(margin + contentWidth, y + rowHeight)
        .stroke();
      y += rowHeight;
    });

    const total = estimate.items.reduce(
      (sum, item) => sum + (item.subtotal ?? 0),
      0,
    );
    doc.rect(margin, y, contentWidth, 22).fill('#eef2f6');
    doc.fillColor('#0f172a').font('Bold').fontSize(9);
    doc.text('Разом', margin + 4, y + 7, {
      width:
        columns.slice(0, 5).reduce((sum, column) => sum + column.width, 0) - 8,
      align: 'right',
    });
    doc.text(
      money(total),
      margin + contentWidth - columns[5]!.width + 4,
      y + 7,
      { width: columns[5]!.width - 8, align: 'right' },
    );
    doc
      .strokeColor('#cbd5e1')
      .lineWidth(0.6)
      .rect(margin, y, contentWidth, 22)
      .stroke();

    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index);
      doc
        .font('Regular')
        .fontSize(8)
        .fillColor('#64748b')
        .text(
          `Сторінка ${index + 1} з ${range.count} · DrawMyPlace`,
          margin,
          815,
          { width: contentWidth, align: 'center', lineBreak: false },
        );
    }

    doc.end();
    return finished;
  }

  async toCsv(ownerId: string, estimateId: string): Promise<string> {
    const estimate = await this.getById(ownerId, estimateId);
    if (!estimate) {
      throw new Error('Estimate not found');
    }

    const lines = [
      'description,unit,quantity,purchaseQuantity,unitPrice,subtotal',
      ...estimate.items.map((item) =>
        [
          JSON.stringify(item.description),
          item.unit,
          item.quantity,
          item.purchaseQuantity ?? '',
          item.unitPrice ?? '',
          item.subtotal ?? '',
        ].join(','),
      ),
    ];

    return lines.join('\\n');
  }

  private toPublic(
    estimate: { id: string; projectId: string; version: number; type?: string | null; status: string; calculationSettings: unknown; warnings?: string[]; createdAt: Date; updatedAt: Date },
    items: Array<{
      materialId: string | null;
      description: string;
      unit: string;
      quantity: number;
      purchaseQuantity: number | null;
      unitPrice: number | null;
      subtotal: number | null;
      note: string | null;
    }>,
  ): PublicEstimate {
    return {
      id: estimate.id,
      projectId: estimate.projectId,
      version: estimate.version,
      type: (estimate.type as 'power' | 'signaling' | null) ?? 'power',
      status: estimate.status as 'draft' | 'final',
      calculationSettings: (estimate.calculationSettings ?? {}) as Record<
        string,
        unknown
      >,
      warnings: estimate.warnings ?? [],
      items: items.map((item, index) => ({
        id: `temp-${index}`,
        estimateId: estimate.id,
        materialId: item.materialId,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        purchaseQuantity: item.purchaseQuantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        isOverridden: false,
        note: item.note,
        createdAt: estimate.createdAt.toISOString(),
      })),
      createdAt: estimate.createdAt.toISOString(),
      updatedAt: estimate.updatedAt.toISOString(),
    };
  }
}
