# AWS App Runner Deployment Guide

This backend can move from Render to AWS without major code changes. The simplest target is AWS App Runner because this API is a single stateless Node.js service that already exposes an HTTP port and reads configuration from environment variables.

## Recommended AWS shape

- Compute: AWS App Runner
- Container registry: Amazon ECR
- Database: keep the current MongoDB for the first migration, then move later only if you want
- Secrets: App Runner environment variables, or AWS Secrets Manager later
- DNS: point `api.tst-plotconnect.com` to the App Runner service after validation

## Why App Runner

- No server patching or EC2 maintenance
- Automatic HTTPS
- Easy health checks against `/api/health`
- Good fit for a small Express API

## Files added for this deployment

- `backend/Dockerfile`
- `backend/.dockerignore`

## Environment variables to configure in AWS

Use your production values, not the sample values below.

- `PORT=10000`
- `HOST=0.0.0.0`
- `JWT_SECRET=...`
- `PAYMENT_MODE=daraja` or `mock`
- `REQUIRE_HTTPS_ADMIN=true`
- `ADMIN_MAX_LOGIN_ATTEMPTS=5`
- `ADMIN_LOCK_MINUTES=15`
- `MONGODB_URI=...`
- `MONGODB_DB_NAME=tstplotconnect`
- `GOOGLE_MAPS_API_KEY=...`
- `DARAJA_ENV=production` or `sandbox`
- `DARAJA_CONSUMER_KEY=...`
- `DARAJA_CONSUMER_SECRET=...`
- `DARAJA_SHORTCODE=...`
- `DARAJA_TILL=...`
- `DARAJA_PASSKEY=...`
- `DARAJA_CALLBACK_URL=https://api.tst-plotconnect.com/api/payments/callback`
- `SMS_MODE=africastalking` or `mock`
- `OTP_DEBUG_RESPONSE=false`
- `OTP_TTL_MINUTES=10`
- `OTP_RESEND_SECONDS=60`
- `OTP_MAX_ATTEMPTS=5`
- `AFRICASTALKING_API_KEY=...`
- `AFRICASTALKING_USERNAME=...`
- `AFRICASTALKING_SENDER_ID=...`
- `EXTRA_ALLOWED_ORIGINS=https://tst-plotconnect.com,https://www.tst-plotconnect.com`

## One-time AWS setup

1. Create an Amazon ECR repository, for example `plotconnect-backend`.
2. Create or choose an IAM user/role with permission to push to ECR and deploy App Runner.
3. Install and configure the AWS CLI locally.

## Build and push the image

Run these from the repo root after replacing placeholders:

```powershell
aws ecr get-login-password --region eu-north-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.eu-north-1.amazonaws.com
docker build -t plotconnect-backend ./backend
docker tag plotconnect-backend:latest <ACCOUNT_ID>.dkr.ecr.eu-north-1.amazonaws.com/plotconnect-backend:latest
docker push <ACCOUNT_ID>.dkr.ecr.eu-north-1.amazonaws.com/plotconnect-backend:latest
```

## Create the App Runner service

In AWS Console:

1. Open App Runner.
2. Create service.
3. Choose `Container registry`.
4. Select the ECR image you pushed.
5. Set container port to `10000`.
6. Set health check path to `/api/health`.
7. Add the environment variables listed above.
8. Deploy the service.

## After the service is live

1. Test:
   - `GET /api/health`
   - login
   - registration
   - payment callback
   - admin login
2. Update frontend and mobile app API base URL to the new AWS domain.
3. Update `DARAJA_CALLBACK_URL` in Safaricom-related config if needed.
4. Move your custom API domain to App Runner, ideally `api.tst-plotconnect.com`.
5. After traffic is stable, retire the Render backend.

## Important migration notes

- Your MongoDB is external to the app process, so the backend can move first without a database migration.
- The backend now supports `EXTRA_ALLOWED_ORIGINS`, so you can allow new production origins without editing code again.
- If the mobile app will keep using the same backend domain, App Store and Play Store configs stay simpler.
- This codebase currently seeds admin accounts from source on startup. Review that behavior before long-term production hardening.
