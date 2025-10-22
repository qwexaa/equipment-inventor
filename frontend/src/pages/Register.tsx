import { useForm } from 'react-hook-form'
import { useAuth } from '../state/useAuth'
import { useNavigate, Link } from 'react-router-dom'

type Form = { name: string; email: string; password: string }

export default function Register() {
  const { register: reg, handleSubmit } = useForm<Form>()
  const { register: registerFn } = useAuth()
  const nav = useNavigate()
  async function onSubmit(v: Form) {
    await registerFn(v.name, v.email, v.password)
    nav('/')
  }
  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
      <h1 className="text-xl font-semibold mb-4">Регистрация</h1>
      <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
        <input className="input" placeholder="Имя" {...reg('name')} />
        <input className="input" placeholder="Email" {...reg('email')} />
        <input className="input" type="password" placeholder="Пароль" {...reg('password')} />
        <button className="px-3 py-2 bg-blue-600 text-white rounded" type="submit">Создать</button>
      </form>
      <div className="mt-3 text-sm">Уже есть аккаунт? <Link to="/login" className="text-blue-600">Войти</Link></div>
    </div>
  )
}
