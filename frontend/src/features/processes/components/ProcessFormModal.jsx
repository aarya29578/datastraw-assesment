import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { extractFieldErrors } from '../../../utils/errorHandler';

export function ProcessFormModal({
  isOpen,
  onClose,
  onSubmit,
  process = null,
  loading = false,
}) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    defaultMinStaff: 1,
    status: 'ACTIVE',
    color: 'emerald',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (process) {
      setFormData({
        code: process.code || '',
        name: process.name || '',
        description: process.description || '',
        defaultMinStaff: process.defaultMinStaff || 1,
        status: process.status || 'ACTIVE',
        color: process.color || 'emerald',
      });
    } else {
      setFormData({
        code: '',
        name: '',
        description: '',
        defaultMinStaff: 1,
        status: 'ACTIVE',
        color: 'emerald',
      });
    }
    setErrors({});
  }, [process, isOpen]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.code.trim()) newErrors.code = 'Process code (e.g. CS, ACC) is required';
    if (!formData.name.trim()) newErrors.name = 'Process name is required';
    if (!formData.defaultMinStaff || formData.defaultMinStaff < 1) {
      newErrors.defaultMinStaff = 'Minimum staffing must be at least 1';
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
      title={process ? 'Edit Operational Process' : 'Add New Process'}
      subtitle="Define operational workflow capabilities and default baseline staffing"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Process Code"
            value={formData.code}
            onChange={(e) => handleChange('code', e.target.value)}
            error={errors.code}
            required
            placeholder="e.g. CS, NDR, VIP"
          />
          <Select
            label="Badge Color"
            value={formData.color}
            onChange={(e) => handleChange('color', e.target.value)}
            options={[
              { value: 'emerald', label: 'Emerald' },
              { value: 'blue', label: 'Blue' },
              { value: 'purple', label: 'Purple' },
              { value: 'amber', label: 'Amber' },
              { value: 'rose', label: 'Rose' },
            ]}
          />
        </div>

        <Input
          label="Process Name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          required
          placeholder="e.g. Customer Support"
        />

        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Scope, SLAs, communication channels..."
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Default Min Staff"
            type="number"
            min="1"
            value={formData.defaultMinStaff}
            onChange={(e) => handleChange('defaultMinStaff', e.target.value)}
            error={errors.defaultMinStaff}
            required
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

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {process ? 'Save Changes' : 'Create Process'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
