# Admin Panel Usage Guide

## Overview

The admin panel uses Lambda backend APIs to manage galleries, replacing the previous direct S3 operation method, providing a more secure and reliable gallery management experience.

## File Structure

```
admin/
├── admin.html                 # Main admin page
├── admin-script.js            # Admin panel script
├── gallery-edit.html          # Gallery edit page
├── gallery-edit.js            # Edit page script
├── admin-styles.css           # Admin panel styles
└── API_ADMIN_USAGE_GUIDE_EN.md   # This usage guide
```

## Prerequisites

### 1. Deploy Lambda Function
Ensure you have deployed the Lambda function and API Gateway according to `lambda_deployment_guide.md`.

### 2. Configure API URL
Before using, you need to update the API URL in two script files:

#### Update `admin-script-api.js`
```javascript
// Line 2, replace with your actual API Gateway URL
const API_BASE_URL = 'https://your-api-id.execute-api.region.amazonaws.com/prod';
```

#### Update `gallery-edit-api.js`
```javascript
// Line 2, replace with your actual API Gateway URL  
const API_BASE_URL = 'https://your-api-id.execute-api.region.amazonaws.com/prod';
```

## Features

### ✅ Supported Features

#### Gallery Management
- **Create New Gallery** - Complete form validation and error handling
- **View Gallery List** - Real-time data fetching from API
- **Edit Gallery Information** - Modify name, description, tags
- **Delete Gallery** - Secure deletion with confirmation mechanism
- **Tag Management** - Add/remove gallery tags

#### Photo Management
- **View Photos** - Display all photos in the gallery
- **Edit Photo Information** - Modify photo title and description
- **Delete Photos** - Remove photos from gallery
- **Photo Details** - View photo metadata

### ❌ Unsupported Features

#### Photo Upload
- **Reason**: Photo upload requires direct S3 access permissions, not supported in API mode
- **Alternative**: Continue using the original admin panel for photo uploads
- **Future**: Consider implementing presigned URL-based upload functionality

## Usage Workflow

### Create New Gallery

1. Visit `admin.html`
2. Ensure you're on the "Create Gallery" tab
3. Fill in required fields:
   - **Continent**
   - **Country** 
   - **Gallery Name**
4. Optional fields:
   - **Description**
   - **Tags** - Add at least one
5. Click "Create Gallery" button

### Manage Existing Galleries

1. Switch to "Manage Galleries" tab
2. View all gallery list
3. Use filters by continent/country
4. For each gallery you can:
   - Click "Edit" to edit gallery
   - Click "Delete" to delete gallery

### Edit Gallery

1. Click "Edit" button from gallery list
2. Or directly visit `gallery-edit.html?gallery=galleryID`
3. On the edit page you can:
   - Modify gallery name and description
   - Add/remove tags
   - View and manage photos
   - Edit photo information
4. Click "Save Changes" to save modifications

## Error Handling

### Common Errors and Solutions

#### API URL Not Configured
- **Error**: Page displays "Please update API_BASE_URL" warning
- **Solution**: Follow the instructions above to update API URL

#### API Connection Failed
- **Error**: Displays "Error loading galleries" and other error messages
- **Solution**: Check if Lambda function and API Gateway are running normally

#### Gallery Loading Failed
- **Error**: Gallery edit page displays loading error
- **Solution**: Confirm gallery ID is correct, check API response data

#### Save Failed
- **Error**: Error message displayed after clicking save
- **Solution**: Check input data format, confirm API permissions

### Debugging Tips

1. **Open Browser Developer Tools**
   - Press F12 to open console
   - Check error messages in Console tab
   - View API requests in Network tab

2. **Check API Response**
   - Look for HTTP status codes
   - Check response body for error details
   - Verify request payload format

3. **Common Issues**
   - CORS errors: Check API Gateway CORS settings
   - Authentication errors: Verify API key or IAM permissions
   - Network errors: Check internet connection and API endpoint

## Security Features

### Comparison with Original Version

- **API Gateway**: All requests go through AWS API Gateway with built-in security
- **Lambda Functions**: Serverless functions with controlled access to AWS resources
- **IAM Roles**: Fine-grained permissions for database and S3 access
- **Request Validation**: Input validation and sanitization
- **Rate Limiting**: API Gateway provides built-in rate limiting

### Best Practices

1. **API Key Management**: Rotate API keys regularly
2. **Access Control**: Use IAM roles with minimal required permissions
3. **Input Validation**: Always validate and sanitize user inputs
4. **Error Handling**: Don't expose sensitive information in error messages
5. **Monitoring**: Set up CloudWatch alarms for API usage

## Performance Optimization

### Data Loading Strategy

- **Lazy Loading**: Load galleries only when needed
- **Pagination**: Implement pagination for large datasets
- **Caching**: Use browser caching for static resources
- **Optimization**: Minimize API calls and optimize response size

### Network Optimization

- **CDN**: Use CloudFront for static content delivery
- **Compression**: Enable gzip compression for API responses
- **Connection Pooling**: Reuse HTTP connections when possible
- **Timeout Handling**: Set appropriate request timeouts

## Troubleshooting

### Page Won't Load

1. Check if all required files are present
2. Verify JavaScript console for errors
3. Check network connectivity
4. Ensure API endpoint is accessible

### API Calls Fail

1. Verify API URL configuration
2. Check Lambda function status
3. Review CloudWatch logs
4. Confirm API Gateway configuration

### Data Out of Sync

1. Refresh page to reload data
2. Check API response timestamps
3. Verify database consistency
4. Clear browser cache if needed

## Support

### Getting Help

- **Documentation**: Check this guide and related documentation
- **Logs**: Review CloudWatch logs for detailed error information
- **Testing**: Use test endpoints to verify functionality
- **Community**: Check AWS forums and documentation

### Reporting Issues

When reporting issues, please include:
- Browser and version
- Error messages from console
- API response details
- Steps to reproduce the issue

## Update Log

### v1.0 (Current Version)

- ✅ Basic gallery CRUD operations
- ✅ Photo management within galleries
- ✅ Tag system implementation
- ✅ Responsive design for mobile devices
- ✅ Error handling and user feedback
- ✅ Security improvements with API Gateway

### Future Plans

- 🔄 Photo upload via presigned URLs
- 🔄 Advanced search and filtering
- 🔄 Bulk operations for galleries
- 🔄 User authentication and roles
- 🔄 Analytics and usage statistics

## Conclusion

This admin panel provides a modern, secure, and efficient way to manage your photography galleries. By using AWS Lambda and API Gateway, you get enterprise-grade security and scalability while maintaining a simple and intuitive user interface.

For any questions or issues, please refer to the troubleshooting section above or check the AWS documentation for your specific setup.
