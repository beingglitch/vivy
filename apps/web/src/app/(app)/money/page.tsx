import { Dock } from '@/components/shell';
import { getMoneyDashboard } from '@/lib/money';
import { requirePageUserId } from '@/lib/page-session';
import { MoneyScreen } from './money-screen';

export const dynamic = 'force-dynamic';

export default async function MoneyPage() {
  const dashboard = await getMoneyDashboard(await requirePageUserId());

  return (
    <>
      <MoneyScreen dashboard={dashboard} />
      <Dock />
    </>
  );
}
