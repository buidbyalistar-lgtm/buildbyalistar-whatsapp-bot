const express = require('express');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// ✅ Verify webhook (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ✅ Receive messages (POST)
app.post('/webhook', (req, res) => {
  console.log("Incoming:", JSON.stringify(req.body, null, 2));
  return res.sendStatus(200);
});

// ✅ Test route
app.get('/', (req, res) => {
  res.send('Bot running');
});

// ✅ Start server (LAST)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server started on port', PORT);
});