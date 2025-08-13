// Gallery data - will be loaded from API
let galleries = [];

// Main Application Class
class PhotoGalleryApp {
    constructor() {
        this.currentFilteredGalleries = [];
        this.galleryMap = null;
        this.currentDisplayCount = 10; // 初始显示数量
        this.itemsPerLoad = 10; // 每次加载数量
        
        // DOM Elements
        this.galleryGrid = document.getElementById('galleryGrid');
        this.yearFilter = document.getElementById('yearFilter');
        this.locationFilter = document.getElementById('locationFilter');
        this.navToggle = document.getElementById('navToggle');
        this.navMenu = document.getElementById('navMenu');
        this.loadMoreBtn = document.getElementById('loadMoreBtn');
        this.galleryLoadMore = document.getElementById('galleryLoadMore');
        
        this.init();
    }

    async init() {
        console.log('Starting application initialization...');
        
        // Load galleries from API
        await this.loadGalleriesFromAPI();
        
        this.currentFilteredGalleries = [...galleries];
        console.log('Initialized with galleries:', galleries.length, 'Filtered:', this.currentFilteredGalleries.length);
        
        this.loadGalleries();
        this.setupFilters();
        this.setupNavigation();
        this.setupSmoothScrolling();
        
        // Initialize map immediately if galleries exist
        if (galleries.length > 0) {
            this.initMap();
        }
        
        // Add scroll event listeners
        window.addEventListener('scroll', () => {
            this.updateActiveNavLink();
            this.handleHeaderScroll();
        });
        
        // Add resize event listener
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Prevent drag on images
        document.addEventListener('dragstart', e => e.preventDefault());
        
        // Setup Load More button
        this.setupLoadMoreButton();
    }

    async loadGalleriesFromAPI() {
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
            galleries = [];
            return false;
        }
    }

    loadGalleries() {
        this.galleryGrid.innerHTML = '';
        this.currentDisplayCount = this.getInitialDisplayCount(); // 根据屏幕尺寸计算初始显示数量
        
        if (this.currentFilteredGalleries.length === 0) {
            this.galleryGrid.innerHTML = '<div class="no-results">No galleries found matching your criteria.</div>';
            this.galleryLoadMore.style.display = 'none';
            console.log('No galleries to display');
            return;
        }
        
        this.displayGalleries();
        this.updateLoadMoreButton();
        console.log('Galleries loaded successfully');
    }
    
    getInitialDisplayCount() {
        // 根据屏幕宽度计算应该显示的数量
        const screenWidth = window.innerWidth;
        if (screenWidth <= 768) {
            return 6; // 移动端显示6个（约两行）
        } else if (screenWidth <= 1200) {
            return 8; // 中等屏幕显示8个
        } else {
            return 10; // 大屏幕显示10个（两行，每行5个）
        }
    }
    
    getItemsPerLoad() {
        // 根据屏幕宽度计算每次加载的数量
        const screenWidth = window.innerWidth;
        if (screenWidth <= 768) {
            return 6; // 移动端每次加载6个
        } else if (screenWidth <= 1200) {
            return 8; // 中等屏幕每次加载8个
        } else {
            return 10; // 大屏幕每次加载10个
        }
    }
    
    displayGalleries() {
        // 清空现有内容
        this.galleryGrid.innerHTML = '';
        
        const galleriesToShow = this.currentFilteredGalleries.slice(0, this.currentDisplayCount);
        
        galleriesToShow.forEach((gallery, index) => {
            const galleryElement = this.createGalleryElement(gallery, index);
            this.galleryGrid.appendChild(galleryElement);
        });
    }
    
    updateLoadMoreButton() {
        if (this.currentDisplayCount >= this.currentFilteredGalleries.length) {
            this.galleryLoadMore.style.display = 'none';
        } else {
            this.galleryLoadMore.style.display = 'block';
        }
    }
    
    loadMoreGalleries() {
        // 添加加载状态
        this.loadMoreBtn.classList.add('loading');
        this.loadMoreBtn.innerHTML = '<i class="fas fa-spinner"></i><span>Loading...</span>';
        
        // 模拟加载延迟，让用户看到加载效果
        setTimeout(() => {
            const previousCount = this.currentDisplayCount;
            this.currentDisplayCount += this.getItemsPerLoad();
            
            // 只添加新的gallery
            const newGalleries = this.currentFilteredGalleries.slice(previousCount, this.currentDisplayCount);
            
            newGalleries.forEach((gallery, index) => {
                const actualIndex = previousCount + index;
                const galleryElement = this.createGalleryElement(gallery, actualIndex);
                this.galleryGrid.appendChild(galleryElement);
            });
            
            this.updateLoadMoreButton();
            
            // 移除加载状态
            this.loadMoreBtn.classList.remove('loading');
            this.loadMoreBtn.innerHTML = '<i class="fas fa-arrow-down"></i><span>Load More</span>';
        }, 300);
    }
    
    setupLoadMoreButton() {
        if (this.loadMoreBtn) {
            this.loadMoreBtn.addEventListener('click', () => {
                this.loadMoreGalleries();
            });
        }
    }
    
    handleResize() {
        // 防抖处理，避免频繁触发
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            const newInitialCount = this.getInitialDisplayCount();
            if (newInitialCount !== this.currentDisplayCount) {
                // 如果初始显示数量发生变化，重新加载gallery
                this.loadGalleries();
            }
        }, 250);
    }

    createGalleryElement(gallery, index) {
        const article = document.createElement('article');
        article.className = 'gallery-item';
        article.setAttribute('data-index', index);
        
        // Use coverPhotoURL if available, otherwise use a placeholder
        const coverImage = gallery.coverPhotoURL || 'images/placeholder.jpg';
        const location = gallery.continent;
        
        // Extract latest year from years array
        let year = '';
        if (gallery.years && Array.isArray(gallery.years) && gallery.years.length > 0) {
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

    setupFilters() {
        // Clear existing options
        this.yearFilter.innerHTML = '<option value="">All Years</option>';
        this.locationFilter.innerHTML = '<option value="">All Locations</option>';
        
        // Populate year filter from years array
        const allYears = [];
        galleries.forEach(gallery => {
            if (gallery.years && Array.isArray(gallery.years) && gallery.years.length > 0) {
                gallery.years.forEach(year => {
                    allYears.push(parseInt(year));
                });
            } else {
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
            this.yearFilter.appendChild(option);
        });
        
        // Populate location filter with continents
        const locations = [...new Set(galleries.map(gallery => gallery.continent || gallery.country || 'Unknown'))].sort();
        console.log('Available locations for filter:', locations);
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            this.locationFilter.appendChild(option);
        });
        
        // Add event listeners
        this.yearFilter.addEventListener('change', () => this.filterGalleries());
        this.locationFilter.addEventListener('change', () => this.filterGalleries());
        
        // Setup Clear Filters button
        const clearFiltersBtn = document.getElementById('clearFilters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }
    }
    
    clearFilters() {
        this.yearFilter.value = '';
        this.locationFilter.value = '';
        this.currentFilteredGalleries = [...galleries];
        this.loadGalleries();
    }

    filterGalleries() {
        const selectedYear = this.yearFilter.value;
        const selectedLocation = this.locationFilter.value;
        
        this.currentFilteredGalleries = galleries.filter(gallery => {
            // Check year from years array
            let yearMatch = !selectedYear;
            if (selectedYear) {
                if (gallery.years && Array.isArray(gallery.years) && gallery.years.length > 0) {
                    yearMatch = gallery.years.includes(selectedYear.toString());
                } else {
                    yearMatch = new Date(gallery.createdAt).getFullYear() == selectedYear;
                }
            }
            
            const locationMatch = !selectedLocation || (gallery.continent || gallery.country || 'Unknown') === selectedLocation;
            return yearMatch && locationMatch;
        });
        
        this.loadGalleries();
    }

    setupNavigation() {
        this.navToggle.addEventListener('click', () => {
            this.navMenu.classList.toggle('active');
            this.navToggle.classList.toggle('active');
        });
        
        // Close mobile menu when clicking on a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                this.navMenu.classList.remove('active');
                this.navToggle.classList.remove('active');
            });
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.navToggle.contains(e.target) && !this.navMenu.contains(e.target)) {
                this.navMenu.classList.remove('active');
                this.navToggle.classList.remove('active');
            }
        });
    }

    setupSmoothScrolling() {
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

    updateActiveNavLink() {
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

    handleHeaderScroll() {
        const header = document.querySelector('.header');
        if (window.scrollY > 100) {
            header.style.background = 'rgba(255, 255, 255, 0.98)';
            header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.15)';
        } else {
            header.style.background = 'rgba(255, 255, 255, 0.95)';
            header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
        }
    }

    initMap() {
        if (!this.galleryMap) {
            this.galleryMap = new GalleryMap({
                batchSize: 2,
                batchDelay: 150,
                maxRetries: 2,
                retryDelay: 800
            });
        }
        this.galleryMap.init();
    }
}

// Map functionality class
class GalleryMap {
    constructor(config = {}) {
        this.map = null;
        this.markers = [];
        this.coordinateCache = new Map();
        this.isInitialized = false;
        this.isLoadingMarkers = false;
        this.markerQueue = [];
        
        // Filter state
        this.selectedYears = new Set();
        this.allYears = [];
        this.yearCounts = {};
        
        // Configurable batch processing parameters
        this.batchSize = config.batchSize || 3;
        this.batchDelay = config.batchDelay || 100;
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000;
        
        // Marker size configuration
        this.markerSizeConfig = {
            minSize: 30,
            maxSize: 100,
            minZoom: 2,
            maxZoom: 18
        };
        
        // Performance monitoring
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

            if (!galleries || galleries.length === 0) {
                console.log('No galleries available, retrying in 1 second...');
                setTimeout(() => this.init(), 1000);
                return;
            }

            console.log('Initializing map with galleries:', galleries.length);
            
            this.performanceMetrics.mapInitStart = performance.now();
            this.performanceMetrics.totalMarkers = galleries.length;
            
            this.initMap();
            
            this.performanceMetrics.mapInitEnd = performance.now();
            const mapInitTime = this.performanceMetrics.mapInitEnd - this.performanceMetrics.mapInitStart;
            console.log(`Map initialized in ${mapInitTime.toFixed(2)}ms`);
            
            this.hideLoading();
            this.isInitialized = true;
            
            this.startBackgroundMarkerLoading();
            
        } catch (error) {
            console.error('Error initializing map:', error);
            this.hideLoading();
        }
    }

    initMap() {
        this.map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            minZoom: 3,
            maxZoom: 16,
            zoomSnap: 0.25,
            zoomDelta: 0.25,
            wheelPxPerZoomLevel: 60,
            worldCopyJump: true,
            maxBounds: [
                [-90, -180],
                [90, 180]
            ],
            maxBoundsViscosity: 1.0
        }).setView([20, 3], 2);
    
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            subdomains: 'abc',
            minZoom: 3,
            maxZoom: 16
        }).addTo(this.map);
    
        this.map.on('zoomend', () => {
            console.log('Zoom event triggered, current zoom level:', this.map.getZoom());
            this.updateMarkerSizes();
        });
        
        // 添加Year Filter的滚轮事件处理
        this.setupYearFilterWheelEvents();
    }

    initFilterControls() {
        this.collectYearData();
        this.generateYearOptions();
        this.bindFilterEvents();
    }
    
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
        
        this.allYears.sort((a, b) => b - a);
        
        console.log('Collected years:', this.allYears);
        console.log('Year counts:', this.yearCounts);
    }
    
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
    
    bindFilterEvents() {
        const checkboxes = document.querySelectorAll('#mapYearCheckboxes input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.handleYearFilterChange();
            });
        });
    }
    
    setupYearFilterWheelEvents() {
        const yearFilterContainer = document.querySelector('.map-filter-control');
        if (!yearFilterContainer) return;
        
        console.log('Setting up wheel events for Year Filter container:', yearFilterContainer);
        
        // 为整个Year Filter容器添加滚轮事件处理
        yearFilterContainer.addEventListener('wheel', (e) => {
            console.log('Wheel event on main container');
            e.stopPropagation();
            e.preventDefault();
            
            // 手动处理滚动
            const yearCheckboxes = yearFilterContainer.querySelector('.year-checkboxes');
            if (yearCheckboxes) {
                const scrollAmount = e.deltaY > 0 ? 30 : -30; // 滚动量
                yearCheckboxes.scrollTop += scrollAmount;
                console.log('Scrolled year checkboxes by:', scrollAmount, 'New scrollTop:', yearCheckboxes.scrollTop);
            }
        }, { passive: false });
        
        // 为Year Filter内的所有子元素添加滚轮事件处理
        this.setupWheelEventForElement(yearFilterContainer);
        
        // 确保整个区域都能响应滚轮事件
        this.ensureFullWheelCoverage(yearFilterContainer);
        
        console.log('Year Filter wheel events configured');
    }
    
    setupWheelEventForElement(element) {
        // 为元素及其所有子元素添加滚轮事件处理
        const addWheelEvent = (el) => {
            el.addEventListener('wheel', (e) => {
                console.log('Wheel event on element:', el.tagName, el.className);
                // 阻止事件冒泡到地图，但允许滚动处理
                e.stopPropagation();
                
                // 查找最近的父级滚动容器
                const scrollContainer = el.closest('.year-checkboxes') || 
                                     el.closest('.map-filter-control');
                
                if (scrollContainer) {
                    // 手动处理滚动
                    const scrollAmount = e.deltaY > 0 ? 30 : -30;
                    scrollContainer.scrollTop += scrollAmount;
                    console.log('Scrolled container by:', scrollAmount, 'New scrollTop:', scrollContainer.scrollTop);
                }
                
                // 阻止默认行为
                e.preventDefault();
            }, { passive: false });
        };
        
        // 为当前元素添加
        addWheelEvent(element);
        
        // 为所有子元素添加
        const allChildren = element.querySelectorAll('*');
        allChildren.forEach(child => {
            addWheelEvent(child);
        });
        
        // 监听新添加的元素
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        addWheelEvent(node);
                        // 为新元素的子元素也添加事件
                        const newChildren = node.querySelectorAll('*');
                        newChildren.forEach(child => {
                            addWheelEvent(child);
                        });
                    }
                });
            });
        });
        
        observer.observe(element, {
            childList: true,
            subtree: true
        });
    }
    
    ensureFullWheelCoverage(container) {
        // 确保整个容器区域都能响应滚轮事件
        // 通过设置CSS属性来确保事件能被正确捕获
        container.style.pointerEvents = 'auto';
        
        // 为容器的所有直接子元素添加滚轮事件处理
        const directChildren = Array.from(container.children);
        directChildren.forEach(child => {
            if (child.tagName !== 'DIV' || !child.classList.contains('wheel-overlay')) {
                child.addEventListener('wheel', (e) => {
                    console.log('Wheel event on direct child:', child.tagName, child.className);
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // 手动处理滚动
                    const yearCheckboxes = container.querySelector('.year-checkboxes');
                    if (yearCheckboxes) {
                        const scrollAmount = e.deltaY > 0 ? 30 : -30;
                        yearCheckboxes.scrollTop += scrollAmount;
                        console.log('Scrolled via direct child by:', scrollAmount, 'New scrollTop:', yearCheckboxes.scrollTop);
                    }
                }, { passive: false });
            }
        });
        
        console.log('Enhanced wheel event coverage for container');
    }
    
    handleYearFilterChange() {
        this.selectedYears.clear();
        
        const checkboxes = document.querySelectorAll('#mapYearCheckboxes input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            this.selectedYears.add(parseInt(checkbox.value));
        });
        
        console.log('Selected years:', Array.from(this.selectedYears));
        this.updateMarkerVisibility();
    }
    
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
        
        this.fitVisibleMarkers();
    }
    
    shouldShowMarker(gallery) {
        if (this.selectedYears.size === 0) {
            return true;
        }
        
        if (gallery.years && Array.isArray(gallery.years) && gallery.years.length > 0) {
            return gallery.years.some(year => this.selectedYears.has(parseInt(year)));
        } else {
            const fallbackYear = new Date(gallery.createdAt).getFullYear();
            return this.selectedYears.has(fallbackYear);
        }
    }
    
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

    calculateMarkerSize() {
        const currentZoom = this.map.getZoom();
        const { minSize, maxSize, minZoom, maxZoom } = this.markerSizeConfig;
        
        const zoomRatio = Math.max(0, Math.min(1, (currentZoom - minZoom) / (maxZoom - minZoom)));
        const easeRatio = this.easeInOutQuad(zoomRatio);
        const currentSize = minSize + (maxSize - minSize) * easeRatio;
        
        return Math.round(currentSize);
    }
    
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    updateMarkerSizes() {
        const newSize = this.calculateMarkerSize();
        
        this.markers.forEach((marker, index) => {
            const markerLatLng = marker.getLatLng();
            console.log(`Updating marker ${index}: lat=${markerLatLng.lat}, lng=${markerLatLng.lng}`);
            
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
            
            const badgeSize = Math.max(16, Math.round(newSize * 0.3));
            const badgeFontSize = Math.max(8, Math.round(badgeSize * 0.4));
            
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
            
            marker.setIcon(newIcon);
        });
    }

    startBackgroundMarkerLoading() {
        if (this.isLoadingMarkers) return;
        
        this.isLoadingMarkers = true;
        this.markerQueue = [...galleries];
        
        this.performanceMetrics.markersLoadStart = performance.now();
        
        this.showMarkerLoadingProgress();
        this.processMarkerBatch();
        
        setTimeout(() => {
            this.updateMarkerSizes();
        }, 100);
    }

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

    updateMarkerProgress(loaded, total) {
        const progressElement = document.getElementById('markerProgress');
        if (progressElement) {
            progressElement.textContent = loaded;
        }
        
        if (loaded >= total) {
            setTimeout(() => {
                this.hideLoading();
            }, 500);
        }
    }

    async processMarkerBatch() {
        if (this.markerQueue.length === 0) {
            this.isLoadingMarkers = false;
            
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
            
            this.fitAllMarkers();
            this.initFilterControls();
            
            return;
        }

        const batch = this.markerQueue.splice(0, this.batchSize);
        console.log(`Processing batch of ${batch.length} markers, ${this.markerQueue.length} remaining`);

        const promises = batch.map(async (gallery) => {
            try {
                const coordinates = await this.getCoordinates(gallery.name, gallery.country);
                if (coordinates) {
                    this.addMarker(gallery, coordinates);
                    console.log(`Added marker for ${gallery.name} at ${coordinates}`);
                    this.performanceMetrics.successfulMarkers++;
                    return true;
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

        const results = await Promise.all(promises);
        const successfulMarkers = results.filter(result => result === true).length;
        
        const totalMarkers = galleries.length;
        const loadedMarkers = totalMarkers - this.markerQueue.length;
        this.updateMarkerProgress(loadedMarkers, totalMarkers);

        setTimeout(() => {
            this.processMarkerBatch();
        }, this.batchDelay);
    }

    getCoordinates(location, country) {
        const gallery = galleries.find(g => g.name === location && g.country === country);
        if (gallery && gallery.latitude && gallery.longitude) {
            return [gallery.latitude, gallery.longitude];
        }
    
        console.warn(`No coordinates found for ${location}, ${country}`);
        return null;
    }

    addMarker(gallery, coordinates) {
        const currentSize = this.calculateMarkerSize();
        const iconSize = [currentSize, currentSize];
        const iconAnchor = [currentSize / 2, currentSize / 2];
        
        const badgeSize = Math.max(20, Math.round(currentSize * 0.3));
        const badgeFontSize = Math.max(8, Math.round(badgeSize * 0.4));
        
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
        
        const popupContent = this.createPopupContent(gallery);
        
        const marker = L.marker(coordinates, { icon: icon })
            .addTo(this.map)
            .bindPopup(popupContent, {
                maxWidth: 280,
                className: 'gallery-popup',
                closeButton: true
            });
        
        marker.galleryData = gallery;
        this.markers.push(marker);
        
        marker.on('click', () => {
            const galleryId = gallery.galleryId || gallery.id;
            this.openGallery(galleryId);
        });
        
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
                <button onclick="app.galleryMap.openGallery('${gallery.galleryId || gallery.id}')" 
                            class="popup-button">
                        <i class="fas fa-external-link-alt"></i>
                    View Gallery
                </button>
                </div>
            </div>
        `;
    }

    openGallery(galleryId) {
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

// Add CSS for the no-results message
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

// Initialize application when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PhotoGalleryApp();
});

// Copy WeChat ID function
function copyWechat() {
    const wechatId = 'Magnetrician';
    
    // Create a temporary textarea element
    const textarea = document.createElement('textarea');
    textarea.value = wechatId;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    
    // Select and copy the text
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopySuccess();
        } else {
            // Fallback for modern browsers
            navigator.clipboard.writeText(wechatId).then(() => {
                showCopySuccess();
            }).catch(() => {
                showCopyError();
            });
        }
    } catch (err) {
        // Fallback for modern browsers
        navigator.clipboard.writeText(wechatId).then(() => {
            showCopySuccess();
        }).catch(() => {
            showCopyError();
        });
    }
    
    // Clean up
    document.body.removeChild(textarea);
}

function showCopySuccess() {
    // Create success message
    const message = document.createElement('div');
    message.className = 'copy-message copy-success';
    message.innerHTML = '<i class="fas fa-check"></i> Wechat ID copied';
    
    // 移动端适配的消息样式
    const isMobile = window.innerWidth <= 768;
    message.style.cssText = `
        position: fixed;
        top: ${isMobile ? '10px' : '20px'};
        ${isMobile ? 'left: 10px; right: 10px;' : 'right: 20px;'}
        background: #27ae60;
        color: white;
        padding: ${isMobile ? '10px 15px' : '12px 20px'};
        border-radius: 8px;
        font-size: ${isMobile ? '13px' : '14px'};
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
        text-align: center;
    `;
    
    document.body.appendChild(message);
    
    // Remove message after 3 seconds
    setTimeout(() => {
        message.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (message.parentNode) {
                document.body.removeChild(message);
            }
        }, 300);
    }, 3000);
}

function showCopyError() {
    // Create error message
    const message = document.createElement('div');
    message.className = 'copy-message copy-error';
    message.innerHTML = '<i class="fas fa-times"></i> 复制失败，请手动复制：Magnetrician';
    
    // 移动端适配的消息样式
    const isMobile = window.innerWidth <= 768;
    message.style.cssText = `
        position: fixed;
        top: ${isMobile ? '10px' : '20px'};
        ${isMobile ? 'left: 10px; right: 10px;' : 'right: 20px;'}
        background: #e74c3c;
        color: white;
        padding: ${isMobile ? '10px 15px' : '12px 20px'};
        border-radius: 8px;
        font-size: ${isMobile ? '13px' : '14px'};
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
        text-align: center;
    `;
    
    document.body.appendChild(message);
    
    // Remove message after 5 seconds
    setTimeout(() => {
        message.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (message.parentNode) {
                document.body.removeChild(message);
            }
        }, 300);
    }, 5000);
}

// Add CSS animations for copy messages
const copyMessageStyle = document.createElement('style');
copyMessageStyle.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    @media (max-width: 768px) {
        @keyframes slideIn {
            from {
                transform: translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateY(0);
                opacity: 1;
            }
            to {
                transform: translateY(-100%);
                opacity: 0;
            }
        }
    }
`;
document.head.appendChild(copyMessageStyle);

// Year Filter toggle function for mobile
function toggleYearFilter() {
    const filterControl = document.querySelector('.map-filter-control');
    const showFilterBtn = document.querySelector('.show-filter-btn');
    
    if (filterControl && showFilterBtn) {
        if (filterControl.style.display === 'none') {
            // Show filter
            filterControl.style.display = 'block';
            showFilterBtn.style.display = 'none';
        } else {
            // Hide filter
            filterControl.style.display = 'none';
            showFilterBtn.style.display = 'flex';
        }
    }
}