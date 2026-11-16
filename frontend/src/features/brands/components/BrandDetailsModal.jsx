import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/ui/Button';
import { Building2, Layers, CheckCircle2, Clock, Users, Workflow } from 'lucide-react';

export function BrandDetailsModal({
  isOpen,
  onClose,
  brand,
  pod,
  assignedEmployees = [],
  processes = [],
  onEdit,
}) {
  if (!brand) return null;

  const brandProcesses = processes.filter((p) => brand.assignedProcesses.includes(p.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Brand Profile & Allocation"
      subtitle={`ID: ${brand.brandId}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">{brand.name}</h3>
              <Badge variant={brand.status === 'ACTIVE' ? 'success' : 'danger'} dot size="sm">
                {brand.status}
              </Badge>
              {brand.isSingleDedicatedStaff && (
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                  Single-Dedicated Staffed
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{brand.description}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Operational Pods:</span>
              {brand.pods && brand.pods.length > 0 ? (
                <div className="inline-flex items-center gap-1.5 flex-wrap">
                  {brand.pods.map((p) => (
                    <span
                      key={p.id}
                      className="px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-200 text-slate-800"
                    >
                      {p.name} {p.employeeCount > 0 ? `(${p.employeeCount} staff)` : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <strong>{pod?.name || 'Unassigned'}</strong>
              )}
            </div>
          </div>

          <Button size="xs" variant="outline" onClick={onEdit}>
            Edit Brand
          </Button>
        </div>

        {/* Operating Requirements & SLA */}
        <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200">
          <div className="flex items-center gap-2 text-amber-900 text-xs font-bold uppercase tracking-wider mb-1">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Operating SLA & Requirements</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed font-medium">
            {brand.operatingRequirements || 'Standard business hours SLA.'}
          </p>
        </div>

        {/* Associated Processes */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
            Operational Processes ({brandProcesses.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {brandProcesses.map((proc) => (
              <div
                key={proc.id}
                className="p-3 rounded-lg border border-slate-200 bg-white flex items-start gap-2.5"
              >
                <div className="p-1.5 rounded bg-slate-100 text-slate-700 font-bold text-xs shrink-0">
                  {proc.code}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">{proc.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{proc.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assigned Staff Members */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
            Assigned Workforce ({assignedEmployees.length})
          </h4>
          {assignedEmployees.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No employees currently mapped to this brand.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {assignedEmployees.map(({ employee, assignment }) => (
                <div key={employee.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                      {employee.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900">{employee.fullName}</span>
                        {assignment.isPrimary && (
                          <span className="px-1.5 py-0.2 text-[10px] bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-semibold">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">{employee.designation}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {assignment.processIds.map((pid) => {
                      const proc = processes.find((p) => p.id === pid);
                      return (
                        <span
                          key={pid}
                          className="px-2 py-0.5 text-[10px] rounded bg-slate-100 font-semibold text-slate-700"
                        >
                          {proc?.code || pid}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
