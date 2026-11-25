/**
 * Static server for the built console plus a same-origin reverse proxy for `/api/**` and
 * `/health`, mirroring the deployment layout (frontend + backend behind one origin).
 *
 * AMS_API_TARGET   backend base URL, default http://127.0.0.1:8180
 * AMS_E2E_PORT     listen port, default 4173
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, request as httpRequest } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../frontend/dist', import.meta.url)))
const target = new URL(process.env.AMS_API_TARGET || 'http://127.0.0.1:8180')
const port = Number(process.env.AMS_E2E_PORT || 4173)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function proxy(req, res) {
  const upstream = httpRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: target.host },
    },
    response => {
      res.writeHead(response.statusCode || 502, response.headers)
      response.pipe(res)
    },
  )
  upstream.on('error', error => {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, message: `后端不可用：${error.code || error.message}` }))
  })
  req.pipe(upstream)
}

function staticFile(req, res) {
  const url = new URL(req.url, 'http://localhost')
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
  if (path.split(/[/\\]/).includes('..')) path = ''
  let file = join(root, path)
  if (!path || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html')
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('frontend/dist 不存在，请先执行 npm run build')
    return
  }
  res.writeHead(200, {
    'content-type': MIME[extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
  })
  createReadStream(file).pipe(res)
}

createServer((req, res) => {
  if (req.url.startsWith('/api/') || req.url === '/health' || req.url.startsWith('/health?')) {
    proxy(req, res)
  } else {
    staticFile(req, res)
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`AMS E2E server: http://127.0.0.1:${port} -> ${target.origin} (static: ${root})`)
})
