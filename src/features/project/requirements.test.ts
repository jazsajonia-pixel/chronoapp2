import { describe, expect, it } from "vitest";
import { analyzeRequirements, describeRequirements, envNamesInCode, envNamesInExample } from "./requirements";

function repo(files: Record<string, string>) {
  return { paths: Object.keys(files), read: async (p: string) => files[p] ?? null };
}
const pkg = (deps: Record<string, string> = {}, scripts: Record<string, string> = {}) => JSON.stringify({ dependencies: deps, scripts });

describe("analyzeRequirements", () => {
  it("never assumes a database for a static or frontend-only project", async () => {
    const r = repo({ "index.html": "<h1>hi</h1>", "package.json": pkg({ react: "19", vite: "7" }), "src/main.tsx": "console.log(import.meta.env.VITE_TITLE)" });
    const out = await analyzeRequirements(r.paths, r.read);
    expect(out.kind).toBe("none");
    expect(out.summary).toBe("Runs without a database.");
    expect(out.steps).toEqual([]);
  });

  it("detects Prisma + PostgreSQL, migrations, scripts and the connection variable", async () => {
    const r = repo({
      "package.json": pkg({ "@prisma/client": "6", next: "16" }, { "db:migrate": "prisma migrate deploy", dev: "next dev" }),
      "prisma/schema.prisma": 'datasource db {\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}',
      "prisma/migrations/20260101_init/migration.sql": "create table x();",
      "prisma/migrations/20260102_more/migration.sql": "alter table x;",
      ".env.example": "DATABASE_URL=postgres://user:pass@host/db\nDIRECT_URL=\nNEXTAUTH_SECRET=changeme\n",
    });
    const out = await analyzeRequirements(r.paths, r.read);
    expect(out.kind).toBe("database");
    expect(out.engines).toEqual(["PostgreSQL"]);
    expect(out.tools).toContain("Prisma");
    expect(out.migrations).toEqual([{ tool: "Prisma", dir: "prisma/migrations/", count: 2 }]);
    expect(out.scripts.map((s) => s.name)).toEqual(["db:migrate"]);
    expect(out.env.map((e) => e.name)).toEqual(["DATABASE_URL", "DIRECT_URL", "NEXTAUTH_SECRET"]);
    expect(out.env.find((e) => e.name === "DATABASE_URL")).toMatchObject({ secret: true, database: true });
    expect(out.steps.join(" ")).toMatch(/"npm run db:migrate"/);
    expect(out.steps[0]).toMatch(/Neon, Supabase, or your own/);
  });

  it("never returns env values, even from the example file", async () => {
    const r = repo({ "package.json": pkg({ pg: "8" }), ".env.example": "DATABASE_URL=postgres://admin:hunter2@prod.example.com/app" });
    const out = await analyzeRequirements(r.paths, r.read);
    const text = JSON.stringify(out) + describeRequirements(out);
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("prod.example.com");
    expect(out.kind).toBe("database");
  });

  it("treats SQLite as local and Supabase JS as a hosted service", async () => {
    const lite = repo({ "package.json": pkg({ "better-sqlite3": "11" }) });
    expect((await analyzeRequirements(lite.paths, lite.read)).kind).toBe("local");
    const supa = repo({ "package.json": pkg({ "@supabase/supabase-js": "2" }), "src/lib/supabase.ts": "createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)" });
    const out = await analyzeRequirements(supa.paths, supa.read);
    expect(out.kind).toBe("service");
    expect(out.providers).toEqual(["Supabase"]);
    expect(out.env.map((e) => e.name)).toEqual(["VITE_SUPABASE_ANON_KEY", "VITE_SUPABASE_URL"]);
    expect(out.env.every((e) => e.public && !e.secret)).toBe(true);
  });

  it("reads the Drizzle dialect and Neon driver", async () => {
    const r = repo({
      "package.json": pkg({ "drizzle-orm": "0.40", "@neondatabase/serverless": "1" }),
      "drizzle.config.ts": 'export default { dialect: "postgresql", dbCredentials: { url: process.env.DATABASE_URL! } }',
      "drizzle/0000_init.sql": "create table t();",
    });
    const out = await analyzeRequirements(r.paths, r.read);
    expect(out).toMatchObject({ kind: "database", engines: ["PostgreSQL"], providers: ["Neon"] });
    expect(out.migrations[0]).toMatchObject({ dir: "drizzle/", count: 1 });
  });

  it("tolerates unreadable and malformed files", async () => {
    const out = await analyzeRequirements(["package.json", "prisma/schema.prisma"], async () => null);
    expect(out.kind).toBe("database");
    const bad = repo({ "package.json": "{not json" });
    expect((await analyzeRequirements(bad.paths, bad.read)).kind).toBe("none");
  });
});

describe("env name extraction", () => {
  it("finds names in code and ignores runtime variables", () => {
    expect(envNamesInCode('process.env.API_KEY; process.env["DB_HOST"]; import.meta.env.VITE_X; Deno.env.get("SECRET_Y"); env("DATABASE_URL")').sort()).toEqual(["API_KEY", "DATABASE_URL", "DB_HOST", "SECRET_Y", "VITE_X"]);
    expect(envNamesInExample("# comment\nexport FOO=1\nBAR=\n  BAZ = x\nnot a line")).toEqual(["FOO", "BAR", "BAZ"]);
  });
});

describe("analyzeRequirements beyond Node", () => {
  const reader = (files: Record<string, string>) => (p: string) => Promise.resolve(files[p] ?? null);
  it("reads Flutter, Spring and Python manifests and their env usage", async () => {
    const files = {
      "pubspec.yaml": "name: app\ndependencies:\n  supabase_flutter: ^2.0.0\n",
      "lib/main.dart": "final url = String.fromEnvironment('SUPABASE_URL');",
      "server/build.gradle.kts": 'dependencies { implementation("org.springframework.boot:spring-boot-starter-data-jpa"); runtimeOnly("org.postgresql:postgresql") }',
      "server/src/main/resources/application.properties": "spring.datasource.url=${DATABASE_URL}\nspring.datasource.password=${DB_PASSWORD:dev}\n",
      "api/requirements.txt": "fastapi\npsycopg2-binary==2.9\n",
      "api/main.py": "import os\nkey = os.environ.get('API_SECRET')\n",
    };
    const r = await analyzeRequirements(Object.keys(files), reader(files));
    expect(r.kind).toBe("database");
    expect(r.engines).toContain("PostgreSQL");
    expect(r.providers).toContain("Supabase");
    expect(r.confidence).toBe("high");
    const names = r.env.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(["DATABASE_URL", "DB_PASSWORD", "SUPABASE_URL", "API_SECRET"]));
    expect(r.steps.at(-1)).toMatch(/Preview variables/);
  });
  it("flags a low-confidence 'none' when server code exists but nothing was recognised", async () => {
    const files = { "server/index.ts": "export const x = 1;" };
    const r = await analyzeRequirements(Object.keys(files), reader(files));
    expect(r.kind).toBe("none");
    expect(r.confidence).toBe("low");
  });
});
