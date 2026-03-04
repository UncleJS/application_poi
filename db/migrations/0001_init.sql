CREATE TABLE IF NOT EXISTS pois (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(80) NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  location POINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  SPATIAL INDEX idx_location (location),
  INDEX idx_category_active (category, archived_at),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS poi_photos (
  id CHAR(36) PRIMARY KEY,
  poi_id CHAR(36) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  size_bytes INT NOT NULL,
  image_blob LONGBLOB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_poi_photos_active (poi_id, archived_at),
  CONSTRAINT fk_poi_photos_poi FOREIGN KEY (poi_id) REFERENCES pois(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
