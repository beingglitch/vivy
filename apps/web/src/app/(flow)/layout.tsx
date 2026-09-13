import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { currentUserId } from '@/lib/session';

/**
 * The flow shell: phone frame, no tab bar.
 *
 * Onboarding deliberately has no bottom navigation, the exit is an explicit
 * "Finish later" link, so leaving is a decision rather than a mis-tap.
 */
export default async function FlowLayout({ children }: { children: ReactNode }) {
  if (!(await currentUserId())) redirect('/login');

  return (
    <div className="board">
      <div className="phone">
        {children}
      </div>
    </div>
  );
}
