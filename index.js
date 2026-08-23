const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

console.log("=== السيرفر يعمل بنجاح ومستعد لالتقاط أي عملية حذف ===");

// 1. الاستماع لكافة الفروع الرئيسية تحت الجذر مباشرة
db.ref().on("child_added", (parentSnapshot) => {
  const parentKey = parentSnapshot.key;
  
  // تجنب التسمع على المجلد الذي نحفظ فيه المحذوفات حتى لا ندخل في حلقة تكرارية
  if (parentKey === "deleted_messages") return;

  console.log(`تم بدء المراقبة على الفرع الرئيسي: ${parentKey}`);

  // التسمع على الحذف داخل هذا الفرع الرئيسي
  db.ref(parentKey).on("child_removed", (snapshot) => {
    console.log(`🔥 تم التقاط حذف من الفرع [${parentKey}]:`, snapshot.key);
    saveDeleted(snapshot.key, snapshot.val(), parentKey);
  });

  // التسمع على الحذف العميق (المستوى الثالث: chats -> chatId -> messageId)
  db.ref(parentKey).on("child_added", (childSnapshot) => {
    const childKey = childSnapshot.key;
    db.ref(`${parentKey}/${childKey}`).on("child_removed", (subSnapshot) => {
      console.log(`🔥 تم التقاط حذف عميق من [${parentKey}/${childKey}]:`, subSnapshot.key);
      saveDeleted(subSnapshot.key, subSnapshot.val(), `${parentKey}/${childKey}`);
    });
  });
});

// دالة أرشفة البيانات المحذوفة
async function saveDeleted(messageId, data, path) {
  if (!data) return;
  try {
    await db.ref(`deleted_messages/${messageId}`).set({
      message_id: messageId,
      path_source: path,
      content: data.content || data.text || data.message || (typeof data === 'object' ? JSON.stringify(data) : data),
      sender_id: data.sender_id || data.senderId || data.sender || "",
      original_data: data,
      deleted_at: new Date().toISOString()
    });
    console.log(`✅ [نجاح] تم حفظ البيانات المحذوفة في deleted_messages للمفتاح: ${messageId}`);
  } catch (error) {
    console.error("❌ [خطأ] فشل الحفظ في deleted_messages:", error);
  }
}
