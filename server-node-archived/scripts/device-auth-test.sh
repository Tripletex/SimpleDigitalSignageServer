#!/bin/bash

# Configuration
SERVER_URL="http://localhost:4000"  # Change this to your server URL
REGISTER_ENDPOINT="/api/device/register"
AUTH_CHALLENGE_ENDPOINT="/api/device-auth/challenge"
AUTH_VERIFY_ENDPOINT="/api/device-auth/verify"
TEST_ENDPOINT="/api/device/list"  # Protected endpoint to test authentication

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Generate a random device name
DEVICE_NAME="auth-test-device-$(date +%s)"

echo -e "${BLUE}Starting API key authentication test...${NC}"
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

# Extract UUID and API key from the response
DEVICE_UUID=$(echo "$REGISTER_RESPONSE" | jq -r '.id' 2>/dev/null)
API_KEY=$(echo "$REGISTER_RESPONSE" | jq -r '.apiKey' 2>/dev/null)

if [ -z "$DEVICE_UUID" ] || [ "$DEVICE_UUID" == "null" ]; then
    echo -e "${RED}Failed to extract UUID from registration response.${NC}"
    exit 1
fi

if [ -z "$API_KEY" ] || [ "$API_KEY" == "null" ]; then
    echo -e "${RED}Failed to extract API key from registration response.${NC}"
    exit 1
fi

echo -e "${GREEN}Device registered with ID: $DEVICE_UUID${NC}"
echo -e "${GREEN}API Key: $API_KEY${NC}"

# Test API key authentication immediately after registration
echo -e "\n${YELLOW}Step 3: Testing API key from registration...${NC}"

# Test using X-API-Key header
echo -e "${BLUE}Testing with X-API-Key header...${NC}"
HEADER_RESPONSE=$(curl -s -X GET "$SERVER_URL$TEST_ENDPOINT" \
  -H "X-API-Key: $API_KEY")

echo "API key (header) auth response:"
echo "$HEADER_RESPONSE" | jq '.' 2>/dev/null || echo "$HEADER_RESPONSE"

# Test using query parameter
echo -e "${BLUE}Testing with query parameter...${NC}"
QUERY_RESPONSE=$(curl -s -X GET "$SERVER_URL$TEST_ENDPOINT?apiKey=$API_KEY")

echo "API key (query) auth response:"
echo "$QUERY_RESPONSE" | jq '.' 2>/dev/null || echo "$QUERY_RESPONSE"

# Test using request body (for POST requests)
echo -e "${BLUE}Testing with API key in request body...${NC}"
BODY_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/device/ping" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$DEVICE_UUID\",
    \"apiKey\": \"$API_KEY\",
    \"name\": \"$DEVICE_NAME\",
    \"status\": \"online\",
    \"ipAddress\": \"127.0.0.1\",
    \"version\": \"test-1.0\",
    \"healthStatus\": \"healthy\"
  }")

echo "API key (body) auth response:"
echo "$BODY_RESPONSE" | jq '.' 2>/dev/null || echo "$BODY_RESPONSE"

# Step 4: Test challenge-based API key generation (alternative method)
echo -e "\n${YELLOW}Step 4: Testing challenge-based API key generation...${NC}"

# Request a challenge
echo -e "${BLUE}Requesting authentication challenge...${NC}"
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
    echo -e "${YELLOW}Skipping challenge-based API key generation...${NC}"
else
    echo -e "${GREEN}Received challenge: $CHALLENGE${NC}"

    # Sign the challenge
    echo -e "${BLUE}Signing the challenge...${NC}"
    
    # Create challenge data to sign with minimal formatting and no spaces
    # IMPORTANT: The exact format is critical for signature verification
    CHALLENGE_DATA=$(echo -n "{\"deviceId\":\"$DEVICE_UUID\",\"challenge\":\"$CHALLENGE\"}")

    # Log the exact data being signed for debugging
    echo "Challenge data being signed (exact format): $CHALLENGE_DATA"

    # Write challenge data to a file - ensure no extra newlines or whitespace
    echo -n "$CHALLENGE_DATA" > challenge_data.json

    # Show hash for verification
    echo "SHA256 hash of challenge data:"
    echo -n "$CHALLENGE_DATA" | openssl dgst -sha256
    
    # Sign the challenge with the private key
    openssl dgst -sha256 -sign device_private_key.pem -out signature.bin challenge_data.json
    
    # Convert signature to base64
    SIGNATURE=$(base64 < signature.bin | tr -d '\n')
    
    echo -e "${GREEN}Challenge signed successfully${NC}"
    
    # Verify the challenge to get another API key
    echo -e "${BLUE}Verifying the challenge to get another API key...${NC}"

    # Create a temporary debug directory for diagnosing challenges
    DEBUG_DIR=/tmp/device-auth-debug-$(date +%s)
    mkdir -p $DEBUG_DIR
    echo -e "${BLUE}Created debug directory: ${GREEN}$DEBUG_DIR${NC}"

    # Save all files used for verification
    echo -n "$CHALLENGE_DATA" > $DEBUG_DIR/challenge_data.json
    cp device_private_key.pem $DEBUG_DIR/private_key.pem
    cp device_public_key.pem $DEBUG_DIR/public_key.pem
    cp signature.bin $DEBUG_DIR/signature.bin
    echo "$SIGNATURE" > $DEBUG_DIR/signature.base64
    echo "$PUBLIC_KEY_BASE64" > $DEBUG_DIR/public_key.base64

    # Try different format variations to help diagnose issues
    FORMATTED_DATA="{
  \"deviceId\": \"$DEVICE_UUID\",
  \"challenge\": \"$CHALLENGE\"
}"
    echo -n "$FORMATTED_DATA" > $DEBUG_DIR/formatted_data.json
    openssl dgst -sha256 -sign device_private_key.pem -out $DEBUG_DIR/formatted_signature.bin $DEBUG_DIR/formatted_data.json
    FORMATTED_SIGNATURE=$(base64 < $DEBUG_DIR/formatted_signature.bin | tr -d '\n')
    echo "$FORMATTED_SIGNATURE" > $DEBUG_DIR/formatted_signature.base64

    # First try the standard verification
    echo -e "${BLUE}Trying standard verification...${NC}"
    VERIFY_RESPONSE=$(curl -s -X POST "$SERVER_URL$AUTH_VERIFY_ENDPOINT" \
      -H "Content-Type: application/json" \
      -d "{
        \"deviceId\": \"$DEVICE_UUID\",
        \"challenge\": \"$CHALLENGE\",
        \"signature\": \"$SIGNATURE\"
      }")

    echo "Standard verification response:"
    echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"

    # If the standard format failed, try with formatted data signature
    if echo "$VERIFY_RESPONSE" | grep -q "Invalid signature"; then
        echo -e "${YELLOW}Standard verification failed, trying formatted data...${NC}"
        FORMATTED_VERIFY_RESPONSE=$(curl -s -X POST "$SERVER_URL$AUTH_VERIFY_ENDPOINT" \
          -H "Content-Type: application/json" \
          -d "{
            \"deviceId\": \"$DEVICE_UUID\",
            \"challenge\": \"$CHALLENGE\",
            \"signature\": \"$FORMATTED_SIGNATURE\"
          }")

        echo "Formatted verification response:"
        echo "$FORMATTED_VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$FORMATTED_VERIFY_RESPONSE"

        # If the formatted verification succeeded, use that response
        if ! echo "$FORMATTED_VERIFY_RESPONSE" | grep -q "Invalid signature"; then
            VERIFY_RESPONSE="$FORMATTED_VERIFY_RESPONSE"
            echo -e "${GREEN}Formatted verification succeeded!${NC}"
        fi
    fi
    
    # Extract API key from response
    SECOND_API_KEY=$(echo "$VERIFY_RESPONSE" | jq -r '.apiKey' 2>/dev/null)
    
    if [ -z "$SECOND_API_KEY" ] || [ "$SECOND_API_KEY" == "null" ]; then
        echo -e "${RED}Initial attempts failed to obtain API key from challenge verification.${NC}"
        echo -e "${YELLOW}Trying one more approach with direct debug endpoint...${NC}"

        # Try the debug-verify endpoint as a last resort
        DEBUG_VERIFY_RESPONSE=$(curl -s -X POST "$SERVER_URL$AUTH_CHALLENGE_ENDPOINT/debug-verify" \
          -H "Content-Type: application/json" \
          -d "{
            \"rawData\": $(cat $DEBUG_DIR/challenge_data.json | jq -R .),
            \"signature\": \"$SIGNATURE\",
            \"publicKeyBase64\": \"$PUBLIC_KEY_BASE64\"
          }")

        echo "Debug verification response:"
        echo "$DEBUG_VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$DEBUG_VERIFY_RESPONSE"

        # If debug verify succeeded, try the normal verify endpoint again
        if echo "$DEBUG_VERIFY_RESPONSE" | grep -q "success\": true"; then
            echo -e "${GREEN}Debug verification succeeded! Trying normal verify endpoint one more time...${NC}"

            FINAL_VERIFY_RESPONSE=$(curl -s -X POST "$SERVER_URL$AUTH_VERIFY_ENDPOINT" \
              -H "Content-Type: application/json" \
              -d "{
                \"deviceId\": \"$DEVICE_UUID\",
                \"challenge\": \"$CHALLENGE\",
                \"signature\": \"$SIGNATURE\"
              }")

            echo "Final verification response:"
            echo "$FINAL_VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$FINAL_VERIFY_RESPONSE"

            # Extract API key from final response
            SECOND_API_KEY=$(echo "$FINAL_VERIFY_RESPONSE" | jq -r '.apiKey' 2>/dev/null)
        fi

        # If still no API key, give up
        if [ -z "$SECOND_API_KEY" ] || [ "$SECOND_API_KEY" == "null" ]; then
            echo -e "${RED}All attempts to obtain API key from challenge verification failed.${NC}"
            echo -e "${RED}Check server logs and debug files in $DEBUG_DIR for more information.${NC}"
        else
            echo -e "${GREEN}Successfully obtained API key after additional attempts!${NC}"
        fi
    fi

    # If we got an API key, test it
    if [ -n "$SECOND_API_KEY" ] && [ "$SECOND_API_KEY" != "null" ]; then
        echo -e "${GREEN}Received second API key: $SECOND_API_KEY${NC}"

        # Test the second API key
        echo -e "\n${YELLOW}Step 5: Testing the second API key...${NC}"

        SECOND_KEY_RESPONSE=$(curl -s -X GET "$SERVER_URL$TEST_ENDPOINT" \
          -H "X-API-Key: $SECOND_API_KEY")

        echo "Second API key auth response:"
        echo "$SECOND_KEY_RESPONSE" | jq '.' 2>/dev/null || echo "$SECOND_KEY_RESPONSE"
    fi
fi

# Clean up temporary files
rm -f device_private_key.pem device_public_key.pem challenge_data.json signature.bin

echo -e "\n${GREEN}API key authentication test completed${NC}"