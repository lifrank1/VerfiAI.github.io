const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { HfInference } = require('@huggingface/inference');
const multer = require("multer");
const { spawn } = require("child_process");

// 🔹 Initialize Firebase
const serviceAccount = require("./firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(cors());
app.use(express.json());

const db = admin.firestore();
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// 🔹 Multer Configuration for File Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Ensure 'uploads' directory exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // Unique filenames
  },
});


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
  const upload = multer({ storage: storage });

  /**
 * 🔹 API: Upload Document and Process Contents
 */
  app.post("/api/upload-document", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }
  console.log("Uploaded file:", req.file.path);

  const pythonProcess = spawn("python3", [
    "./backend/scrapers/document_scraper.py",
    req.file.path,
  ]);

  let data = "";
  let errorData = "";

  pythonProcess.stdout.on("data", (chunk) => {
    data += chunk;
    console.log("Python Output:", chunk.toString());
  });

  pythonProcess.stderr.on("data", (chunk) => {
    errorData += chunk;
    console.error("Python Error:", chunk.toString());
  });

  pythonProcess.on("close", async (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: "Failed to process document", details: errorData });
    }

    try {
      const extractedText = JSON.parse(data).text;
      const docRef = await db.collection("documents").add({
        fileName: req.file.originalname,
        extractedText,
        uploadedAt: new Date(),
      });

      res.json({ success: true, documentId: docRef.id, extractedText });
    } catch (e) {
      res.status(500).json({ error: "Invalid JSON response", details: e.message });
    }
  });
});

/**
 * 🔹 API: Retrieve Uploaded Documents
 */
app.get("/api/documents", async (req, res) => {
  try {
    const snapshot = await db.collection("documents").orderBy("uploadedAt", "desc").get();
    const documents = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 🔹 API: Generate Citations
 */
app.post("/api/generate-citation", async (req, res) => {
  try {
    const { paperTitle, authors, year } = req.body;
    const input = `generate citation for: ${paperTitle} by ${authors} published in ${year}`;

    const response = await hf.textGeneration({
      model: 'scieditor/citation-generation-t5',
      inputs: input,
      parameters: { max_length: 512, temperature: 0.7 }
    });

    res.json({ citation: response.generated_text });
  } catch (error) {
    console.error("Citation generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 🔹 API: Chat with AI about Paper Contents
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, paperContent } = req.body;
    const input = `Context: ${paperContent}\nQuestion: ${message}`;

    const response = await hf.textGeneration({
      model: 'scieditor/citation-generation-t5',
      inputs: input,
      parameters: { max_length: 1024, temperature: 0.8 }
    });

    res.json({ reply: response.generated_text });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 🔹 API: Analyze Paper using DOI
 */
app.post('/api/analyze-paper', async (req, res) => {
  const { doi } = req.body;
  console.log('Received DOI:', doi);

  const pythonProcess = spawn('python3', ['./backend/scrapers/doi_citation.py', doi]);
  let data = '';
  let errorData = '';

  pythonProcess.stdout.on('data', (chunk) => {
    data += chunk;
    console.log('Python output:', chunk.toString());
  });

  pythonProcess.stderr.on('data', (chunk) => {
    errorData += chunk;
    console.error('Python error:', chunk.toString());
  });

  pythonProcess.on('close', async (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Failed to analyze paper', details: errorData });
    }
    try {
      const result = JSON.parse(data);
      console.log('Parsed result:', result);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Invalid JSON response', details: e.message });
    }
  });
});

/**
 * 🔹 API: Get Paper by DOI
 */
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

/**
 * 🔹 API: Update Paper
 */
app.put("/api/papers/:doi", async (req, res) => {
  try {
    const { title, authors, year } = req.body;
    await db.collection("papers").doc(req.params.doi).update({
      title, authors, year, updatedAt: new Date()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/save-citation", async (req, res) => {
  try {
    const { paper, userID } = req.body;

    if (!userID) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const userRef = db.collection("users").doc(userID);
    const citationsRef = userRef.collection("citations");

    const newCitation = {
      title: paper.title,
      authors: paper.authors,
      research_field: paper.research_field?.field || null,
      year: paper.year,
      doi: paper.doi,
      retracted: paper.is_retracted || false,
      userID: userID,
      timestamp: new Date(),
    };

    const docRef = await citationsRef.add(newCitation);

    console.log("Citation saved to Firestore!");
    res.json({ success: true, citationId: docRef.id });

  } catch (error) {
    console.error("Error saving citation:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 🔹 API: Delete Paper
 */
app.delete("/api/papers/:doi", async (req, res) => {
  try {
    await db.collection("papers").doc(req.params.doi).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 🔹 API: Delete User
 */
app.delete("/api/users/:uid", async (req, res) => {
  try {
    await admin.auth().deleteUser(req.params.uid);
    await db.collection("users").doc(req.params.uid).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 Start the Server
const port = 3002;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
