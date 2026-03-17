import os

file_path = r'c:\Work\Inventory Management\Omnix\Frontend\src\components\features\orders\WIPBoard.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all remaining occurrences
old_str = 'calculateElapsedTime(res.actual_start)'
new_str = 'calculateElapsedTime(res.actual_start, res.actual_end)'

if old_str in content:
    content = content.replace(old_str, new_str)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replacement successful!")
else:
    print("String not found in file!")
