import { Request, Response } from 'express'
import { prisma } from '../db/prisma.js'

export async function statsController(_req: Request, res: Response) {
  const [byStatusRaw, byCategoryRaw] = await Promise.all([
    prisma.equipment.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.equipment.groupBy({ by: ['category'], _count: { _all: true } }),
  ])
  const byStatus = Object.fromEntries((byStatusRaw as any[]).map((r: any) => [r.status, r._count._all]))
  const byCategory = Object.fromEntries((byCategoryRaw as any[]).map((r: any) => [r.category, r._count._all]))
  res.json({ byStatus, byCategory })
}
