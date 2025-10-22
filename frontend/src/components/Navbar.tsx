import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../state/useAuth'
import { Package, LogOut, Moon, Sun } from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [dark, setDark] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark'
  })
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const Tab = ({ to, children }:{ to:string, children:React.ReactNode }) => (
    <Link to={to} className={`relative text-sm px-3 py-1.5 rounded-lg transition-colors transform-gpu ${loc.pathname===to ? 'text-indigo-600 font-semibold drop-shadow-sm' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 hover:scale-105'}`}>
      {children}
      <span className={`absolute left-2 right-2 -bottom-0.5 h-0.5 rounded-full bg-indigo-600 transition-opacity ${loc.pathname===to ? 'opacity-100' : 'opacity-0'}`}/>
    </Link>
  )
  return (
    <nav className={`sticky top-0 z-50 backdrop-blur-lg supports-backdrop-blur:bg-white/60 bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 ${scrolled ? 'shadow-sm' : ''}`}>
      <div className="w-full max-w-none px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-indigo-600" />
          <Link to="/" className="font-semibold text-slate-800 dark:text-slate-100">Инвентаризация оборудования</Link>
          {user && (
            <div className="ml-4 hidden sm:flex items-center gap-2">
              <Tab to="/">Оборудование</Tab>
              <Tab to="/warehouse">Склад</Tab>
              <Tab to="/movements">История</Tab>
              <Tab to="/settings">Настройки</Tab>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="theme" onClick={()=>setDark(v=>!v)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {user ? (
            <>
              <span className="text-sm text-slate-600 dark:text-slate-300 hidden sm:block">{user.name}</span>
              <button className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700" onClick={() => { logout(); nav('/login') }}>
                <LogOut className="h-4 w-4" /> Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm">Вход</Link>
              <Link to="/register" className="text-sm">Регистрация</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
