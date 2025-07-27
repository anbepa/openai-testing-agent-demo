import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

dotenv.config({ path: '.env.development' });

const PORT = process.env.PORT || 8000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: CORS_ORIGIN } });

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-pro',
  apiKey: process.env.GOOGLE_API_KEY,
});

app.get('/', (req, res) => {
  res.send('Gemini server running');
});

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  socket.on('testCaseInitiated', async (data) => {
    const prompt = `You are a QA automation assistant. Generate a Playwright test in TypeScript that follows these instructions:\n${data.testCase}\nReturn only the code inside a markdown code block.`;
    try {
      const response = await model.invoke(prompt);
      socket.emit('message', response.content);
    } catch (err) {
      console.error('Gemini error', err);
      socket.emit('message', 'Error generating test code.');
    }
  });

  socket.on('message', async (msg) => {
    try {
      const response = await model.invoke(msg);
      socket.emit('message', response.content);
    } catch (err) {
      console.error('Gemini error', err);
      socket.emit('message', 'Error generating response.');
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket server listening on port ${PORT}`);
});
