import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Login from './pages/Login'
import Register from './pages/Register'
import EquipmentList from './pages/EquipmentList'
import Movements from './pages/Movements'
import WarehousePage from './pages/WarehousePage'
import { useAuth } from './state/useAuth'
import Navbar from './components/Navbar'
import SettingsPage from './pages/Settings'
import EquipmentDetail from './pages/EquipmentDetail'

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { token } = useAuth()
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Navbar />
      <div className="w-full px-2 py-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <Routes>
            <Route path="/login" element={token ? <Navigate to="/" /> : <Login />} />
            <Route path="/register" element={token ? <Navigate to="/" /> : <Register />} />
            <Route path="/" element={<PrivateRoute><EquipmentList /></PrivateRoute>} />
            <Route path="/warehouse" element={<PrivateRoute><WarehousePage /></PrivateRoute>} />
            <Route path="/movements" element={<PrivateRoute><Movements /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
            <Route path="/equipment/:id" element={<PrivateRoute><EquipmentDetail /></PrivateRoute>} />
            <Route path="/import" element={<Navigate to="/settings" replace />} />
            <Route path="/admin/users" element={<Navigate to="/settings" replace />} />
            <Route path="*" element={<div className="text-center mt-10">Страница не найдена. <Link to="/" className="text-blue-600">Домой</Link></div>} />
          </Routes>
        </motion.div>
      </div>
    </div>
  )
}
