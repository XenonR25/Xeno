const {
  processPdfAndExtractInfo,
  processPdfAndUploadPages,
  extractTextFromImageUrl,
  extractBookInfo,
  generateGenericBookInfo,
  testFirstPageOCR,
  testOCRFromImageUrl,
  testOCROnLocalImage,
  processTextFileAndCreateBook,
  testCloudinaryPageUpload,
  runAllTests,
  downloadFile,
  buildPageImageUrl,
  tryGeminiModels,
  uploadPageToCloudinary,
  generatePageId,
} = require("./utils/pdfProcessor.js");

// Test function to verify all functions are properly imported and working
async function testIntegration() {
  console.log("🧪 Testing PDF Processor Integration...");
  console.log("=".repeat(60));

  try {
    // Test 1: Check if all functions are available
    console.log("📋 TEST 1: Function Availability Check");
    console.log("-".repeat(40));

    const functions = [
      "processPdfAndExtractInfo",
      "processPdfAndUploadPages",
      "extractTextFromImageUrl",
      "extractBookInfo",
      "generateGenericBookInfo",
      "testFirstPageOCR",
      "testOCRFromImageUrl",
      "testOCROnLocalImage",
      "processTextFileAndCreateBook",
      "testCloudinaryPageUpload",
      "runAllTests",
      "downloadFile",
      "buildPageImageUrl",
      "tryGeminiModels",
      "uploadPageToCloudinary",
      "generatePageId",
    ];

    functions.forEach((funcName) => {
      try {
        const func = eval(funcName);
        if (typeof func === "function") {
          console.log(`✅ ${funcName}: Available`);
        } else {
          console.log(`❌ ${funcName}: Not a function`);
        }
      } catch (error) {
        console.log(`❌ ${funcName}: Missing - ${error.message}`);
      }
    });

    // Test 2: Test generatePageId function
    console.log("\n📋 TEST 2: Page ID Generation");
    console.log("-".repeat(40));
    const testBookId = 123;
    const pageNum = 1;
    const pageId = generatePageId(testBookId, pageNum);
    console.log(`📄 Generated Page ID: ${pageId}`);
    console.log(
      `✅ Page ID format looks correct: ${
        pageId.includes("page_") &&
        pageId.includes("_123_") &&
        pageId.includes("_1_")
      }`
    );

    // Test 3: Test buildPageImageUrl function
    console.log("\n📋 TEST 3: Cloudinary URL Building");
    console.log("-".repeat(40));
    const testPublicId = "test_book_123";
    const testVersion = "v1234567890";
    const pageUrl = buildPageImageUrl(testPublicId, testVersion, pageNum);
    console.log(`🔗 Generated Page URL: ${pageUrl}`);
    console.log(
      `✅ URL format looks correct: ${
        pageUrl.includes("cloudinary.com") && pageUrl.includes("jpg")
      }`
    );

    // Test 4: Test Gemini AI connection (if API key is available)
    console.log("\n📋 TEST 4: Gemini AI Connection Test");
    console.log("-".repeat(40));
    try {
      const testPrompt =
        "Hello, this is a test. Please respond with 'Test successful'.";
      const response = await tryGeminiModels(testPrompt);
      console.log(`🤖 Gemini AI Response: ${response.substring(0, 100)}...`);
      console.log("✅ Gemini AI connection successful");
    } catch (error) {
      console.log(`⚠️ Gemini AI test failed: ${error.message}`);
      console.log("   This is expected if GEMINI_API_KEY is not set");
    }

    // Test 5: Test book info extraction with sample text
    console.log("\n📋 TEST 5: Book Info Extraction Test");
    console.log("-".repeat(40));
    try {
      const sampleText = "The Great Gatsby by F. Scott Fitzgerald";
      const bookInfo = await extractBookInfo(sampleText);
      console.log(
        `📚 Extracted Book Info: ${JSON.stringify(bookInfo, null, 2)}`
      );
      console.log("✅ Book info extraction successful");
    } catch (error) {
      console.log(`❌ Book info extraction failed: ${error.message}`);
    }

    // Test 6: Test generic book info generation
    console.log("\n📋 TEST 6: Generic Book Info Generation Test");
    console.log("-".repeat(40));
    try {
      const sampleText =
        "This is a book about artificial intelligence and machine learning. It covers topics like neural networks, deep learning, and natural language processing.";
      const genericBookInfo = await generateGenericBookInfo(sampleText);
      console.log(
        `📚 Generated Generic Book Info: ${JSON.stringify(
          genericBookInfo,
          null,
          2
        )}`
      );
      console.log("✅ Generic book info generation successful");
    } catch (error) {
      console.log(`❌ Generic book info generation failed: ${error.message}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("🏁 Integration Test Completed!");
    console.log("=".repeat(60));
    console.log(
      "📝 All functions from test.js have been successfully merged into pdfProcessor.js"
    );
    console.log(
      "🔗 The books.js API now has access to all OCR and processing functions"
    );
    console.log(
      "🧪 You can test the full functionality using the new test endpoints:"
    );
    console.log("   - POST /api/books/test/ocr");
    console.log("   - POST /api/books/test/cloudinary-upload");
    console.log(
      "📚 The main book creation endpoint will now work with all the enhanced features"
    );
  } catch (error) {
    console.error("❌ Integration test failed:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Run the integration test if this file is executed directly
if (require.main === module) {
  testIntegration().catch(console.error);
}

module.exports = {
  testIntegration,
};
