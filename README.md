# TraceCore 10.1 Full Upgrade

This package replaces the TraceCore web/API layer and includes a complete Android client foundation.

## Backend
1. Back up `data/tracecore.db` before replacing files.
2. Copy `.env.example` to `.env` and set `ADMIN_KEY`.
3. `npm install`
4. `npm start`

Existing SQLite data is preserved by the migration code. Manual activation is development-only and requires `X-Admin-Key`.

## PayPal
Set `PAYPAL_MODE=sandbox` or `live`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `APP_URL`. The server creates and captures PayPal orders and verifies the captured amount before activating a plan.

## Android
Default API URL is `http://127.0.0.1:3000/`, which works when TraceCore is running in Termux on the same phone. For production use HTTPS and change `TRACECORE_BASE_URL` in `app/build.gradle`.

The Android client requests location permission, runs a foreground location service, queues locations when offline, sends heartbeats, reacts to lost/stolen status, and includes a legitimate Device Owner foundation. It does not bypass factory reset or Android security.

IMEI/serial are optional manual fields because ordinary Android apps cannot reliably read these identifiers on modern Android versions.
