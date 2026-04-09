# AWS Elastic Beanstalk Deployment Guide

This backend is a good fit for AWS Elastic Beanstalk using the managed Node.js platform.

## Why Elastic Beanstalk for this project

- Your backend is a single Express app
- It already runs from `npm start`
- It reads everything important from environment variables
- You do not need to manage EC2 setup manually

## Recommended AWS setup

- Platform: `Node.js 20 running on 64bit Amazon Linux 2023`
- Region: use the same region where you want to operate, for example `eu-north-1`
- Environment type: `Single instance` first, then `Load balanced` later if traffic grows
- Database: keep your current MongoDB connection during the first migration

## Files used for Beanstalk

- `Procfile`
- `.ebignore`

## Environment variables to set in Elastic Beanstalk

Set these in the Elastic Beanstalk console under:
Configuration -> Updates, monitoring, and logging -> Environment properties

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

Do not upload your local `.env` file to AWS.

## Console-based deployment

1. Open Elastic Beanstalk in AWS.
2. Create application.
3. Create environment.
4. Choose `Web server environment`.
5. Choose platform `Node.js`.
6. Upload the backend source bundle.

The source bundle should contain:

- `package.json`
- `package-lock.json`
- `Procfile`
- `src/`

It should not include:

- `node_modules/`
- `.env`

## How to create the deployment zip

From inside `backend/`, create a zip containing the app source.

Typical contents:

```text
backend/
  package.json
  package-lock.json
  Procfile
  src/
```

If you use the EB CLI, `.ebignore` helps exclude files you do not want bundled.

## Recommended Beanstalk settings

- Health check path: `/api/health`
- Instance type: start small, for example `t3.small`
- Rolling updates: enabled later when you move beyond a single instance
- HTTPS: terminate TLS at the load balancer when you move to a load-balanced environment

## Deployment checklist

1. Deploy the backend to a Beanstalk environment URL.
2. Verify:
   - `GET /api/health`
   - user registration
   - user login
   - admin login
   - plot listing fetch
   - payment callback endpoint
3. Update frontend and mobile app API URLs to the new backend domain.
4. Update your Daraja callback URL to the new production backend URL.
5. Add a custom domain such as `api.tst-plotconnect.com`.
6. After verification, retire the Render service.

## Important production notes

- The backend seeds admin accounts during startup in `src/db.js`. That is convenient for now, but should be reviewed for long-term production hardening.
- The backend now supports `EXTRA_ALLOWED_ORIGINS`, so you can add new domains from environment settings instead of editing code.
- Keep MongoDB where it is for the first cut. Moving compute and database at the same time adds unnecessary migration risk.
