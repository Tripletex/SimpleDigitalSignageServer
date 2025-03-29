#!/bin/bash

# Configuration
SERVER_URL="http://localhost:3000"  # Change this to your server URL
REGISTER_ENDPOINT="/api/device/register"
PING_ENDPOINT="/api/device/ping"

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Generate a random device name
DEVICE_NAME="test-device-$(date +%s)"

echo -e "${BLUE}Starting device simulation script...${NC}"
echo -e "${BLUE}Device name: ${GREEN}$DEVICE_NAME${NC}"

# Step 1: Register a new device
echo -e "\n${YELLOW}Step 1: Registering device...${NC}"

REGISTER_RESPONSE=$(curl -s -X POST "$SERVER_URL$REGISTER_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"deviceType\": \"test-device\",
    \"hardwareId\": \"$(uuidgen)\"
  }")

echo "Registration response:"
echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"

# Step 2: Extract UUID from the response
DEVICE_UUID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*' | sed 's/"id":"//')

if [ -z "$DEVICE_UUID" ]; then
    echo -e "${YELLOW}Unable to extract device UUID from response. Trying alternate method...${NC}"
    DEVICE_UUID=$(echo "$REGISTER_RESPONSE" | jq -r '.id' 2>/dev/null)
fi

if [ -z "$DEVICE_UUID" ]; then
    echo -e "${YELLOW}Failed to extract UUID. Please check the server response format.${NC}"
    echo "Using a placeholder UUID for testing purposes."
    DEVICE_UUID="00000000-0000-0000-0000-000000000000"
fi

echo -e "\n${YELLOW}============================================${NC}"
echo -e "${YELLOW}DEVICE UUID FOR CLAIMING: ${GREEN}$DEVICE_UUID${NC}"
echo -e "${YELLOW}============================================${NC}\n"

# Save UUID to file for easy reference
echo "$DEVICE_UUID" > device-uuid.txt
echo -e "${BLUE}UUID saved to ${GREEN}device-uuid.txt${NC}\n"

# Generate a random MAC address for the network interface
generate_mac() {
    printf '02:%02X:%02X:%02X:%02X:%02X' $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256))
}

MAC_ADDRESS=$(generate_mac)

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

# Step 3: Ping the server every 5 seconds
echo -e "\n${YELLOW}Step 3: Starting periodic ping (every 5 seconds)...${NC}"
echo -e "Press Ctrl+C to stop\n"

PING_COUNT=0

# Create a trap to handle SIGINT (Ctrl+C)
trap 'echo -e "\n${BLUE}Ping test stopped after $PING_COUNT pings${NC}"; exit 0' SIGINT

while true; do
    PING_COUNT=$((PING_COUNT+1))
    
    # Current timestamp
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    
    echo -e "${BLUE}[$TIMESTAMP] Ping #$PING_COUNT${NC}"
    
    # Send the ping with device data
    PING_RESPONSE=$(curl -s -X POST "$SERVER_URL$PING_ENDPOINT" \
      -H "Content-Type: application/json" \
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
            \"ipAddress\": [\"10.0.0.$(( RANDOM % 255 + 1 ))\"]
          }
        ]
      }")
    
    echo "Ping response:"
    echo "$PING_RESPONSE" | jq '.' 2>/dev/null || echo "$PING_RESPONSE"
    
    # Wait 5 seconds before the next ping
    sleep 5
done