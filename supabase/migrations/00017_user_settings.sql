-- Add email column to public.users
alter table public.users add column email text;

-- Update trigger to also store email from Google OAuth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, google_account_id, email)
  values (new.id, new.raw_user_meta_data ->> 'sub', new.raw_user_meta_data ->> 'email');
  return new;
end;
$$;

-- Backfill email for existing users (function is SECURITY DEFINER, can read auth.users)
update public.users u
set email = (select email from auth.users au where au.id = u.id)
where email is null;
