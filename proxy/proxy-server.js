require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const { AzureOpenAI } = require("openai");
const axios = require('axios');
const apiVersion = "2024-04-01-preview";
const modelName = "gpt-4o";
const deployment = "gpt-4o";
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const options = { endpoint, apiKey, deployment, apiVersion }

const client = new AzureOpenAI(options);

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());
app.use(express.json());

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;


// Analyze uploaded image file with Azure OpenAI GPT-4o
app.post('/caption', upload.single('image'), async (req, res) => {
    try {
        console.log("got a request");
        const imagePath = req.file.path;
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        fs.unlinkSync(imagePath);

        const messages = [
            { role: "system", content: "You are a helpful assistant and expert product identifier. Describe exactly what the subject item in this image is, down to the brand (if applicable). Keep descriptions down to a single phrase specifying what an item is (ex. Ikea Gunde chair). If you don't know exactly what an item is, keep the description down to what you know (ex. black folding chair). If you have no idea what an item is, return 'unknown item'." },
            {
                role: "user",
                content: [
                    { type: "text", text: "What is this? Give a specific product name or brand if possible." },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                ]
            }
        ];

        const response = await client.chat.completions.create({
            messages: [
                { role: "system", content: messages[0].content },
                { role: "user", content: messages[1].content }
            ],
            max_tokens: 4096,
            temperature: 0,
            top_p: 1,
            model: modelName
        });

        if (response.choices && response.choices[0]?.message?.content) {
            res.json({ caption: response.choices[0].message.content });
        } else {
            res.status(500).json({ error: "No caption returned." });
        }
    } catch (err) {
        console.error('Proxy error:', err.response?.data || err);
        res.status(500).json({ error: err.message });
    }
});

// Get eBay application access token
async function getEbayAccessToken() {
    const credentials = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'https://api.ebay.com/oauth/api_scope');

    const response = await axios.post(
        'https://api.ebay.com/identity/v1/oauth2/token',
        params,
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
            }
        }
    );
    return response.data.access_token;
}
// Test function to generate an eBay access token on startup
async function testEbayToken() {
    try {
        const token = await getEbayAccessToken();
        console.log("✅ Successfully generated eBay access token (first 20 chars):", token.slice(0, 20) + "...");
    } catch (err) {
        console.error("❌ Failed to generate eBay access token:", err.response?.data || err.message);
    }
}

testEbayToken();

app.post('/ebay-search', async (req, res) => {
    try {
        const { searchTerm, condition } = req.body;
        if (!searchTerm || !condition) {
            return res.status(400).json({ error: "Missing searchTerm or condition in request body." });
        }
        
        const conditionIdMap = {
            "New": [1000],
            "Open box": [1500],
            "Used": [3000, 3010, 4000, 5000],
            "Broken": [6000],
            "For parts or not working": [7000]
        };
        // Default to Used if not found
        const ebayConditionIds = conditionIdMap[condition] || [3000, 3010, 4000, 5000];

        const token = await getEbayAccessToken();

        const response = await axios.get(
            'https://api.ebay.com/buy/browse/v1/item_summary/search',
            {
                params: {
                    q: searchTerm,
                    limit: 10,
                    filter: `buyingOptions:{FIXED_PRICE},conditionIds:{${ebayConditionIds.join('|')}}`
                },
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            }
        );

        // Return only relevant fields for each item
        const items = (response.data.itemSummaries || []).map(item => ({
            title: item.title,
            price: item.price,
            condition: item.condition,
            buyingOptions: item.buyingOptions,
            itemWebUrl: item.itemWebUrl,
            image: item.image?.imageUrl
        }));

        res.json({ items });
    } catch (err) {
        console.error('eBay search error:', err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});