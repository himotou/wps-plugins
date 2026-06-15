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
  customDomain: pkg.customDomain,
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
