CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_categories_name (name),
  INDEX idx_categories_active (archived_at, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO categories (id, name)
SELECT UUID(), p.category
FROM pois p
LEFT JOIN categories c ON c.name = p.category
WHERE p.category IS NOT NULL
  AND TRIM(p.category) <> ''
  AND c.id IS NULL
GROUP BY p.category;

INSERT INTO categories (id, name)
SELECT UUID(), 'general'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'general');

ALTER TABLE pois
  ADD COLUMN category_id CHAR(36) NULL AFTER category;

UPDATE pois p
LEFT JOIN categories c ON c.name = p.category
SET p.category_id = c.id
WHERE p.category_id IS NULL;

UPDATE pois p
JOIN categories c ON c.name = 'general'
SET p.category_id = c.id
WHERE p.category_id IS NULL;

ALTER TABLE pois
  MODIFY COLUMN category_id CHAR(36) NOT NULL,
  ADD INDEX idx_pois_category_id_active (category_id, archived_at),
  ADD CONSTRAINT fk_pois_category FOREIGN KEY (category_id) REFERENCES categories(id);
