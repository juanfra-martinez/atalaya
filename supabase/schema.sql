-- Atalaya · cuentas opcionales (Supabase)
-- Pégalo en el panel de Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.
--
-- Una fila por dato del jugador (clave de A.store, p. ej. "homes" o "rules:ts7.x1.international.travian.com").
-- Cada usuario solo ve y modifica sus filas (Row Level Security). Gana la escritura más reciente de cada clave.

create table if not exists public.user_data (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key        text        not null check (char_length(key) between 1 and 200),
  value      jsonb,
  updated_at timestamptz not null default now(),   -- cuándo cambió el dato en el dispositivo
  synced_at  timestamptz not null default now(),   -- cuándo llegó aquí (lo pone el servidor)
  primary key (user_id, key),
  constraint user_data_value_size check (pg_column_size(value) <= 1048576)
);
create index if not exists user_data_user_synced on public.user_data (user_id, synced_at);

alter table public.user_data enable row level security;

drop policy if exists "user_data: leer lo propio" on public.user_data;
drop policy if exists "user_data: crear lo propio" on public.user_data;
drop policy if exists "user_data: cambiar lo propio" on public.user_data;
drop policy if exists "user_data: borrar lo propio" on public.user_data;
create policy "user_data: leer lo propio" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_data: crear lo propio" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_data: cambiar lo propio" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_data: borrar lo propio" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;

-- Hora de llegada, "gana el más reciente" y cuota por usuario (para que nadie llene la base gratuita de 500 MB).
create or replace function public.user_data_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.synced_at := now();
  if new.updated_at > now() + interval '1 day' then
    new.updated_at := now();  -- un reloj adelantado no puede ganar para siempre
  end if;
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;              -- ya hay una versión más reciente: se ignora esta escritura
  end if;
  if (select count(*) from public.user_data where user_id = new.user_id and key <> new.key) >= 2000 then
    raise exception 'atalaya: demasiadas claves para este usuario';
  end if;
  if (select coalesce(sum(pg_column_size(value)), 0) from public.user_data where user_id = new.user_id and key <> new.key)
     + coalesce(pg_column_size(new.value), 0) > 25 * 1024 * 1024 then
    raise exception 'atalaya: se ha superado el espacio por usuario (25 MB)';
  end if;
  return new;
end $$;

drop trigger if exists user_data_guard on public.user_data;
create trigger user_data_guard before insert or update on public.user_data
  for each row execute function public.user_data_guard();

-- Derecho de supresión (RGPD): el propio usuario borra su cuenta desde la web; sus filas se van con ella (on delete cascade).
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
