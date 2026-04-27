/**
 * 地图页逻辑
 */
const app = getApp();
const api = require('../../utils/api');

const TRANSPORT_MODES = [
  { mode: 'driving', label: '驾车', icon: '🚗' },
  { mode: 'transit', label: '公交', icon: '🚌' },
  { mode: 'riding', label: '骑行', icon: '🚴' },
  { mode: 'walking', label: '步行', icon: '🚶' },
];

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
  },

  onLoad() {
    if (!app.globalData.pairId) {
      wx.showModal({
        title: '尚未配对',
        content: '请先在首页创建配对或加入配对后再进入地图',
        confirmText: '去首页',
        success: (res) => {
          if (res.confirm) wx.switchTab({ url: '/pages/index/index' });
          else wx.switchTab({ url: '/pages/index/index' });
        },
      });
      return;
    }
    this.refreshMyLocation();
    this.refreshPartnerLocation();
  },

  onShow() {
    if (!app.globalData.pairId) return;
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
        this.reportMyLocation(loc, true);
        this.updateMarkers();
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '获取位置失败，请检查权限', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
      },
    });
  },

  // 上报位置到服务器
  reportMyLocation(loc) {
    if (!app.globalData.pairId || !app.globalData.openid) return;
    api.updateLocation(loc.latitude, loc.longitude).catch(() => {});
  },

  // 刷新对方位置
  refreshPartnerLocation() {
    if (!app.globalData.pairId) return;
    api.getLocations(app.globalData.pairId).then(data => {
      if (data && data.users) {
        const partner = data.users.find(
          (u) => u.openid !== app.globalData.openid
        );
        if (partner && partner.lat != null && partner.lng != null) {
          this.setData({
            partnerLocation: { latitude: partner.lat, longitude: partner.lng },
          });
          this.updateMarkers();
        }
      }
    }).catch(err => {
      console.error('刷新对方位置失败:', err);
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

    let points = [myLocation];
    if (partnerLocation.latitude) points.push(partnerLocation);
    if (this.data.meetingPoint) {
      points.push({
        latitude: this.data.meetingPoint.lat,
        longitude: this.data.meetingPoint.lng,
      });
    }

    this.setData({ markers, includePoints: points });
  },

  // 切换交通方式
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ currentMode: mode });
    if (this.data.partnerLocation.latitude) {
      this.calculateMeetingPoint();
    }
  },

  // 计算相遇点和路线
  calculateMeetingPoint() {
    const { partnerLocation, currentMode } = this.data;
    if (!partnerLocation.latitude) {
      wx.showToast({ title: '对方位置不可用', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '寻找最佳相遇点...' });

    api.calculateMeeting(currentMode).then(data => {
      wx.hideLoading();
      if (data.meetingPoint) {
        const info = this.formatRouteInfo(data);
        this.setData({ routeInfo: info, meetingPoint: data, panelExpanded: true });
        this.updateMarkers();
        this.drawRoute(data);
        if (data.note) {
          wx.showToast({ title: data.note, icon: 'none', duration: 3000 });
        }
      } else {
        wx.showToast({ title: '计算失败', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
    });
  },

  // 格式化路线信息供 WXML 展示
  formatRouteInfo(data) {
    const distText = (m) => m > 1000 ? `${(m/1000).toFixed(1)}公里` : `${m}米`;
    const timeText = (min) => min < 60 ? `${min}分钟` : `${Math.floor(min/60)}小时${min%60}分钟`;
    return {
      myDistance: distText(data.routeFromMe?.distance || 0),
      myTime: timeText(data.timeFromMe || 0),
      partnerDistance: distText(data.routeFromPartner?.distance || 0),
      partnerTime: timeText(data.timeFromPartner || 0),
      transportLabel: data.transportLabel || '',
    };
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
