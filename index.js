const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
require("dotenv").config();  

const openai = new OpenAI({
  apiKey: process.env.API_KEY,  
});
const app = express();

const prompt = "can a chicken live here based on the county, hoa restrictions, and the covenants, or anythign else? I really want you to determine yes or no, always start your response with yes or now, here is some info about where live:";

app.use(cors({
  origin: 'http://localhost:4001',  
  methods: ['GET', 'POST'], 
  allowedHeaders: ['Content-Type']  
}));

app.use(express.json());   

app.use((req, res, next) => {
  console.log("Incoming request path:", req.path);
  next();   
});

app.post("/message/:id", (req, res) => {
  console.log("Request body:", req.body);
  console.log("Request Path:", req.path);
  console.log("Sending request to OpenAI with message:", req.body.message);

  const { message } = req.body;
  const newPrompt = prompt + message.content;

  // Ensure the message content is provided
  if (!message || !message.content) {
    return res.status(400).send({ error: "Message content is required" });
  }

  // If the ID is "new", ignore it and just interact with OpenAI
  if (req.params.id === "new") {
    openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use correct model name
      messages: [{ role: "user", content: prompt }],
    })
      .then((data) => {
        console.log("OpenAI Response:", data);
        res.send({
          message: data.choices[0].message.content,
        });
      })
      .catch((error) => {
        console.error("Error with OpenAI request:", error);
        res.status(500).send({ error: "OpenAI request failed" });
      });
  } else {
    // If an invalid ID is provided, return an error
    return res.status(400).send({ error: "Invalid conversation ID" });
  }
});

// Start server
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000 !");
});
