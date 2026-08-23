const admin = require("firebase-admin");
const http = require("http");

// 1. إنشاء سيرفر وهمي لإبقاء Railway متصلًا وناجحًا في الفحص (Health Check)
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Firebase Listener is Running Smoothly!");
}).listen(PORT, () => {
  console.log(`HTTP Server listening on port ${PORT}`);
});

// 2. تهيئة Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

console.log("=== السيرفر يعمل بنجاح ومستعد لالتقاط حذف الرسائل ===");

// 3. التسمع على مسار المحادثات Chats
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
