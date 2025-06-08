// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

// Configuration variables
let speechConfig = null;
let wakeWordActive = false;
let assistantWakeWords = [
  "assistant",
  "hey assistant",
  "ok assistant",
  "hey, assistant",
  "okay assistant",
];

/**
 * Initialize the Azure Speech services
 * @param {string} token - Azure Speech Service authorization token (not subscription key)
 * @param {string} region - Azure region
 */
export function initializeAzureSpeech(token, region) {
  // Use the authorization token from your backend, not the subscription key!
  speechConfig = window.SpeechSDK.SpeechConfig.fromAuthorizationToken(
    token,
    region
  );

  // Optional: adjust speechConfig parameters here, for example:
  // speechConfig.speechRecognitionLanguage = "en-US";

  return speechConfig;
}

/**
 * Detects if a wake word is spoken in the audio input
 * @param {Function} onWakeWordDetected - Callback function to execute when wake word is detected
 * @param {Function} onError - Callback function for errors
 * @returns {Object} - Object with stop method to stop listening
 */
export function startWakeWordDetection(onWakeWordDetected, onError) {
  if (!speechConfig) {
    const error = new Error(
      "Speech config not initialized. Call initializeAzureSpeech first."
    );
    if (onError) onError(error);
    return { stop: () => {}, isActive: () => false, addWakeWord: () => {} };
  }

  // Create audio config from default microphone input
  const audioConfig = window.SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

  // Create speech recognizer
  const recognizer = new window.SpeechSDK.SpeechRecognizer(
    speechConfig,
    audioConfig
  );

  // Set up continuous recognition
  recognizer.recognizing = (sender, event) => {
    // Process intermediate results - useful for debugging
    // console.log("Recognizing:", event.result.text);
  };

  recognizer.recognized = (sender, event) => {
    const result = event.result;

    // Check if we got a successful recognition
    if (result.reason === window.SpeechSDK.ResultReason.RecognizedSpeech) {
      const text = result.text.toLowerCase().trim();
      // console.log("Recognized text:", text);

      // Check if the recognized text contains any of our wake words (robust match)
      const foundWakeWord = assistantWakeWords.find((wakeWord) =>
        text.includes(wakeWord)
      );
      if (foundWakeWord) {
        console.log("Wake word detected:", foundWakeWord);
        if (onWakeWordDetected) {
          onWakeWordDetected(text);
        }
      }
    } else if (result.reason === window.SpeechSDK.ResultReason.NoMatch) {
      // console.log("No speech could be recognized");
    }
  };

  recognizer.canceled = (sender, event) => {
    if (event.reason === window.SpeechSDK.CancellationReason.Error) {
      console.error(`Speech recognition error: ${event.errorDetails}`);
      if (onError) onError(new Error(event.errorDetails));
    }
  };

  // Start continuous speech recognition
  recognizer.startContinuousRecognitionAsync(
    () => {
      console.log(
        "Wake word detection started - listening for 'assistant' or 'hey assistant'"
      );
      wakeWordActive = true;
    },
    (err) => {
      console.error("Error starting wake word detection:", err);
      if (onError) onError(err);
    }
  );

  // Return an object with methods to control the recognition
  return {
    stop: () => {
      if (wakeWordActive) {
        recognizer.stopContinuousRecognitionAsync(
          () => {
            console.log("Wake word detection stopped");
            recognizer.close();
            wakeWordActive = false;
          },
          (err) => {
            console.error("Error stopping wake word detection:", err);
          }
        );
      }
    },
    isActive: () => wakeWordActive,
    addWakeWord: (word) => {
      if (word && typeof word === "string") {
        assistantWakeWords.push(word.toLowerCase());
      }
    },
  };
}
