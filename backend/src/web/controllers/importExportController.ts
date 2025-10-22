import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { prisma } from '../db/prisma.js';

const COLUMNS = [
  'name',
  'category',
  'serialNumber',
  'inventoryNumber',
  'purchaseDate',
  'cost',
  'location',
  'responsible',
  'status',
  'manufacturer',
  'model',
  'condition',
  'transferTo',
  'transferDate',
  'returnDate',
  'note',
] as const;

type Row = Partial<Record<(typeof COLUMNS)[number], any>>;

// Гибкий маппинг заголовков (в т.ч. русские варианты) -> системные ключи
const HEADER_MAP: Record<string, (typeof COLUMNS)[number]> = {
  // name
  'name': 'name', 'наименование': 'name', 'оборудование': 'name', 'имя': 'name', 'предмет': 'name',
  // category
  'category': 'category', 'категория': 'category', 'раздел': 'category', 'тип': 'category',
  // serialNumber
  'serialnumber': 'serialNumber', 'serial': 'serialNumber', 'sn': 'serialNumber', 'серийный': 'serialNumber', 'серийный номер': 'serialNumber',
  // inventoryNumber
  'inventorynumber': 'inventoryNumber', 'инвентарный': 'inventoryNumber', 'инв. номер': 'inventoryNumber', 'инвентарный номер': 'inventoryNumber', 'инв': 'inventoryNumber',
  // purchaseDate
  'purchasedate': 'purchaseDate', 'дата покупки': 'purchaseDate', 'дата приобретения': 'purchaseDate', 'дата': 'purchaseDate',
  // cost
  'cost': 'cost', 'стоимость': 'cost', 'цена': 'cost', 'цена закупки': 'cost',
  // location
  'location': 'location', 'местоположение': 'location', 'локация': 'location', 'кабинет': 'location', 'место': 'location',
  // responsible
  'responsible': 'responsible', 'ответственный': 'responsible', 'фио': 'responsible', 'сотрудник': 'responsible',
  // status
  'status': 'status', 'статус': 'status', 'состояние': 'status',
  
  // manufacturer
  'manufacturer': 'manufacturer', 'производитель': 'manufacturer',
  // model
  'model': 'model', 'модель': 'model',
  // condition (состояние, но status уже маппится; это "состояние" технич. состояния)
  'condition': 'condition', 'техническое состояние': 'condition', 'сост.': 'condition',
  // transfer
  'transferto': 'transferTo', 'кому передан': 'transferTo', 'получатель': 'transferTo',
  'transferdate': 'transferDate', 'дата передачи': 'transferDate',
  'returndate': 'returnDate', 'дата возврата': 'returnDate',
  // note
  'note': 'note', 'примечание': 'note',
};

function normalizeHeader(h: any): (typeof COLUMNS)[number] | null {
  if (!h && h !== 0) return null;
  const key = String(h).trim().toLowerCase();
  return HEADER_MAP[key] || (COLUMNS.includes(key as any) ? (key as any) : null);
}

function normalizeStatus(val: any): string {
  const v = String(val ?? '').trim().toLowerCase();
  if (!v) return 'in_use';
  if (v === 'в эксплуатации') return 'in_use';
  if (v === 'на складе') return 'in_stock';
  if (v === 'в ремонте') return 'in_repair';
  if (v === 'на списание') return 'to_writeoff';
  if (v === 'списано') return 'written_off';
  if (v === 'inuse') return 'in_use';
  if (v === 'instock') return 'in_stock';
  if (v === 'inrepair') return 'in_repair';
  if (v === 'to_writeoff') return 'to_writeoff';
  if (v === 'writtenoff') return 'written_off';
  if (['in_use','in_stock','in_repair','to_writeoff','written_off'].includes(v)) return v;
  return 'in_use';
}

function parseCost(n: any): number | undefined {
  if (n == null || n === '') return undefined;
  if (typeof n === 'number') return n;
  const s = String(n).replace(/\s+/g,'').replace(/[^0-9.,-]/g,'').replace(',', '.');
  const num = Number(s);
  return Number.isFinite(num) ? num : undefined;
}

function parseDate(d: any): Date | undefined {
  if (!d && d !== 0) return undefined;
  if (typeof d === 'number') {
    // Excel date serial
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = d * 24 * 60 * 60 * 1000;
    return new Date(epoch.getTime() + ms);
  }
  const dt = new Date(String(d));
  return isNaN(dt.getTime()) ? undefined : dt;
}

export async function importEquipment(req: Request, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'File is required' });

  try {
    const wb = XLSX.readFile(file.path);
    const wsname = wb.SheetNames[0];
    const ws = wb.Sheets[wsname];

    // Прочитаем шапку и построим маппинг индексов -> системных ключей
    const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null }) as any[];
    if (!raw.length) return res.status(400).json({ error: 'Empty sheet' });
    const headerRow = raw[0] as any[];
    const map: (typeof COLUMNS)[number][] = headerRow.map((h: any) => normalizeHeader(h)).filter(Boolean) as any;
    if (!map.length) return res.status(400).json({ error: 'Cannot recognize any headers' });

    // Преобразуем строки согласно маппингу
    const rows: Row[] = raw.slice(1).map((r: any) => {
      const obj: any = {};
      for (let i: number = 0; i < headerRow.length; i++) {
        const key = normalizeHeader(headerRow[i]);
        if (!key) continue;
        obj[key] = (r as any[])[i] ?? null;
      }
      return obj;
    });

    let created = 0;
    let updated = 0;
    const errors: any[] = [];

    for (const r of rows) {
      const data: any = {
        name: (r.name ?? '').toString().trim(),
        category: (r.category ?? '').toString().trim(),
        serialNumber: r.serialNumber ? String(r.serialNumber).trim() : undefined,
        inventoryNumber: r.inventoryNumber ? String(r.inventoryNumber).trim() : undefined,
        purchaseDate: parseDate(r.purchaseDate),
        cost: parseCost(r.cost),
        location: r.location ? String(r.location).trim() : undefined,
        responsible: r.responsible ? String(r.responsible).trim() : undefined,
        status: normalizeStatus(r.status),
        manufacturer: r.manufacturer ? String(r.manufacturer).trim() : undefined,
        model: r.model ? String(r.model).trim() : undefined,
        condition: r.condition ? String(r.condition).trim() : undefined,
        transferTo: r.transferTo ? String(r.transferTo).trim() : undefined,
        transferDate: parseDate(r.transferDate),
        returnDate: parseDate(r.returnDate),
        note: r.note ? String(r.note).trim() : undefined,
      };

      if (!data.name || !data.category) {
        errors.push({ row: r, error: 'Missing required name/category' });
        continue;
      }

      const where = data.serialNumber
        ? { serialNumber: data.serialNumber }
        : data.inventoryNumber
        ? { inventoryNumber: data.inventoryNumber }
        : null;

      try {
        if (where) {
          const existing = await prisma.equipment.findFirst({ where });
          if (existing) {
            await prisma.equipment.update({ where: { id: existing.id }, data });
            updated++;
            continue;
          }
        }
        await prisma.equipment.create({ data });
        created++;
      } catch (e: any) {
        errors.push({ row: r, error: e.message });
      }
    }

    try { fs.unlinkSync(file.path); } catch {}

    res.json({ created, updated, errorsCount: errors.length, errors });
  } catch (e: any) {
    res.status(500).json({ error: 'Import failed', details: e.message });
  }
}

export async function exportEquipment(req: Request, res: Response) {
  const { q, status, category, location, responsible } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (status) where.status = status;
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
  const items = await prisma.equipment.findMany({ where });

  const fmtDate = (d?: Date | null) => d ? new Date(d).toLocaleDateString('ru-RU') : ''

  // Порядок колонок как на главной странице (без # и Действия)
  const headers = [
    'Наименование',
    'Производитель',
    'Модель',
    'Серийный',
    'Инв. номер',
    'Дата ввода в эксплуатацию',
    'Стоимость',
    'Местоположение',
    'Ответственный',
    'Кому передан',
    'Когда передан',
    'Статус',
    'Примечание',
  ] as const

  const data = items.map((i: any) => ({
    'Наименование': i.name ?? '',
    'Производитель': i.manufacturer ?? '',
    'Модель': i.model ?? '',
    'Серийный': i.serialNumber ?? '',
    'Инв. номер': i.inventoryNumber ?? '',
    'Дата ввода в эксплуатацию': fmtDate(i.purchaseDate ?? null),
    'Стоимость': i.cost ?? '',
    'Местоположение': i.location ?? '',
    'Ответственный': i.responsible ?? '',
    'Кому передан': i.transferTo ?? '',
    'Когда передан': fmtDate(i.transferDate ?? null),
    'Статус': i.status ?? '',
    'Примечание': i.note ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(data, { header: headers as any });
  // Автофильтр по шапке
  const hdrRange: string = (XLSX.utils as any).encode_range({ s: { c: 0, r: 0 }, e: { c: headers.length - 1, r: 0 } } as any);
  (ws as any)['!autofilter'] = { ref: hdrRange };
;
  // Примерные ширины колонок (в символах)
  ;(ws as any)['!cols'] = [
    { wch: 28 }, // Наименование
    { wch: 18 }, // Производитель
    { wch: 16 }, // Модель
    { wch: 16 }, // Серийный
    { wch: 16 }, // Инв. номер
    { wch: 18 }, // Дата ввода в эксплуатацию
    { wch: 12 }, // Стоимость
    { wch: 18 }, // Местоположение
    { wch: 20 }, // Ответственный
    { wch: 18 }, // Кому передан
    { wch: 18 }, // Когда передан
    { wch: 14 }, // Статус
    { wch: 22 }, // Примечание
  ]
  // Задать числовой формат для колонки Стоимость (0-based индекс 6)
  try {
    const ref = (ws as any)['!ref'] as string | undefined
    if (ref) {
      const range = XLSX.utils.decode_range(ref)
      const col = 6
      for (let r = 1; r <= range.e.r; r++) {
        const addr = XLSX.utils.encode_cell({ c: col, r })
        const cell = (ws as any)[addr]
        if (!cell) continue
        const n = typeof cell.v === 'number' ? cell.v : Number(String(cell.v).replace(/\s+/g,'').replace(',', '.'))
        if (Number.isFinite(n)) {
          cell.v = n
          cell.t = 'n'
          cell.z = '#,##0'
        }
      }
    }
  } catch {}
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Equipment');

  const tmp = path.join(process.env.UPLOAD_DIR || './tmp', `export-equipment-${Date.now()}.xlsx`);
  XLSX.writeFile(wb, tmp);

  res.download(tmp, 'equipment.xlsx', err => {
    try { fs.unlinkSync(tmp); } catch {}
    if (err) console.error(err);
  });
}

export async function exportReport(req: Request, res: Response) {
  const { status } = req.query as any;
  const where: any = {};
  if (status) where.status = status;
  const items = await prisma.equipment.findMany({ where });

  // Единый русский набор колонок без подразделения
  const headers = [
    'Наименование','Производитель','Модель','Серийный','Инв. номер','Дата ввода в эксплуатацию','Стоимость','Местоположение','Ответственный','Кому передан','Когда передан','Статус','Примечание'
  ] as const
  const fmtDate = (d?: Date | null) => d ? new Date(d).toLocaleDateString('ru-RU') : ''
  const data = items.map((i:any)=>({
    'Наименование': i.name ?? '',
    'Производитель': i.manufacturer ?? '',
    'Модель': i.model ?? '',
    'Серийный': i.serialNumber ?? '',
    'Инв. номер': i.inventoryNumber ?? '',
    'Дата ввода в эксплуатацию': fmtDate(i.purchaseDate ?? null),
    'Стоимость': i.cost ?? '',
    'Местоположение': i.location ?? '',
    'Ответственный': i.responsible ?? '',
    'Кому передан': i.transferTo ?? '',
    'Когда передан': fmtDate(i.transferDate ?? null),
    'Статус': i.status ?? '',
    'Примечание': i.note ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(data, { header: headers as any });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  const tmp = path.join(process.env.UPLOAD_DIR || './tmp', `report-${Date.now()}.xlsx`);
  XLSX.writeFile(wb, tmp);

  res.download(tmp, 'report.xlsx', err => {
    try { fs.unlinkSync(tmp); } catch {}
    if (err) console.error(err);
  });
}
