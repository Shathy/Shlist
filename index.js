const admin = require("firebase-admin");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 8080;

// Healthcheck
app.get("/", (req, res) => res.status(200).send("OK"));

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Express Server active on port ${PORT}`);
});

process.on("uncaughtException", (err) => console.error("Uncaught Error:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled Rejection:", err));
process.on("SIGTERM", () => {
  console.log("Shutting down...");
  server.close(() => {
    admin.app().delete().then(() => process.exit(0));
  });
});

// تهيئة Firebase
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
  console.log("✅ Firebase Connected");
} catch (error) {
  console.error("❌ Firebase Auth Error:", error.message);
  process.exit(1);
}

const db = admin.database();
const listeners = new Map();

// التقاط إضافة محادثة
db.ref("Chats").on("child_added", (chatSnapshot) => {
  const chatId = chatSnapshot.key;
  const messagesRef = db.ref(`Chats/${chatId}/messages`);

  const onRemoved = (snap) => saveDeleted(snap.key, snap.val(), chatId);
  messagesRef.on("child_removed", onRemoved);
  listeners.set(chatId, { ref: messagesRef, callback: onRemoved });
});

// التقاط حذف محادثة كاملة
db.ref("Chats").on("child_removed", (chatSnapshot) => {
  const chatId = chatSnapshot.key;
  if (listeners.has(chatId)) {
    const { ref, callback } = listeners.get(chatId);
    ref.off("child_removed", callback);
    listeners.delete(chatId);
  }
  saveDeleted(chatId, chatSnapshot.val(), chatId);
});

async function saveDeleted(messageId, data, chatId) {
  if (!data) return;
  const compositeKey = `${chatId}_${messageId}`;
  const content = extractContent(data);
  try {
    await db.ref(`deleted_messages/${compositeKey}`).set({
      message_id: messageId,
      chat_id: chatId || "",
      content,
      sender_id: data.sender_id || data.senderId || "",
      original_data: data,
      deleted_at: new Date().toISOString(),
    });
    console.log(`✅ Saved deleted message: ${compositeKey}`);
  } catch (err) {
    console.error("❌ Save Error:", err.message);
  }
}

function extractContent(data) {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return null;
  return data.content || data.text || data.message || data.body || JSON.stringify(data);
}