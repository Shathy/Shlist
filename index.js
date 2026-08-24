const admin = require("firebase-admin");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

// ==================== Express Server ====================
// Healthcheck endpoint (required by Railway)
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// Start server with error handling for EADDRINUSE
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

// ==================== Global Error Handlers ====================
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...");
  server.close(() => {
    admin.app().delete().then(() => process.exit(0));
  });
  // Force exit if not closed within 5 seconds
  setTimeout(() => process.exit(1), 5000);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully...");
  server.close(() => {
    admin.app().delete().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5000);
});

// ==================== Firebase Initialization ====================
// Check required environment variables
if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.FIREBASE_DATABASE_URL) {
  console.error("❌ Missing required environment variables: FIREBASE_SERVICE_ACCOUNT or FIREBASE_DATABASE_URL");
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
  console.log("✅ Firebase Connected Successfully");
} catch (error) {
  console.error("❌ Firebase Auth Error:", error.message);
  process.exit(1);
}

const db = admin.database();

// ==================== Listener Management ====================
// Map to track active listeners for each chat, so we can remove them when a chat is deleted.
const chatListeners = new Map();

// ==================== Helper Functions ====================
/**
 * Extracts the textual content from a message object.
 * Tries common fields and falls back to JSON stringification.
 */
function extractContent(data) {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return null;
  return data.content || data.text || data.message || data.body || JSON.stringify(data);
}

/**
 * Saves a deleted message to the `deleted_messages` node.
 * Uses a composite key (chatId_messageId) to avoid collisions across different chats.
 * Includes a simple retry mechanism (3 attempts).
 */
async function saveDeletedMessage(messageId, data, chatId, retries = 3) {
  if (!data) return;

  const compositeKey = `${chatId}_${messageId}`;
  const content = extractContent(data);
  const payload = {
    message_id: messageId,
    chat_id: chatId || "",
    content: content,
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
        // Wait before retrying (exponential backoff: 1s, 2s)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}

/**
 * Saves a deleted chat (whole conversation) to the `deleted_chats` node.
 */
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

// ==================== Firebase Realtime Database Listeners ====================
/**
 * Listen for new chats being added.
 * For each new chat, set up a listener on its `messages` node to catch message deletions.
 */
db.ref("Chats").on("child_added", (chatSnapshot) => {
  const chatId = chatSnapshot.key;
  const messagesRef = db.ref(`Chats/${chatId}/messages`);

  // Define the callback for message deletion
  const onMessageRemoved = (snapshot) => {
    saveDeletedMessage(snapshot.key, snapshot.val(), chatId);
  };

  // Attach listener to messages of this chat
  messagesRef.on("child_removed", onMessageRemoved);

  // Store reference for later cleanup
  chatListeners.set(chatId, { ref: messagesRef, callback: onMessageRemoved });

  console.log(`👂 Listening for deletions in chat: ${chatId}`);
});

/**
 * Listen for a whole chat being removed from `Chats`.
 * This will clean up the message listener for that chat and save the chat data.
 */
db.ref("Chats").on("child_removed", (chatSnapshot) => {
  const chatId = chatSnapshot.key;
  const chatData = chatSnapshot.val();

  // Remove the message listener if it exists
  if (chatListeners.has(chatId)) {
    const { ref, callback } = chatListeners.get(chatId);
    ref.off("child_removed", callback);
    chatListeners.delete(chatId);
    console.log(`🧹 Removed listener for chat: ${chatId}`);
  }

  // Save the deleted chat data
  saveDeletedChat(chatId, chatData);
  console.log(`💬 Chat deleted: ${chatId}`);
});