# Azure OpenAI Realtime WebRTC Demo

A Node.js application that demonstrates real-time communication with Azure OpenAI using WebRTC.

## Features

- Voice-triggered AI assistant
- Real-time audio streaming with WebRTC
- Speech recognition for wake words and commands
- Azure OpenAI integration with GPT-4o mini realtime preview

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with your Azure OpenAI API key:

```
AZURE_OPENAI_API_KEY=your_api_key_here
PORT=3000
```

## Usage

Start the development server:

```bash
npm run dev
```

Or for production:

```bash
npm start
```

Visit `http://localhost:3000` in your browser.

## Important Notes

- This demo works best in Chrome and Edge browsers that support the Web Speech API.
- Say "assistant" or "Hey assistant" to activate the AI.
- Say "stop" or "stop it shut up" to end the current session.

## Security Notice

For production use, never expose API keys in client-side code. This demo shows how to move API calls to a secure backend.
