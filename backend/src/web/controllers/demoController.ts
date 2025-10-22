import { Request, Response } from 'express'
import { prisma } from '../db/prisma.js'
import { randomInt } from 'crypto'

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random()*arr.length)] }

export async function seedDemo(req: Request, res: Response) {
  try {
    // Create 30 equipment items (inventory)
    const categories = ['ПК', 'Монитор', 'Принтер', 'Сетевое', 'Периферия']
    const models = ['A100', 'B200', 'C300', 'D400', 'E500']
    const makers = ['Lenovo', 'HP', 'Dell', 'Asus', 'Brother']

    const createdEq = await prisma.$transaction(async (tx)=>{
      const items: any[] = []
      for (let i=0;i<30;i++){
        const name = `${pick(makers)} ${pick(models)}`
        const inv = `INV-${randomInt(100000,999999)}`
        const cost = randomInt(5_000, 80_000)
        const created = await tx.equipment.create({ data: {
          name,
          category: pick(categories),
          model: pick(models),
          manufacturer: pick(makers),
          serialNumber: null,
          inventoryNumber: inv,
          purchaseDate: new Date(Date.now() - randomInt(0, 365)*24*3600*1000),
          cost,
          location: 'Склад-А/Стеллаж 1',
          responsible: '—',
          status: 'in_use',
          note: 'DEMO',
        } as any })
        items.push(created)
      }
      return items
    })

    // Create 20 warehouse items
    const createdWh = await prisma.$transaction(async (tx)=>{
      const items: any[] = []
      for (let i=0;i<20;i++){
        const name = `${pick(makers)} ${pick(models)}`
        const unitCost = randomInt(3_000, 50_000)
        const quantity = randomInt(1, 10)
        const created = await tx.warehouseItem.create({ data: {
          name,
          category: pick(categories),
          model: pick(models),
          manufacturer: pick(makers),
          serialNumber: null,
          quantity,
          unit: 'шт',
          unitCost,
          dateReceived: new Date(Date.now() - randomInt(0, 90)*24*3600*1000),
          supplier: 'DEMO',
          status: 'in_stock',
          location: 'Склад-А/Стеллаж 2',
          note: 'DEMO',
        } as any })
        items.push(created)
      }
      return items
    })

    res.json({ equipment: createdEq.length, warehouse: createdWh.length })
  } catch (e) {
    console.error('seed demo failed', e)
    res.status(500).json({ error: 'seed failed' })
  }
}
