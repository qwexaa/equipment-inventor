import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status
    if (status === 401) {
      try { localStorage.removeItem('token') } catch {}
      // Redirect to login preserving intended path
      if (typeof window !== 'undefined') {
        const loc = window.location
        const ret = encodeURIComponent(loc.pathname + loc.search)
        if (!loc.pathname.startsWith('/login')) {
          window.location.href = `/login?returnTo=${ret}`
        }
      }
    }
    return Promise.reject(err)
  }
)

export default api
