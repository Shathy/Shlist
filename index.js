const admin = require("firebase-admin");

// التقاط الأخطاء لمنع الانهيار
process.on("uncaughtException", (err) => console.error("Uncaught Error:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled Rejection:", err));

// تهيئة Firebase
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  console.log("✅ Firebase Connected Successfully");
} catch (error) {
  console.error("❌ Firebase Auth Error:", error.message);
}

const db = admin.database();

console.log("=== السيرفر يعمل كمستمع خلفي دائم ومستعد لالتقاط الحذف ===");

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

// 💥 السر هنا: منع Node.js من إنهاء العملية وإبقاء الـ Event Loop نشطاً للأبد
setInterval(() => {
  // Keep-alive heartbeat
}, 1000 * 60 * 60);
