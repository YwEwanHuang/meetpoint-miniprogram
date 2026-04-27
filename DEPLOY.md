# ============================================================
# MeetPoint 服务部署指南
# 服务器: 39.105.107.5
# 域名: meetpoint.ewanandalina.top
# ============================================================

## 一、服务器环境确认

```bash
# 查看 Node.js 和 npm 版本
node --version
npm --version

# 查看 Nginx
nginx -v

# 查看系统
cat /etc/os-release
```

如果 Node.js 未安装：
```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 或用 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

---

## 二、项目上传到服务器

在本地（或通过 Git）把项目拉到服务器：

```bash
# 创建目录
sudo mkdir -p /var/www/meetpoint && cd /var/www/meetpoint

# 如果用 Git（服务器上已有仓库）
cd /var/www/meetpoint
git clone https://github.com/YwEwanHuang/meetpoint-miniprogram.git .

# 或手动 rsync / scp 上传
```

---

## 三、安装后端依赖

```bash
cd /var/www/meetpoint/server

# 创建 .env 文件（填入真实 Key）
nano .env
# 内容：
# QQMAP_KEY=<你的腾讯位置服务Key>
# SERVERCHAN_KEY=<你的Server酱Key（可选）>
# PORT=3000

# 安装依赖
npm install
```

---

## 四、用 PM2 运行服务（生产环境）

```bash
# 全局安装 PM2
npm install -g pm2

# 启动服务
cd /var/www/meetpoint/server
pm2 start index.js --name meetpoint

# 设置开机自启
pm2 startup
pm2 save

# 检查运行状态
pm2 status
pm2 logs meetpoint
```

服务运行在 `http://localhost:3000`

---

## 五、配置 Nginx（反向代理 + SSL）

```bash
# 安装 certbot（ Let's Encrypt 免费SSL ）
sudo apt install -y certbot python3-certbot-nginx

# 申请 SSL 证书（域名需已解析到服务器）
sudo certbot --nginx -d meetpoint.ewanandalina.top
```

创建 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/meetpoint
```

内容：
```nginx
server {
    listen 80;
    server_name meetpoint.ewanandalina.top;

    # 强制跳转 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name meetpoint.ewanandalina.top;

    ssl_certificate /etc/letsencrypt/live/meetpoint.ewanandalina.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/meetpoint.ewanandalina.top/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/meetpoint /etc/nginx/sites-enabled/
sudo nginx -t           # 测试配置
sudo systemctl reload nginx
```

---

## 六、防火墙开放端口

```bash
# 开放 80 和 443
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw enable

# 检查端口是否通
curl -I https://meetpoint.ewanandalina.top
```

---

## 七、验证服务

```bash
# 健康检查
curl http://localhost:3000/api/health

# 预期输出: {"status":"ok","pairs":0}
```

---

## 八、之后更新代码

```bash
cd /var/www/meetpoint
git pull
cd server && pm2 restart meetpoint
```

---

## 九、小程序端配置

修改 `miniprogram/app.js`：

```javascript
apiBase: 'https://meetpoint.ewanandalina.top/api',
qqmapKey: '<你的腾讯位置服务Key>',
```

---

## 十、微信公众平台配置

登录 mp.weixin.qq.com → 开发管理 → 开发设置：

1. **服务器域名** → 添加 `request 合法域名`：
   ```
   https://meetpoint.ewanandalina.top
   ```

2. 开发阶段可勾选"不校验合法域名"绕过