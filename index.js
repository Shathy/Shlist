const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

// طباعة للتأكد عند التشغيل
console.log("الخادم يعمل ومستعد لالتقاط الحذف...");

// 1. إذا كانت الرسائل في مسار "messages" مباشرة:
// const messagesRef = db.ref("messages");

// 2. إذا كانت الرسائل داخل كل محادثة (chats/CHAT_ID/messages):
const messagesRef = db.ref("chats");

// الاستماع لأي حذف يحدث على مستوى الفرع
messagesRef.on("child_removed", async (snapshot) => {
  console.log("تم اكتشاف عملية حذف على المفتاح:", snapshot.key);
  
  const deletedData = snapshot.val();
  const messageId = snapshot.key;

  if (deletedData) {
    try {
      await db.ref(`deleted_messages/${messageId}`).set({
        message_id: messageId,
        content: deletedData.content || deletedData.text || deletedData.message || "",
        sender_id: deletedData.sender_id || deletedData.senderId || deletedData.sender || "",
        chat_id: deletedData.chat_id || deletedData.chatId || "",
        original_timestamp: deletedData.timestamp || deletedData.time || null,
        deleted_at: new Date().toISOString()
      });
      console.log(`تم حفظ الرسالة المحذوفة بنجاح في deleted_messages: ${messageId}`);
    } catch (error) {
      console.error("خطأ أثناء حفظ البيانات المحذوفة:", error);
    }
  }
});
