import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import {
  CheckCircle2,
  AlertTriangle,
  Lock,
  Sparkles,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { formatReadableDate } from '../../../utils/dateUtils';

export function ConflictResolutionModal({
  isOpen,
  onClose,
  conflict = null,
  availableEmployees = [],
  onSubmit,
  onCreateDraftRevision,
  loading = false,
  isCreatingRevision = false,
}) {
  const [selectedReplacementId, setSelectedReplacementId] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [error, setError] = useState(null);

  // Reset form inputs whenever conflict or modal open state changes
  useEffect(() => {
    setSelectedReplacementId('');
    setResolutionNote('');
    setError(null);
  }, [conflict?.id, isOpen]);

  if (!conflict) return null;

  const isResolved = conflict.status === 'RESOLVED';
  const isRosterPublished =
    conflict.rosterStatus === 'PUBLISHED' || conflict.roster?.status === 'PUBLISHED';
  const rosterVersion = conflict.rosterVersion || conflict.roster?.version || 1;
  const nextVersion = Number(rosterVersion) + 1;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading || isCreatingRevision || isResolved || isRosterPublished) return;

    if (!selectedReplacementId) {
      setError('Please select an eligible replacement specialist');
      return;
    }
    setError(null);
    onSubmit({
      replacementEmployeeId: selectedReplacementId,
      note: resolutionNote || `Assigned backup specialist to fulfill SLA for ${conflict.brandName}`,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Resolve Scheduling Conflict"
      subtitle={`${conflict.brandName || 'Brand'} • ${conflict.processName || 'Process'} (Revision ${rosterVersion} — ${conflict.rosterStatus || 'DRAFT'})`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Conflict Summary Box */}
        <div
          className={`p-3.5 rounded-xl border ${
            isResolved
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-rose-50 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {isResolved ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <h4
              className={`text-xs font-bold uppercase tracking-wider ${
                isResolved ? 'text-emerald-950' : 'text-rose-950'
              }`}
            >
              {isResolved ? 'Resolved Conflict' : `${conflict.severity} Breach`} on{' '}
              {formatReadableDate(conflict.date)}
            </h4>
          </div>
          <p
            className={`mt-1 text-xs leading-relaxed font-medium ${
              isResolved ? 'text-emerald-900' : 'text-rose-900'
            }`}
          >
            {conflict.reason || conflict.description}
          </p>
          <div
            className={`mt-2 flex items-center gap-3 text-xs ${
              isResolved ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            <span>
              Minimum Staff Required: <strong>{conflict.requiredCount ?? conflict.requiredStaffCount ?? 1}</strong>
            </span>
            <span>•</span>
            <span>
              Available on Duty: <strong>{conflict.availableCount ?? conflict.availableStaffCount ?? 0}</strong>
            </span>
          </div>
        </div>

        {/* State A: Conflict Already Resolved Banner */}
        {isResolved && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  This conflict has already been resolved.
                </p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Remediation: {conflict.resolutionNote || conflict.suggestedResolution || 'Coverage fulfilled.'}
                </p>
                {conflict.resolvedAt && (
                  <p className="text-[11px] text-emerald-600 mt-1">
                    Resolved on {new Date(conflict.resolvedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* State B: Published Roster Revision Lock Workflow */}
        {!isResolved && isRosterPublished && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-200/70 text-amber-900 shrink-0 mt-0.5">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Published Roster Locked (Revision {rosterVersion})
                </h4>
                <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                  Direct modifications cannot be made to a published roster. To assign a replacement specialist and resolve this conflict, create a new draft revision for this monthly cycle.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-amber-200 flex items-center justify-between gap-3">
              <span className="text-[11px] text-amber-800 font-medium">
                Preserves Revision {rosterVersion} audit trail and spawns Revision {nextVersion} (Draft).
              </span>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={Sparkles}
                loading={isCreatingRevision}
                disabled={isCreatingRevision}
                onClick={() => onCreateDraftRevision && onCreateDraftRevision(conflict)}
              >
                Create Draft Revision (v{nextVersion})
              </Button>
            </div>
          </div>
        )}

        {/* System Recommendation Box */}
        {!isResolved && conflict.suggestedResolution && (
          <div className="p-3 bg-indigo-50/70 rounded-lg border border-indigo-200 text-xs text-indigo-900">
            <span className="font-bold block text-indigo-950 mb-0.5">
              💡 System Recommendation:
            </span>
            {conflict.suggestedResolution}
          </div>
        )}

        {/* State C: Normal Resolution Form (Only if Draft & Open) */}
        {!isResolved && !isRosterPublished && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Select Replacement Specialist from Available Fleet
              </label>
              <Select
                value={selectedReplacementId}
                onChange={(e) => {
                  setSelectedReplacementId(e.target.value);
                  if (error) setError(null);
                }}
                disabled={loading}
                error={error}
                options={[
                  { value: '', label: '-- Choose replacement specialist --' },
                  ...availableEmployees
                    .filter((e) => e.status === 'ACTIVE' && e.id !== conflict.affectedEmployeeId)
                    .map((e) => {
                      const isRecommended = conflict.possibleReplacements?.includes(e.id);
                      return {
                        value: e.id,
                        label: `${e.fullName} (${e.employeeId || e.employeeCode || 'EMP'} - ${e.designation})${
                          isRecommended ? ' ★ Recommended' : ''
                        }`,
                      };
                    }),
                ]}
                required
              />
            </div>

            <Input
              label="Resolution Log / Manager Justification"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              disabled={loading}
              placeholder="e.g. Assigned temporary coverage from pod fleet to fulfill SLA"
            />

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <Button variant="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="success"
                loading={loading}
                disabled={loading || !selectedReplacementId}
                icon={ShieldCheck}
              >
                Apply Replacement & Revalidate
              </Button>
            </div>
          </form>
        )}

        {/* If resolved or published, show modal close footer button */}
        {(isResolved || isRosterPublished) && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
            <Button variant="secondary" onClick={onClose} disabled={loading || isCreatingRevision}>
              Close
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
