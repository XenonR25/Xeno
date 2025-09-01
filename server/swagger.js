const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Xeno API Documentation",
      version: "1.0.0",
      description: "Comprehensive API documentation for Xeno application",
      contact: {
        name: "Xeno Team",
        email: "support@xeno.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server",
      },
      {
        url: "https://api.xeno.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token for authentication",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            UserId: {
              type: "integer",
              description: "Unique user identifier",
            },
            UserName: {
              type: "string",
              description: "User display name",
            },
            Email: {
              type: "string",
              format: "email",
              description: "User email address",
            },
            Phone: {
              type: "string",
              description: "User phone number",
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "User creation timestamp",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              description: "Last update timestamp",
            },
          },
        },
        Book: {
          type: "object",
          properties: {
            BookId: {
              type: "integer",
              description: "Unique book identifier",
            },
            Name: {
              type: "string",
              description: "Book name",
            },
            author: {
              type: "string",
              description: "Book author",
            },
            uploaded_at: {
              type: "string",
              format: "date-time",
              description: "Book upload timestamp",
            },
            lastopened_at: {
              type: "string",
              format: "date-time",
              description: "Last opened timestamp",
            },
            UserId: {
              type: "integer",
              description: "Owner user ID",
            },
          },
        },
        Page: {
          type: "object",
          properties: {
            PageId: {
              type: "integer",
              description: "Unique page identifier",
            },
            pageNumber: {
              type: "integer",
              description: "Page number in the book",
            },
            pageURL: {
              type: "string",
              description: "Page URL or file path",
            },
            BookId: {
              type: "integer",
              description: "Associated book ID",
            },
          },
        },
        Quiz: {
          type: "object",
          properties: {
            QuizId: {
              type: "integer",
              description: "Unique quiz identifier",
            },
            Score: {
              type: "number",
              format: "float",
              description: "Quiz score",
            },
            Difficulty: {
              type: "string",
              description: "Quiz difficulty level",
            },
            Pages: {
              type: "object",
              description: "JSON object containing page information",
            },
            UserId: {
              type: "integer",
              description: "User who took the quiz",
            },
          },
        },
        Question: {
          type: "object",
          properties: {
            QuestionId: {
              type: "integer",
              description: "Unique question identifier",
            },
            Questions: {
              type: "string",
              description: "Question text",
            },
            Answers: {
              type: "string",
              description: "Correct answer",
            },
            myAnswer: {
              type: "string",
              description: "User provided answer",
            },
            Options: {
              type: "object",
              description: "JSON array of answer options",
            },
            Explanation: {
              type: "string",
              description: "Explanation of the answer",
            },
            QuizId: {
              type: "integer",
              description: "Associated quiz ID",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "error",
            },
            message: {
              type: "string",
              description: "Error message",
            },
            error: {
              type: "string",
              description: "Detailed error information",
            },
          },
        },
        Success: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "success",
            },
            message: {
              type: "string",
              description: "Success message",
            },
            data: {
              type: "object",
              description: "Response data",
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication endpoints",
      },
      {
        name: "Users",
        description: "User management endpoints",
      },
      {
        name: "Books",
        description: "Book management endpoints",
      },
      {
        name: "Pages",
        description: "Page management endpoints",
      },
      {
        name: "Quizzes",
        description: "Quiz management endpoints",
      },
      {
        name: "Questions",
        description: "Question management endpoints",
      },
      {
        name: "Health",
        description: "System health and status endpoints",
      },
    ],
  },
  apis: ["./server/routes/*.js", "./server/index.js"],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
