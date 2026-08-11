create table if not exists public.simulation_messages (
  id bigserial primary key,
  session_id uuid not null,
  parent_type text,
  situation text,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Audio recordings are deliberately not stored; only transcript text and AI text are retained.
alter table public.simulation_messages add column if not exists attempt_id uuid;
alter table public.simulation_messages add column if not exists attempt_number integer not null default 1;
alter table public.simulation_messages add column if not exists teacher_type text;
alter table public.simulation_messages add column if not exists school_level text;
alter table public.simulation_messages add column if not exists input_mode text;
alter table public.simulation_messages drop constraint if exists simulation_messages_role_check;
alter table public.simulation_messages add constraint simulation_messages_role_check check (role in ('user', 'assistant', 'teacher', 'parent'));

create table if not exists public.simulation_evaluations (
  id bigserial primary key,
  session_id uuid not null,
  parent_type text,
  situation text,
  score integer check (score between 0 and 100),
  summary text,
  strengths jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  conversation jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.simulation_evaluations add column if not exists attempt_id uuid;
alter table public.simulation_evaluations add column if not exists attempt_number integer not null default 1;
alter table public.simulation_evaluations add column if not exists teacher_type text;
alter table public.simulation_evaluations add column if not exists school_level text;
alter table public.simulation_evaluations add column if not exists scaled_score numeric(6,2);

create table if not exists public.simulation_situations (
  id bigserial primary key,
  session_id uuid not null,
  parent_type text,
  situation_mode text check (situation_mode in ('random', 'manual')),
  situation text not null,
  privacy_acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.simulation_situations add column if not exists attempt_id uuid;
alter table public.simulation_situations add column if not exists attempt_number integer not null default 1;
alter table public.simulation_situations add column if not exists teacher_type text;
alter table public.simulation_situations add column if not exists school_level text;
alter table public.simulation_situations add column if not exists situation_context text;

create index if not exists simulation_messages_attempt_idx on public.simulation_messages (attempt_id, created_at);
create index if not exists simulation_evaluations_attempt_idx on public.simulation_evaluations (attempt_id, attempt_number);

alter table public.simulation_messages enable row level security;
alter table public.simulation_evaluations enable row level security;
alter table public.simulation_situations enable row level security;

grant usage on schema public to service_role;
grant all on table public.simulation_messages to service_role;
grant all on table public.simulation_evaluations to service_role;
grant all on table public.simulation_situations to service_role;
grant usage, select on sequence public.simulation_messages_id_seq to service_role;
grant usage, select on sequence public.simulation_evaluations_id_seq to service_role;
grant usage, select on sequence public.simulation_situations_id_seq to service_role;
