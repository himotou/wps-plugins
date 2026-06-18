# WPS 链接绑定插件

选中一段文字后点击功能区按钮，会弹出链接绑定窗口；如果当前选区已有超链接，会自动回填。没有选中文字时，只显示“未选择”。

## 用法

1. `npm install`
2. `npm run dev`
3. 在 WPS 里打开文档后选中文字
4. 点击“设置超链接”

## 说明

- 选中文本时，确认后直接给原文字写入超链接
- 已有超链接时，会把原链接带到弹框里
- 没有选中时，只显示“未选择”

## 线上发布到 GitHub

这个项目现在按 `wpsjs publish` 的发布方式来走，GitHub Pages 承载 `wps-addon-build` 目录内容。

### 1. 推送到 GitHub 仓库

建议用 `main` 分支作为发布分支。

### 2. 启用 GitHub Pages

仓库里已经带了 `.github/workflows/deploy-pages.yml`。

在 GitHub 仓库中执行：

1. 打开 `Settings`
2. 打开 `Pages`
3. `Source` 选择 `GitHub Actions`

之后每次 push 到 `main`，都会自动构建并发布 `wps-addon-build`。

### 3. 确认线上地址

发布成功后，静态资源通常会在下面两种地址之一：

- 用户主页仓库：`https://<github-user>.github.io/`
- 项目仓库：`https://<github-user>.github.io/<repo-name>/`

部署完成后，至少要确认这两个地址能正常访问：

- `https://<your-pages-url>/index.html`
- `https://<your-pages-url>/ribbon.xml`

其中 `ribbon.xml` 打开后应该能看到以 `<customUI` 开头的 XML。

### 4. 在 WPS 中走线上加载

这个项目现在直接使用 `wpsjs publish` 生成的 `publish.html`。WPS 里你看到的“已安装加载项”页面通常没有手动输入 URL 的输入框，所以推荐直接用浏览器打开安装页完成安装。

以当前仓库为例，线上安装步骤如下：

1. 打开 `https://himotou.github.io/wps-plugins/publish.html`
2. 如果浏览器提示是否打开 WPS，请允许
3. 页面出现 `link-bind` 行后，点击“安装”
4. 回到 WPS 演示，完全退出并重新打开，检查功能区里是否出现“链接绑定”

官方 `publish.html` 依赖 WPS 本机加载项服务写入本地 `publish.xml`。如果页面只显示表头，没有出现 `link-bind` 行，通常说明本机加载项服务没有响应，这时线上 `ribbon.xml` 是否可访问不能代表安装流程已经跑通。

如果之前装过本地调试版 `http://127.0.0.1:3890`，建议先在安装页点一次“卸载”，再点“安装 / 更新”，避免本地版本和线上版本混在一起。

当前线上关键地址是：

- 站点首页：`https://himotou.github.io/wps-plugins/index.html`
- 安装页：`https://himotou.github.io/wps-plugins/publish.html`
- 插件描述：`https://himotou.github.io/wps-plugins/ribbon.xml`

### 5. 注意事项

- 这个项目已经修正了 GitHub Pages 子路径下的路由拼接问题。
- 如果你改了仓库名，Pages 地址也会跟着变。
- `manifest.xml` 目前还是模板内容，只影响插件元信息展示，不影响当前页面逻辑验证。
