/**
 * 工具函数 - API 调用封装
 */
const app = getApp();

function request(options) {
  return new Promise((resolve, reject) => {
    const defaultOptions = {
      url: app.globalData.apiBase + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          wx.showToast({ title: res.data?.error || '请求失败', icon: 'none' });
          reject(res);
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      },
    };

    wx.request({ ...defaultOptions, ...options });
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
    data: { code, openid: app.globalData.openid, nickname: app.globalData.nickname },
  });
}

async function deletePair(pairId) {
  return request({
    url: `/pair/${pairId}`,
    method: 'DELETE',
    data: { openid: app.globalData.openid },
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
  return request({ url: `/location/${pairId}` });
}

// 相遇点计算
async function calculateMeeting(transportMode = 'driving') {
  return request({
    url: '/meeting/calculate',
    method: 'POST',
    data: { pairId: app.globalData.pairId, openid: app.globalData.openid, transportMode },
  });
}

module.exports = {
  createPair,
  joinPair,
  deletePair,
  getPairInfo,
  updateLocation,
  getLocations,
  calculateMeeting,
};