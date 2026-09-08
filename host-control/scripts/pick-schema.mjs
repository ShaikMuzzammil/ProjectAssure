// Host Control — universal schema picker (mirrors the main app's script).
// postgres://… DATABASE_URL → schema.postgres.prisma, else SQLite dev schema.
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
  console.log("[host pick-schema] variant schemas missing — keeping schema.prisma");
  process.exit(0);
}

if (isPostgres) {
  copyFileSync(postgres, target);
  console.log("[host pick-schema] DATABASE_URL is PostgreSQL → schema.postgres.prisma applied");
} else {
  copyFileSync(sqlite, target);
  console.log("[host pick-schema] no DATABASE_URL → SQLite dev schema applied");
}
