// 检索：英文前缀匹配 + 拼音前缀/首字母匹配。
// 用「前两个字母」分桶，避免每次按键都全表扫描。

const SEP = '\u0001'
const GSEP = '\u0002'

function splitSenses(str) {
  const out = []
  if (!str) return out
  const groups = str.split(GSEP)
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]
    const sp = g.indexOf(' ')
    if (sp > 0 && sp < 6) out.push([g.slice(0, sp), g.slice(sp + 1)])
    else out.push(['', g])
  }
  return out
}

function enBrief(raw) {
  if (!raw) return ''
  const head = raw.split(SEP)[0]
  const first = head.split(GSEP)[0] || ''
  const sp = first.indexOf(' ')
  const text = sp > 0 && sp < 6 ? first.slice(sp + 1) : first
  return text.length > 24 ? text.slice(0, 24) + '…' : text
}

function parseEn(raw) {
  const parts = (raw || '').split(SEP)
  const s = splitSenses(parts[0] || '')
  const f = []
  const formStr = parts[1] || ''
  if (formStr) {
    const items = formStr.split(GSEP)
    for (let i = 0; i < items.length; i++) {
      const p = items[i]
      const c = p.indexOf(':')
      if (c > 0) f.push([p.slice(c + 1), p.slice(0, c)])
    }
  }
  return { s, f, t: parts[2] || '' }
}

const RANK_MAX = 100000

function makeEnIndex(dict) {
  const words = Object.keys(dict).sort((a, b) => {
    return a.length - b.length || (a < b ? -1 : 1)
  })
  const buckets = {}
  for (let i = 0; i < words.length; i++) {
    const k = words[i].slice(0, 2)
    if (!buckets[k]) buckets[k] = []
    buckets[k].push(words[i])
  }
  return { dict, words, buckets }
}

function searchEn(idx, raw, limit) {
  const q = (raw || '').trim().toLowerCase()
  if (!q) return []
  const dict = idx.dict
  const pool = q.length >= 2 ? (idx.buckets[q.slice(0, 2)] || []) : idx.words
  const out = []
  if (dict[q]) out.push(q)
  for (let i = 0; i < pool.length && out.length < limit; i++) {
    const w = pool[i]
    if (w !== q && w.indexOf(q) === 0) out.push(w)
  }
  return out
}

function initialOf(syl) {
  if (syl.indexOf('zh') === 0 || syl.indexOf('ch') === 0 || syl.indexOf('sh') === 0) return syl.slice(0, 2)
  return syl.charAt(0)
}

function makeZhIndex(rows) {
  const items = []
  const buckets = {}
  const abbrBuckets = {}
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const word = r[0]
    const py = r[1]
    const key = r[2]
    const gloss = r[3]
    let abbr = ''
    const syl = py.split(' ')
    if (syl.length === word.length) {
      for (let j = 0; j < syl.length; j++) abbr += initialOf(syl[j])
    }
    const item = { w: word, py, key, alt: key.replace(/v/g, 'u'), gloss, abbr, i }
    items.push(item)
    const k = item.key.slice(0, 2)
    if (!buckets[k]) buckets[k] = []
    buckets[k].push(item)
    if (abbr) {
      const a = abbr.slice(0, 2)
      if (!abbrBuckets[a]) abbrBuckets[a] = []
      abbrBuckets[a].push(item)
    }
  }
  return { items, buckets, abbrBuckets }
}

function searchZh(idx, raw, limit) {
  const q = (raw || '').toLowerCase().replace(/[^a-z]/g, '')
  if (!q) return []
  const pool = q.length >= 2 ? (idx.buckets[q.slice(0, 2)] || []) : idx.items
  const abbrPool = q.length >= 2 ? (idx.abbrBuckets[q.slice(0, 2)] || []) : []
  const exact = []
  const pref = []
  const abbr = []
  for (let i = 0; i < pool.length; i++) {
    const it = pool[i]
    if (it.key === q || it.alt === q) exact.push(it)
    else if (it.key.indexOf(q) === 0 || it.alt.indexOf(q) === 0) pref.push(it)
  }
  for (let i = 0; i < abbrPool.length; i++) {
    const it = abbrPool[i]
    if (it.abbr.indexOf(q) === 0) abbr.push(it)
  }
  const res = []
  const seen = {}
  const push = it => {
    if (seen[it.w] || res.length >= limit) return
    seen[it.w] = 1
    res.push(it)
  }
  for (let i = 0; i < exact.length; i++) push(exact[i])
  for (let i = 0; i < pref.length; i++) push(pref[i])
  for (let i = 0; i < abbr.length; i++) push(abbr[i])
  return res
}

export default {
  enBrief,
  parseEn,
  makeEnIndex,
  searchEn,
  makeZhIndex,
  searchZh
}
