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

    // 服务器地址（开发时用局域网IP，生产时换成实际域名）
    // 请修改为你的实际服务器地址
    apiBase: 'http://192.168.1.100:3000/api',

    // 地图 key（需在微信公众平台申请腾讯地图插件）
    qqmapKey: 'YOUR_QQMAP_KEY',
  },

  onLaunch() {
    // 获取登录态
    const self = this;
    wx.getUserProfile({
      desc: '用于配对和位置共享',
      success(res) {
        self.globalData.nickname = res.userInfo.nickName;
        self.globalData.avatar = res.userInfo.avatarUrl;
      },
    });

    // 获取 openid（生产环境应通过后端接口获取）
    wx.login({
      success(res) {
        if (res.code) {
          // 生产环境：把 code 发给自己的后端换 openid
          // 这里简化处理，直接用 code 模拟
          self.globalData.openid = 'openid_' + res.code;
        }
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