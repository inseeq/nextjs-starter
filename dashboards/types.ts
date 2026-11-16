import type { ReactNode } from 'react';

import type { IconName } from '../components/shell.tsx';
import type { Period } from '../lib/data.ts';

export interface ViewProps {
  period: Period;
  /** The tab's own URL and its query, for views that keep a selection in the URL. */
  path: string;
  query: Record<string, string | undefined>;
}

export interface Tab {
  /** The last part of the URL: /paid-media/campaigns. */
  slug: string;
  title: string;
  View: (props: ViewProps) => Promise<ReactNode>;
}

export interface Dashboard {
  slug: string;
  title: string;
  description: string;
  icon: IconName;
  tabs: Tab[];
}
