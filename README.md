# 约见 MeetPoint - 微信小程序

两个人配对后，共享位置、智能计算最佳见面点。

---

## 功能

- **配对系统**：6位配对码双向绑定，无需加好友
- **位置共享**：双方实时位置显示在地图上
- **路线规划**：支持驾车/公交/骑行/步行四种交通方式
- **相遇点计算**：基于出行时间找到双方到达时间最均衡的见面位置

---

## 项目结构

```
meetpoint-miniprogram/
├── miniprogram/          # 小程序端（微信开发者工具导入此目录）
│   ├── app.js / app.json / app.wxss
│   ├── pages/
│   │   ├── index/        # 首页：配对入口
│   │   ├── map/          # 地图页：位置 + 路线 + 相遇点
│   │   ├── partner/      # 配对页：输入配对码
│   │   └── settings/     # 设置页
│   └── utils/api.js      # API 调用封装
├── server/               # 后端服务（Node.js）
│   ├── index.js          # Express 入口
│   ├── store.js          # 内存存储 + 文件持久化
│   └── routes/           # API 路由
├── SPEC.md               # 产品设计文档
└── README.md
```

---

## 快速开始

### 1. 配置后端

```bash
cd server
npm init -y
npm install express cors

# 启动服务（开发时前台跑，生产用 pm2 或 docker）
node index.js
```

**环境变量：**
- `QQMAP_KEY`：腾讯位置服务 API Key（[申请地址](https://lbs.qq.com/)）
- `PORT`：服务端口（默认 3000）

### 2. 配置环境变量

```bash
cp server/.env.example server/.env
# 然后编辑 server/.env，填入真实 Key
```

### 3. 配置小程序

修改 `miniprogram/app.js` 中的配置：

```javascript
globalData: {
  apiBase: 'http://你的服务器IP:3000/api',  // 开发环境用局域网IP
  qqmapKey: '你的腾讯地图Key',
}
```

修改 `miniprogram/app.json`：
```json
{
  "plugins": {
    "qqmap": {
      "version": "1.0.0",
      "provider": "腾讯位置服务"
    }
  }
}
```

### 3. 导入微信开发者工具

1. 打开微信开发者工具
2. 项目目录选择 `meetpoint-miniprogram/miniprogram`
3. 填入 AppID：在微信公众平台 → 开发管理 → 开发设置中获取
4. 确认导入

### 4. 配置地图 Key

在 [腾讯位置服务控制台](https://lbs.qq.com/) 申请 WebService API Key，然后在 `app.js` 里替换。

---

## API 列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/pair/create` | 创建配对 |
| POST | `/api/pair/join` | 加入配对 |
| DELETE | `/api/pair/:id` | 解除配对 |
| POST | `/api/location/update` | 上报位置 |
| GET | `/api/location/:pairId` | 获取双方位置 |
| POST | `/api/meeting/calculate` | 计算相遇点 |

---

## 注意事项

1. **域名白名单**：小程序请求的域名需要在微信公众平台配置（开发阶段可勾选"不校验合法域名"）
2. **定位权限**：需要用户授权位置权限才能使用
3. **腾讯地图 Key**：需要开通 WebService API（免费额度足够个人使用）
4. **配对有效期**：配对码 24 小时过期，过期后需重新创建