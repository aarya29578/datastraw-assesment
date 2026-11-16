import React from 'react';
import { Menu, Calendar, CheckCircle2 } from 'lucide-react';
import { useRosterCycle } from '../../context/RosterCycleContext';

export function Header({ onToggleSidebar }) {
  const { activeLabel } = useRosterCycle();

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      {/* Left section: mobile menu toggle & context indicator */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            Active Roster Cycle: <strong>{activeLabel}</strong>
          </span>
          <span className="hidden md:inline-flex items-center gap-1 text-emerald-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Operations Healthy
          </span>
        </div>
      </div>

      {/* Right section: Profile chip */}
      <div className="flex items-center gap-3">
        {/* Manager User Chip */}
        <div className="flex items-center gap-2 pl-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center justify-center border border-indigo-200">
            AM
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-800 leading-none">Aditya Mishra</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Operations Director</p>
          </div>
        </div>
      </div>
    </header>
  );
}
