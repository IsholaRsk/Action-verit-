-- ============================================
-- EscortHub - SEED DATA (optionnel)
-- ============================================

-- Exemple produits
insert into public.products (nom, age, lieu, prix, image) values
('Sophia', 23, 'Cotonou', 150, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400'),
('Maya', 25, 'Abomey-Calavi', 200, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'),
('Chloé', 22, 'Porto-Novo', 120, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400'),
('Inès', 26, 'Parakou', 180, 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400')
on conflict do nothing;

-- Setting déjà inséré dans schema.sql, mais au cas où:
insert into public.settings (key, value) values ('payment_redirect_url','https://t.me/Polarish87')
on conflict (key) do update set value = excluded.value;
