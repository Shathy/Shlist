const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

console.log("الخادم يعمل ومستعد لالتقاط جميع التغييرات والحذف...");

// التسمع الشامل على مستوى قاعدة البيانات أو مسار المحادثات
const rootRef = db.ref();

// 1. مراقبة الحذف المباشر (child_removed) في أي مكان تحت chats
db.ref("chats").on("child_removed", async (snapshot) => {
  console.log("تم حذف عنصر مباشر من chats:", snapshot.key);
  saveDeleted(snapshot.key, snapshot.val());
});

// 2. مراقبة التعديلات (في حال كان الحذف يغير قيمة isDeleted أو النص)
db.ref("chats").on("child_changed", async (snapshot) => {
  const data = snapshot.val();
  console.log("حدث تعديل في chats على المفتاح:", snapshot.key);
  
  // إذا كان التطبيق يوسم الرسالة كمحذوفة عند التعديل
  if (data && (data.isDeleted === true || data.deleted === true || data.text === "تم حذف هذه الرسالة")) {
    saveDeleted(snapshot.key, data);
  }
});

// دالة حفظ الرسالة في deleted_messages
async function saveDeleted(messageId, data) {
  if (!data) return;
  try {
    await db.ref(`deleted_messages/${messageId}`).set({
      message_id: messageId,
      content: data.content || data.text || data.message || "",
      sender_id: data.sender_id || data.senderId || data.sender || "",
      chat_id: data.chat_id || data.chatId || "",
      original_timestamp: data.timestamp || data.time || null,
      deleted_at: new Date().toISOString()
    });
    console.log(`[SUCCESS] تم حفظ الرسالة المحذوفة: ${messageId}`);
  } catch (err) {
    console.error("[ERROR] فشل الحفظ في deleted_messages:", err);
  }
}
