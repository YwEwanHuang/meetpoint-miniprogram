/**
 * 地图页 - 位置共享 + 路线 + 相遇点
 * 支持连续定位、实时位置更新
 */
const app = getApp();

const TRANSPORT_MODES = [
  { mode: 'driving', label: '驾车', icon: '🚗' },
  { mode: 'transit', label: '公交', icon: '🚌' },
  { mode: 'riding', label: '骑行', icon: '🚴' },
  { mode: 'walking', label: '步行', icon: '🚶' },
];

/**
 * 节流函数：限制函数在 delay 毫秒内最多执行一次
 */
function throttle(fn, delay) {
  let timer = null;
  function throttled(...args) {
    if (timer) return;
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  }
  throttled.cancel = function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return throttled;
}

Page({
  data: {
    myLocation: { latitude: 39.908823, longitude: 116.397470 },
    partnerLocation: { latitude: null, longitude: null },
    markers: [],
    polylines: [],
    includePoints: [],
    transportModes: TRANSPORT_MODES,
    currentMode: 'driving',
    routeInfo: null,
    meetingPoint: null,
    panelExpanded: false,
    partnerLastUpdate: null,
    isLocationUpdating: false,
    // 地图设置
    scale: 14,
    minScale: 5,
    maxScale: 18,
    enableZoom: true,
    enableScroll: true,
    enableRotate: false,
    showCompass: true,
    subkey: '',
    enableSatellite: false,
    enableTraffic: false,
  },

  onLoad() {
    if (!app.globalData.pairId) {
      wx.showModal({
        title: '尚未配对',
        content: '请先在首页创建配对或加入配对后再进入地图',
        confirmText: '去首页',
        success: (res) => {
          wx.switchTab({ url: '/pages/index/index' });
        },
      });
      return;
    }

    // 创建节流后的位置上报函数（每10秒最多一次）
    this.throttledReportLocation = throttle((loc) => {
      this.reportMyLocation(loc);
    }, 10000);

    this.initLocation();
  },

  onShow() {
    if (!app.globalData.pairId) return;
    this.startContinuousLocation();
    this.refreshPartnerLocation();

    // 每30秒轮询对方位置
    this._partnerTimer = setInterval(() => {
      this.refreshPartnerLocation();
    }, 30000);
  },

  onHide() {
    this.stopContinuousLocation();
    this.clearTimers();
  },

  onUnload() {
    this.stopContinuousLocation();
    this.clearTimers();
    if (this.throttledReportLocation) {
      this.throttledReportLocation.cancel();
    }
  },

  clearTimers() {
    if (this._partnerTimer) {
      clearInterval(this._partnerTimer);
      this._partnerTimer = null;
    }
  },

  /**
   * 初始化位置：一次性获取当前位置
   */
  initLocation() {
    wx.showLoading({ title: '获取位置...' });
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        wx.hideLoading();
        const loc = { latitude: res.latitude, longitude: res.longitude };
        this.setData({ myLocation: loc });
        this.reportMyLocation(loc);
        this.updateMarkers();
      },
      fail: (err) => {
        wx.hideLoading();
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要位置权限',
            content: '请在设置中开启位置权限，以便共享位置和计算见面点',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) wx.openSetting();
            },
          });
        } else {
          wx.showToast({ title: '获取位置失败，请检查权限', icon: 'none' });
        }
      },
    });
  },

  /**
   * 开启前台持续定位（基于微信官方文档优化）
   */
  startContinuousLocation() {
    if (this.data.isLocationUpdating) return;

    wx.startLocationUpdate({
      success: () => {
        this.setData({ isLocationUpdating: true });
        wx.onLocationChange((res) => {
          const loc = { latitude: res.latitude, longitude: res.longitude };
          this.setData({ myLocation: loc });
          this.updateMarkers();
          // 节流上报，避免高频请求
          this.throttledReportLocation(loc);
        });
      },
      fail: (err) => {
        console.warn('连续定位启动失败，回退到手动模式:', err);
        this.setData({ isLocationUpdating: false });
      },
    });
  },

  /**
   * 停止连续定位
   */
  stopContinuousLocation() {
    if (this.data.isLocationUpdating) {
      wx.stopLocationUpdate();
      wx.offLocationChange();
      this.setData({ isLocationUpdating: false });
    }
  },

  /**
   * 手动刷新当前位置（按钮触发）
   */
  refreshMyLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const loc = { latitude: res.latitude, longitude: res.longitude };
        this.setData({ myLocation: loc });
        this.reportMyLocation(loc);
        this.updateMarkers();
        wx.showToast({ title: '位置已更新', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '获取位置失败', icon: 'none' });
      },
    });
  },

  /**
   * 上报位置到服务器
   */
  reportMyLocation(loc) {
    if (!app.globalData.pairId || !app.globalData.openid) return;
    wx.request({
      url: `${app.globalData.apiBase}/location/update`,
      method: 'POST',
      data: {
        pairId: app.globalData.pairId,
        openid: app.globalData.openid,
        lat: loc.latitude,
        lng: loc.longitude,
      },
    });
  },

  /**
   * 获取对方位置
   */
  refreshPartnerLocation() {
    if (!app.globalData.pairId) return;
    wx.request({
      url: `${app.globalData.apiBase}/location/${app.globalData.pairId}`,
      success: (res) => {
        if (res.data && res.data.users) {
          const partner = res.data.users.find(
            (u) => u.openid !== app.globalData.openid
          );
          if (partner && partner.lat != null && partner.lng != null) {
            this.setData({
              partnerLocation: { latitude: partner.lat, longitude: partner.lng },
              partnerLastUpdate: partner.updatedAt || null,
            });
            this.updateMarkers();
          }
        }
      },
      fail: (err) => {
        console.error('刷新对方位置失败:', err);
      },
    });
  },

  /**
   * 更新地图标记（带 callout 气泡）
   */
  updateMarkers() {
    const { myLocation, partnerLocation, meetingPoint } = this.data;
    const markers = [
      {
        id: 1,
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        width: 36,
        height: 36,
        iconPath: '/assets/marker-me.png',
        callout: {
          content: '我的位置',
          color: '#007AFF',
          fontSize: 11,
          borderRadius: 4,
          bgColor: '#FFFFFF',
          padding: 4,
          display: 'ALWAYS',
          borderWidth: 0.5,
          borderColor: '#007AFF',
        },
      },
    ];

    if (partnerLocation.latitude) {
      markers.push({
        id: 2,
        latitude: partnerLocation.latitude,
        longitude: partnerLocation.longitude,
        width: 36,
        height: 36,
        iconPath: '/assets/marker-partner.png',
        callout: {
          content: '对方位置',
          color: '#34C759',
          fontSize: 11,
          borderRadius: 4,
          bgColor: '#FFFFFF',
          padding: 4,
          display: 'ALWAYS',
          borderWidth: 0.5,
          borderColor: '#34C759',
        },
      });
    }

    if (meetingPoint) {
      markers.push({
        id: 3,
        latitude: meetingPoint.lat,
        longitude: meetingPoint.lng,
        width: 40,
        height: 40,
        iconPath: '/assets/marker-me.png',
        callout: {
          content: '🤝 见面点',
          color: '#FF9500',
          fontSize: 11,
          borderRadius: 4,
          bgColor: '#FFFFFF',
          padding: 4,
          display: 'ALWAYS',
          borderWidth: 0.5,
          borderColor: '#FF9500',
        },
      });
    }

    const points = [myLocation];
    if (partnerLocation.latitude) points.push(partnerLocation);
    if (meetingPoint) points.push({ latitude: meetingPoint.lat, longitude: meetingPoint.lng });

    this.setData({ markers, includePoints: points });
  },

  // ========== 路线与相遇点 ==========

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ currentMode: mode });
    if (this.data.partnerLocation.latitude) {
      this.calculateRoute();
    }
  },

  calculateRoute() {
    const { myLocation, partnerLocation, currentMode } = this.data;
    if (!partnerLocation.latitude) {
      wx.showToast({ title: '对方位置不可用', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '计算路线...' });

    wx.request({
      url: `${app.globalData.apiBase}/meeting/calculate`,
      method: 'POST',
      data: {
        pairId: app.globalData.pairId,
        openid: app.globalData.openid,
        transportMode: currentMode,
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.meetingPoint) {
          this.setData({ routeInfo: res.data, panelExpanded: true });
          this.drawRoute(res.data);
        } else {
          wx.showToast({ title: '路线计算失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  calculateMeetingPoint() {
    const { partnerLocation, currentMode } = this.data;
    if (!partnerLocation.latitude) {
      wx.showToast({ title: '对方位置不可用', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '寻找最佳相遇点...' });

    wx.request({
      url: `${app.globalData.apiBase}/meeting/calculate`,
      method: 'POST',
      data: {
        pairId: app.globalData.pairId,
        openid: app.globalData.openid,
        transportMode: currentMode,
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.meetingPoint) {
          const mp = res.data;
          this.setData({ routeInfo: mp, meetingPoint: mp, panelExpanded: true });
          this.updateMarkers();
          this.drawRoute(mp);
        } else {
          wx.showToast({ title: '计算失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  drawRoute(data) {
    if (!data.routeFromMe || !data.routeFromPartner) return;
    const polylines = [];

    if (data.routeFromMe && data.routeFromMe.polyline) {
      polylines.push({
        points: data.routeFromMe.polyline,
        color: '#007AFF',
        width: 4,
        dottedLine: false,
      });
    }

    if (data.routeFromPartner && data.routeFromPartner.polyline) {
      polylines.push({
        points: data.routeFromPartner.polyline,
        color: '#34C759',
        width: 4,
        dottedLine: false,
      });
    }

    this.setData({ polylines });
  },

  togglePanel() {
    this.setData({ panelExpanded: !this.data.panelExpanded });
  },

  onMapTap(e) {
    console.log('地图点击', e);
  },
});
