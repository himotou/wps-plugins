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
  publishHtml = publishHtml.replace(
    /function LoadAddons\(\) \{([\s\S]*?)InitSdk\(\);([\s\S]*?)\}/,
    `function LoadAddons() {$1LoadPublishAddons();
            InitSdk();$2}`
  );
  publishHtml = publishHtml.replace(
    /function CheckPlugin\(element\) \{[\s\S]*?function GetAddonId\(element\) \{/,
    `function CheckPlugin(element) {
            var id = GetAddonId(element);
            var ele = document.getElementById(id + "_status");
            var offline = element.online === "false";
            var url = offline ? element.url : element.url + "ribbon.xml";
            var xmlReq = getHttpObj();
            xmlReq.open("GET", url);
            xmlReq.onload = function (res) {
                var response = IEVersion() < 10 ? xmlReq.responseText : res.target.response;
                if ((offline && response.startsWith("7z"))
                    || !offline && response.startsWith("<customUI")) {
                    ele.style.color = "green";
                    ele.style.textAlign = "center";
                    ele.innerHTML = "正常";
                } else {
                    ele.style.color = "white";
                    ele.style.backgroundColor = "gray";
                    ele.style.textAlign = "center";
                    ele.innerHTML = "无效";
                    ele.title = offline ? ("不是有效的7z格式" + url) : ("不是有效的ribbon.xml，" + url);
                }
            }
            xmlReq.onerror = function () {
                ele.style.color = "white";
                ele.style.backgroundColor = "gray";
                ele.style.textAlign = "center";
                ele.innerHTML = "无效";
                ele.title = "网页路径不可访问：" + url;
            }
            xmlReq.ontimeout = function () {
                ele.style.color = "white";
                ele.style.backgroundColor = "gray";
                ele.style.textAlign = "center";
                ele.innerHTML = "异常";
                ele.title = "访问超时，" + url;
            }
            if (IEVersion() < 10) {
                xmlReq.onreadystatechange = function () {
                    if (xmlReq.readyState != 4)
                        return;
                    if (xmlReq.bTimeout) {
                        return;
                    }
                    if (xmlReq.status === 200)
                        xmlReq.onload();
                    else
                        xmlReq.onerror();
                }
            }
            xmlReq.timeout = 5000;
            xmlReq.send(null);
        }

        function GetAddonId(element) {`
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

async function main() {
  await buildOnlineArtifacts();
  writePublishList();
  createPublishPage();
  ensurePublishArtifacts();
  copyPublishPageIntoBuild();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
