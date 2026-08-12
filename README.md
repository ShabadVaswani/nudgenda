# Nudgenda

Android-first, local-first calendar planning assistant with a conversational interface and Google Calendar as the calendar source of truth.

## Current prototype

- Today timeline with tappable schedule blocks
- Pull-down gesture from Today to open full-page Chat
- Home microphone opens Chat already listening
- Chat microphone toggles listening on and off
- Google Calendar-style event details, including a description-based sub-schedule
- Calendar source, web OAuth, and Android permission settings screen
- Direct access to Google calendars already synchronized on the phone
- Swappable calendar repository with a runnable demo-data fallback
- Read, create, update, delete, and open system calendar events
- No Nudgenda backend or client secret in the app
- Muted neo-brutalist visual system with bundled Archivo Black and Kalam fonts

The current voice transcription remains a UI simulation. On Android, the app requests Calendar permission and uses the device calendar database. Android's existing account sync propagates changes to Google Calendar. In the browser, Google Identity Services supplies a temporary in-memory access token and the app calls Google Calendar directly. OpenRouter, notifications, and the Android widget come next.

## Run locally

```powershell
pnpm install
pnpm start
```

Press `a` in Expo CLI to open Android, or run:

```powershell
pnpm android
```

Device calendar access requires an Android development build rather than Expo Go.

## Download a development APK from GitHub

The repository includes an **Android development APK** workflow. After the project is pushed to GitHub:

1. Open the repository's **Actions** tab.
2. Select **Android development APK**.
3. Choose **Run workflow**.
4. Download the `nudgenda-development-apk` artifact when the run finishes.
5. Extract and install `nudgenda-development.apk` on an Android device.

The workflow also runs automatically when app code is pushed to `main`. It builds on GitHub's Android runner, so a local Android SDK is not required. The artifact is intentionally a development build and expires after 14 days. A permanently signed APK and automatic GitHub Release publishing will be added before the first public release.

No Google OAuth credentials are required. Never add an Android signing keystore to the repository.

## Project structure

```text
src/app/             Expo Router screens
src/components/      Reusable neo-brutalist UI components
src/calendar/        Android, Google web, and demo calendar repositories
src/constants/       Design tokens
src/data/            Temporary schedule fixtures
```

The browser starts with demo events until Google Calendar is connected. The installable Android build prompts for Calendar permission and then loads synced Google calendars from the device.

## Checks

```powershell
pnpm check
```
