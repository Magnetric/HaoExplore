// Shared Gallery API client for admin pages
class GalleryAPI {
    constructor(baseUrl) {
        this.baseUrl = baseUrl || API_BASE_URL;
    }

    async _request(path, options = {}) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });

        let data = {};
        try {
            data = await response.json();
        } catch (_) {
            data = {};
        }

        if (!response.ok) {
            throw new Error(data.error || data.message || `Request failed (${response.status})`);
        }
        return data;
    }

    async createGallery(galleryData) {
        const requestBody = {
            name: galleryData.name,
            continent: galleryData.continent,
            country: galleryData.country,
            description: galleryData.description || '',
            years: galleryData.years || []
        };

        if (galleryData.latitude && galleryData.longitude) {
            requestBody.latitude = galleryData.latitude;
            requestBody.longitude = galleryData.longitude;
        }

        return this._request('/galleries', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });
    }

    async listGalleries() {
        return this._request('/galleries');
    }

    async getGallery(galleryId, { normalize = false } = {}) {
        const data = await this._request(`/galleries?id=${encodeURIComponent(galleryId)}`);
        return normalize ? normalizeGalleryFromDynamoDB(data) : data;
    }

    async updateGallery(galleryData) {
        return this._request('/galleries', {
            method: 'PUT',
            body: JSON.stringify(galleryData)
        });
    }

    async deleteGallery(galleryId) {
        return this._request(`/galleries?id=${encodeURIComponent(galleryId)}`, {
            method: 'DELETE'
        });
    }

    async deletePhoto(galleryId, payload) {
        return this._request(`/galleries?id=${encodeURIComponent(galleryId)}&action=delete_photo`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async getUploadUrls(galleryId, photosData) {
        return this._request(`/galleries?id=${encodeURIComponent(galleryId)}&action=get_upload_urls`, {
            method: 'POST',
            body: JSON.stringify({ photos: photosData })
        });
    }

    async updateGalleryPhotos(galleryId, photosData) {
        return this._request('/galleries?action=update_GalleryPhotos', {
            method: 'POST',
            body: JSON.stringify({ galleryId, photos: photosData })
        });
    }

    async updateGalleriesMetadata() {
        return this._request('/galleries?action=update_galleries_metadata', {
            method: 'POST',
            body: JSON.stringify({})
        });
    }

    async updatePhotosMetadata() {
        return this._request('/galleries?action=update_GalleryPhotos', {
            method: 'POST',
            body: JSON.stringify({})
        });
    }

    async updateGallerySortOrder(galleriesData) {
        return this._request('/galleries?action=update_sort_order', {
            method: 'POST',
            body: JSON.stringify({ galleries: galleriesData })
        });
    }
}

function normalizeGalleryFromDynamoDB(gallery) {
    if (!gallery) return gallery;
    const normalized = { ...gallery };
    normalized.id = normalized.id || normalized.galleryId || normalized.ID || normalized.Id;

    const rawPhotos = normalized.photos || [];
    normalized.photos = rawPhotos.map(p => ({
        ...p,
        id: p.id || p.photoId || (p.photoNumber ? `photo-${p.photoNumber}` : undefined),
        thumbnailKey: p.thumbnailKey || p.s3Key
    }));

    return normalized;
}
