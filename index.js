const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

console.log("=== السيرفر يعمل بنجاح ومستعد لالتقاط حذف الرسائل ===");

// التسمع داخل كل محادثة فرعية تحت Chats
db.ref("Chats").on("child_added", (chatSnapshot) => {
  const chatId = chatSnapshot.key;
  
  // 1. التسمع في حال حُذفت رسالة من داخل Chats/CHAT_ID مباشرة
  db.ref(`Chats/${chatId}`).on("child_removed", (snapshot) => {
    console.log(`🔥 تم حذف عنصر من المحادثة [${chatId}]:`, snapshot.key);
    saveDeleted(snapshot.key, snapshot.val(), chatId);
  });

  // 2. التسمع في حال كانت الرسائل داخل Chats/CHAT_ID/messages
  db.ref(`Chats/${chatId}/messages`).on("child_removed", (snapshot) => {
    console.log(`🔥 تم حذف رسالة من [Chats/${chatId}/messages]:`, snapshot.key);
    saveDeleted(snapshot.key, snapshot.val(), chatId);
  });
});

// دالة الحفظ في deleted_messages
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
