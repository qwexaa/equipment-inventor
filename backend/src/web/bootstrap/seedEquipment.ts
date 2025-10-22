import { prisma } from '../db/prisma.js'

export async function seedEquipment() {
  const samples = [
    { name: 'Ноутбук Lenovo ThinkPad', category: 'Компьютеры', serialNumber: 'SN-LAP-001', inventoryNumber: 'INV-1001', purchaseDate: new Date('2023-02-10'), cost: 120000, location: 'Офис 101', responsible: 'Иванов И.И.', status: 'in_use' },
    { name: 'Системный блок HP ProDesk', category: 'Компьютеры', serialNumber: 'SN-PC-002', inventoryNumber: 'INV-1002', purchaseDate: new Date('2022-11-05'), cost: 95000, location: 'Офис 102', responsible: 'Петров П.П.', status: 'in_use' },
    { name: 'Монитор Dell 24"', category: 'Мониторы', serialNumber: 'SN-MON-003', inventoryNumber: 'INV-1003', purchaseDate: new Date('2022-11-05'), cost: 22000, location: 'Офис 102', responsible: 'Петров П.П.', status: 'in_use' },
    { name: 'Принтер HP LaserJet', category: 'Печать', serialNumber: 'SN-PRN-004', inventoryNumber: 'INV-1004', purchaseDate: new Date('2021-07-15'), cost: 30000, location: 'Офис 110', responsible: 'Сидорова С.С.', status: 'in_stock' },
    { name: 'МФУ Canon', category: 'Печать', serialNumber: 'SN-MFU-005', inventoryNumber: 'INV-1005', purchaseDate: new Date('2020-03-20'), cost: 45000, location: 'Офис 120', responsible: 'Семенов С.С.', status: 'in_use' },
    { name: 'Сервер Dell PowerEdge', category: 'Серверы', serialNumber: 'SN-SRV-006', inventoryNumber: 'INV-1006', purchaseDate: new Date('2024-01-12'), cost: 550000, location: 'Серверная', responsible: 'Админ А.А.', status: 'in_use' },
    { name: 'Коммутатор Cisco 24p', category: 'Сеть', serialNumber: 'SN-SW-007', inventoryNumber: 'INV-1007', purchaseDate: new Date('2023-09-01'), cost: 80000, location: 'Серверная', responsible: 'Админ А.А.', status: 'in_use' },
    { name: 'Точка доступа Ubiquiti', category: 'Сеть', serialNumber: 'SN-AP-008', inventoryNumber: 'INV-1008', purchaseDate: new Date('2023-10-10'), cost: 15000, location: 'Коридор 2 этаж', responsible: 'Админ А.А.', status: 'in_use' },
    { name: 'ИБП APC 1500', category: 'Электропитание', serialNumber: 'SN-UPS-009', inventoryNumber: 'INV-1009', purchaseDate: new Date('2019-12-12'), cost: 40000, location: 'Серверная', responsible: 'Админ А.А.', status: 'written_off' },
    { name: 'Сканер штрихкодов', category: 'Склад', serialNumber: 'SN-SCN-010', inventoryNumber: 'INV-1010', purchaseDate: new Date('2022-02-02'), cost: 8000, location: 'Склад', responsible: 'Кладовщик', status: 'in_stock' },
  ] as const

  for (const s of samples) {
    let existing = null as any
    if (s.serialNumber) {
      existing = await prisma.equipment.findFirst({ where: { serialNumber: s.serialNumber } })
    }
    if (!existing && s.inventoryNumber) {
      existing = await prisma.equipment.findFirst({ where: { inventoryNumber: s.inventoryNumber } })
    }
    if (!existing) {
      await prisma.equipment.create({ data: s as any })
    }
  }
}
