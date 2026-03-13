#!/bin/bash
#
# Device Authentication Test
# 
# This script demonstrates the full device authentication flow:
# 1. Register a device with the server, providing a public key
# 2. Request an authentication challenge
# 3. Sign the challenge with the device's private key
# 4. Send the signed challenge to get a JWT token
# 5. Use the JWT token to authenticate API requests
# 
# This follows a passwordless WebAuthn-style authentication flow
# that's suitable for IoT and digital signage devices.

# Configuration
SERVER_URL="http://localhost:4000"  # Change this to your server URL
REGISTER_ENDPOINT="/api/device/register"
PING_ENDPOINT="/api/device/ping"
AUTH_CHALLENGE_ENDPOINT="/api/device-auth/challenge"
AUTH_VERIFY_ENDPOINT="/api/device-auth/verify"

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Generate a random device name
DEVICE_NAME="test-device-$(date +%s)"

echo -e "${BLUE}Starting device simulation script with JWT authentication...${NC}"
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

# Print some debug info
echo -e "${BLUE}Public key length: ${#PUBLIC_KEY_BASE64} characters${NC}"
echo -e "${BLUE}First 40 chars of public key: ${PUBLIC_KEY_BASE64:0:40}...${NC}"

# Save request to file for debugging
REGISTER_REQUEST="{
  \"deviceType\": \"test-device\",
  \"hardwareId\": \"$(uuidgen)\",
  \"publicKey\": \"$PUBLIC_KEY_BASE64\"
}"

echo "$REGISTER_REQUEST" > register_request.json
echo -e "${BLUE}Request saved to register_request.json${NC}"

# Use verbose curl to show headers
echo -e "${BLUE}Sending registration request to $SERVER_URL$REGISTER_ENDPOINT${NC}"
REGISTER_RESPONSE=$(curl -v -X POST "$SERVER_URL$REGISTER_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$REGISTER_REQUEST" 2>&1)

# Save the response to a file for debugging
echo "$REGISTER_RESPONSE" > register_response.txt
echo -e "${BLUE}Response saved to register_response.txt${NC}"

echo "Registration response:"
echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"

# Extract UUID from the response - first try to parse JSON
DEVICE_UUID=$(echo "$REGISTER_RESPONSE" | jq -r '.id' 2>/dev/null)

# If that fails, try to extract from the verbose output (look for "id": "UUID" pattern)
if [ -z "$DEVICE_UUID" ] || [ "$DEVICE_UUID" == "null" ]; then
    echo -e "${YELLOW}Failed to extract UUID from JSON response, trying to parse response text...${NC}"
    
    # Try to extract id from a JSON-like string in the response
    EXTRACTED_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d':' -f2 | tr -d '"')
    
    if [ ! -z "$EXTRACTED_ID" ]; then
        DEVICE_UUID="$EXTRACTED_ID"
        echo -e "${GREEN}Found device ID in response: $DEVICE_UUID${NC}"
    else
        echo -e "${RED}Failed to extract UUID from registration response.${NC}"
        echo -e "${YELLOW}To debug, examine register_response.txt and register_request.json${NC}"
        echo "Registration request:"
        cat register_request.json | jq '.' 2>/dev/null || cat register_request.json
        echo "Response (first 500 characters):"
        head -c 500 register_response.txt
        exit 1
    fi
fi

echo -e "${GREEN}Device registered with ID: $DEVICE_UUID${NC}"
echo -e "\n${YELLOW}============================================${NC}"
echo -e "${YELLOW}DEVICE UUID FOR CLAIMING: ${GREEN}$DEVICE_UUID${NC}"
echo -e "${YELLOW}============================================${NC}\n"

# Save UUID to file for easy reference
echo "$DEVICE_UUID" > device-uuid.txt
echo -e "${BLUE}UUID saved to ${GREEN}device-uuid.txt${NC}\n"

# Step 3: Authenticate device and get JWT token
echo -e "\n${YELLOW}Step 3: Authenticating device to get JWT token...${NC}"

# Request authentication challenge
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
    exit 1
fi

# Create challenge data to sign - EXACTLY matching the format expected by the server
CHALLENGE_DATA="{\"deviceId\":\"$DEVICE_UUID\",\"challenge\":\"$CHALLENGE\"}"

# Write challenge data to a file
echo "$CHALLENGE_DATA" > challenge_data.json
echo -e "${BLUE}Challenge data saved to challenge_data.json${NC}"

# Display detailed information for debugging
echo -e "${YELLOW}Challenge details:${NC}"
echo -e "  Device ID: $DEVICE_UUID"
echo -e "  Challenge: $CHALLENGE"
echo -e "  Data to sign: $CHALLENGE_DATA"

# Sign the challenge with the private key
echo -e "${BLUE}Signing the challenge with OpenSSL...${NC}"

# Create the signature with detailed output
openssl dgst -sha256 -hex -sign device_private_key.pem challenge_data.json > signature.hex
echo -e "${BLUE}Hex signature saved to signature.hex${NC}"

# Now create the binary signature for submission
openssl dgst -sha256 -sign device_private_key.pem -out signature.bin challenge_data.json
echo -e "${BLUE}Binary signature saved to signature.bin ($(stat -f%z signature.bin) bytes)${NC}"

# Make copies for server-side debugging
mkdir -p debug
cp signature.bin debug/server_signature.bin
cp challenge_data.json debug/server_data.json
cp device_public_key.pem debug/server_public_key.pem

# Display the hex signature for debugging
echo -e "${YELLOW}Hex signature:${NC} $(cat signature.hex)"

# Log the data being signed for debugging
echo -e "${BLUE}Data being signed:${NC} $CHALLENGE_DATA"

# Convert signature to base64
SIGNATURE=$(base64 < signature.bin | tr -d '\n')
echo -e "${BLUE}Base64 signature length:${NC} ${#SIGNATURE} characters"
echo -e "${BLUE}First 40 chars of base64 signature:${NC} ${SIGNATURE:0:40}..."

# Save signature to file for debugging
echo "$SIGNATURE" > signature.base64
echo -e "${BLUE}Base64 signature saved to signature.base64${NC}"

# Create the authentication verification request
AUTH_REQUEST="{
  \"deviceId\": \"$DEVICE_UUID\",
  \"challenge\": \"$CHALLENGE\",
  \"signature\": \"$SIGNATURE\"
}"

# Save the request to a file for debugging
echo "$AUTH_REQUEST" > auth_request.json
echo -e "${BLUE}Auth request saved to auth_request.json${NC}"

# Verify the challenge to get a token
echo -e "${BLUE}Verifying challenge to get JWT token...${NC}"
echo -e "${BLUE}Sending request to $SERVER_URL$AUTH_VERIFY_ENDPOINT${NC}"

# Use verbose curl for more diagnostics
AUTH_RESPONSE=$(curl -v -X POST "$SERVER_URL$AUTH_VERIFY_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$AUTH_REQUEST" 2>&1)

# Save the full response to a file
echo "$AUTH_RESPONSE" > auth_response.txt
echo -e "${BLUE}Full auth response saved to auth_response.txt${NC}"

# Extract the JSON part of the response (after response headers)
JSON_RESPONSE=$(echo "$AUTH_RESPONSE" | sed -n '/^{/,$p')

echo "Authentication response:"
echo "$JSON_RESPONSE" | jq '.' 2>/dev/null || echo "$JSON_RESPONSE"

# Try to verify the signature locally as a debugging step
echo -e "\n${YELLOW}Attempting local signature verification...${NC}"
openssl dgst -sha256 -verify device_public_key.pem -signature signature.bin challenge_data.json
LOCAL_VERIFY_RESULT=$?

if [ $LOCAL_VERIFY_RESULT -eq 0 ]; then
  echo -e "${GREEN}Local OpenSSL verification SUCCESS${NC}"
else
  echo -e "${RED}Local OpenSSL verification FAILED${NC}"
fi

# Extract token from response
JWT_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token' 2>/dev/null)

if [ -z "$JWT_TOKEN" ] || [ "$JWT_TOKEN" == "null" ]; then
    echo -e "${RED}Failed to obtain JWT token.${NC}"
    exit 1
fi

echo -e "${GREEN}Successfully obtained JWT token${NC}"

# Function to get current IP address
get_ip_address() {
    # Try different methods based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -n 1 | awk '{print $2}')
    else
        # Linux and others
        IP=$(ip addr show | grep "inet " | grep -v 127.0.0.1 | head -n 1 | awk '{print $2}' | cut -d/ -f1)
    fi
    
    # If no IP found, use a placeholder
    if [ -z "$IP" ]; then
        IP="192.168.1.100"
    fi
    
    echo "$IP"
}

IP_ADDRESS=$(get_ip_address)

# Step 4: Ping the server every 5 seconds using JWT token
echo -e "\n${YELLOW}Step 4: Starting periodic ping with JWT authentication (every 5 seconds)...${NC}"
echo -e "Press Ctrl+C to stop\n"

PING_COUNT=0

# Create a trap to handle SIGINT (Ctrl+C)
trap 'echo -e "\n${BLUE}Ping test stopped after $PING_COUNT pings${NC}"; exit 0' SIGINT

while true; do
    PING_COUNT=$((PING_COUNT+1))
    
    # Current timestamp
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    
    echo -e "${BLUE}[$TIMESTAMP] Ping #$PING_COUNT${NC}"
    
    # Send the ping with device data, using JWT token for authentication
    PING_RESPONSE=$(curl -s -X POST "$SERVER_URL$PING_ENDPOINT" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -d "{
        \"id\": \"$DEVICE_UUID\",
        \"name\": \"$DEVICE_NAME\",
        \"networks\": [
          {
            \"name\": \"eth0\",
            \"ipAddress\": [\"$IP_ADDRESS\"]
          },
          {
            \"name\": \"wlan0\",
            \"ipAddress\": [\"10.0.0.$((RANDOM % 255 + 1))\"]
          }
        ]
      }")
    
    echo "Ping response:"
    echo "$PING_RESPONSE" | jq '.' 2>/dev/null || echo "$PING_RESPONSE"
    
    # Wait 5 seconds before the next ping
    sleep 5
    
    # Every 10 pings, check if we need to renew the token
    if [ $((PING_COUNT % 10)) -eq 0 ]; then
        echo -e "${BLUE}Checking if token needs renewal...${NC}"
        
        # For a production script, you should check token expiration and renew if needed
        # For this demo, we'll just renew it automatically every 10 pings
        
        # Request authentication challenge
        CHALLENGE_RESPONSE=$(curl -s -X POST "$SERVER_URL$AUTH_CHALLENGE_ENDPOINT" \
          -H "Content-Type: application/json" \
          -d "{
            \"deviceId\": \"$DEVICE_UUID\"
          }")
        
        CHALLENGE=$(echo "$CHALLENGE_RESPONSE" | jq -r '.challenge' 2>/dev/null)
        
        if [ -n "$CHALLENGE" ] && [ "$CHALLENGE" != "null" ]; then
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
            
            # Verify the challenge to get a new token
            AUTH_RESPONSE=$(curl -s -X POST "$SERVER_URL$AUTH_VERIFY_ENDPOINT" \
              -H "Content-Type: application/json" \
              -d "{
                \"deviceId\": \"$DEVICE_UUID\",
                \"challenge\": \"$CHALLENGE\",
                \"signature\": \"$SIGNATURE\"
              }")
            
            NEW_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token' 2>/dev/null)
            
            if [ -n "$NEW_TOKEN" ] && [ "$NEW_TOKEN" != "null" ]; then
                JWT_TOKEN=$NEW_TOKEN
                echo -e "${GREEN}Token renewed successfully${NC}"
            fi
        fi
    fi
done