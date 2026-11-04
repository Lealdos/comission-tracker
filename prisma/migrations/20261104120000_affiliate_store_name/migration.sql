-- A sale at an affiliated Germain store pays on this store's plan, so it records which store instead of a commission.
-- Affiliate sales logged before this have no store yet; the deals list flags them as "Missing details".
ALTER TABLE "deals" ADD COLUMN "affiliate_store_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "deals" DROP COLUMN "affiliate_commission_cents";
