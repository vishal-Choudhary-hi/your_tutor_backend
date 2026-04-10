require("dotenv").config();

const express = require("express");
const cors = require("cors");
const tutorRoutes = require("./routes/tutor");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/tutor", tutorRoutes);

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});