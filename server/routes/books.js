const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const postgres = require("postgres");
const { DATABASE_URL } = require("../db.js");
const { authenticateToken } = require("../utils/auth.js");
const { processPdfAndExtractInfo } = require("../utils/pdfProcessor.js");

const router = express.Router();
const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Only allow PDF files
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * @swagger
 * /api/books/create:
 *   post:
 *     summary: Create a new book from PDF upload
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - pdfFile
 *             properties:
 *               pdfFile:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to upload and process
 *     responses:
 *       201:
 *         description: Book created successfully
 *       400:
 *         description: Invalid file or processing error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  "/create",
  authenticateToken,
  upload.single("pdfFile"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: "error",
          message: "PDF file is required",
        });
      }

      const userId = req.user.userId;
      const pdfPath = req.file.path;

      console.log(
        `📚 Processing PDF for user ${userId}: ${req.file.originalname}`
      );

      // STEP 1: Process PDF and extract book information from cover page
      console.log(
        "🔄 Step 1: Processing PDF and extracting book information..."
      );
      const processingResult = await processPdfAndExtractInfo(pdfPath);

      // STEP 2: Create book record with extracted information
      console.log("📝 Step 2: Creating book record in database...");
      const newBook = await sql`
        INSERT INTO "Books" ("Name", "author", "UserId")
        VALUES (${processingResult.bookInfo.bookName}, ${processingResult.bookInfo.authorName}, ${userId})
        RETURNING "BookId", "Name", "author", "created_at", "uploaded_at"
      `;

      if (newBook.length === 0) {
        throw new Error("Failed to create book record");
      }

      const bookId = newBook[0].BookId;
      console.log(`✅ Book created with ID: ${bookId}`);

      // STEP 3: Create page records for all pages
      console.log("📄 Step 3: Creating page records in database...");
      const pageResults = await Promise.all(
        processingResult.pages.map(
          (page) =>
            sql`
            INSERT INTO "Pages" ("pageNumber", "pageURL", "BookId")
            VALUES (${page.pageNumber}, ${page.pageURL}, ${bookId})
            RETURNING "PageId", "pageNumber", "pageURL"
          `
        )
      );

      console.log(
        `✅ Created ${pageResults.length} page records with Cloudinary URLs`
      );

      // Clean up uploaded PDF file
      try {
        fs.unlinkSync(pdfPath);
      } catch (_) {}

      return res.status(201).json({
        status: "success",
        message: "Book created successfully",
        data: {
          book: {
            BookId: newBook[0].BookId,
            Name: newBook[0].Name,
            author: newBook[0].author,
            created_at: newBook[0].created_at,
            uploaded_at: newBook[0].uploaded_at,
            totalPages: processingResult.pages.length,
          },
          pages: pageResults.map((result) => result[0]),
          processingInfo: {
            extractedText: processingResult.bookInfo,
            imagesGenerated: processingResult.pages.length,
            localFolder: processingResult.localFolder || undefined,
          },
        },
      });
    } catch (error) {
      console.error("Create book error:", error);

      // Clean up uploaded file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
      }

      return res.status(500).json({
        status: "error",
        message: "Failed to create book",
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/books:
 *   get:
 *     summary: Get all books for the authenticated user
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of books per page
 *     responses:
 *       200:
 *         description: Books retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const totalCount = await sql`
      SELECT COUNT(*) as total FROM "Books" WHERE "UserId" = ${userId}
    `;

    // Get books with pagination
    const books = await sql`
      SELECT b."BookId", b."Name", b."author", b."created_at", b."uploaded_at", b."lastopened_at",
             COUNT(p."PageId") as totalPages
      FROM "Books" b
      LEFT JOIN "Pages" p ON b."BookId" = p."BookId"
      WHERE b."UserId" = ${userId}
      GROUP BY b."BookId"
      ORDER BY b."created_at" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return res.json({
      status: "success",
      data: {
        books,
        pagination: {
          page,
          limit,
          total: parseInt(totalCount[0].total),
          pages: Math.ceil(parseInt(totalCount[0].total) / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get books error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/books/{bookId}:
 *   get:
 *     summary: Get book details with all pages
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Book ID
 *     responses:
 *       200:
 *         description: Book details retrieved successfully
 *       404:
 *         description: Book not found
 */
router.get("/:bookId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;

    // Get book details
    const book = await sql`
      SELECT "BookId", "Name", "author", "created_at", "uploaded_at", "lastopened_at"
      FROM "Books" 
      WHERE "BookId" = ${parseInt(bookId)} AND "UserId" = ${userId}
    `;

    if (book.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Book not found",
      });
    }

    // Get all pages for the book
    const pages = await sql`
      SELECT "PageId", "pageNumber", "pageURL"
      FROM "Pages" 
      WHERE "BookId" = ${parseInt(bookId)}
      ORDER BY "pageNumber"
    `;

    // Update last opened time
    await sql`
      UPDATE "Books" 
      SET "lastopened_at" = NOW() 
      WHERE "BookId" = ${parseInt(bookId)}
    `;

    return res.json({
      status: "success",
      data: {
        book: book[0],
        pages,
        totalPages: pages.length,
      },
    });
  } catch (error) {
    console.error("Get book error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/books/{bookId}:
 *   delete:
 *     summary: Delete book and all its pages
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Book ID
 *     responses:
 *       200:
 *         description: Book deleted successfully
 *       404:
 *         description: Book not found
 */
router.delete("/:bookId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;

    // Check if book exists and belongs to user
    const book = await sql`
      SELECT "BookId", "Name" FROM "Books" 
      WHERE "BookId" = ${parseInt(bookId)} AND "UserId" = ${userId}
    `;

    if (book.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Book not found",
      });
    }

    // Delete book (pages will be deleted automatically due to CASCADE)
    const deletedBook = await sql`
      DELETE FROM "Books" 
      WHERE "BookId" = ${parseInt(bookId)}
      RETURNING "BookId", "Name"
    `;

    return res.json({
      status: "success",
      message: "Book deleted successfully",
      data: deletedBook[0],
    });
  } catch (error) {
    console.error("Delete book error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/books/{bookId}/pages:
 *   get:
 *     summary: Get all pages for a specific book
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Book ID
 *     responses:
 *       200:
 *         description: Pages retrieved successfully
 *       404:
 *         description: Book not found
 */
router.get("/:bookId/pages", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;

    // Check if book exists and belongs to user
    const book = await sql`
      SELECT "BookId", "Name" FROM "Books" 
      WHERE "BookId" = ${parseInt(bookId)} AND "UserId" = ${userId}
    `;

    if (book.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Book not found",
      });
    }

    // Get all pages
    const pages = await sql`
      SELECT "PageId", "pageNumber", "pageURL"
      FROM "Pages" 
      WHERE "BookId" = ${parseInt(bookId)}
      ORDER BY "pageNumber"
    `;

    return res.json({
      status: "success",
      data: {
        book: book[0],
        pages,
        totalPages: pages.length,
      },
    });
  } catch (error) {
    console.error("Get pages error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
