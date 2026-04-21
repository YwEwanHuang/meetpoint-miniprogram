/**
 * 地图页逻辑
 */
const app = getApp();

const TRANSPORT_MODES = [
  { mode: 'driving', label: '驾车', icon: '🚗' },
  { mode: 'transit', label: '公交', icon: '🚌' },
  { mode: 'riding', label: '骑行', icon: '🚴' },
  { mode: 'walking', label: '步行', icon: '🚶' },
];

Page({
  data: {
    myLocation: { latitude: 39.908823, longitude: 116.397470 }, // 默认北京
    partnerLocation: { latitude: null, longitude: null },
    markers: [],
    polylines: [],
    includePoints: [],
    transportModes: TRANSPORT_MODES,
    currentMode: 'driving',
    routeInfo: null,
    meetingPoint: null,
    panelExpanded: false,
  },

  onLoad() {
    this.refreshMyLocation();
  },

  onShow() {
    // 每次进入页面刷新位置
    this.refreshMyLocation();
    this.refreshPartnerLocation();
  },

  // 获取并上报自己的位置
  refreshMyLocation() {
    wx.showLoading({ title: '获取位置...' });

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        wx.hideLoading();
        const loc = { latitude: res.latitude, longitude: res.longitude };
        this.setData({ myLocation: loc });

        // 上报到服务器
        this.reportMyLocation(loc);

        // 更新自己的地图标记
        this.updateMarkers();
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '请开启位置权限', icon: 'none' });
      },
    });
  },

  // 上报位置到服务器
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
      fail: () => {
        console.error('位置上报失败');
      },
    });
  },

  // 刷新对方位置
  refreshPartnerLocation() {
    if (!app.globalData.pairId) return;

    wx.request({
      url: `${app.globalData.apiBase}/location/${app.globalData.pairId}`,
      success: (res) => {
        if (res.data && res.data.users) {
          const partner = res.data.users.find(
            u => u.openid !== app.globalData.openid
          );
          if (partner && partner.lat != null && partner.lng != null) {
            this.setData({
              partnerLocation: { latitude: partner.lat, longitude: partner.lng },
            });
            this.updateMarkers();
          }
        }
      },
    });
  },

  // 更新地图标记
  updateMarkers() {
    const { myLocation, partnerLocation } = this.data;

    const markers = [
      {
        id: 1,
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        width: 40,
        height: 40,
        iconPath: '/assets/marker-me.png',
        title: '我的位置',
      },
    ];

    if (partnerLocation.latitude) {
      markers.push({
        id: 2,
        latitude: partnerLocation.latitude,
        longitude: partnerLocation.longitude,
        width: 40,
        height: 40,
        iconPath: '/assets/marker-partner.png',
        title: '对方位置',
      });
    }

    // 包含双方和相遇点
    let points = [myLocation];
    if (partnerLocation.latitude) points.push(partnerLocation);
    if (this.data.meetingPoint) {
      points.push({
        latitude: this.data.meetingPoint.lat,
        longitude: this.data.meetingPoint.lng,
      });
    }

    this.setData({
      markers,
      includePoints: points,
    });
  },

  // 切换交通方式
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ currentMode: mode });
    // 重新计算路线
    if (this.data.partnerLocation.latitude) {
      this.calculateRoute();
    }
  },

  // 计算路线
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

  // 计算相遇点
  calculateMeetingPoint() {
    const { myLocation, partnerLocation, currentMode } = this.data;
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
          this.setData({
            routeInfo: mp,
            meetingPoint: mp,
            panelExpanded: true,
          });
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

  // 绘制路线
  drawRoute(data) {
    if (!data.routeFromMe || !data.routeFromPartner) return;

    const polylines = [];

    if (data.routeFromMe && data.routeFromMe.polyline) {
      polylines.push({
        points: data.routeFromMe.polyline,
        color: '#3B82F6',
        width: 4,
        dottedLine: false,
      });
    }

    if (data.routeFromPartner && data.routeFromPartner.polyline) {
      polylines.push({
        points: data.routeFromPartner.polyline,
        color: '#10B981',
        width: 4,
        dottedLine: false,
      });
    }

    this.setData({ polylines });
  },

  // 展开/收起面板
  togglePanel() {
    this.setData({ panelExpanded: !this.data.panelExpanded });
  },

  // 地图点击
  onMapTap(e) {
    console.log('地图点击', e);
  },
});