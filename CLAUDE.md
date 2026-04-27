# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"约见 MeetPoint" — 一个微信小程序，让两个人通过6位配对码匿名配对后，共享实时位置并智能计算最佳见面点（基于出行时间差的算法）。

## Tech Stack

- **前端**: 原生微信小程序 (WXML + WXSS + JS)
- **后端**: Node.js + Express (部署在远程服务器 39.105.107.5)
- **地图**: 腾讯位置服务 WebService API + 小程序 map 组件
- **推送**: Server酱（可选）
- **持久化**: 服务器端 JSON 文件

## Project Structure

```
meetpoint-miniprogram/
├── miniprogram/                    # 小程序端（微信开发者工具导入此目录）
│   ├── app.js / app.json / app.wxss
│   ├── pages/
│   │   ├── index/        # 首页：配对状态展示、创建/加入配对入口
│   │   ├── map/           # 地图页：位置共享 + 路线 + 相遇点（连续定位）
│   │   ├── partner/       # 配对页：扫码加入 + 手动输入配对码
│   │   ├── history/       # 记录页：历史见面记录 + 统计
│   │   └── settings/      # 设置页：交通偏好 + 解除配对
│   ├── utils/api.js       # 后端 API 调用封装
│   └── assets/            # 图标资源 (tab-bar, map markers)
├── server/                 # 后端服务（在远程服务器，本地无副本）
│   ├── index.js
│   ├── store.js
│   └── routes/
├── SPEC.md                 # 产品设计文档
├── DEPLOY.md               # 部署文档
└── README.md               # 快速开始
```

## Development

### 小程序端
- 使用微信开发者工具打开 `miniprogram/` 目录
- 无需构建步骤，原生微信小程序，修改源码后自动生效
- 需要配置 `app.js` 中的 `apiBase` 和 `qqmapKey`

### 后端（在远程服务器上）
```bash
cd server
npm install
# 配置 .env: QQMAP_KEY, PORT, SERVERCHAN_KEY
node index.js          # 开发
pm2 start index.js --name meetpoint   # 生产
```

### API Endpoints
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/pair/create | 创建配对 |
| POST | /api/pair/join | 加入配对 |
| DELETE | /api/pair/:id | 解除配对 |
| GET | /api/pair/:id | 获取配对信息 |
| POST | /api/location/update | 上报位置 |
| GET | /api/location/:pairId | 获取双方位置 |
| POST | /api/meeting/calculate | 计算相遇点 |
| GET | /api/records/:pairId | 获取历史记录 |

## Design System (Apple HIG)

全局样式变量在 `app.wxss` 中定义：

- **色彩**: iOS System Colors (--system-blue: #007AFF, --system-green: #34C759, etc.)
- **字体**: -apple-system, SF Pro Text
- **间距**: 8pt Grid (xs:4, sm:8, md:16, lg:24, xl:32, xxl:48)
- **圆角**: 按钮 10px, 卡片 12px, 大卡片 16px
- **列表**: iOS Grouped Table 风格

## Key WeChat APIs Used

- `wx.getLocation` / `wx.startLocationUpdate` / `wx.onLocationChange` — 连续定位
- `wx.scanCode` — 扫码加入配对
- `map` 组件 + `markers` (含 `callout`) — 地图展示
- `wx.setClipboardData` — 复制配对码
- `wx.setStorageSync` / `wx.getStorageSync` — 本地缓存配对状态
- `wx.login` — 获取用户标识

## Important Notes

- `requiredPrivateInfos` 需要在 app.json 中声明 `getLocation`、`onLocationChange`、`startLocationUpdate`
- 域名白名单需在微信公众平台配置，开发阶段可勾选"不校验合法域名"
- 腾讯位置服务 Key 需要开通 WebService API
- 配对码有效期 24 小时
- 本项目没有 CI/CD 或测试套件，部署参考 DEPLOY.md
