import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { validateEmail, validatePhone } from '../../../utils/validation';
import { extractFieldErrors } from '../../../utils/errorHandler';

export function EmployeeFormModal({
  isOpen,
  onClose,
  onSubmit,
  employee = null,
  pods = [],
  loading = false,
}) {
  const [formData, setFormData] = useState({
    employeeId: '',
    fullName: '',
    email: '',
    phone: '',
    podId: '',
    designation: '',
    joiningDate: '',
    status: 'ACTIVE',
    weeklyOff: 'Sunday',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (employee) {
      setFormData({
        employeeId: employee.employeeId || '',
        fullName: employee.fullName || '',
        email: employee.email || '',
        phone: employee.phone || '',
        podId: employee.podId || '',
        designation: employee.designation || '',
        joiningDate: employee.joiningDate || new Date().toISOString().split('T')[0],
        status: employee.status || 'ACTIVE',
        weeklyOff: employee.weeklyOff || 'Sunday',
      });
    } else {
      setFormData({
        employeeId: `DS-${1000 + Math.floor(Math.random() * 900)}`,
        fullName: '',
        email: '',
        phone: '+91 ',
        podId: '',
        designation: 'Operations Specialist',
        joiningDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
        weeklyOff: 'Sunday',
      });
    }
    setErrors({});
  }, [employee, pods, isOpen]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number (e.g. +91 9876543210)';
    }
    if (!formData.designation.trim()) newErrors.designation = 'Designation is required';
    if (!formData.weeklyOff) newErrors.weeklyOff = 'Weekly off day is required';

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
      title={employee ? 'Edit Employee Profile' : 'Add New Employee'}
      subtitle={employee ? `Updating details for ${employee.fullName}` : 'Onboard a new operational specialist to DataStraw'}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Employee ID"
            value={formData.employeeId}
            onChange={(e) => handleChange('employeeId', e.target.value)}
            error={errors.employeeId}
            required
            placeholder="e.g. DS-1033"
          />
          <Input
            label="Full Name"
            value={formData.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            error={errors.fullName}
            required
            placeholder="e.g. Ankit Sharma"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={errors.email}
            required
            placeholder="e.g. ankit.s@datastraw.io"
          />
          <Input
            label="Phone Number"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            error={errors.phone}
            placeholder="+91 98200 00000"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Operational Pod"
            value={formData.podId}
            onChange={(e) => handleChange('podId', e.target.value)}
            options={[
              { value: '', label: 'Unassigned (No Pod)' },
              ...pods.map((p) => ({ value: p.id, label: p.name })),
            ]}
            error={errors.podId}
          />
          <Input
            label="Designation"
            value={formData.designation}
            onChange={(e) => handleChange('designation', e.target.value)}
            error={errors.designation}
            required
            placeholder="e.g. Support Specialist"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Joining Date"
            type="date"
            value={formData.joiningDate}
            onChange={(e) => handleChange('joiningDate', e.target.value)}
            required
          />
          <Select
            label="Weekly Off Day"
            value={formData.weeklyOff}
            onChange={(e) => handleChange('weeklyOff', e.target.value)}
            options={[
              { value: 'Sunday', label: 'Sunday' },
              { value: 'Saturday', label: 'Saturday' },
              { value: 'Monday', label: 'Monday' },
              { value: 'Tuesday', label: 'Tuesday' },
              { value: 'Wednesday', label: 'Wednesday' },
              { value: 'Thursday', label: 'Thursday' },
              { value: 'Friday', label: 'Friday' },
            ]}
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
            required
          />
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {employee ? 'Save Changes' : 'Create Employee'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
