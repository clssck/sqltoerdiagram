// Content for the programmatic landing pages. Each entry → public/<slug>/index.html
// Keep the primary content (h1/lead/steps/example/faq) genuinely distinct per page.

const R = {
  home: { href: '/', label: 'SQL to ER Diagram (home)' },
  prisma: { href: '/prisma/', label: 'Prisma to ER diagram' },
  mysql: { href: '/mysql/', label: 'MySQL to ER diagram' },
  postgresql: { href: '/postgresql/', label: 'PostgreSQL to ER diagram' },
  sqlite: { href: '/sqlite/', label: 'SQLite to ER diagram' },
  sqlserver: { href: '/sql-server/', label: 'SQL Server to ER diagram' },
  dbml: { href: '/dbml/', label: 'DBML to ER diagram' },
  mermaid: { href: '/mermaid/', label: 'Mermaid to ER diagram' },
  sqlalchemy: { href: '/sqlalchemy/', label: 'SQLAlchemy to ER diagram' },
  sequelize: { href: '/sequelize/', label: 'Sequelize to ER diagram' },
  typeorm: { href: '/typeorm/', label: 'TypeORM to ER diagram' },
  django: { href: '/django/', label: 'Django to ER diagram' },
  sql2mermaid: { href: '/sql-to-mermaid/', label: 'SQL to Mermaid' },
  prisma2dbml: { href: '/prisma-to-dbml/', label: 'Prisma to DBML' },
  dbml2er: { href: '/dbml-to-er-diagram/', label: 'DBML to ER diagram' },
  mermaid2erd: { href: '/mermaid-to-erd/', label: 'Mermaid to ERD' },
};

const PRIVATE = '<strong>Private:</strong> everything runs in your browser — nothing is uploaded or stored on a server.';
const INTERACTIVE = '<strong>Interactive:</strong> drag tables, auto-arrange, hide noise, add notes, and manually link columns.';
const EXPORT = '<strong>Export</strong> a high-res PNG, vector SVG, or the schema as Mermaid / DBML / PlantUML code.';
const FREE = '<strong>Free &amp; open source</strong> — no account, no sign-up.';
const FAQ_PRIVATE = { q: 'Is my schema uploaded anywhere?', a: 'No. Everything runs locally in your browser — your schema is never uploaded to or stored on any server.' };
const FAQ_FREE = { q: 'Is it free?', a: 'Yes. It is completely free and open source, with no account or sign-up required.' };
const FAQ_EXPORT = { q: 'Can I export the diagram?', a: 'Yes — export a high-resolution PNG or vector SVG, copy the schema as Mermaid, DBML or PlantUML, or share a link that encodes the whole diagram in the URL.' };

export const PAGES = [
  // ---------------- DIALECTS ----------------
  {
    slug: 'mysql',
    crumb: 'MySQL',
    title: 'MySQL to ER Diagram — Free Online MySQL Schema Visualizer',
    description: 'Paste MySQL CREATE TABLE statements or a mysqldump and instantly generate an interactive ER diagram. Free, open source, runs in your browser — nothing uploaded.',
    keywords: 'mysql to er diagram, mysql erd, mysql schema diagram, visualize mysql database, mysqldump diagram, mysql entity relationship diagram',
    h1: 'MySQL to <span class="a">ER Diagram</span>',
    lead: 'Paste your MySQL <code>CREATE TABLE</code> statements (or a <code>mysqldump</code>) and get a clean, interactive entity-relationship diagram — tables, columns, keys and foreign keys, drawn automatically.',
    steps: [
      'Dump your schema with <code>mysqldump --no-data your_db</code>, or copy your <code>CREATE TABLE</code> statements.',
      'Paste it into the editor — MySQL is parsed automatically.',
      'Every table is rendered with its columns; <code>FOREIGN KEY</code> constraints become relations.',
      'Arrange, hide tables, then export PNG/SVG or share a link.',
    ],
    exampleIntro: 'A MySQL schema like this:',
    example: `CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB;`,
    exampleAfter: '…renders two tables with a relation from <code>orders.customer_id</code> → <code>customers.id</code>.',
    why: [PRIVATE, INTERACTIVE, EXPORT, '<strong>Handles big dumps</strong> — hundreds of tables stay smooth.', FREE],
    badges: ['MySQL', 'MariaDB', 'PostgreSQL', 'SQLite', 'SQL Server'],
    faq: [
      { q: 'How do I turn a MySQL database into an ER diagram?', a: 'Export the schema with <code>mysqldump --no-data</code> (or copy your CREATE TABLE statements), paste it in, and the diagram is drawn instantly with foreign keys as relations.' },
      { q: 'Does it work with mysqldump output?', a: 'Yes. Paste the dump as-is — it reads CREATE TABLE definitions and FOREIGN KEY constraints, ignoring the INSERT data.' },
      FAQ_PRIVATE, FAQ_EXPORT, FAQ_FREE,
    ],
    related: [R.postgresql, R.sqlite, R.sqlserver, R.prisma, R.sql2mermaid, R.home],
  },
  {
    slug: 'postgresql',
    crumb: 'PostgreSQL',
    title: 'PostgreSQL to ER Diagram — Free Online Postgres Schema Visualizer',
    description: 'Paste PostgreSQL CREATE TABLE statements or pg_dump output and instantly generate an interactive ER diagram. Free, open source, runs in your browser — nothing uploaded.',
    keywords: 'postgresql to er diagram, postgres erd, pg_dump diagram, visualize postgres schema, postgresql entity relationship diagram, postgres schema diagram',
    h1: 'PostgreSQL to <span class="a">ER Diagram</span>',
    lead: 'Paste your PostgreSQL schema — <code>CREATE TABLE</code> statements or a <code>pg_dump</code> — and get an interactive ER diagram with every table, column and foreign key drawn for you.',
    steps: [
      'Dump the schema with <code>pg_dump --schema-only your_db</code>, or copy your <code>CREATE TABLE</code> statements.',
      'Paste it into the editor — Postgres is parsed automatically, including <code>ALTER TABLE … ADD CONSTRAINT</code> foreign keys.',
      'Tables render with columns and types; relations are drawn from the constraints.',
      'Arrange, hide tables, then export PNG/SVG or share a link.',
    ],
    exampleIntro: 'A PostgreSQL schema like this:',
    example: `CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id)
);`,
    exampleAfter: '…renders two tables with a relation from <code>orders.customer_id</code> → <code>customers.id</code>.',
    why: [PRIVATE, '<strong>pg_dump-friendly</strong> — handles <code>ALTER TABLE ONLY … ADD CONSTRAINT</code> foreign keys.', INTERACTIVE, EXPORT, FREE],
    badges: ['PostgreSQL', 'pg_dump', 'MySQL', 'SQLite', 'Prisma'],
    faq: [
      { q: 'How do I turn a Postgres database into an ER diagram?', a: 'Run <code>pg_dump --schema-only</code> and paste the output. Tables and foreign keys (including those added via ALTER TABLE) are drawn automatically.' },
      { q: 'Does it support pg_dump?', a: 'Yes — pg_dump emits foreign keys as separate ALTER TABLE statements, which are parsed and turned into relations.' },
      FAQ_PRIVATE, FAQ_EXPORT, FAQ_FREE,
    ],
    related: [R.mysql, R.sqlite, R.sqlserver, R.prisma, R.sql2mermaid, R.home],
  },
  {
    slug: 'sqlite',
    crumb: 'SQLite',
    title: 'SQLite to ER Diagram — Free Online SQLite Schema Visualizer',
    description: 'Paste your SQLite schema (the .schema output) and instantly generate an interactive ER diagram. Free, open source, runs in your browser — nothing uploaded.',
    keywords: 'sqlite to er diagram, sqlite erd, sqlite schema diagram, visualize sqlite database, .schema diagram, sqlite entity relationship diagram',
    h1: 'SQLite to <span class="a">ER Diagram</span>',
    lead: 'Paste your SQLite schema — the output of <code>.schema</code> — and get an interactive ER diagram of every table, column and relationship.',
    steps: [
      'In the <code>sqlite3</code> shell run <code>.schema</code> (or <code>.schema --indent</code>) and copy the output.',
      'Paste it into the editor — SQLite is parsed automatically.',
      'Tables render with columns; <code>REFERENCES</code> become relations.',
      'Arrange, hide tables, then export PNG/SVG or share a link.',
    ],
    exampleIntro: 'A SQLite schema like this:',
    example: `CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id)
);`,
    exampleAfter: '…renders two tables with a relation from <code>orders.customer_id</code> → <code>customers.id</code>.',
    why: [PRIVATE, INTERACTIVE, EXPORT, FREE],
    badges: ['SQLite', 'PostgreSQL', 'MySQL', 'SQL Server'],
    faq: [
      { q: 'How do I diagram a SQLite database?', a: 'Open it with <code>sqlite3 mydb.db</code>, run <code>.schema</code>, and paste the output here. The diagram is generated instantly.' },
      FAQ_PRIVATE, FAQ_EXPORT, FAQ_FREE,
    ],
    related: [R.postgresql, R.mysql, R.sqlserver, R.dbml, R.home],
  },
  {
    slug: 'sql-server',
    crumb: 'SQL Server',
    title: 'SQL Server to ER Diagram — Free Online T-SQL Schema Visualizer',
    description: 'Paste SQL Server / T-SQL CREATE TABLE statements and instantly generate an interactive ER diagram. Free, open source, runs in your browser — nothing uploaded.',
    keywords: 'sql server to er diagram, t-sql erd, mssql schema diagram, sql server entity relationship diagram, visualize sql server database, tsql diagram',
    h1: 'SQL Server to <span class="a">ER Diagram</span>',
    lead: 'Paste your SQL Server (T-SQL) <code>CREATE TABLE</code> statements and get an interactive entity-relationship diagram — tables, columns, primary keys and foreign keys, drawn automatically.',
    steps: [
      'Script the schema from SSMS (right-click the database → Tasks → Generate Scripts), or copy your <code>CREATE TABLE</code> statements.',
      'Paste it into the editor — T-SQL is parsed automatically.',
      'Tables render with columns; <code>FOREIGN KEY</code> constraints become relations.',
      'Arrange, hide tables, then export PNG/SVG or share a link.',
    ],
    exampleIntro: 'A T-SQL schema like this:',
    example: `CREATE TABLE customers (
  id INT IDENTITY(1,1) PRIMARY KEY,
  email NVARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE orders (
  id INT IDENTITY(1,1) PRIMARY KEY,
  customer_id INT NOT NULL,
  CONSTRAINT FK_orders_customers
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);`,
    exampleAfter: '…renders two tables with a relation from <code>orders.customer_id</code> → <code>customers.id</code>.',
    why: [PRIVATE, INTERACTIVE, EXPORT, '<strong>Handles named constraints</strong> like <code>CONSTRAINT FK_… FOREIGN KEY</code>.', FREE],
    badges: ['SQL Server', 'T-SQL', 'PostgreSQL', 'MySQL', 'SQLite'],
    faq: [
      { q: 'How do I create an ER diagram from SQL Server?', a: 'In SSMS use Tasks → Generate Scripts to script the schema, then paste it here. Tables and foreign-key constraints are drawn automatically.' },
      FAQ_PRIVATE, FAQ_EXPORT, FAQ_FREE,
    ],
    related: [R.postgresql, R.mysql, R.sqlite, R.prisma, R.home],
  },

  // ---------------- FORMATS ----------------
  {
    slug: 'dbml',
    crumb: 'DBML',
    title: 'DBML to ER Diagram — Free Online DBML Visualizer',
    description: 'Paste DBML (Database Markup Language) and instantly render an interactive ER diagram. Import DBML, export PNG/SVG. Free, open source, runs in your browser.',
    keywords: 'dbml to er diagram, dbml visualizer, render dbml, dbml diagram, database markup language diagram, dbdiagram alternative',
    h1: 'DBML to <span class="a">ER Diagram</span>',
    lead: 'Paste <strong>DBML</strong> (Database Markup Language) and get an interactive ER diagram instantly. A free, in-browser DBML visualizer — import DBML, export PNG, SVG, Mermaid or PlantUML.',
    steps: [
      'Copy your <code>.dbml</code> file or DBML snippet.',
      'Paste it into the editor — DBML is auto-detected.',
      'Each <code>Table</code> renders with its columns; <code>Ref:</code> and inline <code>[ref: &gt; …]</code> become relations.',
      'Arrange, hide tables, then export PNG/SVG or convert to Mermaid/PlantUML.',
    ],
    exampleIntro: 'DBML like this:',
    example: `Table users {
  id integer [pk]
  email varchar [unique]
}

Table posts {
  id integer [pk]
  user_id integer [ref: > users.id]
}`,
    exampleAfter: '…renders two tables with a relation from <code>posts.user_id</code> → <code>users.id</code>.',
    why: [PRIVATE, '<strong>Round-trip:</strong> import DBML and export it back, or convert to Mermaid / PlantUML / SVG.', INTERACTIVE, FREE],
    badges: ['DBML', 'Mermaid', 'PlantUML', 'SQL', 'Prisma'],
    faq: [
      { q: 'What is DBML?', a: 'DBML (Database Markup Language) is a simple, readable DSL for defining database schemas, popularized by dbdiagram.io. Paste it here to visualize it instantly.' },
      { q: 'Can I convert DBML to SQL or Mermaid?', a: 'Paste your DBML, then use Export to get Mermaid or PlantUML, or a PNG/SVG image of the diagram.' },
      FAQ_PRIVATE, FAQ_FREE,
    ],
    related: [R.mermaid, R.prisma2dbml, R.dbml2er, R.sql2mermaid, R.home],
  },
  {
    slug: 'mermaid',
    crumb: 'Mermaid',
    title: 'Mermaid to ER Diagram — Free Online Mermaid erDiagram Viewer',
    description: 'Paste a Mermaid erDiagram and render it as an interactive ER diagram you can drag, arrange and export. Free, open source, runs in your browser.',
    keywords: 'mermaid to er diagram, mermaid erdiagram viewer, render mermaid er diagram, mermaid erd, visualize mermaid schema',
    h1: 'Mermaid to <span class="a">ER Diagram</span>',
    lead: 'Paste a <strong>Mermaid</strong> <code>erDiagram</code> and turn it into a fully interactive ER diagram you can drag, auto-arrange, and export — no Markdown renderer required.',
    steps: [
      'Copy your Mermaid <code>erDiagram</code> block.',
      'Paste it into the editor — Mermaid is auto-detected.',
      'Each entity becomes a table; relationships are drawn with the right cardinality.',
      'Arrange, hide tables, then export PNG/SVG or convert to DBML/PlantUML.',
    ],
    exampleIntro: 'A Mermaid erDiagram like this:',
    example: `erDiagram
  USERS ||--o{ POSTS : writes
  USERS {
    int id PK
    string email
  }
  POSTS {
    int id PK
    int user_id FK
  }`,
    exampleAfter: '…renders two tables with a relation between <code>USERS</code> and <code>POSTS</code>.',
    why: [PRIVATE, '<strong>Interactive</strong>, unlike a static Mermaid render — drag, arrange and hide tables.', EXPORT, FREE],
    badges: ['Mermaid', 'DBML', 'PlantUML', 'SQL', 'Prisma'],
    faq: [
      { q: 'Can I edit a Mermaid ER diagram visually?', a: 'Paste the Mermaid erDiagram to render it, then drag and arrange tables on the canvas. You can also convert it to SQL-style images or DBML via Export.' },
      { q: 'Does it support Mermaid cardinality?', a: 'Yes — one-to-one, one-to-many and many-to-many crow’s-foot notations are recognised and drawn.' },
      FAQ_PRIVATE, FAQ_FREE,
    ],
    related: [R.dbml, R.mermaid2erd, R.sql2mermaid, R.prisma, R.home],
  },
  {
    slug: 'sqlalchemy',
    crumb: 'SQLAlchemy',
    title: 'SQLAlchemy to ER Diagram — Free Online Model Visualizer',
    description: 'Paste your SQLAlchemy models and instantly generate an interactive ER diagram. Free, open source, runs in your browser — nothing uploaded.',
    keywords: 'sqlalchemy to er diagram, sqlalchemy erd, visualize sqlalchemy models, sqlalchemy schema diagram, python orm diagram',
    h1: 'SQLAlchemy to <span class="a">ER Diagram</span>',
    lead: 'Paste your <strong>SQLAlchemy</strong> declarative models and get an interactive ER diagram — tables from <code>__tablename__</code>, columns, and relations from <code>ForeignKey</code>.',
    steps: [
      'Copy your SQLAlchemy model classes (declarative <code>Base</code> / <code>db.Model</code>).',
      'Paste them into the editor — SQLAlchemy is auto-detected.',
      'Each model becomes a table; <code>ForeignKey("table.col")</code> becomes a relation.',
      'Arrange, hide tables, then export PNG/SVG or share a link.',
    ],
    exampleIntro: 'SQLAlchemy models like this:',
    example: `class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)

class Post(Base):
    __tablename__ = "posts"
    id = Column(Integer, primary_key=True)
    author_id = Column(Integer, ForeignKey("users.id"))`,
    exampleAfter: '…renders two tables with a relation from <code>posts.author_id</code> → <code>users.id</code>.',
    why: [PRIVATE, INTERACTIVE, EXPORT, FREE],
    badges: ['SQLAlchemy', 'Prisma', 'Sequelize', 'SQL'],
    faq: [
      { q: 'How do I visualize SQLAlchemy models?', a: 'Paste your declarative model classes. Tables come from <code>__tablename__</code>, columns from <code>Column(...)</code>, and relations from <code>ForeignKey</code>.' },
      { q: 'Do I need to run my app?', a: 'No — it reads the model source directly in the browser, nothing is imported or executed.' },
      FAQ_PRIVATE, FAQ_FREE,
    ],
    related: [R.django, R.prisma, R.sequelize, R.postgresql, R.home],
  },
  {
    slug: 'sequelize',
    crumb: 'Sequelize',
    title: 'Sequelize to ER Diagram — Free Online Model Visualizer',
    description: 'Paste your Sequelize models and instantly generate an interactive ER diagram. Free, open source, runs in your browser — nothing uploaded.',
    keywords: 'sequelize to er diagram, sequelize erd, visualize sequelize models, sequelize schema diagram, node orm diagram',
    h1: 'Sequelize to <span class="a">ER Diagram</span>',
    lead: 'Paste your <strong>Sequelize</strong> model definitions and get an interactive ER diagram — tables, columns from <code>DataTypes</code>, and relations from associations.',
    steps: [
      'Copy your Sequelize models (<code>sequelize.define(...)</code> or <code>Model.init(...)</code>).',
      'Paste them into the editor — Sequelize is auto-detected.',
      'Each model becomes a table; associations like <code>belongsTo</code> become relations.',
      'Arrange, hide tables, then export PNG/SVG or share a link.',
    ],
    exampleIntro: 'Sequelize models like this:',
    example: `const User = sequelize.define('User', {
  email: { type: DataTypes.STRING, unique: true }
});

const Post = sequelize.define('Post', {
  title: DataTypes.STRING
});

Post.belongsTo(User);`,
    exampleAfter: '…renders <code>User</code> and <code>Post</code> with a relation between them.',
    why: [PRIVATE, INTERACTIVE, EXPORT, FREE],
    badges: ['Sequelize', 'Prisma', 'SQLAlchemy', 'SQL'],
    faq: [
      { q: 'How do I diagram Sequelize models?', a: 'Paste your <code>sequelize.define</code> or <code>Model.init</code> definitions. Columns come from DataTypes and relations from associations like belongsTo / hasMany.' },
      FAQ_PRIVATE, FAQ_FREE,
    ],
    related: [R.typeorm, R.prisma, R.sqlalchemy, R.mysql, R.home],
  },
  {
    slug: 'typeorm',
    crumb: 'TypeORM',
    title: 'TypeORM to ER Diagram — Visualize Your Entities',
    description: 'Turn your TypeORM entities into an interactive ER diagram. Generate the SQL from your entities and paste it to visualize tables and relations. Free, in your browser.',
    keywords: 'typeorm to er diagram, typeorm erd, visualize typeorm entities, typeorm schema diagram, nestjs database diagram',
    h1: 'TypeORM to <span class="a">ER Diagram</span>',
    lead: 'Visualize your <strong>TypeORM</strong> entities as an interactive ER diagram. The most reliable path is to let TypeORM emit the SQL for your entities and paste that — every column type and relation comes through exactly.',
    steps: [
      'Generate the schema SQL from your entities: run a migration with <code>typeorm migration:generate</code>, or log the SQL from <code>synchronize</code>.',
      'Copy the <code>CREATE TABLE</code> / <code>ALTER TABLE</code> statements.',
      'Paste them into the editor — the SQL is parsed and tables + foreign keys are drawn.',
      'Arrange, hide tables, then export PNG/SVG or convert to Mermaid/DBML.',
    ],
    exampleIntro: 'TypeORM generates SQL like this from your entities:',
    example: `CREATE TABLE "user" (
  "id" SERIAL PRIMARY KEY,
  "email" varchar NOT NULL
);

CREATE TABLE "post" (
  "id" SERIAL PRIMARY KEY,
  "authorId" integer REFERENCES "user"("id")
);`,
    exampleAfter: '…renders two tables with a relation from <code>post.authorId</code> → <code>user.id</code>.',
    why: [PRIVATE, '<strong>Exact:</strong> generated SQL captures every column type, index and relation.', INTERACTIVE, EXPORT, FREE],
    badges: ['TypeORM', 'SQL', 'Prisma', 'Sequelize'],
    faq: [
      { q: 'How do I get an ER diagram from TypeORM?', a: 'Have TypeORM emit the SQL for your entities (via <code>migration:generate</code> or by logging the synchronize SQL), then paste those CREATE TABLE statements here.' },
      { q: 'Why use the generated SQL instead of the entity files?', a: 'The generated SQL is the source of truth for the actual database shape — column types, defaults and foreign keys are all explicit, so the diagram is exact.' },
      FAQ_PRIVATE, FAQ_FREE,
    ],
    related: [R.sequelize, R.prisma, R.postgresql, R.sqlalchemy, R.home],
  },
  {
    slug: 'django',
    crumb: 'Django',
    title: 'Django Models to ER Diagram — Visualize Your Schema',
    description: 'Turn your Django models into an interactive ER diagram. Generate the SQL with sqlmigrate and paste it to visualize tables and relations. Free, in your browser.',
    keywords: 'django to er diagram, django models erd, visualize django models, django schema diagram, django database diagram',
    h1: 'Django to <span class="a">ER Diagram</span>',
    lead: 'Visualize your <strong>Django</strong> models as an interactive ER diagram. Django can print the exact SQL for your models — paste that and every table, column and foreign key is drawn for you.',
    steps: [
      'Print the SQL for a migration: <code>python manage.py sqlmigrate yourapp 0001</code>.',
      'Copy the <code>CREATE TABLE</code> / foreign-key statements.',
      'Paste them into the editor — the SQL is parsed automatically.',
      'Arrange, hide tables, then export PNG/SVG or convert to Mermaid/DBML.',
    ],
    exampleIntro: 'Django’s <code>sqlmigrate</code> emits SQL like this from your models:',
    example: `CREATE TABLE "blog_author" (
  "id" bigint NOT NULL PRIMARY KEY,
  "name" varchar(100) NOT NULL
);

CREATE TABLE "blog_post" (
  "id" bigint NOT NULL PRIMARY KEY,
  "author_id" bigint NOT NULL REFERENCES "blog_author"("id")
);`,
    exampleAfter: '…renders two tables with a relation from <code>blog_post.author_id</code> → <code>blog_author.id</code>.',
    why: [PRIVATE, '<strong>Exact:</strong> <code>sqlmigrate</code> output reflects the real database tables Django creates.', INTERACTIVE, EXPORT, FREE],
    badges: ['Django', 'SQL', 'SQLAlchemy', 'PostgreSQL'],
    faq: [
      { q: 'How do I make an ER diagram from Django models?', a: 'Run <code>python manage.py sqlmigrate yourapp 0001</code> to print the SQL, then paste the CREATE TABLE statements here. Foreign keys become relations automatically.' },
      { q: 'Can I see all apps at once?', a: 'Run sqlmigrate for each app’s migrations (or use sqlall-style output) and paste them together — tables across apps are linked by their foreign keys.' },
      FAQ_PRIVATE, FAQ_FREE,
    ],
    related: [R.sqlalchemy, R.postgresql, R.prisma, R.mysql, R.home],
  },

  // ---------------- CONVERTERS ----------------
  {
    slug: 'sql-to-mermaid',
    crumb: 'SQL to Mermaid',
    title: 'SQL to Mermaid — Convert SQL Schema to a Mermaid erDiagram',
    description: 'Paste SQL CREATE TABLE statements and export a Mermaid erDiagram. Free online SQL → Mermaid converter that also draws the live diagram. Runs in your browser.',
    keywords: 'sql to mermaid, convert sql to mermaid, sql to mermaid erdiagram, generate mermaid from sql, create table to mermaid',
    h1: 'SQL to <span class="a">Mermaid</span>',
    lead: 'Paste your SQL <code>CREATE TABLE</code> statements and get a <strong>Mermaid <code>erDiagram</code></strong> you can copy straight into Markdown, GitHub, or your docs — plus a live, interactive diagram.',
    steps: [
      'Paste your SQL schema into the editor (PostgreSQL, MySQL, SQLite or SQL Server).',
      'The diagram renders instantly so you can check it.',
      'Click <strong>Export → Mermaid</strong> and copy the <code>erDiagram</code> code.',
      'Drop it into any Mermaid-aware Markdown (GitHub, GitLab, Notion, Obsidian…).',
    ],
    exampleIntro: 'This SQL:',
    example: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE
);
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id)
);`,
    example2: `erDiagram
    users {
        serial id PK
        text email
    }
    posts {
        serial id PK
        int user_id FK
    }
    users ||--o{ posts : "user_id"`,
    example2label: '…exports as this Mermaid:',
    exampleAfter: 'Copy it from <strong>Export → Mermaid</strong>.',
    why: [PRIVATE, '<strong>Paste-ready Mermaid</strong> for GitHub / GitLab / Notion / Obsidian.', '<strong>Verify visually</strong> — see the live diagram before you copy.', FREE],
    badges: ['SQL → Mermaid', 'SQL → DBML', 'SQL → PlantUML', 'PNG / SVG'],
    faq: [
      { q: 'How do I convert SQL to a Mermaid ER diagram?', a: 'Paste your CREATE TABLE statements, then click Export → Mermaid and copy the erDiagram code. Foreign keys become relationships.' },
      { q: 'Where can I use the Mermaid output?', a: 'Anywhere Mermaid renders: GitHub & GitLab Markdown, Notion, Obsidian, docs sites, and the Mermaid Live Editor.' },
      FAQ_PRIVATE, FAQ_FREE,
    ],
    related: [R.mermaid, R.dbml, R.prisma2dbml, R.postgresql, R.home],
  },
  {
    slug: 'prisma-to-dbml',
    crumb: 'Prisma to DBML',
    title: 'Prisma to DBML — Convert a Prisma Schema to DBML',
    description: 'Paste your schema.prisma and export DBML. Free online Prisma → DBML converter that also renders the live ER diagram. Runs entirely in your browser.',
    keywords: 'prisma to dbml, convert prisma to dbml, prisma schema to dbml, generate dbml from prisma, schema.prisma to dbml',
    h1: 'Prisma to <span class="a">DBML</span>',
    lead: 'Paste your <code>schema.prisma</code> and export it as <strong>DBML</strong> — ready for dbdiagram.io and other DBML tools — while you preview the live ER diagram.',
    steps: [
      'Paste the contents of your <code>schema.prisma</code> — Prisma is auto-detected.',
      'The diagram renders so you can confirm models and relations.',
      'Click <strong>Export → DBML</strong> and copy the result.',
      'Paste it into dbdiagram.io or any DBML-based workflow.',
    ],
    exampleIntro: 'This Prisma schema:',
    example: `model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  posts Post[]
}
model Post {
  id       Int  @id @default(autoincrement())
  author   User @relation(fields: [authorId], references: [id])
  authorId Int
}`,
    example2: `Table "User" {
  "id" Int [pk]
  "email" String [unique]
}
Table "Post" {
  "id" Int [pk]
  "authorId" Int
}
Ref: "Post"."authorId" > "User"."id"`,
    example2label: '…exports as this DBML:',
    exampleAfter: 'Copy it from <strong>Export → DBML</strong>.',
    why: [PRIVATE, '<strong>dbdiagram.io-ready</strong> DBML output.', '<strong>Preview first</strong> — see the relations drawn before exporting.', FREE],
    badges: ['Prisma → DBML', 'Prisma → Mermaid', 'Prisma → SVG'],
    faq: [
      { q: 'How do I convert a Prisma schema to DBML?', a: 'Paste your schema.prisma, then click Export → DBML and copy the output. Models become Tables and @relation fields become Refs.' },
      FAQ_PRIVATE, FAQ_FREE,
    ],
    related: [R.prisma, R.dbml, R.sql2mermaid, R.dbml2er, R.home],
  },
  {
    slug: 'dbml-to-er-diagram',
    crumb: 'DBML to ER Diagram',
    title: 'DBML to ER Diagram — Render DBML Online, Free',
    description: 'Paste DBML and render an interactive ER diagram instantly — a free dbdiagram-style DBML viewer that runs in your browser. Export PNG, SVG, Mermaid.',
    keywords: 'dbml to er diagram, render dbml online, dbml viewer, dbml diagram generator, dbdiagram alternative, visualize dbml',
    h1: 'DBML to <span class="a">ER Diagram</span>',
    lead: 'Paste <strong>DBML</strong> and instantly render an interactive entity-relationship diagram — drag, arrange, and export. A free, in-browser DBML viewer.',
    steps: [
      'Copy your DBML (from dbdiagram.io or a <code>.dbml</code> file).',
      'Paste it into the editor — DBML is auto-detected.',
      'Tables and <code>Ref:</code> relations are drawn immediately.',
      'Arrange, hide tables, then export PNG/SVG or convert to Mermaid/PlantUML.',
    ],
    exampleIntro: 'DBML like this:',
    example: `Table users {
  id integer [pk]
  email varchar [unique]
}
Table orders {
  id integer [pk]
  user_id integer [ref: > users.id]
  total decimal
}`,
    exampleAfter: '…renders two tables with a relation from <code>orders.user_id</code> → <code>users.id</code>.',
    why: [PRIVATE, INTERACTIVE, '<strong>Convert</strong> DBML to Mermaid, PlantUML, PNG or SVG.', FREE],
    badges: ['DBML', 'Mermaid', 'PlantUML', 'SQL'],
    faq: [
      { q: 'Is this a free dbdiagram alternative?', a: 'Yes — paste DBML and get an interactive diagram for free, with no account. You can also export to Mermaid, PlantUML, PNG or SVG.' },
      { q: 'Does it support Ref and inline references?', a: 'Yes — both standalone <code>Ref:</code> lines and inline <code>[ref: &gt; table.col]</code> settings are parsed.' },
      FAQ_PRIVATE, FAQ_FREE,
    ],
    related: [R.dbml, R.mermaid2erd, R.prisma2dbml, R.sql2mermaid, R.home],
  },
  {
    slug: 'mermaid-to-erd',
    crumb: 'Mermaid to ERD',
    title: 'Mermaid to ERD — Render a Mermaid erDiagram, Interactive',
    description: 'Paste a Mermaid erDiagram and turn it into an interactive ERD you can drag, arrange and export. Free, open source, runs in your browser.',
    keywords: 'mermaid to erd, mermaid erdiagram to diagram, render mermaid er diagram, interactive mermaid erd, mermaid er viewer',
    h1: 'Mermaid to <span class="a">ERD</span>',
    lead: 'Paste a <strong>Mermaid</strong> <code>erDiagram</code> and turn the text into a fully interactive ERD — drag tables, auto-arrange, and export to image, DBML or PlantUML.',
    steps: [
      'Copy your Mermaid <code>erDiagram</code>.',
      'Paste it into the editor — Mermaid is auto-detected.',
      'Entities become draggable tables; relationships are drawn with cardinality.',
      'Arrange, then export PNG/SVG or convert to DBML/PlantUML.',
    ],
    exampleIntro: 'A Mermaid erDiagram like this:',
    example: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    int id PK
    string name
  }
  ORDER {
    int id PK
    int customer_id FK
  }`,
    exampleAfter: '…becomes an interactive ERD with <code>CUSTOMER</code> linked to <code>ORDER</code>.',
    why: [PRIVATE, '<strong>Interactive</strong> — not a static image; drag and rearrange freely.', '<strong>Convert</strong> Mermaid to DBML, PlantUML, PNG or SVG.', FREE],
    badges: ['Mermaid', 'DBML', 'PlantUML', 'PNG / SVG'],
    faq: [
      { q: 'How do I turn Mermaid text into a diagram I can edit?', a: 'Paste the Mermaid erDiagram here — it renders as draggable tables you can arrange, then export as an image or convert to DBML/PlantUML.' },
      FAQ_PRIVATE, FAQ_FREE,
    ],
    related: [R.mermaid, R.dbml2er, R.sql2mermaid, R.prisma, R.home],
  },
];
