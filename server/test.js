const fs = require("fs");
const path = require("path");
const https = require("https");
const Tesseract = require("tesseract.js");
const cloudinary = require("cloudinary").v2;
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { CLOUDINARY_URL, GEMINI_API_KEY } = require("./db.js");

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_URL.split("@")[1].split(".")[0],
  api_key: CLOUDINARY_URL.split("//")[1].split(":")[0],
  api_secret: CLOUDINARY_URL.split(":")[2].split("@")[0],
});

// Configure Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Helper: download a file from URL to a destination path
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(
            new Error(`Failed to download ${url}: HTTP ${response.statusCode}`)
          );
        }
        response.pipe(file);
        file.on("finish", () => file.close(() => resolve(destPath)));
      })
      .on("error", (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

// Build Cloudinary URL for a specific page as JPG
function buildPageImageUrl(publicId, version, pageNumber) {
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "image",
    format: "jpg",
    version,
    transformation: [{ page: pageNumber }],
  });
}

// Extract text from image using OCR (accepts URL)
async function extractTextFromImageUrl(imageUrl) {
  try {
    console.log(`🔍 Starting OCR for image: ${imageUrl}`);
    const {
      data: { text },
    } = await Tesseract.recognize(imageUrl, "eng", {
      logger: (m) => console.log(m),
    });
    console.log(
      `✅ OCR completed. Text length: ${text.trim().length} characters`
    );
    return text.trim();
  } catch (error) {
    throw new Error(`OCR failed: ${error.message}`);
  }
}

// Function to test OCR on first page of a PDF
async function testFirstPageOCR(pdfPath) {
  try {
    console.log("🧪 Testing OCR on first page of PDF...");
    console.log("=".repeat(50));

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    console.log(`📁 Processing PDF: ${pdfPath}`);

    // Step 1: Upload PDF to Cloudinary
    console.log("☁️ Uploading PDF to Cloudinary...");
    const uploadResult = await cloudinary.uploader.upload(pdfPath, {
      resource_type: "image",
      folder: "test_ocr",
      use_filename: true,
      unique_filename: true,
    });

    if (!uploadResult || !uploadResult.public_id) {
      throw new Error("Failed to upload PDF to Cloudinary");
    }

    const publicId = uploadResult.public_id;
    const version = uploadResult.version;
    const totalPages = uploadResult.pages || 1;

    console.log(`✅ PDF uploaded. Public ID: ${publicId}`);
    console.log(`📄 Total pages detected: ${totalPages}`);

    // Step 2: Build first page URL
    console.log("🖼️ Building first page image URL...");
    const firstPageUrl = buildPageImageUrl(publicId, version, 1);
    console.log(`🔗 First page URL: ${firstPageUrl}`);

    // Step 3: Extract text using OCR
    console.log("🔍 Extracting text from first page using OCR...");
    const extractedText = await extractTextFromImageUrl(firstPageUrl);

    // Step 4: Display results
    console.log("\n" + "=".repeat(50));
    console.log("📖 OCR RESULTS:");
    console.log("=".repeat(50));
    console.log(`📄 Page: 1 of ${totalPages}`);
    console.log(`📝 Extracted text length: ${extractedText.length} characters`);
    console.log(`🔗 Image URL: ${firstPageUrl}`);
    console.log("\n📋 Extracted Text:");
    console.log("-".repeat(30));
    console.log(extractedText);
    console.log("-".repeat(30));

    // Step 5: Save extracted text to file
    const outputDir = path.join(__dirname, "../test_output");
    fs.mkdirSync(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, `ocr_result_${Date.now()}.txt`);
    fs.writeFileSync(outputFile, extractedText);
    console.log(`💾 Extracted text saved to: ${outputFile}`);

    return {
      success: true,
      extractedText,
      imageUrl: firstPageUrl,
      totalPages,
      outputFile,
      cloudinaryInfo: {
        publicId,
        version,
        folder: "test_ocr",
      },
    };
  } catch (error) {
    console.error("❌ OCR test failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Function to test OCR on a specific image URL
async function testOCRFromImageUrl(imageUrl) {
  try {
    console.log("🧪 Testing OCR from image URL...");
    console.log("=".repeat(50));
    console.log(`🔗 Image URL: ${imageUrl}`);

    const extractedText = await extractTextFromImageUrl(imageUrl);

    console.log("\n" + "=".repeat(50));
    console.log("📖 OCR RESULTS:");
    console.log("=".repeat(50));
    console.log(`📝 Extracted text length: ${extractedText.length} characters`);
    console.log("\n📋 Extracted Text:");
    console.log("-".repeat(30));
    console.log(extractedText);
    console.log("-".repeat(30));

    return {
      success: true,
      extractedText,
      imageUrl,
    };
  } catch (error) {
    console.error("❌ OCR test failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Function to test OCR on a local image file
async function testOCROnLocalImage(imagePath) {
  try {
    console.log("🧪 Testing OCR on local image file...");
    console.log("=".repeat(50));

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    console.log(`📁 Processing image: ${imagePath}`);

    const extractedText = await Tesseract.recognize(imagePath, "eng", {
      logger: (m) => console.log(m),
    });

    const text = extractedText.data.text.trim();

    console.log("\n" + "=".repeat(50));
    console.log("📖 OCR RESULTS:");
    console.log("=".repeat(50));
    console.log(`📝 Extracted text length: ${text.length} characters`);
    console.log("\n📋 Extracted Text:");
    console.log("-".repeat(30));
    console.log(text);
    console.log("-".repeat(30));

    return {
      success: true,
      extractedText: text,
      imagePath,
    };
  } catch (error) {
    console.error("❌ OCR test failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Try Gemini with multiple model fallbacks
async function tryGeminiModels(prompt) {
  const modelCandidates = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.0-pro",
  ];

  let lastError;
  for (const modelName of modelCandidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("All Gemini model attempts failed");
}

// Extract book information using Gemini AI
async function extractBookInfo(text) {
  try {
    const prompt = `
    Analyze the following text extracted from a book cover page and return ONLY a JSON object with the following structure:
    {
      "bookName": "exact book name as it appears",
      "authorName": "exact author name as it appears"
    }

    If you cannot determine the book name or author name, use "Unknown" for that field.
    Return ONLY the JSON object, no additional text or explanation.

    Text to analyze:
    ${text}
    `;

    const textResponse = await tryGeminiModels(prompt);

    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response from Gemini AI");
    }

    const bookInfo = JSON.parse(jsonMatch[0]);

    if (!bookInfo.bookName || !bookInfo.authorName) {
      throw new Error("Incomplete book information from Gemini AI");
    }

    return bookInfo;
  } catch (error) {
    throw new Error(`Gemini AI extraction failed: ${error.message}`);
  }
}

// Generate generic book information based on context
async function generateGenericBookInfo(text) {
  try {
    const prompt = `
    Analyze the following text and generate a generic book name and author based on the context and content.
    Look for themes, topics, or any identifiable content to create meaningful names.
    
    Return ONLY a JSON object with the following structure:
    {
      "bookName": "generated book name based on content",
      "authorName": "generated author name based on context"
    }

    Text to analyze:
    ${text}
    `;

    const textResponse = await tryGeminiModels(prompt);

    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response from Gemini AI");
    }

    const bookInfo = JSON.parse(jsonMatch[0]);

    if (!bookInfo.bookName || !bookInfo.authorName) {
      throw new Error("Incomplete book information from Gemini AI");
    }

    return bookInfo;
  } catch (error) {
    throw new Error(`Generic book info generation failed: ${error.message}`);
  }
}

// Function to process text file and create book record
async function processTextFileAndCreateBook(textFilePath, userId = 1) {
  try {
    console.log("📖 Processing text file and creating book record...");
    console.log("=".repeat(60));

    // Step 1: Read the text file
    if (!fs.existsSync(textFilePath)) {
      throw new Error(`Text file not found: ${textFilePath}`);
    }

    const extractedText = fs.readFileSync(textFilePath, "utf8");
    console.log(`📄 Read text file: ${textFilePath}`);
    console.log(`📝 Text length: ${extractedText.length} characters`);

    // Step 2: Try to extract book information using Gemini AI
    console.log("🤖 Attempting to extract book information from text...");
    let bookInfo;
    try {
      bookInfo = await extractBookInfo(extractedText);
      console.log("✅ Successfully extracted book information:");
      console.log(`   Book Name: ${bookInfo.bookName}`);
      console.log(`   Author: ${bookInfo.authorName}`);
    } catch (error) {
      console.log(
        "⚠️ Could not extract specific book information, generating generic names..."
      );
      console.log(`   Error: ${error.message}`);

      // Step 3: Generate generic book information
      bookInfo = await generateGenericBookInfo(extractedText);
      console.log("✅ Generated generic book information:");
      console.log(`   Book Name: ${bookInfo.bookName}`);
      console.log(`   Author: ${bookInfo.authorName}`);
    }

    // Step 4: Create book record in database
    console.log("💾 Creating book record in database...");
    const postgres = require("postgres");
    const { DATABASE_URL } = require("./db.js");

    const sql = postgres(DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    const newBook = await sql`
      INSERT INTO "Books" ("Name", "author", "UserId")
      VALUES (${bookInfo.bookName}, ${bookInfo.authorName}, ${userId})
      RETURNING "BookId", "Name", "author", "created_at", "uploaded_at"
    `;

    if (newBook.length === 0) {
      throw new Error("Failed to create book record");
    }

    const bookId = newBook[0].BookId;
    console.log(`✅ Book created successfully!`);
    console.log(`   Book ID: ${bookId}`);
    console.log(`   Name: ${newBook[0].Name}`);
    console.log(`   Author: ${newBook[0].author}`);
    console.log(`   Created: ${newBook[0].created_at}`);

    return {
      success: true,
      book: newBook[0],
      extractedText: extractedText.substring(0, 200) + "...", // First 200 chars
      processingInfo: {
        textFile: textFilePath,
        textLength: extractedText.length,
        bookInfoSource:
          bookInfo.bookName === "Unknown" ? "generic" : "extracted",
      },
    };
  } catch (error) {
    console.error(
      "❌ Failed to process text file and create book:",
      error.message
    );
    return {
      success: false,
      error: error.message,
    };
  }
}

// Generate unique page ID
function generatePageId(bookId, pageNumber) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `page_${bookId}_${pageNumber}_${timestamp}_${random}`;
}

// Upload individual page JPG to Cloudinary and create unique ID
async function uploadPageToCloudinary(imagePath, bookId, pageNumber) {
  try {
    const pageId = generatePageId(bookId, pageNumber);
    const cloudFolderName = `books/${bookId}/pages`;

    // Upload the page image to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(imagePath, {
      resource_type: "image",
      folder: cloudFolderName,
      public_id: pageId,
      use_filename: false,
      unique_filename: false,
      overwrite: false,
    });

    if (!uploadResult || !uploadResult.secure_url) {
      throw new Error(`Failed to upload page ${pageNumber} to Cloudinary`);
    }

    return {
      pageId,
      pageNumber,
      pageURL: uploadResult.secure_url,
      cloudinaryId: uploadResult.asset_id,
    };
  } catch (error) {
    throw new Error(`Failed to upload page ${pageNumber}: ${error.message}`);
  }
}

// Process PDF and upload all pages individually to Cloudinary
async function processPdfAndUploadPages(pdfPath, bookId) {
  try {
    const timestamp = Date.now();
    const cloudFolderName = `books/${timestamp}`;

    // Upload PDF to Cloudinary (as image resource, Cloudinary supports PDFs)
    const uploadResult = await cloudinary.uploader.upload(pdfPath, {
      resource_type: "image",
      folder: cloudFolderName,
      use_filename: true,
      unique_filename: true,
    });

    if (!uploadResult || !uploadResult.public_id) {
      throw new Error("Failed to upload PDF to Cloudinary");
    }

    const publicId = uploadResult.public_id;
    const version = uploadResult.version;
    const totalPages = uploadResult.pages || 1;

    // STEP 1: Process only the first page (cover) for book information
    console.log("📖 Step 1: Processing cover page for book information...");
    const coverUrl = buildPageImageUrl(publicId, version, 1);

    // Extract text from cover page
    console.log("🔍 Extracting text from Cloudinary cover image...");
    const coverText = await extractTextFromImageUrl(coverUrl);

    // Extract book information using Gemini AI
    console.log("🤖 Analyzing book information with Gemini AI...");
    const bookInfo = await extractBookInfo(coverText);

    console.log(
      `✅ Book info extracted: "${bookInfo.bookName}" by ${bookInfo.authorName}`
    );

    // STEP 2: Download all pages locally first
    console.log("📄 Step 2: Downloading all pages locally...");

    // Build URLs for all pages
    const pageUrls = Array.from({ length: totalPages }).map((_, idx) => {
      const pageNumber = idx + 1;
      return {
        pageNumber,
        pageURL: buildPageImageUrl(publicId, version, pageNumber),
      };
    });

    // Save images locally - KEEP THEM in local_books folder
    const localRoot = path.join(__dirname, "../local_books", `${timestamp}`);
    fs.mkdirSync(localRoot, { recursive: true });

    console.log(`💾 Downloading ${pageUrls.length} pages to local storage...`);
    const downloadTasks = pageUrls.map((p) => {
      const dest = path.join(localRoot, `page-${p.pageNumber}.jpg`);
      return downloadFile(p.pageURL, dest).then(() => {
        p.localPath = dest;
        return dest;
      });
    });

    await Promise.all(downloadTasks);
    console.log(`✅ All ${pageUrls.length} pages downloaded to: ${localRoot}`);
    console.log(`📁 Local images saved in: ${localRoot}`);

    // STEP 3: Upload each page individually to Cloudinary with unique IDs
    console.log("☁️ Step 3: Uploading individual pages to Cloudinary...");
    const uploadTasks = pageUrls.map((page) =>
      uploadPageToCloudinary(page.localPath, bookId, page.pageNumber)
    );

    const uploadedPages = await Promise.all(uploadTasks);
    console.log(
      `✅ All ${uploadedPages.length} pages uploaded to Cloudinary with unique IDs`
    );

    // DON'T clean up local files - keep them for user access
    console.log(
      "💾 Keeping local images in local_books folder for user access"
    );

    return {
      bookInfo,
      pages: uploadedPages,
      localImagesPath: localRoot,
      originalPdfPublicId: publicId,
      originalPdfVersion: version,
    };
  } catch (error) {
    throw error;
  }
}

// Test function for Cloudinary page upload functionality
async function testCloudinaryPageUpload(pdfPath, bookId = null) {
  try {
    console.log("🧪 Testing Cloudinary page upload functionality...");
    console.log("=".repeat(60));

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    console.log(`📁 Processing PDF: ${pdfPath}`);

    // Generate a temporary book ID for testing if none provided
    const tempBookId = bookId || Math.floor(Math.random() * 10000) + 1000;
    console.log(`📚 Book ID for testing: ${tempBookId}`);

    // Test the generatePageId function first
    const testPageId = generatePageId(tempBookId, 1);
    console.log(`✅ Generated test page ID: ${testPageId}`);

    // Process PDF and upload all pages individually
    const result = await processPdfAndUploadPages(pdfPath, tempBookId);

    console.log("\n" + "=".repeat(60));
    console.log("📖 CLOUDINARY PAGE UPLOAD RESULTS:");
    console.log("=".repeat(60));
    console.log(
      `📚 Book: "${result.bookInfo.bookName}" by ${result.bookInfo.authorName}`
    );
    console.log(`📄 Total pages processed: ${result.pages.length}`);
    console.log(`☁️ Original PDF Public ID: ${result.originalPdfPublicId}`);
    console.log(`🔢 Original PDF Version: ${result.originalPdfVersion}`);
    console.log(`📁 Local images saved in: ${result.localImagesPath}`);

    console.log("\n📋 Individual Page Details:");
    console.log("-".repeat(40));
    result.pages.forEach((page, index) => {
      console.log(`Page ${page.pageNumber}:`);
      console.log(`  📄 Unique ID: ${page.pageId}`);
      console.log(`  🔗 URL: ${page.pageURL}`);
      console.log(`  ☁️ Cloudinary ID: ${page.cloudinaryId}`);
      console.log("");
    });

    // STEP 4: Store book and pages in Supabase database
    console.log("\n💾 STEP 4: Storing data in Supabase database...");
    const postgres = require("postgres");
    const { DATABASE_URL } = require("./db.js");

    const sql = postgres(DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    try {
      // Create book record in database
      console.log("📝 Creating book record in database...");
      const newBook = await sql`
        INSERT INTO "Books" ("Name", "author", "UserId")
        VALUES (${result.bookInfo.bookName}, ${result.bookInfo.authorName}, 1)
        RETURNING "BookId", "Name", "author", "created_at", "uploaded_at"
      `;

      if (newBook.length === 0) {
        throw new Error("Failed to create book record in database");
      }

      const actualBookId = newBook[0].BookId;
      console.log(`✅ Book created in database with ID: ${actualBookId}`);

      // Create page records for all uploaded pages
      console.log("📄 Creating page records in database...");
      const pageResults = await Promise.all(
        result.pages.map(
          (page) =>
            sql`
          INSERT INTO "Pages" ("pageNumber", "pageURL", "PageId", "cloudinaryId", "BookId")
          VALUES (${page.pageNumber}, ${page.pageURL}, ${page.pageId}, ${page.cloudinaryId}, ${actualBookId})
          RETURNING "PageId", "pageNumber", "pageURL", "PageId", "cloudinaryId"
        `
        )
      );

      console.log(`✅ Created ${pageResults.length} page records in database`);
      console.log("🎉 All data successfully stored in Supabase!");

      // Update result with database info
      result.databaseInfo = {
        bookId: actualBookId,
        pagesCreated: pageResults.length,
        bookRecord: newBook[0],
        pageRecords: pageResults.map((r) => r[0]),
      };
    } catch (dbError) {
      console.error("❌ Database operation failed:", dbError.message);
      console.log(
        "⚠️ Cloudinary upload successful, but database storage failed"
      );
      result.databaseError = dbError.message;
    } finally {
      await sql.end();
    }

    // Save results to file
    const outputDir = path.join(__dirname, "../test_output");
    fs.mkdirSync(outputDir, { recursive: true });

    const outputFile = path.join(
      outputDir,
      `cloudinary_pages_result_${Date.now()}.json`
    );
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`💾 Results saved to: ${outputFile}`);

    return {
      success: true,
      result,
      outputFile,
    };
  } catch (error) {
    console.error("❌ Cloudinary page upload test failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Main test function
async function runAllTests() {
  console.log("🚀 Starting OCR Test Suite...");
  console.log("=".repeat(60));

  // Test 1: OCR on first page of PDF
  console.log("\n📋 TEST 1: OCR on first page of PDF");
  console.log("-".repeat(40));
  const pdfPath = "./assets/sample.pdf"; // Update this path to your test PDF
  const pdfResult = await testFirstPageOCR(pdfPath);

  if (pdfResult.success) {
    console.log("✅ PDF OCR test completed successfully!");
  } else {
    console.log("❌ PDF OCR test failed!");
  }

  // Test 2: OCR on specific image URL (if you have one)
  console.log("\n📋 TEST 2: OCR on specific image URL");
  console.log("-".repeat(40));
  const imageUrl = "https://example.com/test-image.jpg"; // Update with actual URL
  console.log(
    "⚠️ Skipping URL test - update imageUrl variable with actual URL"
  );
  // const urlResult = await testOCRFromImageUrl(imageUrl);

  // Test 3: OCR on local image file (if you have one)
  console.log("\n📋 TEST 3: OCR on local image file");
  console.log("-".repeat(40));
  const localImagePath = "./assets/test-image.jpg"; // Update this path to your test image
  console.log(
    "⚠️ Skipping local image test - update localImagePath variable with actual path"
  );
  // const localResult = await testOCROnLocalImage(localImagePath);

  // Test 4: Process text file and create book record
  console.log("\n📋 TEST 4: Process text file and create book record");
  console.log("-".repeat(40));
  const textFilePath = "./test_output/ocr_result_1756732529790.txt"; // Update this path to your text file
  const bookResult = await processTextFileAndCreateBook(textFilePath, 1);

  if (bookResult.success) {
    console.log("✅ Book creation test completed successfully!");
  } else {
    console.log("❌ Book creation test failed!");
  }

  // Test 5: Cloudinary page upload functionality
  console.log("\n📋 TEST 5: Cloudinary page upload functionality");
  console.log("-".repeat(40));
  const cloudinaryResult = await testCloudinaryPageUpload(pdfPath);

  if (cloudinaryResult.success) {
    console.log("✅ Cloudinary page upload test completed successfully!");
  } else {
    console.log("❌ Cloudinary page upload test failed!");
  }

  console.log("\n" + "=".repeat(60));
  console.log("🏁 OCR Test Suite completed!");
}

// Export functions for individual testing
module.exports = {
  testFirstPageOCR,
  testOCRFromImageUrl,
  testOCROnLocalImage,
  extractTextFromImageUrl,
  extractBookInfo,
  generateGenericBookInfo,
  processTextFileAndCreateBook,
  generatePageId,
  uploadPageToCloudinary,
  processPdfAndUploadPages,
  testCloudinaryPageUpload,
  runAllTests,
  testGeminiAPIKey,
};

// Test Gemini API key functionality
async function testGeminiAPIKey() {
  console.log("🧪 Testing Gemini API Key Functionality...");
  console.log("=".repeat(50));
  
  try {
    // Check if API key is configured
    console.log(`🔑 API Key Status: ${GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not found in environment variables");
    }
    
    // Test with a simple prompt
    const testPrompt = "Hello! Please respond with 'Gemini API is working correctly' to confirm the connection.";
    
    console.log("🤖 Testing Gemini API with simple prompt...");
    console.log(`📝 Test prompt: "${testPrompt}"`);
    
    const response = await tryGeminiModels(testPrompt);
    
    console.log("✅ Gemini API test successful!");
    console.log(`📄 Response length: ${response.length} characters`);
    console.log(`💬 Response: "${response}"`);
    
    return {
      success: true,
      response,
      apiKeyConfigured: true
    };
    
  } catch (error) {
    console.error("❌ Gemini API test failed:", error.message);
    
    // Additional debugging info
    if (error.message.includes('API_KEY_INVALID')) {
      console.log("🔍 Diagnosis: API key appears to be invalid");
    } else if (error.message.includes('quota')) {
      console.log("🔍 Diagnosis: API quota may be exceeded");
    } else if (error.message.includes('network')) {
      console.log("🔍 Diagnosis: Network connectivity issue");
    }
    
    return {
      success: false,
      error: error.message,
      apiKeyConfigured: !!GEMINI_API_KEY
    };
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  // Test Gemini API key first
  testGeminiAPIKey().then(result => {
    if (result.success) {
      console.log("\n🎉 Gemini API key test passed! Running full test suite...\n");
      return runAllTests();
    } else {
      console.log("\n⚠️ Gemini API key test failed. Skipping full test suite.");
      console.log("Please check your API key configuration before running full tests.");
    }
  }).catch(console.error);
}
