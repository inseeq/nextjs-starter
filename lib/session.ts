import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'inseeq_session';

const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function sign(expires: string, password: string): string {
  const key = createHmac('sha256', password).update('session cookie').digest();
  return createHmac('sha256', key).update(expires).digest('base64url');
}

export function constantTimeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

export function createSession(password: string): string {
  const expires = String(Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS);
  return `${expires}.${sign(expires, password)}`;
}

export function isValidSession(session: string | undefined, password: string | undefined): boolean {
  const [expires, signature, extra] = (session ?? '').split('.');
  if (!password || !expires || !signature || extra !== undefined || !/^\d+$/.test(expires)) return false;
  return constantTimeEqual(signature, sign(expires, password)) && Number(expires) > Date.now() / 1000;
}

export function sessionCookie(request: Request, session: string, maxAge = MAX_AGE_SECONDS): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const secure = LOCAL_HOSTS.has(host.replace(/:\d+$/, '')) ? '' : '; Secure';
  return `${SESSION_COOKIE}=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
