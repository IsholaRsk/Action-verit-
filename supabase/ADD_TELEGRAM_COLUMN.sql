-- Ajout Telegram associé au produit - à exécuter dans Supabase SQL Editor
alter table public.products add column if not exists telegram_link text;
alter table public.products add column if not exists telegram_username text;
-- Exemple mise à jour produit existant
-- update public.products set telegram_username='@nomducompte' where id='...';
-- ou update public.products set telegram_link='https://t.me/nomducompte' where id='...';
select id, nom, telegram_username, telegram_link from public.products limit 10;
