import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { extractFieldErrors } from '../../../utils/errorHandler';

export function AssignmentFormModal({
  isOpen,
  onClose,
  onSubmit,
  assignment = null,
  employees = [],
  brands = [],
  processes = [],
  loading = false,
}) {
  const [formData, setFormData] = useState({
    employeeId: '',
    brandId: '',
    processIds: [],
    isPrimary: true,
    notes: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (assignment) {
      setFormData({
        employeeId: assignment.employeeId || '',
        brandId: assignment.brandId || '',
        processIds: assignment.processIds || [],
        isPrimary: Boolean(assignment.isPrimary),
        notes: assignment.notes || '',
      });
    } else {
      setFormData({
        employeeId: employees[0]?.id || '',
        brandId: brands[0]?.id || '',
        processIds: brands[0]?.assignedProcesses || (processes[0]?.id ? [processes[0].id] : []),
        isPrimary: true,
        notes: 'Operational allocation',
      });
    }
    setErrors({});
  }, [assignment, employees, brands, isOpen]);

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // If brand changed, auto-suggest the brand's processes if new assignment
      if (field === 'brandId' && !assignment) {
        const brandObj = brands.find((b) => b.id === value);
        if (brandObj && brandObj.assignedProcesses) {
          updated.processIds = [...brandObj.assignedProcesses];
        }
      }
      return updated;
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const toggleProcess = (procId) => {
    setFormData((prev) => {
      const exists = prev.processIds.includes(procId);
      const updated = exists
        ? prev.processIds.filter((id) => id !== procId)
        : [...prev.processIds, procId];
      return { ...prev, processIds: updated };
    });
  };

  const selectAllBrandProcesses = () => {
    const brandObj = brands.find((b) => b.id === formData.brandId);
    if (brandObj) {
      setFormData((prev) => ({ ...prev, processIds: [...brandObj.assignedProcesses] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.employeeId) newErrors.employeeId = 'Select an employee';
    if (!formData.brandId) newErrors.brandId = 'Select a brand';
    if (formData.processIds.length === 0) {
      newErrors.processes = 'Select at least one process to assign';
    }

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

  const selectedBrand = brands.find((b) => b.id === formData.brandId);
  const availableProcesses = processes.filter((p) => {
    const isAllowed = p.status === 'ACTIVE' || (formData.processIds || []).includes(p.id);
    const matchesBrand = selectedBrand ? selectedBrand.assignedProcesses.includes(p.id) : true;
    return isAllowed && matchesBrand;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={assignment ? 'Edit Assignment Mapping' : 'Configure Staff Assignment'}
      subtitle="Map specialist to client brands and select assigned processes"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Specialist / Employee"
          value={formData.employeeId}
          onChange={(e) => handleChange('employeeId', e.target.value)}
          options={employees
            .filter((e) => e.status === 'ACTIVE')
            .map((e) => ({
              value: e.id,
              label: `${e.fullName} (${e.employeeId} - ${e.designation})`,
            }))}
          error={errors.employeeId}
          required
        />

        <Select
          label="Target Client Brand"
          value={formData.brandId}
          onChange={(e) => handleChange('brandId', e.target.value)}
          options={brands
            .filter((b) => b.status === 'ACTIVE')
            .map((b) => ({
              value: b.id,
              label: `${b.name} (${b.brandId})`,
            }))}
          error={errors.brandId}
          required
        />

        {/* Process Selection */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Assigned Processes <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={selectAllBrandProcesses}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Select All Brand Processes
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {availableProcesses.length === 0 ? (
              <p className="col-span-full text-xs text-slate-400 italic py-2">
                No active processes found for this brand.
              </p>
            ) : (
              availableProcesses.map((proc) => {
                const isChecked = formData.processIds.includes(proc.id);
                return (
                  <button
                    type="button"
                    key={proc.id}
                    onClick={() => toggleProcess(proc.id)}
                    className={`p-3 rounded-lg border text-xs font-medium text-left transition-all flex items-center justify-between ${
                      isChecked
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-1 ring-indigo-400 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="pr-2">
                      <span className="font-semibold block text-slate-900 leading-snug">
                        {proc.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        {proc.code}
                      </span>
                    </div>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0 ${
                        isChecked ? 'bg-indigo-600 text-white' : 'border border-slate-300'
                      }`}
                    >
                      {isChecked ? '✓' : ''}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {errors.processes && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{errors.processes}</p>
          )}
        </div>

        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <input
            type="checkbox"
            id="isPrimary"
            checked={formData.isPrimary}
            onChange={(e) => handleChange('isPrimary', e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="isPrimary" className="text-xs text-slate-700 cursor-pointer">
            <span className="font-semibold block text-slate-900">Primary Assignment Lead</span>
            Designate this employee as the primary contact for this brand.
          </label>
        </div>

        <Input
          label="Assignment Notes / Scope"
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="e.g. Sole brand specialist handling all workflows"
        />

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {assignment ? 'Save Assignment' : 'Create Assignment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
