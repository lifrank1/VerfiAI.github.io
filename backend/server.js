const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { HfInference } = require('@huggingface/inference');

const serviceAccount = require("./firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(cors());
app.use(express.json());

const db = admin.firestore();
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

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

// New endpoint to generate citations
app.post("/api/generate-citation", async (req, res) => {
  try {
    const { paperTitle, authors, year } = req.body;
    
    const input = `generate citation for: ${paperTitle} by ${authors} published in ${year}`;
    
    const response = await hf.textGeneration({
      model: 'scieditor/citation-generation-t5',
      inputs: input,
      parameters: {
        max_length: 512,
        temperature: 0.7
      }
    });

    res.json({
      citation: response.generated_text
    });
  } catch (error) {
    console.error("Citation generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Modified chat endpoint to discuss paper contents
app.post("/api/chat", async (req, res) => {
  try {
    const { message, paperContent } = req.body;
    
    const input = `Context: ${paperContent}\nQuestion: ${message}`;
    
    const response = await hf.textGeneration({
      model: 'scieditor/citation-generation-t5',
      inputs: input,
      parameters: {
        max_length: 1024,
        temperature: 0.8
      }
    });

    res.json({
      reply: response.generated_text
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

const port = 3002;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const multer = require('multer');
const { spawn } = require('child_process');
const upload = multer({ dest: 'uploads/' });

app.post('/api/analyze-paper', async (req, res) => {
  const { doi } = req.body;
  console.log('Received DOI:', doi); // Log incoming DOI
  
  const pythonProcess = spawn('python', ['./backend/scrapers/doi_citation.py', doi]);
  
  let data = '';
  let errorData = '';
  
  pythonProcess.stdout.on('data', (chunk) => {
    data += chunk;
    console.log('Python output:', chunk.toString()); // Log Python output
  });
  
  pythonProcess.stderr.on('data', (chunk) => {
    errorData += chunk;
    console.error('Python error:', chunk.toString()); // Log Python errors
  });
  
  pythonProcess.on('close', (code) => {
    console.log('Process exited with code:', code); // Log exit code
    if (code !== 0) {
      return res.status(500).json({ 
        error: 'Failed to analyze paper',
        details: errorData
      });
    }
    try {
      const result = JSON.parse(data);
      console.log('Parsed result:', result); // Log parsed result
      res.json(result);
    } catch (e) {
      res.status(500).json({ 
        error: 'Invalid JSON response',
        details: e.message
      });
    }
  });
});app.post("/api/isbn-citation", async (req, res) => {
  const { isbn } = req.body;
  
  try {
    const pythonProcess = spawn('python', ['./scrapers/isbn_citation.py', isbn]);
    
    let data = '';
    
    pythonProcess.stdout.on('data', (chunk) => {
      data += chunk;
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: 'Failed to process ISBN' });
      }
      const results = JSON.parse(data);
      res.json(results);
    });
  } catch (error) {
    console.error("ISBN processing error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET endpoints
app.get("/api/users/:uid", async (req, res) => {
  try {
    const userDoc = await db.collection("users").doc(req.params.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(userDoc.data());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/papers/:doi", async (req, res) => {
  try {
    const paperDoc = await db.collection("papers").doc(req.params.doi).get();
    if (!paperDoc.exists) {
      return res.status(404).json({ error: "Paper not found" });
    }
    res.json(paperDoc.data());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT endpoints
app.put("/api/users/:uid", async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    await db.collection("users").doc(req.params.uid).update({
      firstName,
      lastName,
      email,
      updatedAt: new Date()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/papers/:doi", async (req, res) => {
  try {
    const { title, authors, year } = req.body;
    await db.collection("papers").doc(req.params.doi).update({
      title,
      authors,
      year,
      updatedAt: new Date()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE endpoints
app.delete("/api/users/:uid", async (req, res) => {
  try {
    await admin.auth().deleteUser(req.params.uid);
    await db.collection("users").doc(req.params.uid).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/papers/:doi", async (req, res) => {
  try {
    await db.collection("papers").doc(req.params.doi).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
