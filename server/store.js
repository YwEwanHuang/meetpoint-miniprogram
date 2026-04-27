/**
 * 内存数据存储 + JSON 文件持久化
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'pairs.json');

// 配对数据: Map<pairId, Pair>
const pairs = new Map();

// ---------------------------------------------------------------------------
// Pair 结构
// ---------------------------------------------------------------------------
// {
//   id: string,
//   code: string,          // 6位配对码
//   createdAt: string,     // ISO timestamp
//   expiresAt: string,     // ISO timestamp, 24h后过期
//   users: [
//     { openid, nickname, lat, lng, updatedAt }
//   ]
// }

// ---------------------------------------------------------------------------
// 存储操作
// ---------------------------------------------------------------------------
function size() {
  return pairs.size;
}

function get(id) {
  return pairs.get(id);
}

function getByCode(code) {
  for (const p of pairs.values()) {
    if (p.code === code) return p;
  }
  return null;
}

function findByOpenid(openid) {
  for (const p of pairs.values()) {
    if (p.users.some(u => u.openid === openid)) return p;
  }
  return null;
}

function set(id, pair) {
  pairs.set(id, pair);
}

function deletePair(id) {
  pairs.delete(id);
}

function getAll() {
  return Array.from(pairs.values());
}

// ---------------------------------------------------------------------------
// 用户操作
// ---------------------------------------------------------------------------
function addUser(pairId, openid, nickname) {
  const pair = pairs.get(pairId);
  if (!pair) return null;
  // 避免重复添加
  if (!pair.users.some(u => u.openid === openid)) {
    pair.users.push({ openid, nickname, lat: null, lng: null, updatedAt: null });
  }
  return pair;
}

function updateUserLocation(pairId, openid, lat, lng) {
  const pair = pairs.get(pairId);
  if (!pair) return null;
  const user = pair.users.find(u => u.openid === openid);
  if (user) {
    user.lat = lat;
    user.lng = lng;
    user.updatedAt = new Date().toISOString();
  }
  return pair;
}

// ---------------------------------------------------------------------------
// 持久化
// ---------------------------------------------------------------------------
const SAVE_DEBOUNCE_MS = 2000;
let saveTimer = null;

function save() {
  // 取消pending的保存
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveSync();
  }, SAVE_DEBOUNCE_MS);
}

function saveSync() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = JSON.stringify(Array.from(pairs.entries()), null, 2);
    fs.writeFileSync(DATA_FILE, data, 'utf8');
  } catch (e) {
    console.error('[Store] 保存失败:', e.message);
  }
}

function load() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const arr = JSON.parse(raw);
    for (const [id, pair] of arr) {
      pairs.set(id, pair);
    }
    console.log(`[Store] 已加载 ${pairs.size} 个配对`);
  } catch (e) {
    console.error('[Store] 加载失败:', e.message);
  }
}

function cleanup() {
  const now = new Date().toISOString();
  let count = 0;
  for (const [id, pair] of pairs.entries()) {
    if (pair.expiresAt < now) {
      pairs.delete(id);
      count++;
    }
  }
  if (count > 0) console.log(`[Store] 清理了 ${count} 个过期配对`);
}

module.exports = {
  size, get, getByCode, findByOpenid, set, deletePair, getAll,
  addUser, updateUserLocation, save, saveSync, load, cleanup,
};