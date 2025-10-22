import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  serialNumber: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  inventoryNumber: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  purchaseDate: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  cost: z.string().optional().or(z.literal('')).transform(v => (v ? Number(v) : undefined)),
  location: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  responsible: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  status: z.string().min(1),
  manufacturer: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  model: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  condition: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  transferTo: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  transferDate: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  returnDate: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  note: z.string().optional().or(z.literal('')).transform(v => v || undefined),
})

export type EquipmentInput = z.infer<typeof schema>

export default function EquipmentForm({ initial, onSubmit, onCancel, categories }:{ initial?: Partial<EquipmentInput>, onSubmit: (v: EquipmentInput)=>void, onCancel: ()=>void, categories?: string[] }) {
  const { register, handleSubmit, formState: { errors } } = useForm<EquipmentInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', category: initial?.category || 'Прочее', status: initial?.status || 'in_use', ...initial,
      purchaseDate: initial?.purchaseDate ? String(initial.purchaseDate).substring(0,10) : undefined,
      cost: initial?.cost ? String(initial.cost as any) as any : undefined,
      transferDate: initial?.transferDate ? String(initial.transferDate).substring(0,10) : undefined,
      returnDate: initial?.returnDate ? String(initial.returnDate).substring(0,10) : undefined,
    } as any
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="flex flex-col gap-1">
        <input {...register('name')} placeholder="Наименование *" className="input" aria-invalid={!!errors.name} />
        {errors.name && <span className="text-xs text-red-600">Обязательное поле</span>}
      </div>
      {/* Категория больше не отображается в UI */}
      <input type="hidden" {...register('category')} defaultValue={initial?.category || 'Прочее'} />
      {/* Поле Производитель скрыто по запросу */}
      <div className="flex flex-col gap-1">
        <input {...register('model')} placeholder="Модель" className="input" />
        {errors.model && <span className="text-xs text-red-600">Некорректное значение</span>}
      </div>
      <div className="flex flex-col gap-1">
        <input {...register('serialNumber')} placeholder="Серийный номер" className="input" />
        {errors.serialNumber && <span className="text-xs text-red-600">Некорректное значение</span>}
      </div>
      <div className="flex flex-col gap-1">
        <input {...register('inventoryNumber')} placeholder="Инвентарный номер" className="input" />
        {errors.inventoryNumber && <span className="text-xs text-red-600">Некорректное значение</span>}
      </div>
      <div className="flex flex-col gap-1">
        <input type="date" {...register('purchaseDate')} placeholder="Дата ввода в эксплуатацию" className="input" />
        <span className="text-xs text-slate-500">Когда оборудование введено в эксплуатацию</span>
      </div>
      {/* Счёт не редактируется здесь */}
      <div className="flex flex-col gap-1">
        <input type="number" step="0.01" {...register('cost')} placeholder="Стоимость" className="input font-number" />
        {errors.cost && <span className="text-xs text-red-600">Введите число</span>}
      </div>
      <div className="flex flex-col gap-1">
        <input {...register('location')} placeholder="Местоположение" className="input" />
        {errors.location && <span className="text-xs text-red-600">Некорректное значение</span>}
      </div>
      <div className="flex flex-col gap-1">
        <input {...register('responsible')} placeholder="Ответственный" className="input" />
        {errors.responsible && <span className="text-xs text-red-600">Некорректное значение</span>}
      </div>
      <div className="flex flex-col gap-1">
        <input {...register('transferTo')} placeholder="Кому передан" className="input" />
        {errors.transferTo && <span className="text-xs text-red-600">Некорректное значение</span>}
      </div>
      <div className="flex flex-col gap-1">
        <input type="date" {...register('transferDate')} placeholder="Дата передачи" className="input" />
        <span className="text-xs text-slate-500">Когда оборудование передали указанному получателю</span>
      </div>
      <div className="flex flex-col gap-1">
        <input type="date" {...register('returnDate')} placeholder="Дата возврата" className="input" />
        <span className="text-xs text-slate-500">Планируемая или фактическая дата возврата</span>
      </div>
      <div className="flex flex-col gap-1 md:col-span-2">
        <input {...register('note')} placeholder="Примечание" className="input" />
        {errors.note && <span className="text-xs text-red-600">Некорректное значение</span>}
      </div>
      <select {...register('status')} className="input">
        <option value="in_use">В эксплуатации</option>
        <option value="in_stock">На складе</option>
        <option value="in_repair">В ремонте</option>
        <option value="written_off">Списано</option>
        <option value="to_writeoff">На списание</option>
      </select>

      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn">Отмена</button>
        <button type="submit" className="btn-primary">Сохранить</button>
      </div>
    </form>
  )
}
