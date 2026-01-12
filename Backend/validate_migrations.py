#!/usr/bin/env python3
import os
import re

def validate_migrations():
    """Validate consolidated migration files for basic syntax and completeness"""

    consolidated_dir = r"migrations_consolidated"
    consolidated_files = [
        '001_initial_schema.sql',
        '002_inventory_and_products.sql',
        '003_production_and_work_orders.sql',
        '004_alerts_and_monitoring.sql',
        '005_gate_entries_and_finished_goods.sql',
        '006_working_orders_consolidated.sql'
    ]

    print("=== MIGRATION VALIDATION REPORT ===\n")

    # Check file existence
    print("1. FILE EXISTENCE CHECK:")
    missing_files = []
    for file in consolidated_files:
        filepath = os.path.join(consolidated_dir, file)
        if os.path.exists(filepath):
            print(f"✓ {file} exists")
        else:
            print(f"✗ {file} missing")
            missing_files.append(file)

    if missing_files:
        print(f"\nMissing files: {missing_files}")
        return False

    print("\n2. BASIC SYNTAX CHECK:")
    total_tables = 0
    total_indexes = 0

    for file in consolidated_files:
        filepath = os.path.join(consolidated_dir, file)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Count CREATE TABLE statements
            create_table_matches = re.findall(r'CREATE TABLE.*?;', content, re.DOTALL | re.IGNORECASE)
            tables_in_file = len(create_table_matches)
            total_tables += tables_in_file

            # Count CREATE INDEX statements
            index_matches = re.findall(r'CREATE.*?INDEX.*?;', content, re.DOTALL | re.IGNORECASE)
            indexes_in_file = len(index_matches)
            total_indexes += indexes_in_file

            # Check for parentheses balance
            open_parens = content.count('(')
            close_parens = content.count(')')
            parens_balance = "OK" if open_parens == close_parens else f"MISMATCH ({open_parens}/{close_parens})"

            print(f"✓ {file}: {tables_in_file} tables, {indexes_in_file} indexes, parentheses {parens_balance}")

        except Exception as e:
            print(f"✗ Error reading {file}: {e}")

    print("\n3. SUMMARY:")
    print(f"Total CREATE TABLE statements: {total_tables}")
    print(f"Total CREATE INDEX statements: {total_indexes}")

    print("\n4. KEY TABLES CHECK:")
    key_tables = [
        'users', 'roles', 'products', 'locations', 'inventory',
        'purchase_orders', 'work_orders', 'finished_goods', 'customers'
    ]

    all_tables_found = []
    for file in consolidated_files:
        filepath = os.path.join(consolidated_dir, file)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            for table in key_tables:
                if re.search(rf'CREATE TABLE.*?\b{table}\b', content, re.IGNORECASE):
                    if table not in all_tables_found:
                        all_tables_found.append(table)
        except Exception as e:
            print(f"Error checking {file}: {e}")

    print(f"Key tables found: {sorted(all_tables_found)}")
    missing_key_tables = [t for t in key_tables if t not in all_tables_found]
    if missing_key_tables:
        print(f"Missing key tables: {missing_key_tables}")
        return False

    print("\n✓ VALIDATION COMPLETED SUCCESSFULLY")
    return True

if __name__ == "__main__":
    validate_migrations()
