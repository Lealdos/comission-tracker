-- A sale or a car bought can carry a one-off bonus for that particular car, paid on top of what the plan pays.
-- Existing rows have none.
ALTER TABLE "deals" ADD COLUMN "unit_bonus_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "acquisitions" ADD COLUMN "unit_bonus_cents" INTEGER NOT NULL DEFAULT 0;
