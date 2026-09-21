// Gallery data - will be loaded from API
let galleries = [];

// Main Application Class
class PhotoGalleryApp {
    constructor() {
        this.currentFilteredGalleries = [];
        this.galleryMap = null;
        this.currentDisplayCount = 10;
        this.isLoadingMore = false;
        
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
        await this.loadGalleriesFromAPI();
        
        this.currentFilteredGalleries = [...galleries];
        
        this.loadGalleries();
        this.setupFilters();
        this.setupNavigation();
        this.setupSmoothScrolling();
        this.setupSubscribeModal();
        
        if (galleries.length > 0) {
            this.initMap();
        }
        
        window.addEventListener('scroll', () => {
            this.updateActiveNavLink();
            this.handleHeaderScroll();
        });
        
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        document.addEventListener('dragstart', e => e.preventDefault());
        this.setupLoadMoreButton();
    }

    async loadGalleriesFromAPI() {
        try {
            const response = await fetch(`${API_BASE_URL}/galleries`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            galleries = sortBySortOrder(data.galleries || []);
            return true;
        } catch (error) {
            console.error('Error loading galleries from API:', error);
            galleries = [];
            return false;
        }
    }

    loadGalleries() {
        this.galleryGrid.innerHTML = '';
        this.currentDisplayCount = this.getInitialDisplayCount(); // Calculate initial display count based on screen size
        
        if (this.currentFilteredGalleries.length === 0) {
            this.galleryGrid.innerHTML = '<div class="no-results">No galleries found matching your criteria.</div>';
            this.galleryLoadMore.style.display = 'none';
            return;
        }
        
        this.displayGalleries();
        this.updateLoadMoreButton();
    }
    
    getInitialDisplayCount() {
        // Calculate display count based on screen width
        const screenWidth = window.innerWidth;
        if (screenWidth <= 768) {
            return 6; // Mobile: show 6 items (about 2 rows)
        } else if (screenWidth <= 1200) {
            return 8; // Medium screen: show 8 items
        } else {
            return 10; // Large screen: show 10 items (2 rows, 5 per row)
        }
    }
    
    getItemsPerLoad() {
        // Calculate load count based on screen width
        const screenWidth = window.innerWidth;
        if (screenWidth <= 768) {
            return 6; // Mobile: load 6 items per time
        } else if (screenWidth <= 1200) {
            return 8; // Medium screen: load 8 items per time
        } else {
            return 10; // Large screen: load 10 items per time
        }
    }
    
    displayGalleries() {
        // Clear existing content
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
        if (this.isLoadingMore) return;
        this.isLoadingMore = true;

        this.loadMoreBtn.classList.add('loading');
        this.loadMoreBtn.innerHTML = '<i class="fas fa-spinner"></i><span>Loading...</span>';
        
        const previousCount = this.currentDisplayCount;
        this.currentDisplayCount += this.getItemsPerLoad();
        
        const newGalleries = this.currentFilteredGalleries.slice(previousCount, this.currentDisplayCount);
        
        newGalleries.forEach((gallery, index) => {
            const actualIndex = previousCount + index;
            const galleryElement = this.createGalleryElement(gallery, actualIndex);
            this.galleryGrid.appendChild(galleryElement);
        });
        
        this.updateLoadMoreButton();
        this.loadMoreBtn.classList.remove('loading');
        this.loadMoreBtn.innerHTML = '<i class="fas fa-arrow-down"></i><span>Load More</span>';
        this.isLoadingMore = false;
    }
    
    setupLoadMoreButton() {
        if (this.loadMoreBtn) {
            this.loadMoreBtn.addEventListener('click', () => {
                this.loadMoreGalleries();
            });
        }
    }

    setupSubscribeModal() {
        const subscribeBtn = document.getElementById('subscribeBtn');
        const subscribeDropdown = document.getElementById('subscribeDropdown');
        const subscribeCancel = document.getElementById('subscribeCancel');
        const subscribeForm = document.getElementById('subscribeForm');
        const subscribeEmail = document.getElementById('subscribeEmail');

        // Toggle dropdown when subscribe button is clicked
        if (subscribeBtn) {
            subscribeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                subscribeDropdown.classList.toggle('active');
                if (subscribeDropdown.classList.contains('active')) {
                    subscribeEmail.focus();
                }
            });
        }

        // Close dropdown when cancel button is clicked
        if (subscribeCancel) {
            subscribeCancel.addEventListener('click', () => {
                subscribeDropdown.classList.remove('active');
                subscribeForm.reset();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!subscribeDropdown.contains(e.target) && !subscribeBtn.contains(e.target)) {
                subscribeDropdown.classList.remove('active');
                subscribeForm.reset();
            }
        });

        // Handle form submission
        if (subscribeForm) {
            subscribeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubscribeSubmit(subscribeEmail.value);
            });
        }

        // Close dropdown with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && subscribeDropdown.classList.contains('active')) {
                subscribeDropdown.classList.remove('active');
                subscribeForm.reset();
            }
        });
    }

    async handleSubscribeSubmit(email) {
        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showSubscribeMessage('Please enter a valid email address.', 'error');
            return;
        }

        // Show loading state
        this.showSubscribeMessage('Subscribing...', 'info');
        
        try {
            const response = await fetch(`${API_BASE_URL}/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showSubscribeMessage(data.message || 'Successfully subscribed!', 'success');
                
                // Close dropdown and reset form
                const subscribeDropdown = document.getElementById('subscribeDropdown');
                const subscribeForm = document.getElementById('subscribeForm');
                subscribeDropdown.classList.remove('active');
                subscribeForm.reset();
            } else {
                const errorMessage = data.error || data.message || `Server error (${response.status})`;
                this.showSubscribeMessage(errorMessage, 'error');
                console.error('Subscribe API error:', { status: response.status, data });
            }
        } catch (error) {
            console.error('Error subscribing:', error);
            this.showSubscribeMessage('Network error. Please check your connection and try again.', 'error');
        }
    }

    showSubscribeMessage(message, type) {
        // Remove any existing messages
        const existingMessage = document.querySelector('.subscribe-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `subscribe-message subscribe-${type}`;
        messageElement.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : 'exclamation-triangle'}"></i>
            <span>${message}</span>
        `;

        // Add message to dropdown container
        const subscribeContainer = document.querySelector('.subscribe-container');
        subscribeContainer.appendChild(messageElement);

        // Remove message after 5 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
            }
        }, 5000);
    }
    
    handleResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            const newInitialCount = this.getInitialDisplayCount();
            // Grow display count when viewport needs more items; never shrink after Load More
            if (this.currentDisplayCount < newInitialCount) {
                this.currentDisplayCount = newInitialCount;
                this.displayGalleries();
                this.updateLoadMoreButton();
            }
        }, 250);
    }

    createGalleryElement(gallery, index) {
        const article = document.createElement('article');
        article.className = 'gallery-item';
        article.setAttribute('data-index', index);
        
        const coverImage = escapeHtml(gallery.coverPhotoURL || 'images/homephoto.webp');
        const location = escapeHtml(gallery.continent || '');
        const year = escapeHtml(formatGalleryYears(gallery));
        const photoCount = gallery.photoCount || 0;
        const name = escapeHtml(gallery.name || '');
        
        article.innerHTML = `
            <img src="${coverImage}" alt="${name}" loading="lazy" onerror="this.src='images/homephoto.webp'">
            <div class="gallery-info">
                <h3 class="gallery-title">${name}</h3>
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
        this.yearFilter.innerHTML = '<option value="">All Years</option>';
        this.locationFilter.innerHTML = '<option value="">All Locations</option>';
        
        const years = collectYearsFromGalleries(galleries);
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            this.yearFilter.appendChild(option);
        });
        
        const locations = [...new Set(galleries.map(gallery => gallery.continent || gallery.country || 'Unknown'))].sort();
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            this.locationFilter.appendChild(option);
        });
        
        if (!this._filtersBound) {
            this.yearFilter.addEventListener('change', () => this.filterGalleries());
            this.locationFilter.addEventListener('change', () => this.filterGalleries());
            const clearFiltersBtn = document.getElementById('clearFilters');
            if (clearFiltersBtn) {
                clearFiltersBtn.addEventListener('click', () => this.clearFilters());
            }
            this._filtersBound = true;
        }
    }
    
    clearFilters() {
        this.yearFilter.value = '';
        this.locationFilter.value = '';
        this.currentFilteredGalleries = sortBySortOrder(galleries);
        this.loadGalleries();
    }

    filterGalleries() {
        const selectedYear = this.yearFilter.value;
        const selectedLocation = this.locationFilter.value;
        
        this.currentFilteredGalleries = galleries.filter(gallery => {
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
        
        this.currentFilteredGalleries = sortBySortOrder(this.currentFilteredGalleries);
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
        this.isInitialized = false;
        this.isLoadingMarkers = false;
        this.markerQueue = [];
        this.initRetries = 0;
        this.maxInitRetries = 10;
        
        this.selectedYears = new Set();
        this.allYears = [];
        this.yearCounts = {};
        
        this.batchSize = config.batchSize || 3;
        this.batchDelay = config.batchDelay || 100;
        
        this.markerSizeConfig = {
            minSize: 30,
            maxSize: 100,
            minZoom: 2,
            maxZoom: 18
        };
        
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
            if (this.isInitialized) return;

            if (!galleries || galleries.length === 0) {
                if (this.initRetries < this.maxInitRetries) {
                    this.initRetries += 1;
                    setTimeout(() => this.init(), 1000);
                }
                return;
            }
            
            this.performanceMetrics.mapInitStart = performance.now();
            this.performanceMetrics.totalMarkers = galleries.length;
            
            this.initMap();
            
            this.performanceMetrics.mapInitEnd = performance.now();
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
            this.updateMarkerSizes();
        });
        
        this.setupYearFilterWheelEvents();
    }

    initFilterControls() {
        this.collectYearData();
        this.generateYearOptions();
        this.bindFilterEvents();
    }
    
    collectYearData() {
        this.allYears = collectYearsFromGalleries(galleries);
        this.yearCounts = {};
        
        galleries.forEach(gallery => {
            if (gallery.years && Array.isArray(gallery.years) && gallery.years.length > 0) {
                gallery.years.forEach(year => {
                    const yearInt = parseInt(year, 10);
                    this.yearCounts[yearInt] = (this.yearCounts[yearInt] || 0) + 1;
                });
            } else if (gallery.createdAt) {
                const fallbackYear = new Date(gallery.createdAt).getFullYear();
                this.yearCounts[fallbackYear] = (this.yearCounts[fallbackYear] || 0) + 1;
            }
        });
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

        const stopMapScroll = (e) => {
            e.stopPropagation();
        };

        yearFilterContainer.addEventListener('wheel', (e) => {
            e.stopPropagation();
            const yearCheckboxes = yearFilterContainer.querySelector('.year-checkboxes');
            if (!yearCheckboxes) return;

            // Allow native scroll inside the checkbox list; only block map zoom
            const atTop = yearCheckboxes.scrollTop <= 0 && e.deltaY < 0;
            const atBottom = yearCheckboxes.scrollTop + yearCheckboxes.clientHeight >= yearCheckboxes.scrollHeight && e.deltaY > 0;
            if (!atTop && !atBottom) {
                e.preventDefault();
                yearCheckboxes.scrollTop += e.deltaY;
            } else {
                e.preventDefault();
            }
        }, { passive: false });

        yearFilterContainer.addEventListener('touchstart', stopMapScroll, { passive: true });
        yearFilterContainer.addEventListener('touchmove', stopMapScroll, { passive: true });
    }
    
    handleYearFilterChange() {
        this.selectedYears.clear();
        
        const checkboxes = document.querySelectorAll('#mapYearCheckboxes input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            this.selectedYears.add(parseInt(checkbox.value, 10));
        });
        
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
        const fallbackCover = 'images/homephoto.webp';
        
        this.markers.forEach((marker) => {
            const gallery = marker.galleryData;
            if (!gallery) return;
            
            const badgeSize = Math.max(16, Math.round(newSize * 0.3));
            const badgeFontSize = Math.max(8, Math.round(badgeSize * 0.4));
            const cover = escapeHtml(gallery.coverPhotoURL || fallbackCover);
            const name = escapeHtml(gallery.name || '');
            
            const newIcon = L.divIcon({
                className: 'gallery-map-marker',
                html: `
                    <div class="marker-container" style="width: ${newSize}px; height: ${newSize}px;">
                        <div class="marker-image" style="width: ${newSize}px; height: ${newSize}px;">
                            <img src="${cover}" 
                                 alt="${name}" 
                                 onerror="this.src='${fallbackCover}'">
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
            this.fitAllMarkers();
            this.initFilterControls();
            return;
        }

        const batch = this.markerQueue.splice(0, this.batchSize);

        const promises = batch.map(async (gallery) => {
            try {
                const coordinates = await this.getCoordinates(gallery.name, gallery.country);
                if (coordinates) {
                    this.addMarker(gallery, coordinates);
                    this.performanceMetrics.successfulMarkers++;
                    return true;
                }
                this.performanceMetrics.failedMarkers++;
                return false;
            } catch (error) {
                console.error(`Error getting coordinates for ${gallery.name}:`, error);
                this.performanceMetrics.failedMarkers++;
                return false;
            }
        });

        await Promise.all(promises);
        
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
        const fallbackCover = 'images/homephoto.webp';
        
        const badgeSize = Math.max(20, Math.round(currentSize * 0.3));
        const badgeFontSize = Math.max(8, Math.round(badgeSize * 0.4));
        const cover = escapeHtml(gallery.coverPhotoURL || fallbackCover);
        const name = escapeHtml(gallery.name || '');
        
        const icon = L.divIcon({
            className: 'gallery-map-marker',
            html: `
                <div class="marker-container" style="width: ${currentSize}px; height: ${currentSize}px;">
                    <div class="marker-image" style="width: ${currentSize}px; height: ${currentSize}px;">
                        <img src="${cover}" 
                     alt="${name}" 
                     onerror="this.src='${fallbackCover}'">
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
            marker.getElement()?.classList.add('marker-hover');
        });
        
        marker.on('mouseout', () => {
            marker.getElement()?.classList.remove('marker-hover');
        });
    }

    createPopupContent(gallery) {
        const coverImage = escapeHtml(gallery.coverPhotoURL || 'images/homephoto.webp');
        const name = escapeHtml(gallery.name || '');
        const continent = escapeHtml(gallery.continent || '');
        const country = escapeHtml(gallery.country || '');
        const galleryId = escapeHtml(gallery.galleryId || gallery.id || '');
        
        return `
            <div class="gallery-popup">
                <div class="popup-header">
                <img src="${coverImage}" alt="${name}" onerror="this.src='images/homephoto.webp'">
                    <div class="popup-overlay">
                <h3>${name}</h3>
                    </div>
                </div>
                <div class="popup-content">
                    <div class="popup-info">
                        <p class="location"><i class="fas fa-map-marker-alt"></i> ${continent} > ${country}</p>
                        <p class="photos"><i class="fas fa-images"></i> ${gallery.photoCount || 0} photos</p>
                    </div>
                <button onclick="app.galleryMap.openGallery('${galleryId}')" 
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

// Initialize application when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PhotoGalleryApp();
});

function copyWechat() {
    const wechatId = 'Magnetrician';

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(wechatId).then(() => {
            showCopyToast('Wechat ID copied', 'success');
        }).catch(() => {
            showCopyToast('Copy failed, please copy manually: Magnetrician', 'error');
        });
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = wechatId;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showCopyToast('Wechat ID copied', 'success');
    } catch (_) {
        showCopyToast('Copy failed, please copy manually: Magnetrician', 'error');
    }
    document.body.removeChild(textarea);
}

function toggleYearFilter() {
    const filterControl = document.querySelector('.map-filter-control');
    const showFilterBtn = document.querySelector('.show-filter-btn');
    
    if (filterControl && showFilterBtn) {
        if (filterControl.style.display === 'none' || filterControl.style.display === '') {
            filterControl.style.display = 'block';
            showFilterBtn.style.display = 'none';
            setTimeout(() => {
                document.addEventListener('click', closeFilterOnClickOutside);
            }, 100);
        } else {
            hideYearFilter();
        }
    }
}

function hideYearFilter() {
    const filterControl = document.querySelector('.map-filter-control');
    const showFilterBtn = document.querySelector('.show-filter-btn');
    
    if (filterControl) filterControl.style.display = 'none';
    if (showFilterBtn) showFilterBtn.style.display = 'flex';
    document.removeEventListener('click', closeFilterOnClickOutside);
}

function closeFilterOnClickOutside(event) {
    const filterControl = document.querySelector('.map-filter-control');
    const showFilterBtn = document.querySelector('.show-filter-btn');
    
    if (filterControl && showFilterBtn && 
        !filterControl.contains(event.target) && 
        !showFilterBtn.contains(event.target)) {
        hideYearFilter();
    }
}