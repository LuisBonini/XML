import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const linksBase = [
  { to: '/', label: 'Salas' },
  { to: '/meus-agendamentos', label: 'Meus agendamentos' },
]

const linksAdmin = [
  { to: '/admin/salas', label: 'Gerenciar salas' },
  { to: '/admin/usuarios', label: 'Usuários' },
]

export default function Layout() {
  const { usuario, empresa, sair } = useAuth()
  const links = usuario?.role === 'admin' ? [...linksBase, ...linksAdmin] : linksBase
  const corPrimaria = empresa?.cor_primaria || '#2563eb'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: corPrimaria }}
            >
              {empresa?.nome?.[0]?.toUpperCase() || 'S'}
            </div>
            <span className="font-semibold text-slate-900">{empresa?.nome || 'SalaFácil'}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span className="hidden sm:inline">{usuario?.nome}</span>
            <button onClick={sair} className="text-slate-500 hover:text-slate-800">
              Sair
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
