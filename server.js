import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// 1. Root Test Endpoint
app.get('/', (req, res) => {
  res.send('FlowDM Backend Engine Active & Ready 🚀');
});

// 2. Direct Instagram Business OAuth Redirect Endpoint
app.get('/auth/instagram', (req, res) => {
  const clientID = process.env.INSTAGRAM_CLIENT_ID || process.env.FACEBOOK_CLIENT_ID;
  const redirectUri = encodeURIComponent(
    process.env.REDIRECT_URI || 'https://flowdm-backend-qqcv.onrender.com/auth/instagram/callback'
  );

  const scopes = [
    'instagram_basic',
    'instagram_manage_messages',
    'instagram_manage_comments',
    'pages_read_engagement'
  ].join(',');

  const instagramAuthUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientID}&redirect_uri=${redirectUri}&scope=${scopes}&response_type=code`;

  console.log("Redirecting to Direct Instagram Auth:", instagramAuthUrl);
  res.redirect(instagramAuthUrl);
});

// 3. Fallback Route for Facebook URL
app.get('/auth/facebook', (req, res) => {
  res.redirect('/auth/instagram');
});

// 4. OAuth Callback Route
app.get('/auth/instagram/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code missing from Meta.");
  }

  try {
    console.log("Instagram Auth Code Received successfully:", code);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard?status=connected`);
  } catch (error) {
    console.error("OAuth Callback Error:", error.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard?error=auth_failed`);
  }
});

// 5. Meta Webhook Verification (GET Request - Handshake)
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "flowdm_secret_123";
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully by Meta!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 6. Handle Incoming Instagram Comments (POST Request)
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'instagram') {
      body.entry.forEach(async (entry) => {
        const changes = entry.changes;
        
        changes.forEach(async (change) => {
          if (change.field === 'comments') {
            const commentData = change.value;
            const commentText = commentData.text;
            const userId = commentData.from.id;

            console.log(`New comment detected: "${commentText}" from Instagram User ID: ${userId}`);
          }
        });
      });

      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    console.error("Webhook Processing Error:", err.message);
    res.status(500).send('Server Error');
  }
});

// Server Initialization
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`FlowDM Server running successfully on port ${PORT}`);
});