const admin = require("firebase-admin");
const http = require("http");

// التقاط الأخطاء لمنع انهيار التطبيق
process.on("uncaughtException", (err) => console.error("Uncaught Error:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled Rejection:", err));

// الاستماع على المنفذ الممرر من Railway أو 8080 افتراضياً
const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server is live and bound to port ${PORT}`);
});

// تهيئة Firebase
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  console.log("✅ Firebase Connected");
} catch (e) {
  console.error("❌ Firebase Auth Error:", e.message);
}

const db = admin.database();

// التسمع على Chats
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
    console.log(`✅ Message Saved: ${messageId}`);
  } catch (err) {
    console.error("❌ Save Error:", err);
  }
}
