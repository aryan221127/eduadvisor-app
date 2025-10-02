require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Add this console.log to check if the key is loaded
console.log("GEMINI_API_KEY loaded:", process.env.GEMINI_API_KEY ? "Found" : "Not Found");

// --- API Endpoints ---

// Gemini API Integration for Recommendations
app.post('/api/recommendations', async (req, res) => {
    const { interests } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; // Get API key from environment variable

    // Check if the API key is available
    if (!apiKey) {
        console.error("GEMINI_API_KEY is not set in the .env file.");
        return res.status(500).json({ error: "Server configuration error: Missing API key for the AI service." });
    }

    if (!interests || typeof interests !== 'string' || interests.trim() === '') {
        return res.status(400).json({ error: 'Interests are required.' });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const systemPrompt = `
    You are an expert career and education advisor. Your goal is to provide personalized recommendations based on a user's interests.
    You MUST respond with a valid JSON object. Do not include any text, explanation, or markdown formatting before or after the JSON object.
    The JSON object should have two keys: "careers" and "hobbies".
    - "careers" should be an array of 2-4 career objects.
    - "hobbies" should be an array of 2-3 hobby objects.

    Each career object must have these keys:
    - "career": The name of the career (string).
    - "studies": An array of 3 specific subjects or fields to study for this career (array of strings).
    - "icon": A string containing only the Font Awesome 6 FREE icon classes (e.g., "fas fa-code").

    Each hobby object must have these keys:
    - "hobby": The name of the hobby (string).
    - "description": A short, encouraging description (string).
    - "icon": A string containing only the Font Awesome 6 FREE icon classes (e.g., "fas fa-camera-retro").

    Example of a valid JSON response:
    {
      "careers": [
        {
          "career": "Software Engineer",
          "studies": ["Computer Science", "Data Structures and Algorithms", "Software Engineering"],
          "icon": "fas fa-code"
        },
        {
          "career": "Web Developer",
          "studies": ["Web Development", "User Interface/Experience (UI/UX) Design", "Front-end and Back-end Technologies"],
          "icon": "fas fa-laptop-code"
        }
      ],
      "hobbies": [
        {
          "hobby": "Photography",
          "description": "Capture and edit photos to enhance your creativity and attention to detail.",
          "icon": "fas fa-camera-retro"
        }
      ]
    }
    `;

    const payload = {
        contents: [{
            parts: [{ text: `User interests: ${interests}` }]
        }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            responseMimeType: "application/json",
        }
    };

    try {
        const geminiResponse = await axios.post(apiUrl, payload, { timeout: 15000 }); // 15 second timeout
        const candidate = geminiResponse.data.candidates?.[0];
        const rawText = candidate?.content?.parts?.[0]?.text;

        if (!rawText) {
            console.error("Gemini API returned an empty or invalid response structure:", geminiResponse.data);
            throw new Error("The AI returned an empty response.");
        }
        
        // The API should return clean JSON now, so no need to strip markdown
        const recommendations = JSON.parse(rawText);
        res.json(recommendations);

    } catch (error) {
        // Log detailed error information for debugging
        console.error('Error calling Gemini API or parsing response:');
        if (error.response) {
            // Error from Gemini API (e.g., 4xx, 5xx)
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            // Request was made but no response was received (e.g., timeout)
            console.error('Request Error:', error.request);
        } else {
            // Other errors (e.g., JSON parsing error, setup issue)
            console.error('General Error:', error.message);
        }
        res.status(500).json({ error: 'Failed to get recommendations from the AI. Please try again later.' });
    }
});

// Gemini API Integration for Chatbot
app.post('/api/chat', async (req, res) => {
    const { history } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Server configuration error." });
    }
    if (!history) {
        return res.status(400).json({ error: 'Chat history is required.' });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const systemPrompt = "You are Eva, a friendly and encouraging AI career counselor for the EduAdvisor.Ai website. Keep your responses concise, helpful, and supportive. Do not use markdown formatting.";
    
    // Construct the full conversation for the API
    const contents = [
        ...history.map(item => ({
            role: item.role,
            parts: item.parts
        }))
    ];

    const payload = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        }
    };

    try {
        const geminiResponse = await axios.post(apiUrl, payload);
        const message = geminiResponse.data.candidates[0].content.parts[0].text;
        res.json({ message });
    } catch (error) {
        console.error('Error in chat API:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to get a response from the AI counselor.' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`EduAdvisor server is running at http://localhost:${port}`);
});
