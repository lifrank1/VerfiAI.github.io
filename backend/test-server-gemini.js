require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require("express");

async function testBoth() {
  console.log("\nTesting direct usage:");
  const directKey = process.env.GEMINI_API_KEY;
  console.log("Direct key prefix:", directKey?.substring(0, 6));

  try {
    const directGenAI = new GoogleGenerativeAI(directKey);
    const directModel = directGenAI.getGenerativeModel({ model: "gemini-pro" });
    const directResult = await directModel.generateContent("Say hello!");
    console.log(
      "Direct test successful:",
      (await directResult.response).text()
    );
  } catch (error) {
    console.error("Direct test failed:", error);
  }

  console.log("\nTesting in Express context:");
  const app = express();
  const serverKey = process.env.GEMINI_API_KEY;
  console.log("Server key prefix:", serverKey?.substring(0, 6));

  try {
    const serverGenAI = new GoogleGenerativeAI(serverKey);
    const serverModel = serverGenAI.getGenerativeModel({ model: "gemini-pro" });
    const serverResult = await serverModel.generateContent("Say hello!");
    console.log(
      "Server test successful:",
      (await serverResult.response).text()
    );
  } catch (error) {
    console.error("Server test failed:", error);
  }
}

testBoth();
