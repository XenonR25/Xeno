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
  extractTextFromImageUrl,
  extractBookInfo,
  generateGenericBookInfo,
  testFirstPageOCR,
  testOCRFromImageUrl,
  testOCROnLocalImage,
  processTextFileAndCreateBook,
  testCloudinaryPageUpload,
  runAllTests,
  downloadFile,
  buildPageImageUrl,
  tryGeminiModels,
  uploadPageToCloudinary,
  generatePageId,
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
            INSERT INTO "Pages" ("pageNumber", "pageURL", "PageId", "cloudinaryId", "BookId")
            VALUES (${page.pageNumber}, ${page.pageURL}, ${page.uniquePageId}, ${page.cloudinaryId}, ${bookId})
            RETURNING "PageId", "pageNumber", "pageURL", "PageId", "cloudinaryId"
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

// Book details endpoint moved to bookDetails.js

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
      SELECT "PageId", "pageNumber", "pageURL", "cloudinaryId"
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
 * /api/books/pages/{PageId}:
 *   get:
 *     summary: Get a specific page by its  page ID
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: PageId
 *         required: true
 *         schema:
 *           type: string
 *         description: page ID
 *     responses:
 *       200:
 *         description: Page retrieved successfully
 *       404:
 *         description: Page not found
 */
router.get("/pages/:PageId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { PageId } = req.params;

    // Get page with book information
    const page = await sql`
      SELECT p."PageId", p."pageNumber", p."pageURL", p."cloudinaryId",
             b."BookId", b."Name" as bookName, b."author"
      FROM "Pages" p
      JOIN "Books" b ON p."BookId" = b."BookId"
      WHERE p."PageId" = ${PageId} AND b."UserId" = ${userId}
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

/**
 * @swagger
 * /api/books/test/ocr:
 *   post:
 *     summary: Test OCR functionality on a PDF file
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
 *                 description: PDF file to test OCR on
 *     responses:
 *       200:
 *         description: OCR test completed successfully
 *       400:
 *         description: Invalid file or processing error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  "/test/ocr",
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

      const pdfPath = req.file.path;
      console.log(`🧪 Testing OCR on PDF: ${req.file.originalname}`);

      // Test OCR on first page
      const ocrResult = await testFirstPageOCR(pdfPath);

      // Clean up uploaded PDF file
      try {
        fs.unlinkSync(pdfPath);
      } catch (_) {}

      if (ocrResult.success) {
        return res.json({
          status: "success",
          message: "OCR test completed successfully",
          data: {
            extractedText: ocrResult.extractedText,
            totalPages: ocrResult.totalPages,
            imageUrl: ocrResult.imageUrl,
            cloudinaryInfo: ocrResult.cloudinaryInfo,
          },
        });
      } else {
        return res.status(400).json({
          status: "error",
          message: "OCR test failed",
          error: ocrResult.error,
        });
      }
    } catch (error) {
      console.error("OCR test error:", error);

      // Clean up uploaded file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
      }

      return res.status(500).json({
        status: "error",
        message: "Failed to complete OCR test",
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/books/test/cloudinary-upload:
 *   post:
 *     summary: Test Cloudinary page upload functionality
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
 *                 description: PDF file to test page upload on
 *     responses:
 *       200:
 *         description: Cloudinary upload test completed successfully
 *       400:
 *         description: Invalid file or processing error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  "/test/cloudinary-upload",
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

      const pdfPath = req.file.path;
      const tempBookId = Math.floor(Math.random() * 10000) + 1000;

      console.log(
        `🧪 Testing Cloudinary page upload on PDF: ${req.file.originalname}`
      );
      console.log(`📚 Using temporary book ID: ${tempBookId}`);

      // Test Cloudinary page upload
      const uploadResult = await testCloudinaryPageUpload(pdfPath, tempBookId);

      // Clean up uploaded PDF file
      try {
        fs.unlinkSync(pdfPath);
      } catch (_) {}

      if (uploadResult.success) {
        return res.json({
          status: "success",
          message: "Cloudinary upload test completed successfully",
          data: {
            bookInfo: uploadResult.result.bookInfo,
            totalPages: uploadResult.result.pages.length,
            localImagesPath: uploadResult.result.localImagesPath,
            originalPdfPublicId: uploadResult.result.originalPdfPublicId,
            originalPdfVersion: uploadResult.result.originalPdfVersion,
            pages: uploadResult.result.pages.map((page) => ({
              pageNumber: page.pageNumber,
              pageId: page.pageId,
              pageURL: page.pageURL,
              cloudinaryId: page.cloudinaryId,
            })),
          },
        });
      } else {
        return res.status(400).json({
          status: "error",
          message: "Cloudinary upload test failed",
          error: uploadResult.error,
        });
      }
    } catch (error) {
      console.error("Cloudinary upload test error:", error);

      // Clean up uploaded file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
      }

      return res.status(500).json({
        status: "error",
        message: "Failed to complete Cloudinary upload test",
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/books/{bookId}/page-ids:
 *   get:
 *     summary: Get all page IDs for a specific book
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
 *         description: Page IDs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookId:
 *                       type: integer
 *                       description: The book ID
 *                     pageIds:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           pageId:
 *                             type: integer
 *                             description: Database page ID
 *                           uniquePageId:
 *                             type: string
 *                             description: Unique page identifier
 *                           pageNumber:
 *                             type: integer
 *                             description: Page number in the book
 *                           cloudinaryId:
 *                             type: string
 *                             description: Cloudinary asset ID
 *                     totalPages:
 *                       type: integer
 *                       description: Total number of pages
 *       404:
 *         description: Book not found
 *       500:
 *         description: Internal server error
 */
router.get("/:bookId/page-ids", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;

    // Check if book exists and belongs to user
    const book = await sql`
      SELECT "BookId", "Name", "author" FROM "Books" 
      WHERE "BookId" = ${parseInt(bookId)} AND "UserId" = ${userId}
    `;

    if (book.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Book not found",
      });
    }

    // Get all page IDs and essential info
    const pageIds = await sql`
      SELECT 
        "PageId",
        "uniquePageId", 
        "pageNumber",
        "cloudinaryId"
      FROM "Pages" 
      WHERE "BookId" = ${parseInt(bookId)}
      ORDER BY "pageNumber"
    `;

    return res.json({
      status: "success",
      data: {
        bookId: parseInt(bookId),
        bookName: book[0].Name,
        author: book[0].author,
        pageIds: pageIds.map((page) => ({
          pageId: page.PageId,
          uniquePageId: page.uniquePageId,
          pageNumber: page.pageNumber,
          cloudinaryId: page.cloudinaryId,
        })),
        totalPages: pageIds.length,
      },
    });
  } catch (error) {
    console.error("Get page IDs error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/books/{bookId}/page-ids/simple:
 *   get:
 *     summary: Get just the page IDs as a simple array
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
 *         description: Page IDs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     pageIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Array of unique page IDs
 *                     totalPages:
 *                       type: integer
 *                       description: Total number of pages
 *       404:
 *         description: Book not found
 *       500:
 *         description: Internal server error
 */
router.get("/:bookId/page-ids/simple", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;

    // Check if book exists and belongs to user
    const book = await sql`
      SELECT "BookId" FROM "Books" 
      WHERE "BookId" = ${parseInt(bookId)} AND "UserId" = ${userId}
    `;

    if (book.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Book not found",
      });
    }

    // Get just the unique page IDs
    const pageIds = await sql`
      SELECT "uniquePageId"
      FROM "Pages" 
      WHERE "BookId" = ${parseInt(bookId)}
      ORDER BY "pageNumber"
    `;

    return res.json({
      status: "success",
      data: {
        pageIds: pageIds.map((page) => page.uniquePageId),
        totalPages: pageIds.length,
      },
    });
  } catch (error) {
    console.error("Get simple page IDs error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
