const express = require("express");
const postgres = require("postgres");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./swagger.js");
const { initializeDatabase } = require("./init-db.js");

// Load database configuration
const { DATABASE_URL } = require("./db.js");

const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create PostgreSQL client
const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Import routes
const userRoutes = require("./routes/users.js");
const bookRoutes = require("./routes/books.js");
const bookDetailsRoutes = require("./routes/bookDetails.js");
const modelRoutes = require("./routes/models.js");

// Swagger documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Xeno API Documentation",
  })
);

// API routes
app.use("/api/users", userRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/books", bookDetailsRoutes);
app.use("/api/models", modelRoutes);

// Database connection function
async function connectToDatabase() {
  try {
    // Test connection with a simple query
    const result = await sql`SELECT NOW()`;
    console.log("✅ Database connected successfully!");
    console.log("📊 Database query test successful:", result[0]);

    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    return false;
  }
}

// Test database connection endpoint
app.get("/api/db-test", async (req, res) => {
  try {
    const result =
      await sql`SELECT NOW() as current_time, version() as db_version`;
    res.json({
      status: "success",
      message: "Database connection is working",
      data: result[0],
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Database test failed",
      error: error.message,
    });
  }
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    // Test database connection
    await sql`SELECT 1`;
    res.json({
      status: "success",
      message: "Server is running",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Server is running but database is disconnected",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error.message,
    });
  }
});

// Root endpoint
app.get("/", async (req, res) => {
  try {
    // Test database connection
    await sql`SELECT 1`;
    res.json({
      message: "Welcome to Xeno Server!",
      status: "running",
      port: PORT,
      database: "connected",
      documentation: "/api-docs",
      endpoints: {
        health: "/api/health",
        dbTest: "/api/db-test",
        users: "/api/users",
        books: "/api/books",
        docs: "/api-docs",
      },
    });
  } catch (error) {
    res.json({
      message: "Welcome to Xeno Server!",
      status: "running",
      port: PORT,
      database: "disconnected",
      warning: "Database connection failed",
      documentation: "/api-docs",
      endpoints: {
        health: "/api/health",
        dbTest: "/api/db-test",
        users: "/api/users",
        books: "/api/books",
        docs: "/api-docs",
      },
    });
  }
});

// Start server function
async function startServer() {
  try {
    // First connect to database
    const dbConnected = await connectToDatabase();

    if (dbConnected) {
      // Initialize database tables
      console.log("🚀 Initializing database tables...");
      await initializeDatabase();

      // Start Express server
      app.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
        console.log(`🌐 Server URL: http://localhost:${PORT}`);
        console.log(`📊 Database: Connected`);
        console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
        console.log("📝 Available endpoints:");
        console.log(`   - GET / (Server info)`);
        console.log(`   - GET /api/health (Health check)`);
        console.log(`   - GET /api/db-test (Database test)`);
        console.log(`   - GET /api-docs (Swagger documentation)`);
        console.log(`   - POST /api/users/signup (User registration)`);
        console.log(`   - POST /api/users/login (User login)`);
        console.log(`   - GET /api/users/profile (Get profile)`);
        console.log(`   - PUT /api/users/profile (Update profile)`);
        console.log(`   - GET /api/users (Get all users)`);
        console.log(`   - GET /api/users/:userId (Get user by ID)`);
        console.log(`   - DELETE /api/users/:userId (Delete user)`);
        console.log(`   - POST /api/users/change-password (Change password)`);
        console.log(`   - POST /api/books/create (Create book from PDF)`);
        console.log(`   - GET /api/books (Get user's books)`);
        console.log(`   - GET /api/books/:bookId (Get book details)`);
        console.log(`   - DELETE /api/books/:bookId (Delete book)`);
        console.log(`   - GET /api/books/:bookId/pages (Get book pages)`);
      });
    } else {
      console.error(
        "❌ Failed to start server due to database connection issues"
      );
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down server...");
  try {
    await sql.end();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down server...");
  try {
    await sql.end();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
});

// Start the server
startServer();
