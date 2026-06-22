const fs = require('fs');
const path = require('path');
const fsEx = require('fs-extra');

const projectRoot = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const buildModulePath = path.join(projectRoot, 'node_modules', 'wpsjs', 'src', 'lib', 'build.js');
const publishListPath = path.join(projectRoot, 'node_modules', 'wpsjs', 'src', 'lib', 'publishlist.json');
const publishTemplatePath = path.join(projectRoot, 'node_modules', 'wpsjs', 'src', 'lib', 'res', 'publish.html');
const buildRoot = path.join(projectRoot, 'wps-addon-build');
const publishRoot = path.join(projectRoot, 'wps-addon-publish');
const serverUrl = process.env.WPS_PUBLISH_SERVER_URL;
const enableMultiUser = process.env.WPS_PUBLISH_MULTI_USER === 'true';

if (!serverUrl) {
  console.error('Missing WPS_PUBLISH_SERVER_URL');
  process.exit(1);
}

const normalizedServerUrl = serverUrl.endsWith('/') ? serverUrl : `${serverUrl}/`;
const publishAddon = {
  name: pkg.name,
  addonType: pkg.addonType,
  online: 'true',
  multiUser: enableMultiUser ? 'true' : 'false',
  customDomain: pkg.customDomain || '',
  url: normalizedServerUrl
};

function writePublishList() {
  const nextList = {
    [publishAddon.name]: publishAddon
  };

  fs.writeFileSync(publishListPath, JSON.stringify(nextList));
}

async function buildOnlineArtifacts() {
  const buildModule = require(buildModulePath);
  await buildModule.buildWithArgs({ pluginType: 'online' });
}

function createPublishPage() {
  fsEx.ensureDirSync(publishRoot);

  const publishList = JSON.parse(fs.readFileSync(publishListPath, 'utf8'));
  const publishItems = Object.keys(publishList).map((key) => publishList[key]);
  let publishHtml = fs.readFileSync(publishTemplatePath, 'utf8');

  publishHtml = publishHtml.replace(/PUBLISH_REPLACE_STRING/, JSON.stringify(publishItems));
  publishHtml = publishHtml.replace(
    /SERVERID_REPLEASE_STRING/,
    enableMultiUser ? 'getServerId()' : 'undefined'
  );

  fs.writeFileSync(path.join(publishRoot, 'publish.html'), publishHtml);
}

function ensurePublishArtifacts() {
  if (!fs.existsSync(path.join(buildRoot, 'ribbon.xml'))) {
    console.error('wps-addon-build/ribbon.xml not found.');
    process.exit(1);
  }

  if (!fs.existsSync(path.join(publishRoot, 'publish.html'))) {
    console.error('wps-addon-publish/publish.html not found.');
    process.exit(1);
  }
}

function copyPublishPageIntoBuild() {
  fsEx.copyFileSync(
    path.join(publishRoot, 'publish.html'),
    path.join(buildRoot, 'publish.html')
  );
}

function createMacInstallerScript() {
  const publishXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<jsplugins>
  <jspluginonline name="${publishAddon.name}" type="${publishAddon.addonType}" url="${publishAddon.url}" debug="" enable="enable_dev" install="null" customDomain="${publishAddon.customDomain}"/>
</jsplugins>
`;
  const installer = `#!/bin/bash
set -euo pipefail

ADDON_DIR="$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons"
PUBLISH_XML="$ADDON_DIR/publish.xml"
AUTH_JSON="$ADDON_DIR/authaddin.json"
STAMP="$(date +%Y%m%d%H%M%S)"
LOG_FILE="${'${TMPDIR:-/tmp}'}/${publishAddon.name}-install.log"

{
  echo "[INFO] Starting ${publishAddon.name} installer"
  echo "[INFO] Target directory: $ADDON_DIR"

  mkdir -p "$ADDON_DIR"

  if [ -f "$PUBLISH_XML" ]; then
    cp "$PUBLISH_XML" "$PUBLISH_XML.bak.$STAMP"
    echo "[INFO] Backed up $PUBLISH_XML"
  fi

  cat > "$PUBLISH_XML" <<'XML'
${publishXml}XML
  echo "[INFO] Wrote $PUBLISH_XML"

  if [ -f "$AUTH_JSON" ] && grep -q '"name"[[:space:]]*:[[:space:]]*"${publishAddon.name}"' "$AUTH_JSON"; then
    cp "$AUTH_JSON" "$AUTH_JSON.bak.$STAMP"
    rm "$AUTH_JSON"
    echo "[INFO] Removed cached auth file $AUTH_JSON"
  fi

  echo "[INFO] Done"
} > "$LOG_FILE" 2>&1 || {
  echo "安装失败，请查看日志：$LOG_FILE"
  cat "$LOG_FILE"
  if [ "${'${1:-}'}" != "--no-pause" ]; then
    echo
    read -r -p "按回车退出..."
  fi
  exit 1
}

cat "$LOG_FILE"
echo
echo "WPS 加载项 ${publishAddon.name} 已写入：$PUBLISH_XML"
echo "请完全退出 WPS 后重新打开 WPS 演示。"
echo "安装日志：$LOG_FILE"
if [ "${'${1:-}'}" != "--no-pause" ]; then
  read -r -p "按回车退出..."
fi
`;

  [buildRoot, publishRoot].forEach((root) => {
    const installerPath = path.join(root, 'install-mac.command');
    fs.writeFileSync(installerPath, installer, { mode: 0o755 });
    fs.chmodSync(installerPath, 0o755);
  });
}

function createWindowsInstallerScript() {
  const installer = `@echo off
setlocal EnableExtensions

set "LOG_FILE=%TEMP%\\${publishAddon.name}-install.log"
echo [INFO] Starting ${publishAddon.name} installer > "%LOG_FILE%"

call :main >> "%LOG_FILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

type "%LOG_FILE%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo Installation failed. Check log: %LOG_FILE%
  if /I not "%~1"=="--no-pause" pause
  exit /b %EXIT_CODE%
)

echo WPS addin ${publishAddon.name} has been written to publish.xml.
echo Fully quit WPS, then reopen WPS Presentation.
echo Install log: %LOG_FILE%
if /I not "%~1"=="--no-pause" pause
endlocal
exit /b 0

:main
set "ADDON_DIR=%APPDATA%\\kingsoft\\wps\\jsaddons"
set "PUBLISH_XML=%ADDON_DIR%\\publish.xml"
set "AUTH_JSON=%ADDON_DIR%\\authaddin.json"
set "STAMP="

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMddHHmmss"') do set "STAMP=%%i"
if not defined STAMP set "STAMP=%RANDOM%%RANDOM%"

echo [INFO] Target directory: %ADDON_DIR%

if not exist "%ADDON_DIR%" (
  mkdir "%ADDON_DIR%" || exit /b 1
)

if exist "%PUBLISH_XML%" (
  copy /Y "%PUBLISH_XML%" "%PUBLISH_XML%.bak.%STAMP%" >nul || exit /b 1
  echo [INFO] Backed up %PUBLISH_XML%
)

(
echo ^<?xml version="1.0" encoding="UTF-8" standalone="yes"?^>
echo ^<jsplugins^>
echo   ^<jspluginonline name="${publishAddon.name}" type="${publishAddon.addonType}" url="${publishAddon.url}" debug="" enable="enable_dev" install="null" customDomain="${publishAddon.customDomain}"/^>
echo ^</jsplugins^>
) > "%PUBLISH_XML%"
if errorlevel 1 exit /b 1
echo [INFO] Wrote %PUBLISH_XML%

if exist "%AUTH_JSON%" (
  findstr /I /C:"${publishAddon.name}" "%AUTH_JSON%" >nul
  if not errorlevel 1 (
    copy /Y "%AUTH_JSON%" "%AUTH_JSON%.bak.%STAMP%" >nul || exit /b 1
    del /F /Q "%AUTH_JSON%" || exit /b 1
    echo [INFO] Removed cached auth file %AUTH_JSON%
  )
)

echo [INFO] Done
exit /b 0
`;

  [buildRoot, publishRoot].forEach((root) => {
    const installerPath = path.join(root, 'install-win.cmd');
    fs.writeFileSync(installerPath, installer.replace(/\n/g, '\r\n'), 'utf8');
  });
}

async function main() {
  await buildOnlineArtifacts();
  writePublishList();
  createPublishPage();
  ensurePublishArtifacts();
  copyPublishPageIntoBuild();
  createMacInstallerScript();
  createWindowsInstallerScript();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
