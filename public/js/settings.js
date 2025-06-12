// Instead of hardcoding keys here, we should fetch them from a secure backend

// The region should match the region of your Azure resources
export const serviceRegion = "eastus2";

// Cached Speech Key Helper
let cachedSpeechCredentials = null;
let cachedSpeechCredentialsExpiry = 0;

// This should be replaced with a secure way to access keys
// In a real app, the API key should NEVER be exposed to the client
export const azureOpenAIKey = ""; // This will be replaced by fetching from server

// Speech service settings
export const azureSttKey = ""; // Will be fetched securely
export const region = serviceRegion; // Using the same region as other services

// Function to safely get API keys (to be implemented with a server endpoint)
export async function getAPIKey() {
  try {
    const response = await fetch("/api/get-credentials");
    const data = await response.json();
    return data.apiKey;
  } catch (error) {
    console.error("Error fetching API key:", error);
    return "";
  }
}

// Function to get Speech API key
async function getSpeechKey() {
  try {
    const response = await fetch("/api/get-speech-token");
    const data = await response.json();
    return {
      token: data.token,
      region: data.region,
    };
  } catch (error) {
    console.error("Error fetching Speech token:", error);
    return { token: "", region: serviceRegion };
  }
}

/**
 * Get Azure Speech credentials, caching them in-memory until shortly before expiry.
 * Use this in place of getSpeechKey() everywhere except for forced refresh.
 */
// Returns cached speech token if valid, otherwise fetches a new one
export async function getCachedSpeechKey() {
  const now = Date.now();
  const SAFETY_MARGIN_MS = 60 * 1000; // 1 minute safety margin

  if (
    cachedSpeechCredentials &&
    cachedSpeechCredentialsExpiry > now + SAFETY_MARGIN_MS
  ) {
    return cachedSpeechCredentials;
  }

  const creds = await getSpeechKey();
  // Assume token is valid for 9 minutes if not specified
  cachedSpeechCredentials = creds;
  cachedSpeechCredentialsExpiry =
    now + (creds.expires_in ? creds.expires_in * 1000 : 9 * 60 * 1000);
  return creds;
}
