#!/bin/bash
#
# Complete authentication flow test with curl
#

# Colors for readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SERVER_URL="http://localhost:4000"  # Change this to your server URL
REGISTER_ENDPOINT="/api/device/register"
CHALLENGE_ENDPOINT="/api/device-auth/challenge"
VERIFY_ENDPOINT="/api/device-auth/verify"

echo -e "${BLUE}Starting complete authentication flow test with curl...${NC}"

# Step 1: Generate RSA keys
echo -e "\n${YELLOW}Step 1: Generating RSA key pair...${NC}"
openssl genrsa -out curl_private_key.pem 2048 > /dev/null 2>&1
openssl rsa -in curl_private_key.pem -pubout -out curl_public_key.pem > /dev/null 2>&1

PUBLIC_KEY_BASE64=$(cat curl_public_key.pem | base64 | tr -d '\n')
echo -e "${GREEN}Key pair generated${NC}"

# Step 2: Register device
echo -e "\n${YELLOW}Step 2: Registering device...${NC}"
REGISTER_REQUEST="{
  \"deviceType\": \"curl-test-device\",
  \"hardwareId\": \"curl-test-$(date +%s)\",
  \"publicKey\": \"$PUBLIC_KEY_BASE64\"
}"

echo "$REGISTER_REQUEST" > curl_register_request.json
echo -e "${BLUE}Request saved to curl_register_request.json${NC}"

REGISTER_RESPONSE=$(curl -s -X POST "$SERVER_URL$REGISTER_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d @curl_register_request.json)

echo "Registration response:"
echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"

# Extract device ID
DEVICE_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.id' 2>/dev/null)

if [ -z "$DEVICE_ID" ] || [ "$DEVICE_ID" == "null" ]; then
  echo -e "${RED}Failed to extract device ID from response${NC}"
  exit 1
fi

echo -e "${GREEN}Device registered with ID: $DEVICE_ID${NC}"

# Step 3: Request challenge
echo -e "\n${YELLOW}Step 3: Requesting challenge...${NC}"
CHALLENGE_REQUEST="{
  \"deviceId\": \"$DEVICE_ID\"
}"

echo "$CHALLENGE_REQUEST" > curl_challenge_request.json

CHALLENGE_RESPONSE=$(curl -s -X POST "$SERVER_URL$CHALLENGE_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d @curl_challenge_request.json)

echo "Challenge response:"
echo "$CHALLENGE_RESPONSE" | jq '.' 2>/dev/null || echo "$CHALLENGE_RESPONSE"

# Extract challenge
CHALLENGE=$(echo "$CHALLENGE_RESPONSE" | jq -r '.challenge' 2>/dev/null)

if [ -z "$CHALLENGE" ] || [ "$CHALLENGE" == "null" ]; then
  echo -e "${RED}Failed to extract challenge from response${NC}"
  exit 1
fi

echo -e "${GREEN}Challenge received: $CHALLENGE${NC}"

# Step 4: Sign challenge
echo -e "\n${YELLOW}Step 4: Signing challenge...${NC}"
DATA_TO_SIGN="{\"deviceId\":\"$DEVICE_ID\",\"challenge\":\"$CHALLENGE\"}"
echo "$DATA_TO_SIGN" > curl_data_to_sign.json

# Sign with OpenSSL
openssl dgst -sha256 -sign curl_private_key.pem -out curl_signature.bin curl_data_to_sign.json
SIGNATURE_BASE64=$(base64 < curl_signature.bin | tr -d '\n')

echo -e "${GREEN}Challenge signed${NC}"
echo -e "${BLUE}Signature length: ${#SIGNATURE_BASE64} characters${NC}"

# Step 5: Verify challenge
echo -e "\n${YELLOW}Step 5: Verifying challenge...${NC}"
VERIFY_REQUEST="{
  \"deviceId\": \"$DEVICE_ID\",
  \"challenge\": \"$CHALLENGE\",
  \"signature\": \"$SIGNATURE_BASE64\"
}"

echo "$VERIFY_REQUEST" > curl_verify_request.json
echo -e "${BLUE}Request saved to curl_verify_request.json${NC}"

VERIFY_RESPONSE=$(curl -v -X POST "$SERVER_URL$VERIFY_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d @curl_verify_request.json 2>&1)

echo "Verification response:"
echo "$VERIFY_RESPONSE" | grep -v "^*" | grep -v "^}" | tail -n +2

# Extract the JSON body from the verbose output (very crude extraction)
JSON_RESPONSE=$(echo "$VERIFY_RESPONSE" | grep -A 100 "^{" | grep -B 100 "^}" | tr -d '\n')

# Check if we received a token
if [[ "$JSON_RESPONSE" == *"\"token\""* ]]; then
  echo -e "\n${GREEN}Authentication successful!${NC}"
  echo "Token received"
else
  echo -e "\n${RED}Authentication failed${NC}"
  echo "No token received"
fi

echo -e "\n${BLUE}Test completed${NC}"