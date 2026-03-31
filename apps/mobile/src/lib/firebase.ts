import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";

export { auth };
export type { FirebaseAuthTypes };

/**
 * Send OTP to phone number. Returns a confirmation object used to verify the code.
 * On real devices, Firebase may auto-verify via silent APNs (iOS) or Play Integrity (Android).
 */
export function sendOtp(
  phoneNumber: string,
): Promise<FirebaseAuthTypes.ConfirmationResult> {
  return auth().signInWithPhoneNumber(phoneNumber);
}

/**
 * Get the current user's Firebase ID token for API authorization.
 * Pass `forceRefresh: true` to force a token refresh.
 */
export async function getIdToken(
  forceRefresh = false,
): Promise<string | null> {
  const user = auth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

/** Sign out the current Firebase user. */
export function signOut(): Promise<void> {
  return auth().signOut();
}
