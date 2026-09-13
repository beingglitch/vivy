'use client';

import { useState } from 'react';

/**
 * Handing a freshly minted code to a person.
 *
 * The code is shown once and never stored in plaintext, so getting it out of
 * this screen is the whole job. Five routes, because the right one depends on
 * how you actually talk to whoever you are inviting:
 *
 * - **Share** opens the operating system sheet, which is how WhatsApp, Signal,
 *   Telegram and everything else get covered without integrating any of them.
 *   Only available over HTTPS or localhost, so the others are not fallbacks,
 *   they are the desktop path.
 * - **Email**, **SMS** and **WhatsApp** are plain links, prefilled.
 * - **Copy** always works.
 */
export function ShareInvite({
  minted,
  signupUrl,
}: {
  minted: { code: string; expiresAt: string; recipient: string | null; period: string };
  signupUrl: string;
}) {
  const { code, expiresAt, recipient, period } = minted;
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // Read once on mount rather than during render: navigator does not exist on
  // the server, and touching it while rendering would break hydration.
  if (typeof window !== 'undefined' && !canShare && typeof navigator.share === 'function') {
    setCanShare(true);
  }

  const expiry = new Date(expiresAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });

  const message =
    `You're invited to Vivy.\n\n` +
    `Invite code: ${code}\n` +
    `Sign up: ${signupUrl}\n\n` +
    `Gives you ${period} of access. The code itself expires ${expiry}.`;

  const encoded = encodeURIComponent(message);

  return (
    <div className="invitecode">
      <span className="eyebrow">Copy this now, it is shown once</span>
      <code className="invitecode__value">{code}</code>

      <div className="sharegrid">
        <button
          className="btn btn--primary"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(() => setCopied(true));
          }}
        >
          {copied ? 'Copied' : 'Copy code'}
        </button>

        {canShare ? (
          <button
            className="btn"
            onClick={() => {
              void navigator.share({ title: 'Vivy invite', text: message }).catch(() => undefined);
            }}
          >
            Share…
          </button>
        ) : null}

        <a
          className="btn"
          href={`mailto:${recipient ?? ''}?subject=${encodeURIComponent('Your Vivy invite')}&body=${encoded}`}
        >
          Email
        </a>
        <a className="btn" href={`sms:?&body=${encoded}`}>
          SMS
        </a>
        <a className="btn" href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      </div>

      <p className="src__controlNote">
        {recipient ? `For ${recipient}. ` : ''}
        Grants {period}. Code expires {expiry}.
      </p>
    </div>
  );
}
