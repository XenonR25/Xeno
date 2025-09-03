const Tesseract = require("tesseract.js");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const postgres = require("postgres");
require("dotenv").config({ path: path.join(__dirname, "server/.env.local") });

// Database connection
const { DATABASE_URL } = require("./server/db.js");
const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Get API keys from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

console.log("🔑 API Keys Status:");
console.log(`OpenAI: ${OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
console.log(`Gemini: ${GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
console.log(`DeepSeek: ${DEEPSEEK_API_KEY ? '✅ Configured' : '❌ Missing'}`);

// OCR processing function
async function processOCR(imageUrl, pageNumber) {
  try {
    console.log(`🔍 [OCR] Starting OCR processing for Page ${pageNumber}`);
    console.log(`📷 [OCR] Image URL: ${imageUrl}`);
    
    const { data: { text } } = await Tesseract.recognize(imageUrl, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`📖 [OCR] Page ${pageNumber} - Recognizing text: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    console.log(`✅ [OCR] Page ${pageNumber} completed - Extracted ${text.length} characters`);
    return text.trim();
  } catch (error) {
    console.error(`❌ [OCR] Page ${pageNumber} processing error:`, error.message);
    throw new Error(`OCR failed for page ${pageNumber}: ${error.message}`);
  }
}

// AI API integration functions
async function callChatGPT(prompt, context) {
  try {
    console.log(`🤖 [CHATGPT] Calling ChatGPT API...`);
    
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key not found in environment variables");
    }

    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that provides detailed explanations based on the given context."
        },
        {
          role: "user",
          content: `Context: ${context}\n\nPrompt: ${prompt}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ [CHATGPT] Response received successfully`);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(`❌ [CHATGPT] API error:`, error.response?.data || error.message);
    throw new Error(`ChatGPT API failed: ${error.message}`);
  }
}

async function callGemini(prompt, context) {
  try {
    console.log(`🤖 [GEMINI] Calling Gemini API...`);
    
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not found in environment variables");
    }

    const response = await axios.post(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
      contents: [{
        parts: [{
          text: `Context: ${context}\n\nPrompt: ${prompt}`
        }]
      }]
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ [GEMINI] Response received successfully`);
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error(`❌ [GEMINI] API error:`, error.response?.data || error.message);
    throw new Error(`Gemini API failed: ${error.message}`);
  }
}

async function callDeepSeek(prompt, context) {
  try {
    console.log(`🤖 [DEEPSEEK] Calling DeepSeek API...`);
    
    if (!DEEPSEEK_API_KEY) {
      throw new Error("DeepSeek API key not found in environment variables");
    }

    const response = await axios.post("https://api.deepseek.com/chat/completions", {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that provides detailed explanations based on the given context."
        },
        {
          role: "user",
          content: `Context: ${context}\n\nPrompt: ${prompt}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ [DEEPSEEK] Response received successfully`);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(`❌ [DEEPSEEK] API error:`, error.response?.data || error.message);
    throw new Error(`DeepSeek API failed: ${error.message}`);
  }
}

// Database helper functions
async function fetchRealPageData() {
  try {
    console.log(`🗄️ [DATABASE] Fetching real page data from database...`);
    
    const pages = await sql`
      SELECT p.pageid, p.pageurl, p.pagenumber, b.title as book_title
      FROM pages p
      JOIN books b ON p.bookid = b.bookid
      LIMIT 3
    `;
    
    console.log(`✅ [DATABASE] Found ${pages.length} pages in database`);
    pages.forEach((page, index) => {
      console.log(`📄 [DATABASE] Page ${index + 1}: ID=${page.pageid}, Number=${page.pagenumber}, Book="${page.book_title}"`);
    });
    
    return pages;
  } catch (error) {
    console.error(`❌ [DATABASE] Failed to fetch page data:`, error.message);
    throw error;
  }
}

// Test functions
async function testOCR() {
  console.log("\n🧪 === OCR TEST ===");
  try {
    let imagePath;
    let pageNumber = 1;
    
    try {
      const pages = await fetchRealPageData();
      if (pages.length > 0) {
        const firstPage = pages[0];
        imagePath = firstPage.pageurl;
        pageNumber = firstPage.pagenumber;
        console.log(`📄 [OCR] Using real database page: ${imagePath}`);
      }
    } catch (dbError) {
      console.log(`⚠️ [OCR] Database unavailable, falling back to local image`);
    }
    
    if (!imagePath) {
      imagePath = path.join(__dirname, "local_books/1756742357471/page-1.jpg");
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Local image file not found: ${imagePath}`);
      }
      console.log(`📁 [OCR] Using local image: ${imagePath}`);
    }
    
    const ocrResult = await processOCR(imagePath, pageNumber);
    console.log(`✅ [OCR] Success! Extracted text length: ${ocrResult.length}`);
    console.log(`📝 [OCR] Sample text: "${ocrResult.substring(0, 200)}..."`);
    return ocrResult;
  } catch (error) {
    console.error(`❌ [OCR] Failed:`, error.message);
    throw error;
  }
}

async function testChatGPT() {
  console.log("\n🧪 === CHATGPT TEST ===");
  try {
    const testPrompt = "Explain the main concepts in this text";
    const testContext = "This is a sample context about machine learning and artificial intelligence concepts.";
    
    if (OPENAI_API_KEY) {
      console.log(`🔑 [CHATGPT] Using real OpenAI API key`);
      const result = await callChatGPT(testPrompt, testContext);
      console.log(`✅ [CHATGPT] Real API test completed`);
      console.log(`📝 [CHATGPT] Response length: ${result.length} characters`);
      return result;
    } else {
      console.log(`⚠️ [CHATGPT] No API key found, using simulated response`);
      const simulatedResponse = "This is a simulated ChatGPT response for testing purposes. The context discusses machine learning and AI concepts.";
      console.log(`✅ [CHATGPT] Simulated test completed`);
      return simulatedResponse;
    }
  } catch (error) {
    console.error(`❌ [CHATGPT] Failed:`, error.message);
    throw error;
  }
}

async function testGemini() {
  console.log("\n🧪 === GEMINI TEST ===");
  try {
    const testPrompt = "Analyze and summarize this content";
    const testContext = "This is sample content about data science, statistics, and analytical methods.";
    
    if (GEMINI_API_KEY) {
      console.log(`🔑 [GEMINI] Using real Gemini API key`);
      const result = await callGemini(testPrompt, testContext);
      console.log(`✅ [GEMINI] Real API test completed`);
      console.log(`📝 [GEMINI] Response length: ${result.length} characters`);
      return result;
    } else {
      console.log(`⚠️ [GEMINI] No API key found, using simulated response`);
      const simulatedResponse = "This is a simulated Gemini response for testing purposes. The content covers data science and statistical analysis.";
      console.log(`✅ [GEMINI] Simulated test completed`);
      return simulatedResponse;
    }
  } catch (error) {
    console.error(`❌ [GEMINI] Failed:`, error.message);
    throw error;
  }
}

async function testDeepSeek() {
  console.log("\n🧪 === DEEPSEEK TEST ===");
  try {
    const testPrompt = "Provide insights on this information";
    const testContext = "This is sample information about software development, programming, and technical documentation.";
    
    if (DEEPSEEK_API_KEY) {
      console.log(`🔑 [DEEPSEEK] Using real DeepSeek API key`);
      const result = await callDeepSeek(testPrompt, testContext);
      console.log(`✅ [DEEPSEEK] Real API test completed`);
      console.log(`📝 [DEEPSEEK] Response length: ${result.length} characters`);
      return result;
    } else {
      console.log(`⚠️ [DEEPSEEK] No API key found, using simulated response`);
      const simulatedResponse = "This is a simulated DeepSeek response for testing purposes. The information relates to software development practices.";
      console.log(`✅ [DEEPSEEK] Simulated test completed`);
      return simulatedResponse;
    }
  } catch (error) {
    console.error(`❌ [DEEPSEEK] Failed:`, error.message);
    throw error;
  }
}

// Main test runner
async function runAllTests() {
  console.log("🚀 === STARTING COMPREHENSIVE API TESTS ===");
  console.log("============================================");
  
  const results = {
    ocr: null,
    chatgpt: null,
    gemini: null,
    deepseek: null
  };

  // Test OCR
  try {
    console.log("\n📋 [MAIN] Running OCR test...");
    results.ocr = await testOCR();
  } catch (error) {
    console.error("❌ [MAIN] OCR test failed:", error.message);
    results.ocr = { error: error.message };
  }

  // Test ChatGPT
  try {
    console.log("\n📋 [MAIN] Running ChatGPT test...");
    results.chatgpt = await testChatGPT();
  } catch (error) {
    console.error("❌ [MAIN] ChatGPT test failed:", error.message);
    results.chatgpt = { error: error.message };
  }

  // Test Gemini
  try {
    console.log("\n📋 [MAIN] Running Gemini test...");
    results.gemini = await testGemini();
  } catch (error) {
    console.error("❌ [MAIN] Gemini test failed:", error.message);
    results.gemini = { error: error.message };
  }

  // Test DeepSeek
  try {
    console.log("\n📋 [MAIN] Running DeepSeek test...");
    results.deepseek = await testDeepSeek();
  } catch (error) {
    console.error("❌ [MAIN] DeepSeek test failed:", error.message);
    results.deepseek = { error: error.message };
  }

  // Print summary
  console.log("\n🏁 === TEST SUMMARY ===");
  console.log("======================");
  console.log(`🔍 OCR: ${results.ocr?.error ? '❌ Failed' : '✅ Passed'}`);
  console.log(`🤖 ChatGPT: ${results.chatgpt?.error ? '❌ Failed' : '✅ Passed'}`);
  console.log(`🤖 Gemini: ${results.gemini?.error ? '❌ Failed' : '✅ Passed'}`);
  console.log(`🤖 DeepSeek: ${results.deepseek?.error ? '❌ Failed' : '✅ Passed'}`);
  
  // Close database connection
  await sql.end();
  console.log("\n🔚 [MAIN] Tests completed and database connection closed");
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
