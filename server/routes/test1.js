const Tesseract = require("tesseract.js");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const postgres = require("postgres");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

// Database connection
const { DATABASE_URL } = require("../db.js");
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

// Configure Gemini AI
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Database helper functions
async function fetchPagesFromDatabase() {
  try {
    console.log(`🗄️ [DATABASE] Fetching pages from database...`);
    
    const pages = await sql`
      SELECT p."PageId", p."pageURL", p."pageNumber", b."Name" as book_title, b."BookId"
      FROM "Pages" p
      JOIN "Books" b ON p."BookId" = b."BookId"
      ORDER BY b."BookId", p."pageNumber"
      LIMIT 5
    `;
    
    console.log(`✅ [DATABASE] Found ${pages.length} pages in database`);
    pages.forEach((page, index) => {
      console.log(`📄 [DATABASE] Page ${index + 1}: ID=${page.PageId}, Number=${page.pageNumber}, Book="${page.book_title}"`);
    });
    
    return pages;
  } catch (error) {
    console.error(`❌ [DATABASE] Failed to fetch page data:`, error.message);
    throw error;
  }
}

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
    console.log(`📝 [OCR] Page ${pageNumber} preview: "${text.substring(0, 100)}..."`);
    return text.trim();
  } catch (error) {
    console.error(`❌ [OCR] Page ${pageNumber} processing error:`, error.message);
    throw new Error(`OCR failed for page ${pageNumber}: ${error.message}`);
  }
}

// OpenAI API integration
async function callOpenAI(context, prompt) {
  try {
    console.log(`🤖 [OPENAI] Calling OpenAI API...`);
    console.log(`💭 [OPENAI] Prompt: "${prompt.substring(0, 100)}..."`);
    console.log(`📄 [OPENAI] Context length: ${context.length} characters`);

    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key not found in environment variables");
    }

    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that provides detailed Responses based on the given context."
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

    console.log(`✅ [OPENAI] Response received successfully`);
    console.log(`📝 [OPENAI] Response length: ${response.data.choices[0].message.content.length} characters`);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(`❌ [OPENAI] API error:`, error.response?.data || error.message);
    throw new Error(`OpenAI API failed: ${error.message}`);
  }
}

// Gemini API integration with model fallbacks
async function tryGeminiModels(context, prompt) {
  const modelCandidates = [
    "gemini-2.0-flash",
    "gemini-1.5-flash", 
    "gemini-1.5-pro",
    "gemini-1.0-pro",
  ];

  let lastError;
  for (const modelName of modelCandidates) {
    try {
      console.log(`🔄 [GEMINI] Trying model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const fullPrompt = `Context: ${context}\n\nPrompt: ${prompt}`;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      console.log(`✅ [GEMINI] Success with model: ${modelName}`);
      return response.text();
    } catch (err) {
      console.log(`❌ [GEMINI] Failed with model ${modelName}: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError || new Error("All Gemini model attempts failed");
}

async function callGemini(context, prompt) {
  try {
    console.log(`🤖 [GEMINI] Calling Gemini API...`);
    console.log(`💭 [GEMINI] Prompt: "${prompt.substring(0, 100)}..."`);
    console.log(`📄 [GEMINI] Context length: ${context.length} characters`);

    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not found in environment variables");
    }

    if (!genAI) {
      throw new Error("Gemini AI not initialized");
    }

    const response = await tryGeminiModels(context, prompt);

    console.log(`✅ [GEMINI] Response received successfully`);
    console.log(`📝 [GEMINI] Response length: ${response.length} characters`);
    return response;
  } catch (error) {
    console.error(`❌ [GEMINI] API error:`, error.message);
    throw new Error(`Gemini API failed: ${error.message}`);
  }
}

// DeepSeek API integration
async function callDeepSeek(context, prompt) {
  try {
    console.log(`🤖 [DEEPSEEK] Calling DeepSeek API...`);
    console.log(`💭 [DEEPSEEK] Prompt: "${prompt.substring(0, 100)}..."`);
    console.log(`📄 [DEEPSEEK] Context length: ${context.length} characters`);

    if (!DEEPSEEK_API_KEY) {
      throw new Error("DeepSeek API key not found in environment variables");
    }

    const response = await axios.post("https://api.deepseek.com/chat/completions", {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that provides detailed Responses based on the given context."
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
    console.log(`📝 [DEEPSEEK] Response length: ${response.data.choices[0].message.content.length} characters`);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(`❌ [DEEPSEEK] API error:`, error.response?.data || error.message);
    throw new Error(`DeepSeek API failed: ${error.message}`);
  }
}

// Main test function
async function runComprehensiveTest() {
  console.log("🚀 === STARTING COMPREHENSIVE API INTEGRATION TEST ===");
  console.log("======================================================");
  
  const results = {
    pages: [],
    ocrResults: [],
    apiResponses: {
      openai: [],
      gemini: [],
      deepseek: []
    },
    errors: []
  };

  try {
    // Step 1: Fetch pages from database
    console.log("\n📋 [STEP 1] Fetching pages from database...");
    const pages = await fetchPagesFromDatabase();
    results.pages = pages;

    if (pages.length === 0) {
      throw new Error("No pages found in database");
    }

    // Step 2: Process OCR for each page
    console.log("\n📋 [STEP 2] Processing OCR for all pages...");
    for (const page of pages) {
      try {
        const ocrText = await processOCR(page.pageURL, page.pageNumber);
        results.ocrResults.push({
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          bookTitle: page.book_title,
          text: ocrText,
          textLength: ocrText.length
        });
      } catch (error) {
        console.error(`❌ [OCR] Failed for page ${page.pageNumber}:`, error.message);
        results.errors.push({
          step: 'OCR',
          pageId: page.PageId,
          error: error.message
        });
      }
    }

    console.log(`✅ [STEP 2] Completed OCR for ${results.ocrResults.length} pages`);

    // Step 3: Test APIs with extracted context
    console.log("\n📋 [STEP 3] Testing APIs with extracted context...");
    
    const testPrompt = "Summarize the main concepts and key points from this text content.";
    
    for (const ocrResult of results.ocrResults) {
      const context = ocrResult.text;
      console.log(`\n🔍 Testing APIs for Page ${ocrResult.pageNumber} (${ocrResult.textLength} chars)`);

      // Test OpenAI
      if (OPENAI_API_KEY) {
        try {
          console.log(`\n🤖 Testing OpenAI for Page ${ocrResult.pageNumber}...`);
          const openaiResponse = await callOpenAI(context, testPrompt);
          results.apiResponses.openai.push({
            pageId: ocrResult.pageId,
            pageNumber: ocrResult.pageNumber,
            response: openaiResponse,
            responseLength: openaiResponse.length
          });
        } catch (error) {
          console.error(`❌ [OPENAI] Failed for page ${ocrResult.pageNumber}:`, error.message);
          results.errors.push({
            step: 'OpenAI',
            pageId: ocrResult.pageId,
            error: error.message
          });
        }
      } else {
        console.log(`⚠️ [OPENAI] Skipping - API key not configured`);
      }

      // Test Gemini
      if (GEMINI_API_KEY) {
        try {
          console.log(`\n🤖 Testing Gemini for Page ${ocrResult.pageNumber}...`);
          const geminiResponse = await callGemini(context, testPrompt);
          results.apiResponses.gemini.push({
            pageId: ocrResult.pageId,
            pageNumber: ocrResult.pageNumber,
            response: geminiResponse,
            responseLength: geminiResponse.length
          });
        } catch (error) {
          console.error(`❌ [GEMINI] Failed for page ${ocrResult.pageNumber}:`, error.message);
          results.errors.push({
            step: 'Gemini',
            pageId: ocrResult.pageId,
            error: error.message
          });
        }
      } else {
        console.log(`⚠️ [GEMINI] Skipping - API key not configured`);
      }

      // Test DeepSeek
      if (DEEPSEEK_API_KEY) {
        try {
          console.log(`\n🤖 Testing DeepSeek for Page ${ocrResult.pageNumber}...`);
          const deepseekResponse = await callDeepSeek(context, testPrompt);
          results.apiResponses.deepseek.push({
            pageId: ocrResult.pageId,
            pageNumber: ocrResult.pageNumber,
            response: deepseekResponse,
            responseLength: deepseekResponse.length
          });
        } catch (error) {
          console.error(`❌ [DEEPSEEK] Failed for page ${ocrResult.pageNumber}:`, error.message);
          results.errors.push({
            step: 'DeepSeek',
            pageId: ocrResult.pageId,
            error: error.message
          });
        }
      } else {
        console.log(`⚠️ [DEEPSEEK] Skipping - API key not configured`);
      }
    }

    // Step 4: Print comprehensive results
    console.log("\n🏁 === TEST RESULTS SUMMARY ===");
    console.log("===============================");
    console.log(`📄 Pages processed: ${results.pages.length}`);
    console.log(`🔍 OCR successful: ${results.ocrResults.length}`);
    console.log(`🤖 OpenAI responses: ${results.apiResponses.openai.length}`);
    console.log(`🤖 Gemini responses: ${results.apiResponses.gemini.length}`);
    console.log(`🤖 DeepSeek responses: ${results.apiResponses.deepseek.length}`);
    console.log(`❌ Total errors: ${results.errors.length}`);

    // Print detailed results for each page
    console.log("\n📋 DETAILED RESULTS:");
    console.log("====================");
    
    for (const ocrResult of results.ocrResults) {
      console.log(`\n📄 Page ${ocrResult.pageNumber} (${ocrResult.bookTitle}):`);
      console.log(`   📝 OCR Text: ${ocrResult.textLength} characters`);
      
      const openaiResult = results.apiResponses.openai.find(r => r.pageId === ocrResult.pageId);
      const geminiResult = results.apiResponses.gemini.find(r => r.pageId === ocrResult.pageId);
      const deepseekResult = results.apiResponses.deepseek.find(r => r.pageId === ocrResult.pageId);
      
      console.log(`   🤖 OpenAI: ${openaiResult ? `✅ ${openaiResult.responseLength} chars` : '❌ Failed'}`);
      console.log(`   🤖 Gemini: ${geminiResult ? `✅ ${geminiResult.responseLength} chars` : '❌ Failed'}`);
      console.log(`   🤖 DeepSeek: ${deepseekResult ? `✅ ${deepseekResult.responseLength} chars` : '❌ Failed'}`);
    }

    // Print errors if any
    if (results.errors.length > 0) {
      console.log("\n❌ ERRORS ENCOUNTERED:");
      console.log("======================");
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.step}] Page ${error.pageId}: ${error.error}`);
      });
    }

    // Save results to file
    const outputDir = path.join(__dirname, "../../test_output");
    fs.mkdirSync(outputDir, { recursive: true });
    
    const outputFile = path.join(outputDir, `comprehensive_test_${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${outputFile}`);

    return results;

  } catch (error) {
    console.error("❌ [MAIN] Test failed:", error.message);
    results.errors.push({
      step: 'Main',
      error: error.message
    });
    return results;
  } finally {
    // Close database connection
    await sql.end();
    console.log("\n🔚 [MAIN] Database connection closed");
  }
}

// Test OpenAI Response generation
async function testOpenAIExplanation() {
  console.log('\n🧪 ========== OPENAI EXPLANATION TEST ==========');
  
  const testResults = {
    timestamp: new Date().toISOString(),
    test_type: 'openai_Response_generation',
    model: 'OpenAI',
    api_key_status: OPENAI_API_KEY ? 'Available' : 'Missing',
    hardcoded_values: {},
    category_info: {},
    pages_processed: [],
    ocr_results: [],
    ai_responses: {},
    database_storage: [],
    local_storage: {},
    errors: []
  };

  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // First, let's check what categories and models exist, and create them if needed
    console.log('🔍 Checking existing categories and models...');
    
    // Check if OpenAI model exists
    let openaiModel = await sql`
      SELECT "ModelId", "ModelName" FROM "Model" 
      WHERE LOWER("ModelName") LIKE '%openai%' OR LOWER("ModelName") LIKE '%gpt%'
      LIMIT 1
    `;
    
    if (openaiModel.length === 0) {
      console.log('📝 Creating OpenAI model...');
      openaiModel = await sql`
        INSERT INTO "Model" ("ModelName", "Description")
        VALUES ('OpenAI GPT-4', 'OpenAI GPT-4 language model for text generation')
        RETURNING "ModelId", "ModelName"
      `;
      console.log(`✅ Created OpenAI model: ${openaiModel[0].ModelName}`);
    } else {
      console.log(`✅ Found existing OpenAI model: ${openaiModel[0].ModelName}`);
    }

    // Check if prompt exists
    let prompt = await sql`
      SELECT "PromptId", "Prompt" FROM "Prompting" 
      LIMIT 1
    `;
    
    if (prompt.length === 0) {
      console.log('📝 Creating test prompt...');
      prompt = await sql`
        INSERT INTO "Prompting" ("Prompt")
        VALUES ('Analyze and explain the content from the provided pages. Focus on key concepts and provide clear Responses.')
        RETURNING "PromptId", "Prompt"
      `;
      console.log(`✅ Created test prompt`);
    } else {
      console.log(`✅ Found existing prompt`);
    }

    // Check if category exists with OpenAI model
    let category = await sql`
      SELECT c."CategoryId", c."Name", m."ModelName", p."Prompt"
      FROM "Category" c
      JOIN "Model" m ON c."ModelId" = m."ModelId"
      JOIN "Prompting" p ON c."PromptId" = p."PromptId"
      WHERE m."ModelId" = ${openaiModel[0].ModelId}
      LIMIT 1
    `;
    
    if (category.length === 0) {
      console.log('📝 Creating test category with OpenAI model...');
      category = await sql`
        INSERT INTO "Category" ("Name", "Description", "ModelId", "PromptId")
        VALUES ('OpenAI Test Category', 'Test category for OpenAI Responses', ${openaiModel[0].ModelId}, ${prompt[0].PromptId})
        RETURNING "CategoryId", "Name"
      `;
      console.log(`✅ Created test category: ${category[0].Name}`);
      
      // Fetch the complete category info
      category = await sql`
        SELECT c."CategoryId", c."Name", c."Description", m."ModelName", p."Prompt"
        FROM "Category" c
        JOIN "Model" m ON c."ModelId" = m."ModelId"
        JOIN "Prompting" p ON c."PromptId" = p."PromptId"
        WHERE c."CategoryId" = ${category[0].CategoryId}
      `;
    } else {
      console.log(`✅ Found existing OpenAI category: ${category[0].Name}`);
    }

    // Use the found/created category ID
    const HARDCODED_CATEGORY_ID = category[0].CategoryId;
    
    // Check what pages exist in the database
    console.log('🔍 Checking existing pages in database...');
    const existingPages = await sql`
      SELECT "PageId", "pageNumber", b."Name" as book_title
      FROM "Pages" p
      JOIN "Books" b ON p."BookId" = b."BookId"
      ORDER BY "PageId"
      LIMIT 10
    `;
    
    let HARDCODED_PAGE_IDS;
    if (existingPages.length >= 3) {
      HARDCODED_PAGE_IDS = existingPages.slice(0, 3).map(p => p.PageId);
      console.log(`✅ Found ${existingPages.length} existing pages, using first 3: [${HARDCODED_PAGE_IDS.join(', ')}]`);
      existingPages.slice(0, 3).forEach(page => {
        console.log(`   📖 Page ${page.pageNumber} from "${page.book_title}" (ID: ${page.PageId})`);
      });
    } else if (existingPages.length > 0) {
      HARDCODED_PAGE_IDS = existingPages.map(p => p.PageId);
      console.log(`⚠️ Only found ${existingPages.length} pages, using all: [${HARDCODED_PAGE_IDS.join(', ')}]`);
    } else {
      console.log('❌ No pages found in database. Creating mock pages for testing...');
      
      // Check if any books exist
      const existingBooks = await sql`
        SELECT "BookId", "Name" FROM "Books" LIMIT 1
      `;
      
      let bookId;
      if (existingBooks.length === 0) {
        console.log('📝 Creating test book...');
        const testBook = await sql`
          INSERT INTO "Books" ("Name", "Description", "UserId")
          VALUES ('Test Book for Explanations', 'A test book for Response testing', 1)
          RETURNING "BookId", "Name"
        `;
        bookId = testBook[0].BookId;
        console.log(`✅ Created test book: ${testBook[0].Name}`);
      } else {
        bookId = existingBooks[0].BookId;
        console.log(`✅ Using existing book: ${existingBooks[0].Name}`);
      }
      
      // Create test pages
      console.log('📝 Creating test pages...');
      const testPages = [];
      for (let i = 1; i <= 3; i++) {
        const page = await sql`
          INSERT INTO "Pages" ("BookId", "pageNumber", "pageURL")
          VALUES (${bookId}, ${i}, 'https://example.com/test-page-${i}.jpg')
          RETURNING "PageId", "pageNumber"
        `;
        testPages.push(page[0].PageId);
        console.log(`✅ Created test page ${i}: PageId ${page[0].PageId}`);
      }
      HARDCODED_PAGE_IDS = testPages;
    }
    
    testResults.hardcoded_values = {
      categoryId: HARDCODED_CATEGORY_ID,
      pageIds: HARDCODED_PAGE_IDS
    };

    console.log(`📋 Using hardcoded Category ID: ${HARDCODED_CATEGORY_ID}`);
    console.log(`📄 Using hardcoded Page IDs: [${HARDCODED_PAGE_IDS.join(', ')}]`);

    // Step 1: Use the category we found/created above
    console.log('\n🔍 Step 1: Using OpenAI category information...');
    
    testResults.category_info = category[0];
    
    console.log(`✅ OpenAI Category found: ${category[0].Name}`);
    console.log(`🤖 Model: ${category[0].ModelName}`);
    console.log(`💭 Prompt: "${category[0].Prompt.substring(0, 100)}..."`);

    // Step 2: Fetch pages by IDs
    console.log('\n📚 Step 2: Fetching pages by IDs...');
    const pages = await sql`
      SELECT p."PageId", p."pageURL", p."pageNumber", b."Name" as book_title, b."BookId"
      FROM "Pages" p
      JOIN "Books" b ON p."BookId" = b."BookId"
      WHERE p."PageId" = ANY(${HARDCODED_PAGE_IDS})
      ORDER BY b."BookId", p."pageNumber"
    `;

    if (pages.length === 0) {
      throw new Error(`No pages found with IDs: [${HARDCODED_PAGE_IDS.join(', ')}]`);
    }

    testResults.pages_processed = pages.map(p => ({
      pageId: p.PageId,
      pageNumber: p.pageNumber,
      bookTitle: p.book_title,
      pageURL: p.pageURL
    }));

    console.log(`✅ Found ${pages.length} pages`);
    pages.forEach(page => {
      console.log(`   📖 Page ${page.pageNumber} from "${page.book_title}" (ID: ${page.PageId})`);
    });

    // Step 3: Process OCR for all pages
    console.log('\n🔍 Step 3: Processing OCR for all pages...');
    const ocrResults = [];
    let combinedContext = '';

    for (const page of pages) {
      try {
        console.log(`📄 Processing OCR for Page ${page.pageNumber}...`);
        const ocrText = await processOCR(page.pageURL);
        
        const ocrResult = {
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          success: true,
          text: ocrText,
          textLength: ocrText.length
        };
        
        ocrResults.push(ocrResult);
        combinedContext += `\n--- Page ${page.pageNumber} ---\n${ocrText}\n`;
        
        console.log(`✅ OCR completed for Page ${page.pageNumber}: ${ocrText.length} characters`);
      } catch (error) {
        console.error(`❌ OCR failed for Page ${page.pageNumber}:`, error.message);
        ocrResults.push({
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          success: false,
          error: error.message,
          text: '',
          textLength: 0
        });
      }
    }

    testResults.ocr_results = ocrResults;
    const successfulOCR = ocrResults.filter(r => r.success).length;
    
    console.log(`📊 OCR Summary: ${successfulOCR}/${pages.length} pages processed successfully`);
    console.log(`📝 Total context length: ${combinedContext.length} characters`);

    // Step 4: Test OpenAI API with individual page responses
    console.log('\n🤖 Step 4: Testing OpenAI API for each page individually...');
    const aiResponses = {};
    const individualResponses = [];

    console.log(`🎯 Using OpenAI API for model: ${category[0].ModelName}`);

    // Process each page individually
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const ocrResult = ocrResults[i];
      
      if (!ocrResult.success) {
        console.log(`⚠️ Skipping Page ${page.pageNumber} - OCR failed`);
        individualResponses.push({
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          success: false,
          error: 'OCR failed for this page',
          response: null
        });
        continue;
      }

      try {
        console.log(`🚀 Testing OpenAI API for Page ${page.pageNumber}...`);
        const pageContext = `Page ${page.pageNumber} content:\n${ocrResult.text}`;
        const response = await callOpenAI(pageContext, category[0].Prompt);
        
        individualResponses.push({
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          success: true,
          response: response,
          length: response.length
        });
        
        console.log(`✅ OpenAI API successful for Page ${page.pageNumber}: ${response.length} characters`);
      } catch (error) {
        console.error(`❌ OpenAI API failed for Page ${page.pageNumber}:`, error.message);
        individualResponses.push({
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          success: false,
          error: error.message,
          response: null
        });
      }
    }

    const successfulResponses = individualResponses.filter(r => r.success);
    aiResponses.openai = { 
      success: successfulResponses.length > 0, 
      individualResponses: individualResponses,
      totalPages: pages.length,
      successfulPages: successfulResponses.length
    };

    testResults.ai_responses.primary = {
      api: 'openai',
      success: successfulResponses.length > 0,
      individualResponses: individualResponses,
      totalPages: pages.length,
      successfulPages: successfulResponses.length
    };

    console.log(`📊 OpenAI API Summary: ${successfulResponses.length}/${pages.length} pages processed successfully`);

    // Step 5: Store individual responses in database (Explanation table)
    console.log('\n💾 Step 5: Storing individual responses in database...');
    const databaseStorage = [];

    for (const responseData of individualResponses) {
      if (!responseData.success || !responseData.response) {
        console.log(`⚠️ Skipping database storage for Page ${responseData.pageNumber} - no valid response`);
        databaseStorage.push({
          pageId: responseData.pageId,
          categoryId: HARDCODED_CATEGORY_ID,
          success: false,
          error: 'No valid AI response to store'
        });
        continue;
      }

      try {
        const Response = await sql`
          INSERT INTO "Explanation" (
            "PageId",
            "CategoryId", 
            "Response"
          )
          VALUES (
            ${responseData.pageId},
            ${HARDCODED_CATEGORY_ID},
            ${responseData.response}
          )
          RETURNING "ExplanationId", "PageId", "CategoryId", "created_at"
        `;

        databaseStorage.push({
          ResponseId: Response[0].ExplanationId,
          pageId: responseData.pageId,
          pageNumber: responseData.pageNumber,
          categoryId: HARDCODED_CATEGORY_ID,
          success: true,
          created_at: Response[0].created_at
        });

        console.log(`✅ Stored individual response for Page ${responseData.pageNumber}: ExplanationId ${Response[0].ExplanationId}`);
      } catch (error) {
        console.error(`❌ Failed to store response for Page ${responseData.pageNumber}:`, error.message);
        databaseStorage.push({
          pageId: responseData.pageId,
          pageNumber: responseData.pageNumber,
          categoryId: HARDCODED_CATEGORY_ID,
          success: false,
          error: error.message
        });
      }
    }

    testResults.database_storage = databaseStorage;

    // Step 6: Store in local storage (JSON file)
    console.log('\n💿 Step 6: Storing OpenAI results in local storage...');
    const timestamp = Date.now();
    const filename = `openai_Response_test_${timestamp}.json`;
    const filepath = path.join(__dirname, '../../test_output', filename);

    testResults.local_storage = {
      filename,
      filepath,
      timestamp
    };

    // Ensure test_output directory exists
    const testOutputDir = path.join(__dirname, '../../test_output');
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    fs.writeFileSync(filepath, JSON.stringify(testResults, null, 2));
    console.log(`✅ Test results saved to: ${filename}`);

    // Summary
    console.log('\n📊 ========== OPENAI TEST SUMMARY ==========');
    console.log(`🎯 Category: ${category[0].Name} (ID: ${HARDCODED_CATEGORY_ID})`);
    console.log(`🤖 Model: ${category[0].ModelName}`);
    console.log(`📄 Pages processed: ${pages.length}`);
    console.log(`🔍 OCR successful: ${successfulOCR}/${pages.length}`);
    console.log(`🤖 OpenAI API: ${testResults.ai_responses.primary?.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`💾 Database storage: ${databaseStorage.filter(d => d.success).length}/${pages.length} successful`);
    console.log(`💿 Local storage: ✅ Saved to ${filename}`);

    return testResults;

  } catch (error) {
    console.error('❌ OpenAI Response test failed:', error);
    testResults.errors.push(error.message);
    
    // Still save results even if test failed
    const timestamp = Date.now();
    const filename = `openai_Response_test_failed_${timestamp}.json`;
    const filepath = path.join(__dirname, '../../test_output', filename);
    
    const testOutputDir = path.join(__dirname, '../../test_output');
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
    
    fs.writeFileSync(filepath, JSON.stringify(testResults, null, 2));
    console.log(`💿 Failed test results saved to: ${filename}`);
    
    throw error;
  }
}

// Test Gemini Response generation
async function testGeminiExplanation() {
  console.log('\n🧪 ========== GEMINI EXPLANATION TEST ==========');
  
  const testResults = {
    timestamp: new Date().toISOString(),
    test_type: 'gemini_Response_generation',
    model: 'Gemini',
    api_key_status: GEMINI_API_KEY ? 'Available' : 'Missing',
    hardcoded_values: {},
    category_info: {},
    pages_processed: [],
    ocr_results: [],
    ai_responses: {},
    database_storage: [],
    local_storage: {},
    errors: []
  };

  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    // Hardcoded test values for Gemini
    const HARDCODED_CATEGORY_ID = 2; // Change this to a category with Gemini model
    const HARDCODED_PAGE_IDS = [1, 2, 3]; // Change these to existing page IDs
    
    testResults.hardcoded_values = {
      categoryId: HARDCODED_CATEGORY_ID,
      pageIds: HARDCODED_PAGE_IDS
    };

    console.log(`📋 Using hardcoded Category ID: ${HARDCODED_CATEGORY_ID}`);
    console.log(`📄 Using hardcoded Page IDs: [${HARDCODED_PAGE_IDS.join(', ')}]`);

    // Step 1: Fetch category information with Gemini model and prompt
    console.log('\n🔍 Step 1: Fetching Gemini category information...');
    const categoryInfo = await sql`
      SELECT 
        c."CategoryId",
        c."Name" as "CategoryName",
        c."Description" as "CategoryDescription",
        m."ModelName" as "ModelName",
        p."Prompt"
      FROM "Category" c
      JOIN "Model" m ON c."ModelId" = m."ModelId"
      JOIN "Prompting" p ON c."PromptId" = p."PromptId"
      WHERE c."CategoryId" = ${HARDCODED_CATEGORY_ID}
        AND LOWER(m."ModelName") LIKE '%gemini%'
    `;

    if (categoryInfo.length === 0) {
      throw new Error(`Gemini category with ID ${HARDCODED_CATEGORY_ID} not found. Make sure the category uses a Gemini model.`);
    }

    const category = categoryInfo[0];
    testResults.category_info = category;
    
    console.log(`✅ Gemini Category found: ${category.CategoryName}`);
    console.log(`🤖 Model: ${category.ModelName}`);
    console.log(`💭 Prompt: "${category.Prompt.substring(0, 100)}..."`);

    // Step 2: Fetch pages by IDs
    console.log('\n📚 Step 2: Fetching pages by IDs...');
    const pages = await sql`
      SELECT p."PageId", p."pageURL", p."pageNumber", b."Name" as book_title, b."BookId"
      FROM "Pages" p
      JOIN "Books" b ON p."BookId" = b."BookId"
      WHERE p."PageId" = ANY(${HARDCODED_PAGE_IDS})
      ORDER BY b."BookId", p."pageNumber"
    `;

    if (pages.length === 0) {
      throw new Error(`No pages found with IDs: [${HARDCODED_PAGE_IDS.join(', ')}]`);
    }

    testResults.pages_processed = pages.map(p => ({
      pageId: p.PageId,
      pageNumber: p.pageNumber,
      bookTitle: p.book_title,
      pageURL: p.pageURL
    }));

    console.log(`✅ Found ${pages.length} pages`);
    pages.forEach(page => {
      console.log(`   📖 Page ${page.pageNumber} from "${page.book_title}" (ID: ${page.PageId})`);
    });

    // Step 3: Process OCR for all pages
    console.log('\n🔍 Step 3: Processing OCR for all pages...');
    const ocrResults = [];
    let combinedContext = '';

    for (const page of pages) {
      try {
        console.log(`📄 Processing OCR for Page ${page.pageNumber}...`);
        const ocrText = await processOCR(page.pageURL);
        
        const ocrResult = {
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          success: true,
          text: ocrText,
          textLength: ocrText.length
        };
        
        ocrResults.push(ocrResult);
        combinedContext += `\n--- Page ${page.pageNumber} ---\n${ocrText}\n`;
        
        console.log(`✅ OCR completed for Page ${page.pageNumber}: ${ocrText.length} characters`);
      } catch (error) {
        console.error(`❌ OCR failed for Page ${page.pageNumber}:`, error.message);
        ocrResults.push({
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          success: false,
          error: error.message,
          text: '',
          textLength: 0
        });
      }
    }

    testResults.ocr_results = ocrResults;
    const successfulOCR = ocrResults.filter(r => r.success).length;
    
    console.log(`📊 OCR Summary: ${successfulOCR}/${pages.length} pages processed successfully`);
    console.log(`📝 Total context length: ${combinedContext.length} characters`);

    // Step 4: Test Gemini API with context + prompt
    console.log('\n🤖 Step 4: Testing Gemini API with context + prompt...');
    const aiResponses = {};

    console.log(`🎯 Using Gemini API for model: ${category.ModelName}`);

    // Test Gemini API specifically
    try {
      console.log(`🚀 Testing Gemini API...`);
      const response = await callGemini(combinedContext, category.Prompt);
      aiResponses.gemini = { success: true, response, length: response.length };
      console.log(`✅ Gemini API successful: ${response.length} characters`);

      testResults.ai_responses.primary = {
        api: 'gemini',
        success: true,
        response: response,
        length: response.length
      };

    } catch (error) {
      console.error(`❌ Gemini API failed:`, error.message);
      testResults.ai_responses.primary = {
        api: 'gemini',
        success: false,
        error: error.message
      };
      throw error; // Re-throw since this is specifically a Gemini test
    }

    // Step 5: Store responses in database (Explanation table)
    console.log('\n💾 Step 5: Storing Responses in database...');
    const databaseStorage = [];
    
    const finalResponse = testResults.ai_responses.primary?.response || 
                         'AI processing failed - no response generated';

    for (const page of pages) {
      try {
        const Response = await sql`
          INSERT INTO "Explanation" (
            "PageId",
            "CategoryId", 
            "Response"
          )
          VALUES (
            ${page.PageId},
            ${HARDCODED_CATEGORY_ID},
            ${finalResponse}
          )
          RETURNING "ExplanationId", "PageId", "CategoryId", "created_at"
        `;

        databaseStorage.push({
          ResponseId: Response[0].ExplanationId,
          pageId: page.PageId,
          categoryId: HARDCODED_CATEGORY_ID,
          success: true,
          created_at: Response[0].created_at
        });

        console.log(`✅ Stored Response for Page ${page.PageId}: ExplanationId ${Response[0].ExplanationId}`);
      } catch (error) {
        console.error(`❌ Failed to store Response for Page ${page.PageId}:`, error.message);
        databaseStorage.push({
          pageId: page.PageId,
          categoryId: HARDCODED_CATEGORY_ID,
          success: false,
          error: error.message
        });
      }
    }

    testResults.database_storage = databaseStorage;

    // Step 6: Store in local storage (JSON file)
    console.log('\n💿 Step 6: Storing Gemini results in local storage...');
    const timestamp = Date.now();
    const filename = `gemini_Response_test_${timestamp}.json`;
    const filepath = path.join(__dirname, '../../test_output', filename);

    testResults.local_storage = {
      filename,
      filepath,
      timestamp
    };

    // Ensure test_output directory exists
    const testOutputDir = path.join(__dirname, '../../test_output');
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    fs.writeFileSync(filepath, JSON.stringify(testResults, null, 2));
    console.log(`✅ Test results saved to: ${filename}`);

    // Summary
    console.log('\n📊 ========== GEMINI TEST SUMMARY ==========');
    console.log(`🎯 Category: ${category.CategoryName} (ID: ${HARDCODED_CATEGORY_ID})`);
    console.log(`🤖 Model: ${category.ModelName}`);
    console.log(`📄 Pages processed: ${pages.length}`);
    console.log(`🔍 OCR successful: ${successfulOCR}/${pages.length}`);
    console.log(`🤖 Gemini API: ${testResults.ai_responses.primary?.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`💾 Database storage: ${databaseStorage.filter(d => d.success).length}/${pages.length} successful`);
    console.log(`💿 Local storage: ✅ Saved to ${filename}`);

    return testResults;

  } catch (error) {
    console.error('❌ Gemini Response test failed:', error);
    testResults.errors.push(error.message);
    
    // Still save results even if test failed
    const timestamp = Date.now();
    const filename = `gemini_Response_test_failed_${timestamp}.json`;
    const filepath = path.join(__dirname, '../../test_output', filename);
    
    const testOutputDir = path.join(__dirname, '../../test_output');
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
    
    fs.writeFileSync(filepath, JSON.stringify(testResults, null, 2));
    console.log(`💿 Failed test results saved to: ${filename}`);
    
    throw error;
  }
}

// Test DeepSeek Response generation
async function testDeepSeekExplanation() {
  console.log('\n🧪 ========== DEEPSEEK EXPLANATION TEST ==========');
  
  const testResults = {
    timestamp: new Date().toISOString(),
    test_type: 'deepseek_Response_generation',
    model: 'DeepSeek',
    api_key_status: DEEPSEEK_API_KEY ? 'Available' : 'Missing',
    hardcoded_values: {},
    category_info: {},
    pages_processed: [],
    ocr_results: [],
    ai_responses: {},
    database_storage: [],
    local_storage: {},
    errors: []
  };

  try {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    // Hardcoded test values for DeepSeek
    const HARDCODED_CATEGORY_ID = 3; // Change this to a category with DeepSeek model
    const HARDCODED_PAGE_IDS = [1, 2, 3]; // Change these to existing page IDs
    
    testResults.hardcoded_values = {
      categoryId: HARDCODED_CATEGORY_ID,
      pageIds: HARDCODED_PAGE_IDS
    };

    console.log(`📋 Using hardcoded Category ID: ${HARDCODED_CATEGORY_ID}`);
    console.log(`📄 Using hardcoded Page IDs: [${HARDCODED_PAGE_IDS.join(', ')}]`);

    // Step 1: Fetch category information with DeepSeek model and prompt
    console.log('\n🔍 Step 1: Fetching DeepSeek category information...');
    const categoryInfo = await sql`
      SELECT 
        c."CategoryId",
        c."Name" as "CategoryName",
        c."Description" as "CategoryDescription",
        m."ModelName" as "ModelName",
        p."Prompt"
      FROM "Category" c
      JOIN "Model" m ON c."ModelId" = m."ModelId"
      JOIN "Prompting" p ON c."PromptId" = p."PromptId"
      WHERE c."CategoryId" = ${HARDCODED_CATEGORY_ID}
        AND LOWER(m."ModelName") LIKE '%deepseek%'
    `;

    if (categoryInfo.length === 0) {
      throw new Error(`DeepSeek category with ID ${HARDCODED_CATEGORY_ID} not found. Make sure the category uses a DeepSeek model.`);
    }

    const category = categoryInfo[0];
    testResults.category_info = category;
    
    console.log(`✅ DeepSeek Category found: ${category.CategoryName}`);
    console.log(`🤖 Model: ${category.ModelName}`);
    console.log(`💭 Prompt: "${category.Prompt.substring(0, 100)}..."`);

    // Step 2: Fetch pages by IDs
    console.log('\n📚 Step 2: Fetching pages by IDs...');
    const pages = await sql`
      SELECT p."PageId", p."pageURL", p."pageNumber", b."Name" as book_title, b."BookId"
      FROM "Pages" p
      JOIN "Books" b ON p."BookId" = b."BookId"
      WHERE p."PageId" = ANY(${HARDCODED_PAGE_IDS})
      ORDER BY b."BookId", p."pageNumber"
    `;

    if (pages.length === 0) {
      throw new Error(`No pages found with IDs: [${HARDCODED_PAGE_IDS.join(', ')}]`);
    }

    testResults.pages_processed = pages.map(p => ({
      pageId: p.PageId,
      pageNumber: p.pageNumber,
      bookTitle: p.book_title,
      pageURL: p.pageURL
    }));

    console.log(`✅ Found ${pages.length} pages`);
    pages.forEach(page => {
      console.log(`   📖 Page ${page.pageNumber} from "${page.book_title}" (ID: ${page.PageId})`);
    });

    // Step 3: Process OCR for all pages
    console.log('\n🔍 Step 3: Processing OCR for all pages...');
    const ocrResults = [];
    let combinedContext = '';

    for (const page of pages) {
      try {
        console.log(`📄 Processing OCR for Page ${page.pageNumber}...`);
        const ocrText = await processOCR(page.pageURL);
        
        const ocrResult = {
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          success: true,
          text: ocrText,
          textLength: ocrText.length
        };
        
        ocrResults.push(ocrResult);
        combinedContext += `\n--- Page ${page.pageNumber} ---\n${ocrText}\n`;
        
        console.log(`✅ OCR completed for Page ${page.pageNumber}: ${ocrText.length} characters`);
      } catch (error) {
        console.error(`❌ OCR failed for Page ${page.pageNumber}:`, error.message);
        ocrResults.push({
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          success: false,
          error: error.message,
          text: '',
          textLength: 0
        });
      }
    }

    testResults.ocr_results = ocrResults;
    const successfulOCR = ocrResults.filter(r => r.success).length;
    
    console.log(`📊 OCR Summary: ${successfulOCR}/${pages.length} pages processed successfully`);
    console.log(`📝 Total context length: ${combinedContext.length} characters`);

    // Step 4: Test DeepSeek API with context + prompt
    console.log('\n🤖 Step 4: Testing DeepSeek API with context + prompt...');
    const aiResponses = {};

    console.log(`🎯 Using DeepSeek API for model: ${category.ModelName}`);

    // Test DeepSeek API specifically
    try {
      console.log(`🚀 Testing DeepSeek API...`);
      const response = await callDeepSeek(combinedContext, category.Prompt);
      aiResponses.deepseek = { success: true, response, length: response.length };
      console.log(`✅ DeepSeek API successful: ${response.length} characters`);

      testResults.ai_responses.primary = {
        api: 'deepseek',
        success: true,
        response: response,
        length: response.length
      };

    } catch (error) {
      console.error(`❌ DeepSeek API failed:`, error.message);
      testResults.ai_responses.primary = {
        api: 'deepseek',
        success: false,
        error: error.message
      };
      throw error; // Re-throw since this is specifically a DeepSeek test
    }

    // Step 5: Store responses in database (Explanation table)
    console.log('\n💾 Step 5: Storing Responses in database...');
    const databaseStorage = [];
    
    const finalResponse = testResults.ai_responses.primary?.response || 
                         'AI processing failed - no response generated';

    for (const page of pages) {
      try {
        const Response = await sql`
          INSERT INTO "Explanation" (
            "PageId",
            "CategoryId", 
            "Response"
          )
          VALUES (
            ${page.PageId},
            ${HARDCODED_CATEGORY_ID},
            ${finalResponse}
          )
          RETURNING "ExplanationId", "PageId", "CategoryId", "created_at"
        `;

        databaseStorage.push({
          ResponseId: Response[0].ExplanationId,
          pageId: page.PageId,
          categoryId: HARDCODED_CATEGORY_ID,
          success: true,
          created_at: Response[0].created_at
        });

        console.log(`✅ Stored Response for Page ${page.PageId}: ExplanationId ${Response[0].ExplanationId}`);
      } catch (error) {
        console.error(`❌ Failed to store Response for Page ${page.PageId}:`, error.message);
        databaseStorage.push({
          pageId: page.PageId,
          categoryId: HARDCODED_CATEGORY_ID,
          success: false,
          error: error.message
        });
      }
    }

    testResults.database_storage = databaseStorage;

    // Step 6: Store in local storage (JSON file)
    console.log('\n💿 Step 6: Storing DeepSeek results in local storage...');
    const timestamp = Date.now();
    const filename = `deepseek_Response_test_${timestamp}.json`;
    const filepath = path.join(__dirname, '../../test_output', filename);

    testResults.local_storage = {
      filename,
      filepath,
      timestamp
    };

    // Ensure test_output directory exists
    const testOutputDir = path.join(__dirname, '../../test_output');
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    fs.writeFileSync(filepath, JSON.stringify(testResults, null, 2));
    console.log(`✅ Test results saved to: ${filename}`);

    // Summary
    console.log('\n📊 ========== DEEPSEEK TEST SUMMARY ==========');
    console.log(`🎯 Category: ${category.CategoryName} (ID: ${HARDCODED_CATEGORY_ID})`);
    console.log(`🤖 Model: ${category.ModelName}`);
    console.log(`📄 Pages processed: ${pages.length}`);
    console.log(`🔍 OCR successful: ${successfulOCR}/${pages.length}`);
    console.log(`🤖 DeepSeek API: ${testResults.ai_responses.primary?.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`💾 Database storage: ${databaseStorage.filter(d => d.success).length}/${pages.length} successful`);
    console.log(`💿 Local storage: ✅ Saved to ${filename}`);

    return testResults;

  } catch (error) {
    console.error('❌ DeepSeek Response test failed:', error);
    testResults.errors.push(error.message);
    
    // Still save results even if test failed
    const timestamp = Date.now();
    const filename = `deepseek_Response_test_failed_${timestamp}.json`;
    const filepath = path.join(__dirname, '../../test_output', filename);
    
    const testOutputDir = path.join(__dirname, '../../test_output');
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
    
    fs.writeFileSync(filepath, JSON.stringify(testResults, null, 2));
    console.log(`💿 Failed test results saved to: ${filename}`);
    
    throw error;
  }
}

// Export functions for individual testing
module.exports = {
  fetchPagesFromDatabase,
  processOCR,
  callOpenAI,
  callGemini,
  callDeepSeek,
  runComprehensiveTest,
  testOpenAIExplanation,
  testGeminiExplanation,
  testDeepSeekExplanation
};

// Run comprehensive test if this file is executed directly
if (require.main === module) {
  // You can choose which test to run:
  // runComprehensiveTest().catch(console.error);
  
  // Test individual AI models:
  testOpenAIExplanation().catch(console.error);
  // testGeminiExplanation().catch(console.error);
  // testDeepSeekExplanation().catch(console.error);
}
