import { useEffect, useState } from 'react'
import api from '../state/api'
import { useToast } from '../components/ToastProvider'

export type User = { id:number; email:string; name:string; role:'ADMIN'|'EDITOR'|'VIEWER'|'USER'; createdAt?:string }

type CreateForm = { email:string; name:string; role:'ADMIN'|'EDITOR'|'VIEWER'|'USER'; password?:string }

export default function AdminUsers() {
  const [items, setItems] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<CreateForm>({ email:'', name:'', role:'USER' })
  const { showToast } = useToast()

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/admin/users', { params: { q, limit: pageSize, offset: (page-1)*pageSize } })
      setItems(res.data.items || [])
      setTotal(res.data.total || 0)
    } catch {
      showToast('Ошибка загрузки пользователей', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { const t=setTimeout(load, 300); return ()=>clearTimeout(t) }, [q])
  useEffect(() => { load() }, [page])

  async function createUser() {
    if (!form.email || !form.name) return
    try {
      const res = await api.post('/admin/users', form)
      setCreating(false)
      setForm({ email:'', name:'', role:'USER' })
      const temp = res.data?.tempPassword
      showToast(temp ? `Создан пользователь. Временный пароль: ${temp}` : 'Пользователь создан', 'success')
      await load()
    } catch {
      showToast('Не удалось создать пользователя', 'error')
    }
  }

  async function changeRole(u: User, role: 'ADMIN'|'EDITOR'|'VIEWER'|'USER') {
    try {
      await api.patch(`/admin/users/${u.id}`, { role })
      showToast('Роль обновлена', 'success')
      await load()
    } catch { showToast('Не удалось обновить роль', 'error') }
  }

  async function resetPassword(u: User) {
    try {
      const res = await api.post(`/admin/users/${u.id}/reset-password`)
      const temp = res.data?.tempPassword
      showToast(temp ? `Новый временный пароль: ${temp}` : 'Пароль сброшен', 'success')
    } catch { showToast('Не удалось сбросить пароль', 'error') }
  }

  async function deleteUser(u: User) {
    if (!confirm(`Удалить пользователя ${u.email}?`)) return
    try {
      await api.delete(`/admin/users/${u.id}`)
      showToast('Пользователь удалён', 'success')
      await load()
    } catch (e:any) {
      showToast(e?.response?.data?.error || 'Не удалось удалить пользователя', 'error')
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="grid gap-4">
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-xl p-4 flex gap-2 items-center">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск" className="input w-60" />
        <div className="flex-1" />
        <button onClick={()=>setCreating(true)} className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-4 py-2 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg">Создать пользователя</button>
      </div>

      <div className="overflow-x-auto bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 dark:bg-slate-800">
            <tr>
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Имя</th>
              <th className="text-left p-2">Роль</th>
              <th className="text-left p-2">Создан</th>
              <th className="text-right p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({length: 8}).map((_,i)=> (
              <tr key={`s${i}`} className="border-t animate-pulse">
                <td className="p-2">&nbsp;</td>
                <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-40"/></td>
                <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32"/></td>
                <td className="p-2"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20"/></td>
                <td className="p-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"/></td>
                <td className="p-2 text-right"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24 ml-auto"/></td>
              </tr>
            ))}
            {!loading && items.map((u, idx) => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{(page-1)*pageSize + idx + 1}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.name}</td>
                <td className="p-2">
                  <select className="input" value={u.role} onChange={e=>changeRole(u, e.target.value as any)}>
                    <option value="VIEWER">VIEWER</option>
                    <option value="EDITOR">EDITOR</option>
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="p-2">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('ru-RU') : '—'}</td>
                <td className="p-2 text-right">
                  <button onClick={()=>resetPassword(u)} className="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 mr-1">Сбросить пароль</button>
                  <button onClick={()=>deleteUser(u)} className="px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">Удалить</button>
                </td>
              </tr>
            ))}
            {!loading && items.length===0 && (
              <tr><td className="p-6 text-center text-slate-500" colSpan={6}>Пользователи не найдены</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-4 grid gap-3">
            <div className="text-lg font-semibold">Создать пользователя</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Email</label>
                <input className="input w-full" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Имя</label>
                <input className="input w-full" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Роль</label>
                <select className="input w-full" value={form.role} onChange={e=>setForm(f=>({...f, role:e.target.value as any}))}>
                  <option value="VIEWER">VIEWER</option>
                  <option value="EDITOR">EDITOR</option>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Пароль (необязательно)</label>
                <input className="input w-full" value={form.password||''} onChange={e=>setForm(f=>({...f, password:e.target.value||undefined}))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={()=>setCreating(false)}>Отмена</button>
              <button className="btn-primary" onClick={createUser} disabled={!form.email || !form.name}>Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
