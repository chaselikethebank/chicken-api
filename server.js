const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const openai = require("openai");
require("dotenv").config(); 

openai.apiKey = process.env.API_KEY;
if (!process.env.API_KEY) {
  console.error("API Key is missing!");
} else {
  console.log("API Key is loaded successfully.");
}

const Message = require("./models/message");
const Conversation = require("./models/conversation");

const app = express();

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

 
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB!");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
  });

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

 app.use(cors({ origin: 'http://localhost:4001' }));

// Post new message or continue conversation 
app.post("/message/:id", (req, res) => {
  console.log("Request body:", req.body); 
  console.log("Request Path:", req.path); 
  console.log("Sending request to OpenAI with message:", req.body.message);
  const { message } = req.body;
  if (!message || !message.content) {
    return res.status(400).send({ error: "Message content is required boiii" });
  }
  if (!req.body.message) {
    res.status(400).send({ error: "Message is required" });
    return;
  }
  
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).send({ error: "Invalid conversation ID" });
    return;
  }

  if (req.params.id === "new") {
    new Conversation().save().then((conversation) => {
      new Message({
        conversation: conversation._id,
        role: "user",
        content: req.body.message.content,
      })
        .save()
        .then(() => {
          console.log("Open AI's response::", req.body.message);
          openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [{
              role: "user",
              content: req.body.message.content,
            }],
          })
            .then((data) => {
              console.log("OpenAI Response:", data);
              new Message({
                conversation: conversation._id,
                role: "assistant",
                content: data.data.choices[0].message.content,
              })
                .save()
                .then(() => {
                  console.log("Assistant's message:", assistantMessage);
                  res.send({
                    message: data.data.choices[0].message.content,
                    conversation: conversation._id,
                  });
                });
            })
            .catch((error) => {
              console.error("Error with OpenAI request:", error);
              res.status(500).send({ error: "OpenAI request failed", error });
            });
        })
        .catch((error) => {
          console.error("Error saving user's message:", error);
          res.status(500).send({ error: "Failed to save user's message" });
        });
    });
  } else {
    Conversation.findById(req.params.id)
      .then((conversation) => {
        Message.find({ conversation: conversation._id })
          .sort({ timestamp: -1 })
          .limit(5)
          .then((messages) => {
            new Message({
              role: "user",
              content: req.body.message.content,
              conversation: conversation._id,
            })
              .save()
              .then(() => {
                openai.createChatCompletion({
                  model: "gpt-3.5-turbo",
                  messages: [
                    ...messages.map((message) => ({
                      content: message.content,
                      role: message.role,
                    })).reverse(),
                    req.body.message,
                  ],
                })
                  .then((data) => {
                    console.log("Assistant Message:", data.data.choices[0].message.content);
                    new Message({
                      role: "assistant",
                      content: data.data.choices[0].message.content,
                      conversation: conversation._id,
                    })
                      .save()
                      .then(() => {
                        res.send({
                          message: data.data.choices[0].message.content,
                        });
                      });
                  })
                  .catch((error) => {
                    console.error("Error with OpenAI request:", error);
                    res.status(500).send({ error: "OpenAI request failed" });
                  });
              })
              .catch((error) => {
                console.error("Error saving user's message:", error);
                res.status(500).send({ error: "Failed to save user's message" });
              });
          })
          .catch((error) => {
            console.error("Error retrieving messages:", error);
            res.status(500).send({ error: "Failed to retrieve messages" });
          });
      })
      .catch((error) => {
        console.error("Error finding conversation:", error);
        res.status(500).send({ error: "Conversation not found" });
      });
  }
});

// Get all messages for a conversation
app.get("/conversation/:id", (req, res) => {
  Conversation.findById(req.params.id)
    .then((conversation) => {
      Message.find({ conversation: conversation._id }).then((messages) => {
        res.send({ messages });
      });
    })
    .catch((error) => {
      console.error("Error finding conversation:", error);
      res.status(500).send({ error: "Conversation not found" });
    });
});

// Delete conversation
app.delete("/conversation/:id", (req, res) => {
  Message.deleteMany({ conversation: req.params.id })
    .then(() => {
      Conversation.findByIdAndDelete(req.params.id).then(() => {
        res.send("Conversation deleted");
      });
    })
    .catch((error) => {
      console.error("Error deleting conversation:", error);
      res.status(500).send({ error: "Failed to delete conversation" });
    });
});

// Start server
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000 !");
});
