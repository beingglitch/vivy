'use client';

import { useTransition } from 'react';
import { killInvite } from './actions';

export interface InviteRow {
  id: string;
  recipientEmail: string | null;
  label: string | null;
  maxUses: number;
  usedCount: number;
  accessAmount: number;
  accessUnit: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/**
 * Codes that could still be redeemed.
 *
 * Revoking is offered here and nowhere else, because it only means anything
 * while a code is live. A spent or expired code needs no action, so showing a
 * revoke button beside one would be a control that does nothing.
 */
export function PendingInvites({ invites }: { invites: InviteRow[] }) {
  if (invites.length === 0) {
    return (
      <section className="src__section">
        <p className="src__controlNote">No codes outstanding. Everything you issued is used,
          expired or revoked.</p>
      </section>
    );
  }

  return (
    <section className="src__section">
      {invites.map((invite) => (
        <PendingRow key={invite.id} invite={invite} />
      ))}
    </section>
  );
}

function PendingRow({ invite }: { invite: InviteRow }) {
  const [pending, start] = useTransition();
  const left = invite.maxUses - invite.usedCount;

  return (
    <div className="person">
      <div className="person__head person__head--static">
        <span className="person__email">
          {invite.recipientEmail ?? invite.label ?? 'Anyone with the code'}
        </span>
        <span className="srcpill srcpill--on">{left} left</span>
      </div>
      <p className="person__meta">
        Grants {invite.accessAmount} {invite.accessUnit}
        {invite.accessAmount === 1 ? '' : 's'} · code expires{' '}
        {invite.expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      </p>
      <button
        className="btn btn--quiet"
        disabled={pending}
        onClick={() => start(async () => void (await killInvite(invite.id)))}
      >
        {pending ? 'Revoking…' : 'Revoke this code'}
      </button>
    </div>
  );
}
