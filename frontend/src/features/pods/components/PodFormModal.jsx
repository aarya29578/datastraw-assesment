import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { extractFieldErrors } from '../../../utils/errorHandler';

export function PodFormModal({
  isOpen,
  onClose,
  onSubmit,
  pod = null,
  employees = [],
  loading = false,
}) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    leadId: '',
    color: 'indigo',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (pod) {
      setFormData({
        name: pod.name || '',
        code: pod.code || '',
        description: pod.description || '',
        leadId: pod.leadId || '',
        color: pod.color || 'indigo',
      });
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        leadId: employees[0]?.id || '',
        color: 'indigo',
      });
    }
    setErrors({});
  }, [pod, employees, isOpen]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Pod name is required';
    if (!formData.leadId) newErrors.leadId = 'Pod lead must be assigned from existing employees';

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
      title={pod ? 'Edit Operational Pod' : 'Create Operational Pod'}
      subtitle="Organize specialist teams and designate team lead"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Pod Name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          required
          placeholder="e.g. Pod Epsilon (Enterprise)"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Pod Code"
            value={formData.code}
            onChange={(e) => handleChange('code', e.target.value)}
            placeholder="e.g. POD-ENT"
          />
          <Select
            label="Theme Color"
            value={formData.color}
            onChange={(e) => handleChange('color', e.target.value)}
            options={[
              { value: 'indigo', label: 'Indigo' },
              { value: 'emerald', label: 'Emerald' },
              { value: 'amber', label: 'Amber' },
              { value: 'purple', label: 'Purple' },
              { value: 'rose', label: 'Rose' },
            ]}
          />
        </div>

        <Select
          label="Pod Lead (Must be existing employee)"
          value={formData.leadId}
          onChange={(e) => handleChange('leadId', e.target.value)}
          options={employees
            .filter((e) => e.status === 'ACTIVE')
            .map((e) => ({
              value: e.id,
              label: `${e.fullName} (${e.employeeId} - ${e.designation})`,
            }))}
          error={errors.leadId}
          required
        />

        <Input
          label="Description / Scope"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Brief description of brand types and workflows managed..."
        />

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {pod ? 'Save Changes' : 'Create Pod'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
