-- Cherry Design & Build: lead database.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste this -> Run.
-- Row Level Security is ON with no public policies, so only the website's server function
-- (using the secret service key) can read or write. Nothing is reachable from a browser.

create sequence if not exists project_ref_seq start 1;

create table if not exists customers (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text not null unique,
  phone       text not null,
  postcode    text not null,
  consent     boolean not null default false
);

create table if not exists projects (
  id             bigint generated always as identity primary key,
  ref            text unique,
  created_at     timestamptz not null default now(),
  submission_id  uuid not null unique,          -- stops double submissions
  customer_id    bigint not null references customers(id),
  project_type   text not null,                 -- 'ext' or 'loft'
  description    text not null,                 -- e.g. 'single-storey rear extension'
  house_type     text,
  selections     jsonb not null,                -- every calculator choice, after server checks
  lines          jsonb not null,                -- itemised estimate as shown to the customer
  area_m2        numeric,
  estimate_low   integer not null,
  estimate_high  integer not null,
  estimate_total integer not null,
  planning       text,
  page           text,                          -- which page the lead came from
  lead_source    text not null default 'website calculator',
  status         text not null default 'New enquiry',
  update_count   integer not null default 0,    -- times the customer re-priced after the reveal
  updated_at     timestamptz,
  ip_hash        text,                          -- hashed, used only for spam limits
  pdf_path       text,                          -- filled in Stage 3
  customer_emailed_at timestamptz,              -- Stage 4
  internal_emailed_at timestamptz,              -- Stage 4
  crm_deal_id    text                           -- Stage 5
);

create index if not exists projects_ip_time on projects (ip_hash, created_at);

-- Reference numbers: CDB-2026-0001, CDB-2026-0002 ...
create or replace function set_project_ref() returns trigger language plpgsql as $$
begin
  if new.ref is null then
    new.ref := 'CDB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('project_ref_seq')::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists projects_ref on projects;
create trigger projects_ref before insert on projects for each row execute function set_project_ref();

alter table customers enable row level security;
alter table projects  enable row level security;
