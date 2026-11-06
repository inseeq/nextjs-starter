import { NextResponse, type NextRequest } from 'next/server';

import { isValidSession, SESSION_COOKIE } from './lib/session.ts';

const PUBLIC_PATHS = new Set(['/login', '/api/login', '/webhooks/inseeq']);

export function proxy(request: NextRequest): Response {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return new Response('DASHBOARD_PASSWORD is not set.', { status: 500 });

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname) || isValidSession(request.cookies.get(SESSION_COOKIE)?.value, password)) return NextResponse.next();
  if (pathname.startsWith('/api/')) return Response.json({ error: { code: 'unauthorized', message: 'Log in first.' } }, { status: 401 });
  return NextResponse.redirect(new URL('/login', request.url), 303);
}

export const config = { matcher: ['/((?!_next/static|favicon.ico).*)'] };
