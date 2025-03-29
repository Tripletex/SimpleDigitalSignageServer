#!/bin/bash

# Configuration
SERVER_URL="http://localhost:3000"  # Change this to your server URL
REGISTER_ENDPOINT="/api/device/register"
PING_ENDPOINT="/api/device/ping"
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

echo -e "${BLUE}Starting multi-device simulation...${NC}"
echo -e "${BLUE}Number of devices: ${GREEN}$DEVICE_COUNT${NC}"

# Step 1: Register devices
echo -e "\n${YELLOW}Step 1: Registering devices...${NC}"

for i in $(seq 1 $DEVICE_COUNT); do
    # Generate device info
    DEVICE_NAME="test-device-$i-$(date +%s)"
    MAC_ADDRESS=$(generate_mac)
    IP_ADDRESS="$IP_PREFIX.$((100 + i))"
    
    echo -e "\n${BLUE}Registering device $i: ${GREEN}$DEVICE_NAME${NC}"
    
    # Register the device
    REGISTER_RESPONSE=$(curl -s -X POST "$SERVER_URL$REGISTER_ENDPOINT" \
      -H "Content-Type: application/json" \
      -d "{
        \"deviceType\": \"test-device\",
        \"hardwareId\": \"$MAC_ADDRESS\"
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
        
        # Generate random WiFi IP for variety
        WIFI_IP="10.0.0.$((RANDOM % 255 + 1))"
        
        # Send the ping with device data
        PING_RESPONSE=$(curl -s -X POST "$SERVER_URL$PING_ENDPOINT" \
          -H "Content-Type: application/json" \
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
                \"ipAddress\": [\"$WIFI_IP\"]
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