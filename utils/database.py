import sqlite3
import os
from pathlib import Path
from datetime import datetime

DB_DIR = Path(__file__).resolve().parent.parent / "database"
DB_PATH = DB_DIR / "heartdrop.db"

def get_db_connection():
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS hearts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                share_code TEXT UNIQUE NOT NULL,
                image_path TEXT NOT NULL,
                video_path TEXT,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_hearts_share_code ON hearts(share_code)")
    conn.close()

def create_heart(share_code: str, image_path: str, video_path: str | None, message: str, expires_at: datetime | None = None) -> int:
    conn = get_db_connection()
    with conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO hearts (share_code, image_path, video_path, message, expires_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            share_code,
            image_path,
            video_path,
            message,
            expires_at.isoformat() if expires_at else None
        ))
        heart_id = cursor.lastrowid
    conn.close()
    return heart_id

def get_heart_by_share_code(share_code: str) -> dict | None:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, share_code, image_path, video_path, message, created_at, expires_at
        FROM hearts
        WHERE share_code = ?
    """, (share_code,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None
