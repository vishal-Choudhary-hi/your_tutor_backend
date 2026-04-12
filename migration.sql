CREATE TABLE topics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_by INT,
  title VARCHAR(255),
  overview TEXT,
  parent_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (parent_id) REFERENCES topics(id) ON DELETE CASCADE
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE mcqs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  topic_id INT,
  question TEXT,
  options JSON,
  correct_answer VARCHAR(10),
  explanation TEXT,

  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE TABLE attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  topic_id INT,
  score INT,
  total INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE TABLE answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT,
  mcq_id INT,
  user_answer VARCHAR(10),
  is_correct BOOLEAN,

  FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(150) UNIQUE,
  password VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE attempts ADD COLUMN user_id INT;
ALTER TABLE attempts ADD FOREIGN KEY (user_id) REFERENCES users(id);