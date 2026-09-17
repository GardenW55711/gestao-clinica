-- Schema inicial da nuvem (Supabase) — Fase 1
-- Cada clínica tem exatamente 1 conta de login (Supabase Auth). As políticas de
-- RLS abaixo garantem, dentro do próprio banco, que uma clínica só enxerga e
-- só grava linhas com o seu próprio clinic_id — isso é o isolamento multi-tenant.

create table if not exists public.clinics (
  id uuid primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cnpj text,
  owner_email text not null,
  self_booking_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clinics_auth_user_id_key on public.clinics(auth_user_id);

alter table public.clinics enable row level security;

create policy "clinic can read own row"
  on public.clinics for select
  using (auth_user_id = auth.uid());

create policy "clinic can insert own row"
  on public.clinics for insert
  with check (auth_user_id = auth.uid());

create policy "clinic can update own row"
  on public.clinics for update
  using (auth_user_id = auth.uid());

-- staff_members: funcionários da clínica. A senha/PIN nunca é validada aqui —
-- fica só o hash, para o programa local poder recriar a lista de funcionários
-- se precisar (ex: apagou o banco local sem querer, ou clínica com 2 computadores no futuro).
create table if not exists public.staff_members (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  role text not null check (role in ('owner','admin','professional','receptionist')),
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.staff_members enable row level security;

create policy "clinic manages its staff"
  on public.staff_members for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

-- Fase 2: cadastros base (pacientes, profissionais, salas, tipos de procedimento).
-- Todas seguem o mesmo padrão de política de RLS: só a própria clínica lê/escreve.

create table if not exists public.patients (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  birth_date date,
  cpf text,
  notes text,
  lgpd_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.patients enable row level security;

create policy "clinic manages its patients"
  on public.patients for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

create table if not exists public.professionals (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  staff_member_id uuid,
  name text not null,
  specialty text,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.professionals enable row level security;

create policy "clinic manages its professionals"
  on public.professionals for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

create table if not exists public.rooms (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.rooms enable row level security;

create policy "clinic manages its rooms"
  on public.rooms for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

create table if not exists public.procedure_types (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  duration_minutes integer not null,
  default_price numeric not null default 0,
  requires_room boolean not null default false,
  bookable_online boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.procedure_types enable row level security;

create policy "clinic manages its procedure types"
  on public.procedure_types for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));
