-- On a split deal the salesperson says whether the unit bonus was for both of them; then it's split by the same percent.
-- Existing deals keep the whole bonus, as before.
ALTER TABLE "deals" ADD COLUMN "unit_bonus_shared" BOOLEAN NOT NULL DEFAULT false;
