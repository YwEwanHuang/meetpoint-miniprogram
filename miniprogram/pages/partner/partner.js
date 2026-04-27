/**
 * 配对页逻辑 - 扫码 + 输入配对码
 */
const app = getApp();
const api = require('../../utils/api');

Page({
  data: {
    inputCode: '',
  },

  // 与后端 CHARS 保持一致：排除 I O 0 1
  isValidCode(str) {
    return /^[A-HJ-NP-Z2-9]{6}$/.test(str);
  },

  onLoad(options) {
    // 接收分享链接中的配对码
    if (options && options.code) {
      const code = (options.code || '').trim().toUpperCase();
      if (this.isValidCode(code)) {
        this.setData({ inputCode: code });
        wx.showToast({ title: '已识别配对码', icon: 'success' });
        setTimeout(() => this.doJoin(code), 800);
      }
    }
  },

  // 每次输入都实时更新 data
  onCodeInput(e) {
    const raw = e.detail.value || '';
    const val = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.setData({ inputCode: val });
  },

  // 点击按钮加入
  onJoinTap() {
    const code = this.data.inputCode;
    if (!this.isValidCode(code)) {
      wx.showToast({ title: '请输入6位配对码', icon: 'none' });
      return;
    }
    this.doJoin(code);
  },

  // 从字符串中提取6位配对码
  extractCode(raw) {
    // meetpoint://pair?code=ABC123 格式
    const paramMatch = raw.match(/[?&]code=([A-HJ-NP-Z2-9]{6})/i);
    if (paramMatch) return paramMatch[1].toUpperCase();
    // 直接6位码
    const directMatch = raw.match(/\b([A-HJ-NP-Z2-9]{6})\b/i);
    if (directMatch) return directMatch[1].toUpperCase();
    return null;
  },

  // 扫码
  scanQR() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        const raw = res.result || '';
        const code = this.extractCode(raw);

        if (code) {
          this.setData({ inputCode: code });
          wx.showToast({ title: '已识别配对码', icon: 'success' });
          setTimeout(() => this.doJoin(code), 600);
        } else {
          wx.showToast({ title: '无效的配对码', icon: 'none' });
        }
      },
      fail: (err) => {
        if (err?.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({ title: '扫码失败', icon: 'none' });
        }
      },
    });
  },

  // 执行加入配对
  doJoin(code) {
    if (!app.globalData.openid) {
      wx.showToast({ title: '登录信息获取中，请稍后', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加入中...' });

    api.joinPair(code).then(data => {
      wx.hideLoading();
      if (data && data.pairId) {
        app.savePairInfo(data.pairId, code, data.partner);
        wx.showToast({ title: '加入成功', icon: 'success' });
        setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 1500);
      } else {
        wx.showToast({ title: data?.error || '加入失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      if (err.statusCode === 404 || err.statusCode === 410) {
        wx.showToast({ title: '配对码无效或已过期', icon: 'none' });
      } else if (err.type === 'network') {
        wx.showToast({ title: '请求超时，请检查网络', icon: 'none' });
      }
    });
  },
});
