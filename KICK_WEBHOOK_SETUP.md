# Kick Webhook Integration Setup

## Overview
This integration subscribes to Kick chat events to track active chatters and auto-enter users into giveaways when they send the giveaway keyword.

## Architecture

### 1. Webhook Handler (`/app/api/webhook/route.ts`)
- Receives `chat.message.sent` events from Kick
- Verifies webhook signature using HMAC-SHA256
- Tracks user activity in `user_messages` table
- Auto-enters users into active giveaways when they say the keyword

### 2. Subscription Endpoint (`/app/api/webhook/subscribe/route.ts`)
- Creates event subscriptions with Kick API
- Requires broadcaster ID and event type
- Calls `https://api.kick.com/public/v1/events/subscriptions`

## Required Environment Variables

Add these to your Vercel project settings:

```
KICK_ACCESS_TOKEN=your_access_token_here
KICK_WEBHOOK_SECRET=your_webhook_secret_here
NEXT_PUBLIC_BASE_URL=https://www.trinidorewards.com
```

## Getting Kick Access Token

1. Go to https://id.kick.com/oauth/authorize
2. Request `events:subscribe` scope
3. Copy the access token from the OAuth response

## Webhook Signature Verification

Kick sends webhooks with these headers:
- `x-signature-ed25519`: HMAC-SHA256 signature
- `x-signature-timestamp`: Request timestamp

The webhook handler verifies the signature by computing:
```
hmac_sha256(timestamp + body, secret) == signature
```

## Setting Up Subscription

Call the subscription endpoint to enable chat events:

```bash
curl -X POST https://www.trinidorewards.com/api/webhook/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "event": "chat.message.sent",
    "broadcaster_user_id": "123456"
  }'
```

## Event Flow

1. User sends message in Kick chat
2. Kick sends `chat.message.sent` webhook
3. Webhook handler receives and verifies signature
4. User tracked in `user_messages` table (5-min activity window)
5. If message contains giveaway keyword, user auto-entered into giveaway
6. Duplicate entries prevented by checking existing records

## Database Tables Used

- `user_messages`: Tracks active chatters with username, kick_id, and last_message_time
- `giveaways`: Active giveaways with keyword and status
- `giveaway_entries`: User entries for active giveaways
