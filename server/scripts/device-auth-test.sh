#!/bin/bash

# Configuration
SERVER_URL="http://localhost:3000"  # Change this to your server URL
REGISTER_ENDPOINT="/api/device/register"
AUTH_CHALLENGE_ENDPOINT="/api/device/auth/challenge"
AUTH_VERIFY_ENDPOINT="/api/device/auth/verify"
TEST_ENDPOINT="/api/device/list"  # Protected endpoint to test authentication

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Generate a random device name
DEVICE_NAME="auth-test-device-$(date +%s)"

echo -e "${BLUE}Starting device authentication test...${NC}"
echo -e "${BLUE}Device name: ${GREEN}$DEVICE_NAME${NC}"

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}OpenSSL is required but not installed. Please install OpenSSL.${NC}"
    exit 1
fi

# Step 1: Generate RSA key pair for the device
echo -e "\n${YELLOW}Step 1: Generating RSA key pair for the device...${NC}"

# Generate private key
openssl genrsa -out device_private_key.pem 2048 > /dev/null 2>&1

# Generate public key
openssl rsa -in device_private_key.pem -pubout -out device_public_key.pem > /dev/null 2>&1

# Convert keys to base64 for easier transmission
PRIVATE_KEY_BASE64=$(cat device_private_key.pem | base64 | tr -d '\n')
PUBLIC_KEY_BASE64=$(cat device_public_key.pem | base64 | tr -d '\n')

echo -e "${GREEN}Key pair generated successfully${NC}"
echo -e "${BLUE}Private key saved to ${GREEN}device_private_key.pem${NC}"
echo -e "${BLUE}Public key saved to ${GREEN}device_public_key.pem${NC}"

# Step 2: Register the device with the server
echo -e "\n${YELLOW}Step 2: Registering device with public key...${NC}"

REGISTER_RESPONSE=$(curl -s -X POST "$SERVER_URL$REGISTER_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"deviceType\": \"test-device\",
    \"hardwareId\": \"$(uuidgen)\",
    \"publicKey\": \"$PUBLIC_KEY_BASE64\"
  }")

echo "Registration response:"
echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"

# Extract UUID from the response
DEVICE_UUID=$(echo "$REGISTER_RESPONSE" | jq -r '.id' 2>/dev/null)

if [ -z "$DEVICE_UUID" ] || [ "$DEVICE_UUID" == "null" ]; then
    echo -e "${RED}Failed to extract UUID from registration response.${NC}"
    exit 1
fi

echo -e "${GREEN}Device registered with ID: $DEVICE_UUID${NC}"

# Step 3: Request an authentication challenge
echo -e "\n${YELLOW}Step 3: Requesting authentication challenge...${NC}"

CHALLENGE_RESPONSE=$(curl -s -X POST "$SERVER_URL$AUTH_CHALLENGE_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"deviceId\": \"$DEVICE_UUID\"
  }")

echo "Challenge response:"
echo "$CHALLENGE_RESPONSE" | jq '.' 2>/dev/null || echo "$CHALLENGE_RESPONSE"

# Extract challenge from response
CHALLENGE=$(echo "$CHALLENGE_RESPONSE" | jq -r '.challenge' 2>/dev/null)

if [ -z "$CHALLENGE" ] || [ "$CHALLENGE" == "null" ]; then
    echo -e "${RED}Failed to extract challenge from response.${NC}"
    exit 1
fi

echo -e "${GREEN}Received challenge: $CHALLENGE${NC}"

# Step 4: Sign the challenge
echo -e "\n${YELLOW}Step 4: Signing the challenge...${NC}"

# Create challenge data to sign
CHALLENGE_DATA=$(cat <<EOF
{
  "deviceId": "$DEVICE_UUID",
  "challenge": "$CHALLENGE"
}
EOF
)

# Write challenge data to a file
echo "$CHALLENGE_DATA" > challenge_data.json

# Sign the challenge with the private key
openssl dgst -sha256 -sign device_private_key.pem -out signature.bin challenge_data.json

# Convert signature to base64
SIGNATURE=$(base64 < signature.bin | tr -d '\n')

echo -e "${GREEN}Challenge signed successfully${NC}"

# Step 5: Verify the challenge and get a token
echo -e "\n${YELLOW}Step 5: Verifying the challenge to get a JWT token...${NC}"

VERIFICATION_RESPONSE=$(curl -s -X POST "$SERVER_URL$AUTH_VERIFY_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"deviceId\": \"$DEVICE_UUID\",
    \"challenge\": \"$CHALLENGE\",
    \"signature\": \"$SIGNATURE\"
  }")

echo "Verification response:"
echo "$VERIFICATION_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFICATION_RESPONSE"

# Extract token from response
TOKEN=$(echo "$VERIFICATION_RESPONSE" | jq -r '.token' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo -e "${RED}Failed to obtain JWT token.${NC}"
    exit 1
fi

echo -e "${GREEN}Received JWT token${NC}"

# Step 6: Test the token on a protected endpoint
echo -e "\n${YELLOW}Step 6: Testing JWT token on a protected endpoint...${NC}"

TEST_RESPONSE=$(curl -s -X GET "$SERVER_URL$TEST_ENDPOINT" \
  -H "Authorization: Bearer $TOKEN")

echo "Protected endpoint response:"
echo "$TEST_RESPONSE" | jq '.' 2>/dev/null || echo "$TEST_RESPONSE"

# Clean up temporary files
rm -f challenge_data.json signature.bin

echo -e "\n${GREEN}Device authentication test completed${NC}"