import sqlite3
conn = sqlite3.connect('brainrot.db')
c = conn.cursor()
try:
    c.execute("ALTER TABLE api_keys ADD COLUMN eldorado_email VARCHAR;")
    print("Added eldorado_email column")
except sqlite3.OperationalError as e:
    print(f"Column might already exist: {e}")

c.execute('''CREATE TABLE IF NOT EXISTS config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key VARCHAR UNIQUE,
                value VARCHAR
             )''')
c.execute("INSERT OR IGNORE INTO config (key, value) VALUES ('LLM_API_KEY', 'sk-8b222539a757ac8381d0d792c777903d')")
conn.commit()
conn.close()
print("Migration complete")
