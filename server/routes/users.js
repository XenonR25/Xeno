const express = require("express");
const postgres = require("postgres");
const { DATABASE_URL } = require("../db.js");
const {
  hashPassword,
  verifyPassword,
  generateToken,
  authenticateToken,
} = require("../utils/auth.js");

const router = express.Router();
const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Validation middleware
function validateUserData(req, res, next) {
  const { UserName, Email, Password, Phone } = req.body;

  if (!UserName || !Email || !Password) {
    return res.status(400).json({
      status: "error",
      message: "UserName, Email, and Password are required",
    });
  }

  if (Password.length < 6) {
    return res.status(400).json({
      status: "error",
      message: "Password must be at least 6 characters long",
    });
  }

  if (!Email.includes("@")) {
    return res.status(400).json({
      status: "error",
      message: "Please provide a valid email address",
    });
  }

  next();
}

/**
 * @swagger
 * /api/users/signup:
 *   post:
 *     summary: User registration
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - UserName
 *               - Email
 *               - Password
 *             properties:
 *               UserName:
 *                 type: string
 *                 description: User's display name
 *               Email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               Password:
 *                 type: string
 *                 minLength: 6
 *                 description: User's password
 *               Phone:
 *                 type: string
 *                 description: User's phone number (optional)
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */
router.post("/signup", validateUserData, async (req, res) => {
  try {
    const { UserName, Email, Password, Phone } = req.body;

    // Check if user already exists
    const existingUser = await sql`
      SELECT "UserId" FROM "User" WHERE "Email" = ${Email}
    `;

    if (existingUser.length > 0) {
      return res.status(409).json({
        status: "error",
        message: "User with this email already exists",
      });
    }

    // Hash password
    const { hash, salt } = hashPassword(Password);

    // Create user
    const newUser = await sql`
      INSERT INTO "User" ("UserName", "Email", "Password", "Salt", "Phone")
      VALUES (${UserName}, ${Email}, ${hash}, ${salt}, ${Phone})
      RETURNING "UserId", "UserName", "Email", "Phone", "created_at"
    `;

    // Generate JWT token
    const token = generateToken(newUser[0].UserId, newUser[0].Email);

    res.status(201).json({
      status: "success",
      message: "User created successfully",
      data: {
        user: newUser[0],
        token,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Email
 *               - Password
 *             properties:
 *               Email:
 *                 type: string
 *                 format: email
 *               Password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       404:
 *         description: User not found
 */
router.post("/login", async (req, res) => {
  try {
    const { Email, Password } = req.body;

    if (!Email || !Password) {
      return res.status(400).json({
        status: "error",
        message: "Email and Password are required",
      });
    }

    // Find user by email
    const user = await sql`
      SELECT "UserId", "UserName", "Email", "Password", "Salt", "Phone", "created_at"
      FROM "User" 
      WHERE "Email" = ${Email}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Verify password
    const isValidPassword = verifyPassword(
      Password,
      user[0].Password,
      user[0].Salt
    );

    if (!isValidPassword) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = generateToken(user[0].UserId, user[0].Email);

    // Update last login time
    await sql`
      UPDATE "User" 
      SET "updated_at" = NOW() 
      WHERE "UserId" = ${user[0].UserId}
    `;

    res.json({
      status: "success",
      message: "Login successful",
      data: {
        user: {
          UserId: user[0].UserId,
          UserName: user[0].UserName,
          Email: user[0].Email,
          Phone: user[0].Phone,
          created_at: user[0].created_at,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await sql`
      SELECT "UserId", "UserName", "Email", "Phone", "created_at", "updated_at"
      FROM "User" 
      WHERE "UserId" = ${userId}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.json({
      status: "success",
      data: user[0],
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               UserName:
 *                 type: string
 *               Phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { UserName, Phone } = req.body;

    if (!UserName && !Phone) {
      return res.status(400).json({
        status: "error",
        message: "At least one field (UserName or Phone) is required",
      });
    }

    let updateQuery = `UPDATE "User" SET "updated_at" = NOW()`;
    const updateValues = [];

    if (UserName) {
      updateQuery += `, "UserName" = $${updateValues.length + 1}`;
      updateValues.push(UserName);
    }

    if (Phone) {
      updateQuery += `, "Phone" = $${updateValues.length + 1}`;
      updateValues.push(Phone);
    }

    updateQuery += ` WHERE "UserId" = $${updateValues.length + 1} RETURNING *`;
    updateValues.push(userId);

    const updatedUser = await sql.unsafe(updateQuery, updateValues);

    if (updatedUser.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        UserId: updatedUser[0].UserId,
        UserName: updatedUser[0].UserName,
        Email: updatedUser[0].Email,
        Phone: updatedUser[0].Phone,
        created_at: updatedUser[0].created_at,
        updated_at: updatedUser[0].updated_at,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
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
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const totalCount = await sql`
      SELECT COUNT(*) as total FROM "User"
    `;

    // Get users with pagination
    const users = await sql`
      SELECT "UserId", "UserName", "Email", "Phone", "created_at", "updated_at"
      FROM "User"
      ORDER BY "created_at" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    res.json({
      status: "success",
      data: {
        users,
        pagination: {
          page,
          limit,
          total: parseInt(totalCount[0].total),
          pages: Math.ceil(parseInt(totalCount[0].total) / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Get individual user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       404:
 *         description: User not found
 */
router.get("/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await sql`
      SELECT "UserId", "UserName", "Email", "Phone", "created_at", "updated_at"
      FROM "User" 
      WHERE "UserId" = ${parseInt(userId)}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.json({
      status: "success",
      data: user[0],
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     summary: Delete user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       403:
 *         description: Cannot delete own account
 */
router.delete("/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    // Prevent user from deleting their own account
    if (parseInt(userId) === currentUserId) {
      return res.status(403).json({
        status: "error",
        message: "Cannot delete your own account",
      });
    }

    const deletedUser = await sql`
      DELETE FROM "User" 
      WHERE "UserId" = ${parseInt(userId)}
      RETURNING "UserId", "UserName", "Email"
    `;

    if (deletedUser.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.json({
      status: "success",
      message: "User deleted successfully",
      data: deletedUser[0],
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/users/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized or invalid current password
 */
router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: "error",
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        status: "error",
        message: "New password must be at least 6 characters long",
      });
    }

    // Get current user with password
    const user = await sql`
      SELECT "Password", "Salt" FROM "User" WHERE "UserId" = ${userId}
    `;

    if (user.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Verify current password
    const isValidPassword = verifyPassword(
      currentPassword,
      user[0].Password,
      user[0].Salt
    );

    if (!isValidPassword) {
      return res.status(401).json({
        status: "error",
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const { hash, salt } = hashPassword(newPassword);

    // Update password
    await sql`
      UPDATE "User" 
      SET "Password" = ${hash}, "Salt" = ${salt}, "updated_at" = NOW()
      WHERE "UserId" = ${userId}
    `;

    res.json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
