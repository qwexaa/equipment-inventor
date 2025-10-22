import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, Pencil, Trash2, Filter, CheckCircle, Box, Wrench, AlertTriangle, Share2, Ban, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import Tooltip from '../components/Tooltip'
import api from '../state/api'
import EquipmentForm, { type EquipmentInput } from '../components/EquipmentForm'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../state/useAuth'

export type Equipment = {
  id: number
  name: string
  category: string
  serialNumber?: string | null
  inventoryNumber?: string | null
  account?: 'main' | 'off_balance' | 'household' | null
  purchaseDate?: string | null
  cost?: string | null
  location?: string | null
  responsible?: string | null
  status: string
  note?: string | null
  transferDate?: string | null
}

export default function EquipmentList() {
  const [items, setItems] = useState<Equipment[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({ status: '', category: '' })
  const [mode, setMode] = useState<'list'|'create'|'edit'>('list')
  // cards view removed — always table
  const [current, setCurrent] = useState<Equipment | null>(null)
  const [sort, setSort] = useState<{key: keyof Equipment | string, dir: 'asc'|'desc'}>({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()
  const { user } = useAuth()
  const role = user?.role || 'USER'
  const canCreate = role === 'ADMIN' || role === 'EDITOR'
  const canEdit = role === 'ADMIN' || role === 'EDITOR'
  const canDelete = role === 'ADMIN'
  const [selected, setSelected] = useState<number[]>([])

  async function load() {
    setLoading(true)
    const params: any = {}
    if (q) params.q = q
    if (filters.status) params.status = filters.status
    if (filters.category) params.category = filters.category
    
    params.limit = pageSize
    params.offset = (page - 1) * pageSize
    params.sort_by = sort.key
    params.order = sort.dir
    try {
      const res = await api.get('/equipment', { params })
      const body = res.data
      setItems(body.items || [])
      setTotal(body.total || 0)
    } catch (e:any) {
      showToast('Ошибка загрузки списка', 'error')
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(id: number, on?: boolean){
    setSelected(prev => {
      const has = prev.includes(id)
      const next = (on ?? !has) ? [...prev, id] : prev.filter(x=>x!==id)
      return Array.from(new Set(next))
    })
  }
  function isSelected(id: number){ return selected.includes(id) }
  function clearSelection(){ setSelected([]) }
  function selectAllOnPage(on: boolean){
    const ids = paged.map(i=>i.id)
    setSelected(prev => on ? Array.from(new Set([...prev, ...ids])) : prev.filter(id=>!ids.includes(id)))
  }

  async function bulkDelete(){
    if (!canDelete) return
    if (!selected.length) return
    if (!confirm(`Удалить выбранные (${selected.length})?`)) return
    setLoading(true)
    try {
      const results = await Promise.allSettled(selected.map(id=>api.delete(`/equipment/${id}`)))
      const ok = results.filter(r=>r.status==='fulfilled').length
      const fail = results.length - ok
      showToast(`Удалено: ${ok}${fail?`, ошибок: ${fail}`:''}`, fail? 'error':'success')
      clearSelection()
      await load()
    } finally { setLoading(false) }
  }

  async function bulkReturnToWarehouse(){
    if (!canEdit) return
    if (!selected.length) return
    if (!confirm(`Вернуть на склад выбранные (${selected.length})?`)) return
    setLoading(true)
    try {
      const results = await Promise.allSettled(selected.map(id=>api.put(`/equipment/${id}`, { status: 'in_stock' })))
      const ok = results.filter(r=>r.status==='fulfilled').length
      const fail = results.length - ok
      showToast(`Возвращено на склад: ${ok}${fail?`, ошибок: ${fail}`:''}`, fail? 'error':'success')
      clearSelection()
      await load()
    } finally { setLoading(false) }
  }
  function fmtDate(d?: string | Date | null) {
    if (!d) return '—'
    const dt = typeof d === 'string' ? new Date(d) : d
    if (Number.isNaN(dt.getTime())) return '—'
    try {
      return dt.toLocaleDateString('ru-RU')
    } catch {
      const y = dt.getFullYear()
      const m = String(dt.getMonth()+1).padStart(2,'0')
      const dd = String(dt.getDate()).padStart(2,'0')
      return `${dd}.${m}.${y}`
    }
  }

  function fmtCost(n?: number | null) {
    if (n == null) return '—'
    try { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n) } catch { return String(n) }
  }

  useEffect(() => {
    // restore persisted filters
    try {
      const saved = localStorage.getItem('eq_filters')
      if (saved) {
        const s = JSON.parse(saved)
        if (s.q != null) setQ(s.q)
        if (s.filters) setFilters(s.filters)
      }
    } catch {}
    load()
  }, [])
  // Автообновление при изменении фильтров/поиска с дебаунсом
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      try { localStorage.setItem('eq_filters', JSON.stringify({ q, filters })) } catch {}
      load()
    }, 300)
    return () => clearTimeout(t)
  }, [q, filters.status, filters.category])
  // Reload on page/sort/pageSize change
  useEffect(() => { load() }, [page, pageSize, sort.key, sort.dir])

  // Keep selection in sync with current items
  useEffect(() => {
    setSelected(prev => prev.filter(id => items.some(i => i.id === id)))
  }, [items])

  // removed eq_view persistence

  function startCreate() { if (!canCreate) return; setMode('create'); setCurrent(null) }
  function startEdit(it: Equipment) { if (!canEdit) return; setMode('edit'); setCurrent(it) }

  async function remove(id: number) {
    if (!confirm('Удалить запись?')) return
    try {
      await api.delete(`/equipment/${id}`)
      showToast('Запись удалена', 'success')
      await load()
    } catch {
      showToast('Не удалось удалить', 'error')
    }
  }


  async function onCreate(v: EquipmentInput) {
    try {
      await api.post('/equipment', v)
      showToast('Оборудование добавлено', 'success')
      setMode('list')
      await load()
    } catch {
      showToast('Не удалось добавить', 'error')
    }
  }
  async function onUpdate(v: EquipmentInput) {
    if (!current) return
    try {
      await api.put(`/equipment/${current.id}`, v)
      showToast('Изменения сохранены', 'success')
      setMode('list')
      await load()
    } catch {
      showToast('Не удалось сохранить', 'error')
    }
  }

  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category || ''))).filter(Boolean).sort(), [items])
  
  const statusRu: Record<string,string> = { in_use: 'В эксплуатации', in_stock: 'На складе', in_repair: 'В ремонте', written_off: 'Списано', to_writeoff: 'На списание' }
  const statusCls: Record<string,string> = { in_use: 'badge-green', in_stock: 'badge-yellow', in_repair: 'badge-blue', written_off: 'badge-gray', to_writeoff: 'badge-red' }
  function normStatus(s?: string | null) {
    const v = (s || '').toString().trim().toLowerCase()
    if (!v) return 'in_use'
    // поддержка русских значений, если попали из импорта/ручного ввода
    if (v === 'в эксплуатации') return 'in_use'
    if (v === 'на складе') return 'in_stock'
    if (v === 'списано') return 'written_off'
    if (v === 'на списание') return 'to_writeoff'
    // поддержка альтернативных кодов
    if (v === 'inuse') return 'in_use'
    if (v === 'instock') return 'in_stock'
    return v
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paged = items

  function changeSort(key: keyof Equipment | string) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  function sortLabel(key: string) {
    const map: Record<string,string> = {
      name: 'Наименование',
      manufacturer: 'Производитель',
      model: 'Модель',
      purchaseDate: 'Дата ввода в эксплуатацию',
      cost: 'Стоимость',
      location: 'Местоположение',
      responsible: 'Ответственный',
      transferTo: 'Кому передан',
      transferDate: 'Когда передан',
      status: 'Статус',
      account: 'Счёт',
    }
    return map[key] || key
  }
  function ruAccount(v?: Equipment['account']){
    if (!v) return '—'
    if (v === 'main') return 'Основной'
    if (v === 'off_balance') return 'Забалансовый'
    if (v === 'household') return 'Хоз.расчёт'
    return String(v)
  }
  function sortArrow(key: string) {
    if (sort.key !== key) return ''
    return sort.dir === 'asc' ? '▲' : '▼'
  }

  return (
    <div className="grid gap-4">
      {mode === 'list' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-xl p-4 flex flex-wrap gap-2 items-center">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск" className="input w-60" />
            <select value={filters.status} onChange={e=>setFilters(f=>({...f, status: e.target.value}))} className="input">
              <option value="">Статус</option>
              <option value="in_use">В эксплуатации</option>
              <option value="in_repair">В ремонте</option>
              <option value="written_off">Списано</option>
              <option value="to_writeoff">На списание</option>
            </select>
            {/* Убраны: выбор подразделения и кнопка Фильтр по запросу. */}
            <span className="text-xs md:text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg shadow-sm">
              Сортировка: {sortLabel(String(sort.key))} {sort.dir === 'asc' ? 'по возрастанию' : 'по убыванию'}
            </span>
            <div className="flex-1" />
            {selected.length>0 ? (
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button onClick={bulkReturnToWarehouse} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white shadow-md disabled:opacity-60 disabled:cursor-not-allowed"><Box className="h-5 w-5"/>В склад ({selected.length})</button>
                )}
                {canDelete && (
                  <button onClick={bulkDelete} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md disabled:opacity-60 disabled:cursor-not-allowed"><Trash2 className="h-5 w-5"/>Удалить ({selected.length})</button>
                )}
              </div>
            ) : (
              canCreate && (
                <button onClick={startCreate} className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-4 py-2 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg"><PlusCircle className="h-5 w-5"/>Добавить оборудование</button>
              )
            )}
          </div>

          <div className="overflow-hidden surface">
            <table className="w-full table-auto text-sm">
              <thead className="bg-gray-100/95 dark:bg-slate-800/95 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="text-left px-2 py-2 whitespace-nowrap">
                    <input type="checkbox" checked={paged.length>0 && paged.every(i=>isSelected(i.id))} onChange={e=>selectAllOnPage(e.target.checked)} />
                  </th>
                  <th className="text-left px-2 py-2 whitespace-nowrap">#</th>
                  <th className="text-left px-2 py-2 cursor-pointer whitespace-nowrap group" onClick={()=>changeSort('name')}>Наименование <span className={`ml-1 text-slate-400 group-hover:text-slate-600 ${sort.key==='name'?'text-blue-600':''}`}>{sortArrow('name')}</span></th>
                  <th className="text-left px-2 py-2 cursor-pointer hidden xl:table-cell group" onClick={()=>changeSort('model' as any)}>Модель <span className={`ml-1 text-slate-400 group-hover:text-slate-600 ${sort.key==='model'?'text-blue-600':''}`}>{sortArrow('model')}</span></th>
                  <th className="text-left px-2 py-2 whitespace-nowrap">Серийный</th>
                  <th className="text-left px-2 py-2 whitespace-nowrap">Инв. номер</th>
                  <th className="text-left px-2 py-2 cursor-pointer whitespace-nowrap group" onClick={()=>changeSort('account' as any)}>Счёт <span className={`ml-1 text-slate-400 group-hover:text-slate-600 ${sort.key==='account'?'text-blue-600':''}`}>{sortArrow('account')}</span></th>
                  <th className="text-right px-2 py-2 cursor-pointer hidden lg:table-cell group" onClick={()=>changeSort('cost' as any)}>Стоимость <span className={`ml-1 text-slate-400 group-hover:text-slate-600 ${sort.key==='cost'?'text-blue-600':''}`}>{sortArrow('cost')}</span></th>
                  <th className="text-left px-2 py-2">Ответственный</th>
                  <th className="text-left px-2 py-2 cursor-pointer hidden lg:table-cell group" onClick={()=>changeSort('purchaseDate' as any)}>
                    <span className="leading-tight block">Дата ввода<br/>в эксплуатацию</span>
                    <span className={`ml-1 text-slate-400 group-hover:text-slate-600 ${sort.key==='purchaseDate'?'text-blue-600':''}`}>{sortArrow('purchaseDate')}</span>
                  </th>
                  <th className="text-left px-2 py-2">Местоположение</th>
                  <th className="text-left px-2 py-2 cursor-pointer hidden xl:table-cell group" onClick={()=>changeSort('transferTo' as any)}>
                    <span className="leading-tight block">Кому<br/>передан</span>
                    <span className={`ml-1 text-slate-400 group-hover:text-slate-600 ${sort.key==='transferTo'?'text-blue-600':''}`}>{sortArrow('transferTo')}</span>
                  </th>
                  <th className="text-left px-2 py-2 cursor-pointer hidden xl:table-cell group" onClick={()=>changeSort('transferDate' as any)}>
                    <span className="leading-tight block">Когда<br/>передан</span>
                    <span className={`ml-1 text-slate-400 group-hover:text-slate-600 ${sort.key==='transferDate'?'text-blue-600':''}`}>{sortArrow('transferDate')}</span>
                  </th>
                  <th className="text-left px-2 py-2 cursor-pointer group" onClick={()=>changeSort('status')}>Статус <span className={`ml-1 text-slate-400 group-hover:text-slate-600 ${sort.key==='status'?'text-blue-600':''}`}>{sortArrow('status')}</span></th>
                  <th className="text-left px-2 py-2 w-1/3">Примечание</th>
                  <th className="text-right px-2 py-2 w-28">Действия</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                {loading && Array.from({length: Math.min(pageSize, 10)}).map((_,i)=> (
                  <tr key={`s${i}`} className="border-t animate-pulse">
                    <td className="px-2 py-2">&nbsp;</td>
                    <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-40"/></td>
                    <td className="p-2 hidden xl:table-cell"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2 hidden xl:table-cell"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20"/></td>
                    <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20"/></td>
                    <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2 hidden lg:table-cell text-right"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto"/></td>
                    <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2 hidden lg:table-cell"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2 hidden xl:table-cell"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2 hidden xl:table-cell"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                    <td className="p-2 text-right"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto"/></td>
                  </tr>
                ))}
                {!loading && paged.map((it, idx) => (
                  <motion.tr key={it.id} initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} exit={{opacity:0}} transition={{duration:0.2}} className={`border-t transition-all rounded-md ${
                    normStatus(it.status)==='in_use' ? 'bg-green-50 dark:bg-green-900/20' :
                    normStatus(it.status)==='in_stock' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                    normStatus(it.status)==='in_repair' ? 'bg-blue-50 dark:bg-blue-900/20' :
                    'bg-red-50 dark:bg-red-900/20'
                  } hover:bg-blue-50 dark:hover:bg-slate-600`}>
                    <td className="px-2 py-2"><input type="checkbox" checked={isSelected(it.id)} onChange={e=>toggleSelect(it.id, e.target.checked)} /></td>
                    <td className="px-2 py-2">{(currentPage - 1) * pageSize + idx + 1}</td>
                    <td className="px-2 py-2 truncate max-w-[320px]"><Tooltip text={it.name || '—'}><span className="truncate inline-block max-w-[320px] align-bottom">{it.name}</span></Tooltip></td>
                    <td className="px-2 py-2 hidden xl:table-cell truncate max-w-[220px]" title={`${(it as any).manufacturer || ''} ${(it as any).model || ''}`.trim() || '—'}>
                      {[(it as any).manufacturer,(it as any).model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">{it.serialNumber || '—'}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{it.inventoryNumber || '—'}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{ruAccount(it.account)}</td>
                    <td className="px-2 py-2 text-right hidden lg:table-cell font-number">{fmtCost(it.cost as any)}</td>
                    <td className="px-2 py-2 truncate max-w-[200px] break-words"><Tooltip text={it.responsible || '—'}><span className="truncate inline-block max-w-[200px] align-bottom">{it.responsible || '—'}</span></Tooltip></td>
                    <td className="px-2 py-2 hidden lg:table-cell">{fmtDate(it.purchaseDate as any)}</td>
                    <td className="px-2 py-2 truncate max-w-[200px] break-words"><Tooltip text={it.location || '—'}><span className="truncate inline-block max-w-[200px] align-bottom">{it.location || '—'}</span></Tooltip></td>
                    <td className="px-2 py-2 hidden xl:table-cell">{(it as any).transferTo || '—'}</td>
                    <td className="px-2 py-2 hidden xl:table-cell">{fmtDate((it as any).transferDate as any)}</td>
                    <td className="px-2 py-2">
                      { (it as any).transferTo ? (
                        <span className="inline-flex items-center gap-1 border rounded-lg px-2 py-0.5 text-xs bg-slate-100 text-slate-700 border-slate-200"><Share2 className="h-3 w-3"/>Передан</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 border rounded-lg px-2 py-0.5 text-xs ${
                          normStatus(it.status)==='in_use' ? 'bg-green-100 text-green-800 border-green-200' :
                          normStatus(it.status)==='in_stock' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                          normStatus(it.status)==='in_repair' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          'bg-red-100 text-red-800 border-red-200'
                        }`}>
                          {normStatus(it.status)==='in_use' && <CheckCircle className="h-3 w-3"/>}
                          {normStatus(it.status)==='in_stock' && <Box className="h-3 w-3"/>}
                          {normStatus(it.status)==='in_repair' && <Wrench className="h-3 w-3"/>}
                          {normStatus(it.status)==='to_writeoff' && <AlertTriangle className="h-3 w-3"/>}
                          {normStatus(it.status)==='written_off' && <Ban className="h-3 w-3"/>}
                          {statusRu[normStatus(it.status)] || (it.status || '—')}
                        </span>
                      )}
                    </td>
                    <td className="p-2 w-1/3 truncate"><Tooltip text={(it as any).note || '—'}><span className="truncate inline-block max-w-full align-bottom">{(it as any).note || '—'}</span></Tooltip></td>
                    <td className="p-2 text-right w-28">
                      <Link to={`/equipment/${it.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"><Info className="h-4 w-4"/> Подр.</Link>
                    </td>
                  </motion.tr>
                ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          
          <div className="flex items-center justify-between py-3">
            <div className="text-sm text-gray-600">Стр. {currentPage} из {pageCount} — всего {total}</div>
            <div className="flex items-center gap-2">
              <button className="btn" disabled={currentPage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Назад</button>
              <button className="btn" disabled={currentPage>=pageCount} onClick={()=>setPage(p=>Math.min(pageCount,p+1))}>Вперёд</button>
              <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value)); setPage(1)}} className="input">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {mode !== 'list' && (
        <div className="surface p-4">
          <h2 className="text-lg font-semibold mb-4">{mode === 'create' ? 'Добавить' : 'Редактировать'} оборудование</h2>
          <EquipmentForm
            initial={mode==='edit' && current ? {
              name: current.name,
              category: current.category,
              serialNumber: current.serialNumber ?? undefined,
              inventoryNumber: current.inventoryNumber ?? undefined,
              purchaseDate: current.purchaseDate ? String(current.purchaseDate).substring(0,10) : undefined,
              cost: current.cost ? Number(current.cost as any) : undefined,
              location: current.location ?? undefined,
              responsible: current.responsible ?? undefined,
              status: current.status,
            } : undefined}
            onSubmit={mode==='create'? onCreate : onUpdate}
            onCancel={()=>setMode('list')}
            categories={categories}
          />
        </div>
      )}
    </div>
  )
}
