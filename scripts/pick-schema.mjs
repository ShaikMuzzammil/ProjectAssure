// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — universal schema picker
// Picks the right Prisma datasource automatically from DATABASE_URL:
//   postgres://… → prisma/schema.postgres.prisma
//   file:…  (or unset) → prisma/schema.sqlite.prisma
// The generated file is written to prisma/schema.prisma (both local and
// Vercel run `postinstall: node scripts/pick-schema.mjs && prisma generate`).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const prismaDir = path.resolve(here, "../prisma");
const target = path.join(prismaDir, "schema.prisma");
const postgres = path.join(prismaDir, "schema.postgres.prisma");
const sqlite = path.join(prismaDir, "schema.sqlite.prisma");

const url = (process.env.DATABASE_URL || "").trim();
const isPostgres = /^postgres(ql)?:\/\//i.test(url);

if (!existsSync(postgres) || !existsSync(sqlite)) {
  console.log("[pick-schema] variant schemas missing — keeping existing schema.prisma");
  process.exit(0);
}

if (isPostgres) {
  copyFileSync(postgres, target);
  console.log("[pick-schema] DATABASE_URL is PostgreSQL → schema.postgres.prisma applied");
} else {
  // SQLite local/dev: inject the resolved file url only when unset
  let content = readFileSync(sqlite, "utf-8");
  if (!url) {
    const dbFile = path.join(prismaDir, "db");
    content = content.replace(
      'url      = env("DATABASE_URL")',
      `url      = "file:${dbFile.replace(/\\/g, "/")}/custom.db"`
    );
  }
  writeFileSync(target, content);
  console.log("[pick-schema] no DATABASE_URL → SQLite dev schema applied (app runs in browser-persist mode)");
}
