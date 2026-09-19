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
  people jsonb := jsonb_build_object('alice', alice, 'bob', bob, 'carol', carol, 'dave', dave,
    'erin', erin, 'frank', frank, 'gina', gina, 'hank', hank);
  who_key text;
  the_match constant uuid := '11111111-1111-1111-1111-111111111111';
  tests jsonb := $j$[
    {"n":"setup: create 3 fake users","as":"admin","sql":"insert into auth.users (id, aud, role, email) values ('{alice}','authenticated','authenticated','alice@test.invalid'), ('{bob}','authenticated','authenticated','bob@test.invalid'), ('{carol}','authenticated','authenticated','carol@test.invalid')","expect":"rows=3"},
    {"n":"sign-up trigger creates an empty profile for each user","as":"admin","sql":"select 1 from public.profiles where id in ('{alice}','{bob}','{carol}') and onboarded = false","expect":"rows=3"},

    {"n":"profiles: alice completes her own profile","as":"alice","sql":"update public.profiles set display_name='Alice', work_mode='remote_ok', idea_status='exploring', weekly_hours='5_10', ambition='for_fun', onboarded=true where id='{alice}'","expect":"rows=1"},
    {"n":"profiles: bob completes his own profile","as":"bob","sql":"update public.profiles set display_name='Bob', work_mode='remote_ok', idea_status='wants_to_join', weekly_hours='10_20', ambition='side_income', onboarded=true where id='{bob}'","expect":"rows=1"},
    {"n":"profiles: alice cannot edit bob's profile","as":"alice","sql":"update public.profiles set display_name='Hacked' where id='{bob}'","expect":"rows=0"},
    {"n":"profiles: nobody can change the id column","as":"alice","sql":"update public.profiles set id='{carol}' where id='{alice}'","expect":"error=permission denied"},
    {"n":"profiles: cannot mark onboarded with missing fields","as":"carol","sql":"update public.profiles set onboarded=true where id='{carol}'","expect":"error=profiles_onboarded_complete"},
    {"n":"profiles: local-only without a city is rejected","as":"carol","sql":"update public.profiles set display_name='C', work_mode='local_only', idea_status='exploring', weekly_hours='lt_5', ambition='for_fun', onboarded=true where id='{carol}'","expect":"error=profiles_onboarded_complete"},
    {"n":"profiles: has_idea without a pitch is rejected","as":"carol","sql":"update public.profiles set display_name='C', work_mode='remote_ok', idea_status='has_idea', weekly_hours='lt_5', ambition='for_fun', onboarded=true where id='{carol}'","expect":"error=profiles_onboarded_complete"},
    {"n":"profiles: pitch over 280 characters is rejected","as":"carol","sql":"update public.profiles set pitch=repeat('x',281) where id='{carol}'","expect":"error=profiles_pitch_length"},
    {"n":"profiles: partner hours can be set to a valid range","as":"carol","sql":"update public.profiles set partner_weekly_hours='20_plus' where id='{carol}'","expect":"rows=1"},
    {"n":"profiles: partner hours can be cleared (no preference)","as":"carol","sql":"update public.profiles set partner_weekly_hours=null where id='{carol}'","expect":"rows=1"},
    {"n":"profiles: invalid partner hours value is rejected","as":"carol","sql":"update public.profiles set partner_weekly_hours='forever' where id='{carol}'","expect":"error=profiles_partner_weekly_hours_values"},
    {"n":"profiles: invalid work_mode value is rejected","as":"carol","sql":"update public.profiles set work_mode='nonsense' where id='{carol}'","expect":"error=profiles_work_mode_values"},
    {"n":"profiles: before any match, alice sees only herself","as":"alice","sql":"select id from public.profiles","expect":"rows=1"},
    {"n":"profiles: logged-out visitor is refused","as":"anon","sql":"select id from public.profiles","expect":"error=permission denied"},
    {"n":"profiles: users cannot insert profiles","as":"alice","sql":"insert into public.profiles (id) values (gen_random_uuid())","expect":"error=permission denied"},
    {"n":"profiles: users cannot delete profiles","as":"alice","sql":"delete from public.profiles where id='{alice}'","expect":"error=permission denied"},

    {"n":"categories: logged-in user sees all 7","as":"alice","sql":"select id from public.categories","expect":"rows=7"},
    {"n":"categories: exactly one is active (video games)","as":"alice","sql":"select id from public.categories where is_active and slug='video_games'","expect":"rows=1"},
    {"n":"skills: logged-in user sees all 14 seeded skills","as":"alice","sql":"select id from public.skills","expect":"rows=14"},
    {"n":"categories: logged-out visitor is refused","as":"anon","sql":"select id from public.categories","expect":"error=permission denied"},
    {"n":"categories: users cannot add categories","as":"alice","sql":"insert into public.categories (slug, name) values ('x','x')","expect":"error=permission denied"},
    {"n":"skills: users cannot change skills","as":"alice","sql":"update public.skills set is_active=false","expect":"error=permission denied"},

    {"n":"profile_categories: alice picks the active category","as":"alice","sql":"insert into public.profile_categories (profile_id, category_id) select '{alice}', id from public.categories where slug='video_games'","expect":"rows=1"},
    {"n":"profile_categories: cannot pick an inactive category","as":"alice","sql":"insert into public.profile_categories (profile_id, category_id) select '{alice}', id from public.categories where slug='local_services'","expect":"error=row-level security"},
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
    {"n":"avatars: another logged-in user can read alice's photo","as":"bob","sql":"select 1 from storage.objects where bucket_id='avatars'","expect":"rows=1"},
    {"n":"avatars: logged-out visitor cannot see photos","as":"anon","sql":"select 1 from storage.objects where bucket_id='avatars'","expect":"rows=0"},
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

    {"n":"matches: pair stored in the wrong order is rejected","as":"admin","sql":"insert into public.matches (id, user_a, user_b) values ('{match}','{bob}','{alice}')","expect":"error=matches_ordered"},
    {"n":"matches: (setup) alice+bob match","as":"admin","sql":"insert into public.matches (id, user_a, user_b) values ('{match}','{alice}','{bob}')","expect":"rows=1"},
    {"n":"matches: the same pair cannot match twice","as":"admin","sql":"insert into public.matches (user_a, user_b) values ('{alice}','{bob}')","expect":"error=matches_pair_unique"},
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

    {"n":"messages: alice sends a message in her match","as":"alice","sql":"insert into public.messages (match_id, sender_id, body) values ('{match}','{alice}','hi bob')","expect":"rows=1"},
    {"n":"messages: bob can read it","as":"bob","sql":"select 1 from public.messages","expect":"rows=1"},
    {"n":"messages: carol cannot read it","as":"carol","sql":"select 1 from public.messages","expect":"rows=0"},
    {"n":"messages: carol cannot send into someone else's match","as":"carol","sql":"insert into public.messages (match_id, sender_id, body) values ('{match}','{carol}','let me in')","expect":"error=row-level security"},
    {"n":"messages: cannot send as someone else","as":"alice","sql":"insert into public.messages (match_id, sender_id, body) values ('{match}','{bob}','fake')","expect":"error=row-level security"},
    {"n":"messages: empty message is rejected","as":"alice","sql":"insert into public.messages (match_id, sender_id, body) values ('{match}','{alice}','   ')","expect":"error=messages_body_length"},
    {"n":"messages: message over 2000 characters is rejected","as":"alice","sql":"insert into public.messages (match_id, sender_id, body) values ('{match}','{alice}',repeat('x',2001))","expect":"error=messages_body_length"},
    {"n":"messages: message of exactly 2000 characters is accepted","as":"alice","sql":"insert into public.messages (match_id, sender_id, body) values ('{match}','{alice}',repeat('x',2000))","expect":"rows=1"},
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

    {"n":"feed setup: create dave, erin, frank, gina, hank","as":"admin","sql":"insert into auth.users (id, aud, role, email) values ('{dave}','authenticated','authenticated','dave@test.invalid'), ('{erin}','authenticated','authenticated','erin@test.invalid'), ('{frank}','authenticated','authenticated','frank@test.invalid'), ('{gina}','authenticated','authenticated','gina@test.invalid'), ('{hank}','authenticated','authenticated','hank@test.invalid')","expect":"rows=5"},
    {"n":"feed setup: dave = local-only in ' LYON ', erin = remote in 'lyon', frank = local-only in Paris, gina = remote, hank = not onboarded","as":"admin","sql":"update public.profiles p set display_name=v.n, work_mode=v.wm, city=v.city, idea_status='exploring', weekly_hours='5_10', ambition='for_fun', onboarded=v.onb from (values ('{dave}'::uuid,'Dave','local_only',' LYON ',true), ('{erin}'::uuid,'Erin','remote_ok','lyon',true), ('{frank}'::uuid,'Frank','local_only','Paris',true), ('{gina}'::uuid,'Gina','remote_ok',null,true), ('{hank}'::uuid,'Hank','remote_ok',null,false)) as v(id,n,wm,city,onb) where p.id=v.id","expect":"rows=5"},
    {"n":"feed setup: everyone picks video games, except gina who only has an inactive category","as":"admin","sql":"insert into public.profile_categories (profile_id, category_id) select v.id, c.id from (values ('{dave}'::uuid,'video_games'), ('{erin}'::uuid,'video_games'), ('{frank}'::uuid,'video_games'), ('{gina}'::uuid,'local_services'), ('{hank}'::uuid,'video_games')) as v(id,slug) join public.categories c on c.slug=v.slug","expect":"rows=5"},
    {"n":"feed setup: erin offers game programming","as":"admin","sql":"insert into public.profile_skills (profile_id, skill_id, kind) select '{erin}', id, 'offers' from public.skills where slug='game_programming'","expect":"rows=1"},

    {"n":"feed: a local-only user sees only people in the same city (case and spaces ignored)","as":"dave","sql":"select 1 from public.get_feed()","expect":"rows=1"},
    {"n":"feed: ...and that person is erin","as":"dave","sql":"select 1 from public.get_feed() where id='{erin}'","expect":"rows=1"},
    {"n":"feed: a local-only user with nobody in their city sees nobody","as":"frank","sql":"select 1 from public.get_feed()","expect":"rows=0"},
    {"n":"feed: a remote user sees other remote users, plus local-only people in the same city (alice, bob, dave) but not frank in Paris","as":"erin","sql":"select 1 from public.get_feed()","expect":"rows=3"},
    {"n":"feed: ...frank (local-only, Paris) is not shown to erin (remote, Lyon)","as":"erin","sql":"select 1 from public.get_feed() where id='{frank}'","expect":"rows=0"},
    {"n":"feed: ...and erin is not shown to frank either (two-way)","as":"frank","sql":"select 1 from public.get_feed() where id='{erin}'","expect":"rows=0"},
    {"n":"feed: two remote users in different cities (or with no city) see each other: bob sees erin","as":"bob","sql":"select 1 from public.get_feed() where id='{erin}'","expect":"rows=1"},
    {"n":"feed: ...and erin sees bob","as":"erin","sql":"select 1 from public.get_feed() where id='{bob}'","expect":"rows=1"},
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
    {"n":"feed: erin passes on dave","as":"erin","sql":"insert into public.swipes (swiper_id, target_id, direction) values ('{erin}','{dave}','pass')","expect":"rows=1"},
    {"n":"feed: ...and dave disappears from her feed (alice and bob remain)","as":"erin","sql":"select 1 from public.get_feed()","expect":"rows=2"},
    {"n":"feed: erin blocks alice","as":"erin","sql":"insert into public.blocks (blocker_id, blocked_id) values ('{erin}','{alice}')","expect":"rows=1"},
    {"n":"feed: the blocker no longer sees the blocked person (only bob remains)","as":"erin","sql":"select 1 from public.get_feed()","expect":"rows=1"},
    {"n":"feed: the blocked person no longer sees the blocker either","as":"alice","sql":"select 1 from public.get_feed() where id='{erin}'","expect":"rows=0"},
    {"n":"feed: cannot ask for another person's feed (no user id parameter)","as":"alice","sql":"select 1 from public.get_feed('{bob}')","expect":"error=does not exist"},
    {"n":"feed: logged-out visitor cannot call it","as":"anon","sql":"select 1 from public.get_feed()","expect":"error=permission denied"},
    {"n":"feed setup: 25 more onboarded remote users who play video games","as":"admin","sql":"insert into auth.users (id, aud, role, email) select gen_random_uuid(), 'authenticated', 'authenticated', 'bulk' || g || '@test.invalid' from generate_series(1,25) g","expect":"rows=25"},
    {"n":"feed setup: complete the 25 profiles","as":"admin","sql":"update public.profiles set display_name='Bulk', work_mode='remote_ok', idea_status='exploring', weekly_hours='5_10', ambition='for_fun', onboarded=true where id in (select id from auth.users where email like 'bulk%@test.invalid')","expect":"rows=25"},
    {"n":"feed setup: give them the video games category","as":"admin","sql":"insert into public.profile_categories (profile_id, category_id) select u.id, c.id from auth.users u cross join public.categories c where u.email like 'bulk%@test.invalid' and c.slug='video_games'","expect":"rows=25"},
    {"n":"feed: never more than 20 cards at once","as":"erin","sql":"select 1 from public.get_feed()","expect":"rows=20"},

    {"n":"account deletion: deleting alice's auth user works","as":"admin","sql":"delete from auth.users where id='{alice}'","expect":"rows=1"},
    {"n":"account deletion: her profile is gone","as":"admin","sql":"select 1 from public.profiles where id='{alice}'","expect":"rows=0"},
    {"n":"account deletion: her swipes are gone","as":"admin","sql":"select 1 from public.swipes where '{alice}' in (swiper_id, target_id)","expect":"rows=0"},
    {"n":"account deletion: her match is gone","as":"admin","sql":"select 1 from public.matches where '{alice}' in (user_a, user_b)","expect":"rows=0"},
    {"n":"account deletion: her messages are gone","as":"admin","sql":"select 1 from public.messages","expect":"rows=0"},
    {"n":"account deletion: her reports are gone","as":"admin","sql":"select 1 from public.reports","expect":"rows=0"},
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
    stmt := replace(t->>'sql', '{match}', the_match::text);
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
