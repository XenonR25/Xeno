# Quiz Generation System

## Overview
A comprehensive quiz generation system that scans multiple pages using OCR, creates quizzes with difficulty levels, and generates questions based on the extracted content using AI.

## Database Schema

### Quizzes Table
- **QuizId** (int8, primary key) - Unique identifier for each quiz
- **created_at** (timestamptz) - Quiz creation timestamp
- **Score** (float8) - Final quiz score (0-100)
- **updated_at** (timestamp) - Last update timestamp
- **Difficulty** (varchar) - Quiz difficulty level (easy, medium, hard)
- **Pages** (json) - Information about pages used to generate the quiz
- **UserId** (int8, foreign key → User.UserId) - User who created/owns the quiz

### Questions Table
- **QuestionId** (int8, primary key) - Unique identifier for each question
- **created_at** (timestamptz) - Question creation timestamp
- **Questions** (varchar) - The question text
- **Answers** (varchar) - Correct answer (A, B, C, or D)
- **myAnswer** (varchar) - User's selected answer
- **Options** (json) - Multiple choice options {A, B, C, D}
- **Explanation** (varchar) - Explanation of the correct answer
- **QuizId** (int8, foreign key → Quizzes.QuizId) - Associated quiz

## API Endpoints

### 1. Generate Quiz
**POST** `/api/quizzes/generate`

Creates a new quiz by scanning multiple pages with OCR and generating questions using AI.

**Request Body:**
```json
{
  "pageIds": [1, 2, 3],
  "difficulty": "medium",
  "userId": 1
}
```

**Response:**
```json
{
  "success": true,
  "quiz": {
    "quizId": 1,
    "difficulty": "medium",
    "pages": [...],
    "userId": 1,
    "createdAt": "2024-01-01T00:00:00Z",
    "score": 0.0
  },
  "questions": [...],
  "ocrSummary": {
    "totalPages": 3,
    "successfulPages": 3,
    "totalCharacters": 5000
  }
}
```

### 2. Get Quiz
**GET** `/api/quizzes/:quizId`

Retrieves a quiz with all its questions.

**Response:**
```json
{
  "quiz": {
    "QuizId": 1,
    "Difficulty": "medium",
    "Pages": [...],
    "UserId": 1,
    "Score": 85.0,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "questions": [...]
}
```

### 3. Submit Quiz
**POST** `/api/quizzes/:quizId/submit`

Submits answers for a quiz and calculates the final score.

**Request Body:**
```json
{
  "answers": {
    "1": "A",
    "2": "B",
    "3": "C"
  }
}
```

**Response:**
```json
{
  "success": true,
  "quizId": 1,
  "score": 85.0,
  "correctAnswers": 8,
  "totalQuestions": 10,
  "results": [...]
}
```

### 4. Get User Quizzes
**GET** `/api/quizzes/user/:userId`

Retrieves all quizzes for a specific user.

**Response:**
```json
{
  "quizzes": [
    {
      "QuizId": 1,
      "Difficulty": "medium",
      "Pages": [...],
      "Score": 85.0,
      "created_at": "2024-01-01T00:00:00Z",
      "question_count": 10
    }
  ]
}
```

## Workflow

### Quiz Generation Process
1. **User Input Validation** - Validates pageIds array and userId
2. **Page Retrieval** - Fetches page information from database
3. **OCR Processing** - Extracts text content from page images
4. **Quiz Creation** - Creates quiz record in database
5. **AI Question Generation** - Uses OpenAI to generate 10 questions
6. **Database Storage** - Stores questions in Questions table
7. **Response** - Returns complete quiz data

### Question Generation
- Uses AI (OpenAI) to analyze OCR content
- Generates exactly 10 multiple-choice questions
- Each question has 4 options (A, B, C, D)
- Includes correct answer and explanation
- Difficulty level influences question complexity

### Quiz Submission
- Updates Questions table with user answers
- Calculates score as percentage of correct answers
- Updates quiz score and timestamp
- Returns detailed results

## Files

### Core Implementation
- **`server/routes/quizzes.js`** - Main quiz API routes
- **`server/test-quiz-generation.js`** - Comprehensive test suite
- **`server/index.js`** - Updated to include quiz routes

### Dependencies
- **OCR Processing** - `server/utils/pdfProcessor.js`
- **AI Integration** - `server/utils/auth.js` (OpenAI, Gemini, DeepSeek)
- **Database** - `server/db.js`

## Testing

Run the comprehensive test suite:
```bash
cd server
node test-quiz-generation.js
```

The test includes:
- User validation
- Page retrieval and OCR processing
- Quiz creation
- AI question generation
- Database storage
- Quiz submission simulation

## Configuration

### Required Environment Variables
- **OPENAI_API_KEY** - For AI question generation
- **Database connection** - PostgreSQL configuration

### Hardcoded Test Values
Update these in test files for your environment:
- `HARDCODED_USER_ID` - Valid user ID
- `HARDCODED_PAGE_IDS` - Valid page IDs with image content

## Features

### ✅ Implemented
- Multi-page OCR scanning
- AI-powered question generation
- Difficulty level support
- Complete CRUD operations
- Score calculation
- User association
- Comprehensive error handling
- Test suite

### 🔄 Workflow
1. Select multiple pages from books
2. System extracts text via OCR
3. AI generates relevant questions
4. User takes quiz
5. System calculates and stores score

### 📊 Data Storage
- Quiz metadata (difficulty, pages, user)
- Generated questions with options
- User answers and scores
- Timestamps and audit trail

## Usage Example

```javascript
// Generate a quiz
const response = await fetch('/api/quizzes/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pageIds: [1, 2, 3],
    difficulty: 'medium',
    userId: 1
  })
});

// Take the quiz
const quiz = await response.json();

// Submit answers
await fetch(`/api/quizzes/${quiz.quiz.quizId}/submit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    answers: { "1": "A", "2": "B", "3": "C" }
  })
});
```

## Error Handling

The system includes comprehensive error handling for:
- Invalid page IDs
- OCR processing failures
- AI generation errors
- Database connection issues
- User validation errors

All errors are logged and returned with appropriate HTTP status codes.
