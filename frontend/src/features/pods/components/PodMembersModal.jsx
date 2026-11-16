import React, { useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/ui/Button';
import { SearchInput } from '../../../components/common/SearchInput';
import { Users, Crown, Mail, Clock } from 'lucide-react';

export function PodMembersModal({
  isOpen,
  onClose,
  pod,
  members = [],
  lead = null,
}) {
  const [search, setSearch] = useState('');

  if (!pod) return null;

  const filtered = members.filter(
    (m) =>
      m.fullName.toLowerCase().includes(search.toLowerCase()) ||
      m.designation.toLowerCase().includes(search.toLowerCase()) ||
      m.employeeId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${pod.name} — Team Members`}
      subtitle={`Total ${members.length} operational specialists`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Designated Pod Lead Banner */}
        {lead && (
          <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {lead.avatar}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{lead.fullName}</span>
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200">
                    <Crown className="w-3 h-3 text-amber-500 fill-amber-500" /> Pod Lead
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{lead.designation} • {lead.email}</p>
              </div>
            </div>
            <Badge variant="primary">Lead</Badge>
          </div>
        )}

        {/* Member search */}
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter team members by name or role..."
        />

        {/* Members list */}
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {filtered.map((member) => (
            <div
              key={member.id}
              className={`p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors ${
                member.status !== 'ACTIVE' ? 'bg-slate-50/60 opacity-80' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                  {member.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900">{member.fullName}</span>
                    <span className="text-[11px] text-slate-400">({member.employeeId})</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{member.designation}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Off: {member.weeklyOff}
                </span>
                <Badge variant={member.status === 'ACTIVE' ? 'success' : 'default'} size="sm">
                  {member.status}
                </Badge>
              </div>
            </div>
          ))}
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
