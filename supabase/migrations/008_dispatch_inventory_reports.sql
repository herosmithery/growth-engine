-- ============================================================
-- Migration 008: Dispatch, Inventory & Field Reports tables
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- INVENTORY ITEMS
-- ─────────────────────────────────────────────────────────────
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  category text not null,           -- Vaccines | Surgical | Medications | Diagnostics | Injectables | Skincare | Laser
  item text not null,
  qty numeric not null default 0,
  unit text not null default 'units',
  threshold_warn numeric not null default 20,
  threshold_crit numeric not null default 8,
  reorder_qty numeric not null default 50,
  supplier_url text,
  cost_per_unit numeric,
  last_reordered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_inventory_business on inventory_items(business_id);
create index if not exists idx_inventory_category on inventory_items(category);

-- ─────────────────────────────────────────────────────────────
-- FIELD REPORTS (Voice note → AI report → Stripe invoice)
-- ─────────────────────────────────────────────────────────────
create table if not exists field_reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  client_id uuid references clients(id),
  appointment_id uuid references appointments(id),
  provider_name text,
  service_name text,
  voice_transcript text,            -- raw voice note text
  ai_notes text,                    -- parsed structured notes
  upsell text,                      -- AI-identified upsell opportunity
  has_upsell boolean default false,
  follow_up_required boolean default false,
  follow_up_scheduled_for timestamptz,
  invoice_amount numeric,
  invoice_status text default 'pending', -- pending | sent | paid
  stripe_invoice_url text,
  stripe_payment_intent_id text,
  report_id text,                   -- human-readable RPT-YYYYMMDD-HHMMSS
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_field_reports_business on field_reports(business_id);
create index if not exists idx_field_reports_client on field_reports(client_id);
create index if not exists idx_field_reports_created on field_reports(created_at desc);

-- ─────────────────────────────────────────────────────────────
-- DAILY SCHEDULE CACHE (Dispatch page — stores AI optimized order)
-- ─────────────────────────────────────────────────────────────
create table if not exists daily_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  schedule_date date not null default current_date,
  appointment_id uuid references appointments(id),
  optimized_order int,
  sms_sent_at timestamptz,
  sms_status text,                  -- sent | failed | pending
  created_at timestamptz default now()
);

create unique index if not exists idx_daily_schedule_unique
  on daily_schedules(business_id, schedule_date, appointment_id);

-- ─────────────────────────────────────────────────────────────
-- SEED: Vet Clinic inventory for default business
-- ─────────────────────────────────────────────────────────────
insert into inventory_items (business_id, category, item, qty, unit, threshold_warn, threshold_crit, reorder_qty)
select
  id,
  cat, itm, qty::numeric, unt, warn::numeric, crit::numeric, reorder::numeric
from
  (values
    ('Vaccines',     'Rabies vaccine',           8,  'doses', 25, 10, 50),
    ('Vaccines',     'DHPP vaccine',             30, 'doses', 25, 10, 50),
    ('Vaccines',     'Bordetella',               45, 'doses', 20,  8, 40),
    ('Surgical',     'Suture packs (3-0 Vicryl)', 4, 'packs', 15,  5, 20),
    ('Surgical',     'IV fluids (1L bags)',        6, 'bags',  12,  5, 24),
    ('Surgical',     'Surgical gloves',           40, 'pairs', 20,  8, 50),
    ('Medications',  'Apoquel',                  200,'tablets',50, 20,100),
    ('Medications',  'Carprofen',                 12,'tablets',30, 10, 60),
    ('Diagnostics',  'Heartworm test kits',       22, 'kits',  20,  8, 30),
    ('Diagnostics',  'Parvo test kits',            7, 'kits',  15,  5, 20)
  ) as v(cat, itm, qty, unt, warn, crit, reorder),
  businesses
where businesses.id = 'ab445992-80fd-46d0-bec0-138a86e1d607'::uuid
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- Auto-update updated_at triggers
-- ─────────────────────────────────────────────────────────────
create or replace function update_timestamp()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists inventory_items_updated_at on inventory_items;
create trigger inventory_items_updated_at
  before update on inventory_items
  for each row execute function update_timestamp();

drop trigger if exists field_reports_updated_at on field_reports;
create trigger field_reports_updated_at
  before update on field_reports
  for each row execute function update_timestamp();

-- RLS: Allow service role full access
alter table inventory_items enable row level security;
alter table field_reports enable row level security;
alter table daily_schedules enable row level security;

create policy "service_role_inventory" on inventory_items
  for all using (true) with check (true);
create policy "service_role_field_reports" on field_reports
  for all using (true) with check (true);
create policy "service_role_daily_schedules" on daily_schedules
  for all using (true) with check (true);
