import bcrypt from 'bcryptjs'
import { prisma } from '../db/prisma.js'

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@local'
  const password = process.env.ADMIN_PASSWORD || 'admin'
  const name = process.env.ADMIN_NAME || 'Админ'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, password: hashed, name, role: 'ADMIN' as any },
  })
  return user
}
