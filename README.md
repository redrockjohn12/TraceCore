# TraceCore — Device Protection & Recovery Platform

TraceCore by Atlas Technologies is a device protection and recovery platform MVP designed to help registered device owners manage protected devices, monitor device activity, record locations, and manage recovery events through a web-based system.

## Current Version

**TraceCore V9.1 — PayPal Subscription Foundation**

The current implementation includes account management, subscription plans, device registration, device authentication, location reporting, security events, recovery workflows, and PayPal subscription integration.

## Features

### Account Management
- User registration and login
- Password hashing using Node.js `scrypt`
- Bearer-token authentication with hashed server-side sessions
- Personal and business account types
- Subscription status tracking

### Device Protection
- Register protected devices
- Generate unique TraceCore recovery IDs
- Device credentials for authenticated device communication
- Device heartbeat monitoring
- Last-seen tracking
- Device status management

### Location & Recovery
- Record device latitude and longitude
- Store location accuracy information
- Retrieve device location history
- Recovery case management
- Lost, stolen, suspicious, recovery and recovered statuses
- Security event history

### Security Events
TraceCore can record events including:

- SIM changes
- SIM removal
- Offline/reconnected events
- Security changes
- Location updates
- Factory-reset signals

Certain security events can automatically change a protected device to a suspicious state.

### Subscription Platform

TraceCore currently uses **PayPal subscriptions**.

Supported plans are denominated in ZAR:

| Plan | Price | Protected Devices |
|---|---:|---:|
| Personal | R100/month | 1 |
| Family | R300/month | 5 |
| Business Starter | R750/month | 10 |
| Business | R1,500/month | 25 |
| Business Plus | R2,500/month | 50 |
| Enterprise | Contact sales | Up to enterprise limit |

The PayPal integration includes:

- PayPal subscription creation
- Sandbox/live environment selection
- PayPal product and billing-plan creation
- Subscription activation
- Payment completion handling
- Subscription cancellation handling
- Subscription suspension handling
- Webhook signature verification

Payment credentials are supplied through environment variables and are not stored in source code.

## Technology Stack

### Backend
- Node.js
- Express 5
- REST APIs
- Node.js built-in SQLite support
- PayPal REST APIs

### Database
- SQLite
- WAL mode
- Foreign-key enforcement
- Prepared SQL statements

### Frontend
- HTML
- CSS
- JavaScript
- Responsive web interface

### Android
An Android client project is included separately from the web/backend application.

Android development and deeper device-management integration remain ongoing areas of development.

### Development Tools
- Git
- GitHub
- Termux
- Android SDK tooling

## Architecture

TraceCore is structured as a client-server application:

```text
Android Client
     │
     ▼
REST API (Express 5)
     │
     ├── Authentication & device management
     ├── Location & security events
     ├── Recovery workflows
     │
     ├──────────────► SQLite Database
     │
     └──────────────► PayPal APIs
```

The Android client communicates with the backend through authenticated REST API requests. The backend handles account management, protected-device operations, location records, security events, recovery workflows, and subscription-related operations.


## API Overview

### Health

```http
GET /api/health
