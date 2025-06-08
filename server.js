import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Load environment variables from .env file
dotenv.config();

// Define constants for Azure OpenAI API
const SESSIONS_URL = process.env.AZURE_OPENAI_SESSIONS_URL;
const API_KEY = process.env.AZURE_OPENAI_API_KEY;

// Azure Speech Service credentials
// For demo purposes only, you should use environment variables in production
const SPEECH_KEY = process.env.AZURE_SPEECH_KEY || "dummy_key_for_testing"; // Set your actual Speech Service key in .env
const SPEECH_REGION = process.env.AZURE_SPEECH_REGION || "eastus"; // Set your Speech Service region in .env

console.log("SPEECH_KEY:", SPEECH_KEY);
console.log("SPEECH_REGION:", SPEECH_REGION);

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// API endpoint to get a session with ephemeral key
app.post("/api/sessions", async (req, res) => {
  try {
    const { model, voice } = req.body;

    console.log("Creating session with model:", model, "and voice:", voice);
    console.log("URL:", SESSIONS_URL);

    const response = await fetch(SESSIONS_URL.toString(), {
      method: "POST",
      headers: {
        "api-key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        voice: voice || "verse",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response body:", errorText);
      throw new Error(
        `Azure OpenAI API returned ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();
    console.log("Azure response data:", data); // Add this line
    res.json(data);
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get Speech Service token
app.get("/api/get-speech-token", async (req, res) => {
  try {
    if (!SPEECH_KEY) {
      return res.status(400).json({
        error: "Azure Speech Service key is not configured",
      });
    }

    // Token endpoint for Speech Services
    const tokenEndpoint = `https://${SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;

    const response = await axios({
      method: "post",
      url: tokenEndpoint,
      headers: {
        "Ocp-Apim-Subscription-Key": SPEECH_KEY,
        "Content-Type": "application/json",
      },
    });

    res.json({
      token: response.data,
      region: SPEECH_REGION,
    });
  } catch (error) {
    console.error(
      "Error getting speech token:",
      error.response?.data || error.message
    );
    res.status(error?.response?.status || 500).json({
      error: "Error retrieving token",
      details: error.message,
    });
  }
});

// Define the port
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
});
