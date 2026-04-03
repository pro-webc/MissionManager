"use client";

import { useState, useEffect } from "react";
import { DepartmentTabs } from "./DepartmentTabs";
import { ProjectSelector } from "./ProjectSelector";
import { MainTaskList } from "./MainTaskList";
import { useDepartments } from "@/hooks/useDepartments";
import { useProjects } from "@/hooks/useProjects";
import { useAssignees } from "@/hooks/useAssignees";

export function PageContent() {
  const { departments, loading: deptLoading, refetch: refetchDepts } = useDepartments();
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!deptLoading && departments.length > 0 && !selectedDeptId) {
      setSelectedDeptId(departments[0].id);
    }
  }, [deptLoading, departments, selectedDeptId]);

  const handleSelectDept = (id: string | null) => {
    setSelectedDeptId(id);
    setSelectedProjectId(null);
  };

  const { projects, loading: projectLoading, error, refetch, refetchSilent, updateSubTaskOptimistic } = useProjects(selectedDeptId);
  const { assignees, addAssignee, deleteAssignee } = useAssignees();
  const selectedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId) ?? null
    : null;

  return (
    <>
      <DepartmentTabs
        departments={departments}
        loading={deptLoading}
        selectedId={selectedDeptId}
        onSelect={handleSelectDept}
        refetch={refetchDepts}
      />
      <div
        className="flex flex-col md:flex-row md:gap-6 min-h-0 flex-1 pb-4"
        style={{ minHeight: "calc(100dvh - 180px)" }}
      >
        {selectedDeptId ? (
          <>
            <aside className="md:w-64 md:flex-shrink-0 md:border-r md:border-gray-700 md:pr-4 md:overflow-y-auto">
              <ProjectSelector
                projects={projects}
                loading={projectLoading}
                error={error}
                departmentId={selectedDeptId}
                refetch={refetch}
                refetchSilent={refetchSilent}
                selectedProject={selectedProject}
                onSelect={(p) => setSelectedProjectId(p?.id ?? null)}
                assignees={assignees}
                onAddAssignee={addAssignee}
                onDeleteAssignee={deleteAssignee}
              />
            </aside>
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
              <MainTaskList
                selectedProject={selectedProject}
                refetch={refetch}
                refetchSilent={refetchSilent}
                updateSubTaskOptimistic={updateSubTaskOptimistic}
                assignees={assignees}
                onAddAssignee={addAssignee}
                onDeleteAssignee={deleteAssignee}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            {deptLoading ? "読み込み中..." : "「+ 追加」から部門を作成してください"}
          </div>
        )}
      </div>
    </>
  );
}
