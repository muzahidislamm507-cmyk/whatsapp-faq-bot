const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const stringSimilarity = require("string-similarity");
const twilio = require("twilio");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// ---- Load FAQ data ----
function loadFaqs() {
  const raw = fs.readFileSync(path.join(__dirname, "faqs.json"), "utf-8");
  return JSON.parse(raw);
}

// ---- Find best matching FAQ answer for a given message ----
function findAnswer(userMessage) {
  const faqs = loadFaqs();
  const msg = userMessage.toLowerCase().trim();

  // 1) Direct keyword match (fast + reliable)
  for (const faq of faqs) {
    for (const kw of faq.keywords) {
      if (msg.includes(kw.toLowerCase())) {
        return faq.answer;
      }
    }
  }

  // 2) Fuzzy match against the question text (catches typos / rephrasing)
  const questions = faqs.map((f) => f.question.toLowerCase());
  const { bestMatch, bestMatchIndex } = stringSimilarity.findBestMatch(
    msg,
    questions
  );

  if (bestMatch.rating >= 0.35) {
    return faqs[bestMatchIndex].answer;
  }

  // 3) No good match found
  return null;
}

// ---- Twilio webhook endpoint ----
// Set this URL (e.g. https://your-app.onrender.com/whatsapp) as the
// "WHEN A MESSAGE COMES IN" webhook in your Twilio WhatsApp Sandbox settings.
app.post("/whatsapp", (req, res) => {
  const incomingMsg = req.body.Body || "";
  const from = req.body.From || "unknown";

  console.log(`Message from ${from}: ${incomingMsg}`);

  const answer = findAnswer(incomingMsg);

  const twiml = new twilio.twiml.MessagingResponse();

  if (answer) {
    twiml.message(answer);
  } else {
    twiml.message(
      "Sorry, I couldn't find an answer to that. Type 'agent' to talk to a human, or try rephrasing your question."
    );
  }

  res.type("text/xml").send(twiml.toString());
});

// ---- Health check (useful for hosting platforms) ----
app.get("/", (req, res) => {
  res.send("WhatsApp FAQ bot is running.");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
