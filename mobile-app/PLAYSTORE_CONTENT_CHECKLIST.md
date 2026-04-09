# PlotConnect Play Console Checklist

Use this as the practical answer sheet when creating the Play Console app entry for PlotConnect.

## Store listing

- App name: `PlotConnect`
- Short description: `Find verified hostels, bedsitters, and lodges, then unlock contacts when ready.`
- Full description: use [PLAYSTORE_LISTING.md](/c:/Users/SecurityManager/Desktop/plotconnect/mobile-app/PLAYSTORE_LISTING.md)
- App icon: use `mobile-app/assets/icon.png`
- Feature graphic: still needed from you
- Phone screenshots: still needed from you
- Support email: `support@tst-plotconnect.com`
- Privacy policy URL: `https://www.tst-plotconnect.com/privacy` after the frontend is deployed

## App access

- Users can browse listings before login.
- Login is required for account-specific features like activation status, payment history, and unlocking caretaker contact details.
- Contact details are behind a paid activation flow inside the app.
- Suggested Play Console note:
  `Users can browse listings without logging in. Login is required only for account features and to unlock listing contact details after payment activation.`

## Ads

- Current answer: `No`
- I did not find ad SDK usage in the mobile app code.

## Data safety

Based on the current codebase, review these as collected or processed:

- Name
- Phone number
- Country
- Account identifiers
- Password / login credentials
- Payment history
- M-Pesa transaction references
- Support contact interactions

Suggested Play Console interpretation:

- Personal info:
  `Name`, `Phone number`
- Financial info:
  `Purchase history` or payment-related records
- App activity:
  listing search/use activity if you choose to declare it
- App info and performance:
  only declare if you actually collect diagnostics separately

Important confirmations from the code:

- Data encrypted in transit: `Yes`, the app talks to `https://tstplotconnect-2.onrender.com`
- Payment processor: M-Pesa / Safaricom flow is used through the backend
- Account deletion: there is no self-service account deletion flow in the mobile app right now

For Play Console, answer carefully:

- `Is all user data encrypted in transit?`
  `Yes`
- `Can users request that data is deleted?`
  Only answer `Yes` if you are ready to support deletion requests through email/support and actually process them.
- If Google asks for a deletion URL or in-app path:
  you currently do not have a user-facing deletion path in the app, so this may need to be added before production depending on the exact form shown in Play Console.

## Content rating

Recommended answers direction:

- Category feel: general marketplace / accommodation app
- No violent, sexual, gambling, or drug content is visible in the app code
- Includes:
  account creation, external communication links, and payment-related flows

So the rating should likely stay in a low/general range, but complete the questionnaire honestly in Play Console.

## Target audience

- Best fit appears to be `18+` adults and older teens / students looking for accommodation
- Do not mark the app as designed for children

## Testing before production

- Start with `Internal testing`
- If needed, move to `Closed testing`
- Then release to `Production`

## Final checks before upload

- Package name is final: currently `com.tst.plotconnect`
- Version number is correct: currently `1.0.0`
- Android version code is correct: currently `1`
- Android App Bundle (`.aab`) builds successfully
- Privacy policy page is publicly reachable
- Screenshots match the current mobile UI
- Feature graphic is prepared
- Support email is monitored
- Store listing text is pasted into Play Console

## Risks to fix or confirm before submission

- Add a proper feature graphic for the Play Store
- Capture real phone screenshots from the app
- Confirm whether you want to support account deletion by email only, or add an in-app deletion request flow
- Deploy the privacy page before submitting
