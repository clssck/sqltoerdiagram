export const USAGE = `Usage: dbt-erd [options]

Generate a self-contained local HTML ER diagram from a dbt project.

Options:
  --path <dir>        Use a local directory and skip GitHub browsing
  --repo <owner/name> Clone this GitHub repository directly
  --branch <name>     Clone/diagram a specific branch (default: the repo's default)
  --all               Browse all accessible repos (default: only repos with dbt)
  --lineage           Render dbt model dependency lineage instead of FK ERD
  --out <file>        Output HTML file (default: <project>.erd.html)
  --open              Open the generated HTML file after writing it
  --keep              Keep a cloned temporary repository on disk
  -h, --help          Show this help message
`;

const VALUE_FLAGS = new Set(['--path', '--repo', '--out', '--branch']);
const BOOLEAN_FLAGS = new Map([
  ['--all', 'all'],
  ['--lineage', 'lineage'],
  ['--open', 'open'],
  ['--keep', 'keep'],
  ['--help', 'help'],
  ['-h', 'help']
]);

function defaults() {
  return {
    path: null,
    repo: null,
    branch: null,
    all: false,
    lineage: false,
    out: null,
    open: false,
    keep: false,
    help: false
  };
}

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value == null || value === '') {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const opts = defaults();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg.startsWith('--') && arg.includes('=')) {
      const [flag, ...rest] = arg.split('=');
      const value = rest.join('=');
      if (!VALUE_FLAGS.has(flag)) {
        throw new Error(`Unknown option: ${flag}`);
      }
      if (value === '') {
        throw new Error(`${flag} requires a value`);
      }
      opts[flag.slice(2)] = value;
      continue;
    }

    if (VALUE_FLAGS.has(arg)) {
      opts[arg.slice(2)] = readValue(argv, i, arg);
      i += 1;
      continue;
    }

    const booleanKey = BOOLEAN_FLAGS.get(arg);
    if (booleanKey) {
      opts[booleanKey] = true;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (opts.path && opts.repo) {
    throw new Error('Use either --path or --repo, not both');
  }

  return opts;
}
