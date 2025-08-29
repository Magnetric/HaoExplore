# Subscribe Functionality Fix Guide

## Problem Summary

The subscribe functionality in your photography website is currently failing with "Internal server error" responses. This indicates that the backend infrastructure for handling subscriptions is not properly configured.

## Root Causes

1. **Missing API Gateway Endpoint**: The `/subscribe` endpoint is not configured in API Gateway
2. **Missing DynamoDB Table**: The `Subscriptions` table doesn't exist
3. **Missing Lambda Function**: The user lambda function for handling subscriptions is not deployed
4. **Configuration Mismatch**: The frontend is trying to call an endpoint that doesn't exist

## Current Status

- ✅ Main galleries API: Working (`/galleries`)
- ❌ Subscribe API: Not working (`/subscribe` - returns 500 Internal Server Error)
- ✅ Frontend code: Correctly implemented
- ❌ Backend infrastructure: Incomplete

## Step-by-Step Fix

### Step 1: Create DynamoDB Table

1. **Navigate to AWS Console** → DynamoDB
2. **Create Table** with these settings:
   - Table name: `Subscriptions`
   - Partition key: `email` (String)
   - Billing mode: Pay per request
3. **Or use the provided script**:
   ```bash
   cd backend
   python create-subscriptions-table.py
   ```

### Step 2: Deploy User Lambda Function

1. **Create new Lambda function**:
   - Runtime: Python 3.9+
   - Handler: `user-lambda.lambda_handler`
   - Role: Create new role with DynamoDB permissions

2. **Upload the code** from `backend/user-lambda.py`

3. **Set environment variables**:
   - `SUBSCRIPTIONS_TABLE`: `Subscriptions`

4. **Configure permissions**:
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
           }
       ]
   }
   ```

### Step 3: Configure API Gateway

1. **Go to your existing API** (ID: `5nuxhstp12`)
2. **Create new resource** `/subscribe`
3. **Create POST method** and integrate with your new user lambda function
4. **Enable CORS** for the `/subscribe` resource
5. **Deploy the API** to the `prod` stage

### Step 4: Test the Fix

1. **Use the test page**: Open `subscribe-test.html` in your browser
2. **Test the subscribe endpoint** to verify it's working
3. **Test the main website** subscribe functionality

## Alternative Quick Fix (Temporary)

If you want to get the subscribe functionality working quickly without setting up the full backend, you can modify the frontend to use a mock service:

```javascript
// In js/script.js, replace the handleSubscribeSubmit method with:
async handleSubscribeSubmit(email) {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        this.showSubscribeMessage('Please enter a valid email address.', 'error');
        return;
    }

    // Show loading state
    this.showSubscribeMessage('Subscribing...', 'info');
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock successful subscription
    this.showSubscribeMessage('Successfully subscribed! (Demo mode)', 'success');
    
    // Close dropdown and reset form
    const subscribeDropdown = document.getElementById('subscribeDropdown');
    const subscribeForm = document.getElementById('subscribeForm');
    subscribeDropdown.classList.remove('active');
    subscribeForm.reset();
    
    // Store in localStorage for demo purposes
    const subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '[]');
    subscriptions.push({ email, timestamp: new Date().toISOString() });
    localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
}
```

## Verification Checklist

- [ ] DynamoDB `Subscriptions` table exists
- [ ] User lambda function is deployed and configured
- [ ] API Gateway has `/subscribe` endpoint with POST method
- [ ] CORS is enabled for the subscribe endpoint
- [ ] API is deployed to production stage
- [ ] Frontend can successfully call the subscribe endpoint
- [ ] Subscriptions are stored in DynamoDB

## Testing Commands

```bash
# Test the subscribe endpoint
curl -X POST https://5nuxhstp12.execute-api.eu-north-1.amazonaws.com/prod/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Expected response:
# {"message": "Successfully subscribed! You will receive notifications when new galleries are added.", "email": "test@example.com", "status": "active"}
```

## Common Issues and Solutions

### Issue: "Internal server error"
- **Cause**: Lambda function not deployed or misconfigured
- **Solution**: Deploy the user lambda function and verify configuration

### Issue: "Table not found"
- **Cause**: DynamoDB table doesn't exist
- **Solution**: Create the Subscriptions table

### Issue: CORS errors
- **Cause**: CORS not enabled on the subscribe endpoint
- **Solution**: Enable CORS in API Gateway for the `/subscribe` resource

### Issue: Permission denied
- **Cause**: Lambda execution role lacks DynamoDB permissions
- **Solution**: Update the execution role with proper permissions

## Next Steps After Fix

1. **Monitor CloudWatch logs** for any subscription-related errors
2. **Set up CloudWatch alarms** for failed subscription attempts
3. **Consider adding email verification** for new subscriptions
4. **Implement unsubscribe functionality** if needed
5. **Add subscription management** in the admin panel

## Support

If you continue to have issues after following this guide:
1. Check CloudWatch logs for detailed error messages
2. Verify all AWS resources are in the same region
3. Ensure your AWS credentials have the necessary permissions
4. Test the API endpoints individually using the test page
