import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client.ts";

// On Neon this is the pooled (-pooler) URL; node-postgres keeps a small pool open in this long-running server.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * Resolves to null when a single-row write matches nothing (P2025). Writes are filtered by
 * `{ id, userId }`, so another user's row lands here too and the route answers 404.
 */
export async function orNotFound<T>(write: Promise<T>): Promise<T | null> {
  try {
    return await write;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return null;
    throw e;
  }
}

export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}
