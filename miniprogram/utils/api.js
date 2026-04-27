/**
 * 工具函数 - API 调用封装
 */
const app = getApp();

function request(options) {
  return new Promise((resolve, reject) => {
    const requestUrl = app.globalData.apiBase + options.url;

    wx.request({
      url: requestUrl,
      method: options.method || 'GET',
      data: options.data || {},
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          if (!options._skipErrorToast) {
            wx.showToast({ title: res.data?.error || '请求失败', icon: 'none' });
          }
          reject({ statusCode: res.statusCode, data: res.data });
        }
      },
      fail: (err) => {
        if (!options._skipErrorToast) {
          const errMsg = err?.errMsg || '';
          wx.showToast({
            title: errMsg.includes('timeout') ? '请求超时，请检查网络' : '网络错误',
            icon: 'none',
          });
        }
        reject({ type: 'network', errMsg: err?.errMsg });
      },
    });
  });
}

// 配对相关
async function createPair() {
  return request({
    url: '/pair/create',
    method: 'POST',
    data: { openid: app.globalData.openid, nickname: app.globalData.nickname },
  });
}

async function joinPair(code) {
  return request({
    url: '/pair/join',
    method: 'POST',
    _skipErrorToast: true,
    data: { code, openid: app.globalData.openid, nickname: app.globalData.nickname },
  });
}

async function deletePair(pairId) {
  return request({
    url: `/pair/${pairId}?openid=${app.globalData.openid}`,
    method: 'DELETE',
  });
}

async function getPairInfo(pairId) {
  return request({ url: `/pair/${pairId}` });
}

// 位置相关
async function updateLocation(lat, lng) {
  return request({
    url: '/location/update',
    method: 'POST',
    data: { pairId: app.globalData.pairId, openid: app.globalData.openid, lat, lng },
  });
}

async function getLocations(pairId) {
  return request({ url: `/location/${pairId}?openid=${app.globalData.openid}` });
}

// 相遇点计算
async function calculateMeeting(transportMode = 'driving') {
  return request({
    url: '/meeting/calculate',
    method: 'POST',
    data: { pairId: app.globalData.pairId, openid: app.globalData.openid, transportMode },
  });
}

// 通知相关
async function getNotifications(userId, limit = 5) {
  return request({ url: `/notifications?userId=${userId}&limit=${limit}` });
}

// 历史记录
async function getRecords(pairId) {
  return request({ url: `/records/${pairId}` });
}

module.exports = {
  createPair,
  joinPair,
  deletePair,
  getPairInfo,
  updateLocation,
  getLocations,
  calculateMeeting,
  getNotifications,
  getRecords,
};