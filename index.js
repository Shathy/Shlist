const express = require("express");
const app = express();

// محاولة اكتشاف المنفذ الصحيح
let PORT = process.env.PORT || 3000;

// إذا كان المنفذ 8080، جرب 3000
if (PORT === "8080" || PORT === 8080) {
  console.log("⚠️ Port 8080 detected, trying 3000 instead...");
  PORT = 3000;
}

console.log("=== ENVIRONMENT VARIABLES ===");
console.log("PORT:", process.env.PORT);
console.log("USING PORT:", PORT);
console.log("RAILWAY_ENVIRONMENT:", process.env.RAILWAY_ENVIRONMENT);
console.log("============================");

app.use((req, res, next) => {
  console.log(`📥 Request: ${req.method} ${req.url}`);
  next();
});

app.get("/", (req, res) => {
  console.log("✅ Healthcheck received!");
  res.status(200).send("OK");
});

app.get("/health", (req, res) => {
  console.log("✅ Healthcheck at /health!");
  res.status(200).json({ status: "healthy" });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on port ${PORT}`);
});

server.on("error", (err) => {
  console.error("❌ Server error:", err);
  process.exit(1);
});