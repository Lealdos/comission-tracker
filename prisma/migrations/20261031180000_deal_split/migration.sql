-- A deal can be split with another salesperson. Existing deals aren't split.
ALTER TABLE "deals" ADD COLUMN "split_pct" INTEGER,
ADD COLUMN "split_with" TEXT NOT NULL DEFAULT '',
ADD COLUMN "split_counts_for_volume" BOOLEAN NOT NULL DEFAULT true;
