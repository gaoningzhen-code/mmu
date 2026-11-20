# MMU · 搭配挂机

- `public/index.html`：游戏本体（单文件，由 `src/build.py` 生成）
- `netlify/functions/save.mjs`：云存档接口 `/api/save`（Netlify Functions + Netlify Blobs）
- 修改代码：编辑 `src/` 下文件，`cd src && python3 build.py`，提交后 Netlify 自动部署
