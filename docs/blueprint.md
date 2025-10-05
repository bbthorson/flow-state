# **App Name**: Flow State

## Core Features:

- Charging Status Display: Display the current charging status of the device (charging/discharging).
- Orientation Status Display: Show whether the device is face up or face down.
- Webhook Configuration: Allow the user to input and save a webhook URL to localStorage. The URL will be loaded when the app starts.
- Webhook Notifications: Send a POST request to the configured webhook URL when the charging or orientation status changes. Include a timestamp with each notification.
- PWA Features: Enable installability on supported devices and offline functionality using service worker caching.

## Style Guidelines:

- Primary color: White (#FFFFFF) for a clean and modern look.
- Secondary color: Light gray (#F0F0F0) for backgrounds and subtle contrasts.
- Accent: Teal (#008080) for interactive elements and highlights.
- Use a simple, single-column layout for easy readability on mobile devices.
- Use clear and recognizable icons for charging and orientation status.
- Subtle animations or transitions when the device status changes.

## Original User Request:
### Simple Progressive Web Application

I'll help you build a simple PWA that tracks device charging and orientation, then sends webhook notifications when these states change. Let's create a clean, understandable structure using Next.js.

```typescriptreact project="pwa-tracker"
...
```

## How It Works

This PWA tracks two device states and sends webhook notifications when they change:

1. **Charging Status**: Uses the Battery Status API to detect if the device is charging
2. **Face Down Status**: Uses the Device Orientation API to detect if the device is face down
3. **Webhook Configuration**: Allows users to set a webhook URL that's stored in localStorage


### File Structure

- **src/app/page.tsx**: Main component that manages state and initializes device sensors.
- **src/app/manifest.ts**: PWA manifest configuration for installability.
- **src/app/layout.tsx**: Root layout with PWA meta tags.
- **src/components/app-bar.tsx**: Simple app bar with title and icons.
- **src/components/status-section.tsx**: Displays current device states.
- **src/components/webhook-section.tsx**: Form for configuring the webhook URL.
- **src/components/onboarding.tsx**: Onboarding component for new users.
- **src/components/permissions.tsx**: Component to handle device API permissions.
- **src/components/settings-section.tsx**: Contains settings-related components.
- **src/components/webhook-helper.tsx**: A helper component for webhook functionality.
- **public/sw.js**: Service worker for offline functionality.


### Key Features

1. **Device APIs**:

1. Battery Status API to detect charging
2. Device Orientation API to detect face down position



2. **Local Storage**:

1. Saves webhook URL in localStorage
2. Loads saved URL on application start



3. **Webhook Notifications**:

1. Sends updates when charging or orientation status changes
2. Includes timestamp with each notification



4. **Progressive Web App**:

1. Installable on supported devices
2. Works offline with service worker caching
3. Has app icons and manifest





### Browser Compatibility Notes

- The Battery Status API is not supported in all browsers
- Device Orientation API may require permission on some devices
- The application handles cases where these APIs are not available


To use this application, simply:

1. Enter your webhook URL
2. Click "Save Webhook URL"
3. The app will start tracking device states and sending updates


The UI is clean and responsive, with clear sections for status display and configuration.
  