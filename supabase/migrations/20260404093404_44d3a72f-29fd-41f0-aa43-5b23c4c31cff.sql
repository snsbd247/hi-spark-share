
-- Full database reset: keep only super_admin tables
DO $$
DECLARE
  tbl TEXT;
  protected_tables TEXT[] := ARRAY['super_admins', 'super_admin_sessions'];
  all_tables TEXT[];
BEGIN
  -- Get all public tables
  SELECT array_agg(tablename) INTO all_tables
  FROM pg_tables WHERE schemaname = 'public';

  -- Disable FK checks temporarily via TRUNCATE CASCADE
  FOR tbl IN
    SELECT unnest(all_tables)
  LOOP
    IF tbl != ALL(protected_tables) THEN
      BEGIN
        EXECUTE format('TRUNCATE TABLE public.%I CASCADE', tbl);
        RAISE NOTICE 'Truncated: %', tbl;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipped %: %', tbl, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;
