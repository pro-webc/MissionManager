export interface Genre {
  id: string;
  name: string;
  summary: string | null;
  order: number;
  missions?: Mission[];
}

export interface Mission {
  id: string;
  genreId: string;
  name: string;
  summary: string | null;
  dueDate: string | null;
  completedAt: string | null;
  order: number;
  tasks?: Task[];
}

export interface Task {
  id: string;
  missionId: string;
  name: string;
  summary: string | null;
  done: boolean;
  completedAt: string | null;
  dueDate: string | null;
  order: number;
}

export function missionProgress(m: { tasks?: { done: boolean }[] }): number {
  const tasks = m.tasks ?? [];
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.done).length;
  return done / tasks.length;
}

export function countIncompleteMissions(genre: { missions?: { tasks?: { done: boolean }[] }[] }): number {
  const missions = genre.missions ?? [];
  return missions.filter((m) => missionProgress(m) < 1).length;
}

export function formatDateJp(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 期限が早く・未完了のミッションを上に。同条件は order でタイブレーク */
export function sortMissionsByDueAndIncomplete<T extends { dueDate?: string | Date | null; order: number; tasks?: { done: boolean }[] }>(
  missions: T[]
): T[] {
  return [...missions].sort((a, b) => {
    const aIncomplete = missionProgress(a) < 1;
    const bIncomplete = missionProgress(b) < 1;
    if (aIncomplete !== bIncomplete) return aIncomplete ? -1 : 1;
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDue !== bDue) return aDue - bDue;
    return a.order - b.order;
  });
}

/** 期限が早く・未完了のタスクを上に。同条件は order でタイブレーク */
export function sortTasksByDueAndIncomplete<T extends { done: boolean; dueDate?: string | Date | null; order: number }>(
  tasks: T[]
): T[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDue !== bDue) return aDue - bDue;
    return a.order - b.order;
  });
}
