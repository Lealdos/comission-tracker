import { Hono } from "hono";
import { profileBody, profileCreateBody } from "../../shared/schemas.ts";
import { requireSession, requireUser, type AppEnv } from "../auth.ts";
import { isUniqueViolation, prisma } from "../db/client.ts";
import { publicUserSelect, serializeUser, toDbDate } from "../serialize.ts";
import { validate } from "../validate.ts";

// Sign-up, sign-in and sign-out go straight to Neon Auth via /api/auth/*. These routes manage the
// app profile that hangs off a Neon Auth account: `user` is null until it has been created.
export const meRoutes = new Hono<AppEnv>()
  .get("/", requireSession, async (c) => {
    const account = c.get("account");
    const profile = await prisma.user.findUnique({ where: { authUserId: account.id }, select: publicUserSelect });
    return c.json({ account: { email: account.email, name: account.name }, user: profile && serializeUser(profile, account.email) });
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
