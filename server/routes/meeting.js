/**
 * 相遇点计算 API
 * POST /api/meeting/calculate
 * 
 * 算法：
 * 1. 获取双方位置 A(lat,lng), B(lat,lng)
 * 2. 沿AB连线方向，以固定步长取候选点 C1...Cn
 * 3. 对每个候选点，计算从 A 和 B 以选定交通方式到达的时间
 * 4. 找出 |time_A - time_B| 最小的点，即为相遇点
 * 
 * 腾讯地图 API 文档: https://lbs.qq.com/service/direction/v1/route
 */

const express = require('express');
const router = express.Router();
const store = require('../store');
const { sendNotification } = require('../notifications');

// 腾讯地图 WebService API Key（需替换为实际KEY）
// 申请地址: https://lbs.qq.com/
const QQMAP_KEY = process.env.QQMAP_KEY || 'YOUR_KEY_HERE';

// 交通方式映射到腾讯地图 API 参数
const TRANSPORT_MODE_MAP = {
  driving: 'driving',
  transit: 'transit',
  riding: 'cycling',  // 骑行（自行车/电动车）
  walking: 'walking',
};

const TRANSPORT_LABEL = {
  driving: '驾车',
  transit: '公交/地铁',
  riding: '骑行',
  walking: '步行',
};

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 计算两点间的方位角（从北顺时针，0-360°）
 */
function bearing(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;

  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
          - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);

  const angle = toDeg(Math.atan2(y, x));
  return (angle + 360) % 360;
}

/**
 * 沿方位角移动指定距离（米），返回目标点坐标
 */
function destinationPoint(lat, lng, bearingDeg, distanceM) {
  const R = 6371000; // 地球半径（米）
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;

  const br = toRad(bearingDeg);
  const d = distanceM / R;

  const lat1 = toRad(lat);
  const lng1 = toRad(lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br)
  );

  const lng2 = lng1 + Math.atan2(
    Math.sin(br) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: toDeg(lat2),
    lng: toDeg(lng2),
  };
}

/**
 * 调用腾讯地图 Direction API 获取路线信息
 */
async function getRoute(origin, destination, mode) {
  const qqMode = TRANSPORT_MODE_MAP[mode] || 'driving';
  const url = `https://apis.map.qq.com/direction/v1/${qqMode}?` +
    `key=${QQMAP_KEY}` +
    `&from=${origin.lat},${origin.lng}` +
    `&to=${destination.lat},${destination.lng}` +
    `&output=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.status !== 0 || !data.result || !data.result.routes) {
      return null;
    }

    const route = data.result.routes[0];
    return {
      distance: route.distance,     // 米
      duration: route.duration,     // 秒
      polyline: route.polyline,     // 坐标点串 base64 编码
    };
  } catch (e) {
    console.error('[Meeting] 路线计算失败:', e.message);
    return null;
  }
}

/**
 * 解码腾讯地图 polyline（base64 编码的坐标数组）
 * 返回 [{lat, lng}, ...]
 */
function decodePolyline(polyline) {
  // 腾讯地图 polyline 是经过压缩的 base64 字符串
  // 这里用简化处理：直接解析已知的点串格式
  // 实际生产环境应使用专业的解码库
  try {
    // polyline 是 ; 分隔的 lat,lng 对
    return polyline.split(';').map(p => {
      const [lat, lng] = p.split(',').map(Number);
      return { lat, lng };
    }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
  } catch {
    return [];
  }
}

/**
 * 计算两点间的直线距离（米）
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ---------------------------------------------------------------------------
// POST /api/meeting/calculate
// Body: { pairId, openid, transportMode }
// ---------------------------------------------------------------------------
router.post('/calculate', async (req, res) => {
  const { pairId, openid, transportMode = 'driving' } = req.body;

  if (!pairId || !openid) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const pair = store.get(pairId);
  if (!pair) {
    return res.status(404).json({ error: '配对不存在' });
  }

  const me = pair.users.find(u => u.openid === openid);
  const partner = pair.users.find(u => u.openid !== openid);

  if (!me || !partner) {
    return res.status(404).json({ error: '用户不在配对中' });
  }

  if (me.lat == null || me.lng == null) {
    return res.status(400).json({ error: '我的位置未知，请先上报位置' });
  }
  if (partner.lat == null || partner.lng == null) {
    return res.status(400).json({ error: '对方位置未知，请等待对方上报' });
  }

  const myLoc = { lat: me.lat, lng: me.lng };
  const partnerLoc = { lat: partner.lat, lng: partner.lng };

  // 如果两点太近（<500m），直接返回中点
  const dist = haversineDistance(myLoc.lat, myLoc.lng, partnerLoc.lat, partnerLoc.lng);
  if (dist < 500) {
    const midLat = (myLoc.lat + partnerLoc.lat) / 2;
    const midLng = (myLoc.lng + partnerLoc.lng) / 2;
    return res.json({
      meetingPoint: { lat: midLat, lng: midLng },
      distance: dist,
      timeFromMe: 0,
      timeFromPartner: 0,
      note: '双方距离很近，直接选中间位置',
    });
  }

  // 计算 AB 连线方位角
  const ab = bearing(myLoc.lat, myLoc.lng, partnerLoc.lat, partnerLoc.lng);
  const ba = (ab + 180) % 360;

  // 从 A 到 B 方向，以固定步长取候选点
  // 步长：总距离的 10%，最多取 20 个候选点
  const STEP_COUNT = 20;
  const stepDist = dist / STEP_COUNT;

  let bestPoint = null;
  let bestTimeDiff = Infinity;
  let bestRouteA = null;
  let bestRouteB = null;

  // 候选点序列：从 A 往 B 方向
  const candidates = [];
  for (let i = 1; i < STEP_COUNT; i++) {
    const d = stepDist * i;
    const pt = destinationPoint(myLoc.lat, myLoc.lng, ab, d);
    candidates.push(pt);
  }

  // 限制并发：每次最多同时算 5 条路线
  const BATCH = 5;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);

    const results = await Promise.all(
      batch.map(async (candidate) => {
        const [routeA, routeB] = await Promise.all([
          getRoute(myLoc, candidate, transportMode),
          getRoute(candidate, partnerLoc, transportMode),
        ]);
        return { candidate, routeA, routeB };
      })
    );

    for (const { candidate, routeA, routeB } of results) {
      if (!routeA || !routeB) continue;

      const timeDiff = Math.abs(routeA.duration - routeB.duration);
      if (timeDiff < bestTimeDiff) {
        bestTimeDiff = timeDiff;
        bestPoint = candidate;
        bestRouteA = routeA;
        bestRouteB = routeB;
      }
    }
  }

  if (!bestPoint) {
    return res.status(500).json({ error: '无法找到合适的相遇点（路线服务不可用）' });
  }

  // 同时创建历史记录
  if (pair.records) {
    // (record creation happens in the success response)
  }

  // 通知对方相遇点已计算
  if (partner) {
    sendNotification({
      userId: partner.openid,
      title: '相遇点已计算',
      content: `你们在 ${TRANSPORT_LABEL[transportMode]} 模式下，相遇点距你约 ${Math.round(bestRouteA.duration/60)} 分钟，距对方约 ${Math.round(bestRouteB.duration/60)} 分钟。`,
      type: 'meeting_ready',
      pairId,
      data: {
        meetingPoint: { lat: bestPoint.lat, lng: bestPoint.lng },
        timeFromMe: Math.round(bestRouteA.duration / 60),
        timeFromPartner: Math.round(bestRouteB.duration / 60),
      },
    });
  }

  res.json({
    meetingPoint: {
      lat: bestPoint.lat,
      lng: bestPoint.lng,
    },
    timeFromMe: Math.round(bestRouteA.duration / 60),
    timeFromPartner: Math.round(bestRouteB.duration / 60),
    timeDiff: Math.round(bestTimeDiff / 60),
    distance: Math.round(dist),
    routeFromMe: {
      distance: bestRouteA.distance,
      duration: bestRouteA.duration,
      polyline: decodePolyline(bestRouteA.polyline),
    },
    routeFromPartner: {
      distance: bestRouteB.distance,
      duration: bestRouteB.duration,
      polyline: decodePolyline(bestRouteB.polyline),
    },
    transportMode,
    transportLabel: TRANSPORT_LABEL[transportMode] || transportMode,
  });
});

module.exports = router;