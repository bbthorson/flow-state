# Development Environment Setup

This guide covers the steps required to set up the "Flow State" development environment.

## Phase 1: Prerequisites & Installation

1.  **Node.js**: Ensure you have Node.js (v18+) installed.
2.  **Git**: Clone the repository.
3.  **Install Dependencies**:
    ```bash
    npm install
    ```

## Phase 2: Firebase Configuration

1.  Create a Firebase project.
2.  Enable Firestore and Authentication.
3.  Add your Firebase configuration to the environment variables.

## Phase 3: Environment Variables

Create a `.env` file in the root directory and populate it with the required keys:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
GOOGLE_GENAI_API_KEY=...
```

## Phase 4: Email & Notifications (Resend)

The application uses **Resend** for transactional emails and notifications. This replaces the legacy SendGrid integration.

### 1. Create Resend Account
Sign up for an account at [resend.com](https://resend.com).

### 2. Generate API Key
1.  Navigate to the **API Keys** section in your Resend dashboard.
2.  Create a new API Key with "Sending access" (or Full access).
3.  Copy the key immediately (you won't be able to see it again).

### 3. Configure Environment
Add the Resend API key to your `.env` file:

```env
RESEND_API_KEY=re_123456789...
```

### 4. Domain Verification (Optional for Dev)
For production, you must verify your sending domain. For local development, you can send emails to the email address associated with your Resend account (usually your signup email) without domain verification.

### 5. Verification
To verify the setup, you can run the notification test script (if available) or trigger a flow that sends an email action. Ensure the logs show `Resend API success` rather than generic SMTP errors.
