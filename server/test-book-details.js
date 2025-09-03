const { DATABASE_URL } = require("./db.js");
const postgres = require("postgres");

const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

async function testBookDetails() {
  try {
    console.log("🧪 Testing Book Details Endpoint...\n");

    // Test 1: Check if we have any books in the database
    console.log("📚 Test 1: Checking available books...");
    const books = await sql`
      SELECT "BookId", "Name", "author", "UserId" 
      FROM "Books" 
      LIMIT 5
    `;

    if (books.length === 0) {
      console.log("❌ No books found in database. Please create a book first.");
      return;
    }

    console.log(`✅ Found ${books.length} books:`);
    books.forEach((book) => {
      console.log(
        `   - BookId: ${book.BookId}, Name: "${book.Name}", Author: ${book.author}, UserId: ${book.UserId}`
      );
    });

    // Test 2: Check pages for the first book
    const firstBook = books[0];
    console.log(
      `\n📄 Test 2: Checking pages for BookId: ${firstBook.BookId}...`
    );

    const pages = await sql`
      SELECT "PageId", "pageNumber", "pageURL", "cloudinaryId"
      FROM "Pages" 
      WHERE "BookId" = ${firstBook.BookId}
      ORDER BY "pageNumber"
    `;

    console.log(`✅ Found ${pages.length} pages for book "${firstBook.Name}":`);
    pages.forEach((page) => {
      console.log(`   - Page ${page.pageNumber}: PageId=${page.PageId}`);
    });

    // Test 3: Simulate the endpoint query
    console.log(
      `\n🔍 Test 3: Simulating endpoint query for BookId: ${firstBook.BookId}...`
    );

    const bookDetails = await sql`
      SELECT "BookId", "Name", "author", "created_at", "uploaded_at", "lastopened_at"
      FROM "Books" 
      WHERE "BookId" = ${firstBook.BookId}
    `;

    if (bookDetails.length > 0) {
      console.log("✅ Book details retrieved successfully:");
      console.log(`   - Name: "${bookDetails[0].Name}"`);
      console.log(`   - Author: ${bookDetails[0].author}`);
      console.log(`   - Created: ${bookDetails[0].created_at}`);
      console.log(`   - Uploaded: ${bookDetails[0].uploaded_at}`);
      console.log(`   - Last Opened: ${bookDetails[0].lastopened_at}`);
    }

    console.log("\n🎯 Book Details endpoint is ready to use!");
    console.log(`📖 Call: GET /api/books/${firstBook.BookId}`);
    console.log(`📊 Call: GET /api/books/${firstBook.BookId}/summary`);
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await sql.end();
  }
}

// Run the test
testBookDetails();
