BEGIN;

-- Reference Architecture Categories
CREATE TABLE IF NOT EXISTS threat_model.reference_architecture_category (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

-- Reference Architecture Options
CREATE TABLE IF NOT EXISTS threat_model.reference_architecture_option (
  id          SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES threat_model.reference_architecture_category(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  UNIQUE(category_id, name)
);

-- Safeguard Reference Architecture join (with color)
CREATE TABLE IF NOT EXISTS threat_model.safeguard_reference_architecture (
  safeguard_id UUID NOT NULL REFERENCES threat_model.safeguards(id) ON DELETE CASCADE,
  category_id  INT NOT NULL REFERENCES threat_model.reference_architecture_category(id),
  option_id    INT NOT NULL REFERENCES threat_model.reference_architecture_option(id),
  color        VARCHAR(20) NOT NULL,
  PRIMARY KEY (safeguard_id, option_id)
);

COMMIT;
