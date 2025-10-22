import { useForm } from 'react-hook-form'
import { useAuth } from '../state/useAuth'
import { useNavigate, Link } from 'react-router-dom'

type Form = { email: string; password: string }

export default function Login() {
  const { register, handleSubmit } = useForm<Form>()
  const { login } = useAuth()
  const nav = useNavigate()
  async function onSubmit(v: Form) {
    await login(v.email, v.password)
    nav('/')
  }
  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
      <h1 className="text-xl font-semibold mb-4">Вход</h1>
      <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
        <input className="input" placeholder="Email" {...register('email')} />
        <input className="input" type="password" placeholder="Пароль" {...register('password')} />
        <button className="px-3 py-2 bg-blue-600 text-white rounded" type="submit">Войти</button>
      </form>
      <div className="mt-3 text-sm">Нет аккаунта? <Link to="/register" className="text-blue-600">Регистрация</Link></div>
    </div>
  )
}
