CREATE DATABASE auth_db;
CREATE USER auth_user WITH PASSWORD 'auth_password';
GRANT ALL PRIVILEGES ON DATABASE auth_db TO auth_user;

CREATE DATABASE post_db;
CREATE USER post_user WITH PASSWORD 'post_password';
GRANT ALL PRIVILEGES ON DATABASE post_db TO post_user;