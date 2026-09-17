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
