import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SalaAgenda from './SalaAgenda'
import { supabase } from '../lib/supabaseClient'
import { buscarReservasDoDia } from '../utils/reservas'
import { useAuth } from '../contexts/AuthContext'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('../utils/reservas', async () => {
  const actual = await vi.importActual('../utils/reservas')
  return { ...actual, buscarReservasDoDia: vi.fn() }
})

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'sala-1' }),
  }
})

const sala = { id: 'sala-1', nome: 'Sala Azul', andar: '2º andar', capacidade: 6 }

function mockSalaQuery() {
  supabase.from.mockImplementation(() => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      single: () => Promise.resolve({ data: sala, error: null }),
    }
    return builder
  })
}

function renderAgenda() {
  return render(
    <MemoryRouter>
      <SalaAgenda />
    </MemoryRouter>
  )
}

describe('SalaAgenda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSalaQuery()
    useAuth.mockReturnValue({ usuario: { id: 'usuario-1', empresa_id: 'empresa-1', nome: 'Maria' } })
  })

  it('mostra os horários disponíveis e os ocupados por uma reserva existente', async () => {
    buscarReservasDoDia.mockResolvedValue([
      { id: 'r1', hora_inicio: '09:00', hora_fim: '10:00', motivo: 'Reunião de vendas', usuario_nome: 'Maria' },
    ])

    renderAgenda()

    expect(await screen.findByText('Sala Azul')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /09:00.*Reunião de vendas/s })).toBeDisabled()
    expect(screen.getByRole('button', { name: /08:00.*Disponível/s })).toBeEnabled()
  })

  it('abre o modal de nova reserva ao clicar em um horário disponível', async () => {
    buscarReservasDoDia.mockResolvedValue([])
    const user = userEvent.setup()

    renderAgenda()

    await screen.findByText('Sala Azul')
    await user.click(screen.getByRole('button', { name: /08:00.*Disponível/s }))

    expect(await screen.findByText('Confirmar reserva')).toBeInTheDocument()
  })

  it('redireciona para /app quando a sala não é encontrada', async () => {
    supabase.from.mockImplementation(() => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
      }
      return builder
    })
    buscarReservasDoDia.mockResolvedValue([])

    renderAgenda()

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app'))
  })
})
