import json
import boto3
import uuid
from datetime import datetime
from botocore.exceptions import ClientError
import logging
import os
import re

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)
logger.info("==== User Lambda START ====")

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb')
SUBSCRIPTIONS_TABLE_NAME = os.getenv('SUBSCRIPTIONS_TABLE', 'Subscriptions')
tbl_subscriptions = dynamodb.Table(SUBSCRIPTIONS_TABLE_NAME)

def lambda_handler(event, context):
    """
    Main Lambda handler for user-facing operations
    """
    logger.info(f"Received event: {event}")
    
    # Parse the HTTP method and path
    http_method = event.get('httpMethod', 'GET')
    path = event.get('path', '')
    
    # Parse request body if present
    body = {}
    if event.get('body'):
        body = json.loads(event.get('body', '{}'))
    
    # Parse query parameters
    query_params = event.get('queryStringParameters') or {}
    
    logger.info(f"Body: {body}")
    logger.info(f"Query params: {query_params}")
    
    # CORS preflight support
    if http_method == 'OPTIONS':
        return create_response(200, {'ok': True})
    
    # Route to appropriate handler
    if http_method == 'POST' and '/subscribe' in path:
        return subscribe_user(body)
    else:
        return create_response(400, {'error': 'Invalid endpoint or method'})

def subscribe_user(subscription_data):
    """
    Subscribe a user to receive notifications when new galleries are added
    """
    try:
        logger.info(f"Processing subscription request: {subscription_data}")
        
        # Validate required fields
        if 'email' not in subscription_data:
            return create_response(400, {'error': 'Email is required'})
        
        email = subscription_data['email'].strip().lower()
        
        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return create_response(400, {'error': 'Invalid email format'})
        
        current_time = datetime.utcnow().isoformat() + 'Z'
        
        # Check if user is already subscribed
        try:
            existing_subscription = tbl_subscriptions.get_item(Key={'email': email})
            
            if existing_subscription.get('Item'):
                # User already subscribed, update status to active if needed
                if existing_subscription['Item'].get('status') != 'active':
                    tbl_subscriptions.update_item(
                        Key={'email': email},
                        UpdateExpression='SET status = :status, updatedAt = :now',
                        ExpressionAttributeValues={
                            ':status': 'active',
                            ':now': current_time
                        }
                    )
                    logger.info(f"Reactivated subscription for {email}")
                    return create_response(200, {
                        'message': 'Subscription reactivated successfully',
                        'email': email,
                        'status': 'active'
                    })
                else:
                    logger.info(f"User {email} is already subscribed")
                    return create_response(200, {
                        'message': 'You are already subscribed',
                        'email': email,
                        'status': 'active'
                    })
            else:
                # Create new subscription
                subscription_item = {
                    'email': email,
                    'status': 'active',
                    'createdAt': current_time,
                    'updatedAt': current_time
                }
                
                tbl_subscriptions.put_item(Item=subscription_item)
                logger.info(f"Created new subscription for {email}")
                
                return create_response(201, {
                    'message': 'Successfully subscribed! You will receive notifications when new galleries are added.',
                    'email': email,
                    'status': 'active'
                })
                
        except Exception as e:
            logger.error(f"Error processing subscription for {email}: {str(e)}")
            return create_response(500, {'error': 'Failed to process subscription', 'details': str(e)})
            
    except Exception as e:
        logger.error(f"Error in subscribe_user: {str(e)}")
        return create_response(500, {'error': 'Failed to subscribe user', 'details': str(e)})

def create_response(status_code, body):
    """
    Create a standardized HTTP response
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Origin',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Max-Age': '86400'
        },
        'body': json.dumps(body, ensure_ascii=False)
    }
