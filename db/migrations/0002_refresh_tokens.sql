CREATE TABLE IF NOT EXISTS refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  jti CHAR(36) NOT NULL,
  user_name VARCHAR(120) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_refresh_jti (jti),
  INDEX idx_refresh_active (jti, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
