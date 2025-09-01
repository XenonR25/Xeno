const fs = require("fs");
const path = require("path");
const https = require("https");
const Tesseract = require("tesseract.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cloudinary = require("cloudinary").v2;
const { CLOUDINARY_URL, GEMINI_API_KEY } = require("../db.js");

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

// Extract text from image using OCR (accepts URL)
async function extractTextFromImageUrl(imageUrl) {
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(imageUrl, "eng", {
      logger: (m) => console.log(m),
    });
    return text.trim();
  } catch (error) {
    throw new Error(`OCR failed: ${error.message}`);
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
      publicId: uploadResult.public_id,
      cloudinaryId: uploadResult.asset_id,
    };
  } catch (error) {
    throw new Error(`Failed to upload page ${pageNumber}: ${error.message}`);
  }
}

// Main function to process PDF using Cloudinary-derived images
async function processPdfAndExtractInfo(pdfPath) {
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

    console.log(`✅ Book info extracted: "${bookInfo.bookName}" by ${bookInfo.authorName}`);

    // STEP 2: Process all pages for storage and page records
    console.log("📄 Step 2: Processing all pages for storage...");
    
    // Build URLs for all pages
    const pages = Array.from({ length: totalPages }).map((_, idx) => {
      const pageNumber = idx + 1;
      return {
        pageNumber,
        pageURL: buildPageImageUrl(publicId, version, pageNumber),
        publicId,
      };
    });

    // Save images locally as well
    const localRoot = path.join(__dirname, "../../local_books", `${timestamp}`);
    fs.mkdirSync(localRoot, { recursive: true });

    console.log(`💾 Downloading ${pages.length} pages to local storage...`);
    const downloadTasks = pages.map((p) => {
      const dest = path.join(localRoot, `page-${p.pageNumber}.jpg`);
      return downloadFile(p.pageURL, dest).then(() => {
        p.localPath = dest;
        return dest;
      });
    });

    await Promise.all(downloadTasks);
    console.log(`✅ All ${pages.length} pages downloaded to: ${localRoot}`);

    return { bookInfo, pages, localFolder: localRoot };
  } catch (error) {
    throw error;
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

    console.log(`✅ Book info extracted: "${bookInfo.bookName}" by ${bookInfo.authorName}`);

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

    // Save images locally
    const localRoot = path.join(__dirname, "../../local_books", `${timestamp}`);
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

    // STEP 3: Upload each page individually to Cloudinary with unique IDs
    console.log("☁️ Step 3: Uploading individual pages to Cloudinary...");
    const uploadTasks = pageUrls.map((page) => 
      uploadPageToCloudinary(page.localPath, bookId, page.pageNumber)
    );

    const uploadedPages = await Promise.all(uploadTasks);
    console.log(`✅ All ${uploadedPages.length} pages uploaded to Cloudinary with unique IDs`);

    // Clean up local files
    console.log("🧹 Cleaning up local files...");
    pageUrls.forEach(page => {
      if (page.localPath && fs.existsSync(page.localPath)) {
        try {
          fs.unlinkSync(page.localPath);
        } catch (error) {
          console.warn(`Failed to delete local file ${page.localPath}:`, error.message);
        }
      }
    });

    // Try to remove the local directory if empty
    try {
      if (fs.existsSync(localRoot) && fs.readdirSync(localRoot).length === 0) {
        fs.rmdirSync(localRoot);
      }
    } catch (error) {
      console.warn(`Failed to remove local directory ${localRoot}:`, error.message);
    }

    return { 
      bookInfo, 
      pages: uploadedPages,
      originalPdfPublicId: publicId,
      originalPdfVersion: version
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  processPdfAndExtractInfo,
  processPdfAndUploadPages,
  uploadPageToCloudinary,
  generatePageId,
};
