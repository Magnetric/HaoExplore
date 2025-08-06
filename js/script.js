// S3 Configuration for fetching gallery data
const S3_CONFIG = {
    bucketName: 'haophotography',
    region: 'eu-north-1'
};

// Load galleries from S3 metadata or fallback to localStorage/default data
let galleries = [];

// Load galleries from S3 metadata
async function loadGalleriesFromS3() {
    try {
        console.log('Attempting to load galleries from S3 metadata...');
        
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
        console.log('Metadata version:', metadata.version);
        
        // Check if this is the new optimized format
        if (metadata.version === '2.0-optimized' && metadata.gallerySummaries) {
            console.log('Using optimized metadata format (gallerySummaries)');
            
            // Convert gallerySummaries to gallery format for display
            galleries = metadata.gallerySummaries.map(summary => ({
                id: summary.id,
                name: summary.name,
                location: summary.country,
                year: new Date().getFullYear(), // Default year, could be extracted from tags
                photos: [], // Photos not loaded here - will be fetched when gallery is opened
                photoCount: summary.photoCount,
                coverImage: summary.coverPhoto ? summary.coverPhoto.image : null,
                coverThumbnail: summary.coverPhoto ? (summary.coverPhoto.thumbnail || summary.coverPhoto.image) : null,
                continent: summary.continent,
                country: summary.country,
                description: summary.description,
                metadataPath: summary.metadataPath
            }));
            
            const galleryCovers = metadata.galleryCovers || [];
            
            console.log('Loaded galleries from optimized metadata:', galleries.length);
            
            // Save summary data to localStorage
            localStorage.setItem('gallerySummaries', JSON.stringify(metadata.gallerySummaries));
            localStorage.setItem('galleryCovers', JSON.stringify(galleryCovers));
            localStorage.setItem('lastS3Update', new Date().toISOString());
            localStorage.setItem('metadataVersion', metadata.version);
            
        } else {
            console.log('Using legacy metadata format (full photos array)');
            
            // Extract galleries and photos from centralized metadata (old format)
            const photos = metadata.photos || [];
            const galleryCovers = metadata.galleryCovers || [];
            
            // Group photos by gallery
            const galleryMap = new Map();
            
            photos.forEach(photo => {
                const galleryId = photo.galleryId || 'default';
                const galleryName = photo.galleryName || 'Uncategorized';
                
                if (!galleryMap.has(galleryId)) {
                    galleryMap.set(galleryId, {
                        id: galleryId,
                        name: galleryName,
                        location: photo.location,
                        year: photo.year,
                        photos: [],
                        coverImage: null,
                        coverThumbnail: null
                    });
                }
                
                const gallery = galleryMap.get(galleryId);
                gallery.photos.push(photo);
                
                // Use the first photo as cover, prefer thumbnail if available
                if (!gallery.coverImage) {
                    gallery.coverImage = photo.image;
                    gallery.coverThumbnail = photo.thumbnail || photo.image;
                }
            });
            
            galleries = Array.from(galleryMap.values());
            
            // Apply custom cover photos if available
            console.log('Found gallery covers:', galleryCovers);
            
            galleries.forEach(gallery => {
                console.log(`Checking gallery ${gallery.id} (${gallery.name}) for cover photo`);
                // Try to match by both string and numeric comparison
                const coverInfo = galleryCovers.find(cover => 
                    cover.galleryId == gallery.id || 
                    cover.galleryId == parseInt(gallery.id) || 
                    cover.galleryId == gallery.id.toString()
                );
                if (coverInfo && coverInfo.coverPhoto) {
                    console.log(`Applying cover photo for gallery ${gallery.id}:`, coverInfo.coverPhoto);
                    gallery.coverImage = coverInfo.coverPhoto.image;
                    gallery.coverThumbnail = coverInfo.coverPhoto.thumbnail || coverInfo.coverPhoto.image;
                } else {
                    console.log(`No cover photo found for gallery ${gallery.id}`);
                }
            });
            
            console.log('Loaded galleries from legacy metadata:', galleries.length);
            
            // Save to localStorage as backup for offline viewing
            localStorage.setItem('galleryPhotos', JSON.stringify(photos));
            localStorage.setItem('galleryCovers', JSON.stringify(galleryCovers));
            localStorage.setItem('lastS3Update', new Date().toISOString());
            localStorage.setItem('metadataVersion', metadata.version || '1.0');
        }
        
        return true;
        
    } catch (error) {
        console.error('Error loading galleries from S3:', error);
        console.log('Falling back to localStorage or default data...');
        return false;
    }
}

function loadGalleriesFromStorage() {
    const savedPhotos = localStorage.getItem('galleryPhotos');
    if (savedPhotos) {
        const photos = JSON.parse(savedPhotos);
        
        // Group photos by gallery
        const galleryMap = new Map();
        
        photos.forEach(photo => {
            const galleryId = photo.galleryId || 'default';
            const galleryName = photo.galleryName || 'Uncategorized';
            
            if (!galleryMap.has(galleryId)) {
                galleryMap.set(galleryId, {
                    id: galleryId,
                    name: galleryName,
                    location: photo.location,
                    year: photo.year,
                    photos: [],
                    coverImage: null,
                    coverThumbnail: null
                });
            }
            
            const gallery = galleryMap.get(galleryId);
            gallery.photos.push(photo);
            
            // Use the first photo as cover, prefer thumbnail if available
            if (!gallery.coverImage) {
                gallery.coverImage = photo.image;
                gallery.coverThumbnail = photo.thumbnail || photo.image;
            }
        });
        
        galleries = Array.from(galleryMap.values());
        
        // Apply custom cover photos if available
        const galleryCovers = JSON.parse(localStorage.getItem('galleryCovers') || '[]');
        console.log('Found gallery covers:', galleryCovers);
        
        galleries.forEach(gallery => {
            console.log(`Checking gallery ${gallery.id} (${gallery.name}) for cover photo`);
            // Try to match by both string and numeric comparison
            const coverInfo = galleryCovers.find(cover => 
                cover.galleryId == gallery.id || 
                cover.galleryId == parseInt(gallery.id) || 
                cover.galleryId == gallery.id.toString()
            );
            if (coverInfo && coverInfo.coverPhoto) {
                console.log(`Applying cover photo for gallery ${gallery.id}:`, coverInfo.coverPhoto);
                gallery.coverImage = coverInfo.coverPhoto.image;
                gallery.coverThumbnail = coverInfo.coverPhoto.thumbnail || coverInfo.coverPhoto.image;
            } else {
                console.log(`No cover photo found for gallery ${gallery.id}`);
            }
        });
        console.log('Loaded galleries from localStorage:', galleries.length);
    } else {
        // No saved data, use empty array
        galleries = [];
        console.log('No galleries found in localStorage');
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
    
    // Try loading from S3 first, fallback to localStorage if needed
    const s3Success = await loadGalleriesFromS3();
    
    if (!s3Success) {
        console.log('S3 loading failed, falling back to localStorage');
        loadGalleriesFromStorage();
    }
    
    currentFilteredGalleries = [...galleries];
    console.log('Initialized with galleries:', galleries.length, 'Filtered:', currentFilteredGalleries.length);
    loadGalleries();
    setupFilters();
    setupNavigation();
    setupSmoothScrolling();
    // setupRealTimeUpdates(); // Temporarily disabled to prevent conflicts
}

// Setup real-time updates from admin panel
function setupRealTimeUpdates() {
    // Wait 10 seconds after page load before starting real-time updates
    // This prevents conflicts with initial loading
    setTimeout(() => {
        console.log('Starting real-time updates...');
        
        // Check for updates every 5 seconds (increased from 2 seconds)
        setInterval(checkForUpdates, 5000);
        
        // Also check when the page becomes visible (user switches back to tab)
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                // Add small delay to prevent conflicts
                setTimeout(checkForUpdates, 1000);
            }
        });
        
        // Check for updates when window gains focus
        window.addEventListener('focus', () => {
            // Add small delay to prevent conflicts
            setTimeout(checkForUpdates, 1000);
        });
    }, 10000); // Wait 10 seconds before starting
}

// Check if there are new photos or galleries
async function checkForUpdates() {
    console.log('Checking for updates...');
    
    // Check what metadata version we're using
    const metadataVersion = localStorage.getItem('metadataVersion');
    
    if (metadataVersion === '2.0-optimized') {
        console.log('Using optimized metadata - checking S3 for updates');
        
        try {
            // Fetch latest metadata from S3
            const metadataUrl = `https://${S3_CONFIG.bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/galleries/metadata.json`;
            const response = await fetch(metadataUrl + '?t=' + Date.now());
            
            if (response.ok) {
                const newMetadata = await response.json();
                const lastUpdate = localStorage.getItem('lastS3Update');
                
                console.log('Metadata lastUpdated:', newMetadata.lastUpdated);
                console.log('Stored lastS3Update:', lastUpdate);
                
                // Check if metadata has been updated since last fetch
                // Only update if we have a stored timestamp AND it's different
                if (lastUpdate && newMetadata.lastUpdated && newMetadata.lastUpdated !== lastUpdate) {
                    console.log('Detected updated metadata, refreshing galleries...');
                    
                    // Convert gallerySummaries to gallery format
                    const newGalleries = newMetadata.gallerySummaries.map(summary => ({
                        id: summary.id,
                        name: summary.name,
                        location: summary.country,
                        year: new Date().getFullYear(),
                        photos: [],
                        photoCount: summary.photoCount,
                        coverImage: summary.coverPhoto ? summary.coverPhoto.image : null,
                        coverThumbnail: summary.coverPhoto ? (summary.coverPhoto.thumbnail || summary.coverPhoto.image) : null,
                        continent: summary.continent,
                        country: summary.country,
                        description: summary.description,
                        metadataPath: summary.metadataPath
                    }));
                    
                    const oldCount = galleries.length;
                    galleries = newGalleries;
                    currentFilteredGalleries = [...galleries];
                    loadGalleries();
                    setupFilters();
                    
                    // Update localStorage
                    localStorage.setItem('gallerySummaries', JSON.stringify(newMetadata.gallerySummaries));
                    localStorage.setItem('galleryCovers', JSON.stringify(newMetadata.galleryCovers || []));
                    localStorage.setItem('lastS3Update', newMetadata.lastUpdated);
                    
                    showUpdateNotification();
                    console.log(`Gallery updated: ${oldCount} → ${galleries.length} galleries`);
                } else {
                    console.log('No metadata changes detected');
                }
            }
        } catch (error) {
            console.error('Error checking for metadata updates:', error);
        }
        
    } else {
        console.log('Using legacy metadata - checking localStorage');
        
        // Legacy update checking (for backwards compatibility)
        const savedPhotos = localStorage.getItem('galleryPhotos');
        if (savedPhotos) {
            const newPhotos = JSON.parse(savedPhotos);
            
            // Group new photos into galleries
            const galleryMap = new Map();
            newPhotos.forEach(photo => {
                const galleryId = photo.galleryId || 'default';
                const galleryName = photo.galleryName || 'Uncategorized';
                
                if (!galleryMap.has(galleryId)) {
                    galleryMap.set(galleryId, {
                        id: galleryId,
                        name: galleryName,
                        location: photo.location,
                        year: photo.year,
                        photos: [],
                        coverImage: null,
                        coverThumbnail: null
                    });
                }
                
                const gallery = galleryMap.get(galleryId);
                gallery.photos.push(photo);
                
                // Use the first photo as cover, prefer thumbnail if available
                if (!gallery.coverImage) {
                    gallery.coverImage = photo.image;
                    gallery.coverThumbnail = photo.thumbnail || photo.image;
                }
            });
            
            const newGalleries = Array.from(galleryMap.values());
            
            // Apply custom cover photos to new galleries
            const galleryCovers = JSON.parse(localStorage.getItem('galleryCovers') || '[]');
            newGalleries.forEach(gallery => {
                const coverInfo = galleryCovers.find(cover => 
                    cover.galleryId == gallery.id || 
                    cover.galleryId == parseInt(gallery.id) || 
                    cover.galleryId == gallery.id.toString()
                );
                if (coverInfo && coverInfo.coverPhoto) {
                    console.log(`Applying cover photo for gallery ${gallery.id} in update:`, coverInfo.coverPhoto);
                    gallery.coverImage = coverInfo.coverPhoto.image;
                    gallery.coverThumbnail = coverInfo.coverPhoto.thumbnail || coverInfo.coverPhoto.image;
                }
            });
            
            // Check if galleries have changed
            if (JSON.stringify(newGalleries) !== JSON.stringify(galleries)) {
                console.log('Detected new galleries, updating gallery...');
                const oldCount = galleries.length;
                galleries = newGalleries;
                currentFilteredGalleries = [...galleries];
                loadGalleries();
                setupFilters(); // Re-populate filters with new data
                showUpdateNotification();
                console.log(`Gallery updated: ${oldCount} → ${galleries.length} galleries`);
            } else {
                console.log('No gallery changes detected');
            }
        }
    }
}

// Show notification when gallery is updated
function showUpdateNotification() {
    // Remove existing notification
    const existingNotification = document.querySelector('.update-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-sync-alt"></i>
            <span>Gallery updated with new content!</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Load galleries into the gallery grid
function loadGalleries() {
    galleryGrid.innerHTML = '';
    console.log('Loading galleries. Total:', currentFilteredGalleries.length);
    
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
    
    // Use thumbnail if available, otherwise use original image
    const coverImage = gallery.coverThumbnail || gallery.coverImage;
    
    article.innerHTML = `
        <img src="${coverImage}" alt="${gallery.name}" loading="lazy">
        <div class="gallery-info">
            <h3 class="gallery-title">${gallery.name}</h3>
            <div class="gallery-meta">
                <span><i class="fas fa-map-marker-alt"></i> ${gallery.location}</span>
                <span><i class="fas fa-calendar"></i> ${gallery.year}</span>
                <span><i class="fas fa-images"></i> ${gallery.photoCount || gallery.photos.length} photos</span>
            </div>
        </div>
    `;
    
    article.addEventListener('click', () => {
        window.location.href = `gallery.html?gallery=${gallery.id}`;
    });
    return article;
}

// Setup filters
function setupFilters() {
    // Clear existing options
    yearFilter.innerHTML = '<option value="">All Years</option>';
    locationFilter.innerHTML = '<option value="">All Locations</option>';
    
    // Populate year filter
    const years = [...new Set(galleries.map(gallery => gallery.year))].sort((a, b) => b - a);
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
    
    // Populate location filter
    const locations = [...new Set(galleries.map(gallery => gallery.location))].sort();
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });
    
    // Add event listeners
    yearFilter.addEventListener('change', filterGalleries);
    locationFilter.addEventListener('change', filterGalleries);
    clearFiltersBtn.addEventListener('click', clearFilters);
}

// Filter galleries based on selected criteria
function filterGalleries() {
    const selectedYear = yearFilter.value;
    const selectedLocation = locationFilter.value;
    
    currentFilteredGalleries = galleries.filter(gallery => {
        const yearMatch = !selectedYear || gallery.year == selectedYear;
        const locationMatch = !selectedLocation || gallery.location === selectedLocation;
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
    });
    
    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });
}

// Setup smooth scrolling for navigation links
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
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