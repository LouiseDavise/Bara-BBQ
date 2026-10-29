// Vercel Routing Middleware.
//  - "/" redirects to the remembered language, else the browser's, else English.
//  - /staff/* and /hq/* need a signed session; a registered device without one goes to the
//    PIN screen, anyone else to /login. Only the signature and expiry are checked here: every
//    API call re-checks the user, branch and role against Firestore.
// vite/dev-server.ts runs this same file locally.
import { next } from '@vercel/functions'
import { DEVICE_COOKIE, readCookie, SESSION_COOKIE, verifyDeviceToken, verifySession } from './lib/auth/session.js'
import { isLocale, matchLocale } from './shared/locales.js'

export const config = { matcher: ['/', '/staff', '/staff/:path*', '/hq', '/hq/:path*'], runtime: 'nodejs' }

export const LANG_COOKIE = 'bara_lang'

function redirect(location: URL): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location.toString(), Vary: 'Accept-Language, Cookie', 'Cache-Control': 'private, no-store' },
  })
}

async function quietly<T>(check: () => Promise<T>): Promise<T | null> {
  try {
    return await check()
  } catch {
    // SESSION_SECRET missing or a malformed cookie: treat as signed out, never as signed in.
    return null
  }
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const cookies = request.headers.get('cookie')

  if (url.pathname === '/') {
    const remembered = readCookie(cookies, LANG_COOKIE)
    const lang = isLocale(remembered) ? remembered : matchLocale(request.headers.get('accept-language'))
    return redirect(new URL(`/${lang}/${url.search}`, url))
  }

  if (!/^\/(staff|hq)(\/|$)/.test(url.pathname)) return next()
  if (await quietly(() => verifySession(readCookie(cookies, SESSION_COOKIE)))) return next()

  const device = await quietly(() => verifyDeviceToken(readCookie(cookies, DEVICE_COOKIE)))
  const target = new URL(device ? '/lock' : '/login', url)
  target.searchParams.set('next', `${url.pathname}${url.search}`)
  return redirect(target)
}
