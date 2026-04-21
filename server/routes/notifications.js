/**
 * 通知相关 API
 * GET  /api/notifications      - 获取我的通知
 * PUT  /api/notifications/read - 标记已读
 */

const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead, getUnreadCount } = require('../notifications');

// ---------------------------------------------------------------------------
// GET /api/notifications?userId=xxx&limit=20
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const { userId, limit } = req.query;
  if (!userId) return res.status(400).json({ error: '缺少 userId' });

  const notifications = getNotifications(userId, parseInt(limit) || 20);
  const unreadCount = getUnreadCount(userId);

  res.json({ notifications, unreadCount });
});

// ---------------------------------------------------------------------------
// PUT /api/notifications/read
// Body: { userId, notifId? }  不传 notifId 则全部已读
// ---------------------------------------------------------------------------
router.put('/read', (req, res) => {
  const { userId, notifId } = req.body;
  if (!userId) return res.status(400).json({ error: '缺少 userId' });

  if (notifId) {
    markAsRead(notifId, userId);
  } else {
    markAllAsRead(userId);
  }

  res.json({ success: true });
});

module.exports = router;