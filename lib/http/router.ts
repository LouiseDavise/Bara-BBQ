// Matches /api/<path> to a route file. Pure, so it's unit-tested; api/index.ts uses it in
// production and vite/dev-server.ts uses it (through api/index.ts) locally.

export const HTTP_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export type RouteHandler = (request: Request, params: Record<string, string>) => Promise<Response>
export type RouteModule = Partial<Record<HttpMethod, RouteHandler>>

export interface RouteDefinition {
  /** '/b/:branch/orders/:order' */
  pattern: string
  load: () => Promise<RouteModule>
}

interface CompiledRoute extends RouteDefinition {
  segments: string[]
}

const isParam = (segment: string) => segment.startsWith(':')

/** Static segments win over parameters at the same position, so /auth/me beats /auth/:x. */
export function compileRoutes(definitions: readonly RouteDefinition[]): CompiledRoute[] {
  return definitions
    .map((definition) => ({ ...definition, segments: definition.pattern.split('/').filter(Boolean) }))
    .sort((a, b) => {
      if (a.segments.length !== b.segments.length) return a.segments.length - b.segments.length
      for (let i = 0; i < a.segments.length; i++) {
        const pa = isParam(a.segments[i]!)
        const pb = isParam(b.segments[i]!)
        if (pa !== pb) return pa ? 1 : -1
      }
      return a.pattern < b.pattern ? -1 : 1
    })
}

export function matchRoute(routes: readonly CompiledRoute[], path: string): { route: CompiledRoute; params: Record<string, string> } | null {
  const raw = path.split('/').filter(Boolean)
  let segments: string[]
  try {
    segments = raw.map((segment) => decodeURIComponent(segment))
  } catch {
    return null
  }
  if (segments.some((segment) => segment === '.' || segment === '..' || segment.includes('/'))) return null
  for (const route of routes) {
    if (route.segments.length !== segments.length) continue
    const params: Record<string, string> = {}
    const matched = route.segments.every((segment, i) => {
      if (isParam(segment)) {
        params[segment.slice(1)] = segments[i]!
        return true
      }
      return segment === segments[i]
    })
    if (matched) return { route, params }
  }
  return null
}

/**
 * The route path of a request: Vercel's rewrite passes it as ?__path=…; locally the pathname
 * is used as is.
 */
export function apiPath(url: URL): string {
  const rewritten = url.searchParams.get('__path')
  if (rewritten !== null) return `/${rewritten.replace(/^\/+/, '')}`
  return url.pathname.replace(/^\/api(?=\/|$)/, '') || '/'
}
