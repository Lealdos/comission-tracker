import { Hono } from "hono";
import { z } from "zod";
import { monthParam, profileBody, profileCreateBody } from "../../shared/schemas.ts";
import { requireSession, requireUser, type AppEnv } from "../auth.ts";
import { isUniqueViolation, prisma } from "../db/client.ts";
import { publicUserSelect, serializeUser, toDbDate } from "../serialize.ts";
import { validate } from "../validate.ts";
import { loadMonth } from "./months.ts";

const meQuery = z.object({ month: monthParam.optional() });

// Sign-up, sign-in and sign-out go straight to Neon Auth via /api/auth/*. These routes manage the
// app profile that hangs off a Neon Auth account: `user` is null until it has been created.
export const meRoutes = new Hono<AppEnv>()
  // `?month=YYYY-MM` also returns that month's data (what GET /api/months/:month answers), so opening the app
  // checks the session once and makes one round trip. index.html starts this request before the app's JS loads.
  .get("/", requireSession, validate("query", meQuery), async (c) => {
    const account = c.get("account");
    const { month } = c.req.valid("query");
    const profile = await prisma.user.findUnique({ where: { authUserId: account.id }, select: publicUserSelect });
    const user = profile && serializeUser(profile, account.email);
    return c.json({
      account: { email: account.email, name: account.name },
      user,
      ...(user && month ? { month: await loadMonth(user, month) } : {}),
    });
  })

  .post("/", requireSession, validate("json", profileCreateBody), async (c) => {
    const account = c.get("account");
    const { name, hireDate } = c.req.valid("json");
    try {
      const profile = await prisma.user.create({ data: { authUserId: account.id, name, hireDate: toDbDate(hireDate) }, select: publicUserSelect });
      return c.json({ user: serializeUser(profile, account.email) }, 201);
    } catch (e) {
      if (isUniqueViolation(e)) return c.json({ error: "Your profile is already set up" }, 409);
      throw e;
    }
  })

  .patch("/", requireUser, validate("json", profileBody), async (c) => {
    const { name, hireDate } = c.req.valid("json");
    const profile = await prisma.user.update({
      where: { id: c.get("user").id },
      data: { name, hireDate: hireDate ? toDbDate(hireDate) : undefined },
      select: publicUserSelect,
    });
    return c.json({ user: serializeUser(profile, c.get("account").email) });
  });
