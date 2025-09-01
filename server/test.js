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
  runAllTests,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
