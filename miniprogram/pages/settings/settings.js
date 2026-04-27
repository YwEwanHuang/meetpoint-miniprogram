/**
 * 设置页逻辑
 */
const app = getApp();

const TRANSPORT_MODES = [
  { mode: 'driving', label: '驾车', icon: '🚗' },
  { mode: 'transit', label: '公交/地铁', icon: '🚌' },
  { mode: 'riding', label: '骑行', icon: '🚴' },
  { mode: 'walking', label: '步行', icon: '🚶' },
];

Page({
  data: {
    transportModes: TRANSPORT_MODES,
    defaultMode: 'driving',
  },

  onLoad() {
    this.setData({ defaultMode: app.globalData.transportMode || 'driving' });
  },

  selectMode(e) {
    const mode = e.currentTarget.dataset.mode;
    app.globalData.transportMode = mode;
    this.setData({ defaultMode: mode });
    wx.setStorageSync('transportMode', mode);
  },

  unpair() {
    wx.showModal({
      title: '解除配对',
      content: '确定解除当前配对？解除后双方位置将不再共享',
      success: (res) => {
        if (!res.confirm) return;

        if (!app.globalData.pairId) {
          wx.showToast({ title: '当前无配对', icon: 'none' });
          return;
        }

        wx.request({
          url: `${app.globalData.apiBase}/pair/${app.globalData.pairId}`,
          method: 'DELETE',
          data: { openid: app.globalData.openid },
          success: () => {
            app.clearPairInfo();
            wx.showToast({ title: '已解除', icon: 'success' });
            setTimeout(() => {
              wx.switchTab({ url: '/pages/index/index' });
            }, 1500);
          },
          fail: () => {
            wx.showToast({ title: '解除失败', icon: 'none' });
          },
        });
      },
    });
  },
});