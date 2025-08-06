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
function getGalleryData() {
    const galleryId = getGalleryIdFromUrl();
    
    if (galleryId) {
        // Find gallery from localStorage
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
function loadGallery() {
    const gallery = getGalleryData();
    
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
    
    photoElement.innerHTML = `
        <img src="${photo.thumbnail || photo.image}" alt="${photo.title}" loading="lazy">
        <div class="photo-overlay">
            <div class="photo-info">
            </div>
        </div>
    `;
    
    // Add click event to open full-screen viewer
    photoElement.addEventListener('click', () => {
        openFullscreenViewer(index);
    });
    
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
    
    loadGallery();
    setupNavigation();
    setupFullscreenViewer();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 