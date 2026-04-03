-- AlterTable
ALTER TABLE "Genre" ADD COLUMN "due_date" DATE;

-- AlterTable
ALTER TABLE "Genre" ADD COLUMN "assignee_id" TEXT;

-- AddForeignKey
ALTER TABLE "Genre" ADD CONSTRAINT "Genre_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "Assignee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
