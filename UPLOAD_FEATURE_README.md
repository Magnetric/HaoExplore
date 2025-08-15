# New Photo Upload Feature - Bypassing API Gateway 10MB Limit

## Overview

This feature implements a new photo upload workflow that bypasses the API Gateway 10MB size limit by using direct S3 uploads with presigned URLs. The process converts images to WebP format for optimal quality and generates thumbnails automatically.

## How It Works

### 1. Frontend Processing (JavaScript)
- **Image Conversion**: Photos are converted to WebP format using HTML5 Canvas
  - Quality: 95% (maintains original quality)
  - Format: WebP (better compression than JPEG/PNG)
  - Dimensions: Preserved from original

- **Thumbnail Generation**: Creates optimized thumbnails
  - Quality: 40% (good balance of size vs quality)
  - Max Width: 2000px (maintains aspect ratio)
  - Format: WebP

### 2. Backend Processing (AWS Lambda)
- **Presigned URL Generation**: Creates S3 upload URLs for each photo
  - Original image URL
  - Thumbnail URL
  - 1-hour expiration
  - Direct PUT access to S3

### 3. Direct S3 Upload
- **Bypasses API Gateway**: Files go directly to S3
- **No Size Limits**: Can handle photos up to 5TB (S3 limit)
- **Parallel Uploads**: Multiple photos upload simultaneously

### 4. Database Update
- **DynamoDB Integration**: Updates GalleryPhotos table
- **Metadata Storage**: File sizes, dimensions, S3 keys
- **Gallery Association**: Links photos to specific galleries

## File Structure

```
galleries/
├── {gallery_id}/
│   └── photos/
│       ├── {photo_id}/
│       │   ├── {filename}.webp          # Original WebP
│       │   └── {filename}_thumb.webp    # Thumbnail
```

## API Endpoints

### 1. Get Upload URLs
```
POST /galleries?id={gallery_id}&action=get_upload_urls
```

**Request Body:**
```json
{
  "photos": [
    {
      "filename": "photo1.webp",
      "thumbnailFilename": "photo1_thumb.webp",
      "contentType": "image/webp"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "upload_urls": [
    {
      "photo_id": "uuid",
      "original_url": "presigned_s3_url",
      "thumbnail_url": "presigned_s3_url",
      "original_key": "s3_key",
      "thumbnail_key": "s3_key"
    }
  ]
}
```

### 2. Update Gallery Photos
```
POST /galleries?action=update_GalleryPhotos
```

**Request Body:**
```json
{
  "galleryId": "gallery_uuid",
  "photos": [
    {
      "filename": "photo1.webp",
      "thumbnailFilename": "photo1_thumb.webp",
      "s3Key": "s3_key",
      "thumbnailKey": "s3_key",
      "contentType": "image/webp",
      "fileSize": 1234567,
      "thumbnailSize": 234567,
      "width": 1920,
      "height": 1080
    }
  ]
}
```

## Frontend Implementation

### Key Functions

1. **`convertToWebP(file, quality)`**: Converts image to WebP format
2. **`generateThumbnail(file, maxWidth, quality)`**: Creates thumbnail
3. **`uploadToS3(presignedUrl, file)`**: Uploads file to S3
4. **`uploadPhotos()`**: Main upload workflow

### Upload Workflow

1. **File Selection**: User selects photos
2. **Processing**: Convert to WebP + generate thumbnails
3. **Get URLs**: Request presigned URLs from Lambda
4. **S3 Upload**: Upload files directly to S3
5. **Database Update**: Update DynamoDB with photo info
6. **UI Refresh**: Reload gallery display

## Benefits

### Performance
- **Faster Uploads**: No base64 encoding/decoding
- **Better Compression**: WebP format reduces file sizes
- **Parallel Processing**: Multiple photos upload simultaneously

### Scalability
- **No API Limits**: Bypasses 10MB API Gateway restriction
- **S3 Direct**: Leverages S3's high-performance infrastructure
- **Efficient Storage**: WebP format saves storage space

### Quality
- **High Quality**: 95% WebP quality maintains visual fidelity
- **Smart Thumbnails**: 40% quality with size optimization
- **Format Consistency**: All photos stored in WebP format

## Browser Support

- **WebP Support**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Canvas API**: Required for image processing
- **File API**: Required for file handling

## Testing

Use the `test-upload.html` file to test the WebP conversion and thumbnail generation functionality locally before deploying to production.

## Deployment Notes

1. **Lambda Permissions**: Ensure Lambda has S3 PUT permissions
2. **CORS**: Configure S3 bucket CORS for direct uploads
3. **Bucket Policy**: Verify S3 bucket allows PUT operations
4. **API Gateway**: No changes needed (bypasses size limits)

## Error Handling

- **Processing Errors**: Individual photo failures don't stop batch
- **Upload Failures**: S3 upload errors are logged and reported
- **Database Errors**: Failed database updates are logged
- **Partial Success**: System reports partial success when some operations fail

## Monitoring

- **CloudWatch Logs**: Lambda execution logs
- **S3 Metrics**: Upload success/failure rates
- **DynamoDB Metrics**: Database operation performance
- **Frontend Console**: Browser console logs for debugging

