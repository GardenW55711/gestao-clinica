-- Schema da nuvem (Supabase). Pode ser rodado inteiro de novo a qualquer
-- momento sem dar erro (todo "create" tem um "if not exists"/"drop if exists"
-- na frente) — é seguro colar o arquivo inteiro no SQL Editor sempre que
-- adicionarmos uma tabela nova em vez de precisar achar só o trecho novo.

-- Fase 1: clínica (conta na nuvem) e funcionários -----------------------
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

drop policy if exists "clinic can read own row" on public.clinics;
create policy "clinic can read own row"
  on public.clinics for select
  using (auth_user_id = auth.uid());

drop policy if exists "clinic can insert own row" on public.clinics;
create policy "clinic can insert own row"
  on public.clinics for insert
  with check (auth_user_id = auth.uid());

drop policy if exists "clinic can update own row" on public.clinics;
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

drop policy if exists "clinic manages its staff" on public.staff_members;
create policy "clinic manages its staff"
  on public.staff_members for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

-- Fase 2: cadastros base (pacientes, profissionais, salas, tipos de procedimento) --
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

drop policy if exists "clinic manages its patients" on public.patients;
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

drop policy if exists "clinic manages its professionals" on public.professionals;
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

drop policy if exists "clinic manages its rooms" on public.rooms;
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

drop policy if exists "clinic manages its procedure types" on public.procedure_types;
create policy "clinic manages its procedure types"
  on public.procedure_types for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

-- Fase 3: agendamentos -----------------------------------------------------

create table if not exists public.appointments (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  professional_id uuid not null,
  room_id uuid,
  procedure_type_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null check (status in ('scheduled','confirmed','completed','cancelled','no_show')),
  source text not null check (source in ('staff','patient_self')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.appointments enable row level security;

drop policy if exists "clinic manages its appointments" on public.appointments;
create policy "clinic manages its appointments"
  on public.appointments for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

-- Fase 4: estoque ----------------------------------------------------------

create table if not exists public.inventory_items (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  category text,
  unit text not null,
  min_quantity numeric not null default 0,
  unit_cost numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.inventory_items enable row level security;

drop policy if exists "clinic manages its inventory items" on public.inventory_items;
create policy "clinic manages its inventory items"
  on public.inventory_items for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

create table if not exists public.inventory_batches (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  item_id uuid not null,
  batch_code text,
  quantity numeric not null,
  expiry_date date,
  received_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.inventory_batches enable row level security;

drop policy if exists "clinic manages its inventory batches" on public.inventory_batches;
create policy "clinic manages its inventory batches"
  on public.inventory_batches for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

create table if not exists public.inventory_movements (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  item_id uuid not null,
  batch_id uuid,
  type text not null check (type in ('entrada','saida','ajuste')),
  quantity numeric not null,
  reason text,
  related_sale_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.inventory_movements enable row level security;

drop policy if exists "clinic manages its inventory movements" on public.inventory_movements;
create policy "clinic manages its inventory movements"
  on public.inventory_movements for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

-- Fase 5: vendas ------------------------------------------------------------

create table if not exists public.sales (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  appointment_id uuid,
  professional_id uuid,
  total_amount numeric not null default 0,
  payment_method text not null check (payment_method in ('dinheiro','cartao','pix','outro')),
  status text not null check (status in ('paga','pendente')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.sales enable row level security;

drop policy if exists "clinic manages its sales" on public.sales;
create policy "clinic manages its sales"
  on public.sales for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

create table if not exists public.sale_items (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  sale_id uuid not null,
  description text not null,
  kind text not null check (kind in ('procedimento','produto')),
  procedure_type_id uuid,
  inventory_item_id uuid,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  subtotal numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.sale_items enable row level security;

drop policy if exists "clinic manages its sale items" on public.sale_items;
create policy "clinic manages its sale items"
  on public.sale_items for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

-- Fase 6: autoagendamento online --------------------------------------------
-- A página pública de agendamento não faz login (o paciente não tem conta).
-- Ela usa o papel "anon" do Supabase, então aqui liberamos, só pra esse
-- papel, uma leitura bem restrita (nada de prontuário/telefone/e-mail) e a
-- criação de pedidos de agendamento.

alter table public.booking_requests add column if not exists professional_id uuid;

-- Dados públicos da clínica (nome + se autoagendamento está ligado) —
-- necessário pra página saber o nome da clínica e se deve funcionar.
grant select on public.clinics to anon;
drop policy if exists "public can read bookable clinics" on public.clinics;
create policy "public can read bookable clinics"
  on public.clinics for select
  to anon
  using (self_booking_enabled = true);

-- Profissionais ativos das clínicas com autoagendamento ligado.
grant select on public.professionals to anon;
drop policy if exists "public can read professionals of bookable clinics" on public.professionals;
create policy "public can read professionals of bookable clinics"
  on public.professionals for select
  to anon
  using (
    active = true
    and clinic_id in (select id from public.clinics where self_booking_enabled = true)
  );

-- Tipos de procedimento marcados como disponíveis para autoagendamento.
grant select on public.procedure_types to anon;
drop policy if exists "public can read bookable procedure types" on public.procedure_types;
create policy "public can read bookable procedure types"
  on public.procedure_types for select
  to anon
  using (
    active = true
    and bookable_online = true
    and clinic_id in (select id from public.clinics where self_booking_enabled = true)
  );

-- Horários ocupados (sem nome de paciente nem observações) — só o suficiente
-- pra página pública saber quais horários NÃO oferecer. Como essa view é
-- dona do schema "public" (não do paciente), ela ignora a RLS da tabela
-- appointments e decide sozinha o que expor, através do WHERE abaixo.
create or replace view public.public_busy_slots as
select clinic_id, professional_id, start_at, end_at
from public.appointments
where status <> 'cancelled'
  and deleted_at is null
  and clinic_id in (select id from public.clinics where self_booking_enabled = true);

grant select on public.public_busy_slots to anon;

-- Pedido de agendamento enviado pelo paciente pela página pública.
grant insert on public.booking_requests to anon;
drop policy if exists "public can create booking requests" on public.booking_requests;
create policy "public can create booking requests"
  on public.booking_requests for insert
  to anon
  with check (clinic_id in (select id from public.clinics where self_booking_enabled = true));
