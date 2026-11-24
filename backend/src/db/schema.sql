-- Online do'kon — PostgreSQL sxemasi (TZ, 9-bo'lim)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(20)  UNIQUE,
  email         VARCHAR(150) UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer','admin','courier')),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addresses (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      VARCHAR(50)  NOT NULL DEFAULT 'Uy',
  address    VARCHAR(300) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) NOT NULL UNIQUE,
  slug  VARCHAR(100) NOT NULL UNIQUE,
  icon  VARCHAR(10)  NOT NULL DEFAULT '🍽️',
  sort  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  ingredients TEXT NOT NULL DEFAULT '',
  price       INT  NOT NULL CHECK (price >= 0),          -- so'mda
  discount    INT  NOT NULL DEFAULT 0 CHECK (discount BETWEEN 0 AND 90), -- foiz
  image       VARCHAR(300) NOT NULL DEFAULT '',
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  available   BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  sold_count  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS promotions (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  subtitle    VARCHAR(300) NOT NULL DEFAULT '',
  color       VARCHAR(20)  NOT NULL DEFAULT '#f97316',
  emoji       VARCHAR(10)  NOT NULL DEFAULT '🔥',
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INT NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  user_id        INT NOT NULL REFERENCES users(id),
  courier_id     INT REFERENCES users(id),
  subtotal       INT NOT NULL,
  delivery_fee   INT NOT NULL,
  total          INT NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'accepted'
                 CHECK (status IN ('accepted','preparing','on_the_way','delivered','cancelled')),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('payme','click','card','cash')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (payment_status IN ('pending','paid','failed','refunded')),
  address        VARCHAR(300) NOT NULL,
  phone          VARCHAR(20)  NOT NULL,
  comment        VARCHAR(500) NOT NULL DEFAULT '',
  delivery_time  VARCHAR(40)  NOT NULL DEFAULT 'asap',
  signature      VARCHAR(64)  NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id);

CREATE TABLE IF NOT EXISTS order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  name       VARCHAR(150) NOT NULL,
  quantity   INT NOT NULL,
  price      INT NOT NULL   -- buyurtma paytidagi narx (chegirma bilan)
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id         SERIAL PRIMARY KEY,
  order_id   INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     VARCHAR(20) NOT NULL,
  changed_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id           SERIAL PRIMARY KEY,
  order_id     INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider     VARCHAR(20) NOT NULL,
  amount       INT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'created'
               CHECK (status IN ('created','paid','failed','cancelled')),
  provider_txn VARCHAR(100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel    VARCHAR(10) NOT NULL DEFAULT 'app',
  title      VARCHAR(150) NOT NULL,
  body       VARCHAR(500) NOT NULL DEFAULT '',
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
