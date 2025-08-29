// Gallery Edit Script - API Version
// Complete rewrite to use Lambda API instead of direct S3 operations

// ==================== CONFIGURATION ====================
const API_BASE_URL = 'https://5nuxhstp12.execute-api.eu-north-1.amazonaws.com/prod';

// ==================== API CLIENT ====================
class GalleryAPI {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    async getGallery(galleryId) {
        try {
            const response = await fetch(`${this.baseUrl}/galleries?id=${galleryId}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get gallery');
            }

            const data = await response.json();
            return normalizeGalleryFromDynamoDB(data);
        } catch (error) {
            console.error('Error getting gallery:', error);
            throw error;
        }
    }

    async updateGallery(galleryData) {
        try {
            const response = await fetch(`${this.baseUrl}/galleries`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(galleryData)
            });

            console.log('API response status:', response.status);
            console.log('API response headers:', response.headers);

            if (!response.ok) {
                const error = await response.json();
                console.error('API error response:', error);
                throw new Error(error.error || 'Failed to update gallery');
            }

            const result = await response.json();
            console.log('API success response:', result);
            return result;
        } catch (error) {
            console.error('Error updating gallery:', error);
            throw error;
        }
    }

    async deletePhoto(galleryId, payload) {
        const response = await fetch(`${this.baseUrl}/galleries?id=${encodeURIComponent(galleryId)}&action=delete_photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to delete photo');
        }
        return await response.json();
    }

    async getUploadUrls(galleryId, photosData) {
        try {
            const response = await fetch(`${this.baseUrl}/galleries?id=${galleryId}&action=get_upload_urls`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ photos: photosData })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get upload URLs');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting upload URLs:', error);
            throw error;
        }
    }

    async updateGalleryPhotos(galleryId, photosData) {
        try {
            const response = await fetch(`${this.baseUrl}/galleries?action=update_GalleryPhotos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    galleryId: galleryId,
                    photos: photosData
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update gallery photos');
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating gallery photos:', error);
            throw error;
        }
    }
}

// Initialize API client
const galleryAPI = new GalleryAPI(API_BASE_URL);

// ==================== STATE MANAGEMENT ====================
let currentGallery = null;
let currentGalleryYears = [];
let currentPhotoYears = [];
let photos = [];
let originalPhotos = []; // Store original photo data to detect changes
let isFormModified = false; // Track form modification state

// ==================== UTILITY FUNCTIONS ====================
// Convert image to WebP format with optimized compression
async function convertToWebP(file, quality = 0.8) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Get original image dimensions
            const w = img.naturalWidth;
            const h = img.naturalHeight;

            // Set canvas size to original dimensions
            canvas.width = w;
            canvas.height = h;

            // Enable high quality image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Draw the original image to canvas
            ctx.drawImage(img, 0, 0, w, h);

            // Convert canvas to WebP Blob
            canvas.toBlob((blob) => {
                blob.width = w;
                blob.height = h;
                resolve(blob);
            }, 'image/webp', quality);
        };

        img.src = URL.createObjectURL(file);
    });
}


// Generate thumbnail with optimized compression
async function generateThumbnail(file, maxWidth = 2000, quality = 0.4) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // Calculate new dimensions maintaining aspect ratio
            let { width, height } = img;
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            // For thumbnails, we can be more aggressive with size reduction
            // If the calculated size is still large, reduce it further
            if (width > 1500) {
                const scale = 1500 / width;
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Use high-quality image smoothing for better thumbnail quality
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw and compress with optimized settings
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                // Add dimensions to blob for reference
                blob.width = width;
                blob.height = height;
                resolve(blob);
            }, 'image/webp', quality);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// Upload file to S3 using presigned URL
async function uploadToS3(presignedUrl, file) {
    try {
        const response = await fetch(presignedUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type,
            }
        });

        if (!response.ok) {
            throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
        }

        return true;
    } catch (error) {
        console.error('S3 upload error:', error);
        throw error;
    }
}

// Normalize gallery object returned from DynamoDB to the shape the editor expects
function normalizeGalleryFromDynamoDB(gallery) {
    if (!gallery) return gallery;
    const normalized = { ...gallery };

    // Ensure id exists
    normalized.id = normalized.id || normalized.galleryId || normalized.ID || normalized.Id;

    // Photos from DynamoDB may have keys photoId/photoNumber
    const rawPhotos = normalized.photos || [];
    normalized.photos = rawPhotos.map(p => ({
        ...p,
        id: p.id || p.photoId || (p.photoNumber ? `photo-${p.photoNumber}` : undefined),
        thumbnailKey: p.thumbnailKey || p.s3Key
    }));

    return normalized;
}

// Get gallery ID from URL parameter
function getGalleryIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('gallery');
    //console.log("galleryid", urlParams)
}

// Show message to user
function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.admin-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message element
    const messageElement = document.createElement('div');
    messageElement.className = `admin-message admin-message-${type}`;
    messageElement.innerHTML = `
        <div class="message-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="message-close">&times;</button>
        </div>
    `;
    
    // Add to page
    const container = document.querySelector('.edit-container');
    if (container) {
        container.insertBefore(messageElement, container.firstChild);
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageElement.parentElement) {
            messageElement.remove();
        }
    }, 5000);
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Safe taken date formatting
function formatDate(value) {
    try {
        if (!value) return null;
        const d = new Date(value);
        if (isNaN(d.getTime())) return null;
        
        // Check if the date is recent (within 2 days) - likely upload date
        const now = new Date();
        const diffDays = (now - d) / (1000 * 60 * 60 * 24);
        
        if (diffDays < 2) {
            return d.toLocaleDateString() + ' (Recent)';
        }
        
        // Format as YYYY-MM-DD for older dates (likely actual photo date)
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (_) {
        return null;
    }
}

// Detect image resolution by loading the image
function detectPhotoResolution(photo) {
    return new Promise((resolve, reject) => {
        const src = photo.image || photo.thumbnail;
        if (!src) return reject(new Error('no image'));
        const img = new Image();
        img.onload = function () {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = reject;
        img.src = src;
    });
}

// ==================== GALLERY MANAGEMENT ====================

// Load gallery data from API
async function loadGallery() {
    try {
        const galleryId = getGalleryIdFromUrl();
        
        if (!galleryId) {
            showMessage('No gallery ID specified in URL', 'error');
            return;
        }
        
        console.log('Loading gallery from API:', galleryId);
        showMessage('Loading gallery...', 'info');
        
        currentGallery = await galleryAPI.getGallery(galleryId);
        photos = currentGallery.photos || [];
        currentGalleryYears = currentGallery.years || [];
        
        // Convert coverPhotoURL to coverPhoto object for frontend compatibility
        if (currentGallery.coverPhotoURL && !currentGallery.coverPhoto) {
            // Find the photo that matches the coverPhotoURL
            const coverPhoto = photos.find(photo => 
                photo.thumbnail === currentGallery.coverPhotoURL || 
                photo.image === currentGallery.coverPhotoURL
            );
            
            if (coverPhoto) {
                currentGallery.coverPhoto = {
                    id: coverPhoto.id,
                    title: coverPhoto.title || coverPhoto.name,
                    image: coverPhoto.image,
                    thumbnail: coverPhoto.thumbnail,
                    s3Key: coverPhoto.s3Key
                };
            }
        }
        
        // Store original photo data to detect changes
        originalPhotos = photos.map(photo => ({
            id: photo.id,
            name: photo.name || photo.title || '',
            title: photo.title || photo.name || ''
        }));
        
        console.log('Gallery loaded successfully:', currentGallery.name, 'with', photos.length, 'photos');
        
        // Update page UI
        updateGalleryInfo();
        updatePhotosGrid();
        updateYearsDisplay();
        updateCoverPhotoDisplay();
        
        // Ensure photo count is accurate by updating from server data
        if (currentGallery.photoCount !== undefined && currentGallery.photoCount !== photos.length) {
            console.log(`Photo count mismatch: server=${currentGallery.photoCount}, local=${photos.length}, updating...`);
            currentGallery.photoCount = photos.length;
            updatePhotoCountDisplay();
        }
        
        // Clear loading message
        setTimeout(() => {
            const loadingMsg = document.querySelector('.admin-message-info');
            if (loadingMsg && loadingMsg.textContent.includes('Loading')) {
                loadingMsg.remove();
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error loading gallery:', error);
        showMessage('Error loading gallery: ' + error.message, 'error');
        
        // Show error state
        const container = document.querySelector('.edit-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <h3>Failed to Load Gallery</h3>
                    <p>Error: ${error.message}</p>
                    <button onclick="window.location.href='admin.html'" class="btn btn-primary">
                        <i class="fas fa-arrow-left"></i> Back to Admin
                    </button>
                </div>
            `;
        }
    }
}

// Update gallery information display
function updateGalleryInfo() {
    if (!currentGallery) return;
    
    // Update page title
    document.title = `Edit ${currentGallery.name} - Gallery Admin`;
    
    // Update gallery header
    const galleryName = document.getElementById('galleryName');
    const galleryLocation = document.getElementById('galleryLocation');
    const galleryDescription = document.getElementById('galleryDescription');
    
    if (galleryName) galleryName.textContent = currentGallery.name;
    if (galleryLocation) galleryLocation.textContent = `${currentGallery.continent}, ${currentGallery.country}`;
    if (galleryDescription) galleryDescription.textContent = currentGallery.description || 'No description';
    
    // Update form fields
    const nameInput = document.getElementById('editGalleryName');
    const descInput = document.getElementById('editGalleryDescription');
    
    if (nameInput) nameInput.value = currentGallery.name;
    if (descInput) descInput.value = currentGallery.description || '';
    
    // Update photo count display
    updatePhotoCountDisplay();
}

// Update photo count display
function updatePhotoCountDisplay() {
    if (!currentGallery) return;
    
    const photoCount = document.getElementById('photoCount');
    if (photoCount) {
        // Use the actual photos array length for real-time accuracy
        photoCount.textContent = photos.length;
        
        // Also update the currentGallery.photoCount for consistency
        currentGallery.photoCount = photos.length;
        
        // Add a small visual indicator that the count was updated
        photoCount.classList.add('count-updated');
        setTimeout(() => {
            photoCount.classList.remove('count-updated');
        }, 1000);
    }
}

// Refresh photo count from server to ensure accuracy
async function refreshPhotoCountFromServer() {
    if (!currentGallery) return;
    
    try {
        console.log('Refreshing photo count from server...');
        
        // Show loading state
        const photoCount = document.getElementById('photoCount');
        const refreshBtn = document.querySelector('.btn-refresh-count');
        
        if (photoCount) {
            photoCount.textContent = '...';
            photoCount.style.opacity = '0.6';
        }
        
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            refreshBtn.disabled = true;
        }
        
        // Reload the gallery to get the latest photo count
        await loadGallery();
        
        console.log('Photo count refreshed from server');
        
        // Show success message
        showMessage('Photo count refreshed successfully', 'success');
        
    } catch (error) {
        console.error('Error refreshing photo count from server:', error);
        showMessage('Failed to refresh photo count from server', 'warning');
        
        // Restore original state on error
        if (photoCount) {
            photoCount.textContent = photos.length;
            photoCount.style.opacity = '1';
        }
    } finally {
        // Restore button state
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            refreshBtn.disabled = false;
        }
        
        // Restore photo count display
        if (photoCount) {
            photoCount.style.opacity = '1';
        }
    }
}

// Update photos grid display
function updatePhotosGrid() {
    const photosGrid = document.getElementById('photosGrid');
    if (!photosGrid) return;
    
    if (photos.length === 0) {
        photosGrid.innerHTML = `
            <div class="no-photos">
                <i class="fas fa-images" style="font-size: 3rem; color: #bdc3c7; margin-bottom: 1rem;"></i>
                <h4>No Photos</h4>
                <p>This gallery doesn't have any photos yet.</p>
                <p><strong>Note:</strong> Photo upload functionality will be added in a future update.</p>
            </div>
        `;
        return;
    }

    photosGrid.innerHTML = photos.map((photo, index) => `
        <div class="photo-item-enhanced" data-photo-index="${index}" data-photo-id="${photo.photoId || photo.id || index}" data-sort-order="${photo.sortOrder || index + 1}">
            <!-- Drag Handle - positioned at top left -->
            <div class="drag-handle" draggable="true" onmousedown="event.stopPropagation();" onmouseover="this.style.background='rgba(255,255,255,1)'" onmouseout="this.style.background='rgba(255,255,255,0.9)'">
                <i class="fas fa-grip-vertical" style="color: #6c757d; font-size: 12px;"></i>
            </div>
            
            <!-- Sort Order Indicator - positioned at top right -->
            <div class="sort-order-indicator">
                #${photo.sortOrder || index + 1}
            </div>
            
            <div class="photo-image-container">
                <img src="${photo.thumbnail}" alt="${photo.title || 'Photo'}" loading="lazy" class="photo-img">
                <div class="photo-overlay"></div>
            </div>
            <div class="photo-details-enhanced">
                <input class="photo-title-enhanced" data-index="${index}" value="${(photo.name || photo.title || '').replace(/"/g, '&quot;')}" placeholder="Enter photo title..." />
                <div class="photo-metadata">
                    <div class="metadata-row">
                        <div class="metadata-item">
                            <i class="fas fa-expand-arrows-alt metadata-icon"></i>
                            <span class="metadata-label">Resolution:</span>
                            <span class="metadata-value" id="res-${index}">${(photo.width && photo.height) ? `${photo.width} × ${photo.height}` : 'Loading...'}</span>
                        </div>
                    </div>
                    <div class="metadata-row">
                        <div class="metadata-item">
                            <i class="fas fa-file-alt metadata-icon"></i>
                            <span class="metadata-label">File Size:</span>
                            <span class="metadata-value">${photo.fileSize}</span>
                        </div>
                    </div>
                    <div class="metadata-row">
                        <div class="metadata-item">
                            <i class="fas fa-camera metadata-icon"></i>
                            <span class="metadata-label">Taken:</span>
                            <span class="metadata-value">${formatDate(photo.takenAt) || formatDate(photo.uploadedAt) || 'Unknown'}</span>
                        </div>
                    </div>
                    ${photo.format ? `
                    <div class="metadata-row">
                        <div class="metadata-item">
                            <i class="fas fa-image metadata-icon"></i>
                            <span class="metadata-label">Format:</span>
                            <span class="metadata-value">${photo.format}</span>
                        </div>
                    </div>
                    ` : ''}
                    <button class="btn-delete-enhanced" title="Remove photo" onclick="deletePhotoConfirm(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    // Title inline editing
    photosGrid.querySelectorAll('.photo-title-enhanced').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'), 10);
            if (!Number.isNaN(idx) && photos[idx]) {
                // Update both name and title fields for compatibility
                photos[idx].name = e.target.value;
                photos[idx].title = e.target.value;
                
                // Mark photo as modified
                photos[idx]._modified = true;
            }
        });
    });

    // Populate resolution if unknown
    photos.forEach((photo, index) => {
        if (!(photo.width && photo.height)) {
            detectPhotoResolution(photo).then(dim => {
                photo.width = dim.width;
                photo.height = dim.height;
                const el = document.getElementById(`res-${index}`);
                if (el) el.textContent = `${dim.width}×${dim.height}`;
            }).catch(() => {
                const el = document.getElementById(`res-${index}`);
                if (el) el.textContent = 'Unknown';
            });
        }
    });
    
    // Setup drag and drop functionality for photos
    setupPhotoDragAndDrop();
}

// ==================== PHOTO MANAGEMENT ====================

// Add new photo functionality
function addNewPhoto() {
    // Show the upload modal
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
        uploadModal.style.display = 'block';
        // Reset upload state
        resetUploadState();
    } else {
        showMessage('Upload modal not found', 'error');
    }
}

// Reset upload modal state
function resetUploadState() {
    const uploadInput = document.getElementById('photoUpload');
    const uploadBtn = document.getElementById('uploadBtn');
    const progressDiv = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (uploadInput) uploadInput.value = '';
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Photos';
    }
    if (progressDiv) progressDiv.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';
}

// Close upload modal
function closeUploadModal() {
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
        uploadModal.style.display = 'none';
    }
}

// Handle file selection
function handleFileSelect(event) {
    const files = event.target.files;
    const uploadBtn = document.getElementById('uploadBtn');
    
    if (files && files.length > 0) {
        console.log(`Selected ${files.length} files for upload`);
        
        // Validate files
        const validFiles = [];
        const maxSize = 100 * 1024 * 1024; // 100MB
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
        
        for (let file of files) {
            if (!allowedTypes.includes(file.type)) {
                showMessage(`File ${file.name} is not a supported image format`, 'warning');
                continue;
            }
            if (file.size > maxSize) {
                showMessage(`File ${file.name} is too large (max 100MB)`, 'warning');
                continue;
            }
            validFiles.push(file);
        }
        
        if (validFiles.length > 0) {
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = `<i class="fas fa-upload"></i> Upload ${validFiles.length} Photo${validFiles.length > 1 ? 's' : ''}`;
            }
            // Store files for upload
            window.selectedFiles = validFiles;
        } else {
            if (uploadBtn) {
                uploadBtn.disabled = true;
                uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Photos';
            }
            window.selectedFiles = null;
        }
    }
}

// Upload photos functionality
async function uploadPhotos() {
    const photosToUpload = window.selectedFiles;
    const uploadBtn = document.getElementById('uploadBtn');
    const progressDiv = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    try {
        // Show progress
        if (progressDiv) progressDiv.style.display = 'block';
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }
        
        // Process files: convert to WebP and generate thumbnails
        const processedPhotos = [];
        let totalSize = 0;
        
        for (let i = 0; i < photosToUpload.length; i++) {
            const photo = photosToUpload[i];
            
            // Validate file size (100MB limit)
            if (photo.size > 100 * 1024 * 1024) {
                showMessage(`File ${photo.name} is too large (max 100MB)`, 'error');
                continue;
            }
            
            try {
                // Update progress
                const progress = ((i + 0.3) / photosToUpload.length) * 100;
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (progressText) progressText.textContent = `Processing ${i + 1}/${photosToUpload.length}`;
                
                // Convert to WebP format
                const webpBlob = await convertToWebP(photo);
                
                // Generate thumbnail
                const thumbnailBlob = await generateThumbnail(photo);
                
                // Calculate total size
                totalSize += webpBlob.size + thumbnailBlob.size;
                
                processedPhotos.push({
                    originalFile: photo,
                    webpBlob: webpBlob,
                    thumbnailBlob: thumbnailBlob,
                    filename: photo.name.replace(/\.[^/.]+$/, '.webp'),
                    thumbnailFilename: photo.name.replace(/\.[^/.]+$/, '_thumb.webp')
                });
                
                console.log(`Processed ${photo.name}: WebP ${(webpBlob.size / 1024 / 1024).toFixed(2)}MB, Thumbnail ${(thumbnailBlob.size / 1024 / 1024).toFixed(2)}MB`);
            } catch (error) {
                console.error(`Error processing ${photo.name}:`, error);
                showMessage(`Error processing ${photo.name}: ${error.message}`, 'error');
                continue;
            }
        }
        
        if (processedPhotos.length === 0) {
            showMessage('No valid files to upload', 'error');
            return;
        }
        
        // Get presigned URLs from Lambda
        if (uploadBtn) {
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting upload URLs...';
        }
        
        const photosData = processedPhotos.map(photo => ({
            filename: photo.filename,
            thumbnailFilename: photo.thumbnailFilename,
            contentType: 'image/webp'
        }));
        
        console.log('Getting presigned URLs for', photosData.length, 'photos');
        const uploadUrls = await galleryAPI.getUploadUrls(currentGallery.id, photosData);
        
        if (!uploadUrls.success) {
            throw new Error(uploadUrls.error || 'Failed to get upload URLs');
        }
        
        // Upload files to S3 using presigned URLs
        if (uploadBtn) {
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading to S3...';
        }
        
        const uploadedPhotos = [];
        
        for (let i = 0; i < processedPhotos.length; i++) {
            const photo = processedPhotos[i];
            const urls = uploadUrls.upload_urls[i];
            
            try {
                // Update progress
                const progress = ((i + 0.7) / processedPhotos.length) * 100;
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (progressText) progressText.textContent = `Uploading ${i + 1}/${processedPhotos.length}`;
                
                // Upload original WebP
                await uploadToS3(urls.original_url, photo.webpBlob);
                
                // Upload thumbnail
                await uploadToS3(urls.thumbnail_url, photo.thumbnailBlob);
                
                // Prepare photo data for DynamoDB
                uploadedPhotos.push({
                    filename: photo.filename,
                    thumbnailFilename: photo.thumbnailFilename,
                    s3Key: urls.original_key,
                    thumbnailKey: urls.thumbnail_key,
                    contentType: 'image/webp',
                    fileSize: photo.webpBlob.size,
                    thumbnailSize: photo.thumbnailBlob.size,
                    width: photo.webpBlob.width || photo.originalFile.naturalWidth,
                    height: photo.webpBlob.height || photo.originalFile.naturalHeight
                });
                
                console.log(`Uploaded ${photo.filename} successfully`);
            } catch (error) {
                console.error(`Error uploading ${photo.filename}:`, error);
                showMessage(`Error uploading ${photo.filename}: ${error.message}`, 'error');
                continue;
            }
        }
        
        if (uploadedPhotos.length === 0) {
            throw new Error('No photos were uploaded successfully');
        }
        
        // Update DynamoDB with uploaded photo information
        if (uploadBtn) {
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating database...';
        }
        
        console.log('Updating DynamoDB with', uploadedPhotos.length, 'photos');
        const dbResult = await galleryAPI.updateGalleryPhotos(currentGallery.id, uploadedPhotos);
        
        console.log('Database update successful:', dbResult);
        
        // Add uploaded photos to current gallery
        if (dbResult.success && dbResult.photos_created > 0) {
            console.log('Adding uploaded photos to current gallery...');
            
            // Reload the gallery to get the updated photo list and photo count
            await loadGallery();
            
            // Update the photo count display immediately
            updatePhotoCountDisplay();
            
            showMessage(`Successfully uploaded ${dbResult.photos_created} photos!`, 'success');
        } else {
            console.warn('No photos were created in database');
            showMessage('Photos uploaded to S3 but database update failed', 'warning');
        }
        
        // Close modal and reset
        console.log('Closing upload modal...');
        closeUploadModal();
        
    } catch (error) {
        console.error('Upload error:', error);
        showMessage('Upload failed: ' + error.message, 'error');
        
        // Reset button state
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Photos';
        }
        
        // Hide progress
        if (progressDiv) progressDiv.style.display = 'none';
    }
}

// Edit photo information
function editPhotoInfo(photoIndex) {
    const photo = photos[photoIndex];
    if (!photo) return;
    
    const newTitle = prompt('Enter photo title:', photo.title || '');
    if (newTitle === null) return; // User cancelled
    
    const newDescription = prompt('Enter photo description:', photo.description || '');
    if (newDescription === null) return; // User cancelled
    
    // Update photo info
    photo.title = newTitle.trim();
    photo.description = newDescription.trim();
    
    // Update display
    updatePhotosGrid();
    
    showMessage('Photo information updated. Don\'t forget to save changes!', 'success');
}

// Delete photo with confirmation
function deletePhotoConfirm(photoIndex) {
    const photo = photos[photoIndex];
    if (!photo) return;
    
    const photoTitle = photo.title || `Photo ${photoIndex + 1}`;
    
    const confirmDelete = confirm(
        `Are you sure you want to delete "${photoTitle}"?\n\n` +
        `This action cannot be undone!`
    );
    
    if (confirmDelete) {
        performDeletePhoto(photoIndex).catch(err => {
            console.error('Delete photo error:', err);
            showMessage('Delete failed: ' + err.message, 'error');
        });
    }
}

async function performDeletePhoto(photoIndex) {
    const photo = photos[photoIndex];
    if (!photo || !currentGallery) return;

    showMessage('Deleting photo...', 'info');
    const payload = {
        photoId: photo.id || photo.photoId,
        photoNumber: photo.photoNumber || (typeof photo.id === 'string' && photo.id.startsWith('photo-') ? photo.id.split('photo-')[1] : undefined),
        s3Key: photo.s3Key
    };
    // Remove undefined
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    const result = await galleryAPI.deletePhoto(currentGallery.id || currentGallery.galleryId, payload);

    // Remove from local array
    photos.splice(photoIndex, 1);
    updatePhotosGrid();
    updateGalleryInfo();
    
    // Update the photo count display immediately
    updatePhotoCountDisplay();
    
    showMessage('Photo deleted successfully', 'success');
}

// ==================== YEAR MANAGEMENT ====================

// Add year functionality
function addYear(type) {
    const select = document.getElementById(type === 'gallery' ? 'galleryYearSelect' : 'photoYearSelect');
    const year = select.value;
    
    if (!year) return;
    
    const yearsArray = type === 'gallery' ? currentGalleryYears : currentPhotoYears;
    
    if (!yearsArray.includes(year)) {
        yearsArray.push(year);
        updateYearsDisplay();
        select.value = '';
        
        if (type === 'gallery') {
            showMessage('Gallery year added. Don\'t forget to save changes!', 'success');
        }
    }
}

// Remove year
function removeYear(type, year) {
    if (type === 'gallery') {
        currentGalleryYears = currentGalleryYears.filter(y => y !== year);
        showMessage('Gallery year removed. Don\'t forget to save changes!', 'success');
    } else {
        currentPhotoYears = currentPhotoYears.filter(y => y !== year);
    }
    updateYearsDisplay();
}

// Update years display
function updateYearsDisplay() {
    updateYearDisplay('gallery', currentGalleryYears);
    updateYearDisplay('photo', currentPhotoYears);
}

function updateYearDisplay(type, years) {
    const container = document.getElementById(`${type}Years`);
    if (!container) return;
    
    container.innerHTML = years.map(year => `
        <span class="year-tag">
            ${year}
            <button type="button" onclick="removeYear('${type}', '${year}')" class="year-remove">&times;</button>
        </span>
    `).join('');
}

// Handle change for year select
function handleYearSelect(event, type) {
    if (event.target.value) {
        addYear(type);
    }
}

// ==================== SAVE FUNCTIONALITY ====================

// Save gallery changes
async function saveGalleryChanges() {
    try {
        if (!currentGallery) {
            showMessage('No gallery data to save', 'error');
            return;
        }
        
        // Get form data
        const nameInput = document.getElementById('editGalleryName');
        const descInput = document.getElementById('editGalleryDescription');
        
        const newName = nameInput ? nameInput.value.trim() : currentGallery.name;
        const newDescription = descInput ? descInput.value.trim() : currentGallery.description;
        
        // Validate input
        if (!newName) {
            showMessage('Gallery name is required', 'error');
            if (nameInput) nameInput.focus();
            return;
        }
        
        showMessage('Saving changes...', 'info');
        
        // Prepare updated gallery data
        const updatedGallery = {
            id: currentGallery.id,
            name: newName,
            description: newDescription,
            years: [...currentGalleryYears],
        };
        
        // Add cover photo URL if cover photo is selected
        if (currentGallery.coverPhoto && currentGallery.coverPhoto.thumbnail) {
            updatedGallery.coverPhotoURL = currentGallery.coverPhoto.thumbnail;
        }
        
        // Only include photos that have been modified - just photoId and new title
        const modifiedPhotos = photos.filter(photo => photo._modified).map(photo => ({
            photoId: photo.id,
            title: photo.name || photo.title || ''
        }));
        if (modifiedPhotos.length > 0) {
            updatedGallery.photos = modifiedPhotos;
        }
        
        console.log('Sending gallery update data:', JSON.stringify(updatedGallery, null, 2));
        
        const result = await galleryAPI.updateGallery(updatedGallery);
        
        console.log('Gallery updated successfully:', result);
        showMessage('Gallery updated successfully! Redirecting to admin panel...', 'success');
        
        // Update local state
        currentGallery = { ...currentGallery, ...updatedGallery };
        
        // Clear modification flags and update original data for modified photos
        if (updatedGallery.photos) {
            updatedGallery.photos.forEach(modifiedPhoto => {
                const photoIndex = photos.findIndex(p => p.id === modifiedPhoto.photoId);
                if (photoIndex !== -1) {
                    photos[photoIndex]._modified = false;
                    // Update original data
                    const originalIndex = originalPhotos.findIndex(p => p.id === modifiedPhoto.photoId);
                    if (originalIndex !== -1) {
                        originalPhotos[originalIndex] = {
                            id: photos[photoIndex].id,
                            name: photos[photoIndex].name || photos[photoIndex].title || '',
                            title: photos[photoIndex].title || photos[photoIndex].name || ''
                        };
                    }
                }
            });
        }
        
        // Reset form modification flag
        isFormModified = false;
        
        updateGalleryInfo();
        
        // Redirect to admin panel after successful save
        setTimeout(() => {
            goBackToAdmin();
        }, 1500);
        
    } catch (error) {
        console.error('Error updating gallery:', error);
        showMessage('Error updating gallery: ' + error.message, 'error');
    }
}

// ==================== NAVIGATION ====================

// Go back to admin panel
function goBackToAdmin() {
    window.location.href = 'admin.html?tab=manage-galleries';
}

// ==================== INITIALIZATION ====================

// Setup form handlers
function setupFormHandlers() {
    // Save button handler - only bind once
    const saveBtn = document.getElementById('saveChangesBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveGalleryChanges);
    }
    
    // Year select handlers
    const galleryYearSelect = document.getElementById('galleryYearSelect');
    if (galleryYearSelect) {
        galleryYearSelect.addEventListener('change', (e) => handleYearSelect(e, 'gallery'));
    }
    
    const photoYearSelect = document.getElementById('photoYearSelect');
    if (photoYearSelect) {
        photoYearSelect.addEventListener('change', (e) => handleYearSelect(e, 'photo'));
    }
    
    // Form change detection for unsaved changes warning
    const form = document.getElementById('galleryEditForm');
    if (form) {
        // Track form changes
        form.addEventListener('input', () => {
            isFormModified = true;
        });
        
        // Warn before leaving with unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (isFormModified || hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }
}

// Initialize the gallery edit page
function init() {
    console.log('Initializing gallery edit page with API...');
    
    // Check if gallery ID is provided
    const galleryId = getGalleryIdFromUrl();
    if (!galleryId) {
        showMessage('No gallery ID provided in URL. Redirecting to admin panel...', 'error');
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 3000);
        return;
    }
    
    // Setup form handlers
    setupFormHandlers();
    
            // Initialize years display
        updateYearsDisplay();
    
    // Load gallery data
    loadGallery();
    
    console.log('Gallery edit page initialized successfully');
    console.log('API Base URL:', API_BASE_URL);
    console.log('Gallery ID:', galleryId);
    
    // Show API connection status
    console.log('Connected to Lambda API at:', API_BASE_URL);
}

// ==================== EVENT LISTENERS ====================

// Cover Photo Management
function selectCoverPhoto() {
    if (!photos || photos.length === 0) {
        showMessage('No photos available to set as cover. Please add photos first.', 'warning');
        return;
    }
    
    // Show the cover photo selection modal
    const modal = document.getElementById('coverPhotoModal');
    const grid = document.getElementById('coverPhotoGrid');
    
    // Populate the grid with photos
    grid.innerHTML = photos.map((photo, index) => `
        <div class="cover-photo-item" onclick="setCoverPhoto(${index})" data-index="${index}">
            <img src="${photo.thumbnail || photo.image}" alt="${photo.title || 'Photo'}" loading="lazy">
            <div class="photo-title">${photo.title || `Photo ${index + 1}`}</div>
        </div>
    `).join('');
    
    // Highlight current cover photo if exists
    if (currentGallery && currentGallery.coverPhoto) {
        const currentCoverIndex = photos.findIndex(photo => 
            photo.id === currentGallery.coverPhoto.id || 
            photo.image === currentGallery.coverPhoto.image ||
            photo.s3Key === currentGallery.coverPhoto.s3Key
        );
        if (currentCoverIndex !== -1) {
            const coverItem = grid.querySelector(`[data-index="${currentCoverIndex}"]`);
            if (coverItem) {
                coverItem.classList.add('selected');
            }
        }
    }
    
    modal.style.display = 'block';
}

function setCoverPhoto(photoIndex) {
    if (!photos[photoIndex]) return;
    
    selectedCoverPhotoIndex = photoIndex;
    const photo = photos[photoIndex];
    
    // Update the cover photo display
    const coverDisplay = document.getElementById('coverPhotoDisplay');
    coverDisplay.innerHTML = `<img src="${photo.thumbnail || photo.image}" alt="${photo.title || 'Cover Photo'}">`;
    coverDisplay.classList.remove('empty');
    
    // Update visual selection in grid
    document.querySelectorAll('.cover-photo-item').forEach(item => item.classList.remove('selected'));
    document.querySelector(`[data-index="${photoIndex}"]`).classList.add('selected');
    
    // Update the current gallery data
    if (currentGallery) {
        currentGallery.coverPhoto = {
            id: photo.id,
            title: photo.title,
            image: photo.image,
            thumbnail: photo.thumbnail,
            s3Key: photo.s3Key
        };
    }
    
    // Close modal after selection
    setTimeout(() => {
        closeCoverPhotoModal();
        showMessage(`Cover photo set to "${photo.title || 'Photo'}"`, 'success');
    }, 500);
}

function closeCoverPhotoModal() {
    const modal = document.getElementById('coverPhotoModal');
    modal.style.display = 'none';
}

// Global variables for cover photo management
let selectedCoverPhotoIndex = null;

// Update the cover photo display when loading gallery
function updateCoverPhotoDisplay() {
    const coverDisplay = document.getElementById('coverPhotoDisplay');
    
    if (currentGallery && currentGallery.coverPhoto) {
        coverDisplay.innerHTML = `<img src="${currentGallery.coverPhoto.thumbnail || currentGallery.coverPhoto.image}" alt="Cover Photo">`;
        coverDisplay.classList.remove('empty');
    } else if (photos && photos.length > 0) {
        // Auto-select first photo as cover if none is set
        const firstPhoto = photos[0];
        coverDisplay.innerHTML = `<img src="${firstPhoto.thumbnail || firstPhoto.image}" alt="Cover Photo">`;
        coverDisplay.classList.remove('empty');
        
        if (currentGallery) {
            currentGallery.coverPhoto = {
                id: firstPhoto.id,
                title: firstPhoto.title,
                image: firstPhoto.image,
                thumbnail: firstPhoto.thumbnail,
                s3Key: firstPhoto.s3Key
            };
        }
    } else {
        coverDisplay.innerHTML = '<span>Click to select cover photo</span>';
        coverDisplay.classList.add('empty');
    }
}

// Setup drag and drop functionality
function setupDragAndDrop() {
    const uploadArea = document.querySelector('.upload-area');
    if (!uploadArea) return;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    uploadArea.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight(e) {
        uploadArea.classList.add('dragover');
    }
    
    function unhighlight(e) {
        uploadArea.classList.remove('dragover');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        // Create a fake event object to reuse existing handleFileSelect function
        const fakeEvent = {
            target: { files: files }
        };
        
        handleFileSelect(fakeEvent);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupDragAndDrop();
});

// Helper function to convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Check if there are unsaved changes
function hasUnsavedChanges() {
    // Check if form has been modified
    if (isFormModified) {
        return true;
    }
    
    // Check if gallery info has changed
    const nameInput = document.getElementById('editGalleryName');
    const descInput = document.getElementById('editGalleryDescription');
    
    if (nameInput && nameInput.value.trim() !== (currentGallery?.name || '')) {
        return true;
    }
    
    if (descInput && descInput.value.trim() !== (currentGallery?.description || '')) {
        return true;
    }
    
    // Check if years have changed
    const currentYears = currentGalleryYears.sort().join(',');
    const originalYears = (currentGallery?.years || []).sort().join(',');
    if (currentYears !== originalYears) {
        return true;
    }
    
    // Check if any photos have been modified
    return photos.some(photo => photo._modified);
}

// Global functions for onclick handlers (need to be in global scope)
window.addNewPhoto = addNewPhoto;
window.closeUploadModal = closeUploadModal;
window.handleFileSelect = handleFileSelect;
window.uploadPhotos = uploadPhotos;
window.editPhotoInfo = editPhotoInfo;
window.deletePhotoConfirm = deletePhotoConfirm;
window.selectCoverPhoto = selectCoverPhoto;
window.setCoverPhoto = setCoverPhoto;
window.closeCoverPhotoModal = closeCoverPhotoModal;
window.addYear = addYear;
window.removeYear = removeYear;
window.saveGalleryChanges = saveGalleryChanges;
window.goBackToAdmin = goBackToAdmin;
window.updatePhotoCountDisplay = updatePhotoCountDisplay;
window.refreshPhotoCountFromServer = refreshPhotoCountFromServer;

// ==================== PHOTO DRAG AND DROP FUNCTIONALITY ====================

function setupPhotoDragAndDrop() {
    const photoItems = document.querySelectorAll('.photo-item-enhanced');
    
    if (!photoItems.length) return;
    
    // Setup drag events for each photo item
    photoItems.forEach(item => {
        const handle = item.querySelector('.drag-handle');
        if (handle) {
            handle.addEventListener('dragstart', (e) => handlePhotoDragStart(e, item));
            handle.addEventListener('dragend', (e) => handlePhotoDragEnd(e, item));
        }
    });
    
    // Setup drop zones
    photoItems.forEach(item => {
        item.addEventListener('dragover', (e) => handlePhotoDragOver(e, item));
        item.addEventListener('drop', (e) => handlePhotoDrop(e, item));
        item.addEventListener('dragenter', (e) => handlePhotoDragEnter(e, item));
        item.addEventListener('dragleave', (e) => handlePhotoDragLeave(e, item));
    });
    
    console.log('Photo drag and drop functionality initialized');
}

function handlePhotoDragStart(e, item) {
    e.stopPropagation();
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', item.outerHTML);
    e.dataTransfer.setData('text/plain', item.dataset.photoId);
    
    console.log('Photo drag started for:', item.dataset.photoId);
}

function handlePhotoDragEnd(e, item) {
    e.stopPropagation();
    item.classList.remove('dragging');
    console.log('Photo drag ended for:', item.dataset.photoId);
}

function handlePhotoDragOver(e, item) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
}

function handlePhotoDragEnter(e, item) {
    e.preventDefault();
    e.stopPropagation();
    if (!item.classList.contains('dragging')) {
        item.classList.add('drag-over');
    }
}

function handlePhotoDragLeave(e, item) {
    e.preventDefault();
    e.stopPropagation();
    item.classList.remove('drag-over');
}

function handlePhotoDrop(e, item) {
    e.preventDefault();
    e.stopPropagation();
    
    const draggedItem = document.querySelector('.dragging');
    if (!draggedItem) return;
    
    item.classList.remove('drag-over');
    
    const draggedId = draggedItem.dataset.photoId;
    const targetId = item.dataset.photoId;
    
    if (draggedId === targetId) return;
    
    console.log(`Dropping photo ${draggedId} onto ${targetId}`);
    
    // Reorder photos
    reorderPhotos(draggedId, targetId);
}

function reorderPhotos(draggedId, targetId) {
    const draggedIndex = photos.findIndex(p => (p.photoId || p.id || p.toString()) === draggedId);
    const targetIndex = photos.findIndex(p => (p.photoId || p.id || p.toString()) === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Remove dragged item from array
    const [draggedPhoto] = photos.splice(draggedIndex, 1);
    
    // Insert at target position
    photos.splice(targetIndex, 0, draggedPhoto);
    
    // Update sort order for all photos
    updatePhotoSortOrders();
    
    // Auto-save the new order
    autoSavePhotoOrder();
}

function updatePhotoSortOrders() {
    photos.forEach((photo, index) => {
        photo.sortOrder = index + 1;
    });
    
    console.log('Updated photo sort orders:', photos.map(p => ({
        id: p.photoId || p.id,
        name: p.name || p.title,
        sortOrder: p.sortOrder
    })));
}

async function autoSavePhotoOrder() {
    try {
        // Show saving message
        showMessage('💾 Auto-saving photo order...', 'info');
        
        // Prepare photos with updated sort orders
        const photosToUpdate = photos.map(photo => ({
            photoId: photo.photoId || photo.id,
            sortOrder: photo.sortOrder
        }));
        
        // Call API to update photo sort orders
        const result = await updatePhotoSortOrder(photosToUpdate);
        
        if (result.success) {
            showMessage('✅ Photo order auto-saved successfully!', 'success');
            
            // Refresh the display to show new order
            updatePhotosGrid();
            
        } else {
            throw new Error(result.error || 'Failed to auto-save photo order');
        }
        
    } catch (error) {
        console.error('Error auto-saving photo order:', error);
        showMessage('❌ Failed to auto-save photo order: ' + error.message, 'error');
        
        // Revert the order change on error
        revertPhotoOrderChange();
    }
}

function revertPhotoOrderChange() {
    // Reload photos from server to revert any local changes
    loadGalleryPhotos();
}

async function updatePhotoSortOrder(photosData) {
    try {
        const response = await fetch(`${API_BASE_URL}/galleries?action=update_photo_sort_order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                galleryId: currentGallery.galleryId,
                photos: photosData
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update photo sort order');
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating photo sort order:', error);
        throw error;
    }
}

