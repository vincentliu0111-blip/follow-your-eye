-- Existing choices retain unknown network location detail.
ALTER TABLE experience_choices
  ADD COLUMN postal_code TEXT CHECK (postal_code IS NULL OR length(postal_code) BETWEEN 1 AND 128);
ALTER TABLE experience_choices
  ADD COLUMN latitude REAL CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
ALTER TABLE experience_choices
  ADD COLUMN longitude REAL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
