# Using the Digital Signage Server API

This document provides examples of how to interact with the Digital Signage Server API.

## Device Registration Flow

The Digital Signage system uses a two-step process:

1. First, a device must register to get a unique identifier (UUID)
2. Then the device uses that UUID to ping the server regularly to report its status

## 1. Register a New Device

To register a new device, send a POST request to the `/api/device/register` endpoint with minimal information (or an empty object):

```bash
# Register with minimal information (returns a UUID)
curl -X POST http://localhost:4000/api/device/register \
  -H "Content-Type: application/json" \
  -d '{
    "deviceType": "RaspberryPi4",
    "hardwareId": "b8:27:eb:5a:6b:90"
  }'
```

You'll receive a response containing the device's assigned UUID and registration time:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "registrationTime": "2023-04-01T12:00:00.000Z"
}
```

## 2. Ping with Device Status

After receiving a UUID, the device should ping the server regularly with its status:

```bash
# Ping to update device status
curl -X POST http://localhost:4000/api/device/ping \
  -H "Content-Type: application/json" \
  -d '{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Digital Display 1",
    "networks": [
      {
        "name": "Office WiFi",
        "ipAddress": ["192.168.1.100"]
      }
    ]
  }'
```

A successful ping returns:

```json
{
  "message": "Device ping successful",
  "lastSeen": "2023-04-01T12:05:00.000Z"
}
```

## 3. View All Registered Devices

To view all registered devices (whether they're pinging or not):

```bash
curl http://localhost:4000/api/device/registered
```

## 4. View All Active Devices

To view all devices that have pinged the server:

```bash
curl http://localhost:4000/api/device/list
```

## 5. View a Specific Device

To view details for a specific device:

```bash
curl http://localhost:4000/api/device/123e4567-e89b-12d3-a456-426614174000
```