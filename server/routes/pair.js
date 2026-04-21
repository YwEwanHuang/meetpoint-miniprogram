/**
 * 配对相关 API
 * POST /api/pair/create  - 创建配对
 * POST /api/pair/join    - 加入配对
 * DELETE /api/pair/:id   - 解除配对
 * GET  /api/pair/code/:code - 验证配对码
 */

const express = require('express');
const router = express.Router();
const store = require('../store');
const { sendNotification } = require('../notifications');

// 生成6位配对码（去掉了I,O,0,1等易混淆字符）
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

function makeId() {
  return 'pair_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// ---------------------------------------------------------------------------
// POST /api/pair/create
// Body: { openid, nickname }
// ---------------------------------------------------------------------------
router.post('/create', (req, res) => {
  const { openid, nickname } = req.body;
  if (!openid || !nickname) {
    return res.status(400).json({ error: '缺少 openid 或 nickname' });
  }

  // 检查是否已在配对中
  const existing = store.findByOpenid(openid);
  if (existing) {
    return res.status(409).json({ error: '已在配对中', pairId: existing.id });
  }

  // 生成唯一配对码（最多试10次避免冲突）
  let code, pair;
  for (let attempt = 0; attempt < 10; attempt++) {
    code = generateCode();
    if (!store.getByCode(code)) break;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  pair = {
    id: makeId(),
    code,
    createdAt: now.toISOString(),
    expiresAt,
    users: [{ openid, nickname, lat: null, lng: null, updatedAt: null }],
  };

  store.set(pair.id, pair);
  store.save();

  sendNotification({
    userId: openid,
    title: '配对已创建',
    content: `你的配对码是 ${pair.code}，分享给朋友即可开始位置共享。`,
    type: 'pair_created',
    pairId: pair.id,
  });

  res.json({ pairId: pair.id, code: pair.code, expiresAt });
});

// ---------------------------------------------------------------------------
// POST /api/pair/join
// Body: { code, openid, nickname }
// ---------------------------------------------------------------------------
router.post('/join', (req, res) => {
  const { code, openid, nickname } = req.body;
  if (!code || !openid || !nickname) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const pair = store.getByCode(code);
  if (!pair) {
    return res.status(404).json({ error: '配对码无效或已过期' });
  }

  if (new Date(pair.expiresAt) < new Date()) {
    store.deletePair(pair.id);
    return res.status(410).json({ error: '配对码已过期，请重新创建' });
  }

  if (pair.users.length >= 2) {
    return res.status(409).json({ error: '配对已满（2人）' });
  }

  if (pair.users.some(u => u.openid === openid)) {
    return res.status(409).json({ error: '你已在该配对中' });
  }

  // 检查加入者是否已在其他配对
  const existing = store.findByOpenid(openid);
  if (existing) {
    return res.status(409).json({ error: '已在其他配对中，请先解除' });
  }

  store.addUser(pair.id, openid, nickname);
  store.save();

  // 通知对方
  const partner = pair.users.find(u => u.openid !== openid);
  if (partner) {
    sendNotification({
      userId: partner.openid,
      title: '配对成功',
      content: `${nickname || '有人'}已加入配对，你们可以开始共享位置了。`,
      type: 'pair_joined',
      pairId: pair.id,
    });
  }

  res.json({
    pairId: pair.id,
    partner: pair.users.find(u => u.openid !== openid),
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/pair/:id
// ---------------------------------------------------------------------------
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const { openid } = req.body;

  const pair = store.get(id);
  if (!pair) {
    return res.status(404).json({ error: '配对不存在' });
  }

  if (!pair.users.some(u => u.openid === openid)) {
    return res.status(403).json({ error: '无权操作' });
  }

  store.deletePair(id);
  store.save();
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/pair/:id
// ---------------------------------------------------------------------------
router.get('/:id', (req, res) => {
  const pair = store.get(req.params.id);
  if (!pair) return res.status(404).json({ error: '配对不存在' });
  res.json(pair);
});

module.exports = router;