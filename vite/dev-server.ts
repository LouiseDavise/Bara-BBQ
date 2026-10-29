// Makes `npm run dev` behave like Vercel:
//  - /api/* runs api/index.ts (the same dispatcher and route files as production)
//  - "/", /staff/* and /hq/* go through middleware.ts first
//  - /login, /device, /lock, /staff/* and /hq/* are served by app.html (the staff entry)
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'

const MIDDLEWARE_PATHS = /^\/$|^\/(staff|hq)(\/|$)/
const APP_PATHS = /^\/(login|device|lock|staff|hq)(\/|$)/

type Handler = (request: Request) => Promise<Response>

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const method = req.method ?? 'GET'
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', req.socket.remoteAddress ?? '127.0.0.1')
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req)
  return new Request(`http://${req.headers.host ?? 'localhost:5173'}${req.url ?? '/'}`, {
    method,
    headers,
    body: body?.length ? new Uint8Array(body) : undefined,
  })
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key !== 'set-cookie') res.setHeader(key, value)
  })
  const cookies = response.headers.getSetCookie()
  if (cookies.length) res.setHeader('Set-Cookie', cookies)
  res.end(Buffer.from(await response.arrayBuffer()))
}

async function load(server: ViteDevServer, file: string, name: string): Promise<Handler> {
  const module = (await server.ssrLoadModule(file)) as Record<string, Handler>
  return module[name]!
}

export function devServer(): Plugin {
  return {
    name: 'bara-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const [pathname = '/', query = ''] = (req.url ?? '/').split('?')
        const toApp = () => {
          if (APP_PATHS.test(pathname)) req.url = `/app.html${query ? `?${query}` : ''}`
          next()
        }
        const fail = (error: unknown) => {
          console.error('Local server error:', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { code: 'server_error', message: 'Local server error. Check the terminal.' } }))
        }

        if (pathname === '/api' || pathname.startsWith('/api/')) {
          toRequest(req)
            .then(async (request) => send(res, await (await load(server, '/api/index.ts', 'handle'))(request)))
            .catch(fail)
          return
        }
        if (MIDDLEWARE_PATHS.test(pathname)) {
          toRequest(req)
            .then(async (request) => {
              const response = await (await load(server, '/middleware.ts', 'default'))(request)
              if (response.headers.get('x-middleware-next')) toApp()
              else await send(res, response)
            })
            .catch(fail)
          return
        }
        toApp()
      })
    },
  }
}
