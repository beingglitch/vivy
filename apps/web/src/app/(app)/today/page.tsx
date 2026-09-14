import { listTasks, retireExpired } from '@/lib/tasks';
import { listAreas } from '@/lib/areas';
import { requirePageUserId } from '@/lib/page-session';
import { TodayDock, TodayScreen } from './today-screen';

export const dynamic = 'force-dynamic';

function dayKey(date: Date) {
  return date.toLocaleDateString('en-CA');
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const userId = await requirePageUserId();
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const params = await searchParams;
  const currentDay = dayKey(new Date());
  const selectedDay = /^\d{4}-\d{2}-\d{2}$/.test(params.day ?? '') ? params.day! : currentDay;
  await retireExpired(userId);
  const [allOpen, allDone, areas] = await Promise.all([
    listTasks(userId),
    listTasks(userId, 'done'),
    listAreas(userId),
  ]);
  const activeAreaIds = new Set(areas.map((area) => area.id));
  const belongsToActiveArea = (task: (typeof allOpen)[number]) =>
    task.areaId === null || activeAreaIds.has(task.areaId);
  const open = allOpen.filter(
    (task) => belongsToActiveArea(task) && dayKey(task.dueAt ?? new Date()) === selectedDay,
  );
  const done = allDone.filter(
    (task) =>
      belongsToActiveArea(task) &&
      task.completedAt !== null &&
      dayKey(task.completedAt) === selectedDay,
  );

  const today = new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en-GB', {
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
          <div
            className="today-progress"
            aria-label={`${done.length} of ${open.length + done.length} done`}
          >
            <strong>{done.length}</strong>
            <span>of {open.length + done.length} done</span>
          </div>
        </div>
      </div>

      <div className="screen screen--flush">
        <TodayScreen
          open={open}
          done={done}
          areas={areas}
          day={selectedDay}
          googleMapsApiKey={googleMapsApiKey}
        />
      </div>

      <TodayDock />
    </>
  );
}
