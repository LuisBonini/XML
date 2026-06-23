import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { RotaProtegida, RotaAdmin } from './components/RotaProtegida'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import SalaAgenda from './pages/SalaAgenda'
import MeusAgendamentos from './pages/MeusAgendamentos'
import AdminSalas from './pages/admin/AdminSalas'
import AdminUsuarios from './pages/admin/AdminUsuarios'
import AdminConfiguracoes from './pages/admin/AdminConfiguracoes'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/entrar" element={<Auth />} />

          <Route element={<RotaProtegida />}>
            <Route path="/app" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="salas/:id" element={<SalaAgenda />} />
              <Route path="meus-agendamentos" element={<MeusAgendamentos />} />

              <Route element={<RotaAdmin />}>
                <Route path="admin/salas" element={<AdminSalas />} />
                <Route path="admin/usuarios" element={<AdminUsuarios />} />
                <Route path="admin/configuracoes" element={<AdminConfiguracoes />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
