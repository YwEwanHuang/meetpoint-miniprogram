/**
 * 配对页逻辑 - 扫码 + 输入配对码
 */
const app = getApp();

Page({
  data: {
    inputCode: '',
  },

  onLoad(options) {
    // 接收分享链接中的配对码
    if (options && options.code) {
      const code = (options.code || '').trim().toUpperCase();
      if (/^[A-Z0-9]{6}$/.test(code)) {
        this.setData({ inputCode: code });
        wx.showToast({ title: '已识别配对码', icon: 'success' });
        setTimeout(() => this.doJoin(code), 800);
      }
    }
  },

  onCodeInput(e) {
    const val = (e.detail.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.setData({ inputCode: val });
  },

  onCodeConfirm(e) {
    const val = (e.detail.value || '').trim().toUpperCase();
    if (val.length === 6) {
      this.doJoin(val);
    }
  },

  // 点击按钮加入
  onJoinTap() {
    const code = this.data.inputCode.trim();
    if (!code) {
      wx.showToast({ title: '请输入配对码', icon: 'none' });
      return;
    }
    if (code.length !== 6) {
      wx.showToast({ title: '配对码为6位', icon: 'none' });
      return;
    }
    this.doJoin(code);
  },

  // 扫码
  scanQR() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        const raw = res.result || '';
        let code = raw.trim().toUpperCase();

        // 解析 URL 格式 meetpoint://pair?code=ABC123
        try {
          const url = new URL(raw);
          if (url.hostname === 'pair' || raw.startsWith('meetpoint://')) {
            code = (url.searchParams.get('code') || '').trim().toUpperCase();
          }
        } catch (e) { /* ignore */ }

        if (/^[A-Z0-9]{6}$/.test(code)) {
          this.setData({ inputCode: code });
          wx.showToast({ title: '已识别配对码', icon: 'success' });
          setTimeout(() => this.doJoin(code), 600);
        } else {
          wx.showToast({ title: '无效的配对码', icon: 'none' });
        }
      },
      fail: (err) => {
        if (!err.errMsg || !err.errMsg.includes('cancel')) {
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
        if (res.data && res.data.pairId) {
          app.savePairInfo(res.data.pairId, code, res.data.partner);
          wx.showToast({ title: '加入成功', icon: 'success' });
          setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 1500);
        } else {
          const msg = res.data ? res.data.error : '加入失败';
          wx.showToast({ title: msg, icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },
});
