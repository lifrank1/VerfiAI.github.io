const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

// 🔹 Load Firebase Admin credentials (get this from Firebase console)
const serviceAccount = require("./firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(cors()); // Enable frontend requests
app.use(express.json()); // Allow JSON requests

const db = admin.firestore();

// 🔹 API route to create a new user
app.post("/api/create-user", async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  try {
    // Try to create the user first
    const userRecord = await admin.auth().createUser({
      email,
      password,
    });

    // If successful, store additional user details in Firestore
    await db.collection("users").doc(userRecord.uid).set({
      firstName,
      lastName,
      email,
      createdAt: new Date(),
    });

    res.json({ success: true, uid: userRecord.uid });
  } catch (error) {
    console.error("Error creating user:", error);

    // Handle specific Firebase error codes
    if (error.code === "auth/email-already-exists") {
      return res.status(400).json({
        success: false,
        message: "Email already in use.",
      });
    }

    // For other errors, send the message from Firebase
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// 🔹 Start the backend server
app.listen(3002, () => {
  console.log("Server running on port 3002");
});
