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
    apiBase: 'https://meetpoint.ewanandalina.top/api',

    // 地图 key（需在微信公众平台申请腾讯地图插件）
    qqmapKey: '', // 请替换为你的腾讯位置服务 Key（https://lbs.qq.com/）
  },

  onLaunch() {
    // 获取用户信息（新版，已废弃 wx.getUserProfile）
    wx.getUserInfo({
      lang: 'zh_CN',
      success(res) {
        getApp().globalData.nickname = res.userInfo.nickName;
        getApp().globalData.avatar = res.userInfo.avatarUrl;
      },
      fail(err) {
        console.warn('获取用户信息失败:', err);
      },
    });

    // 获取 openid
    wx.login({
      success(res) {
        if (res.code) {
          // 简化处理：直接用 code 作为 openid 标识
          getApp().globalData.openid = 'openid_' + res.code;
        }
      },
      fail(err) {
        console.error('wx.login 失败:', err);
      },
    });

    // 尝试恢复本地配对状态
    const saved = wx.getStorageSync('pairInfo');
    if (saved) {
      this.globalData.pairId = saved.pairId;
      this.globalData.pairCode = saved.pairCode;
      this.globalData.partner = saved.partner;
    }
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
