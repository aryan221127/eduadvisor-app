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
console.log("GEMINI_API_KEY loaded:", process.env.GEMINI_API_KEY);

// --- Gemini API Integration ---
app.post('/api/recommendations', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY; // Get API key from environment variable
    const { interests } = req.body;

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
        The JSON object must have two properties: "careers" and "hobbies".

        1. "careers": This must be an array of exactly 2 career objects.
           Each career object must have the following properties:
           - "career": (string) The name of the career.
           - "icon": (string) The Font Awesome icon name for this career (e.g., "fas fa-code", "fas fa-paint-brush").
           - "studies": (array of strings) A list of 3-4 recommended subjects or fields of study for this career.

        2. "hobbies": This must be an array of exactly 2 hobby objects.
           Each hobby object must have the following properties:
           - "hobby": (string) The name of the hobby.
           - "icon": (string) The Font Awesome icon name for this hobby (e.g., "fas fa-book", "fas fa-music").
           - "description": (string) A brief description of the hobby.

        Example of a valid response format:
        {
          "careers": [
            {
              "career": "Software Engineer",
              "icon": "fas fa-code",
              "studies": ["Computer Science", "Software Engineering", "Data Structures and Algorithms"]
            },
            {
              "career": "Graphic Designer",
              "icon": "fas fa-paint-brush",
              "studies": ["Visual Arts", "Digital Media", "Typography", "UI/UX Design"]
            }
          ],
          "hobbies": [
            {
              "hobby": "Creative Writing",
              "icon": "fas fa-pen-nib",
              "description": "Explore storytelling and express your ideas through writing."
            },
            {
              "hobby": "Play a Musical Instrument",
              "icon": "fas fa-guitar",
              "description": "Learn to play an instrument to enhance creativity and discipline."
            }
          ]
        }
    `;

    const payload = {
        contents: [{
            parts: [{ text: `User's interests: ${interests}` }]
        }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            responseMimeType: "application/json",
        }
    };

    try {
        const apiResponse = await axios.post(apiUrl, payload);
        // The Gemini API (with JSON mode) returns the JSON directly in the 'text' field.
        // It's already a parsed object if responseMimeType is set.
        const responseData = apiResponse.data.candidates[0].content.parts[0].text;
        
        // Even with JSON mode, the API sometimes wraps the response in markdown. Let's clean it.
        const cleanedData = responseData.replace(/```json/g, '').replace(/```/g, '').trim();

        // Parse the cleaned string into a JSON object
        const jsonData = JSON.parse(cleanedData);

        // Basic validation to ensure the structure is correct before sending to the client
        if (!jsonData || !Array.isArray(jsonData.careers) || !Array.isArray(jsonData.hobbies)) {
             throw new Error("Invalid JSON structure received from AI.");
        }

        res.json(jsonData);
    } catch (error) {
        console.error("Error calling Gemini API:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to get recommendations from the AI. Please try again later." });
    }
});


app.post('/api/chat', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const { history } = req.body;

    if (!apiKey) {
        return res.status(500).json({ error: "Server configuration error." });
    }
    if (!history) {
        return res.status(400).json({ error: 'Chat history is required.' });
    }
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const systemPrompt = `
        You are Eva, a friendly and knowledgeable AI career counselor for a website called EduAdvisor.Ai.
        Your tone should be encouraging, helpful, and professional, but not overly robotic.
        Keep your answers concise and easy to read, ideally in 2-4 sentences.
        Your primary goal is to answer user questions about careers, skills, education paths, and job searching.
        If a user asks something outside of this scope, gently guide them back to career-related topics.
        Do not answer questions about your own nature as an AI or about programming.
    `;
    
    const payload = {
        contents: history,
         systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };
    
    try {
        const apiResponse = await axios.post(apiUrl, payload);
        const message = apiResponse.data.candidates[0].content.parts[0].text;
        res.json({ message });
    } catch (error) {
        console.error("Error calling Gemini Chat API:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to get a response from the AI." });
    }
});


app.listen(port, '0.0.0.0', () => {
    console.log(`EduAdvisor server is running at http://localhost:${port}`);
});

