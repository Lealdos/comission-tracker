// Prisma returns @db.Date columns as Dates at UTC midnight, while the API and the pay-plan engine
// use "YYYY-MM-DD" strings. Every row leaves the server through one of these mappers.

import { fromUTC, monthEnd, monthStart, toUTC } from "../shared/dates.ts";
import type { Acquisition, Deal, Prisma, Spiff, User } from "./generated/prisma/client.ts";

export const toDbDate = toUTC;

/** Inclusive date filter covering every day of `month` ("YYYY-MM"). */
export function inMonth(month: string): Prisma.DateTimeFilter {
  return { gte: toUTC(monthStart(month)), lte: toUTC(monthEnd(month)) };
}

export const publicUserSelect = { id: true, name: true, hireDate: true } satisfies Prisma.UserSelect;

/** The email comes from the Neon Auth session, which owns it; the rest is the app's profile row. */
export function serializeUser(u: Pick<User, "id" | "name" | "hireDate">, email: string) {
  return { id: u.id, email, name: u.name, hireDate: fromUTC(u.hireDate) };
}

export function serializeDeal({ userId: _, ...d }: Deal) {
  return { ...d, soldOn: fromUTC(d.soldOn), createdAt: d.createdAt.toISOString() };
}

export function serializeAcquisition({ userId: _, ...a }: Acquisition) {
  return { ...a, acquiredOn: fromUTC(a.acquiredOn), createdAt: a.createdAt.toISOString() };
}

export function serializeSpiff({ userId: _, ...s }: Spiff) {
  return { ...s, paidOn: fromUTC(s.paidOn), createdAt: s.createdAt.toISOString() };
}

export type PublicUser = ReturnType<typeof serializeUser>;
export type DealDto = ReturnType<typeof serializeDeal>;
export type AcquisitionDto = ReturnType<typeof serializeAcquisition>;
export type SpiffDto = ReturnType<typeof serializeSpiff>;
