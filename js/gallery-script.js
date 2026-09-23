// Main Gallery Application Class
class GalleryPageApp {
    constructor() {
        this.photos = [];
        this.currentGalleryPhotos = [];
        this.currentPhotoIndexValue = 0;
        this.deviceId = null;
        this.panoramaObserver = null;
        
        // DOM Elements
        this.galleryTitle = document.getElementById('galleryTitle');
        this.galleryLocation = document.getElementById('galleryLocation');
        this.galleryYear = document.getElementById('galleryYear');
        this.photoCount = document.getElementById('photoCount');
        this.galleryDescription = document.getElementById('galleryDescription');
        this.photosGrid = document.getElementById('photosGrid');
        this.navToggle = document.getElementById('navToggle');
        this.navMenu = document.getElementById('navMenu');
        
        // Full-screen viewer elements
        this.fullscreenViewer = document.getElementById('fullscreenViewer');
        this.fullscreenImage = document.getElementById('fullscreenImage');
        this.fullscreenImageContainer = document.querySelector('.fullscreen-image-container');
        this.prevPhotoBtn = document.getElementById('prevPhotoBtn');
        this.nextPhotoBtn = document.getElementById('nextPhotoBtn');
        this.closeViewerBtn = document.getElementById('closeViewerBtn');
        this.currentPhotoIndex = document.getElementById('currentPhotoIndex');
        this.totalPhotos = document.getElementById('totalPhotos');
        this.zoom = { scale: 1, x: 0, y: 0 };
        this._zoomPointers = new Map();
        this._pinchStart = null;
        this._isPanning = false;
        this._panLast = null;
        this._suppressViewerClick = false;
        
        // Panorama elements
        this.panoramaSection = document.getElementById('panoramaSection');
        this.panoramaContainer = document.getElementById('panoramaContainer');
        this.panoramaViewer = null;
        this.currentPanoramaIndex = 0;
        this.panoramaURLs = [];
        this.galleryId = null;
        this._openSharedPanorama = false;
        this._panoIdleTimer = null;
        this._panoControlsTimer = null;
        this._panoUserInteracted = false;
        this._panoIdleBound = false;
        this._panoChromeBound = false;
        this._panoPointerDown = null;
        
        this.init();
    }

    async init() {
        this.setupNavigation();
        this.setupFullscreenViewer();
        this.initDeviceId();
        await this.loadGallery();
    }

    getSortedPhotos() {
        return sortBySortOrder(this.currentGalleryPhotos);
    }

    async loadPhotosFromAPI(galleryId) {
        try {
            const response = await fetch(`${API_BASE_URL}/galleries?id=${encodeURIComponent(galleryId)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const galleryData = await response.json();
            this.photos = galleryData.photos || [];
            return galleryData;
        } catch (error) {
            console.error('Error loading photos from API:', error);
            return null;
        }
    }

    async getGalleryData() {
        const galleryId = new URLSearchParams(window.location.search).get('gallery') || null;
        
        if (!galleryId) {
            return { error: t('noGalleryId') };
        }

        const galleryData = await this.loadPhotosFromAPI(galleryId);
        if (!galleryData) {
            return { error: t('galleryLoadFailed') };
        }

        return {
            id: galleryData.galleryId || galleryData.id,
            name: galleryData.name,
            location: [tPlace(galleryData.continent || ''), galleryData.country || ''].filter(Boolean).join(', '),
            year: formatGalleryYears(galleryData),
            photos: galleryData.photos || [],
            description: galleryData.description || '',
            panoramaURL: galleryData.panoramaURL || [],
            continent: galleryData.continent || '',
            country: galleryData.country || '',
        };
    }

    async loadGallery() {
        try {
            const gallery = await this.getGalleryData();

            if (gallery.error) {
                document.title = 'Light&Lens - Gallery Not Found';
                if (this.galleryTitle) this.galleryTitle.textContent = t('galleryNotFound');
                if (this.galleryDescription) this.galleryDescription.textContent = gallery.error;
                if (this.photosGrid) {
                    this.photosGrid.innerHTML = `<div class="no-photos">${escapeHtml(gallery.error)}</div>`;
                }
                if (this.panoramaSection) this.panoramaSection.style.display = 'none';
                return;
            }
            
            document.title = `Light&Lens - ${gallery.name}`;
            this.galleryId = gallery.id || null;
            this.galleryTitle.textContent = gallery.name;
            this.galleryLocation.textContent = gallery.location;
            this.galleryYear.textContent = gallery.year;
            this.photoCount.textContent = gallery.photos.length;
            this.galleryDescription.textContent = gallery.description;
            this.currentGalleryPhotos = gallery.photos;
            this.placeContinent = gallery.continent || '';
            this.placeCountry = gallery.country || '';
            this.loadPhotosGrid(gallery.photos);
            this.loadPanorama(gallery);
        } catch (error) {
            console.error('Error loading gallery:', error);
            if (this.galleryTitle) this.galleryTitle.textContent = t('errorLoadingGallery');
            if (this.galleryDescription) this.galleryDescription.textContent = t('galleryLoadError');
        }
    }

    loadPhotosGrid(photos) {
        this.photosGrid.innerHTML = '';
        
        if (photos.length === 0) {
            this.photosGrid.innerHTML = `<div class="no-photos">${t('noPhotos')}</div>`;
            return;
        }
        
        const sortedPhotos = sortBySortOrder(photos);
        sortedPhotos.forEach((photo, index) => {
            const photoElement = this.createPhotoElement(photo, index);
            this.photosGrid.appendChild(photoElement);
        });
    }

    createPhotoElement(photo, index) {
        const photoElement = document.createElement('div');
        photoElement.className = 'photo-item';
        photoElement.setAttribute('data-index', index);
        
        const photoId = photo.photoId;
        // Star rating disabled — keep code for possible restore
        // const currentRating = this.getPhotoRatingFromLocal(photoId);
        const thumb = escapeHtml(photo.thumbnail || photo.image || '');
        const alt = escapeHtml(photo.title || photo.name || 'Photo');
        
        photoElement.innerHTML = `
            <img src="${thumb}" alt="${alt}" loading="lazy">
            <div class="photo-overlay">
                <div class="photo-info">
                </div>
            </div>
            <!--
            <div class="photo-rating">
                <div class="star-rating" data-photo-id="${escapeHtml(photoId)}">
                </div>
            </div>
            -->
        `;
        
        // const starRating = photoElement.querySelector('.star-rating');
        // if (starRating) {
        //     this.createStarsWithEvents(starRating, photoId, currentRating);
        // }
        
        const img = photoElement.querySelector('img');
        if (img) {
            img.addEventListener('click', () => {
                this.openFullscreenViewer(index);
            });
        }
        
        return photoElement;
    }

    createStarsWithEvents(starRatingElement, photoId, currentRating) {
        starRatingElement.innerHTML = '';
        
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.className = i <= currentRating ? 'star filled' : 'star';
            star.setAttribute('data-rating', i);
            star.textContent = '★';
            
            star.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                const currentRating = this.getPhotoRatingFromLocal(photoId);
                let newRating = i;
                
                if (currentRating === i) {
                    newRating = 0;
                    console.log('Star clicked! Photo ID:', photoId, 'Cancelling rating (was:', currentRating, ')');
                } else {
                    console.log('Star clicked! Photo ID:', photoId, 'New rating:', newRating);
                }
                
                try {
                    await this.ratePhoto(photoId, newRating);
                    this.updateAllPhotoRatings(photoId, newRating);
                    
                    if (newRating === 0) {
                        this.showRatingMessage(t('ratingCancelled'), 'success');
                    } else {
                        this.showRatingMessage(t('ratingSaved'), 'success');
                    }
                } catch (error) {
                    console.error('Failed to save rating:', error);
                    this.showRatingMessage(t('ratingFailed'), 'error');
                }
            });
            
            star.addEventListener('mouseenter', () => {
                const stars = starRatingElement.querySelectorAll('.star');
                this.highlightStars(stars, i);
            });
            
            star.addEventListener('mouseleave', () => {
                const stars = starRatingElement.querySelectorAll('.star');
                const currentRatingFromStorage = this.getPhotoRatingFromLocal(photoId);
                this.updateStarDisplay(stars, currentRatingFromStorage);
            });
            
            starRatingElement.appendChild(star);
        }
    }

    setupNavigation() {
        this.navToggle.addEventListener('click', () => {
            this.navMenu.classList.toggle('active');
            this.navToggle.classList.toggle('active');
        });
        
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                this.navMenu.classList.remove('active');
                this.navToggle.classList.remove('active');
            });
        });
        
        document.addEventListener('click', (e) => {
            if (!this.navToggle.contains(e.target) && !this.navMenu.contains(e.target)) {
                this.navMenu.classList.remove('active');
                this.navToggle.classList.remove('active');
            }
        });
    }

    // Full-screen viewer methods
    openFullscreenViewer(index) {
        const sortedPhotos = this.getSortedPhotos();
        
        if (index < 0 || index >= sortedPhotos.length) {
            return;
        }
        
        this.currentPhotoIndexValue = index;
        const photo = sortedPhotos[index];
        
        if (!this.fullscreenImage) return;
        
        this.resetZoom();
        this.fullscreenImage.src = photo.image || photo.thumbnail;
        this.fullscreenImage.alt = photo.title || photo.name || 'Photo';
        
        this.currentPhotoIndex.textContent = index + 1;
        this.totalPhotos.textContent = sortedPhotos.length;
        
        // Star rating disabled — keep code for possible restore
        // const fullscreenRating = document.getElementById('fullscreenStarRating');
        // if (fullscreenRating) {
        //     this.setupFullscreenStarRating(fullscreenRating, photo.photoId);
        // }
        
        this.fullscreenViewer.style.display = 'flex';
        this.fullscreenViewer.classList.add('active');
        document.body.classList.add('fullscreen-active');
        document.body.style.overflow = 'hidden';
        
        const header = document.querySelector('.header');
        if (header) header.style.display = 'none';
    }

    closeFullscreenViewer() {
        this.resetZoom();
        this.fullscreenViewer.style.display = 'none';
        this.fullscreenViewer.classList.remove('active');
        document.body.classList.remove('fullscreen-active');
        document.body.style.overflow = 'auto';
        
        const header = document.querySelector('.header');
        if (header) header.style.display = 'block';
    }

    showPreviousPhoto() {
        const sortedPhotos = this.getSortedPhotos();
        const newIndex = this.currentPhotoIndexValue > 0 ? this.currentPhotoIndexValue - 1 : sortedPhotos.length - 1;
        this.openFullscreenViewer(newIndex);
    }

    showNextPhoto() {
        const sortedPhotos = this.getSortedPhotos();
        const newIndex = this.currentPhotoIndexValue < sortedPhotos.length - 1 ? this.currentPhotoIndexValue + 1 : 0;
        this.openFullscreenViewer(newIndex);
    }

    setupFullscreenStarRating(starRatingElement, photoId) {
        const currentRating = this.getPhotoRatingFromLocal(photoId);
        this.createStarsWithEvents(starRatingElement, photoId, currentRating);
    }

    setupFullscreenViewer() {
        this.prevPhotoBtn.addEventListener('click', () => this.showPreviousPhoto());
        this.nextPhotoBtn.addEventListener('click', () => this.showNextPhoto());
        this.closeViewerBtn.addEventListener('click', () => this.closeFullscreenViewer());
        
        document.addEventListener('keydown', (e) => {
            if (this.fullscreenViewer.style.display === 'flex') {
                switch (e.key) {
                    case 'ArrowLeft':
                        this.showPreviousPhoto();
                        break;
                    case 'ArrowRight':
                        this.showNextPhoto();
                        break;
                    case 'Escape':
                        this.closeFullscreenViewer();
                        break;
                }
            }
        });
        
        this.fullscreenViewer.addEventListener('click', (e) => {
            if (this._suppressViewerClick) {
                this._suppressViewerClick = false;
                return;
            }
            if (e.target === this.fullscreenViewer || e.target === this.fullscreenImageContainer) {
                if (this.zoom.scale > 1.01) {
                    this.resetZoom();
                    return;
                }
                this.closeFullscreenViewer();
            }
        });

        this.setupFullscreenZoom();
    }

    setupFullscreenZoom() {
        const container = this.fullscreenImageContainer;
        const img = this.fullscreenImage;
        if (!container || !img) return;

        img.draggable = false;

        container.addEventListener('wheel', (e) => {
            if (!this.isFullscreenOpen()) return;
            e.preventDefault();
            this._suppressViewerClick = true;
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            this.zoomAtPoint(e.clientX, e.clientY, this.zoom.scale * factor);
        }, { passive: false });

        container.addEventListener('pointerdown', (e) => {
            if (!this.isFullscreenOpen() || e.button !== 0) return;
            if (e.target.closest('button') || e.target.closest('.star-rating') || e.target.closest('.fullscreen-counter')) return;

            container.setPointerCapture(e.pointerId);
            this._zoomPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (this._zoomPointers.size === 2) {
                this._isPanning = false;
                this._panLast = null;
                const points = [...this._zoomPointers.values()];
                this._pinchStart = {
                    distance: this.pointerDistance(points[0], points[1]),
                    scale: this.zoom.scale,
                    center: this.pointerMidpoint(points[0], points[1]),
                    x: this.zoom.x,
                    y: this.zoom.y
                };
            } else if (this._zoomPointers.size === 1 && this.zoom.scale > 1.01) {
                this._isPanning = true;
                this._panLast = { x: e.clientX, y: e.clientY };
                img.classList.add('dragging');
            }
        });

        container.addEventListener('pointermove', (e) => {
            if (!this._zoomPointers.has(e.pointerId)) return;
            this._zoomPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (this._zoomPointers.size === 2 && this._pinchStart) {
                e.preventDefault();
                this._suppressViewerClick = true;
                this.updatePinchZoom();
            } else if (this._isPanning && this._panLast && this.zoom.scale > 1.01) {
                e.preventDefault();
                const dx = e.clientX - this._panLast.x;
                const dy = e.clientY - this._panLast.y;
                if (Math.abs(dx) > 1 || Math.abs(dy) > 1) this._suppressViewerClick = true;
                this._panLast = { x: e.clientX, y: e.clientY };
                this.zoom.x += dx;
                this.zoom.y += dy;
                this.clampPan();
                this.applyZoomTransform();
            }
        }, { passive: false });

        const endPointer = (e) => {
            if (!this._zoomPointers.has(e.pointerId)) return;
            this._zoomPointers.delete(e.pointerId);
            img.classList.remove('dragging');

            if (this._zoomPointers.size < 2) {
                this._pinchStart = null;
            }
            if (this._zoomPointers.size === 0) {
                this._isPanning = false;
                this._panLast = null;
                if (this.zoom.scale < 1.05) this.resetZoom();
            } else if (this._zoomPointers.size === 1 && this.zoom.scale > 1.01) {
                const remaining = [...this._zoomPointers.values()][0];
                this._isPanning = true;
                this._panLast = { x: remaining.x, y: remaining.y };
            }
        };

        container.addEventListener('pointerup', endPointer);
        container.addEventListener('pointercancel', endPointer);
    }

    isFullscreenOpen() {
        return this.fullscreenViewer && this.fullscreenViewer.style.display === 'flex';
    }

    resetZoom() {
        this.zoom = { scale: 1, x: 0, y: 0 };
        this._zoomPointers.clear();
        this._pinchStart = null;
        this._isPanning = false;
        this._panLast = null;
        this.applyZoomTransform();
    }

    applyZoomTransform() {
        if (!this.fullscreenImage) return;
        const { scale, x, y } = this.zoom;
        this.fullscreenImage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        this.fullscreenImage.classList.toggle('zoomed', scale > 1.01);
        if (scale <= 1.01) this.fullscreenImage.classList.remove('dragging');
    }

    updatePinchZoom() {
        if (!this._pinchStart || this._zoomPointers.size < 2) return;

        const container = this.fullscreenImageContainer;
        const rect = container.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const points = [...this._zoomPointers.values()];
        const distance = this.pointerDistance(points[0], points[1]);
        const center = this.pointerMidpoint(points[0], points[1]);
        if (this._pinchStart.distance <= 0) return;

        const nextScale = Math.min(8, Math.max(1, this._pinchStart.scale * (distance / this._pinchStart.distance)));
        if (nextScale === 1) {
            this.resetZoom();
            return;
        }

        const start = this._pinchStart;
        const ratio = nextScale / start.scale;
        const startOx = start.center.x - cx;
        const startOy = start.center.y - cy;
        this.zoom.scale = nextScale;
        this.zoom.x = startOx - (startOx - start.x) * ratio + (center.x - start.center.x);
        this.zoom.y = startOy - (startOy - start.y) * ratio + (center.y - start.center.y);
        this.clampPan();
        this.applyZoomTransform();
    }

    zoomAtPoint(clientX, clientY, nextScale) {
        const container = this.fullscreenImageContainer;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const { scale, x, y } = this.zoom;

        const clamped = Math.min(8, Math.max(1, nextScale));
        if (clamped === 1) {
            this.resetZoom();
            return;
        }

        const ox = clientX - cx;
        const oy = clientY - cy;
        const ratio = clamped / scale;
        this.zoom.scale = clamped;
        this.zoom.x = ox - (ox - x) * ratio;
        this.zoom.y = oy - (oy - y) * ratio;
        this.clampPan();
        this.applyZoomTransform();
    }

    clampPan() {
        if (this.zoom.scale <= 1) {
            this.zoom.x = 0;
            this.zoom.y = 0;
            return;
        }
        const container = this.fullscreenImageContainer;
        const img = this.fullscreenImage;
        if (!container || !img) return;

        const maxX = (container.clientWidth * (this.zoom.scale - 1)) / 2 + img.clientWidth * 0.25;
        const maxY = (container.clientHeight * (this.zoom.scale - 1)) / 2 + img.clientHeight * 0.25;
        this.zoom.x = Math.min(maxX, Math.max(-maxX, this.zoom.x));
        this.zoom.y = Math.min(maxY, Math.max(-maxY, this.zoom.y));
    }

    pointerDistance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    pointerMidpoint(a, b) {
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    updateAllPhotoRatings(photoId, rating) {
        const galleryRatings = document.querySelectorAll(`.star-rating[data-photo-id="${photoId}"]`);
        galleryRatings.forEach(ratingElement => {
            const stars = ratingElement.querySelectorAll('.star');
            this.updateStarDisplay(stars, rating);
        });
        
        const fullscreenRating = document.getElementById('fullscreenStarRating');
        if (fullscreenRating) {
            const sortedPhotos = this.getSortedPhotos();
            const currentPhoto = sortedPhotos[this.currentPhotoIndexValue];
            if (currentPhoto && currentPhoto.photoId === photoId) {
                const stars = fullscreenRating.querySelectorAll('.star');
                this.updateStarDisplay(stars, rating);
            }
        }
        
        this.setPhotoRatingInLocal(photoId, rating);
    }

    // Device ID management
    initDeviceId() {
        this.deviceId = this.getOrCreateDeviceId();
        console.log('Device ID initialized:', this.deviceId);
        
        setTimeout(() => {
            const cookieDeviceId = this.getCookie('deviceId');
            const localStorageDeviceId = localStorage.getItem('deviceId');
            
            if (cookieDeviceId !== this.deviceId || localStorageDeviceId !== this.deviceId) {
                console.warn('DeviceId mismatch detected! Attempting to fix...');
                this.setCookie('deviceId', this.deviceId, 365 * 24 * 60 * 60);
                localStorage.setItem('deviceId', this.deviceId);
            }
        }, 1000);
    }

    getOrCreateDeviceId() {
        let deviceId = this.getCookie('deviceId');
        
        if (!deviceId) {
            deviceId = localStorage.getItem('deviceId');
        }
        
        if (!deviceId) {
            deviceId = 'device_' + this.generateUUID();
            this.setCookie('deviceId', deviceId, 365 * 24 * 60 * 60);
            localStorage.setItem('deviceId', deviceId);
        } else if (!this.getCookie('deviceId')) {
            this.setCookie('deviceId', deviceId, 365 * 24 * 60 * 60);
        }
        
        return deviceId;
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    setCookie(name, value, seconds) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (seconds * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    }

    getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) {
                return c.substring(nameEQ.length, c.length);
            }
        }
        return null;
    }

    // Rating system methods
    async ratePhoto(photoId, rating) {
        try {
            const response = await fetch(`${API_BASE_URL}/galleries?action=rate_photo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    photoId: photoId,
                    deviceId: this.deviceId,
                    rating: rating
                })
            });

            const result = await response.json();
            if (response.ok) {
                return result;
            }
            throw new Error(result.error || 'Failed to rate photo');
        } catch (error) {
            console.error('Error rating photo:', error);
            throw error;
        }
    }

    async getPhotoRatingStats(photoId) {
        try {
            const response = await fetch(`${API_BASE_URL}/galleries?action=get_photo_rating&photoId=${encodeURIComponent(photoId)}&deviceId=${encodeURIComponent(this.deviceId)}`);
            const result = await response.json();
            
            if (response.ok) {
                return result;
            }
            throw new Error(result.error || 'Failed to get photo rating');
        } catch (error) {
            console.error('Error getting photo rating:', error);
            throw error;
        }
    }

    async loadPhotoRating(photoId) {
        try {
            const ratingData = await this.getPhotoRatingStats(photoId);
            this.displayRating(photoId, ratingData);
        } catch (error) {
            console.error('Error loading photo rating:', error);
            const localRating = this.getPhotoRatingFromLocal(photoId);
            this.displayRating(photoId, {
                averageRating: 0,
                totalRatings: 0,
                userRating: localRating
            });
        }
    }

    displayRating(photoId, ratingData) {
        const ratingElements = document.querySelectorAll(`.star-rating[data-photo-id="${photoId}"]`);
        
        ratingElements.forEach(ratingElement => {
            const stars = ratingElement.querySelectorAll('.star');
            this.updateStarDisplay(stars, ratingData.userRating || 0);
        });
    }

    highlightStars(stars, rating) {
        if (!stars || stars.length === 0) return;
        
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('filled');
                star.classList.add('hovered');
            } else {
                star.classList.remove('filled');
                star.classList.remove('hovered');
            }
        });
    }

    updateStarDisplay(stars, rating) {
        if (!stars || stars.length === 0) return;
        
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('filled');
                star.classList.remove('hovered');
            } else {
                star.classList.remove('filled');
                star.classList.remove('hovered');
            }
        });
    }

    showRatingMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `rating-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            border-radius: 5px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            ${type === 'success' ? 'background-color: #4CAF50;' : 'background-color: #f44336;'}
        `;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    }

    getPhotoRatingFromLocal(photoId) {
        const ratings = JSON.parse(localStorage.getItem('photoRatings') || '{}');
        return ratings[photoId] || 0;
    }

    setPhotoRatingInLocal(photoId, rating) {
        const ratings = JSON.parse(localStorage.getItem('photoRatings') || '{}');
        ratings[photoId] = rating;
        localStorage.setItem('photoRatings', JSON.stringify(ratings));
    }

    // ==================== PANORAMA METHODS ====================
    
    loadPanorama(gallery) {
        if (!gallery.panoramaURL || !Array.isArray(gallery.panoramaURL) || gallery.panoramaURL.length === 0) {
            this.panoramaSection.style.display = 'none';
            return;
        }
        
        this.panoramaURLs = gallery.panoramaURL;
        const shareIndex = this.getSharedPanoramaIndex();
        this._openSharedPanorama = shareIndex !== null;
        this.currentPanoramaIndex = shareIndex !== null ? shareIndex : 0;
        this.panoramaSection.style.display = 'block';
        this.initializePanoramaViewer(this.panoramaURLs[this.currentPanoramaIndex]);

        if (this._openSharedPanorama) {
            requestAnimationFrame(() => {
                this.enterPanoramaFullscreen({ skipSystemFullscreen: true });
                this.syncPanoramaShareUrl();
            });
        }
    }

    getSharedPanoramaIndex() {
        const raw = new URLSearchParams(window.location.search).get('pano');
        if (raw === null || raw === '') return null;
        const n = parseInt(raw, 10);
        if (Number.isNaN(n) || n < 1 || n > this.panoramaURLs.length) return null;
        return n - 1;
    }

    getPanoramaShareUrl(index = this.currentPanoramaIndex) {
        const url = new URL(window.location.href);
        if (this.galleryId) url.searchParams.set('gallery', this.galleryId);
        url.searchParams.set('pano', String(index + 1));
        return url.toString();
    }

    syncPanoramaShareUrl() {
        if (!this.galleryId || !this.panoramaURLs.length) return;
        const params = new URLSearchParams(window.location.search);
        const inFullscreen = this.panoramaContainer && this.panoramaContainer.classList.contains('fullscreen');
        if (!this._openSharedPanorama && !params.has('pano') && !inFullscreen) return;
        const url = this.getPanoramaShareUrl();
        if (url !== window.location.href) {
            history.replaceState(null, '', url);
        }
    }

    async copyPanoramaShareLink() {
        const link = this.getPanoramaShareUrl();
        let ok = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            ok = await navigator.clipboard.writeText(link).then(() => true).catch(() => false);
        }
        if (!ok) {
            const input = document.createElement('input');
            input.value = link;
            input.setAttribute('readonly', '');
            input.style.cssText = 'position:fixed;left:-9999px;top:0;';
            document.body.appendChild(input);
            input.select();
            ok = document.execCommand('copy');
            document.body.removeChild(input);
        }
        this.showRatingMessage(t(ok ? 'shareCopied' : 'shareFailed'), ok ? 'success' : 'error');
    }
    
    initializePanoramaViewer(panoramaUrl) {
        try {
            this.teardownPanoramaIdleWatch();
            this.clearPanoramaControlsTimer();

            if (this.panoramaViewer) {
                this.panoramaViewer.destroy();
                this.panoramaViewer = null;
            }
            if (this.panoramaObserver) {
                this.panoramaObserver.disconnect();
                this.panoramaObserver = null;
            }
            
            this.panoramaContainer.innerHTML = '';
            this.panoramaContainer.classList.remove('controls-hidden');
            
            if (this.panoramaURLs.length > 1) {
                const counter = document.createElement('div');
                counter.className = 'panorama-counter';
                counter.textContent = `${this.currentPanoramaIndex + 1} / ${this.panoramaURLs.length}`;
                counter.style.cssText = `
                    position: absolute;
                    bottom: 5px;
                    right: 5px;
                    z-index: 1000;
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    pointer-events: none;
                `;
                this.panoramaContainer.appendChild(counter);
                
                const prevBtn = document.createElement('button');
                prevBtn.className = 'panorama-nav-btn panorama-nav-prev';
                prevBtn.type = 'button';
                prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                prevBtn.onclick = () => this.showPreviousPanorama();
                this.panoramaContainer.appendChild(prevBtn);
                
                const nextBtn = document.createElement('button');
                nextBtn.className = 'panorama-nav-btn panorama-nav-next';
                nextBtn.type = 'button';
                nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                nextBtn.onclick = () => this.showNextPanorama();
                this.panoramaContainer.appendChild(nextBtn);
                
                this.panoramaCounter = counter;
            }
            
            const panoramaDiv = document.createElement('div');
            panoramaDiv.id = 'panorama-viewer-' + Date.now();
            panoramaDiv.style.width = '100%';
            panoramaDiv.style.height = '100%';
            this.panoramaContainer.appendChild(panoramaDiv);
            
            this.panoramaViewer = pannellum.viewer(panoramaDiv, {
                "type": "equirectangular",
                "panorama": panoramaUrl,
                "autoLoad": true,
                "autoRotate": -2,
                "yaw": 0,
                "pitch": 0,
                "hfov": 100,
                "hotSpotDebug": false,
                "mouseZoom": true,
                "showControls": false,
                "showFullscreenCtrl": false,
                "showZoomCtrl": false,
                "keyboardZoom": false,
                "compass": false,
                "draggable": true
            });
            
            this.hideUnwantedButtons(panoramaDiv);
            this.addCustomFullscreenButton(this.panoramaContainer);
            this.addPanoramaShareButton(this.panoramaContainer);
            this.setupPanoramaIdleWatch();
            this.setupPanoramaChromeToggle();

            if (this.panoramaContainer.classList.contains('fullscreen')) {
                const fullscreenBtn = this.panoramaContainer.querySelector('.custom-fullscreen-btn');
                if (fullscreenBtn) {
                    fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
                    fullscreenBtn.title = t('exitFullscreen');
                }
                this.showPanoramaControls(true);
            }
            
            this.panoramaObserver = new MutationObserver(() => {
                this.hideUnwantedButtons(panoramaDiv);
            });
            this.panoramaObserver.observe(panoramaDiv, {
                childList: true,
                subtree: true
            });
            
            this.panoramaViewer.on('load', () => {
                this.hideUnwantedButtons(panoramaDiv);
            });
            
            this.panoramaViewer.on('error', (error) => {
                console.error('Panorama loading error:', error);
                this.panoramaContainer.innerHTML = `
                    <div class="panorama-loading">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${t('panoramaFailed')}</p>
                    </div>
                `;
            });
        } catch (error) {
            console.error('Error initializing panorama viewer:', error);
            this.panoramaContainer.innerHTML = `
                <div class="panorama-loading">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${t('panoramaFailed')}</p>
                </div>
            `;
        }
    }

    setupPanoramaIdleWatch() {
        this.teardownPanoramaIdleWatch();
        if (!this.panoramaContainer) return;

        this._panoUserInteracted = false;
        this._panoIdleOnActivity = () => {
            this._panoUserInteracted = true;
            this.schedulePanoramaIdleReset();
        };

        const types = ['pointerdown', 'wheel', 'touchstart'];
        types.forEach(type => {
            this.panoramaContainer.addEventListener(type, this._panoIdleOnActivity, { passive: true });
        });
        this._panoIdleBound = true;
    }

    teardownPanoramaIdleWatch() {
        this.clearPanoramaIdleTimer();
        if (this._panoIdleBound && this.panoramaContainer && this._panoIdleOnActivity) {
            ['pointerdown', 'wheel', 'touchstart'].forEach(type => {
                this.panoramaContainer.removeEventListener(type, this._panoIdleOnActivity);
            });
        }
        this._panoIdleBound = false;
        this._panoIdleOnActivity = null;
        this._panoUserInteracted = false;
    }

    clearPanoramaIdleTimer() {
        if (this._panoIdleTimer) {
            clearTimeout(this._panoIdleTimer);
            this._panoIdleTimer = null;
        }
    }

    schedulePanoramaIdleReset() {
        this.clearPanoramaIdleTimer();
        this._panoIdleTimer = setTimeout(() => {
            this.resetPanoramaToCenterAndRotate();
        }, 5000);
    }

    resetPanoramaToCenterAndRotate() {
        const viewer = this.panoramaViewer;
        if (!viewer || !this._panoUserInteracted) return;

        this._panoUserInteracted = false;
        this.clearPanoramaIdleTimer();

        if (typeof viewer.stopAutoRotate === 'function') {
            viewer.stopAutoRotate();
        }

        const resume = () => {
            if (this.panoramaViewer !== viewer) return;
            if (typeof viewer.startAutoRotate === 'function') {
                viewer.startAutoRotate(-2, 0);
            }
        };

        if (typeof viewer.lookAt === 'function') {
            viewer.lookAt(0, 0, 100, 1000, resume);
        } else {
            if (typeof viewer.setPitch === 'function') viewer.setPitch(0, 1000);
            if (typeof viewer.setYaw === 'function') viewer.setYaw(0, 1000);
            if (typeof viewer.setHfov === 'function') viewer.setHfov(100, 1000);
            setTimeout(resume, 1000);
        }
    }

    setupPanoramaChromeToggle() {
        if (this._panoChromeBound || !this.panoramaContainer) return;

        this._onPanoChromePointerDown = (e) => {
            if (!this.panoramaContainer.classList.contains('fullscreen')) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (!this.panoramaContainer.classList.contains('controls-hidden')) {
                this.showPanoramaControls(true);
            }
            this._panoPointerDown = {
                x: e.clientX,
                y: e.clientY,
                t: Date.now(),
                id: e.pointerId
            };
        };

        this._onPanoChromePointerUp = (e) => {
            if (!this.panoramaContainer.classList.contains('fullscreen')) {
                this._panoPointerDown = null;
                return;
            }
            const start = this._panoPointerDown;
            this._panoPointerDown = null;
            if (!start || start.id !== e.pointerId) return;

            const dx = Math.abs(e.clientX - start.x);
            const dy = Math.abs(e.clientY - start.y);
            const dt = Date.now() - start.t;
            if (dx > 10 || dy > 10 || dt > 500) return;

            // Single tap/click: reveal chrome (and refresh auto-hide timer)
            this.showPanoramaControls(true);
        };

        this.panoramaContainer.addEventListener('pointerdown', this._onPanoChromePointerDown, { passive: true });
        this.panoramaContainer.addEventListener('pointerup', this._onPanoChromePointerUp, { passive: true });
        this.panoramaContainer.addEventListener('pointercancel', () => {
            this._panoPointerDown = null;
        }, { passive: true });
        this._panoChromeBound = true;
    }

    clearPanoramaControlsTimer() {
        if (this._panoControlsTimer) {
            clearTimeout(this._panoControlsTimer);
            this._panoControlsTimer = null;
        }
    }

    showPanoramaControls(scheduleHide = false) {
        if (!this.panoramaContainer) return;
        this.panoramaContainer.classList.remove('controls-hidden');
        this.clearPanoramaControlsTimer();
        if (scheduleHide && this.panoramaContainer.classList.contains('fullscreen')) {
            this._panoControlsTimer = setTimeout(() => {
                this.hidePanoramaControls();
            }, 3000);
        }
    }

    hidePanoramaControls() {
        this.clearPanoramaControlsTimer();
        if (!this.panoramaContainer || !this.panoramaContainer.classList.contains('fullscreen')) return;
        this.panoramaContainer.classList.add('controls-hidden');
    }
    
    showPreviousPanorama() {
        if (this.panoramaURLs.length <= 1) return;
        
        this.currentPanoramaIndex = (this.currentPanoramaIndex - 1 + this.panoramaURLs.length) % this.panoramaURLs.length;
        this.initializePanoramaViewer(this.panoramaURLs[this.currentPanoramaIndex]);
        this.syncPanoramaShareUrl();
    }
    
    showNextPanorama() {
        if (this.panoramaURLs.length <= 1) return;
        
        this.currentPanoramaIndex = (this.currentPanoramaIndex + 1) % this.panoramaURLs.length;
        this.initializePanoramaViewer(this.panoramaURLs[this.currentPanoramaIndex]);
        this.syncPanoramaShareUrl();
    }
    
    updatePanoramaCounter() {
        if (this.panoramaCounter && this.panoramaURLs.length > 1) {
            this.panoramaCounter.textContent = `${this.currentPanoramaIndex + 1} / ${this.panoramaURLs.length}`;
        }
    }
    
    hideUnwantedButtons(panoramaDiv) {
        const unwantedSelectors = [
            '[class*="zoom"]',
            '.pnlm-plus',
            '.pnlm-minus',
            '[class*="compass"]',
            '.pnlm-compass',
            '.pnlm-zoom-controls',
            '.pnlm-zoom-in',
            '.pnlm-zoom-out',
            '.pnlm-fullscreen-button',
            '.pnlm-controls'
        ];
        
        unwantedSelectors.forEach(selector => {
            panoramaDiv.querySelectorAll(selector).forEach(el => {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('opacity', '0', 'important');
            });
        });
    }
    
    addCustomFullscreenButton(parent) {
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'custom-fullscreen-btn';
        fullscreenBtn.type = 'button';
        fullscreenBtn.setAttribute('aria-label', t('fullscreen'));
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        fullscreenBtn.title = t('fullscreen');
        
        fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanoramaFullscreen();
        });
        
        parent.appendChild(fullscreenBtn);
    }

    addPanoramaShareButton(parent) {
        const shareBtn = document.createElement('button');
        shareBtn.className = 'panorama-share-btn';
        shareBtn.type = 'button';
        shareBtn.setAttribute('aria-label', t('sharePanorama'));
        shareBtn.innerHTML = '<i class="fas fa-share-alt"></i>';
        shareBtn.title = t('sharePanorama');

        shareBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyPanoramaShareLink();
        });

        parent.appendChild(shareBtn);
    }
    
    togglePanoramaFullscreen() {
        if (!this.panoramaContainer) return;
        
        const isCurrentlyFullscreen = this.panoramaContainer.classList.contains('fullscreen');
        
        if (isCurrentlyFullscreen) {
            this.exitPanoramaFullscreen();
        } else {
            this.enterPanoramaFullscreen();
        }
    }
    
    enterPanoramaFullscreen({ skipSystemFullscreen = false } = {}) {
        if (!this.panoramaContainer) return;

        this.panoramaContainer.classList.add('fullscreen');
        document.body.classList.add('panorama-fullscreen-active');
        document.body.style.overflow = 'hidden';

        const header = document.querySelector('.header');
        if (header) {
            header.style.display = 'none';
        }

        if (skipSystemFullscreen) {
            // CSS pseudo-fullscreen only; system FS needs a later user tap.
            this.orientationLockFailed = this.isPhone();
            this.applyLandscapeLayout();
        } else {
            this.lockLandscapeOrientation();
        }

        const fullscreenBtn = this.panoramaContainer.querySelector('.custom-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
            fullscreenBtn.title = t('exitFullscreen');
        }

        if (!this.fullscreenKeyHandler) {
            this.fullscreenKeyHandler = (e) => {
                if (e.key === 'Escape') {
                    this.exitPanoramaFullscreen();
                }
            };
            document.addEventListener('keydown', this.fullscreenKeyHandler);
        }

        if (!this.onFullscreenChange) {
            this.onFullscreenChange = () => {
                const active = document.fullscreenElement || document.webkitFullscreenElement;
                // Only exit CSS fullscreen after system FS was actually granted then left
                if (!active) {
                    const hadSystemFs = this._hadSystemFullscreen;
                    if (hadSystemFs) this.exitPanoramaFullscreen();
                }
                this._hadSystemFullscreen = !!active;
            };
            document.addEventListener('fullscreenchange', this.onFullscreenChange);
            document.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
        }

        if (!this.orientationChangeHandler) {
            this.orientationChangeHandler = () => this.applyLandscapeLayout();
            window.addEventListener('orientationchange', this.orientationChangeHandler);
            window.addEventListener('resize', this.orientationChangeHandler);
        }

        this.showPanoramaControls(true);
        this.resizePanoramaViewer();
    }

    exitPanoramaFullscreen() {
        if (!this.panoramaContainer || this._exitingPanorama) return;
        this._exitingPanorama = true;

        this.clearForceLandscape();
        this.unlockLandscapeOrientation();
        this._hadSystemFullscreen = false;
        this.clearPanoramaControlsTimer();
        this.panoramaContainer.classList.remove('controls-hidden');

        this.panoramaContainer.classList.remove('fullscreen');
        document.body.classList.remove('panorama-fullscreen-active');
        document.body.style.overflow = 'auto';

        const header = document.querySelector('.header');
        if (header) {
            header.style.display = 'block';
        }

        this.resizePanoramaViewer();

        const fullscreenBtn = this.panoramaContainer.querySelector('.custom-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
            fullscreenBtn.title = t('fullscreen');
        }

        if (this.fullscreenKeyHandler) {
            document.removeEventListener('keydown', this.fullscreenKeyHandler);
            this.fullscreenKeyHandler = null;
        }
        if (this.onFullscreenChange) {
            document.removeEventListener('fullscreenchange', this.onFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange);
            this.onFullscreenChange = null;
        }
        if (this.orientationChangeHandler) {
            window.removeEventListener('orientationchange', this.orientationChangeHandler);
            window.removeEventListener('resize', this.orientationChangeHandler);
            this.orientationChangeHandler = null;
        }

        this._exitingPanorama = false;
    }

    isPhone() {
        const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (coarse && navigator.maxTouchPoints > 1);
    }

    isPortrait() {
        const { width, height } = this.getViewportSize();
        return height > width;
    }

    getViewportSize() {
        const vv = window.visualViewport;
        return {
            width: Math.round((vv && vv.width) || window.innerWidth),
            height: Math.round((vv && vv.height) || window.innerHeight)
        };
    }

    async lockLandscapeOrientation() {
        const el = this.panoramaContainer;
        const requestFs = el.requestFullscreen || el.webkitRequestFullscreen;
        if (requestFs) {
            const pending = requestFs.call(el);
            if (pending && pending.then) {
                await pending.catch(() => {});
            }
        }

        this.orientationLockFailed = true;
        if (this.isPhone() && screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape').then(() => {
                this.orientationLockFailed = false;
            }).catch(() => {});
        } else if (!this.isPhone()) {
            this.orientationLockFailed = false;
        }

        this.applyLandscapeLayout();
    }

    unlockLandscapeOrientation() {
        try {
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        } catch (_) { /* already unlocked */ }

        const active = document.fullscreenElement || document.webkitFullscreenElement;
        if (!active) return;
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (!exit) return;
        const pending = exit.call(document);
        if (pending && pending.catch) pending.catch(() => {});
    }

    applyLandscapeLayout() {
        if (!this.panoramaContainer || !this.panoramaContainer.classList.contains('fullscreen')) {
            return;
        }

        // Real landscape lock worked, or the phone is already sideways.
        if (!this.isPhone() || !this.orientationLockFailed || !this.isPortrait()) {
            this.clearForceLandscape();
        } else {
            this.enableForceLandscape();
        }

        this.resizePanoramaViewer();
    }

    enableForceLandscape() {
        const el = this.panoramaContainer;
        const { width, height } = this.getViewportSize();
        el.classList.add('force-landscape');
        el.style.top = '0px';
        el.style.left = width + 'px';
        el.style.width = height + 'px';
        el.style.height = width + 'px';
        el.style.transformOrigin = 'top left';
        el.style.transform = 'rotate(90deg)';
        this.bindLandscapePointerFix();
    }

    clearForceLandscape() {
        const el = this.panoramaContainer;
        if (!el) return;
        el.classList.remove('force-landscape');
        el.style.top = '';
        el.style.left = '';
        el.style.width = '';
        el.style.height = '';
        el.style.transform = '';
        el.style.transformOrigin = '';
        this.unbindLandscapePointerFix();
    }

    bindLandscapePointerFix() {
        if (this._landscapePointerFix) return;
        this._landscapePointerFix = (event) => this.remapLandscapePointer(event);
        const types = ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel'];
        types.forEach(type => {
            this.panoramaContainer.addEventListener(type, this._landscapePointerFix, { capture: true, passive: false });
        });
    }

    unbindLandscapePointerFix() {
        if (!this._landscapePointerFix || !this.panoramaContainer) return;
        const types = ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel'];
        types.forEach(type => {
            this.panoramaContainer.removeEventListener(type, this._landscapePointerFix, { capture: true });
        });
        this._landscapePointerFix = null;
    }

    remapLandscapePointer(event) {
        if (!this.panoramaContainer.classList.contains('force-landscape') || event.__remapped) return;
        const target = event.target;
        if (!target || !target.closest || target.closest('button')) return;
        if (!target.closest('.pnlm-container') && !target.closest('.pnlm-dragfix')) return;

        try {
            const rect = this.panoramaContainer.getBoundingClientRect();
            const mapPoint = (x, y) => ({
                x: rect.left + (y - rect.top),
                y: rect.top + (rect.right - x)
            });

            let fake;
            if (typeof Touch !== 'undefined' && (event.touches || event.changedTouches)) {
                const toTouches = (list) => Array.from(list || []).map(t => {
                    const p = mapPoint(t.clientX, t.clientY);
                    return new Touch({
                        identifier: t.identifier,
                        target: t.target,
                        clientX: p.x,
                        clientY: p.y,
                        pageX: p.x,
                        pageY: p.y,
                        screenX: p.x,
                        screenY: p.y
                    });
                });
                fake = new TouchEvent(event.type, {
                    bubbles: true,
                    cancelable: true,
                    touches: toTouches(event.touches),
                    targetTouches: toTouches(event.targetTouches),
                    changedTouches: toTouches(event.changedTouches)
                });
            } else {
                const p = mapPoint(event.clientX, event.clientY);
                fake = new MouseEvent(event.type, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: p.x,
                    clientY: p.y,
                    screenX: p.x,
                    screenY: p.y,
                    button: event.button,
                    buttons: event.buttons
                });
            }

            fake.__remapped = true;
            event.stopImmediatePropagation();
            if (event.cancelable) event.preventDefault();
            target.dispatchEvent(fake);
        } catch (_) {
            // Keep the original event if this browser cannot rebuild touches.
        }
    }

    resizePanoramaViewer() {
        setTimeout(() => {
            if (this.panoramaViewer && this.panoramaViewer.resize) {
                this.panoramaViewer.resize();
            }
        }, 100);
    }
}

// Initialize application when DOM is loaded
let galleryApp;
document.addEventListener('DOMContentLoaded', () => {
    galleryApp = new GalleryPageApp();
});

window.addEventListener('langchange', () => {
    if (!galleryApp) return;
    if (galleryApp.galleryLocation) {
        galleryApp.galleryLocation.textContent = [tPlace(galleryApp.placeContinent || ''), galleryApp.placeCountry || ''].filter(Boolean).join(', ');
    }
    const fullscreenBtn = galleryApp.panoramaContainer && galleryApp.panoramaContainer.querySelector('.custom-fullscreen-btn');
    if (fullscreenBtn) {
        const expanded = galleryApp.panoramaContainer.classList.contains('fullscreen');
        fullscreenBtn.title = t(expanded ? 'exitFullscreen' : 'fullscreen');
    }
    const shareBtn = galleryApp.panoramaContainer && galleryApp.panoramaContainer.querySelector('.panorama-share-btn');
    if (shareBtn) shareBtn.title = t('sharePanorama');
});
