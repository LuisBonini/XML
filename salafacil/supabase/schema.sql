-- SalaFácil — schema completo do banco (Supabase / Postgres)
-- Execute este arquivo no SQL Editor do seu projeto Supabase.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- =========================================================
-- TABELAS
-- =========================================================

create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  plano text not null default 'free', -- free | pro
  cor_primaria text default '#2563eb',
  logo_url text,
  stripe_customer_id text,
  ativo boolean default true,
  criado_em timestamptz default now()
);

create table if not exists usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid references empresas(id) on delete cascade,
  nome text not null,
  email text,
  role text not null default 'user', -- admin | user
  ativo boolean default true,
  criado_em timestamptz default now()
);

create table if not exists salas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade,
  nome text not null,
  andar text,
  capacidade int,
  recursos text[] default '{}', -- ex: ['TV', 'Projetor', 'Videoconferência']
  ativo boolean default true,
  criado_em timestamptz default now()
);

create table if not exists reservas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade,
  sala_id uuid references salas(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete set null,
  usuario_nome text,
  data_key date not null,
  hora_inicio time not null,
  hora_fim time not null,
  motivo text not null,
  participantes text,
  criado_em timestamptz default now(),
  constraint horario_valido check (hora_fim > hora_inicio),
  constraint sem_conflito unique (sala_id, data_key, hora_inicio, hora_fim),
  -- impede qualquer sobreposição de horário na mesma sala, não só duplicata exata
  constraint sem_overlap exclude using gist (
    sala_id with =,
    tsrange(
      (data_key + hora_inicio)::timestamp,
      (data_key + hora_fim)::timestamp,
      '[)'
    ) with &&
  )
);

-- Convites pendentes: admin convida por e-mail antes do usuário ter conta.
-- Quando o convidado faz cadastro com esse e-mail, o convite é consumido
-- pela função aceitar_convite() e vira uma linha em "usuarios".
create table if not exists convites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade,
  email text not null,
  role text not null default 'user',
  convidado_por uuid references usuarios(id),
  criado_em timestamptz default now(),
  unique (empresa_id, email)
);

create index if not exists idx_usuarios_empresa on usuarios(empresa_id);
create index if not exists idx_salas_empresa on salas(empresa_id);
create index if not exists idx_reservas_empresa on reservas(empresa_id);
create index if not exists idx_reservas_sala_data on reservas(sala_id, data_key);
create index if not exists idx_reservas_usuario on reservas(usuario_id);
create index if not exists idx_convites_email on convites(email);

-- =========================================================
-- FUNÇÕES (SECURITY DEFINER) — bootstrap de empresa e convites
-- Rodam com privilégio elevado pois o usuário ainda não tem linha
-- em "usuarios" no momento do cadastro (RLS normal bloquearia).
-- =========================================================

-- Cria a empresa e o usuário admin no primeiro cadastro.
create or replace function criar_empresa_e_admin(
  p_nome_empresa text,
  p_slug text,
  p_nome_usuario text
) returns usuarios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa empresas;
  v_usuario usuarios;
begin
  if exists (select 1 from usuarios where id = auth.uid()) then
    raise exception 'Usuário já está vinculado a uma empresa';
  end if;

  insert into empresas (nome, slug)
  values (p_nome_empresa, p_slug)
  returning * into v_empresa;

  insert into usuarios (id, empresa_id, nome, email, role)
  values (auth.uid(), v_empresa.id, p_nome_usuario, auth.email(), 'admin')
  returning * into v_usuario;

  return v_usuario;
end;
$$;

-- Consome um convite pendente para o e-mail do usuário autenticado,
-- criando a linha em "usuarios" vinculada à empresa do convite.
create or replace function aceitar_convite() returns usuarios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convite convites;
  v_usuario usuarios;
begin
  if exists (select 1 from usuarios where id = auth.uid()) then
    raise exception 'Usuário já está vinculado a uma empresa';
  end if;

  select * into v_convite from convites where email = auth.email() limit 1;

  if v_convite is null then
    raise exception 'Nenhum convite pendente para este e-mail';
  end if;

  insert into usuarios (id, empresa_id, nome, email, role)
  values (auth.uid(), v_convite.empresa_id, coalesce(auth.email(), ''), auth.email(), v_convite.role)
  returning * into v_usuario;

  delete from convites where id = v_convite.id;

  return v_usuario;
end;
$$;

-- =========================================================
-- RLS
-- =========================================================

alter table empresas enable row level security;
alter table usuarios enable row level security;
alter table salas enable row level security;
alter table reservas enable row level security;
alter table convites enable row level security;

-- empresas: qualquer usuário autenticado vê apenas a própria empresa
create policy "Empresa visível para seus membros" on empresas
  for select using (id = (select empresa_id from usuarios where id = auth.uid()));

create policy "Admin atualiza a própria empresa" on empresas
  for update using (
    id = (select empresa_id from usuarios where id = auth.uid())
    and (select role from usuarios where id = auth.uid()) = 'admin'
  );

-- usuarios
create policy "Usuários veem colegas da própria empresa" on usuarios
  for select using (empresa_id = (select empresa_id from usuarios where id = auth.uid()));

create policy "Usuário atualiza o próprio perfil" on usuarios
  for update using (id = auth.uid());

create policy "Admin atualiza usuários da própria empresa" on usuarios
  for update using (
    empresa_id = (select empresa_id from usuarios where id = auth.uid())
    and (select role from usuarios where id = auth.uid()) = 'admin'
  );

create policy "Admin desativa usuários da própria empresa" on usuarios
  for delete using (
    empresa_id = (select empresa_id from usuarios where id = auth.uid())
    and (select role from usuarios where id = auth.uid()) = 'admin'
  );

-- salas: isoladas por empresa, gestão restrita a admin
create policy "Salas visíveis para a empresa" on salas
  for select using (empresa_id = (select empresa_id from usuarios where id = auth.uid()));

create policy "Admin gerencia salas da empresa" on salas
  for insert with check (
    empresa_id = (select empresa_id from usuarios where id = auth.uid())
    and (select role from usuarios where id = auth.uid()) = 'admin'
  );

create policy "Admin atualiza salas da empresa" on salas
  for update using (
    empresa_id = (select empresa_id from usuarios where id = auth.uid())
    and (select role from usuarios where id = auth.uid()) = 'admin'
  );

create policy "Admin remove salas da empresa" on salas
  for delete using (
    empresa_id = (select empresa_id from usuarios where id = auth.uid())
    and (select role from usuarios where id = auth.uid()) = 'admin'
  );

-- reservas: isoladas por empresa; qualquer membro cria; só autor ou admin cancela
create policy "Reservas visíveis para a empresa" on reservas
  for select using (empresa_id = (select empresa_id from usuarios where id = auth.uid()));

create policy "Membros criam reservas na própria empresa" on reservas
  for insert with check (empresa_id = (select empresa_id from usuarios where id = auth.uid()));

create policy "Autor ou admin cancela a reserva" on reservas
  for delete using (
    empresa_id = (select empresa_id from usuarios where id = auth.uid())
    and (
      usuario_id = auth.uid()
      or (select role from usuarios where id = auth.uid()) = 'admin'
    )
  );

create policy "Autor ou admin atualiza a reserva" on reservas
  for update using (
    empresa_id = (select empresa_id from usuarios where id = auth.uid())
    and (
      usuario_id = auth.uid()
      or (select role from usuarios where id = auth.uid()) = 'admin'
    )
  );

-- convites: visíveis e gerenciáveis apenas por admins da empresa
create policy "Admin vê convites da empresa" on convites
  for select using (
    empresa_id = (select empresa_id from usuarios where id = auth.uid())
    and (select role from usuarios where id = auth.uid()) = 'admin'
  );

create policy "Admin cria convites para a empresa" on convites
  for insert with check (
    empresa_id = (select empresa_id from usuarios where id = auth.uid())
    and (select role from usuarios where id = auth.uid()) = 'admin'
  );

create policy "Admin remove convites da empresa" on convites
  for delete using (
    empresa_id = (select empresa_id from usuarios where id = auth.uid())
    and (select role from usuarios where id = auth.uid()) = 'admin'
  );
