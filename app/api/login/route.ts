import { constantTimeEqual, createSession, sessionCookie } from '../../../lib/session.ts';

export async function POST(request: Request): Promise<Response> {
  const password = process.env.DASHBOARD_PASSWORD;
  const form = await request.formData().catch(() => null);
  const given = form?.get('password');
  if (!password || typeof given !== 'string' || !constantTimeEqual(given, password)) {
    return new Response(null, { status: 303, headers: { Location: '/login?error=1' } });
  }
  return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': sessionCookie(request, createSession(password)) } });
}
