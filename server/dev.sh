#!/bin/bash

# Clear any existing AWS credentials to ensure they don't interfere
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_SESSION_TOKEN

# Set environment variables for local development with DynamoDB
export DYNAMODB_ENDPOINT=http://localhost:8000
export AWS_REGION=us-east-1

# Display configuration
echo "----------------------------------------"
echo "Local DynamoDB Development Configuration"
echo "----------------------------------------"
echo "DYNAMODB_ENDPOINT: $DYNAMODB_ENDPOINT"
echo "AWS_REGION: $AWS_REGION"
echo "----------------------------------------"

# Start the server
npm start