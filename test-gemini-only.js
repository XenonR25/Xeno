const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GEMINI_API_KEY } = require("./server/db.js");

// Configure Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Try Gemini with multiple model fallbacks
async function tryGeminiModels(prompt) {
  const modelCandidates = [
    "gemini-2.0-flash",
    "gemini-1.5-flash", 
    "gemini-1.5-pro",
    "gemini-1.0-pro",
  ];

  let lastError;
  for (const modelName of modelCandidates) {
    try {
      console.log(`🔄 Trying model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      console.log(`✅ Success with model: ${modelName}`);
      return response.text();
    } catch (err) {
      console.log(`❌ Failed with model ${modelName}: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError || new Error("All Gemini model attempts failed");
}

// Test Gemini API key functionality
async function testGeminiAPIKey() {
  console.log("🧪 Testing Gemini API Key Functionality...");
  console.log("=".repeat(50));
  
  try {
    // Check if API key is configured
    console.log(`🔑 API Key Status: ${GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not found in environment variables");
    }
    
    console.log(`🔑 API Key (first 10 chars): ${GEMINI_API_KEY.substring(0, 10)}...`);
    
    // Test with a simple prompt
    const testPrompt = "Hello! Please respond with 'Gemini API is working correctly' to confirm the connection.";
    
    console.log("🤖 Testing Gemini API with simple prompt...");
    console.log(`📝 Test prompt: "${testPrompt}"`);
    
    const response = await tryGeminiModels(testPrompt);
    
    console.log("✅ Gemini API test successful!");
    console.log(`📄 Response length: ${response.length} characters`);
    console.log(`💬 Response: "${response}"`);
    
    return {
      success: true,
      response,
      apiKeyConfigured: true
    };
    
  } catch (error) {
    console.error("❌ Gemini API test failed:", error.message);
    
    // Additional debugging info
    if (error.message.includes('API_KEY_INVALID')) {
      console.log("🔍 Diagnosis: API key appears to be invalid");
    } else if (error.message.includes('quota')) {
      console.log("🔍 Diagnosis: API quota may be exceeded");
    } else if (error.message.includes('network')) {
      console.log("🔍 Diagnosis: Network connectivity issue");
    } else if (error.message.includes('403')) {
      console.log("🔍 Diagnosis: API key may not have proper permissions");
    } else if (error.message.includes('400')) {
      console.log("🔍 Diagnosis: Bad request - check API parameters");
    }
    
    return {
      success: false,
      error: error.message,
      apiKeyConfigured: !!GEMINI_API_KEY
    };
  }
}

// Run the test
testGeminiAPIKey().then(result => {
  console.log("\n" + "=".repeat(50));
  console.log("🏁 GEMINI API TEST COMPLETE");
  console.log("=".repeat(50));
  
  if (result.success) {
    console.log("🎉 Status: SUCCESS");
    console.log("✅ Gemini API key is working correctly!");
  } else {
    console.log("❌ Status: FAILED");
    console.log(`💥 Error: ${result.error}`);
    console.log("🔧 Please check your API key configuration in server/.env.local");
  }
}).catch(console.error);
