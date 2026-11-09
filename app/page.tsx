import { redirect } from 'next/navigation';

import { EmptyState } from '../components/ui.tsx';
import { PageHeader, Shell } from '../components/shell.tsx';
import { dashboards } from '../dashboards/index.ts';

export default async function HomePage() {
  if (dashboards.length > 0) redirect(`/${dashboards[0].slug}`);
  return (
    <Shell active="">
      <PageHeader title="Your dashboard" />
      <EmptyState title="No pages yet">
        <p>Open Claude in this folder and ask for one, for example:</p>
        <ul>
          <li>Add a page for ad spend by platform, with a tab for campaigns.</li>
          <li>Add a tab that shows leads per week by channel.</li>
        </ul>
      </EmptyState>
    </Shell>
  );
}
