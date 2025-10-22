import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, Users, Palette, Bell, Import as ImportIcon, Database } from 'lucide-react'
import { useAuth } from '../state/useAuth'
import AdminUsers from './AdminUsers'
import ImportExport from './ImportExport'
type CategoryKey = 'general'|'users'|'appearance'|'notifications'|'import'|'system'

export default function SettingsPage() {
  const [active, setActive] = useState<CategoryKey>('general')
  const { user } = useAuth()
  const isAdmin = (user?.role === 'ADMIN')
  const categories = useMemo(() => {
    const base = [
      { key: 'general' as const, label: 'Общие', icon: Settings },
      { key: 'appearance' as const, label: 'Темы и внешний вид', icon: Palette },
      { key: 'notifications' as const, label: 'Уведомления', icon: Bell },
      { key: 'import' as const, label: 'Импорт / Экспорт', icon: ImportIcon },
      { key: 'system' as const, label: 'Система', icon: Database },
    ]
    return isAdmin ? [{ key: 'users' as const, label: 'Пользователи и роли', icon: Users }, ...base] : base
  }, [isAdmin])

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Настройки системы</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Sidebar */}
        <aside className="lg:col-span-3 xl:col-span-3">
          <nav className="surface p-2">
            <ul className="grid">
              {categories.map(({ key, label, icon: Icon }) => (
                <li key={key}>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${active===key ? 'bg-slate-50 dark:bg-slate-800 font-medium' : ''}`}
                    onClick={() => setActive(key)}
                  >
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Content */}
        <section className="lg:col-span-9 xl:col-span-9">
          {active === 'general' && <GeneralSection />}
          {active === 'users' && isAdmin && <UsersSection />}
          {active === 'appearance' && <AppearanceSection />}
          {active === 'notifications' && <NotificationsSection />}
          {active === 'import' && <ImportExportSection />}
          {active === 'system' && <SystemSection />}
        </section>
      </div>
    </div>
  )
}

function Section({ title, description, children, showSave = true }:{ title:string, description?:string, children:React.ReactNode, showSave?: boolean }){
  return (
    <div className="surface p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (<p className="text-sm text-slate-600 mt-1">{description}</p>)}
      </div>
      <div className="grid gap-4">
        {children}
      </div>
      {showSave && (
        <div className="mt-6 flex justify-end">
          <button className="btn-primary">Сохранить изменения</button>
        </div>
      )}
    </div>
  )
}

function GeneralSection(){
  return (
    <Section title="Общие" description="Основные параметры системы">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Название системы</label>
          <input className="input w-full" placeholder="Например, Инвентаризация оборудования" />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Язык интерфейса</label>
          <select className="input w-full">
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Часовой пояс</label>
          <select className="input w-full">
            <option value="UTC+03:00">UTC+03:00 (Москва)</option>
            <option value="UTC+04:00">UTC+04:00</option>
            <option value="UTC+05:00">UTC+05:00</option>
          </select>
        </div>
      </div>
    </Section>
  )
}

function UsersSection(){
  return (
    <Section title="Пользователи и роли" description="Управление пользователями и их доступом" showSave={false}>
      <AdminUsers />
    </Section>
  )
}

function AppearanceSection(){
  return (
    <Section title="Темы и внешний вид" description="Настройте внешний вид интерфейса">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="flex items-center justify-between surface p-3">
          <div>
            <div className="font-medium">Тёмная тема</div>
            <div className="text-sm text-slate-600">Переключить светлую/тёмную тему</div>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
          </label>
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Цветовая схема</label>
          <select className="input w-full">
            <option value="blue">Синяя (по умолчанию)</option>
            <option value="green">Зелёная</option>
            <option value="indigo">Индиго</option>
          </select>
        </div>
      </div>
    </Section>
  )
}

function NotificationsSection(){
  return (
    <Section title="Уведомления" description="Управляйте уведомлениями о событиях">
      <div className="grid gap-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-4 w-4" />
          <span>Email при добавлении оборудования</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-4 w-4" />
          <span>Email при списании оборудования</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-4 w-4" />
          <span>Push при изменении ответственного</span>
        </label>
      </div>
    </Section>
  )
}

function ImportExportSection(){
  return (
    <Section title="Импорт / Экспорт" description="Операции с данными" showSave={false}>
      <ImportExport />
    </Section>
  )
}

function SystemSection(){
  return (
    <Section title="Система" description="Информация о приложении и служебные действия">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="surface p-3">
          <div className="text-sm text-slate-600">Версия приложения</div>
          <div className="text-lg font-semibold">v1.0.0</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn">Проверить обновления</button>
          <button className="btn">Сбросить настройки</button>
        </div>
      </div>
    </Section>
  )
}
