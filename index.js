import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(express.json());

// Request Console Logger
app.use((req, res, next) => {
    console.log(`[INCOMING REQUEST] ${req.method} -> ${req.url}`);
    next();
});

// Cloud Services Initialization
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) 
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const aiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

// 1. Root Route
app.get('/', (req, res) => {
    res.status(200).send("🚀 FlowDM SaaS Engine is Live and Running!");
});

// 2. Meta OAuth Start Route (Handles both /auth/facebook and /auth/facebook/)
app.get(['/auth/facebook', '/auth/facebook/'], (req, res) => {
    const cleanAppUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    const redirectUri = `${cleanAppUrl}/auth/facebook/callback`;
    const scopes = ['instagram_basic', 'instagram_manage_messages', 'pages_messaging', 'pages_show_list'];
    
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.META_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join(',')}&response_type=code`;
    
    console.log("[OAUTH INIT] Redirecting to:", authUrl);
    res.redirect(authUrl);
});

// 3. Meta OAuth Callback Route
app.get(['/auth/facebook/callback', '/auth/facebook/callback/'], async (req, res) => {
    const { code } = req.query;
    const cleanAppUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    const redirectUri = `${cleanAppUrl}/auth/facebook/callback`;

    if (!code) {
        return res.status(400).send("Authorization Code Missing.");
    }

    try {
        const tokenRes = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
            params: {
                client_id: process.env.META_CLIENT_ID,
                client_secret: process.env.META_CLIENT_SECRET,
                redirect_uri: redirectUri,
                code: code
            }
        });

        const shortLivedToken = tokenRes.data.access_token;

        const longLivedRes = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: process.env.META_CLIENT_ID,
                client_secret: process.env.META_CLIENT_SECRET,
                fb_exchange_token: shortLivedToken
            }
        });

        const longLivedToken = longLivedRes.data.access_token;

        const accountsRes = await axios.get(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`);
        const pageId = accountsRes.data.data[0]?.id;

        const instaRes = await axios.get(`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${longLivedToken}`);
        const instaBusinessId = instaRes.data.instagram_business_account?.id;

        if (supabase) {
            await supabase
                .from('instagram_accounts')
                .upsert({
                    instagram_business_id: instaBusinessId,
                    facebook_page_id: pageId,
                    access_token: longLivedToken,
                    token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
                }, { onConflict: 'instagram_business_id' });
        }

        res.send("🎉 Account Connected Successfully to FlowDM!");

    } catch (err) {
        console.error("OAuth Exchange Failed:", err.response?.data || err.message);
        res.status(500).send("Authentication Failed.");
    }
});

// 4. Webhook Verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// 5. Catch-All Route (Aapko exact status batayega screen par)
app.use((req, res) => {
    console.log(`[404 NOT FOUND] ${req.method} -> ${req.url}`);
    res.status(404).send(`⚠️ FlowDM Server active hai, lekin requested URL nahi mila: ${req.url}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 FlowDM SaaS Engine running on port ${PORT}`));