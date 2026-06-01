/*
  Warnings:

  - You are about to drop the column `url` on the `CreatorMedia` table. All the data in the column will be lost.
  - Added the required column `imageBytes` to the `CreatorMedia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `CreatorMedia` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CreatorMedia" DROP COLUMN "url",
ADD COLUMN     "imageBytes" BYTEA NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL;
