import { sessionCookie } from '../../../lib/session.ts';

export async function POST(request: Request): Promise<Response> {
  return new Response(null, { status: 303, headers: { Location: '/login', 'Set-Cookie': sessionCookie(request, '', 0) } });
}
