/**
 * 历史记录 API
 * GET  /api/records/:pairId
 * POST /api/records
 * PUT  /api/records/:id
 * DELETE /api/records/:id
 */

const express = require('express');
const router = express.Router();
const store = require('../store');

const TRANSPORT_LABELS = {
  driving: '驾车',
  transit: '公交/地铁',
  riding: '骑行',
  walking: '步行',
};

function makeRecordId() {
  return 'record_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function enrichRecord(record) {
  return {
    ...record,
    transportModeText: TRANSPORT_LABELS[record.transportMode] || record.transportMode,
    distanceText: record.distance > 1000
      ? `${(record.distance / 1000).toFixed(1)}公里`
      : `${record.distance}米`,
    timeDiff: Math.abs((record.timeFromMe || 0) - (record.timeFromPartner || 0)),
    statusText: {
      scheduled: '待赴约',
      completed: '已完成',
      cancelled: '已取消',
    }[record.status] || record.status,
  };
}

// ---------------------------------------------------------------------------
// GET /api/records/:pairId
// ---------------------------------------------------------------------------
router.get('/:pairId', (req, res) => {
  const { pairId } = req.params;
  const pair = store.get(pairId);
  if (!pair) return res.status(404).json({ error: '配对不存在' });

  const records = (pair.records || []).map(enrichRecord).reverse();
  res.json({ records });
});

// ---------------------------------------------------------------------------
// POST /api/records
// Body: { pairId, meetingPoint, transportMode, timeFromMe, timeFromPartner, distance }
// ---------------------------------------------------------------------------
router.post('/', (req, res) => {
  const { pairId, meetingPoint, transportMode, timeFromMe, timeFromPartner, distance } = req.body;

  if (!pairId) return res.status(400).json({ error: '缺少 pairId' });

  const pair = store.get(pairId);
  if (!pair) return res.status(404).json({ error: '配对不存在' });

  if (!pair.records) pair.records = [];

  const record = {
    id: makeRecordId(),
    pairId,
    createdAt: new Date().toISOString(),
    meetingPoint: meetingPoint || { lat: 0, lng: 0 },
    transportMode: transportMode || 'driving',
    timeFromMe: timeFromMe || 0,
    timeFromPartner: timeFromPartner || 0,
    distance: distance || 0,
    status: 'scheduled',
  };

  pair.records.push(record);
  store.save();

  res.json({ record: enrichRecord(record) });
});

// ---------------------------------------------------------------------------
// PUT /api/records/:id
// Body: { status } 或 { actualMeetingTime }
// ---------------------------------------------------------------------------
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { status, actualMeetingTime } = req.body;

  for (const pair of store.getAll()) {
    if (!pair.records) continue;
    const record = pair.records.find(r => r.id === id);
    if (record) {
      if (status) record.status = status;
      if (actualMeetingTime) record.actualMeetingTime = actualMeetingTime;
      store.save();
      return res.json({ record: enrichRecord(record) });
    }
  }

  res.status(404).json({ error: '记录不存在' });
});

// ---------------------------------------------------------------------------
// DELETE /api/records/:id
// ---------------------------------------------------------------------------
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  for (const pair of store.getAll()) {
    if (!pair.records) continue;
    const idx = pair.records.findIndex(r => r.id === id);
    if (idx !== -1) {
      pair.records.splice(idx, 1);
      store.save();
      return res.json({ success: true });
    }
  }

  res.status(404).json({ error: '记录不存在' });
});

module.exports = router;