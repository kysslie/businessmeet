-- Security smoke test for the F1 schema. Safe to run any time.
--
-- Run it with:  npx supabase@2.117.0 db query --linked -f supabase/tests/rls_smoke_test.sql
-- (or paste it into the Supabase dashboard SQL Editor and click Run).
--
-- It creates three fake users (alice, bob, carol), then tries a long list of things
-- each of them (and a logged-out visitor) should and should not be able to do.
-- Every step says what it expects: `rows=N` (the statement worked and touched N rows)
-- or `error=text` (the statement must fail with an error containing that text).
--
-- The script ALWAYS finishes by raising an error on purpose. That undoes everything
-- it did, so no test data is left behind. The error text is the report:
-- one PASS/FAIL line per check. Read the report, not the "error" itself.
do $test$
declare
  alice constant uuid := '00000000-0000-0000-0000-0000000000a1';
  bob   constant uuid := '00000000-0000-0000-0000-0000000000b2';
  carol constant uuid := '00000000-0000-0000-0000-0000000000c3';
  dave  constant uuid := '00000000-0000-0000-0000-0000000000d4';
  erin  constant uuid := '00000000-0000-0000-0000-0000000000e5';
  frank constant uuid := '00000000-0000-0000-0000-0000000000f6';
  gina  constant uuid := '00000000-0000-0000-0000-0000000000a7';
  hank  constant uuid := '00000000-0000-0000-0000-0000000000b8';
  ivan  constant uuid := '00000000-0000-0000-0000-0000000000c9';
  judy  constant uuid := '00000000-0000-0000-0000-0000000000d1';
  kim   constant uuid := '00000000-0000-0000-0000-0000000000e2';
  matchid constant uuid := '11111111-1111-1111-1111-111111111111';
  conv  constant uuid := '22222222-2222-2222-2222-222222222222';
  conv2 constant uuid := '33333333-3333-3333-3333-333333333333';
  paris constant uuid := '00000000-0000-0000-0000-0000000000f1';
  boulogne constant uuid := '00000000-0000-0000-0000-0000000000f2';
  lyona constant uuid := '00000000-0000-0000-0000-0000000000f3';
  lyonb constant uuid := '00000000-0000-0000-0000-0000000000f4';
  people jsonb := jsonb_build_object('alice', alice, 'bob', bob, 'carol', carol, 'dave', dave,
    'erin', erin, 'frank', frank, 'gina', gina, 'hank', hank, 'ivan', ivan, 'judy', judy, 'kim', kim,
    'paris', paris, 'boulogne', boulogne, 'lyona', lyona, 'lyonb', lyonb);
  who_key text;
  tests jsonb := $j$[
    {"n":"setup: create 3 fake users","as":"admin","sql":"insert into auth.users (id, aud, role, email) values ('{alice}','authenticated','authenticated','alice@test.invalid'), ('{bob}','authenticated','authenticated','bob@test.invalid'), ('{carol}','authenticated','authenticated','carol@test.invalid')","expect":"rows=3"},
    {"n":"isolation: real people are hidden from the feed for the duration of this test (rolled back at the end)","as":"admin","sql":"with hidden as (update public.profiles set onboarded = false where id not in ('{alice}','{bob}','{carol}') returning 1) select 1 where false","expect":"rows=0"},
    {"n":"sign-up trigger creates an empty profile for each user","as":"admin","sql":"select 1 from public.profiles where id in ('{alice}','{bob}','{carol}') and onboarded = false","expect":"rows=3"},
    {"n":"profiles: alice completes her own profile (remote, France)","as":"alice","sql":"update public.profiles set display_name='Alice', work_modes=array['remote'], country='FR', idea_statuses=array['exploring'], weekly_hours=array['5_10'], ambitions=array['for_fun'], onboarded=true where id='{alice}'","expect":"rows=1"},
    {"n":"profiles: bob completes his own profile with several answers per question (remote, Lebanon)","as":"bob","sql":"update public.profiles set display_name='Bob', work_modes=array['remote'], country='LB', idea_statuses=array['wants_to_join','open_to_merge'], weekly_hours=array['10_20','20_plus'], ambitions=array['side_income','full_time'], onboarded=true where id='{bob}'","expect":"rows=1"},
    {"n":"profiles: alice cannot edit bob's profile","as":"alice","sql":"update public.profiles set display_name='Hacked' where id='{bob}'","expect":"rows=0"},
    {"n":"profiles: nobody can change the id column","as":"alice","sql":"update public.profiles set id='{carol}' where id='{alice}'","expect":"error=permission denied"},
    {"n":"profiles: cannot mark onboarded with missing fields","as":"carol","sql":"update public.profiles set onboarded=true where id='{carol}'","expect":"error=profiles_onboarded_complete"},
    {"n":"profiles: taking Local without a city is rejected","as":"carol","sql":"update public.profiles set display_name='C', work_modes=array['local'], country='FR', idea_statuses=array['exploring'], weekly_hours=array['lt_5'], ambitions=array['for_fun'], onboarded=true where id='{carol}'","expect":"error=profiles_onboarded_complete"},
    {"n":"profiles: Local in France without a postal code is rejected","as":"carol","sql":"update public.profiles set display_name='C', work_modes=array['local'], country='FR', city='Paris', idea_statuses=array['exploring'], weekly_hours=array['lt_5'], ambitions=array['for_fun'], onboarded=true where id='{carol}'","expect":"error=profiles_onboarded_complete"},
    {"n":"profiles: a postal code must be exactly 5 digits","as":"carol","sql":"update public.profiles set postal_code='7501' where id='{carol}'","expect":"error=profiles_postal_code_format"},
    {"n":"profiles: a postal code with letters is rejected","as":"carol","sql":"update public.profiles set postal_code='75O11' where id='{carol}'","expect":"error=profiles_postal_code_format"},
    {"n":"profiles: a valid postal code can be saved","as":"carol","sql":"update public.profiles set postal_code='75011' where id='{carol}'","expect":"rows=1"},
    {"n":"profiles: the owner can read their own postal code through the function","as":"carol","sql":"select 1 where public.get_my_postal_code() = '75011'","expect":"rows=1"},
    {"n":"profiles: onboarding without a country is rejected","as":"carol","sql":"update public.profiles set display_name='C', work_modes=array['remote'], idea_statuses=array['exploring'], weekly_hours=array['lt_5'], ambitions=array['for_fun'], onboarded=true where id='{carol}'","expect":"error=profiles_onboarded_complete"},
    {"n":"profiles: onboarding with an empty list of work modes is rejected","as":"carol","sql":"update public.profiles set display_name='C', work_modes=array[]::text[], country='FR', idea_statuses=array['exploring'], weekly_hours=array['lt_5'], ambitions=array['for_fun'], onboarded=true where id='{carol}'","expect":"error=profiles_onboarded_complete"},
    {"n":"profiles: having an idea (among other answers) without a pitch is rejected","as":"carol","sql":"update public.profiles set display_name='C', work_modes=array['remote'], country='FR', idea_statuses=array['has_idea','open_to_merge'], weekly_hours=array['lt_5'], ambitions=array['for_fun'], onboarded=true where id='{carol}'","expect":"error=profiles_onboarded_complete"},
    {"n":"profiles: pitch over 280 characters is rejected","as":"carol","sql":"update public.profiles set pitch=repeat('x',281) where id='{carol}'","expect":"error=profiles_pitch_length"},
    {"n":"profiles: several answers per question are accepted (before onboarding)","as":"carol","sql":"update public.profiles set work_modes=array['remote','local'], idea_statuses=array['has_idea','wants_to_join','open_to_merge','exploring'], weekly_hours=array['5_10','10_20'], ambitions=array['for_fun','side_income','full_time'] where id='{carol}'","expect":"rows=1"},
    {"n":"profiles: partner hours can be set to several ranges","as":"carol","sql":"update public.profiles set partner_weekly_hours=array['10_20','20_plus'] where id='{carol}'","expect":"rows=1"},
    {"n":"profiles: partner hours can be cleared (no preference)","as":"carol","sql":"update public.profiles set partner_weekly_hours=null where id='{carol}'","expect":"rows=1"},
    {"n":"profiles: invalid partner hours value is rejected","as":"carol","sql":"update public.profiles set partner_weekly_hours=array['10_20','forever'] where id='{carol}'","expect":"error=profiles_partner_weekly_hours_values"},
    {"n":"profiles: invalid work mode value is rejected","as":"carol","sql":"update public.profiles set work_modes=array['remote_ok'] where id='{carol}'","expect":"error=profiles_work_modes_values"},
    {"n":"profiles: invalid idea status value is rejected","as":"carol","sql":"update public.profiles set idea_statuses=array['dreaming'] where id='{carol}'","expect":"error=profiles_idea_statuses_values"},
    {"n":"profiles: invalid ambition value is rejected","as":"carol","sql":"update public.profiles set ambitions=array['world_domination'] where id='{carol}'","expect":"error=profiles_ambitions_values"},
    {"n":"profiles: a country must be a 2-letter capital code","as":"carol","sql":"update public.profiles set country='france' where id='{carol}'","expect":"error=profiles_country_format"},
    {"n":"profiles: a lower-case country code is rejected","as":"carol","sql":"update public.profiles set country='fr' where id='{carol}'","expect":"error=profiles_country_format"},
    {"n":"profiles: a district can be saved","as":"carol","sql":"update public.profiles set district='3e arrondissement' where id='{carol}'","expect":"rows=1"},
    {"n":"profiles: a district over 100 characters is rejected","as":"carol","sql":"update public.profiles set district=repeat('x',101) where id='{carol}'","expect":"error=profiles_district_length"},
    {"n":"profiles: the old single-answer columns are gone","as":"admin","sql":"select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('work_mode','idea_status','ambition')","expect":"rows=0"},
    {"n":"profiles: before any match, alice sees only herself","as":"alice","sql":"select id from public.profiles","expect":"rows=1"},
    {"n":"profiles: logged-out visitor is refused","as":"anon","sql":"select id from public.profiles","expect":"error=permission denied"},
    {"n":"profiles: users cannot insert profiles","as":"alice","sql":"insert into public.profiles (id) values (gen_random_uuid())","expect":"error=permission denied"},
    {"n":"profiles: users cannot delete profiles","as":"alice","sql":"delete from public.profiles where id='{alice}'","expect":"error=permission denied"},
    {"n":"categories: logged-in user sees all 7","as":"alice","sql":"select id from public.categories","expect":"rows=7"},
    {"n":"categories: all seven seeded categories are open","as":"alice","sql":"select id from public.categories where is_active","expect":"rows=7"},
    {"n":"skills: logged-in user sees all 60 seeded skills (9 universal + 51 in categories)","as":"alice","sql":"select id from public.skills","expect":"rows=60"},
    {"n":"categories: logged-out visitor is refused","as":"anon","sql":"select id from public.categories","expect":"error=permission denied"},
    {"n":"categories: users cannot add categories","as":"alice","sql":"insert into public.categories (slug, name) values ('x','x')","expect":"error=permission denied"},
    {"n":"skills: users cannot change skills","as":"alice","sql":"update public.skills set is_active=false","expect":"error=permission denied"},
    {"n":"setup: add an inactive category for the negative tests","as":"admin","sql":"insert into public.categories (slug, name, is_active, sort_order) values ('test_inactive','Test inactive category', false, 99)","expect":"rows=1"},
    {"n":"skills: every seeded category except Other has skills of its own","as":"admin","sql":"select c.id from public.categories c where c.slug not in ('other','test_inactive') and not exists (select 1 from public.skills s where s.category_id = c.id)","expect":"rows=0"},
    {"n":"profile_categories: alice picks the active category","as":"alice","sql":"insert into public.profile_categories (profile_id, category_id) select '{alice}', id from public.categories where slug='video_games'","expect":"rows=1"},
    {"n":"profile_categories: cannot pick an inactive category","as":"alice","sql":"insert into public.profile_categories (profile_id, category_id) select '{alice}', id from public.categories where slug='test_inactive'","expect":"error=row-level security"},
    {"n":"profile_categories: cannot add to someone else's profile","as":"alice","sql":"insert into public.profile_categories (profile_id, category_id) select '{bob}', id from public.categories where slug='video_games'","expect":"error=row-level security"},
    {"n":"profile_categories: bob picks the active category","as":"bob","sql":"insert into public.profile_categories (profile_id, category_id) select '{bob}', id from public.categories where slug='video_games'","expect":"rows=1"},
    {"n":"profile_skills: alice offers game programming","as":"alice","sql":"insert into public.profile_skills (profile_id, skill_id, kind) select '{alice}', id, 'offers' from public.skills where slug='game_programming'","expect":"rows=1"},
    {"n":"profile_skills: invalid kind is rejected","as":"alice","sql":"insert into public.profile_skills (profile_id, skill_id, kind) select '{alice}', id, 'wrong' from public.skills where slug='art_2d'","expect":"error=check constraint"},
    {"n":"setup: add an inactive skill","as":"admin","sql":"insert into public.skills (slug, name, is_active) values ('test_inactive','Inactive test skill',false)","expect":"rows=1"},
    {"n":"profile_skills: cannot pick an inactive skill","as":"alice","sql":"insert into public.profile_skills (profile_id, skill_id, kind) select '{alice}', id, 'seeks' from public.skills where slug='test_inactive'","expect":"error=row-level security"},
    {"n":"avatars: bucket is private, 2 MB, jpeg/png/webp only","as":"admin","sql":"select 1 from storage.buckets where id='avatars' and not public and file_size_limit=2097152 and allowed_mime_types=array['image/jpeg','image/png','image/webp']","expect":"rows=1"},
    {"n":"avatars: the three storage rules exist","as":"admin","sql":"select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'avatars:%'","expect":"rows=3"},
    {"n":"avatars: alice uploads into her own folder","as":"alice","sql":"insert into storage.objects (bucket_id, name) values ('avatars','{alice}/photo1.jpg')","expect":"rows=1"},
    {"n":"avatars: alice cannot upload into bob's folder","as":"alice","sql":"insert into storage.objects (bucket_id, name) values ('avatars','{bob}/photo2.jpg')","expect":"error=row-level security"},
    {"n":"avatars: cannot upload at the top level of the bucket","as":"alice","sql":"insert into storage.objects (bucket_id, name) values ('avatars','loose.jpg')","expect":"error=row-level security"},
    {"n":"avatars: another logged-in user can read alice's photo","as":"bob","sql":"select 1 from storage.objects where bucket_id='avatars' and name like '{alice}/%'","expect":"rows=1"},
    {"n":"avatars: logged-out visitor cannot see photos","as":"anon","sql":"select 1 from storage.objects where bucket_id='avatars' and name like '{alice}/%'","expect":"rows=0"},
    {"n":"avatars: logged-out visitor cannot upload","as":"anon","sql":"insert into storage.objects (bucket_id, name) values ('avatars','{alice}/anon.jpg')","expect":"error=row-level security"},
    {"n":"profiles: avatar_path inside own folder is accepted","as":"alice","sql":"update public.profiles set avatar_path='{alice}/photo1.jpg' where id='{alice}'","expect":"rows=1"},
    {"n":"profiles: avatar_path pointing into someone else's folder is rejected","as":"alice","sql":"update public.profiles set avatar_path='{bob}/photo1.jpg' where id='{alice}'","expect":"error=profiles_avatar_path_own_folder"},
    {"n":"profiles: avatar_path can be cleared","as":"alice","sql":"update public.profiles set avatar_path=null where id='{alice}'","expect":"rows=1"},
    {"n":"swipes: alice likes bob","as":"alice","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{alice}','{bob}','like')","expect":"rows=1"},
    {"n":"swipes: cannot swipe as someone else","as":"alice","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{bob}','{alice}','like')","expect":"error=row-level security"},
    {"n":"swipes: cannot swipe on yourself","as":"alice","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{alice}','{alice}','like')","expect":"error=swipes_not_self"},
    {"n":"swipes: cannot swipe the same person twice","as":"alice","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{alice}','{bob}','pass')","expect":"error=duplicate key"},
    {"n":"swipes: bob cannot see alice's swipe","as":"bob","sql":"select 1 from public.swipes","expect":"rows=0"},
    {"n":"swipes: alice sees her own swipe","as":"alice","sql":"select 1 from public.swipes","expect":"rows=1"},
    {"n":"swipes: swipes cannot be edited","as":"alice","sql":"update public.swipes set direction='pass' where swiper_id='{alice}'","expect":"error=permission denied"},
    {"n":"swipes: swipes cannot be deleted","as":"alice","sql":"delete from public.swipes where swiper_id='{alice}'","expect":"error=permission denied"},
    {"n":"conversations: (setup) two empty conversations","as":"admin","sql":"insert into public.conversations (id) values ('{conv}'), ('{conv2}')","expect":"rows=2"},
    {"n":"matches: pair stored in the wrong order is rejected","as":"admin","sql":"insert into public.matches (user_a, user_b, conversation_id) values ('{bob}','{alice}','{conv}')","expect":"error=matches_ordered"},
    {"n":"matches: a match cannot exist without a conversation","as":"admin","sql":"insert into public.matches (user_a, user_b) values ('{alice}','{bob}')","expect":"error=conversation_id"},
    {"n":"matches: (setup) alice+bob match, linked to their conversation","as":"admin","sql":"insert into public.matches (id, user_a, user_b, conversation_id) values ('{matchid}','{alice}','{bob}','{conv}')","expect":"rows=1"},
    {"n":"conversations: (setup) alice and bob are the participants","as":"admin","sql":"insert into public.conversation_participants (conversation_id, user_id) values ('{conv}','{alice}'), ('{conv}','{bob}')","expect":"rows=2"},
    {"n":"matches: the same pair cannot match twice","as":"admin","sql":"insert into public.matches (user_a, user_b, conversation_id) values ('{alice}','{bob}','{conv2}')","expect":"error=matches_pair_unique"},
    {"n":"matches: one conversation cannot belong to two matches","as":"admin","sql":"insert into public.matches (user_a, user_b, conversation_id) values ('{alice}','{carol}','{conv}')","expect":"error=duplicate key"},
    {"n":"matches: users cannot change or unmatch by editing the row","as":"alice","sql":"update public.matches set unmatched_at = now()","expect":"error=permission denied"},
    {"n":"matches: alice sees the match","as":"alice","sql":"select 1 from public.matches","expect":"rows=1"},
    {"n":"matches: bob sees the match","as":"bob","sql":"select 1 from public.matches","expect":"rows=1"},
    {"n":"matches: carol does not see it","as":"carol","sql":"select 1 from public.matches","expect":"rows=0"},
    {"n":"matches: users cannot create matches","as":"alice","sql":"insert into public.matches (user_a, user_b) values ('{alice}','{carol}')","expect":"error=permission denied"},
    {"n":"matches: users cannot delete matches","as":"alice","sql":"delete from public.matches","expect":"error=permission denied"},
    {"n":"profiles: after matching, alice sees herself and bob","as":"alice","sql":"select id from public.profiles","expect":"rows=2"},
    {"n":"profiles: carol still sees only herself","as":"carol","sql":"select id from public.profiles","expect":"rows=1"},
    {"n":"profile_categories: alice can read her match's categories","as":"alice","sql":"select 1 from public.profile_categories where profile_id='{bob}'","expect":"rows=1"},
    {"n":"profile_categories: carol cannot read bob's","as":"carol","sql":"select 1 from public.profile_categories where profile_id='{bob}'","expect":"rows=0"},
    {"n":"profile_skills: carol cannot read alice's","as":"carol","sql":"select 1 from public.profile_skills where profile_id='{alice}'","expect":"rows=0"},
    {"n":"conversations: a participant can read the conversation","as":"alice","sql":"select 1 from public.conversations where id='{conv}'","expect":"rows=1"},
    {"n":"conversations: an outsider cannot read it","as":"carol","sql":"select 1 from public.conversations where id='{conv}'","expect":"rows=0"},
    {"n":"conversations: a participant sees both participants","as":"bob","sql":"select 1 from public.conversation_participants where conversation_id='{conv}'","expect":"rows=2"},
    {"n":"conversations: users cannot create conversations","as":"alice","sql":"insert into public.conversations (type) values ('direct')","expect":"error=permission denied"},
    {"n":"conversations: users cannot add participants","as":"alice","sql":"insert into public.conversation_participants (conversation_id, user_id) values ('{conv}','{carol}')","expect":"error=permission denied"},
    {"n":"conversations: the type must be direct or group","as":"admin","sql":"insert into public.conversations (type) values ('channel')","expect":"error=conversations_type_check"},
    {"n":"messages: alice sends a message in her conversation","as":"alice","sql":"insert into public.messages (conversation_id, sender_id, body) values ('{conv}','{alice}','hi bob')","expect":"rows=1"},
    {"n":"messages: bob can read it","as":"bob","sql":"select 1 from public.messages","expect":"rows=1"},
    {"n":"messages: carol cannot read it","as":"carol","sql":"select 1 from public.messages","expect":"rows=0"},
    {"n":"messages: carol cannot send into someone else's conversation","as":"carol","sql":"insert into public.messages (conversation_id, sender_id, body) values ('{conv}','{carol}','let me in')","expect":"error=row-level security"},
    {"n":"messages: cannot send as someone else","as":"alice","sql":"insert into public.messages (conversation_id, sender_id, body) values ('{conv}','{bob}','fake')","expect":"error=row-level security"},
    {"n":"messages: empty message is rejected","as":"alice","sql":"insert into public.messages (conversation_id, sender_id, body) values ('{conv}','{alice}','   ')","expect":"error=messages_body_length"},
    {"n":"messages: message over 2000 characters is rejected","as":"alice","sql":"insert into public.messages (conversation_id, sender_id, body) values ('{conv}','{alice}',repeat('x',2001))","expect":"error=messages_body_length"},
    {"n":"messages: message of exactly 2000 characters is accepted","as":"alice","sql":"insert into public.messages (conversation_id, sender_id, body) values ('{conv}','{alice}',repeat('x',2000))","expect":"rows=1"},
    {"n":"messages: messages cannot be edited","as":"alice","sql":"update public.messages set body='edited'","expect":"error=permission denied"},
    {"n":"messages: messages cannot be deleted","as":"alice","sql":"delete from public.messages","expect":"error=permission denied"},
    {"n":"blocks: alice blocks bob","as":"alice","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{alice}','{bob}')","expect":"rows=1"},
    {"n":"blocks: bob cannot see that he was blocked","as":"bob","sql":"select 1 from public.blocks","expect":"rows=0"},
    {"n":"blocks: cannot block on someone else's behalf","as":"alice","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{bob}','{carol}')","expect":"error=row-level security"},
    {"n":"blocks: cannot block yourself","as":"alice","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{alice}','{alice}')","expect":"error=blocks_not_self"},
    {"n":"blocks: alice can unblock","as":"alice","sql":"delete from public.blocks where blocker_id='{alice}'","expect":"rows=1"},
    {"n":"reports: alice reports bob","as":"alice","sql":"insert into public.reports (reporter_id, reported_id, reason) values ('{alice}','{bob}','spam')","expect":"rows=1"},
    {"n":"reports: users cannot read reports","as":"alice","sql":"select 1 from public.reports","expect":"error=permission denied"},
    {"n":"reports: cannot file a report as someone else","as":"bob","sql":"insert into public.reports (reporter_id, reported_id, reason) values ('{alice}','{carol}','spam')","expect":"error=row-level security"},
    {"n":"reports: logged-out visitor is refused","as":"anon","sql":"insert into public.reports (reporter_id, reported_id, reason) values ('{alice}','{bob}','spam')","expect":"error=permission denied"},
    {"n":"other tables: logged-out visitor is refused on swipes","as":"anon","sql":"select 1 from public.swipes","expect":"error=permission denied"},
    {"n":"other tables: logged-out visitor is refused on messages","as":"anon","sql":"select 1 from public.messages","expect":"error=permission denied"},
    {"n":"other tables: logged-out visitor is refused on matches","as":"anon","sql":"select 1 from public.matches","expect":"error=permission denied"},
    {"n":"feed setup: create dave, erin, frank, gina, hank, ivan, judy, kim","as":"admin","sql":"insert into auth.users (id, aud, role, email) values ('{dave}','authenticated','authenticated','dave@test.invalid'), ('{erin}','authenticated','authenticated','erin@test.invalid'), ('{frank}','authenticated','authenticated','frank@test.invalid'), ('{gina}','authenticated','authenticated','gina@test.invalid'), ('{hank}','authenticated','authenticated','hank@test.invalid'), ('{ivan}','authenticated','authenticated','ivan@test.invalid'), ('{judy}','authenticated','authenticated','judy@test.invalid'), ('{kim}','authenticated','authenticated','kim@test.invalid')","expect":"rows=8"},
    {"n":"feed setup: dave = Local in ' LYON ' 69001 (FR), erin = Remote + Local in 'lyon' 69002 (FR), frank = Local in Paris 75010 (FR), gina = Remote, hank = not onboarded, ivan = Local in 'Lyon' (CH), judy = Local in 'Zürich' (CH), kim = Local in '  ZURICH ' (CH)","as":"admin","sql":"update public.profiles p set display_name=v.n, work_modes=v.wm, country=v.co, city=v.city, postal_code=v.pc, idea_statuses=array['exploring'], weekly_hours=array['5_10'], ambitions=array['for_fun'], onboarded=v.onb from (values ('{dave}'::uuid,'Dave',array['local'],'FR',' LYON ','69001',true), ('{erin}'::uuid,'Erin',array['remote','local'],'FR','lyon','69002',true), ('{frank}'::uuid,'Frank',array['local'],'FR','Paris','75010',true), ('{gina}'::uuid,'Gina',array['remote'],'FR',null,null,true), ('{hank}'::uuid,'Hank',array['remote'],'FR',null,null,false), ('{ivan}'::uuid,'Ivan',array['local'],'CH','Lyon',null,true), ('{judy}'::uuid,'Judy',array['local'],'CH','Zürich',null,true), ('{kim}'::uuid,'Kim',array['local'],'CH','  ZURICH ',null,true)) as v(id,n,wm,co,city,pc,onb) where p.id=v.id","expect":"rows=8"},
    {"n":"feed setup: everyone picks video games, except gina who only has an inactive category","as":"admin","sql":"insert into public.profile_categories (profile_id, category_id) select v.id, c.id from (values ('{dave}'::uuid,'video_games'), ('{erin}'::uuid,'video_games'), ('{frank}'::uuid,'video_games'), ('{gina}'::uuid,'test_inactive'), ('{hank}'::uuid,'video_games'), ('{ivan}'::uuid,'video_games'), ('{judy}'::uuid,'video_games'), ('{kim}'::uuid,'video_games')) as v(id,slug) join public.categories c on c.slug=v.slug","expect":"rows=8"},
    {"n":"feed setup: erin offers game programming","as":"admin","sql":"insert into public.profile_skills (profile_id, skill_id, kind) select '{erin}', id, 'offers' from public.skills where slug='game_programming'","expect":"rows=1"},
    {"n":"feed: a Local-only user sees only Local people in the same place (case and spaces ignored)","as":"dave","sql":"select 1 from public.get_feed()","expect":"rows=1"},
    {"n":"feed: ...and that person is erin","as":"dave","sql":"select 1 from public.get_feed() where id='{erin}'","expect":"rows=1"},
    {"n":"feed: a Local-only user with nobody in their place sees nobody","as":"frank","sql":"select 1 from public.get_feed()","expect":"rows=0"},
    {"n":"feed: someone who picked BOTH Remote and Local sees remote people (alice, bob) and local people in their place (dave), not frank in Paris","as":"erin","sql":"select 1 from public.get_feed()","expect":"rows=3"},
    {"n":"feed: ...frank (local-only, Paris) is not shown to erin (remote, Lyon)","as":"erin","sql":"select 1 from public.get_feed() where id='{frank}'","expect":"rows=0"},
    {"n":"feed: ...and erin is not shown to frank either (two-way)","as":"frank","sql":"select 1 from public.get_feed() where id='{erin}'","expect":"rows=0"},
    {"n":"feed: two remote users in different cities (or with no city) see each other: bob sees erin","as":"bob","sql":"select 1 from public.get_feed() where id='{erin}'","expect":"rows=1"},
    {"n":"feed: ...and erin sees bob","as":"erin","sql":"select 1 from public.get_feed() where id='{bob}'","expect":"rows=1"},
    {"n":"feed: remote matching ignores the country (erin in France sees bob in Lebanon)","as":"erin","sql":"select 1 from public.get_feed() where id='{bob}'","expect":"rows=1"},
    {"n":"feed: the same city name in another country is not the same place (ivan in Switzerland sees nobody)","as":"ivan","sql":"select 1 from public.get_feed()","expect":"rows=0"},
    {"n":"feed: ...and dave in Lyon does not see ivan either (two-way)","as":"dave","sql":"select 1 from public.get_feed() where id='{ivan}'","expect":"rows=0"},
    {"n":"feed: accents, capitals and extra spaces are ignored: judy ('Zürich') sees only kim ('  ZURICH ')","as":"judy","sql":"select 1 from public.get_feed()","expect":"rows=1"},
    {"n":"feed: ...and kim sees judy (two-way)","as":"kim","sql":"select 1 from public.get_feed() where id='{judy}'","expect":"rows=1"},
    {"n":"feed: a remote user with no city does not see a local-only person (alice does not see dave)","as":"alice","sql":"select 1 from public.get_feed() where id='{dave}'","expect":"rows=0"},
    {"n":"feed: ...and dave does not see alice either (two-way)","as":"dave","sql":"select 1 from public.get_feed() where id='{alice}'","expect":"rows=0"},
    {"n":"feed: no shared ACTIVE category means an empty feed","as":"gina","sql":"select 1 from public.get_feed()","expect":"rows=0"},
    {"n":"feed: someone who has not finished onboarding gets an empty feed","as":"hank","sql":"select 1 from public.get_feed()","expect":"rows=0"},
    {"n":"feed: carol (not onboarded) gets an empty feed","as":"carol","sql":"select 1 from public.get_feed()","expect":"rows=0"},
    {"n":"feed: alice sees only erin (bob already swiped; dave and frank are local-only)","as":"alice","sql":"select 1 from public.get_feed()","expect":"rows=1"},
    {"n":"feed: never includes yourself","as":"alice","sql":"select 1 from public.get_feed() where id='{alice}'","expect":"rows=0"},
    {"n":"feed: never includes someone you already swiped","as":"alice","sql":"select 1 from public.get_feed() where id='{bob}'","expect":"rows=0"},
    {"n":"feed: never includes someone who is not onboarded","as":"alice","sql":"select 1 from public.get_feed() where id in ('{hank}','{carol}')","expect":"rows=0"},
    {"n":"feed: never includes someone with no shared active category","as":"alice","sql":"select 1 from public.get_feed() where id='{gina}'","expect":"rows=0"},
    {"n":"feed: a card carries name, categories and skills","as":"alice","sql":"select 1 from public.get_feed() where id='{erin}' and display_name='Erin' and category_names=array['Video games'] and offers=array['Game programming'] and seeks='{}'","expect":"rows=1"},
    {"n":"feed: a card carries place, work modes and answers as lists","as":"alice","sql":"select 1 from public.get_feed() where id='{erin}' and country='FR' and city='lyon' and district is null and work_modes=array['remote','local'] and idea_statuses=array['exploring'] and weekly_hours=array['5_10'] and ambitions=array['for_fun']","expect":"rows=1"},
    {"n":"feed: erin passes on dave","as":"erin","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{erin}','{dave}','pass')","expect":"rows=1"},
    {"n":"feed: ...and dave disappears from her feed (alice and bob remain)","as":"erin","sql":"select 1 from public.get_feed()","expect":"rows=2"},
    {"n":"feed: erin blocks alice","as":"erin","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{erin}','{alice}')","expect":"rows=1"},
    {"n":"feed: the blocker no longer sees the blocked person (only bob remains)","as":"erin","sql":"select 1 from public.get_feed()","expect":"rows=1"},
    {"n":"feed: the blocked person no longer sees the blocker either","as":"alice","sql":"select 1 from public.get_feed() where id='{erin}'","expect":"rows=0"},
    {"n":"feed: cannot ask for another person's feed (no user id parameter)","as":"alice","sql":"select 1 from public.get_feed('{bob}')","expect":"error=does not exist"},
    {"n":"feed: logged-out visitor cannot call it","as":"anon","sql":"select 1 from public.get_feed()","expect":"error=permission denied"},
    {"n":"feed: the place-comparison helper is not callable by users","as":"alice","sql":"select public.normalize_place('Zürich')","expect":"error=permission denied"},
    {"n":"feed setup: 25 more onboarded remote users who play video games","as":"admin","sql":"insert into auth.users (id, aud, role, email) select gen_random_uuid(), 'authenticated', 'authenticated', 'bulk' || g || '@test.invalid' from generate_series(1,25) g","expect":"rows=25"},
    {"n":"feed setup: complete the 25 profiles (remote, France)","as":"admin","sql":"update public.profiles set display_name='Bulk', work_modes=array['remote'], country='FR', idea_statuses=array['exploring'], weekly_hours=array['5_10'], ambitions=array['for_fun'], onboarded=true where id in (select id from auth.users where email like 'bulk%@test.invalid')","expect":"rows=25"},
    {"n":"feed setup: give them the video games category","as":"admin","sql":"insert into public.profile_categories (profile_id, category_id) select u.id, c.id from auth.users u cross join public.categories c where u.email like 'bulk%@test.invalid' and c.slug='video_games'","expect":"rows=25"},
    {"n":"feed: never more than 20 cards at once","as":"erin","sql":"select 1 from public.get_feed()","expect":"rows=20"},
    {"n":"match: frank likes kim (one-sided) and no match exists yet","as":"frank","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{frank}','{kim}','like')","expect":"rows=1"},
    {"n":"match: ...still no match after one like","as":"admin","sql":"select 1 from public.matches where '{frank}' in (user_a, user_b) and '{kim}' in (user_a, user_b)","expect":"rows=0"},
    {"n":"match: kim likes frank back and the match appears, stored in order (kim before frank)","as":"kim","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{kim}','{frank}','like')","expect":"rows=1"},
    {"n":"match: ...the match row exists with user_a = kim, user_b = frank","as":"admin","sql":"select 1 from public.matches where user_a='{kim}' and user_b='{frank}'","expect":"rows=1"},
    {"n":"match: frank sees his match","as":"frank","sql":"select 1 from public.matches","expect":"rows=1"},
    {"n":"match: kim sees the same match","as":"kim","sql":"select 1 from public.matches","expect":"rows=1"},
    {"n":"match: dave (not part of it) sees no match","as":"dave","sql":"select 1 from public.matches","expect":"rows=0"},
    {"n":"match: matched people can read each other's profile","as":"frank","sql":"select 1 from public.profiles where id='{kim}'","expect":"rows=1"},
    {"n":"match: a stranger cannot read the matched person's profile","as":"dave","sql":"select 1 from public.profiles where id='{kim}'","expect":"rows=0"},
    {"n":"match: a like after the other person PASSED does not match (erin passed on dave earlier)","as":"dave","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{dave}','{erin}','like')","expect":"rows=1"},
    {"n":"match: ...no match for dave and erin","as":"admin","sql":"select 1 from public.matches where '{dave}' in (user_a, user_b) and '{erin}' in (user_a, user_b)","expect":"rows=0"},
    {"n":"match: setup: judy blocks ivan","as":"admin","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{judy}','{ivan}')","expect":"rows=1"},
    {"n":"match: ivan likes judy","as":"ivan","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{ivan}','{judy}','like')","expect":"rows=1"},
    {"n":"match: judy likes ivan back, but she blocked him, so no match","as":"judy","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{judy}','{ivan}','like')","expect":"rows=1"},
    {"n":"match: ...no match for ivan and judy","as":"admin","sql":"select 1 from public.matches where '{ivan}' in (user_a, user_b) and '{judy}' in (user_a, user_b)","expect":"rows=0"},
    {"n":"match: gina likes hank","as":"gina","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{gina}','{hank}','like')","expect":"rows=1"},
    {"n":"match: hank (not onboarded) likes gina back, so no match","as":"hank","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{hank}','{gina}','like')","expect":"rows=1"},
    {"n":"match: ...no match for gina and hank","as":"admin","sql":"select 1 from public.matches where '{gina}' in (user_a, user_b) and '{hank}' in (user_a, user_b)","expect":"rows=0"},
    {"n":"match: the trigger function cannot be called by users","as":"alice","sql":"select public.create_match_on_mutual_like()","expect":"error=permission denied"},
    {"n":"match: users still cannot create matches directly","as":"kim","sql":"insert into public.matches (user_a, user_b) values ('{kim}','{dave}')","expect":"error=permission denied"},
    {"n":"privacy: a user cannot read anyone's postal code, not even their own, through the table","as":"carol","sql":"select postal_code from public.profiles where id='{carol}'","expect":"error=permission denied"},
    {"n":"privacy: ...nor last_seen_at","as":"alice","sql":"select last_seen_at from public.profiles where id='{alice}'","expect":"error=permission denied"},
    {"n":"privacy: ...nor is_demo","as":"alice","sql":"select is_demo from public.profiles where id='{alice}'","expect":"error=permission denied"},
    {"n":"privacy: select * on profiles is refused (the app lists its columns)","as":"alice","sql":"select * from public.profiles where id='{alice}'","expect":"error=permission denied"},
    {"n":"privacy: the columns the app needs are still readable","as":"alice","sql":"select id, display_name, avatar_path, country, city, district, work_modes, idea_statuses, pitch, weekly_hours, partner_weekly_hours, ambitions, onboarded, created_at, updated_at from public.profiles where id='{alice}'","expect":"rows=1"},
    {"n":"privacy: a chat partner cannot read the other person's postal code through the table (bob and alice share a conversation)","as":"bob","sql":"select postal_code from public.profiles where id='{alice}'","expect":"error=permission denied"},
    {"n":"privacy: users can still update their own postal code","as":"carol","sql":"update public.profiles set postal_code='75012' where id='{carol}'","expect":"rows=1"},
    {"n":"privacy: ...and read it back only through the function","as":"carol","sql":"select 1 where public.get_my_postal_code() = '75012'","expect":"rows=1"},
    {"n":"privacy: nobody else can read it through the function (it returns only your own)","as":"alice","sql":"select 1 where public.get_my_postal_code() is not null","expect":"rows=0"},
    {"n":"zones: department_of handles Paris, Corsica, overseas and bad input","as":"admin","sql":"select 1 where public.department_of('75011')='75' and public.department_of('20100')='2A' and public.department_of('20200')='2B' and public.department_of('97100')='971' and public.department_of('69003')='69' and public.department_of('1234') is null","expect":"rows=1"},
    {"n":"zones: all of Île-de-France is one zone, outside it the zone is the department","as":"admin","sql":"select 1 where public.local_zone('FR','75001','Paris')='FR:IDF' and public.local_zone('FR','95000','Cergy')='FR:IDF' and public.local_zone('FR','69003','Lyon')='FR:69' and public.local_zone('FR','69007','Villeurbanne')='FR:69' and public.local_zone('FR','13001','Marseille')='FR:13' and public.local_zone('CH',null,'Zürich')=public.local_zone('CH',null,'  ZURICH ')","expect":"rows=1"},
    {"n":"zones: the helpers cannot be called by users","as":"alice","sql":"select public.local_zone('FR','75001','Paris')","expect":"error=permission denied"},
    {"n":"zones: setup: paris (75), boulogne (92), lyon a and lyon b (69, different city names), all Local in France","as":"admin","sql":"insert into auth.users (id, aud, role, email) values ('{paris}','authenticated','authenticated','paris@test.invalid'), ('{boulogne}','authenticated','authenticated','boulogne@test.invalid'), ('{lyona}','authenticated','authenticated','lyona@test.invalid'), ('{lyonb}','authenticated','authenticated','lyonb@test.invalid')","expect":"rows=4"},
    {"n":"zones: setup: complete their profiles and pick video games","as":"admin","sql":"with done as (update public.profiles p set display_name=v.n, work_modes=array['local'], country='FR', city=v.city, postal_code=v.pc, idea_statuses=array['exploring'], weekly_hours=array['5_10'], ambitions=array['for_fun'], onboarded=true from (values ('{paris}'::uuid,'Paris','Paris','75001'), ('{boulogne}'::uuid,'Boulogne','Boulogne-Billancourt','92100'), ('{lyona}'::uuid,'LyonA','Lyon','69003'), ('{lyonb}'::uuid,'LyonB','Villeurbanne','69100')) as v(id,n,city,pc) where p.id=v.id returning p.id) insert into public.profile_categories (profile_id, category_id) select d.id, c.id from done d cross join public.categories c where c.slug='video_games'","expect":"rows=4"},
    {"n":"zones: Paris (75) sees Boulogne (92): all of Île-de-France is one zone","as":"paris","sql":"select 1 from public.get_feed() where id='{boulogne}'","expect":"rows=1"},
    {"n":"zones: ...and Boulogne sees Paris (two-way)","as":"boulogne","sql":"select 1 from public.get_feed() where id='{paris}'","expect":"rows=1"},
    {"n":"zones: Paris does not see Lyon (another zone)","as":"paris","sql":"select 1 from public.get_feed() where id in ('{lyona}','{lyonb}')","expect":"rows=0"},
    {"n":"zones: outside Île-de-France the department is the zone: Lyon (69003) sees Villeurbanne (69100)","as":"lyona","sql":"select 1 from public.get_feed() where id='{lyonb}'","expect":"rows=1"},
    {"n":"zones: ...and Villeurbanne sees Lyon (two-way)","as":"lyonb","sql":"select 1 from public.get_feed() where id='{lyona}'","expect":"rows=1"},
    {"n":"zones: Lyon does not see Paris","as":"lyona","sql":"select 1 from public.get_feed() where id in ('{paris}','{boulogne}')","expect":"rows=0"},
    {"n":"zones: the feed never returns a postal code","as":"paris","sql":"select postal_code from public.get_feed()","expect":"error=does not exist"},
    {"n":"block: lyona and lyonb like each other, so they match","as":"lyona","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{lyona}','{lyonb}','like')","expect":"rows=1"},
    {"n":"block: ...second like","as":"lyonb","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{lyonb}','{lyona}','like')","expect":"rows=1"},
    {"n":"block: they exchange a message each","as":"lyona","sql":"insert into public.messages (conversation_id, sender_id, body) select m.conversation_id, '{lyona}', 'bonjour' from public.matches m where m.user_a = least('{lyona}'::uuid,'{lyonb}'::uuid) and m.user_b = greatest('{lyona}'::uuid,'{lyonb}'::uuid)","expect":"rows=1"},
    {"n":"block: ...and back","as":"lyonb","sql":"insert into public.messages (conversation_id, sender_id, body) select m.conversation_id, '{lyonb}', 'salut' from public.matches m where m.user_a = least('{lyonb}'::uuid,'{lyona}'::uuid) and m.user_b = greatest('{lyonb}'::uuid,'{lyona}'::uuid)","expect":"rows=1"},
    {"n":"block: both see the active conversation","as":"lyonb","sql":"select 1 from public.conversations c join public.matches m on m.conversation_id=c.id where c.archived_at is null and m.user_a = least('{lyona}'::uuid,'{lyonb}'::uuid) and m.user_b = greatest('{lyona}'::uuid,'{lyonb}'::uuid)","expect":"rows=1"},
    {"n":"block: lyona blocks lyonb (anyone can block anyone they can see)","as":"lyona","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{lyona}','{lyonb}')","expect":"rows=1"},
    {"n":"block: the match is marked unmatched by the blocker and kept","as":"admin","sql":"select 1 from public.matches m where m.user_a = least('{lyona}'::uuid,'{lyonb}'::uuid) and m.user_b = greatest('{lyona}'::uuid,'{lyonb}'::uuid) and m.unmatched_at is not null and m.unmatched_by='{lyona}'","expect":"rows=1"},
    {"n":"block: the conversation is archived","as":"admin","sql":"select 1 from public.conversations c join public.matches m on m.conversation_id=c.id where c.archived_at is not null and m.user_a = least('{lyona}'::uuid,'{lyonb}'::uuid) and m.user_b = greatest('{lyona}'::uuid,'{lyonb}'::uuid)","expect":"rows=1"},
    {"n":"block: no message was deleted","as":"admin","sql":"select 1 from public.messages x join public.matches m on m.conversation_id=x.conversation_id where m.user_a = least('{lyona}'::uuid,'{lyonb}'::uuid) and m.user_b = greatest('{lyona}'::uuid,'{lyonb}'::uuid)","expect":"rows=2"},
    {"n":"block: the blocked person can no longer read the conversation","as":"lyonb","sql":"select 1 from public.messages x join public.matches m on m.conversation_id=x.conversation_id where m.user_a = least('{lyona}'::uuid,'{lyonb}'::uuid) and m.user_b = greatest('{lyona}'::uuid,'{lyonb}'::uuid)","expect":"rows=0"},
    {"n":"block: ...nor the blocker (a block hides it from both)","as":"lyona","sql":"select 1 from public.messages x join public.matches m on m.conversation_id=x.conversation_id where m.user_a = least('{lyona}'::uuid,'{lyonb}'::uuid) and m.user_b = greatest('{lyona}'::uuid,'{lyonb}'::uuid)","expect":"rows=0"},
    {"n":"block: neither can see the other in the swipe feed","as":"lyona","sql":"select 1 from public.get_feed() where id='{lyonb}'","expect":"rows=0"},
    {"n":"block: ...the other way","as":"lyonb","sql":"select 1 from public.get_feed() where id='{lyona}'","expect":"rows=0"},
    {"n":"block: the blocked person cannot read the blocker's profile","as":"lyonb","sql":"select 1 from public.profiles where id='{lyona}'","expect":"rows=0"},
    {"n":"block: the blocked person cannot see that they were blocked","as":"lyonb","sql":"select 1 from public.blocks","expect":"rows=0"},
    {"n":"block: the block is listed with the name for the blocker","as":"lyona","sql":"select 1 from public.get_blocked_profiles() where id='{lyonb}' and display_name='LyonB'","expect":"rows=1"},
    {"n":"block: the blocked person's own list stays empty","as":"lyonb","sql":"select 1 from public.get_blocked_profiles()","expect":"rows=0"},
    {"n":"block: logged-out visitors cannot call the block list","as":"anon","sql":"select 1 from public.get_blocked_profiles()","expect":"error=permission denied"},
    {"n":"block: blocking twice is refused by the database (duplicate) and changes nothing","as":"lyona","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{lyona}','{lyonb}')","expect":"error=duplicate key"},
    {"n":"block: nobody can block someone on another person's behalf","as":"lyonb","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{lyona}','{paris}')","expect":"error=row-level security"},
    {"n":"block: unblocking is allowed for the blocker only (lyonb cannot remove it)","as":"lyonb","sql":"delete from public.blocks where blocker_id='{lyona}'","expect":"rows=0"},
    {"n":"block: lyona unblocks lyonb","as":"lyona","sql":"delete from public.blocks where blocker_id='{lyona}' and blocked_id='{lyonb}'","expect":"rows=1"},
    {"n":"block: after unblocking the archived chat is readable again, still read-only","as":"lyona","sql":"select 1 from public.messages x join public.matches m on m.conversation_id=x.conversation_id where m.user_a = least('{lyona}'::uuid,'{lyonb}'::uuid) and m.user_b = greatest('{lyona}'::uuid,'{lyonb}'::uuid)","expect":"rows=2"},
    {"n":"block: ...and a match that was ended does not come back","as":"admin","sql":"select 1 from public.matches m where m.user_a = least('{lyona}'::uuid,'{lyonb}'::uuid) and m.user_b = greatest('{lyona}'::uuid,'{lyonb}'::uuid) and m.unmatched_at is not null","expect":"rows=1"},
    {"n":"block: ...nobody can write in it","as":"lyonb","sql":"insert into public.messages (conversation_id, sender_id, body) select m.conversation_id, '{lyonb}', 'encore' from public.matches m where m.user_a = least('{lyona}'::uuid,'{lyonb}'::uuid) and m.user_b = greatest('{lyona}'::uuid,'{lyonb}'::uuid)","expect":"error=row-level security"},
    {"n":"block: blocking a stranger from the feed works and hides them both ways","as":"paris","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{paris}','{boulogne}')","expect":"rows=1"},
    {"n":"block: ...paris no longer sees boulogne","as":"paris","sql":"select 1 from public.get_feed() where id='{boulogne}'","expect":"rows=0"},
    {"n":"block: ...and boulogne no longer sees paris","as":"boulogne","sql":"select 1 from public.get_feed() where id='{paris}'","expect":"rows=0"},
    {"n":"report: lyona reports lyonb with a reason and details","as":"lyona","sql":"insert into public.reports (reporter_id, reported_id, reason, details) values ('{lyona}','{lyonb}','harassment','messages insistants')","expect":"rows=1"},
    {"n":"report: a reason is required","as":"lyona","sql":"insert into public.reports (reporter_id, reported_id, reason) values ('{lyona}','{lyonb}','')","expect":"error=reports_reason_check"},
    {"n":"report: details over 1000 characters are refused","as":"lyona","sql":"insert into public.reports (reporter_id, reported_id, reason, details) values ('{lyona}','{lyonb}','spam',repeat('x',1001))","expect":"error=reports_details_check"},
    {"n":"report: nobody can report themselves","as":"lyona","sql":"insert into public.reports (reporter_id, reported_id, reason) values ('{lyona}','{lyona}','spam')","expect":"error=reports_not_self"},
    {"n":"report: the reported person cannot read reports","as":"lyonb","sql":"select 1 from public.reports","expect":"error=permission denied"},
    {"n":"report: the admin view shows names and reason to the database owner","as":"admin","sql":"select 1 from public.admin_reports where reporter_name='LyonA' and reported_name='LyonB' and reason='harassment'","expect":"rows=1"},
    {"n":"report: ...and to nobody else","as":"lyona","sql":"select 1 from public.admin_reports","expect":"error=permission denied"},
    {"n":"conversation: the mutual like of frank and kim created a direct conversation with two participants","as":"admin","sql":"select 1 from public.matches m join public.conversations c on c.id = m.conversation_id and c.type = 'direct' and c.archived_at is null where m.user_a = '{kim}' and m.user_b = '{frank}' and (select count(*) from public.conversation_participants cp where cp.conversation_id = c.id) = 2","expect":"rows=1"},
    {"n":"conversation: frank writes a message","as":"frank","sql":"insert into public.messages (conversation_id, sender_id, body) select conversation_id, '{frank}', 'salut kim' from public.matches where user_a='{kim}' and user_b='{frank}'","expect":"rows=1"},
    {"n":"conversation: kim writes a message","as":"kim","sql":"insert into public.messages (conversation_id, sender_id, body) select conversation_id, '{kim}', 'salut frank' from public.matches where user_a='{kim}' and user_b='{frank}'","expect":"rows=1"},
    {"n":"conversation: an outsider (dave) cannot read any of these messages","as":"dave","sql":"select 1 from public.messages","expect":"rows=0"},
    {"n":"unmatch: an outsider cannot unmatch someone else's match","as":"carol","sql":"select public.unmatch('{matchid}')","expect":"error=match not found"},
    {"n":"unmatch: logged-out visitors cannot call unmatch","as":"anon","sql":"select public.unmatch('{conv}')","expect":"error=permission denied"},
    {"n":"unmatch: frank unmatches kim","as":"frank","sql":"select public.unmatch(m.id) from public.matches m where m.user_a='{kim}' and m.user_b='{frank}'","expect":"rows=1"},
    {"n":"unmatch: the match is kept (unmatched_at and unmatched_by are set)","as":"admin","sql":"select 1 from public.matches where user_a='{kim}' and user_b='{frank}' and unmatched_at is not null and unmatched_by='{frank}'","expect":"rows=1"},
    {"n":"unmatch: the conversation is archived","as":"admin","sql":"select 1 from public.conversations c join public.matches m on m.conversation_id=c.id where m.user_a='{kim}' and m.user_b='{frank}' and c.archived_at is not null","expect":"rows=1"},
    {"n":"unmatch: no message was deleted","as":"admin","sql":"select 1 from public.messages m join public.matches x on x.conversation_id=m.conversation_id where x.user_a='{kim}' and x.user_b='{frank}'","expect":"rows=2"},
    {"n":"unmatch: both people can still read the archived chat (frank)","as":"frank","sql":"select 1 from public.messages m join public.matches x on x.conversation_id=m.conversation_id where x.user_a='{kim}'","expect":"rows=2"},
    {"n":"unmatch: ...and kim","as":"kim","sql":"select 1 from public.messages m join public.matches x on x.conversation_id=m.conversation_id where x.user_a='{kim}'","expect":"rows=2"},
    {"n":"unmatch: nobody can write in an archived conversation (frank)","as":"frank","sql":"insert into public.messages (conversation_id, sender_id, body) select conversation_id, '{frank}', 'encore ?' from public.matches where user_a='{kim}' and user_b='{frank}'","expect":"error=row-level security"},
    {"n":"unmatch: ...nor kim","as":"kim","sql":"insert into public.messages (conversation_id, sender_id, body) select conversation_id, '{kim}', 'encore ?' from public.matches where user_a='{kim}' and user_b='{frank}'","expect":"error=row-level security"},
    {"n":"unmatch: unmatching twice does nothing and does not fail","as":"kim","sql":"select public.unmatch(m.id) from public.matches m where m.user_a='{kim}' and m.user_b='{frank}'","expect":"rows=1"},
    {"n":"unmatch: the archived chat still shows the other person's profile","as":"frank","sql":"select 1 from public.profiles where id='{kim}'","expect":"rows=1"},
    {"n":"unmatch: they never come back to each other's swipe feed","as":"frank","sql":"select 1 from public.get_feed() where id='{kim}'","expect":"rows=0"},
    {"n":"block: kim blocks frank","as":"kim","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{kim}','{frank}')","expect":"rows=1"},
    {"n":"block: frank can no longer read the conversation","as":"frank","sql":"select 1 from public.messages m join public.conversations c on c.id=m.conversation_id","expect":"rows=0"},
    {"n":"block: kim cannot read it either (a block hides it from both)","as":"kim","sql":"select 1 from public.messages m join public.conversations c on c.id=m.conversation_id","expect":"rows=0"},
    {"n":"block: frank can no longer read kim's profile","as":"frank","sql":"select 1 from public.profiles where id='{kim}'","expect":"rows=0"},
    {"n":"block: the messages are kept in the database","as":"admin","sql":"select 1 from public.messages m join public.matches x on x.conversation_id=m.conversation_id where x.user_a='{kim}' and x.user_b='{frank}'","expect":"rows=2"},
    {"n":"block: kim removes the block (so we can test account deletion)","as":"kim","sql":"delete from public.blocks where blocker_id='{kim}'","expect":"rows=1"},
    {"n":"deletion: kim deletes her account","as":"admin","sql":"delete from auth.users where id='{kim}'","expect":"rows=1"},
    {"n":"deletion: the conversation survives for frank, archived, with only frank as participant","as":"admin","sql":"select 1 from public.conversations c join public.conversation_participants cp on cp.conversation_id=c.id where cp.user_id='{frank}' and c.archived_at is not null and (select count(*) from public.conversation_participants x where x.conversation_id=c.id) = 1","expect":"rows=1"},
    {"n":"deletion: frank can still read the archived conversation","as":"frank","sql":"select 1 from public.conversations","expect":"rows=1"},
    {"n":"deletion: kim's own messages went with her (right to erasure), frank's stay","as":"frank","sql":"select 1 from public.messages where sender_id='{frank}'","expect":"rows=1"},
    {"n":"deletion: nothing of kim's is left in the messages","as":"admin","sql":"select 1 from public.messages where sender_id='{kim}'","expect":"rows=0"},
    {"n":"deletion: frank cannot write in it any more","as":"frank","sql":"insert into public.messages (conversation_id, sender_id, body) select id, '{frank}', 'toujours là ?' from public.conversations","expect":"error=row-level security"},
    {"n":"deletion: frank deletes his account too","as":"admin","sql":"delete from auth.users where id='{frank}'","expect":"rows=1"},
    {"n":"deletion: with nobody left, the conversation is removed (no orphan)","as":"admin","sql":"select 1 from public.conversations c where c.id not in ('{conv}','{conv2}') and not exists (select 1 from public.matches m where m.conversation_id = c.id)","expect":"rows=0"},
    {"n":"realtime: new messages are published to logged-in readers","as":"admin","sql":"select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages'","expect":"rows=1"},
    {"n":"metrics: users cannot read the admin views (active profiles)","as":"alice","sql":"select 1 from public.metrics_active_profiles","expect":"error=permission denied"},
    {"n":"metrics: ...weekly matches","as":"alice","sql":"select 1 from public.metrics_weekly_matches","expect":"error=permission denied"},
    {"n":"metrics: ...retention","as":"alice","sql":"select 1 from public.metrics_retention_30d","expect":"error=permission denied"},
    {"n":"metrics: logged-out visitors cannot read them either","as":"anon","sql":"select 1 from public.metrics_active_profiles","expect":"error=permission denied"},
    {"n":"metrics: users cannot set last_seen_at or is_demo themselves","as":"alice","sql":"update public.profiles set is_demo = true where id='{alice}'","expect":"error=permission denied"},
    {"n":"metrics: setup: dave was first seen 100 days ago and last seen 70 days after signup; erin signed up 100 days ago, last seen 5 days ago; gina is a demo like erin","as":"admin","sql":"with x as (update public.profiles p set created_at = now() - interval '100 days', last_seen_at = case p.id when '{dave}' then now() - interval '30 days' when '{erin}' then now() - interval '5 days' when '{gina}' then now() - interval '5 days' end, is_demo = (p.id = '{gina}') where p.id in ('{dave}','{erin}','{gina}') returning 1) select 1 where (select count(*) from x) = 0","expect":"rows=0"},
    {"n":"metrics: erin (Remote + Local, France, 69) counts as seen in the last 30 days, gina (demo) does not","as":"admin","sql":"select 1 from public.metrics_active_profiles where region = 'local_hors_ile_de_france' and active_profiles_30d >= 1","expect":"rows=1"},
    {"n":"metrics: the demo profile is excluded from active profiles","as":"admin","sql":"select 1 where (select coalesce(sum(active_profiles_30d),0) from public.metrics_active_profiles) = (select count(*) from public.profiles p where not p.is_demo and p.last_seen_at >= now() - interval '30 days')","expect":"rows=1"},
    {"n":"metrics: retention counts erin (seen 95 days after signup) and dave (70 days after signup), not the demo","as":"admin","sql":"select 1 from public.metrics_retention_30d where signup_week_start = date_trunc('week', now() - interval '100 days')::date and seen_after_30d >= 2","expect":"rows=1"},
    {"n":"metrics: retention never shows a signup week younger than 37 days","as":"admin","sql":"select 1 from public.metrics_retention_30d where signup_week_start > (now() - interval '37 days')::date","expect":"rows=0"},
    {"n":"metrics: last seen 10 minutes ago (setup)","as":"admin","sql":"update public.profiles set last_seen_at = now() - interval '10 minutes' where id='{alice}'","expect":"rows=1"},
    {"n":"metrics: opening the app again within the hour changes nothing","as":"alice","sql":"select public.touch_last_seen()","expect":"rows=1"},
    {"n":"metrics: ...still 10 minutes ago","as":"admin","sql":"select 1 from public.profiles where id='{alice}' and last_seen_at < now() - interval '9 minutes'","expect":"rows=1"},
    {"n":"metrics: last seen 2 hours ago (setup)","as":"admin","sql":"update public.profiles set last_seen_at = now() - interval '2 hours' where id='{alice}'","expect":"rows=1"},
    {"n":"metrics: opening the app after an hour updates it","as":"alice","sql":"select public.touch_last_seen()","expect":"rows=1"},
    {"n":"metrics: ...it was refreshed","as":"admin","sql":"select 1 from public.profiles where id='{alice}' and last_seen_at > now() - interval '1 minute'","expect":"rows=1"},
    {"n":"parcours: setup: gina and erin like each other","as":"gina","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{gina}','{erin}','like')","expect":"rows=1"},
    {"n":"parcours: ...","as":"erin","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{erin}','{gina}','like')","expect":"rows=1"},
    {"n":"parcours: setup: gina and dave like each other","as":"gina","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{gina}','{dave}','like')","expect":"rows=1"},
    {"n":"parcours: ...","as":"dave","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{dave}','{gina}','like')","expect":"rows=1"},
    {"n":"parcours: a person with no match cannot start one with a stranger (erin has no match with hank)","as":"erin","sql":"select public.start_journey((select m.id from public.matches m where m.user_a = least('{erin}'::uuid,'{hank}'::uuid) and m.user_b = greatest('{erin}'::uuid,'{hank}'::uuid)), 'Non', 'x')","expect":"error=match not found"},
    {"n":"parcours: logged-out visitors cannot start one","as":"anon","sql":"select public.start_journey('{matchid}', 'Non', 'x')","expect":"error=permission denied"},
    {"n":"parcours: a name is required","as":"gina","sql":"select public.start_journey((select m.id from public.matches m where m.user_a = least('{gina}'::uuid,'{erin}'::uuid) and m.user_b = greatest('{gina}'::uuid,'{erin}'::uuid)), '   ', 'x')","expect":"error=invalid name"},
    {"n":"parcours: gina starts a parcours from her match with erin","as":"gina","sql":"select public.start_journey((select m.id from public.matches m where m.user_a = least('{gina}'::uuid,'{erin}'::uuid) and m.user_b = greatest('{gina}'::uuid,'{erin}'::uuid)), 'Boulangerie du quartier', 'g1')","expect":"rows=1"},
    {"n":"parcours: gina is active and erin is invited","as":"admin","sql":"select 1 from public.journey_members jm join public.journeys j on j.id=jm.journey_id where j.goal='g1' and ((jm.user_id='{gina}' and jm.status='active') or (jm.user_id='{erin}' and jm.status='invited'))","expect":"rows=2"},
    {"n":"parcours: it has its own group conversation (the 1:1 chat is untouched)","as":"admin","sql":"select 1 from public.conversations c join public.journeys j on j.conversation_id=c.id where j.goal='g1' and c.type='group'","expect":"rows=1"},
    {"n":"parcours: ...with only the creator as a participant until the invitation is accepted","as":"admin","sql":"select 1 from public.conversation_participants cp join public.journeys j on j.conversation_id=cp.conversation_id where j.goal='g1'","expect":"rows=1"},
    {"n":"parcours: the invited person can see the invitation (the parcours)","as":"erin","sql":"select 1 from public.journeys where goal='g1'","expect":"rows=1"},
    {"n":"parcours: ...but not the group chat before accepting","as":"erin","sql":"select 1 from public.messages x join public.journeys j on j.conversation_id = x.conversation_id where j.goal='g1'","expect":"rows=0"},
    {"n":"parcours: ...and not the links","as":"erin","sql":"select 1 from public.journey_links","expect":"rows=0"},
    {"n":"parcours: an outsider (dave) sees no parcours","as":"dave","sql":"select 1 from public.journeys","expect":"rows=0"},
    {"n":"parcours: nobody can create a parcours by inserting into the table","as":"gina","sql":"insert into public.journeys (name, conversation_id) values ('x','{conv}')","expect":"error=permission denied"},
    {"n":"parcours: nobody can delete one","as":"gina","sql":"delete from public.journeys","expect":"error=permission denied"},
    {"n":"parcours: nobody can add themselves as a member","as":"dave","sql":"insert into public.journey_members (journey_id, user_id, status) select id, '{dave}', 'active' from public.journeys","expect":"error=permission denied"},
    {"n":"parcours: an outsider cannot accept someone else's invitation","as":"dave","sql":"select public.respond_to_journey_invite((select id from public.journeys where goal='g1'), true)","expect":"error=invitation not found"},
    {"n":"parcours: erin accepts","as":"erin","sql":"select public.respond_to_journey_invite((select id from public.journeys where goal='g1'), true)","expect":"rows=1"},
    {"n":"parcours: erin is now a participant of the group chat","as":"admin","sql":"select 1 from public.conversation_participants cp join public.journeys j on j.conversation_id=cp.conversation_id where j.goal='g1'","expect":"rows=2"},
    {"n":"parcours: erin writes in the group chat","as":"erin","sql":"insert into public.messages (conversation_id, sender_id, body) select j.conversation_id, '{erin}', 'Bonjour tout le monde' from public.journeys j where j.goal='g1'","expect":"rows=1"},
    {"n":"parcours: gina reads it","as":"gina","sql":"select 1 from public.messages x join public.journeys j on j.conversation_id = x.conversation_id where j.goal='g1'","expect":"rows=1"},
    {"n":"parcours: an outsider (dave) cannot read it","as":"dave","sql":"select 1 from public.messages x join public.journeys j on j.conversation_id = x.conversation_id where j.goal='g1'","expect":"rows=0"},
    {"n":"parcours: a member cannot write as somebody else","as":"gina","sql":"insert into public.messages (conversation_id, sender_id, body) select j.conversation_id, '{erin}', 'usurpation' from public.journeys j where j.goal='g1'","expect":"error=row-level security"},
    {"n":"parcours: a member cannot invite someone they have no match with (erin, alice)","as":"erin","sql":"select public.invite_to_journey((select id from public.journeys where goal='g1'), '{alice}')","expect":"error=not matched"},
    {"n":"parcours: nobody invites themselves","as":"gina","sql":"select public.invite_to_journey((select id from public.journeys where goal='g1'), '{gina}')","expect":"error=invalid person"},
    {"n":"parcours: an outsider cannot invite anyone","as":"dave","sql":"select public.invite_to_journey((select id from public.journeys where goal='g1'), '{gina}')","expect":"error=not allowed"},
    {"n":"parcours: gina invites dave, her match","as":"gina","sql":"select public.invite_to_journey((select id from public.journeys where goal='g1'), '{dave}')","expect":"rows=1"},
    {"n":"parcours: inviting him twice is refused","as":"gina","sql":"select public.invite_to_journey((select id from public.journeys where goal='g1'), '{dave}')","expect":"error=already invited or member"},
    {"n":"parcours: before accepting, dave cannot read erin's profile (they never matched)","as":"dave","sql":"select 1 from public.profiles where id='{erin}'","expect":"rows=0"},
    {"n":"parcours: dave accepts","as":"dave","sql":"select public.respond_to_journey_invite((select id from public.journeys where goal='g1'), true)","expect":"rows=1"},
    {"n":"parcours: now dave can read erin's profile (same parcours)","as":"dave","sql":"select 1 from public.profiles where id='{erin}'","expect":"rows=1"},
    {"n":"parcours: ...but still not her postal code (private)","as":"dave","sql":"select postal_code from public.profiles where id='{erin}'","expect":"error=permission denied"},
    {"n":"parcours: dave sees all three members","as":"dave","sql":"select 1 from public.journey_members m join public.journeys j on j.id=m.journey_id where j.goal='g1' and m.status='active'","expect":"rows=3"},
    {"n":"parcours: dave reads the chat from before he joined","as":"dave","sql":"select 1 from public.messages x join public.journeys j on j.conversation_id = x.conversation_id where j.goal='g1'","expect":"rows=1"},
    {"n":"links: erin adds a website link","as":"erin","sql":"insert into public.journey_links (journey_id, added_by, title, url, kind) values ((select id from public.journeys where goal='g1'), '{erin}', 'Notre site', 'https://exemple.fr/boulangerie', 'website')","expect":"rows=1"},
    {"n":"links: only https is accepted (http refused)","as":"erin","sql":"insert into public.journey_links (journey_id, added_by, title, url, kind) values ((select id from public.journeys where goal='g1'), '{erin}', 'Non', 'http://exemple.fr', 'website')","expect":"error=journey_links_url_https"},
    {"n":"links: javascript links are refused","as":"erin","sql":"insert into public.journey_links (journey_id, added_by, title, url, kind) values ((select id from public.journeys where goal='g1'), '{erin}', 'Non', 'javascript:alert(1)', 'other')","expect":"error=journey_links_url_https"},
    {"n":"links: a link with a space is refused","as":"erin","sql":"insert into public.journey_links (journey_id, added_by, title, url, kind) values ((select id from public.journeys where goal='g1'), '{erin}', 'Non', 'https://exemple.fr/a b', 'other')","expect":"error=journey_links_url_https"},
    {"n":"links: a title is required","as":"erin","sql":"insert into public.journey_links (journey_id, added_by, title, url, kind) values ((select id from public.journeys where goal='g1'), '{erin}', '  ', 'https://exemple.fr', 'other')","expect":"error=journey_links_title_check"},
    {"n":"links: an unknown kind is refused","as":"erin","sql":"insert into public.journey_links (journey_id, added_by, title, url, kind) values ((select id from public.journeys where goal='g1'), '{erin}', 'Non', 'https://exemple.fr', 'telegram')","expect":"error=journey_links_kind_check"},
    {"n":"links: members can read them (dave)","as":"dave","sql":"select 1 from public.journey_links","expect":"rows=1"},
    {"n":"links: an outsider (alice) cannot read them","as":"alice","sql":"select 1 from public.journey_links","expect":"rows=0"},
    {"n":"links: an outsider cannot add one","as":"alice","sql":"insert into public.journey_links (journey_id, added_by, title, url, kind) values ((select id from public.journeys where goal='g1'), '{alice}', 'Non', 'https://exemple.fr', 'other')","expect":"error=row-level security"},
    {"n":"links: a member cannot add a link in someone else's name","as":"dave","sql":"insert into public.journey_links (journey_id, added_by, title, url, kind) values ((select id from public.journeys where goal='g1'), '{erin}', 'Non', 'https://exemple.fr', 'other')","expect":"error=row-level security"},
    {"n":"links: gina adds a private WhatsApp link","as":"gina","sql":"insert into public.journey_links (journey_id, added_by, title, url, kind) values ((select id from public.journeys where goal='g1'), '{gina}', 'Groupe WhatsApp', 'https://chat.whatsapp.com/abcdef', 'whatsapp')","expect":"rows=1"},
    {"n":"links: dave (neither the adder nor the creator) cannot delete gina's link","as":"dave","sql":"delete from public.journey_links where added_by='{gina}'","expect":"rows=0"},
    {"n":"links: gina (creator) can delete erin's link","as":"gina","sql":"delete from public.journey_links where added_by='{erin}'","expect":"rows=1"},
    {"n":"links: gina removes her own","as":"gina","sql":"delete from public.journey_links where added_by='{gina}'","expect":"rows=1"},
    {"n":"parcours: a member can rename it","as":"dave","sql":"update public.journeys set name='Boulangerie et retouches' where goal='g1'","expect":"rows=1"},
    {"n":"parcours: an outsider cannot","as":"alice","sql":"update public.journeys set name='Piraté' where goal='g1'","expect":"rows=0"},
    {"n":"parcours: nobody can change who created it or its chat","as":"gina","sql":"update public.journeys set created_by='{dave}' where goal='g1'","expect":"error=permission denied"},
    {"n":"parcours: setup: bob blocks erin","as":"bob","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{bob}','{erin}')","expect":"rows=1"},
    {"n":"parcours: setup: gina and bob like each other","as":"gina","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{gina}','{bob}','like')","expect":"rows=1"},
    {"n":"parcours: ...","as":"bob","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{bob}','{gina}','like')","expect":"rows=1"},
    {"n":"parcours: gina cannot invite bob (he blocked erin, a current member)","as":"gina","sql":"select public.invite_to_journey((select id from public.journeys where goal='g1'), '{bob}')","expect":"error=not allowed"},
    {"n":"group chat: dave blocks erin","as":"dave","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{dave}','{erin}')","expect":"rows=1"},
    {"n":"group chat: a block between two members does not hide the group chat (dave)","as":"dave","sql":"select 1 from public.messages x join public.journeys j on j.conversation_id = x.conversation_id where j.goal='g1'","expect":"rows=1"},
    {"n":"group chat: ...nor for gina","as":"gina","sql":"select 1 from public.messages x join public.journeys j on j.conversation_id = x.conversation_id where j.goal='g1'","expect":"rows=1"},
    {"n":"group chat: dave and erin cannot see each other's profile any more","as":"dave","sql":"select 1 from public.profiles where id='{erin}'","expect":"rows=0"},
    {"n":"parcours: dave leaves","as":"dave","sql":"select public.leave_journey((select id from public.journeys where goal='g1'))","expect":"rows=1"},
    {"n":"parcours: dave can no longer read the chat","as":"dave","sql":"select 1 from public.messages x join public.journeys j on j.conversation_id = x.conversation_id where j.goal='g1'","expect":"rows=0"},
    {"n":"parcours: ...nor the links or the parcours","as":"dave","sql":"select 1 from public.journeys","expect":"rows=0"},
    {"n":"parcours: two active members are left, so it is not archived","as":"admin","sql":"select 1 from public.journeys where goal='g1' and archived_at is null","expect":"rows=1"},
    {"n":"parcours: erin leaves too, leaving fewer than 2 active members","as":"erin","sql":"select public.leave_journey((select id from public.journeys where goal='g1'))","expect":"rows=1"},
    {"n":"parcours: it is archived, and so is its chat","as":"admin","sql":"select 1 from public.journeys j join public.conversations c on c.id=j.conversation_id where j.goal='g1' and j.archived_at is not null and c.archived_at is not null","expect":"rows=1"},
    {"n":"parcours: no message was deleted","as":"admin","sql":"select 1 from public.messages x join public.journeys j on j.conversation_id = x.conversation_id where j.goal='g1'","expect":"rows=1"},
    {"n":"parcours: gina can still read the archived chat","as":"gina","sql":"select 1 from public.messages x join public.journeys j on j.conversation_id = x.conversation_id where j.goal='g1'","expect":"rows=1"},
    {"n":"parcours: ...but nobody can write in it","as":"gina","sql":"insert into public.messages (conversation_id, sender_id, body) select j.conversation_id, '{gina}', 'encore' from public.journeys j where j.goal='g1'","expect":"error=row-level security"},
    {"n":"parcours: ...nor add links to an archived parcours","as":"gina","sql":"insert into public.journey_links (journey_id, added_by, title, url, kind) values ((select id from public.journeys where goal='g1'), '{gina}', 'Non', 'https://exemple.fr', 'other')","expect":"error=row-level security"},
    {"n":"parcours: gina starts another one with dave","as":"gina","sql":"select public.start_journey((select m.id from public.matches m where m.user_a = least('{gina}'::uuid,'{dave}'::uuid) and m.user_b = greatest('{gina}'::uuid,'{dave}'::uuid)), 'Deuxième idée', 'g2')","expect":"rows=1"},
    {"n":"parcours: dave declines","as":"dave","sql":"select public.respond_to_journey_invite((select id from public.journeys where goal='g2'), false)","expect":"rows=1"},
    {"n":"parcours: an empty parcours is removed with its chat","as":"admin","sql":"select 1 from public.journeys where goal='g2'","expect":"rows=0"},
    {"n":"parcours: gina starts a third with dave and he accepts","as":"gina","sql":"select public.start_journey((select m.id from public.matches m where m.user_a = least('{gina}'::uuid,'{dave}'::uuid) and m.user_b = greatest('{gina}'::uuid,'{dave}'::uuid)), 'Troisième', 'g3')","expect":"rows=1"},
    {"n":"parcours: ...accepts","as":"dave","sql":"select public.respond_to_journey_invite((select id from public.journeys where goal='g3'), true)","expect":"rows=1"},
    {"n":"parcours: dave deletes his account","as":"admin","sql":"delete from auth.users where id='{dave}'","expect":"rows=1"},
    {"n":"parcours: the parcours survives for gina, archived (only one active member left)","as":"admin","sql":"select 1 from public.journeys where goal='g3' and archived_at is not null","expect":"rows=1"},
    {"n":"parcours: gina can still read it","as":"gina","sql":"select 1 from public.journeys where goal='g3'","expect":"rows=1"},
    {"n":"account deletion: deleting alice's auth user works","as":"admin","sql":"delete from auth.users where id='{alice}'","expect":"rows=1"},
    {"n":"account deletion: her profile is gone","as":"admin","sql":"select 1 from public.profiles where id='{alice}'","expect":"rows=0"},
    {"n":"account deletion: her swipes are gone","as":"admin","sql":"select 1 from public.swipes where '{alice}' in (swiper_id, target_id)","expect":"rows=0"},
    {"n":"account deletion: her match is gone","as":"admin","sql":"select 1 from public.matches where '{alice}' in (user_a, user_b)","expect":"rows=0"},
    {"n":"account deletion: her messages are gone","as":"admin","sql":"select 1 from public.messages where sender_id='{alice}'","expect":"rows=0"},
    {"n":"account deletion: her reports are gone","as":"admin","sql":"select 1 from public.reports where reporter_id='{alice}'","expect":"rows=0"},
    {"n":"account deletion: her categories and skills are gone","as":"admin","sql":"select 1 from public.profile_categories where profile_id='{alice}' union all select 1 from public.profile_skills where profile_id='{alice}'","expect":"rows=0"},
    {"n":"account deletion: bob's profile is untouched","as":"admin","sql":"select 1 from public.profiles where id='{bob}'","expect":"rows=1"}
  ]$j$;
  t jsonb;
  who text;
  expect text;
  stmt text;
  n integer;
  err text;
  ok boolean;
  report text := '';
  passed integer := 0;
  failed integer := 0;
begin
  for t in select * from jsonb_array_elements(tests) loop
    who := t->>'as';
    expect := t->>'expect';
    stmt := replace(replace(replace(t->>'sql', '{conv}', conv::text), '{conv2}', conv2::text), '{matchid}', matchid::text);
    for who_key in select jsonb_object_keys(people) loop
      stmt := replace(stmt, '{' || who_key || '}', people->>who_key);
    end loop;
    err := null;
    n := null;
    begin
      reset role;
      if who = 'anon' then
        perform set_config('request.jwt.claims', '', true);
        set local role anon;
      elsif who <> 'admin' then
        perform set_config('request.jwt.claims', json_build_object(
          'sub', people->>who,
          'role', 'authenticated')::text, true);
        set local role authenticated;
      end if;
      execute stmt;
      get diagnostics n = row_count;
    exception when others then
      err := sqlerrm;
    end;
    reset role;
    if expect like 'rows=%' then
      ok := err is null and n = substr(expect, 6)::integer;
    else
      ok := err is not null and err ilike '%' || substr(expect, 7) || '%';
    end if;
    if ok then
      passed := passed + 1;
      report := report || E'\nPASS  ' || (t->>'n');
    else
      failed := failed + 1;
      report := report || E'\nFAIL  ' || (t->>'n')
        || E'\n        expected: ' || expect
        || E'\n        got:      ' || coalesce('error: ' || err, 'rows=' || n::text);
    end if;
  end loop;
  raise exception E'\n===== RLS SMOKE TEST: % passed, % failed (everything was rolled back) =====\n%',
    passed, failed, report;
end;
$test$;