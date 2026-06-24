# SalaFácil

Sistema multi-empresa de reserva de salas de reunião. React + Vite + Tailwind no
frontend, Supabase (Auth + Postgres + RLS) no backend.

## Stack

- **Frontend**: React, Vite, Tailwind CSS, React Router
- **Backend**: Supabase (Auth, Postgres, Row Level Security)
- **Testes**: Vitest + React Testing Library
- **Hospedagem**: Vercel (frontend) + Supabase (backend)
- **Pagamentos**: Stripe (não integrado ainda — ver seção abaixo)

## Funcionalidades

- Landing page pública (`/`) com apresentação do produto e planos
- Cadastro de empresa + conta admin, login, e cadastro via convite (`/entrar`)
- Dashboard com lista de salas (`/app`)
- Agenda visual por sala com grade de horários e criação de reserva (`/app/salas/:id`)
- Verificação de conflito de horário em duas camadas (client + constraint no banco)
- "Meus agendamentos" com cancelamento de reserva própria (`/app/meus-agendamentos`)
- Painel admin: CRUD de salas, gestão de usuários e convites, configurações de
  marca da empresa — nome, cor primária e logo (`/app/admin/*`)
- Layout responsivo, testado em telas de tablet e celular

## Setup do Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Vá em **SQL Editor** e execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
   Isso cria as tabelas, as funções de bootstrap (`criar_empresa_e_admin`,
   `aceitar_convite`) e todas as políticas de RLS.
3. Em **Project Settings → API**, copie a `Project URL` e a `anon public key`.
4. Em **Authentication → Settings**, desative a confirmação de e-mail durante o
   desenvolvimento (ou configure um provedor de SMTP) para acelerar os testes.

## Setup do frontend

```bash
cd salafacil
cp .env.example .env   # preencha com a URL e a anon key do seu projeto
npm install
npm run dev
```

## Como funciona o isolamento multi-empresa

- Toda tabela de dados (`salas`, `reservas`, `usuarios`) tem `empresa_id` e
  políticas de RLS que restringem cada usuário aos dados da própria empresa.
- O primeiro cadastro de uma empresa cria a `empresa` e o usuário `admin` numa
  única chamada RPC (`criar_empresa_e_admin`), pois nesse momento o usuário
  ainda não tem vínculo com nenhuma empresa (a RLS normal bloquearia o insert).
- Convites funcionam hoje sem envio de e-mail automático: o admin cadastra o
  e-mail em **Usuários → Convidar**, e a pessoa convidada se cadastra na aba
  "Tenho convite" usando o mesmo e-mail. A função `aceitar_convite()` vincula
  a conta nova à empresa do convite. Para enviar e-mails de convite automaticamente,
  crie uma Supabase Edge Function que dispare um e-mail (Resend, Postmark etc.)
  ao inserir uma linha em `convites`.

## Verificação de conflito de horário

A checagem acontece em duas camadas:

1. **Frontend** (`src/utils/reservas.js`): antes de criar a reserva, busca as
   reservas do dia para a sala e verifica sobreposição de horário — dá feedback
   imediato ao usuário.
2. **Banco** (`supabase/schema.sql`): a tabela `reservas` tem uma
   `exclusion constraint` via `btree_gist` que impede qualquer sobreposição de
   horário na mesma sala, mesmo sob concorrência (duas pessoas reservando ao
   mesmo tempo). Esse é o ponto de verdade contra race conditions.

## Testes

```bash
npm run test       # roda a suíte uma vez
npm run test:watch # modo watch
```

A suíte cobre a lógica de conflito de horário (`src/utils/reservas.js`), o
modal de nova reserva, a agenda da sala e o fluxo de login/cadastro do `Auth.jsx`.

## Próximos passos (fora do MVP)

- **Stripe**: a tabela `empresas` já tem as colunas `plano` e
  `stripe_customer_id`. Para integrar, crie uma Edge Function de checkout/webhook
  e atualize `plano`/`stripe_customer_id` ao confirmar o pagamento. A tela
  **Configurações** já mostra o plano atual e está pronta para receber o botão
  de upgrade quando o checkout existir.
- **Convites por e-mail real**: ver seção acima.

## Deploy

- **Frontend**: importe o repositório na Vercel, configure `VITE_SUPABASE_URL`
  e `VITE_SUPABASE_ANON_KEY` nas variáveis de ambiente do projeto, com root
  directory `salafacil`.
- **Backend**: já está hospedado no Supabase — não há deploy manual além de
  rodar as migrations em `supabase/schema.sql`.
