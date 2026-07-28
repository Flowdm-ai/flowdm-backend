import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(express.json());

// Request Logging Middleware (Console me dikhega ki request aayi)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} request to ${req.url}`);
    next();
});

// 1. Initialize Cloud Services (Safely)
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY 
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const aiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

// 2. ROOT ROUTE (Health Check)
app.get('/', (req, res) => {
    res.status(200).send("🚀 FlowDM SaaS Engine is Live and Running!");
});

// 3. META OAUTH INIT ROUTE
app.get('/auth/facebook', (req, res) => {
    const redirectUri = `${process.env.APP_URL}/auth/facebook/callback`;
    const scopes = ['instagram_basic', 'instagram_manage_messages', 'pages_messaging', 'pages_show_list'];
    
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.META_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join(',')}&response_type=code`;
    
    res.redirect(authUrl);
});

// 4. META OAUTH CALLBACK ROUTE
app.get('/auth/facebook/callback', async (req, res) => {
    const { code } = req.query;
    const redirectUri = `${process.env.APP_URL}/auth/facebook/callback`;

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

// 5. WEBHOOK VERIFICATION
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// 6. WEBHOOK EVENT LISTENER
app.post('/webhook', async (req, res) => {
    try {
        const entry = req.body?.entry?.[0];
        const change = entry?.changes?.[0]?.value;

        if (change && change.text && supabase) {
            const commentText = change.text;
            const commenterId = change.from?.id;
            const recipientBusinessId = entry.id;

            const { data: account } = await supabase
                .from('instagram_accounts')
                .select('*')
                .eq('instagram_business_id', recipientBusinessId)
                .single();

            if (!account) return res.sendStatus(200);

            const { data: campaign } = await supabase
                .from('automations')
                .select('*')
                .eq('account_id', account.id)
                .ilike('keyword', commentText.trim())
                .eq('is_active', true)
                .single();

            if (campaign) {
                const gatewayUrl = `https://flowdm.in/gate?lead=${commenterId}&campaign=${campaign.id}`;

                await axios.post(`https://graph.facebook.com/v19.0/me/messages`, {
                    recipient: { id: commenterId },
                    message: { text: `${campaign.reply_dm_text}\n\nAccess Link: ${gatewayUrl}` }
                }, {
                    headers: { Authorization: `Bearer ${account.access_token}` }
                });

                if (aiModel) {
                    await aiModel.generateContent(`Reply to comment "${commentText}" in 3 words in Hinglish encouraging them to check DM.`);
                }

                await supabase.from('leads').insert({
                    automation_id: campaign.id,
                    commenter_insta_id: commenterId,
                    comment_text: commentText,
                    gateway_link: gatewayUrl,
                    status: 'SENT'
                });
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
        console.error("Webhook Execution Error:", err.message);
        res.status(200).send('EVENT_RECEIVED');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 FlowDM SaaS Engine running on port ${PORT}`));