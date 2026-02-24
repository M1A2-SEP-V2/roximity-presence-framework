CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE presence_logs (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    session_id INT NOT NULL,
    log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE student_sessions (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL,
    session_id INT NOT NULL,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    student_session_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    FOREIGN KEY (student_session_id) REFERENCES student_sessions(id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_presence_logs_user_id ON presence_logs(user_id);
CREATE INDEX idx_student_sessions_student_id ON student_sessions(student_id);
CREATE INDEX idx_attendance_records_student_session_id ON attendance_records(student_session_id);
