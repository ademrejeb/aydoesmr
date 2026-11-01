-- Agile module: workflows, columns, sprints + task agile fields.

-- Task.status: enum -> text (preserve existing values)
ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" SET DATA TYPE TEXT USING "status"::text;
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'TODO';

-- Enums
CREATE TYPE "TaskType" AS ENUM ('EPIC', 'STORY', 'TASK', 'BUG', 'SUBTASK');
CREATE TYPE "SprintStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED');

-- Task agile columns
ALTER TABLE "Task" ADD COLUMN "type" "TaskType" NOT NULL DEFAULT 'TASK';
ALTER TABLE "Task" ADD COLUMN "storyPoints" INTEGER;
ALTER TABLE "Task" ADD COLUMN "sprintId" TEXT;
ALTER TABLE "Task" ADD COLUMN "columnId" TEXT;
ALTER TABLE "Task" ADD COLUMN "epicId" TEXT;

-- Workflow
CREATE TABLE "Workflow" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Board',
  "method" TEXT NOT NULL DEFAULT 'kanban',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- WorkflowColumn
CREATE TABLE "WorkflowColumn" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "color" TEXT DEFAULT '#2563eb',
  "wipLimit" INTEGER,
  "isBacklog" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WorkflowColumn_pkey" PRIMARY KEY ("id")
);

-- Sprint
CREATE TABLE "Sprint" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "teamId" TEXT,
  "name" TEXT NOT NULL,
  "goal" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "status" "SprintStatus" NOT NULL DEFAULT 'PLANNING',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowColumn" ADD CONSTRAINT "WorkflowColumn_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "WorkflowColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique + indexes
CREATE UNIQUE INDEX "Workflow_projectId_name_key" ON "Workflow"("projectId", "name");
CREATE INDEX "Workflow_organizationId_idx" ON "Workflow"("organizationId");
CREATE UNIQUE INDEX "WorkflowColumn_workflowId_name_key" ON "WorkflowColumn"("workflowId", "name");
CREATE INDEX "WorkflowColumn_workflowId_idx" ON "WorkflowColumn"("workflowId");
CREATE INDEX "Sprint_organizationId_projectId_idx" ON "Sprint"("organizationId", "projectId");

-- Drop legacy Board
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_boardId_fkey";
DROP INDEX IF EXISTS "Board_organizationId_idx";
DROP INDEX IF EXISTS "Board_projectId_name_key";
DROP TABLE "Board";
DROP TYPE IF EXISTS "TaskStatus";