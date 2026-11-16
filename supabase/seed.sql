-- ============================================================================
-- Medersa Ustaz Evaluation Management System
-- Seed Script & Initial Account Setup
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION seed_user_account(
  user_email TEXT,
  user_password TEXT,
  user_full_name TEXT,
  user_role TEXT
) RETURNS UUID AS $$
DECLARE
  new_uid UUID := gen_random_uuid();
  encrypted_pw TEXT;
BEGIN
  encrypted_pw := crypt(user_password, gen_salt('bf'));

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    SELECT id INTO new_uid FROM auth.users WHERE email = user_email;
    UPDATE public.profiles 
    SET full_name = user_full_name, role = user_role, is_active = true
    WHERE id = new_uid;
    RETURN new_uid;
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    email_change_token_current,
    reauthentication_token,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_uid,
    'authenticated',
    'authenticated',
    user_email,
    encrypted_pw,
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', user_full_name, 'role', user_role),
    now(),
    now()
  );

  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (new_uid, user_full_name, user_role, true)
  ON CONFLICT (id) DO UPDATE 
  SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = true;

  RETURN new_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT seed_user_account('admin@medersa.org', 'AdminPass123!', 'Chief Administrator', 'admin');
SELECT seed_user_account('entry1@medersa.org', 'EntryPass123!', 'Data Entry Officer 1', 'data_entry');
SELECT seed_user_account('entry2@medersa.org', 'EntryPass123!', 'Data Entry Officer 2', 'data_entry');
