import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const targets = [
  ['https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv', 'tools/data/ecdict.csv'],
  ['https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz', 'tools/data/cedict.txt.gz'],
]

for (const [url, dest] of targets) {
  const t0 = Date.now()
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length') || 0)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
  const { size } = await import('node:fs').then(m => m.promises.stat(dest))
  console.log(`${dest} ${(size / 1048576).toFixed(2)}MB in ${((Date.now() - t0) / 1000).toFixed(1)}s (content-length ${total})`)
}
