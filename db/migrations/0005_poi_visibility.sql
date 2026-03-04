ALTER TABLE pois
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER category,
  ADD INDEX idx_pois_public_active (is_public, archived_at);
