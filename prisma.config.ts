import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations need a direct connection: Neon's pooled DATABASE_URL goes through PgBouncer in
// transaction mode, which breaks Prisma Migrate.
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set (run `neon env pull`)");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "bun server/db/seed.ts" },
  datasource: { url },
});
