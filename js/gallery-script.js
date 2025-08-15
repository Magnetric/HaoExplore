// API Configuration for fetching gallery data
const API_BASE_URL = 'https://5nuxhstp12.execute-api.eu-north-1.amazonaws.com/prod';

// Main Gallery Application Class
class GalleryPageApp {
    constructor() {
        this.photos = [];
        this.currentGalleryPhotos = [];
        this.currentPhotoIndexValue = 0;
        this.deviceId = null;
        
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
        this.prevPhotoBtn = document.getElementById('prevPhotoBtn');
        this.nextPhotoBtn = document.getElementById('nextPhotoBtn');
        this.closeViewerBtn = document.getElementById('closeViewerBtn');
        this.currentPhotoIndex = document.getElementById('currentPhotoIndex');
        this.totalPhotos = document.getElementById('totalPhotos');
        
        this.init();
    }

    async init() {
        console.log('Initializing gallery page...');
        
        this.setupNavigation();
        this.setupFullscreenViewer();
        this.initDeviceId();
        
        await this.loadGallery();
        
        console.log('Gallery page initialized successfully');
    }

    async loadPhotosFromAPI(galleryId) {
        try {
            console.log('Loading gallery data from Lambda API...');
            
            const response = await fetch(`${API_BASE_URL}/galleries?id=${galleryId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const galleryData = await response.json();
            console.log('Successfully loaded gallery data from API:', galleryData);
            
            this.photos = galleryData.photos || [];
            console.log('Loaded photos from API:', this.photos.length);

            return galleryData;
            
        } catch (error) {
            console.error('Error loading photos from API:', error);
            return null;
        }
    }

    async getGalleryData() {
        const galleryId = new URLSearchParams(window.location.search).get('gallery') || null;
        
        if (galleryId) {
            console.log('Loading gallery data for ID:', galleryId);
            
            const galleryData = await this.loadPhotosFromAPI(galleryId);
            
            if (galleryData) {
                console.log('Successfully loaded gallery data from API');
                // Get year from years array if available, otherwise fallback to createdAt
                let year;
                if (galleryData.years && Array.isArray(galleryData.years) && galleryData.years.length > 0) {
                    // If multiple years, join them with commas, otherwise use single year
                    if (galleryData.years.length > 1) {
                        year = galleryData.years.map(y => parseInt(y)).sort((a, b) => a - b).join(', ');
                    } else {
                        year = parseInt(galleryData.years[0]);
                    }
                } else {
                    // Fallback to createdAt year
                    year = new Date(galleryData.createdAt).getFullYear();
                }
                
                return {
                    id: galleryData.galleryId || galleryData.id,
                    name: galleryData.name,
                    location: `${galleryData.continent}, ${galleryData.country}`,
                    year: year,
                    photos: galleryData.photos || [],
                    description: galleryData.description || ''
                };
            }
        }
        
        // Fallback to default gallery
        return {
            id: 'default',
            name: 'Sample Gallery',
            location: 'Various Locations',
            year: 2024,
            photos: [],
            description: 'A collection of beautiful photographs from around the world.'
        };
    }

    async loadGallery() {
        try {
            const gallery = await this.getGalleryData();
            
            // Update page title
            document.title = `Light&Lens - ${gallery.name}`;
            
            // Update gallery header
            this.galleryTitle.textContent = gallery.name;
            this.galleryLocation.textContent = gallery.location;
            this.galleryYear.textContent = gallery.year;
            this.photoCount.textContent = gallery.photos.length;
            this.galleryDescription.textContent = gallery.description;
            
            // Store photos for full-screen viewer
            this.currentGalleryPhotos = gallery.photos;
            
            // Load photos grid
            this.loadPhotosGrid(gallery.photos);
            
            console.log('Gallery loaded successfully:', gallery.name, 'with', gallery.photos.length, 'photos');
        } catch (error) {
            console.error('Error loading gallery:', error);
            if (this.galleryTitle) this.galleryTitle.textContent = 'Error Loading Gallery';
            if (this.galleryDescription) this.galleryDescription.textContent = 'Failed to load gallery data. Please try again.';
        }
    }

    loadPhotosGrid(photos) {
        console.log('=== Loading Photos Grid ===');
        console.log('Photos array length:', photos.length);
        console.log('First few photos:', photos.slice(0, 3));
        
        this.photosGrid.innerHTML = '';
        
        if (photos.length === 0) {
            this.photosGrid.innerHTML = '<div class="no-photos">No photos found in this gallery.</div>';
            return;
        }
        
        // Sort photos by sortOrder if available, otherwise by index
        const sortedPhotos = [...photos].sort((a, b) => {
            const orderA = a.sortOrder || Number.MAX_SAFE_INTEGER;
            const orderB = b.sortOrder || Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
        });
        
        console.log('Photos sorted by sortOrder:', sortedPhotos.map(p => ({
            id: p.photoId,
            name: p.name || p.title,
            sortOrder: p.sortOrder
        })));
        
        sortedPhotos.forEach((photo, index) => {
            const photoElement = this.createPhotoElement(photo, index);
            this.photosGrid.appendChild(photoElement);
        });
        
        console.log('Photos grid loaded with', this.photosGrid.children.length, 'elements');
    }

    createPhotoElement(photo, index) {
        const photoElement = document.createElement('div');
        photoElement.className = 'photo-item';
        photoElement.setAttribute('data-index', index);
        
        const photoId = photo.photoId;
        const currentRating = this.getPhotoRatingFromLocal(photoId);
        
        photoElement.innerHTML = `
            <img src="${photo.thumbnail || photo.image}" alt="${photo.title || photo.name}" loading="lazy">
            <div class="photo-overlay">
                <div class="photo-info">
                </div>
            </div>
            <div class="photo-rating">
                <div class="star-rating" data-photo-id="${photoId}">
                </div>
            </div>
        `;
        
        // Create stars dynamically and set up events
        const starRating = photoElement.querySelector('.star-rating');
        if (starRating) {
            this.createStarsWithEvents(starRating, photoId, currentRating);
        }
        
        // Add click event to open full-screen viewer
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
                        this.showRatingMessage('Rating cancelled successfully!', 'success');
                    } else {
                        this.showRatingMessage('Rating saved successfully!', 'success');
                    }
                } catch (error) {
                    console.error('Failed to save rating:', error);
                    this.showRatingMessage('Failed to save rating. Please try again.', 'error');
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
        console.log('Opening fullscreen viewer for index:', index);
        
        // Get sorted photos for consistent ordering
        const sortedPhotos = [...this.currentGalleryPhotos].sort((a, b) => {
            const orderA = a.sortOrder || Number.MAX_SAFE_INTEGER;
            const orderB = b.sortOrder || Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
        });
        
        if (index < 0 || index >= sortedPhotos.length) {
            console.error('Invalid photo index:', index);
            return;
        }
        
        this.currentPhotoIndexValue = index;
        const photo = sortedPhotos[index];
        
        if (!this.fullscreenImage) {
            console.error('Fullscreen image element not found');
            return;
        }
        
        this.fullscreenImage.src = photo.image || photo.thumbnail;
        this.fullscreenImage.alt = photo.title || photo.name || 'Photo';
        
        this.currentPhotoIndex.textContent = index + 1;
        this.totalPhotos.textContent = sortedPhotos.length;
        
        const fullscreenRating = document.getElementById('fullscreenStarRating');
        if (fullscreenRating) {
            this.setupFullscreenStarRating(fullscreenRating, photo.photoId);
        }
        
        this.fullscreenViewer.style.display = 'flex';
        this.fullscreenViewer.classList.add('active');
        document.body.classList.add('fullscreen-active');
        document.body.style.overflow = 'hidden';
        
        // Hide header when fullscreen viewer is active
        const header = document.querySelector('.header');
        if (header) {
            header.style.display = 'none';
        }
    }

    closeFullscreenViewer() {
        this.fullscreenViewer.style.display = 'none';
        this.fullscreenViewer.classList.remove('active');
        document.body.classList.remove('fullscreen-active');
        document.body.style.overflow = 'auto';
        
        // Show header when fullscreen viewer is closed
        const header = document.querySelector('.header');
        if (header) {
            header.style.display = 'block';
        }
    }

    showPreviousPhoto() {
        const sortedPhotos = [...this.currentGalleryPhotos].sort((a, b) => {
            const orderA = a.sortOrder || Number.MAX_SAFE_INTEGER;
            const orderB = b.sortOrder || Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
        });
        const newIndex = this.currentPhotoIndexValue > 0 ? this.currentPhotoIndexValue - 1 : sortedPhotos.length - 1;
        this.openFullscreenViewer(newIndex);
    }

    showNextPhoto() {
        const sortedPhotos = [...this.currentGalleryPhotos].sort((a, b) => {
            const orderA = a.sortOrder || Number.MAX_SAFE_INTEGER;
            const orderB = b.sortOrder || Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
        });
        const newIndex = this.currentPhotoIndexValue < sortedPhotos.length - 1 ? this.currentPhotoIndexValue + 1 : 0;
        this.openFullscreenViewer(newIndex);
    }

    setupFullscreenStarRating(starRatingElement, photoId) {
        console.log('Setting up fullscreen star rating for photoId:', photoId);
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
            if (e.target === this.fullscreenViewer) {
                this.closeFullscreenViewer();
            }
        });
    }

    updateAllPhotoRatings(photoId, rating) {
        console.log('Updating all photo ratings for:', photoId, 'with rating:', rating);
        
        const galleryRatings = document.querySelectorAll(`[data-photo-id="${photoId}"]`);
        galleryRatings.forEach(ratingElement => {
            const stars = ratingElement.querySelectorAll('.star');
            this.updateStarDisplay(stars, rating);
        });
        
        const fullscreenRating = document.getElementById('fullscreenStarRating');
        if (fullscreenRating && this.currentPhotoIndexValue < this.currentGalleryPhotos.length) {
            const currentPhoto = this.currentGalleryPhotos[this.currentPhotoIndexValue];
            if (currentPhoto.photoId === photoId) {
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
        console.log('ratePhoto called with photoId:', photoId, 'rating:', rating);
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
                await this.loadPhotoRating(photoId);
                return result;
            } else {
                throw new Error(result.error || 'Failed to rate photo');
            }
        } catch (error) {
            console.error('Error rating photo:', error);
            throw error;
        }
    }

    async getPhotoRatingStats(photoId) {
        try {
            const response = await fetch(`${API_BASE_URL}/galleries?action=get_photo_rating&photoId=${photoId}&deviceId=${this.deviceId}`);
            const result = await response.json();
            
            if (response.ok) {
                return result;
            } else {
                throw new Error(result.error || 'Failed to get photo rating');
            }
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
        const ratingElements = document.querySelectorAll(`[data-photo-id="${photoId}"] .star-rating`);
        
        ratingElements.forEach(ratingElement => {
            this.updateStarDisplay(ratingElement, ratingData.userRating || 0, ratingData.averageRating);
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
}

// Initialize application when DOM is loaded
let galleryApp;
document.addEventListener('DOMContentLoaded', () => {
    galleryApp = new GalleryPageApp();
});

// Make functions available globally for HTML onclick handlers
window.openFullscreenViewer = (index) => galleryApp.openFullscreenViewer(index);
window.closeFullscreenViewer = () => galleryApp.closeFullscreenViewer();
window.showPreviousPhoto = () => galleryApp.showPreviousPhoto();
window.showNextPhoto = () => galleryApp.showNextPhoto(); 