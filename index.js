const admin = require("firebase-admin");
const express = require("express");

const app = express();

// إجبار الخادم على استخدام منفذ Railway الديناميكي أولاً
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Express Server running on port ${PORT}`);
});

// تهيئة Firebase
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  console.log("✅ Firebase Connected Successfully");
} catch (error) {
  console.error("❌ Firebase Config Error:", error.message);
}

const db = admin.database();

// التسمع على الحذف
db.ref("Chats").on("child_added", (chatSnapshot) => {
  const chatId = chatSnapshot.key;

  db.ref(`Chats/${chatId}`).on("child_removed", (snapshot) => {
    saveDeleted(snapshot.key, snapshot.val(), chatId);
  });

  db.ref(`Chats/${chatId}/messages`).on("child_removed", (snapshot) => {
    saveDeleted(snapshot.key, snapshot.val(), chatId);
  });
});

async function saveDeleted(messageId, data, chatId) {
  if (!data) return;
  try {
    await db.ref(`deleted_messages/${messageId}`).set({
      message_id: messageId,
      chat_id: chatId || "",
      content: data.content || data.text || data.message || (typeof data === 'object' ? JSON.stringify(data) : data),
      sender_id: data.sender_id || data.senderId || "",
      original_data: data,
      deleted_at: new Date().toISOString()
    });
    console.log(`✅ Saved deleted message: ${messageId}`);
  } catch (err) {
    console.error("❌ Save Error:", err.message);
  }
}
