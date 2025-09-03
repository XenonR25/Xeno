require("dotenv").config({ path: __dirname + "/.env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Validate required environment variables
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in .env.local");
  process.exit(1);
}

if (!CLOUDINARY_URL) {
  console.error("❌ CLOUDINARY_URL is not set in .env.local");
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is not set in .env.local");
  process.exit(1);
}

console.log("✅ Environment variables loaded successfully");

module.exports = {
  DATABASE_URL,
  CLOUDINARY_URL,
  GEMINI_API_KEY,
};
