// 本地存储：最近查询 + 收藏。都只存渲染快照，避免详情页再依赖词典数据。
import storage from '@system.storage'

const K_HISTORY = 'dict_history'
const K_FAV = 'dict_favorites'
const K_CURRENT = 'dict_current'

let cache = { history: null, favorites: null, current: null }

function read(key, fallback, cb) {
  storage.get({
    key,
    success(data) {
      let v = fallback
      try {
        v = data ? JSON.parse(data) : fallback
      } catch (e) {
        v = fallback
      }
      cb(v)
    },
    fail() {
      cb(fallback)
    }
  })
}

function write(key, value) {
  storage.set({ key, value: JSON.stringify(value) })
}

function getHistory(cb) {
  if (cache.history) return cb(cache.history)
  read(K_HISTORY, [], list => {
    cache.history = list
    cb(list)
  })
}

function addHistory(item) {
  getHistory(list => {
    const next = [item].concat(list.filter(x => !(x.w === item.w && x.m === item.m))).slice(0, 20)
    cache.history = next
    write(K_HISTORY, next)
  })
}

function getFavorites(cb) {
  if (cache.favorites) return cb(cache.favorites)
  read(K_FAV, [], list => {
    cache.favorites = list
    cb(list)
  })
}

function isFavorite(mode, w) {
  return (cache.favorites || []).some(x => x.w === w && x.m === mode)
}

function toggleFavorite(item, cb) {
  getFavorites(list => {
    const exists = list.some(x => x.w === item.w && x.m === item.m)
    const next = exists ? list.filter(x => !(x.w === item.w && x.m === item.m)) : [item].concat(list)
    cache.favorites = next
    write(K_FAV, next)
    if (cb) cb(!exists)
  })
}

// 路由传参在部分 Vela 版本上不可靠，这里用存储兜底传当前词条
function setCurrent(item) {
  cache.current = item
  write(K_CURRENT, item)
}

function getCurrent(cb) {
  if (cache.current) return cb(cache.current)
  read(K_CURRENT, null, v => {
    cache.current = v
    cb(v)
  })
}

export default {
  getHistory,
  addHistory,
  getFavorites,
  isFavorite,
  toggleFavorite,
  setCurrent,
  getCurrent
}
