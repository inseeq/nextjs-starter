import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { PageHeader, Shell } from '../../../components/shell.tsx';
import { ErrorState, RangePicker, Tabs } from '../../../components/ui.tsx';
import { dashboards } from '../../../dashboards/index.ts';
import { getPeriod, parseRange } from '../../../lib/data.ts';
import { InseeqError } from '../../../lib/inseeq.ts';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ dashboard: string; tab?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { dashboard: slug, tab: rest = [] } = await params;
  const dashboard = dashboards.find((d) => d.slug === slug);
  const tab = rest.length <= 1 ? dashboard?.tabs.find((t) => t.slug === (rest[0] ?? dashboard.tabs[0]?.slug)) : undefined;
  if (!dashboard || !tab) notFound();

  const range = parseRange((await searchParams).range);
  let body: ReactNode;
  try {
    body = await tab.View({ period: await getPeriod(range) });
  } catch (error) {
    if (!(error instanceof InseeqError)) throw error;
    body = <ErrorState error={error} />;
  }

  return (
    <Shell active={dashboard.slug}>
      <PageHeader title={dashboard.title} description={dashboard.description} />
      <div className="toolbar">
        <Tabs base={`/${dashboard.slug}`} tabs={dashboard.tabs} active={tab.slug} range={range} />
        <RangePicker path={`/${dashboard.slug}/${tab.slug}`} range={range} />
      </div>
      {body}
    </Shell>
  );
}
