import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/ui/Button';
import { Mail, Phone, Calendar, Briefcase, Layers, UserCheck, UserX, Clock, Trash2 } from 'lucide-react';
import { formatReadableDate } from '../../../utils/dateUtils';

export function EmployeeDetailsModal({
  isOpen,
  onClose,
  employee,
  pod,
  assignments = [],
  brands = [],
  processes = [],
  onEdit,
  onToggleStatus,
  onDelete,
}) {
  if (!employee) return null;

  // Find assignments for this employee
  const empAssignments = assignments.filter((a) => a.employeeId === employee.id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Employee Profile"
      subtitle={`ID: ${employee.employeeId}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-sm">
              {employee.avatar || 'EM'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{employee.fullName}</h3>
                <Badge variant={employee.status === 'ACTIVE' ? 'success' : 'danger'} dot size="sm">
                  {employee.status}
                </Badge>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-0.5">{employee.designation}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  {pod?.name || employee.pod?.name || 'Unassigned'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Weekly Off: <strong>{employee.weeklyOff}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button size="xs" variant="outline" onClick={onEdit}>
              Edit Profile
            </Button>
            <Button
              size="xs"
              variant={employee.status === 'ACTIVE' ? 'dangerOutline' : 'subtle'}
              onClick={onToggleStatus}
            >
              {employee.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              icon={Trash2}
              onClick={onDelete}
            >
              Delete Employee
            </Button>
          </div>
        </div>

        {/* Contact & Employment Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Contact Information
            </span>
            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <a href={`mailto:${employee.email}`} className="text-indigo-600 hover:underline">
                  {employee.email}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{employee.phone || 'Not provided'}</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Employment Details
            </span>
            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Joined on {formatReadableDate(employee.joiningDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-slate-400" />
                <span>Default Shift: 9:00 AM - 6:00 PM IST</span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Client & Process Assignments */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
            Client Brand & Process Allocations ({empAssignments.length})
          </h4>
          {empAssignments.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-500">
              No active brand assignments configured for this employee.
            </div>
          ) : (
            <div className="space-y-2.5">
              {empAssignments.map((asgn) => {
                const brand = brands.find((b) => b.id === asgn.brandId);
                const assignedProcObjs = processes.filter((p) => asgn.processIds.includes(p.id));

                return (
                  <div
                    key={asgn.id}
                    className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {brand ? brand.name : asgn.brandId}
                        </span>
                        {asgn.isPrimary && (
                          <span className="px-1.5 py-0.2 text-[10px] bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-semibold">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{asgn.notes}</p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {assignedProcObjs.map((proc) => (
                        <span
                          key={proc.id}
                          className="px-2 py-0.5 text-xs rounded border bg-slate-50 text-slate-700 font-medium"
                        >
                          {proc.code}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
