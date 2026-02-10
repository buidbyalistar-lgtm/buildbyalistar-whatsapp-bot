const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// --------------------
// 1) Verify webhook (GET)
// --------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// --------------------
// Helpers
// --------------------
async function sendWhatsAppText(to, text) {
  const url = `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    }),
  });

  const data = await resp.json();
  if (!resp.ok) console.error("❌ WhatsApp send error:", data);
  else console.log("✅ Sent WhatsApp reply:", data);
}

function normalize(text) {
  return (text || "").toLowerCase().trim();
}

// Your Packages/Menu message (same as SYSTEM_PROMPT “Packages block”)
function packagesMessage() {
  return (
`✅ *BuildByAlistar Services*
1) *WhatsApp AI Chatbot*
   - FAQ + Lead capture + Human handover
   - Setup: ₹9,999 (or $199)
   - Monthly: ₹2,999 (or $49)

2) *Website + Automation*
   - Landing page + forms + CRM + follow-ups
   - Setup: ₹14,999 (or $299)
   - Monthly: ₹3,999 (or $69)

3) *Custom Automation*
   - Any workflow (Sheets/CRM, reminders, bookings, integrations)
   - Quote after requirements

👉 Type:
*demo* = book a call
*pricing* = packages
*support* = help`
  );
}

// Tiny lead-capture prompt
function leadQuestions() {
  return (
`Quick 3 questions so I can guide you perfectly:
1) Your name?
2) Your business type?
3) What do you want to automate? (leads / support / booking / ecommerce)`
  );
}

// Simple intent checks
function isPricingIntent(t) {
  return (
    t.includes("price") ||
    t.includes("pricing") ||
    t.includes("package") ||
    t.includes("plans") ||
    t.includes("services") ||
    t.includes("service") ||
    t.includes("menu")
  );
}

function isDemoIntent(t) {
  return t.includes("demo") || t.includes("call") || t.includes("meeting") || t.includes("book");
}

function isSupportIntent(t) {
  return t.includes("support") || t.includes("help") || t.includes("issue") || t.includes("problem");
}

// Ask Grok (xAI OpenAI-compatible)
async function askGrok(userText) {
  const systemPrompt =
    process.env.SYSTEM_PROMPT ||
    "You are BuildByAlistar Assistant. Be concise and helpful.";

  const model = process.env.XAI_MODEL || "grok-2-latest";

  const resp = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      temperature: 0.4,
    }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    console.error("❌ xAI error:", data);
    return "Sorry—AI is having an issue right now. Please try again in a minute.";
  }

  return data?.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a reply.";
}

// --------------------
// 2) Receive messages (POST)
// --------------------
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from; // user wa_id
    const userText = message?.text?.body;

    // If not a text message:
    if (!userText) {
      await sendWhatsAppText(from, "Send me a text message 🙂 I’ll help you.");
      return res.sendStatus(200);
    }

    const t = normalize(userText);

    // ✅ Command-style responses (fast + consistent)
    if (isPricingIntent(t)) {
      await sendWhatsAppText(from, packagesMessage());
      await sendWhatsAppText(from, leadQuestions());
      return res.sendStatus(200);
    }

    if (isDemoIntent(t)) {
      await sendWhatsAppText(
        from,
        "Awesome ✅ Send your preferred day/time + your city, and I’ll schedule a demo call."
      );
      await sendWhatsAppText(from, leadQuestions());
      return res.sendStatus(200);
    }

    if (isSupportIntent(t)) {
      await sendWhatsAppText(
        from,
        "Sure ✅ Tell me what you need help with (WhatsApp bot / website / automation) and what problem you’re facing."
      );
      return res.sendStatus(200);
    }

    // 🤖 Otherwise: AI reply, but still business-focused
    const aiReply = await askGrok(userText);
    await sendWhatsAppText(from, aiReply);

    // Optional: add a soft CTA occasionally
    if (t.length < 40) {
      await sendWhatsAppText(from, "Type *pricing* to see packages or *demo* to book a call.");
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error in webhook:", err);
    return res.sendStatus(200);
  }
});

// Test route
app.get("/", (req, res) => res.send("Bot running"));

// Start server LAST
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Server started on port", PORT));