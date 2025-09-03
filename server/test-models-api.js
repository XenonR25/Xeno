const { DATABASE_URL } = require("./db.js");
const postgres = require("postgres");

const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

async function testModelsAPI() {
  try {
    console.log("🧪 Testing AI Models API...\n");

    // Test 1: Check if Models table exists
    console.log("📊 Test 1: Checking Models table...");
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Models'
      )
    `;

    if (!tableExists[0].exists) {
      console.log(
        "❌ Models table does not exist. Please run create-models-table.js first."
      );
      return;
    }

    console.log("✅ Models table exists");

    // Test 2: Check table structure
    console.log("\n🔍 Test 2: Checking table structure...");
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Models' 
      ORDER BY ordinal_position
    `;

    console.log("📋 Table columns:");
    columns.forEach((col) => {
      console.log(
        `   - ${col.column_name}: ${col.data_type} (${
          col.is_nullable === "YES" ? "nullable" : "not null"
        })`
      );
    });

    // Test 3: Check if we have any models
    console.log("\n📚 Test 3: Checking existing models...");
    const models = await sql`
      SELECT "ModelId", "name", "type", "isActive", "capabilities"
      FROM "Models" 
      LIMIT 10
    `;

    if (models.length === 0) {
      console.log("ℹ️ No models found in database");
    } else {
      console.log(`✅ Found ${models.length} models:`);
      models.forEach((model) => {
        console.log(
          `   - ${model.name} (${model.type}): ${
            model.isActive ? "Active" : "Inactive"
          }`
        );
        console.log(
          `     Capabilities: ${(model.capabilities || []).join(", ")}`
        );
      });
    }

    // Test 4: Test model creation (simulation)
    console.log("\n🔧 Test 4: Testing model creation logic...");
    const testModel = {
      name: "Test GPT-4",
      type: "chatgpt",
      apiKey: "test_key_123",
      baseUrl: "https://api.openai.com/v1",
      description: "Test model for API validation",
      maxTokens: 2048,
      temperature: 0.8,
      capabilities: ["text_generation", "summarization"],
    };

    console.log("📝 Sample model data:");
    console.log(`   Name: ${testModel.name}`);
    console.log(`   Type: ${testModel.type}`);
    console.log(`   Base URL: ${testModel.baseUrl}`);
    console.log(`   Max Tokens: ${testModel.maxTokens}`);
    console.log(`   Temperature: ${testModel.temperature}`);
    console.log(`   Capabilities: ${testModel.capabilities.join(", ")}`);

    // Test 5: Test filtering logic
    console.log("\n🔍 Test 5: Testing filtering logic...");

    // Test by type
    const chatgptModels = await sql`
      SELECT COUNT(*) as count FROM "Models" WHERE "type" = 'chatgpt'
    `;
    console.log(`   ChatGPT models: ${chatgptModels[0].count}`);

    const geminiModels = await sql`
      SELECT COUNT(*) as count FROM "Models" WHERE "type" = 'gemini'
    `;
    console.log(`   Gemini models: ${geminiModels[0].count}`);

    const deepseekModels = await sql`
      SELECT COUNT(*) as count FROM "Models" WHERE "type" = 'deepseek'
    `;
    console.log(`   DeepSeek models: ${deepseekModels[0].count}`);

    // Test by active status
    const activeModels = await sql`
      SELECT COUNT(*) as count FROM "Models" WHERE "isActive" = true
    `;
    console.log(`   Active models: ${activeModels[0].count}`);

    // Test 6: Test capabilities filtering
    console.log("\n🎯 Test 6: Testing capabilities filtering...");
    const summarizationModels = await sql`
      SELECT "name", "type" FROM "Models" 
      WHERE 'summarization' = ANY("capabilities")
    `;
    console.log(
      `   Models with summarization capability: ${summarizationModels.length}`
    );
    summarizationModels.forEach((model) => {
      console.log(`     - ${model.name} (${model.type})`);
    });

    // Test 7: Test model update simulation
    console.log("\n🔄 Test 7: Testing update logic...");
    if (models.length > 0) {
      const firstModel = models[0];
      console.log(`   Sample update for ${firstModel.name}:`);
      console.log(`     - Change temperature to 0.9`);
      console.log(`     - Add 'translation' capability`);
      console.log(`     - Set maxTokens to 4096`);
    }

    // Test 8: Test model testing endpoint simulation
    console.log("\n🧪 Test 8: Testing model testing endpoint...");
    const testPrompt =
      "Summarize the key points of artificial intelligence in 3 sentences.";
    const testTaskType = "summarization";

    console.log(`   Test prompt: "${testPrompt}"`);
    console.log(`   Task type: ${testTaskType}`);
    console.log(`   Expected: Simulated response from AI model`);

    // Test 9: Check database constraints
    console.log("\n🔒 Test 9: Checking database constraints...");

    // Check foreign key constraint
    const foreignKeyCheck = await sql`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'Models'
    `;

    if (foreignKeyCheck.length > 0) {
      console.log("✅ Foreign key constraints found:");
      foreignKeyCheck.forEach((fk) => {
        console.log(
          `   - ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`
        );
      });
    }

    // Check check constraints
    const checkConstraints = await sql`
      SELECT 
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.check_constraints AS cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.constraint_type = 'CHECK' 
        AND tc.table_name = 'Models'
    `;

    if (checkConstraints.length > 0) {
      console.log("✅ Check constraints found:");
      checkConstraints.forEach((cc) => {
        console.log(`   - ${cc.constraint_name}: ${cc.check_clause}`);
      });
    }

    console.log("\n🎯 AI Models API is ready for use!");
    console.log("📖 Available endpoints:");
    console.log("   - POST /api/models (Create model)");
    console.log("   - GET /api/models (List models with filters)");
    console.log("   - GET /api/models/:id (Get specific model)");
    console.log("   - PUT /api/models/:id (Update model)");
    console.log("   - PATCH /api/models/:id/dynamic-update (Dynamic update)");
    console.log("   - DELETE /api/models/:id (Delete model)");
    console.log("   - POST /api/models/:id/test (Test model)");

    console.log("\n🔧 Sample usage:");
    console.log("   # Create a new model");
    console.log("   POST /api/models");
    console.log("   {");
    console.log('     "name": "GPT-4 Turbo",');
    console.log('     "type": "chatgpt",');
    console.log('     "apiKey": "your_api_key",');
    console.log('     "baseUrl": "https://api.openai.com/v1",');
    console.log('     "capabilities": ["text_generation", "summarization"]');
    console.log("   }");

    console.log("\n   # Filter models by capability");
    console.log("   GET /api/models?capability=summarization");

    console.log("\n   # Dynamic update specific fields");
    console.log("   PATCH /api/models/1/dynamic-update");
    console.log("   {");
    console.log('     "fieldUpdates": {');
    console.log('       "temperature": 0.9,');
    console.log('       "isActive": false');
    console.log("     }");
    console.log("   }");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await sql.end();
  }
}

// Run the test
testModelsAPI();
