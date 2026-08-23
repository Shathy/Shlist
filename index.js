const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();
const messagesRef = db.ref("chats");

console.log("الخادم يعمل ومستعد لالتقاط الحذف...");

messagesRef.on("child_removed", async (snapshot) => {
  const deletedData = snapshot.val();
  const messageId = snapshot.key;

  if (deletedData) {
    try {
      await db.ref(`deleted_messages/${messageId}`).set({
        message_id: messageId,
        content: deletedData.content || deletedData.text || "",
        sender_id: deletedData.sender_id || deletedData.senderId || "",
        chat_id: deletedData.chat_id || "",
        original_timestamp: deletedData.timestamp || null,
        deleted_at: new Date().toISOString()
      });
      console.log(`تم حفظ الرسالة المحذوفة: ${messageId}`);
    } catch (error) {
      console.error("خطأ أثناء الحفظ:", error);
    }
  }
});
