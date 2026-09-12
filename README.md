# TraceCore V9 — Production Web & Real Payments Foundation

TraceCore by Atlas Technologies is a device protection and recovery platform MVP.

## What's new in V9
- Stripe Checkout monthly subscriptions in ZAR.
- Stripe webhook verification and subscription lifecycle handling.
- Automatic activation after successful checkout.
- Renewal handling through `invoice.paid`.
- Payment failure tracking.
- Customer billing portal.
- Existing customer dashboard, recovery center, security events and device APIs remain.
- Android client is kept separate; APK work can resume later.

## Real payment configuration
Set these environment variables on the production server:

```bash
export STRIPE_SECRET_KEY='sk_live_...'
export STRIPE_WEBHOOK_SECRET='whsec_...'
export APP_URL='https://your-domain.example'
```

Never put secret keys in browser JavaScript or commit them to Git.

Configure the Stripe webhook endpoint:

`https://your-domain.example/api/billing/webhook`

Subscribe to at least:
- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.deleted`

## Local development
```bash
npm install
npm run init-db
npm start
```

Without `STRIPE_SECRET_KEY`, the checkout endpoint deliberately refuses to pretend a payment happened.

## Important product boundary
A normal Android application cannot survive a factory reset by itself. Vision B requires legitimate OEM/OS/device-management integration. Offline tracking is not claimed as a current feature.


## PayPal Sandbox
This version uses PayPal subscriptions instead of Stripe. Set: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE=sandbox, APP_URL. For production webhook verification also set PAYPAL_WEBHOOK_ID. Do not commit secrets.
