import React from 'react';
import { TeamInvitation } from '../../types/firestore';
import { Mail, Clock, X, Copy } from 'lucide-react';
import { Button } from '../ui/Button';

interface PendingInvitationsTableProps {
  invitations: TeamInvitation[];
  actionLoading: string | null;
  onCopyLink: (invitationId: string) => void;
  onCancel: (invitationId: string) => void;
}

const formatDate = (date: any) => {
  if (!date) return '—';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const PendingInvitationsTable: React.FC<PendingInvitationsTableProps> = ({
  invitations,
  actionLoading,
  onCopyLink,
  onCancel,
}) => {
  if (invitations.length === 0) return null;

  return (
    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 bg-zinc-900/40">
        <h2 className="text-lg font-semibold text-white">
          Pending Creator Invitations ({invitations.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Invited By</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Sent</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {invitations.map((invitation) => (
              <tr key={invitation.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-white">{invitation.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {invitation.invitedByName || invitation.invitedByEmail || 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    {formatDate(invitation.createdAt)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCopyLink(invitation.id)}
                      className="text-gray-400 hover:text-gray-300 hover:bg-gray-500/10"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCancel(invitation.id)}
                      disabled={actionLoading === invitation.id}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      {actionLoading === invitation.id ? (
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          Canceling...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <X className="w-4 h-4" />
                          Cancel
                        </span>
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PendingInvitationsTable;
