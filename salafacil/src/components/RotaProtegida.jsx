import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function RotaProtegida() {
  const { autenticado, perfilCompleto, carregando } = useAuth()

  if (carregando) return <TelaCarregando />
  if (!autenticado) return <Navigate to="/entrar" replace />
  if (!perfilCompleto) return <Navigate to="/entrar" replace />

  return <Outlet />
}

export function RotaAdmin() {
  const { usuario, carregando } = useAuth()

  if (carregando) return <TelaCarregando />
  if (usuario?.role !== 'admin') return <Navigate to="/" replace />

  return <Outlet />
}

function TelaCarregando() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Carregando...
    </div>
  )
}
