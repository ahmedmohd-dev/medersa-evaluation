-- ============================================================================
-- Migration 006: Seed Real Ustazes for Boys and Girls Sections
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_real_ustazes()
RETURNS void AS $$
DECLARE
  v_boys_id UUID;
  v_girls_id UUID;
BEGIN
  SELECT id INTO v_boys_id FROM public.evaluation_groups WHERE name = 'boys' LIMIT 1;
  SELECT id INTO v_girls_id FROM public.evaluation_groups WHERE name = 'girls' LIMIT 1;

  -- Deactivate previous dummy sample ustazes
  UPDATE public.ustazes
  SET is_active = false
  WHERE name IN (
    'Ustaz Ahmed Ibrahim',
    'Ustaz Bilal Mohammed',
    'Ustaz Khalid Omar',
    'Ustaz Tariq Mansur',
    'Ustaza Aisha Abdulkarim',
    'Ustaza Fatima Zahra',
    'Ustaza Khadija Yusuf',
    'Ustaza Maryam Hassan'
  );

  -- Insert Girls' Ustazes (15)
  INSERT INTO public.ustazes (name, group_id, is_active)
  VALUES
    ('Ekram Akmel', v_girls_id, true),
    ('Eman Ibrahim', v_girls_id, true),
    ('Firdews Maeruf', v_girls_id, true),
    ('Fozia Jemal', v_girls_id, true),
    ('Hanan Hussein', v_girls_id, true),
    ('Khewlet Siraj', v_girls_id, true),
    ('Muferihat Nasir', v_girls_id, true),
    ('Reeham Mohammed', v_girls_id, true),
    ('Rihana Khedr', v_girls_id, true),
    ('Semira Mussefa', v_girls_id, true),
    ('Semira Zeynu', v_girls_id, true),
    ('Sualihat Maeruf', v_girls_id, true),
    ('Yesriba Hussein', v_girls_id, true),
    ('Zaid Mohammed', v_girls_id, true),
    ('Zulmaidah Ababu', v_girls_id, true);

  -- Insert Boys' Ustazes (26)
  INSERT INTO public.ustazes (name, group_id, is_active)
  VALUES
    ('Abdulfetah (Ustaz Mohammed)', v_boys_id, true),
    ('Osama (Ustaz Mohammed)', v_boys_id, true),
    ('Huzeyfa (Ustaz Mohammed)', v_boys_id, true),
    ('Aymen (Ustaz Namus)', v_boys_id, true),
    ('Khalid Bedru', v_boys_id, true),
    ('Redwan Khedir', v_boys_id, true),
    ('Mujteba (Ustaz Namus)', v_boys_id, true),
    ('Umer (Ustaz Namus)', v_boys_id, true),
    ('Dinsefa Sultan', v_boys_id, true),
    ('Abdulfetah Abrar', v_boys_id, true),
    ('Amar Abdushukur', v_boys_id, true),
    ('Amar Nesro', v_boys_id, true),
    ('Fekrudin Muzemil', v_boys_id, true),
    ('Fuad Mohammed', v_boys_id, true),
    ('Hussein Bekri', v_boys_id, true),
    ('Imran Awel', v_boys_id, true),
    ('Imran Mohammed', v_boys_id, true),
    ('Khalid Hamza', v_boys_id, true),
    ('Khalid Nesre', v_boys_id, true),
    ('Mohammed Bargicho', v_boys_id, true),
    ('Mubesher Zeynu', v_boys_id, true),
    ('Namus Hussein', v_boys_id, true),
    ('Selehadin Ibrahim', v_boys_id, true),
    ('Semer Kedir', v_boys_id, true),
    ('Sudais Abdo', v_boys_id, true),
    ('Tajudin Shemesudin', v_boys_id, true);
END;
$$ LANGUAGE plpgsql;

SELECT public.seed_real_ustazes();
