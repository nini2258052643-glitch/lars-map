/* =====================================================
   LARS / IN TRANSIT - HYBRID INDEXEDDB & STORAGE BRIDGE
   彻底解决浏览器 localStorage 5MB 配额上限导致的 QuotaExceededError
===================================================== */
const LARS_IDB_NAME = "LarsTravelImageDB";
const LARS_IDB_STORE = "lars_data_store";
if (typeof window !== "undefined") {
    window._larsStorageCache = window._larsStorageCache || {};
}

function openLarsDB() {
    return new Promise((resolve) => {
        if (typeof window === "undefined" || !window.indexedDB) return resolve(null);
        try {
            const req = window.indexedDB.open(LARS_IDB_NAME, 1);
            req.onupgradeneeded = function (e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(LARS_IDB_STORE)) {
                    db.createObjectStore(LARS_IDB_STORE);
                }
            };
            req.onsuccess = function (e) {
                resolve(e.target.result);
            };
            req.onerror = function () {
                resolve(null);
            };
        } catch (e) {
            resolve(null);
        }
    });
}

function idbSave(key, value) {
    if (!key) return;
    if (typeof window !== "undefined") {
        window._larsStorageCache = window._larsStorageCache || {};
        window._larsStorageCache[key] = value;
    }
    openLarsDB().then((db) => {
        if (!db) return;
        try {
            const tx = db.transaction(LARS_IDB_STORE, "readwrite");
            const store = tx.objectStore(LARS_IDB_STORE);
            store.put(value, key);
        } catch (err) {
            console.warn("IndexedDB put error:", err);
        }
    });
}

function initStorageBridge() {
    openLarsDB().then((db) => {
        if (!db) return;
        try {
            const tx = db.transaction(LARS_IDB_STORE, "readonly");
            const store = tx.objectStore(LARS_IDB_STORE);
            const req = store.openCursor();
            req.onsuccess = function (e) {
                const cursor = e.target.result;
                if (cursor) {
                    if (typeof window !== "undefined") {
                        window._larsStorageCache = window._larsStorageCache || {};
                        window._larsStorageCache[cursor.key] = cursor.value;
                    }
                    cursor.continue();
                }
            };
        } catch (e) {}
    });
}

if (typeof window !== "undefined") {
    initStorageBridge();
}


function extractPlacePhotos(place) {
    if (!place) return [];
    if (Array.isArray(place.photos)) return place.photos.filter(Boolean);
    if (typeof place.photo === "string" && place.photo.trim()) return [place.photo.trim()];
    if (Array.isArray(place.images)) return place.images.filter(Boolean);
    if (typeof place.image === "string" && place.image.trim()) return [place.image.trim()];
    return [];
}


function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getPlaceLinks(place) {
    if (!place) return [];
    if (Array.isArray(place.links)) {
        return place.links.filter(l => l && (l.url || l.name));
    }
    if (place.link && typeof place.link === "string" && place.link.trim()) {
        return [{ name: "外部链接", url: place.link.trim() }];
    }
    return [];
}

/* =====================================================
   LARS / IN TRANSIT
   script.js

   本版本只修改：
   1. 地图省份亮 / 暗逻辑
   2. 城市点击一次放大，再点一次退出
   3. MEMORY 可滚动 + 点击进入独立记忆页面

   其他原有功能保持不变
===================================================== */


/* =====================================================
   页面
===================================================== */

const homePage = document.querySelector("#home-page");
const mapPage = document.querySelector("#map-page");
const enterMap = document.querySelector("#enter-map");
const backHome = document.querySelector("#back-home");


/* =====================================================
   日记面板
===================================================== */

const placePanel = document.querySelector("#place-panel");
const closePlace = document.querySelector("#close-place");
const placeTitle = document.querySelector("#place-title");
const placeLocation = document.querySelector("#place-location");
const placeDescription = document.querySelector("#place-description");


/* =====================================================
   地图容器
===================================================== */

const mapFrame = document.querySelector("#map-frame");
const mapViewport = document.querySelector("#map-viewport");


/* =====================================================
   城市数据
===================================================== */

const cities = [

    {
        id: "macao",
        name: "澳门",
        province: "澳门",
        x: 730.8,
        y: 740.5,
        description: "Lars关于澳门的记忆"
    },

    {
        id: "beijing",
        name: "北京",
        province: "北京",
        x: 736.9,
        y: 335.3,
        description: "Lars关于北京的记忆"
    },

    {
        id: "xiamen",
        name: "厦门",
        province: "福建",
        x: 819.6,
        y: 666.8,
        description: "Lars关于厦门的记忆"
    },

    {
        id: "changsha",
        name: "长沙",
        province: "湖南",
        x: 706.5,
        y: 599.5,
        description: "Lars关于长沙的记忆"
    },

    {
        id: "nanjing",
        name: "南京",
        province: "江苏",
        x: 814.6,
        y: 502.3,
        description: "Lars关于南京的记忆"
    },

    {
        id: "hangzhou",
        name: "杭州",
        province: "浙江",
        x: 834.4,
        y: 538.4,
        description: "Lars关于杭州的记忆"
    },

    {
        id: "jiaxing",
        name: "嘉兴",
        province: "浙江",
        x: 842.5,
        y: 531.0,
        description: "Lars关于嘉兴的记忆"
    },

    {
        id: "shanghai",
        name: "上海",
        province: "上海",
        x: 861.0,
        y: 515.1,
        description: "Lars关于上海的记忆"
    },

    {
        id: "haikou",
        name: "海口",
        province: "海南",
        x: 670.3,
        y: 796.7,
        description: "Lars关于海口的记忆"
    },

    {
        id: "zhengzhou",
        name: "郑州",
        province: "河南",
        x: 703.9,
        y: 468.5,
        description: "Lars关于郑州的记忆"
    },

    {
        id: "luzhou",
        name: "泸州",
        province: "四川",
        x: 568.0,
        y: 598.0,
        description: "Lars关于泸州的记忆"
    },

    {
        id: "changzhou",
        name: "常州",
        province: "江苏",
        x: 821.0,
        y: 515.0,
        description: "Lars关于常州的记忆"
    },

    {
        id: "wuyuan",
        name: "婺源",
        province: "江西",
        x: 782.0,
        y: 568.0,
        description: "Lars关于婺源的记忆"
    },

    {
        id: "nanning",
        name: "南宁",
        province: "广西",
        x: 626.4,
        y: 731.9,
        description: "Lars关于南宁的记忆"
    },

    {
        id: "yangzhou",
        name: "扬州",
        province: "江苏",
        x: 807.6,
        y: 503.8,
        description: "Lars关于扬州的记忆"
    },

    {
        id: "wuhan",
        name: "武汉",
        province: "湖北",
        x: 724.4,
        y: 547.3,
        description: "Lars关于武汉的记忆"
    },

    {
        id: "guangzhou",
        name: "广州",
        province: "广东",
        x: 730.9,
        y: 717.5,
        description: "Lars关于广州的记忆"
    },

    {
        id: "wuxi",
        name: "无锡",
        province: "江苏",
        x: 829.0,
        y: 518.0,
        description: "Lars关于无锡的记忆"
    },

    {
        id: "baotou",
        name: "包头",
        province: "内蒙古",
        x: 646.0,
        y: 320.0,
        description: "Lars关于包头的记忆"
    },

    {
        id: "zhuzhou",
        name: "株洲",
        province: "湖南",
        x: 709.7,
        y: 612.4,
        description: "Lars关于株洲的记忆"
    },

    {
        id: "shenyang",
        name: "沈阳",
        province: "辽宁",
        x: 840.2,
        y: 289.3,
        description: "Lars关于沈阳的记忆"
    },

    {
        id: "chongzuo",
        name: "崇左",
        province: "广西",
        x: 612.0,
        y: 742.0,
        description: "Lars关于崇左的记忆"
    },

    {
        id: "shenzhen",
        name: "深圳",
        province: "广东",
        x: 748.3,
        y: 735.8,
        description: "Lars关于深圳的记忆"
    },

    {
        id: "hefei",
        name: "合肥",
        province: "安徽",
        x: 780.7,
        y: 514.6,
        description: "Lars关于合肥的记忆"
    },

    {
        id: "qingdao",
        name: "青岛",
        province: "山东",
        x: 818.7,
        y: 409.8,
        description: "Lars关于青岛的记忆"
    },

    {
        id: "dongguan",
        name: "东莞",
        province: "广东",
        x: 738.0,
        y: 726.0,
        description: "Lars关于东莞的记忆"
    },

    {
        id: "haerbin",
        name: "哈尔滨",
        province: "黑龙江",
        x: 888.7,
        y: 177.3,
        description: "Lars关于哈尔滨的记忆"
    },

    {
        id: "chengdu",
        name: "成都",
        province: "四川",
        x: 542.5,
        y: 560.5,
        description: "Lars关于成都的记忆"
    },

    {
        id: "ningbo",
        name: "宁波",
        province: "浙江",
        x: 868.6,
        y: 543.9,
        description: "Lars关于宁波的记忆"
    },

    {
        id: "chongqing",
        name: "重庆",
        province: "重庆",
        x: 582.4,
        y: 584.3,
        description: "Lars关于重庆的记忆"
    },

    {
        id: "huainan",
        name: "淮南",
        province: "安徽",
        x: 776.0,
        y: 494.0,
        description: "Lars关于淮南的记忆"
    },

    {
        id: "guiyang",
        name: "贵阳",
        province: "贵州",
        x: 594.7,
        y: 639.7,
        description: "Lars关于贵阳的记忆"
    },

    {
        id: "xishuangbanna",
        name: "西双版纳",
        province: "云南",
        x: 492.0,
        y: 746.0,
        description: "Lars关于西双版纳的记忆"
    },

    {
        id: "putian",
        name: "莆田",
        province: "福建",
        x: 828.5,
        y: 650.0,
        description: "Lars关于莆田的记忆"
    },

    {
        id: "baoding",
        name: "保定",
        province: "河北",
        x: 726.0,
        y: 358.0,
        description: "Lars关于保定的记忆"
    },

    {
        id: "handan",
        name: "邯郸",
        province: "河北",
        x: 712.0,
        y: 418.0,
        description: "Lars关于邯郸的记忆"
    },

    {
        id: "fuyang",
        name: "阜阳",
        province: "安徽",
        x: 745.0,
        y: 482.0,
        description: "Lars关于阜阳的记忆"
    },

    {
        id: "zaozhuang",
        name: "枣庄",
        province: "山东",
        x: 770.0,
        y: 442.0,
        description: "Lars关于枣庄的记忆"
    },

    {
        id: "shaoxing",
        name: "绍兴",
        province: "浙江",
        x: 850.0,
        y: 541.0,
        description: "Lars关于绍兴的记忆"
    },

    {
        id: "zunyi",
        name: "遵义",
        province: "贵州",
        x: 590.0,
        y: 612.0,
        description: "Lars关于遵义的记忆"
    },

    {
        id: "xian",
        name: "西安",
        province: "陕西",
        x: 620.3,
        y: 479.3,
        description: "Lars关于西安的记忆"
    },

    {
        id: "tianjin",
        name: "天津",
        province: "天津",
        x: 758.7,
        y: 353.9,
        description: "Lars关于天津的记忆"
    },

    {
        id: "taiyuan",
        name: "太原",
        province: "山西",
        x: 677.7,
        y: 386.0,
        description: "Lars关于太原的记忆"
    },

    {
        id: "lvliang",
        name: "吕梁",
        province: "山西",
        x: 655.0,
        y: 392.0,
        description: "Lars关于吕梁的记忆"
    },

    {
        id: "kashi",
        name: "喀什",
        province: "新疆",
        x: 126.0,
        y: 382.0,
        description: "Lars关于喀什的记忆"
    }
];


/* =====================================================
   所有原 SVG 城市点
   用于把原图里没有交互功能的黑色小点清掉。

   注意：
   这些不是网站的交互城市。
   这里只是原 SVG 内部的点位置。
===================================================== */

const originalSvgCityPoints = [

    { x: 888.691, y: 177.301 },
    { x: 818.696, y: 409.846 },
    { x: 766.587, y: 412.806 },
    { x: 834.376, y: 538.353 },
    { x: 870.345, y: 232.154 },
    { x: 840.175, y: 289.336 },
    { x: 814.576, y: 502.258 },
    { x: 529.477, y: 440.815 },
    { x: 819.629, y: 666.849 },
    { x: 730.857, y: 717.485 },
    { x: 765.267, y: 587.116 },
    { x: 294.369, y: 575.742 },
    { x: 724.380, y: 547.347 },
    { x: 706.455, y: 599.511 },
    { x: 510.318, y: 695.119 },
    { x: 703.854, y: 468.498 },
    { x: 265.104, y: 241.267 },
    { x: 620.265, y: 479.299 },
    { x: 542.457, y: 560.471 },
    { x: 838.368, y: 633.876 },
    { x: 627.948, y: 422.010 },
    { x: 677.665, y: 386.015 },
    { x: 860.955, y: 515.055 },
    { x: 758.719, y: 353.890 },
    { x: 736.916, y: 335.280 },
    { x: 582.388, y: 584.291 },
    { x: 626.401, y: 731.926 },
    { x: 594.664, y: 639.695 },
    { x: 685.556, y: 347.235 },
    { x: 846.823, y: 377.350 },
    { x: 831.345, y: 342.295 },
    { x: 477.347, y: 425.344 },
    { x: 878.618, y: 656.827 },
    { x: 670.288, y: 796.675 },
    { x: 665.115, y: 319.161 },
    { x: 716.268, y: 382.428 },
    { x: 748.272, y: 735.761 },
    { x: 730.806, y: 740.493 },
    { x: 660.727, y: 673.615 },
    { x: 780.728, y: 514.581 },
    { x: 570.424, y: 387.439 },
    { x: 840.645, y: 511.687 },
    { x: 774.503, y: 459.494 },
    { x: 854.876, y: 584.558 },
    { x: 868.583, y: 543.863 }
];


/* =====================================================
   状态
===================================================== */

let currentCity = null;

let cityHotspots = [];

let hotspotAnimationStarted = false;

let mapImage = null;

let mapSourceImage = null;

let mapScale = 1;

let mapX = 0;

let mapY = 0;

let dragging = false;

let dragStartX = 0;

let dragStartY = 0;

let startMapX = 0;

let startMapY = 0;

let mapNaturalWidth = 1000;

let mapNaturalHeight = 850;

let mapIsAnimating = false;


/* =====================================================
   首页
===================================================== */

if (homePage) {

    homePage.classList.add("active");

    homePage.style.display = "";

    homePage.style.visibility = "visible";
}


/* =====================================================
   进入地图
===================================================== */

if (enterMap) {

    enterMap.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();


            if (homePage) {

                homePage.classList.remove(
                    "active"
                );

                homePage.style.visibility =
                    "hidden";

                homePage.style.pointerEvents =
                    "none";
            }


            if (mapPage) {

                mapPage.classList.add(
                    "active"
                );

                mapPage.style.display =
                    "block";

                mapPage.style.visibility =
                    "visible";

                mapPage.style.opacity =
                    "1";

                mapPage.style.pointerEvents =
                    "auto";

                mapPage.style.transform =
                    "none";

                mapPage.style.zIndex =
                    "100";

                mapPage.style.position =
                    "fixed";

                mapPage.style.left =
                    "0";

                mapPage.style.top =
                    "0";

                mapPage.style.width =
                    "100vw";

                mapPage.style.height =
                    "100vh";
            }


            setTimeout(
                function () {

                    createLocalMap();

                },
                50
            );
        }
    );
}


/* =====================================================
   创建地图
===================================================== */

let isMapRendered = false;

function createLocalMap() {
    if (!mapViewport) return;
    mapViewport.style.cursor = "grab";

    const oldSvg = document.querySelector("#china-map");
    if (oldSvg) {
        oldSvg.style.display = "none";
    }

    const oldCanvas = document.querySelector("#local-china-map");
    if (oldCanvas && isMapRendered) {
        mapImage = oldCanvas;
        createCityHotspots();
        resetMap();
        return;
    }

    createProcessedMap();
    setupDragging();
    setupWheel();
}


/* =====================================================
   创建处理后的地图

   核心逻辑：

   原地图：
   省份 = #99CC99
   城市点 = #32432e

   现在：
   有你指定城市的省份 = 亮绿色
   没有指定城市的省份 = 暗灰绿色
   所有原来的城市黑点 = 删除

   最终仍然是一张地图。
===================================================== */

/* =====================================================
   省份映射与动态点亮系统
===================================================== */

const provinceIdToName = {
    pBJ: "北京", pTJ: "天津", pHE: "河北", pSX: "山西", pNM: "内蒙古",
    pLN: "辽宁", pJL: "吉林", pHJ: "黑龙江", pSH: "上海", pJS: "江苏",
    pZJ: "浙江", pAH: "安徽", pFJ: "福建", pJX: "江西", pSD: "山东",
    pHA: "河南", pHB: "湖北", pHN: "湖南", pGD: "广东", pGX: "广西",
    pHI: "海南", pCQ: "重庆", pSC: "四川", pGZ: "贵州", pYN: "云南",
    pSN: "陕西", pGS: "甘肃", pQH: "青海", pNX: "宁夏", pXJ: "新疆",
    pXZ: "西藏", pHK: "香港", pMO: "澳门", pTW: "台湾"
};

let cachedSvgSource = "";

async function getOrFetchSvgSource() {
    if (typeof window !== "undefined" && window.EMBEDDED_CHINA_MAP_SVG) {
        cachedSvgSource = window.EMBEDDED_CHINA_MAP_SVG;
        return cachedSvgSource;
    }
    if (cachedSvgSource) return cachedSvgSource;
    const candidatePaths = [
        "images/china-map.svg",
        "/travel-map/images/china-map.svg",
        "/images/china-map.svg"
    ];
    for (const p of candidatePaths) {
        try {
            const res = await fetch(p);
            if (res.ok) {
                cachedSvgSource = await res.text();
                return cachedSvgSource;
            }
        } catch (_) {}
    }
    return "";
}

function getActiveProvincesSet() {
    const set = new Set();
    cities.forEach(function (c) {
        if (!c.province) return;
        const norm = c.province.replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, "").trim();
        if (norm) {
            set.add(norm);
            set.add(norm + "省");
            set.add(norm + "市");
            set.add(norm + "自治区");
            set.add(norm + "维吾尔自治区");
        }
        set.add(c.province.trim());
    });
    return set;
}

async function createProcessedMap() {
    let canvas = document.querySelector("#local-china-map");
    if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "local-china-map";
        canvas.width = 1000;
        canvas.height = 850;
        canvas.style.position = "absolute";
        canvas.style.left = "0";
        canvas.style.top = "0";
        canvas.style.width = "1000px";
        canvas.style.height = "850px";
        canvas.style.maxWidth = "none";
        canvas.style.maxHeight = "none";
        canvas.style.display = "block";
        canvas.style.userSelect = "none";
        canvas.style.pointerEvents = "none";
        canvas.style.transformOrigin = "0 0";
        mapViewport.appendChild(canvas);
    }

    mapImage = canvas;
    const ctx = canvas.getContext("2d");

    const activeProvinces = getActiveProvincesSet();
    const brightColor = "#9fc29d";
    const darkColor = "#cdd3cc";

    const svgSource = await getOrFetchSvgSource();
    if (svgSource) {
        let coloredSvg = svgSource;

        coloredSvg = coloredSvg.replace(/<path\s+id="(p[A-Za-z0-9_]+)"([^>]*?)>/g, function (match, id, rest) {
            const matchCode = id.match(/^p([A-Z]{2})/);
            const prefix = matchCode ? ('p' + matchCode[1]) : id.split('_')[0];
            const provName = provinceIdToName[prefix] || provinceIdToName[id.split('_')[0]];
            const isLit = provName && (
                activeProvinces.has(provName) ||
                activeProvinces.has(provName + "省") ||
                activeProvinces.has(provName + "市") ||
                activeProvinces.has(provName + "自治区") ||
                activeProvinces.has(provName + "维吾尔自治区")
            );
            const fillColor = isLit ? brightColor : darkColor;
            const cleanRest = rest.replace(/style="[^"]*"/g, "").replace(/fill="[^"]*"/g, "");
            return '<path id="' + id + '" fill="' + fillColor + '" stroke="#403c37" stroke-width="0.8"' + cleanRest + '>';
        });

        coloredSvg = coloredSvg.replace(/<g\s+id="layer5"[^>]*>[\s\S]*?<\/g>/, '<g id="layer5" style="display:none;"></g>');

        const svgElem = document.querySelector("#china-map");
        if (svgElem) {
            svgElem.innerHTML = coloredSvg.replace(/<\?xml[\s\S]*?\?>/i, '').replace(/<!DOCTYPE[\s\S]*?>/i, '').replace(/<svg[^>]*>/i, '').replace(/<\/svg>/i, '');
        }

        const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(coloredSvg);
        const img = new Image();

        img.onload = function () {
            ctx.clearRect(0, 0, 1000, 850);
            ctx.drawImage(img, 0, 0, 1000, 850);
            isMapRendered = true;

            if (mapSourceImage) {
                mapSourceImage.remove();
                mapSourceImage = null;
            }

            resetMap();
            createCityHotspots();
        };

        img.onerror = function () {
            if (svgElem) {
                svgElem.style.display = "block";
                svgElem.style.position = "absolute";
                svgElem.style.left = "0";
                svgElem.style.top = "0";
                svgElem.style.width = "1000px";
                svgElem.style.height = "850px";
                svgElem.style.transformOrigin = "0 0";
                mapImage = svgElem;
                if (canvas) canvas.style.display = "none";
            }
            isMapRendered = true;
            resetMap();
            createCityHotspots();
        };

        img.src = dataUrl;
        return;
    }

    executeFallbackPixelMap(canvas, ctx, activeProvinces, brightColor, darkColor);
}

function executeFallbackPixelMap(canvas, ctx, activeProvinces, brightColor, darkColor) {
    if (mapSourceImage) {
        ctx.drawImage(mapSourceImage, 0, 0, 1000, 850);
    }
    resetMap();
    createCityHotspots();
}


/* =====================================================
   找城市所在省份区域
===================================================== */

function findNearestProvinceRegion(
    x,
    y,
    provinceMask,
    regionMap,
    width,
    height
) {

    const startX =
        Math.round(x);

    const startY =
        Math.round(y);


    /*
       先在周围寻找省份颜色。

       因为城市原始黑点会盖住
       城市中心的绿色。
    */

    for (
        let radius = 5;
        radius <= 28;
        radius += 2
    ) {

        for (
            let dy = -radius;
            dy <= radius;
            dy++
        ) {

            for (
                let dx = -radius;
                dx <= radius;
                dx++
            ) {

                if (
                    Math.abs(dx) <
                    radius &&
                    Math.abs(dy) <
                    radius
                ) {

                    continue;
                }


                const px =
                    startX + dx;

                const py =
                    startY + dy;


                if (
                    px < 0 ||
                    px >= width ||
                    py < 0 ||
                    py >= height
                ) {

                    continue;
                }


                const index =
                    py * width + px;


                if (
                    provinceMask[index] ===
                    1
                ) {

                    return regionMap[
                        index
                    ];
                }
            }
        }
    }


    return -1;
}


/* =====================================================
   删除原 SVG 城市点
===================================================== */

function eraseOriginalCityPoint(
    data,
    provinceMask,
    regionMap,
    regions,
    centerX,
    centerY,
    width,
    height
) {

    const regionId =
        findNearestProvinceRegion(
            centerX,
            centerY,
            provinceMask,
            regionMap,
            width,
            height
        );


    let replacement =
        {
            r: 205,
            g: 211,
            b: 204
        };


    if (
        regionId !== -1 &&
        regions[regionId] &&
        regions[regionId].bright
    ) {

        replacement =
            {
                r: 159,
                g: 194,
                b: 157
            };
    }


    /*
       找附近真正的省份颜色。
       用它覆盖原来的黑点。
    */

    const radius =
        11;


    for (
        let y = -radius;
        y <= radius;
        y++
    ) {

        for (
            let x = -radius;
            x <= radius;
            x++
        ) {

            if (
                x * x +
                y * y >
                radius * radius
            ) {

                continue;
            }


            const px =
                Math.round(
                    centerX + x
                );

            const py =
                Math.round(
                    centerY + y
                );


            if (
                px < 0 ||
                px >= width ||
                py < 0 ||
                py >= height
            ) {

                continue;
            }


            const index =
                py * width + px;


            const i =
                index * 4;


            data[i] =
                replacement.r;

            data[i + 1] =
                replacement.g;

            data[i + 2] =
                replacement.b;

            data[i + 3] =
                255;
        }
    }
}


/* =====================================================
   地图加载失败
===================================================== */

function showMapError() {

    let error =
        document.querySelector(
            "#map-error"
        );


    if (!error) {

        error =
            document.createElement(
                "div"
            );


        error.id =
            "map-error";


        error.style.position =
            "absolute";

        error.style.left =
            "50%";

        error.style.top =
            "50%";

        error.style.transform =
            "translate(-50%, -50%)";

        error.style.textAlign =
            "center";

        error.style.fontFamily =
            "Arial, sans-serif";

        error.style.color =
            "#555";

        error.style.zIndex =
            "999";


        error.innerHTML =
            "<div style='font-size:14px;letter-spacing:.15em;margin-bottom:10px;'>CHINA MAP NOT FOUND</div>" +
            "<div style='font-size:11px;color:#999;'>请确认 images/china-map.svg 存在</div>";


        mapViewport.appendChild(
            error
        );
    }
}


/* =====================================================
   地图初始大小
===================================================== */

function resetMap() {

    if (
        !mapImage ||
        !mapViewport
    ) {

        return;
    }


    const viewportWidth =
        mapViewport.clientWidth ||
        window.innerWidth;


    const viewportHeight =
        mapViewport.clientHeight ||
        window.innerHeight;


    const scaleX =
        viewportWidth /
        mapNaturalWidth;


    const scaleY =
        viewportHeight /
        mapNaturalHeight;


    mapScale =
        Math.min(
            scaleX,
            scaleY
        ) * 0.9;


    mapX =
        (
            viewportWidth -
            mapNaturalWidth *
            mapScale
        ) / 2;


    mapY =
        (
            viewportHeight -
            mapNaturalHeight *
            mapScale
        ) / 2;


    applyMapTransform();
}


/* =====================================================
   地图变换
===================================================== */

function applyMapTransform() {

    if (!mapImage) {
        return;
    }


    mapImage.style.transform =
        "translate(" +
        mapX +
        "px, " +
        mapY +
        "px) scale(" +
        mapScale +
        ")";
}


/* =====================================================
   城市交互点
===================================================== */

function createCityHotspots() {

    if (!mapViewport) {
        return;
    }


    document
        .querySelectorAll(
            ".city-hotspot"
        )
        .forEach(
            function (node) {
                node.remove();
            }
        );


    cityHotspots = [];


    cities.forEach(
        function (city) {

            const hotspot =
                document.createElement(
                    "button"
                );


            hotspot.type =
                "button";


            hotspot.className =
                "city-hotspot";


            hotspot.dataset.cityId =
                city.id;


            hotspot.setAttribute(
                "aria-label",
                "打开" +
                city.name +
                "记忆"
            );


            hotspot.title =
                city.name;


            hotspot.style.position =
                "absolute";


            hotspot.style.width =
                "14px";


            hotspot.style.height =
                "14px";


            hotspot.style.padding =
                "0";


            hotspot.style.margin =
                "0";


            hotspot.style.border =
                "0";


            hotspot.style.borderRadius =
                "50%";


            hotspot.style.background =
                "rgba(255,255,255,.96)";


            hotspot.style.boxShadow =
                "0 0 0 1.5px rgba(45,55,45,.78), 0 2px 8px rgba(0,0,0,.12)";


            hotspot.style.cursor =
                "pointer";


            hotspot.style.zIndex =
                "30";


            hotspot.style.pointerEvents =
                "auto";


            hotspot.style.appearance =
                "none";


            hotspot.style.boxSizing =
                "border-box";


            /*
               小纸条
            */

            const label =
                document.createElement(
                    "span"
                );


            label.textContent =
                city.name;


            label.style.position =
                "absolute";


            label.style.left =
                "13px";


            label.style.top =
                "-5px";


            label.style.whiteSpace =
                "nowrap";


            label.style.padding =
                "4px 7px 4px 8px";


            label.style.borderRadius =
                "1px";


            label.style.border =
                "1px solid rgba(45,55,45,.13)";


            label.style.background =
                "rgba(248,246,239,.94)";


            label.style.boxShadow =
                "0 2px 7px rgba(45,55,45,.10)";


            label.style.color =
                "#263026";


            label.style.fontFamily =
                "inherit";


            label.style.fontSize =
                "9px";


            label.style.lineHeight =
                "1.25";


            label.style.letterSpacing =
                ".08em";


            label.style.pointerEvents =
                "none";


            label.style.textShadow =
                "0 1px 0 rgba(255,255,255,.8)";


            label.style.transform =
                "rotate(" +
                (
                    (
                        city.x %
                        3
                    ) -
                    1
                ) *
                0.7 +
                "deg)";


            hotspot.appendChild(
                label
            );


            mapViewport.appendChild(
                hotspot
            );


            /*
               防止拖拽时触发地图
            */

            hotspot.addEventListener(
                "mousedown",
                function (event) {

                    event.stopPropagation();
                }
            );


            /*
               点击城市
            */

            hotspot.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    event.stopPropagation();


                    /*
                       第二次点击同一个城市：
                       直接退出。
                    */

                    if (
                        currentCity &&
                        currentCity.id ===
                        city.id &&
                        placePanel &&
                        placePanel.classList.contains(
                            "visible"
                        )
                    ) {

                        closeCityView();

                        return;
                    }


                    openCity(
                        city
                    );
                }
            );


            /*
               Hover
            */

            hotspot.addEventListener(
                "mouseenter",
                function () {

                    hotspot.style.transform =
                        "scale(1.18)";

                    hotspot.style.zIndex =
                        "80";

                    label.style.background =
                        "rgba(255,253,247,.99)";

                    label.style.fontWeight =
                        "600";
                }
            );


            hotspot.addEventListener(
                "mouseleave",
                function () {

                    hotspot.style.transform =
                        "scale(1)";

                    hotspot.style.zIndex =
                        "30";

                    label.style.background =
                        "rgba(248,246,239,.94)";

                    label.style.fontWeight =
                        "400";
                }
            );


            cityHotspots.push(
                {
                    city:
                        city,

                    element:
                        hotspot
                }
            );
        }
    );


    if (
        !hotspotAnimationStarted
    ) {

        hotspotAnimationStarted =
            true;


        updateAllCityHotspots();
    }
}


/* =====================================================
   城市点位置
===================================================== */

function updateAllCityHotspots() {

    cityHotspots.forEach(
        function (item) {

            const city =
                item.city;


            const hotspot =
                item.element;


            const size =
                14;


            hotspot.style.left =
                (
                    mapX +
                    city.x *
                    mapScale -
                    size / 2
                ) +
                "px";


            hotspot.style.top =
                (
                    mapY +
                    city.y *
                    mapScale -
                    size / 2
                ) +
                "px";
        }
    );


    requestAnimationFrame(
        updateAllCityHotspots
    );
}


/* =====================================================
   地图拖拽
===================================================== */

function setupDragging() {

    if (!mapViewport) {
        return;
    }


    mapViewport.addEventListener(
        "mousedown",
        function (event) {

            if (
                event.button !==
                0
            ) {

                return;
            }


            if (
                event.target.closest &&
                event.target.closest(
                    ".city-hotspot"
                )
            ) {

                return;
            }


            if (
                event.target.closest &&
                (
                    event.target.closest(
                        "#place-panel"
                    ) ||
                    event.target.closest(
                        "#memory-editor-overlay"
                    ) ||
                    event.target.closest(
                        "#memory-detail-page"
                    ) ||
                    event.target.closest(
                        "#place-editor-overlay"
                    ) ||
                    event.target.closest(
                        "#place-archive-page"
                    ) ||
                    event.target.closest(
                        "#photo-lightbox-overlay"
                    )
                )
            ) {

                return;
            }


            dragging =
                true;


            dragStartX =
                event.clientX;


            dragStartY =
                event.clientY;


            startMapX =
                mapX;


            startMapY =
                mapY;


            mapViewport.style.cursor =
                "grabbing";
        }
    );


    window.addEventListener(
        "mousemove",
        function (event) {

            if (!dragging) {
                return;
            }


            mapX =
                startMapX +
                (
                    event.clientX -
                    dragStartX
                );


            mapY =
                startMapY +
                (
                    event.clientY -
                    dragStartY
                );


            applyMapTransform();
        }
    );


    window.addEventListener(
        "mouseup",
        function () {

            if (!dragging) {
                return;
            }


            dragging =
                false;


            mapViewport.style.cursor =
                "grab";
        }
    );
}


/* =====================================================
   滚轮缩放
===================================================== */

function setupWheel() {

    if (!mapViewport) {
        return;
    }


    mapViewport.addEventListener(
        "wheel",
        function (event) {

            /*
               如果鼠标正在记忆框或者
               记忆详情页里，不能让地图缩放。
            */

            if (
                event.target.closest &&
                (
                    event.target.closest(
                        "#place-panel"
                    ) ||
                    event.target.closest(
                        "#memory-editor-overlay"
                    ) ||
                    event.target.closest(
                        "#memory-detail-page"
                    ) ||
                    event.target.closest(
                        "#place-editor-overlay"
                    ) ||
                    event.target.closest(
                        "#place-archive-page"
                    ) ||
                    event.target.closest(
                        "#photo-lightbox-overlay"
                    )
                )
            ) {

                return;
            }


            event.preventDefault();


            if (!mapImage) {
                return;
            }


            const rect =
                mapViewport.getBoundingClientRect();


            const mouseX =
                event.clientX -
                rect.left;


            const mouseY =
                event.clientY -
                rect.top;


            const oldScale =
                mapScale;


            const factor =
                event.deltaY < 0
                    ? 1.12
                    : 0.89;


            mapScale *=
                factor;


            const minScale =
                Math.min(
                    rect.width /
                    mapNaturalWidth,

                    rect.height /
                    mapNaturalHeight
                ) *
                0.55;


            const maxScale =
                5;


            mapScale =
                Math.max(
                    minScale,
                    Math.min(
                        maxScale,
                        mapScale
                    )
                );


            const scaleRatio =
                mapScale /
                oldScale;


            mapX =
                mouseX -
                (
                    mouseX -
                    mapX
                ) *
                scaleRatio;


            mapY =
                mouseY -
                (
                    mouseY -
                    mapY
                ) *
                scaleRatio;


            applyMapTransform();

        },
        {
            passive:
                false
        }
    );
}


/* =====================================================
   打开城市

   第一次点击：
   放大一次。

   再点击同一个城市：
   closeCityView()。

   因此不会无限放大。
===================================================== */

function openCity(city) {

    currentCity =
        city;


    if (mapPage) {
        mapPage.classList.add(
            "has-sidebar"
        );
    }


    if (placeTitle) {

        placeTitle.textContent =
            city.name;
    }


    if (placeLocation) {

        placeLocation.textContent =
            city.province +
            " / CHINA";
    }


    if (placeDescription) {

        placeDescription.textContent =
            "Lars关于" +
            city.name +
            "的记忆";
    }


    /*
       每次从完整地图进入一个城市，
       只进行一次放大。
       在左侧地图可用区域居中，确保不穿透右侧固定信息面板。
    */

    const targetScale =
        Math.max(
            2,
            Math.min(
                2.65,
                mapScale *
                1.65
            )
        );


    const availableWidth =
        window.innerWidth >= 860
            ? (window.innerWidth - 420)
            : window.innerWidth;


    const targetX =
        availableWidth / 2 -
        city.x *
        targetScale;


    const targetY =
        window.innerHeight / 2 -
        city.y *
        targetScale;


    animateMapTo(
        targetX,
        targetY,
        targetScale
    );


    renderPlacesSummary(city);
    renderSecretGardenSection(city);
    renderFoodLogSection(city);
    updateCityTabCounts(city);
    switchCityTab("places");

    prepareMemoryPanel();


    if (placePanel) {

        setTimeout(
            function () {

                placePanel.classList.add(
                    "visible"
                );

            },
            150
        );
    }
}


/* =====================================================
   退出城市
===================================================== */

function closeCityView() {

    closeMemoryEditor();


    closeMemoryDetail();


    closePlaceEditor();


    closePlacesArchivePage();


    closePhotoLightbox();

    switchCityTab("memories");


    if (mapPage) {

        mapPage.classList.remove(
            "has-sidebar"
        );
    }


    if (placePanel) {

        placePanel.classList.remove(
            "visible"
        );
    }


    currentCity =
        null;


    /*
       恢复到完整中国地图。
    */

    setTimeout(
        function () {

            resetMap();

        },
        50
    );
}


/* =====================================================
   地图动画
===================================================== */

function animateMapTo(
    targetX,
    targetY,
    targetScale
) {

    if (
        mapIsAnimating
    ) {

        /*
           如果正在动画，
           直接从当前状态继续。
        */
    }


    mapIsAnimating =
        true;


    const startX =
        mapX;


    const startY =
        mapY;


    const startScale =
        mapScale;


    const duration =
        850;


    const startTime =
        performance.now();


    function animate(
        currentTime
    ) {

        const elapsed =
            currentTime -
            startTime;


        const progress =
            Math.min(
                elapsed /
                duration,
                1
            );


        const eased =
            progress < 0.5
                ? 2 *
                    progress *
                    progress
                : 1 -
                    Math.pow(
                        -2 *
                        progress +
                        2,
                        2
                    ) /
                    2;


        mapX =
            startX +
            (
                targetX -
                startX
            ) *
            eased;


        mapY =
            startY +
            (
                targetY -
                startY
            ) *
            eased;


        mapScale =
            startScale +
            (
                targetScale -
                startScale
            ) *
            eased;


        applyMapTransform();


        if (
            progress <
            1
        ) {

            requestAnimationFrame(
                animate
            );

        } else {

            mapIsAnimating =
                false;
        }
    }


    requestAnimationFrame(
        animate
    );
}


/* =====================================================
   城市关闭按钮
===================================================== */

if (closePlace) {

    closePlace.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();

            closeCityView();

        }
    );

    closePlace.addEventListener(
        "mousedown",
        function (event) {

            event.stopPropagation();

        }
    );
}


/* =====================================================
   让右侧记忆框可以滚动与事件隔离
===================================================== */

function prepareMemoryPanel() {

    if (!placePanel) {
        return;
    }

    placePanel.addEventListener(
        "wheel",
        function (event) {

            event.stopPropagation();

        },
        {
            passive:
                true
        }
    );

    placePanel.addEventListener(
        "mousedown",
        function (event) {

            event.stopPropagation();

        }
    );
}


/* =====================================================
   返回首页
===================================================== */

if (backHome) {

    backHome.addEventListener(
        "click",
        function () {

            closeMemoryDetail();

            closeMemoryEditor();

            closePlaceEditor();

            closePlacesArchivePage();

            closePhotoLightbox();

            if (placePanel) {

                placePanel.classList.remove(
                    "visible"
                );
            }

            currentCity =
                null;

            if (mapPage) {

                mapPage.classList.remove(
                    "has-sidebar"
                );

                mapPage.classList.remove(
                    "active"
                );

                mapPage.style.display =
                    "";

                mapPage.style.visibility =
                    "";

                mapPage.style.opacity =
                    "";

                mapPage.style.pointerEvents =
                    "";

                mapPage.style.transform =
                    "";

                mapPage.style.zIndex =
                    "";

                mapPage.style.position =
                    "";

                mapPage.style.left =
                    "";

                mapPage.style.top =
                    "";

                mapPage.style.width =
                    "";

                mapPage.style.height =
                    "";
            }


            if (homePage) {

                homePage.classList.add(
                    "active"
                );

                homePage.style.visibility =
                    "visible";

                homePage.style.pointerEvents =
                    "auto";
            }

        }
    );
}


/* =====================================================
   URL 外部链接校验与格式化
===================================================== */

function isValidHttpUrl(string) {
    if (!string || typeof string !== "string") return false;
    const trimmed = string.trim();
    if (!trimmed) return false;
    if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return false;
    try {
        const url = new URL(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : "https://" + trimmed);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}

function normalizeExternalUrl(string) {
    if (!string || typeof string !== "string") return "";
    const trimmed = string.trim();
    if (!trimmed) return "";
    if (!isValidHttpUrl(trimmed)) return null;
    if (!/^https?:\/\//i.test(trimmed)) {
        return "https://" + trimmed;
    }
    return trimmed;
}

/* =====================================================
   内容排序功能（飞行日志 & 城市记忆）
===================================================== */

function moveMemoryItem(city, fromIndex, toIndex) {
    if (!city) return;
    const list = getMemories(city);
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length || fromIndex === toIndex) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    saveMemories(city, list);
    renderMemoryLibrary(city);
}

function movePlaceItem(city, fromIndex, toIndex) {
    if (!city) return;
    const list = getCityPlaces(city);
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length || fromIndex === toIndex) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    saveCityPlaces(city, list);
    renderPlacesSummary(city);
    const archivePage = document.querySelector("#place-archive-page");
    if (archivePage) {
        openPlacesArchivePage(city, moved.id);
    }
}


/* =====================================================
   MEMORY STORAGE
===================================================== */

function memoryStorageKey(
    city
) {

    return (
        "lars_memories_" +
        city.id
    );
}


function getMemories(
    city
) {

    try {

        const raw =
            localStorage.getItem(
                memoryStorageKey(
                    city
                )
            );


        if (!raw) {
            return [];
        }


        const parsed =
            JSON.parse(
                raw
            );


        return Array.isArray(
            parsed
        )
            ? parsed
            : [];

    } catch (
        error
    ) {

        console.error(
            "读取记忆失败：",
            error
        );


        return [];
    }
}


function saveMemories(
    city,
    memories
) {

    localStorage.setItem(
        memoryStorageKey(
            city
        ),
        JSON.stringify(
            memories
        )
    );
}


/* =====================================================
   MEMORY LIBRARY
===================================================== */

function renderMemoryLibrary(
    city
) {

    if (
        !placePanel ||
        !city
    ) {

        return;
    }


    const container =
        document.querySelector("#section-pane-memories") ||
        placePanel;

    let library =
        container.querySelector(
            "#memory-library"
        );


    if (!library) {

        library =
            document.createElement(
                "div"
            );


        library.id =
            "memory-library";


        library.style.marginTop =
            "8px";


        library.style.paddingTop =
            "8px";


        container.appendChild(
            library
        );
    }


    const memories =
        getMemories(
            city
        );


    library.innerHTML =
        "";


    /*
       标题栏
    */

    const header =
        document.createElement(
            "div"
        );


    header.style.display =
        "flex";


    header.style.alignItems =
        "center";


    header.style.justifyContent =
        "space-between";


    header.style.gap =
        "12px";


    header.style.marginBottom =
        "16px";


    const heading =
        document.createElement(
            "div"
        );


    heading.textContent =
        "MEMORY LIBRARY";


    heading.style.fontSize =
        "10px";


    heading.style.letterSpacing =
        ".18em";


    heading.style.opacity =
        ".55";


    const addButton =
        document.createElement(
            "button"
        );


    addButton.type =
        "button";


    addButton.dataset.action =
        "add-memory";


    addButton.textContent =
        "+ ADD MEMORY";


    addButton.style.border =
        "0";


    addButton.style.background =
        "transparent";


    addButton.style.padding =
        "4px 0";


    addButton.style.cursor =
        "pointer";


    addButton.style.fontSize =
        "10px";


    addButton.style.letterSpacing =
        ".12em";


    header.appendChild(
        heading
    );


    header.appendChild(
        addButton
    );


    library.appendChild(
        header
    );


    /*
       真正的记忆列表。

       只让这里滚动，
       标题和 ADD MEMORY 不跟着消失。
    */

    const list =
        document.createElement(
            "div"
        );


    list.className =
        "memory-scroll-list";


    list.style.maxHeight =
        "52vh";


    list.style.overflowY =
        "auto";


    list.style.overflowX =
        "hidden";


    list.style.paddingRight =
        "8px";


    list.style.boxSizing =
        "border-box";


    list.style.scrollBehavior =
        "smooth";


    /*
       自定义滚动条
    */

    list.style.scrollbarWidth =
        "thin";


    library.appendChild(
        list
    );


    if (
        memories.length ===
        0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.textContent =
            "NO MEMORIES YET";


        empty.style.fontSize =
            "11px";


        empty.style.opacity =
            ".45";


        empty.style.padding =
            "8px 0";


        list.appendChild(
            empty
        );


        return;
    }


    /*
       每一条记忆
    */

    memories.forEach(
        function (
            memory,
            index
        ) {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "memory-list-item";


            item.dataset.action =
                "open-memory-detail";


            item.dataset.memoryId =
                memory.id;


            item.style.padding =
                "12px 0";


            item.style.borderTop =
                index === 0
                    ? "0"
                    : "1px solid rgba(0,0,0,.08)";


            item.style.cursor =
                "pointer";


            item.style.transition =
                "opacity .2s ease";


            /*
               鼠标进入的时候稍微变化
            */

            item.addEventListener(
                "mouseenter",
                function () {

                    item.style.opacity =
                        ".62";
                }
            );


            item.addEventListener(
                "mouseleave",
                function () {

                    item.style.opacity =
                        "1";
                }
            );


            const top =
                document.createElement(
                    "div"
                );


            top.style.display =
                "flex";


            top.style.alignItems =
                "baseline";


            top.style.justifyContent =
                "space-between";


            top.style.gap =
                "10px";


            const title =
                document.createElement(
                    "div"
                );


            title.textContent =
                memory.title ||
                "UNTITLED MEMORY";


            title.style.fontSize =
                "13px";


            const number =
                document.createElement(
                    "div"
                );


            number.textContent =
                "MEMORY " +
                String(
                    index + 1
                ).padStart(
                    2,
                    "0"
                );


            number.style.fontSize =
                "9px";


            number.style.letterSpacing =
                ".12em";


            number.style.opacity =
                ".45";


            top.appendChild(
                title
            );


            top.appendChild(
                number
            );


            const date =
                document.createElement(
                    "div"
                );


            date.textContent =
                memory.date ||
                "";


            date.style.fontSize =
                "10px";


            date.style.opacity =
                ".45";


            date.style.marginTop =
                "4px";


            const text =
                document.createElement(
                    "div"
                );


            /*
               列表页只显示部分正文。
               点击以后看完整内容。
            */

            const preview =
                memory.content ||
                "";


            text.textContent =
                preview.length >
                100
                    ? preview.slice(
                        0,
                        100
                    ) +
                    "…"
                    : preview;


            text.style.fontSize =
                "11px";


            text.style.lineHeight =
                "1.7";


            text.style.opacity =
                ".7";


            text.style.marginTop =
                "6px";


            text.style.whiteSpace =
                "pre-wrap";


            /*
               操作行：排序 (↑ 上移 / ↓ 下移) + 外部链接 + EDIT
            */
            const actionsRow = document.createElement("div");
            actionsRow.className = "memory-item-actions-row";
            actionsRow.style.display = "flex";
            actionsRow.style.alignItems = "center";
            actionsRow.style.justifyContent = "space-between";
            actionsRow.style.marginTop = "8px";

            const orderControls = document.createElement("div");
            orderControls.className = "item-order-controls";

            if (index > 0) {
                const upBtn = document.createElement("button");
                upBtn.type = "button";
                upBtn.className = "order-btn order-up-btn";
                upBtn.textContent = "↑ 上移";
                upBtn.title = "上移一条记录";
                upBtn.addEventListener("click", function (e) {
                    e.stopPropagation();
                    moveMemoryItem(city, index, index - 1);
                });
                orderControls.appendChild(upBtn);
            }

            if (index < memories.length - 1) {
                const downBtn = document.createElement("button");
                downBtn.type = "button";
                downBtn.className = "order-btn order-down-btn";
                downBtn.textContent = "↓ 下移";
                downBtn.title = "下移一条记录";
                downBtn.addEventListener("click", function (e) {
                    e.stopPropagation();
                    moveMemoryItem(city, index, index + 1);
                });
                orderControls.appendChild(downBtn);
            }

            const rightActions = document.createElement("div");
            rightActions.style.display = "flex";
            rightActions.style.alignItems = "center";
            rightActions.style.gap = "8px";

            if (memory.link) {
                const linkTag = document.createElement("a");
                linkTag.href = memory.link;
                linkTag.target = "_blank";
                linkTag.rel = "noopener noreferrer";
                linkTag.className = "memory-mini-link-tag";
                linkTag.textContent = "LINK ↗";
                linkTag.title = memory.link;
                linkTag.addEventListener("click", function (e) {
                    e.stopPropagation();
                });
                rightActions.appendChild(linkTag);
            }

            const edit =
                document.createElement(
                    "button"
                );


            edit.type =
                "button";


            edit.dataset.action =
                "edit-memory";


            edit.dataset.memoryId =
                memory.id;


            edit.textContent =
                "EDIT";


            edit.style.border =
                "0";


            edit.style.background =
                "transparent";


            edit.style.padding =
                "0";


            edit.style.cursor =
                "pointer";


            edit.style.fontSize =
                "9px";


            edit.style.letterSpacing =
                ".12em";


            edit.style.opacity =
                ".6";


            edit.addEventListener(
                "click",
                function (
                    event
                ) {

                    event.stopPropagation();

                }
            );

            rightActions.appendChild(edit);
            actionsRow.appendChild(orderControls);
            actionsRow.appendChild(rightActions);

            item.appendChild(
                top
            );


            item.appendChild(
                date
            );


            item.appendChild(
                text
            );


            item.appendChild(
                actionsRow
            );

            // 拖拽排序支持
            item.draggable = true;
            item.addEventListener("dragstart", function (e) {
                e.dataTransfer.setData("text/plain", String(index));
                item.style.opacity = "0.35";
            });
            item.addEventListener("dragend", function () {
                item.style.opacity = "1";
            });
            item.addEventListener("dragover", function (e) {
                e.preventDefault();
            });
            item.addEventListener("drop", function (e) {
                e.preventDefault();
                const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                if (!isNaN(fromIdx) && fromIdx !== index) {
                    moveMemoryItem(city, fromIdx, index);
                }
            });


            list.appendChild(
                item
            );
        }
    );
}


/* =====================================================
   新的记忆详情页面

   不是浏览器真的跳转，
   而是在当前页面上生成一个独立的全屏页面。

   对用户来说就是：
   点击 MEMORY
   ↓
   进入新的页面
===================================================== */

function openMemoryDetail(
    city,
    memory
) {

    closeMemoryDetail();


    const page =
        document.createElement(
            "div"
        );


    page.id =
        "memory-detail-page";


    page.style.position =
        "fixed";


    page.style.inset =
        "0";


    page.style.zIndex =
        "2000";


    page.style.background =
        "#f8f7f2";


    page.style.color =
        "#263026";


    page.style.overflowY =
        "auto";


    page.style.overflowX =
        "hidden";


    page.style.boxSizing =
        "border-box";


    /*
       顶部返回
    */

    const top =
        document.createElement(
            "div"
        );


    top.style.position =
        "sticky";


    top.style.top =
        "0";


    top.style.zIndex =
        "10";


    top.style.display =
        "flex";


    top.style.alignItems =
        "center";


    top.style.justifyContent =
        "space-between";


    top.style.padding =
        "28px 42px";


    top.style.background =
        "rgba(248,247,242,.92)";


    top.style.backdropFilter =
        "blur(8px)";


    top.style.borderBottom =
        "1px solid rgba(38,48,38,.08)";


    const back =
        document.createElement(
            "button"
        );


    back.type =
        "button";


    back.dataset.action =
        "close-memory-detail";


    back.textContent =
        "← BACK";


    back.style.border =
        "0";


    back.style.background =
        "transparent";


    back.style.padding =
        "0";


    back.style.cursor =
        "pointer";


    back.style.fontSize =
        "10px";


    back.style.letterSpacing =
        ".14em";


    const location =
        document.createElement(
            "div"
        );


    location.textContent =
        city.name +
        " / " +
        city.province;


    location.style.fontSize =
        "9px";


    location.style.letterSpacing =
        ".16em";


    location.style.opacity =
        ".5";


    top.appendChild(
        back
    );


    top.appendChild(
        location
    );


    /*
       正文区域
    */

    const content =
        document.createElement(
            "article"
        );


    content.style.width =
        "min(760px, 82vw)";


    content.style.margin =
        "0 auto";


    content.style.padding =
        "100px 0 140px";


    const number =
        document.createElement(
            "div"
        );


    const memories =
        getMemories(
            city
        );


    const index =
        memories.findIndex(
            function (item) {

                return (
                    item.id ===
                    memory.id
                );
            }
        );


    number.textContent =
        "MEMORY " +
        String(
            index + 1
        ).padStart(
            2,
            "0"
        );


    number.style.fontSize =
        "10px";


    number.style.letterSpacing =
        ".18em";


    number.style.opacity =
        ".42";


    const title =
        document.createElement(
            "h1"
        );


    title.textContent =
        memory.title ||
        "UNTITLED MEMORY";


    title.style.margin =
        "18px 0 10px";


    title.style.fontSize =
        "clamp(32px, 5vw, 64px)";


    title.style.fontWeight =
        "400";


    title.style.lineHeight =
        "1.08";


    title.style.letterSpacing =
        "-.025em";


    const date =
        document.createElement(
            "div"
        );


    date.textContent =
        memory.date ||
        "";


    date.style.fontSize =
        "11px";


    date.style.letterSpacing =
        ".1em";


    date.style.opacity =
        ".45";


    date.style.marginBottom =
        "70px";


    const divider =
        document.createElement(
            "div"
        );


    divider.style.width =
        "100%";


    divider.style.height =
        "1px";


    divider.style.background =
        "rgba(38,48,38,.12)";


    divider.style.marginBottom =
        "55px";


    const body =
        document.createElement(
            "div"
        );


    body.textContent =
        memory.content ||
        "";


    body.style.fontSize =
        "15px";


    body.style.lineHeight =
        "2.15";


    body.style.letterSpacing =
        ".02em";


    body.style.whiteSpace =
        "pre-wrap";


    body.style.wordBreak =
        "break-word";


    body.style.opacity =
        ".82";


    content.appendChild(
        number
    );


    content.appendChild(
        title
    );


    content.appendChild(
        date
    );


    content.appendChild(
        divider
    );


    content.appendChild(
        body
    );

    if (memory.link) {
        const linkBlock = document.createElement("div");
        linkBlock.className = "memory-detail-link-section";

        const linkTitle = document.createElement("div");
        linkTitle.style.fontSize = "10px";
        linkTitle.style.letterSpacing = ".18em";
        linkTitle.style.opacity = ".48";
        linkTitle.style.marginBottom = "10px";
        linkTitle.textContent = "EXTERNAL LINK / 外部链接";

        const linkAnchor = document.createElement("a");
        linkAnchor.href = memory.link;
        linkAnchor.target = "_blank";
        linkAnchor.rel = "noopener noreferrer";
        linkAnchor.className = "memory-detail-external-anchor";
        linkAnchor.innerHTML = `
            <span class="anchor-label">访问相关外部链接</span>
            <span class="anchor-url">${memory.link}</span>
            <span class="anchor-arrow">↗</span>
        `;
        linkBlock.appendChild(linkTitle);
        linkBlock.appendChild(linkAnchor);
        content.appendChild(linkBlock);
    }


    page.appendChild(
        top
    );


    page.appendChild(
        content
    );


    document.body.appendChild(
        page
    );


    /*
       新页面从顶部开始。
    */

    page.scrollTop =
        0;
}


/* =====================================================
   关闭记忆详情
===================================================== */

function closeMemoryDetail() {

    const page =
        document.querySelector(
            "#memory-detail-page"
        );


    if (page) {

        page.remove();
    }
}


/* =====================================================
   板块 02：城市地点 / 活动档案数据与交互
===================================================== */

const defaultCuratedPlaces = {
    shanghai: [
        {
            id: "place-shanghai-1",
            name: "安福路话剧艺术中心",
            category: "剧场 / 演出",
            date: "2026.04",
            location: "徐汇区安福路288号",
            content: "雨天的午后，散场后梧桐树叶落了一地。戏剧的台词还在耳边回响，在街角的小咖啡馆坐了很久，看撑伞的路人匆匆走过。",
            photos: []
        },
        {
            id: "place-shanghai-2",
            name: "鲁迅公园斜角咖啡",
            category: "咖啡馆 / 漫游",
            date: "2026.03",
            location: "虹口区甜爱路周边",
            content: "阳光穿过树荫斑驳落在木桌上，手冲曼特宁香气沉静。店里只有黑胶唱片的杂音与偶尔翻动纸张的沙沙声。",
            photos: []
        }
    ],
    hangzhou: [
        {
            id: "place-hangzhou-1",
            name: "满觉陇山间茶室",
            category: "茶空间 / 闲游",
            date: "2026.05",
            location: "西湖区满觉陇",
            content: "沿石阶拾级而上，山风穿过竹林。点了一壶九曲红梅，安静地看午后光影在竹席上流动，时间好像变慢了。",
            photos: []
        }
    ],
    beijing: [
        {
            id: "place-beijing-1",
            name: "东四胡同独立书店",
            category: "书店 / 散步",
            date: "2026.04",
            location: "东城区东四九条",
            content: "穿过幽深的胡同小径，推开青砖小院的木门。老式四合院改造成的阅读空间，瓦片上落着初春清脆的鸽哨声。",
            photos: []
        }
    ],
    xiamen: [
        {
            id: "place-xiamen-1",
            name: "沙坡尾避风坞老船坞",
            category: "海边 / 漫步",
            date: "2026.02",
            location: "思明区大学路",
            content: "潮水退去的时候，老渔船静静停泊在港湾里。咸涩的海风吹散了午后的暑气，晚霞把远处的双子塔染成浅浅的粉紫色。",
            photos: []
        }
    ],
    chengdu: [
        {
            id: "place-chengdu-1",
            name: "望江楼公园竹林茶座",
            category: "茶馆 / 慢步",
            date: "2026.04",
            location: "武侯区望江路30号",
            content: "锦江边的竹林深处，盖碗茶雾气袅袅升起。老茶客闲敲棋子，春风吹动竹梢沙沙作响，体会最地道的成都慢调子。",
            secretNotes: "在竹影摇曳里翻开速写本，竹叶落下一枚青绿的书签，茶博士续水时铜壶轻鸣，令人忘却行色匆匆。",
            photos: [],
            secretPhotos: []
        },
        {
            id: "place-chengdu-2",
            name: "玉林西路旧物与唱片小店",
            category: "音乐 / 街区巡礼",
            date: "2026.03",
            location: "武侯区玉林西路",
            content: "深巷里积淀着岁月质感的旧物店，黑胶机里播放着低沉的爵士乐，门外是黄昏里温暖热闹的市井烟火气息。",
            secretNotes: "淘到一张泛黄的木吉他黑胶，老板顺手递来一杯茉莉花茶，说慢一点才能听见旋律里的心跳。",
            photos: [],
            secretPhotos: []
        }
    ],
    changzhou: [
        {
            id: "place-changzhou-music-fest",
            name: "太湖湾音乐节",
            category: "音乐节 / 现场",
            date: "2026.05",
            location: "常州市武进区太湖湾旅游度假区",
            content: "太湖之畔的微风与傍晚的夕阳，舞台上的声浪和草地上一同挥手的人群。落日余晖中奔跑的少年，关于春末最自由鲜活的声响。",
            secretNotes: "落日的时候天空泛起粉橙色，音乐刚好切到那一首歌，身旁的人转过头笑了。那一刻好像所有漂泊都有了片刻的安放。",
            photos: [],
            secretPhotos: []
        }
    ],
    xian: [
        {
            id: "place-xian-1",
            name: "南门古城墙夜骑漫行",
            category: "城市漫步 / 巡礼",
            date: "2026.04",
            location: "碑林区南门城墙",
            content: "青砖漫长，城墙上的风吹过千年岁月的轮廓。俯瞰城门下车水马龙的灯火，历史与当下的市井在这里温柔交汇。",
            secretNotes: "在敌楼的阴影里停下车吹了很久的风，耳机里循环着同一首民谣，那一刻突然明白了古人的羁旅之思。",
            photos: [],
            secretPhotos: []
        }
    ],
    tianjin: [
        {
            id: "place-tianjin-1",
            name: "五大道海棠花下的午后",
            category: "建筑巡礼 / 散步",
            date: "2026.04",
            location: "和平区五大道历史文化街区",
            content: "老租界的红砖洋房掩映在茂密的海棠花枝后。推开有些沉重的木门，留声机的乐声里，时间像凝固的琥珀。",
            secretNotes: "在窗边那张小圆桌坐了两个小时，看着海棠花瓣一片一片落在大理石台阶上。",
            photos: [],
            secretPhotos: []
        }
    ],
    taiyuan: [
        {
            id: "place-taiyuan-1",
            name: "晋祠周柏与难老泉寻幽",
            category: "古建寻踪 / 漫步",
            date: "2026.03",
            location: "晋源区晋祠公园",
            content: "苍劲的周柏横卧在古殿之前，难老泉水澄澈地从石罅中涌出。三月的春阳穿过雕花窗棂，静谧得能听见松针落地的细响。",
            secretNotes: "触碰古柏粗糙树皮的那一瞬间，手心仿佛感受到了横跨数千年的温度与脉搏。",
            photos: [],
            secretPhotos: []
        }
    ],
    xishuangbanna: [
        {
            id: "place-xishuangbanna-1",
            name: "曼听公园热带植物园漫行",
            category: "热带漫游 / 秘境",
            date: "2026.02",
            location: "景洪市曼听南路35号",
            content: "棕榈树与芭蕉叶遮蔽了午后的阳光，空气里弥漫着湿润的草木香与鸡蛋花的清甜。澜沧江畔的微风吹散了整座城市的喧嚣。",
            secretNotes: "在暮色四合时遇见了一场没有预兆的太阳雨，雨滴穿过巨大的芭蕉叶，宛如雨林里独奏的乐曲。",
            photos: [],
            secretPhotos: []
        }
    ],
    shaoxing: [
        {
            id: "place-shaoxing-1",
            name: "仓桥直街乌篷船行水巷",
            category: "水乡寻幽 / 漫步",
            date: "2026.03",
            location: "越城区仓桥直街",
            content: "青石板路被岁月打磨得发亮，乌篷船从古石桥下悠悠摇过。沿河人家的炊烟与黄酒香气交织，是最地道的江南日常。",
            secretNotes: "老爷爷摇橹的手势极稳，水声欸乃作响，桥上走过放学的孩童，那一刻时间仿佛从未流逝。",
            photos: [],
            secretPhotos: []
        }
    ],
    kashi: [
        {
            id: "place-kashi-1",
            name: "喀什古城与百年老茶馆",
            category: "古城漫步 / 茶馆巡礼",
            date: "2026.06",
            location: "喀什市解放北路喀什古城",
            link: "",
            content: "土黄色的高台生土建筑错落有致，老茶馆里飘着红茶与藏红花的香气。艾德莱斯绸在阳光下闪着斑斓的光芒，阳光洒在斑驳的木窗棱上，时光在这里放慢了脚步。",
            secretNotes: "坐在二楼临街的长廊上品茶听热瓦普弹唱，微风拂过挂满干果的巷弄，那一刻仿佛穿越了千年的丝路岁月。",
            photos: [],
            secretPhotos: []
        }
    ]
};

function placesStorageKey(city) {
    return "lars_places_" + city.id;
}

function getCityPlaces(city) {
    if (!city) return [];
    const key = placesStorageKey(city);
    if (typeof window !== "undefined" && window._larsStorageCache && window._larsStorageCache[key] !== undefined) {
        const cached = window._larsStorageCache[key];
        if (Array.isArray(cached)) return [...cached];
    }
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                if (typeof window !== "undefined") {
                    window._larsStorageCache = window._larsStorageCache || {};
                    window._larsStorageCache[key] = parsed;
                }
                idbSave(key, parsed);
                return parsed;
            }
        }
    } catch (e) {
        console.error("读取地点档案失败:", e);
    }
    if (defaultCuratedPlaces[city.id]) {
        return JSON.parse(JSON.stringify(defaultCuratedPlaces[city.id]));
    }
    return [];
}

function saveCityPlaces(city, places) {
    if (!city) return;
    const key = placesStorageKey(city);
    if (typeof window !== "undefined") {
        window._larsStorageCache = window._larsStorageCache || {};
        window._larsStorageCache[key] = places;
    }
    idbSave(key, places);
    try {
        localStorage.setItem(key, JSON.stringify(places));
    } catch (quotaErr) {
        console.warn("localStorage quota exceeded for places; persisted safely in IndexedDB:", key);
    }
    updateCityTabCounts(city);
}

function updateCityTabCounts(city) {
    if (!city) return;
    const places = getCityPlaces(city);
    const badgePlaces = document.querySelector("#tab-count-places");
    if (badgePlaces) {
        badgePlaces.textContent = places.length > 0 ? " (" + places.length + ")" : "";
    }

    const garden = getCitySecretGarden(city);
    const badgeSecret = document.querySelector("#tab-count-secret");
    if (badgeSecret) {
        const count = (garden.photos ? garden.photos.length : 0) + (garden.notes ? 1 : 0);
        badgeSecret.textContent = count > 0 ? " (" + count + ")" : "";
    }

    const dishes = getCityFoodDishes(city);
    const badgeFood = document.querySelector("#tab-count-food");
    if (badgeFood) {
        badgeFood.textContent = dishes.length > 0 ? " (" + dishes.length + ")" : "";
    }
}

function switchCityTab(tabName) {
    document.querySelectorAll(".section-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.tab === tabName);
    });
    const panePlaces = document.querySelector("#section-pane-places");
    const paneGarden = document.querySelector("#section-pane-secret-garden");
    const paneFood = document.querySelector("#section-pane-food-log");
    const paneMemories = document.querySelector("#section-pane-memories");

    if (panePlaces) panePlaces.classList.toggle("active", tabName === "places" || tabName === "memories");
    if (paneGarden) paneGarden.classList.toggle("active", tabName === "secret-garden");
    if (paneFood) paneFood.classList.toggle("active", tabName === "food-log");
    if (paneMemories) paneMemories.classList.toggle("active", false);
}

function renderPlacesSummary(city) {
    if (!city) return;
    const container = document.querySelector("#section-pane-places") || placePanel;
    let sectionWrapper = container.querySelector("#places-section-wrapper");
    if (!sectionWrapper) {
        sectionWrapper = document.createElement("div");
        sectionWrapper.id = "places-section-wrapper";
        container.appendChild(sectionWrapper);
    }
    sectionWrapper.innerHTML = "";

    const places = getCityPlaces(city);

    // 头部
    const header = document.createElement("div");
    header.className = "places-section-header";

    const heading = document.createElement("div");
    heading.className = "places-section-title";
    heading.textContent = "01 飞行日志 · FLIGHT LOG";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "places-action-button";
    addBtn.dataset.action = "add-place";
    addBtn.textContent = "+ 添加记录 / ADD RECORD";

    header.appendChild(heading);
    header.appendChild(addBtn);
    sectionWrapper.appendChild(header);

    // 横幅进入完整画报页（小狗日记簿）
    const banner = document.createElement("button");
    banner.type = "button";
    banner.className = "open-archive-banner";
    banner.dataset.action = "open-places-archive";
    banner.innerHTML = "<span>VIEW ARCHIVE / 小狗日记簿</span><strong>→</strong>";
    sectionWrapper.appendChild(banner);

    // 滚动列表
    const list = document.createElement("div");
    list.className = "places-scroll-list";
    sectionWrapper.appendChild(list);

    if (places.length === 0) {
        const empty = document.createElement("div");
        empty.style.padding = "16px 0";
        empty.style.fontSize = "11px";
        empty.style.opacity = "0.45";
        empty.style.letterSpacing = "0.08em";
        empty.textContent = "暂无收录地点与活动，点击上方添加收录第一条手记。";
        list.appendChild(empty);
        return;
    }

    places.forEach((place, index) => {
        const card = document.createElement("div");
        card.className = "place-item-card";
        card.dataset.action = "open-places-archive";
        card.dataset.placeId = place.id;

        const headerRow = document.createElement("div");
        headerRow.className = "place-item-header";

        const nameEl = document.createElement("div");
        nameEl.className = "place-item-name";
        nameEl.textContent = place.name || "未命名地点 / 活动";

        const idxEl = document.createElement("div");
        idxEl.className = "place-item-idx";
        idxEl.textContent = "NO. " + String(index + 1).padStart(2, "0");

        headerRow.appendChild(nameEl);
        headerRow.appendChild(idxEl);
        card.appendChild(headerRow);

        const metaRow = document.createElement("div");
        metaRow.className = "place-item-meta";

        if (place.category) {
            const cat = document.createElement("span");
            cat.className = "place-item-category";
            cat.textContent = place.category;
            metaRow.appendChild(cat);
        }
        if (place.date) {
            const date = document.createElement("span");
            date.textContent = place.date;
            metaRow.appendChild(date);
        }
        if (place.location) {
            const loc = document.createElement("span");
            loc.textContent = "· " + place.location;
            metaRow.appendChild(loc);
        }
        card.appendChild(metaRow);

        const currentPlacePhotos = extractPlacePhotos(place);
        if (currentPlacePhotos.length > 0) {
            const photoStrip = document.createElement("div");
            photoStrip.className = "place-item-photos-preview";
            currentPlacePhotos.forEach((src, pIdx) => {
                if (!src) return;
                const img = document.createElement("img");
                img.src = src;
                img.alt = "飞行日志照片 " + (pIdx + 1);
                img.className = "place-item-photo-thumb";
                img.title = "点击全屏放大查看";
                img.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openPhotoLightbox(src);
                });
                photoStrip.appendChild(img);
            });
            card.appendChild(photoStrip);
        }

        if (place.content) {
            const snippet = document.createElement("div");
            snippet.className = "place-item-snippet";
            snippet.textContent = place.content.length > 70 ? place.content.slice(0, 70) + "…" : place.content;
            card.appendChild(snippet);
        }

        // 特别的记忆提示
        if (place.secretNotes || (place.secretPhotos && place.secretPhotos.length > 0)) {
            const secretBadge = document.createElement("div");
            secretBadge.className = "place-item-secret-indicator";
            secretBadge.innerHTML = "<span>✦ 秘密花园</span>";
            card.appendChild(secretBadge);
        }

        const footer = document.createElement("div");
        footer.className = "place-item-footer";

        const actions = document.createElement("div");
        actions.className = "place-item-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "place-action-link";
        editBtn.dataset.action = "edit-place";
        editBtn.dataset.placeId = place.id;
        editBtn.textContent = "EDIT";
        editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openPlaceEditor(city, place);
        });

        const orderControls = document.createElement("div");
        orderControls.className = "item-order-controls";

        if (index > 0) {
            const upBtn = document.createElement("button");
            upBtn.type = "button";
            upBtn.className = "order-btn order-up-btn";
            upBtn.textContent = "↑ 上移";
            upBtn.title = "上移一条记录";
            upBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                movePlaceItem(city, index, index - 1);
            });
            orderControls.appendChild(upBtn);
        }

        if (index < places.length - 1) {
            const downBtn = document.createElement("button");
            downBtn.type = "button";
            downBtn.className = "order-btn order-down-btn";
            downBtn.textContent = "↓ 下移";
            downBtn.title = "下移一条记录";
            downBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                movePlaceItem(city, index, index + 1);
            });
            orderControls.appendChild(downBtn);
        }

        const currentLinks = getPlaceLinks(place);
        if (currentLinks.length > 0) {
            const linksWrap = document.createElement("div");
            linksWrap.className = "place-item-links-strip";
            currentLinks.forEach(lnk => {
                if (!lnk.url) return;
                const linkTag = document.createElement("a");
                linkTag.href = lnk.url;
                linkTag.target = "_blank";
                linkTag.rel = "noopener noreferrer";
                linkTag.className = "place-item-link-btn";
                linkTag.innerHTML = '<span class="link-label">' + escapeHtml(lnk.name || "LINK") + '</span> <span class="link-arrow">↗</span>';
                linkTag.title = (lnk.name ? lnk.name + " · " : "") + lnk.url;
                linkTag.addEventListener("click", (e) => {
                    e.stopPropagation();
                });
                linksWrap.appendChild(linkTag);
            });
            actions.appendChild(linksWrap);
        }

        actions.appendChild(editBtn);
        footer.appendChild(orderControls);
        footer.appendChild(actions);
        card.appendChild(footer);

        // 拖拽排序支持
        card.draggable = true;
        card.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", String(index));
            card.style.opacity = "0.35";
        });
        card.addEventListener("dragend", () => {
            card.style.opacity = "1";
        });
        card.addEventListener("dragover", (e) => {
            e.preventDefault();
        });
        card.addEventListener("drop", (e) => {
            e.preventDefault();
            const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
            if (!isNaN(fromIdx) && fromIdx !== index) {
                movePlaceItem(city, fromIdx, index);
            }
        });

        list.appendChild(card);
    });
}

function openPlacesArchivePage(city, focusPlaceId) {
    if (!city) return;
    closePlacesArchivePage();

    const places = getCityPlaces(city);

    const page = document.createElement("div");
    page.id = "place-archive-page";

    // 顶部导航条
    const topBar = document.createElement("header");
    topBar.className = "archive-top-bar";

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "archive-back-btn";
    backBtn.dataset.action = "close-places-archive";
    backBtn.textContent = "← BACK TO MAP";
    backBtn.addEventListener("click", () => closePlacesArchivePage());

    const locTitle = document.createElement("div");
    locTitle.className = "archive-top-location";
    locTitle.textContent = city.name.toUpperCase() + " / 小狗日记簿";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "archive-top-add-btn";
    addBtn.dataset.action = "add-place";
    addBtn.textContent = "+ ADD PLACE / EVENT";
    addBtn.addEventListener("click", () => openPlaceEditor(city, null));

    topBar.appendChild(backBtn);
    topBar.appendChild(locTitle);
    topBar.appendChild(addBtn);
    page.appendChild(topBar);

    // 内容容器
    const container = document.createElement("div");
    container.className = "archive-content-container";

    const headerBlock = document.createElement("div");
    headerBlock.className = "archive-header-block";

    const subtitle = document.createElement("div");
    subtitle.className = "archive-subtitle";
    subtitle.textContent = "02 / CITY ARCHIVE · " + city.province.toUpperCase() + " / CHINA";

    const title = document.createElement("h1");
    title.className = "archive-title";
    title.textContent = "Lars的私人城市手记·" + city.name;

    const desc = document.createElement("p");
    desc.className = "archive-desc";
    desc.textContent = "“一本长大的秘籍加上航行的风帆”";

    headerBlock.appendChild(subtitle);
    headerBlock.appendChild(title);
    headerBlock.appendChild(desc);
    container.appendChild(headerBlock);

    if (places.length === 0) {
        const emptyBlock = document.createElement("div");
        emptyBlock.style.padding = "60px 0";
        emptyBlock.style.textAlign = "center";
        emptyBlock.innerHTML = `
            <div style="font-size:12px;letter-spacing:.16em;opacity:.5;margin-bottom:18px;">NO PLACES OR ACTIVITIES RECORDED YET</div>
            <button type="button" class="archive-top-add-btn" data-action="add-place">+ 收录第一个地点 / 活动</button>
        `;
        emptyBlock.querySelector("button").addEventListener("click", () => openPlaceEditor(city, null));
        container.appendChild(emptyBlock);
    } else {
        places.forEach((place, index) => {
            const entry = document.createElement("article");
            entry.className = "archive-entry-card";
            entry.id = "place-entry-" + place.id;

            const metaRow = document.createElement("div");
            metaRow.className = "archive-entry-meta-row";

            const idxEl = document.createElement("div");
            idxEl.className = "archive-entry-idx";
            idxEl.textContent = String(index + 1).padStart(2, "0");

            const tagsEl = document.createElement("div");
            tagsEl.className = "archive-entry-tags";
            if (place.category) tagsEl.innerHTML += `<span>[ ${place.category} ]</span>`;
            if (place.date) tagsEl.innerHTML += `<span>DATE: ${place.date}</span>`;
            if (place.location) tagsEl.innerHTML += `<span>LOC: ${place.location}</span>`;

            metaRow.appendChild(idxEl);
            metaRow.appendChild(tagsEl);
            entry.appendChild(metaRow);

            const titleEl = document.createElement("h2");
            titleEl.className = "archive-entry-title";
            titleEl.textContent = place.name;
            entry.appendChild(titleEl);

            // 照片画廊
            if (place.photos && place.photos.length > 0) {
                const gallery = document.createElement("div");
                gallery.className = "archive-photo-gallery";
                place.photos.forEach(photoSrc => {
                    const item = document.createElement("div");
                    item.className = "archive-photo-item";
                    item.innerHTML = `<img src="${photoSrc}" alt="${place.name}" ><div class="archive-photo-item-caption">点击放大查看</div>`;
                    item.addEventListener("click", () => openPhotoLightbox(photoSrc));
                    gallery.appendChild(item);
                });
                entry.appendChild(gallery);
            }

            // 正文手记
            if (place.content) {
                const textEl = document.createElement("div");
                textEl.className = "archive-entry-text";
                textEl.textContent = place.content;
                entry.appendChild(textEl);
            }

            // 特别的记忆 / 秘密花园专栏
            if (place.secretNotes || (place.secretPhotos && place.secretPhotos.length > 0)) {
                const secretBlock = document.createElement("div");
                secretBlock.className = "archive-secret-garden";

                const secHeader = document.createElement("div");
                secHeader.className = "archive-secret-garden-header";
                secHeader.innerHTML = `
                    <span class="archive-secret-garden-label">特别的记忆 / 秘密花园</span>
                    <span class="editor-secret-garden-badge">PRIVATE</span>
                `;
                secretBlock.appendChild(secHeader);

                if (place.secretNotes) {
                    const secText = document.createElement("div");
                    secText.className = "archive-secret-garden-text";
                    secText.textContent = place.secretNotes;
                    secretBlock.appendChild(secText);
                }

                if (place.secretPhotos && place.secretPhotos.length > 0) {
                    const secGrid = document.createElement("div");
                    secGrid.className = "archive-secret-photos-grid";
                    place.secretPhotos.forEach(src => {
                        const item = document.createElement("div");
                        item.className = "archive-secret-photo-item";
                        item.innerHTML = `<img src="${src}" alt="秘密花园照片" >`;
                        item.addEventListener("click", () => openPhotoLightbox(src));
                        secGrid.appendChild(item);
                    });
                    secretBlock.appendChild(secGrid);
                }

                entry.appendChild(secretBlock);
            }

            // 外部链接
            if (place.link) {
                const linkBlock = document.createElement("div");
                linkBlock.className = "archive-entry-link-section";
                linkBlock.innerHTML = `
                    <a href="${place.link}" target="_blank" rel="noopener noreferrer" class="archive-entry-external-link">
                        <span class="link-prefix">EXTERNAL LINK ↗</span>
                        <span class="link-target-url">${place.link}</span>
                    </a>
                `;
                entry.appendChild(linkBlock);
            }

            // 底部操作与排序
            const footer = document.createElement("div");
            footer.className = "archive-entry-footer";
            footer.style.display = "flex";
            footer.style.alignItems = "center";
            footer.style.justifyContent = "space-between";

            const orderControls = document.createElement("div");
            orderControls.className = "item-order-controls";
            orderControls.style.display = "flex";
            orderControls.style.gap = "10px";

            if (index > 0) {
                const upBtn = document.createElement("button");
                upBtn.type = "button";
                upBtn.className = "place-action-link";
                upBtn.textContent = "↑ 上移";
                upBtn.addEventListener("click", () => movePlaceItem(city, index, index - 1));
                orderControls.appendChild(upBtn);
            }

            if (index < places.length - 1) {
                const downBtn = document.createElement("button");
                downBtn.type = "button";
                downBtn.className = "place-action-link";
                downBtn.textContent = "↓ 下移";
                downBtn.addEventListener("click", () => movePlaceItem(city, index, index + 1));
                orderControls.appendChild(downBtn);
            }

            const actionBtns = document.createElement("div");
            actionBtns.style.display = "flex";
            actionBtns.style.gap = "14px";

            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "place-action-link";
            editBtn.textContent = "EDIT / 编辑";
            editBtn.addEventListener("click", () => openPlaceEditor(city, place));

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "place-action-link";
            delBtn.style.opacity = "0.45";
            delBtn.textContent = "DELETE / 删除";
            delBtn.addEventListener("click", () => {
                if (window.confirm("确定删除「" + place.name + "」这条手记吗？")) {
                    const updated = getCityPlaces(city).filter(p => p.id !== place.id);
                    saveCityPlaces(city, updated);
                    openPlacesArchivePage(city);
                    renderPlacesSummary(city);
                    updateCityTabCounts(city);
                }
            });

            actionBtns.appendChild(editBtn);
            actionBtns.appendChild(delBtn);

            footer.appendChild(orderControls);
            footer.appendChild(actionBtns);
            entry.appendChild(footer);

            container.appendChild(entry);
        });
    }

    page.appendChild(container);
    document.body.appendChild(page);

    if (focusPlaceId) {
        setTimeout(() => {
            const target = document.getElementById("place-entry-" + focusPlaceId);
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    } else {
        page.scrollTop = 0;
    }
}

function closePlacesArchivePage() {
    const page = document.querySelector("#place-archive-page");
    if (page) page.remove();
}

function openPhotoLightbox(photoUrl) {
    closePhotoLightbox();
    const overlay = document.createElement("div");
    overlay.id = "photo-lightbox-overlay";
    overlay.dataset.action = "close-lightbox";

    overlay.innerHTML = `
        <button type="button" class="lightbox-close-btn" data-action="close-lightbox" aria-label="关闭大图">×</button>
        <div class="lightbox-image-wrapper">
            <img src="${photoUrl}" alt="照片原图">
        </div>
    `;

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.closest("[data-action='close-lightbox']")) {
            closePhotoLightbox();
        }
    });

    document.body.appendChild(overlay);
}

function closePhotoLightbox() {
    const overlay = document.querySelector("#photo-lightbox-overlay");
    if (overlay) overlay.remove();
}

function compressImageFile(file, maxWidth = 800, quality = 0.75) {
    return new Promise((resolve) => {
        if (!file) return resolve("");
        const reader = new FileReader();
        reader.onload = function (e) {
            const rawData = e.target.result;
            if (!rawData || typeof rawData !== "string") {
                return resolve("");
            }
            // If already a small data URL (< 160KB), return immediately without canvas
            if (rawData.length < 160 * 1024) {
                return resolve(rawData);
            }
            const img = new Image();
            img.onload = function () {
                try {
                    let width = img.naturalWidth || img.width;
                    let height = img.naturalHeight || img.height;
                    if (!width || !height) return resolve(rawData);
                    if (width > maxWidth || height > maxWidth) {
                        if (width >= height) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        } else {
                            width = Math.round((width * maxWidth) / height);
                            height = maxWidth;
                        }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressed = canvas.toDataURL("image/jpeg", quality);
                    if (compressed && compressed.length > 50) {
                        resolve(compressed);
                    } else {
                        resolve(rawData);
                    }
                } catch (canvasErr) {
                    console.warn("Canvas compression fallback to rawData:", canvasErr);
                    resolve(rawData);
                }
            };
            img.onerror = function () {
                resolve(rawData);
            };
            img.src = rawData;
        };
        reader.onerror = function () {
            resolve("");
        };
        reader.readAsDataURL(file);
    });
}

function openPlaceEditor(city, place) {
    closePlaceEditor();
    if (!city) return;

    let attachedPhotos = extractPlacePhotos(place);

    const overlay = document.createElement("div");
    overlay.id = "place-editor-overlay";

    const box = document.createElement("div");
    box.className = "place-editor-box";

    // 头部
    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.alignItems = "center";
    top.style.justifyContent = "space-between";
    top.style.marginBottom = "22px";

    const heading = document.createElement("div");
    heading.textContent = place ? "EDIT PLACE / EVENT" : "ADD PLACE / EVENT";
    heading.style.fontSize = "12px";
    heading.style.letterSpacing = ".16em";
    heading.style.fontFamily = "Cormorant Garamond, serif";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.style.border = "none";
    closeBtn.style.background = "transparent";
    closeBtn.style.fontSize = "26px";
    closeBtn.style.cursor = "pointer";
    closeBtn.addEventListener("click", () => closePlaceEditor());

    top.appendChild(heading);
    top.appendChild(closeBtn);
    box.appendChild(top);

    // 表单
    const form = document.createElement("form");

    addEditorField(form, "PLACE / EVENT NAME (地点或活动名称)", "place-name", place ? place.name : "", false);
    addEditorField(form, "CATEGORY (类别/标签，如：小剧场、咖啡馆、展览)", "place-category", place ? place.category : "", false);
    addEditorField(form, "DATE (日期，如：2026.04)", "place-date", place ? place.date : "", false);
    
    // 多链接管理区域
    const linksGroup = document.createElement("div");
    linksGroup.className = "editor-field-group editor-links-field-group";
    linksGroup.innerHTML = '<label class="editor-field-label">EXTERNAL LINKS (外部链接，可自由添加多个，如出发图/现场直拍/相关网页)</label><div id="editor-place-links-list" class="editor-links-list"></div><div style="margin-top: 8px;"><button type="button" class="editor-add-link-btn" id="btn-add-place-link">+ 添加一个外部链接 / ADD LINK</button></div>';
    
    let currentPlaceLinks = getPlaceLinks(place);
    const linksListContainer = linksGroup.querySelector("#editor-place-links-list");

    function renderEditorLinks() {
        linksListContainer.innerHTML = "";
        if (currentPlaceLinks.length === 0) {
            linksListContainer.innerHTML = '<div class="editor-links-empty">暂未添加外部链接（可选）</div>';
        } else {
            currentPlaceLinks.forEach((item, lIdx) => {
                const row = document.createElement("div");
                row.className = "editor-link-row";
                row.innerHTML = '<input type="text" class="editor-input link-name-input" placeholder="链接名称（如：出发图、视频直拍）" value="' + escapeHtml(item.name || '') + '"><input type="text" class="editor-input link-url-input" placeholder="网址（如：https://...）" value="' + escapeHtml(item.url || '') + '"><button type="button" class="editor-link-del-btn" title="删除链接">×</button>';
                
                const nameInp = row.querySelector(".link-name-input");
                const urlInp = row.querySelector(".link-url-input");
                const delBtn = row.querySelector(".editor-link-del-btn");

                nameInp.addEventListener("input", (e) => {
                    currentPlaceLinks[lIdx].name = e.target.value;
                });
                urlInp.addEventListener("input", (e) => {
                    currentPlaceLinks[lIdx].url = e.target.value;
                });
                delBtn.addEventListener("click", () => {
                    currentPlaceLinks.splice(lIdx, 1);
                    renderEditorLinks();
                });
                linksListContainer.appendChild(row);
            });
        }
    }
    renderEditorLinks();

    linksGroup.querySelector("#btn-add-place-link").addEventListener("click", () => {
        currentPlaceLinks.push({ name: "", url: "" });
        renderEditorLinks();
    });
    form.appendChild(linksGroup);


    // 照片上传区域
    const photoSection = document.createElement("div");
    photoSection.className = "editor-photos-manager";

    const photoHeader = document.createElement("div");
    photoHeader.className = "editor-photos-header";
    photoHeader.innerHTML = `<span style="font-size:9px;letter-spacing:.14em;opacity:.5;">PHOTOS (照片档案，支持多张照片)</span>`;
    photoSection.appendChild(photoHeader);

    const uploadControls = document.createElement("div");
    uploadControls.className = "editor-upload-controls";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.style.position = "absolute";
    fileInput.style.width = "0.1px";
    fileInput.style.height = "0.1px";
    fileInput.style.opacity = "0";
    fileInput.style.overflow = "hidden";
    fileInput.style.zIndex = "-1";

    const fileLabel = document.createElement("button");
    fileLabel.type = "button";
    fileLabel.className = "editor-file-label";
    fileLabel.innerHTML = `<span>+ 本地上传照片</span>`;
    fileLabel.addEventListener("click", (e) => {
        e.preventDefault();
        fileInput.click();
    });

    const urlGroup = document.createElement("div");
    urlGroup.className = "editor-url-input-group";

    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.placeholder = "或输入图片链接 URL";

    const urlAddBtn = document.createElement("button");
    urlAddBtn.type = "button";
    urlAddBtn.className = "editor-url-add-btn";
    urlAddBtn.textContent = "添加链接";

    urlGroup.appendChild(urlInput);
    urlGroup.appendChild(urlAddBtn);

    uploadControls.appendChild(fileLabel);
    uploadControls.appendChild(fileInput);
    uploadControls.appendChild(urlGroup);
    photoSection.appendChild(uploadControls);

    const previewStrip = document.createElement("div");
    previewStrip.className = "editor-photos-preview-strip";
    photoSection.appendChild(previewStrip);

    function refreshPhotoPreviews() {
        previewStrip.innerHTML = "";
        attachedPhotos.forEach((src, idx) => {
            const thumb = document.createElement("div");
            thumb.className = "editor-thumb-item";
            thumb.innerHTML = `<img src="${src}" alt="photo"><button type="button" class="editor-thumb-del">×</button>`;
            thumb.querySelector(".editor-thumb-del").addEventListener("click", () => {
                attachedPhotos.splice(idx, 1);
                refreshPhotoPreviews();
            });
            previewStrip.appendChild(thumb);
        });
    }

    fileInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []);
        for (const file of files) {
            try {
                const compressed = await compressImageFile(file);
                attachedPhotos.push(compressed);
            } catch (err) {
                console.error("照片压缩失败:", err);
            }
        }
        refreshPhotoPreviews();
        fileInput.value = "";
    });

    urlAddBtn.addEventListener("click", () => {
        const val = urlInput.value.trim();
        if (val) {
            attachedPhotos.push(val);
            urlInput.value = "";
            refreshPhotoPreviews();
        }
    });

    refreshPhotoPreviews();
    form.appendChild(photoSection);

    addEditorField(form, "TRAVEL NOTES (手记 / 记录文字)", "place-content", place ? place.content : "", true);
    addEditorField(form, "特别的记忆 / 秘密花园 (一段私密瞬间 / 一件只有自己知道的小事)", "place-secret-notes", place ? (place.secretNotes || "") : "", true);

    // 操作按钮
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.alignItems = "center";
    actions.style.justifyContent = "space-between";
    actions.style.marginTop = "24px";

    const left = document.createElement("div");
    if (place) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "DELETE";
        delBtn.style.border = "none";
        delBtn.style.background = "transparent";
        delBtn.style.cursor = "pointer";
        delBtn.style.fontSize = "10px";
        delBtn.style.letterSpacing = ".12em";
        delBtn.style.opacity = "0.5";
        delBtn.addEventListener("click", () => {
            if (window.confirm("确定删除「" + place.name + "」这条手记吗？")) {
                const updated = getCityPlaces(city).filter(p => p.id !== place.id);
                saveCityPlaces(city, updated);
                closePlaceEditor();
                renderPlacesSummary(city);
                updateCityTabCounts(city);
                const archivePage = document.querySelector("#place-archive-page");
                if (archivePage) openPlacesArchivePage(city);
            }
        });
        left.appendChild(delBtn);
    }

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "14px";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "CANCEL";
    cancelBtn.style.border = "none";
    cancelBtn.style.background = "transparent";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.style.fontSize = "10px";
    cancelBtn.style.letterSpacing = ".12em";
    cancelBtn.addEventListener("click", () => closePlaceEditor());

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "SAVE";
    saveBtn.style.border = "1px solid rgba(0,0,0,.35)";
    saveBtn.style.background = "transparent";
    saveBtn.style.padding = "8px 18px";
    saveBtn.style.cursor = "pointer";
    saveBtn.style.fontSize = "10px";
    saveBtn.style.letterSpacing = ".12em";

    saveBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const nameVal = form.querySelector('[name="place-name"]').value.trim();
        const catVal = form.querySelector('[name="place-category"]').value.trim();
        const dateVal = form.querySelector('[name="place-date"]').value.trim();
        const contentVal = form.querySelector('[name="place-content"]').value.trim();

        const savedLinks = [];
        for (let i = 0; i < currentPlaceLinks.length; i++) {
            const item = currentPlaceLinks[i];
            const rawUrl = (item.url || "").trim();
            const rawName = (item.name || "").trim();
            if (rawUrl) {
                const norm = normalizeExternalUrl(rawUrl);
                if (norm === null) {
                    alert("链接「" + (rawName || ("第" + (i + 1) + "条")) + "」的网址无效，请输入有效网址（例如 https://example.com）");
                    return;
                }
                savedLinks.push({
                    name: rawName || "外部链接",
                    url: norm
                });
            } else if (rawName) {
                alert("请输入「" + rawName + "」对应的网址。");
                return;
            }
        }
        const validLink = savedLinks[0] ? savedLinks[0].url : "";

        const secretNotesInput = form.querySelector('[name="place-secret-notes"]');
        const secretNotesVal = secretNotesInput ? secretNotesInput.value.trim() : "";

        if (!nameVal && !contentVal && !secretNotesVal) {
            alert("请至少填写地点/活动名称或手记内容。");
            return;
        }

        const places = getCityPlaces(city);
        if (place && place.id) {
            const idx = places.findIndex(p => p.id === place.id);
            if (idx !== -1) {
                places[idx] = {
                    ...places[idx],
                    name: nameVal || "未命名地点 / 活动",
                    category: catVal,
                    date: dateVal,
                    link: validLink, links: savedLinks,
                    photos: attachedPhotos, photo: attachedPhotos[0] || "",
                    content: contentVal,
                    secretNotes: secretNotesVal
                };
            }
        } else {
            places.unshift({
                id: "place-" + Date.now(),
                name: nameVal || "未命名地点 / 活动",
                category: catVal,
                date: dateVal,
                link: validLink,
                location: "",
                photos: attachedPhotos,
                secretPhotos: [],
                content: contentVal,
                secretNotes: secretNotesVal
            });
        }

        saveCityPlaces(city, places);
        closePlaceEditor();
        renderPlacesSummary(city);
        updateCityTabCounts(city);
        const archivePage = document.querySelector("#place-archive-page");
        if (archivePage) openPlacesArchivePage(city);
    });

    right.appendChild(cancelBtn);
    right.appendChild(saveBtn);

    actions.appendChild(left);
    actions.appendChild(right);
    form.appendChild(actions);

    box.appendChild(form);
    overlay.appendChild(box);

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closePlaceEditor();
    });

    document.body.appendChild(overlay);
}

function closePlaceEditor() {
    const overlay = document.querySelector("#place-editor-overlay");
    if (overlay) overlay.remove();
}


/* =====================================================
   记忆编辑器
===================================================== */

function openMemoryEditor(
    city,
    memory
) {

    closeMemoryEditor();


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "memory-editor-overlay";


    overlay.style.position =
        "fixed";


    overlay.style.inset =
        "0";


    overlay.style.zIndex =
        "3000";


    overlay.style.background =
        "rgba(255,255,255,.72)";


    overlay.style.display =
        "flex";


    overlay.style.alignItems =
        "center";


    overlay.style.justifyContent =
        "center";


    overlay.style.padding =
        "24px";


    const editor =
        document.createElement(
            "div"
        );


    editor.style.width =
        "min(560px, 92vw)";


    editor.style.maxHeight =
        "88vh";


    editor.style.overflowY =
        "auto";


    editor.style.background =
        "#fff";


    editor.style.padding =
        "28px";


    editor.style.boxSizing =
        "border-box";


    editor.style.border =
        "1px solid rgba(0,0,0,.12)";


    editor.style.boxShadow =
        "0 12px 40px rgba(0,0,0,.08)";


    const top =
        document.createElement(
            "div"
        );


    top.style.display =
        "flex";


    top.style.alignItems =
        "center";


    top.style.justifyContent =
        "space-between";


    top.style.marginBottom =
        "24px";


    const heading =
        document.createElement(
            "div"
        );


    heading.textContent =
        memory
            ? "EDIT MEMORY"
            : "ADD MEMORY";


    heading.style.fontSize =
        "12px";


    heading.style.letterSpacing =
        ".16em";


    const close =
        document.createElement(
            "button"
        );


    close.type =
        "button";


    close.dataset.action =
        "close-memory-editor";


    close.textContent =
        "×";


    close.style.border =
        "0";


    close.style.background =
        "transparent";


    close.style.fontSize =
        "24px";


    close.style.lineHeight =
        "1";


    close.style.cursor =
        "pointer";


    top.appendChild(
        heading
    );


    top.appendChild(
        close
    );


    const form =
        document.createElement(
            "form"
        );


    form.dataset.memoryForm =
        "true";


    form.dataset.cityId =
        city.id;


    form.dataset.memoryId =
        memory
            ? memory.id
            : "";


    addEditorField(
        form,
        "TITLE",
        "memory-title",
        memory
            ? memory.title
            : "",
        false
    );


    addEditorField(
        form,
        "DATE",
        "memory-date",
        memory
            ? memory.date
            : "",
        false
    );


    addEditorField(
        form,
        "CONTENT",
        "memory-content",
        memory
            ? memory.content
            : "",
        true
    );


    addEditorField(
        form,
        "EXTERNAL LINK (外部链接，可选)",
        "memory-link",
        memory
            ? (memory.link || "")
            : "",
        false
    );


    const actions =
        document.createElement(
            "div"
        );


    actions.style.display =
        "flex";


    actions.style.alignItems =
        "center";


    actions.style.justifyContent =
        "space-between";


    actions.style.gap =
        "16px";


    actions.style.marginTop =
        "22px";


    const left =
        document.createElement(
            "div"
        );


    if (memory) {

        const del =
            document.createElement(
                "button"
            );


        del.type =
            "button";


        del.dataset.action =
            "delete-memory";


        del.dataset.cityId =
            city.id;


        del.dataset.memoryId =
            memory.id;


        del.textContent =
            "DELETE";


        del.style.border =
            "0";


        del.style.background =
            "transparent";


        del.style.cursor =
            "pointer";


        del.style.fontSize =
            "10px";


        del.style.letterSpacing =
            ".12em";


        left.appendChild(
            del
        );
    }


    const right =
        document.createElement(
            "div"
        );


    right.style.display =
        "flex";


    right.style.gap =
        "14px";


    const cancel =
        document.createElement(
            "button"
        );


    cancel.type =
        "button";


    cancel.dataset.action =
        "close-memory-editor";


    cancel.textContent =
        "CANCEL";


    cancel.style.border =
        "0";


    cancel.style.background =
        "transparent";


    cancel.style.cursor =
        "pointer";


    cancel.style.fontSize =
        "10px";


    cancel.style.letterSpacing =
        ".12em";


    const save =
        document.createElement(
            "button"
        );


    save.type =
        "button";


    save.dataset.action =
        "save-memory";


    save.textContent =
        "SAVE";


    save.style.border =
        "1px solid rgba(0,0,0,.35)";


    save.style.background =
        "transparent";


    save.style.padding =
        "8px 16px";


    save.style.cursor =
        "pointer";


    save.style.fontSize =
        "10px";


    save.style.letterSpacing =
        ".12em";


    right.appendChild(
        cancel
    );


    right.appendChild(
        save
    );


    actions.appendChild(
        left
    );


    actions.appendChild(
        right
    );


    form.appendChild(
        actions
    );


    editor.appendChild(
        top
    );


    editor.appendChild(
        form
    );


    overlay.appendChild(
        editor
    );


    document.body.appendChild(
        overlay
    );


    overlay.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                overlay
            ) {

                closeMemoryEditor();
            }
        }
    );
}


/* =====================================================
   编辑器字段
===================================================== */

function addEditorField(
    form,
    labelText,
    name,
    value,
    textarea
) {

    const wrapper =
        document.createElement(
            "label"
        );


    wrapper.style.display =
        "block";


    wrapper.style.marginBottom =
        "16px";


    const label =
        document.createElement(
            "div"
        );


    label.textContent =
        labelText;


    label.style.fontSize =
        "9px";


    label.style.letterSpacing =
        ".14em";


    label.style.opacity =
        ".5";


    label.style.marginBottom =
        "7px";


    const input =
        textarea
            ? document.createElement(
                "textarea"
            )
            : document.createElement(
                "input"
            );


    input.name =
        name;


    input.value =
        value ||
        "";


    input.style.width =
        "100%";


    input.style.boxSizing =
        "border-box";


    input.style.border =
        "1px solid rgba(0,0,0,.15)";


    input.style.background =
        "transparent";


    input.style.padding =
        "10px";


    input.style.fontFamily =
        "inherit";


    input.style.fontSize =
        "13px";


    input.style.outline =
        "none";


    if (
        textarea
    ) {

        input.rows =
            8;


        input.style.resize =
            "vertical";


        input.style.lineHeight =
            "1.7";
    }


    wrapper.appendChild(
        label
    );


    wrapper.appendChild(
        input
    );


    form.appendChild(
        wrapper
    );
}


/* =====================================================
   关闭编辑器
===================================================== */

function closeMemoryEditor() {

    const overlay =
        document.querySelector(
            "#memory-editor-overlay"
        );


    if (overlay) {

        overlay.remove();
    }
}



/* =====================================================
   所有记忆按钮
===================================================== */

document.addEventListener(
    "click",
    function (event) {

        const button =
            event.target.closest
                ? event.target.closest(
                    "[data-action]"
                )
                : null;


        if (!button) {
            return;
        }


        const action =
            button.dataset.action;

        /* =================================================
           关闭城市面板
        ================================================= */

        if (
            action === "close-city-panel" ||
            (event.target.closest && event.target.closest("#close-place"))
        ) {
            event.preventDefault();
            event.stopPropagation();
            closeCityView();
            return;
        }

        /* =================================================
           切换城市板块 (记忆 / 地点与活动)
        ================================================= */

        if (action === "switch-city-tab") {
            event.preventDefault();
            event.stopPropagation();
            if (button.dataset.tab) {
                switchCityTab(button.dataset.tab);
            }
            return;
        }

        /* =================================================
           打开城市地点/活动档案全屏画报
        ================================================= */

        if (action === "open-places-archive" || action === "open-place-archive-page") {
            event.preventDefault();
            event.stopPropagation();
            if (currentCity) {
                openPlacesArchivePage(currentCity, button.dataset.placeId);
            }
            return;
        }

        /* =================================================
           关闭城市地点/活动档案全屏画报
        ================================================= */

        if (action === "close-places-archive" || action === "close-place-archive") {
            event.preventDefault();
            event.stopPropagation();
            closePlacesArchivePage();
            return;
        }

        /* =================================================
           添加地点/活动
        ================================================= */

        if (action === "add-place") {
            event.preventDefault();
            event.stopPropagation();
            if (currentCity) {
                openPlaceEditor(currentCity, null);
            }
            return;
        }

        /* =================================================
           编辑地点/活动
        ================================================= */

        if (action === "edit-place") {
            event.preventDefault();
            event.stopPropagation();
            if (currentCity && button.dataset.placeId) {
                const places = getCityPlaces(currentCity);
                const pl = places.find(p => p.id === button.dataset.placeId);
                if (pl) {
                    openPlaceEditor(currentCity, pl);
                }
            }
            return;
        }

        /* =================================================
           关闭地点/活动编辑器
        ================================================= */

        if (action === "close-place-editor") {
            event.preventDefault();
            event.stopPropagation();
            closePlaceEditor();
            return;
        }

        /* =================================================
           打开大图灯箱
        ================================================= */

        if (action === "open-lightbox") {
            event.preventDefault();
            event.stopPropagation();
            if (button.dataset.photoUrl) {
                openPhotoLightbox(button.dataset.photoUrl);
            }
            return;
        }

        /* =================================================
           关闭大图灯箱
        ================================================= */

        if (action === "close-lightbox") {
            event.preventDefault();
            event.stopPropagation();
            closePhotoLightbox();
            return;
        }


        /* =================================================
           关闭详情页面
        ================================================= */

        if (
            action ===
            "close-memory-detail"
        ) {

            event.preventDefault();

            event.stopPropagation();

            closeMemoryDetail();

            return;
        }


        /* =================================================
           打开记忆详情
        ================================================= */

        if (
            action ===
            "open-memory-detail"
        ) {

            event.preventDefault();

            event.stopPropagation();


            if (!currentCity) {
                return;
            }


            const memories =
                getMemories(
                    currentCity
                );


            const memory =
                memories.find(
                    function (item) {

                        return (
                            item.id ===
                            button.dataset.memoryId
                        );
                    }
                );


            if (memory) {

                openMemoryDetail(
                    currentCity,
                    memory
                );
            }


            return;
        }


        /* =================================================
           关闭编辑器
        ================================================= */

        if (
            action ===
            "close-memory-editor"
        ) {

            event.preventDefault();

            event.stopPropagation();

            closeMemoryEditor();

            return;
        }


        /* =================================================
           ADD MEMORY
        ================================================= */

        if (
            action ===
            "add-memory"
        ) {

            event.preventDefault();

            event.stopPropagation();


            if (currentCity) {

                openMemoryEditor(
                    currentCity,
                    null
                );
            }


            return;
        }


        /* =================================================
           EDIT MEMORY
        ================================================= */

        if (
            action ===
            "edit-memory"
        ) {

            event.preventDefault();

            event.stopPropagation();


            if (!currentCity) {
                return;
            }


            const memories =
                getMemories(
                    currentCity
                );


            const memory =
                memories.find(
                    function (item) {

                        return (
                            item.id ===
                            button.dataset.memoryId
                        );
                    }
                );


            if (memory) {

                openMemoryEditor(
                    currentCity,
                    memory
                );
            }


            return;
        }


        /* =================================================
           SAVE MEMORY
        ================================================= */

        if (
            action ===
            "save-memory"
        ) {

            event.preventDefault();

            event.stopPropagation();


            const overlay =
                document.querySelector(
                    "#memory-editor-overlay"
                );


            const form =
                overlay
                    ? overlay.querySelector(
                        "form[data-memory-form]"
                    )
                    : null;


            if (!form) {
                return;
            }


            const titleInput =
                form.querySelector(
                    '[name="memory-title"]'
                );


            const dateInput =
                form.querySelector(
                    '[name="memory-date"]'
                );


            const contentInput =
                form.querySelector(
                    '[name="memory-content"]'
                );

            const linkInput =
                form.querySelector(
                    '[name="memory-link"]'
                );


            const title =
                titleInput.value.trim();


            const date =
                dateInput.value.trim();


            const content =
                contentInput.value.trim();

            const rawLink =
                linkInput ? linkInput.value.trim() : "";

            let validLink = "";
            if (rawLink) {
                const normalized = normalizeExternalUrl(rawLink);
                if (normalized === null) {
                    alert("请输入有效的外部链接网址（例如 https://example.com）");
                    if (linkInput) linkInput.focus();
                    return;
                }
                validLink = normalized;
            }


            if (
                !title &&
                !date &&
                !content &&
                !validLink
            ) {

                alert(
                    "至少填写一点记忆内容。"
                );

                return;
            }


            const city =
                cities.find(
                    function (item) {

                        return (
                            item.id ===
                            form.dataset.cityId
                        );
                    }
                );


            if (!city) {
                return;
            }


            const memories =
                getMemories(
                    city
                );


            const memoryId =
                form.dataset.memoryId;


            if (memoryId) {

                const index =
                    memories.findIndex(
                        function (item) {

                            return (
                                item.id ===
                                memoryId
                            );
                        }
                    );


                if (
                    index !==
                    -1
                ) {

                    memories[index] =
                        {
                            ...memories[index],

                            id:
                                memoryId,

                            title:
                                title,

                            date:
                                date,

                            content:
                                content,

                            link:
                                validLink
                        };
                }

            } else {

                memories.push(
                    {
                        id:
                            "memory-" +
                            Date.now(),

                        title:
                            title,

                        date:
                            date,

                        content:
                            content,

                        link:
                            validLink
                    }
                );
            }


            saveMemories(
                city,
                memories
            );


            closeMemoryEditor();


            currentCity =
                city;


            renderMemoryLibrary(
                city
            );


            return;
        }


        /* =================================================
           DELETE MEMORY
        ================================================= */

        if (
            action ===
            "delete-memory"
        ) {

            event.preventDefault();

            event.stopPropagation();


            const city =
                cities.find(
                    function (item) {

                        return (
                            item.id ===
                            button.dataset.cityId
                        );
                    }
                );


            if (!city) {
                return;
            }


            const confirmed =
                window.confirm(
                    "确定删除这条记忆吗？"
                );


            if (!confirmed) {
                return;
            }


            const memories =
                getMemories(
                    city
                ).filter(
                    function (item) {

                        return (
                            item.id !==
                            button.dataset.memoryId
                        );
                    }
                );


            saveMemories(
                city,
                memories
            );


            closeMemoryEditor();


            currentCity =
                city;


            renderMemoryLibrary(
                city
            );
        }

    },
    true
);


/* =====================================================
   ESC
===================================================== */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key ===
            "Escape"
        ) {

            const introOverlay = document.querySelector("#intro-reading-overlay");
            if (introOverlay && !introOverlay.classList.contains("is-hidden") && introOverlay.style.display !== "none" && typeof window.closeIntroReading === "function") {
                window.closeIntroReading();
                return;
            }

            if (document.querySelector("#photo-lightbox-overlay")) {
                closePhotoLightbox();
                return;
            }

            if (document.querySelector("#place-editor-overlay")) {
                closePlaceEditor();
                return;
            }

            if (document.querySelector("#place-archive-page")) {
                closePlacesArchivePage();
                return;
            }

            if (
                document.querySelector(
                    "#memory-detail-page"
                )
            ) {

                closeMemoryDetail();

                return;
            }

            closeMemoryEditor();
        }
    }
);


/* =====================================================
   窗口大小
===================================================== */

window.addEventListener(
    "resize",
    function () {

        if (
            mapPage &&
            mapPage.classList.contains(
                "active"
            )
        ) {

            /*
               如果正在城市页面，
               不改变当前城市状态。

               只在完整地图状态重新计算。
            */

            if (
                !currentCity
            ) {

                resetMap();
            }
        }
    }
);


/* =====================================================
   鸟形鼠标与轻盈飞行跟随系统
===================================================== */

const bird =
    document.querySelector(
        ".bird-cursor"
    );

const trail1 =
    document.querySelector(
        ".bird-cursor-trail.trail-1"
    );

const trail2 =
    document.querySelector(
        ".bird-cursor-trail.trail-2"
    );


if (bird) {

    let mouseX = -100;
    let mouseY = -100;
    let birdX = -100;
    let birdY = -100;
    let trail1X = -100;
    let trail1Y = -100;
    let trail2X = -100;
    let trail2Y = -100;
    let birdAngle = 0;
    let hasMoved = false;

    document.addEventListener(
        "mousemove",
        function (event) {

            mouseX = event.clientX;
            mouseY = event.clientY;

            if (!hasMoved) {
                birdX = mouseX;
                birdY = mouseY;
                trail1X = mouseX;
                trail1Y = mouseY;
                trail2X = mouseX;
                trail2Y = mouseY;
                hasMoved = true;
                bird.style.opacity = "0.75";
            }
        }
    );

    function updateBirdFlight() {
        if (hasMoved) {
            // 平滑、略有滞后的跟随（插值系数 0.18，轻盈自然）
            const dx = mouseX - birdX;
            const dy = mouseY - birdY;
            birdX += dx * 0.18;
            birdY += dy * 0.18;

            // 根据水平飞行速率产生克制优雅的微倾角（-14deg ~ 14deg）
            const targetAngle = Math.max(-14, Math.min(14, dx * 0.8));
            birdAngle += (targetAngle - birdAngle) * 0.12;

            bird.style.left = birdX + "px";
            bird.style.top = birdY + "px";

            const svg = bird.querySelector("svg");
            if (svg) {
                svg.style.transform = `rotate(${birdAngle}deg)`;
            }

            // 轻微残影拖尾跟随
            trail1X += (birdX - trail1X) * 0.22;
            trail1Y += (birdY - trail1Y) * 0.22;
            if (trail1) {
                trail1.style.left = trail1X + "px";
                trail1.style.top = trail1Y + "px";
            }

            trail2X += (trail1X - trail2X) * 0.18;
            trail2Y += (trail1Y - trail2Y) * 0.18;
            if (trail2) {
                trail2.style.left = trail2X + "px";
                trail2.style.top = trail2Y + "px";
            }
        }

        requestAnimationFrame(updateBirdFlight);
    }

    requestAnimationFrame(updateBirdFlight);


    if (mapViewport) {

        mapViewport.addEventListener(
            "mouseenter",
            function () {

                bird.style.opacity =
                    "0.85";
            }
        );


        mapViewport.addEventListener(
            "mouseleave",
            function () {

                bird.style.opacity =
                    "0.55";
            }
        );
    }
}


/* =====================================================
   READY
===================================================== */

window.addEventListener(
    "load",
    function () {

        console.log(
            "LARS website ready"
        );
    }
);


/* =====================================================
   四页飞行日志导读系统交互逻辑
   PAGE 01: WELCOME (入口 01 / 02)
   PAGE 02: BEYOND THE CLOUDS
   PAGE 03: STAY & FEEL
   PAGE 04: ANNIVERSARY (出道八周年快乐)
===================================================== */

function initIntroReadingSystem() {
    const overlay = document.getElementById("intro-reading-overlay");
    if (!overlay) return;

    const page1 = document.getElementById("guide-page-1");
    const page2 = document.getElementById("guide-page-2");
    const page3 = document.getElementById("guide-page-3");
    const page4 = document.getElementById("guide-page-4");
    const pages = { 1: page1, 2: page2, 3: page3, 4: page4 };

    function showPage(pageNumber) {
        Object.keys(pages).forEach(function (k) {
            const el = pages[k];
            if (el) {
                const isActive = String(k) === String(pageNumber);
                el.style.display = isActive ? "flex" : "none";
                if (isActive) {
                    const scrollable = el.querySelector(".guide-article-scroll");
                    if (scrollable) {
                        scrollable.scrollTop = 0;
                    }
                }
            }
        });
    }

    function closeGuide() {
        overlay.classList.add("is-hidden");
        overlay.style.display = "none";
        document.body.style.overflow = "";
    }

    window.closeIntroReading = closeGuide;

    // 所有页面的右上角 × 关闭按钮
    overlay.querySelectorAll('[data-guide-action="close"]').forEach(function (btn) {
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            closeGuide();
        });
    });

    // 页面跳转按钮（PAGE 01篇章入口、PAGE 02/03右下角NEXT箭头）
    overlay.querySelectorAll("[data-guide-goto]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            const targetPage = btn.dataset.guideGoto;
            if (targetPage) {
                showPage(targetPage);
            }
        });
    });

    // 点击遮罩外部空白区域亦可自主关闭
    overlay.addEventListener("click", function (e) {
        if (e.target === overlay) {
            closeGuide();
        }
    });

    // 隔离滚动与触摸事件，防止滚轮穿透缩放底层地图
    overlay.addEventListener("wheel", function (e) {
        e.stopPropagation();
    }, { passive: true });

    overlay.addEventListener("touchmove", function (e) {
        e.stopPropagation();
    }, { passive: true });

    // 初始化默认展示 PAGE 01
    showPage(1);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initIntroReadingSystem);
} else {
    initIntroReadingSystem();
}


window.addEventListener("resize", function () {
    if (typeof resetMap === "function") {
        resetMap();
    }
});


/* =====================================================
   02 秘密花园 (SECRET GARDEN) 数据与渲染
===================================================== */

function getSecretGardenKey(city) {
    return "lars_secret_garden_" + (city ? city.id : "");
}

function getCitySecretGarden(city) {
    if (!city) return { notes: "", photos: [] };
    const key = getSecretGardenKey(city);
    if (typeof window !== "undefined" && window._larsStorageCache && window._larsStorageCache[key] !== undefined) {
        const cached = window._larsStorageCache[key];
        if (cached && typeof cached === "object") {
            return {
                notes: cached.notes || "",
                photos: Array.isArray(cached.photos) ? [...cached.photos] : []
            };
        }
    }
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
                const res = {
                    notes: parsed.notes || "",
                    photos: Array.isArray(parsed.photos) ? parsed.photos : []
                };
                if (typeof window !== "undefined") {
                    window._larsStorageCache = window._larsStorageCache || {};
                    window._larsStorageCache[key] = res;
                }
                idbSave(key, res);
                return res;
            }
        }
    } catch (e) {
        console.error("读取秘密花园数据失败:", e);
    }
    let defaultNotes = "";
    let defaultPhotos = [];
    if (defaultCuratedPlaces[city.id] && defaultCuratedPlaces[city.id][0]) {
        const p0 = defaultCuratedPlaces[city.id][0];
        defaultNotes = p0.secretNotes || "";
        defaultPhotos = Array.isArray(p0.secretPhotos) ? [...p0.secretPhotos] : [];
    }
    return { notes: defaultNotes, photos: defaultPhotos };
}

function saveCitySecretGarden(city, data) {
    if (!city) return;
    const key = getSecretGardenKey(city);
    if (typeof window !== "undefined") {
        window._larsStorageCache = window._larsStorageCache || {};
        window._larsStorageCache[key] = data;
    }
    idbSave(key, data);
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (quotaErr) {
        console.warn("localStorage quota exceeded for secret garden; persisted safely in IndexedDB:", key);
    }
    updateCityTabCounts(city);
}

function renderSecretGardenSection(city) {
    if (!city) return;
    const container = document.querySelector("#section-pane-secret-garden");
    if (!container) return;
    container.innerHTML = "";

    const data = getCitySecretGarden(city);

    const wrap = document.createElement("div");
    wrap.className = "secret-garden-pane";

    const header = document.createElement("div");
    header.className = "secret-garden-header";
    header.innerHTML = '<div class="secret-garden-title">02 秘密花园 · SECRET GARDEN</div><div class="secret-garden-subtitle">一段私密瞬间与专属记忆相册</div>';
    wrap.appendChild(header);

    const notesCard = document.createElement("div");
    notesCard.className = "secret-notes-card";

    let isEditingNotes = false;

    function renderNotesCard() {
        notesCard.innerHTML = "";
        const topRow = document.createElement("div");
        topRow.className = "secret-notes-top-row";
        topRow.innerHTML = '<span class="secret-label">✦ 私密手记</span>';

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "secret-action-btn";
        editBtn.textContent = isEditingNotes ? "取消" : "编辑手记";
        editBtn.addEventListener("click", () => {
            isEditingNotes = !isEditingNotes;
            renderNotesCard();
        });
        topRow.appendChild(editBtn);
        notesCard.appendChild(topRow);

        if (isEditingNotes) {
            const textarea = document.createElement("textarea");
            textarea.className = "secret-notes-textarea";
            textarea.placeholder = "写下一段只有你与这座城市知道的故事、私密情绪或偶得之想…";
            textarea.value = data.notes || "";
            notesCard.appendChild(textarea);

            const saveBtn = document.createElement("button");
            saveBtn.type = "button";
            saveBtn.className = "secret-save-btn";
            saveBtn.textContent = "保存手记";
            saveBtn.addEventListener("click", () => {
                data.notes = textarea.value.trim();
                saveCitySecretGarden(city, data);
                isEditingNotes = false;
                renderNotesCard();
            });
            notesCard.appendChild(saveBtn);
        } else {
            const body = document.createElement("div");
            body.className = "secret-notes-body";
            if (data.notes) {
                body.textContent = data.notes;
            } else {
                body.innerHTML = '<span class="secret-empty-hint">暂无私密手记。点击上方「编辑手记」记录专属于' + city.name + '的独家记忆…</span>';
            }
            notesCard.appendChild(body);
        }
    }
    renderNotesCard();
    wrap.appendChild(notesCard);

    const gallerySection = document.createElement("div");
    gallerySection.className = "secret-gallery-section";

    const galHeader = document.createElement("div");
    galHeader.className = "secret-gallery-header";
    galHeader.innerHTML = '<span class="secret-gallery-title">GARDEN PHOTOS / 花园相册' + (data.photos.length > 0 ? ' (' + data.photos.length + ')' : '') + '</span>';

    const uploadControlsWrap = document.createElement("div");
    uploadControlsWrap.style.display = "flex";
    uploadControlsWrap.style.alignItems = "center";
    uploadControlsWrap.style.gap = "8px";

    const gardenFileInput = document.createElement("input");
    gardenFileInput.type = "file";
    gardenFileInput.accept = "image/*";
    gardenFileInput.multiple = true;
    gardenFileInput.id = "garden-file-input-" + city.id;
    gardenFileInput.style.position = "absolute";
    gardenFileInput.style.width = "0.1px";
    gardenFileInput.style.height = "0.1px";
    gardenFileInput.style.opacity = "0";
    gardenFileInput.style.overflow = "hidden";
    gardenFileInput.style.zIndex = "-1";

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "garden-upload-btn";
    uploadBtn.textContent = "+ 上传照片";
    uploadBtn.addEventListener("click", (e) => {
        e.preventDefault();
        gardenFileInput.click();
    });

    uploadControlsWrap.appendChild(uploadBtn);
    uploadControlsWrap.appendChild(gardenFileInput);
    galHeader.appendChild(uploadControlsWrap);
    gallerySection.appendChild(galHeader);

    gardenFileInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        uploadBtn.textContent = "正在处理…";
        uploadBtn.disabled = true;
        if (!Array.isArray(data.photos)) data.photos = [];
        for (const file of files) {
            try {
                const b64 = await compressImageFile(file, 800, 0.75);
                if (b64) {
                    data.photos.push(b64);
                }
            } catch (err) {
                console.error("秘密花园图片处理失败:", err);
            }
        }
        uploadBtn.textContent = "+ 上传照片";
        uploadBtn.disabled = false;
        saveCitySecretGarden(city, data);
        renderSecretGardenSection(city);
    });

    const photosGrid = document.createElement("div");
    photosGrid.className = "secret-photos-grid";

    if (data.photos && data.photos.length > 0) {
        data.photos.forEach((src, idx) => {
            const item = document.createElement("div");
            item.className = "secret-photo-item";

            const img = document.createElement("img");
            img.src = src;
            img.alt = "秘密花园照片 " + (idx + 1);
            /* img.loading = "lazy" omitted for Data URIs */
            img.title = "点击全屏放大查看";
            img.addEventListener("click", () => {
                if (typeof openPhotoLightbox === "function") openPhotoLightbox(src);
            });
            item.appendChild(img);

            // 操作控制工具栏：左移、右移、替换、删除
            const bar = document.createElement("div");
            bar.className = "secret-photo-toolbar";

            if (idx > 0) {
                const leftBtn = document.createElement("button");
                leftBtn.type = "button";
                leftBtn.className = "secret-photo-tool-btn";
                leftBtn.title = "前移一张";
                leftBtn.textContent = "←";
                leftBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const [moved] = data.photos.splice(idx, 1);
                    data.photos.splice(idx - 1, 0, moved);
                    saveCitySecretGarden(city, data);
                    renderSecretGardenSection(city);
                });
                bar.appendChild(leftBtn);
            }

            if (idx < data.photos.length - 1) {
                const rightBtn = document.createElement("button");
                rightBtn.type = "button";
                rightBtn.className = "secret-photo-tool-btn";
                rightBtn.title = "后移一张";
                rightBtn.textContent = "→";
                rightBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const [moved] = data.photos.splice(idx, 1);
                    data.photos.splice(idx + 1, 0, moved);
                    saveCitySecretGarden(city, data);
                    renderSecretGardenSection(city);
                });
                bar.appendChild(rightBtn);
            }

            // 替换照片单文件输入
            const replaceInput = document.createElement("input");
            replaceInput.type = "file";
            replaceInput.accept = "image/*";
            replaceInput.style.display = "none";
            replaceInput.addEventListener("change", async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                try {
                    const b64 = await compressImageFile(file, 800, 0.75);
                    if (b64) {
                        data.photos[idx] = b64;
                        saveCitySecretGarden(city, data);
                        renderSecretGardenSection(city);
                    }
                } catch (err) {
                    console.error("替换照片失败:", err);
                }
            });
            item.appendChild(replaceInput);

            const replaceBtn = document.createElement("button");
            replaceBtn.type = "button";
            replaceBtn.className = "secret-photo-tool-btn";
            replaceBtn.title = "替换这张照片";
            replaceBtn.textContent = "换";
            replaceBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                replaceInput.click();
            });
            bar.appendChild(replaceBtn);

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "secret-photo-tool-btn secret-photo-del-tool";
            delBtn.title = "删除照片";
            delBtn.textContent = "×";
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (confirm("确定删除这张秘密花园照片吗？")) {
                    data.photos.splice(idx, 1);
                    saveCitySecretGarden(city, data);
                    renderSecretGardenSection(city);
                }
            });
            bar.appendChild(delBtn);

            item.appendChild(bar);
            photosGrid.appendChild(item);
        });
    } else {
        const emptyHint = document.createElement("div");
        emptyHint.className = "secret-gallery-empty";
        emptyHint.textContent = "尚未上传秘密花园照片。点击上方「+ 上传照片」保存你的城市相片（支持一次或多次上传多张）。";
        photosGrid.appendChild(emptyHint);
    }

    gallerySection.appendChild(photosGrid);
    wrap.appendChild(gallerySection);

    container.appendChild(wrap);
}

/* =====================================================
   03 城食记录 (FOOD LOG) 数据与渲染
===================================================== */

function getFoodNotesKey(city) {
    return "lars_food_notes_" + (city ? city.id : "");
}

function getFoodDishesKey(city) {
    return "lars_food_dishes_" + (city ? city.id : "");
}

function getCityFoodNotes(city) {
    if (!city) return "";
    try {
        return localStorage.getItem(getFoodNotesKey(city)) || "";
    } catch (_) {
        return "";
    }
}

function saveCityFoodNotes(city, notes) {
    if (!city) return;
    try {
        localStorage.setItem(getFoodNotesKey(city), notes);
    } catch (e) {
        console.error("保存城食手记失败:", e);
    }
}

function getCityFoodDishes(city) {
    if (!city) return [];
    const key = getFoodDishesKey(city);
    if (typeof window !== "undefined" && window._larsStorageCache && window._larsStorageCache[key] !== undefined) {
        const cached = window._larsStorageCache[key];
        if (Array.isArray(cached)) return [...cached];
    }
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                if (typeof window !== "undefined") {
                    window._larsStorageCache = window._larsStorageCache || {};
                    window._larsStorageCache[key] = parsed;
                }
                idbSave(key, parsed);
                return parsed;
            }
        }
    } catch (e) {
        console.error("读取菜品记录失败:", e);
    }
    return [];
}

function saveCityFoodDishes(city, dishes) {
    if (!city) return;
    const key = getFoodDishesKey(city);
    if (typeof window !== "undefined") {
        window._larsStorageCache = window._larsStorageCache || {};
        window._larsStorageCache[key] = dishes;
    }
    idbSave(key, dishes);
    try {
        localStorage.setItem(key, JSON.stringify(dishes));
    } catch (quotaErr) {
        console.warn("localStorage quota exceeded for food dishes; persisted safely in IndexedDB:", key);
    }
    updateCityTabCounts(city);
}

function moveFoodDish(city, fromIndex, toIndex) {
    if (!city) return;
    const list = getCityFoodDishes(city);
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length || fromIndex === toIndex) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    saveCityFoodDishes(city, list);
    renderFoodLogSection(city);
}

function renderFoodLogSection(city) {
    if (!city) return;
    const container = document.querySelector("#section-pane-food-log");
    if (!container) return;
    container.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "food-log-pane";

    // 1. 标题区 (缩减约25%，桌面端保持完整单行)
    const header = document.createElement("div");
    header.className = "food-log-header";
    header.innerHTML = '<div class="food-log-tag">03 城食记录 · FOOD LOG</div>' +
        '<h2 class="food-log-title">Lars的城食记录·' + escapeHtml(city.name) + '</h2>' +
        '<div class="food-log-subtitle">祝大家吃好喝好</div>';
    wrap.appendChild(header);

    // 2. 城市记忆大段文字区 (饮食手记)
    const storyCard = document.createElement("div");
    storyCard.className = "food-story-card";

    let isEditingStory = false;
    let currentStory = getCityFoodNotes(city);

    function renderStoryCard() {
        storyCard.innerHTML = "";

        const topRow = document.createElement("div");
        topRow.className = "food-story-top-row";
        topRow.innerHTML = '<span class="food-story-label">✦ 城市饮食手记</span>';

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "food-action-btn";
        editBtn.textContent = isEditingStory ? "取消" : "编辑手记";
        editBtn.addEventListener("click", () => {
            isEditingStory = !isEditingStory;
            renderStoryCard();
        });
        topRow.appendChild(editBtn);
        storyCard.appendChild(topRow);

        if (isEditingStory) {
            const textarea = document.createElement("textarea");
            textarea.className = "food-story-textarea";
            textarea.placeholder = "填写关于" + city.name + "的饮食、生活习惯、街巷寻味与个人舌尖记忆（支持长文本）…";
            textarea.value = currentStory;
            storyCard.appendChild(textarea);

            const saveBtn = document.createElement("button");
            saveBtn.type = "button";
            saveBtn.className = "food-save-btn";
            saveBtn.textContent = "保存饮食手记";
            saveBtn.addEventListener("click", () => {
                currentStory = textarea.value.trim();
                saveCityFoodNotes(city, currentStory);
                isEditingStory = false;
                renderStoryCard();
            });
            storyCard.appendChild(saveBtn);
        } else {
            const body = document.createElement("div");
            body.className = "food-story-body";
            if (currentStory) {
                body.textContent = currentStory;
            } else {
                body.innerHTML = '<span class="food-empty-hint">暂无记录。点击右上角「编辑手记」写下关于' + city.name + '的饮食、早市夜市或难忘的味道…</span>';
            }
            storyCard.appendChild(body);
        }
    }
    renderStoryCard();
    wrap.appendChild(storyCard);

    // 3. 食物记录列表 (Dishes)
    const dishesSection = document.createElement("div");
    dishesSection.className = "food-dishes-section";

    const dishesHeader = document.createElement("div");
    dishesHeader.className = "food-dishes-header";
    dishesHeader.innerHTML = '<span class="food-dishes-title">DISHES / 菜品记录</span>';

    const dishesList = document.createElement("div");
    dishesList.className = "food-dishes-list";

    let dishes = getCityFoodDishes(city);

    const addDishBtn = document.createElement("button");
    addDishBtn.type = "button";
    addDishBtn.className = "food-add-dish-btn";
    addDishBtn.textContent = "+ 添加一道菜 / ADD DISH";
    addDishBtn.addEventListener("click", () => {
        // 立即在菜品列表顶部新增一张正在编辑的卡片
        const newDish = {
            id: "dish-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
            name: "",
            source: "",
            location: "",
            content: "",
            photos: [],
            _isEditing: true,
            _isNew: true
        };
        dishes.unshift(newDish);
        renderDishesList();
    });
    dishesHeader.appendChild(addDishBtn);
    dishesSection.appendChild(dishesHeader);

    function renderDishesList() {
        dishesList.innerHTML = "";

        if (dishes.length === 0) {
            const emptyBox = document.createElement("div");
            emptyBox.className = "food-dishes-empty";
            emptyBox.textContent = "尚未添加菜品。点击上方「+ 添加一道菜」记录你在" + city.name + "品尝过的美味。";
            dishesList.appendChild(emptyBox);
            return;
        }

        dishes.forEach((dish, index) => {
            const card = document.createElement("div");
            card.className = "food-dish-card" + (dish._isEditing ? " food-dish-card-editing" : "");

            if (dish._isEditing) {
                // 编辑态卡片
                let draftPhotos = Array.isArray(dish.photos) ? [...dish.photos] : [];

                const formWrap = document.createElement("div");
                formWrap.className = "dish-inline-editor";

                const formTitle = document.createElement("div");
                formTitle.className = "dish-edit-header-title";
                formTitle.textContent = dish._isNew ? ("+ 新增菜品记录 · " + city.name) : ("编辑菜品 · " + (dish.name || "未命名"));
                formWrap.appendChild(formTitle);

                // 1. 菜品名称
                const nameRow = document.createElement("div");
                nameRow.className = "dish-edit-field";
                nameRow.innerHTML = '<label class="dish-edit-label">菜品名称 / DISH NAME</label><input type="text" class="dish-edit-input input-dish-name" placeholder="例如：北京烤鸭 / 葱包桧 / 羊肉串" value="' + escapeHtml(dish.name || '') + '">';
                formWrap.appendChild(nameRow);

                // 2. 来源
                const srcRow = document.createElement("div");
                srcRow.className = "dish-edit-field";
                srcRow.innerHTML = '<label class="dish-edit-label">来源 / 出处 (谁推荐 / 在哪看到)</label><input type="text" class="dish-edit-input input-dish-source" placeholder="例如：老街坊推荐 / 朋友带路 / 偶然探店" value="' + escapeHtml(dish.source || '') + '">';
                formWrap.appendChild(srcRow);

                // 3. 地点
                const locRow = document.createElement("div");
                locRow.className = "dish-edit-field";
                locRow.innerHTML = '<label class="dish-edit-label">地点 / LOCATION (餐厅名 / 街巷 / 市场)</label><input type="text" class="dish-edit-input input-dish-location" placeholder="例如：前门大栅栏老店 / 满觉陇路茶水铺" value="' + escapeHtml(dish.location || '') + '">';
                formWrap.appendChild(locRow);

                // 4. 文字内容 (自由填写的多行文本框)
                const textRow = document.createElement("div");
                textRow.className = "dish-edit-field";
                textRow.innerHTML = '<label class="dish-edit-label">味道与回忆手记 / TASTE & MEMORY (多行记录)</label><textarea class="dish-edit-textarea input-dish-content" rows="3" placeholder="记录这道菜的风味口感、独特的搭配、或发生在这道菜背后的城市回忆…">' + escapeHtml(dish.content || '') + '</textarea>';
                formWrap.appendChild(textRow);

                // 5. 食物图片上传与预览
                const photoRow = document.createElement("div");
                photoRow.className = "dish-edit-field";
                photoRow.innerHTML = '<label class="dish-edit-label">食物图片 / PHOTOS (支持多张图片本地上传)</label>';

                const photoControls = document.createElement("div");
                photoControls.className = "dish-photo-controls-row";

                const fileInp = document.createElement("input");
                fileInp.type = "file";
                fileInp.accept = "image/*";
                fileInp.multiple = true;
                fileInp.style.position = "absolute";
                fileInp.style.width = "0.1px";
                fileInp.style.height = "0.1px";
                fileInp.style.opacity = "0";
                fileInp.style.overflow = "hidden";
                fileInp.style.zIndex = "-1";

                const uploadBtn = document.createElement("button");
                uploadBtn.type = "button";
                uploadBtn.className = "dish-upload-btn";
                uploadBtn.textContent = "+ 上传食物照片";
                uploadBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    fileInp.click();
                });

                photoControls.appendChild(uploadBtn);
                photoControls.appendChild(fileInp);
                photoRow.appendChild(photoControls);

                const thumbsStrip = document.createElement("div");
                thumbsStrip.className = "dish-edit-thumbs-strip";
                photoRow.appendChild(thumbsStrip);

                function refreshDraftPhotos() {
                    thumbsStrip.innerHTML = "";
                    if (draftPhotos.length === 0) {
                        thumbsStrip.innerHTML = '<span class="dish-no-photo-hint">暂未上传图片（可选）</span>';
                        return;
                    }
                    draftPhotos.forEach((src, pIdx) => {
                        const thumb = document.createElement("div");
                        thumb.className = "dish-edit-thumb-item";
                        thumb.innerHTML = '<img src="' + src + '" alt="preview"><button type="button" class="dish-thumb-del-btn" title="删除图片">×</button>';
                        thumb.querySelector(".dish-thumb-del-btn").addEventListener("click", () => {
                            draftPhotos.splice(pIdx, 1);
                            refreshDraftPhotos();
                        });
                        thumb.querySelector("img").addEventListener("click", () => {
                            openPhotoLightbox(src);
                        });
                        thumbsStrip.appendChild(thumb);
                    });
                }
                refreshDraftPhotos();

                fileInp.addEventListener("change", async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    uploadBtn.textContent = "处理中…";
                    uploadBtn.disabled = true;
                    for (const file of files) {
                        try {
                            const b64 = await compressImageFile(file, 800, 0.75);
                            if (b64) draftPhotos.push(b64);
                        } catch (err) {
                            console.error("菜品图片处理失败:", err);
                        }
                    }
                    uploadBtn.textContent = "+ 上传食物照片";
                    uploadBtn.disabled = false;
                    refreshDraftPhotos();
                    fileInp.value = "";
                });

                formWrap.appendChild(photoRow);

                // 底部操作按钮
                const btnRow = document.createElement("div");
                btnRow.className = "dish-edit-buttons-row";

                const saveBtn = document.createElement("button");
                saveBtn.type = "button";
                saveBtn.className = "dish-save-btn";
                saveBtn.textContent = "保存菜品 / SAVE";
                saveBtn.addEventListener("click", () => {
                    const nameVal = formWrap.querySelector(".input-dish-name").value.trim();
                    const srcVal = formWrap.querySelector(".input-dish-source").value.trim();
                    const locVal = formWrap.querySelector(".input-dish-location").value.trim();
                    const contentVal = formWrap.querySelector(".input-dish-content").value.trim();

                    if (!nameVal && !srcVal && !locVal && !contentVal && draftPhotos.length === 0) {
                        alert("请至少填写菜品名称、手记或上传图片。");
                        return;
                    }

                    dish.name = nameVal || "未命名菜品";
                    dish.source = srcVal;
                    dish.location = locVal;
                    dish.content = contentVal;
                    dish.photos = draftPhotos;
                    delete dish._isEditing;
                    delete dish._isNew;

                    saveCityFoodDishes(city, dishes);
                    updateCityTabCounts(city);
                    renderDishesList();
                });

                const cancelBtn = document.createElement("button");
                cancelBtn.type = "button";
                cancelBtn.className = "dish-cancel-btn";
                cancelBtn.textContent = "取消";
                cancelBtn.addEventListener("click", () => {
                    if (dish._isNew) {
                        dishes.splice(index, 1);
                    } else {
                        delete dish._isEditing;
                    }
                    renderDishesList();
                });

                btnRow.appendChild(saveBtn);
                btnRow.appendChild(cancelBtn);

                if (!dish._isNew) {
                    const delCardBtn = document.createElement("button");
                    delCardBtn.type = "button";
                    delCardBtn.className = "dish-delete-card-btn";
                    delCardBtn.textContent = "删除这道菜";
                    delCardBtn.addEventListener("click", () => {
                        if (confirm("确定删除菜品「" + (dish.name || "此项") + "」吗？")) {
                            dishes.splice(index, 1);
                            saveCityFoodDishes(city, dishes);
                            updateCityTabCounts(city);
                            renderDishesList();
                        }
                    });
                    btnRow.appendChild(delCardBtn);
                }

                formWrap.appendChild(btnRow);
                card.appendChild(formWrap);
            } else {
                // 展示态卡片
                const cardTop = document.createElement("div");
                cardTop.className = "food-dish-card-top";

                const nameEl = document.createElement("h3");
                nameEl.className = "food-dish-name";
                nameEl.textContent = dish.name || "未命名菜品";
                cardTop.appendChild(nameEl);

                const cardActions = document.createElement("div");
                cardActions.className = "food-dish-card-actions";

                const orderControls = document.createElement("div");
                orderControls.className = "item-order-controls";
                if (index > 0) {
                    const upBtn = document.createElement("button");
                    upBtn.type = "button";
                    upBtn.className = "order-btn";
                    upBtn.textContent = "↑ 上移";
                    upBtn.addEventListener("click", () => {
                        const [moved] = dishes.splice(index, 1);
                        dishes.splice(index - 1, 0, moved);
                        saveCityFoodDishes(city, dishes);
                        renderDishesList();
                    });
                    orderControls.appendChild(upBtn);
                }
                if (index < dishes.length - 1) {
                    const downBtn = document.createElement("button");
                    downBtn.type = "button";
                    downBtn.className = "order-btn";
                    downBtn.textContent = "↓ 下移";
                    downBtn.addEventListener("click", () => {
                        const [moved] = dishes.splice(index, 1);
                        dishes.splice(index + 1, 0, moved);
                        saveCityFoodDishes(city, dishes);
                        renderDishesList();
                    });
                    orderControls.appendChild(downBtn);
                }
                cardActions.appendChild(orderControls);

                const editBtn = document.createElement("button");
                editBtn.type = "button";
                editBtn.className = "dish-action-link";
                editBtn.textContent = "EDIT";
                editBtn.addEventListener("click", () => {
                    dish._isEditing = true;
                    renderDishesList();
                });
                cardActions.appendChild(editBtn);

                const delBtn = document.createElement("button");
                delBtn.type = "button";
                delBtn.className = "dish-action-link dish-del-link";
                delBtn.textContent = "DELETE";
                delBtn.addEventListener("click", () => {
                    if (confirm("确定删除菜品「" + (dish.name || "此项") + "」吗？")) {
                        dishes.splice(index, 1);
                        saveCityFoodDishes(city, dishes);
                        updateCityTabCounts(city);
                        renderDishesList();
                    }
                });
                cardActions.appendChild(delBtn);

                cardTop.appendChild(cardActions);
                card.appendChild(cardTop);

                // 图片预览区 (支持多图，点击全屏放大)
                const dishPhotos = Array.isArray(dish.photos) ? dish.photos.filter(Boolean) : (dish.photo ? [dish.photo] : []);
                if (dishPhotos.length > 0) {
                    const photoStrip = document.createElement("div");
                    photoStrip.className = "dish-photos-strip";
                    dishPhotos.forEach((src, pIdx) => {
                        const img = document.createElement("img");
                        img.src = src;
                        img.alt = dish.name || "菜品照片";
                        img.className = "food-dish-thumb";
                        img.title = "点击全屏放大查看";
                        img.addEventListener("click", () => {
                            openPhotoLightbox(src);
                        });
                        photoStrip.appendChild(img);
                    });
                    card.appendChild(photoStrip);
                }

                // 自由文字多行内容
                if (dish.content) {
                    const contentEl = document.createElement("div");
                    contentEl.className = "food-dish-content-body";
                    contentEl.textContent = dish.content;
                    card.appendChild(contentEl);
                }

                // 来源与地点
                if (dish.source || dish.location) {
                    const metaRow = document.createElement("div");
                    metaRow.className = "dish-meta-row";
                    if (dish.source) {
                        const srcTag = document.createElement("span");
                        srcTag.className = "dish-meta-item";
                        srcTag.innerHTML = '<span class="meta-label">来源:</span> ' + escapeHtml(dish.source);
                        metaRow.appendChild(srcTag);
                    }
                    if (dish.location) {
                        const locTag = document.createElement("span");
                        locTag.className = "dish-meta-item";
                        locTag.innerHTML = '<span class="meta-label">地点:</span> ' + escapeHtml(dish.location);
                        metaRow.appendChild(locTag);
                    }
                    card.appendChild(metaRow);
                }
            }

            dishesList.appendChild(card);
        });
    }

    renderDishesList();
    dishesSection.appendChild(dishesList);
    wrap.appendChild(dishesSection);
    container.appendChild(wrap);
}

function closeFoodDishEditor() {
    const el = document.getElementById("food-dish-editor-overlay");
    if (el) el.remove();
}

function openFoodDishEditor(city, dish) {
    closeFoodDishEditor();
    if (!city) return;

    let attachedPhotos = dish && Array.isArray(dish.photos) ? [...dish.photos] : [];

    const overlay = document.createElement("div");
    overlay.id = "food-dish-editor-overlay";
    overlay.className = "place-editor-overlay";

    const box = document.createElement("div");
    box.className = "place-editor-box";

    // 头部
    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.alignItems = "center";
    top.style.justifyContent = "space-between";
    top.style.marginBottom = "22px";

    const heading = document.createElement("div");
    heading.textContent = dish ? ("EDIT DISH · " + (dish.name || "菜品编辑")) : ("ADD DISH · " + city.name);
    heading.style.fontSize = "12px";
    heading.style.letterSpacing = ".16em";
    heading.style.fontFamily = "Cormorant Garamond, serif";
    heading.style.color = "#292724";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.style.border = "none";
    closeBtn.style.background = "transparent";
    closeBtn.style.fontSize = "26px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.color = "#292724";
    closeBtn.addEventListener("click", closeFoodDishEditor);

    top.appendChild(heading);
    top.appendChild(closeBtn);
    box.appendChild(top);

    const form = document.createElement("form");

    // 1. 菜品名称
    addEditorField(form, "DISH NAME (菜品名称)", "dish-name", dish ? (dish.name || "") : "", false);

    // 2. 来源
    addEditorField(form, "SOURCE / 来源 (谁推荐 / 在哪看到 / 出处)", "dish-source", dish ? (dish.source || "") : "", false);

    // 3. 地点
    addEditorField(form, "LOCATION / 地点 (餐厅名称 / 街巷 / 市场)", "dish-location", dish ? (dish.location || "") : "", false);

    // 4. 文字内容 (多行文本框)
    addEditorField(form, "TASTE & MEMORY (味道、风味、回忆与相关手记)", "dish-content", dish ? (dish.content || "") : "", true);

    // 5. 食物照片上传区域
    const photoSection = document.createElement("div");
    photoSection.className = "editor-photos-manager";

    const photoHeader = document.createElement("div");
    photoHeader.className = "editor-photos-header";
    photoHeader.innerHTML = `<span style="font-size:10px;letter-spacing:.14em;opacity:.6;font-family:'Cormorant Garamond',serif;">FOOD PHOTOS / 食物照片 (支持本地多图上传)</span>`;
    photoSection.appendChild(photoHeader);

    const uploadControls = document.createElement("div");
    uploadControls.className = "editor-upload-controls";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.id = "dish-photo-input-" + Date.now();
    fileInput.style.position = "absolute";
    fileInput.style.width = "0.1px";
    fileInput.style.height = "0.1px";
    fileInput.style.opacity = "0";
    fileInput.style.overflow = "hidden";
    fileInput.style.zIndex = "-1";

    const fileLabel = document.createElement("button");
    fileLabel.type = "button";
    fileLabel.className = "editor-file-label";
    fileLabel.innerHTML = `<span>+ 本地上传照片</span>`;
    fileLabel.addEventListener("click", (e) => {
        e.preventDefault();
        fileInput.click();
    });

    uploadControls.appendChild(fileLabel);
    uploadControls.appendChild(fileInput);
    photoSection.appendChild(uploadControls);

    const previewStrip = document.createElement("div");
    previewStrip.className = "editor-photos-preview-strip";
    photoSection.appendChild(previewStrip);

    function refreshDishPhotoPreviews() {
        previewStrip.innerHTML = "";
        if (attachedPhotos.length === 0) {
            previewStrip.innerHTML = '<div style="font-size:11px;opacity:0.45;padding:4px 0;font-style:italic;">暂无食物照片，可点击上方「+ 本地上传照片」添加</div>';
            return;
        }
        attachedPhotos.forEach((src, idx) => {
            const thumb = document.createElement("div");
            thumb.className = "editor-thumb-item";
            thumb.innerHTML = '<img src="' + src + '" alt="dish photo"><button type="button" class="editor-thumb-del" title="删除照片">×</button>';
            thumb.querySelector(".editor-thumb-del").addEventListener("click", (e) => {
                e.stopPropagation();
                attachedPhotos.splice(idx, 1);
                refreshDishPhotoPreviews();
            });
            thumb.querySelector("img").addEventListener("click", () => {
                openPhotoLightbox(src);
            });
            previewStrip.appendChild(thumb);
        });
    }
    refreshDishPhotoPreviews();

    fileInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        fileLabel.innerHTML = `<span>处理中…</span>`;
        for (const file of files) {
            try {
                const compressed = await compressImageFile(file, 800, 0.75);
                if (compressed) attachedPhotos.push(compressed);
            } catch (err) {
                console.error("菜品照片读取失败:", err);
            }
        }
        fileLabel.innerHTML = `<span>+ 本地上传照片</span>`;
        refreshDishPhotoPreviews();
        fileInput.value = "";
    });

    form.appendChild(photoSection);

    // 操作按钮
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.alignItems = "center";
    actions.style.justifyContent = "space-between";
    actions.style.marginTop = "24px";

    const left = document.createElement("div");
    if (dish) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "DELETE DISH";
        delBtn.style.border = "none";
        delBtn.style.background = "transparent";
        delBtn.style.cursor = "pointer";
        delBtn.style.fontSize = "10px";
        delBtn.style.letterSpacing = ".12em";
        delBtn.style.color = "#a33";
        delBtn.addEventListener("click", () => {
            if (window.confirm("确定删除菜品「" + (dish.name || "此项") + "」吗？")) {
                const dishes = getCityFoodDishes(city).filter(d => d.id !== dish.id);
                saveCityFoodDishes(city, dishes);
                closeFoodDishEditor();
                renderFoodLogSection(city);
            }
        });
        left.appendChild(delBtn);
    }

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "14px";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "CANCEL";
    cancelBtn.style.border = "none";
    cancelBtn.style.background = "transparent";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.style.fontSize = "10px";
    cancelBtn.style.letterSpacing = ".12em";
    cancelBtn.addEventListener("click", closeFoodDishEditor);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "SAVE DISH";
    saveBtn.style.border = "1px solid rgba(0,0,0,.35)";
    saveBtn.style.background = "transparent";
    saveBtn.style.padding = "8px 18px";
    saveBtn.style.cursor = "pointer";
    saveBtn.style.fontSize = "10px";
    saveBtn.style.letterSpacing = ".12em";

    saveBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const nameVal = form.querySelector('[name="dish-name"]').value.trim();
        const srcVal = form.querySelector('[name="dish-source"]').value.trim();
        const locVal = form.querySelector('[name="dish-location"]').value.trim();
        const contentVal = form.querySelector('[name="dish-content"]').value.trim();

        if (!nameVal && !srcVal && !locVal && !contentVal && attachedPhotos.length === 0) {
            alert("请至少填写菜品名称、手记、出处或上传照片。");
            return;
        }

        const dishes = getCityFoodDishes(city);
        if (dish && dish.id) {
            const idx = dishes.findIndex(d => d.id === dish.id);
            if (idx !== -1) {
                dishes[idx] = {
                    ...dishes[idx],
                    name: nameVal || "未命名菜品",
                    source: srcVal,
                    location: locVal,
                    content: contentVal,
                    photos: attachedPhotos
                };
            }
        } else {
            dishes.unshift({
                id: "dish-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
                name: nameVal || "未命名菜品",
                source: srcVal,
                location: locVal,
                content: contentVal,
                photos: attachedPhotos
            });
        }

        saveCityFoodDishes(city, dishes);
        closeFoodDishEditor();
        renderFoodLogSection(city);
    });

    right.appendChild(cancelBtn);
    right.appendChild(saveBtn);

    actions.appendChild(left);
    actions.appendChild(right);
    form.appendChild(actions);

    box.appendChild(form);
    overlay.appendChild(box);

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeFoodDishEditor();
    });

    document.body.appendChild(overlay);
}
