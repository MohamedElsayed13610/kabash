-- KABASH SAMPLE DATA. Every row is flagged is_sample = true.
-- Prices are PLACEHOLDERS: the owner replaces them from the admin dashboard.
-- Run after 0001_schema.sql. Safe to run once on an empty database.

-- ---------- categories ----------
insert into categories (type, name_ar, sort, is_sample) values
  ('restaurant', 'مندي',          1, true),
  ('restaurant', 'مدفون',         2, true),
  ('restaurant', 'برياني',        3, true),
  ('restaurant', 'مضغوط',         4, true),
  ('restaurant', 'صواني ومشاوي',  5, true),
  ('butcher',    'لحوم فريش',     1, true),
  ('butcher',    'مصنعات',        2, true),
  ('butcher',    'دجاج طازج',     3, true);

-- ---------- restaurant items (piece) ----------
insert into items (category_id, name_ar, description_ar, unit, base_price, min_qty, step_qty, serving_tag, featured, sort, is_sample)
select c.id, v.name_ar, v.descr, 'piece', v.price, 1, 1, v.tag, v.featured, v.sort, true
from (values
  ('مندي',         'مندي لحم',     'لحم ضاني على رز المندي المدخن، بنكهة الفحم والبهارات.',         250, 'الصينية تكفي ٤ أفراد', true,  1),
  ('مندي',         'مندي دجاج',    'دجاج مدخن على رز المندي، مع صلصة الدقوس.',                       140, 'الصينية تكفي ٢ فرد',  false, 2),
  ('مدفون',        'مدفون لحم',    'لحم مطهي ببطء في الفرن المدفون مع رز بالبهارات.',                 270, 'الصينية تكفي ٤ أفراد', true,  1),
  ('برياني',       'برياني دجاج',  'رز برياني بالبهارات الهندية مع دجاج متبل وبصل مقرمش.',            120, 'يكفي فرد ونص',        false, 1),
  ('برياني',       'برياني لحم',   'رز برياني بقطع اللحم الطرية والزعفران.',                          160, 'يكفي فرد ونص',        false, 2),
  ('مضغوط',        'مضغوط دجاج',   'دجاج مضغوط على رز بالسمن البلدي والبهارات الخليجية.',             130, 'الصينية تكفي ٢ فرد',  false, 1),
  ('صواني ومشاوي', 'صينية مشاوي',  'مشكل مشاوي على الفحم: كفتة وكباب وريش مع الأرز والسلطات.',        320, 'الصينية تكفي ٤ أفراد', true,  1)
) as v(cat, name_ar, descr, price, tag, featured, sort)
join categories c on c.name_ar = v.cat and c.is_sample;

-- sizes (variants) for the trays
insert into item_variants (item_id, name_ar, price_delta, sort)
select i.id, s.name_ar, s.delta, s.sort
from items i
cross join (values ('صغير', 0, 1), ('وسط', 90, 2), ('كبير', 180, 3)) as s(name_ar, delta, sort)
where i.is_sample and i.name_ar in ('مندي لحم', 'مدفون لحم', 'صينية مشاوي');

insert into item_extras (item_id, name_ar, price, sort)
select i.id, e.name_ar, e.price, e.sort
from items i
cross join (values ('سلطة زبادي', 15, 1), ('دقوس زيادة', 10, 2), ('مشروب', 15, 3)) as e(name_ar, price, sort)
where i.is_sample and i.category_id in (select id from categories where type = 'restaurant' and is_sample);

-- ---------- butcher items (per kg, 0.5 kg steps) ----------
insert into items (category_id, name_ar, description_ar, unit, base_price, min_qty, step_qty, featured, sort, is_sample)
select c.id, v.name_ar, v.descr, 'kg', v.price, 0.5, 0.5, v.featured, v.sort, true
from (values
  ('لحوم فريش',  'لحم كندوز',   'لحم كندوز طازج يوميًا، تقطيع حسب طلبك.',        420, true,  1),
  ('لحوم فريش',  'لحم ضاني',    'ضاني بلدي طازج، مناسب للمندي والمدفون.',         520, true,  2),
  ('مصنعات',     'كفتة',        'كفتة متبلة وجاهزة للشوي، تتصنع طازجة.',          380, false, 1),
  ('مصنعات',     'سجق',         'سجق بلدي متبل بخلطتنا.',                          360, false, 2),
  ('مصنعات',     'برجر',        'برجر لحم طازج بدون حشو.',                         400, false, 3),
  ('دجاج طازج',  'دجاج طازج',   'دجاج طازج يوميًا، كامل أو متقطع.',                 110, false, 1)
) as v(cat, name_ar, descr, price, featured, sort)
join categories c on c.name_ar = v.cat and c.is_sample;

-- ---------- delivery zones (SAMPLE: edit or delete from the admin) ----------
insert into delivery_zones (name_ar, fee, min_order, eta_minutes, sort, is_sample) values
  ('منطقة تجريبية ١ (قريبة)',  10, 0,   30, 1, true),
  ('منطقة تجريبية ٢',          20, 100, 45, 2, true),
  ('منطقة تجريبية ٣ (بعيدة)',  35, 200, 60, 3, true);

-- ---------- offers (SAMPLE) ----------
insert into offers (title_ar, description_ar, discount_type, discount_value, target_type, target_id, is_sample)
select 'خصم ١٠٪ على المندي', 'عرض تجريبي: خصم على كل أصناف المندي.', 'percent', 10, 'category', c.id, true
from categories c where c.name_ar = 'مندي' and c.is_sample;

insert into offers (title_ar, description_ar, discount_type, discount_value, target_type, is_sample) values
  ('وفّر ٣٠ جنيه على طلبك', 'عرض تجريبي: خصم ثابت على إجمالي السلة.', 'fixed', 30, 'cart', true);

-- ---------- settings (PLACEHOLDERS, no real phone numbers) ----------
insert into settings (key, value, is_public) values
  ('restaurant_info', jsonb_build_object(
      'name_ar', 'كباش',
      'address_ar', 'بني مزار – طريق الساحة – أمام كوب',
      'phone', '0XXXXXXXXXX',
      'whatsapp', '20XXXXXXXXXX',
      'social', jsonb_build_object('facebook', '', 'instagram', '')
   ), true),
  -- 0 = Sunday ... 6 = Saturday. Times are Africa/Cairo, 24h. SAMPLE hours.
  ('opening_hours', jsonb_build_object(
      'timezone', 'Africa/Cairo',
      'days', jsonb_build_array(
        jsonb_build_object('day', 0, 'open', '12:00', 'close', '01:00', 'closed', false),
        jsonb_build_object('day', 1, 'open', '12:00', 'close', '01:00', 'closed', false),
        jsonb_build_object('day', 2, 'open', '12:00', 'close', '01:00', 'closed', false),
        jsonb_build_object('day', 3, 'open', '12:00', 'close', '01:00', 'closed', false),
        jsonb_build_object('day', 4, 'open', '12:00', 'close', '01:00', 'closed', false),
        jsonb_build_object('day', 5, 'open', '12:00', 'close', '01:00', 'closed', false),
        jsonb_build_object('day', 6, 'open', '12:00', 'close', '01:00', 'closed', false)
      )
   ), true),
  -- 'auto' follows opening_hours; 'open' / 'closed' force the state.
  ('open_override', to_jsonb('auto'::text), true),
  -- When closed: false = show a closed message and block checkout (default).
  ('accept_orders_when_closed', 'false'::jsonb, true),
  -- null = no free delivery. Otherwise a cart total in EGP.
  ('free_delivery_threshold', 'null'::jsonb, true),
  ('announcement_ar', to_jsonb(''::text), true);
