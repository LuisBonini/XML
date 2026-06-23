import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NovaReservaModal from './NovaReservaModal'
import { criarReserva } from '../utils/reservas'
import { useAuth } from '../contexts/AuthContext'

vi.mock('../utils/reservas', () => ({
  criarReserva: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const sala = { id: 'sala-1', nome: 'Sala Azul' }
const usuario = { id: 'usuario-1', empresa_id: 'empresa-1', nome: 'Maria' }

describe('NovaReservaModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ usuario })
  })

  it('impede o envio quando o horário de fim não é depois do início', async () => {
    const user = userEvent.setup()
    render(
      <NovaReservaModal sala={sala} dataKey="2026-01-10" horaInicioSugerida="09:00" onClose={vi.fn()} onCriada={vi.fn()} />
    )

    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '09:00' } })
    await user.type(screen.getByLabelText('Motivo da reunião'), 'Reunião de vendas')
    await user.click(screen.getByRole('button', { name: 'Confirmar reserva' }))

    expect(await screen.findByText(/horário de término deve ser depois do início/i)).toBeInTheDocument()
    expect(criarReserva).not.toHaveBeenCalled()
  })

  it('chama criarReserva e onCriada quando o formulário é válido', async () => {
    criarReserva.mockResolvedValue({ data: { id: 'reserva-1' } })
    const onCriada = vi.fn()
    const user = userEvent.setup()

    render(
      <NovaReservaModal sala={sala} dataKey="2026-01-10" horaInicioSugerida="09:00" onClose={vi.fn()} onCriada={onCriada} />
    )

    await user.type(screen.getByLabelText('Motivo da reunião'), 'Reunião de vendas')
    await user.click(screen.getByRole('button', { name: 'Confirmar reserva' }))

    await waitFor(() => expect(onCriada).toHaveBeenCalled())
    expect(criarReserva).toHaveBeenCalledWith(
      expect.objectContaining({
        empresaId: 'empresa-1',
        salaId: 'sala-1',
        usuarioId: 'usuario-1',
        motivo: 'Reunião de vendas',
      })
    )
  })

  it('exibe o erro retornado quando o banco rejeita a reserva (conflito de corrida)', async () => {
    criarReserva.mockResolvedValue({ error: { message: 'Já existe uma reserva nesse horário para esta sala.' } })
    const onCriada = vi.fn()
    const user = userEvent.setup()

    render(
      <NovaReservaModal sala={sala} dataKey="2026-01-10" horaInicioSugerida="09:00" onClose={vi.fn()} onCriada={onCriada} />
    )

    await user.type(screen.getByLabelText('Motivo da reunião'), 'Reunião de vendas')
    await user.click(screen.getByRole('button', { name: 'Confirmar reserva' }))

    expect(await screen.findByText(/já existe uma reserva/i)).toBeInTheDocument()
    expect(onCriada).not.toHaveBeenCalled()
  })
})
