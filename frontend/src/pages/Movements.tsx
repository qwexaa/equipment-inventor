import { useEffect, useState } from 'react'
import api from '../state/api'

type Movement = {
  id: number
  datetime: string
  user: string
  action: string
  itemName: string
  quantity: number
  fromTable?: string | null
  toTable?: string | null
  note?: string | null
}

export default function Movements() {
  const [items, setItems] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  async function load(){
    setLoading(true)
    try{
      const params: any = {}
      if (action) params.action = action
      if (from) params.from = from
      if (to) params.to = to
      const r = await api.get('/warehouse/movements', { params })
      setItems(r.data.items || [])
    } finally { setLoading(false) }
  }

  useEffect(()=>{ load() }, [])
  useEffect(()=>{ const t = setTimeout(load, 250); return ()=>clearTimeout(t) }, [action, from, to])

  function badgeCls(a: string){
    const v = a.toLowerCase()
    if (v.includes('добав')) return 'bg-green-100 text-green-800 border-green-200'
    if (v.includes('перенос') || v.includes('transfer') || v.includes('инвентар')) return 'bg-blue-100 text-blue-800 border-blue-200'
    if (v.includes('удален') || v.includes('delete') || v.includes('спис')) return 'bg-red-100 text-red-800 border-red-200'
    return 'bg-slate-100 text-slate-800 border-slate-200'
  }

  function fmtDate(d: string){ try{ return new Date(d).toLocaleString('ru-RU') } catch { return d } }
  function ruPlace(k?: string | null){
    const v = (k||'').toLowerCase()
    if (!v) return '—'
    if (v === 'warehouse') return 'Склад'
    if (v === 'inventory') return 'Инвентаризация'
    return k || '—'
  }

  return (
    <div className="grid gap-4">
      <div className="surface p-4 flex flex-wrap gap-2 items-center">
        <input className="input" placeholder="Действие (например, Перенос)" value={action} onChange={e=>setAction(e.target.value)} />
        <input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)} />
        <input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)} />
        <div className="flex-1"/>
        <button onClick={load} className="btn">Обновить</button>
      </div>

      <div className="overflow-hidden surface">
        <table className="w-full table-auto text-sm">
          <thead className="bg-gray-100 dark:bg-slate-800 sticky top-0 z-10">
            <tr>
              <th className="text-left p-2">Дата</th>
              <th className="text-left p-2">Пользователь</th>
              <th className="text-left p-2">Действие</th>
              <th className="text-left p-2">Оборудование</th>
              <th className="text-left p-2">Кол-во</th>
              <th className="text-left p-2">Откуда → Куда</th>
              <th className="text-left p-2">Примечание</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="p-2" colSpan={7}>Загрузка…</td></tr>
            )}
            {!loading && items.map(it=> (
              <tr key={it.id} className="border-t">
                <td className="p-2 whitespace-nowrap">{fmtDate(it.datetime)}</td>
                <td className="p-2 truncate max-w-[220px]" title={it.user}>{it.user}</td>
                <td className="p-2">
                  <span className={`inline-flex items-center gap-1 border rounded-lg px-2 py-0.5 text-xs ${badgeCls(it.action)}`}>{it.action}</span>
                </td>
                <td className="p-2 truncate max-w-[360px]" title={it.itemName}>{it.itemName}</td>
                <td className="p-2">{it.quantity}</td>
                <td className="p-2">{ruPlace(it.fromTable)} → {ruPlace(it.toTable)}</td>
                <td className="p-2 truncate max-w-[360px]" title={it.note||'—'}>{it.note||'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
