import re
import os

SCHEMA_FILE = r"d:\capstone_website\AutoKita-Smart-Automotive-Repair-Shop-Management-System\sql\Other\Capstone_postgres_fixed.sql"
MIGRATION_FILE = r"d:\capstone_website\AutoKita-Smart-Automotive-Repair-Shop-Management-System\sql\Other\Migrations_postgresSQL.sql"

def parse_schema(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    tables = {}
    table_pattern = re.compile(r'CREATE TABLE "(.*?)" \((.*?)\);', re.DOTALL | re.IGNORECASE)
    for match in table_pattern.finditer(content):
        table_name = match.group(1).lower()
        columns_str = match.group(2)
        
        # split columns by comma, but be careful with nested parens (like DECIMAL(10,2))
        columns = []
        for line in columns_str.split('\n'):
            line = line.strip()
            if not line: continue
            if line.startswith('FOREIGN KEY') or line.startswith('PRIMARY KEY') or line.startswith('UNIQUE'):
                continue
            
            # Match `"column_name" type`
            col_match = re.match(r'^"([^"]+)"', line)
            if col_match:
                columns.append(col_match.group(1).lower())
                
        tables[table_name] = set(columns)
    
    return tables

def parse_migrations(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    inserts = {}
    # Match INSERT INTO table_name (col1, col2, ...)
    insert_pattern = re.compile(r'INSERT INTO ([a-zA-Z0-9_]+)\s*\((.*?)\)', re.DOTALL | re.IGNORECASE)
    for match in insert_pattern.finditer(content):
        table_name = match.group(1).lower()
        columns_str = match.group(2)
        
        columns = [c.strip().strip('"').lower() for c in columns_str.split(',')]
        inserts[table_name] = set(columns)
        
    return inserts

schema_tables = parse_schema(SCHEMA_FILE)
migration_inserts = parse_migrations(MIGRATION_FILE)

print(f"Tables in Schema: {len(schema_tables)}")
print(f"Tables with Migrations: {len(migration_inserts)}")

for table, cols in migration_inserts.items():
    if table not in schema_tables:
        print(f"WARNING: Table '{table}' has migrations but is NOT in schema!")
        continue
        
    schema_cols = schema_tables[table]
    missing_in_schema = cols - schema_cols
    
    if missing_in_schema:
        print(f"ERROR: Table '{table}' migration inserts columns {missing_in_schema} which are NOT in schema!")
        
    missing_in_migration = schema_cols - cols
    # This is not necessarily an error if there are defaults, but good to know
    # print(f"INFO: Table '{table}' schema has columns {missing_in_migration} not in migration inserts.")
    
for table in schema_tables:
    if table not in migration_inserts:
        print(f"INFO: Table '{table}' is in schema but has NO migrations.")
