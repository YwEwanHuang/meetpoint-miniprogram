# 约见 MeetPoint - 产品设计文档 v3

## 1. Concept & Vision

约见是一个让人感到**安心、可信赖**的工具。

核心体验：两个人的位置像两根丝线，地图把它们连在一起，算法算出最公平的那个点——不是几何中点，是**时间中点**。

设计方向：**Apple Human Interface Guidelines** — 大量留白、克制的色彩、精准的间距、流畅的动效。让人用的时候感觉"这就是应该的样子"，而不是"功能堆砌"。

---

## 2. Design Language (Apple HIG Adaptation)

### 色彩系统
```
iOS System Blue:      #007AFF   (主操作、链接)
iOS System Green:     #34C759   (成功、到达)
iOS System Orange:    #FF9500   (警示、等待)
iOS System Red:       #FF3B30   (危险、错误)
iOS Label:            #000000E5 (主文字，85% opacity)
iOS Secondary:        #00000099 (次要文字)
iOS Tertiary:         #00000048 (三级文字)
iOS Gray 6:           #F2F2F7   (页面背景)
iOS Gray 7:           #FFFFFF   (卡片背景)
```

### 字体
```
大标题 (34px, bold)    — 页面主标题（Large Title）
标题1 (28px, bold)     — 卡片标题
标题2 (22px, semibold) — 区块标题
Headline (17px, semibold) — 重要内容
Body (17px, regular)   — 正文
Callout (16px, regular)— 次要正文
Subhead (15px, regular)— 辅助说明
Caption (12px, regular)— 小字注释
```

### 间距系统 (8pt Grid)
```
xs:  4px   sm:  8px   md:  16px   lg:  24px   xl:  32px   xxl: 48px
```

### 圆角
```
小组件:  8px   卡片: 12px   大卡片: 16px   按钮: 10px
```

---

## 3. Architecture

### 技术栈
- **小程序端**: 原生 WXML + WXSS + JS，腾讯地图 `map` 组件
- **后端**: Node.js + Express，内存存储 + JSON 文件持久化
- **推送**: Server酱（可选，配置 `SERVERCHAN_KEY` 即可）；本地存储供小程序内查询
- **地图 API**: 腾讯位置服务 WebService API

### 文件结构
```
meetpoint-miniprogram/
├── miniprogram/                    # 小程序端
│   ├── app.js / app.json / app.wxss
│   ├── pages/
│   │   ├── index/                  # 首页
│   │   ├── map/                    # 地图页
│   │   ├── history/                # 记录页
│   │   ├── partner/                # 配对页（扫码+输入码）
│   │   └── settings/               # 设置页
│   └── utils/api.js
├── server/                         # 后端服务
│   ├── index.js
│   ├── store.js
│   ├── notifications.js            # 推送通知模块
│   └── routes/
│       ├── pair.js                 # 配对 API
│       ├── location.js             # 位置上报 API
│       ├── meeting.js             # 相遇点计算 API
│       ├── records.js             # 历史记录 API
│       └── notifications.js       # 通知查询 API
├── SPEC.md
└── README.md
```

---

## 4. Features

### 4.1 配对系统
- **创建配对**：生成唯一 6 位配对码，有效期 24 小时
- **扫码加入**：调用 `wx.scanCode` 解析 `meetpoint://pair?code=ABC123` 或直接6位码
- **手动输入**：输入框接收6位码
- **分享配对码**：复制到剪贴板 + 微信分享菜单
- **解除配对**：单方面解除，双方位置共享终止

### 4.2 位置共享
- 主动获取：进入地图页时自动 `wx.getLocation({ type: 'gcj02' })`
- 上报服务器：每次刷新位置时同时上报
- 对方位置：实时显示在地图上，带时间戳
- 刷新按钮：手动刷新双方位置

### 4.3 路线规划
| 模式 | 说明 |
|------|------|
| 驾车 | 驾车路线规划 |
| 公交/地铁 | 公交/地铁路线规划 |
| 骑行 | 自行车/电动车路线 |
| 步行 | 步行路线规划 |

显示内容：总距离 + 预计时间 + 路线描述

### 4.4 相遇点计算
**算法**：沿 AB 连线取 20 个候选点，计算双方分别到达的时间，时间差最小即为相遇点。
- 两点距离 < 500m → 直接返回几何中点
- 无法找到均衡点 → 返回最近均衡点并标注误差

**结果存储**：每次计算自动创建一条历史记录。

### 4.5 历史记录
每条记录包含：
- 日期 / 时间
- 相遇点坐标
- 交通方式
- 双方各自到达耗时
- 状态：`scheduled` / `completed` / `cancelled`

**统计**：本月见面次数、累计次数、平均时间差

### 4.6 推送通知
**触发时机**：
| 事件 | 通知内容 |
|------|----------|
| 配对创建 | "你的配对码是 XXX，分享给朋友" |
| 配对加入成功 | 通知对方："有人加入配对" |
| 相遇点计算完成 | 通知对方：相遇点摘要 |
| 配对即将过期（6h内）| "配对码即将过期" |

**推送渠道**：Server酱（可选）+ 本地存储（小程序内随时查）

---

## 5. Pages Detail

### TabBar (4个标签)
| 标签 | 图标 | 说明 |
|------|------|------|
| 首页 | 🏠 | 配对状态 + 快速入口 |
| 地图 | 🗺️ | 位置共享 + 路线 + 相遇点 |
| 记录 | 📋 | 历史见面记录 + 统计 |
| 设置 | ⚙️ | 偏好 + 关于 |

### 首页 (index)
- **未配对**：大标题 + 品牌语 + "创建配对"按钮 + "扫码加入"按钮
- **已配对**：配对状态卡片（对方昵称、位置状态、配对码）+ "进入地图"按钮 + 最近记录预览

### 地图页 (map)
- 全屏腾讯地图，占据上方 60%
- 我方/对方/相遇点三个标记
- 底部半透明面板：交通方式切换 tabs + 路线摘要 + 相遇点信息 + 操作按钮

### 记录页 (history)
- 大标题 "记录"
- 统计卡片：本月次数 / 累计次数 / 平均时差
- 时间线列表：每条显示日期、交通方式、双方到达时间、状态

### 配对页 (partner)
- 大标题 "配对"
- 扫码按钮 + 分隔线 + 输入框 + 加入按钮
- 我的配对码展示（可复制/分享）

### 设置页 (settings)
- 大标题 "设置"
- 交通偏好选择（单选）
- 位置权限说明
- 解除配对（红色）

---

## 6. API Design

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/pair/create` | 创建配对 |
| POST | `/api/pair/join` | 加入配对 |
| DELETE | `/api/pair/:id` | 解除配对 |
| GET | `/api/pair/:id` | 获取配对信息 |
| POST | `/api/location/update` | 上报位置 |
| GET | `/api/location/:pairId` | 获取双方位置 |
| POST | `/api/meeting/calculate` | 计算相遇点 |
| GET | `/api/records/:pairId` | 获取历史记录 |
| POST | `/api/records` | 创建记录 |
| PUT | `/api/records/:id` | 更新记录状态 |
| GET | `/api/notifications?userId=` | 获取我的通知 |
| PUT | `/api/notifications/read` | 标记已读 |

---

## 7. Data Model

### Pair
```json
{
  "id": "pair_xxx",
  "code": "ABC123",
  "createdAt": "ISO",
  "expiresAt": "ISO",
  "status": "active|expired",
  "users": [
    { "openid": "ou_xxx", "nickname": "A", "lat": 0, "lng": 0, "updatedAt": "ISO" }
  ],
  "records": []
}
```

### Record
```json
{
  "id": "record_xxx",
  "pairId": "pair_xxx",
  "createdAt": "ISO",
  "meetingPoint": { "lat": 0, "lng": 0 },
  "transportMode": "driving",
  "timeFromMe": 15,
  "timeFromPartner": 17,
  "distance": 3500,
  "status": "scheduled|completed|cancelled"
}
```

### Notification
```json
{
  "id": "notif_xxx",
  "userId": "ou_xxx",
  "title": "配对成功",
  "content": "有人加入配对",
  "type": "pair_joined|meeting_ready|pair_expiring",
  "pairId": "pair_xxx",
  "data": {},
  "createdAt": "ISO",
  "read": false
}
```

---

## 8. 环境变量

```bash
# 后端
PORT=3000
QQMAP_KEY=你的腾讯地图Key          # 必需
SERVERCHAN_KEY=你的Server酱Key     # 可选，不填则只用本地通知

# 小程序
// app.js 中配置
apiBase: 'http://你的服务器:3000/api'
qqmapKey: '你的腾讯地图Key'
```