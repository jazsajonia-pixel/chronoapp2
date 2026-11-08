/**
 * Project requirements: does this repository actually need a database (or another backing
 * service) to run, which technology, which migrations it ships, and which environment variables it
 * expects. Reads manifests, schemas and a capped set of likely config/server files as DATA only —
 * nothing from the repository is executed, and only variable NAMES are collected, never values.
 *
 * A database is never assumed: static sites, frontend-only apps and apps with local/mock data come
 * back as `kind: "none"`.
 */

export type DbEngine = "PostgreSQL" | "MySQL" | "SQLite" | "MongoDB" | "Redis" | "SQL Server";
export type RequirementKind =
  /** No database or backing service detected. */
  | "none"
  /** File-based database (SQLite) — runs without an external server. */
  | "local"
  /** A hosted backend client (e.g. Supabase JS) — needs a project URL and public key, not a DB connection. */
  | "service"
  /** Server-side code connects to a database — it needs a connection string to run. */
  | "database";

export interface EnvRequirement {
  name: string;
  /** Where the name was seen first. */
  source: string;
  /** Looks like a secret (connection strings, keys, tokens) — keep it out of client code and logs. */
  secret: boolean;
  /** Part of the database/service connection. */
  database: boolean;
  /** Exposed to the browser bundle by its prefix (NEXT_PUBLIC_, VITE_, …). */
  public: boolean;
}

export interface MigrationSet {
  tool: string;
  dir: string;
  count: number;
}

export interface ProjectRequirements {
  kind: RequirementKind;
  engines: DbEngine[];
  /** Libraries / ORMs that indicate the requirement, e.g. "Prisma", "Drizzle ORM", "pg". */
  tools: string[];
  /** Hosted providers the code is already written for (Supabase, Neon, PlanetScale, Turso…). */
  providers: string[];
  migrations: MigrationSet[];
  env: EnvRequirement[];
  /** The committed example env file, if any (.env.example, .env.sample…). */
  envExample: string | null;
  /** Scripts that run migrations or seeds, e.g. `db:migrate → prisma migrate deploy`. */
  scripts: { name: string; command: string }[];
  /** One line for the UI. */
  summary: string;
  /** What the user needs to provide or run, in order. */
  steps: string[];
}

type Read = (path: string) => Promise<string | null>;

const DEP_HINTS: { dep: string | RegExp; tool: string; engine?: DbEngine; provider?: string; service?: boolean }[] = [
  { dep: "@prisma/client", tool: "Prisma" },
  { dep: "prisma", tool: "Prisma" },
  { dep: "drizzle-orm", tool: "Drizzle ORM" },
  { dep: "kysely", tool: "Kysely" },
  { dep: "knex", tool: "Knex" },
  { dep: "typeorm", tool: "TypeORM" },
  { dep: "sequelize", tool: "Sequelize" },
  { dep: "@mikro-orm/core", tool: "MikroORM" },
  { dep: "pg", tool: "pg", engine: "PostgreSQL" },
  { dep: "postgres", tool: "postgres.js", engine: "PostgreSQL" },
  { dep: "@vercel/postgres", tool: "@vercel/postgres", engine: "PostgreSQL", provider: "Vercel Postgres" },
  { dep: "@neondatabase/serverless", tool: "Neon serverless driver", engine: "PostgreSQL", provider: "Neon" },
  { dep: "mysql2", tool: "mysql2", engine: "MySQL" },
  { dep: "mysql", tool: "mysql", engine: "MySQL" },
  { dep: "@planetscale/database", tool: "PlanetScale driver", engine: "MySQL", provider: "PlanetScale" },
  { dep: "better-sqlite3", tool: "better-sqlite3", engine: "SQLite" },
  { dep: "sqlite3", tool: "sqlite3", engine: "SQLite" },
  { dep: "@libsql/client", tool: "libSQL", engine: "SQLite", provider: "Turso" },
  { dep: "mongoose", tool: "Mongoose", engine: "MongoDB" },
  { dep: "mongodb", tool: "MongoDB driver", engine: "MongoDB" },
  { dep: "redis", tool: "redis", engine: "Redis" },
  { dep: "ioredis", tool: "ioredis", engine: "Redis" },
  { dep: "@upstash/redis", tool: "Upstash Redis", engine: "Redis", provider: "Upstash" },
  { dep: "mssql", tool: "mssql", engine: "SQL Server" },
  { dep: "@supabase/supabase-js", tool: "Supabase JS", provider: "Supabase", service: true },
  { dep: "@supabase/ssr", tool: "Supabase SSR", provider: "Supabase", service: true },
  { dep: "firebase", tool: "Firebase", provider: "Firebase", service: true },
];

const PRISMA_PROVIDERS: Record<string, DbEngine> = { postgresql: "PostgreSQL", postgres: "PostgreSQL", cockroachdb: "PostgreSQL", mysql: "MySQL", sqlite: "SQLite", mongodb: "MongoDB", sqlserver: "SQL Server" };
const DRIZZLE_DIALECTS: Record<string, DbEngine> = { postgresql: "PostgreSQL", pg: "PostgreSQL", mysql: "MySQL", sqlite: "SQLite", turso: "SQLite" };

const EXAMPLE_ENV = /(^|\/)\.env\.(example|sample|template|dist|defaults)$|(^|\/)env\.example$|(^|\/)example\.env$/i;
const DB_ENV = /^(DATABASE_URL|DIRECT_URL|SHADOW_DATABASE_URL|POSTGRES_[A-Z_]+|PG(HOST|USER|PASSWORD|DATABASE|PORT)|MYSQL_[A-Z_]+|MONGO(DB)?_[A-Z_]*URI|MONGO(DB)?_URL|REDIS_URL|KV_[A-Z_]+|[A-Z_]*SUPABASE_[A-Z_]+|TURSO_[A-Z_]+|NEON_[A-Z_]+|DB_[A-Z_]+)$/;
const SECRET_ENV = /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|_KEY$|KEY_|DATABASE_URL|DIRECT_URL|_URI$|SERVICE_ROLE|CREDENTIAL|DSN)/;
const PUBLIC_PREFIX = /^(NEXT_PUBLIC_|VITE_|PUBLIC_|EXPO_PUBLIC_|REACT_APP_|NUXT_PUBLIC_|GATSBY_)/;
/** Runtime/tooling variables projects read but users never set. */
const IGNORED_ENV = new Set(["NODE_ENV", "PORT", "HOST", "HOSTNAME", "CI", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "DEV", "PROD", "MODE", "SSR", "BASE_URL", "TZ", "PWD", "HOME", "npm_package_version"]);

const CODE_FILE = /\.(c|m)?[jt]sx?$/;
const LIKELY_CONFIG = /(^|\/)(drizzle\.config|knexfile|ormconfig|data-source|db|database|prisma|supabase|env|config|server|index|app|main|auth|client)\.(c|m)?[jt]s$/i;
const LIKELY_DIR = /(^|\/)(server|api|lib|db|database|src\/server|src\/lib|src\/db|app\/api|netlify\/functions|functions|backend)\//i;
const MAX_SCANNED = 40;
const MAX_SCAN_BYTES = 200_000;

const MIGRATION_DIRS: { re: RegExp; tool: string }[] = [
  { re: /^(.*\/)?prisma\/migrations\/[^/]+\/migration\.sql$/, tool: "Prisma" },
  { re: /^(.*\/)?(drizzle|migrations|db\/migrations|src\/db\/migrations|server\/migrations)\/[^/]*\.sql$/, tool: "SQL" },
  { re: /^(.*\/)?supabase\/migrations\/[^/]+\.sql$/, tool: "Supabase" },
  { re: /^(.*\/)?migrations\/[^/]+\.(c|m)?[jt]s$/, tool: "Knex / TypeORM / Sequelize" },
];

function parseJson(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function addEnv(map: Map<string, EnvRequirement>, name: string, source: string) {
  if (IGNORED_ENV.has(name) || name.length < 3 || map.has(name)) return;
  map.set(name, { name, source, secret: SECRET_ENV.test(name) && !PUBLIC_PREFIX.test(name), database: DB_ENV.test(name.replace(PUBLIC_PREFIX, "")), public: PUBLIC_PREFIX.test(name) });
}

/** Variable names referenced in code: process.env.X, process.env["X"], import.meta.env.X, Deno.env.get("X"), env("X") (Prisma). */
export function envNamesInCode(text: string): string[] {
  const out = new Set<string>();
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]{1,63})/g,
    /process\.env\[\s*["'`]([A-Z][A-Z0-9_]{1,63})["'`]\s*\]/g,
    /import\.meta\.env\.([A-Z][A-Z0-9_]{1,63})/g,
    /Deno\.env\.get\(\s*["'`]([A-Z][A-Z0-9_]{1,63})["'`]/g,
    /\benv\(\s*["']([A-Z][A-Z0-9_]{1,63})["']\s*\)/g,
  ];
  for (const re of patterns) for (const m of text.matchAll(re)) out.add(m[1]!);
  return [...out];
}

/** Names declared in an example env file. Values are ignored entirely. */
export function envNamesInExample(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]{1,63})\s*=/.exec(line);
    if (m) out.push(m[1]!);
  }
  return out;
}

function packageDirs(paths: readonly string[]): string[] {
  const dirs = paths.filter((p) => /(^|\/)package\.json$/.test(p) && !p.includes("node_modules/") && p.split("/").length <= 3).map((p) => p.slice(0, -"package.json".length));
  return dirs.sort((a, b) => a.length - b.length).slice(0, 6);
}

export async function analyzeRequirements(paths: readonly string[], read: Read): Promise<ProjectRequirements> {
  const tools = new Set<string>();
  const engines = new Set<DbEngine>();
  const providers = new Set<string>();
  const env = new Map<string, EnvRequirement>();
  const scripts: { name: string; command: string }[] = [];
  let service = false;
  let serverDb = false;

  // 1) package.json files (root + shallow workspaces).
  for (const dir of packageDirs(paths)) {
    const pkg = parseJson(await read(`${dir}package.json`));
    if (!pkg) continue;
    const deps = { ...(pkg.dependencies as Record<string, string> | undefined), ...(pkg.devDependencies as Record<string, string> | undefined) };
    for (const hint of DEP_HINTS) {
      const hit = typeof hint.dep === "string" ? hint.dep in deps : Object.keys(deps).some((d) => (hint.dep as RegExp).test(d));
      if (!hit) continue;
      tools.add(hint.tool);
      if (hint.engine) engines.add(hint.engine);
      if (hint.provider) providers.add(hint.provider);
      if (hint.service) service = true;
      else serverDb = true;
    }
    const s = (pkg.scripts ?? {}) as Record<string, unknown>;
    for (const [name, command] of Object.entries(s)) {
      if (typeof command !== "string") continue;
      if (/\b(prisma (migrate|db push|db seed)|drizzle-kit (migrate|push)|knex migrate|typeorm migration|sequelize(-cli)? db:migrate|supabase db|node-pg-migrate)\b/.test(command) || /^(db|migrate|migration|seed)(:|$)/.test(name)) {
        scripts.push({ name: dir ? `${dir}${name}` : name, command: command.slice(0, 160) });
      }
    }
  }

  // 2) Schemas and configs that name the engine and the connection variable.
  const prismaSchemas = paths.filter((p) => /(^|\/)schema\.prisma$/.test(p) && !p.includes("node_modules/")).slice(0, 3);
  for (const p of prismaSchemas) {
    tools.add("Prisma");
    serverDb = true;
    const text = await read(p);
    if (!text) continue;
    const ds = /datasource\s+\w+\s*\{([\s\S]*?)\}/.exec(text)?.[1] ?? "";
    const provider = /provider\s*=\s*"([a-z]+)"/.exec(ds)?.[1];
    if (provider && PRISMA_PROVIDERS[provider]) engines.add(PRISMA_PROVIDERS[provider]!);
    for (const name of envNamesInCode(ds)) addEnv(env, name, p);
  }
  const drizzleConfigs = paths.filter((p) => /(^|\/)drizzle\.config\.(c|m)?[jt]s$/.test(p)).slice(0, 3);
  for (const p of drizzleConfigs) {
    tools.add("Drizzle ORM");
    serverDb = true;
    const text = await read(p);
    if (!text) continue;
    const dialect = /dialect\s*:\s*["'`]([a-z]+)["'`]/.exec(text)?.[1] ?? /driver\s*:\s*["'`]([a-z]+)["'`]/.exec(text)?.[1];
    if (dialect && DRIZZLE_DIALECTS[dialect]) engines.add(DRIZZLE_DIALECTS[dialect]!);
    for (const name of envNamesInCode(text)) addEnv(env, name, p);
  }
  if (paths.some((p) => /(^|\/)supabase\/config\.toml$/.test(p))) {
    providers.add("Supabase");
    engines.add("PostgreSQL");
  }

  // 3) Migrations.
  const migrationCounts = new Map<string, MigrationSet>();
  for (const p of paths) {
    if (p.includes("node_modules/")) continue;
    for (const { re, tool } of MIGRATION_DIRS) {
      if (!re.test(p)) continue;
      const dir = tool === "Prisma" ? p.replace(/[^/]+\/migration\.sql$/, "") : p.slice(0, p.lastIndexOf("/") + 1);
      const key = `${tool}|${dir}`;
      const cur = migrationCounts.get(key) ?? { tool, dir, count: 0 };
      cur.count += 1;
      migrationCounts.set(key, cur);
      break;
    }
  }
  const migrations = [...migrationCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  if (migrations.length && !tools.size && !service) serverDb = true;

  // 4) The example env file is the project's own statement of what it needs.
  const envExample = paths.find((p) => EXAMPLE_ENV.test(p) && p.split("/").length <= 3) ?? null;
  if (envExample) {
    const text = await read(envExample);
    if (text) for (const name of envNamesInExample(text)) addEnv(env, name, envExample);
  }

  // 5) A capped scan of likely config/server files for referenced variable names — only when a
  //    database/service was found, so frontend-only projects cost one or two file reads.
  const candidates = !(serverDb || service) ? [] : paths
    .filter((p) => CODE_FILE.test(p) && !p.includes("node_modules/") && !/\.(test|spec)\./.test(p) && (LIKELY_CONFIG.test(p) || LIKELY_DIR.test(p)))
    .sort((a, b) => a.split("/").length - b.split("/").length)
    .slice(0, MAX_SCANNED);
  for (const p of candidates) {
    const text = await read(p);
    if (!text || text.length > MAX_SCAN_BYTES) continue;
    for (const name of envNamesInCode(text)) addEnv(env, name, p);
  }

  const envList = [...env.values()].sort((a, b) => Number(b.database) - Number(a.database) || a.name.localeCompare(b.name));
  const dbVars = envList.filter((e) => e.database);
  const sqliteOnly = engines.size > 0 && [...engines].every((e) => e === "SQLite") && !providers.has("Turso");
  const kind: RequirementKind = serverDb ? (sqliteOnly ? "local" : "database") : service ? "service" : "none";
  const engineList = [...engines];
  const toolList = [...tools];

  return {
    kind,
    engines: engineList,
    tools: toolList,
    providers: [...providers],
    migrations,
    env: envList,
    envExample,
    scripts: scripts.slice(0, 8),
    summary: summarize(kind, engineList, toolList, [...providers]),
    steps: stepsFor(kind, engineList, dbVars, envList, migrations, scripts, envExample),
  };
}

function summarize(kind: RequirementKind, engines: DbEngine[], tools: string[], providers: string[]): string {
  const via = tools.length ? ` via ${tools.slice(0, 2).join(" + ")}` : "";
  switch (kind) {
    case "none":
      return "Runs without a database.";
    case "local":
      return `Uses a local SQLite file${via} — no database server needed.`;
    case "service":
      return `Talks to ${providers.join(" / ") || "a hosted backend"} from the app — needs that project's URL and public key.`;
    case "database":
      return `Needs a ${engines.length ? engines.join(" / ") : "database"} connection${via}.`;
  }
}

function stepsFor(
  kind: RequirementKind,
  engines: DbEngine[],
  dbVars: EnvRequirement[],
  envList: EnvRequirement[],
  migrations: MigrationSet[],
  scripts: { name: string; command: string }[],
  envExample: string | null,
): string[] {
  if (kind === "none") return [];
  const steps: string[] = [];
  if (kind === "database") {
    const pg = engines.includes("PostgreSQL");
    steps.push(
      pg
        ? "Create a separate development database on any PostgreSQL host (Neon, Supabase, or your own). Never point a preview at production data."
        : `Create a separate development ${engines[0] ?? "database"} — never point a preview at production data.`,
    );
    const names = dbVars.map((e) => e.name);
    steps.push(names.length ? `Set ${names.slice(0, 4).join(", ")} to that database's connection details.` : "Set the connection string the code reads (no variable name was found — check the database setup file).");
  } else if (kind === "service") {
    const names = dbVars.map((e) => e.name);
    steps.push(names.length ? `Set ${names.slice(0, 4).join(", ")} from your own development project's API settings.` : "Set the hosted project's URL and public (anon) key the code expects.");
  } else {
    steps.push("The SQLite file is created locally on first run; no account or server is needed.");
  }
  const otherSecrets = envList.filter((e) => !e.database && e.secret).map((e) => e.name);
  if (otherSecrets.length) steps.push(`It also reads ${otherSecrets.slice(0, 4).join(", ")}${otherSecrets.length > 4 ? ` and ${otherSecrets.length - 4} more` : ""}.`);
  if (migrations.length) {
    const migrate = scripts.find((s) => /migrat|push|deploy/.test(s.name + s.command));
    steps.push(`Apply ${migrations.reduce((n, m) => n + m.count, 0)} migration file(s) in ${migrations[0]!.dir}${migrate ? ` with \`npm run ${migrate.name}\`` : ""} on the development database.`);
  } else if (scripts.length) {
    steps.push(`Create the schema with \`npm run ${scripts[0]!.name}\` on the development database.`);
  }
  if (envExample) steps.push(`${envExample} lists every variable the project expects.`);
  return steps;
}

/** Plain-text summary for the agent's tools. Names only; never values. */
export function describeRequirements(r: ProjectRequirements): string {
  const lines = [`Requirements: ${r.summary}`];
  if (r.kind === "none") return lines.join("\n");
  if (r.engines.length) lines.push(`Engine: ${r.engines.join(", ")}`);
  if (r.tools.length) lines.push(`Libraries: ${r.tools.join(", ")}`);
  if (r.providers.length) lines.push(`Written for: ${r.providers.join(", ")}`);
  if (r.migrations.length) lines.push(`Migrations: ${r.migrations.map((m) => `${m.count} × ${m.tool} in ${m.dir}`).join("; ")}`);
  if (r.scripts.length) lines.push(`DB scripts: ${r.scripts.map((s) => `${s.name} → ${s.command}`).join("; ")}`);
  if (r.env.length) lines.push(`Env vars (names only): ${r.env.slice(0, 30).map((e) => `${e.name}${e.secret ? " [secret]" : ""}${e.public ? " [public]" : ""}`).join(", ")}`);
  lines.push("Live preview sandboxes start without environment variables, so database calls fail there until a development connection is configured.");
  lines.push(...r.steps.map((s, i) => `${i + 1}. ${s}`));
  return lines.join("\n");
}
