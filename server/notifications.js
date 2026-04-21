/**
 * 推送通知模块
 * 
 * 支持多种推送渠道，当前实现：
 * 1. 本地存储（用于小程序内查询）
 * 2. 微信订阅消息（需要用户授权）
 * 3. Server酱（免费推送，https://sct.ftqq.com/）
 * 
 * 使用方式：
 * - 开发调试：直接打印日志
 * - 生产环境：配置 SERVERCHAN_KEY 即可通过 Server酱推送
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const NOTIF_STORE_FILE = path.join(__dirname, 'data', 'notifications.json');

// ---------------------------------------------------------------------------
// 通知存储（本地文件）
// ---------------------------------------------------------------------------
let notifications = [];

function loadNotifications() {
  try {
    if (fs.existsSync(NOTIF_STORE_FILE)) {
      notifications = JSON.parse(fs.readFileSync(NOTIF_STORE_FILE, 'utf8'));
    }
  } catch (e) {
    notifications = [];
  }
}

function saveNotifications() {
  const dir = path.dirname(NOTIF_STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // 只保留最近 100 条
  const toSave = notifications.slice(-100);
  fs.writeFileSync(NOTIF_STORE_FILE, JSON.stringify(toSave, null, 2));
}

loadNotifications();

// ---------------------------------------------------------------------------
// 推送核心函数
// ---------------------------------------------------------------------------

/**
 * 发送通知
 * @param {Object} opts
 * @param opts.userId      - 用户 openid
 * @param opts.title       - 通知标题
 * @param opts.content     - 通知内容
 * @param opts.type        - 通知类型 (pair_created, location_update, meeting_ready, pair_expiring)
 * @param opts.pairId      - 关联的配对 ID（可选）
 * @param opts.data        - 附加数据（可选）
 */
async function sendNotification(opts) {
  const { userId, title, content, type, pairId, data } = opts;
  const id = 'notif_' + Date.now().toString(36);

  // 1. 本地存储（任何人可查自己的通知）
  const notif = {
    id,
    userId,
    title,
    content,
    type,
    pairId: pairId || null,
    data: data || null,
    createdAt: new Date().toISOString(),
    read: false,
  };
  notifications.push(notif);
  saveNotifications();

  // 2. Server酱推送（如果配置了 KEY）
  if (process.env.SERVERCHAN_KEY && process.env.SERVERCHAN_KEY !== 'YOUR_KEY') {
    await sendViaServerChan(title, content);
  } else {
    console.log(`[Notify] ${title} → ${userId}: ${content}`);
  }

  return notif;
}

/**
 * 通过 Server酱 推送
 */
function sendViaServerChan(title, content) {
  return new Promise((resolve, reject) => {
    const key = process.env.SERVERCHAN_KEY;
    const url = `https://sctapi.ftqq.com/${key}.send`;
    const body = JSON.stringify({
      title: `约见 - ${title}`,
      desp: content,
    });

    const req = https.request(
      {
        method: 'POST',
        hostname: 'sctapi.ftqq.com',
        path: `/${key}.send`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.code === 0) {
              console.log('[Notify] Server酱推送成功');
            } else {
              console.log('[Notify] Server酱推送失败:', json.message);
            }
          } catch (e) {
            // ignore
          }
          resolve();
        });
      }
    );

    req.on('error', (e) => {
      console.log('[Notify] Server酱推送失败:', e.message);
      resolve(); // 不阻塞
    });

    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// 查询通知
// ---------------------------------------------------------------------------

/**
 * 获取用户的所有通知（按时间倒序）
 */
function getNotifications(userId, limit = 20) {
  return notifications
    .filter(n => n.userId === userId)
    .slice(-limit)
    .reverse();
}

/**
 * 标记通知为已读
 */
function markAsRead(notifId, userId) {
  const notif = notifications.find(n => n.id === notifId && n.userId === userId);
  if (notif) {
    notif.read = true;
    saveNotifications();
  }
}

/**
 * 标记所有通知为已读
 */
function markAllAsRead(userId) {
  notifications.forEach(n => {
    if (n.userId === userId) n.read = true;
  });
  saveNotifications();
}

/**
 * 获取未读数
 */
function getUnreadCount(userId) {
  return notifications.filter(n => n.userId === userId && !n.read).length;
}

module.exports = {
  sendNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};