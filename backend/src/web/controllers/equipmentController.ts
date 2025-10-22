import { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { z } from 'zod';

const equipmentSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  serialNumber: z.string().optional().nullable(),
  inventoryNumber: z.string().optional().nullable(),
  account: z.enum(['main','off_balance','household']).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  cost: z.number().optional().nullable(),
  location: z.string().optional().nullable(),
  responsible: z.string().optional().nullable(),
  status: z.string().min(1),
  // department removed
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  transferTo: z.string().optional().nullable(),
  transferDate: z.string().optional().nullable(),
  returnDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function listEquipment(req: Request, res: Response) {
  const { q, status, category, location, responsible, sort_by, order, limit, offset } = req.query as Record<string, string | undefined>;

  const where: any = {};
  // Hide items without inventory number by default
  where.inventoryNumber = { not: null };
  if (status) where.status = status;
  else where.status = { not: 'in_stock' } as any;
  if (category) where.category = category;
  if (location) where.location = { contains: location, mode: 'insensitive' };
  if (responsible) where.responsible = { contains: responsible, mode: 'insensitive' };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
      { serialNumber: { contains: q, mode: 'insensitive' } },
      { inventoryNumber: { contains: q, mode: 'insensitive' } },
      { location: { contains: q, mode: 'insensitive' } },
      { responsible: { contains: q, mode: 'insensitive' } },
      { status: { contains: q, mode: 'insensitive' } },
      
      { manufacturer: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
      { condition: { contains: q, mode: 'insensitive' } },
      { transferTo: { contains: q, mode: 'insensitive' } },
      { note: { contains: q, mode: 'insensitive' } },
    ];
  }

  const take = Math.min(Number(limit ?? 25) || 25, 100);
  const skip = Math.max(Number(offset ?? 0) || 0, 0);
  const sortKey = (sort_by as any) || 'createdAt';
  const sortOrder = (order === 'asc' || order === 'desc') ? order : 'desc';

  const [total, items] = await Promise.all([
    prisma.equipment.count({ where }),
    prisma.equipment.findMany({ where, orderBy: { [sortKey]: sortOrder as any }, skip, take })
  ]);

  res.json({ items, total });
}

export async function getEquipment(req: Request, res: Response) {
  const id = Number(req.params.id);
  const item = await prisma.equipment.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
}

export async function createEquipment(req: Request, res: Response) {
  const parsed = equipmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  
  if (data.purchaseDate) (data as any).purchaseDate = new Date(data.purchaseDate as string);
  if (data.transferDate) (data as any).transferDate = new Date(data.transferDate as string);
  if (data.returnDate) (data as any).returnDate = new Date(data.returnDate as string);
  if (data.cost != null) (data as any).cost = data.cost;

  // extra validations
  if ((data as any).purchaseDate && (data as any).purchaseDate > new Date()) {
    return res.status(422).json({ error: 'purchaseDate cannot be in the future' });
  }
  if (data.cost != null && data.cost < 0) {
    return res.status(422).json({ error: 'cost must be non-negative' });
  }

  try {
    const item = await prisma.equipment.create({ data: data as any });
    // log movement: created in inventory
    try {
      const user = (req as any).user?.email || 'system'
      await prisma.movementLog.create({ data: {
        user,
        action: 'Добавлено в инвентаризацию',
        itemName: item.name,
        quantity: 1,
        fromTable: null as any,
        toTable: 'inventory',
        note: `Оборудование ID ${item.id}`,
      }})
    } catch {}
    res.status(201).json(item);
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(422).json({ error: 'serialNumber or inventoryNumber must be unique' });
    }
    console.error(e);
    res.status(500).json({ error: 'Create failed' });
  }
}

export async function updateEquipment(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = equipmentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  const before = await prisma.equipment.findUnique({ where: { id } });
  if (data.purchaseDate) (data as any).purchaseDate = new Date(data.purchaseDate as string);
  if (data.transferDate) (data as any).transferDate = new Date(data.transferDate as string);
  if (data.returnDate) (data as any).returnDate = new Date(data.returnDate as string);

  // extra validations
  if ((data as any).purchaseDate && (data as any).purchaseDate > new Date()) {
    return res.status(422).json({ error: 'purchaseDate cannot be in the future' });
  }
  if ((data as any).cost != null && (data as any).cost! < 0) {
    return res.status(422).json({ error: 'cost must be non-negative' });
  }

  try {
    const item = await prisma.equipment.update({ where: { id }, data: data as any });
    // If status changed to in_stock, create a warehouse item mirror and log movement
    const becameInStock = (data.status === 'in_stock') && (before?.status !== 'in_stock')
    if (becameInStock) {
      const user = (req as any).user?.email || 'system'
      try {
        // Merge back to warehouse by name + model (case-insensitive), regardless of current status
        const where: any = {
          name: { equals: item.name, mode: 'insensitive' },
          model: { equals: (item as any).model ?? null, ...((item as any).model ? { mode: 'insensitive' } : {}) },
        }
        const ex = await prisma.warehouseItem.findFirst({ where })
        if (ex) {
          await prisma.warehouseItem.update({ where: { id: ex.id }, data: {
            quantity: { increment: 1 },
            dateReceived: ex.dateReceived ?? new Date(),
            status: 'in_stock',
            location: (item as any).location ?? ex.location,
            note: (item as any).note ?? ex.note,
          }})
          await prisma.movementLog.create({ data: {
            user,
            action: 'Возврат на склад (объединено)',
            itemName: item.name,
            quantity: 1,
            fromTable: 'inventory',
            toTable: 'warehouse',
            note: `В строку склада ID ${ex.id}; Оборудование ID ${item.id}`,
          }})
        } else {
          await prisma.warehouseItem.create({ data: {
            name: item.name,
            category: item.category,
            model: (item as any).model || undefined,
            manufacturer: (item as any).manufacturer || undefined,
            serialNumber: item.serialNumber || undefined,
            quantity: 1,
            unit: 'шт',
            dateReceived: new Date(),
            supplier: null as any,
            status: 'in_stock',
            location: item.location || null,
            note: item.note || null,
          } as any })
          await prisma.movementLog.create({ data: {
            user,
            action: 'Возврат на склад',
            itemName: item.name,
            quantity: 1,
            fromTable: 'inventory',
            toTable: 'warehouse',
            note: `Оборудование ID ${item.id}`,
          }})
        }
      } catch (e) {
        // do not fail the whole request on log/mirror issues
        console.error('mirror to warehouse failed', e)
      }
    }
    // generic movement logs for significant changes
    try {
      const user = (req as any).user?.email || 'system'
      if (before && data.status && data.status !== before.status) {
        await prisma.movementLog.create({ data: {
          user,
          action: 'Изменение статуса',
          itemName: item.name,
          quantity: 1,
          fromTable: 'inventory',
          toTable: 'inventory',
          note: `${before.status} → ${item.status}`,
        }})
      }
      if (before && (data.transferTo || data.transferDate)) {
        await prisma.movementLog.create({ data: {
          user,
          action: 'Передача',
          itemName: item.name,
          quantity: 1,
          fromTable: 'inventory',
          toTable: 'inventory',
          note: `Кому: ${data.transferTo ?? (item as any).transferTo ?? '—'}; Дата: ${data.transferDate ?? (item as any).transferDate ?? '—'}`,
        }})
      }
      if (before && (data.location || data.responsible)) {
        const ch: string[] = []
        if (data.location && data.location !== before.location) ch.push(`Местоположение: ${before.location ?? '—'} → ${data.location}`)
        if (data.responsible && data.responsible !== before.responsible) ch.push(`Ответственный: ${before.responsible ?? '—'} → ${data.responsible}`)
        if (ch.length) {
          await prisma.movementLog.create({ data: {
            user,
            action: 'Обновление карточки',
            itemName: item.name,
            quantity: 1,
            fromTable: 'inventory',
            toTable: 'inventory',
            note: ch.join('; '),
          }})
        }
      }
    } catch {}
    res.json(item);
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(422).json({ error: 'serialNumber or inventoryNumber must be unique' });
    }
    res.status(500).json({ error: 'Update failed' });
  }
}

export async function deleteEquipment(req: Request, res: Response) {
  const id = Number(req.params.id);
  try {
    const before = await prisma.equipment.findUnique({ where: { id } });
    await prisma.equipment.delete({ where: { id } });
    try {
      const user = (req as any).user?.email || 'system'
      await prisma.movementLog.create({ data: {
        user,
        action: 'Удалено из инвентаризации',
        itemName: before?.name || `ID ${id}`,
        quantity: 1,
        fromTable: 'inventory',
        toTable: null as any,
        note: `Оборудование ID ${id}`,
      }})
    } catch {}
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Delete failed' });
  }
}
