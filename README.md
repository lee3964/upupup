# 模拟盘大厅（实时）

GitHub Pages 只托管前端；数据来自实时后台（命名 Cloudflare 隧道 `https://api.kinglee.si` → paperbots `/api/state`）。旧主机名 `https://api.lee3964.xyz` 仍可作为备份，直到确认新域名稳定。

## 打开方式

1. 网站：`https://lee3964.github.io/upupup/?k=你的访问令牌`
2. 四系统对比：`https://lee3964.github.io/upupup/compare.html?k=你的访问令牌`（大厅页眉「四系统对比」进同一页，令牌会带上）。四路为尾盘 60→10、尾盘 120→10、做市、实盘尾盘。
3. 本地：用静态服务器打开本目录，或浏览器直接打开 `index.html`，同样带上 `?k=`。

访问令牌在运行环境的 `paperbots/data/web_token.txt`，**不要**提交到本仓库。

`config.js` 里的 `FLOOR_API` 固定为命名 Cloudflare 隧道 `https://api.kinglee.si`。大厅和四系统对比都读取这个地址。

令牌会写入浏览器 localStorage（`pb_floor_k`），下次可省略 `?k=`。
