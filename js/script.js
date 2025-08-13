// Gallery data - will be loaded from API
let galleries = [];

// Load galleries from API
async function loadGalleriesFromAPI() {
    try {
        console.log('Loading galleries from API...');
        
        const API_BASE_URL = 'https://5nuxhstp12.execute-api.eu-north-1.amazonaws.com/prod';
        const response = await fetch(`${API_BASE_URL}/galleries`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        galleries = data.galleries || [];
        
        console.log('Successfully loaded galleries from API:', galleries.length);
        return true;
        
    } catch (error) {
        console.error('Error loading galleries from API:', error);
        return false;
    }
}



// DOM Elements
const galleryGrid = document.getElementById('galleryGrid');
const yearFilter = document.getElementById('yearFilter');
const locationFilter = document.getElementById('locationFilter');
const clearFiltersBtn = document.getElementById('clearFilters');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

// Debug DOM elements
console.log('DOM Elements found:', {
    galleryGrid: !!galleryGrid,
    yearFilter: !!yearFilter,
    locationFilter: !!locationFilter,
    clearFiltersBtn: !!clearFiltersBtn,
    navToggle: !!navToggle,
    navMenu: !!navMenu
});

// State
let currentFilteredGalleries = [];

// Initialize the application
async function init() {
    console.log('Starting application initialization...');
    
    // Load galleries from API
    const apiSuccess = await loadGalleriesFromAPI();
    
    if (!apiSuccess) {
        console.log('API loading failed, using empty galleries array');
        galleries = [];
    }
    
    currentFilteredGalleries = [...galleries];
    console.log('Initialized with galleries:', galleries.length, 'Filtered:', currentFilteredGalleries.length);
    loadGalleries();
    setupFilters();
    setupNavigation();
    setupSmoothScrolling();
    
    // 立即初始化地图，不需要延迟
    if (galleries.length > 0) {
        initMap();
    }
}

// Load galleries into the gallery grid
function loadGalleries() {
    galleryGrid.innerHTML = '';
    
    if (currentFilteredGalleries.length === 0) {
        galleryGrid.innerHTML = '<div class="no-results">No galleries found matching your criteria.</div>';
        console.log('No galleries to display');
        return;
    }
    currentFilteredGalleries.forEach((gallery, index) => {
        const galleryElement = createGalleryElement(gallery, index);
        galleryGrid.appendChild(galleryElement);
    });
    console.log('Galleries loaded successfully');
}

// Create a gallery element
function createGalleryElement(gallery, index) {
    const article = document.createElement('article');
    article.className = 'gallery-item';
    article.setAttribute('data-index', index);
    
    // Use coverPhotoURL if available, otherwise use a placeholder
    const coverImage = gallery.coverPhotoURL || 'images/placeholder.jpg';

    // Format location and year from API data
    const location = gallery.continent;
    
    // Extract latest year from years array
    let year = '';
    if (gallery.years && Array.isArray(gallery.years) && gallery.years.length > 0) {
        // Sort years in descending order and get the latest (first one)
        const sortedYears = gallery.years.sort((a, b) => parseInt(b) - parseInt(a));
        year = sortedYears[0];
    } else {
        year = new Date(gallery.createdAt).getFullYear();
    }
    
    const photoCount = gallery.photoCount || 0;
    
    article.innerHTML = `
        <img src="${coverImage}" alt="${gallery.name}" loading="lazy" onerror="this.src='images/placeholder.jpg'">
        <div class="gallery-info">
            <h3 class="gallery-title">${gallery.name}</h3>
            <div class="gallery-meta">
                <span><i class="fas fa-map-marker-alt"></i> ${location}</span>
                <span><i class="fas fa-calendar"></i> ${year}</span>
                <span><i class="fas fa-images"></i> ${photoCount} photos</span>
            </div>
        </div>
    `;
    
    article.addEventListener('click', () => {
        window.location.href = `gallery.html?gallery=${gallery.galleryId || gallery.id}`;
    });
    return article;
}

// Setup filters
function setupFilters() {
    
    // Clear existing options
    yearFilter.innerHTML = '<option value="">All Years</option>';
    locationFilter.innerHTML = '<option value="">All Locations</option>';
    
    // Populate year filter from years array - include all years from all galleries
    const allYears = [];
    galleries.forEach(gallery => {
        if (gallery.years && Array.isArray(gallery.years) && gallery.years.length > 0) {
            // Add all years from this gallery
            gallery.years.forEach(year => {
                allYears.push(parseInt(year));
            });
        } else {
            // Fallback to createdAt if no years
            const fallbackYear = new Date(gallery.createdAt).getFullYear();
            allYears.push(fallbackYear);
        }
    });
    
    // Remove duplicates and sort in descending order
    const years = [...new Set(allYears)].sort((a, b) => b - a);
    
    console.log('Available years for filter:', years);
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
    
    // Populate location filter with continents
    const locations = [...new Set(galleries.map(gallery => gallery.continent || gallery.country || 'Unknown'))].sort();
    console.log('Available locations for filter:', locations);
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });
    
    // Add event listeners
    yearFilter.addEventListener('change', filterGalleries);
    locationFilter.addEventListener('change', filterGalleries);
    // clearFiltersBtn.addEventListener('click', clearFilters); // Removed as per edit hint
}

// Filter galleries based on selected criteria
function filterGalleries() {
    const selectedYear = yearFilter.value;
    const selectedLocation = locationFilter.value;
    
    currentFilteredGalleries = galleries.filter(gallery => {
        // Check year from years array
        let yearMatch = !selectedYear;
        if (selectedYear) {
            if (gallery.years && Array.isArray(gallery.years) && gallery.years.length > 0) {
                // Check if the selected year is present in the gallery's years array
                yearMatch = gallery.years.includes(selectedYear.toString());
            } else {
                // Fallback to createdAt if no years
                yearMatch = new Date(gallery.createdAt).getFullYear() == selectedYear;
            }
        }
        
        const locationMatch = !selectedLocation || (gallery.continent || gallery.country || 'Unknown') === selectedLocation;
        return yearMatch && locationMatch;
    });
    
    loadGalleries();
}

// Clear all filters
function clearFilters() {
    yearFilter.value = '';
    locationFilter.value = '';
    currentFilteredGalleries = [...galleries];
    loadGalleries();
}

// Note: Lightbox functionality has been replaced with individual gallery pages

// Setup mobile navigation
function setupNavigation() {
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        }
    });
}

// Setup smooth scrolling for navigation links
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                            const headerHeight = document.querySelector('.header').offsetHeight;
            const targetPosition = target.offsetTop - headerHeight - 20;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
                });
            }
        });
    });
}

// Update active navigation link based on scroll position
function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.pageYOffset >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}

// Header scroll effect
function handleHeaderScroll() {
    const header = document.querySelector('.header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(255, 255, 255, 0.98)';
        header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.15)';
    } else {
        header.style.background = 'rgba(255, 255, 255, 0.95)';
        header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    }
}

// Add scroll event listeners
window.addEventListener('scroll', () => {
    updateActiveNavLink();
    handleHeaderScroll();
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Add some CSS for the no-results message
const style = document.createElement('style');
style.textContent = `
    .no-results {
        text-align: center;
        padding: 4rem 2rem;
        color: #7f8c8d;
        font-size: 1.1rem;
    }
`;
document.head.appendChild(style); 

document.addEventListener('dragstart', function(e) {
    e.preventDefault();
});

// Map functionality
class GalleryMap {
    constructor(config = {}) {
        this.map = null;
        this.markers = [];
        this.coordinateCache = new Map(); // 添加坐标缓存
        this.isInitialized = false;
        this.isLoadingMarkers = false;
        this.markerQueue = [];
        
        // 筛选状态
        this.selectedYears = new Set();
        this.allYears = [];
        this.yearCounts = {};
        
        // 可配置的批量处理参数
        this.batchSize = config.batchSize || 3; // 每批处理的标记数量
        this.batchDelay = config.batchDelay || 100; // 批次间的延迟时间(ms)
        this.maxRetries = config.maxRetries || 3; // 最大重试次数
        this.retryDelay = config.retryDelay || 1000; // 重试延迟时间(ms)
        
        // 标记点大小配置
        this.markerSizeConfig = {
            minSize: 30,    // 最小尺寸 (zoom out时)
            maxSize: 100,   // 最大尺寸 (zoom in时)
            minZoom: 2,     // 最小缩放级别
            maxZoom: 18     // 最大缩放级别
        };
        
        // 性能监控
        this.performanceMetrics = {
            mapInitStart: 0,
            mapInitEnd: 0,
            markersLoadStart: 0,
            markersLoadEnd: 0,
            totalMarkers: 0,
            successfulMarkers: 0,
            failedMarkers: 0
        };
        
    }

    async init() {
        try {
            if (this.isInitialized) {
                console.log('Map already initialized');
                return;
            }

            // 检查是否有画廊数据
            if (!galleries || galleries.length === 0) {
                console.log('No galleries available, retrying in 1 second...');
                setTimeout(() => this.init(), 1000);
                return;
            }

            console.log('Initializing map with galleries:', galleries.length);
            
            // 记录地图初始化开始时间
            this.performanceMetrics.mapInitStart = performance.now();
            this.performanceMetrics.totalMarkers = galleries.length;
            
            // 立即初始化地图（这是关键优化）
            this.initMap();
            
            // 记录地图初始化完成时间
            this.performanceMetrics.mapInitEnd = performance.now();
            const mapInitTime = this.performanceMetrics.mapInitEnd - this.performanceMetrics.mapInitStart;
            console.log(`Map initialized in ${mapInitTime.toFixed(2)}ms`);
            
            // 隐藏加载状态，让用户看到地图
            this.hideLoading();
            this.isInitialized = true;
            
            // 在后台开始加载gallery标记
            this.startBackgroundMarkerLoading();
            
        } catch (error) {
            console.error('Error initializing map:', error);
            this.hideLoading();
        }
    }

    initMap() {
        // 初始化 Leaflet 地图
        this.map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            minZoom: 3,       // 最小缩放级别（和 setView 对齐）
            maxZoom: 16,      // 最大缩放级别
            zoomSnap: 0.25,   // 最小粒度（0.25 = 四分之一等级）
            zoomDelta: 0.25,  // 按按钮/键盘一次缩放 0.25 级
            wheelPxPerZoomLevel: 60 // 滚轮滚动灵敏度
        }).setView([20, 3], 2); // 默认中心 & 缩放级别
    
        // 瓦片图层（OSM）
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            subdomains: 'abc',
            minZoom: 3,  // 同地图一致
            maxZoom: 16
        }).addTo(this.map);
    
        // 添加缩放事件监听器
        this.map.on('zoomend', () => {
            console.log('Zoom event triggered, current zoom level:', this.map.getZoom());
            this.updateMarkerSizes();
        });
    }

    // 初始化筛选控件
    initFilterControls() {
        // 收集所有年份和计数
        this.collectYearData();
        
        // 生成年份选项
        this.generateYearOptions();
        
        // 绑定事件
        this.bindFilterEvents();
    }
    
    // 收集年份数据
    collectYearData() {
        this.allYears = [];
        this.yearCounts = {};
        
        galleries.forEach(gallery => {
            if (gallery.years && Array.isArray(gallery.years) && gallery.years.length > 0) {
                gallery.years.forEach(year => {
                    const yearInt = parseInt(year);
                    if (!this.allYears.includes(yearInt)) {
                        this.allYears.push(yearInt);
                    }
                    this.yearCounts[yearInt] = (this.yearCounts[yearInt] || 0) + 1;
                });
            } else {
                const fallbackYear = new Date(gallery.createdAt).getFullYear();
                if (!this.allYears.includes(fallbackYear)) {
                    this.allYears.push(fallbackYear);
                }
                this.yearCounts[fallbackYear] = (this.yearCounts[fallbackYear] || 0) + 1;
            }
        });
        
        // 排序年份
        this.allYears.sort((a, b) => b - a);
        
        console.log('Collected years:', this.allYears);
        console.log('Year counts:', this.yearCounts);
    }
    
    // 生成年份选项
    generateYearOptions() {
        const container = document.getElementById('mapYearCheckboxes');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.allYears.forEach(year => {
            const count = this.yearCounts[year] || 0;
            const option = document.createElement('div');
            option.className = 'year-option';
            option.innerHTML = `
                <input type="checkbox" id="year-${year}" value="${year}">
                <label for="year-${year}">${year}</label>
                <span class="count">${count}</span>
            `;
            container.appendChild(option);
        });
    }
    
    // 绑定筛选事件
    bindFilterEvents() {
        // 年份复选框事件
        const checkboxes = document.querySelectorAll('#mapYearCheckboxes input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.handleYearFilterChange();
            });
        });
    }
    
    // 处理年份筛选变化
    handleYearFilterChange() {
        this.selectedYears.clear();
        
        const checkboxes = document.querySelectorAll('#mapYearCheckboxes input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            this.selectedYears.add(parseInt(checkbox.value));
        });
        
        console.log('Selected years:', Array.from(this.selectedYears));
        this.updateMarkerVisibility();
    }
    

    
    // 更新标记点可见性
    updateMarkerVisibility() {
        this.markers.forEach(marker => {
            const gallery = marker.galleryData;
            if (!gallery) return;
            
            const shouldShow = this.shouldShowMarker(gallery);
            
            if (shouldShow) {
                marker.getElement().style.display = 'block';
            } else {
                marker.getElement().style.display = 'none';
            }
        });
        
        // 重新调整地图视图以显示可见的标记点
        this.fitVisibleMarkers();
    }
    
    // 判断是否应该显示标记点
    shouldShowMarker(gallery) {
        // 如果没有选择任何年份，显示所有标记点
        if (this.selectedYears.size === 0) {
            return true;
        }
        
        // 检查画廊的年份是否在选中的年份中
        if (gallery.years && Array.isArray(gallery.years) && gallery.years.length > 0) {
            return gallery.years.some(year => this.selectedYears.has(parseInt(year)));
        } else {
            const fallbackYear = new Date(gallery.createdAt).getFullYear();
            return this.selectedYears.has(fallbackYear);
        }
    }
    
    // 调整地图视图以显示可见的标记点
    fitVisibleMarkers() {
        const visibleMarkers = this.markers.filter(marker => {
            const gallery = marker.galleryData;
            if (!gallery) return false;
            return this.shouldShowMarker(gallery);
        });
        
        if (visibleMarkers.length > 0) {
            const group = new L.featureGroup(visibleMarkers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    addCustomAttribution() {
        const attribution = L.control.attribution({
            position: 'bottomleft'
        });
        attribution.addAttribution('© OpenStreetMap contributors');
        attribution.addAttribution('© CartoDB');
        attribution.addTo(this.map);
    }

    // 根据当前缩放级别计算标记点大小
    calculateMarkerSize() {
        const currentZoom = this.map.getZoom();
        const { minSize, maxSize, minZoom, maxZoom } = this.markerSizeConfig;
        
        // 计算缩放比例 (0-1)
        const zoomRatio = Math.max(0, Math.min(1, (currentZoom - minZoom) / (maxZoom - minZoom)));
        
        // 使用缓动函数让大小变化更平滑
        const easeRatio = this.easeInOutQuad(zoomRatio);
        
        // 计算当前大小
        const currentSize = minSize + (maxSize - minSize) * easeRatio;
        
        console.log(`Marker size calculation: zoom=${currentZoom}, ratio=${zoomRatio.toFixed(2)}, size=${Math.round(currentSize)}px`);
        
        return Math.round(currentSize);
    }
    
    // 缓动函数，让大小变化更平滑
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    // 更新所有标记点的大小
    updateMarkerSizes() {
        const newSize = this.calculateMarkerSize();
        console.log(`Updating marker sizes to ${newSize}px at zoom level ${this.map.getZoom()}`);
        console.log(`Total markers to update: ${this.markers.length}`);
        
        this.markers.forEach((marker, index) => {
            // 获取标记点的坐标
            const markerLatLng = marker.getLatLng();
            console.log(`Updating marker ${index}: lat=${markerLatLng.lat}, lng=${markerLatLng.lng}`);
            
            // 根据坐标找到对应的画廊数据
            const gallery = galleries.find(g => {
                if (g.latitude && g.longitude) {
                    return Math.abs(g.latitude - markerLatLng.lat) < 0.001 && 
                           Math.abs(g.longitude - markerLatLng.lng) < 0.001;
                }
                return false;
            });
            
            if (!gallery) {
                console.warn(`No gallery found for marker ${index}`);
                return;
            }
            
            console.log(`Found gallery: ${gallery.name}`);
            
            // 计算徽章大小（随标记点大小变化）
            const badgeSize = Math.max(16, Math.round(newSize * 0.3));
            const badgeFontSize = Math.max(8, Math.round(badgeSize * 0.4));
            
            // 创建新的图标
            const newIcon = L.divIcon({
                className: 'gallery-map-marker',
                html: `
                    <div class="marker-container" style="width: ${newSize}px; height: ${newSize}px;">
                        <div class="marker-image" style="width: ${newSize}px; height: ${newSize}px;">
                            <img src="${gallery.coverPhotoURL}" 
                                 alt="${gallery.name}" 
                                 onerror="this.src='https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop'">
                        </div>
                        <div class="marker-badge" style="width: ${badgeSize}px; height: ${badgeSize}px; font-size: ${badgeFontSize}px;">
                            <span class="photo-count">${gallery.photoCount || 0}</span>
                        </div>
                    </div>
                `,
                iconSize: [newSize, newSize],
                iconAnchor: [newSize / 2, newSize / 2]
            });
            
            // 更新标记点图标
            marker.setIcon(newIcon);
            console.log(`Marker ${index} updated to size ${newSize}px`);
        });
    }

    // 在后台开始加载gallery标记
    startBackgroundMarkerLoading() {
        if (this.isLoadingMarkers) return;
        
        this.isLoadingMarkers = true;
        this.markerQueue = [...galleries];
        
        // 记录标记加载开始时间
        this.performanceMetrics.markersLoadStart = performance.now();
        
        // 显示加载进度指示器
        this.showMarkerLoadingProgress();
        
        // 开始批量处理
        this.processMarkerBatch();
        
        // 初始化完成后更新一次标记点大小
        setTimeout(() => {
            this.updateMarkerSizes();
        }, 100);
    }

    // 显示标记加载进度
    showMarkerLoadingProgress() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading gallery markers...</div>
                <div class="loading-progress">
                    <span id="markerProgress">0</span> / <span id="totalMarkers">${galleries.length}</span>
                </div>
            `;
            loadingOverlay.style.display = 'flex';
        }
    }

    // 更新标记加载进度
    updateMarkerProgress(loaded, total) {
        const progressElement = document.getElementById('markerProgress');
        if (progressElement) {
            progressElement.textContent = loaded;
        }
        
        // 当所有标记加载完成时，隐藏加载指示器
        if (loaded >= total) {
            setTimeout(() => {
                this.hideLoading();
            }, 500);
        }
    }

    // 批量处理标记
    async processMarkerBatch() {
        if (this.markerQueue.length === 0) {
            this.isLoadingMarkers = false;
            
            // 记录标记加载完成时间
            this.performanceMetrics.markersLoadEnd = performance.now();
            const markersLoadTime = this.performanceMetrics.markersLoadEnd - this.performanceMetrics.markersLoadStart;
            
            console.log('All markers loaded');
            console.log(`Performance Summary:
                - Map initialization: ${(this.performanceMetrics.mapInitEnd - this.performanceMetrics.mapInitStart).toFixed(2)}ms
                - Markers loading: ${markersLoadTime.toFixed(2)}ms
                - Total markers: ${this.performanceMetrics.totalMarkers}
                - Successful: ${this.performanceMetrics.successfulMarkers}
                - Failed: ${this.performanceMetrics.failedMarkers}
                - Success rate: ${((this.performanceMetrics.successfulMarkers / this.performanceMetrics.totalMarkers) * 100).toFixed(1)}%`);
            
            // 所有标记加载完成后，调整地图视图
            this.fitAllMarkers();
            
            // 初始化筛选控件
            this.initFilterControls();
            
            return;
        }

        // 取出一批标记
        const batch = this.markerQueue.splice(0, this.batchSize);
        console.log(`Processing batch of ${batch.length} markers, ${this.markerQueue.length} remaining`);

        // 并行处理这一批标记
        const promises = batch.map(async (gallery) => {
            try {
                const coordinates = await this.getCoordinates(gallery.name, gallery.country);
                if (coordinates) {
                    this.addMarker(gallery, coordinates);
                    console.log(`Added marker for ${gallery.name} at ${coordinates}`);
                    this.performanceMetrics.successfulMarkers++;
                    return true; // 成功添加标记
                } else {
                    console.warn(`Could not find coordinates for ${gallery.name}`);
                    this.performanceMetrics.failedMarkers++;
                    return false;
                }
            } catch (error) {
                console.error(`Error getting coordinates for ${gallery.name}:`, error);
                this.performanceMetrics.failedMarkers++;
                return false;
            }
        });

        // 等待当前批次完成
        const results = await Promise.all(promises);
        const successfulMarkers = results.filter(result => result === true).length;
        
        // 更新进度
        const totalMarkers = galleries.length;
        const loadedMarkers = totalMarkers - this.markerQueue.length;
        this.updateMarkerProgress(loadedMarkers, totalMarkers);

        // 延迟处理下一批，避免阻塞UI
        setTimeout(() => {
            this.processMarkerBatch();
        }, this.batchDelay);
    }

    getCoordinates(location, country) {
        // 直接查找 gallery 数据里的经纬度
        const gallery = galleries.find(g => g.name === location && g.country === country);
        if (gallery && gallery.latitude && gallery.longitude) {
            return [gallery.latitude, gallery.longitude];
        }
    
        console.warn(`No coordinates found for ${location}, ${country}`);
            return null;
    }

    addMarker(gallery, coordinates) {
        // 计算当前缩放级别下的标记点大小
        const currentSize = this.calculateMarkerSize();
        const iconSize = [currentSize, currentSize];
        const iconAnchor = [currentSize / 2, currentSize / 2];
        
        // 计算徽章大小（随标记点大小变化）
        const badgeSize = Math.max(20, Math.round(currentSize * 0.3));
        const badgeFontSize = Math.max(8, Math.round(badgeSize * 0.4));
        
        // Create custom icon for the marker with better styling
        const icon = L.divIcon({
            className: 'gallery-map-marker',
            html: `
                <div class="marker-container" style="width: ${currentSize}px; height: ${currentSize}px;">
                    <div class="marker-image" style="width: ${currentSize}px; height: ${currentSize}px;">
                        <img src="${gallery.coverPhotoURL}" 
                     alt="${gallery.name}" 
                     onerror="this.src='https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop'">
                    </div>
                    <div class="marker-badge" style="width: ${badgeSize}px; height: ${badgeSize}px; font-size: ${badgeFontSize}px;">
                        <span class="photo-count">${gallery.photoCount || 0}</span>
                    </div>
                </div>
            `,
            iconSize: iconSize,
            iconAnchor: iconAnchor
        });
        
        // Create popup content
        const popupContent = this.createPopupContent(gallery);
        
        // Add marker to map
        const marker = L.marker(coordinates, { icon: icon })
            .addTo(this.map)
            .bindPopup(popupContent, {
                maxWidth: 280,
                className: 'gallery-popup',
                closeButton: true
            });
        
        // 将画廊数据附加到标记点对象上
        marker.galleryData = gallery;
        
        // Store marker reference
        this.markers.push(marker);
        
        // 修复标记点点击事件
        marker.on('click', () => {
            const galleryId = gallery.galleryId || gallery.id;
            this.openGallery(galleryId);
        });
        
        // Add hover effects
        marker.on('mouseover', () => {
            marker.getElement().classList.add('marker-hover');
        });
        
        marker.on('mouseout', () => {
            marker.getElement().classList.remove('marker-hover');
        });
    }

    createPopupContent(gallery) {
        const coverImage = gallery.coverPhotoURL || 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop';
        
        return `
            <div class="gallery-popup">
                <div class="popup-header">
                <img src="${coverImage}" alt="${gallery.name}" onerror="this.src='https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop'">
                    <div class="popup-overlay">
                <h3>${gallery.name}</h3>
                    </div>
                </div>
                <div class="popup-content">
                    <div class="popup-info">
                        <p class="location"><i class="fas fa-map-marker-alt"></i> ${gallery.continent} > ${gallery.country}</p>
                        <p class="photos"><i class="fas fa-images"></i> ${gallery.photoCount || 0} photos</p>
                    </div>
                <button onclick="galleryMap.openGallery('${gallery.galleryId || gallery.id}')" 
                            class="popup-button">
                        <i class="fas fa-external-link-alt"></i>
                    View Gallery
                </button>
                </div>
            </div>
        `;
    }

    openGallery(galleryId) {
        // Navigate to gallery page
        window.location.href = `gallery.html?gallery=${galleryId}`;
    }

    fitAllMarkers() {
        if (this.markers.length > 0) {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
}

// Initialize map when galleries are loaded
let galleryMap;
function initMap() {
    if (!galleryMap) {
        // 使用优化的配置参数
        galleryMap = new GalleryMap({
            batchSize: 2,        // 每批处理2个标记，减少API压力
            batchDelay: 150,     // 批次间延迟150ms，平衡性能和用户体验
            maxRetries: 2,       // 最大重试2次
            retryDelay: 800      // 重试延迟800ms
        });
    }
    galleryMap.init();
}

// Make galleryMap globally accessible for popup buttons
window.galleryMap = galleryMap;