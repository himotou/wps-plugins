// 在后续的wps版本中，wps的所有枚举值都会通过wps.Enum对象来自动支持，现阶段先人工定义
var WPS_Enum = {
    msoCTPDockPositionLeft: 0,
    msoCTPDockPositionRight: 2,
    ppMouseClick: 1,
    ppActionHyperlink: 7
}

function GetUrlPath() {
    if (window.location.protocol === 'file:') {
        const path = decodeURI(window.location.href)
        return path.substring(0, path.lastIndexOf('/'))
    }

    const { protocol, hostname, port } = window.location
    const portPart = port ? `:${port}` : ''
    return `${protocol}//${hostname}${portPart}`
}

function GetRouterHash() {
    if (window.location.protocol === 'file:') {
        return ''
    }

    return '/#'
}

function BuildRouteUrl(routePath) {
    const normalizedRoute = routePath.startsWith('/') ? routePath : `/${routePath}`
    return `${GetUrlPath()}${GetRouterHash()}${normalizedRoute}`
}

function AppendQuery(url, params) {
    const hasQuery = url.indexOf('?') >= 0
    const query = Object.keys(params)
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&')
    return `${url}${hasQuery ? '&' : '?'}${query}`
}

export default {
    WPS_Enum,
    GetUrlPath,
    GetRouterHash,
    BuildRouteUrl,
    AppendQuery
}
