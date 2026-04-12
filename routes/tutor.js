const express = require("express");
const router = express.Router();
const { generateTutor, evaluateAnswers, getTopicDetails, getSubtopics, getUserHistory } = require("../controller/tutorController");
const authMiddleware = require("../middleware/auth");

router.get("/history", authMiddleware, getUserHistory);
router.get("/topic/:id", authMiddleware, getTopicDetails);
router.get("/subtopics/:parentId", authMiddleware, getSubtopics);


router.post("/generate", authMiddleware, generateTutor);
router.post("/evaluate", authMiddleware, evaluateAnswers);

module.exports = router;