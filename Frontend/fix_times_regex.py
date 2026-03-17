import os
import re

file_path = r'c:\Work\Inventory Management\Omnix\Frontend\src\components\features\orders\WIPBoard.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Space-insensitive regex
pattern = r'calculateElapsedTime\s*\(\s*(res\.actual_start)\s*\)'
replacement = r'calculateElapsedTime(\1, res.actual_end)'

new_content, count = re.subn(pattern, replacement, content)

if count > 0:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Replacement successful! Replaced {count} occurrences.")
else:
    print("Pattern not found in file!")
