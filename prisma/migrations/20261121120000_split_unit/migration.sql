-- On a split deal the car can count toward this salesperson's volume as a whole unit, as half a unit, or not at all
-- (the unit goes to the other salesperson). It replaces the yes/no split_counts_for_volume.
CREATE TYPE "split_unit" AS ENUM ('mine', 'half', 'theirs');

ALTER TABLE "deals" ADD COLUMN "split_unit" "split_unit" NOT NULL DEFAULT 'mine';

-- Split deals that weren't counted left the unit to the other salesperson.
UPDATE "deals" SET "split_unit" = 'theirs' WHERE "split_counts_for_volume" = false;

ALTER TABLE "deals" DROP COLUMN "split_counts_for_volume";
