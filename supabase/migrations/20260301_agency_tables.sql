-- Scale With JAK Agency Tables

create table if not exists agency_prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  email text,
  owner_first_name text,
  specific_service text,
  website_score int,          -- 1-10, lower = worse site = better lead
  is_outdated boolean default true,
  outdated_reason text,
  preview_blurred_url text,   -- Supabase storage URL
  preview_full_url text,
  mockup_html text,           -- raw generated HTML
  status text default 'discovered',
  -- discovered | emailed | replied | demo_sent | invoiced | paid | building | delivered | lost
  niche text,
  city text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists agency_outreach (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references agency_prospects(id) on delete cascade,
  sequence_step int not null,  -- 1=initial blurred, 2=followup day3, 3=final day7
  resend_email_id text,
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  reply_text text,
  reply_intent text,           -- interested | objection | not_interested | question
  created_at timestamptz default now()
);

create table if not exists agency_projects (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references agency_prospects(id),
  tier int not null default 1, -- 1=Growth Engine, 2=Fulltime AI, 3=Transformation Partner
  stripe_payment_id text,
  stripe_invoice_url text,
  amount_cents int,
  site_url text,               -- deployed Vercel URL
  comms_channel text default 'email', -- whatsapp | telegram | email
  comms_contact text,          -- phone for WA/TG, email for email
  status text default 'paid',  -- paid | building | review | delivered
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_agency_prospects_status on agency_prospects(status);
create index if not exists idx_agency_prospects_email on agency_prospects(email);
create index if not exists idx_agency_outreach_prospect on agency_outreach(prospect_id);
create index if not exists idx_agency_projects_prospect on agency_projects(prospect_id);

-- Auto-update updated_at
create or replace function update_agency_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists agency_prospects_updated_at on agency_prospects;
create trigger agency_prospects_updated_at
  before update on agency_prospects
  for each row execute function update_agency_updated_at();

drop trigger if exists agency_projects_updated_at on agency_projects;
create trigger agency_projects_updated_at
  before update on agency_projects
  for each row execute function update_agency_updated_at();
