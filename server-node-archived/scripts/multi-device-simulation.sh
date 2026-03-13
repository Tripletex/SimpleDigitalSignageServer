#!/bin/bash

# Configuration
SERVER_URL="http://localhost:3000"  # Change this to your server URL
REGISTER_ENDPOINT="/api/device/register"
PING_ENDPOINT="/api/device/ping"
AUTH_CHALLENGE_ENDPOINT="/api/device-auth/challenge"
AUTH_VERIFY_ENDPOINT="/api/device-auth/verify"
DEFAULT_DEVICE_COUNT=3
PING_INTERVAL=5  # seconds

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed. Please install it to parse JSON responses.${NC}"
    echo "On macOS: brew install jq"
    echo "On Ubuntu/Debian: sudo apt-get install jq"
    exit 1
fi

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}OpenSSL is required but not installed. Please install OpenSSL.${NC}"
    exit 1
fi

# Parse command line arguments
DEVICE_COUNT=$DEFAULT_DEVICE_COUNT
if [ $# -ge 1 ]; then
    if [[ $1 =~ ^[0-9]+$ ]]; then
        DEVICE_COUNT=$1
    else
        echo -e "${RED}Invalid device count: $1. Using default: $DEFAULT_DEVICE_COUNT${NC}"
    fi
fi

# Generate a random MAC address for the network interface
generate_mac() {
    printf '02:%02X:%02X:%02X:%02X:%02X' $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256))
}

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

BASE_IP=$(get_ip_address)
IP_PREFIX=$(echo $BASE_IP | cut -d. -f1-3)

# Arrays to store device information
declare -a DEVICE_NAMES
declare -a DEVICE_UUIDS
declare -a DEVICE_MACS
declare -a DEVICE_IPS
declare -a DEVICE_PRIVATE_KEYS
declare -a DEVICE_PUBLIC_KEYS
declare -a DEVICE_TOKENS

echo -e "${BLUE}Starting multi-device simulation with passkey authentication...${NC}"
echo -e "${BLUE}Number of devices: ${GREEN}$DEVICE_COUNT${NC}"

# Create a directory to store keys
KEYS_DIR="device_keys"
mkdir -p "$KEYS_DIR"

# Step 1: Generate key pairs and register devices
echo -e "\n${YELLOW}Step 1: Generating key pairs and registering devices...${NC}"

for i in $(seq 1 $DEVICE_COUNT); do
    # Generate device info
    DEVICE_NAME="test-device-$i-$(date +%s)"
    MAC_ADDRESS=$(generate_mac)
    IP_ADDRESS="$IP_PREFIX.$((100 + i))"
    
    echo -e "\n${BLUE}Device $i: ${GREEN}$DEVICE_NAME${NC}"
    echo -e "${BLUE}Generating RSA key pair...${NC}"
    
    # Generate private key
    PRIVATE_KEY_FILE="$KEYS_DIR/device_${i}_private_key.pem"
    PUBLIC_KEY_FILE="$KEYS_DIR/device_${i}_public_key.pem"
    
    openssl genrsa -out "$PRIVATE_KEY_FILE" 2048 > /dev/null 2>&1
    openssl rsa -in "$PRIVATE_KEY_FILE" -pubout -out "$PUBLIC_KEY_FILE" > /dev/null 2>&1
    
    # Convert keys to base64
    PRIVATE_KEY_BASE64=$(cat "$PRIVATE_KEY_FILE" | base64 | tr -d '\n')
    PUBLIC_KEY_BASE64=$(cat "$PUBLIC_KEY_FILE" | base64 | tr -d '\n')
    
    echo -e "${GREEN}Key pair generated${NC}"
    
    # Register the device
    echo -e "${BLUE}Registering device with server...${NC}"
    
    REGISTER_RESPONSE=$(curl -s -X POST "$SERVER_URL$REGISTER_ENDPOINT" \
      -H "Content-Type: application/json" \
      -d "{
        \"deviceType\": \"test-device\",
        \"hardwareId\": \"$MAC_ADDRESS\",
        \"publicKey\": \"$PUBLIC_KEY_BASE64\"
      }")
    
    # Extract UUID
    DEVICE_UUID=$(echo "$REGISTER_RESPONSE" | jq -r '.id' 2>/dev/null)
    
    if [ -z "$DEVICE_UUID" ] || [ "$DEVICE_UUID" == "null" ]; then
        echo -e "${RED}Failed to register device $i. Response:${NC}"
        echo "$REGISTER_RESPONSE"
        DEVICE_UUID="00000000-0000-0000-0000-00000000000$i"
        echo -e "${YELLOW}Using placeholder UUID: $DEVICE_UUID${NC}"
    else
        echo -e "${GREEN}Device $i registered successfully with UUID: $DEVICE_UUID${NC}"
    fi
    
    # Store device info
    DEVICE_NAMES[$i]=$DEVICE_NAME
    DEVICE_UUIDS[$i]=$DEVICE_UUID
    DEVICE_MACS[$i]=$MAC_ADDRESS
    DEVICE_IPS[$i]=$IP_ADDRESS
    DEVICE_PRIVATE_KEYS[$i]=$PRIVATE_KEY_FILE
    DEVICE_PUBLIC_KEYS[$i]=$PUBLIC_KEY_FILE
done

# Display all device UUIDs for claiming
echo -e "\n${YELLOW}===================================================${NC}"
echo -e "${YELLOW}DEVICE UUIDs FOR CLAIMING:${NC}"

# Save UUIDs to file for easy reference
UUIDS_FILE="device-uuids.txt"
rm -f "$UUIDS_FILE"
touch "$UUIDS_FILE"

for i in $(seq 1 $DEVICE_COUNT); do
    echo -e "${YELLOW}Device $i - ${GREEN}${DEVICE_NAMES[$i]}${YELLOW}: ${GREEN}${DEVICE_UUIDS[$i]}${NC}"
    echo "${DEVICE_NAMES[$i]},${DEVICE_UUIDS[$i]}" >> "$UUIDS_FILE"
done
echo -e "${YELLOW}===================================================${NC}"
echo -e "${BLUE}UUIDs saved to ${GREEN}$UUIDS_FILE${NC}\n"

# Function to sign device data with private key
sign_device_data() {
    local device_id="$1"
    local device_name="$2"
    local ip_address="$3"
    local private_key_file="$4"
    local timestamp=$(date +%s000)  # Current time in milliseconds
    
    # Create the data to sign (without signature)
    local data_to_sign=$(cat <<EOF
{
  "id": "$device_id",
  "name": "$device_name",
  "networks": [
    {
      "name": "eth0",
      "ipAddress": ["$ip_address"]
    },
    {
      "name": "wlan0",
      "ipAddress": ["10.0.0.$((RANDOM % 255 + 1))"]
    }
  ],
  "timestamp": $timestamp
}
EOF
)
    
    # Create a temporary file with the data
    local temp_file="temp_data_$device_id.json"
    echo "$data_to_sign" > "$temp_file"
    
    # Sign the data using the private key
    local sig_file="signature_$device_id.bin"
    openssl dgst -sha256 -sign "$private_key_file" -out "$sig_file" "$temp_file"
    
    # Convert signature to base64
    local signature=$(base64 < "$sig_file" | tr -d '\n')
    
    # Add signature to the data
    local signed_data=$(cat <<EOF
{
  "id": "$device_id",
  "name": "$device_name",
  "networks": [
    {
      "name": "eth0",
      "ipAddress": ["$ip_address"]
    },
    {
      "name": "wlan0",
      "ipAddress": ["10.0.0.$((RANDOM % 255 + 1))"]
    }
  ],
  "timestamp": $timestamp,
  "signature": "$signature"
}
EOF
)
    
    # Clean up temporary files
    rm -f "$temp_file" "$sig_file"
    
    echo "$signed_data"
}

# Step 2: Start pinging with all devices
echo -e "\n${YELLOW}Step 2: Starting periodic ping for all devices (every $PING_INTERVAL seconds)...${NC}"
echo -e "Press Ctrl+C to stop\n"

PING_COUNT=0

# Create a trap to handle SIGINT (Ctrl+C)
trap 'echo -e "\n${BLUE}Simulation stopped after $PING_COUNT ping rounds${NC}"; exit 0' SIGINT

while true; do
    PING_COUNT=$((PING_COUNT+1))
    
    # Current timestamp
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    
    echo -e "\n${BLUE}[$TIMESTAMP] Ping round #$PING_COUNT${NC}"
    
    for i in $(seq 1 $DEVICE_COUNT); do
        echo -e "${BLUE}Pinging with device $i: ${GREEN}${DEVICE_NAMES[$i]}${NC}"
        
        # Generate signed device data
        SIGNED_DATA=$(sign_device_data "${DEVICE_UUIDS[$i]}" "${DEVICE_NAMES[$i]}" "${DEVICE_IPS[$i]}" "${DEVICE_PRIVATE_KEYS[$i]}")
        
        # First, authenticate the device to get a JWT token
    if [ -z "${DEVICE_TOKENS[$i]}" ] || [ $((PING_COUNT % 10)) -eq 0 ]; then
        echo -e "${BLUE}Authenticating device $i...${NC}"
        
        # Request a challenge
        CHALLENGE_RESPONSE=$(curl -s -X POST "$SERVER_URL$AUTH_CHALLENGE_ENDPOINT" \
          -H "Content-Type: application/json" \
          -d "{
            \"deviceId\": \"${DEVICE_UUIDS[$i]}\"
          }")
        
        CHALLENGE=$(echo "$CHALLENGE_RESPONSE" | jq -r '.challenge' 2>/dev/null)
        
        if [ -z "$CHALLENGE" ] || [ "$CHALLENGE" == "null" ]; then
            echo -e "${RED}Failed to get challenge for device $i${NC}"
            continue
        fi
        
        # Sign the challenge
        CHALLENGE_DATA="{\"deviceId\":\"${DEVICE_UUIDS[$i]}\",\"challenge\":\"$CHALLENGE\"}"
        echo "$CHALLENGE_DATA" > "temp_challenge_$i.json"
        openssl dgst -sha256 -sign "${DEVICE_PRIVATE_KEYS[$i]}" -out "temp_sig_$i.bin" "temp_challenge_$i.json"
        SIG=$(base64 < "temp_sig_$i.bin" | tr -d '\n')
        
        # Verify the challenge to get a token
        AUTH_RESPONSE=$(curl -s -X POST "$SERVER_URL$AUTH_VERIFY_ENDPOINT" \
          -H "Content-Type: application/json" \
          -d "{
            \"deviceId\": \"${DEVICE_UUIDS[$i]}\",
            \"challenge\": \"$CHALLENGE\",
            \"signature\": \"$SIG\"
          }")
        
        TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token' 2>/dev/null)
        
        if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
            DEVICE_TOKENS[$i]=$TOKEN
            echo -e "${GREEN}✓ Authentication successful${NC}"
        else
            echo -e "${RED}✗ Authentication failed:${NC}"
            echo "$AUTH_RESPONSE"
            continue
        fi
        
        # Clean up temporary files
        rm -f "temp_challenge_$i.json" "temp_sig_$i.bin"
    fi
    
    # Send the ping with JWT authentication
    PING_RESPONSE=$(curl -s -X POST "$SERVER_URL$PING_ENDPOINT" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${DEVICE_TOKENS[$i]}" \
      -d "{
        \"id\": \"${DEVICE_UUIDS[$i]}\",
        \"name\": \"${DEVICE_NAMES[$i]}\",
        \"networks\": [
          {
            \"name\": \"eth0\",
            \"ipAddress\": [\"${DEVICE_IPS[$i]}\"]
          },
          {
            \"name\": \"wlan0\",
            \"ipAddress\": [\"10.0.0.$((RANDOM % 255 + 1))\"]
          }
        ]
      }")
    
    # Check if ping was successful
    if echo "$PING_RESPONSE" | jq -e '.message' &>/dev/null; then
        SUCCESS_MSG=$(echo "$PING_RESPONSE" | jq -r '.message')
        echo -e "${GREEN}✓ $SUCCESS_MSG${NC}"
    else
        echo -e "${RED}✗ Ping failed. Response:${NC}"
        echo "$PING_RESPONSE"
    fi
    done
    
    # Wait before the next ping round
    sleep $PING_INTERVAL
done