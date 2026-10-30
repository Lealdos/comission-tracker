import { Hono } from "hono";
import { z } from "zod";
import { monthSummary } from "../../shared/commission.ts";
import { monthParam, monthSettingsBody } from "../../shared/schemas.ts";
import { requireUser, type AppEnv } from "../auth.ts";
import { prisma } from "../db/client.ts";
import { inMonth, serializeAcquisition, serializeDeal, serializeSpiff } from "../serialize.ts";
import { validate } from "../validate.ts";

const params = z.object({ month: monthParam });

export const monthRoutes = new Hono<AppEnv>()
  .use(requireUser)

  /** Everything the dashboard needs for one month: the logged rows plus the computed pay summary. */
  .get("/:month", validate("param", params), async (c) => {
    const { month } = c.req.valid("param");
    const user = c.get("user");
    const days = inMonth(month);

    const [dealRows, acquisitionRows, spiffRows, settingsRow] = await Promise.all([
      prisma.deal.findMany({ where: { userId: user.id, soldOn: days }, orderBy: [{ soldOn: "asc" }, { id: "asc" }] }),
      prisma.acquisition.findMany({ where: { userId: user.id, acquiredOn: days }, orderBy: [{ acquiredOn: "asc" }, { id: "asc" }] }),
      prisma.spiff.findMany({ where: { userId: user.id, paidOn: days }, orderBy: [{ paidOn: "asc" }, { id: "asc" }] }),
      prisma.monthSetting.findUnique({ where: { userId_month: { userId: user.id, month } } }),
    ]);

    const deals = dealRows.map(serializeDeal);
    const spiffs = spiffRows.map(serializeSpiff);
    const settings = {
      dpbQualified: settingsRow?.dpbQualified ?? false,
      dpbPerCarCents: settingsRow?.dpbPerCarCents ?? 0,
      drawOverrideCents: settingsRow?.drawOverrideCents ?? null,
    };

    const summary = monthSummary({
      month,
      hireDate: user.hireDate,
      deals,
      acquisitionCount: acquisitionRows.length,
      spiffCents: spiffs.map((s) => s.amountCents),
      dpb: { qualified: settings.dpbQualified, perCarCents: settings.dpbPerCarCents },
      drawOverrideCents: settings.drawOverrideCents,
    });

    return c.json({ summary, settings, deals, acquisitions: acquisitionRows.map(serializeAcquisition), spiffs });
  })

  .put("/:month/settings", validate("param", params), validate("json", monthSettingsBody), async (c) => {
    const { month } = c.req.valid("param");
    const userId = c.get("user").id;
    const values = c.req.valid("json");
    const row = await prisma.monthSetting.upsert({
      where: { userId_month: { userId, month } },
      create: { ...values, userId, month },
      update: values,
    });
    return c.json({ settings: row });
  });
