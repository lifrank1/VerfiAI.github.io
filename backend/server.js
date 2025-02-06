const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// 🔹 Load Firebase Admin credentials (get this from Firebase console)
const serviceAccount = require('./firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(cors()); // Enable frontend requests
app.use(express.json()); // Allow JSON requests

const db = admin.firestore();

// 🔹 API route to create a new user
app.post('/api/create-user', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  try {
    // 🔹 Check if the email already exists using Firebase Authentication
    const existingUser = await admin.auth().getUserByEmail(email);
    if (existingUser) {
      // If the email already exists, send an error response
      return res.status(400).json({ success: false, message: 'Email already in use.' });
    }
    
    // 🔹 Create the user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email,
      password,
    });

    // 🔹 Store additional user details in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      firstName,
      lastName,
      email,
      createdAt: new Date(),
    });

    res.json({ success: true, uid: userRecord.uid });
  } catch (error) {
    console.error('Error creating user:', error);

    // If Firebase throws an error about the email being already used, handle it
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ success: false, message: 'Email already in use.' });
    }

    // For other errors, send the message from Firebase
    res.status(400).json({ success: false, message: error.message });
  }
});

// 🔹 Start the backend server
app.listen(5000, () => {
  console.log('Server running on port 5000');
});
