// S3 Configuration for fetching gallery data
const S3_CONFIG = {
    bucketName: 'haophotography',
    region: 'eu-north-1'
};

// Load photos from S3 metadata or localStorage
let photos = [];

async function loadPhotosFromS3() {
    try {
        console.log('Attempting to load photos from S3 metadata...');
        
        // Construct the S3 URL for the metadata file
        const metadataUrl = `https://${S3_CONFIG.bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/galleries/metadata.json`;
        
        // Add cache-busting parameter to ensure fresh data
        const cacheBustUrl = `${metadataUrl}?t=${Date.now()}`;
        
        console.log('Fetching metadata from:', cacheBustUrl);
        
        const response = await fetch(cacheBustUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const metadata = await response.json();
        console.log('Successfully loaded metadata from S3:', metadata);
        
        // Extract photos from centralized metadata
        photos = metadata.photos || [];
        
        console.log('Loaded photos from S3 metadata:', photos.length);
        
        // Save to localStorage as backup for offline viewing
        localStorage.setItem('galleryPhotos', JSON.stringify(photos));
        localStorage.setItem('lastS3Update', new Date().toISOString());
        
        return true;
        
    } catch (error) {
        console.error('Error loading photos from S3:', error);
        console.log('Falling back to localStorage...');
        return false;
    }
}

function loadPhotosFromStorage() {
    const savedPhotos = localStorage.getItem('galleryPhotos');
    if (savedPhotos) {
        photos = JSON.parse(savedPhotos);
    } else {
        photos = [];
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

// Get gallery ID from URL parameter
function getGalleryIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('gallery') || null;
}

// Get gallery data
async function getGalleryData() {
    const galleryId = getGalleryIdFromUrl();
    
    if (galleryId) {
        // Check if we have optimized metadata
        const metadataVersion = localStorage.getItem('metadataVersion');
        
        if (metadataVersion === '2.0-optimized') {
            console.log('Using optimized metadata - fetching individual gallery data');
            
            // Get gallery summary from localStorage
            const gallerySummaries = JSON.parse(localStorage.getItem('gallerySummaries') || '[]');
            const gallerySummary = gallerySummaries.find(summary => summary.id == galleryId);
            
            if (gallerySummary && gallerySummary.metadataPath) {
                try {
                    // Fetch individual gallery metadata from S3
                    const metadataUrl = `https://${S3_CONFIG.bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/${gallerySummary.metadataPath}`;
                    const cacheBustUrl = `${metadataUrl}?t=${Date.now()}`;
                    
                    console.log('Fetching individual gallery metadata from:', cacheBustUrl);
                    
                    const response = await fetch(cacheBustUrl);
                    if (response.ok) {
                        const galleryMetadata = await response.json();
                        console.log('Successfully loaded individual gallery metadata:', galleryMetadata);
                        
                        return {
                            id: galleryMetadata.id,
                            name: galleryMetadata.name,
                            location: galleryMetadata.country,
                            year: new Date().getFullYear(), // Could be extracted from tags
                            photos: galleryMetadata.photos || [],
                            description: galleryMetadata.description || ''
                        };
                    }
                } catch (error) {
                    console.error('Error fetching individual gallery metadata:', error);
                }
            }
        } else {
            console.log('Using legacy metadata - loading from localStorage photos');
            
            // Find gallery from localStorage (legacy format)
            const savedPhotos = localStorage.getItem('galleryPhotos');
            if (savedPhotos) {
                const allPhotos = JSON.parse(savedPhotos);
                const galleryPhotos = allPhotos.filter(photo => photo.galleryId == galleryId);
                
                if (galleryPhotos.length > 0) {
                    // Extract gallery info from first photo
                    const firstPhoto = galleryPhotos[0];
                    return {
                        id: galleryId,
                        name: firstPhoto.galleryName || 'Unnamed Gallery',
                        location: firstPhoto.location,
                        year: firstPhoto.year,
                        photos: galleryPhotos,
                        description: firstPhoto.galleryDescription || ''
                    };
                }
            }
        }
    }
    
    // Fallback to default gallery
    return {
        id: 'default',
        name: 'Sample Gallery',
        location: 'Various Locations',
        year: 2024,
        photos: photos,
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
    photosGrid.innerHTML = '';
    
    if (photos.length === 0) {
        photosGrid.innerHTML = '<div class="no-photos">No photos found in this gallery.</div>';
        return;
    }
    
    photos.forEach((photo, index) => {
        const photoElement = createPhotoElement(photo, index);
        photosGrid.appendChild(photoElement);
    });
}

// Create photo element
function createPhotoElement(photo, index) {
    const photoElement = document.createElement('div');
    photoElement.className = 'photo-item';
    photoElement.setAttribute('data-index', index);
    
    // Get current rating for this photo (from localStorage)
    const currentRating = getPhotoRating(photo.image || photo.thumbnail || `photo_${index}`);
    
    photoElement.innerHTML = `
        <img src="${photo.thumbnail || photo.image}" alt="${photo.title}" loading="lazy">
        <div class="photo-overlay">
            <div class="photo-info">
            </div>
        </div>
        <div class="photo-rating">
            <div class="star-rating" data-photo-id="${photo.image || photo.thumbnail || `photo_${index}`}">
                ${generateStarHTML(currentRating)}
            </div>
        </div>
    `;
    
    // Add click event to open full-screen viewer (only for the image, not the rating area)
    const img = photoElement.querySelector('img');
    img.addEventListener('click', () => {
        openFullscreenViewer(index);
    });
    
    // Add star rating click handlers
    setupStarRating(photoElement);
    
    return photoElement;
}

// Setup navigation
function setupNavigation() {
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });
}

// Full-screen viewer functions
function openFullscreenViewer(index) {
    currentPhotoIndexValue = index;
    const photo = currentGalleryPhotos[index];
    
    // Update full-screen viewer content
    fullscreenImage.src = photo.image; // Use original image for full-screen
    fullscreenImage.alt = photo.title;
    
    // Update counter
    currentPhotoIndex.textContent = index + 1;
    totalPhotos.textContent = currentGalleryPhotos.length;
    
    // Update fullscreen star rating
    updateFullscreenRating(photo);
    
    // Show full-screen viewer
    fullscreenViewer.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeFullscreenViewer() {
    fullscreenViewer.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
}

function showPreviousPhoto() {
    if (currentPhotoIndexValue > 0) {
        openFullscreenViewer(currentPhotoIndexValue - 1);
    }
}

function showNextPhoto() {
    if (currentPhotoIndexValue < currentGalleryPhotos.length - 1) {
        openFullscreenViewer(currentPhotoIndexValue + 1);
    }
}

function updateFullscreenRating(photo) {
    const fullscreenStarRating = document.getElementById('fullscreenStarRating');
    const photoId = photo.image || photo.thumbnail || `photo_${currentPhotoIndexValue}`;
    const currentRating = getPhotoRating(photoId);
    
    // Generate stars HTML
    fullscreenStarRating.innerHTML = generateStarHTML(currentRating);
    fullscreenStarRating.setAttribute('data-photo-id', photoId);
    
    // Setup event listeners for fullscreen stars
    setupFullscreenStarRating(fullscreenStarRating, photoId);
}

function setupFullscreenStarRating(starRatingElement, photoId) {
    const stars = starRatingElement.querySelectorAll('.star');
    
    stars.forEach((star, index) => {
        // Hover effect
        star.addEventListener('mouseenter', () => {
            highlightStars(stars, index + 1);
        });
        
        // Click to rate
        star.addEventListener('click', (e) => {
            e.stopPropagation();
            const rating = index + 1;
            const currentRating = getPhotoRating(photoId);
            
            // If clicking the same star again, unrate (set to 0)
            const newRating = (currentRating === rating) ? 0 : rating;
            
            setPhotoRating(photoId, newRating);
            updateStarDisplay(stars, newRating);
            
            // Also update the corresponding gallery star rating
            updateGalleryStarRating(photoId, newRating);
            
            // Feedback removed - no popup needed
        });
    });
    
    // Reset hover effect when leaving the rating area
    starRatingElement.addEventListener('mouseleave', () => {
        const currentRating = getPhotoRating(photoId);
        updateStarDisplay(stars, currentRating);
    });
}

function updateGalleryStarRating(photoId, rating) {
    // Find and update the corresponding gallery star rating
    const galleryStarRating = document.querySelector(`[data-photo-id="${photoId}"]`);
    if (galleryStarRating && galleryStarRating !== document.getElementById('fullscreenStarRating')) {
        const galleryStars = galleryStarRating.querySelectorAll('.star');
        updateStarDisplay(galleryStars, rating);
    }
}

// Fullscreen feedback function removed - no popups needed

// Setup full-screen viewer event listeners
function setupFullscreenViewer() {
    // Close button
    closeViewerBtn.addEventListener('click', closeFullscreenViewer);
    
    // Navigation buttons
    prevPhotoBtn.addEventListener('click', showPreviousPhoto);
    nextPhotoBtn.addEventListener('click', showNextPhoto);
    
    // Close on background click
    fullscreenViewer.addEventListener('click', (e) => {
        if (e.target === fullscreenViewer) {
            closeFullscreenViewer();
        }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!fullscreenViewer.classList.contains('active')) return;
        
        switch(e.key) {
            case 'Escape':
                closeFullscreenViewer();
                break;
            case 'ArrowLeft':
                showPreviousPhoto();
                break;
            case 'ArrowRight':
                showNextPhoto();
                break;
        }
    });
}

// Initialize the gallery page
async function init() {
    console.log('Starting gallery page initialization...');
    
    // Try loading from S3 first, fallback to localStorage if needed
    const s3Success = await loadPhotosFromS3();
    
    if (!s3Success) {
        console.log('S3 loading failed, falling back to localStorage');
        loadPhotosFromStorage();
    }
    
    await loadGallery();
    setupNavigation();
    setupFullscreenViewer();
}

// Star Rating Functions
function generateStarHTML(rating = 0) {
    let starsHTML = '';
    for (let i = 1; i <= 5; i++) {
        const filled = i <= rating ? 'filled' : '';
        starsHTML += `<span class="star ${filled}" data-rating="${i}">★</span>`;
    }
    return starsHTML;
}

function getPhotoRating(photoId) {
    const ratings = JSON.parse(localStorage.getItem('photoRatings') || '{}');
    return ratings[photoId] || 0;
}

function setPhotoRating(photoId, rating) {
    const ratings = JSON.parse(localStorage.getItem('photoRatings') || '{}');
    ratings[photoId] = rating;
    localStorage.setItem('photoRatings', JSON.stringify(ratings));
}

function setupStarRating(photoElement) {
    const starRating = photoElement.querySelector('.star-rating');
    if (!starRating) {
        console.error('Star rating element not found');
        return;
    }
    
    const stars = starRating.querySelectorAll('.star');
    if (stars.length === 0) {
        console.error('No star elements found');
        return;
    }
    
    const photoId = starRating.getAttribute('data-photo-id');
    console.log('Setting up star rating for:', photoId);
    
    stars.forEach((star, index) => {
        // Hover effect
        star.addEventListener('mouseenter', () => {
            highlightStars(stars, index + 1);
        });
        
        // Click to rate
        star.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent opening fullscreen viewer
            const rating = index + 1;
            const currentRating = getPhotoRating(photoId);
            
            // If clicking the same star again, unrate (set to 0)
            const newRating = (currentRating === rating) ? 0 : rating;
            
            setPhotoRating(photoId, newRating);
            updateStarDisplay(stars, newRating);
            
            // Feedback removed - no popup needed
        });
    });
    
    // Reset hover effect when leaving the rating area
    starRating.addEventListener('mouseleave', () => {
        const currentRating = getPhotoRating(photoId);
        updateStarDisplay(stars, currentRating);
    });
}

function highlightStars(stars, rating) {
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('hovered');
        } else {
            star.classList.remove('hovered');
        }
    });
}

function updateStarDisplay(stars, rating) {
    stars.forEach((star, index) => {
        star.classList.remove('hovered');
        if (index < rating) {
            star.classList.add('filled');
        } else {
            star.classList.remove('filled');
        }
    });
}

// Gallery feedback function removed - no popups needed

// Debugging function for deployment issues
function debugStarRating() {
    console.log('=== Star Rating Debug Info ===');
    console.log('Photo items found:', document.querySelectorAll('.photo-item').length);
    console.log('Star rating containers found:', document.querySelectorAll('.photo-rating').length);
    console.log('Star elements found:', document.querySelectorAll('.star').length);
    console.log('LocalStorage available:', typeof(Storage) !== "undefined");
    
    // Test click on first star
    const firstStar = document.querySelector('.star');
    if (firstStar) {
        console.log('First star found, testing click...');
        firstStar.style.border = '2px solid red'; // Visual indicator
    } else {
        console.error('No stars found on page!');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    init();
    
    // Add debug function to window for manual testing
    window.debugStarRating = debugStarRating;
    
    // Auto-debug after 2 seconds
    setTimeout(() => {
        debugStarRating();
    }, 2000);
}); 