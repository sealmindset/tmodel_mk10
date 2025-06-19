#!/usr/bin/env python3
import os
import sys
import psycopg2
import glob
import re

DB = os.environ.get("DB", "postgres")
USER = os.environ.get("USER", "postgres")
PASSWORD = os.environ.get("PASSWORD", "postgres")
HOST = os.environ.get("HOST", "localhost")
PORT = os.environ.get("PORT", "5432")

def get_live_schema():
    conn = psycopg2.connect(
        dbname=DB, user=USER, password=PASSWORD, host=HOST, port=PORT
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    """)
    schema = {}
    for table, column, dtype in cur.fetchall():
        schema.setdefault(table, []).append(column)
    cur.close()
    conn.close()
    return schema

def scan_codebase():
    # Recursively scan for table/column usage in .js, .sql, .json, .py, .ejs, etc.
    root = os.path.dirname(os.path.abspath(__file__))
    exts = ('*.js', '*.sql', '*.json', '*.py', '*.ejs')
    files = []
    for ext in exts:
        files += glob.glob(os.path.join(root, '**', ext), recursive=True)
    table_col_usage = {}
    table_re = re.compile(r'\bfrom\s+([a-zA-Z0-9_]+)', re.IGNORECASE)
    col_re = re.compile(r'\b([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\b')
    for f in files:
        with open(f, encoding="utf-8", errors="ignore") as fh:
            txt = fh.read()
            for m in table_re.finditer(txt):
                table = m.group(1)
                table_col_usage.setdefault(table, set())
            for m in col_re.finditer(txt):
                table, col = m.groups()
                table_col_usage.setdefault(table, set()).add(col)
    return {k: sorted(list(v)) for k, v in table_col_usage.items()}

def main():
    live_schema = get_live_schema()
    code_usage = scan_codebase()
    missing = []
    for table, cols in code_usage.items():
        if table not in live_schema:
            missing.append(f"Missing table: {table}")
        else:
            for col in cols:
                if col not in live_schema[table]:
                    missing.append(f"Missing column: {table}.{col}")
    # Write schema.sql (reuse logic from step 2, or export from pg_dump)
    os.system(f'pg_dump --schema-only --no-owner --no-privileges -U {USER} -h {HOST} -p {PORT} {DB} > schema.sql')
    if missing:
        for m in missing:
            print(m, file=sys.stderr)
        sys.exit(1)
    print("Schema extraction and validation successful.")

if __name__ == "__main__":
    main()