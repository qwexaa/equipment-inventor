import { Request, Response } from 'express'
import { prisma } from '../db/prisma.js'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

export async function listUsers(req: Request, res: Response) {
  const q = (req.query.q as string)?.trim() || ''
  const limit = Math.min(100, Number(req.query.limit) || 20)
  const offset = Math.max(0, Number(req.query.offset) || 0)
  const where = q
    ? {
        OR: [
          { email: { contains: q } },
          { name: { contains: q } },
        ],
      }
    : {}
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip: offset, take: limit, orderBy: { id: 'asc' }, select: { id:true, email:true, name:true, role:true, createdAt:true } }),
    prisma.user.count({ where })
  ])
  res.json({ items, total })
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['ADMIN','EDITOR','VIEWER','USER']).default('USER'),
  password: z.string().min(6).optional()
})
export async function createUser(req: Request, res: Response) {
  const p = createSchema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.flatten() })
  const { email, name, role, password } = p.data
  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return res.status(409).json({ error: 'User already exists' })
  const temp = password ?? Math.random().toString(36).slice(-10)
  const hashed = await bcrypt.hash(temp, 10)
  const user = await prisma.user.create({ data: { email, name, role: role as any, password: hashed } })
  res.status(201).json({ user: { id:user.id, email:user.email, name:user.name, role:user.role }, tempPassword: password ? undefined : temp })
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN','EDITOR','VIEWER','USER']).optional()
})
export async function updateUser(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'Invalid id' })
  const p = updateSchema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.flatten() })
  const user = await prisma.user.update({ where: { id }, data: p.data as any, select: { id:true, email:true, name:true, role:true } })
  res.json({ user })
}

export async function resetPassword(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'Invalid id' })
  const temp = Math.random().toString(36).slice(-10)
  const hashed = await bcrypt.hash(temp, 10)
  await prisma.user.update({ where: { id }, data: { password: hashed } })
  res.json({ tempPassword: temp })
}

export async function deleteUser(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'Invalid id' })
  const me = (req as any).user?.id as number | undefined
  if (me === id) return res.status(400).json({ error: 'Нельзя удалить самого себя' })
  await prisma.user.delete({ where: { id } })
  res.json({ ok: true })
}
