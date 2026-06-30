// Example-gallery schemas. Each renders as a live embedded diagram + "Open in editor".
// Targets "<domain> database schema example / diagram" searches.

export const GALLERY = [
  {
    slug: 'ecommerce',
    name: 'E-commerce',
    title: 'E-commerce Database Schema Example (ER Diagram)',
    description: 'A complete e-commerce database schema example — customers, products, orders, order items, payments and reviews — as an interactive ER diagram you can open and edit.',
    keywords: 'ecommerce database schema example, ecommerce er diagram, online store database design, shopping cart schema, order database schema',
    lead: 'A realistic <strong>e-commerce</strong> schema — customers and addresses, a product catalog, orders and line items, payments and reviews — shown as an interactive ER diagram.',
    about: 'This models a typical online store: customers place orders made up of line items referencing products, ship to saved addresses, pay via payments, and leave product reviews.',
    sql: `CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(120),
  created_at TIMESTAMP
);
CREATE TABLE addresses (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  line1 VARCHAR(255), city VARCHAR(80), country CHAR(2)
);
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  parent_id INT REFERENCES categories(id)
);
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES categories(id),
  sku VARCHAR(64) UNIQUE, name VARCHAR(200),
  price_cents INT, active BOOLEAN
);
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  address_id INT REFERENCES addresses(id),
  status VARCHAR(32), total_cents INT, placed_at TIMESTAMP
);
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT, unit_cents INT
);
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  amount_cents INT, method VARCHAR(32), paid_at TIMESTAMP
);
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  customer_id INT NOT NULL REFERENCES customers(id),
  rating SMALLINT, body TEXT
);`,
  },
  {
    slug: 'blog',
    name: 'Blog / CMS',
    title: 'Blog Database Schema Example (ER Diagram)',
    description: 'A blog / CMS database schema example — users, posts, comments, categories and tags with a join table — as an interactive ER diagram you can open and edit.',
    keywords: 'blog database schema example, cms database design, blog er diagram, posts comments tags schema, wordpress-like schema',
    lead: 'A classic <strong>blog / CMS</strong> schema — authors writing posts, threaded comments, categories, and many-to-many tags — as an interactive ER diagram.',
    about: 'Authors (users) write posts in a category; readers leave comments; posts and tags have a many-to-many relationship through a join table.',
    sql: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  bio TEXT
);
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) UNIQUE
);
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  author_id INT NOT NULL REFERENCES users(id),
  category_id INT REFERENCES categories(id),
  title VARCHAR(200), slug VARCHAR(220) UNIQUE,
  body TEXT, published_at TIMESTAMP
);
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES posts(id),
  author_id INT REFERENCES users(id),
  parent_id INT REFERENCES comments(id),
  body TEXT, created_at TIMESTAMP
);
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) UNIQUE NOT NULL
);
CREATE TABLE post_tags (
  post_id INT NOT NULL REFERENCES posts(id),
  tag_id INT NOT NULL REFERENCES tags(id),
  PRIMARY KEY (post_id, tag_id)
);`,
  },
  {
    slug: 'saas',
    name: 'SaaS (multi-tenant)',
    title: 'SaaS Multi-Tenant Database Schema Example (ER Diagram)',
    description: 'A multi-tenant SaaS database schema example — organizations, users, memberships, projects, plans and subscriptions — as an interactive ER diagram you can open and edit.',
    keywords: 'saas database schema example, multi-tenant database design, saas er diagram, organizations users subscriptions schema, b2b saas schema',
    lead: 'A <strong>multi-tenant SaaS</strong> schema — organizations with members, per-org projects, and plan-based subscriptions with invoices — as an interactive ER diagram.',
    about: 'Each organization (tenant) has users joined through memberships (with roles), owns projects, and subscribes to a plan; invoices belong to a subscription.',
    sql: `CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) UNIQUE,
  created_at TIMESTAMP
);
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(120)
);
CREATE TABLE memberships (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id),
  user_id INT NOT NULL REFERENCES users(id),
  role VARCHAR(20)
);
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id),
  name VARCHAR(160), archived BOOLEAN
);
CREATE TABLE plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60), price_cents INT, seats INT
);
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id),
  plan_id INT NOT NULL REFERENCES plans(id),
  status VARCHAR(20), renews_at TIMESTAMP
);
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  subscription_id INT NOT NULL REFERENCES subscriptions(id),
  amount_cents INT, issued_at TIMESTAMP, paid BOOLEAN
);`,
  },
  {
    slug: 'social-network',
    name: 'Social network',
    title: 'Social Network Database Schema Example (ER Diagram)',
    description: 'A social network database schema example — users, follows, posts, likes, comments and direct messages — as an interactive ER diagram you can open and edit.',
    keywords: 'social network database schema, social media database design, followers schema, posts likes comments schema, social app er diagram',
    lead: 'A <strong>social network</strong> schema — users following each other, posting, liking and commenting, plus direct messages — as an interactive ER diagram.',
    about: 'Users follow other users (self-referencing many-to-many via follows), create posts, like and comment on them, and send each other direct messages.',
    sql: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  handle VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(80), avatar_url TEXT
);
CREATE TABLE follows (
  follower_id INT NOT NULL REFERENCES users(id),
  followee_id INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  author_id INT NOT NULL REFERENCES users(id),
  body VARCHAR(280), created_at TIMESTAMP
);
CREATE TABLE likes (
  user_id INT NOT NULL REFERENCES users(id),
  post_id INT NOT NULL REFERENCES posts(id),
  PRIMARY KEY (user_id, post_id)
);
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES posts(id),
  author_id INT NOT NULL REFERENCES users(id),
  body VARCHAR(280), created_at TIMESTAMP
);
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  sender_id INT NOT NULL REFERENCES users(id),
  recipient_id INT NOT NULL REFERENCES users(id),
  body TEXT, sent_at TIMESTAMP
);`,
  },
  {
    slug: 'project-management',
    name: 'Project management',
    title: 'Project Management Database Schema Example (ER Diagram)',
    description: 'A project management database schema example (Jira-style) — projects, tasks, assignees, labels and comments — as an interactive ER diagram you can open and edit.',
    keywords: 'project management database schema, task tracker database design, jira-like schema, tasks projects er diagram, issue tracker schema',
    lead: 'A <strong>project management</strong> schema (think Jira/Trello) — projects containing tasks, with assignees, labels and comments — as an interactive ER diagram.',
    about: 'Projects contain tasks; tasks are assigned to users through a join table, carry many-to-many labels, and accumulate comments.',
    sql: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(120)
);
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  key VARCHAR(10) UNIQUE, name VARCHAR(160),
  lead_id INT REFERENCES users(id)
);
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id),
  title VARCHAR(200), status VARCHAR(20),
  priority SMALLINT, due_date DATE,
  reporter_id INT REFERENCES users(id)
);
CREATE TABLE task_assignees (
  task_id INT NOT NULL REFERENCES tasks(id),
  user_id INT NOT NULL REFERENCES users(id),
  PRIMARY KEY (task_id, user_id)
);
CREATE TABLE labels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(40) UNIQUE, color VARCHAR(7)
);
CREATE TABLE task_labels (
  task_id INT NOT NULL REFERENCES tasks(id),
  label_id INT NOT NULL REFERENCES labels(id),
  PRIMARY KEY (task_id, label_id)
);
CREATE TABLE task_comments (
  id SERIAL PRIMARY KEY,
  task_id INT NOT NULL REFERENCES tasks(id),
  author_id INT NOT NULL REFERENCES users(id),
  body TEXT, created_at TIMESTAMP
);`,
  },
  {
    slug: 'inventory',
    name: 'Inventory / warehouse',
    title: 'Inventory Database Schema Example (ER Diagram)',
    description: 'An inventory / warehouse database schema example — suppliers, products, warehouses, stock levels and purchase orders — as an interactive ER diagram you can open and edit.',
    keywords: 'inventory database schema example, warehouse database design, stock management schema, purchase order er diagram, supplier product schema',
    lead: 'An <strong>inventory / warehouse</strong> schema — suppliers and products, per-warehouse stock levels, and purchase orders with line items — as an interactive ER diagram.',
    about: 'Suppliers provide products; stock tracks quantity of each product per warehouse; purchase orders to suppliers contain line items for products.',
    sql: `CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255)
);
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  supplier_id INT REFERENCES suppliers(id),
  sku VARCHAR(64) UNIQUE, name VARCHAR(200),
  unit_cost_cents INT
);
CREATE TABLE warehouses (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE, name VARCHAR(120),
  location VARCHAR(160)
);
CREATE TABLE stock (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  warehouse_id INT NOT NULL REFERENCES warehouses(id),
  quantity INT
);
CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  supplier_id INT NOT NULL REFERENCES suppliers(id),
  warehouse_id INT REFERENCES warehouses(id),
  status VARCHAR(20), ordered_at TIMESTAMP
);
CREATE TABLE purchase_order_items (
  id SERIAL PRIMARY KEY,
  purchase_order_id INT NOT NULL REFERENCES purchase_orders(id),
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT, unit_cost_cents INT
);`,
  },
];
