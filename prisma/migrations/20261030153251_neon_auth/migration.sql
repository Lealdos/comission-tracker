/*
  Warnings:

  - Login moves to Neon Auth. The old email/password accounts have no Neon Auth identity to link,
    so this migration fails while `users` has rows; it is meant for an empty database.
*/
-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropIndex
DROP INDEX "users_email_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "email",
DROP COLUMN "password_hash",
ADD COLUMN     "auth_user_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "sessions";

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");
