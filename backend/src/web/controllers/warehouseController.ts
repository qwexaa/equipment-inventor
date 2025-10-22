import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { randomInt } from 'crypto'
import XLSX from 'xlsx'

const schema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  model: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  quantity: z.number().int().min(0).default(1),
  unit: z.string().min(1).default('шт'),
  unitCost: z.number().optional().nullable(),
  dateReceived: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  status: z.string().min(1).default('in_stock'),
  location: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

export async function list(req: Request, res: Response) {
  const { q, status, sort_by, order } = req.query as any
  // Warehouse items query only
  const whereWh: any = {}
  if (status) {
    if (status === 'all') {
      // no filter
    } else {
      whereWh.status = status
    }
  } else {
    whereWh.status = { not: 'archived' }
  }
  if (q) {
    whereWh.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
      { manufacturer: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
      { supplier: { contains: q, mode: 'insensitive' } },
      { serialNumber: { contains: q, mode: 'insensitive' } },
      { note: { contains: q, mode: 'insensitive' } },
    ]
  }

  const items = await prisma.warehouseItem.findMany({ where: whereWh, orderBy: { [(sort_by as any) || 'createdAt']: ((order==='asc'||order==='desc')?order:'desc') as any } })
  res.json({ items })
}

export async function create(req: Request, res: Response) {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() })
  const data: any = parsed.data
  if (data.dateReceived) data.dateReceived = new Date(data.dateReceived)
  if (data.unitCost != null) data.unitCost = Number(data.unitCost)
  // merge by key: name + model (case-insensitive), status in_stock
  const where: any = {
    name: { equals: data.name, mode: 'insensitive' },
    model: { equals: data.model ?? null, ...(data.model ? { mode: 'insensitive' } : {}) },
    status: { equals: 'in_stock' },
  }
  const existing = await prisma.warehouseItem.findFirst({ where })
  const user = (req as any).user?.email || 'system'
  if (existing) {
    const updated = await prisma.warehouseItem.update({ where: { id: existing.id }, data: {
      quantity: { increment: data.quantity ?? 1 },
      // keep earliest dateReceived if present, otherwise set if missing
      dateReceived: existing.dateReceived ?? data.dateReceived ?? null,
      location: data.location ?? existing.location,
      note: data.note ?? existing.note,
    }})
    await logMove({ user, action: 'Добавлено (объединено) на складе', itemName: updated.name, quantity: data.quantity ?? 1, fromTable: null as any, toTable: 'warehouse', note: `В строку ID ${existing.id}` })
    return res.status(200).json(updated)
  } else {
    const item = await prisma.warehouseItem.create({ data })
    await logMove({ user, action: 'Добавлено на складе', itemName: item.name, quantity: item.quantity, fromTable: null as any, toTable: 'warehouse', note: data.note || undefined })
    return res.status(201).json(item)
  }
}

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id)
  const parsed = schema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() })
  const data: any = parsed.data
  if (data.dateReceived) data.dateReceived = new Date(data.dateReceived)
  if (data.unitCost != null) data.unitCost = Number(data.unitCost)
  const before = await prisma.warehouseItem.findUnique({ where: { id } })
  const item = await prisma.warehouseItem.update({ where: { id }, data })
  const user = (req as any).user?.email || 'system'
  await logMove({ user, action: 'Обновление на складе', itemName: item.name, quantity: item.quantity, fromTable: 'warehouse', toTable: 'warehouse', note: `Было: ${before?.quantity ?? '-'}; Стало: ${item.quantity}` })
  res.json(item)
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id)
  const before = await prisma.warehouseItem.findUnique({ where: { id } })
  await prisma.warehouseItem.delete({ where: { id } })
  const user = (req as any).user?.email || 'system'
  if (before) await logMove({ user, action: 'Удалено со склада', itemName: before.name, quantity: before.quantity, fromTable: 'warehouse', toTable: null as any, note: before.note || undefined })
  res.status(204).end()
}

async function logMove(opts: { user: string; action: string; itemName: string; quantity: number; fromTable?: string; toTable?: string; note?: string }) {
  await prisma.movementLog.create({ data: {
    user: opts.user, action: opts.action, itemName: opts.itemName, quantity: opts.quantity,
    fromTable: opts.fromTable, toTable: opts.toTable, note: opts.note
  } })
}

export async function transferToInventory(req: Request, res: Response) {
  const id = Number(req.params.id)
  const body = req.body as any
  const user = (req as any).user?.email || 'system'
  const src = await prisma.warehouseItem.findUnique({ where: { id } })
  if (!src) return res.status(404).json({ error: 'Not found' })

  // generate inventory number if missing
  let inventoryNumber: string = body.inventoryNumber
  if (!inventoryNumber) {
    const n = randomInt(1000, 9999)
    inventoryNumber = `INV-${n}`
  }
  const purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : new Date()
  const qtyNum = Number(body.qty)
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
    return res.status(422).json({ error: 'qty must be a positive number' })
  }
  const qty = Math.max(1, Math.min(qtyNum, src.quantity))

  const created = await prisma.$transaction(async (tx)=>{
    const createdItems: any[] = []
    // Use serial only if it's not already present in inventory
    const serial = src.serialNumber || undefined
    const canUseSerial = serial ? !(await tx.equipment.findFirst({ where: { serialNumber: serial } })) : false
    for (let i=0;i<qty;i++){
      const inv = i===0 ? inventoryNumber : `INV-${randomInt(1000,9999)}`
      // sanitize cost to avoid numeric overflow (precision 12, scale 2)
      const rawCost = Number(body.cost)
      const safeCost = Number.isFinite(rawCost) && rawCost >= 0 && rawCost < 1e10 ? rawCost : undefined
      const equipment = await tx.equipment.create({ data: {
        name: src.name,
        category: src.category,
        model: src.model || undefined,
        manufacturer: src.manufacturer || undefined,
        // serialNumber в Equipment уникален — назначаем только для первой единицы и только если уникален
        serialNumber: (i===0 && canUseSerial) ? serial : undefined,
        inventoryNumber: inv,
        purchaseDate,
        cost: safeCost,
        location: body.location || null,
        responsible: body.responsible || null,
        status: 'in_use',
        note: body.note || null,
      } as any })
      createdItems.push(equipment)
    }

    const left = src.quantity - qty
    if (left > 0) {
      await tx.warehouseItem.update({ where: { id: src.id }, data: { quantity: left, status: 'issued' } })
    } else {
      await tx.warehouseItem.update({ where: { id: src.id }, data: { quantity: 0, status: 'archived' } })
    }

    await tx.movementLog.create({ data: {
      user,
      action: 'Перенос в инвентаризацию',
      itemName: src.name,
      quantity: qty,
      fromTable: 'warehouse',
      toTable: 'inventory',
      note: `Создано ${qty} ед.`
    }})

    return createdItems
  })

  res.status(201).json({ createdCount: created.length })
}

export async function importWarehouse(req: Request, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined
  if (!file) return res.status(400).json({ error: 'file is required' })
  const wb = XLSX.readFile(file.path)
  const wsName = wb.SheetNames[0]
  const ws = wb.Sheets[wsName]
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
  let created = 0
  let merged = 0
  for (const r of rows) {
    const data: any = {
      name: r['Наименование'] || r['name'] || '',
      category: r['Категория'] || r['category'] || 'Прочее',
      model: r['Модель'] || r['model'] || null,
      serialNumber: r['Серийный номер'] || r['serial_number'] || null,
      quantity: Number(r['Количество'] || r['quantity'] || 1) || 1,
      unit: r['Ед.'] || r['unit'] || 'шт',
      location: r['Местоположение'] || r['location'] || null,
      note: r['Примечание'] || r['note'] || null,
      dateReceived: r['Дата поступления'] ? new Date(r['Дата поступления']) : null,
      status: 'in_stock',
    }
    if (!data.name) continue
    const where: any = {
      name: { equals: data.name, mode: 'insensitive' },
      model: { equals: data.model ?? null, ...(data.model ? { mode: 'insensitive' } : {}) },
      status: { equals: 'in_stock' },
    }
    const ex = await prisma.warehouseItem.findFirst({ where })
    if (ex) {
      await prisma.warehouseItem.update({ where: { id: ex.id }, data: {
        quantity: { increment: data.quantity ?? 1 },
        dateReceived: ex.dateReceived ?? data.dateReceived ?? null,
        location: data.location ?? ex.location,
        note: data.note ?? ex.note,
      }})
      merged++
    } else {
      await prisma.warehouseItem.create({ data })
      created++
    }
  }
  const user = (req as any).user?.email || 'system'
  await prisma.movementLog.create({ data: { user, action: 'Импортировано из Excel', itemName: 'Множественно', quantity: created, fromTable: null as any, toTable: 'warehouse', note: `Добавлено ${created}, объединено ${merged}` } })
  res.json({ created, merged })
}

export async function listMovements(req: Request, res: Response) {
  const { user, action, from, to, itemName, limit } = req.query as any
  const where: any = {}
  if (user) where.user = { contains: user, mode: 'insensitive' }
  if (action) where.action = { contains: action, mode: 'insensitive' }
  if (itemName) where.itemName = { equals: String(itemName), mode: 'insensitive' }
  if (from || to) {
    where.datetime = {}
    if (from) where.datetime.gte = new Date(from)
    if (to) where.datetime.lte = new Date(to)
  }
  const take = Math.min(Number(limit || 200) || 200, 1000)
  const items = await prisma.movementLog.findMany({ where, orderBy: { datetime: 'desc' }, take })
  res.json({ items })
}
