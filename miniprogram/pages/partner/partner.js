/**
 * 配对页逻辑 - 扫码 + 输入配对码
 */
const app = getApp();

Page({
  data: {
    code: '',
    myCode: '',
    scanning: false,
  },

  onLoad(options) {
    // 接收分享链接中的配对码
    if (options && options.code) {
      const code = options.code.toUpperCase();
      if (/^[A-Z0-9]{6}$/.test(code)) {
        this.setData({ code });
        wx.showToast({ title: '已识别配对码', icon: 'success' });
        // 自动触发加入
        setTimeout(() => this.joinPair(code), 800);
      }
    }
  },

  onShow() {
    this.setData({
      myCode: app.globalData.pairCode || '',
    });
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value.toUpperCase() });
  },

  // 扫码配对
  scanQR() {
    if (this.data.scanning) return;
    this.setData({ scanning: true });

    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        this.setData({ scanning: false });
        this.handleScannedCode(res.result || res.rawData || '');
      },
      fail: (err) => {
        this.setData({ scanning: false });
        if (err.errMsg && err.errMsg.includes('cancel')) return;
        wx.showToast({ title: '扫码失败', icon: 'none' });
      },
    });
  },

  // 解析扫码结果
  handleScannedCode(code) {
    let pairCode = (code || '').trim();

    // 支持格式：
    // 1. meetpoint://pair?code=ABC123
    // 2. 直接的6位配对码
    try {
      const url = new URL(code);
      if (url.hostname === 'pair' || code.startsWith('meetpoint://')) {
        pairCode = url.searchParams.get('code') || pairCode;
      }
    } catch (e) {
      // 不是 URL 格式，直接用原始值
    }

    // 检查是否是6位有效配对码格式
    if (/^[A-Z0-9]{6}$/i.test(pairCode)) {
      this.setData({ code: pairCode.toUpperCase() });
      wx.showToast({ title: '已识别配对码', icon: 'success' });
      // 自动触发加入
      setTimeout(() => this.joinPair(pairCode.toUpperCase()), 800);
    } else {
      wx.showToast({ title: '无效的配对码', icon: 'none' });
    }
  },

  // 加入配对（可指定 code 参数）
  joinPair(codeFromParam) {
    const code = codeFromParam || this.data.code.trim();
    if (!code || code.length !== 6) {
      wx.showToast({ title: '请输入6位配对码', icon: 'none' });
      return;
    }

    if (!app.globalData.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加入中...' });

    wx.request({
      url: `${app.globalData.apiBase}/pair/join`,
      method: 'POST',
      data: {
        code,
        openid: app.globalData.openid,
        nickname: app.globalData.nickname || '我',
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.pairId) {
          app.savePairInfo(res.data.pairId, code, res.data.partner);
          wx.showToast({ title: '加入成功', icon: 'success' });
          setTimeout(() => {
            wx.switchTab({ url: '/pages/index/index' });
          }, 1500);
        } else {
          wx.showToast({ title: res.data.error || '加入失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  // 复制配对码
  copyCode() {
    if (!this.data.myCode) return;
    wx.setClipboardData({
      data: this.data.myCode,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  // 分享配对码（生成分享图片）
  shareCode() {
    if (!this.data.myCode) return;
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    });
  },

  onShareAppMessage() {
    return {
      title: '加入我的配对 - 约见',
      path: `/pages/partner/partner?code=${this.data.myCode}`,
      imageUrl: '',
    };
  },
});