import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getUnitColors = (unitId: string, subKey?: string) => {
  if (!unitId) return { border: '', badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', row: '' };
  
  const colors = [
    { border: 'border-l-4 border-l-blue-500', badge: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800', row: 'bg-blue-50/30 dark:bg-blue-900/5' },
    { border: 'border-l-4 border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800', row: 'bg-emerald-50/30 dark:bg-emerald-900/5' },
    { border: 'border-l-4 border-l-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800', row: 'bg-amber-50/30 dark:bg-amber-900/5' },
    { border: 'border-l-4 border-l-purple-500', badge: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-400 dark:border-purple-800', row: 'bg-purple-50/30 dark:bg-purple-900/5' },
    { border: 'border-l-4 border-l-pink-500', badge: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/40 dark:text-pink-400 dark:border-pink-800', row: 'bg-pink-50/30 dark:bg-pink-900/5' },
    { border: 'border-l-4 border-l-cyan-500', badge: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-400 dark:border-cyan-800', row: 'bg-cyan-50/30 dark:bg-cyan-900/5' },
    { border: 'border-l-4 border-l-orange-500', badge: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800', row: 'bg-orange-50/30 dark:bg-orange-900/5' },
    { border: 'border-l-4 border-l-indigo-500', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-400 dark:border-indigo-800', row: 'bg-indigo-50/30 dark:bg-indigo-900/5' },
    { border: 'border-l-4 border-l-teal-500', badge: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/40 dark:text-teal-400 dark:border-teal-800', row: 'bg-teal-50/30 dark:bg-teal-900/5' },
    { border: 'border-l-4 border-l-rose-500', badge: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-400 dark:border-rose-800', row: 'bg-rose-50/30 dark:bg-rose-900/5' }
  ];
  
  const key = subKey ? `${unitId}_${subKey}` : unitId;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};
