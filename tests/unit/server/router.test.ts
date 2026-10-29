import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { handle } from '../../../api/index.js'
import { apiPath, compileRoutes, matchRoute, type RouteDefinition } from '../../../lib/http/router.js'
import { patternOf, renderTable, routeFiles, TABLE_FILE } from '../../../scripts/gen-routes.js'

const noop = async () => ({})
const defs: RouteDefinition[] = [
  { pattern: '/b/:branch/orders/:order', load: noop },
  { pattern: '/b/:branch/orders/open', load: noop },
  { pattern: '/b/:branch/orders', load: noop },
  { pattern: '/auth/me', load: noop },
]
const routes = compileRoutes(defs)

describe('route matching', () => {
  it('extracts parameters', () => {
    expect(matchRoute(routes, '/b/sin/orders/abc123')).toMatchObject({ route: { pattern: '/b/:branch/orders/:order' }, params: { branch: 'sin', order: 'abc123' } })
    expect(matchRoute(routes, '/b/sin/orders')?.route.pattern).toBe('/b/:branch/orders')
  })

  it('prefers static segments over parameters', () => {
    expect(matchRoute(routes, '/b/sin/orders/open')?.route.pattern).toBe('/b/:branch/orders/open')
  })

  it('refuses unknown paths and traversal tricks', () => {
    expect(matchRoute(routes, '/auth/nope')).toBeNull()
    expect(matchRoute(routes, '/b/sin/orders/%2E%2E')).toBeNull()
    expect(matchRoute(routes, '/b/sin/orders/%2Fetc')).toBeNull()
    expect(matchRoute(routes, '/b/sin/orders/%E0%A4%A')).toBeNull()
  })

  it('reads the path from the Vercel rewrite or the pathname', () => {
    expect(apiPath(new URL('https://bara.stoedio.com/api?__path=b/sin/context'))).toBe('/b/sin/context')
    expect(apiPath(new URL('http://localhost:5173/api/auth/me?x=1'))).toBe('/auth/me')
  })
})

describe('route table', () => {
  it('maps files to patterns like Vercel would', () => {
    expect(patternOf('auth/login.ts')).toBe('/auth/login')
    expect(patternOf('b/[branch]/devices/index.ts')).toBe('/b/:branch/devices')
    expect(patternOf('cron/[job].ts')).toBe('/cron/:job')
  })

  it('is up to date with api/_routes (run `npm run routes`)', () => {
    expect(readFileSync(TABLE_FILE, 'utf8')).toBe(renderTable(routeFiles()))
  })
})

describe('api/index.ts dispatcher', () => {
  it('answers 404 for an unknown route and 405 for a wrong method', async () => {
    const missing = await handle(new Request('http://localhost/api/nope'))
    expect(missing.status).toBe(404)
    const wrongMethod = await handle(new Request('http://localhost/api/auth/login', { method: 'GET' }))
    expect(wrongMethod.status).toBe(405)
    expect(wrongMethod.headers.get('allow')).toBe('POST')
  })
})
