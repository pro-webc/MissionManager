export interface Department {
  id: string;
  name: string;
  order: number;
}

export interface Project {
  id: string;
  departmentId: string;
  assigneeId: string | null;
  assignee?: Assignee | null;
  name: string;
  summary: string | null;
  dueDate: string | null;
  order: number;
  mainTasks?: MainTask[];
}

export interface Assignee {
  id: string;
  name: string;
}

export interface MainTask {
  id: string;
  projectId: string;
  assigneeId: string | null;
  assignee?: Assignee | null;
  name: string;
  summary: string | null;
  dueDate: string | null;
  completedAt: string | null;
  order: number;
  subTasks?: SubTask[];
}

export interface SubTask {
  id: string;
  mainTaskId: string;
  name: string;
  summary: string | null;
  done: boolean;
  completedAt: string | null;
  dueDate: string | null;
  order: number;
}

export function mainTaskProgress(m: { subTasks?: { done: boolean }[] }): number {
  const subTasks = m.subTasks ?? [];
  if (subTasks.length === 0) return 0;
  const done = subTasks.filter((t) => t.done).length;
  return done / subTasks.length;
}

export function countIncompleteMainTasks(project: { mainTasks?: { subTasks?: { done: boolean }[] }[] }): number {
  const mainTasks = project.mainTasks ?? [];
  return mainTasks.filter((m) => mainTaskProgress(m) < 1).length;
}

export function formatDateJp(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 期限が早く・未完了のプロジェクトを上に。同条件は order でタイブレーク */
export function sortProjectsByDueAndIncomplete<T extends { dueDate?: string | Date | null; order: number; mainTasks?: { subTasks?: { done: boolean }[] }[] }>(
  projects: T[]
): T[] {
  return [...projects].sort((a, b) => {
    const aIncomplete = countIncompleteMainTasks(a) > 0;
    const bIncomplete = countIncompleteMainTasks(b) > 0;
    if (aIncomplete !== bIncomplete) return aIncomplete ? -1 : 1;
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDue !== bDue) return aDue - bDue;
    return a.order - b.order;
  });
}

/** 期限が早く・未完了のメインタスクを上に。同条件は order でタイブレーク */
export function sortMainTasksByDueAndIncomplete<T extends { dueDate?: string | Date | null; order: number; subTasks?: { done: boolean }[] }>(
  mainTasks: T[]
): T[] {
  return [...mainTasks].sort((a, b) => {
    const aIncomplete = mainTaskProgress(a) < 1;
    const bIncomplete = mainTaskProgress(b) < 1;
    if (aIncomplete !== bIncomplete) return aIncomplete ? -1 : 1;
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDue !== bDue) return aDue - bDue;
    return a.order - b.order;
  });
}

/** 期限が早く・未完了のサブタスクを上に。同条件は order でタイブレーク */
export function sortSubTasksByDueAndIncomplete<T extends { done: boolean; dueDate?: string | Date | null; order: number }>(
  subTasks: T[]
): T[] {
  return [...subTasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDue !== bDue) return aDue - bDue;
    return a.order - b.order;
  });
}
