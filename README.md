# 铁大 AI Lab 协会官网

石家庄铁道大学 AI.Lab 协会的静态网站，介绍社团、入社登记和 GitHub 开源组织 Ironseed Lab。

本地预览先运行 `npm ci`，再运行 `npm run dev` 并打开 `http://localhost:8000`。生产构建命令是 `npm run build`，输出到 `dist/`。

首屏用 Three.js 加载从社团 Blender 模型导出的徽章。缺少 WebGL 时显示静态徽章，系统启用减少动态效果时使用静态视角。

向官网提交修正或建议，可以通过本仓库的 Issue 和 Pull Request。入门路线整理在[飞书知识库](https://ecnzifm6trb8.feishu.cn/docx/U9QkdPv2qo8rbqx0E6cc2g4YnYb)，可通过「知识库共建建议」Issue 模板反馈。想加入 Ironseed Lab，可在协会群联系组织管理员，提供 GitHub 用户名和想参与的方向。

Vercel CLI 生产部署命令为 `vercel deploy --prod`。
