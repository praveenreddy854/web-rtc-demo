import { getCachedSpeechKey } from "./settings.js";
import {
  initializeAzureSpeech,
  startWakeOrStopWordDetection,
} from "./azure-stt.js";

const WEBRTC_URL =
  "https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc";
const DEPLOYMENT = "gpt-4o-mini-realtime-preview";
const VOICE = "verse";

let wakeWordDetector = null;
let inSessionStopWordDetector = null;
let currentSession = null;
let peerConnection = null;
let dataChannel = null;

// Create a single remote audio element for assistant playback
const remoteAudio = document.createElement("audio");
remoteAudio.autoplay = true;
document.body.appendChild(remoteAudio);

function setVoiceStatus(status) {
  const el = document.getElementById("voiceStatus");
  if (el) el.textContent = status;
}

function logMessage(msg) {
  const container = document.getElementById("logContainer");
  if (!container) return;
  const div = document.createElement("div");
  div.textContent = msg;
  container.appendChild(div);
}

function addChatMessage(sender, message) {
  const chatContainer = document.getElementById("chatContainer");
  if (!chatContainer) return;
  const div = document.createElement("div");
  div.className = sender === "user" ? "user-message" : "assistant-message";
  div.textContent = message;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// --- Wake word detection logic ---
async function initWakeWordDetection() {
  setVoiceStatus(
    "Listening for wake word (say 'assistant' or 'hey assistant')"
  );
  logMessage("Initializing Azure Speech for wake word detection...");

  try {
    const speechCredentials = await getCachedSpeechKey();

    if (!speechCredentials.token) {
      logMessage("Failed to get speech credentials.");
      setVoiceStatus("Could not start wake word detection.");
      return;
    }

    // Initialize Speech SDK
    const initialized = initializeAzureSpeech(
      speechCredentials.token,
      speechCredentials.region
    );

    if (!initialized) {
      logMessage("Failed to initialize Azure Speech SDK.");
      setVoiceStatus("Could not start wake word detection.");
      return;
    }

    // Start listening for wake word
    wakeWordDetector = startWakeOrStopWordDetection(
      (text) => {
        logMessage("Wake word detected: " + text);
        setVoiceStatus("Wake word detected! Starting session...");
        startSessionFromWake();
      },
      (text) => {
        logMessage("Stop word detected: " + text);
        setVoiceStatus("Stop word detected! Ending session...");
        onSessionEnded();
      },
      (error) => {
        logMessage("Wake word detection error: " + error.message);
        setVoiceStatus("Wake word error. Try reloading.");
        wakeWordDetector = null;
      }
    );
  } catch (error) {
    logMessage("Error initializing wake word: " + error.message);
    setVoiceStatus("Wake word error. Try reloading.");
  }
}

// --- Start OpenAI Session after wake word ---
async function startSessionFromWake() {
  // Stop wake word detection while session is active
  if (wakeWordDetector && wakeWordDetector.isActive()) {
    wakeWordDetector.stop();
  }
  // Stop any previous in-session stop word detector
  if (inSessionStopWordDetector && inSessionStopWordDetector.isActive()) {
    inSessionStopWordDetector.stop();
  }
  setVoiceStatus("Session active! Say 'stop' to end the session.");
  logMessage("Connecting to OpenAI real-time session...");

  try {
    // POST to your backend to get ephemeral key/session info
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: DEPLOYMENT, voice: VOICE }),
    });
    const data = await response.json();
    console.log("OpenAI session API response:", data); // ADD THIS LINE

    const ephemeralKey = data.client_secret?.value;
    const sessionId = data.id || null;

    if (!ephemeralKey) {
      logMessage("Failed to create OpenAI session: missing ephemeral key.");
      onSessionEnded();
      return;
    }

    logMessage(
      "Received ephemeralKey and sessionId, creating WebRTC connection..."
    );

    // Step 1: Create RTCPeerConnection
    peerConnection = new RTCPeerConnection();

    // Add ontrack handler to play remote audio
    peerConnection.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0];
      logMessage("Remote audio stream started.");
      console.log("Remote track event:", event);
      console.log("Stream tracks:", event.streams[0].getTracks());
      event.streams[0]
        .getAudioTracks()
        .forEach((track) =>
          console.log("Audio track:", track.label, "Enabled:", track.enabled)
        );
    };

    // Step 2: Setup data channel for chat
    dataChannel = peerConnection.createDataChannel("chat");

    dataChannel.onopen = () => {
      logMessage("DataChannel open. You can now send messages.");
      setVoiceStatus("Session active! You can chat now. Say 'stop' to end.");
      // Enable send button and input
      const sendBtn = document.getElementById("sendBtn");
      const userInput = document.getElementById("userInput");
      if (sendBtn) sendBtn.disabled = false;
      if (userInput) userInput.disabled = false;
    };

    dataChannel.onclose = () => {
      logMessage("DataChannel closed.");
      setVoiceStatus(
        "Data channel closed. Session ended. Listening for wake word."
      );
      onSessionEnded();
    };

    dataChannel.onerror = (e) => {
      logMessage("DataChannel error: " + e.message);
    };

    dataChannel.onmessage = (event) => {
      logMessage("Received message from OpenAI: " + event.data);
      addChatMessage("assistant", event.data);
    };

    // Step 3: Set up ICE candidate handler
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate === null) {
        // All ICE candidates gathered, send offer to OpenAI
        const offer = peerConnection.localDescription;
        logMessage("Sending offer to OpenAI...");
        // Send offer to OpenAI using the ephemeralKey
        const rtcResp = await fetch(WEBRTC_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Session-Id": sessionId || "",
          },
          body: new Blob([offer.sdp], { type: "application/sdp" }),
        });

        if (!rtcResp.ok) {
          logMessage("Failed to establish session: " + (await rtcResp.text()));
          onSessionEnded();
          return;
        }
        const rtcText = await rtcResp.text();
        const rtcData = {
          type: "answer",
          sdp: rtcText,
        };
        logMessage(
          "Received answer from OpenAI, setting remote description..."
        );
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({
            type: rtcData.type,
            sdp: rtcData.sdp,
          })
        );
        logMessage("WebRTC connection established!");
      }
    };

    // Step 4: Add audio track to peer connection
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    localStream.getAudioTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    // Step 5: Create offer and set local description
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Save session info to allow cleanup later
    currentSession = { data, peerConnection, dataChannel };

    // --- Start in-session stop word detection ---
    const speechCredentials = await getCachedSpeechKey();
    if (speechCredentials.token) {
      initializeAzureSpeech(speechCredentials.token, speechCredentials.region);
      inSessionStopWordDetector = startWakeOrStopWordDetection(
        null, // No wake word needed during session
        (text) => {
          logMessage("Stop word detected (in-session): " + text);
          setVoiceStatus("Stop word detected! Ending session...");
          onSessionEnded();
        },
        (error) => {
          logMessage("In-session stop word detection error: " + error.message);
        }
      );
    }

    // Optional: End session after 60s (replace with real logic)
    setTimeout(() => {
      logMessage("Session ended (auto timeout for demo)");
      onSessionEnded();
    }, 60000);
  } catch (err) {
    logMessage("Failed to start session: " + err.message);
    onSessionEnded();
  }
}

// --- Called when OpenAI session ends ---
function onSessionEnded() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }
  currentSession = null;

  // Stop and clean up remote audio
  if (remoteAudio) {
    remoteAudio.srcObject = null;
    // Optionally, remove from DOM if you want:
    // remoteAudio.remove();
  }

  // Stop in-session stop word detector if running
  if (inSessionStopWordDetector && inSessionStopWordDetector.isActive()) {
    inSessionStopWordDetector.stop();
    inSessionStopWordDetector = null;
  }

  // Disable send button and input
  const sendBtn = document.getElementById("sendBtn");
  const userInput = document.getElementById("userInput");
  if (sendBtn) sendBtn.disabled = true;
  if (userInput) userInput.disabled = true;

  setVoiceStatus(
    "Listening for wake word (say 'assistant' or 'hey assistant')"
  );
  logMessage("Session ended. Returning to wake word listening.");
  initWakeWordDetection();
}

// --- Manual button (optional) ---
document.getElementById("startSessionBtn")?.addEventListener("click", () => {
  if (!currentSession) {
    logMessage("Manual session start requested.");
    setVoiceStatus("Session active! Say 'stop' to end the session.");
    startSessionFromWake();
  }
});

// --- On page load ---
window.addEventListener("DOMContentLoaded", () => {
  setVoiceStatus("Click 'Enable Assistant' to start listening.");
  document.getElementById("enableMicBtn").onclick = () => {
    initWakeWordDetection();
    document.getElementById("enableMicBtn").disabled = true;
    setVoiceStatus(
      "Listening for wake word (say 'assistant' or 'hey assistant')"
    );
  };
});
