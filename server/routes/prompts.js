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
 * /api/prompts:
 *   post:
 *     summary: Create a new prompt
 *     tags: [Prompts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Prompt
 *             properties:
 *               Prompt:
 *                 type: string
 *                 description: The prompt text
 *     responses:
 *       201:
 *         description: Prompt created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { Prompt } = req.body;

    // Validate required fields
    if (!Prompt) {
      return res.status(400).json({
        status: "error",
        message: "Prompt is required",
      });
    }

    console.log(`🔧 Creating prompt: ${Prompt.substring(0, 50)}...`);

    // Create prompt
    const newPrompt = await sql`
      INSERT INTO "Prompting" (
        "Prompt"
      )
      VALUES (
        ${Prompt}
      )
      RETURNING "PromptId", "Prompt", "created_at"
    `;

    console.log(`✅ Prompt created successfully with ID: ${newPrompt[0].PromptId}`);

    return res.status(201).json({
      status: "success",
      message: "Prompt created successfully",
      data: newPrompt[0],
    });
  } catch (error) {
    console.error("Create prompt error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to create prompt",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/prompts:
 *   get:
 *     summary: Get all prompts
 *     tags: [Prompts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Prompts retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    console.log(`🔍 Fetching all prompts`);

    const prompts = await sql`
      SELECT "PromptId", "Prompt", "created_at"
      FROM "Prompting" 
      ORDER BY "created_at" DESC
    `;

    console.log(`✅ Retrieved ${prompts.length} prompts`);

    return res.json({
      status: "success",
      data: {
        prompts: prompts,
        total: prompts.length,
      },
    });
  } catch (error) {
    console.error("Get prompts error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/prompts/{promptId}:
 *   get:
 *     summary: Get a specific prompt by ID
 *     tags: [Prompts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: promptId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Prompt ID
 *     responses:
 *       200:
 *         description: Prompt retrieved successfully
 *       404:
 *         description: Prompt not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/:promptId", authenticateToken, async (req, res) => {
  try {
    const { promptId } = req.params;

    console.log(`🔍 Fetching prompt ${promptId}`);

    const prompt = await sql`
      SELECT "PromptId", "Prompt", "created_at"
      FROM "Prompting" 
      WHERE "PromptId" = ${parseInt(promptId)}
    `;

    if (prompt.length === 0) {
      console.log(`❌ Prompt not found: ${promptId}`);
      return res.status(404).json({
        status: "error",
        message: "Prompt not found",
      });
    }

    console.log(`✅ Prompt found: ${prompt[0].PromptId}`);

    return res.json({
      status: "success",
      data: prompt[0],
    });
  } catch (error) {
    console.error("Get prompt error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/prompts/{promptId}:
 *   put:
 *     summary: Update a prompt
 *     tags: [Prompts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: promptId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Prompt ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Prompt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Prompt updated successfully
 *       404:
 *         description: Prompt not found
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put("/:promptId", authenticateToken, async (req, res) => {
  try {
    const { promptId } = req.params;
    const { Prompt } = req.body;

    console.log(`🔧 Updating prompt ${promptId}`);

    // Check if prompt exists
    const existingPrompt = await sql`
      SELECT "PromptId" FROM "Prompting" 
      WHERE "PromptId" = ${parseInt(promptId)}
    `;

    if (existingPrompt.length === 0) {
      console.log(`❌ Prompt not found: ${promptId}`);
      return res.status(404).json({
        status: "error",
        message: "Prompt not found",
      });
    }

    // Update prompt
    const updatedPrompt = await sql`
      UPDATE "Prompting" 
      SET "Prompt" = ${Prompt}
      WHERE "PromptId" = ${parseInt(promptId)}
      RETURNING "PromptId", "Prompt", "created_at"
    `;

    console.log(`✅ Prompt updated successfully: ${updatedPrompt[0].PromptId}`);

    return res.json({
      status: "success",
      message: "Prompt updated successfully",
      data: updatedPrompt[0],
    });
  } catch (error) {
    console.error("Update prompt error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to update prompt",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/prompts/{promptId}:
 *   delete:
 *     summary: Delete a prompt
 *     tags: [Prompts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: promptId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Prompt ID
 *     responses:
 *       200:
 *         description: Prompt deleted successfully
 *       404:
 *         description: Prompt not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete("/:promptId", authenticateToken, async (req, res) => {
  try {
    const { promptId } = req.params;

    console.log(`🗑️ Deleting prompt ${promptId}`);

    // Check if prompt exists
    const existingPrompt = await sql`
      SELECT "PromptId", "Prompt" FROM "Prompting" 
      WHERE "PromptId" = ${parseInt(promptId)}
    `;

    if (existingPrompt.length === 0) {
      console.log(`❌ Prompt not found: ${promptId}`);
      return res.status(404).json({
        status: "error",
        message: "Prompt not found",
      });
    }

    // Delete prompt
    const deletedPrompt = await sql`
      DELETE FROM "Prompting" 
      WHERE "PromptId" = ${parseInt(promptId)}
      RETURNING "PromptId", "Prompt"
    `;

    console.log(`✅ Prompt deleted: ${deletedPrompt[0].PromptId}`);

    return res.json({
      status: "success",
      message: "Prompt deleted successfully",
      data: deletedPrompt[0],
    });
  } catch (error) {
    console.error("Delete prompt error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete prompt",
      error: error.message,
    });
  }
});

module.exports = router;
