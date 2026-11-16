export const ROSTER_STATUS = {
  WORKING: 'WORKING',
  WEEKLY_OFF: 'WEEKLY_OFF',
  LEAVE: 'LEAVE',
  COMP_OFF: 'COMP_OFF',
  HOLIDAY: 'HOLIDAY',
  NOT_REQUIRED: 'NOT_REQUIRED',
};

export const ROSTER_STATUS_CONFIG = {
  [ROSTER_STATUS.WORKING]: {
    code: 'W',
    label: 'Working',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  [ROSTER_STATUS.WEEKLY_OFF]: {
    code: 'WO',
    label: 'Weekly Off',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
  'WEEKLY OFF': {
    code: 'WO',
    label: 'Weekly Off',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
  [ROSTER_STATUS.LEAVE]: {
    code: 'L',
    label: 'Leave',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  [ROSTER_STATUS.COMP_OFF]: {
    code: 'CO',
    label: 'Comp-Off',
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
  },
  'COMP-OFF': {
    code: 'CO',
    label: 'Comp-Off',
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
  },
  [ROSTER_STATUS.HOLIDAY]: {
    code: 'H',
    label: 'Holiday',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  [ROSTER_STATUS.NOT_REQUIRED]: {
    code: 'NR',
    label: 'Not Required',
    bg: 'bg-zinc-100',
    text: 'text-zinc-500',
    border: 'border-zinc-200',
    badge: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    dot: 'bg-zinc-400',
  },
  'NOT REQUIRED': {
    code: 'NR',
    label: 'Not Required',
    bg: 'bg-zinc-100',
    text: 'text-zinc-500',
    border: 'border-zinc-200',
    badge: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    dot: 'bg-zinc-400',
  },
};

/**
 * Robust helper to retrieve config for any status string variant
 */
export function getRosterStatusConfig(status) {
  if (!status) return ROSTER_STATUS_CONFIG[ROSTER_STATUS.WORKING];
  const clean = status.trim().toUpperCase().replace(/[\s-]/g, '_');
  return ROSTER_STATUS_CONFIG[clean] || ROSTER_STATUS_CONFIG[status] || ROSTER_STATUS_CONFIG[ROSTER_STATUS.WORKING];
}
