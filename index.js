const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

console.log("الخادم الشامل يعمل ومستعد لالتقاط أي حذف في قاعدة البيانات...");

// التسمع على كل تغيير في الشجرة كاملة
db.ref().on("child_removed", handleDeletion);

// التسمع داخل المستويات الفرعية العمومية
db.ref("chats").on("child_removed", handleDeletion);
db.ref("messages").on("child_removed", handleDeletion);

async function handleDeletion(snapshot) {
  console.log("=== تم التقاط عملية حذف ===");
  console.log("المفتاح (Key):", snapshot.key);
  console.log("البيانات (Val):", snapshot.val());

  const deletedData = snapshot.val();
  const messageId = snapshot.key;

  if (deletedData) {
    try {
      await db.ref(`deleted_messages/${messageId}`).set({
        message_id: messageId,
        content: deletedData.content || deletedData.text || deletedData.message || JSON.stringify(deletedData),
        sender_id: deletedData.sender_id || deletedData.senderId || "",
        chat_id: deletedData.chat_id || "",
        deleted_at: new Date().toISOString()
      });
      console.log(`[نجاح] تم الأرشفة بنجاح للمفتاح: ${messageId}`);
    } catch (err) {
      console.error("[خطأ في الحفظ]:", err);
    }
  }
}
