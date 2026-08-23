const admin = require("firebase-admin");
const http = require("http");

// 1. التقاط جميع الأخطاء غير المتوقعة لمنع انهيار الحاوية
process.on("uncaughtException", (err) => {
  console.error("🔥 uncaughtException Error:", err.message);
  console.error(err.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 unhandledRejection Error:", reason);
});

// 2. استخدام المنفذ الممرر من Railway ديناميكياً مع الربط بـ 0.0.0.0
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ HTTP Server listening on 0.0.0.0:${PORT}`);
});

// 3. تهيئة Firebase Admin SDK
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });

  console.log("✅ Firebase initialized successfully");
} catch (error) {
  console.error("❌ Firebase Initialization Error:", error.message);
}

const db = admin.database();

console.log("=== السيرفر يعمل بنجاح ومستعد لالتقاط حذف الرسائل ===");

// 4. التسمع داخل كل محادثة فرعية تحت Chats
try {
  db.ref("Chats").on("child_added", (chatSnapshot) => {
    const chatId = chatSnapshot.key;
    
    // التسمع داخل Chats/CHAT_ID
    db.ref(`Chats/${chatId}`).on("child_removed", (snapshot) => {
      console.log(`🔥 تم حذف عنصر من المحادثة [${chatId}]:`, snapshot.key);
      saveDeleted(snapshot.key, snapshot.val(), chatId);
    });

    // التسمع داخل Chats/CHAT_ID/messages
    db.ref(`Chats/${chatId}/messages`).on("child_removed", (snapshot) => {
      console.log(`🔥 تم حذف رسالة من [Chats/${chatId}/messages]:`, snapshot.key);
      saveDeleted(snapshot.key, snapshot.val(), chatId);
    });
  });
} catch (err) {
  console.error("❌ Error setting up Realtime listeners:", err.message);
}

// دالة الحفظ
async function saveDeleted(messageId, data, chatId) {
  if (!data) return;
  try {
    await db.ref(`deleted_messages/${messageId}`).set({
      message_id: messageId,
      chat_id: chatId || "",
      content: data.content || data.text || data.message || (typeof data === 'object' ? JSON.stringify(data) : data),
      sender_id: data.sender_id || data.senderId || data.sender || "",
      original_data: data,
      deleted_at: new Date().toISOString()
    });
    console.log(`✅ تم حفظ الرسالة المحذوفة بنجاح: ${messageId}`);
  } catch (error) {
    console.error("❌ خطأ أثناء الحفظ:", error);
  }
}
