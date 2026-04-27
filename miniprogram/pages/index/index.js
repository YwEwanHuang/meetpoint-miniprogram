/**
 * 首页逻辑 - Apple Style
 */
const app = getApp();
const api = require('../../utils/api');

Page({
  data: {
    hasPair: false,
    pairCode: '',
    partner: null,
    recentRecord: null,
    notifCount: 0,
    qrCodeUrl: '',
  },

  onShow() {
    this.refresh();
    this.loadNotifications();
  },

  refresh() {
    const hasPair = !!app.globalData.pairId;
    this.setData({
      hasPair,
      pairCode: app.globalData.pairCode || '',
      partner: app.globalData.partner || null,
    });

    if (hasPair) {
      this.refreshLocation();
      this.loadRecentRecord();
      this.loadQRCode();
    } else {
      this.setData({ qrCodeUrl: '' });
    }
  },

  // 加载二维码图片
  loadQRCode() {
    if (!app.globalData.pairCode) return;
    if (this.data.qrCodeUrl) return; // 已加载过

    const qrUrl = `meetpoint://pair?code=${app.globalData.pairCode}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;

    wx.downloadFile({
      url: qrApiUrl,
      success: (res) => {
        if (res.statusCode === 200 && res.tempFilePath) {
          this.setData({ qrCodeUrl: res.tempFilePath });
        }
      },
      fail: () => {
        console.error('二维码加载失败');
      },
    });
  },

  // 预览二维码
  previewQR() {
    if (!this.data.qrCodeUrl) return;
    wx.previewImage({
      urls: [this.data.qrCodeUrl],
      current: this.data.qrCodeUrl,
    });
  },

  loadNotifications() {
    if (!app.globalData.openid) return;
    api.getNotifications(app.globalData.openid).then(data => {
      if (data && data.unreadCount > 0) {
        this.setData({ notifCount: data.unreadCount });
      }
    }).catch(() => {});
  },

  createPair() {
    if (!app.globalData.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '创建中...' });
    api.createPair().then(data => {
      wx.hideLoading();
      if (data.code) {
        app.savePairInfo(data.pairId, data.code, null);
        this.setData({ hasPair: true, pairCode: data.code });
        wx.showToast({ title: '配对已创建', icon: 'success' });
        setTimeout(() => this.loadQRCode(), 300);
      } else {
        wx.showToast({ title: data.error || '创建失败', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
    });
  },

  // 跳转到输入配对码页面
  goToPartner() {
    wx.navigateTo({ url: '/pages/partner/partner' });
  },

  goToMap() {
    wx.switchTab({ url: '/pages/map/map' });
  },

  copyCode() {
    wx.setClipboardData({
      data: this.data.pairCode,
      success: () => {
        wx.vibrateShort({ type: 'light' }).catch(() => {});
        wx.showToast({ title: '已复制', icon: 'success' });
      },
    });
  },

  refreshLocation() {
    if (!app.globalData.pairId) return;
    api.getLocations(app.globalData.pairId).then(data => {
      if (data && data.users) {
        const partner = data.users.find(u => u.openid !== app.globalData.openid);
        if (partner) {
          app.globalData.partner = partner;
          this.setData({ partner });
        }
      }
    }).catch(() => {});
  },

  loadRecentRecord() {
    if (!app.globalData.pairId) return;
    api.getRecords(app.globalData.pairId).then(data => {
      if (data && data.records && data.records.length > 0) {
        const latest = data.records[0];
        const d = new Date(latest.createdAt);
        const dateStr = `${d.getMonth()+1}月${d.getDate()}日`;
        const modeLabels = { driving: '驾车', transit: '公交', riding: '骑行', walking: '步行' };
        const timeDiff = Math.abs(latest.timeFromMe - latest.timeFromPartner);
        this.setData({
          recentRecord: {
            date: dateStr,
            transport: modeLabels[latest.transportMode] || latest.transportMode,
            timeDiff: `时差${timeDiff}分钟`,
          },
        });
      }
    }).catch(() => {});
  },

  showUnpairConfirm() {
    wx.showModal({
      title: '解除配对',
      content: '确定解除当前配对？解除后双方位置将不再共享。',
      confirmText: '解除',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (!res.confirm) return;
        this.unpair();
      },
    });
  },

  unpair() {
    api.deletePair(app.globalData.pairId).then(() => {
      app.clearPairInfo();
      this.setData({ hasPair: false, pairCode: '', partner: null, qrCodeUrl: '' });
      wx.showToast({ title: '已解除', icon: 'success' });
    }).catch(() => {
      wx.showToast({ title: '解除失败', icon: 'none' });
    });
  },

  onShareAppMessage() {
    if (!this.data.pairCode) return;
    return {
      title: '加入我的配对 - 约见',
      path: `/pages/partner/partner?code=${this.data.pairCode}`,
    };
  },
});