const { processPdfAndExtractInfo } = require("./server/utils/pdfProcessor.js");
const path = require("path");

async function testPdfProcessing() {
  try {
    console.log("🧪 Testing PDF processing...");

    // Test with a sample PDF path (you'll need to provide an actual PDF)
    const pdfPath = path.join(__dirname, "sample.pdf");

    if (!require("fs").existsSync(pdfPath)) {
      console.log(
        '⚠️ Sample PDF not found. Please place a PDF file named "sample.pdf" in the root directory.'
      );
      console.log(
        "📝 You can test the API directly using the /api/books/create endpoint."
      );
      return;
    }

    const result = await processPdfAndExtractInfo(pdfPath);

    console.log("✅ PDF processing successful!");
    console.log("📖 Book Info:", result.bookInfo);
    console.log("📄 Total Pages:", result.pages.length);
    console.log("☁️ First page URL:", result.pages[0]?.pageURL);
  } catch (error) {
    console.error("❌ PDF processing test failed:", error.message);
    console.log("💡 Make sure you have:");
    console.log("   1. A valid PDF file");
    console.log("   2. Internet connection for Gemini AI and Cloudinary");
    console.log("   3. Valid API keys in server/db.js");
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testPdfProcessing();
}

module.exports = { testPdfProcessing };
