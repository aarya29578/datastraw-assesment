import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { LEAVE_STATUS } from '../../../constants/availabilityEnums';
import { extractFieldErrors } from '../../../utils/errorHandler';

export function LeaveRequestModal({
  isOpen,
  onClose,
  onSubmit,
  employees = [],
  loading = false,
}) {
  const [formData, setFormData] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    type: 'Casual Leave',
    reason: '',
    status: LEAVE_STATUS.APPROVED,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    setFormData({
      employeeId: employees[0]?.id || '',
      startDate: todayStr,
      endDate: todayStr,
      type: 'Casual Leave',
      reason: '',
      status: LEAVE_STATUS.APPROVED,
    });
    setErrors({});
  }, [employees, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.employeeId) newErrors.employeeId = 'Select an employee';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      newErrors.endDate = 'End date cannot be before start date';
    }
    if (!formData.reason?.trim()) newErrors.reason = 'Please specify a reason for absence';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Leave Request"
      subtitle="Submit planned absence or grant immediate approved leave"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Employee"
          value={formData.employeeId}
          onChange={(e) => {
            setFormData({ ...formData, employeeId: e.target.value });
            if (errors.employeeId) setErrors((prev) => ({ ...prev, employeeId: null }));
          }}
          options={employees.map((e) => ({
            value: e.id,
            label: `${e.fullName} (${e.employeeId})`,
          }))}
          error={errors.employeeId}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={formData.startDate}
            onChange={(e) => {
              setFormData({ ...formData, startDate: e.target.value });
              if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: null }));
            }}
            error={errors.startDate}
            required
          />
          <Input
            label="End Date"
            type="date"
            value={formData.endDate}
            onChange={(e) => {
              setFormData({ ...formData, endDate: e.target.value });
              if (errors.endDate) setErrors((prev) => ({ ...prev, endDate: null }));
            }}
            error={errors.endDate}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Leave Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            options={[
              { value: 'Casual Leave', label: 'Casual Leave (CL)' },
              { value: 'Sick Leave', label: 'Sick Leave (SL)' },
              { value: 'Earned Leave', label: 'Earned Leave (EL)' },
              { value: 'Comp-Off', label: 'Compensatory Off' },
            ]}
          />

          <Select
            label="Initial Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: LEAVE_STATUS.APPROVED, label: 'Approved (Blocks roster)' },
              { value: LEAVE_STATUS.PENDING, label: 'Pending (Under review)' },
            ]}
          />
        </div>

        <Input
          label="Reason for Absence"
          value={formData.reason}
          onChange={(e) => {
            setFormData({ ...formData, reason: e.target.value });
            if (errors.reason) setErrors((prev) => ({ ...prev, reason: null }));
          }}
          error={errors.reason}
          placeholder="e.g. Family wedding, medical appointment..."
          required
        />

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Submit Request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
