const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const postgres = require("postgres");
const { DATABASE_URL } = require("../db.js");
const { authenticateToken } = require("../utils/auth.js");
const {
  processPdfAndExtractInfo,
  processPdfAndUploadPages,
} = require("../utils/pdfProcessor.js");

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

      // STEP 1: Create book record first (we'll need the bookId for page processing)
      console.log("📝 Step 1: Creating initial book record...");
      const tempBook = await sql`
        INSERT INTO "Books" ("Name", "author", "UserId")
        VALUES ('Processing...', 'Processing...', ${userId})
        RETURNING "BookId"
      `;

      if (tempBook.length === 0) {
        throw new Error("Failed to create initial book record");
      }

      const bookId = tempBook[0].BookId;
      console.log(`✅ Initial book created with ID: ${bookId}`);

      // STEP 2: Process PDF and upload all pages individually to Cloudinary
      console.log(
        "🔄 Step 2: Processing PDF and uploading pages to Cloudinary..."
      );
      const processingResult = await processPdfAndUploadPages(pdfPath, bookId);

      // STEP 3: Update book record with extracted information
      console.log(
        "📝 Step 3: Updating book record with extracted information..."
      );
      const updatedBook = await sql`
        UPDATE "Books" 
        SET "Name" = ${processingResult.bookInfo.bookName}, 
            "author" = ${processingResult.bookInfo.authorName}
        WHERE "BookId" = ${bookId}
        RETURNING "BookId", "Name", "author", "created_at", "uploaded_at"
      `;

      console.log(
        `✅ Book updated: "${updatedBook[0].Name}" by ${updatedBook[0].author}`
      );

      // STEP 4: Create page records for all uploaded pages
      console.log("📄 Step 4: Creating page records in database...");
      const pageResults = await Promise.all(
        processingResult.pages.map(
          (page) =>
            sql`
            INSERT INTO "Pages" ("pageNumber", "pageURL", "uniquePageId", "cloudinaryId", "publicId", "BookId")
            VALUES (${page.pageNumber}, ${page.pageURL}, ${page.pageId}, ${page.cloudinaryId}, ${page.publicId}, ${bookId})
            RETURNING "PageId", "pageNumber", "pageURL", "uniquePageId", "cloudinaryId", "publicId"
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
            BookId: updatedBook[0].BookId,
            Name: updatedBook[0].Name,
            author: updatedBook[0].author,
            created_at: updatedBook[0].created_at,
            uploaded_at: updatedBook[0].uploaded_at,
            totalPages: processingResult.pages.length,
          },
          pages: pageResults.map((result) => result[0]),
          processingInfo: {
            extractedText: processingResult.bookInfo,
            imagesGenerated: processingResult.pages.length,
            originalPdfPublicId: processingResult.originalPdfPublicId,
            originalPdfVersion: processingResult.originalPdfVersion,
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
      SELECT "PageId", "pageNumber", "pageURL", "uniquePageId", "cloudinaryId", "publicId"
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
      SELECT "PageId", "pageNumber", "pageURL", "uniquePageId", "cloudinaryId", "publicId"
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

/**
 * @swagger
 * /api/books/pages/{uniquePageId}:
 *   get:
 *     summary: Get a specific page by its unique page ID
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uniquePageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique page ID
 *     responses:
 *       200:
 *         description: Page retrieved successfully
 *       404:
 *         description: Page not found
 */
router.get("/pages/:uniquePageId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { uniquePageId } = req.params;

    // Get page with book information
    const page = await sql`
      SELECT p."PageId", p."pageNumber", p."pageURL", p."uniquePageId", p."cloudinaryId", p."publicId",
             b."BookId", b."Name" as bookName, b."author"
      FROM "Pages" p
      JOIN "Books" b ON p."BookId" = b."BookId"
      WHERE p."uniquePageId" = ${uniquePageId} AND b."UserId" = ${userId}
    `;

    if (page.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Page not found",
      });
    }

    return res.json({
      status: "success",
      data: {
        page: page[0],
        book: {
          BookId: page[0].BookId,
          Name: page[0].bookName,
          author: page[0].author,
        },
      },
    });
  } catch (error) {
    console.error("Get page by unique ID error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
