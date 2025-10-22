import api from '../state/api'
import { useEffect, useState } from 'react'
import { useToast } from '../components/ToastProvider'
import { motion, AnimatePresence } from 'framer-motion'

export default function ImportExport() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<any>(null)
  const [actOpen, setActOpen] = useState(false)
  const [equip, setEquip] = useState<any[]>([])
  const [form, setForm] = useState<{equipmentId?: number, transferTo: string, transferDepartment?: string, transferDate: string, returnDate?: string, note?: string}>({ transferTo: '', transferDate: new Date().toISOString().slice(0,10) })
  const { showToast } = useToast()

  useEffect(() => {
    if (!actOpen) return
    (async () => {
      const res = await api.get('/equipment', { params: { limit: 100 } })
      setEquip(res.data.items || res.data || [])
    })()
  }, [actOpen])

  async function doImport() {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await api.post('/import-export/import', form, { headers: { 'Content-Type': 'multipart/form-data' }})
      setResult(res.data)
      showToast('Импорт завершён', 'success')
    } catch {
      showToast('Ошибка импорта', 'error')
    }
  }

  async function doExport() {
    try {
      const res = await api.get('/import-export/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = 'equipment.xlsx'; a.click()
      window.URL.revokeObjectURL(url)
      showToast('Экспорт оборудования готов', 'success')
    } catch { showToast('Ошибка экспорта', 'error') }
  }

  async function doReport() {
    try {
      const res = await api.get('/import-export/report', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = 'report.xlsx'; a.click()
      window.URL.revokeObjectURL(url)
      showToast('Экспорт отчёта готов', 'success')
    } catch { showToast('Ошибка экспорта отчёта', 'error') }
  }

  async function generateAct() {
    if (!form.equipmentId || !form.transferTo) return
    try {
      const res = await api.post('/docs/transfer', form, { responseType: 'blob' as any })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      const name = equip.find(e=>e.id===form.equipmentId)?.name || 'акт'
      a.href = url; a.download = `Акт_${name}.docx`; a.click()
      window.URL.revokeObjectURL(url)
      setActOpen(false)
      showToast('Акт сформирован', 'success')
    } catch { showToast('Ошибка формирования акта', 'error') }
  }

  return (
    <div className="grid gap-4">
      <div className="surface p-4 grid gap-3">
        <h2 className="text-lg font-semibold">Импорт из Excel/CSV</h2>
        <input type="file" onChange={e=>setFile(e.target.files?.[0] || null)} />
        <button onClick={doImport} className="w-fit btn-primary inline-flex items-center gap-2">Импортировать</button>
        {result && (
          <div className="text-sm text-gray-700">Создано: {result.created}, Обновлено: {result.updated}, Ошибок: {result.errorsCount}</div>
        )}
      </div>

      <div className="surface p-4 flex gap-3">
        <button onClick={doExport} className="btn">Экспорт оборудования</button>
        <button onClick={doReport} className="btn">Экспорт отчёта</button>
        <button onClick={()=>setActOpen(true)} className="btn">Сформировать акт</button>
      </div>

      <AnimatePresence>
      {actOpen && (
        <motion.div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
          <motion.div initial={{scale:0.96, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.96, opacity:0}} transition={{type:'spring', stiffness:260, damping:20}} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl p-4 grid gap-3">
            <div className="text-lg font-semibold">Акт приёма-передачи</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Оборудование</label>
                <select className="input w-full" value={form.equipmentId||''} onChange={e=>setForm(f=>({...f, equipmentId: Number(e.target.value)||undefined}))}>
                  <option value="">Выберите...</option>
                  {equip.map(e=> (
                    <option key={e.id} value={e.id}>{e.name} {e.inventoryNumber?`(инв. ${e.inventoryNumber})`:''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Кому передан</label>
                <input className="input w-full" value={form.transferTo} onChange={e=>setForm(f=>({...f, transferTo: e.target.value}))} placeholder="ФИО/подразделение" />
              </div>
              <div>
                <label className="text-sm text-gray-600">Подразделение получателя</label>
                <input className="input w-full" value={form.transferDepartment||''} onChange={e=>setForm(f=>({...f, transferDepartment: e.target.value||undefined}))} placeholder="Название подразделения" />
              </div>
              <div>
                <label className="text-sm text-gray-600">Дата передачи</label>
                <input type="date" className="input w-full" value={form.transferDate} onChange={e=>setForm(f=>({...f, transferDate: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Дата возврата</label>
                <input type="date" className="input w-full" value={form.returnDate||''} onChange={e=>setForm(f=>({...f, returnDate: e.target.value||undefined}))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Примечание</label>
                <input className="input w-full" value={form.note||''} onChange={e=>setForm(f=>({...f, note: e.target.value||undefined}))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={()=>setActOpen(false)}>Отмена</button>
              <button className="btn-primary" onClick={generateAct} disabled={!form.equipmentId || !form.transferTo}>Скачать DOCX</button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}
