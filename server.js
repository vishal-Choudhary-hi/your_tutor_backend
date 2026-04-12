require("dotenv").config();//env load
require("./config/db");//db init

const express = require("express");
const cors = require("cors");
const tutorRoutes = require("./routes/tutor");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/tutor", tutorRoutes);
app.use("/api/auth", authRoutes);

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});