const postgres = require("postgres");
const { DATABASE_URL } = require("./db.js");

const sql = postgres(DATABASE_URL, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

async function initializeDatabase() {
  try {
    console.log("🚀 Initializing database...");

    // Create Users table
    await sql`
      CREATE TABLE IF NOT EXISTS "User" (
        "UserId" BIGSERIAL PRIMARY KEY,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW(),
        "UserName" VARCHAR(255) NOT NULL,
        "Email" VARCHAR(255) UNIQUE NOT NULL,
        "Phone" VARCHAR(20),
        "Password" VARCHAR(255) NOT NULL,
        "Salt" VARCHAR(255) NOT NULL
      );
    `;
    console.log("✅ Users table created/verified");

    // Create Books table
    await sql`
      CREATE TABLE IF NOT EXISTS "Books" (
        "BookId" BIGSERIAL PRIMARY KEY,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "Name" VARCHAR(255) NOT NULL,
        "author" VARCHAR(255),
        "uploaded_at" TIMESTAMP DEFAULT NOW(),
        "lastopened_at" TIMESTAMP DEFAULT NOW(),
        "UserId" BIGINT REFERENCES "User"("UserId") ON DELETE CASCADE
      );
    `;
    console.log("✅ Books table created/verified");

    // Create Pages table
    await sql`
      CREATE TABLE IF NOT EXISTS "Pages" (
        "PageId" BIGSERIAL PRIMARY KEY,
        "pageNumber" BIGINT NOT NULL,
        "pageURL" VARCHAR(500),
        "uniquePageId" VARCHAR(255) UNIQUE,
        "cloudinaryId" VARCHAR(255),
        "BookId" BIGINT REFERENCES "Books"("BookId") ON DELETE CASCADE
      );
    `;
    console.log("✅ Pages table created/verified");

    // Create Category table
    await sql`
      CREATE TABLE IF NOT EXISTS "Category" (
        "CategoryId" BIGSERIAL PRIMARY KEY,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "Name" TEXT NOT NULL,
        "Description" VARCHAR(500),
        "ModelId" BIGINT,
        "PromptId" BIGINT
      );
    `;
    console.log("✅ Category table created/verified");

    // Create Model table
    await sql`
      CREATE TABLE IF NOT EXISTS "Model" (
        "ModelId" BIGSERIAL PRIMARY KEY,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "ModelName" TEXT NOT NULL,
        "Description" VARCHAR(500)
      );
    `;
    console.log("✅ Model table created/verified");

    // Create Prompting table
    await sql`
      CREATE TABLE IF NOT EXISTS "Prompting" (
        "PromptId" BIGSERIAL PRIMARY KEY,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "Prompt" VARCHAR(1000)
      );
    `;
    console.log("✅ Prompting table created/verified");

    // Create Explanation table
    await sql`
      CREATE TABLE IF NOT EXISTS "Explanation" (
        "ExplanationId" BIGSERIAL PRIMARY KEY,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "Response" VARCHAR(1000),
        "CategoryId" BIGINT REFERENCES "Category"("CategoryId") ON DELETE CASCADE,
        "PageId" BIGINT REFERENCES "Pages"("PageId") ON DELETE CASCADE
      );
    `;
    console.log("✅ Explanation table created/verified");

    // Create Quizzes table
    await sql`
      CREATE TABLE IF NOT EXISTS "Quizzes" (
        "QuizId" BIGSERIAL PRIMARY KEY,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "Score" FLOAT8 DEFAULT 0,
        "updated_at" TIMESTAMP DEFAULT NOW(),
        "Difficulty" VARCHAR(50),
        "Pages" JSONB,
        "UserId" BIGINT REFERENCES "User"("UserId") ON DELETE CASCADE
      );
    `;
    console.log("✅ Quizzes table created/verified");

    // Create Questions table
    await sql`
      CREATE TABLE IF NOT EXISTS "Questions" (
        "QuestionId" BIGSERIAL PRIMARY KEY,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "Questions" VARCHAR(1000) NOT NULL,
        "Answers" VARCHAR(1000),
        "myAnswer" VARCHAR(1000),
        "Options" JSONB,
        "Explanation" VARCHAR(1000),
        "QuizId" BIGINT REFERENCES "Quizzes"("QuizId") ON DELETE CASCADE
      );
    `;
    console.log("✅ Questions table created/verified");

    // Add foreign key constraints for Category table (safely)
    try {
      await sql`
        ALTER TABLE "Category" 
        ADD CONSTRAINT fk_category_model 
        FOREIGN KEY ("ModelId") REFERENCES "Model"("ModelId") ON DELETE SET NULL;
      `;
      console.log("✅ Model foreign key constraint added");
    } catch (error) {
      if (error.code === "42710") {
        // constraint already exists
        console.log("ℹ️ Model foreign key constraint already exists");
      } else {
        console.log(
          "⚠️ Could not add Model foreign key constraint:",
          error.message
        );
      }
    }

    try {
      await sql`
        ALTER TABLE "Category" 
        ADD CONSTRAINT fk_category_prompt 
        FOREIGN KEY ("PromptId") REFERENCES "Prompting"("PromptId") ON DELETE SET NULL;
      `;
      console.log("✅ Prompt foreign key constraint added");
    } catch (error) {
      if (error.code === "42710") {
        // constraint already exists
        console.log("ℹ️ Prompt foreign key constraint already exists");
      } else {
        console.log(
          "⚠️ Could not add Prompt foreign key constraint:",
          error.message
        );
      }
    }

    // Create indexes for better performance (safely)
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_user_email ON "User"("Email");`;
      await sql`CREATE INDEX IF NOT EXISTS idx_books_userid ON "Books"("UserId");`;
      await sql`CREATE INDEX IF NOT EXISTS idx_pages_bookid ON "Pages"("BookId");`;
      await sql`CREATE INDEX IF NOT EXISTS idx_quizzes_userid ON "Quizzes"("UserId");`;
      await sql`CREATE INDEX IF NOT EXISTS idx_questions_quizid ON "Questions"("QuizId");`;
      console.log("✅ Database indexes created");
    } catch (error) {
      console.log("⚠️ Some indexes could not be created:", error.message);
    }

    console.log("🎉 Database initialization completed successfully!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log("✅ Database setup complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Database setup failed:", error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
