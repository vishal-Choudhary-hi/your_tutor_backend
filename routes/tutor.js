const express = require("express");
const router = express.Router();
const { generateTutor } = require("../controllers/tutorController");

router.post("/generate", generateTutor);

module.exports = router;