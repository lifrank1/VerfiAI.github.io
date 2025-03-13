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
