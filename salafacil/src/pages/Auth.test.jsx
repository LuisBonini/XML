import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Auth from './Auth'
import { useAuth } from '../contexts/AuthContext'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderAuth() {
  return render(
    <MemoryRouter>
      <Auth />
    </MemoryRouter>
  )
}

function botaoSubmit(nome) {
  const form = screen.getByLabelText('E-mail').closest('form')
  return within(form).getByRole('button', { name: nome })
}

describe('Auth', () => {
  const entrar = vi.fn()
  const cadastrarComEmpresa = vi.fn()
  const cadastrarComConvite = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ entrar, cadastrarComEmpresa, cadastrarComConvite })
  })

  it('mostra o formulário de login por padrão', () => {
    renderAuth()
    expect(botaoSubmit('Entrar')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da empresa')).not.toBeInTheDocument()
  })

  it('troca para a aba de nova empresa e mostra os campos correspondentes', async () => {
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByRole('button', { name: 'Nova empresa' }))
    expect(screen.getByLabelText('Nome da empresa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar empresa e conta admin' })).toBeInTheDocument()
  })

  it('troca para a aba de convite e mostra o aviso sobre usar o e-mail convidado', async () => {
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByRole('button', { name: 'Tenho convite' }))
    expect(screen.getByText(/mesmo e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail convidado')).toBeInTheDocument()
  })

  it('navega para /app após login bem-sucedido', async () => {
    entrar.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderAuth()

    await user.type(screen.getByLabelText('E-mail'), 'admin@empresa.com')
    await user.type(screen.getByLabelText('Senha'), 'senha123')
    await user.click(botaoSubmit('Entrar'))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app'))
  })

  it('mostra mensagem de erro traduzida quando o login falha', async () => {
    entrar.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const user = userEvent.setup()
    renderAuth()

    await user.type(screen.getByLabelText('E-mail'), 'admin@empresa.com')
    await user.type(screen.getByLabelText('Senha'), 'errada')
    await user.click(botaoSubmit('Entrar'))

    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
