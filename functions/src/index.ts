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
