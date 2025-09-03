const { testCloudinaryPageUpload } = require("./server/test.js");

async function testLocalImagesAndDatabase() {
  try {
    console.log("🚀 Testing Local Images and Database Storage...");
    console.log("=".repeat(60));

    const pdfPath = "./assets/sample.pdf";
    
    if (!require("fs").existsSync(pdfPath)) {
      console.error(`❌ PDF file not found: ${pdfPath}`);
      console.log("Please ensure you have a sample.pdf file in the assets folder");
      return;
    }

    console.log(`📁 Testing with PDF: ${pdfPath}`);
    console.log("This will:");
    console.log("1. Upload PDF to Cloudinary");
    console.log("2. Extract all pages as images");
    console.log("3. Save images to local_books folder");
    console.log("4. Upload individual pages to Cloudinary");
    console.log("5. Store book and pages in Supabase database");
    console.log("");

    const result = await testCloudinaryPageUpload(pdfPath);

    if (result.success) {
      console.log("\n🎉 TEST COMPLETED SUCCESSFULLY!");
      console.log("=".repeat(60));
      console.log(`📚 Book: "${result.result.bookInfo.bookName}" by ${result.result.bookInfo.authorName}"`);
      console.log(`📄 Pages processed: ${result.result.pages.length}`);
      console.log(`📁 Local images saved in: ${result.result.localImagesPath}`);
      
      if (result.result.databaseInfo) {
        console.log(`💾 Database Book ID: ${result.result.databaseInfo.bookId}`);
        console.log(`📊 Pages stored in database: ${result.result.databaseInfo.pagesCreated}`);
      }
      
      console.log(`💾 Results saved to: ${result.outputFile}`);
      
      // List the local images
      const fs = require("fs");
      const localPath = result.result.localImagesPath;
      if (fs.existsSync(localPath)) {
        const files = fs.readdirSync(localPath);
        console.log(`\n📁 Local images in ${localPath}:`);
        files.forEach(file => {
          console.log(`  📄 ${file}`);
        });
      }
    } else {
      console.error("❌ TEST FAILED:", result.error);
    }

  } catch (error) {
    console.error("❌ Test execution failed:", error.message);
  }
}

// Run the test
testLocalImagesAndDatabase();


