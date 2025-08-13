// API Configuration for fetching gallery data
const API_BASE_URL = 'https://5nuxhstp12.execute-api.eu-north-1.amazonaws.com/prod';

// Load photos from Lambda API
let photos = [];

async function loadPhotosFromAPI(galleryId) {
    try {
        console.log('Loading gallery data from Lambda API...');
        
        const response = await fetch(`${API_BASE_URL}/galleries?id=${galleryId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const galleryData = await response.json();
        console.log('Successfully loaded gallery data from API:', galleryData);
        
        // Extract photos from gallery data
        photos = galleryData.photos || [];
        
        console.log('Loaded photos from API:', photos.length);

        return galleryData;
        
    } catch (error) {
        console.error('Error loading photos from API:', error);
        return null;
    }
}

// DOM Elements
const galleryTitle = document.getElementById('galleryTitle');
const galleryLocation = document.getElementById('galleryLocation');
const galleryYear = document.getElementById('galleryYear');
const photoCount = document.getElementById('photoCount');
const galleryDescription = document.getElementById('galleryDescription');
const photosGrid = document.getElementById('photosGrid');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

// Full-screen viewer elements
const fullscreenViewer = document.getElementById('fullscreenViewer');
const fullscreenImage = document.getElementById('fullscreenImage');
const prevPhotoBtn = document.getElementById('prevPhotoBtn');
const nextPhotoBtn = document.getElementById('nextPhotoBtn');
const closeViewerBtn = document.getElementById('closeViewerBtn');
const currentPhotoIndex = document.getElementById('currentPhotoIndex');
const totalPhotos = document.getElementById('totalPhotos');

// Full-screen viewer state
let currentGalleryPhotos = [];
let currentPhotoIndexValue = 0;

// Get gallery data
async function getGalleryData() {
    const galleryId = new URLSearchParams(window.location.search).get('gallery') || null;
    
    if (galleryId) {
        console.log('Loading gallery data for ID:', galleryId);
        
        // Load from API
        const galleryData = await loadPhotosFromAPI(galleryId);
        
        if (galleryData) {
            console.log('Successfully loaded gallery data from API');
            return {
                id: galleryData.galleryId || galleryData.id,
                name: galleryData.name,
                location: `${galleryData.continent}, ${galleryData.country}`,
                year: new Date(galleryData.createdAt).getFullYear(),
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

// Load gallery data
async function loadGallery() {
    try {
        const gallery = await getGalleryData();
        
        // Update page title
        document.title = `${gallery.name} - Photography Portfolio`;
        
        // Update gallery header
        galleryTitle.textContent = gallery.name;
        galleryLocation.textContent = gallery.location;
        galleryYear.textContent = gallery.year;
        photoCount.textContent = gallery.photos.length;
        galleryDescription.textContent = gallery.description;
        
        // Store photos for full-screen viewer
        currentGalleryPhotos = gallery.photos;
        
        // Load photos grid
        loadPhotosGrid(gallery.photos);
        
        console.log('Gallery loaded successfully:', gallery.name, 'with', gallery.photos.length, 'photos');
    } catch (error) {
        console.error('Error loading gallery:', error);
        // Show error message to user
        if (galleryTitle) galleryTitle.textContent = 'Error Loading Gallery';
        if (galleryDescription) galleryDescription.textContent = 'Failed to load gallery data. Please try again.';
    }
}

// Load photos into grid
function loadPhotosGrid(photos) {
    console.log('=== Loading Photos Grid ===');
    console.log('Photos array length:', photos.length);
    console.log('First few photos:', photos.slice(0, 3));
    
    photosGrid.innerHTML = '';
    
    if (photos.length === 0) {
        photosGrid.innerHTML = '<div class="no-photos">No photos found in this gallery.</div>';
        return;
    }
    
    photos.forEach((photo, index) => {
        const photoElement = createPhotoElement(photo, index);
        photosGrid.appendChild(photoElement);
    });
    
    console.log('Photos grid loaded with', photosGrid.children.length, 'elements');
}

// Create photo element
function createPhotoElement(photo, index) {
    const photoElement = document.createElement('div');
    photoElement.className = 'photo-item';
    photoElement.setAttribute('data-index', index);
    
    // Get current rating for this photo (from localStorage)
    const photoId = photo.photoId;
    const currentRating = getPhotoRatingFromLocal(photoId);
    
    photoElement.innerHTML = `
        <img src="${photo.thumbnail || photo.image}" alt="${photo.title || photo.name}" loading="lazy">
        <div class="photo-overlay">
            <div class="photo-info">
            </div>
        </div>
        <div class="photo-rating">
            <div class="star-rating" data-photo-id="${photoId}">
                <!-- Stars will be created dynamically -->
            </div>
        </div>
    `;
    
    // Create stars dynamically and set up events
    const starRating = photoElement.querySelector('.star-rating');
    if (starRating) {
        createStarsWithEvents(starRating, photoId, currentRating);
    }
    
    // Add click event to open full-screen viewer (only on the image)
    const img = photoElement.querySelector('img');
    if (img) {
        img.addEventListener('click', () => {
            openFullscreenViewer(index);
        });
    }
    
    return photoElement;
}

// Create stars with events for a star rating element
function createStarsWithEvents(starRatingElement, photoId, currentRating) {
    // Clear existing content
    starRatingElement.innerHTML = '';
    
    // Create 5 stars
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = i <= currentRating ? 'star filled' : 'star';
        star.setAttribute('data-rating', i);
        star.textContent = '★';
        
        // Add click event
        star.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent opening fullscreen viewer when clicking stars
            
            // Check if user is clicking the same rating (cancel rating)
            const currentRating = getPhotoRatingFromLocal(photoId);
            let newRating = i;
            
            if (currentRating === i) {
                // User clicked the same star, cancel rating (set to 0)
                newRating = 0;
                console.log('Star clicked! Photo ID:', photoId, 'Cancelling rating (was:', currentRating, ')');
            } else {
                console.log('Star clicked! Photo ID:', photoId, 'New rating:', newRating);
            }
            
            try {
                // Call API to save rating (or cancel if newRating is 0)
                await ratePhoto(photoId, newRating);
                
                // Update all instances of this photo's rating (grid and fullscreen)
                updateAllPhotoRatings(photoId, newRating);
                
                // Show simple success message
                if (newRating === 0) {
                    showRatingMessage('Rating cancelled successfully!', 'success');
                } else {
                    showRatingMessage('Rating saved successfully!', 'success');
                }
            } catch (error) {
                console.error('Failed to save rating:', error);
                showRatingMessage('Failed to save rating. Please try again.', 'error');
            }
        });
        
        // Add hover events
        star.addEventListener('mouseenter', () => {
            const stars = starRatingElement.querySelectorAll('.star');
            highlightStars(stars, i);
        });
        
        star.addEventListener('mouseleave', () => {
            const stars = starRatingElement.querySelectorAll('.star');
            // Get the current rating from localStorage to ensure it's up to date
            const currentRatingFromStorage = getPhotoRatingFromLocal(photoId);
            updateStarDisplay(stars, currentRatingFromStorage);
        });
        
        starRatingElement.appendChild(star);
    }
}

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

// ==================== FULLSCREEN VIEWER ====================

// Open full-screen viewer
function openFullscreenViewer(index) {
    console.log('Opening fullscreen viewer for index:', index);
    console.log('Current gallery photos:', currentGalleryPhotos);
    
    if (index < 0 || index >= currentGalleryPhotos.length) {
        console.error('Invalid photo index:', index);
        return;
    }
    
    currentPhotoIndexValue = index;
    const photo = currentGalleryPhotos[index];
    console.log('Selected photo:', photo);
    console.log('Photo photoId:', photo.photoId);
    
    if (!fullscreenImage) {
        console.error('Fullscreen image element not found');
        return;
    }
    
    fullscreenImage.src = photo.image || photo.thumbnail;
    fullscreenImage.alt = photo.title || photo.name || 'Photo';
    
    currentPhotoIndex.textContent = index + 1;
    totalPhotos.textContent = currentGalleryPhotos.length;
    
    // Setup star rating for full-screen view
    const fullscreenRating = document.getElementById('fullscreenStarRating');
    if (fullscreenRating) {
        setupFullscreenStarRating(fullscreenRating, photo.photoId);
    }
    
    console.log('Setting fullscreen viewer display to flex');
    fullscreenViewer.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    console.log('Fullscreen viewer display style:', fullscreenViewer.style.display);
}

// Close full-screen viewer
function closeFullscreenViewer() {
    fullscreenViewer.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Show previous photo
function showPreviousPhoto() {
    const newIndex = currentPhotoIndexValue > 0 ? currentPhotoIndexValue - 1 : currentGalleryPhotos.length - 1;
    openFullscreenViewer(newIndex);
}

// Show next photo
function showNextPhoto() {
    const newIndex = currentPhotoIndexValue < currentGalleryPhotos.length - 1 ? currentPhotoIndexValue + 1 : 0;
    openFullscreenViewer(newIndex);
}



// Setup full-screen star rating
function setupFullscreenStarRating(starRatingElement, photoId) {
    console.log('Setting up fullscreen star rating for photoId:', photoId);
    const currentRating = getPhotoRatingFromLocal(photoId);
    console.log('Current rating from localStorage:', currentRating);
    
    // Use the same dynamic creation method
    createStarsWithEvents(starRatingElement, photoId, currentRating);
}

// Update all instances of a photo's rating (both grid and fullscreen)
function updateAllPhotoRatings(photoId, rating) {
    console.log('Updating all photo ratings for:', photoId, 'with rating:', rating);
    
    // Update all grid ratings for this photo
    const galleryRatings = document.querySelectorAll(`[data-photo-id="${photoId}"]`);
    console.log('Found gallery rating elements:', galleryRatings.length);
    
    galleryRatings.forEach(ratingElement => {
        const stars = ratingElement.querySelectorAll('.star');
        console.log('Found stars in gallery element:', stars.length);
        updateStarDisplay(stars, rating);
    });
    
    // Update fullscreen rating if the same photo is currently displayed
    const fullscreenRating = document.getElementById('fullscreenStarRating');
    if (fullscreenRating && currentPhotoIndexValue < currentGalleryPhotos.length) {
        const currentPhoto = currentGalleryPhotos[currentPhotoIndexValue];
        const currentPhotoId = currentPhoto.photoId;
        if (currentPhotoId === photoId) {
            const stars = fullscreenRating.querySelectorAll('.star');
            console.log('Found stars in fullscreen:', stars.length);
            updateStarDisplay(stars, rating);
        }
    }
    
    // Also update localStorage as fallback
    setPhotoRatingInLocal(photoId, rating);
}

// Setup full-screen viewer event listeners
function setupFullscreenViewer() {
    // Navigation buttons
    prevPhotoBtn.addEventListener('click', showPreviousPhoto);
    nextPhotoBtn.addEventListener('click', showNextPhoto);
    closeViewerBtn.addEventListener('click', closeFullscreenViewer);
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (fullscreenViewer.style.display === 'flex') {
            switch (e.key) {
                case 'ArrowLeft':
                    showPreviousPhoto();
                    break;
                case 'ArrowRight':
                    showNextPhoto();
                    break;
                case 'Escape':
                    closeFullscreenViewer();
                    break;
            }
        }
    });
    
    // Click outside to close
    fullscreenViewer.addEventListener('click', (e) => {
        if (e.target === fullscreenViewer) {
            closeFullscreenViewer();
        }
    });
}

// ==================== INITIALIZATION ====================

// Initialize the application
async function init() {
    console.log('Initializing gallery page...');
    
    // Setup navigation
    setupNavigation();
    
    // Setup full-screen viewer
    setupFullscreenViewer();

    // Initialize device ID
    initDeviceId();
    
    // Load gallery data
    await loadGallery();
    
    console.log('Gallery page initialized successfully');
}

// ==================== STAR RATING SYSTEM ====================

// Device ID management
let deviceId = null;

// Initialize device ID
function initDeviceId() {
    deviceId = getOrCreateDeviceId();
    console.log('Device ID initialized:', deviceId);
    
    // Verify deviceId persistence
    setTimeout(() => {
        const cookieDeviceId = getCookie('deviceId');
        const localStorageDeviceId = localStorage.getItem('deviceId');
        console.log('DeviceId persistence check:');
        console.log('  - Current deviceId:', deviceId);
        console.log('  - Cookie deviceId:', cookieDeviceId);
        console.log('  - localStorage deviceId:', localStorageDeviceId);
        
        if (cookieDeviceId !== deviceId || localStorageDeviceId !== deviceId) {
            console.warn('DeviceId mismatch detected! Attempting to fix...');
            setCookie('deviceId', deviceId, 365 * 24 * 60 * 60);
            localStorage.setItem('deviceId', deviceId);
        }
    }, 1000);
}

// Generate or retrieve device ID from cookie or localStorage
function getOrCreateDeviceId() {
    // Try to get from cookie first
    let deviceId = getCookie('deviceId');
    console.log('Retrieved deviceId from cookie:', deviceId);
    
    // If not in cookie, try localStorage
    if (!deviceId) {
        deviceId = localStorage.getItem('deviceId');
        console.log('Retrieved deviceId from localStorage:', deviceId);
    }
    
    // If still not found, generate new one
    if (!deviceId) {
        deviceId = 'device_' + generateUUID();
        console.log('Generated new deviceId:', deviceId);
        
        // Save to both cookie and localStorage for redundancy
        setCookie('deviceId', deviceId, 365 * 24 * 60 * 60); // 1 year
        localStorage.setItem('deviceId', deviceId);
        console.log('DeviceId saved to both cookie and localStorage');
    } else {
        // If found in localStorage but not cookie, sync to cookie
        if (!getCookie('deviceId')) {
            setCookie('deviceId', deviceId, 365 * 24 * 60 * 60);
            console.log('Synced deviceId from localStorage to cookie');
        }
    }
    
    return deviceId;
}

// Generate a simple UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Set cookie
function setCookie(name, value, seconds) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (seconds * 1000));
    // Add SameSite and Secure attributes for better cookie persistence
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    console.log(`Cookie set: ${name}=${value}, expires: ${expires.toUTCString()}`);
}

// Get cookie value
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    console.log(`Looking for cookie: ${name}, all cookies: ${document.cookie}`);
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            const value = c.substring(nameEQ.length, c.length);
            console.log(`Found cookie ${name}: ${value}`);
            return value;
        }
    }
    console.log(`Cookie ${name} not found`);
    return null;
}

// Rate a photo (0-5 stars) - API call
async function ratePhoto(photoId, rating) {
    console.log('ratePhoto called with photoId:', photoId, 'rating:', rating);
    try {
        const response = await fetch(`${API_BASE_URL}/galleries?action=rate_photo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                photoId: photoId,
                deviceId: deviceId,
                rating: rating
            })
        });

        const result = await response.json();
        console.log('Rating result:', response);  
        if (response.ok) {
            // Refresh rating display
            await loadPhotoRating(photoId);
            return result;
        } else {
            throw new Error(result.error || 'Failed to rate photo');
        }
    } catch (error) {
        console.error('Error rating photo:', error);
        throw error;
    }
}

// Get photo rating statistics from API
async function getPhotoRatingStats(photoId) {
    try {
        const response = await fetch(`${API_BASE_URL}/galleries?action=get_photo_rating&photoId=${photoId}&deviceId=${deviceId}`);
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

// Load and display photo rating
async function loadPhotoRating(photoId) {
    try {
        const ratingData = await getPhotoRatingStats(photoId);
        displayRating(photoId, ratingData);
    } catch (error) {
        console.error('Error loading photo rating:', error);
        // Fallback to localStorage if API fails
        const localRating = getPhotoRatingFromLocal(photoId);
        displayRating(photoId, {
            averageRating: 0,
            totalRatings: 0,
            userRating: localRating
        });
    }
}

// Display rating in the UI
function displayRating(photoId, ratingData) {
    // Update all instances of this photo's rating display
    const ratingElements = document.querySelectorAll(`[data-photo-id="${photoId}"] .star-rating`);
    
    ratingElements.forEach(ratingElement => {
        // Update star display
        updateStarDisplay(ratingElement, ratingData.userRating || 0, ratingData.averageRating);
    });
}

// Update star display based on user rating and average
function updateStarDisplay(starRatingElement, userRating, averageRating) {
    if (!starRatingElement) return;

    // Clear existing stars
    starRatingElement.innerHTML = '';

    // Create stars
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = 'star';
        star.innerHTML = '★';
        star.dataset.rating = i;
        
        // Set star color based on user rating
        if (i <= userRating) {
            star.classList.add('filled');
        }
        
        // Add click event
        star.addEventListener('click', () => handleStarClick(starRatingElement, i));
        
        starRatingElement.appendChild(star);
    }
}

// Handle star click
async function handleStarClick(starRatingElement, rating) {
    const photoId = starRatingElement.getAttribute('data-photo-id');
    if (!photoId) return;

    try {
        await ratePhoto(photoId, rating);
        // Show success message
        showRatingMessage('Rating saved successfully!', 'success');
    } catch (error) {
        showRatingMessage('Failed to save rating. Please try again.', 'error');
    }
}

// Show rating message to user
function showRatingMessage(message, type = 'info') {
    // Create message element
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
    
    // Add to page
    document.body.appendChild(messageEl);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 3000);
}

// Get photo rating from localStorage (fallback)
function getPhotoRatingFromLocal(photoId) {
    const ratings = JSON.parse(localStorage.getItem('photoRatings') || '{}');
    return ratings[photoId] || 0;
}

// Set photo rating in localStorage (fallback)
function setPhotoRatingInLocal(photoId, rating) {
    const ratings = JSON.parse(localStorage.getItem('photoRatings') || '{}');
    ratings[photoId] = rating;
    localStorage.setItem('photoRatings', JSON.stringify(ratings));
}

// Generate star HTML (simplified version for initial display)
function generateStarHTML(rating = 0) {
    let starsHTML = '';
    for (let i = 1; i <= 5; i++) {
        const starClass = i <= rating ? 'star filled' : 'star';
        starsHTML += `<span class="${starClass}" data-rating="${i}">★</span>`;
    }
    return starsHTML;
}

// Highlight stars on hover
function highlightStars(stars, rating) {
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

// Update star display (for existing stars)
function updateStarDisplay(stars, rating) {
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

// ==================== GLOBAL FUNCTIONS ====================

// Make functions available globally for HTML onclick handlers
window.openFullscreenViewer = openFullscreenViewer;
window.closeFullscreenViewer = closeFullscreenViewer;
window.showPreviousPhoto = showPreviousPhoto;
window.showNextPhoto = showNextPhoto;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 