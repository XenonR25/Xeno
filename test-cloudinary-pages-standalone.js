const { testCloudinaryPageUpload } = require("./server/test.js");

async function runCloudinaryTest() {
  try {
    console.log("🚀 Starting Cloudinary Page Upload Test...");
    console.log("=".repeat(60));

    // Test with the sample PDF
    const pdfPath = "./assets/sample.pdf";
    const testBookId = 123;

    console.log(`📄 Testing with PDF: ${pdfPath}`);
    console.log(`📚 Using test book ID: ${testBookId}`);

    const result = await testCloudinaryPageUpload(pdfPath, testBookId);

    if (result.success) {
      console.log("\n🎉 Test completed successfully!");
      console.log(`📁 Results saved to: ${result.outputFile}`);

      console.log("\n📋 Summary:");
      console.log(
        `   📚 Book: "${result.result.bookInfo.bookName}" by ${result.result.bookInfo.authorName}`
      );
      console.log(`   📄 Total pages: ${result.result.pages.length}`);
      console.log(
        `   ☁️ Original PDF ID: ${result.result.originalPdfPublicId}`
      );

      console.log("\n📋 Page Details:");
      result.result.pages.forEach((page, index) => {
        console.log(`   Page ${page.pageNumber}: ${page.pageId}`);
      });
    } else {
      console.log("\n❌ Test failed!");
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error("❌ Test execution failed:", error.message);
  }
}

// Run the test
runCloudinaryTest();
