import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, Pencil, Trash2, ArrowRightSquare, Upload, Info } from 'lucide-react'
import Tooltip from '../components/Tooltip'
import api from '../state/api'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../state/useAuth'

export type WarehouseItem = {
  id: number
  name: string
  category: string
  model?: string | null
  manufacturer?: string | null
  serialNumber?: string | null
  quantity: number
  unit: string
  unitCost?: number | string | null
  dateReceived?: string | null
  supplier?: string | null
  status: string
  location?: string | null
  note?: string | null
  createdAt?: string
}

function fmtDate(d?: string | Date | null) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toISOString().substring(0,10)
}

function badgeCls(status: string) {
  const v = status.toLowerCase()
  if (v === 'на складе' || v === 'in_stock') return 'badge badge-green'
  if (v === 'зарезервировано' || v === 'reserved') return 'badge badge-yellow'
  if (v === 'выдано' || v === 'issued') return 'badge badge-gray'
  return 'badge badge-slate'
}

function fmtMoney(v: any){
  if (v == null || v === '' || isNaN(Number(v))) return '—'
  try{
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v))
  }catch{return String(v)}
}

export default function WarehousePage() {
  const { showToast } = useToast()
  const { user } = useAuth()
  const canCreate = !!user && (user.role === 'ADMIN' || user.role === 'EDITOR')
  const canEdit = canCreate
  const canDelete = !!user && user.role === 'ADMIN'

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<WarehouseItem[]>([])
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState<string>('createdAt')
  const [order, setOrder] = useState<'asc'|'desc'>('desc')

  const [mode, setMode] = useState<'list'|'create'|'edit'>('list')
  const [current, setCurrent] = useState<WarehouseItem | null>(null)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [transfer, setTransfer] = useState<any>({ responsible:'', location:'', cost:'', purchaseDate:'', inventoryNumber:'', qty: 1 })
  const [costTouched, setCostTouched] = useState(false)
  function changeSort(key: string){
    if (sortBy === key) {
      setOrder(order === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setOrder('asc')
    }
  }
  function sortArrow(key: string){ return sortBy===key ? (order==='asc' ? '▲' : '▼') : '' }
  const statusRu: Record<string,string> = { in_stock: 'На складе', reserved: 'Зарезервировано', issued: 'Выдано', archived: 'Архив' }

  async function load() {
    setLoading(true)
    try {
      const params: any = {}
      if (q) params.q = q
      if (status) params.status = status
      if (sortBy) params.sort_by = sortBy
      if (order) params.order = order
      const res = await api.get('/warehouse', { params })
      setItems(res.data.items || [])
    } catch (e) {
      console.error('Failed to load warehouse', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  async function doTransfer(){
    if (!current) return
    try {
      const payload = {
        responsible: transfer.responsible || undefined,
        location: transfer.location || undefined,
        cost: transfer.cost ? Number(transfer.cost) : undefined,
        purchaseDate: transfer.purchaseDate || undefined,
        inventoryNumber: transfer.inventoryNumber || undefined,
        qty: Math.max(1, Math.min(Number(transfer.qty||1), current.quantity)),
      }
      await api.post(`/warehouse/${current.id}/transfer`, payload)
      setShowTransfer(false)
      setCurrent(null)
      showToast('Перенос выполнен успешно', 'success')
      await load()
    } catch {
      showToast('Не удалось перенести', 'error')
    }
  }

  async function importExcel(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const form = new FormData()
      form.append('file', f)
      await api.post('/warehouse/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      showToast('Импорт выполнен', 'success')
      await load()
    } catch {
      showToast('Не удалось импортировать', 'error')
    } finally {
      e.target.value = ''
    }
  }

  useEffect(()=>{ load() },[]) // initial
  useEffect(()=>{ const t = setTimeout(load, 200); return ()=>clearTimeout(t) }, [q, status, sortBy, order])

  // Auto-calc total cost = unitCost * qty unless user edited cost manually
  useEffect(()=>{
    if (!current) return
    if (costTouched) return
    const unitCost = Number((current as any)?.unitCost ?? '')
    if (Number.isFinite(unitCost)) {
      const qty = Number(transfer.qty || 1)
      const total = unitCost * Math.max(1, qty)
      const rounded = Math.round(total * 100) / 100
      setTransfer((t:any)=> ({ ...t, cost: String(rounded) }))
    }
  }, [transfer.qty, current, costTouched])

  function startCreate(){ setMode('create'); setCurrent(null) }
  function startEdit(it: WarehouseItem){ setCurrent(it); setMode('edit') }
  function startTransfer(it: WarehouseItem){
    setCurrent(it)
    const unitCost = Number((it as any)?.unitCost ?? '')
    const initialCost = Number.isFinite(unitCost) ? (Math.round(unitCost * 100) / 100) : ''
    setTransfer({ responsible:'', location:'', cost: initialCost!=='' ? String(initialCost) : '', purchaseDate: fmtDate(new Date()), inventoryNumber: '', qty: 1 })
    setCostTouched(false)
    setShowTransfer(true)
  }

  async function onCreate(v: Partial<WarehouseItem>) {
    try {
      await api.post('/warehouse', v)
      showToast('Позиция добавлена', 'success')
      setMode('list')
      await load()
    } catch {
      showToast('Не удалось добавить', 'error')
    }
  }
  async function onUpdate(v: Partial<WarehouseItem>) {
    if (!current) return
    try {
      await api.put(`/warehouse/${current.id}`, v)
      showToast('Изменения сохранены', 'success')
      setMode('list')
      await load()
    } catch {
      showToast('Не удалось сохранить', 'error')
    }
  }
  async function remove(id: number){
    if (!confirm('Удалить позицию?')) return
    try {
      await api.delete(`/warehouse/${id}`)
      showToast('Удалено', 'success')
      await load()
    } catch {
      showToast('Не удалось удалить', 'error')
    }
  }

  const paged = items // no pagination for first version

  return (
    <div className="grid gap-4">
      {mode === 'list' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-xl p-4 flex flex-wrap gap-2 items-center">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск" className="input w-60" />
            <select value={status} onChange={e=>setStatus(e.target.value)} className="input">
              <option value="">Активные</option>
              <option value="in_stock">На складе</option>
              <option value="reserved">Зарезервировано</option>
              <option value="issued">Выдано</option>
              <option value="archived">Архив</option>
              <option value="all">Все</option>
            </select>
            <label className="inline-flex items-center gap-2 px-3 py-2 border rounded cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              <Upload className="h-4 w-4"/>
              <span className="text-sm">Импорт Excel</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={importExcel}/>
            </label>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="input">
              <option value="createdAt">Сорт. по дате добавления</option>
              <option value="name">Сорт. по наименованию</option>
              <option value="category">Сорт. по категории</option>
              <option value="quantity">Сорт. по количеству</option>
              <option value="status">Сорт. по статусу</option>
            </select>
            <select value={order} onChange={e=>setOrder((e.target.value as any))} className="input w-28">
              <option value="desc">Убыв.</option>
              <option value="asc">Возр.</option>
            </select>
            <div className="flex-1"/>
            {canCreate && (
              <button onClick={startCreate} className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-4 py-2 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg"><PlusCircle className="h-5 w-5"/>Добавить позицию</button>
            )}
          </div>

          <div className="overflow-hidden bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-xl">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-10"/>
                <col />
                <col className="hidden xl:table-column w-56 xl:table-cell"/>
                <col className="w-36"/>
                <col className="w-28"/>
                <col className="w-24"/>
                <col className="w-20"/>
                <col className="w-16"/>
                <col className="w-32"/>
                <col className="w-32"/>
                <col className="w-48"/>
                <col />
                <col className="w-36"/>
              </colgroup>
              <thead className="bg-gray-100 dark:bg-slate-800 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-2 py-2">#</th>
                  <th className="text-left px-2 py-2">Наименование</th>
                  <th className="text-left px-2 py-2 hidden xl:table-cell">Модель</th>
                  <th className="text-left px-2 py-2">Серийный</th>
                  <th className="text-left px-2 py-2">Инв. номер</th>
                  <th className="text-left px-2 py-2">Счёт</th>
                  <th className="text-right px-2 py-2">Кол-во</th>
                  <th className="text-left px-2 py-2">Ед.</th>
                  <th className="text-right px-2 py-2">Цена за единицу</th>
                  <th className="text-right px-2 py-2">Стоимость</th>
                  <th className="text-left px-2 py-2">Местоположение</th>
                  <th className="text-left px-2 py-2">Примечание</th>
                  <th className="text-right px-2 py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                {loading && Array.from({length: 8}).map((_,i)=> (
                  <tr key={`s${i}`} className="border-t animate-pulse">
                    <td className="p-2">&nbsp;</td>
                    <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-40"/></td>
                    <td className="p-2 hidden xl:table-cell"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2 hidden xl:table-cell"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-10"/></td>
                    <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-10"/></td>
                    <td className="p-2 text-right"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-10 ml-auto"/></td>
                    <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-10"/></td>
                    <td className="p-2 text-right hidden lg:table-cell"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24 ml-auto"/></td>
                    <td className="p-2 text-right hidden lg:table-cell"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24 ml-auto"/></td>
                    <td className="p-2 w-1/3"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-40"/></td>
                    <td className="p-2"/>
                  </tr>
                ))}
                {!loading && paged.map((it, idx)=> (
                  <motion.tr key={it.id} initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} exit={{opacity:0}} transition={{duration:0.2}} className="border-t transition-all hover:bg-blue-50 dark:hover:bg-slate-600">
                    <td className="px-2 py-2 whitespace-nowrap">{idx+1}</td>
                    <td className="px-2 py-2 truncate"><Tooltip text={it.name || '—'}><span className="truncate inline-block max-w-[320px] align-bottom">{it.name}</span></Tooltip></td>
                    <td className="px-2 py-2 hidden xl:table-cell truncate" title={`${it.manufacturer||''} ${it.model||''}`.trim() || '—'}>{[it.manufacturer,it.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{it.serialNumber || '—'}</td>
                    <td className="px-2 py-2 whitespace-nowrap">—</td>
                    <td className="px-2 py-2 whitespace-nowrap">—</td>
                    <td className="px-2 py-2 text-right font-number whitespace-nowrap">{Number((it as any)?.quantity ?? 0)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{it.unit}</td>
                    <td className="px-2 py-2 text-right font-number whitespace-nowrap">{fmtMoney((it as any).unitCost)}</td>
                    <td className="px-2 py-2 text-right font-number whitespace-nowrap">{
                      (it as any).unitCost != null && (it as any).unitCost !== ''
                        ? fmtMoney((Number((it as any).unitCost) || 0) * (Number((it as any).quantity) || 0))
                        : '—'
                    }</td>
                    <td className="px-2 py-2 truncate" title={it.location || '—'}>{it.location || '—'}</td>
                    <td className="px-2 py-2 truncate" title={it.note || '—'}>{it.note || '—'}</td>
                    <td className="p-2 text-right w-36">
                      <button onClick={()=>{ setCurrent(it); setShowDetails(true) }} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors mr-1"><Info className="h-4 w-4"/> Подр.</button>
                      {canEdit && (
                        <button onClick={()=>startTransfer(it)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"><ArrowRightSquare className="h-4 w-4"/> В инвент</button>
                      )}
                    </td>
                  </motion.tr>
                ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details modal */}
      {showDetails && current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <motion.div initial={{opacity:0, scale:0.96}} animate={{opacity:1, scale:1}} className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold">{current.name}</div>
              <button className="btn" onClick={()=>setShowDetails(false)}>Закрыть</button>
            </div>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="text-slate-500">Модель</div>
              <div className="md:col-span-2">{[current.manufacturer, current.model].filter(Boolean).join(' ') || '—'}</div>
              <div className="text-slate-500">Серийный</div>
              <div className="md:col-span-2">{current.serialNumber || '—'}</div>
              <div className="text-slate-500">Кол-во</div>
              <div className="md:col-span-2">{current.quantity} {current.unit}</div>
              <div className="text-slate-500">Стоимость</div>
              <div className="md:col-span-2">{current.unitCost!=null && current.unitCost!=='' ? `${fmtMoney(current.unitCost)} ₽ / ед.` : '—'}</div>
              
              <div className="text-slate-500">Местоположение</div>
              <div className="md:col-span-2">{current.location || '—'}</div>
              <div className="text-slate-500">Примечание</div>
              <div className="md:col-span-2">{current.note || '—'}</div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {canEdit ? (
                <button className="btn inline-flex items-center gap-2" onClick={()=>{ setShowDetails(false); startEdit(current) }}>
                  <Pencil className="h-4 w-4"/> Редактировать
                </button>
              ) : (
                <button className="btn" onClick={()=>setShowDetails(false)}>Закрыть</button>
              )}
              {canEdit && (
                <button onClick={()=>{ setShowDetails(false); startTransfer(current) }} className="btn-primary inline-flex items-center gap-2"><ArrowRightSquare className="h-4 w-4"/> В инвент</button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {mode !== 'list' && (
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-xl p-4">
          <WarehouseForm
            initial={mode==='edit' ? {
              name: current?.name || '',
              model: current?.model || undefined,
              manufacturer: current?.manufacturer || undefined,
              serialNumber: current?.serialNumber || undefined,
              quantity: current?.quantity || 1,
              unit: current?.unit || 'шт',
              location: current?.location || undefined,
              note: current?.note || undefined,
              unitCost: (current as any)?.unitCost ?? undefined,
            } : undefined}
            onSubmit={mode==='create' ? onCreate : onUpdate}
            onCancel={()=>setMode('list')}
          />
        </div>
      )}

      {/* Transfer modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <motion.div initial={{opacity:0, scale:0.96}} animate={{opacity:1, scale:1}} className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-xl p-4">
            <h3 className="text-lg font-semibold mb-3">Перенос в инвентаризацию</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={transfer.responsible} onChange={e=>setTransfer({...transfer, responsible:e.target.value})} placeholder="Ответственный" className="input"/>
              <input value={transfer.location} onChange={e=>setTransfer({...transfer, location:e.target.value})} placeholder="Местоположение" className="input"/>
              <div className="flex flex-col">
                <input type="number" step="0.01" value={transfer.cost} onChange={e=>{ setCostTouched(true); setTransfer({...transfer, cost: e.target.value}) }} placeholder="Стоимость" className="input"/>
                <span className="text-xs text-slate-500 mt-1">Допустимо до 9 999 999 999.99 или оставьте пустым</span>
              </div>
              <input type="date" value={transfer.purchaseDate} onChange={e=>setTransfer({...transfer, purchaseDate:e.target.value})} placeholder="Дата ввода в эксплуатацию" className="input"/>
              <input value={transfer.inventoryNumber} onChange={e=>setTransfer({...transfer, inventoryNumber:e.target.value})} placeholder="Инвентарный номер (если пусто, сгенерируется)" className="input"/>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={current?.quantity||1} value={transfer.qty}
                  onChange={e=>setTransfer({...transfer, qty: Number(e.target.value||1)})}
                  placeholder="Кол-во для переноса" className="input w-40"/>
                <span className="text-xs text-slate-500">Доступно: {current?.quantity}</span>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>setShowTransfer(false)} className="btn">Отмена</button>
              {(() => { const qtyOk = Number(transfer.qty) > 0 && Number(transfer.qty) <= (current?.quantity||0); const costNum = Number(transfer.cost); const costOk = (transfer.cost===''||transfer.cost==null) || (Number.isFinite(costNum) && costNum>=0 && costNum < 1e10); const disabled = !qtyOk || !costOk; return (
                <button onClick={doTransfer} disabled={disabled} className={`btn-primary ${disabled? 'opacity-60 cursor-not-allowed':''}`}>Перенести</button>
              )})()}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

function WarehouseForm({ initial, onSubmit, onCancel }:{ initial?: any, onSubmit:(v:any)=>void, onCancel:()=>void }){
  const [form, setForm] = useState<any>({
    name: '', model: '', manufacturer: '', serialNumber: '', quantity: 1, unit: 'шт', unitCost: '', location: '', note: '',
    ...initial,
  })
  function set<K extends string>(k:K, v:any){ setForm((f:any)=>({ ...f, [k]: v })) }
  function submit(e:any){ e.preventDefault(); onSubmit({
    ...form,
    quantity: Number(form.quantity||1)||1,
    unitCost: form.unitCost!=='' && form.unitCost!=null ? Number(form.unitCost) : undefined,
    model: form.model||undefined, manufacturer: form.manufacturer||undefined, serialNumber: form.serialNumber||undefined,
    location: form.location||undefined, note: form.note||undefined,
  }) }
  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="Наименование *" className="input"/>
      <input value={form.model} onChange={e=>set('model', e.target.value)} placeholder="Модель" className="input"/>
      {/* Поле Производитель скрыто по запросу */}
      <input value={form.serialNumber} onChange={e=>set('serialNumber', e.target.value)} placeholder="Серийный номер" className="input"/>
      <div className="flex gap-2">
        <input type="number" value={form.quantity} onChange={e=>set('quantity', Number(e.target.value||0))} placeholder="Кол-во" className="input w-32"/>
        <input value={form.unit} onChange={e=>set('unit', e.target.value)} placeholder="Ед." className="input w-28"/>
      </div>
      <input type="number" step="0.01" value={form.unitCost} onChange={e=>set('unitCost', e.target.value)} placeholder="Цена за единицу" className="input"/>
      <input value={form.location} onChange={e=>set('location', e.target.value)} placeholder="Местоположение" className="input"/>
      <div className="md:col-span-2">
        <input value={form.note} onChange={e=>set('note', e.target.value)} placeholder="Примечание" className="input"/>
      </div>
      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn">Отмена</button>
        <button type="submit" className="btn-primary">Сохранить</button>
      </div>
    </form>
  )
}
