import os

file_path = r'c:\Work\Inventory Management\Omnix\Frontend\src\components\features\orders\WIPBoard.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("--- CLOCK USAGES ---")
for i, line in enumerate(lines):
    if 'calculateElapsedTime' in line:
        print(f"Line {i+1}: {line.strip()}")
