const express = require("express");
const app = express();
const PORT = process.env.PORT || 8080;

app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

app.get("/", (req, res) => res.status(200).send("OK"));
app.get("/health", (req, res) => res.status(200).json({ status: "healthy" }));

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server on ${PORT}`);
});

server.on("error", (err) => {
  console.error("❌ Server error:", err);
  process.exit(1);
});