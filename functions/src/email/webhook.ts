import { parseEmail, EmailContent } from './parser';

// Mock database interface
// NOTE: This is a placeholder for actual database interaction.
// The actual project would import the Firebase Admin SDK or similar to fetch the user document.
// Since the backend environment and DB schema files are not available in this context,
// we are using a mock to satisfy the requirement of demonstrating the logic.
interface UserDoc {
  id: string;
  email: string;
  user_type: 'manager' | 'maker';
}

async function fetchUser(userId: string): Promise<UserDoc> {
  // Mock implementation
  // In production: const snapshot = await admin.firestore().collection('users').doc(userId).get();
  return {
    id: userId,
    email: 'test@example.com',
    user_type: 'maker', // Default to maker for now
  };
}

export async function handleIncomingEmail(userId: string, emailContent: EmailContent) {
  const userDoc = await fetchUser(userId);

  const defaultDuration = userDoc.user_type === 'manager' ? 30 : 60;

  const event = parseEmail(emailContent, defaultDuration);

  console.log(`Created event for ${userDoc.email}:`, event);
  return event;
}
