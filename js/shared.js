// Shared utilities for Light&Lens frontend and admin
const API_BASE_URL = 'https://5nuxhstp12.execute-api.eu-north-1.amazonaws.com/prod';

function sortBySortOrder(items) {
    if (!Array.isArray(items)) return [];
    return [...items].sort((a, b) => {
        const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
    });
}

function formatGalleryYears(gallery) {
    if (gallery.years && Array.isArray(gallery.years) && gallery.years.length > 0) {
        const years = gallery.years.map(y => parseInt(y, 10)).filter(y => !Number.isNaN(y));
        years.sort((a, b) => a - b);
        return years.length > 1 ? years.join(', ') : String(years[0] || '');
    }
    if (gallery.createdAt) {
        return String(new Date(gallery.createdAt).getFullYear());
    }
    return '';
}

function collectYearsFromGalleries(galleries) {
    const allYears = [];
    (galleries || []).forEach(gallery => {
        if (gallery.years && Array.isArray(gallery.years) && gallery.years.length > 0) {
            gallery.years.forEach(year => {
                const y = parseInt(year, 10);
                if (!Number.isNaN(y)) allYears.push(y);
            });
        } else if (gallery.createdAt) {
            allYears.push(new Date(gallery.createdAt).getFullYear());
        }
    });
    return [...new Set(allYears)].sort((a, b) => b - a);
}

function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function revokeObjectUrl(url) {
    if (url && typeof url === 'string' && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    }
}

function showCopyToast(message, type = 'success') {
    const existing = document.querySelector('.copy-message');
    if (existing) existing.remove();

    const isMobile = window.innerWidth <= 768;
    const messageEl = document.createElement('div');
    messageEl.className = `copy-message copy-${type}`;
    messageEl.innerHTML = type === 'success'
        ? `<i class="fas fa-check"></i> ${escapeHtml(message)}`
        : `<i class="fas fa-times"></i> ${escapeHtml(message)}`;

    messageEl.style.cssText = `
        position: fixed;
        top: ${isMobile ? '10px' : '20px'};
        ${isMobile ? 'left: 10px; right: 10px;' : 'right: 20px;'}
        background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
        color: white;
        padding: ${isMobile ? '10px 15px' : '12px 20px'};
        border-radius: 8px;
        font-size: ${isMobile ? '13px' : '14px'};
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
        text-align: center;
    `;

    document.body.appendChild(messageEl);
    const duration = type === 'success' ? 3000 : 5000;
    setTimeout(() => {
        messageEl.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => messageEl.remove(), 300);
    }, duration);
}
