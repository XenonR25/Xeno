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
 * /api/categories:
 *   post:
 *     summary: Create a new category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Name
 *               - Description
 *               - ModelId
 *               - PromptId
 *             properties:
 *               Name:
 *                 type: string
 *                 description: Category name
 *               Description:
 *                 type: string
 *                 description: Category description
 *               ModelId:
 *                 type: integer
 *                 description: Foreign key to Model table
 *               PromptId:
 *                 type: integer
 *                 description: Foreign key to Prompting table
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { Name, Description, ModelId, PromptId } = req.body;

    // Validate required fields
    if (!Name || !Description || !ModelId || !PromptId) {
      return res.status(400).json({
        status: "error",
        message: "Name, Description, ModelId, and PromptId are required",
      });
    }

    console.log(`🔧 Creating category: ${Name} with ModelId: ${ModelId}, PromptId: ${PromptId}`);

    // Verify ModelId exists
    const modelExists = await sql`
      SELECT "ModelId" FROM "Model" WHERE "ModelId" = ${parseInt(ModelId)}
    `;

    if (modelExists.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid ModelId - Model does not exist",
      });
    }

    // Verify PromptId exists
    const promptExists = await sql`
      SELECT "PromptId" FROM "Prompting" WHERE "PromptId" = ${parseInt(PromptId)}
    `;

    if (promptExists.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid PromptId - Prompt does not exist",
      });
    }

    // Create category
    const newCategory = await sql`
      INSERT INTO "Category" (
        "Name", "Description", "ModelId", "PromptId"
      )
      VALUES (
        ${Name}, ${Description}, ${parseInt(ModelId)}, ${parseInt(PromptId)}
      )
      RETURNING "CategoryId", "Name", "Description", "ModelId", "PromptId", "created_at"
    `;

    console.log(`✅ Category created successfully: ${newCategory[0].Name}`);

    return res.status(201).json({
      status: "success",
      message: "Category created successfully",
      data: newCategory[0],
    });
  } catch (error) {
    console.error("Create category error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to create category",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ModelId
 *         schema:
 *           type: integer
 *         description: Filter by Model ID
 *       - in: query
 *         name: PromptId
 *         schema:
 *           type: integer
 *         description: Filter by Prompt ID
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { ModelId, PromptId } = req.query;

    console.log(`🔍 Fetching categories with filters - ModelId: ${ModelId}, PromptId: ${PromptId}`);

    let query = sql`
      SELECT c."CategoryId", c."Name", c."Description", c."ModelId", c."PromptId", c."created_at",
             m."ModelName", p."Prompt"
      FROM "Category" c
      LEFT JOIN "Model" m ON c."ModelId" = m."ModelId"
      LEFT JOIN "Prompting" p ON c."PromptId" = p."PromptId"
    `;

    // Add filters if provided
    const conditions = [];
    if (ModelId) {
      conditions.push(sql`c."ModelId" = ${parseInt(ModelId)}`);
    }
    if (PromptId) {
      conditions.push(sql`c."PromptId" = ${parseInt(PromptId)}`);
    }

    if (conditions.length > 0) {
      query = sql`${query} WHERE ${sql.join(conditions, sql` AND `)}`;
    }

    query = sql`${query} ORDER BY c."created_at" DESC`;

    const categories = await query;

    console.log(`✅ Retrieved ${categories.length} categories`);

    return res.json({
      status: "success",
      data: {
        categories: categories,
        total: categories.length,
        filters: { ModelId, PromptId },
      },
    });
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/categories/{categoryId}:
 *   get:
 *     summary: Get a specific category by ID
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *       404:
 *         description: Category not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/:categoryId", authenticateToken, async (req, res) => {
  try {
    const { categoryId } = req.params;

    console.log(`🔍 Fetching category ${categoryId}`);

    const category = await sql`
      SELECT c."CategoryId", c."Name", c."Description", c."ModelId", c."PromptId", c."created_at",
             m."ModelName", p."Prompt"
      FROM "Category" c
      LEFT JOIN "Model" m ON c."ModelId" = m."ModelId"
      LEFT JOIN "Prompting" p ON c."PromptId" = p."PromptId"
      WHERE c."CategoryId" = ${parseInt(categoryId)}
    `;

    if (category.length === 0) {
      console.log(`❌ Category not found: ${categoryId}`);
      return res.status(404).json({
        status: "error",
        message: "Category not found",
      });
    }

    console.log(`✅ Category found: ${category[0].Name}`);

    return res.json({
      status: "success",
      data: category[0],
    });
  } catch (error) {
    console.error("Get category error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/categories/{categoryId}:
 *   put:
 *     summary: Update a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Name:
 *                 type: string
 *               Description:
 *                 type: string
 *               ModelId:
 *                 type: integer
 *               PromptId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put("/:categoryId", authenticateToken, async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { Name, Description, ModelId, PromptId } = req.body;

    console.log(`🔧 Updating category ${categoryId}`);

    // Check if category exists
    const existingCategory = await sql`
      SELECT "CategoryId" FROM "Category" 
      WHERE "CategoryId" = ${parseInt(categoryId)}
    `;

    if (existingCategory.length === 0) {
      console.log(`❌ Category not found: ${categoryId}`);
      return res.status(404).json({
        status: "error",
        message: "Category not found",
      });
    }

    // Verify ModelId exists if provided
    if (ModelId) {
      const modelExists = await sql`
        SELECT "ModelId" FROM "Model" WHERE "ModelId" = ${parseInt(ModelId)}
      `;

      if (modelExists.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Invalid ModelId - Model does not exist",
        });
      }
    }

    // Verify PromptId exists if provided
    if (PromptId) {
      const promptExists = await sql`
        SELECT "PromptId" FROM "Prompting" WHERE "PromptId" = ${parseInt(PromptId)}
      `;

      if (promptExists.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Invalid PromptId - Prompt does not exist",
        });
      }
    }

    // Update category
    const updatedCategory = await sql`
      UPDATE "Category" 
      SET "Name" = ${Name}, "Description" = ${Description}, 
          "ModelId" = ${parseInt(ModelId)}, "PromptId" = ${parseInt(PromptId)}
      WHERE "CategoryId" = ${parseInt(categoryId)}
      RETURNING "CategoryId", "Name", "Description", "ModelId", "PromptId", "created_at"
    `;

    console.log(`✅ Category updated successfully: ${updatedCategory[0].Name}`);

    return res.json({
      status: "success",
      message: "Category updated successfully",
      data: updatedCategory[0],
    });
  } catch (error) {
    console.error("Update category error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to update category",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/categories/{categoryId}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       404:
 *         description: Category not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete("/:categoryId", authenticateToken, async (req, res) => {
  try {
    const { categoryId } = req.params;

    console.log(`🗑️ Deleting category ${categoryId}`);

    // Check if category exists
    const existingCategory = await sql`
      SELECT "CategoryId", "Name" FROM "Category" 
      WHERE "CategoryId" = ${parseInt(categoryId)}
    `;

    if (existingCategory.length === 0) {
      console.log(`❌ Category not found: ${categoryId}`);
      return res.status(404).json({
        status: "error",
        message: "Category not found",
      });
    }

    // Delete category
    const deletedCategory = await sql`
      DELETE FROM "Category" 
      WHERE "CategoryId" = ${parseInt(categoryId)}
      RETURNING "CategoryId", "Name", "Description"
    `;

    console.log(`✅ Category deleted: ${deletedCategory[0].Name}`);

    return res.json({
      status: "success",
      message: "Category deleted successfully",
      data: deletedCategory[0],
    });
  } catch (error) {
    console.error("Delete category error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete category",
      error: error.message,
    });
  }
});

module.exports = router;
