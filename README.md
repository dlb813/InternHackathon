# ReSnap 📸

ReSnap helps you identify, price, and resell your unused items using real marketplace data.

---

## 🚀 Setup Instructions

### 1. Clone the Repository

Clone both the frontend (`ReSnap`) and backend (`proxy`) folders:

```sh
git clone https://github.com/dlb813/InternHackathon.git
cd InternHackathon
```

---

### 2. Create Azure AI Foundry Project

- Go to [Azure AI Studio](https://ai.azure.com/) and create a new project.
- Deploy a **GPT-4o** (or GPT-4) model.
- Get your **Azure OpenAI Endpoint** and **API Key** from the Azure portal.

---

### 3. Create an eBay Developer Account

- Go to [eBay Developer Program](https://developer.ebay.com/) and sign up.
- Create an application to get your **Client ID** and **Client Secret**.

---

### 4. Create a `.env` File for the Proxy Server

In the `proxy` folder, create a file named `.env` and fill in your credentials:

```env
AZURE_OPENAI_ENDPOINT=https://YOUR_AZURE_RESOURCE_NAME.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-openai-api-key

EBAY_CLIENT_ID=your-ebay-client-id
EBAY_CLIENT_SECRET=your-ebay-client-secret
```

---

### 5. Install Dependencies

#### Frontend

```sh
cd ReSnap
npm install
```

#### Backend (Proxy)

```sh
cd ../proxy
npm install
```

---

### 6. Run the App

#### Start the Proxy Server

```sh
cd proxy
node proxy-server.js
```

#### Start the Frontend

```sh
cd ../ReSnap
npm run dev
```

---

### 7. Using the App

- Open your browser and go to the URL shown by the frontend (usually `http://localhost:5173` or similar).
- Use the search bar or upload an image to identify and price your item.
- The app will suggest whether to sell or donate, and show real eBay price ranges.

---

## 📝 Notes

- **Never commit your `.env` file or API keys to GitHub.**
- Make sure your `.env` is listed in `.gitignore`.
- If you change your API keys, restart the proxy server.

---

## 📄 Example `.env`

```env
AZURE_OPENAI_ENDPOINT=https://dlbyrd813-8618-resource.cognitiveservices.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview
AZURE_OPENAI_API_KEY=your-azure-openai-api-key

EBAY_CLIENT_ID=your-ebay-client-id
EBAY_CLIENT_SECRET=your-ebay-client-secret
```

---

## 💡 Need Help?

- [Azure OpenAI Docs](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [eBay Developer Docs](https://developer.ebay.com/api-docs/static/oauth-client-credentials-grant.html)
- Or open an issue in
