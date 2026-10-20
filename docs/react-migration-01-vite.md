# 第 1 课：让现有项目通过 Vite 运行

本课只调整项目的运行、构建和发布方式。页面继续由原来的 JavaScript 渲染，业务规则、数据格式和界面样式沿用现有实现。下一课再接入第一个 React 展示组件。

## 先认识目录

```text
index.html                    浏览器入口，引用 src/app.js
src/                          我们平时修改的 JavaScript 和 CSS
public/                       原样复制的图标和 PWA manifest
pwa/sw.js                     离线缓存脚本模板
scripts/build-service-worker.mjs  为实际构建产物生成离线清单
dist/                         构建出来的网站，忽略 Git 跟踪
tests/                        业务规则测试
tests/build/                  构建产物与离线缓存测试
```

过去 `dist/` 同时是源码目录和发布目录。现在我们编辑 `src/`，执行构建后生成 `dist/`。因此，直接修改 `dist/` 会在下一次构建时被覆盖。

## 三条命令解决三个问题

首次安装或拉取了依赖变更后，执行 `npm ci`。它按照 `package-lock.json` 安装确定的依赖版本；不要提交 `node_modules/`。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 用 Vite 开发服务器运行源码，默认 http://127.0.0.1:5173 |
| `npm run build` | 打包 JS/CSS、复制静态文件，并生成生产环境离线缓存脚本 |
| `npm run preview` | 本地查看已经生成的 `dist/`，默认 http://127.0.0.1:4173；先执行 build |

`npm run ...` 执行的是 `package.json` 的 `scripts`。例如 `dev` 对应 `vite`，npm 会找到项目依赖中的 Vite 命令。Vite 是开发和构建工具，所以放在 `devDependencies`；发布后的静态页面不需要运行 Node.js 或 Vite 服务。

`index.html` 的 `<script type="module" src="./src/app.js">` 是应用入口。Vite 从这里找到各层 `import`，再生成部署用的文件。构建后的 JS/CSS 名称会带内容标识，例如 `assets/index-xxxx.js`；资源内容变化时，文件名也会变化。

## 为什么还有离线构建脚本

现有 PWA 会缓存应用文件。源码文件打包后，原来固定写死的 `app.js`、`model.js` 等 URL 不再对应实际产物。因此，构建脚本读取完整的 `dist/` 文件列表，生成 `sw.js`，并根据文件内容生成缓存版本。无需再手动递增缓存编号。

生产环境保留原来的「新版本已就绪 · 点击更新」交互。开发环境不注册 Service Worker，便于看到刚改过的源码。如果同一个开发地址以前安装过旧版 Service Worker，可在开发者工具的 Application / Service Workers 中注销该开发地址的注册，再重新打开开发页面；无需删除 localStorage。

`vite.config.js` 的 `base: './'` 让资源使用相对路径，同时适配 GitHub Pages 的 `/habit-seasons/` 和原有根路径托管。项目依旧使用同一个本地存储键 `habit-seasons-v1` 与 v4 数据格式。不同域名、端口的本地存储各自独立，开发地址不会自动读取生产地址的记录；开发可使用样例数据或导入一份备份副本。

## 验证

```sh
npm test
npm run build
npm run test:build
```

业务测试直接导入 `src/`，可独立运行。构建测试在 build 之后执行，验证带内容标识的资源、GitHub Pages 子路径、离线访问、其他应用缓存隔离，以及静态文件更新时的缓存版本变化。GitHub Actions 也按这个顺序验证后发布 `dist/`。

## 你的练习

1. 找到 `package.json` 中 `dev`、`build`、`preview` 的具体命令。
2. 阅读根目录的 `index.html`，沿着 `src/app.js` 的 import 找到 `goal-ui.js`。
3. 在 `src/style.css` 中临时调整一个间距，观察开发页面；执行 build，对照生成的 CSS 文件名，然后恢复这次样式试验。

思考：修改了 `src/` 后，只重启 `npm run preview`，为什么可能看不到这次修改？

参考：[Vite 入门](https://vite.dev/guide/)、[静态资源](https://vite.dev/guide/assets.html)、[构建与部署](https://vite.dev/guide/static-deploy.html)。
