import bcrypt from 'bcryptjs'
import { prisma } from '../db/prisma.js'

export async function seedUsers() {
  const users = [
    { email: 'trr@local', name: 'trr', password: 'qwexsa', role: 'USER' as any },
    { email: 'sdu@local', name: 'sdu', password: 'sdu', role: 'USER' as any },
  ]

  for (const u of users) {
    const existing = await prisma.user.findFirst({ where: { OR: [ { email: u.email }, { name: u.name } ] } })
    if (!existing) {
      const hashed = await bcrypt.hash(u.password, 10)
      await prisma.user.create({ data: { email: u.email, name: u.name, password: hashed, role: u.role } })
    }
  }
}
