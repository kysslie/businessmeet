-- PROPOSED, NOT APPLIED: waits for Elie's approval because it renames and moves EXISTING rows.
-- To apply it after approval: move this file into supabase/migrations/, update the category and
-- skill counts in supabase/tests/rls_smoke_test.sql (9 categories, 67 skills), then run
-- `npx supabase@2.117.0 db push`.
--
-- Elie's decisions, 2026-09-20 (A and answer 1): the launch list has nine categories with
-- French names, and skill names are French too (the whole app is French only).
--
-- What this changes in existing data:
--   * 7 categories are renamed and re-ordered (slugs stay, so nothing that points at them breaks)
--   * 2 categories are added: Artisanat & BTP and Commerce de proximité
--   * 7 trade skills move from Services locaux to Artisanat & BTP
--   * every existing skill is renamed to French (slugs stay)
--   * 7 skills are added for Commerce de proximité
--   * profiles that already offer or seek a trade skill get the Artisanat & BTP category, so
--     the skill they picked stays visible in their form; the two demo profiles get both new
--     categories (they have "everything ticked")
-- Nothing is deleted.

-- 1. Categories: rename, re-order, add. All nine are active.
update public.categories set name = 'Services locaux',              sort_order = 1 where slug = 'local_services';
update public.categories set name = 'Restauration & alimentation',  sort_order = 3 where slug = 'food';
update public.categories set                                         sort_order = 4 where slug = 'ecommerce';
update public.categories set name = 'Contenu & médias',             sort_order = 6 where slug = 'content_media';
update public.categories set name = 'Applis & logiciels',           sort_order = 7 where slug = 'apps_software';
update public.categories set name = 'Jeux vidéo',                   sort_order = 8 where slug = 'video_games';
update public.categories set name = 'Autre',                        sort_order = 9 where slug = 'other';

insert into public.categories (slug, name, is_active, sort_order) values
  ('artisanat_btp',      'Artisanat & BTP',        true, 2),
  ('commerce_proximite', 'Commerce de proximité',  true, 5)
on conflict (slug) do nothing;

-- 2. The trade skills move to Artisanat & BTP.
update public.skills
set category_id = (select id from public.categories where slug = 'artisanat_btp')
where slug in ('safety_compliance', 'plumbing', 'electrical', 'carpentry',
               'painting_finishing', 'tiling_masonry', 'hvac');

-- 3. New skills for Commerce de proximité.
insert into public.skills (slug, name, category_id)
select v.slug, v.name, c.id
from (values
  ('shop_merchandising',  'Merchandising et agencement'),
  ('buying_stock',        'Achats et gestion des stocks'),
  ('pos_cash',            'Caisse et encaissement'),
  ('local_partnerships',  'Partenariats locaux'),
  ('customer_loyalty',    'Fidélisation client'),
  ('markets_popups',      'Marchés et boutiques éphémères'),
  ('shop_lease',          'Bail commercial et local')
) as v (slug, name)
join public.categories c on c.slug = 'commerce_proximite'
on conflict (slug) do nothing;

-- 4. Every skill name in French (matched by slug).
update public.skills s
set name = v.name
from (values
  -- pour toute activité
  ('marketing',            'Marketing'),
  ('community_management', 'Animation de communauté'),
  ('sales',                'Vente'),
  ('finance_admin',        'Finance et administration'),
  ('project_management',   'Gestion de projet'),
  ('business_planning',    'Business plan'),
  ('legal_registration',   'Démarches juridiques et création d''entreprise'),
  ('branding_design',      'Image de marque et design'),
  ('website_presence',     'Site web et présence en ligne'),
  -- services locaux
  ('hands_on_service',     'Prestation de service sur le terrain'),
  ('scheduling_dispatch',  'Planning et organisation des interventions'),
  ('quoting_estimating',   'Devis et chiffrage'),
  ('customer_service',     'Relation client'),
  ('local_marketing',      'Communication locale'),
  ('vehicles_equipment',   'Véhicules et matériel'),
  ('insurance_permits',    'Assurances et autorisations'),
  -- artisanat & BTP
  ('safety_compliance',    'Normes de sécurité et habilitations'),
  ('plumbing',             'Plomberie'),
  ('electrical',           'Électricité'),
  ('carpentry',            'Menuiserie'),
  ('painting_finishing',   'Peinture et finitions'),
  ('tiling_masonry',       'Carrelage et maçonnerie'),
  ('hvac',                 'Chauffage et climatisation'),
  -- restauration & alimentation
  ('cooking_recipes',      'Cuisine et création de recettes'),
  ('baking_pastry',        'Boulangerie-pâtisserie'),
  ('food_safety',          'Hygiène et sécurité alimentaire (HACCP)'),
  ('sourcing_suppliers',   'Approvisionnement et fournisseurs'),
  ('front_of_house',       'Service en salle'),
  ('food_photography',     'Photographie culinaire'),
  ('packaging_labelling',  'Emballage et étiquetage'),
  ('events_catering',      'Événementiel et traiteur'),
  -- e-commerce
  ('product_sourcing',     'Sourcing de produits'),
  ('online_store_setup',   'Création de boutique en ligne'),
  ('product_photography',  'Photographie produit'),
  ('copywriting',          'Rédaction commerciale'),
  ('paid_ads',             'Publicité en ligne'),
  ('logistics_fulfilment', 'Logistique et expédition'),
  ('customer_support',     'Service client'),
  ('inventory_pricing',    'Stocks et prix'),
  -- contenu & médias
  ('content_writing',      'Rédaction et édition'),
  ('video_editing',        'Montage vidéo'),
  ('photography',          'Photographie'),
  ('podcasting_audio',     'Podcast et audio'),
  ('social_media_content', 'Contenus pour les réseaux sociaux'),
  ('graphic_design',       'Design graphique'),
  -- applis & logiciels
  ('web_development',      'Développement web'),
  ('mobile_development',   'Développement d''applications mobiles'),
  ('ux_ui_design',         'Design UX/UI'),
  ('data_analytics',       'Données et analyse'),
  ('software_testing',     'Tests logiciels'),
  ('devops_hosting',       'Hébergement et DevOps'),
  -- jeux vidéo
  ('game_programming',     'Programmation de jeux'),
  ('game_design',          'Game design'),
  ('level_design',         'Level design'),
  ('art_2d',               'Art 2D'),
  ('art_3d',               'Art 3D'),
  ('animation',            'Animation'),
  ('audio_music',          'Audio et musique'),
  ('writing_narrative',    'Écriture et narration'),
  ('qa_testing',           'Tests et assurance qualité')
) as v (slug, name)
where s.slug = v.slug;

-- 5. Keep people's saved trade skills visible: anyone who offers or seeks a trade skill also
-- gets the Artisanat & BTP category; the demo profiles get both new categories.
insert into public.profile_categories (profile_id, category_id)
select distinct ps.profile_id, c.id
from public.profile_skills ps
join public.skills s on s.id = ps.skill_id
join public.categories c on c.slug = 'artisanat_btp'
where s.category_id = c.id
on conflict do nothing;

insert into public.profile_categories (profile_id, category_id)
select p.id, c.id
from public.profiles p
cross join public.categories c
where p.is_demo and c.slug in ('artisanat_btp', 'commerce_proximite')
on conflict do nothing;
