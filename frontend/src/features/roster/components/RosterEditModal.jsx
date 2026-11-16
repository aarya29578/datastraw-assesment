import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { ROSTER_STATUS, ROSTER_STATUS_CONFIG } from '../../../constants/rosterStatuses';
import { formatReadableDate } from '../../../utils/dateUtils';

export function RosterEditModal({
  isOpen,
  onClose,
  onSubmit,
  employee = null,
  dateKey = '',
  currentEntry = null,
  loading = false,
}) {
  const [status, setStatus] = useState(ROSTER_STATUS.WORKING);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (currentEntry) {
      setStatus(currentEntry.status || ROSTER_STATUS.WORKING);
      setNote(currentEntry.notes || currentEntry.note || '');
    } else {
      setStatus(ROSTER_STATUS.WORKING);
      setNote('');
    }
  }, [currentEntry, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ status, note });
  };

  if (!employee) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manual Roster Entry Edit"
      subtitle={`${employee.fullName} • ${formatReadableDate(dateKey)}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500">Employee & Designation</p>
          <p className="text-xs font-bold text-slate-900 mt-0.5">
            {employee.fullName} ({employee.employeeId}) — {employee.designation}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Default Weekly Off: <strong>{employee.weeklyOff}</strong>
          </p>
        </div>

        <Select
          label="Shift Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={Object.values(ROSTER_STATUS).map((st) => ({
            value: st,
            label: `${ROSTER_STATUS_CONFIG[st]?.label || st} (${ROSTER_STATUS_CONFIG[st]?.code})`,
          }))}
          required
        />

        <Input
          label="Reason / Edit Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Overtime replacement cover, swap with team member"
        />

        <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200 text-xs text-indigo-900">
          <strong>Validation Notice:</strong> Saving a manual shift edit marks the entry as modified. You can click <em>Validate Roster</em> to recheck coverage and conflict impact.
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Apply Shift Edit
          </Button>
        </div>
      </form>
    </Modal>
  );
}
