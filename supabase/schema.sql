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
  related_appointment_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.inventory_movements add column if not exists related_appointment_id uuid;

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

-- Produtos que cada tipo de procedimento consome (baixa automática de estoque) ---

create table if not exists public.procedure_type_items (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  procedure_type_id uuid not null,
  inventory_item_id uuid not null,
  default_quantity numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.procedure_type_items enable row level security;

drop policy if exists "clinic manages its procedure type items" on public.procedure_type_items;
create policy "clinic manages its procedure type items"
  on public.procedure_type_items for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

-- Fase 6: autoagendamento online --------------------------------------------
-- A página pública de agendamento não faz login (o paciente não tem conta).
-- Ela usa o papel "anon" do Supabase, então aqui liberamos, só pra esse
-- papel, uma leitura bem restrita (nada de prontuário/telefone/e-mail) e a
-- criação de pedidos de agendamento.

create table if not exists public.booking_requests (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_name text not null,
  patient_phone text not null,
  professional_id uuid,
  procedure_type_id uuid,
  desired_start_at timestamptz not null,
  status text not null default 'pending_review' check (status in ('pending_review','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.booking_requests add column if not exists professional_id uuid;

alter table public.booking_requests enable row level security;

-- A própria clínica (autenticada) também precisa ler/atualizar os pedidos
-- que aprovar ou recusar na tela de Configurações.
drop policy if exists "clinic manages its booking requests" on public.booking_requests;
create policy "clinic manages its booking requests"
  on public.booking_requests for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

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

-- ============================================================
-- Fase 1 / Etapa 0: dinheiro em CENTAVOS INTEIROS
-- As colunas antigas (em reais, sem sufixo) ficam intocadas por segurança;
-- o app passa a ler e gravar só as colunas *_cents.
-- ============================================================
alter table public.procedure_types add column if not exists default_price_cents bigint;
alter table public.inventory_items add column if not exists unit_cost_cents bigint;
alter table public.sales add column if not exists total_amount_cents bigint;
alter table public.sale_items add column if not exists unit_price_cents bigint;
alter table public.sale_items add column if not exists subtotal_cents bigint;

-- ============================================================
-- Fase 1 / Etapa B: financeiro de verdade (parcelas, despesas), comissão,
-- taxas de cartão, horário de trabalho e bloqueios da agenda.
-- ============================================================

-- Cobranças: valor bruto, desconto e novos status / formas de pagamento
alter table public.sales add column if not exists gross_amount_cents bigint;
alter table public.sales add column if not exists discount_cents bigint;
update public.sales set payment_method = 'cartao_credito' where payment_method = 'cartao';
alter table public.sales drop constraint if exists sales_payment_method_check;
alter table public.sales add constraint sales_payment_method_check
  check (payment_method in ('dinheiro','pix','cartao_debito','cartao_credito','boleto','outro'));
alter table public.sales drop constraint if exists sales_status_check;
alter table public.sales add constraint sales_status_check
  check (status in ('pendente','parcial','paga','cancelada'));

-- Comissão por profissional e taxas de cartão da clínica
alter table public.professionals add column if not exists commission_percent numeric not null default 0;
alter table public.clinics add column if not exists card_fee_debit_percent numeric not null default 0;
alter table public.clinics add column if not exists card_fee_credit_percent numeric not null default 0;
alter table public.clinics add column if not exists card_fee_credit_installment_percent numeric not null default 0;

-- Parcelas das cobranças
create table if not exists public.installments (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  sale_id uuid not null,
  number integer not null,
  total_installments integer not null default 1,
  amount_cents bigint not null,
  due_date date not null,
  paid_at timestamptz,
  payment_method text not null check (payment_method in ('dinheiro','pix','cartao_debito','cartao_credito','boleto','outro')),
  fee_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.installments enable row level security;
drop policy if exists "clinic manages its installments" on public.installments;
create policy "clinic manages its installments"
  on public.installments for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

-- Despesas
create table if not exists public.expenses (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  description text not null,
  category text not null check (category in ('aluguel','salarios','pro_labore','contas','laboratorio','materiais','marketing','impostos','manutencao','outros')),
  kind text not null check (kind in ('fixa','variavel')),
  amount_cents bigint not null,
  due_date date not null,
  paid_at timestamptz,
  recurring_monthly boolean not null default false,
  recurrence_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.expenses enable row level security;
drop policy if exists "clinic manages its expenses" on public.expenses;
create policy "clinic manages its expenses"
  on public.expenses for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

-- Horário de trabalho por profissional
create table if not exists public.professional_working_hours (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  professional_id uuid not null,
  weekday integer not null check (weekday between 0 and 6),
  start_time text not null,
  end_time text not null,
  break_start text,
  break_end text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.professional_working_hours enable row level security;
drop policy if exists "clinic manages its working hours" on public.professional_working_hours;
create policy "clinic manages its working hours"
  on public.professional_working_hours for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

-- Bloqueios da agenda (professional_id nulo = vale para todos)
create table if not exists public.schedule_blocks (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  professional_id uuid,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.schedule_blocks enable row level security;
drop policy if exists "clinic manages its schedule blocks" on public.schedule_blocks;
create policy "clinic manages its schedule blocks"
  on public.schedule_blocks for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

-- Para a página pública de agendamento respeitar horário de trabalho e bloqueios
-- (sem expor o motivo do bloqueio).
create or replace view public.public_working_hours as
select clinic_id, professional_id, weekday, start_time, end_time, break_start, break_end
from public.professional_working_hours
where deleted_at is null
  and clinic_id in (select id from public.clinics where self_booking_enabled = true);
grant select on public.public_working_hours to anon;

create or replace view public.public_schedule_blocks as
select clinic_id, professional_id, start_at, end_at
from public.schedule_blocks
where deleted_at is null
  and clinic_id in (select id from public.clinics where self_booking_enabled = true);
grant select on public.public_schedule_blocks to anon;

-- ============================================================
-- Fase 2 / Etapa A: prontuário clínico — base
-- Nenhuma tabela clínica desta fase (patient_alerts e as que vêm nas próximas
-- etapas) é exposta às views/políticas "anon" do autoagendamento acima.
-- ============================================================

-- Cabeçalho dos documentos em PDF
alter table public.clinics add column if not exists address text;
alter table public.clinics add column if not exists phone text;
alter table public.clinics add column if not exists logo_path text;

-- Só vale para cargo "admin": o dono libera acesso clínico (anamnese/odontograma/imagens)
alter table public.staff_members add column if not exists clinical_access boolean not null default false;

-- Obrigatórios para emitir receita/atestado
alter table public.professionals add column if not exists cro_number text;
alter table public.professionals add column if not exists cro_uf text;

-- O que o dentista seleciona no odontograma ao usar o procedimento, e a marcação
-- automática correspondente (código do catálogo em shared/odontogram.ts)
alter table public.procedure_types add column if not exists scope text not null default 'nenhum';
alter table public.procedure_types drop constraint if exists procedure_types_scope_check;
alter table public.procedure_types add constraint procedure_types_scope_check
  check (scope in ('nenhum','dente','face','arcada','boca'));
alter table public.procedure_types add column if not exists odontogram_condition text;

-- Alertas de saúde do paciente (alergias, anticoagulante, gestante...)
create table if not exists public.patient_alerts (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  text text not null,
  severity text not null default 'atencao' check (severity in ('atencao','grave')),
  origin text not null check (origin in ('anamnese','manual')),
  source_record_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.patient_alerts enable row level security;
drop policy if exists "clinic manages its patient alerts" on public.patient_alerts;
create policy "clinic manages its patient alerts"
  on public.patient_alerts for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

-- ============================================================
-- Fase 2 / Etapa B: anamnese
-- Documento legal e imutável: o app nunca faz update nem delete físico aqui,
-- só insere um registro novo. As perguntas e respostas ficam num JSON (mesmo
-- formato guardado localmente), pra não precisar mudar o schema a cada campo novo.
-- ============================================================

create table if not exists public.anamnesis_templates (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  questions_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.anamnesis_templates enable row level security;
drop policy if exists "clinic manages its anamnesis templates" on public.anamnesis_templates;
create policy "clinic manages its anamnesis templates"
  on public.anamnesis_templates for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));

create table if not exists public.anamnesis_records (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  template_name text not null,
  questions_json jsonb not null,
  answers_json jsonb not null,
  filled_by_name text not null,
  filled_at timestamptz not null,
  signed_on_paper_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.anamnesis_records enable row level security;
drop policy if exists "clinic manages its anamnesis records" on public.anamnesis_records;
create policy "clinic manages its anamnesis records"
  on public.anamnesis_records for all
  using (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()))
  with check (clinic_id in (select id from public.clinics where auth_user_id = auth.uid()));
