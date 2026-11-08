// 把 ECDICT 提取版 + CC-CEDICT + jieba 词频 编译成手环可用的紧凑词典数据。
// 产物：src/common/dict-en.js、src/common/dict-zh.js、preview/data/*.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = process.env.DICT_SRC || resolve(ROOT, '..', '.dict-data')
const OUT = resolve(ROOT, 'src/common')
const PREVIEW = resolve(ROOT, 'preview/data')

const EN_SRC = resolve(DATA, 'hover/package/data/dict.dat')
const CEDICT_GZ = resolve(DATA, 'cedict.txt.gz')
const JIEBA = resolve(DATA, 'jieba/package/submodules/cppjieba/dict/jieba.dict.utf8')

mkdirSync(OUT, { recursive: true })
mkdirSync(PREVIEW, { recursive: true })

// ---------------------------------------------------------------- 拼音
const TONE_MARKS = {
  a: ['ā', 'á', 'ǎ', 'à'], e: ['ē', 'é', 'ě', 'è'], i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'], u: ['ū', 'ú', 'ǔ', 'ù'], v: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

/** "Ni3 hao3" -> { display: "nǐ hǎo", key: "nihao" } */
function formatPinyin(raw) {
  const syllables = raw.trim().split(/\s+/)
  const out = []
  const plain = []
  for (const syl of syllables) {
    const m = /^([A-Za-z:]+)([0-5])?$/.exec(syl)
    if (!m) return null
    let body = m[1].toLowerCase().replace(/u:/g, 'v').replace(/ü/g, 'v')
    const tone = Number(m[2] || 0)
    plain.push(body)
    if (tone >= 1 && tone <= 4) {
      // 标调规则：a/e 优先，ou 标 o，否则标最后一个元音
      let idx = -1
      if (body.includes('a')) idx = body.indexOf('a')
      else if (body.includes('e')) idx = body.indexOf('e')
      else if (body.includes('ou')) idx = body.indexOf('o')
      else {
        for (let i = body.length - 1; i >= 0; i--) {
          if ('aeiou'.includes(body[i])) { idx = i; break }
        }
      }
      if (idx >= 0) {
        const ch = body[idx]
        const marked = TONE_MARKS[ch]?.[tone - 1]
        if (marked) body = body.slice(0, idx) + marked + body.slice(idx + 1)
      }
    }
    out.push(body)
  }
  const display = out.join(' ').replace(/v/g, 'ü')
  const key = plain.join('')
  return { display, key }
}

// ---------------------------------------------------------------- 中文 -> 英文
const cedictText = gunzipSync(readFileSync(CEDICT_GZ)).toString('utf8')
const zhMap = new Map() // 简体 -> { pinyin, glosses:Set }
let cedictLines = 0
for (const line of cedictText.split('\n')) {
  if (!line || line.startsWith('#')) continue
  const m = /^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/\s*$/.exec(line)
  if (!m) continue
  const [, , simp, pinyinRaw, defs] = m
  cedictLines++
  const py = formatPinyin(pinyinRaw)
  if (!py) continue
  const glosses = defs.split('/').map(s => s.trim()).filter(s => s && !s.startsWith('CL:'))
  if (!glosses.length) continue
  const prev = zhMap.get(simp)
  if (prev) {
    for (const g of glosses) prev.glosses.add(g)
  } else {
    zhMap.set(simp, { pinyin: py, glosses: new Set(glosses) })
  }
}
console.log('cedict lines', cedictLines, 'simplified headwords', zhMap.size)

// jieba 词频
const freq = new Map()
for (const line of readFileSync(JIEBA, 'utf8').split('\n')) {
  const sp = line.indexOf(' ')
  if (sp < 0) continue
  const w = line.slice(0, sp)
  const rest = line.slice(sp + 1).split(' ')
  const f = Number(rest[0]) || 0
  if (!w) continue
  if (f > (freq.get(w) || 0)) freq.set(w, f)
}
console.log('jieba words', freq.size)

const isHan = c => c >= '\u4e00' && c <= '\u9fff'
const zhEntries = []
for (const [word, f] of freq) {
  if (word.length < 1 || word.length > 4) continue
  if (![...word].every(isHan)) continue
  const info = zhMap.get(word)
  if (!info) continue
  const glosses = [...info.glosses]
  // 丢弃纯拼音/纯符号/过长释义
  const gloss = glosses.slice(0, 3).join('; ')
  if (!gloss || gloss.length > 90) continue
  zhEntries.push([word, info.pinyin.display, info.pinyin.key, gloss, f])
}
zhEntries.sort((a, b) => b[4] - a[4])
const ZH_LIMIT = Number(process.env.ZH_LIMIT || 14000)
const zhFinal = zhEntries.slice(0, ZH_LIMIT).map(([w, d, k, g]) => [w, d, k, g])

// 首字母缩写索引（nh -> 你好）
const initials = new Map()
for (const [w, , k] of zhFinal) {
  if (w.length < 2) continue
  // 用拼音音节首字母：借助空格分隔的原始 pinyin 不好拿，这里按字符声母近似
  const ini = k
  // 常见做法：取每个汉字拼音的首字母，需要音节切分；简化：用 cedict 的音节数对齐
  const info = zhMap.get(w)
  if (!info) continue
  const syllables = info.pinyin.display.split(' ')
  if (syllables.length !== w.length) continue
  const abbr = syllables.map(s => s[0]).join('')
  if (!initials.has(abbr)) initials.set(abbr, [])
  initials.get(abbr).push(w)
}

// ---------------------------------------------------------------- 英文 -> 中文
const enRaw = JSON.parse(readFileSync(EN_SRC, 'utf8'))
const enMap = {}
let enCount = 0
for (const [word, val] of Object.entries(enRaw)) {
  if (!/^[a-z][a-z'\- ]{0,23}$/.test(word)) continue
  const senses = Array.isArray(val) ? val[0] : null
  if (!Array.isArray(senses) || !senses.length) continue
  const out = []
  for (const s of senses) {
    const pos = (s && s[0]) || ''
    const zh = (s && s[1]) || []
    if (!Array.isArray(zh) || !zh.length) continue
    out.push([pos, zh.slice(0, 5).join('；')])
    if (out.length >= 3) break
  }
  if (!out.length) continue
  const entry = { s: out }
  const FORM_LABEL = { p: '过去式', d: '过去分词', i: '现在分词', '3': '第三人称单数', s: '复数', r: '比较级', t: '最高级' }
  let forms = val[5]
  if (typeof forms === 'string') {
    const list = []
    for (const part of forms.split('/')) {
      const i = part.indexOf(':')
      if (i < 0) continue
      const k = part.slice(0, i)
      const w = part.slice(i + 1)
      if (FORM_LABEL[k] && w) list.push([w, FORM_LABEL[k]])
    }
    forms = list
  }
  if (Array.isArray(forms) && forms.length) {
    const ranked = (val[2] || 0) > 0 && val[2] <= 20000
    if (ranked) entry.f = forms.slice(0, 4)
  }
  const tags = val[1]
  if (tags) entry.t = tags
  const frq = val[2] || 0
  if (frq) entry.r = frq
  enMap[word] = entry
  enCount++
}
console.log('en entries', enCount)

// 精简版：只保留词频最高的 N 个词（EN_LIMIT=0 表示全量）
const EN_LIMIT = Number(process.env.EN_LIMIT || 0)
if (EN_LIMIT > 0 && enCount > EN_LIMIT) {
  const sorted = Object.keys(enMap).sort((a, b) => {
    const ra = enMap[a].r || 999999
    const rb = enMap[b].r || 999999
    return ra - rb || (a < b ? -1 : 1)
  })
  const keep = {}
  for (let i = 0; i < EN_LIMIT; i++) keep[sorted[i]] = enMap[sorted[i]]
  for (const k of Object.keys(enMap)) delete enMap[k]
  Object.assign(enMap, keep)
  console.log('en trimmed to', Object.keys(enMap).length)
}

// ---------------------------------------------------------------- 输出
// 用 JSON.parse(字符串字面量) 而不是直接输出对象字面量：
// 打包器不会对字符串做格式化，产物体积可控，运行时也只解析一次。
function emit(file, payload, note) {
  // 单引号字符串：只需要转义反斜杠和单引号，体积几乎等于 JSON 本身
  const body = payload.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const js = `// 自动生成，勿手改。${note}\nexport default JSON.parse('${body}')\n`
  writeFileSync(resolve(OUT, file), js)
  return js
}

// 展平成「每词一条字符串」，去掉对象/数组开销，运行期只解析命中的那几条
const SEP = '\u0001'
const GSEP = '\u0002'
const enFlat = {}
for (const w of Object.keys(enMap)) {
  const e = enMap[w]
  const senses = e.s.map(function (pair) {
    return pair[0] ? pair[0] + ' ' + pair[1] : pair[1]
  }).join(GSEP)
  const forms = (e.f || []).map(function (pair) {
    return pair[1] + ':' + pair[0]
  }).join(GSEP)
  enFlat[w] = senses + SEP + forms + SEP + (e.t || '')
}
const enPayload = JSON.stringify(enFlat)
const enJs = emit('dict-en.js', enPayload, '数据来源 ECDICT (MIT)。')
writeFileSync(resolve(PREVIEW, 'dict-en.js'), `window.__DICT_EN=${enPayload};\n`)

const zhPayload = JSON.stringify(zhFinal)
const zhJs = emit('dict-zh.js', zhPayload, '数据来源 CC-CEDICT (CC BY-SA 4.0) + jieba 词频。')
writeFileSync(resolve(PREVIEW, 'dict-zh.js'), `window.__DICT_ZH=${zhPayload};\n`)

const iniObj = {}
for (const [k, v] of initials) iniObj[k] = v.slice(0, 12)
writeFileSync(resolve(PREVIEW, 'initials.json'), JSON.stringify(iniObj))

const mb = n => (n / 1048576).toFixed(2) + 'MB'
console.log('dict-en.js', mb(Buffer.byteLength(enJs)))
console.log('dict-zh.js', mb(Buffer.byteLength(zhJs)), 'entries', zhFinal.length)
