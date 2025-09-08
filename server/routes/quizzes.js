const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
const axios = require('axios');
const { DATABASE_URL } = require('../db');
const { extractTextFromImageUrl } = require('../utils/pdfProcessor');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Get API keys from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Database connection
const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// OpenAI API integration
async function callOpenAI(prompt, context) {
  try {
    console.log(`🤖 [OPENAI] Calling OpenAI API...`);
    
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key not found in environment variables");
    }

    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that provides detailed explanations and generates quiz questions based on the given context."
        },
        {
          role: "user",
          content: `Context: ${context}\n\nPrompt: ${prompt}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ [OPENAI] Response received successfully`);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(`❌ [OPENAI] API error:`, error.response?.data || error.message);
    throw new Error(`OpenAI API failed: ${error.message}`);
  }
}

// Gemini API integration
async function callGemini(prompt, context) {
  try {
    console.log(`🤖 [GEMINI] Calling Gemini API...`);
    
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not found in environment variables");
    }

    const response = await axios.post(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
      contents: [{
        parts: [{
          text: `Context: ${context}\n\nPrompt: ${prompt}`
        }]
      }]
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ [GEMINI] Response received successfully`);
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error(`❌ [GEMINI] API error:`, error.response?.data || error.message);
    throw new Error(`Gemini API failed: ${error.message}`);
  }
}

// DeepSeek API integration
async function callDeepSeek(prompt, context) {
  try {
    console.log(`🤖 [DEEPSEEK] Calling DeepSeek API...`);
    
    if (!DEEPSEEK_API_KEY) {
      throw new Error("DeepSeek API key not found in environment variables");
    }

    const response = await axios.post("https://api.deepseek.com/chat/completions", {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that provides detailed explanations and generates quiz questions based on the given context."
        },
        {
          role: "user",
          content: `Context: ${context}\n\nPrompt: ${prompt}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ [DEEPSEEK] Response received successfully`);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(`❌ [DEEPSEEK] API error:`, error.response?.data || error.message);
    throw new Error(`DeepSeek API failed: ${error.message}`);
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Quiz:
 *       type: object
 *       properties:
 *         quizId:
 *           type: integer
 *           description: Unique identifier for the quiz
 *         difficulty:
 *           type: string
 *           enum: [easy, medium, hard]
 *           description: Difficulty level of the quiz
 *         pages:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               pageId:
 *                 type: integer
 *               pageNumber:
 *                 type: integer
 *               bookTitle:
 *                 type: string
 *               bookId:
 *                 type: integer
 *           description: Array of page information used in the quiz
 *         userId:
 *           type: integer
 *           description: ID of the user who created the quiz
 *         userName:
 *           type: string
 *           description: Name of the user who created the quiz
 *         userEmail:
 *           type: string
 *           description: Email of the user who created the quiz
 *         score:
 *           type: number
 *           format: float
 *           description: Quiz score (0-100)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Quiz creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Quiz last update timestamp
 *     
 *     Question:
 *       type: object
 *       properties:
 *         questionId:
 *           type: integer
 *           description: Unique identifier for the question
 *         question:
 *           type: string
 *           description: The question text
 *         options:
 *           type: object
 *           properties:
 *             A:
 *               type: string
 *             B:
 *               type: string
 *             C:
 *               type: string
 *             D:
 *               type: string
 *           description: Multiple choice options
 *         correctAnswer:
 *           type: string
 *           enum: [A, B, C, D]
 *           description: The correct answer option
 *         userAnswer:
 *           type: string
 *           enum: [A, B, C, D]
 *           nullable: true
 *           description: User's selected answer (null initially)
 *         explanation:
 *           type: string
 *           description: Explanation of the correct answer
 *     
 *     QuizGeneration:
 *       type: object
 *       required:
 *         - pageIds
 *         - difficulty
 *       properties:
 *         pageIds:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of page IDs to generate quiz from (varchar format)
 *           example: ["page_9_1_1756746712183_mmkmmk", "page_9_2_1756746712185_cf1yv5", "page_9_3_1756746712187_0xzyp1"]
 *         difficulty:
 *           type: string
 *           enum: [easy, medium, hard]
 *           description: Difficulty level for the quiz
 *           example: medium
 *         userId:
 *           type: integer
 *           description: Optional user ID (auto-discovered if not provided)
 *           example: 1
 *         questionCount:
 *           type: integer
 *           minimum: 10
 *           description: Number of questions to generate (minimum 10)
 *           example: 10
 *     
 *     QuizUpdate:
 *       type: object
 *       properties:
 *         difficulty:
 *           type: string
 *           enum: [easy, medium, hard]
 *           description: Updated difficulty level
 *         score:
 *           type: number
 *           format: float
 *           description: Updated quiz score
 *         userAnswers:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               questionId:
 *                 type: integer
 *               userAnswer:
 *                 type: string
 *                 enum: [A, B, C, D]
 *           description: Array of user answers to update
 *     
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           description: Error message
 *         details:
 *           type: string
 *           description: Detailed error information
 *     
 *     PaginationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Quiz'
 *         pagination:
 *           type: object
 *           properties:
 *             currentPage:
 *               type: integer
 *             totalPages:
 *               type: integer
 *             totalItems:
 *               type: integer
 *             itemsPerPage:
 *               type: integer
 * 
 *   responses:
 *     NotFound:
 *       description: Resource not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *     BadRequest:
 *       description: Invalid request parameters
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *     InternalError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 */

// Helper function to find valid pages dynamically
async function findValidPages(pageIds) {
  if (pageIds && Array.isArray(pageIds) && pageIds.length > 0) {
    // Use provided pageIds (varchar format)
    const pages = await sql`
      SELECT p."PageId", p."pageURL", p."pageNumber", b."Name" as book_title, b."BookId"
      FROM "Pages" p
      JOIN "Books" b ON p."BookId" = b."BookId"
      WHERE p."PageId" = ANY(${pageIds})
      ORDER BY b."BookId", p."pageNumber"
    `;
    return pages;
  } else {
    // Auto-discover valid pages
    const pages = await sql`
      SELECT p."PageId", p."pageURL", p."pageNumber", b."Name" as book_title, b."BookId"
      FROM "Pages" p
      JOIN "Books" b ON p."BookId" = b."BookId"
      WHERE p."pageURL" IS NOT NULL AND p."pageURL" != ''
      ORDER BY b."BookId", p."pageNumber"
      LIMIT 5
    `;
    return pages.slice(0, Math.min(3, pages.length));
  }
}

// Helper function to find valid user dynamically
async function findValidUser(userId) {
  if (userId) {
    // Use provided userId
    const users = await sql`
      SELECT "UserId", "UserName", "Email"
      FROM "User"
      WHERE "UserId" = ${userId}
    `;
    return users.length > 0 ? users[0] : null;
  } else {
    // Auto-discover first available user
    const users = await sql`
      SELECT "UserId", "UserName", "Email"
      FROM "User"
      ORDER BY "UserId"
      LIMIT 1
    `;
    return users.length > 0 ? users[0] : null;
  }
}

/**
 * @swagger
 * /api/quizzes/generate:
 *   post:
 *     summary: Generate a new quiz from specified pages
 *     description: Creates a quiz by processing OCR on specified page images and generating AI questions
 *     tags: [Quizzes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuizGeneration'
 *           examples:
 *             basic:
 *               summary: Basic quiz generation
 *               value:
 *                 pageIds: ["page_9_1_1756746712183_mmkmmk", "page_9_2_1756746712185_cf1yv5", "page_9_3_1756746712187_0xzyp1"]
 *                 difficulty: "medium"
 *                 questionCount: 10
 *             advanced:
 *               summary: Advanced quiz with specific user
 *               value:
 *                 pageIds: ["page_10_1_1756746712190_abc123", "page_10_2_1756746712192_def456", "page_10_3_1756746712194_ghi789", "page_10_4_1756746712196_jkl012"]
 *                 difficulty: "hard"
 *                 userId: 1
 *                 questionCount: 15
 *     responses:
 *       200:
 *         description: Quiz generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 quiz:
 *                   $ref: '#/components/schemas/Quiz'
 *                 questions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Question'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/generate', async (req, res) => {
  try {
    const { difficulty = 'medium', pageIds, userId, questionCount = 10 } = req.body;

    // Validate required inputs
    if (!pageIds || !Array.isArray(pageIds) || pageIds.length === 0) {
      return res.status(400).json({ 
        error: 'pageIds is required and must be a non-empty array of page IDs (varchar format)' 
      });
    }

    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(difficulty.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Invalid difficulty level. Must be: easy, medium, or hard' 
      });
    }

    // Validate question count
    if (questionCount < 10) {
      return res.status(400).json({ 
        error: 'questionCount must be at least 10' 
      });
    }

    console.log(`\n🎯 Starting quiz generation with difficulty: ${difficulty.toUpperCase()}`);
    console.log(`📄 Page IDs provided: [${pageIds.join(', ')}]`);
    console.log(`❓ Question count: ${questionCount}`);

    // Step 1: Find valid user dynamically
    console.log('\n👤 Step 1: Finding valid user...');
    const user = await findValidUser(userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'No valid user found. Please provide a valid userId or ensure users exist in database.' 
      });
    }
    console.log(`✅ Using user: ${user.UserName} (ID: ${user.UserId})`);

    // Step 2: Retrieve specific pages by IDs
    console.log('\n📄 Step 2: Retrieving specified pages...');
    const pages = await findValidPages(pageIds);
    if (pages.length === 0) {
      return res.status(404).json({ 
        error: 'No valid pages found with the provided page IDs. Please ensure pages exist and have valid URLs.' 
      });
    }

    console.log(`✅ Retrieved ${pages.length} pages for quiz generation:`);
    pages.forEach(page => {
      console.log(`   📖 Page ${page.pageNumber} from "${page.book_title}" (ID: ${page.PageId})`);
    });

    // Step 2: Process OCR for all pages
    console.log('🔍 Processing OCR for all pages...');
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

    const successfulOCR = ocrResults.filter(r => r.success).length;
    if (successfulOCR === 0) {
      return res.status(500).json({ 
        error: 'OCR failed for all pages. Cannot generate quiz without content.' 
      });
    }

    console.log(`📊 OCR Summary: ${successfulOCR}/${pages.length} pages processed successfully`);

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
        ${difficulty},
        ${JSON.stringify(pagesInfo)},
        ${user.UserId},
        ${0.0}
      )
      RETURNING "QuizId", "created_at"
    `;

    const quiz = quizResult[0];
    console.log(`✅ Quiz created with ID: ${quiz.QuizId}`);

    // Step 5: Generate questions using AI
    console.log('\n🤖 Step 5: Generating questions using AI...');
    
    const questionPrompt = `Based on the following content from multiple book pages, generate exactly ${questionCount} multiple-choice questions with difficulty level: ${difficulty}.

DIFFICULTY LEVEL GUIDELINES:
- EASY: Basic comprehension, direct facts, simple recall questions
- MEDIUM: Analysis, inference, connecting concepts, moderate complexity
- HARD: Critical thinking, complex analysis, synthesis, advanced reasoning

Content:
${combinedContext}

Requirements:
1. Generate exactly ${questionCount} questions appropriate for ${difficulty.toUpperCase()} difficulty level
2. Each question should have 4 options (A, B, C, D)
3. Provide the correct answer
4. Include a brief explanation for each answer
5. Questions must match the ${difficulty} difficulty criteria above
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
      // Try OpenAI first with difficulty-aware prompt
      console.log(`🎯 Generating ${difficulty.toUpperCase()} difficulty questions using AI...`);
      const aiResponse = await callOpenAI(questionPrompt, `Generate ${difficulty} difficulty quiz questions from the provided content.`);
      
      // Parse the AI response
      const cleanResponse = aiResponse.trim();
      const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        questionsData = JSON.parse(jsonMatch[0]);
      } else {
        questionsData = JSON.parse(cleanResponse);
      }

      if (!Array.isArray(questionsData) || questionsData.length !== questionCount) {
        throw new Error(`AI did not return exactly ${questionCount} questions in the expected format`);
      }

      console.log(`✅ Generated ${questionsData.length} questions using AI`);

    } catch (error) {
      console.error('❌ AI question generation failed:', error.message);
      return res.status(500).json({ 
        error: 'Failed to generate questions using AI', 
        details: error.message 
      });
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
        throw error;
      }
    }

    // Step 7: Store quiz and questions in local storage (JSON files)
    console.log('\n💿 Step 7: Storing quiz and questions in local storage...');
    const timestamp = Date.now();
    const quizFilename = `quiz_${quiz.QuizId}_${timestamp}.json`;
    const questionsFilename = `questions_${quiz.QuizId}_${timestamp}.json`;
    
    // Ensure test_output directory exists
    const testOutputDir = path.join(__dirname, '../../test_output');
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // Prepare quiz data for local storage
    const quizData = {
      quiz: {
        quizId: quiz.QuizId,
        difficulty: difficulty,
        pages: pagesInfo,
        userId: user.UserId,
        userName: user.UserName,
        createdAt: quiz.created_at,
        score: 0.0
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalPages: pages.length,
        successfulOCR: successfulOCR,
        totalCharacters: combinedContext.length,
        testType: 'quiz_generation_api'
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
        difficulty: difficulty,
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

    // Step 8: Return complete quiz data
    console.log('\n✅ Quiz generation completed successfully!');
    const response = {
      success: true,
      quiz: {
        quizId: quiz.QuizId,
        difficulty: difficulty,
        pages: pagesInfo,
        userId: user.UserId,
        createdAt: quiz.created_at,
        score: 0.0
      },
      questions: insertedQuestions.map(q => ({
        questionId: q.QuestionId,
        question: q.Questions,
        options: q.Options,
        correctAnswer: q.Answers,
        explanation: q.Explanation,
        myAnswer: null
      })),
      ocrSummary: {
        totalPages: pages.length,
        successfulPages: successfulOCR,
        totalCharacters: combinedContext.length
      }
    };

    console.log(`🎉 Quiz generation completed successfully! QuizId: ${quiz.QuizId}`);
    res.json(response);

  } catch (error) {
    console.error('❌ Quiz generation failed:', error);
    res.status(500).json({ 
      error: 'Failed to generate quiz', 
      details: error.message 
    });
  }
});

// Get quiz by ID with questions
router.get('/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;

    // Fetch quiz information
    const quiz = await sql`
      SELECT q."QuizId", q."Difficulty", q."Pages", q."UserId", q."Score", q."created_at", q."updated_at"
      FROM "Quizzes" q
      WHERE q."QuizId" = ${quizId}
    `;

    if (quiz.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Fetch questions for this quiz
    const questions = await sql`
      SELECT "QuestionId", "Questions", "Answers", "myAnswer", "Options", "Explanation"
      FROM "Questions"
      WHERE "QuizId" = ${quizId}
      ORDER BY "QuestionId"
    `;

    const response = {
      quiz: quiz[0],
      questions: questions
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Failed to fetch quiz:', error);
    res.status(500).json({ 
      error: 'Failed to fetch quiz', 
      details: error.message 
    });
  }
});

// Submit quiz answers
router.post('/:quizId/submit', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body; // { questionId: selectedAnswer, ... }

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Answers object is required' });
    }

    console.log(`📝 Submitting answers for quiz ${quizId}`);

    // Fetch all questions for this quiz
    const questions = await sql`
      SELECT "QuestionId", "Answers" as correct_answer
      FROM "Questions"
      WHERE "QuizId" = ${quizId}
      ORDER BY "QuestionId"
    `;

    if (questions.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    let correctAnswers = 0;
    const results = [];

    // Update each question with user's answer and calculate score
    for (const question of questions) {
      const questionId = question.QuestionId;
      const userAnswer = answers[questionId];
      const correctAnswer = question.correct_answer;
      const isCorrect = userAnswer === correctAnswer;

      if (isCorrect) {
        correctAnswers++;
      }

      // Update the question with user's answer
      await sql`
        UPDATE "Questions"
        SET "myAnswer" = ${userAnswer}
        WHERE "QuestionId" = ${questionId}
      `;

      results.push({
        questionId: questionId,
        userAnswer: userAnswer,
        correctAnswer: correctAnswer,
        isCorrect: isCorrect
      });
    }

    // Calculate final score (percentage)
    const finalScore = (correctAnswers / questions.length) * 100;

    // Update quiz with final score
    await sql`
      UPDATE "Quizzes"
      SET "Score" = ${finalScore}, "updated_at" = NOW()
      WHERE "QuizId" = ${quizId}
    `;

    console.log(`✅ Quiz submitted. Score: ${correctAnswers}/${questions.length} (${finalScore.toFixed(1)}%)`);

    const response = {
      success: true,
      quizId: parseInt(quizId),
      score: finalScore,
      correctAnswers: correctAnswers,
      totalQuestions: questions.length,
      results: results
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Failed to submit quiz:', error);
    res.status(500).json({ 
      error: 'Failed to submit quiz', 
      details: error.message 
    });
  }
});

// Get all quizzes for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const quizzes = await sql`
      SELECT q."QuizId", q."Difficulty", q."Pages", q."Score", q."created_at", q."updated_at",
             COUNT(qs."QuestionId") as question_count
      FROM "Quizzes" q
      LEFT JOIN "Questions" qs ON q."QuizId" = qs."QuizId"
      WHERE q."UserId" = ${userId}
      GROUP BY q."QuizId", q."Difficulty", q."Pages", q."Score", q."created_at", q."updated_at"
      ORDER BY q."created_at" DESC
    `;

    res.json({ quizzes });

  } catch (error) {
    console.error('❌ Failed to fetch user quizzes:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user quizzes', 
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/quizzes:
 *   get:
 *     summary: Retrieve all quizzes with pagination and filtering
 *     description: Get a paginated list of quizzes with optional filtering by user and difficulty
 *     tags: [Quizzes]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter by specific user ID
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [easy, medium, hard]
 *         description: Filter by difficulty level
 *     responses:
 *       200:
 *         description: Quizzes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginationResponse'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, userId, difficulty } = req.query;
    const offset = (page - 1) * limit;

    // Build dynamic WHERE clause
    let whereConditions = [];
    let params = [];
    
    if (userId) {
      whereConditions.push(`"UserId" = $${params.length + 1}`);
      params.push(userId);
    }
    
    if (difficulty) {
      whereConditions.push(`"Difficulty" = $${params.length + 1}`);
      params.push(difficulty);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count for pagination
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM "Quizzes" q
      JOIN "User" u ON q."UserId" = u."UserId"
      ${whereClause ? sql.unsafe(whereClause) : sql``}
    `;

    // Get quizzes with user information
    const quizzes = await sql`
      SELECT 
        q."QuizId",
        q."Difficulty",
        q."Pages",
        q."UserId",
        q."Score",
        q."created_at",
        q."updated_at",
        u."UserName",
        u."Email"
      FROM "Quizzes" q
      JOIN "User" u ON q."UserId" = u."UserId"
      ${whereClause ? sql.unsafe(whereClause) : sql``}
      ORDER BY q."created_at" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const total = parseInt(countResult[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: quizzes.map(quiz => ({
        quizId: quiz.QuizId,
        difficulty: quiz.Difficulty,
        pages: quiz.Pages,
        userId: quiz.UserId,
        userName: quiz.UserName,
        userEmail: quiz.Email,
        score: quiz.Score,
        createdAt: quiz.created_at,
        updatedAt: quiz.updated_at
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Error retrieving quizzes:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quizzes',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/quizzes/{id}:
 *   get:
 *     summary: Retrieve a specific quiz by ID
 *     description: Get detailed information about a quiz, optionally including questions
 *     tags: [Quizzes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Quiz ID
 *       - in: query
 *         name: includeQuestions
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Whether to include questions in the response
 *     responses:
 *       200:
 *         description: Quiz retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 quiz:
 *                   $ref: '#/components/schemas/Quiz'
 *                 questions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Question'
 *                   description: Only included if includeQuestions is true
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeQuestions = true } = req.query;

    // Get quiz with user information
    const quizResult = await sql`
      SELECT 
        q."QuizId",
        q."Difficulty",
        q."Pages",
        q."UserId",
        q."Score",
        q."created_at",
        q."updated_at",
        u."UserName",
        u."Email"
      FROM "Quizzes" q
      JOIN "User" u ON q."UserId" = u."UserId"
      WHERE q."QuizId" = ${id}
    `;

    if (quizResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    const quiz = quizResult[0];
    const response = {
      success: true,
      quiz: {
        quizId: quiz.QuizId,
        difficulty: quiz.Difficulty,
        pages: quiz.Pages,
        userId: quiz.UserId,
        userName: quiz.UserName,
        userEmail: quiz.Email,
        score: quiz.Score,
        createdAt: quiz.created_at,
        updatedAt: quiz.updated_at
      }
    };

    // Include questions if requested
    if (includeQuestions === 'true' || includeQuestions === true) {
      const questions = await sql`
        SELECT 
          "QuestionId",
          "Questions",
          "Answers",
          "myAnswer",
          "Options",
          "Explanation"
        FROM "Questions"
        WHERE "QuizId" = ${id}
        ORDER BY "QuestionId"
      `;

      response.questions = questions.map(q => ({
        questionId: q.QuestionId,
        question: q.Questions,
        options: q.Options,
        correctAnswer: q.Answers,
        userAnswer: q.myAnswer,
        explanation: q.Explanation
      }));
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Error retrieving quiz:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quiz',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/quizzes/{id}:
 *   put:
 *     summary: Update quiz answers and submit quiz
 *     description: Retrieve all questions for a quiz, update user answers dynamically, calculate score and submit
 *     tags: [Quizzes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Quiz ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userAnswers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: integer
 *                     myAnswer:
 *                       type: string
 *                       enum: [A, B, C, D]
 *                 description: Array of user answers to update and submit
 *               submit:
 *                 type: boolean
 *                 description: Whether to calculate final score and submit quiz
 *                 default: false
 *           examples:
 *             updateAnswers:
 *               summary: Update user answers only
 *               value:
 *                 userAnswers:
 *                   - questionId: 1
 *                     myAnswer: "A"
 *                   - questionId: 2
 *                     myAnswer: "C"
 *                 submit: false
 *             submitQuiz:
 *               summary: Submit quiz with all answers
 *               value:
 *                 userAnswers:
 *                   - questionId: 1
 *                     myAnswer: "A"
 *                   - questionId: 2
 *                     myAnswer: "C"
 *                   - questionId: 3
 *                     myAnswer: "B"
 *                 submit: true
 *     responses:
 *       200:
 *         description: Quiz updated/submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Quiz submitted successfully"
 *                 quiz:
 *                   $ref: '#/components/schemas/Quiz'
 *                 questions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Question'
 *                 scoreDetails:
 *                   type: object
 *                   properties:
 *                     correctAnswers:
 *                       type: integer
 *                     totalQuestions:
 *                       type: integer
 *                     percentage:
 *                       type: number
 *                       format: float
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userAnswers, submit = false } = req.body;

    // Check if quiz exists
    const existingQuiz = await sql`
      SELECT "QuizId", "UserId" FROM "Quizzes" WHERE "QuizId" = ${id}
    `;

    if (existingQuiz.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    // Retrieve all questions for this quiz
    const questions = await sql`
      SELECT 
        "QuestionId",
        "Questions",
        "Answers",
        "myAnswer",
        "Options",
        "Explanation"
      FROM "Questions"
      WHERE "QuizId" = ${id}
      ORDER BY "QuestionId"
    `;

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No questions found for this quiz'
      });
    }

    // Update user answers if provided
    if (userAnswers && Array.isArray(userAnswers)) {
      for (const answer of userAnswers) {
        const { questionId, myAnswer } = answer;
        
        if (questionId && myAnswer) {
          await sql`
            UPDATE "Questions"
            SET "myAnswer" = ${myAnswer}
            WHERE "QuestionId" = ${questionId} AND "QuizId" = ${id}
          `;
        }
      }
    }

    // Calculate score if submitting
    let scoreDetails = null;
    let finalScore = null;

    if (submit) {
      // Get updated questions with user answers
      const updatedQuestions = await sql`
        SELECT "QuestionId", "Answers", "myAnswer"
        FROM "Questions"
        WHERE "QuizId" = ${id}
        ORDER BY "QuestionId"
      `;

      let correctCount = 0;
      const totalQuestions = updatedQuestions.length;

      for (const question of updatedQuestions) {
        if (question.myAnswer && question.myAnswer === question.Answers) {
          correctCount++;
        }
      }

      finalScore = (correctCount / totalQuestions) * 100;
      scoreDetails = {
        correctAnswers: correctCount,
        totalQuestions: totalQuestions,
        percentage: parseFloat(finalScore.toFixed(2))
      };

      // Update quiz score
      await sql`
        UPDATE "Quizzes"
        SET "Score" = ${finalScore}, "updated_at" = NOW()
        WHERE "QuizId" = ${id}
      `;

      console.log(`✅ Quiz ${id} submitted with score: ${correctCount}/${totalQuestions} (${finalScore.toFixed(1)}%)`);
    }

    // Get updated quiz information
    const updatedQuiz = await sql`
      SELECT 
        q."QuizId",
        q."Difficulty",
        q."Pages",
        q."UserId",
        q."Score",
        q."created_at",
        q."updated_at",
        u."UserName"
      FROM "Quizzes" q
      JOIN "User" u ON q."UserId" = u."UserId"
      WHERE q."QuizId" = ${id}
    `;

    // Get updated questions with user answers
    const finalQuestions = await sql`
      SELECT 
        "QuestionId",
        "Questions",
        "Answers",
        "myAnswer",
        "Options",
        "Explanation"
      FROM "Questions"
      WHERE "QuizId" = ${id}
      ORDER BY "QuestionId"
    `;

    const response = {
      success: true,
      message: submit ? 'Quiz submitted successfully' : 'Quiz answers updated successfully',
      quiz: {
        quizId: updatedQuiz[0].QuizId,
        difficulty: updatedQuiz[0].Difficulty,
        pages: updatedQuiz[0].Pages,
        userId: updatedQuiz[0].UserId,
        userName: updatedQuiz[0].UserName,
        score: updatedQuiz[0].Score,
        createdAt: updatedQuiz[0].created_at,
        updatedAt: updatedQuiz[0].updated_at
      },
      questions: finalQuestions.map(q => ({
        questionId: q.QuestionId,
        question: q.Questions,
        options: q.Options,
        correctAnswer: q.Answers,
        userAnswer: q.myAnswer,
        explanation: q.Explanation
      }))
    };

    if (scoreDetails) {
      response.scoreDetails = scoreDetails;
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Error updating quiz:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update quiz',
      details: error.message
    });
  }
});

// DELETE /api/quizzes/:id - Delete quiz and associated questions
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if quiz exists
    const existingQuiz = await sql`
      SELECT "QuizId", "UserId" FROM "Quizzes" WHERE "QuizId" = ${id}
    `;

    if (existingQuiz.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    // Delete questions first (foreign key constraint)
    const deletedQuestions = await sql`
      DELETE FROM "Questions" WHERE "QuizId" = ${id}
      RETURNING "QuestionId"
    `;

    // Delete quiz
    const deletedQuiz = await sql`
      DELETE FROM "Quizzes" WHERE "QuizId" = ${id}
      RETURNING "QuizId", "Difficulty", "UserId"
    `;

    console.log(`✅ Deleted quiz ${id} with ${deletedQuestions.length} questions`);

    res.json({
      success: true,
      message: 'Quiz deleted successfully',
      deletedQuiz: {
        quizId: deletedQuiz[0].QuizId,
        difficulty: deletedQuiz[0].Difficulty,
        userId: deletedQuiz[0].UserId,
        deletedQuestions: deletedQuestions.length
      }
    });

  } catch (error) {
    console.error('❌ Error deleting quiz:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete quiz',
      details: error.message
    });
  }
});

module.exports = router;
