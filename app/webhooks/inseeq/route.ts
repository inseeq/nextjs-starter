import { after } from 'next/server';
import { Webhook } from 'standardwebhooks';

import type { InseeqEvent } from '../../../lib/inseeq.ts';

const MAX_BODY_BYTES = 1024 * 1024;

async function readCappedBody(request: Request): Promise<string | null> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request.body ?? []) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}

async function handleEvent({ id, type }: InseeqEvent): Promise<void> {
  console.log(`[inseeq] ${type} ${id}`);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.INSEEQ_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'INSEEQ_WEBHOOK_SECRET is not set.' }, { status: 503 });

  const body = await readCappedBody(request);
  if (body === null) return Response.json({ error: 'The body is over 1 MiB.' }, { status: 413 });

  let event: InseeqEvent;
  try {
    event = new Webhook(secret).verify(body, Object.fromEntries(request.headers)) as InseeqEvent;
  } catch {
    return Response.json({ error: 'The webhook signature does not verify.' }, { status: 401 });
  }

  after(() => handleEvent(event));
  return Response.json({ received: true });
}
