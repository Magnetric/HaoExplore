# User Lambda Setup Guide

This guide explains how to set up the user lambda function for handling user-facing operations like subscriptions.

## Overview

The user lambda is separated from the admin lambda to:
- Improve security by isolating user and admin operations
- Better resource management
- Easier maintenance and scaling

## Files Created

1. `user-lambda.py` - Main user lambda function
2. `deploy-user-lambda.py` - Deployment script
3. `user-requirements.txt` - Dependencies for user lambda

## Deployment Steps

### 1. Deploy the User Lambda Function

```bash
cd backend
python deploy-user-lambda.py
```

When prompted, enter your user lambda function name (e.g., `photography-user-api`)

### 2. Create API Gateway for User Lambda

1. Go to AWS API Gateway console
2. Create a new REST API
3. Create a new resource `/subscribe`
4. Create a POST method for `/subscribe`
5. Integrate with your user lambda function
6. Deploy the API to a stage (e.g., `prod`)

### 3. Update Frontend Configuration

After creating the API Gateway, update the frontend configuration:

1. Get your API Gateway URL (format: `https://your-api-id.execute-api.eu-north-1.amazonaws.com/prod`)
2. Update `js/script.js` line 254:
   ```javascript
   const USER_API_BASE_URL = 'https://your-actual-api-id.execute-api.eu-north-1.amazonaws.com/prod';
   ```

### 4. Configure Lambda Permissions

Ensure your user lambda has the following permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem"
            ],
            "Resource": "arn:aws:dynamodb:*:*:table/Subscriptions"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}
```

### 5. Environment Variables

Set the following environment variables for your user lambda:

- `SUBSCRIPTIONS_TABLE`: Name of your DynamoDB subscriptions table (default: `Subscriptions`)

## Testing

### Test the Subscription Endpoint

```bash
curl -X POST https://your-user-api-id.execute-api.eu-north-1.amazonaws.com/prod/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

Expected response:
```json
{
  "message": "Successfully subscribed! You will receive notifications when new galleries are added.",
  "email": "test@example.com",
  "status": "active"
}
```

### Test Frontend Integration

1. Open your website
2. Try subscribing with a valid email
3. Check the browser console for any errors
4. Verify the subscription is created in DynamoDB

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure API Gateway has CORS enabled
2. **Permission Denied**: Check Lambda execution role permissions
3. **Table Not Found**: Verify DynamoDB table name and region
4. **API Gateway Integration**: Ensure lambda integration is configured correctly

### Logs

Check CloudWatch logs for your user lambda function:
- Log group: `/aws/lambda/your-user-function-name`
- Look for any error messages or debugging information

## Security Considerations

1. **Input Validation**: The lambda validates email format
2. **Rate Limiting**: Consider adding API Gateway rate limiting
3. **CORS**: Configure CORS properly for your domain
4. **Logging**: Sensitive data is not logged

## Next Steps

After successful deployment:

1. Test the subscription functionality thoroughly
2. Monitor CloudWatch logs for any issues
3. Consider adding additional user endpoints as needed
4. Set up monitoring and alerting for the user lambda
