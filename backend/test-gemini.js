require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize the API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testGeminiAPI() {
  try {
    console.log("Testing Gemini API connection...");

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Send a simple test prompt
    const prompt = "Say hello and confirm you're working!";
    console.log("Sending test prompt:", prompt);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("Response received:", text);
    console.log("API test successful!");
  } catch (error) {
    console.error("Error testing Gemini API:", error);
  }
}

// Run the test
testGeminiAPI();
