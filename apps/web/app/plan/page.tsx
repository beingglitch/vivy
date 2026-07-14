import { Planner } from './planner';

export const dynamic = 'force-dynamic';

// The nightly ritual: tell Vivy what tomorrow should be; she lays out the day
// around what's already fixed (calendar, routines, deadlines, goal pace).
export default function PlanPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl italic">Plan tomorrow</h1>
        <p className="mt-1 text-sm text-moth">
          Say what you want from tomorrow — Vivy schedules it around what&apos;s already fixed.
        </p>
      </div>
      <Planner />
    </main>
  );
}
