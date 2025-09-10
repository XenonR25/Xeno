const express = require("express");
const postgres = require("postgres");
const { DATABASE_URL } = require("../db.js");
const { authenticateToken } = require("../utils/auth.js");
const Tesseract = require("tesseract.js");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// OCR processing function
async function processOCR(imageUrl, pageNumber) {
  try {
    console.log(`🔍 [OCR] Starting OCR processing for Page ${pageNumber}`);
    console.log(`📷 [OCR] Image URL: ${imageUrl}`);
    
    const { data: { text } } = await Tesseract.recognize(imageUrl, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`📖 [OCR] Page ${pageNumber} - Recognizing text: ${Math.round(m.progress * 100)}%`);
        } else {
          console.log(`🔄 [OCR] Page ${pageNumber} - ${m.status}: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    console.log(`✅ [OCR] Page ${pageNumber} completed - Extracted ${text.length} characters`);
    console.log(`📝 [OCR] Page ${pageNumber} preview: "${text.substring(0, 100)}..."`);
    return text.trim();
  } catch (error) {
    console.error(`❌ [OCR] Page ${pageNumber} processing error:`, error);
    throw new Error(`OCR failed for page ${pageNumber}: ${error.message}`);
  }
}

// Get API keys from environment
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Configure Gemini AI
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// AI API integration functions
async function callOpenAI(context, prompt) {
  try {
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

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API error:", error);
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
      const model = genAI.getGenerativeModel({ model: modelName });
      const fullPrompt = `Context: ${context}\n\nPrompt: ${prompt}`;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("All Gemini model attempts failed");
}

async function callGemini(context, prompt) {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not found in environment variables");
    }

    if (!genAI) {
      throw new Error("Gemini AI not initialized");
    }

    const response = await tryGeminiModels(context, prompt);
    return response;
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(`Gemini API failed: ${error.message}`);
  }
}

async function callDeepSeek(context, prompt) {
  try {
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

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("DeepSeek API error:", error);
    throw new Error(`DeepSeek API failed: ${error.message}`);
  }
}

/**
 * @swagger
 * /api/explanations/generate:
 *   post:
 *     summary: Generate explanation from multiple pages using OCR and AI
 *     tags: [Explanations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pageIds
 *               - categoryId
 *             properties:
 *               pageIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of Page IDs to process
 *               categoryId:
 *                 type: integer
 *                 description: Category ID (contains Model and Prompt info)
 *     responses:
 *       201:
 *         description: Explanation generated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/generate", authenticateToken, async (req, res) => {
  try {
    const { pageIds, categoryId, bookId, pageNumbers } = req.body;

    // Validate required fields
    if ((!pageIds || !Array.isArray(pageIds) || pageIds.length === 0) && 
        (!(bookId && pageNumbers && Array.isArray(pageNumbers) && pageNumbers.length > 0)) || 
        !categoryId) {
      return res.status(400).json({
        status: "error",
        message: "Provide either pageIds (array) or (bookId and pageNumbers array), and a valid categoryId",
      });
    }

    console.log(`🔧 Generating explanation - incoming payload:`);
    console.log(`   • pageIds: ${Array.isArray(pageIds) ? pageIds.join(',') : 'N/A'}`);
    console.log(`   • bookId: ${bookId ?? 'N/A'}`);
    console.log(`   • pageNumbers: ${Array.isArray(pageNumbers) ? pageNumbers.join(',') : 'N/A'}`);
    console.log(`   • categoryId: ${categoryId}`);

    // Get category with model and prompt info
    const category = await sql`
      SELECT c."CategoryId", c."Name" as "CategoryName", c."Description" as "CategoryDescription",
             m."ModelId", m."ModelName", m."Description" as "ModelDescription",
             p."PromptId", p."Prompt"
      FROM "Category" c
      JOIN "Model" m ON c."ModelId" = m."ModelId"
      JOIN "Prompting" p ON c."PromptId" = p."PromptId"
      WHERE c."CategoryId" = ${parseInt(categoryId)}
    `;

    if (category.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid categoryId - Category not found",
      });
    }

    const categoryInfo = category[0];

    // Resolve pages to process
    let pages = [];
    if (pageIds && Array.isArray(pageIds) && pageIds.length > 0) {
      console.log(`🔍 [DEBUG] Searching for pages with PageIds:`, pageIds);
      console.log(`🔍 [DEBUG] PageIds types:`, pageIds.map(id => typeof id));
      
      // Get pages by PageId list - handle both string and integer PageIds
      pages = await sql`
        SELECT "PageId", "pageNumber", "pageURL", "BookId"
        FROM "Pages"
        WHERE "PageId" = ANY(${pageIds})
        ORDER BY "pageNumber"
      `;
      
      console.log(`🔍 [DEBUG] Found ${pages.length} pages in database`);
      if (pages.length > 0) {
        console.log(`🔍 [DEBUG] Found pages:`, pages.map(p => ({ PageId: p.PageId, pageNumber: p.pageNumber, BookId: p.BookId })));
      }
    } else if (bookId && pageNumbers && Array.isArray(pageNumbers) && pageNumbers.length > 0) {
      // Get pages by bookId and pageNumbers
      pages = await sql`
        SELECT "PageId", "pageNumber", "pageURL", "BookId"
        FROM "Pages"
        WHERE "BookId" = ${parseInt(bookId)} AND "pageNumber" = ANY(${pageNumbers.map(n => parseInt(n))})
        ORDER BY "pageNumber"
      `;
    }

    if (pages.length === 0) {
      console.log(`❌ [DEBUG] No pages found. Checking all pages in database...`);
      const allPages = await sql`SELECT "PageId", "pageNumber", "BookId" FROM "Pages" LIMIT 10`;
      console.log(`🔍 [DEBUG] Sample pages in database:`, allPages);
      
      return res.status(400).json({
        status: "error",
        message: "No valid pages found for the provided pageIds",
        debug: {
          requestedPageIds: pageIds,
          samplePagesInDb: allPages
        }
      });
    }

    console.log(`📄 [PROCESS] Starting OCR processing for ${pages.length} pages`);
    console.log(`📋 [PROCESS] Pages to process: ${pages.map(p => `Page ${p.pageNumber} (ID: ${p.PageId})`).join(', ')}`);

    // Process OCR for all pages
    const ocrResults = [];
    let successfulOCR = 0;
    let failedOCR = 0;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      console.log(`\n🔄 [PROCESS] Processing page ${i + 1}/${pages.length} - Page ${page.pageNumber} (ID: ${page.PageId})`);
      
      try {
        const pageText = await processOCR(page.pageURL, page.pageNumber);
        ocrResults.push({
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          extractedText: pageText,
          status: 'success'
        });
        successfulOCR++;
        console.log(`✅ [PROCESS] Page ${page.pageNumber} OCR completed successfully`);
      } catch (error) {
        console.error(`❌ [PROCESS] OCR failed for page ${page.PageId}:`, error);
        const errorText = `[OCR Error: ${error.message}]`;
        ocrResults.push({
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          extractedText: errorText,
          status: 'failed'
        });
        failedOCR++;
      }
    }

    console.log(`\n📊 [OCR SUMMARY] OCR processing completed:`);
    console.log(`   ✅ Successful: ${successfulOCR} pages`);
    console.log(`   ❌ Failed: ${failedOCR} pages`);

    console.log(`\n🤖 [AI] Starting individual AI processing for each page`);
    console.log(`🎯 [AI] Selected model: ${categoryInfo.ModelName}`);
    console.log(`💭 [AI] Using prompt: "${categoryInfo.Prompt.substring(0, 100)}..."`);
    console.log(`🔗 [AI] Category: ${categoryInfo.CategoryName} - ${categoryInfo.CategoryDescription}`);

    // Helper function to call AI API based on model type
    const callAIModel = async (context, prompt) => {
      const modelType = categoryInfo.ModelName.toLowerCase();
      
      if (modelType.includes('gpt') || modelType.includes('chatgpt') || modelType.includes('openai')) {
        return await callOpenAI(context, prompt);
      } else if (modelType.includes('gemini')) {
        return await callGemini(context, prompt);
      } else if (modelType.includes('deepseek')) {
        return await callDeepSeek(context, prompt);
      } else {
        console.log(`⚠️ [AI] Unknown model type: ${modelType}, using fallback`);
        if (OPENAI_API_KEY) {
          return await callOpenAI(context, prompt);
        } else if (GEMINI_API_KEY) {
          return await callGemini(context, prompt);
        } else if (DEEPSEEK_API_KEY) {
          return await callDeepSeek(context, prompt);
        } else {
          throw new Error("No API keys available for AI processing");
        }
      }
    };

    // Generate individual explanations for each page
    console.log(`\n💾 [DATABASE] Starting to generate and store individual explanations`);
    console.log(`📊 [DATABASE] Will create ${ocrResults.length} explanation records`);
    
    const explanations = [];
    for (let i = 0; i < ocrResults.length; i++) {
      const ocrResult = ocrResults[i];
      const page = pages.find(p => p.PageId === ocrResult.pageId);
      
      console.log(`🤖 [AI] Processing page ${i + 1}/${ocrResults.length} - Page ${ocrResult.pageNumber} (ID: ${ocrResult.pageId})`);
      
      let aiResponse;
      try {
        // Create individual context for this page
        const pageContext = `Page ${ocrResult.pageNumber} content:\n${ocrResult.extractedText}`;
        
        console.log(`📤 [AI] Sending individual page context to ${categoryInfo.ModelName}`);
        console.log(`📄 [AI] Page context length: ${pageContext.length} characters`);
        
        aiResponse = await callAIModel(pageContext, categoryInfo.Prompt);
        console.log(`✅ [AI] Individual response received for page ${ocrResult.pageNumber}`);
        console.log(`📝 [AI] Response length: ${aiResponse.length} characters`);
        
      } catch (error) {
        console.error(`❌ [AI] AI API call failed for page ${ocrResult.pageNumber}:`, error);
        aiResponse = `AI processing failed for page ${ocrResult.pageNumber}: ${error.message}. OCR ${ocrResult.status === 'success' ? 'was successful' : 'failed'}.`;
        console.log(`🔄 [AI] Using fallback response for page ${ocrResult.pageNumber}`);
      }

      // Store explanation for this specific page
      console.log(`💾 [DATABASE] Inserting explanation ${i + 1}/${ocrResults.length} for Page ${ocrResult.pageNumber} (ID: ${ocrResult.pageId})`);
      
      try {
        const newExplanation = await sql`
          INSERT INTO "Explanation" (
            "Response", "CategoryId", "PageId"
          )
          VALUES (
            ${aiResponse}, ${parseInt(categoryId)}, ${ocrResult.pageId}
          )
          RETURNING "ExplanationId", "Response", "CategoryId", "PageId", "created_at"
        `;
        explanations.push(newExplanation[0]);
        console.log(`✅ [DATABASE] Explanation ${i + 1} stored successfully - ID: ${newExplanation[0].ExplanationId}`);
      } catch (dbError) {
        console.error(`❌ [DATABASE] Failed to store explanation for Page ${ocrResult.pageId}:`, dbError);
        throw dbError;
      }
    }
    
    console.log(`🎉 [DATABASE] All explanations stored successfully!`);
    console.log(`📈 [DATABASE] Total explanations created: ${explanations.length}`);

    console.log(`\n🎯 [SUMMARY] Explanation generation completed successfully!`);
    console.log(`📊 [SUMMARY] Processing statistics:`);
    console.log(`   📄 Pages processed: ${pages.length}`);
    console.log(`   ✅ OCR successful: ${successfulOCR}`);
    console.log(`   ❌ OCR failed: ${failedOCR}`);
    console.log(`   💾 Explanations stored: ${explanations.length}`);
    console.log(`   🤖 AI model used: ${categoryInfo.ModelName}`);

    return res.status(201).json({
      status: "success",
      message: "Explanations generated successfully",
      data: {
        explanations: explanations,
        category: categoryInfo,
        processedPages: pages.length,
        ocrResults: ocrResults,
        statistics: {
          totalPages: pages.length,
          successfulOCR: successfulOCR,
          failedOCR: failedOCR,
          explanationsGenerated: explanations.length
        }
      },
    });
  } catch (error) {
    console.error("Generate explanation error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to generate explanation",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/explanations:
 *   get:
 *     summary: Get all explanations
 *     tags: [Explanations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *         description: Filter by Category ID
 *       - in: query
 *         name: pageId
 *         schema:
 *           type: integer
 *         description: Filter by Page ID
 *     responses:
 *       200:
 *         description: Explanations retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { categoryId, pageId } = req.query;

    console.log(`🔍 Fetching explanations with filters - CategoryId: ${categoryId}, PageId: ${pageId}`);

    let query = sql`
      SELECT e."ExplanationId", e."Response", e."CategoryId", e."PageId", e."created_at",
             c."Name" as "CategoryName", c."Description" as "CategoryDescription",
             p."pageNumber", p."pageURL"
      FROM "Explanation" e
      LEFT JOIN "Category" c ON e."CategoryId" = c."CategoryId"
      LEFT JOIN "Pages" p ON e."PageId" = p."PageId"
    `;

    // Add filters if provided
    const conditions = [];
    if (categoryId) {
      conditions.push(sql`e."CategoryId" = ${parseInt(categoryId)}`);
    }
    if (pageId) {
      conditions.push(sql`e."PageId" = ${parseInt(pageId)}`);
    }

    if (conditions.length > 0) {
      query = sql`${query} WHERE ${sql.join(conditions, sql` AND `)}`;
    }

    query = sql`${query} ORDER BY e."created_at" DESC`;

    const explanations = await query;

    console.log(`✅ Retrieved ${explanations.length} explanations`);

    return res.json({
      status: "success",
      data: {
        explanations: explanations,
        total: explanations.length,
        filters: { categoryId, pageId },
      },
    });
  } catch (error) {
    console.error("Get explanations error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/explanations/{explanationId}:
 *   get:
 *     summary: Get a specific explanation by ID
 *     tags: [Explanations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: explanationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Explanation ID
 *     responses:
 *       200:
 *         description: Explanation retrieved successfully
 *       404:
 *         description: Explanation not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/:explanationId", authenticateToken, async (req, res) => {
  try {
    const { explanationId } = req.params;

    console.log(`🔍 Fetching explanation ${explanationId}`);

    const explanation = await sql`
      SELECT e."ExplanationId", e."Response", e."CategoryId", e."PageId", e."created_at",
             c."Name" as "CategoryName", c."Description" as "CategoryDescription",
             p."pageNumber", p."pageURL",
             m."ModelName", pr."Prompt"
      FROM "Explanation" e
      LEFT JOIN "Category" c ON e."CategoryId" = c."CategoryId"
      LEFT JOIN "Pages" p ON e."PageId" = p."PageId"
      LEFT JOIN "Model" m ON c."ModelId" = m."ModelId"
      LEFT JOIN "Prompting" pr ON c."PromptId" = pr."PromptId"
      WHERE e."ExplanationId" = ${parseInt(explanationId)}
    `;

    if (explanation.length === 0) {
      console.log(`❌ Explanation not found: ${explanationId}`);
      return res.status(404).json({
        status: "error",
        message: "Explanation not found",
      });
    }

    console.log(`✅ Explanation found: ${explanation[0].ExplanationId}`);

    return res.json({
      status: "success",
      data: explanation[0],
    });
  } catch (error) {
    console.error("Get explanation error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/explanations/{explanationId}:
 *   put:
 *     summary: Update an explanation
 *     tags: [Explanations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: explanationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Explanation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Response:
 *                 type: string
 *     responses:
 *       200:
 *         description: Explanation updated successfully
 *       404:
 *         description: Explanation not found
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put("/:explanationId", authenticateToken, async (req, res) => {
  try {
    const { explanationId } = req.params;
    const { Response } = req.body;

    console.log(`🔧 Updating explanation ${explanationId}`);

    // Check if explanation exists
    const existingExplanation = await sql`
      SELECT "ExplanationId" FROM "Explanation" 
      WHERE "ExplanationId" = ${parseInt(explanationId)}
    `;

    if (existingExplanation.length === 0) {
      console.log(`❌ Explanation not found: ${explanationId}`);
      return res.status(404).json({
        status: "error",
        message: "Explanation not found",
      });
    }

    // Update explanation
    const updatedExplanation = await sql`
      UPDATE "Explanation" 
      SET "Response" = ${Response}
      WHERE "ExplanationId" = ${parseInt(explanationId)}
      RETURNING "ExplanationId", "Response", "CategoryId", "PageId", "created_at"
    `;

    console.log(`✅ Explanation updated successfully: ${updatedExplanation[0].ExplanationId}`);

    return res.json({
      status: "success",
      message: "Explanation updated successfully",
      data: updatedExplanation[0],
    });
  } catch (error) {
    console.error("Update explanation error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to update explanation",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/explanations/{explanationId}:
 *   delete:
 *     summary: Delete an explanation
 *     tags: [Explanations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: explanationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Explanation ID
 *     responses:
 *       200:
 *         description: Explanation deleted successfully
 *       404:
 *         description: Explanation not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete("/:explanationId", authenticateToken, async (req, res) => {
  try {
    const { explanationId } = req.params;

    console.log(`🗑️ Deleting explanation ${explanationId}`);

    // Check if explanation exists
    const existingExplanation = await sql`
      SELECT "ExplanationId" FROM "Explanation" 
      WHERE "ExplanationId" = ${parseInt(explanationId)}
    `;

    if (existingExplanation.length === 0) {
      console.log(`❌ Explanation not found: ${explanationId}`);
      return res.status(404).json({
        status: "error",
        message: "Explanation not found",
      });
    }

    // Delete explanation
    const deletedExplanation = await sql`
      DELETE FROM "Explanation" 
      WHERE "ExplanationId" = ${parseInt(explanationId)}
      RETURNING "ExplanationId", "Response"
    `;

    console.log(`✅ Explanation deleted: ${deletedExplanation[0].ExplanationId}`);

    return res.json({
      status: "success",
      message: "Explanation deleted successfully",
      data: deletedExplanation[0],
    });
  } catch (error) {
    console.error("Delete explanation error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete explanation",
      error: error.message,
    });
  }
});

module.exports = router;
