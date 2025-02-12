# VerifAI Backend

This is the backend service for VerifAI, built with **Node.js** and **Express.js**.

## 🚀 Features
- User authentication using Firebase
- AI-powered chat via Gemini API
- REST API for managing users

## 📌 Installation
1. Clone this repository:
   \`\`\`bash
   git clone <https://github.com/ShashankRaghuraj/VerfiAI.git>
   cd verifai-backend
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up the environment variables:
   - Create a \`.env\` file in the root directory.
   - Add the following:
     \`\`\`ini
     GEMINI_API_KEY=<THE_KEY_HERE>
     \`\`\`

4. Start the server:
   \`\`\`bash
   npm start
   \`\`\`

## 📡 API Endpoints
- \`POST /api/create-user\`: Creates a new user
- \`POST /api/chat\`: Sends a message to the AI model

## 📜 Dependencies
- Node.js (v14+)
- Express
- Firebase Admin SDK
- Google Generative AI SDK

## 🔧 Configuration
Ensure that your \`firebase-adminsdk.json\` is correctly set up in the root directory.

---

Maintained by **VerifAI Team**.
