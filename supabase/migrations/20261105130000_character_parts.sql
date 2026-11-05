-- Character customization v2: gender, outfit, shoes and facial hair were added to custom
-- characters, so custom codes grow beyond seven palette indices. Allow 7-16 (older 7-digit
-- codes stay valid; the client treats missing parts as their first option).
alter table public.profiles drop constraint profiles_character_check;
alter table public.profiles
  add constraint profiles_character_check
  check (character ~ '^(hero:[0-9]{1,2}|c:[0-9a-z]{7,16})$');
