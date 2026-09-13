import { doneToday, listTasks, retireExpired } from '@/lib/tasks';
import { requireUserId } from '@/lib/session';
import { TodayDock, TodayScreen } from './today-screen';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const userId = await requireUserId();
  await retireExpired(userId);
  const [open, done] = await Promise.all([listTasks(userId), doneToday(userId)]);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      <div className="header">
        <div className="header__row">
          <div className="header__titles">
            <h1 className="title">Today</h1>
            <span className="subtitle">{today}</span>
          </div>
        </div>
      </div>

      <div className="screen screen--flush">
        <TodayScreen open={open} done={done} />
      </div>

      <TodayDock />
    </>
  );
}
