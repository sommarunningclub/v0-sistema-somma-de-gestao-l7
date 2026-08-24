
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS data_do_evento VARCHAR(10);
;
