create table if not exists public.ai_free_trial_usages (
  id bigserial primary key,
  user_id uuid not null,
  used_at timestamptz not null default now()
);

create index if not exists ai_free_trial_usages_user_id_idx
  on public.ai_free_trial_usages (user_id, used_at desc);
