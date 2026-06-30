# dbt-erd — dbt → interactive ER diagrams

**A local, [bun](https://bun.sh)-native CLI that turns your dbt projects into self-contained, interactive ER (and lineage) diagrams.** It detects your GitHub account, browses the repos that actually contain dbt (your own, your orgs', and ones shared with you), lets you pick one, and writes a single offline `.html` — the same interactive canvas as [sqltoerdiagram.com](https://sqltoerdiagram.com), but built from **dbt model metadata** instead of a pasted SQL file.

> **Built on [royalbhati/sqltoerdiagram](https://github.com/royalbhati/sqltoerdiagram)** by [**Royal Bhati**](https://github.com/royalbhati) (MIT) — the SQL→ER canvas app, parser, layout, and renderer are his. The `dbt-erd` CLI (`cli/`, `src/dbt/`) and the read-only single-file viewer are the additions in this fork. Cheers, Royal 🙏

**Local & read-only.** It reads your dbt artifacts/files and writes one HTML file to disk — it never modifies the source project or pushes to GitHub. (GitHub modes clone shallowly into a temp dir, then delete it.)

→ **[Jump to the dbt-erd CLI ↓](#the-dbt-erd-cli)**

## The SQL → ER app (the engine)

The underlying tool is a single static page that turns pasted `CREATE TABLE` DDL into a clean, interactive diagram — smooth at **hundreds of tables**, with two-way SQL editing and link sharing, nothing leaving your browser. `dbt-erd` reuses its canvas renderer and layout.

## Features

### Parse

- Standard `CREATE TABLE` / `ALTER TABLE` DDL across **PostgreSQL, MySQL, SQLite,
  SQL Server & Snowflake**.

### Visualize & navigate

- **Canvas renderer** with cached bitmaps + viewport culling — smooth at hundreds of
  tables (benchmarked **~120fps** while zooming 300 tables / 593 FKs).
- **Declutter dense schemas**: FK lines are soft by default; **hover** a table to
  highlight just its relationships, **click** to pin focus (fades every unrelated
  table and line), click empty space to clear.
- **Drag** tables, **scroll / pinch to zoom**, and pan.

### Smart layout

- **Hub-aware layered auto-arrange**: the most-connected table is placed on one side
  with its related tables aligned beside it. **Horizontal / Vertical** direction and
  **Compact / Comfortable / Spacious** spacing live under the **Arrange ▾** menu.
- **Overlap-free**: auto-arrange runs a separation pass so no two tables overlap.
- **Your arrangement is saved**: positions and the camera persist automatically, so
  reloading restores your exact layout. Editing SQL keeps your manual positions —
  only brand-new tables get auto-placed beside the rest. **Arrange** re-runs layout
  on demand.

### Edit on the canvas → SQL updates

- **Double-click** a table name, column name, or column type to edit it inline. The
  change is applied as a *surgical text edit* (comments, formatting, and unsupported
  clauses are preserved), and a table rename updates every `REFERENCES` to it.
- **Add columns**: pin a table, then **+ add column**. The new column is inserted into
  your SQL with a default type for the selected **dialect** (PostgreSQL / MySQL /
  SQLite / SQL Server / Snowflake) and opens inline so you can name it. Editing a
  column type shows dialect-aware suggestions.

### Annotate

- A bottom-left palette adds **sticky notes** and **group boxes** to label and cluster
  sections. Drag to move, drag the corner to resize, double-click to edit text, click
  to select (colour swatches + delete), or press Delete. They're part of the diagram —
  included in saves, share links, and PNG/SVG exports.

### Save, share & export

- **Save / Open projects**: **Save** downloads a `.json` project (SQL + layout + camera
  + dialect); **Open** loads one back.
- **Share link**: **Share** copies a URL with the entire project encoded in the hash —
  gzip-compressed + base64. The `#…` fragment is never sent to a server, so sharing
  needs **no backend**, and opening the link restores the exact diagram.
- **Export** to **PNG** (raster) and **SVG** (vector).

### Editor & appearance

- **Syntax-highlighted SQL editor**: keywords / types / strings / comments / numbers
  are colored via a paint layer behind the textarea. Re-tokenizing is a single linear
  pass coalesced to one animation frame, so typing stays instant (~6ms full repaint on
  a 45KB / 300-table script, sub-ms on normal schemas).
- **Hide the SQL panel** (⬚ in the toolbar) for a full-width diagram.
- **Light + dark themes**, and it remembers your last schema locally.

## Run locally

```bash
bun install
bun run dev      # http://localhost:5173
```

## Build & host

```bash
bun run build    # outputs static files to dist/
bun run preview  # preview the production build locally
```

`dist/` is plain static HTML/JS/CSS — drop it on any static host:

- **GitHub Pages** — push `dist/` to a `gh-pages` branch, or use an action.
- **Netlify / Vercel / Cloudflare Pages** — build command `bun run build`, publish dir `dist`.
- **Any web server / S3 bucket** — just upload the contents of `dist/`.

## The dbt-erd CLI

`dbt-erd` is a local, dbt-specialized CLI that turns a **dbt project** into the same
self-contained, interactive canvas ERD — no SQL file, no hosting. It reads your dbt
**model metadata** (tables, columns, keys and relations) and writes a single portable
`.html` you can open straight from disk.
It is **bun-native**, and the interactive repo/project browser is rendered with
[OpenTUI](https://opentui.com).

```bash
bun install                                          # one-time: install deps

# from a local checkout of a dbt project
bun cli/index.js --path /path/to/dbt_project         # writes <project>.erd.html

# or browse your dbt repos — yours, your orgs', and ones shared with you
bun cli/index.js                                     # only repos with dbt; type to filter
bun cli/index.js --all                               # browse ALL accessible repos
bun cli/index.js --repo owner/name                   # clone + generate one repo
bun cli/index.js --repo owner/name --branch dev      # a specific branch (else prompted)

# install the `dbt-erd` command globally
bun link && dbt-erd --path /path/to/dbt_project
```

**Options**

| Flag | Description |
| --- | --- |
| `--path <dir>` | Use a local directory; skip GitHub. Picks the dbt project (prompts if several). |
| `--repo <owner/name>` | Shallow-clone a GitHub repo and generate. |
| `--branch <name>` | Diagram a specific branch. Without it, browse/`--repo` prompt you to pick (default branch first) on a TTY, else use the repo default. `--path` only records the currently checked-out branch (never checks out). |
| `--all` | Browse **all** accessible repos. By default browse shows **only repos containing a `dbt_project.yml`** (found via GitHub code search across you + your orgs + collaborator repos, including nested ones in monorepos). |
| `--lineage` | Force the **lineage** view (model dependency DAG) — headless override. Interactively you're asked instead (see below). |
| `--out <file>` | Output path (default `<project>.erd.html`). |
| `--open` | Open the generated file when done. |
| `--keep` | Keep the temporary clone. |

In an interactive terminal, browse mode renders a keyboard-navigable **OpenTUI** list —
**type to fuzzy-filter**, ↑/↓ to move, Enter to select, Esc to cancel — and falls back to a
numbered text prompt when there is no TTY or raw mode is unavailable. By default it shows only
repos containing a `dbt_project.yml` (owned, organization, and collaborator/shared); pass `--all`
for every accessible repo. Your GitHub login
comes from `gh api user` (run `gh auth login` first) and is only needed for browse mode;
`--path` and `--repo` don't use it.

**Where the diagram comes from**

- **dbt artifacts (preferred)** — `target/manifest.json` for models, seeds, snapshots and
  sources (with columns), enriched with warehouse types from `target/catalog.json`
  (`dbt docs generate`). Disabled and `ephemeral` nodes are skipped.
- **No artifacts? Fallback** — `dbt_project.yml` + `models/`, `seeds/`, `snapshots/` YAML
  (columns + tests + constraints), with `ref()`/`source()` scanned from the `.sql`.
- **Relations (FK ERD)** come from `relationships` data tests **and** model-contract
  `constraints` (`primary_key`, `foreign_key`, `unique`, `not_null`) — column-accurate,
  composite keys included. A column that is both `unique` and `not_null` is treated as a PK.
- **`--lineage`** instead wires tables by `ref()`/`source()` dependencies, upstream → downstream.

After you pick a project, an interactive run asks **what to generate** — ERD vs lineage — showing each with its relation count, and only offers modes that produce output: a project with FK relationships shows ERD; if it has none but its models have `ref()`/`source()` dependencies it goes straight to lineage; if neither has edges you get a tables-only ERD. `--lineage` skips the prompt; a non-interactive run defaults to the FK ERD.

The generated page is the read-only canvas viewer: pan, zoom, **Fit**, and a dark/light
toggle. For dbt diagrams it also **colors tables by layer** (source / staging / intermediate /
marts / seed / snapshot) with a legend, **collapses wide tables to the first 8 columns** — click
the `▾ +N more` footer to expand one, or use **Expand all** / **Collapse all** in the toolbar —
and shows a hint when column types are unavailable (yml fallback with no `catalog.json`).
It is fully offline — all JS/CSS is inlined and the model is embedded in the file.
The CLI builds the embed template on first run; you can also build it explicitly:

```bash
bun run build:viewer    # outputs dist/viewer/viewer.html (the embed template)
```

## Supported SQL

- `CREATE [OR REPLACE] [TEMPORARY | TRANSIENT] TABLE [IF NOT EXISTS] name ( ... )` with quoted / backtick / `[bracket]` / `schema.qualified` names.
- Inline column constraints: `PRIMARY KEY`, `NOT NULL`, `UNIQUE`, `REFERENCES other(col)`.
- Table-level constraints: `PRIMARY KEY (...)`, `UNIQUE (...)`,
  `FOREIGN KEY (...) REFERENCES other(...)`, `CONSTRAINT ... FOREIGN KEY ...`.
- `ALTER TABLE x ADD [CONSTRAINT ...] FOREIGN KEY (...) REFERENCES y(...)`.
- Line (`--`, `#`) and block (`/* */`) comments are ignored.

## BigQuery

Select **BigQuery** from the dialect dropdown to work with BigQuery SQL instead of DDL.

- Paste a raw `WITH … AS (…)` query — no `CREATE TABLE` statements needed. Each CTE becomes a table node in the diagram.
- Column names are extracted from the `SELECT` list of each CTE (using aliases where present).
- Relationships are inferred automatically from `FROM` and `JOIN` references: a CTE that reads from another CTE gets an edge between them, and references to base tables create stub nodes connected to the CTE.
- Backtick-quoted three-part names (`project.dataset.table`) are supported — the table portion is used as the node label.

## Tech

- **Vite** — build + dev server.
- **@dagrejs/dagre** — layered auto-layout.
- Custom canvas renderer + SQL DDL parser (no heavy SQL-parser dependency).

## Shortcuts

| Key | Action |
| --- | --- |
| **⌘ / Ctrl + Enter** | Re-arrange |
| **Double-click** canvas | Zoom in |
| Drag the pane divider | Resize the editor |

## License

[MIT](./LICENSE) © [**Royal Bhati**](https://github.com/royalbhati) for the original [sqltoerdiagram](https://github.com/royalbhati/sqltoerdiagram). The `dbt-erd` additions in this fork are MIT too. Fork it, self-host it, point it at your dbt projects — go for it.
