#!/bin/bash

# Set local DynamoDB endpoint
ENDPOINT_URL="http://localhost:8000"

echo "Creating DeviceRegistrations table in local DynamoDB..."

# Create the DeviceRegistrations table
aws dynamodb create-table \
  --table-name DeviceRegistrations \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --endpoint-url $ENDPOINT_URL

echo "Table creation completed. Listing tables to verify:"
aws dynamodb list-tables --endpoint-url $ENDPOINT_URL