CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO users (name, email, active) VALUES
    ('Alice',   'alice@example.com',   true),
    ('Bob',     'bob@example.com',     true),
    ('Charlie', 'charlie@example.com', false),
    ('Diana',   'diana@example.com',   true),
    ('Eve',     'eve@example.com',     true);
