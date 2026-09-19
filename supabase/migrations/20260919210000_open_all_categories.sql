-- Elie's decision, 2026-09-19: the main audience is first-time founders starting a small,
-- non-tech business (local services, trades, food, e-commerce), and ALL categories are open.
-- This is only data (no structure change): categories become active, "trades" is folded into
-- Local services, and every category gets its own skills. Everything here can be edited later
-- from the dashboard (rows of `categories` and `skills`) without touching code.

-- 1. Open every category. Order shown in the picker follows the new focus.
update public.categories set is_active = true;

update public.categories set sort_order = 1, name = 'Local services & trades' where slug = 'local_services';
update public.categories set sort_order = 2 where slug = 'food';
update public.categories set sort_order = 3 where slug = 'ecommerce';
update public.categories set sort_order = 4 where slug = 'content_media';
update public.categories set sort_order = 5 where slug = 'apps_software';
update public.categories set sort_order = 6 where slug = 'video_games';
update public.categories set sort_order = 7 where slug = 'other';

-- 2. More universal skills (offered for every category), useful to any first-time founder.
insert into public.skills (slug, name, category_id) values
  ('business_planning',  'Business planning',              null),
  ('legal_registration', 'Legal & business registration',  null),
  ('branding_design',    'Branding & design',              null),
  ('website_presence',   'Website & online presence',      null)
on conflict (slug) do nothing;

-- 3. Skills per category. ("Other" has none: it only shows the universal skills.)
insert into public.skills (slug, name, category_id)
select v.slug, v.name, c.id
from (values
  -- Local services & trades
  ('local_services', 'hands_on_service',    'Hands-on service work'),
  ('local_services', 'scheduling_dispatch', 'Scheduling & dispatch'),
  ('local_services', 'quoting_estimating',  'Quoting & estimating'),
  ('local_services', 'customer_service',    'Customer service'),
  ('local_services', 'local_marketing',     'Local marketing'),
  ('local_services', 'vehicles_equipment',  'Vehicles & equipment'),
  ('local_services', 'insurance_permits',   'Insurance & permits'),
  ('local_services', 'safety_compliance',   'Licences & safety compliance'),
  ('local_services', 'plumbing',            'Plumbing'),
  ('local_services', 'electrical',          'Electrical'),
  ('local_services', 'carpentry',           'Carpentry'),
  ('local_services', 'painting_finishing',  'Painting & finishing'),
  ('local_services', 'tiling_masonry',      'Tiling & masonry'),
  ('local_services', 'hvac',                'Heating & air conditioning'),
  -- Food
  ('food', 'cooking_recipes',      'Cooking & recipe development'),
  ('food', 'baking_pastry',        'Baking & pastry'),
  ('food', 'food_safety',          'Food safety & hygiene rules'),
  ('food', 'sourcing_suppliers',   'Sourcing & suppliers'),
  ('food', 'front_of_house',       'Front of house & service'),
  ('food', 'food_photography',     'Food photography'),
  ('food', 'packaging_labelling',  'Packaging & labelling'),
  ('food', 'events_catering',      'Events & catering'),
  -- E-commerce
  ('ecommerce', 'product_sourcing',     'Product sourcing'),
  ('ecommerce', 'online_store_setup',   'Online store setup'),
  ('ecommerce', 'product_photography',  'Product photography'),
  ('ecommerce', 'copywriting',          'Copywriting'),
  ('ecommerce', 'paid_ads',             'Paid ads'),
  ('ecommerce', 'logistics_fulfilment', 'Logistics & fulfilment'),
  ('ecommerce', 'customer_support',     'Customer support'),
  ('ecommerce', 'inventory_pricing',    'Inventory & pricing'),
  -- Content/media
  ('content_media', 'content_writing',       'Writing & editing'),
  ('content_media', 'video_editing',         'Video editing'),
  ('content_media', 'photography',           'Photography'),
  ('content_media', 'podcasting_audio',      'Podcasting & audio'),
  ('content_media', 'social_media_content',  'Social media content'),
  ('content_media', 'graphic_design',        'Graphic design'),
  -- Apps/software
  ('apps_software', 'web_development',     'Web development'),
  ('apps_software', 'mobile_development',  'Mobile app development'),
  ('apps_software', 'ux_ui_design',        'UX/UI design'),
  ('apps_software', 'data_analytics',      'Data & analytics'),
  ('apps_software', 'software_testing',    'Software testing'),
  ('apps_software', 'devops_hosting',      'Hosting & DevOps')
) as v (category_slug, slug, name)
join public.categories c on c.slug = v.category_slug
on conflict (slug) do nothing;
