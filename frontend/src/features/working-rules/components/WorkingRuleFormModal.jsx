import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { OPERATING_PATTERNS, OPERATING_PATTERN_LABELS } from '../../../constants/workingRuleEnums';
import { extractFieldErrors } from '../../../utils/errorHandler';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function WorkingRuleFormModal({
  isOpen,
  onClose,
  onSubmit,
  rule = null,
  brands = [],
  processes = [],
  loading = false,
}) {
  const [formData, setFormData] = useState({
    brandId: '',
    processId: '',
    pattern: OPERATING_PATTERNS.DAYS_365,
    operatingDays: ALL_DAYS,
    operatesOnHolidays: true,
    minStaffRequired: 1,
    notes: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (rule) {
      setFormData({
        brandId: rule.brandId || '',
        processId: rule.processId || '',
        pattern: rule.pattern || OPERATING_PATTERNS.DAYS_365,
        operatingDays: rule.operatingDays || ALL_DAYS,
        operatesOnHolidays: Boolean(rule.operatesOnHolidays),
        minStaffRequired: rule.minStaffRequired || 1,
        notes: rule.notes || '',
      });
    } else {
      setFormData({
        brandId: brands[0]?.id || '',
        processId: processes[0]?.id || '',
        pattern: OPERATING_PATTERNS.DAYS_365,
        operatingDays: ALL_DAYS,
        operatesOnHolidays: true,
        minStaffRequired: 1,
        notes: '365-day continuous operating SLA',
      });
    }
    setErrors({});
  }, [rule, brands, processes, isOpen]);

  const handlePatternChange = (newPattern) => {
    let days = ALL_DAYS;
    let holidays = true;

    if (newPattern === OPERATING_PATTERNS.DAYS_365) {
      days = ALL_DAYS;
      holidays = true;
    } else if (newPattern === OPERATING_PATTERNS.EXCEPT_HOLIDAYS) {
      days = ALL_DAYS;
      holidays = false;
    } else if (newPattern === OPERATING_PATTERNS.MON_TO_SAT) {
      days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      holidays = false;
    } else if (newPattern === OPERATING_PATTERNS.MON_TO_FRI) {
      days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      holidays = false;
    }

    setFormData((prev) => ({
      ...prev,
      pattern: newPattern,
      operatingDays: days,
      operatesOnHolidays: holidays,
    }));
  };

  const toggleDay = (day) => {
    setFormData((prev) => {
      const exists = prev.operatingDays.includes(day);
      const updated = exists
        ? prev.operatingDays.filter((d) => d !== day)
        : [...prev.operatingDays, day];
      return {
        ...prev,
        pattern: OPERATING_PATTERNS.CUSTOM,
        operatingDays: updated,
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.brandId) newErrors.brandId = 'Select a client brand';
    if (!formData.processId) newErrors.processId = 'Select a process';
    if (!formData.minStaffRequired || Number(formData.minStaffRequired) < 1) {
      newErrors.minStaffRequired = 'Minimum staff required must be at least 1';
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
    const isAllowed = p.status === 'ACTIVE' || p.id === formData.processId;
    const matchesBrand =
      selectedBrand && Array.isArray(selectedBrand.assignedProcesses) && selectedBrand.assignedProcesses.length > 0
        ? selectedBrand.assignedProcesses.includes(p.id)
        : true;
    return isAllowed && matchesBrand;
  });

  const handleBrandChange = (newBrandId) => {
    const brandObj = brands.find((b) => b.id === newBrandId);
    let nextProcessId = formData.processId;
    if (brandObj && Array.isArray(brandObj.assignedProcesses) && brandObj.assignedProcesses.length > 0) {
      if (!brandObj.assignedProcesses.includes(formData.processId)) {
        nextProcessId = brandObj.assignedProcesses[0] || '';
      }
    }
    setFormData((prev) => ({
      ...prev,
      brandId: newBrandId,
      processId: nextProcessId,
    }));
    if (errors.brandId) setErrors((prev) => ({ ...prev, brandId: null }));
    if (errors.processId) setErrors((prev) => ({ ...prev, processId: null }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={rule ? 'Edit Working & Staffing Rule' : 'Configure New Working Rule'}
      subtitle="Define brand/process operating calendar separate from employee rosters"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Client Brand"
            value={formData.brandId}
            onChange={(e) => handleBrandChange(e.target.value)}
            options={brands.map((b) => ({ value: b.id, label: b.name }))}
            error={errors.brandId}
            required
          />
          <Select
            label="Target Process"
            value={formData.processId}
            onChange={(e) => {
              setFormData({ ...formData, processId: e.target.value });
              if (errors.processId) setErrors((prev) => ({ ...prev, processId: null }));
            }}
            options={availableProcesses.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
            error={errors.processId}
            required
          />
        </div>

        <Select
          label="Operating Calendar Pattern"
          value={formData.pattern}
          onChange={(e) => handlePatternChange(e.target.value)}
          options={Object.entries(OPERATING_PATTERN_LABELS).map(([val, lbl]) => ({
            value: val,
            label: lbl,
          }))}
          required
        />

        {/* Operating Days Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Active Operating Days
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {ALL_DAYS.map((day) => {
              const isSelected = formData.operatingDays.includes(day);
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Minimum Staffing Required"
            type="number"
            min="1"
            max="10"
            value={formData.minStaffRequired}
            onChange={(e) => {
              setFormData({ ...formData, minStaffRequired: Number(e.target.value) });
              if (errors.minStaffRequired) setErrors((prev) => ({ ...prev, minStaffRequired: null }));
            }}
            error={errors.minStaffRequired}
            required
            helperText="Staff required on duty each operating day"
          />

          <div className="pt-6">
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.operatesOnHolidays}
                onChange={(e) =>
                  setFormData({ ...formData, operatesOnHolidays: e.target.checked })
                }
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-700 font-medium">
                Operates on Public Holidays
              </span>
            </label>
          </div>
        </div>

        <Input
          label="Rule Notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="e.g. 24/7 high volume peak season requirement"
        />

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {rule ? 'Save Rule' : 'Create Rule'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
