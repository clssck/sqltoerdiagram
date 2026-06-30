export const EXAMPLE_SQL = `-- Example: a small e-commerce schema
CREATE TABLE users (
  id            BIGINT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  full_name     VARCHAR(120),
  created_at    TIMESTAMP NOT NULL
);

CREATE TABLE addresses (
  id          BIGINT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  line1       VARCHAR(255) NOT NULL,
  city        VARCHAR(80),
  country     CHAR(2) NOT NULL
);

CREATE TABLE products (
  id          BIGINT PRIMARY KEY,
  sku         VARCHAR(64) NOT NULL UNIQUE,
  name        VARCHAR(200) NOT NULL,
  price_cents INT NOT NULL,
  active      BOOLEAN NOT NULL
);

CREATE TABLE orders (
  id            BIGINT PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  address_id    BIGINT,
  status        VARCHAR(32) NOT NULL,
  total_cents   INT NOT NULL,
  placed_at     TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (address_id) REFERENCES addresses(id)
);

CREATE TABLE order_items (
  id          BIGINT PRIMARY KEY,
  order_id    BIGINT NOT NULL,
  product_id  BIGINT NOT NULL,
  quantity    INT NOT NULL,
  unit_cents  INT NOT NULL,
  CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)   REFERENCES orders(id),
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE reviews (
  id          BIGINT PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES products(id),
  user_id     BIGINT NOT NULL REFERENCES users(id),
  rating      SMALLINT NOT NULL,
  body        TEXT,
  created_at  TIMESTAMP NOT NULL
);
`;
