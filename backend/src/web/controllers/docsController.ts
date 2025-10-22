import { Request, Response } from 'express'
import { prisma } from '../db/prisma.js'
import { z } from 'zod'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle } from 'docx'

const transferSchema = z.object({
  equipmentId: z.number(),
  transferTo: z.string().min(1),
  transferDate: z.string().optional(),
  returnDate: z.string().optional(),
  note: z.string().optional().default(''),
})

export async function generateTransferAct(req: Request, res: Response) {
  const parsed = transferSchema.safeParse(req.body)
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() })
  const { equipmentId, transferTo, transferDate, returnDate, note } = parsed.data

  const eq = await prisma.equipment.findUnique({ where: { id: equipmentId } })
  if (!eq) return res.status(404).json({ error: 'Equipment not found' })

  const fmt = (d?: Date | string | null) => {
    if (!d) return ''
    const dt = typeof d === 'string' ? new Date(d) : d
    if (Number.isNaN(dt.getTime())) return ''
    const dd = String(dt.getDate()).padStart(2, '0')
    const mm = String(dt.getMonth()+1).padStart(2, '0')
    const yyyy = dt.getFullYear()
    return `${dd}.${mm}.${yyyy}`
  }

  // Header and title
  const header1 = new Paragraph({
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: 'Приложение (рекомендуемое)', italics: true })],
  })
  const title = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: 'АКТ № ______', bold: true, size: 28 }),
      new TextRun({ text: '\nпередачи оборудования', bold: true, size: 28 }),
    ],
  })
  const dateLine = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `от «${fmt(transferDate ?? new Date()).split('.')[0]}» ${fmt(transferDate ?? new Date()).split('.')[1]}.${fmt(transferDate ?? new Date()).split('.')[2]} г.` })],
  })

  // Parties lines
  const transmitter = eq.responsible ?? ''
  const receiver = transferTo
  const receiverDept = ''

  const line = (label: string, value: string) => new Paragraph({
    children: [
      new TextRun({ text: label + ' ' }),
      new TextRun({ text: value || '_____________________________', underline: { type: 'single' } }),
    ],
  })

  // Equipment table similar to sample: №, Наименование оборудования, Ед. изм., Кол-во
  const eqTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '№ п/п', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Наименование оборудования', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ед. изм.', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Кол-во', bold: true })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('1')]}),
          new TableCell({ children: [new Paragraph(`${eq.name}${eq.model?` (${eq.model})`:''}${eq.serialNumber?` / SN: ${eq.serialNumber}`:''}${eq.inventoryNumber?` / Инв.: ${eq.inventoryNumber}`:''}`)] }),
          new TableCell({ children: [new Paragraph('шт')] }),
          new TableCell({ children: [new Paragraph('1')] }),
        ],
      }),
    ],
  })

  const remarksTitle = new Paragraph({ children: [new TextRun({ text: 'Замечания:', bold: true })] })
  const remarks = new Paragraph({ children: [new TextRun({ text: note || '____________________________________________' })] })

  const doc = new Document({
    sections: [
      {
        children: [
          header1,
          new Paragraph({ text: '' }),
          title,
          dateLine,
          new Paragraph({ text: '' }),
          line('Я,', transmitter),
          line('передал(а)', `${receiver}`),
          new Paragraph({ text: 'оборудование:' }),
          eqTable,
          new Paragraph({ text: '' }),
          remarksTitle,
          remarks,
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  const fname = `transfer-act-${eq.inventoryNumber || eq.serialNumber || eq.name}.docx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fname)}"`)
  res.send(buffer)
}
