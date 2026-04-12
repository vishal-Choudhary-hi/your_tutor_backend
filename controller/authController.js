const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.execute(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );

    return res.json({
      success: true,
      user_id: result.insertId
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
};


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await db.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (!users.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    );

    return res.json({
      success: true,
      token
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
};