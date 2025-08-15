#!/usr/bin/env python3
"""
Script to create the Subscriptions DynamoDB table
Run this script to ensure the Subscriptions table exists with proper configuration
"""

import boto3
import json
import sys
from botocore.exceptions import ClientError

def create_subscriptions_table():
    """Create the Subscriptions DynamoDB table"""
    
    # Initialize DynamoDB client
    dynamodb = boto3.resource('dynamodb')
    
    # Table configuration
    table_name = 'Subscriptions'
    
    # Check if table already exists
    try:
        table = dynamodb.Table(table_name)
        table.load()
        print(f"✅ Table '{table_name}' already exists")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print(f"Table '{table_name}' does not exist, creating...")
        else:
            print(f"Error checking table existence: {e}")
            return False
    
    # Create table
    try:
        table = dynamodb.create_table(
            TableName=table_name,
            AttributeDefinitions=[
                {
                    'AttributeName': 'email',
                    'AttributeType': 'S'
                }
            ],
            KeySchema=[
                {
                    'AttributeName': 'email',
                    'KeyType': 'HASH'
                }
            ],
            BillingMode='PAY_PER_REQUEST',
            Tags=[
                {
                    'Key': 'Project',
                    'Value': 'PhotographyWeb'
                },
                {
                    'Key': 'Environment',
                    'Value': 'Production'
                }
            ]
        )
        
        # Wait for table to be created
        print("Creating table...")
        table.meta.client.get_waiter('table_exists').wait(TableName=table_name)
        
        print(f"✅ Successfully created table '{table_name}'")
        return True
        
    except ClientError as e:
        print(f"❌ Error creating table: {e}")
        return False

def main():
    """Main function"""
    print("🔧 Creating Subscriptions DynamoDB Table")
    print("=" * 50)
    
    success = create_subscriptions_table()
    
    if success:
        print("\n✅ Setup completed successfully!")
        print("\nNext steps:")
        print("1. Deploy the updated Lambda function")
        print("2. Ensure API Gateway has the /subscribe endpoint configured")
        print("3. Test the subscription functionality")
    else:
        print("\n❌ Setup failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
