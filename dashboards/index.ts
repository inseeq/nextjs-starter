import { paidMedia } from './paid-media.tsx';
import { pipeline } from './pipeline.tsx';
import type { Dashboard } from './types.ts';
import { website } from './website.tsx';

/** The pages in the sidebar, in this order. Each page's tabs live in its own file. Delete an example by removing it here and deleting its file. */
export const dashboards: Dashboard[] = [paidMedia, website, pipeline];
