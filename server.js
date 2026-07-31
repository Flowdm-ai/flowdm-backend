const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Root Route
app.get('/', (req, res) => {
  res.send('FlowDM Server Active - Instagram Auth Ready 🚀');
});

// 1. Direct Instagram OAuth Redirect Endpoint
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

// 2. Fallback for /auth/facebook URL to prevent 404
app.get('/auth/facebook', (req, res) => {
  res.redirect('/auth/instagram');
});

// 3. Callback Route
app.get('/auth/instagram/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code missing.");
  }

  try {
    console.log("Instagram Code Received:", code);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard?status=connected`);
  } catch (error) {
    console.error("Callback Error:", error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard?error=auth_failed`);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`FlowDM Backend running on port ${PORT}`);
});