import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { extractFieldErrors } from '../../../utils/errorHandler';

export function BrandFormModal({
  isOpen,
  onClose,
  onSubmit,
  brand = null,
  pods = [],
  processes = [],
  loading = false,
}) {
  const [formData, setFormData] = useState({
    brandId: '',
    name: '',
    description: '',
    podId: '',
    status: 'ACTIVE',
    operatingRequirements: '',
    assignedProcesses: [],
    isSingleDedicatedStaff: true,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (brand) {
      setFormData({
        brandId: brand.brandId || '',
        name: brand.name || '',
        description: brand.description || '',
        podId: brand.podId || '',
        status: brand.status || 'ACTIVE',
        operatingRequirements: brand.operatingRequirements || '',
        assignedProcesses: brand.assignedProcesses || [],
        isSingleDedicatedStaff: Boolean(brand.isSingleDedicatedStaff),
      });
    } else {
      setFormData({
        brandId: `BRD-${100 + Math.floor(Math.random() * 900)}`,
        name: '',
        description: '',
        podId: '',
        status: 'ACTIVE',
        operatingRequirements: '',
        assignedProcesses: processes.slice(0, 2).map((p) => p.id),
        isSingleDedicatedStaff: true,
      });
    }
    setErrors({});
  }, [brand, pods, isOpen]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const toggleProcess = (procId) => {
    setFormData((prev) => {
      const exists = prev.assignedProcesses.includes(procId);
      const updated = exists
        ? prev.assignedProcesses.filter((id) => id !== procId)
        : [...prev.assignedProcesses, procId];
      return { ...prev, assignedProcesses: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Brand name is required';
    if (formData.assignedProcesses.length === 0) {
      newErrors.processes = 'Select at least one active process for this brand';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      const serverFieldErrors = extractFieldErrors(err);
      if (Object.keys(serverFieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...serverFieldErrors }));
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={brand ? 'Edit Brand Details' : 'Add Client Brand'}
      subtitle="Configure brand portfolio identity, SLA requirements, and operational processes"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Brand ID"
            value={formData.brandId}
            onChange={(e) => handleChange('brandId', e.target.value)}
            required
            placeholder="e.g. BRD-013"
          />
          <Input
            label="Brand Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={errors.name}
            required
            placeholder="e.g. Zara Home"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Operational Pod"
            value={formData.podId}
            onChange={(e) => handleChange('podId', e.target.value)}
            options={[
              { value: '', label: 'Unassigned (or Multi-Pod)' },
              ...pods.map((p) => ({ value: p.id, label: p.name })),
            ]}
            error={errors.podId}
          />
          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
          />
        </div>

        {brand && brand.pods && brand.pods.length > 0 && (
          <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 flex items-center justify-between">
            <div>
              <span className="font-semibold block">Active Servicing Pods (via Employee Assignments):</span>
              <span className="text-slate-600 mt-0.5 block">
                {brand.pods.map((p) => `${p.name}${p.employeeCount > 0 ? ` (${p.employeeCount} staff)` : ''}`).join(', ')}
              </span>
            </div>
            {brand.isMultiPod && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded shrink-0 ml-2">
                Multi-Pod
              </span>
            )}
          </div>
        )}

        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Brief description of product categories & market focus..."
        />

        <Input
          label="Operating Requirements / SLA"
          value={formData.operatingRequirements}
          onChange={(e) => handleChange('operatingRequirements', e.target.value)}
          placeholder="e.g. 365-day operation, zero downtime, SLA < 15 mins"
        />

        {/* Process Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Associated Processes <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {processes.filter((p) => p.status === 'ACTIVE').length === 0 ? (
              <p className="col-span-full text-xs text-slate-400 italic py-2">
                No active processes available. Please configure processes first.
              </p>
            ) : (
              processes
                .filter((p) => p.status === 'ACTIVE')
                .map((proc) => {
                  const isChecked = formData.assignedProcesses.includes(proc.id);
                  return (
                    <button
                      type="button"
                      key={proc.id}
                      onClick={() => toggleProcess(proc.id)}
                      className={`p-3 rounded-lg border text-xs font-medium text-left transition-all flex items-center justify-between ${
                        isChecked
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs ring-1 ring-indigo-400'
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

        {/* Dedicated 1-Person Staffing Checkbox */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-2.5">
          <input
            type="checkbox"
            id="singleStaff"
            checked={formData.isSingleDedicatedStaff}
            onChange={(e) => handleChange('isSingleDedicatedStaff', e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="singleStaff" className="text-xs text-slate-700 cursor-pointer">
            <span className="font-semibold block text-slate-900">
              Single Dedicated Employee Staffing (~80% Distribution)
            </span>
            One dedicated specialist will handle all selected processes for this client brand.
          </label>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {brand ? 'Save Changes' : 'Create Brand'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
