const postgres = require("postgres");
const { DATABASE_URL } = require("./db.js");

const sql = postgres(DATABASE_URL, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

async function migratePagesTable() {
  try {
    console.log("🔄 Starting Pages table migration...");

    // Add new columns to Pages table
    const migrations = [
      {
        name: "Add uniquePageId column",
        query: `ALTER TABLE "Pages" ADD COLUMN IF NOT EXISTS "uniquePageId" VARCHAR(255) UNIQUE;`
      },
      {
        name: "Add cloudinaryId column", 
        query: `ALTER TABLE "Pages" ADD COLUMN IF NOT EXISTS "cloudinaryId" VARCHAR(255);`
      },
      {
        name: "Add publicId column",
        query: `ALTER TABLE "Pages" ADD COLUMN IF NOT EXISTS "publicId" VARCHAR(255);`
      }
    ];

    for (const migration of migrations) {
      try {
        console.log(`📝 Running migration: ${migration.name}`);
        await sql.unsafe(migration.query);
        console.log(`✅ Migration completed: ${migration.name}`);
      } catch (error) {
        if (error.code === "42701") {
          // Column already exists
          console.log(`ℹ️ Column already exists for: ${migration.name}`);
        } else {
          console.error(`❌ Migration failed for ${migration.name}:`, error.message);
          throw error;
        }
      }
    }

    // Create index for uniquePageId for better performance
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_pages_uniquepageid ON "Pages"("uniquePageId");`;
      console.log("✅ Index created for uniquePageId");
    } catch (error) {
      console.log("ℹ️ Index already exists or could not be created");
    }

    console.log("🎉 Pages table migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migratePagesTable()
    .then(() => {
      console.log("✅ Migration complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    });
}

module.exports = { migratePagesTable };
