import { Link } from 'react-router-dom'
import { Button } from '../components/ui'

const RECURSOS = [
  { titulo: 'Agenda visual por sala', desc: 'Veja em segundos quais salas estão livres em cada horário do dia.' },
  { titulo: 'Sem conflito de horário', desc: 'O sistema bloqueia automaticamente reservas que se sobrepõem.' },
  { titulo: 'Multi-empresa e multiusuário', desc: 'Cada empresa só acessa seus próprios dados, com perfis de admin e usuário.' },
  { titulo: 'Convide sua equipe', desc: 'Administradores convidam colegas por e-mail em poucos cliques.' },
  { titulo: 'Funciona no tablet da recepção', desc: 'Interface responsiva, pensada para uso rápido em qualquer tela.' },
  { titulo: 'Marca da sua empresa', desc: 'No plano Pro, personalize a cor e o logo do seu painel.' },
]

const PLANOS = [
  {
    nome: 'Free',
    preco: 'R$ 0',
    periodo: '/mês',
    descricao: 'Para equipes pequenas testarem o SalaFácil.',
    itens: ['Até 3 salas', 'Usuários ilimitados', 'Agenda e reservas com verificação de conflito', 'Suporte por e-mail'],
    destaque: false,
  },
  {
    nome: 'Pro',
    preco: 'R$ 79',
    periodo: '/mês',
    descricao: 'Para empresas que precisam de mais salas e identidade visual própria.',
    itens: ['Salas ilimitadas', 'Cor e logo personalizados', 'Relatórios de ocupação (em breve)', 'Suporte prioritário'],
    destaque: true,
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              S
            </div>
            <span className="font-semibold text-slate-900">SalaFácil</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/entrar" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Entrar
            </Link>
            <Link to="/entrar">
              <Button>Começar gratis</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Reserva de salas de reunião, sem planilha e sem conflito de horário
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          O SalaFácil organiza as salas da sua empresa numa agenda visual simples. Sua equipe reserva em
          segundos, e o sistema garante que duas reuniões nunca caiam no mesmo horário.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/entrar">
            <Button className="px-6 py-3 text-base">Criar minha empresa gratis</Button>
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-400">Não precisa de cartão de crédito para começar.</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((r) => (
            <div key={r.titulo} className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-medium text-slate-900">{r.titulo}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-3xl font-semibold text-slate-900">Planos</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {PLANOS.map((plano) => (
              <div
                key={plano.nome}
                className={`rounded-2xl border p-6 ${
                  plano.destaque ? 'border-brand-500 bg-white shadow-lg' : 'border-slate-200 bg-white'
                }`}
              >
                <h3 className="text-lg font-semibold text-slate-900">{plano.nome}</h3>
                <p className="mt-1 text-sm text-slate-500">{plano.descricao}</p>
                <p className="mt-4">
                  <span className="text-3xl font-semibold text-slate-900">{plano.preco}</span>
                  <span className="text-sm text-slate-500">{plano.periodo}</span>
                </p>
                <ul className="mt-5 space-y-2 text-sm text-slate-600">
                  {plano.itens.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-brand-600">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link to="/entrar" className="mt-6 block">
                  <Button variant={plano.destaque ? 'primary' : 'secondary'} className="w-full">
                    Começar gratis
                  </Button>
                </Link>
                {plano.destaque && (
                  <p className="mt-2 text-center text-xs text-slate-400">Upgrade para Pro em breve, direto no painel.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} SalaFácil. Todos os direitos reservados.
      </footer>
    </div>
  )
}
