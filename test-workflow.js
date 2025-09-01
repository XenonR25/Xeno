const { processPdfAndExtractInfo } = require("./server/utils/pdfProcessor.js");

async function testWorkflow() {
  try {
    console.log("🧪 Testing sequential PDF processing workflow...");
    console.log("=".repeat(50));

    // Test with a sample PDF (you'll need to provide one)
    const pdfPath = "./sample.pdf"; // Update this path to your test PDF

    console.log(`📁 Processing PDF: ${pdfPath}`);

    const result = await processPdfAndExtractInfo(pdfPath);

    console.log("\n✅ Workflow completed successfully!");
    console.log("=".repeat(50));
    console.log("📖 Book Information:");
    console.log(`   Name: ${result.bookInfo.bookName}`);
    console.log(`   Author: ${result.bookInfo.authorName}`);
    console.log(`\n📄 Pages processed: ${result.pages.length}`);
    console.log(`💾 Local folder: ${result.localFolder}`);

    console.log("\n🔗 Sample page URLs:");
    result.pages.slice(0, 3).forEach((page, index) => {
      console.log(`   Page ${page.pageNumber}: ${page.pageURL}`);
    });

    if (result.pages.length > 3) {
      console.log(`   ... and ${result.pages.length - 3} more pages`);
    }
  } catch (error) {
    console.error("❌ Workflow test failed:", error.message);
  }
}

// Run the test
testWorkflow();
