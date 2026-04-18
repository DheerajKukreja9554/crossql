CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO orders (user_id, total, status) VALUES
    (1, 299.00, 'paid'),
    (1, 149.50, 'paid'),
    (2, 89.99,  'pending'),
    (4, 499.00, 'paid'),
    (5, 59.00,  'cancelled'),
    (2, 199.00, 'paid'),
    (4, 39.99,  'pending');
