// CRUD for the three things a salesperson logs: deals, cars bought from customers, and spiffs.
// Every query is filtered by the signed-in user, so another user's id simply 404s.

import { Hono } from "hono";
import { z } from "zod";
import { acquisitionBody, dealBody, dealPatch, monthParam, spiffBody } from "../../shared/schemas.ts";
import { requireUser, type AppEnv } from "../auth.ts";
import { orNotFound, prisma } from "../db/client.ts";
import { inMonth, serializeAcquisition, serializeDeal, serializeSpiff, toDbDate } from "../serialize.ts";
import { validate } from "../validate.ts";

const idParam = z.object({ id: z.coerce.number().int().positive() });
const monthQuery = z.object({ month: monthParam });
const notFound = { error: "Not found" } as const;

export const dealRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", validate("query", monthQuery), async (c) => {
    const rows = await prisma.deal.findMany({
      where: { userId: c.get("user").id, soldOn: inMonth(c.req.valid("query").month) },
      orderBy: [{ soldOn: "asc" }, { id: "asc" }],
    });
    return c.json({ deals: rows.map(serializeDeal) });
  })
  .post("/", validate("json", dealBody), async (c) => {
    const body = c.req.valid("json");
    const row = await prisma.deal.create({ data: { ...body, soldOn: toDbDate(body.soldOn), userId: c.get("user").id } });
    return c.json({ deal: serializeDeal(row) }, 201);
  })
  .patch("/:id", validate("param", idParam), validate("json", dealPatch), async (c) => {
    const body = c.req.valid("json");
    const row = await orNotFound(
      prisma.deal.update({
        where: { id: c.req.valid("param").id, userId: c.get("user").id },
        data: { ...body, soldOn: body.soldOn ? toDbDate(body.soldOn) : undefined },
      }),
    );
    return row ? c.json({ deal: serializeDeal(row) }) : c.json(notFound, 404);
  })
  .delete("/:id", validate("param", idParam), async (c) => {
    const row = await orNotFound(prisma.deal.delete({ where: { id: c.req.valid("param").id, userId: c.get("user").id } }));
    return row ? c.json({ ok: true }) : c.json(notFound, 404);
  });

export const acquisitionRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", validate("query", monthQuery), async (c) => {
    const rows = await prisma.acquisition.findMany({
      where: { userId: c.get("user").id, acquiredOn: inMonth(c.req.valid("query").month) },
      orderBy: [{ acquiredOn: "asc" }, { id: "asc" }],
    });
    return c.json({ acquisitions: rows.map(serializeAcquisition) });
  })
  .post("/", validate("json", acquisitionBody), async (c) => {
    const body = c.req.valid("json");
    const row = await prisma.acquisition.create({ data: { ...body, acquiredOn: toDbDate(body.acquiredOn), userId: c.get("user").id } });
    return c.json({ acquisition: serializeAcquisition(row) }, 201);
  })
  .delete("/:id", validate("param", idParam), async (c) => {
    const row = await orNotFound(prisma.acquisition.delete({ where: { id: c.req.valid("param").id, userId: c.get("user").id } }));
    return row ? c.json({ ok: true }) : c.json(notFound, 404);
  });

export const spiffRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", validate("query", monthQuery), async (c) => {
    const rows = await prisma.spiff.findMany({
      where: { userId: c.get("user").id, paidOn: inMonth(c.req.valid("query").month) },
      orderBy: [{ paidOn: "asc" }, { id: "asc" }],
    });
    return c.json({ spiffs: rows.map(serializeSpiff) });
  })
  .post("/", validate("json", spiffBody), async (c) => {
    const body = c.req.valid("json");
    const row = await prisma.spiff.create({ data: { ...body, paidOn: toDbDate(body.paidOn), userId: c.get("user").id } });
    return c.json({ spiff: serializeSpiff(row) }, 201);
  })
  .delete("/:id", validate("param", idParam), async (c) => {
    const row = await orNotFound(prisma.spiff.delete({ where: { id: c.req.valid("param").id, userId: c.get("user").id } }));
    return row ? c.json({ ok: true }) : c.json(notFound, 404);
  });
