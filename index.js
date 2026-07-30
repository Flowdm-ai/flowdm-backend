const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Root Check Endpoint
app.get('/', (req, res) => {
  res.send('FlowDM Backend Engine Running Successfully 🚀');
});

// 1. DIRECT INSTAGRAM BUSINESS OAUTH ENDPOINT
app.get('/auth/instagram', (req, res) => {
  const clientID = process.env.INSTAGRAM_CLIENT_ID; // Meta App ID
  const redirectUri = encodeURIComponent(
    process.env.REDIRECT_URI || 'https://flowdm-backend-qqcv.onrender.com/auth/instagram/callback'
  );

  // Instagram Business OAuth Scopes
  const scopes = [
    'instagram_basic',
    'instagram_manage_messages',
    'instagram_manage_comments',
    'pages_read_engagement'
  ].join(',');

  // Direct Instagram Login Window URL
  const instagramAuthUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientID}&redirect_uri=${redirectUri}&scope=${scopes}&response_type=code`;

  res.redirect(instagramAuthUrl);
});

// 2. OAUTH CALLBACK & TOKEN EXCHANGE ROUTE
app.get('/auth/instagram/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code missing from Meta redirect.");
  }

  try {
    console.log("Instagram Auth Code Received:", code);

    // Redirect user back to Frontend Dashboard with success state
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard?status=connected`);
  } catch (error) {
    console.error("OAuth Callback Error:", error.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard?error=auth_failed`);
  }
});

// Server Listener
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});