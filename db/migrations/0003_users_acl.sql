CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_users_username (username),
  INDEX idx_users_role_active (role, archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE pois
  ADD COLUMN owner_user_id CHAR(36) NULL AFTER id,
  ADD INDEX idx_pois_owner_active (owner_user_id, archived_at);

ALTER TABLE pois
  ADD CONSTRAINT fk_pois_owner_user FOREIGN KEY (owner_user_id) REFERENCES users(id);

CREATE TABLE IF NOT EXISTS poi_shares (
  id CHAR(36) PRIMARY KEY,
  poi_id CHAR(36) NOT NULL,
  shared_with_user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_poi_shares_poi_active (poi_id, archived_at),
  INDEX idx_poi_shares_user_active (shared_with_user_id, archived_at),
  UNIQUE KEY uq_poi_share_pair (poi_id, shared_with_user_id),
  CONSTRAINT fk_poi_shares_poi FOREIGN KEY (poi_id) REFERENCES pois(id),
  CONSTRAINT fk_poi_shares_user FOREIGN KEY (shared_with_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
