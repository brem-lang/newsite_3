-- Demo catalogue so the storefront is not empty on first visit.
insert into public.categories (name, slug, color, icon, description, sort_order)
values
  ('إلكترونيات', 'electronics', '#22d3ee', 'Smartphone', 'هواتف وحواسيب وأجهزة ذكية', 1),
  ('ساعات', 'watches', '#f59e0b', 'Watch', 'ساعات فاخرة وكلاسيكية', 2),
  ('سيارات', 'cars', '#ef4444', 'Car', 'سيارات ومركبات', 3),
  ('مجوهرات', 'jewellery', '#a855f7', 'Gem', 'ذهب وألماس ومجوهرات', 4)
on conflict do nothing;

insert into public.brands (name, slug, sort_order)
values ('Apple','apple',1), ('Samsung','samsung',2), ('Rolex','rolex',3), ('Sony','sony',4)
on conflict do nothing;

insert into public.auctions
  (title, description, image_url, category_id, brand_id, entry_fee, max_subscribers,
   start_price, current_price, bid_increment, duration_minutes, status, scheduled_start_time)
values
  ('iPhone 16 Pro Max 512GB', 'جديد بالكرتون مع ضمان سنة.',
   'https://images.unsplash.com/photo-1592286927505-1def25115558?w=1200&q=80',
   (select id from public.categories where slug='electronics'),
   (select id from public.brands where slug='apple'),
   10, 20, 100, 100, 5, 10, 'open', now() + interval '1 hour'),
  ('Rolex Submariner Date', 'ساعة أصلية بحالة ممتازة مع العلبة والأوراق.',
   'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=1200&q=80',
   (select id from public.categories where slug='watches'),
   (select id from public.brands where slug='rolex'),
   25, 15, 5000, 5000, 100, 15, 'open', now() + interval '3 hours'),
  ('PlayStation 5 Pro', 'مع ذراعين وثلاث ألعاب.',
   'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=1200&q=80',
   (select id from public.categories where slug='electronics'),
   (select id from public.brands where slug='sony'),
   5, 30, 50, 50, 5, 10, 'open', now() + interval '30 minutes'),
  ('Samsung Galaxy S25 Ultra', 'لون تيتانيوم، 1 تيرابايت.',
   'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=1200&q=80',
   (select id from public.categories where slug='electronics'),
   (select id from public.brands where slug='samsung'),
   10, 20, 80, 80, 5, 10, 'open', now() + interval '2 hours'),
  ('طقم ألماس 18 قيراط', 'قلادة وأقراط بشهادة أصالة.',
   'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1200&q=80',
   (select id from public.categories where slug='jewellery'),
   null,
   20, 12, 1200, 1200, 50, 12, 'open', now() + interval '5 hours');