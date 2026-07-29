import os
import re

directories = ['sql', 'src', 'app']
base_dir = r"d:\capstone_website\AutoKita-Smart-Automotive-Repair-Shop-Management-System"

# Do not touch these files because they are the schema definitions/migrations which already use actual_grand_total correctly
exclude_files = [
    r'sql\Other\Capstone_postgres_fixed.sql',
    r'sql\Other\Migrations_postgresSQL.sql'
]

count = 0
for d in directories:
    dir_path = os.path.join(base_dir, d)
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            file_path = os.path.join(root, file)
            
            # check exclude
            skip = False
            for ef in exclude_files:
                if file_path.endswith(ef):
                    skip = True
            if skip:
                continue
                
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except UnicodeDecodeError:
                continue # skip binary files
                
            # Regex to find grand_total not preceded by actual_ or estimated_
            # and replace it with actual_grand_total
            new_content = re.sub(r'(?<!actual_)(?<!estimated_)grand_total', 'actual_grand_total', content)
            
            if new_content != content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated: {file_path}")
                count += 1

print(f"Refactor complete. {count} files updated.")
