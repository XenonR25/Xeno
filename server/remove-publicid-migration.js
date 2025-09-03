const postgres = require("postgres");
const { DATABASE_URL } = require("./db.js");

const sql = postgres(DATABASE_URL, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

async function removePublicIdColumn() {
  try {
    console.log("🔄 Starting publicId column removal migration...");

    // Check if publicId column exists
    const columnExists = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Pages' 
      AND column_name = 'publicId'
    `;

    if (columnExists.length > 0) {
      console.log("📝 Removing publicId column from Pages table...");
      
      // Remove the publicId column
      await sql.unsafe(`ALTER TABLE "Pages" DROP COLUMN "publicId";`);
      console.log("✅ publicId column removed successfully");
    } else {
      console.log("ℹ️ publicId column does not exist, no action needed");
    }

    // Verify the current table structure
    const tableStructure = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'Pages'
      ORDER BY ordinal_position
    `;

    console.log("\n📋 Current Pages table structure:");
    console.log("-".repeat(50));
    tableStructure.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    console.log("\n🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  removePublicIdColumn()
    .then(() => {
      console.log("✅ Migration complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    });
}

module.exports = { removePublicIdColumn };
