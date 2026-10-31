// Creates (or recreates) a demo account with last month and this month of sample activity for local development.
// Login: demo@example.com / demo-password

import { addDays, monthOf, monthStart, prevMonth, today } from "../../shared/dates.ts";
import { toDbDate } from "../serialize.ts";
import { prisma } from "./client.ts";

const EMAIL = "demo@example.com";
const PASSWORD = "demo-password";
const NAME = "Demo Seller";
const thisMonth = monthOf(today());
const lastMonth = prevMonth(thisMonth);
const on = (month: string, day: number) => toDbDate(addDays(monthStart(month), day - 1));

/** The demo login lives in Neon Auth: sign in to it, or sign it up the first time. */
async function demoAccountId(): Promise<string> {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) throw new Error("NEON_AUTH_BASE_URL is not set (run `neon deploy` or `neon env pull`)");
  // Neon Auth checks the origin; localhost origins are trusted by default.
  const post = (path: string, body: object) =>
    fetch(`${baseUrl}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: `http://localhost:${process.env.PORT ?? 3000}` },
      body: JSON.stringify(body),
    });

  let res = await post("sign-in/email", { email: EMAIL, password: PASSWORD });
  if (res.status === 401) res = await post("sign-up/email", { email: EMAIL, password: PASSWORD, name: NAME });
  if (!res.ok) throw new Error(`Neon Auth refused the demo account (${res.status}): ${await res.text()}`);
  const { user } = (await res.json()) as { user: { id: string } };
  return user.id;
}

type Sale = [day: number, type: "new" | "used", gross: number, customer: string, vehicle: string, stock: string];

// Gross in dollars as the dealership reports it, already net of the $500 management fee.
// Includes a deal at the minimum and one with negative gross; with the affiliate sale below, this month reaches the first volume milestone (13).
const thisMonthSales: Sale[] = [
  [2, "new", 2350, "Maria Lopez", "2026 Tucson SEL", "H6102"],
  [3, "used", 2900, "James Carter", "2022 Honda Civic EX", "U2214"],
  [4, "new", 700, "Ana Torres", "2026 Elantra SE", "H6118"],
  [6, "new", 3600, "Robert Kim", "2026 Palisade Calligraphy", "H6125"],
  [7, "used", 1400, "Linda Nguyen", "2021 Toyota RAV4 XLE", "U2230"],
  [9, "new", 1800, "David Brooks", "2026 Santa Fe SEL", "H6131"],
  [10, "new", 150, "Sofia Ramirez", "2026 Venue SE", "H6140"],
  [12, "used", -650, "Kevin Patel", "2020 Nissan Altima SV", "U2241"],
  [13, "new", 2600, "Emily Chen", "2026 Ioniq 5 Limited", "H6152"],
  [15, "new", 2200, "Marcus Johnson", "2026 Tucson Hybrid", "H6160"],
  [17, "used", 2100, "Laura Mitchell", "2019 Ford F-150 XLT", "U2257"],
  [19, "new", 1250, "Daniel Ortiz", "2026 Kona N Line", "H6171"],
  [21, "used", 1750, "Grace Wilson", "2020 Hyundai Santa Fe", "U2263"],
];

const lastMonthSales: Sale[] = [
  [3, "new", 1900, "Brian Foster", "2026 Sonata SEL", "H6015"],
  [5, "used", 2400, "Olivia Hayes", "2021 Jeep Grand Cherokee", "U2150"],
  [8, "new", 2750, "Victor Morales", "2026 Santa Cruz", "H6033"],
  [11, "new", 500, "Hannah Lee", "2026 Elantra SEL", "H6041"],
  [14, "used", 1600, "Samuel Wright", "2018 Honda CR-V", "U2172"],
  [16, "new", 3200, "Natalie Price", "2026 Palisade XRT", "H6057"],
  [20, "new", 1500, "Ethan Rivera", "2026 Tucson SE", "H6064"],
  [23, "used", 900, "Chloe Bennett", "2019 Mazda CX-5", "U2188"],
  [25, "new", 2100, "Isaac Turner", "2026 Ioniq 6", "H6078"],
  [28, "used", 2300, "Megan Scott", "2020 Toyota Tacoma", "U2195"],
];

const deals = (month: string, sales: Sale[]) =>
  sales.map(([day, vehicleType, gross, customerName, vehicle, stockNumber]) => ({ soldOn: on(month, day), vehicleType, grossCents: gross * 100, customerName, vehicle, stockNumber }));

const authUserId = await demoAccountId();

// Cascades to the demo profile's deals, acquisitions, spiffs and month settings.
await prisma.user.deleteMany({ where: { authUserId } });

await prisma.user.create({
  data: {
    authUserId,
    name: NAME,
    // Over a year of tenure, so rates carry the +1 point.
    hireDate: toDbDate("2025-03-01"),
    deals: {
      create: [
        ...deals(lastMonth, lastMonthSales),
        ...deals(thisMonth, thisMonthSales),
        // Counts toward volume; paid what the affiliated store reports.
        { soldOn: on(thisMonth, 16), vehicleType: "new", grossCents: 1800_00, customerName: "Carlos Mendez", vehicle: "2026 Kona SEL", affiliateStore: true, affiliateCommissionCents: 300_00, notes: "Delivered at the affiliated store" },
        // Split 50/50 and the unit left to the other salesperson, so this month still sits at 13 units.
        { soldOn: on(thisMonth, 20), vehicleType: "new", grossCents: 2400_00, customerName: "Nina Alvarez", vehicle: "2026 Santa Fe XRT", stockNumber: "H6177", splitPct: 50, splitWith: "Chris Dalton", splitCountsForVolume: false },
      ],
    },
    acquisitions: {
      create: [
        { acquiredOn: on(lastMonth, 12), source: "service_drive", customerName: "George Allen", vehicle: "2018 Hyundai Sonata" },
        { acquiredOn: on(thisMonth, 8), source: "service_drive", customerName: "Thomas Reed", vehicle: "2019 Toyota Camry" },
        { acquiredOn: on(thisMonth, 18), source: "off_street", customerName: "Priya Shah", vehicle: "2017 Honda Accord" },
      ],
    },
    spiffs: {
      create: [
        { paidOn: on(lastMonth, 9), amountCents: 75_00, note: "Santa Cruz spiff" },
        { paidOn: on(thisMonth, 14), amountCents: 100_00, note: "Ioniq 5 spiff" },
        { paidOn: on(thisMonth, 22), amountCents: 50_00, note: "Service contract spiff" },
      ],
    },
    monthSettings: { create: { month: thisMonth, dpbQualified: true, dpbPerCarCents: 800_00 } },
  },
});

console.log(`Seeded ${EMAIL} with ${lastMonthSales.length} deals in ${lastMonth} and ${thisMonthSales.length + 1} in ${thisMonth}`);
await prisma.$disconnect();
