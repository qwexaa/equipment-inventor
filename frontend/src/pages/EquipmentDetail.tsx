import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import api from '../state/api'
import { useToast } from '../components/ToastProvider'
import EquipmentForm, { type EquipmentInput } from '../components/EquipmentForm'
import Tooltip from '../components/Tooltip'
import { useAuth } from '../state/useAuth'

function normStatus(s?: string | null) {
  const v = (s || '').toString().trim().toLowerCase()
  if (!v) return 'in_use'
  if (v === 'в эксплуатации') return 'in_use'
  if (v === 'на складе') return 'in_stock'
  if (v === 'в ремонте') return 'in_repair'
  if (v === 'на списание') return 'to_writeoff'
  return v
}
function badgeCls(status?: string){
  const v = normStatus(status)
  return v==='in_use' ? 'badge badge-green' : v==='in_stock' ? 'badge badge-yellow' : v==='in_repair' ? 'badge badge-blue' : 'badge badge-red'
}
const statusRu: Record<string,string> = { in_use: 'В эксплуатации', in_stock: 'На складе', in_repair: 'В ремонте', written_off: 'Списано', to_writeoff: 'На списание' }

export default function EquipmentDetail(){
  const { id } = useParams()
  const nav = useNavigate()
  const { showToast } = useToast()
  const { user } = useAuth()
  const role = user?.role || 'USER'
  const canEdit = role === 'ADMIN' || role === 'EDITOR'
  const canDelete = role === 'ADMIN'
  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<any>(null)
  const [tab, setTab] = useState<'main'|'moves'|'service'|'docs'>('main')
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmReturn, setConfirmReturn] = useState(false)
  const [returning, setReturning] = useState(false)

  

  async function load(){
    if (!id) return
    setLoading(true)
    try {
      const res = await api.get(`/equipment/${id}`)
      setItem(res.data || res)
    } catch {
      showToast('Не удалось загрузить оборудование', 'error')
    } finally { setLoading(false) }
  }

  async function doReturn(){
    if (!id) return
    try{
      setReturning(true)
      await api.put(`/equipment/${id}`, { status: 'in_stock' })
      showToast('Возвращено на склад', 'success')
      setConfirmReturn(false)
      await load()
    }catch{
      showToast('Не удалось вернуть на склад', 'error')
    } finally {
      setReturning(false)
    }
  }
  useEffect(()=>{ load() }, [id])

  async function remove(){
    if (!id) return
    try {
      setDeleting(true)
      await api.delete(`/equipment/${id}`)
      showToast('Удалено', 'success')
      nav('/')
    } catch { showToast('Не удалось удалить', 'error') } finally { setDeleting(false) }
  }
  async function submitEdit(v: EquipmentInput){
    if (!id) return
    try{
      setSaving(true)
      await api.put(`/equipment/${id}`, v)
      showToast('Изменения сохранены', 'success')
      setEditing(false)
      await load()
    }catch{ showToast('Не удалось сохранить', 'error') } finally { setSaving(false) }
  }

  return (
    <div className="max-w-5xl mx-auto grid gap-4 px-2 md:px-0">
      <div className="surface p-4 sticky top-14 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              <Tooltip text={item?.name || '—'}>
                <span className="truncate inline-block max-w-[90%] align-bottom">{item?.name || '—'}</span>
              </Tooltip>
            </h1>
            <div className="text-[13px] text-slate-600 mt-1 flex items-center gap-3">
              <span>
                <Tooltip text="Формат: буквенно-цифровой, до 32 символов"><span className="underline decoration-dotted cursor-help">Серийный</span></Tooltip>:
                <span className="text-slate-800 ml-1">{item?.serialNumber || '—'}</span>
              </span>
              <span>Статус: <span className={badgeCls(item?.status)}>{statusRu[normStatus(item?.status)] || (item?.status || '—')}</span></span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 opacity-0 select-none">
            {/* Actions moved to bottom bar */}
            <button className="btn" disabled><ArrowLeft className="h-4 w-4"/> Назад</button>
            <button className="btn" disabled>Редактировать</button>
            <button className="btn" disabled>Удалить</button>
          </div>
        </div>
      </div>

      <div className="surface p-0">
        <div className="px-4 pt-3 border-b bg-white/60 dark:bg-slate-900/60 backdrop-blur rounded-t-xl">
          <div className="flex gap-1">
            <TabButton active={tab==='main'} onClick={()=>setTab('main')}>Основное</TabButton>
            <TabButton active={tab==='moves'} onClick={()=>setTab('moves')}>История перемещений</TabButton>
            <TabButton active={tab==='service'} onClick={()=>setTab('service')}>Сервис</TabButton>
            <TabButton active={tab==='docs'} onClick={()=>setTab('docs')}>Документы</TabButton>
          </div>
        </div>
        <div className="p-4">
          {tab==='main' && <MainTab item={item} loading={loading} />}
          {tab==='moves' && <MovesTab id={id!} name={item?.name} />}
          {tab==='service' && <ServiceTab id={id!} />}
          {tab==='docs' && <DocsTab id={id!} />}
        </div>
      </div>

      {/* Bottom actions bar */}
      <div className="surface p-3 md:p-4 flex flex-col md:flex-row gap-2 md:justify-end">
        <button onClick={()=>nav(-1)} className="btn inline-flex items-center justify-center gap-2">
          <ArrowLeft className="h-4 w-4"/> Назад
        </button>
        {canEdit && (
          <button onClick={()=>setConfirmReturn(true)} disabled={saving||deleting||returning} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white shadow-md disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            ⬅️ В склад
          </button>
        )}
        {canEdit && (
          <button onClick={()=>setEditing(true)} disabled={saving||deleting} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white shadow-md disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-colors">
            <Pencil className="h-4 w-4"/>
            {saving ? 'Сохранение…' : 'Редактировать'}
          </button>
        )}
        {canDelete && (
          <button disabled={saving||deleting} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md disabled:opacity-60 disabled:cursor-not-allowed transition-colors" onClick={()=>setConfirmDel(true)}>
            <Trash2 className="h-4 w-4"/>
            {deleting ? 'Удаление…' : 'Удалить'}
          </button>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <motion.div initial={{opacity:0, scale:0.96}} animate={{opacity:1, scale:1}} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">Редактировать оборудование</div>
              <button className="btn" onClick={()=>setEditing(false)}>Закрыть</button>
            </div>
            <EquipmentForm
              initial={item ? {
                name: item.name,
                category: item.category,
                serialNumber: item.serialNumber ?? undefined,
                inventoryNumber: item.inventoryNumber ?? undefined,
                purchaseDate: item.purchaseDate ? String(item.purchaseDate).substring(0,10) : undefined,
                cost: item.cost ? Number(item.cost as any) : undefined,
                location: item.location ?? undefined,
                responsible: item.responsible ?? undefined,
                status: item.status,
                note: item.note ?? undefined,
              } : undefined}
              onSubmit={submitEdit}
              onCancel={()=>setEditing(false)}
            />
          </motion.div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <motion.div initial={{opacity:0, scale:0.96}} animate={{opacity:1, scale:1}} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md p-4">
            <div className="text-lg font-semibold mb-1">Удалить оборудование?</div>
            <div className="text-sm text-slate-600 mb-4">Это действие необратимо.</div>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={()=>setConfirmDel(false)}>Отмена</button>
              <button className="btn" onClick={()=>{ setConfirmDel(false); remove() }}>Удалить</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

function TabButton({ active, children, onClick }:{ active:boolean, children:React.ReactNode, onClick: ()=>void }){
  return (
    <button onClick={onClick}
      className={`px-3 py-2 rounded-t-lg text-sm border-b-2 ${active ? 'border-blue-600 text-slate-900 bg-slate-50 dark:bg-slate-800' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600'} transition-colors`}>{children}</button>
  )
}

function Row({ label, children }:{ label:React.ReactNode, children:React.ReactNode }){
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
      <div className="font-medium text-[13px] text-slate-700">{label}</div>
      <div className="md:col-span-2 text-[13px] md:text-[14px] text-slate-900 dark:text-slate-100 break-words">{children}</div>
    </div>
  )
}

function Section({ title, children }:{ title:string, children:React.ReactNode }){
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 md:p-4 bg-white/60 dark:bg-slate-900/40">
      <div className="text-[16px] font-semibold mb-2 text-slate-900 dark:text-slate-100">{title}</div>
      <div className="grid gap-3">
        {children}
      </div>
    </div>
  )
}

function MainTab({ item, loading }:{ item:any, loading:boolean }){
  if (loading) return (
    <div className="grid gap-3">
      {Array.from({length:8}).map((_,i)=> (
        <div key={i} className="h-5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>
      ))}
    </div>
  )
  if (!item) return <div className="text-sm text-slate-600">Нет данных</div>
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}}>
      <div className="grid gap-4">
        <Section title="Общие данные">
          <Row label="Наименование"><Tooltip text={item.name || '—'}><span className="truncate inline-block max-w-full align-bottom">{item.name || '—'}</span></Tooltip></Row>
          <Row label="Статус"><span className={`font-semibold ${badgeCls(item.status)}`}>{statusRu[normStatus(item.status)] || (item.status || '—')}</span></Row>
          <Row label={<span className="inline-flex items-center gap-1"><Tooltip text="Формат: буквенно-цифровой, до 32 символов"><span className="underline decoration-dotted cursor-help">Серийный номер</span></Tooltip></span> as any}>{item.serialNumber || '—'}</Row>
          <Row label={<span className="inline-flex items-center gap-1"><Tooltip text="Формат: буквенно-цифровой, до 16 символов"><span className="underline decoration-dotted cursor-help">Инвентарный номер</span></Tooltip></span> as any}>{item.inventoryNumber || '—'}</Row>
          <Row label="Дата ввода">{item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString('ru-RU') : '—'}</Row>
          <Row label="Стоимость"><span className="font-semibold text-slate-900">{item.cost ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(item.cost)) : '—'}</span></Row>
        </Section>
        <Section title="Технические характеристики">
          <Row label="Модель">{(item as any).model || '—'}</Row>
        </Section>
        <Section title="Ответственность и местоположение">
          <Row label="Ответственный"><Tooltip text={item.responsible || '—'}><span className="truncate inline-block max-w-full align-bottom">{item.responsible || '—'}</span></Tooltip></Row>
          <Row label="Местоположение"><Tooltip text={item.location || '—'}><span className="truncate inline-block max-w-full align-bottom">{item.location || '—'}</span></Tooltip></Row>
        </Section>
        <Section title="Примечание">
          <Row label="Комментарий"><Tooltip text={item.note || '—'}><span className="truncate inline-block max-w-full align-bottom">{item.note || '—'}</span></Tooltip></Row>
        </Section>
      </div>
    </motion.div>
  )
}

function MovesTab({ id, name }:{ id:string, name?: string }){
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(()=>{
    (async()=>{
      setLoading(true)
      try{
        const res = await api.get('/warehouse/movements')
        const all = res.data.items || res.data || []
        setRows(name ? all.filter((r:any)=> (r.itemName||'').toLowerCase() === String(name).toLowerCase()) : all)
      }catch{} finally{ setLoading(false) }
    })()
  },[id, name])
  return (
    <div className="overflow-auto">
      <table className="w-full table-auto text-sm">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            <th className="text-left p-2">Дата</th>
            <th className="text-left p-2">Откуда</th>
            <th className="text-left p-2">Куда</th>
            <th className="text-left p-2">Кто</th>
            <th className="text-left p-2">Комментарий</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={5} className="p-3 text-slate-600">Загрузка...</td></tr>}
          {!loading && rows.length===0 && <tr><td colSpan={5} className="p-3 text-slate-500">Нет перемещений</td></tr>}
          {!loading && rows.map((r:any)=>(
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.createdAt ? new Date(r.createdAt).toLocaleString('ru-RU') : '—'}</td>
              <td className="p-2">{r.from || '—'}</td>
              <td className="p-2">{r.to || '—'}</td>
              <td className="p-2">{r.user?.name || r.userName || '—'}</td>
              <td className="p-2">{r.note || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ServiceTab({ id }:{ id:string }){
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(()=>{ setRows([]) },[id])
  return (
    <div className="text-sm text-slate-600">Нет данных о сервисе</div>
  )
}

function DocsTab({ id }:{ id:string }){
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <button className="btn">📎 Добавить документ</button>
      </div>
      <div className="text-sm text-slate-600">Документы не прикреплены</div>
    </div>
  )
}
