-- Deals and cars bought now record who the customer was and which vehicle. The old free-text
-- fields are renamed rather than dropped, so nothing typed before this migration is lost:
-- a deal's "stock # / customer" text becomes its stock number, a car bought's description its vehicle.

-- AlterTable
ALTER TABLE "deals" RENAME COLUMN "stock_or_customer" TO "stock_number";
ALTER TABLE "deals" ADD COLUMN "customer_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN "vehicle" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "acquisitions" RENAME COLUMN "description" TO "vehicle";
ALTER TABLE "acquisitions" ADD COLUMN "customer_name" TEXT NOT NULL DEFAULT '';
