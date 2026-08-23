const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

console.log("الخادم يعمل ومستعد لالتقاط الحذف على جميع المستويات...");

// 1. التسمع المباشر إذا كانت الرسائل في المسار الرئيسي
db.ref("chats").on("child_removed", (snapshot) => {
  console.log("تم التقاط حذف مباشر من chats:", snapshot.key);
  saveToDeleted(snapshot.key, snapshot.val());
});

// 2. التسمع الديناميكي داخل كل محادثة فرعية (chats -> chatId -> messages أو chats -> chatId)
db.ref("chats").on("child_added", (chatSnapshot) => {
  const chatId = chatSnapshot.key;
  
  // التسمع داخل كل محادثة
  db.ref(`chats/${chatId}`).on("child_removed", (snapshot) => {
    console.log(`تم حذف عنصر من المحادثة ${chatId}:`, snapshot.key);
    saveToDeleted(snapshot.key, snapshot.val(), chatId);
  });

  // التسمع إذا كانت الرسائل داخل فرع messages
  db.ref(`chats/${chatId}/messages`).on("child_removed", (snapshot) => {
    console.log(`تم حذف رسالة من chats/${chatId}/messages:`, snapshot.key);
    saveToDeleted(snapshot.key, snapshot.val(), chatId);
  });
});

// دالة أرشفة الرسائل المحذوفة
async function saveToDeleted(messageId, data, chatId = "") {
  if (!data) return;
  try {
    await db.ref(`deleted_messages/${messageId}`).set({
      message_id: messageId,
      content: data.content || data.text || data.message || (typeof data === 'string' ? data : JSON.stringify(data)),
      sender_id: data.sender_id || data.senderId || data.sender || "",
      chat_id: chatId || data.chat_id || data.chatId || "",
      original_data: data,
      deleted_at: new Date().toISOString()
    });
    console.log(`[SUCCESS] تم حفظ الرسالة المحذوفة بنجاح: ${messageId}`);
  } catch (error) {
    console.error("[ERROR] فشل الحفظ في deleted_messages:", error);
  }
}
