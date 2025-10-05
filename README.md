# Flow State

Flow State is a simple Progressive Web Application (PWA) that tracks the charging and orientation status of your device and sends webhook notifications when these states change.

## Features

  * **Device State Tracking**:
      * **Charging Status**: Utilizes the Battery Status API to detect if the device is charging.
      * **Face Down Status**: Uses the Device Orientation API to detect if the device is face down.
  * **Webhook Notifications**: Sends a POST request to a configured webhook URL when the charging or orientation status changes, including a timestamp with each notification.
  * **PWA Functionality**:
      * Installable on supported devices for a native-app-like experience.
      * Offline functionality through a service worker.
  * **Configurable Webhooks**: Allows users to set and save webhook URLs, which are persisted in `localStorage`.

## How It Works

This PWA tracks two device states and sends webhook notifications when they change:

1.  **Charging Status**: Uses the Battery Status API to detect if the device is charging.
2.  **Face Down Status**: Uses the Device Orientation API to detect if the device is face down.
3.  **Webhook Configuration**: Allows users to set a webhook URL that's stored in `localStorage`.

## File Structure

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

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

  * npm
    ```sh
    npm install npm@latest -g
    ```

### Installation

1.  Clone the repo
    ```sh
    git clone https://github.com/your_username/flow-state.git
    ```
2.  Install NPM packages
    ```sh
    npm install
    ```
3.  Run the development server
    ```sh
    npm run dev
    ```

## Usage

1.  Enter your webhook URL in the settings section.
2.  Click "Save Webhook URL".
3.  The application will begin tracking the device's charging and orientation status and send updates to your configured webhook.
