Of course. I can help with that. Here is a more comprehensive README for your repository based on the files you've provided.

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
