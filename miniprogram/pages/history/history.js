/**
 * 记录页 - 历史见面记录
 */

const app = getApp();

Page({
  data: {
    records: [],
    stats: {
      totalMeetings: 0,
      avgTimeDiff: 0,
      thisMonth: 0,
    },
    loading: true,
  },

  onShow() {
    this.loadRecords();
  },

  onPullDownRefresh() {
    this.loadRecords();
    wx.stopPullDownRefresh();
  },

  loadRecords() {
    if (!app.globalData.pairId) {
      this.setData({ loading: false, records: [] });
      return;
    }

    wx.showLoading({ title: '加载中...' });

    wx.request({
      url: `${app.globalData.apiBase}/records/${app.globalData.pairId}`,
      success: (res) => {
        wx.hideLoading();
        if (res.data && res.data.records) {
          this.computeStats(res.data.records);
          this.setData({ records: res.data.records, loading: false });
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ loading: false });
      },
    });
  },

  computeStats(records) {
    const now = new Date();
    const thisMonthRecords = records.filter(r => {
      const d = new Date(r.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const totalTimeDiff = records.reduce((sum, r) => sum + (r.timeDiff || 0), 0);

    this.setData({
      stats: {
        totalMeetings: records.length,
        avgTimeDiff: records.length > 0 ? Math.round(totalTimeDiff / records.length) : 0,
        thisMonth: thisMonthRecords.length,
      },
    });
  },

  formatDate(isoString) {
    const d = new Date(isoString);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    return `${month}月${day}日 ${weekday}`;
  },

  formatTime(minutes) {
    if (minutes < 60) return `${minutes}分钟`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  },

  transportIcon(mode) {
    const icons = { driving: '🚗', transit: '🚌', riding: '🚴', walking: '🚶' };
    return icons[mode] || '📍';
  },

  onRecordTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/history/detail?id=${id}` });
  },
});