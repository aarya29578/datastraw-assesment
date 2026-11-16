import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui/Button';
import {
  AlertTriangle,
  Trash2,
  Calendar,
  Briefcase,
  ShieldAlert,
  UserX,
  Layers,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export function DeleteEmployeeModal({
  isOpen,
  onClose,
  employee,
  eligibility,
  eligibilityLoading = false,
  onConfirmPermanentDelete,
  onDeactivate,
  onUnassign,
  actionLoading = false,
}) {
  if (!isOpen || !employee) return null;

  const isProtected = eligibility?.isProtected;
  const canDelete = eligibility?.canDelete;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      showClose={!actionLoading}
      title={
        eligibilityLoading
          ? 'Checking Deletion Eligibility'
          : isProtected
          ? 'Permanent Deletion Unavailable'
          : 'Delete Employee'
      }
    >
      {/* Loading state while checking historical references */}
      {eligibilityLoading ? (
        <div className="py-8 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <h5 className="text-sm font-semibold text-slate-800">
            Checking historical records...
          </h5>
          <p className="mt-1 text-xs text-slate-500 max-w-xs">
            Verifying roster entries, monthly schedule assignments, and audit logs for {employee.fullName}.
          </p>
        </div>
      ) : isProtected ? (
        /* Protected Employee View: Permanent Deletion Blocked */
        <div className="space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  Protected Historical Record
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {employee.employeeId || employee.employeeCode}
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 mt-1">
                {employee.fullName}
              </h4>
            </div>
          </div>

          {/* Required Warning Copy */}
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-amber-950 text-xs leading-relaxed font-medium">
            Permanent deletion is unavailable because this employee has historical records. You can deactivate and unassign this employee while preserving their historical roster data.
          </div>

          {/* Historical References Count Breakdown */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Historical References</span>
              <span className="text-rose-600 font-semibold">Active in System</span>
            </div>

            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60">
              <div className="flex items-center gap-2 text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Historical Roster Entries:</span>
              </div>
              <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {eligibility?.rosterCount ?? 0} shift{(eligibility?.rosterCount ?? 0) === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60">
              <div className="flex items-center gap-2 text-slate-700">
                <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                <span>Workflow Assignments:</span>
              </div>
              <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {eligibility?.assignmentCount ?? 0} assignment{(eligibility?.assignmentCount ?? 0) === 1 ? '' : 's'}
              </span>
            </div>

            {(eligibility?.leaveCount ?? 0) > 0 && (
              <div className="flex items-center justify-between text-xs py-1">
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Leave Records:</span>
                </div>
                <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {eligibility.leaveCount} record{eligibility.leaveCount === 1 ? '' : 's'}
                </span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-normal">
            Data integrity rule: Deleting this employee would damage monthly timesheets and client servicing history. Use the actions below to deactivate or remove them from active operations.
          </p>

          {/* Action buttons for Protected Employee */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={actionLoading}
              className="text-xs"
            >
              Close
            </Button>

            {employee.podId && (
              <Button
                variant="secondary"
                icon={Layers}
                onClick={onUnassign}
                loading={actionLoading}
                className="text-xs text-slate-700"
                title="Unassign employee from their current Pod"
              >
                Unassign (No Pod)
              </Button>
            )}

            {employee.status === 'ACTIVE' && (
              <Button
                variant="primary"
                icon={UserX}
                onClick={onDeactivate}
                loading={actionLoading}
                className="text-xs"
                title="Deactivate employee while preserving past rosters"
              >
                Deactivate Employee
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Unprotected Employee View: Permanent Deletion Allowed with Confirmation */
        <div className="space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-slate-900">
                Permanently Delete Employee?
              </h4>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                Are you sure you want to delete{' '}
                <strong className="text-slate-900">{employee.fullName}</strong> (
                {employee.employeeId || employee.employeeCode})?
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Zero historical roster entries and zero workflow assignments found. Permanent deletion is safe.
            </span>
          </div>

          <p className="text-xs text-rose-600 font-medium">
            Warning: This action will permanently remove this employee record from the database. This action cannot be undone.
          </p>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={onConfirmPermanentDelete}
              loading={actionLoading}
            >
              Delete Employee
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
export default DeleteEmployeeModal;
