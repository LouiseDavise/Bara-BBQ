// The one deployed Vercel function. vercel.json rewrites every /api/* request here (passing the
// path as ?__path=…), and the route table lazy-loads only the route file the request needs.
// The route files in api/_routes keep the one-file-per-route layout with GET/POST/… exports.
import { methodNotAllowed, notFound } from '../lib/http/errors.js'
import { errorResponse } from '../lib/http/respond.js'
import { apiPath, compileRoutes, HTTP_METHODS, matchRoute, type HttpMethod } from '../lib/http/router.js'
import { routeTable } from './_route-table.js'

const routes = compileRoutes(routeTable)

export async function handle(request: Request): Promise<Response> {
  try {
    const match = matchRoute(routes, apiPath(new URL(request.url)))
    if (!match) throw notFound('No such API route.')
    const module = await match.route.load()
    const method = request.method.toUpperCase() as HttpMethod
    const handler = HTTP_METHODS.includes(method) ? module[method] : undefined
    if (!handler) {
      const response = errorResponse(methodNotAllowed())
      response.headers.set('Allow', HTTP_METHODS.filter((m) => module[m]).join(', '))
      return response
    }
    return await handler(request, match.params)
  } catch (error) {
    return errorResponse(error)
  }
}

export const GET = handle
export const POST = handle
export const PATCH = handle
export const PUT = handle
export const DELETE = handle
