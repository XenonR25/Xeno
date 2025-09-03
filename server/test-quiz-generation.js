require('dotenv').config({ path: './.env.local' });
const postgres = require('postgres');
const fs = require('fs');
const path = require('path');
const { extractTextFromImageUrl } = require('./utils/pdfProcessor');
const { callOpenAI } = require('./routes/test1');

// Database connection
const { DATABASE_URL } = require('./db');
const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Test Quiz Generation Workflow with dynamic data
async function testQuizGenerationWithData(testData) {
  console.log('\n🧪 ========== QUIZ GENERATION TEST ==========');
  
  const testResults = {
    timestamp: new Date().toISOString(),
    test_type: 'quiz_generation_workflow',
    test_data: testData,
    pages_processed: [],
    ocr_results: [],
    quiz_creation: {},
    questions_generated: [],
    database_storage: {},
    errors: []
  };

  try {
    const { userId, pageIds, userName } = testData;
    const DIFFICULTY = 'medium';
    
    console.log(`📋 Using User: ${userName} (ID: ${userId})`);
    console.log(`📄 Using Page IDs: [${pageIds.join(', ')}]`);
    console.log(`🎯 Difficulty Level: ${DIFFICULTY}`);

    // Step 1: Verify user exists (already verified in findValidTestData)
    console.log('\n👤 Step 1: User verification (already done)...');
    console.log(`✅ User confirmed: ${userName} (ID: ${userId})`);

    // Step 2: Fetch pages information
    console.log('\n📚 Step 2: Fetching pages information...');
    const pages = await sql`
      SELECT p."PageId", p."pageURL", p."pageNumber", b."Name" as book_title, b."BookId"
      FROM "Pages" p
      JOIN "Books" b ON p."BookId" = b."BookId"
      WHERE p."PageId" = ANY(${pageIds})
      ORDER BY b."BookId", p."pageNumber"
    `;

    if (pages.length === 0) {
      throw new Error(`No pages found with IDs: [${pageIds.join(', ')}]. This should not happen after discovery.`);
    }

    testResults.pages_processed = pages.map(p => ({
      pageId: p.PageId,
      pageNumber: p.pageNumber,
      bookTitle: p.book_title,
      pageURL: p.pageURL
    }));

    console.log(`✅ Found ${pages.length} pages`);
    pages.forEach(page => {
      console.log(`   📖 Page ${page.pageNumber} from "${page.book_title}" (ID: ${page.PageId})`);
    });

    // Step 3: Process OCR for all pages
    console.log('\n🔍 Step 3: Processing OCR for all pages...');
    const ocrResults = [];
    let combinedContext = '';

    for (const page of pages) {
      try {
        console.log(`📄 Processing OCR for Page ${page.pageNumber}...`);
        const ocrText = await extractTextFromImageUrl(page.pageURL);
        
        const ocrResult = {
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          success: true,
          text: ocrText,
          textLength: ocrText.length
        };
        
        ocrResults.push(ocrResult);
        combinedContext += `\n--- Page ${page.pageNumber} from "${page.book_title}" ---\n${ocrText}\n`;
        
        console.log(`✅ OCR completed for Page ${page.pageNumber}: ${ocrText.length} characters`);
      } catch (error) {
        console.error(`❌ OCR failed for Page ${page.pageNumber}:`, error.message);
        ocrResults.push({
          pageId: page.PageId,
          pageNumber: page.pageNumber,
          success: false,
          error: error.message,
          text: '',
          textLength: 0
        });
      }
    }

    testResults.ocr_results = ocrResults;
    const successfulOCR = ocrResults.filter(r => r.success).length;
    
    console.log(`📊 OCR Summary: ${successfulOCR}/${pages.length} pages processed successfully`);
    console.log(`📝 Total context length: ${combinedContext.length} characters`);

    if (successfulOCR === 0) {
      throw new Error('OCR failed for all pages. Cannot generate quiz without content.');
    }

    // Step 4: Create Quiz record
    console.log('\n💾 Step 4: Creating quiz record...');
    const pagesInfo = pages.map(p => ({
      pageId: p.PageId,
      pageNumber: p.pageNumber,
      bookTitle: p.book_title,
      bookId: p.BookId
    }));

    const quizResult = await sql`
      INSERT INTO "Quizzes" (
        "Difficulty",
        "Pages",
        "UserId",
        "Score"
      )
      VALUES (
        ${DIFFICULTY},
        ${JSON.stringify(pagesInfo)},
        ${userId},
        ${0.0}
      )
      RETURNING "QuizId", "created_at"
    `;

    const quiz = quizResult[0];
    testResults.quiz_creation = {
      quizId: quiz.QuizId,
      difficulty: DIFFICULTY,
      pages: pagesInfo,
      userId: userId,
      createdAt: quiz.created_at
    };

    console.log(`✅ Quiz created with ID: ${quiz.QuizId}`);

    // Step 5: Generate questions using AI
    console.log('\n🤖 Step 5: Generating questions using AI...');
    
    const questionPrompt = `Based on the following content from multiple book pages, generate exactly 10 multiple-choice questions with difficulty level: ${DIFFICULTY}.

DIFFICULTY LEVEL GUIDELINES:
- EASY: Basic comprehension, direct facts, simple recall questions
- MEDIUM: Analysis, inference, connecting concepts, moderate complexity
- HARD: Critical thinking, complex analysis, synthesis, advanced reasoning

Content:
${combinedContext}

Requirements:
1. Generate exactly 10 questions appropriate for ${DIFFICULTY.toUpperCase()} difficulty level
2. Each question should have 4 options (A, B, C, D)
3. Provide the correct answer
4. Include a brief explanation for each answer
5. Questions must match the ${DIFFICULTY} difficulty criteria above
6. Vary question types: comprehension, analysis, application, evaluation
7. Return the response as a JSON array with this exact structure:

[
  {
    "question": "Question text here?",
    "options": {
      "A": "Option A text",
      "B": "Option B text", 
      "C": "Option C text",
      "D": "Option D text"
    },
    "correctAnswer": "A",
    "explanation": "Explanation of why this answer is correct"
  }
]

Make sure to return ONLY the JSON array, no additional text or formatting.`;

    let questionsData;
    try {
      console.log(`🎯 Generating ${DIFFICULTY.toUpperCase()} difficulty questions using AI...`);
      const aiResponse = await callOpenAI(questionPrompt, `Generate ${DIFFICULTY} difficulty quiz questions from the provided content.`);
      
      // Parse the AI response
      const cleanResponse = aiResponse.trim();
      const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        questionsData = JSON.parse(jsonMatch[0]);
      } else {
        questionsData = JSON.parse(cleanResponse);
      }

      if (!Array.isArray(questionsData) || questionsData.length !== 10) {
        throw new Error('AI did not return exactly 10 questions in the expected format');
      }

      console.log(`✅ Generated ${questionsData.length} questions using AI`);
      testResults.questions_generated = questionsData;

    } catch (error) {
      console.error('❌ AI question generation failed:', error.message);
      testResults.errors.push(`AI generation failed: ${error.message}`);
      throw error;
    }

    // Step 6: Insert questions into database
    console.log('\n💾 Step 6: Storing questions in database...');
    const insertedQuestions = [];

    for (let i = 0; i < questionsData.length; i++) {
      const questionData = questionsData[i];
      
      try {
        const questionResult = await sql`
          INSERT INTO "Questions" (
            "Questions",
            "Answers", 
            "myAnswer",
            "Options",
            "Explanation",
            "QuizId"
          )
          VALUES (
            ${questionData.question},
            ${questionData.correctAnswer},
            ${null},
            ${JSON.stringify(questionData.options)},
            ${questionData.explanation},
            ${quiz.QuizId}
          )
          RETURNING "QuestionId", "Questions", "Options", "Answers", "Explanation"
        `;

        insertedQuestions.push(questionResult[0]);
        console.log(`✅ Question ${i + 1} inserted with ID: ${questionResult[0].QuestionId}`);

      } catch (error) {
        console.error(`❌ Failed to insert question ${i + 1}:`, error.message);
        testResults.errors.push(`Question ${i + 1} insertion failed: ${error.message}`);
        throw error;
      }
    }

    testResults.database_storage = {
      quizId: quiz.QuizId,
      questionsInserted: insertedQuestions.length,
      questions: insertedQuestions
    };

    // Step 7: Store quiz and questions in local storage (JSON files)
    console.log('\n💿 Step 7: Storing quiz and questions in local storage...');
    const timestamp = Date.now();
    const quizFilename = `quiz_${quiz.QuizId}_${timestamp}.json`;
    const questionsFilename = `questions_${quiz.QuizId}_${timestamp}.json`;
    
    // Ensure test_output directory exists
    const testOutputDir = path.join(__dirname, '../test_output');
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // Prepare quiz data for local storage
    const quizData = {
      quiz: {
        quizId: quiz.QuizId,
        difficulty: DIFFICULTY,
        pages: pagesInfo,
        userId: userId,
        createdAt: quiz.created_at,
        score: 0.0
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalPages: pages.length,
        successfulOCR: successfulOCR,
        totalCharacters: combinedContext.length,
        testType: 'quiz_generation'
      }
    };

    // Prepare questions data for local storage
    const localQuestionsData = {
      quizId: quiz.QuizId,
      questions: insertedQuestions.map(q => ({
        questionId: q.QuestionId,
        question: q.Questions,
        options: JSON.parse(q.Options),
        correctAnswer: q.Answers,
        explanation: q.Explanation,
        myAnswer: null
      })),
      metadata: {
        timestamp: new Date().toISOString(),
        totalQuestions: insertedQuestions.length,
        difficulty: DIFFICULTY,
        generatedBy: 'AI'
      }
    };

    // Save quiz data to local file
    const quizFilepath = path.join(testOutputDir, quizFilename);
    fs.writeFileSync(quizFilepath, JSON.stringify(quizData, null, 2));
    console.log(`✅ Quiz data saved to: ${quizFilename}`);

    // Save questions data to local file
    const questionsFilepath = path.join(testOutputDir, questionsFilename);
    fs.writeFileSync(questionsFilepath, JSON.stringify(localQuestionsData, null, 2));
    console.log(`✅ Questions data saved to: ${questionsFilename}`);

    // Update test results with local storage info
    testResults.local_storage = {
      quizFile: {
        filename: quizFilename,
        filepath: quizFilepath,
        size: fs.statSync(quizFilepath).size
      },
      questionsFile: {
        filename: questionsFilename,
        filepath: questionsFilepath,
        size: fs.statSync(questionsFilepath).size
      },
      directory: testOutputDir,
      timestamp: timestamp
    };

    // Step 8: Verify quiz retrieval
    console.log('\n🔍 Step 8: Verifying quiz retrieval...');
    const retrievedQuiz = await sql`
      SELECT q."QuizId", q."Difficulty", q."Pages", q."UserId", q."Score", q."created_at"
      FROM "Quizzes" q
      WHERE q."QuizId" = ${quiz.QuizId}
    `;

    const retrievedQuestions = await sql`
      SELECT "QuestionId", "Questions", "Answers", "myAnswer", "Options", "Explanation"
      FROM "Questions"
      WHERE "QuizId" = ${quiz.QuizId}
      ORDER BY "QuestionId"
    `;

    console.log(`✅ Quiz retrieved: ${retrievedQuiz.length} quiz record`);
    console.log(`✅ Questions retrieved: ${retrievedQuestions.length} questions`);

    // Summary
    console.log('\n📊 ========== QUIZ GENERATION TEST SUMMARY ==========');
    console.log(`👤 User: ${userName} (ID: ${userId})`);
    console.log(`📄 Pages processed: ${pages.length}`);
    console.log(`🔍 OCR successful: ${successfulOCR}/${pages.length}`);
    console.log(`🎯 Quiz created: ID ${quiz.QuizId} (${DIFFICULTY} difficulty)`);
    console.log(`❓ Questions generated: ${insertedQuestions.length}/10`);
    console.log(`💾 Database storage: ✅ Success`);
    console.log(`💿 Local storage: ✅ Quiz saved to ${quizFilename}`);
    console.log(`💿 Local storage: ✅ Questions saved to ${questionsFilename}`);
    console.log(`🔍 Retrieval test: ✅ Success`);

    // Display sample questions
    console.log('\n📝 Sample Questions Generated:');
    for (let i = 0; i < Math.min(3, insertedQuestions.length); i++) {
      const q = insertedQuestions[i];
      console.log(`\n${i + 1}. ${q.Questions}`);
      const options = JSON.parse(q.Options);
      Object.entries(options).forEach(([key, value]) => {
        console.log(`   ${key}) ${value}`);
      });
      console.log(`   ✅ Correct Answer: ${q.Answers}`);
      console.log(`   💡 Explanation: ${q.Explanation}`);
    }

    console.log('\n🎉 Quiz generation test completed successfully!');
    return testResults;

  } catch (error) {
    console.error('❌ Quiz generation test failed:', error);
    testResults.errors.push(error.message);
    throw error;
  }
}

// Test quiz submission workflow
async function testQuizSubmission(quizId) {
  console.log(`\n🧪 ========== QUIZ SUBMISSION TEST (Quiz ID: ${quizId}) ==========`);
  
  try {
    // Fetch quiz questions
    const questions = await sql`
      SELECT "QuestionId", "Answers" as correct_answer
      FROM "Questions"
      WHERE "QuizId" = ${quizId}
      ORDER BY "QuestionId"
    `;

    if (questions.length === 0) {
      throw new Error('No questions found for this quiz');
    }

    console.log(`📝 Found ${questions.length} questions for quiz ${quizId}`);

    // Simulate user answers (mix of correct and incorrect)
    const answers = {};
    let correctCount = 0;

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      // Simulate 70% correct answers
      const isCorrect = Math.random() < 0.7;
      
      if (isCorrect) {
        answers[question.QuestionId] = question.correct_answer;
        correctCount++;
      } else {
        // Pick a random wrong answer
        const wrongAnswers = ['A', 'B', 'C', 'D'].filter(opt => opt !== question.correct_answer);
        answers[question.QuestionId] = wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)];
      }
    }

    console.log(`🎯 Simulated answers: ${correctCount}/${questions.length} correct`);

    // Submit answers
    for (const question of questions) {
      const questionId = question.QuestionId;
      const userAnswer = answers[questionId];

      await sql`
        UPDATE "Questions"
        SET "myAnswer" = ${userAnswer}
        WHERE "QuestionId" = ${questionId}
      `;
    }

    // Calculate and update score
    const finalScore = (correctCount / questions.length) * 100;

    await sql`
      UPDATE "Quizzes"
      SET "Score" = ${finalScore}, "updated_at" = NOW()
      WHERE "QuizId" = ${quizId}
    `;

    console.log(`✅ Quiz submitted successfully!`);
    console.log(`📊 Final Score: ${correctCount}/${questions.length} (${finalScore.toFixed(1)}%)`);

    return {
      quizId: quizId,
      score: finalScore,
      correctAnswers: correctCount,
      totalQuestions: questions.length
    };

  } catch (error) {
    console.error('❌ Quiz submission test failed:', error);
    throw error;
  }
}

// Helper function to find valid page IDs and user ID
async function findValidTestData() {
  console.log('🔍 Discovering valid test data from database...');
  
  try {
    // Find a valid user
    const users = await sql`
      SELECT "UserId", "UserName", "Email"
      FROM "User"
      ORDER BY "UserId"
      LIMIT 1
    `;

    if (users.length === 0) {
      throw new Error('No users found in database. Please create a user first.');
    }

    const userId = users[0].UserId;
    console.log(`✅ Found user: ${users[0].UserName} (ID: ${userId})`);

    // Find valid pages with actual content
    const pages = await sql`
      SELECT p."PageId", p."pageURL", p."pageNumber", b."Name" as book_title, b."BookId"
      FROM "Pages" p
      JOIN "Books" b ON p."BookId" = b."BookId"
      WHERE p."pageURL" IS NOT NULL AND p."pageURL" != ''
      ORDER BY b."BookId", p."pageNumber"
      LIMIT 5
    `;

    if (pages.length === 0) {
      throw new Error('No pages found in database. Please upload some books with pages first.');
    }

    const pageIds = pages.slice(0, Math.min(3, pages.length)).map(p => p.PageId);
    
    console.log(`✅ Found ${pages.length} pages, using first ${pageIds.length} for test:`);
    pages.slice(0, pageIds.length).forEach(page => {
      console.log(`   📖 Page ${page.pageNumber} from "${page.book_title}" (ID: ${page.PageId})`);
    });

    return {
      userId: userId,
      pageIds: pageIds,
      userName: users[0].UserName,
      userEmail: users[0].Email,
      pagesInfo: pages.slice(0, pageIds.length)
    };

  } catch (error) {
    console.error('❌ Failed to find valid test data:', error.message);
    throw error;
  }
}

// Main test function
async function runQuizTests() {
  try {
    console.log('🚀 Starting comprehensive quiz generation and submission tests...');
    
    // Step 1: Find valid test data
    const testData = await findValidTestData();
    
    // Step 2: Quiz Generation with discovered data
    console.log('\n📋 Using discovered test data:');
    console.log(`   👤 User: ${testData.userName} (ID: ${testData.userId})`);
    console.log(`   📄 Page IDs: [${testData.pageIds.join(', ')}]`);
    
    const generationResults = await testQuizGenerationWithData(testData);
    const quizId = generationResults.quiz_creation.quizId;
    
    // Step 3: Quiz Submission
    await testQuizSubmission(quizId);
    
    console.log('\n🎉 All quiz tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Quiz tests failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runQuizTests();
}

module.exports = {
  testQuizGenerationWithData,
  testQuizSubmission,
  runQuizTests,
  findValidTestData
};
