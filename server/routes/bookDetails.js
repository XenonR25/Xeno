const express = require("express");
const postgres = require("postgres");
const { DATABASE_URL } = require("../db.js");
const { authenticateToken } = require("../utils/auth.js");

const router = express.Router();
const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

/**
 * @swagger
 * /api/books/{bookId}:
 *   get:
 *     summary: Get book details with all pages
 *     tags: [Book Details]
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
 *                     book:
 *                       type: object
 *                       properties:
 *                         BookId:
 *                           type: integer
 *                           description: Database book ID
 *                         Name:
 *                           type: string
 *                           description: Book title
 *                         author:
 *                           type: string
 *                           description: Book author
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           description: When the book was created
 *                         uploaded_at:
 *                           type: string
 *                           format: date-time
 *                           description: When the book was uploaded
 *                         lastopened_at:
 *                           type: string
 *                           format: date-time
 *                           description: When the book was last opened
 *                     pages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           PageId:
 *                             type: integer
 *                             description: Database page ID
 *                           pageNumber:
 *                             type: integer
 *                             description: Page number in the book
 *                           pageURL:
 *                             type: string
 *                             description: Cloudinary URL of the page image
 *                           cloudinaryId:
 *                             type: string
 *                             description: Cloudinary asset ID
 *                     totalPages:
 *                       type: integer
 *                       description: Total number of pages in the book
 *       404:
 *         description: Book not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/:bookId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;

    console.log(
      `📚 Fetching book details for BookId: ${bookId}, UserId: ${userId}`
    );

    // Get book details
    const book = await sql`
      SELECT "BookId", "Name", "author", "created_at", "uploaded_at", "lastopened_at"
      FROM "Books" 
      WHERE "BookId" = ${parseInt(bookId)} AND "UserId" = ${userId}
    `;

    if (book.length === 0) {
      console.log(`❌ Book not found: BookId ${bookId} for UserId ${userId}`);
      return res.status(404).json({
        status: "error",
        message: "Book not found",
      });
    }

    console.log(`✅ Book found: "${book[0].Name}" by ${book[0].author}`);

    // Get all pages for the book
    const pages = await sql`
      SELECT "PageId", "pageNumber", "pageURL", "cloudinaryId"
      FROM "Pages" 
      WHERE "BookId" = ${parseInt(bookId)}
      ORDER BY "pageNumber"
    `;

    console.log(`📄 Retrieved ${pages.length} pages for BookId: ${bookId}`);

    // Update last opened time
    await sql`
      UPDATE "Books" 
      SET "lastopened_at" = NOW() 
      WHERE "BookId" = ${parseInt(bookId)}
    `;

    console.log(`⏰ Updated lastopened_at for BookId: ${bookId}`);

    return res.json({
      status: "success",
      data: {
        book: book[0],
        pages: pages.map((page) => ({
          PageId: page.PageId,
          pageNumber: page.pageNumber,
          pageURL: page.pageURL,
          cloudinaryId: page.cloudinaryId,
        })),
        totalPages: pages.length,
      },
    });
  } catch (error) {
    console.error("Get book details error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/books/{bookId}/summary:
 *   get:
 *     summary: Get book summary without pages (faster response)
 *     tags: [Book Details]
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
 *         description: Book summary retrieved successfully
 *       404:
 *         description: Book not found
 *       500:
 *         description: Internal server error
 */
router.get("/:bookId/summary", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;

    console.log(
      `📚 Fetching book summary for BookId: ${bookId}, UserId: ${userId}`
    );

    // Get book details with page count
    const book = await sql`
      SELECT b."BookId", b."Name", b."author", b."created_at", b."uploaded_at", b."lastopened_at",
             COUNT(p."PageId") as totalPages
      FROM "Books" b
      LEFT JOIN "Pages" p ON b."BookId" = p."BookId"
      WHERE b."BookId" = ${parseInt(bookId)} AND b."UserId" = ${userId}
      GROUP BY b."BookId"
    `;

    if (book.length === 0) {
      console.log(`❌ Book not found: BookId ${bookId} for UserId ${userId}`);
      return res.status(404).json({
        status: "error",
        message: "Book not found",
      });
    }

    console.log(
      `✅ Book summary found: "${book[0].Name}" with ${book[0].totalPages} pages`
    );

    return res.json({
      status: "success",
      data: {
        book: {
          BookId: book[0].BookId,
          Name: book[0].Name,
          author: book[0].author,
          created_at: book[0].created_at,
          uploaded_at: book[0].uploaded_at,
          lastopened_at: book[0].lastopened_at,
          totalPages: parseInt(book[0].totalPages),
        },
      },
    });
  } catch (error) {
    console.error("Get book summary error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
