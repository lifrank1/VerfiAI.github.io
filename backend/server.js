const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Debug logging
console.log("Loading environment from:", path.join(__dirname, ".env"));
console.log("Environment check:");
console.log("GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);
console.log(
  "GEMINI_API_KEY prefix:",
  process.env.GEMINI_API_KEY?.substring(0, 6)
);

// Store the API key in a constant
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("FATAL: GEMINI_API_KEY not found in environment");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Rest of your server setup
const serviceAccount = require("./firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(cors());
app.use(express.json());

const db = admin.firestore();

// 🔹 API route to create a new user
app.post("/api/create-user", async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  try {
    // Check if email exists first
    const usersByEmail = await admin.auth().getUserByEmail(email);
    
    // If we get here, the email exists
    return res.status(400).json({
      success: false,
      message: "Email already in use.",
    });
  } catch (error) {
    // If error code is auth/user-not-found, the email is available
    if (error.code === 'auth/user-not-found') {
      try {
        // Create the new user
        const userRecord = await admin.auth().createUser({
          email,
          password,
        });

        // Store additional user details in Firestore
        await db.collection("users").doc(userRecord.uid).set({
          firstName,
          lastName,
          email,
          createdAt: new Date(),
        });

        return res.json({ success: true, uid: userRecord.uid });

      } catch (createError) {
        console.error("Error creating user:", createError);
        return res.status(400).json({
          success: false,
          message: createError.message,
        });
      }
    }

    // Handle any other errors
    console.error("Error checking email:", error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});
// 🔹 API route to send a message to Deepseek
app.post("/api/chat", async (req, res) => {
  try {
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("Messages array:", JSON.stringify(req.body.messages, null, 2));
    console.log(
      "Last message:",
      req.body.messages[req.body.messages.length - 1].content
    );

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Try with just the last message first
    const lastMessage = req.body.messages[req.body.messages.length - 1].content;
    console.log("Attempting to generate content with:", lastMessage);

    const result = await model.generateContent(lastMessage);
    console.log("Generation successful");
    const response = await result.response;
    const responseText = response.text();
    console.log("Response received:", responseText);

    res.json({
      choices: [
        {
          message: {
            content: responseText,
          },
        },
      ],
    });
  } catch (error) {
    console.error("Full error details:", {
      error: error,
      requestBody: req.body,
      messageCount: req.body.messages?.length,
    });
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
