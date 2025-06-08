// Instead of hardcoding keys here, we should fetch them from a secure backend

// The region should match the region of your Azure resources
export const serviceRegion = "eastus2";

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
export async function getSpeechKey() {
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
