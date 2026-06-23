import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { RotaProtegida, RotaAdmin } from './components/RotaProtegida'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import SalaAgenda from './pages/SalaAgenda'
import MeusAgendamentos from './pages/MeusAgendamentos'
import AdminSalas from './pages/admin/AdminSalas'
import AdminUsuarios from './pages/admin/AdminUsuarios'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/entrar" element={<Auth />} />

          <Route element={<RotaProtegida />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/salas/:id" element={<SalaAgenda />} />
              <Route path="/meus-agendamentos" element={<MeusAgendamentos />} />

              <Route element={<RotaAdmin />}>
                <Route path="/admin/salas" element={<AdminSalas />} />
                <Route path="/admin/usuarios" element={<AdminUsuarios />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
