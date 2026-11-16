import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Layers,
  Building2,
  Workflow,
  Briefcase,
  CalendarClock,
  CalendarCheck,
  CalendarDays,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { NAV_ITEMS } from '../../constants/navigation';
import { conflictService } from '../../features/conflicts/services/conflictService';

const iconMap = {
  LayoutDashboard,
  Users,
  Layers,
  Building2,
  Workflow,
  Briefcase,
  CalendarClock,
  CalendarCheck,
  CalendarDays,
  AlertTriangle,
};

export function Sidebar({ isOpen, onClose }) {
  const [openConflictsCount, setOpenConflictsCount] = useState(0);

  useEffect(() => {
    async function loadConflictCount() {
      try {
        const conflicts = await conflictService.getConflicts();
        const openCount = conflicts.filter((c) => c.status === 'OPEN').length;
        setOpenConflictsCount(openCount);
      } catch (e) {
        console.error(e);
      }
    }
    loadConflictCount();
    // Poll periodically and listen to immediate custom event
    window.addEventListener('roster:conflicts-updated', loadConflictCount);
    const interval = setInterval(loadConflictCount, 4000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('roster:conflicts-updated', loadConflictCount);
    };
  }, []);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold text-base shadow-sm">
              DS
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-base tracking-tight">DataStraw</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Ops
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Smart Roster System</p>
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <div className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Workforce & Operations
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon] || LayoutDashboard;
            const isConflicts = item.path === '/conflicts';

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.name}</span>
                </div>

                {isConflicts && openConflictsCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white animate-pulse">
                    {openConflictsCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* System Info & Status */}
        <div className="p-3.5 m-3 rounded-xl bg-slate-800/70 border border-slate-700/60">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart Roster Active</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
            Full enterprise rules, live conflict detection, and availability impact simulation.
          </p>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between px-4">
          <span>DataStraw v1.0</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            System Online
          </span>
        </div>
      </aside>
    </>
  );
}
