# PlotConnect Play Store Submission

This Expo app is now configured for Android builds with:

- package name: `com.tst.plotconnect`
- first Android version code: `1`
- EAS build profiles in `eas.json`
- app assets in `mobile-app/assets/`

## Before the first release

1. Confirm the package name in `app.json` is the final one you want.
2. Replace the generated icons in `mobile-app/assets/` if you want custom store branding.
3. Make sure your privacy policy URL is live.
4. Prepare Play Store assets:
   - app name
   - short description
   - full description
   - app icon
   - feature graphic
   - phone screenshots
   - support email
   - privacy policy URL

## Build the Android App Bundle

Install EAS CLI if you do not already have it:

```bash
npm install -g eas-cli
```

Then from `mobile-app/` run:

```bash
eas login
eas build:configure
eas build --platform android --profile production
```

That produces an `.aab` file, which is the format Google Play expects for new apps.

## Submit in Google Play Console

1. Create the app in Play Console.
2. Complete the App content forms:
   - privacy policy
   - data safety
   - ads
   - target audience
   - content rating
3. Go to `Production` or `Internal testing`.
4. Create a new release.
5. Upload the generated `.aab`.
6. Add release notes.
7. Review and roll out the release.

## Useful commands

```bash
eas build --platform android --profile preview
eas submit --platform android --latest
```

## Notes

- `production` builds auto-increment the Android version code through EAS.
- If you change the Android package name after publishing, Google Play treats it as a different app.
- If you want local native Android folders, run `npx expo prebuild`, but it is not required for EAS cloud builds.
