-- F1, migration 3 of 3: starting data.
-- Only "Video games" is active at launch. To open another category later, run
--   update public.categories set is_active = true where slug = '...';
-- and add that category's skills with an insert like the video-games one below.
-- No code change is needed.

insert into public.categories (slug, name, is_active, sort_order) values
  ('video_games',    'Video games',   true,  1),
  ('local_services', 'Local services', false, 2),
  ('ecommerce',      'E-commerce',    false, 3),
  ('content_media',  'Content/media', false, 4),
  ('apps_software',  'Apps/software', false, 5),
  ('food',           'Food',          false, 6),
  ('other',          'Other',         false, 7)
on conflict (slug) do nothing;

-- Universal skills (category_id null): offered for every category.
insert into public.skills (slug, name, category_id) values
  ('marketing',            'Marketing',            null),
  ('community_management', 'Community management', null),
  ('sales',                'Sales',                null),
  ('finance_admin',        'Finance/admin',        null),
  ('project_management',   'Project management',   null)
on conflict (slug) do nothing;

-- Video games skills.
insert into public.skills (slug, name, category_id)
select v.slug, v.name, c.id
from (values
  ('game_programming',  'Game programming'),
  ('game_design',       'Game design'),
  ('level_design',      'Level design'),
  ('art_2d',            '2D art'),
  ('art_3d',            '3D art'),
  ('animation',         'Animation'),
  ('audio_music',       'Audio/music'),
  ('writing_narrative', 'Writing/narrative'),
  ('qa_testing',        'QA/testing')
) as v (slug, name)
cross join public.categories c
where c.slug = 'video_games'
on conflict (slug) do nothing;
