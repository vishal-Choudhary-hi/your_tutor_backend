const axios = require("axios");

exports.generateTutor = async (req, res) => {
  try {
    const { topic } = req.body;

    const response = await axios.post(
      `${process.env.PYTHON_SERVICE_URL}/generate`,
      { topic }
    );

    return res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error(error.message);

    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};