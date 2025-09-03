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
 * /api/models:
 *   post:
 *     summary: Create a new AI model
 *     tags: [AI Models]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ModelName
 *               - Description
 *             properties:
 *               ModelName:
 *                 type: string
 *                 description: Model name
 *               Description:
 *                 type: string
 *                 description: Model description
 *     responses:
 *       201:
 *         description: Model created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { ModelName, Description } = req.body;

    // Validate required fields
    if (!ModelName || !Description) {
      return res.status(400).json({
        status: "error",
        message: "ModelName and Description are required",
      });
    }

    console.log(`🔧 Creating model: ${ModelName}`);

    // Create model
    const newModel = await sql`
      INSERT INTO "Model" (
        "ModelName", "Description"
      )
      VALUES (
        ${ModelName}, ${Description}
      )
      RETURNING "ModelId", "ModelName", "Description", "created_at"
    `;

    console.log(`✅ Model created successfully: ${newModel[0].ModelName}`);

    return res.status(201).json({
      status: "success",
      message: "Model created successfully",
      data: newModel[0],
    });
  } catch (error) {
    console.error("Create model error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to create model",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/models:
 *   get:
 *     summary: Get all AI models
 *     tags: [AI Models]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Models retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    console.log(`🔍 Fetching all models`);

    const models = await sql`
      SELECT "ModelId", "ModelName", "Description", "created_at"
      FROM "Model" 
      ORDER BY "created_at" DESC
    `;

    console.log(`✅ Retrieved ${models.length} models`);

    return res.json({
      status: "success",
      data: {
        models: models,
        total: models.length,
      },
    });
  } catch (error) {
    console.error("Get models error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/models/{modelId}:
 *   get:
 *     summary: Get a specific AI model by ID
 *     tags: [AI Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Model ID
 *     responses:
 *       200:
 *         description: Model retrieved successfully
 *       404:
 *         description: Model not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/:modelId", authenticateToken, async (req, res) => {
  try {
    const { modelId } = req.params;

    console.log(`🔍 Fetching model ${modelId}`);

    const model = await sql`
      SELECT "ModelId", "ModelName", "Description", "created_at"
      FROM "Model" 
      WHERE "ModelId" = ${parseInt(modelId)}
    `;

    if (model.length === 0) {
      console.log(`❌ Model not found: ${modelId}`);
      return res.status(404).json({
        status: "error",
        message: "Model not found",
      });
    }

    console.log(`✅ Model found: ${model[0].ModelName}`);

    return res.json({
      status: "success",
      data: model[0],
    });
  } catch (error) {
    console.error("Get model error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/models/{modelId}:
 *   put:
 *     summary: Update an AI model
 *     tags: [AI Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Model ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ModelName:
 *                 type: string
 *               Description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Model updated successfully
 *       404:
 *         description: Model not found
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put("/:modelId", authenticateToken, async (req, res) => {
  try {
    const { modelId } = req.params;
    const { ModelName, Description } = req.body;

    console.log(`🔧 Updating model ${modelId}`);

    // Check if model exists
    const existingModel = await sql`
      SELECT "ModelId" FROM "Model" 
      WHERE "ModelId" = ${parseInt(modelId)}
    `;

    if (existingModel.length === 0) {
      console.log(`❌ Model not found: ${modelId}`);
      return res.status(404).json({
        status: "error",
        message: "Model not found",
      });
    }

    // Update model
    const updatedModel = await sql`
      UPDATE "Model" 
      SET "ModelName" = ${ModelName}, "Description" = ${Description}
      WHERE "ModelId" = ${parseInt(modelId)}
      RETURNING "ModelId", "ModelName", "Description", "created_at"
    `;

    console.log(`✅ Model updated successfully: ${updatedModel[0].ModelName}`);

    return res.json({
      status: "success",
      message: "Model updated successfully",
      data: updatedModel[0],
    });
  } catch (error) {
    console.error("Update model error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to update model",
      error: error.message,
    });
  }
});


/**
 * @swagger
 * /api/models/{modelId}:
 *   delete:
 *     summary: Delete an AI model
 *     tags: [AI Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Model ID
 *     responses:
 *       200:
 *         description: Model deleted successfully
 *       404:
 *         description: Model not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete("/:modelId", authenticateToken, async (req, res) => {
  try {
    const { modelId } = req.params;

    console.log(`🗑️ Deleting model ${modelId}`);

    // Check if model exists
    const existingModel = await sql`
      SELECT "ModelId", "ModelName" FROM "Model" 
      WHERE "ModelId" = ${parseInt(modelId)}
    `;

    if (existingModel.length === 0) {
      console.log(`❌ Model not found: ${modelId}`);
      return res.status(404).json({
        status: "error",
        message: "Model not found",
      });
    }

    // Delete model
    const deletedModel = await sql`
      DELETE FROM "Model" 
      WHERE "ModelId" = ${parseInt(modelId)}
      RETURNING "ModelId", "ModelName", "Description"
    `;

    console.log(`✅ Model deleted: ${deletedModel[0].ModelName}`);

    return res.json({
      status: "success",
      message: "Model deleted successfully",
      data: deletedModel[0],
    });
  } catch (error) {
    console.error("Delete model error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete model",
      error: error.message,
    });
  }
});


module.exports = router;
