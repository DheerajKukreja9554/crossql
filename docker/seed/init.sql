-- Create multiple databases on the same server (mimics production setup)
-- PostgreSQL init scripts run against the default database first,
-- then we create additional databases and seed them.

CREATE DATABASE users;
CREATE DATABASE orders;

-- Seed the users database
\connect users;
\i /docker-entrypoint-initdb.d/02-users.sql

-- Seed the orders database
\connect orders;
\i /docker-entrypoint-initdb.d/03-orders.sql
