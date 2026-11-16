import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/ui/Button';
import { CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatReadableDate } from '../../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';

export function RosterValidationDrawer({
  isOpen,
  onClose,
  conflicts = [],
  isValidating = false,
}) {
  const navigate = useNavigate();
  const criticalCount = conflicts.filter((c) => c.severity === 'CRITICAL').length;
  const warningCount = conflicts.filter((c) => c.severity === 'WARNING').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Roster Impact Validation Report"
      subtitle="Evaluated against all Brand Working Rules and Availability constraints"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Validation Score Header */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            criticalCount > 0
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : warningCount > 0
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-3">
            {criticalCount > 0 ? (
              <AlertTriangle className="w-8 h-8 text-rose-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
            )}
            <div>
              <h4 className="text-base font-bold">
                {criticalCount > 0
                  ? `${criticalCount} Critical Coverage Deficit(s) Detected`
                  : 'Roster Compliant & Balanced'}
              </h4>
              <p className="text-xs opacity-85 mt-0.5">
                {criticalCount > 0
                  ? 'Mandatory operating minimums are breached on one or more dates.'
                  : 'All operational minimums and staffing SLAs are satisfied.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={criticalCount > 0 ? 'danger' : 'success'}>
              {criticalCount} Critical
            </Badge>
            <Badge variant="warning">{warningCount} Warnings</Badge>
          </div>
        </div>

        {/* Conflict list */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
            Validation Findings ({conflicts.length})
          </h4>

          {conflicts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800">Zero Coverage Gaps</p>
              <p className="text-[11px] text-slate-500 mt-1">
                All scheduled shifts satisfy brand operating requirements.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {conflicts.map((conf) => (
                <div
                  key={conf.id}
                  className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-start justify-between gap-3 shadow-2xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {conf.brandName} • {conf.processName}
                      </span>
                      <Badge variant={conf.severity === 'CRITICAL' ? 'danger' : 'warning'} size="sm">
                        {conf.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-700 mt-1">{conf.reason}</p>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      Date: {formatReadableDate(conf.date)} | Required: {conf.requiredCount} | Available: {conf.availableCount}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              navigate('/conflicts');
            }}
            icon={ArrowRight}
            iconPosition="right"
          >
            Go to Conflict Management Screen
          </Button>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Report
          </Button>
        </div>
      </div>
    </Modal>
  );
}
