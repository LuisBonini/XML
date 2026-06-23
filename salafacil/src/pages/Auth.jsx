import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button, Input, Card } from '../components/ui'

function gerarSlug(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function Auth() {
  const [aba, setAba] = useState('entrar') // entrar | nova-empresa | convite
  const navigate = useNavigate()
  const { entrar, cadastrarComEmpresa, cadastrarComConvite } = useAuth()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(false)

  function limparMensagens() {
    setErro('')
    setMensagem('')
  }

  async function aoEntrar(e) {
    e.preventDefault()
    limparMensagens()
    setCarregando(true)
    const { error } = await entrar(email, senha)
    setCarregando(false)
    if (error) return setErro(traduzErro(error.message))
    navigate('/app')
  }

  async function aoCriarEmpresa(e) {
    e.preventDefault()
    limparMensagens()
    setCarregando(true)
    const slug = gerarSlug(nomeEmpresa) + '-' + Math.random().toString(36).slice(2, 6)
    const { error, confirmacaoPendente } = await cadastrarComEmpresa({
      email,
      senha,
      nomeUsuario: nome,
      nomeEmpresa,
      slugEmpresa: slug,
    })
    setCarregando(false)
    if (error) return setErro(traduzErro(error.message))
    if (confirmacaoPendente) return setMensagem('Verifique seu e-mail para confirmar o cadastro.')
    navigate('/app')
  }

  async function aoAceitarConvite(e) {
    e.preventDefault()
    limparMensagens()
    setCarregando(true)
    const { error, confirmacaoPendente } = await cadastrarComConvite({ email, senha, nomeUsuario: nome })
    setCarregando(false)
    if (error) return setErro(traduzErro(error.message))
    if (confirmacaoPendente) return setMensagem('Verifique seu e-mail para confirmar o cadastro.')
    navigate('/app')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">SalaFácil</h1>
          <p className="mt-1 text-sm text-slate-500">Reserva de salas de reunião para sua empresa</p>
        </div>

        <Card>
          <div className="mb-5 flex rounded-lg bg-slate-100 p-1 text-sm">
            <TabButton ativo={aba === 'entrar'} onClick={() => { setAba('entrar'); limparMensagens() }}>
              Entrar
            </TabButton>
            <TabButton ativo={aba === 'nova-empresa'} onClick={() => { setAba('nova-empresa'); limparMensagens() }}>
              Nova empresa
            </TabButton>
            <TabButton ativo={aba === 'convite'} onClick={() => { setAba('convite'); limparMensagens() }}>
              Tenho convite
            </TabButton>
          </div>

          {erro && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
          {mensagem && <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{mensagem}</div>}

          {aba === 'entrar' && (
            <form className="space-y-4" onSubmit={aoEntrar}>
              <Input label="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
              <Button type="submit" className="w-full" disabled={carregando}>
                {carregando ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          )}

          {aba === 'nova-empresa' && (
            <form className="space-y-4" onSubmit={aoCriarEmpresa}>
              <Input label="Nome da empresa" required value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} />
              <Input label="Seu nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
              <Input label="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Senha" type="password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} />
              <Button type="submit" className="w-full" disabled={carregando}>
                {carregando ? 'Criando...' : 'Criar empresa e conta admin'}
              </Button>
            </form>
          )}

          {aba === 'convite' && (
            <form className="space-y-4" onSubmit={aoAceitarConvite}>
              <p className="text-sm text-slate-500">
                Use o mesmo e-mail para o qual você recebeu o convite do administrador da sua empresa.
              </p>
              <Input label="Seu nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
              <Input label="E-mail convidado" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Crie uma senha" type="password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} />
              <Button type="submit" className="w-full" disabled={carregando}>
                {carregando ? 'Entrando...' : 'Entrar na empresa'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}

function TabButton({ ativo, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1.5 font-medium transition ${
        ativo ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function traduzErro(msg) {
  const mapa = {
    'Invalid login credentials': 'E-mail ou senha inválidos.',
    'User already registered': 'Já existe uma conta com este e-mail.',
  }
  return mapa[msg] || msg
}
