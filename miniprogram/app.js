/**
 * 约见 MeetPoint - 小程序入口
 */

App({
  globalData: {
    openid: null,
    nickname: null,
    pairId: null,
    pairCode: null,
    partner: null,

    // 交通偏好
    transportMode: 'driving',

    // 服务器地址
    // 请修改为你的实际服务器地址
    apiBase: 'YOUR_SERVER_API_BASE',

    // 地图 key（需在微信公众平台申请腾讯地图插件）
    qqmapKey: 'YOUR_QQMAP_KEY',
  },

  onLaunch() {
    // 获取持久化用户标识（不存在则生成）
    let openid = wx.getStorageSync('openid');
    if (!openid) {
      openid = 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
      wx.setStorageSync('openid', openid);
    }
    this.globalData.openid = openid;

    // 恢复交通偏好
    const savedMode = wx.getStorageSync('transportMode');
    if (savedMode) {
      this.globalData.transportMode = savedMode;
    }

    // 尝试恢复本地配对状态
    const saved = wx.getStorageSync('pairInfo');
    if (saved) {
      this.globalData.pairId = saved.pairId;
      this.globalData.pairCode = saved.pairCode;
      this.globalData.partner = saved.partner;
    }

    // 获取用户昵称和头像
    wx.getUserInfo({
      lang: 'zh_CN',
      success(res) {
        const app = getApp();
        app.globalData.nickname = res.userInfo.nickName || ('用户' + openid.slice(-4));
        app.globalData.avatar = res.userInfo.avatarUrl;
      },
      fail() {
        getApp().globalData.nickname = '用户' + openid.slice(-4);
      },
    });
  },

  // 刷新配对信息
  refreshPairInfo() {
    if (!this.globalData.pairId) return;
    const self = this;
    wx.request({
      url: `${this.globalData.apiBase}/pair/${this.globalData.pairId}`,
      success(res) {
        if (res.data && res.data.users) {
          const me = res.data.users.find(u => u.openid !== self.globalData.openid);
          self.globalData.partner = me || null;
        }
      },
      fail(err) {
        console.error('刷新配对信息失败:', err);
      },
    });
  },

  // 保存配对信息到本地
  savePairInfo(pairId, pairCode, partner) {
    this.globalData.pairId = pairId;
    this.globalData.pairCode = pairCode;
    this.globalData.partner = partner;
    wx.setStorageSync('pairInfo', { pairId, pairCode, partner });
  },

  // 清除配对信息
  clearPairInfo() {
    this.globalData.pairId = null;
    this.globalData.pairCode = null;
    this.globalData.partner = null;
    wx.removeStorageSync('pairInfo');
  },
});
