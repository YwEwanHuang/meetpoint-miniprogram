/**
 * 位置上报 API
 * POST /api/location/update
 */

const express = require('express');
const router = express.Router();
const store = require('../store');

// ---------------------------------------------------------------------------
// POST /api/location/update
// Body: { pairId, openid, lat, lng }
// ---------------------------------------------------------------------------
router.post('/update', (req, res) => {
  const { pairId, openid, lat, lng } = req.body;

  if (!pairId || !openid || lat == null || lng == null) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const pair = store.get(pairId);
  if (!pair) {
    return res.status(404).json({ error: '配对不存在' });
  }

  if (!pair.users.some(u => u.openid === openid)) {
    return res.status(403).json({ error: '不在该配对中' });
  }

  store.updateUserLocation(pairId, openid, lat, lng);
  store.save();

  res.json({ success: true, updatedAt: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// GET /api/location/:pairId?openid=xxx
// 获取配对双方当前位置（需验证属于该配对）
// ---------------------------------------------------------------------------
router.get('/:pairId', (req, res) => {
  const pair = store.get(req.params.pairId);
  if (!pair) return res.status(404).json({ error: '配对不存在' });

  const { openid } = req.query;
  if (!openid || !pair.users.some(u => u.openid === openid)) {
    return res.status(403).json({ error: '无权访问该配对位置' });
  }

  res.json({
    users: pair.users.map(u => ({
      openid: u.openid,
      nickname: u.nickname,
      lat: u.lat,
      lng: u.lng,
      updatedAt: u.updatedAt,
    })),
  });
});

module.exports = router;