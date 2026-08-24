const admin = require("firebase-admin");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== تسجيل الطلبات ====================
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// ==================== تشخيص المنفذ ====================
console.log(`🔧 Environment PORT = ${process.env.PORT}`);
console.log(`🔧 Using PORT = ${PORT}`);

// ==================== مسارات فحص الصحة ====================
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", uptime: process.uptime() });
});

// ==================== إعداد Firebase ====================
if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.FIREBASE_DATABASE_URL) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

let db;

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
  console.log("✅ Firebase Connected Successfully");
  db = admin.database();
} catch (error) {
  console.error("❌ Firebase Auth Error:", error.message);
  process.exit(1);
}

// ==================== بدء خادم Express ====================
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Express Server active on port ${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Exiting...`);
    process.exit(1);
  } else {
    console.error("❌ Server error:", err);
    process.exit(1);
  }
});

// ==================== معالجة الأخطاء العامة ====================
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});

// ==================== إيقاف نظيف ====================
function gracefulShutdown(signal) {
  console.log(`🛑 ${signal} received, shutting down gracefully...`);
  server.close(() => {
    console.log("✅ HTTP server closed");
    admin.app().delete().then(() => {
      console.log("✅ Firebase app deleted");
      process.exit(0);
    }).catch((err) => {
      console.error("❌ Error during Firebase cleanup:", err);
      process.exit(1);
    });
  });

  setTimeout(() => {
    console.error("❌ Forced shutdown after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ==================== إدارة المستمعين ====================
const chatListeners = new Map();

// ==================== دوال مساعدة ====================
function extractContent(data) {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return null;
  return data.content || data.text || data.message || data.body || JSON.stringify(data);
}

async function saveDeletedMessage(messageId, data, chatId, retries = 3) {
  if (!data) return;

  const compositeKey = `${chatId}_${messageId}`;
  const payload = {
    message_id: messageId,
    chat_id: chatId || "",
    content: extractContent(data),
    sender_id: data.sender_id || data.senderId || "",
    original_data: data,
    deleted_at: new Date().toISOString(),
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await db.ref(`deleted_messages/${compositeKey}`).set(payload);
      console.log(`✅ Saved deleted message: ${compositeKey}`);
      return;
    } catch (err) {
      console.error(`❌ Save Error (attempt ${attempt}/${retries}):`, err.message);
      if (attempt === retries) {
        console.error(`❌ Failed to save message after ${retries} attempts: ${compositeKey}`);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}

async function saveDeletedChat(chatId, data, retries = 3) {
  if (!data) return;

  const payload = {
    chat_id: chatId,
    original_data: data,
    deleted_at: new Date().toISOString(),
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await db.ref(`deleted_chats/${chatId}`).set(payload);
      console.log(`✅ Saved deleted chat: ${chatId}`);
      return;
    } catch (err) {
      console.error(`❌ Save Chat Error (attempt ${attempt}/${retries}):`, err.message);
      if (attempt === retries) {
        console.error(`❌ Failed to save chat after ${retries} attempts: ${chatId}`);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}

// ==================== الاستماع لحذف البيانات ====================
db.ref("Chats").on("child_added", (chatSnapshot) => {
  const chatId = chatSnapshot.key;
  const messagesRef = db.ref(`Chats/${chatId}/messages`);

  const onMessageRemoved = (snapshot) => {
    saveDeletedMessage(snapshot.key, snapshot.val(), chatId);
  };

  messagesRef.on("child_removed", onMessageRemoved);
  chatListeners.set(chatId, { ref: messagesRef, callback: onMessageRemoved });

  console.log(`👂 Listening for deletions in chat: ${chatId}`);
});

db.ref("Chats").on("child_removed", (chatSnapshot) => {
  const chatId = chatSnapshot.key;
  const chatData = chatSnapshot.val();

  if (chatListeners.has(chatId)) {
    const { ref, callback } = chatListeners.get(chatId);
    ref.off("child_removed", callback);
    chatListeners.delete(chatId);
    console.log(`🧹 Removed listener for chat: ${chatId}`);
  }

  saveDeletedChat(chatId, chatData);
  console.log(`💬 Chat deleted: ${chatId}`);
});