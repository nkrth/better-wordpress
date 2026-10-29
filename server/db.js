const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, requester TEXT NOT NULL, created_at INTEGER NOT NULL, upvotes INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS request_votes (request_id INTEGER NOT NULL, username TEXT NOT NULL, PRIMARY KEY (request_id, username));
CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', snippet TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, request_id INTEGER, parent_id INTEGER, tags TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, saved_at INTEGER NOT NULL, saved_by TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS article_collaborators (article_id INTEGER NOT NULL, username TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY (article_id, username));
CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id INTEGER NOT NULL, parent_id INTEGER, username TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL, edited_at INTEGER);
CREATE TABLE IF NOT EXISTS comment_edits (id INTEGER PRIMARY KEY AUTOINCREMENT, comment_id INTEGER NOT NULL, text TEXT NOT NULL, edited_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS reactions (comment_id INTEGER NOT NULL, username TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (comment_id, username, emoji));
CREATE TABLE IF NOT EXISTS chatrooms (id INTEGER PRIMARY KEY AUTOINCREMENT, comment_id INTEGER NOT NULL UNIQUE, article_id INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chatroom_id INTEGER NOT NULL, username TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL);
`);

module.exports = db;