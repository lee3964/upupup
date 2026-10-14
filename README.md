# 模拟盘大厅（实时）

GitHub Pages 只托管前端；数据来自实时后台（Cloudflare 隧道 → paperbots `/api/state`）。

## 打开方式

1. 网站：`https://lee3964.github.io/upupup/?k=你的访问令牌`
2. 本地：用静态服务器打开本目录，或浏览器直接打开 `index.html`，同样带上 `?k=`。

访问令牌在运行环境的 `paperbots/data/web_token.txt`，**不要**提交到本仓库。

`config.js` 里的 `FLOOR_API` 是当前公网隧道；隧道重建后需更新该文件。

令牌会写入浏览器 localStorage（`pb_floor_k`），下次可省略 `?k=`。
