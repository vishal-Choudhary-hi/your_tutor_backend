const axios = require("axios");
const db = require("../config/db");

exports.generateTutor = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { topic,instructions,parent_topic_id } = req.body;

    const response = await axios.post(
      `${process.env.PYTHON_SERVICE_URL}/generate`,
      { topic, instructions },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.INTERNAL_API_KEY
        }
      }
    );

    const data = response.data;

    await connection.beginTransaction();

    // 2. Insert main topic
    const [topicResult] = await connection.execute(
      "INSERT INTO topics (user_id,title, overview, parent_id) VALUES (?, ?, ?)",
      [req.user.id, data.topic, data.overview, parent_topic_id || null]
    );

    const mainTopicId = topicResult.insertId;

    for (const sub of data.subtopics) {
      await connection.execute(
        "INSERT INTO topics (title, parent_id) VALUES (?, ?)",
        [sub, mainTopicId]
      );
    }

    for (const mcq of data.mcqs) {
      await connection.execute(
        `INSERT INTO mcqs 
        (topic_id, question, options, correct_answer, explanation)
        VALUES (?, ?, ?, ?, ?)`,
        [
          mainTopicId,
          mcq.question,
          JSON.stringify(mcq.options),
          mcq.correct_answer,
          mcq.explanation
        ]
      );
    }

    await connection.commit();

    return res.json({
      success: true,
      topic_id: mainTopicId,
      data
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "DB transaction failed"
    });

  } finally {
    connection.release();
  }
};


exports.evaluateAnswers = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const userId = req.user.id;
    const { topic_id, answers } = req.body;

    if (!topic_id || !answers) {
      return res.status(400).json({
        success: false,
        message: "topic_id and answers are required"
      });
    }

    await connection.beginTransaction();

    // 1. Get correct answers from DB
    const [mcqs] = await connection.execute(
      "SELECT id, correct_answer, explanation, question FROM mcqs WHERE topic_id = ?",
      [topic_id]
    );

    let score = 0;

    // Map user answers by mcq_id
    const userAnswerMap = {};
    for (const ans of answers) {
      userAnswerMap[ans.mcq_id] = ans.user_answer;
    }

    // 2. Evaluate
    const results = mcqs.map((q) => {
      const userAnswer = userAnswerMap[q.id];
      const isCorrect = userAnswer === q.correct_answer;

      if (isCorrect) score++;

      return {
        mcq_id: q.id,
        question: q.question,
        correct: isCorrect,
        correct_answer: q.correct_answer,
        user_answer: userAnswer,
        explanation: q.explanation
      };
    });

    // 3. Save attempt
    const [attemptResult] = await connection.execute(
      "INSERT INTO attempts (user_id, topic_id, score, total) VALUES (?, ?, ?, ?)",
      [userId, topic_id, score, mcqs.length]
    );

    const attemptId = attemptResult.insertId;

    // 4. Save answers
    for (const r of results) {
      await connection.execute(
        `INSERT INTO answers (attempt_id, mcq_id, user_answer, is_correct)
         VALUES (?, ?, ?, ?)`,
        [attemptId, r.mcq_id, r.user_answer, r.correct]
      );
    }

    await connection.commit();

    return res.json({
      success: true,
      score,
      total: mcqs.length,
      attempt_id: attemptId,
      results
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Evaluation failed"
    });

  } finally {
    connection.release();
  }
};

exports.getTopicDetails = async (req, res) => {
  try {
    const topicId = req.params.id;
    const userId = req.user.id;

    // 1. Get main topic (only root)
    const [topics] = await db.execute(
      `SELECT * FROM topics 
       WHERE id = ? AND parent_id IS NULL`,
      [topicId]
    );

    if (!topics.length) {
      return res.status(404).json({
        success: false,
        message: "Topic not found"
      });
    }

    const topic = topics[0];

    // 2. Get subtopics (1 level only)
    const [subtopics] = await db.execute(
      `SELECT id, title FROM topics WHERE parent_id = ? AND created_by = ?`,
      [topicId, userId]
    );

    const subtopicNames = subtopics.map(s => s.title);

    // 3. Get MCQs
    const [mcqs] = await db.execute(
      `SELECT id, question, options, correct_answer, explanation 
       FROM mcqs WHERE topic_id = ?`,
      [topicId]
    );

    // Parse options JSON
    const parsedMcqs = mcqs.map(q => ({
      ...q,
      options: JSON.parse(q.options)
    }));

    // 4. Get attempts of user for this topic
    const [attempts] = await db.execute(
      `SELECT * FROM attempts 
       WHERE topic_id = ? AND user_id = ?`,
      [topicId, userId]
    );

    // 5. Get answers for attempts
    let answers = [];

    if (attempts.length) {
      const attemptIds = attempts.map(a => a.id);

      const [ans] = await db.query(
        `SELECT * FROM answers WHERE attempt_id IN (?)`,
        [attemptIds]
      );

      answers = ans;
    }

    return res.json({
      success: true,
      data: {
        topic,
        subtopics: subtopicNames,
        mcqs: parsedMcqs,
        attempts,
        answers
      }
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch topic details"
    });
  }
};

exports.getSubtopics = async (req, res) => {
  try {
    const parentId = req.params.parentId;
    const userId = req.user.id;
    const [subtopics] = await db.execute(
      `SELECT id, title FROM topics WHERE parent_id = ? AND created_by = ?`,
      [parentId, userId]
    );

    return res.json({
      success: true,
      count: subtopics.length,
      data: subtopics
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch subtopics"
    });
  }
};

exports.getUserHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get topics created by user (only root topics)
    const [topics] = await db.execute(
      `SELECT id, title, created_at 
       FROM topics 
       WHERE created_by = ? AND parent_id IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );

    if (!topics.length) {
      return res.json({
        success: true,
        data: []
      });
    }

    const topicIds = topics.map(t => t.id);

    // Get attempts summary
    const [attemptStats] = await db.query(
      `
      SELECT 
        topic_id,
        COUNT(*) as attempts_count,
        MAX(id) as latest_attempt_id
      FROM attempts
      WHERE topic_id IN (?)
      GROUP BY topic_id
      `,
      [topicIds]
    );

    // Map for quick lookup
    const attemptMap = {};
    attemptStats.forEach(a => {
      attemptMap[a.topic_id] = a;
    });

    // Get latest attempt scores
    const latestAttemptIds = attemptStats.map(a => a.latest_attempt_id);

    let latestAttempts = [];
    if (latestAttemptIds.length) {
      const [rows] = await db.query(
        `SELECT id, topic_id, score, total 
         FROM attempts 
         WHERE id IN (?)`,
        [latestAttemptIds]
      );

      latestAttempts = rows;
    }

    const latestMap = {};
    latestAttempts.forEach(a => {
      latestMap[a.topic_id] = a;
    });

    // Final response
    const result = topics.map(topic => {
      const stats = attemptMap[topic.id] || {};
      const latest = latestMap[topic.id] || {};

      return {
        topic_id: topic.id,
        title: topic.title,
        created_at: topic.created_at,
        attempts_count: stats.attempts_count || 0,
        latest_score: latest.score || 0,
        total_questions: latest.total || 0
      };
    });

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch history"
    });
  }
};