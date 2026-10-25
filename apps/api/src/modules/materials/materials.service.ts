import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { PublicMaterial } from '@drawmyplace/contracts';
import { materials } from '@drawmyplace/database';
import { DatabaseService } from '../../database/database.service';
import { MaterialsRepository } from './materials.repository';

const DEFAULT_MATERIALS = [
  { code: 'CABLE-3X2.5', name: 'Cable 3x2.5 mm²', unit: 'm', category: 'cable' as const, unitPrice: 18.5 },
  { code: 'CABLE-3X1.5', name: 'Cable 3x1.5 mm²', unit: 'm', category: 'cable' as const, unitPrice: 12.0 },
  { code: 'CONDUIT-20', name: 'Conduit 20 mm', unit: 'm', category: 'conduit' as const, unitPrice: 6.0 },
];

function toPublic(row: Awaited<ReturnType<MaterialsRepository['findById']>> & {}): PublicMaterial {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    name: row.name,
    unit: row.unit,
    category: row.category as PublicMaterial['category'],
    unitPrice: row.unitPrice === null ? null : Number(row.unitPrice),
    currency: row.currency,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class MaterialsService implements OnModuleInit {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(MaterialsRepository) private readonly repository: MaterialsRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const db = this.database?.db;

    if (!db) {
      return;
    }

    const existing = await db.select().from(materials).limit(1);

    if (existing.length === 0) {
      await db.insert(materials).values(
        DEFAULT_MATERIALS.map((item) => ({
          code: item.code,
          name: item.name,
          unit: item.unit,
          category: item.category,
          unitPrice: item.unitPrice.toString(),
          organizationId: null,
          currency: 'UAH',
          active: true,
        })),
      );
    }
  }

  async list(): Promise<PublicMaterial[]> {
    const rows = await this.repository.listActive();
    return rows.map((row) => toPublic(row));
  }

  async getById(id: string): Promise<PublicMaterial | null> {
    const row = await this.repository.findById(id);
    return row ? toPublic(row) : null;
  }
}
