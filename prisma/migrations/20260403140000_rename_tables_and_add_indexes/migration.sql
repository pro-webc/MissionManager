-- Rename tables
ALTER TABLE "Genre" RENAME TO "Project";
ALTER TABLE "Mission" RENAME TO "MainTask";
ALTER TABLE "Task" RENAME TO "SubTask";

-- Rename FK columns
ALTER TABLE "MainTask" RENAME COLUMN "genre_id" TO "project_id";
ALTER TABLE "SubTask" RENAME COLUMN "mission_id" TO "main_task_id";

-- Rename FK constraints
ALTER TABLE "Project" RENAME CONSTRAINT "Genre_user_id_fkey" TO "Project_user_id_fkey";
ALTER TABLE "Project" RENAME CONSTRAINT "Genre_department_id_fkey" TO "Project_department_id_fkey";
ALTER TABLE "Project" RENAME CONSTRAINT "Genre_assignee_id_fkey" TO "Project_assignee_id_fkey";
ALTER TABLE "Project" RENAME CONSTRAINT "Genre_pkey" TO "Project_pkey";

ALTER TABLE "MainTask" RENAME CONSTRAINT "Mission_pkey" TO "MainTask_pkey";
ALTER TABLE "MainTask" RENAME CONSTRAINT "Mission_genre_id_fkey" TO "MainTask_project_id_fkey";
ALTER TABLE "MainTask" RENAME CONSTRAINT "Mission_assignee_id_fkey" TO "MainTask_assignee_id_fkey";

ALTER TABLE "SubTask" RENAME CONSTRAINT "Task_pkey" TO "SubTask_pkey";
ALTER TABLE "SubTask" RENAME CONSTRAINT "Task_mission_id_fkey" TO "SubTask_main_task_id_fkey";

-- Add indexes on FK columns
CREATE INDEX "Department_user_id_idx" ON "Department"("user_id");
CREATE INDEX "Project_user_id_idx" ON "Project"("user_id");
CREATE INDEX "Project_department_id_idx" ON "Project"("department_id");
CREATE INDEX "Project_assignee_id_idx" ON "Project"("assignee_id");
CREATE INDEX "MainTask_project_id_idx" ON "MainTask"("project_id");
CREATE INDEX "MainTask_assignee_id_idx" ON "MainTask"("assignee_id");
CREATE INDEX "SubTask_main_task_id_idx" ON "SubTask"("main_task_id");
