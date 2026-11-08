/* 腕上词典 · 浏览器预览（与 Vela 页面同布局同逻辑） */
const app = document.getElementById('app')
const params = new URLSearchParams(location.search)
if (params.get('shot')) document.body.classList.add('shot')

const state = {
  screen: params.get('s') || 'home',
  query: params.get('q') || '',
  kb: true,
  payload: null,
  items: [],
  listType: 'fav'
}

let EN = null
let ZH = null
let ZH_INDEX = null

const HOT_EN = ['hello', 'time', 'water', 'love', 'apple', 'happy', 'run', 'book']
const HOT_ZH = ['nihao', 'xiexie', 'zaijian', 'duoshao', 'shijian', 'chifan']
const TAG_TEXT = { zk: '中考', gk: '高考', cet4: '四级', cet6: '六级', ky: '考研', toefl: '托福', ielts: '雅思', gre: 'GRE' }

/* ---------- 存储 ---------- */
const store = {
  get(k, f) {
    try { return JSON.parse(localStorage.getItem(k)) || f } catch (e) { return f }
  },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)) }
}
const getHistory = () => store.get('hist', [])
const getFavs = () => store.get('fav', [])
function addHistory(item) {
  store.set('hist', [item, ...getHistory().filter(x => !(x.w === item.w && x.m === item.m))].slice(0, 20))
}
function toggleFav(item) {
  const list = getFavs()
  const has = list.some(x => x.w === item.w && x.m === item.m)
  store.set('fav', has ? list.filter(x => !(x.w === item.w && x.m === item.m)) : [item, ...list])
  return !has
}

/* ---------- 检索 ---------- */
const RANK_MAX = 100000
const SEP = '\u0001'
const GSEP = '\u0002'

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
  const s = []
  const senseStr = parts[0] || ''
  if (senseStr) {
    for (const g of senseStr.split(GSEP)) {
      const sp = g.indexOf(' ')
      if (sp > 0 && sp < 6) s.push([g.slice(0, sp), g.slice(sp + 1)])
      else s.push(['', g])
    }
  }
  const fl = []
  const formStr = parts[1] || ''
  if (formStr) {
    for (const p of formStr.split(GSEP)) {
      const c = p.indexOf(':')
      if (c > 0) fl.push([p.slice(c + 1), p.slice(0, c)])
    }
  }
  return { s, f: fl, t: parts[2] || '' }
}
function searchEn(qraw) {
  const q = (qraw || '').trim().toLowerCase()
  if (!q || !EN) return []
  const out = []
  const seen = new Set()
  const push = w => { if (!seen.has(w)) { seen.add(w); out.push(w) } }
  if (EN[q]) push(q)
  const pref = [], inner = []
  for (const w of Object.keys(EN)) {
    if (w === q) continue
    if (w.indexOf(q) === 0) pref.push(w)
    else if (q.length >= 3 && w.indexOf(q) > 0 && inner.length < 60) inner.push(w)
  }
  const rank = w => (EN[w] && EN[w].r) || RANK_MAX
  const cmp = (a, b) => rank(a) - rank(b) || a.length - b.length || (a < b ? -1 : 1)
  pref.sort(cmp); inner.sort(cmp)
  for (const w of pref) { if (out.length >= 40) break; push(w) }
  for (const w of inner) { if (out.length >= 40) break; push(w) }
  return out.map(w => ({ w, b: enBrief(EN[w]) }))
}
function searchZh(qraw) {
  const q = (qraw || '').toLowerCase().replace(/[^a-z]/g, '')
  if (!q || !ZH_INDEX) return []
  const exact = [], pref = [], abbr = []
  for (const it of ZH_INDEX) {
    if (it.key === q || it.alt === q) exact.push(it)
    else if (it.key.indexOf(q) === 0 || it.alt.indexOf(q) === 0) pref.push(it)
    else if (it.abbr && it.abbr.indexOf(q) === 0) abbr.push(it)
  }
  const byLen = (a, b) => a.w.length - b.w.length || a.i - b.i
  pref.sort(byLen); abbr.sort(byLen)
  const seen = new Set(), res = []
  for (const it of [...exact, ...pref, ...abbr]) {
    if (res.length >= 40) break
    if (seen.has(it.w)) continue
    seen.add(it.w); res.push(it)
  }
  return res
}

/* ---------- 键盘 ---------- */
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')
function keyboardHTML(mode) {
  const rows = []
  for (let r = 0; r < 4; r++) rows.push(LETTERS.slice(r * 6, r * 6 + 6).map(c => ({ l: c, v: c })))
  const fn = (mode === 'en'
    ? [['y', 'y'], ['z', 'z'], ['删', 'del'], ['空格', 'space'], ['清空', 'clear'], ['收起', 'hide']]
    : [['y', 'y'], ['z', 'z'], ['删', 'del'], ['清空', 'clear'], ['收起', 'hide'], ['返回', 'back']]
  ).map(([l, v]) => ({ l, v }))
  rows.push(fn)
  return `<div class="kb">${rows.map(row => `<div class="kb-row">${row.map(({ l, v }) => {
    const isFn = v.length > 1
    return `<div class="key ${isFn ? 'fn' : ''}" data-k="${v}"><span>${l}</span></div>`
  }).join('')}</div>`).join('')}</div>`
}

/* ---------- 页面 ---------- */
function head(title, count, back) {
  return `<div class="head"><div class="back" data-act="back">‹</div><div class="title">${title}</div><div class="count">${count || ''}</div></div>`
}

function renderHome() {
  const recent = getHistory().slice(0, 6)
  return `<div class="page home">
    <div class="top">
      <div class="brand-block"><div class="brand">腕上词典</div><div class="sub">离线 · 英汉双向</div></div>
      <div class="about-btn" data-act="go-about">关于</div>
    </div>
    <div class="card card-en" data-act="go-en">
      <div class="card-icon icon-en"><span class="icon-txt">A</span></div>
      <div class="card-body"><div class="card-title">英 → 中</div><div class="card-desc">输入英文单词，查中文释义</div></div>
      <div class="chev">›</div>
    </div>
    <div class="card card-zh" data-act="go-zh">
      <div class="card-icon icon-zh"><span class="icon-txt">中</span></div>
      <div class="card-body"><div class="card-title">中 → 英</div><div class="card-desc">打拼音，选中文字看英文</div></div>
      <div class="chev">›</div>
    </div>
    <div class="recent-head"><div class="recent-title">最近查询</div><div class="recent-more" data-act="go-fav">收藏 ›</div></div>
    <div class="recent">${recent.length ? recent.map((it, i) => `
      <div class="row-item" data-act="open-hist" data-i="${i}">
        <div class="main"><div class="row-word">${esc(it.w)}</div><div class="row-brief">${esc(it.b || '')}</div></div>
        <div class="row-mode">${it.m === 'en' ? 'EN' : '中'}</div>
      </div>`).join('') : '<div class="empty">还没有查询记录</div>'}</div>
    <div class="foot">20,475 英汉词条 · 14,000 汉英词条 · 完全离线</div>
  </div>`
}

function renderSearch(mode) {
  const isEn = mode === 'en'
  const q = state.query
  const results = isEn ? searchEn(q) : searchZh(q)
  const hot = isEn ? HOT_EN : HOT_ZH
  let body
  if (!q) {
    body = `<div class="hint"><div class="hint-title">试试这些</div><div class="chips">${hot.map(w => `<div class="chip" data-act="pick" data-w="${w}">${w}</div>`).join('')}</div></div>`
  } else if (results.length === 0) {
    body = `<div class="empty2"><div class="t">${isEn ? '没有找到' : '没有匹配'} “${esc(q)}”</div><div class="s">${isEn ? '试试更短的词根，或检查拼写' : '只支持拼音全拼，例如 nihao'}</div></div>`
  } else if (isEn) {
    body = results.map(r => `<div class="row" data-act="open-en" data-w="${r.w}"><div class="rw">${esc(r.w)}</div><div class="rb">${esc(r.b)}</div></div>`).join('')
  } else {
    body = results.map(r => `<div class="row" data-act="open-zh" data-w="${r.w}"><div class="row-top"><span class="zh">${esc(r.w)}</span><span class="py">${esc(r.py)}</span></div><div class="rb">${esc(r.gloss)}</div></div>`).join('')
  }
  return `<div class="page">
    ${head(isEn ? '英 → 中' : '中 → 英', results.length && q ? results.length + ' 条' : '', true)}
    <div class="search" data-act="focus">
      <div class="qwrap">${q ? `<span class="q">${esc(q)}</span>` : `<span class="q ph">${isEn ? '输入英文单词' : '输入拼音，如 nihao'}</span>`}${state.kb ? '<span class="caret">|</span>' : ''}</div>
      ${q ? '<div class="clear" data-act="clear">✕</div>' : ''}
    </div>
    <div class="list">${body}</div>
    ${state.kb ? keyboardHTML(mode) : ''}
  </div>`
}

function renderDetail() {
  const p = state.payload
  if (!p) return renderHome()
  const isEn = p.m === 'en'
  const tags = (p.t || '').split(' ').filter(x => TAG_TEXT[x]).map(x => TAG_TEXT[x])
  const starred = getFavs().some(x => x.w === p.w && x.m === p.m)
  const senses = isEn ? (p.s || []).map(s => `
    <div class="sense"><div class="pos">${esc(s[0] || '')}</div><div class="mean">${esc(s[1] || '')}</div></div>`).join('') : ''
  const forms = isEn && p.f && p.f.length ? `<div class="forms"><div class="forms-title">词形变化</div>${p.f.map(f => `<div class="form-row"><div class="form-label">${esc(f[1])}</div><div class="form-value">${esc(f[0])}</div></div>`).join('')}</div>` : ''
  return `<div class="page detail">
    <div class="head"><div class="back" data-act="back">‹</div><div class="title" style="font-size:18px;color:#8e8e93">${isEn ? '英 → 中' : '中 → 英'}</div><div class="star ${starred ? 'on' : ''}" data-act="star">${starred ? '★' : '☆'}</div></div>
    <div class="body">
      <div class="word-block">
        <div class="word">${esc(p.w)}</div>
        ${!isEn ? `<div class="py-line">${esc(p.py || '')}</div>` : ''}
        ${tags.length ? `<div class="tags">${tags.map(t => `<div class="tag">${t}</div>`).join('')}</div>` : ''}
      </div>
      ${!isEn ? `<div class="gloss-block"><div class="gloss">${esc(p.g || '')}</div></div>` : ''}
      ${isEn ? `<div class="senses">${senses}</div>` : ''}
      ${forms}
      <div class="src">离线数据 · ECDICT / CC-CEDICT</div>
      <div class="pad"></div>
    </div>
  </div>`
}

function renderList() {
  const isFav = state.listType === 'fav'
  const items = isFav ? getFavs() : getHistory()
  return `<div class="page">
    ${head(isFav ? '收藏' : '最近查询', items.length ? items.length + ' 条' : '', true)}
    <div class="list">${items.length ? items.map((it, i) => `
      <div class="row-item" data-act="open-list" data-i="${i}">
        <div class="main"><div class="row-word">${esc(it.w)}</div><div class="row-brief">${esc(it.b || '')}</div></div>
        <div class="row-mode">${it.m === 'en' ? 'EN' : '中'}</div>
      </div>`).join('') : `<div class="empty2"><div class="t">${isFav ? '还没有收藏' : '还没有记录'}</div><div class="s">${isFav ? '在词条页点右上角 ☆ 收藏' : '查过的词会出现在这里'}</div></div>`}</div>
  </div>`
}

function renderAbout() {
  return `<div class="page">
    ${head('关于', '', true)}
    <div class="body about-body">
      <div class="hero">
        <img class="logo" src="../src/common/logo.png" alt="logo" />
        <div class="name">腕上词典</div>
        <div class="ver">版本 1.0.0</div>
        <div class="slogan">离线英汉 · 汉英双向词典</div>
      </div>
      <div class="info"><div class="ik">制作人</div><div class="iv strong">Xinglan Deepseek Harness</div></div>
      <div class="info"><div class="ik">词条规模</div><div class="iv">20,475 英汉 · 14,000 汉英</div></div>
      <div class="info"><div class="ik">数据来源</div><div class="iv">ECDICT · CC-CEDICT · jieba</div></div>
      <div class="info"><div class="ik">运行方式</div><div class="iv">完全离线，不联网</div></div>
      <div class="note">为小米手环 10 Pro 开发 · Vela 快应用</div>
    </div>
  </div>`
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function render() {
  if (state.screen === 'home') app.innerHTML = renderHome()
  else if (state.screen === 'en') app.innerHTML = renderSearch('en')
  else if (state.screen === 'zh') app.innerHTML = renderSearch('zh')
  else if (state.screen === 'detail') app.innerHTML = renderDetail()
  else if (state.screen === 'list') app.innerHTML = renderList()
  else if (state.screen === 'about') app.innerHTML = renderAbout()
}

/* ---------- 交互 ---------- */
app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]')
  if (!el) return
  const act = el.dataset.act
  if (act === 'go-en') { state.screen = 'en'; state.query = ''; state.kb = true; return render() }
  if (act === 'go-zh') { state.screen = 'zh'; state.query = ''; state.kb = true; return render() }
  if (act === 'go-fav') { state.screen = 'list'; state.listType = 'fav'; return render() }
  if (act === 'go-about') { state.screen = 'about'; return render() }
  if (act === 'back') { state.screen = 'home'; return render() }
  if (act === 'focus') { state.kb = true; return render() }
  if (act === 'clear') { state.query = ''; return render() }
  if (act === 'pick') { state.query = el.dataset.w; return render() }
  if (act === 'open-en') {
    const w = el.dataset.w, raw = EN[w] || ''
    const parsed = parseEn(raw)
    state.payload = { w, m: 'en', s: parsed.s, f: parsed.f, t: parsed.t }
    addHistory({ w, b: enBrief(raw), m: 'en', p: state.payload })
    state.screen = 'detail'; return render()
  }
  if (act === 'open-zh') {
    const w = el.dataset.w
    const item = searchZh(state.query).find(x => x.w === w) || { w, py: '', gloss: '' }
    state.payload = { w, m: 'zh', py: item.py, g: item.gloss }
    addHistory({ w, b: item.gloss, m: 'zh', p: state.payload })
    state.screen = 'detail'; return render()
  }
  if (act === 'star') {
    const p = state.payload
    const brief = p.m === 'en' ? (p.s && p.s[0] ? p.s[0][1] : '') : p.g
    toggleFav({ w: p.w, b: brief, m: p.m, p }); return render()
  }
  if (act === 'open-hist' || act === 'open-list') {
    const i = Number(el.dataset.i)
    const list = act === 'open-hist' ? getHistory() : (state.listType === 'fav' ? getFavs() : getHistory())
    if (list[i] && list[i].p) { state.payload = list[i].p; state.screen = 'detail'; return render() }
  }
  if (act === 'key') return
})

app.addEventListener('click', e => {
  const key = e.target.closest('[data-k]')
  if (!key) return
  const v = key.dataset.k
  if (v === 'del') state.query = state.query.slice(0, -1)
  else if (v === 'clear') state.query = ''
  else if (v === 'space') state.query += ' '
  else if (v === 'hide') state.kb = false
  else if (v === 'back') { state.screen = 'home' }
  else state.query += v
  render()
})

/* ---------- 启动 ---------- */
async function boot() {
  EN = window.__DICT_EN
  ZH = window.__DICT_ZH
  ZH_INDEX = ZH.map((r, i) => {
    const word = r[0], py = r[1], key = r[2], gloss = r[3]
    const syl = py.split(' ')
    const initialOf = s => (s.indexOf('zh') === 0 || s.indexOf('ch') === 0 || s.indexOf('sh') === 0) ? s.slice(0, 2) : s.charAt(0)
    const abbr = syl.length === word.length ? syl.map(initialOf).join('') : ''
    return { w: word, py, key, alt: key.replace(/v/g, 'u'), gloss, abbr, i }
  })
  // 截图/直达：?s=detail&w=apple&m=en / ?s=en&q=hel
  const w = params.get('w')
  if (state.screen === 'detail' && w) {
    const m = params.get('m') || 'en'
    if (m === 'en') {
      const parsed = parseEn(EN[w] || '')
      state.payload = { w, m: 'en', s: parsed.s, f: parsed.f, t: parsed.t }
    } else {
      const item = ZH_INDEX.find(x => x.w === w) || { py: '', gloss: '' }
      state.payload = { w, m: 'zh', py: item.py, g: item.gloss }
    }
  }
  if (state.screen === 'list') state.listType = params.get('t') || 'fav'
  render()
}
boot()
