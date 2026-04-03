-- DropIndex
DROP INDEX IF EXISTS "Assignee_user_id_name_key";

-- AlterTable
ALTER TABLE "Assignee" DROP COLUMN IF EXISTS "order";
