# Photography Gallery Backend Guide

## Overview

This backend system is built on AWS Lambda with API Gateway, providing a serverless architecture for managing photography galleries. The system handles gallery creation, photo management, metadata processing, and image optimization.

## Architecture

### Core Components

- **AWS Lambda**: Serverless compute for handling API requests
- **API Gateway**: RESTful API endpoints
- **DynamoDB**: NoSQL database for storing gallery and photo metadata
- **S3**: Object storage for images and thumbnails
- **Lambda Layers**: Shared dependencies (Pillow, requests)

### Database Schema

#### Galleries Table
```json
{
  "galleryId": "string (Primary Key)",
  "name": "string",
  "continent": "string",
  "country": "string", 
  "description": "string",
  "years": ["number"],
  "photoCount": "number",
  "coverPhotoURL": "string",
  "createdAt": "string (ISO timestamp)",
  "updatedAt": "string (ISO timestamp)"
}
```

#### GalleryPhotos Table
```json
{
  "galleryId": "string (Partition Key)",
  "photoId": "string (Sort Key)",
  "photoNumber": "number",
  "title": "string",
  "description": "string",
  "tags": ["string"],
  "s3Key": "string",
  "thumbnailURL": "string",
  "fullSizeURL": "string",
  "exifData": "object",
  "uploadedAt": "string (ISO timestamp)"
}
```

#### PhotoRatings Table
```json
{
  "photoId": "string (Partition Key)",
  "userId": "string (Sort Key)",
  "rating": "number (1-5)",
  "ratedAt": "string (ISO timestamp)"
}
```

## API Endpoints

### Gallery Management

#### Create Gallery
```
POST /galleries
Content-Type: application/json

{
  "name": "Gallery Name",
  "continent": "Europe",
  "country": "France",
  "description": "Optional description",
  "years": [2023, 2024]
}
```

#### List Galleries
```
GET /galleries
```

#### Get Gallery
```
GET /galleries?id={galleryId}
```

#### Update Gallery
```
PUT /galleries
Content-Type: application/json

{
  "galleryId": "uuid",
  "name": "Updated Name",
  "continent": "Europe",
  "country": "France",
  "description": "Updated description",
  "years": [2023, 2024]
}
```

#### Delete Gallery
```
DELETE /galleries?id={galleryId}
```

### Photo Management

#### Upload Photos
```
POST /galleries?action=upload_photos&id={galleryId}
Content-Type: multipart/form-data

{
  "photos": [file1, file2, ...],
  "titles": ["Title 1", "Title 2", ...],
  "descriptions": ["Desc 1", "Desc 2", ...],
  "tags": [["tag1", "tag2"], ["tag3"], ...]
}
```

#### Delete Photo
```
POST /galleries?action=delete_photo&id={galleryId}
Content-Type: application/json

{
  "photoId": "uuid",
  "photoNumber": 1,
  "s3Key": "galleries/{galleryId}/photo1.jpg"
}
```

### Metadata Management

#### Update Galleries Metadata
```
POST /galleries?action=update_galleries_metadata
```
Scans S3 bucket and updates DynamoDB with gallery information.

#### Update Photos Metadata
```
POST /galleries?action=update_GalleryPhotos
```
Scans S3 bucket and updates DynamoDB with photo information.

### Photo Ratings

#### Rate Photo
```
POST /galleries?action=rate_photo
Content-Type: application/json

{
  "photoId": "uuid",
  "userId": "user123",
  "rating": 5
}
```

#### Get Photo Rating
```
GET /galleries?action=get_photo_rating&photoId={photoId}&userId={userId}
```

## Environment Variables

Configure these environment variables in your Lambda function:

```bash
GALLERIES_TABLE=Galleries
GALLERY_PHOTOS_TABLE=GalleryPhotos
PHOTO_RATINGS_TABLE=PhotoRatings
BUCKET_NAME=your-photography-bucket
```

## Dependencies

### Python Requirements
```
boto3==1.34.0
botocore==1.34.0
Pillow==10.2.0
```

### Lambda Layers
- **Pillow Layer**: Image processing capabilities
- **Requests Layer**: HTTP client functionality

## Deployment Instructions

### 1. Prerequisites
- AWS CLI configured
- Python 3.9+ installed
- Appropriate AWS permissions

### 2. Create S3 Bucket
```bash
aws s3 mb s3://your-photography-bucket
aws s3api put-bucket-cors --bucket your-photography-bucket --cors-configuration file://cors-config.json
```

### 3. Create DynamoDB Tables

#### Galleries Table
```bash
aws dynamodb create-table \
  --table-name Galleries \
  --attribute-definitions AttributeName=galleryId,AttributeType=S \
  --key-schema AttributeName=galleryId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

#### GalleryPhotos Table
```bash
aws dynamodb create-table \
  --table-name GalleryPhotos \
  --attribute-definitions \
    AttributeName=galleryId,AttributeType=S \
    AttributeName=photoId,AttributeType=S \
  --key-schema \
    AttributeName=galleryId,KeyType=HASH \
    AttributeName=photoId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST
```

#### PhotoRatings Table
```bash
aws dynamodb create-table \
  --table-name PhotoRatings \
  --attribute-definitions \
    AttributeName=photoId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=photoId,KeyType=HASH \
    AttributeName=userId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST
```

### 4. Create Lambda Layers

#### Pillow Layer
```bash
# Create layer directory
mkdir -p lambda-layer/python
cd lambda-layer/python

# Install Pillow
pip install Pillow -t .

# Create ZIP file
cd ..
zip -r pillow-layer.zip python/
```

#### Requests Layer
```bash
# Create layer directory
mkdir -p requests-layer/python
cd requests-layer/python

# Install requests
pip install requests -t .

# Create ZIP file
cd ..
zip -r requests-layer.zip python/
```

### 5. Deploy Lambda Function

#### Create Deployment Package
```bash
# Install dependencies
pip install -r requirements.txt -t package/

# Add Lambda function
cp lambda_gallery_manager.py package/

# Create ZIP file
cd package
zip -r lambda-deployment.zip .
```

#### Deploy to AWS
```bash
# Create Lambda function
aws lambda create-function \
  --function-name gallery-manager \
  --runtime python3.9 \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler lambda_gallery_manager.lambda_handler \
  --zip-file fileb://lambda-deployment.zip \
  --timeout 300 \
  --memory-size 1024

# Add layers
aws lambda update-function-configuration \
  --function-name gallery-manager \
  --layers arn:aws:lambda:REGION:YOUR_ACCOUNT:layer:pillow-layer:1 \
           arn:aws:lambda:REGION:YOUR_ACCOUNT:layer:requests-layer:1
```

### 6. Create API Gateway

#### Create REST API
```bash
aws apigateway create-rest-api \
  --name "Gallery API" \
  --description "Photography Gallery Management API"
```

#### Create Resources and Methods
```bash
# Get API ID and root resource ID
API_ID=$(aws apigateway get-rest-apis --query 'items[?name==`Gallery API`].id' --output text)
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?path==`/`].id' --output text)

# Create galleries resource
GALLERIES_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part "galleries" \
  --query 'id' --output text)

# Create methods
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $GALLERIES_ID \
  --http-method GET \
  --authorization-type NONE

aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $GALLERIES_ID \
  --http-method POST \
  --authorization-type NONE

aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $GALLERIES_ID \
  --http-method PUT \
  --authorization-type NONE

aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $GALLERIES_ID \
  --http-method DELETE \
  --authorization-type NONE
```

#### Deploy API
```bash
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod
```

## Usage Examples

### Frontend Integration

#### JavaScript API Client
```javascript
const API_BASE_URL = 'https://your-api-gateway-url.amazonaws.com/prod';

class GalleryAPI {
  async createGallery(galleryData) {
    const response = await fetch(`${API_BASE_URL}/galleries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(galleryData)
    });
    return response.json();
  }

  async uploadPhotos(galleryId, formData) {
    const response = await fetch(
      `${API_BASE_URL}/galleries?action=upload_photos&id=${galleryId}`,
      {
        method: 'POST',
        body: formData
      }
    );
    return response.json();
  }
}
```

### Error Handling

The API returns standardized error responses:

```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid input)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

## Security Considerations

### IAM Permissions
Ensure your Lambda execution role has appropriate permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket",
        "arn:aws:s3:::your-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/Galleries",
        "arn:aws:dynamodb:*:*:table/GalleryPhotos",
        "arn:aws:dynamodb:*:*:table/PhotoRatings"
      ]
    }
  ]
}
```

### CORS Configuration
Configure CORS for your S3 bucket:

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}
```

## Monitoring and Logging

### CloudWatch Logs
Lambda functions automatically log to CloudWatch. Monitor:
- Function execution time
- Memory usage
- Error rates
- API Gateway metrics

### Custom Metrics
Consider adding custom CloudWatch metrics for:
- Photo upload success rates
- Gallery creation frequency
- API response times

## Troubleshooting

### Common Issues

1. **Lambda Timeout**: Increase timeout for large photo uploads
2. **Memory Issues**: Increase memory allocation for image processing
3. **CORS Errors**: Verify CORS configuration in API Gateway and S3
4. **Permission Denied**: Check IAM roles and policies

### Debug Mode
Enable detailed logging by setting log level to DEBUG in the Lambda function.

## Performance Optimization

### Lambda Configuration
- **Memory**: 1024MB recommended for image processing
- **Timeout**: 300 seconds for large uploads
- **Concurrency**: Configure based on expected load

### Caching
- Implement CloudFront for image delivery
- Use DynamoDB DAX for frequently accessed data
- Consider ElastiCache for session management

## Cost Optimization

### Lambda
- Monitor function duration and optimize code
- Use provisioned concurrency for consistent load
- Implement proper error handling to avoid retries

### S3
- Use S3 Intelligent Tiering for cost-effective storage
- Implement lifecycle policies for old photos
- Use S3 Transfer Acceleration for faster uploads

### DynamoDB
- Use on-demand billing for variable workloads
- Implement proper indexing strategies
- Monitor read/write capacity units

## Future Enhancements

### Planned Features
- User authentication and authorization
- Advanced image processing (filters, effects)
- Social sharing capabilities
- Analytics and reporting
- CDN integration for global delivery

### Scalability Considerations
- Implement pagination for large galleries
- Use SQS for async photo processing
- Consider microservices architecture for complex features
- Implement proper caching strategies

## Support and Maintenance

### Regular Maintenance
- Monitor AWS service quotas
- Update dependencies regularly
- Review and optimize IAM permissions
- Backup critical data

### Documentation Updates
- Keep API documentation current
- Update deployment guides for new features
- Maintain troubleshooting guides

---

For additional support or questions, refer to the AWS documentation or contact the development team.
