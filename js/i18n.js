const I18N = {
    en: {
        navHome: 'Home',
        navGallery: 'Gallery',
        navMap: 'Map',
        navContact: 'Contact',
        subscribe: 'Subscribe',
        subscribeDesc: 'Subscribe to receive notifications when new galleries are added.',
        emailPlaceholder: 'Enter your email address',
        cancel: 'Cancel',
        heroTitle: 'Capturing Moments',
        heroSubtitle: 'The Story of Light and Shadow',
        exploreGallery: 'Explore Gallery',
        year: 'Year:',
        location: 'Location:',
        allYears: 'All Years',
        allLocations: 'All Locations',
        clearFilters: 'Clear Filters',
        loadMore: 'Load More',
        loading: 'Loading...',
        noGalleries: 'No galleries found matching your criteria.',
        photoCount: '{n} photos',
        letsConnect: "Let's Connect",
        contactRole: 'Photographer & Visual Storyteller',
        collaborate: "Let's Collaborate",
        collaborateP1: 'I’m passionate about photography, with a special love for landscapes and urban storytelling.',
        collaborateP2: 'Always open to creative collaborations—let’s bring ideas to life together.',
        xiaohongshu: 'Xiaohongshu',
        wechat: 'Wechat',
        footer: '© 2025 Light&Lens. All rights reserved.',
        invalidEmail: 'Please enter a valid email address.',
        subscribing: 'Subscribing...',
        subscribeSuccess: 'Successfully subscribed!',
        subscribeNetwork: 'Network error. Please check your connection and try again.',
        wechatCopied: 'Wechat ID copied',
        wechatCopyFailed: 'Copy failed, please copy manually: Magnetrician',
        yearFilter: 'Year Filter',
        showYearFilter: 'Show Year Filter',
        loadingMarkers: 'Loading gallery markers...',
        viewGallery: 'View Gallery',
        unknown: 'Unknown',
        backHome: 'Back to Home',
        photosWord: 'photos',
        galleryNotFound: 'Gallery Not Found',
        noGalleryId: 'No gallery specified in the URL.',
        galleryLoadFailed: 'Failed to load gallery. Please try again later.',
        errorLoadingGallery: 'Error Loading Gallery',
        galleryLoadError: 'Failed to load gallery data. Please try again.',
        noPhotos: 'No photos found in this gallery.',
        ratingCancelled: 'Rating cancelled successfully!',
        ratingSaved: 'Rating saved successfully!',
        ratingFailed: 'Failed to save rating. Please try again.',
        panoramaFailed: 'Failed to load panorama',
        panoramaWebGLTitle: 'WebGL is disabled in this browser',
        panoramaWebGLDesc: '360° panoramas need WebGL. Please enable it, then refresh this page.',
        panoramaWebGLChrome: 'Chrome: open chrome://settings/system → turn on “Use graphics acceleration when available” → restart Chrome. Also check chrome://flags and set WebGL items to Default (not Disabled).',
        panoramaWebGLEdge: 'Edge: open edge://settings/system → turn on “Use graphics acceleration when available” → restart Edge. Check edge://flags and keep WebGL related items at Default.',
        panoramaWebGLSafari: 'Safari (Mac): Safari → Settings → Advanced → enable “Show features for web developers”. Then Develop → Experimental Features → ensure WebGL / WebGL 2.0 are enabled. Update macOS if needed.',
        panoramaWebGLOther: 'Try Microsoft Edge or Google Chrome with graphics acceleration enabled, then refresh.',
        fullscreen: 'Fullscreen',
        exitFullscreen: 'Exit Fullscreen',
        sharePanorama: 'Copy panorama link',
        shareCopied: 'Panorama link copied!',
        shareFailed: 'Could not copy link. Please copy from the address bar.'
    },
    zh: {
        navHome: '首页',
        navGallery: '相册',
        navMap: '地图',
        navContact: '联系',
        subscribe: '订阅',
        subscribeDesc: '订阅后，新相册发布时会收到通知。',
        emailPlaceholder: '请输入邮箱地址',
        cancel: '取消',
        heroTitle: '捕捉瞬间',
        heroSubtitle: '光与影的故事',
        exploreGallery: '浏览作品',
        year: '年份：',
        location: '地区：',
        allYears: '全部年份',
        allLocations: '全部地区',
        clearFilters: '清除筛选',
        loadMore: '加载更多',
        loading: '加载中...',
        noGalleries: '没有符合条件的相册。',
        photoCount: '{n} 张照片',
        letsConnect: '联系我',
        contactRole: '摄影师 · 视觉叙事',
        collaborate: '一起合作',
        collaborateP1: '我热爱摄影，尤其喜欢风景与城市故事。',
        collaborateP2: '欢迎各种创作合作，一起把想法变成画面。',
        xiaohongshu: '小红书',
        wechat: '微信',
        footer: '© 2025 Light&Lens. 保留所有权利。',
        invalidEmail: '请输入有效的邮箱地址。',
        subscribing: '正在订阅...',
        subscribeSuccess: '订阅成功！',
        subscribeNetwork: '网络错误，请检查连接后重试。',
        wechatCopied: '微信号已复制',
        wechatCopyFailed: '复制失败，请手动复制：Magnetrician',
        yearFilter: '年份筛选',
        showYearFilter: '显示年份筛选',
        loadingMarkers: '正在加载地图标记...',
        viewGallery: '查看相册',
        unknown: '未知',
        backHome: '返回首页',
        photosWord: '张照片',
        galleryNotFound: '未找到相册',
        noGalleryId: '链接中没有指定相册。',
        galleryLoadFailed: '相册加载失败，请稍后再试。',
        errorLoadingGallery: '相册加载失败',
        galleryLoadError: '无法加载相册数据，请重试。',
        noPhotos: '这个相册还没有照片。',
        ratingCancelled: '已取消评分',
        ratingSaved: '评分已保存',
        ratingFailed: '评分保存失败，请重试。',
        panoramaFailed: '全景图加载失败',
        panoramaWebGLTitle: '当前浏览器未启用 WebGL',
        panoramaWebGLDesc: '360° 全景需要 WebGL。请按下面步骤开启后刷新本页。',
        panoramaWebGLChrome: 'Chrome：打开 chrome://settings/system → 开启「使用硬件加速模式」→ 重启 Chrome。也可打开 chrome://flags，将 WebGL 相关项设为 Default（不要 Disabled）。',
        panoramaWebGLEdge: 'Edge：打开 edge://settings/system → 开启「使用硬件加速」→ 重启 Edge。也可打开 edge://flags，保持 WebGL 相关项为 Default。',
        panoramaWebGLSafari: 'Safari（Mac）：Safari → 设置 → 高级 → 勾选「显示网页开发者功能」。再在「开发」菜单 →「实验性功能」中确认 WebGL / WebGL 2.0 已启用。必要时更新 macOS。',
        panoramaWebGLOther: '可改用 Microsoft Edge 或 Google Chrome，并开启硬件加速后刷新。',
        fullscreen: '全屏',
        exitFullscreen: '退出全屏',
        sharePanorama: '复制全景分享链接',
        shareCopied: '全景链接已复制',
        shareFailed: '复制失败，请从地址栏手动复制。'
    }
};

const CONTINENT_ZH = {
    'Africa': '非洲',
    'Asia': '亚洲',
    'Europe': '欧洲',
    'North America': '北美洲',
    'South America': '南美洲',
    'Oceania': '大洋洲',
    'Antarctica': '南极洲',
    'Unknown': '未知'
};

function getLang() {
    return localStorage.getItem('siteLang') === 'zh' ? 'zh' : 'en';
}

function t(key, vars) {
    const lang = getLang();
    let text = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    if (vars) {
        Object.keys(vars).forEach(name => {
            text = text.replace(`{${name}}`, vars[name]);
        });
    }
    return text;
}

function tPlace(name) {
    if (!name) return '';
    if (getLang() !== 'zh') return name;
    return CONTINENT_ZH[name] || name;
}

function applyI18n() {
    const lang = getLang();
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.body.classList.toggle('lang-zh', lang === 'zh');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle);
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
}

function setLang(lang) {
    localStorage.setItem('siteLang', lang === 'zh' ? 'zh' : 'en');
    applyI18n();
    window.dispatchEvent(new CustomEvent('langchange'));
}

document.addEventListener('click', (event) => {
    const btn = event.target.closest('.lang-btn');
    if (!btn || btn.dataset.lang === getLang()) return;
    setLang(btn.dataset.lang);
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyI18n);
} else {
    applyI18n();
}
