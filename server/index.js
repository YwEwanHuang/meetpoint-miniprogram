/**
 * 约见 MeetPoint - 后端服务
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const pairRouter = require('./routes/pair');
const locationRouter = require('./routes/location');
const meetingRouter = require('./routes/meeting');
const recordsRouter = require('./routes/records');
const notificationsRouter = require('./routes/notifications');
const store = require('./store');
const { sendNotification } = require('./notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/pair', pairRouter);
app.use('/api/location', locationRouter);
app.use('/api/meeting', meetingRouter);
app.use('/api/records', recordsRouter);
app.use('/api/notifications', notificationsRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', pairs: store.size() });
});

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`MeetPoint 服务已启动: http://localhost:${PORT}`);
  store.load();
});

// 每 10 分钟清理过期配对
setInterval(() => {
  store.cleanup();
  store.save();
}, 10 * 60 * 1000);

// 每小时检查即将过期的配对并通知
setInterval(() => {
  checkExpiringPairs();
}, 60 * 60 * 1000);

process.on('exit', () => store.saveSync());
process.on('SIGINT', () => {
  store.saveSync();
  process.exit();
});
process.on('SIGTERM', () => {
  store.saveSync();
  process.exit();
});

// ---------------------------------------------------------------------------
// 过期检查
// ---------------------------------------------------------------------------
function checkExpiringPairs() {
  const now = Date.now();
  for (const pair of store.getAll()) {
    const expiresAt = new Date(pair.expiresAt).getTime();
    const hoursLeft = (expiresAt - now) / (1000 * 60 * 60);

    if (hoursLeft > 0 && hoursLeft <= 6) {
      for (const user of pair.users) {
        sendNotification({
          userId: user.openid,
          title: '配对即将过期',
          content: `配对码 ${pair.code} 将在 ${Math.ceil(hoursLeft)} 小时后过期，如需继续使用请重新创建。`,
          type: 'pair_expiring',
          pairId: pair.id,
        });
      }
    }
  }
}