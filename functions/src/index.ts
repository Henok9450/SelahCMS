import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

interface UpdateUserStatusData {
  uid: string;
  disabled: boolean;
}

export const updateUserStatus = functions.https.onCall(async (data: UpdateUserStatusData, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Only authenticated users can update user status"
    );
  }

  const adminCheck = await admin.firestore()
    .collection("admins")
    .doc(context.auth.uid)
    .get();

  if (!adminCheck.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can update user status"
    );
  }

  if (!data.uid || typeof data.disabled !== "boolean") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid request data"
    );
  }

  try {
    await admin.auth().updateUser(data.uid, {
      disabled: data.disabled
    });
    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError(
      "internal",
      "Error updating user status",
      error
    );
  }
});

interface CreateUserAccountData {
  email: string;
  firstName: string;
  lastName: string;
}

export const createUserAccount = functions.https.onCall(async (data: CreateUserAccountData, context) => {
  // 1. Security: Check for Authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Only authenticated users can create accounts"
    );
  }

  // 2. Security: Check for Admin Privileges
  const adminCheck = await admin.firestore()
    .collection("admins")
    .doc(context.auth.uid)
    .get();

  if (!adminCheck.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can create user accounts"
    );
  }

  // 3. Validation
  if (!data.email || !data.firstName || !data.lastName) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Email, First Name, and Last Name are required"
    );
  }

  const email = data.email.trim();
  const displayName = `${data.firstName.trim()} ${data.lastName.trim()}`;
  // Generate a temporary password (e.g., specific pattern or random)
  const password = "Password@123";

  try {
    // 4. Check if user already exists
    try {
      const existingUser = await admin.auth().getUserByEmail(email);
      return {
        success: true,
        uid: existingUser.uid,
        message: "User already exists",
        isNew: false
      };
    } catch (error: any) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
      // User doesn't exist, proceed to create
    }

    // 5. Create new user
    const userRecord = await admin.auth().createUser({
      email: email,
      emailVerified: true, // Auto-verify since admin is creating it
      password: password,
      displayName: displayName,
      disabled: false
    });

    return {
      success: true,
      uid: userRecord.uid,
      message: "User created successfully",
      isNew: true
    };
  } catch (error) {
    console.error("Error creating user:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to create user account",
      error
    );
  }
});
