-- Apply once to the existing experience_choices table before deploying city/region capture.
-- Existing rows remain NULL; the migration does not infer historical locations.
ALTER TABLE experience_choices
  ADD COLUMN city_name TEXT CHECK (city_name IS NULL OR length(city_name) BETWEEN 1 AND 128);
ALTER TABLE experience_choices
  ADD COLUMN region_name TEXT CHECK (region_name IS NULL OR length(region_name) BETWEEN 1 AND 128);
