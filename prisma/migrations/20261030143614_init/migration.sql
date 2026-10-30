-- CreateEnum
CREATE TYPE "vehicle_type" AS ENUM ('new', 'used');

-- CreateEnum
CREATE TYPE "acquisition_source" AS ENUM ('off_street', 'service_drive');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hire_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "sold_on" DATE NOT NULL,
    "vehicle_type" "vehicle_type" NOT NULL,
    "gross_cents" INTEGER NOT NULL,
    "stock_or_customer" TEXT NOT NULL DEFAULT '',
    "affiliate_store" BOOLEAN NOT NULL DEFAULT false,
    "affiliate_commission_cents" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acquisitions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "acquired_on" DATE NOT NULL,
    "source" "acquisition_source" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acquisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spiffs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "paid_on" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spiffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_settings" (
    "user_id" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "dpb_qualified" BOOLEAN NOT NULL DEFAULT false,
    "dpb_per_car_cents" INTEGER NOT NULL DEFAULT 0,
    "draw_override_cents" INTEGER,

    CONSTRAINT "month_settings_pkey" PRIMARY KEY ("user_id","month")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "deals_user_id_sold_on_idx" ON "deals"("user_id", "sold_on");

-- CreateIndex
CREATE INDEX "acquisitions_user_id_acquired_on_idx" ON "acquisitions"("user_id", "acquired_on");

-- CreateIndex
CREATE INDEX "spiffs_user_id_paid_on_idx" ON "spiffs"("user_id", "paid_on");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisitions" ADD CONSTRAINT "acquisitions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spiffs" ADD CONSTRAINT "spiffs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_settings" ADD CONSTRAINT "month_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
