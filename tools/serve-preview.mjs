import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../preview/', import.meta.url))
const PORT = Number(process.env.PORT || 4180)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' }

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  let p = decodeURIComponent(url.pathname)
  if (p === '/') p = '/index.html'
  const file = normalize(join(ROOT, p))
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden')
    return
  }
  try {
    const buf = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(buf)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(PORT, '127.0.0.1', () => console.log(`preview http://127.0.0.1:${PORT}`))
