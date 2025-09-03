// Simple integration test
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "server/.env.local") });

console.log("🔧 Environment Test");
console.log("==================");

// Check API keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

console.log(`OpenAI API Key: ${OPENAI_API_KEY ? '✅ Found' : '❌ Missing'}`);
console.log(`Gemini API Key: ${GEMINI_API_KEY ? '✅ Found' : '❌ Missing'}`);
console.log(`DeepSeek API Key: ${DEEPSEEK_API_KEY ? '✅ Found' : '❌ Missing'}`);

// Check database connection
console.log("\n🗄️ Database Test");
console.log("================");

try {
  const { DATABASE_URL } = require("./server/db.js");
  console.log(`Database URL: ${DATABASE_URL ? '✅ Found' : '❌ Missing'}`);
} catch (error) {
  console.log(`Database connection: ❌ Error - ${error.message}`);
}

// Check file system
console.log("\n📁 File System Test");
console.log("===================");

const fs = require("fs");
const testImagePath = path.join(__dirname, "local_books/1756742357471/page-1.jpg");
console.log(`Test image exists: ${fs.existsSync(testImagePath) ? '✅ Found' : '❌ Missing'}`);

console.log("\n✅ Basic integration test completed");
