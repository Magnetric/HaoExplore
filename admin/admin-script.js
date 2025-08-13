// Admin Script - API Version
// Complete rewrite to use Lambda API instead of direct S3 operations

// ==================== CONFIGURATION ====================
const API_BASE_URL = 'https://5nuxhstp12.execute-api.eu-north-1.amazonaws.com/prod';
// TODO: Replace with your actual API Gateway URL after deployment

// Country data by continent
const countriesByContinent = {
    'Africa': ['Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon', 'Cape Verde', 'Central African Republic', 'Chad', 'Comoros', 'Congo', 'Côte d\'Ivoire', 'Democratic Republic of the Congo', 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'São Tomé and Príncipe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'],
    'Asia': ['Afghanistan', 'Armenia', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Bhutan', 'Brunei', 'Cambodia', 'China', 'Cyprus', 'Georgia', 'India', 'Indonesia', 'Iran', 'Iraq', 'Israel', 'Japan', 'Jordan', 'Kazakhstan', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Lebanon', 'Malaysia', 'Maldives', 'Mongolia', 'Myanmar', 'Nepal', 'North Korea', 'Oman', 'Pakistan', 'Palestine', 'Philippines', 'Qatar', 'Saudi Arabia', 'Singapore', 'South Korea', 'Sri Lanka', 'Syria', 'Taiwan', 'Tajikistan', 'Thailand', 'Timor-Leste', 'Turkey', 'Turkmenistan', 'United Arab Emirates', 'Uzbekistan', 'Vietnam', 'Yemen'],
    'Europe': ['Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta', 'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal', 'Romania', 'Russia', 'San Marino', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom', 'Vatican City'],
    'North America': ['Antigua and Barbuda', 'Bahamas', 'Barbados', 'Belize', 'Canada', 'Costa Rica', 'Cuba', 'Dominica', 'Dominican Republic', 'El Salvador', 'Grenada', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica', 'Mexico', 'Nicaragua', 'Panama', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Trinidad and Tobago', 'United States'],
    'South America': ['Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay', 'Venezuela'],
    'Oceania': ['Australia', 'Fiji', 'Kiribati', 'Marshall Islands', 'Micronesia', 'Nauru', 'New Zealand', 'Palau', 'Papua New Guinea', 'Samoa', 'Solomon Islands', 'Tonga', 'Tuvalu', 'Vanuatu'],
    'Antarctica': ['Antarctica']
};

// ==================== MAIN ADMIN CLASS ====================
class AdminPanel {
    constructor() {
        this.api = new GalleryAPI(API_BASE_URL);
        this.galleries = [];
        this.currentFilteredGalleries = [];
        this.currentGalleryYears = [];
        this.currentPhotoYears = [];
        this.isProcessing = false;
    }

    // ==================== INITIALIZATION ====================
    async init() {
        console.log('Initializing admin panel with API...');
        
        try {
            // Setup form handlers
            this.setupCreateGalleryFormHandler();
            this.setupEventListeners();
            
            // Initialize UI
            this.updateYearsDisplay();
            
            // Load initial data
            await this.loadGalleries();
            
            // Check URL parameters for tab selection
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab');
            if (tabParam) {
                console.log('URL parameter tab found:', tabParam);
                this.showTab(tabParam);
            }
            
            console.log('Admin panel initialized successfully');
            console.log('API Base URL:', API_BASE_URL);
            
            // Check if API URL is configured
            if (API_BASE_URL.includes('your-api-id')) {
                this.showMessage('⚠️ Please update API_BASE_URL in admin-script-api.js with your actual API Gateway URL', 'warning');
            }
        } catch (error) {
            console.error('Error initializing admin panel:', error);
            this.showMessage('Error initializing admin panel: ' + error.message, 'error');
        }
    }

    // ==================== API OPERATIONS ====================
    
    async updateGalleriesMetadata() {
        try {
            this.showMessage('Updating galleries metadata from S3...', 'info');
            this.isProcessing = true;
            
            const result = await this.api.updateGalleriesMetadata();
            console.log('Galleries metadata updated successfully:', result);
            
            // Check if a test gallery was created
            if (result.test_gallery_created) {
                this.showMessage(`✅ Test gallery created! No galleries found in S3. Check debug info for details.`, 'success');
                
                // Show debug information in console
                if (result.debug_info) {
                    console.log('Debug info:', result.debug_info);
                    console.log('S3 objects found:', result.debug_info.all_objects);
                }
            } else {
                this.showMessage(`✅ Galleries metadata updated successfully! ${result.galleries_updated} updated, ${result.galleries_created} created`, 'success');
            }
            
            // Show additional information
            if (result.total_objects_scanned !== undefined) {
                console.log(`Total objects scanned in S3: ${result.total_objects_scanned}`);
            }
            
            if (result.total_folders_scanned !== undefined) {
                console.log(`Total gallery folders found: ${result.total_folders_scanned}`);
            }
            
            // Refresh galleries list
            await this.loadGalleries();
            
            return result;
        } catch (error) {
            console.error('Error updating galleries metadata:', error);
            
            // Provide more specific error messages
            let errorMessage = '❌ Error updating galleries metadata: ' + error.message;
            
            if (error.message.includes('Failed to scan S3 bucket')) {
                errorMessage = '❌ Cannot access S3 bucket. Check AWS permissions and bucket name.';
            } else if (error.message.includes('No gallery folders found')) {
                errorMessage = '⚠️ No gallery folders found in S3. The system is working, but there are no galleries to process.';
            }
            
            this.showMessage(errorMessage, 'error');
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    async updatePhotosMetadata() {
        try {
            this.showMessage('Updating photos metadata from S3...', 'info');
            this.isProcessing = true;
            
            const result = await this.api.updatePhotosMetadata();
            console.log('Photos metadata updated successfully:', result);
            
            this.showMessage(`✅ Photos metadata updated successfully! ${result.photos_updated} updated, ${result.photos_created} created`, 'success');
            
            return result;
        } catch (error) {
            console.error('Error updating photos metadata:', error);
            this.showMessage('❌ Error updating photos metadata: ' + error.message, 'error');
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    // ==================== GALLERY MANAGEMENT ====================
    
    async createGallery(galleryData) {
        try {
            this.showMessage('Creating gallery...', 'info');
            
            const result = await this.api.createGallery(galleryData);
            console.log('Gallery created successfully:', result);
            this.showMessage('✅ Gallery created successfully!', 'success');
            
            // Clear form and refresh list
            this.clearCreateGalleryForm();
            await this.loadGalleries();
            
            // Switch to manage tab
            this.showTab('manage-galleries');
            
            return result;
        } catch (error) {
            console.error('Error creating gallery:', error);
            this.showMessage('❌ Error creating gallery: ' + error.message, 'error');
            throw error;
        }
    }

    async loadGalleries() {
        try {
            console.log('Loading galleries from API...');
            
            const result = await this.api.listGalleries();
            this.galleries = result.galleries || [];
            this.currentFilteredGalleries = [...this.galleries];
            
            console.log('Loaded galleries from API:', this.galleries.length);
            
            // Setup filters and update galleries list in manage tab
            this.setupFilters();
            this.updateGalleriesManageList();
            
        } catch (error) {
            console.error('Error loading galleries:', error);
            this.showMessage('❌ Error loading galleries: ' + error.message, 'error');
            
            // Fallback: try to load from localStorage
            const savedGalleries = localStorage.getItem('galleries');
            if (savedGalleries) {
                this.galleries = JSON.parse(savedGalleries);
                this.currentFilteredGalleries = [...this.galleries];
                this.setupFilters();
                this.updateGalleriesManageList();
                this.showMessage('⚠️ Loaded galleries from local cache', 'warning');
            }
        }
    }

    async deleteGallery(galleryId) {
        try {
            this.showMessage('Deleting gallery...', 'info');
            
            const result = await this.api.deleteGallery(galleryId);
            console.log('Gallery deleted successfully:', result);
            this.showMessage('✅ Gallery deleted successfully!', 'success');
            
            // Refresh galleries list
            await this.loadGalleries();
            
            return result;
        } catch (error) {
            console.error('Error deleting gallery:', error);
            this.showMessage('❌ Error deleting gallery: ' + error.message, 'error');
            throw error;
        }
    }

    // ==================== UI MANAGEMENT ====================
    
    updateGalleriesManageList() {
        const galleriesGrid = document.getElementById('galleriesGrid');
        if (!galleriesGrid) return;
        
        // Setup image load error handling after rendering
        setTimeout(() => {
            this.setupImageErrorHandling();
        }, 100);
        
        // Ensure the container has proper width for grid layout
        galleriesGrid.style.width = '100%';
        galleriesGrid.style.maxWidth = 'none';
        galleriesGrid.style.display = 'block';
        galleriesGrid.style.overflow = 'visible';
        
        if (this.currentFilteredGalleries.length === 0) {
            galleriesGrid.innerHTML = '<div class="no-galleries" style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #6c757d;">No galleries found matching your criteria.</div>';
            return;
        }
        
        // Pre-process galleries to get thumbnail URLs
        const processedGalleries = this.currentFilteredGalleries.map(gallery => {
            const thumbnailUrl = this.getCoverPhotoThumbnail(gallery);
            return {
                ...gallery,
                thumbnailUrl: thumbnailUrl
            };
        });
        
        // Create grid view for galleries - apply grid directly to container
        galleriesGrid.style.display = 'grid';
        galleriesGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        galleriesGrid.style.gap = '1.5rem';
        galleriesGrid.style.padding = '1rem';
        galleriesGrid.style.width = '100%';
        galleriesGrid.style.maxWidth = 'none';
        
        galleriesGrid.innerHTML = `
            ${processedGalleries.map(gallery => `
                <div class="gallery-item" data-gallery-id="${gallery.galleryId}" data-thumbnail="${gallery.thumbnailUrl || ''}" style="background: ${gallery.thumbnailUrl ? `url('${gallery.thumbnailUrl}')` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; background-size: cover; background-position: center; background-repeat: no-repeat; border-radius: 12px; padding: 1.25rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #e1e8ed; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; position: relative; min-height: 200px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)'" onclick="adminPanel.editGallery('${gallery.galleryId}')">
                    <!-- Overlay for better text readability -->
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); border-radius: 12px;"></div>
                    
                    <!-- Delete Button - positioned at top right -->
                    <button onclick="event.stopPropagation(); adminPanel.deleteGalleryConfirm('${gallery.galleryId}')" style="position: absolute; top: 12px; right: 12px; z-index: 3; background: #e74c3c; color: white; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.3);" onmouseover="this.style.background='#c0392b'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='#e74c3c'; this.style.transform='scale(1)'">
                        <i class="fas fa-trash"></i>
                    </button>
                    
                    <!-- Gallery Info - positioned above overlay -->
                    <div style="position: relative; z-index: 2; margin-top: 40px;">
                        <div style="font-size: 1.1rem; font-weight: 600; color: white; margin-bottom: 0.5rem; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">${gallery.name}</div>
                        
                        <div style="color: rgba(255,255,255,0.9); font-size: 0.9rem; margin-bottom: 0.75rem; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">
                            ${gallery.continent} > ${gallery.country}
                        </div>
                        <div style="color: rgba(255,255,255,0.8); font-size: 0.85rem; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">
                            Photos: ${gallery.photoCount || 0} | Created: ${new Date(gallery.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            `).join('')}
        `;
        
        // Grid view is now the default and only view
    }

    showTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab content
        const selectedTab = document.getElementById(tabName);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        // Add active class to clicked button
        const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => 
            btn.onclick && btn.onclick.toString().includes(tabName)
        );
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Load data if switching to manage galleries tab
        if (tabName === 'manage-galleries') {
            this.loadGalleries();
        }
    }

    // ==================== FORM HANDLERS ====================
    
    setupCreateGalleryFormHandler() {
        const form = document.getElementById('createGalleryForm');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const continent = document.getElementById('continent').value;
            const country = document.getElementById('country').value;
            const name = document.getElementById('galleryName').value;
            const description = document.getElementById('galleryDescription').value;
            
            // Validate input
            if (!continent || !country || !name.trim()) {
                this.showMessage('❌ Please fill in all required fields (Continent, Country, and Gallery Name)', 'error');
                return;
            }
            
            // Check for duplicate gallery names
            const existingGallery = this.galleries.find(g => 
                g.name.toLowerCase() === name.trim().toLowerCase() &&
                g.continent === continent &&
                g.country === country
            );
            
            if (existingGallery) {
                this.showMessage(`❌ A gallery named "${name}" already exists in ${country}, ${continent}`, 'error');
                return;
            }
            
            try {
                await this.createGallery({
                    name: name.trim(),
                    continent: continent,
                    country: country,
                    description: description.trim(),
                    years: [...this.currentGalleryYears]
                });
            } catch (error) {
                // Error already handled in createGallery method
            }
        });
    }

    clearCreateGalleryForm() {
        document.getElementById('continent').value = '';
        document.getElementById('country').value = '';
        document.getElementById('galleryName').value = '';
        document.getElementById('galleryDescription').value = '';
        this.currentGalleryYears = [];
        this.updateYearsDisplay();
    }

    // ==================== UTILITY FUNCTIONS ====================
    
    getCoverPhotoThumbnail(gallery) {
        // 直接使用DynamoDB中的coverPhotoURL字段
        return gallery.coverPhotoURL || '';
    }

    setupImageErrorHandling() {
        // Find all gallery items with thumbnails
        const galleryItems = document.querySelectorAll('.gallery-item[data-thumbnail]');
        
        galleryItems.forEach(item => {
            const thumbnailUrl = item.getAttribute('data-thumbnail');
            if (!thumbnailUrl) return;
            
            // Create a test image to check if the thumbnail loads
            const testImg = new Image();
            testImg.onload = () => {
                // Image loaded successfully, no action needed
            };
            testImg.onerror = () => {
                // Image failed to load, set fallback background
                item.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            };
            testImg.src = thumbnailUrl;
        });
    }

    // ==================== FILTER FUNCTIONS ====================
    
    setupFilters() {        
        // Clear existing options
        const continentFilter = document.getElementById('filterContinent');
        const countryFilter = document.getElementById('filterCountry');
        
        if (continentFilter) {
            continentFilter.innerHTML = '<option value="">All Continents</option>';
        }
        if (countryFilter) {
            countryFilter.innerHTML = '<option value="">All Countries</option>';
        }
        
        // Populate continent filter
        const continents = [...new Set(this.galleries.map(gallery => gallery.continent))].sort();
        continents.forEach(continent => {
            if (continentFilter) {
                const option = document.createElement('option');
                option.value = continent;
                option.textContent = continent;
                continentFilter.appendChild(option);
            }
        });
        
        // Populate country filter with all countries initially
        const countries = [...new Set(this.galleries.map(gallery => gallery.country))].sort();
        countries.forEach(country => {
            if (countryFilter) {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                countryFilter.appendChild(option);
            }
        });
        
        // Add event listeners
        if (continentFilter) {
            continentFilter.addEventListener('change', () => {
                this.updateCountryFilter();
                this.filterGalleries();
            });
        }
        if (countryFilter) {
            countryFilter.addEventListener('change', () => this.filterGalleries());
        }
    }

    filterGalleries() {
        const continentFilter = document.getElementById('filterContinent');
        const countryFilter = document.getElementById('filterCountry');
        
        const selectedContinent = continentFilter ? continentFilter.value : '';
        const selectedCountry = countryFilter ? countryFilter.value : '';
        
        console.log('Filtering galleries:', { selectedContinent, selectedCountry });
        
        this.currentFilteredGalleries = this.galleries.filter(gallery => {
            const continentMatch = !selectedContinent || gallery.continent === selectedContinent;
            const countryMatch = !selectedCountry || gallery.country === selectedCountry;
            return continentMatch && countryMatch;
        });
        
        console.log('Filtered galleries:', this.currentFilteredGalleries.length);
        this.updateGalleriesManageList();
    }

    clearFilters() {
        const continentFilter = document.getElementById('filterContinent');
        const countryFilter = document.getElementById('filterCountry');
        
        if (continentFilter) continentFilter.value = '';
        if (countryFilter) countryFilter.value = '';
        
        // Reset country filter to show all countries
        this.updateCountryFilter();
        
        this.currentFilteredGalleries = [...this.galleries];
        this.updateGalleriesManageList();
        
        console.log('Filters cleared, showing all galleries');
    }

    updateCountryFilter() {
        const continentFilter = document.getElementById('filterContinent');
        const countryFilter = document.getElementById('filterCountry');
        
        if (!continentFilter || !countryFilter) return;
        
        const selectedContinent = continentFilter.value;
        
        // Clear current country options
        countryFilter.innerHTML = '<option value="">All Countries</option>';
        
        if (selectedContinent) {
            // Filter countries based on selected continent
            const countriesInContinent = [...new Set(
                this.galleries
                    .filter(gallery => gallery.continent === selectedContinent)
                    .map(gallery => gallery.country)
            )].sort();
            
            console.log(`Countries in ${selectedContinent}:`, countriesInContinent);
            
            // Add country options for the selected continent
            countriesInContinent.forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                countryFilter.appendChild(option);
            });
        } else {
            // If no continent selected, show all countries
            const allCountries = [...new Set(this.galleries.map(gallery => gallery.country))].sort();
            console.log('All countries:', allCountries);
            
            allCountries.forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                countryFilter.appendChild(option);
            });
        }
        
        // Reset country selection when continent changes
        countryFilter.value = '';
    }



    copyGalleryId(galleryId) {
        navigator.clipboard.writeText(galleryId).then(() => {
            this.showMessage('✅ Gallery ID copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = galleryId;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showMessage('✅ Gallery ID copied to clipboard!', 'success');
        });
    }

    showCoverPhotoModal(galleryId) {
        // 这个方法用于显示封面照片选择模态框
        // 暂时显示一个简单的消息，你可以根据需要实现完整的模态框
        this.showMessage('Cover photo selection feature coming soon...', 'info');
    }

    updateCountries() {
        const continent = document.getElementById('continent').value;
        const countrySelect = document.getElementById('country');
        
        // Clear current options
        countrySelect.innerHTML = '<option value="">Select Country</option>';
        
        if (continent && countriesByContinent[continent]) {
            countriesByContinent[continent].forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                countrySelect.appendChild(option);
            });
        }

    }

    // removed: gallery path UI

    showMessage(message, type = 'info') {
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
        const container = document.querySelector('.admin-container');
        if (container) {
            container.insertBefore(messageElement, container.firstChild);
        }
        
        // Auto-remove after 8 seconds for longer operations
        setTimeout(() => {
            if (messageElement.parentElement) {
                messageElement.remove();
            }
        }, 8000);
    }

    // ==================== YEAR MANAGEMENT ====================
    
    addYear(type) {
        const select = document.getElementById(type === 'gallery' ? 'galleryYearSelect' : 'photoYearSelect');
        const year = select.value;
        
        if (!year) return;
        
        const yearsArray = type === 'gallery' ? this.currentGalleryYears : this.currentPhotoYears;
        
        if (!yearsArray.includes(year)) {
            yearsArray.push(year);
            this.updateYearsDisplay();
            select.value = '';
        }
    }

    removeYear(type, year) {
        if (type === 'gallery') {
            this.currentGalleryYears = this.currentGalleryYears.filter(y => y !== year);
        } else {
            this.currentPhotoYears = this.currentPhotoYears.filter(y => y !== year);
        }
        this.updateYearsDisplay();
    }

    updateYearsDisplay() {
        this.updateYearDisplay('gallery', this.currentGalleryYears);
        this.updateYearDisplay('photo', this.currentPhotoYears);
    }

    updateYearDisplay(type, years) {
        const container = document.getElementById(`${type}Years`);
        if (!container) return;
        
        container.innerHTML = years.map(year => `
            <span class="year-tag">
                ${year}
                <button type="button" onclick="adminPanel.removeYear('${type}', '${year}')" class="year-remove">&times;</button>
            </span>
        `).join('');
    }

    // ==================== EVENT HANDLERS ====================
    
    setupEventListeners() {
        // Setup country dropdown change handler
        const continentSelect = document.getElementById('continent');
        if (continentSelect) {
            continentSelect.addEventListener('change', () => this.updateCountries());
        }
        
        // Setup gallery name input handler (no path update required)
        const galleryNameInput = document.getElementById('galleryName');
        if (galleryNameInput) {
            // no-op
        }
        
        // Setup year select handlers
        const galleryYearSelect = document.getElementById('galleryYearSelect');
        if (galleryYearSelect) {
            galleryYearSelect.addEventListener('change', (e) => this.handleYearSelect(e, 'gallery'));
        }
        
        const photoYearSelect = document.getElementById('photoYearSelect');
        if (photoYearSelect) {
            photoYearSelect.addEventListener('change', (e) => this.handleYearSelect(e, 'photo'));
        }
    }

    handleYearSelect(event, type) {
        if (event.target.value) {
            this.addYear(type);
        }
    }

    // ==================== GALLERY OPERATIONS ====================
    
    editGallery(galleryId) {
        try {
           
            // Direct redirect to gallery edit page with gallery ID
            window.location.href = `gallery-edit.html?gallery=${encodeURIComponent(galleryId)}`;
            
        } catch (error) {
            console.error('Error redirecting to gallery editor:', error);
            this.showMessage('❌ Error opening gallery editor: ' + error.message, 'error');
        }
    }

    deleteGalleryConfirm(galleryId) {
        const gallery = this.galleries.find(g => g.id === galleryId);
        if (!gallery) {
            this.showMessage('❌ Gallery not found', 'error');
            return;
        }
        
        // Show custom delete confirmation modal
        this.showDeleteConfirmationModal(gallery);
    }

    showDeleteConfirmationModal(gallery) {
        // Create modal HTML
        const modalHTML = `
            <div id="deleteConfirmModal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>Confirm Gallery Deletion</h3>
                        <button class="modal-close" onclick="adminPanel.closeDeleteConfirmationModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 1.5rem;">
                            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                                <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                                    <i class="fas fa-exclamation-triangle" style="color: #856404; margin-right: 0.5rem;"></i>
                                    <strong style="color: #856404;">Warning: This action cannot be undone!</strong>
                                </div>
                            </div>
                            
                            <p style="margin-bottom: 1rem;">You are about to delete the gallery <strong>"${gallery.name}"</strong></p>
                            
                            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                                <p style="margin: 0; font-weight: 600; color: #2c3e50;">This will permanently delete:</p>
                                <ul style="margin: 0.5rem 0 0 1rem; color: #7f8c8d;">
                                    <li>The gallery and all its metadata</li>
                                    <li>All photos in the gallery (${gallery.photoCount || 0} photos)</li>
                                    <li>All associated years and descriptions</li>
                                </ul>
                            </div>
                            
                            <div style="margin-bottom: 1rem;">
                                <label for="confirmGalleryName" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #2c3e50;">
                                    Type the gallery name "${gallery.name}" to confirm:
                                </label>
                                <input type="text" id="confirmGalleryName" 
                                       style="width: 100%; padding: 8px; border: 2px solid #e1e8ed; border-radius: 4px;" 
                                       placeholder="Type gallery name here..."
                                       autocomplete="off">
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                            <button type="button" onclick="adminPanel.closeDeleteConfirmationModal()" 
                                    style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                                Cancel
                            </button>
                            <button type="button" id="confirmDeleteBtn" onclick="adminPanel.proceedWithDeletion('${gallery.galleryId}', '${gallery.name}')" 
                                    style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;" 
                                    disabled>
                                <i class="fas fa-trash"></i> Delete Gallery
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add input validation
        const nameInput = document.getElementById('confirmGalleryName');
        const deleteBtn = document.getElementById('confirmDeleteBtn');
        
        nameInput.addEventListener('input', function() {
            if (this.value === gallery.name) {
                deleteBtn.disabled = false;
                deleteBtn.style.opacity = '1';
            } else {
                deleteBtn.disabled = true;
                deleteBtn.style.opacity = '0.6';
            }
        });
        
        // Focus on input
        setTimeout(() => nameInput.focus(), 100);
    }

    closeDeleteConfirmationModal() {
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) {
            modal.remove();
        }
    }

    async proceedWithDeletion(galleryId, galleryName) {
        const nameInput = document.getElementById('confirmGalleryName');
        
        if (nameInput.value !== galleryName) {
            this.showMessage('❌ Gallery name does not match. Deletion cancelled.', 'warning');
            return;
        }
        
        try {
            this.closeDeleteConfirmationModal();
            await this.deleteGallery(galleryId);
        } catch (error) {
            // Error already handled in deleteGallery method
        }
    }
}

// ==================== API CLIENT CLASS ====================
class GalleryAPI {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    } 

    async createGallery(galleryData) {
        try {
            const response = await fetch(`${this.baseUrl}/galleries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: galleryData.name,
                    continent: galleryData.continent,
                    country: galleryData.country,
                    description: galleryData.description || '',
                    years: galleryData.years || []
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create gallery');
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating gallery:', error);
            throw error;
        }
    }

    async listGalleries() {
        try {
            const response = await fetch(`${this.baseUrl}/galleries`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to list galleries');
            }

            return await response.json();
        } catch (error) {
            console.error('Error listing galleries:', error);
            throw error;
        }
    }

    async getGallery(galleryId) {
        try {
            const response = await fetch(`${this.baseUrl}/galleries?id=${galleryId}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get gallery');
            }

            return await response.json();
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

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update gallery');
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating gallery:', error);
            throw error;
        }
    }

    async deleteGallery(galleryId) {
        try {
            const response = await fetch(`${this.baseUrl}/galleries?id=${galleryId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete gallery');
            }

            return await response.json();
        } catch (error) {
            console.error('Error deleting gallery:', error);
            throw error;
        }
    }

    async updateGalleriesMetadata() {
        try {
            const response = await fetch(`${this.baseUrl}/galleries?action=update_galleries_metadata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({})
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update galleries metadata');
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating galleries metadata:', error);
            throw error;
        }
    }

    async updatePhotosMetadata() {
        try {
            const response = await fetch(`${this.baseUrl}/galleries?action=update_GalleryPhotos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({})
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update photos metadata');
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating photos metadata:', error);
            throw error;
        }
    }
}

// ==================== GLOBAL INSTANCE ====================
const adminPanel = new AdminPanel();

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    adminPanel.init();
});

// ==================== GLOBAL FUNCTIONS FOR HTML ONCLICK ====================
// These functions are needed for HTML onclick handlers to work properly

window.showTab = (tabName) => adminPanel.showTab(tabName);
window.editGallery = (galleryId) => adminPanel.editGallery(galleryId);
window.deleteGalleryConfirm = (galleryId) => adminPanel.deleteGalleryConfirm(galleryId);
window.closeDeleteConfirmModal = () => adminPanel.closeDeleteConfirmationModal();
window.proceedWithDeletion = (galleryId, galleryName) => adminPanel.proceedWithDeletion(galleryId, galleryName);
window.copyGalleryId = (galleryId) => adminPanel.copyGalleryId(galleryId);
window.showCoverPhotoModal = (galleryId) => adminPanel.showCoverPhotoModal(galleryId);
// removed for rewrite; buttons should be updated to new handlers when implemented
window.updateCountries = () => adminPanel.updateCountries();
window.addYear = (type) => adminPanel.addYear(type);
window.removeYear = (type, year) => adminPanel.removeYear(type, year);
// Filter functions
window.clearFilters = () => adminPanel.clearFilters();
