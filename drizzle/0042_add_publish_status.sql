DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entities' AND column_name = 'publish_status'
  ) THEN
    ALTER TABLE entities ADD COLUMN publish_status TEXT;
  END IF;
END $$;
