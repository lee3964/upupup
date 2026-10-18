# 模拟盘大厅（实时）

GitHub Pages 只托管前端；数据来自实时后台（命名 Cloudflare 隧道 `https://api.kinglee.si` → paperbots `/api/state`）。备份主机名 `https://api.lee3964.xyz`。

## 打开方式

1. 大厅：`https://lee3964.github.io/upupup/?k=你的访问令牌`
2. **late A/B 竞赛（3×2）**：`https://lee3964.github.io/upupup/compare.html?k=…`  
   行 = book+z / logit×z；列 = 60-scan / 120-scan / T-60；右下格为 **LIVE**（logit×T-60）。订单对齐六列（5 paper + LIVE）。
3. **做市（独立页）**：`https://lee3964.github.io/upupup/maker.html?k=…`
4. 本地：`http://127.0.0.1:8787/compare.html` · `http://127.0.0.1:8787/maker.html`（需令牌）。

访问令牌在运行环境的 `paperbots/data/web_token.txt`，**不要**提交到本仓库。

`config.js` 里的 `FLOOR_API` 固定为 `https://api.kinglee.si`。
