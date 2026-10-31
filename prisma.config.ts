import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations need a direct connection: Neon's pooled DATABASE_URL goes through PgBouncer in
// transaction mode, which breaks Prisma Migrate. Not required for `prisma generate`, which runs on
// `bun install` (possibly on a build server without database variables); migrate and studio need it.
const url = process.env.DATABASE_URL_UNPOOLED ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "bun server/db/seed.ts" },
  datasource: { url },
});
