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
    <div className="rounded-2xl bg-surface-secondary backdrop-blur border border-border-subtle shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-border-subtle bg-surface-secondary">
        <h2 className="text-lg font-semibold text-content">
          Pending Creator Invitations ({invitations.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">Invited By</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">Sent</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-content-muted uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invitations.map((invitation) => (
              <tr key={invitation.id} className="hover:bg-surface-hover transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-content-muted" />
                    <span className="text-sm text-content">{invitation.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content-muted">
                  {invitation.invitedByName || invitation.invitedByEmail || 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm text-content-muted">
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
                      className="text-content-muted hover:text-content-secondary hover:bg-surface-hover"
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
