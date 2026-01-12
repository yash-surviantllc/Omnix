#!/usr/bin/env python3
import os
import re
from collections import defaultdict

def validate_migration_logic():
    """Validate migration logic and dependencies"""

    print("=== MIGRATION LOGIC VALIDATION ===\n")

    consolidated_files = [
        '001_initial_schema.sql',
        '002_inventory_and_products.sql',
        '003_production_and_work_orders.sql',
        '004_alerts_and_monitoring.sql',
        '005_gate_entries_and_finished_goods.sql',
        '006_working_orders_consolidated.sql'
    ]

    # Track table dependencies
    table_dependencies = defaultdict(set)
    table_creations = defaultdict(list)

    # Track sequence dependencies
    sequence_usage = defaultdict(list)
    sequence_creations = defaultdict(list)

    # Track function dependencies
    function_usage = defaultdict(list)
    function_creations = defaultdict(list)

    print("1. ANALYZING DEPENDENCIES:")

    for file in consolidated_files:
        filepath = os.path.join('migrations_consolidated', file)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Find table references in foreign keys
                fk_references = re.findall(r'REFERENCES\s+(\w+)\s*\(', content, re.IGNORECASE)
                for ref_table in fk_references:
                    table_dependencies[file].add(ref_table.lower())

                # Find table creations
                create_table_matches = re.findall(r'CREATE\s+TABLE.*?(\w+)\s*\(', content, re.IGNORECASE | re.DOTALL)
                for table in create_table_matches:
                    table_creations[file].append(table.lower())

                # Find sequence usage
                seq_usage = re.findall(r'nextval\(\s*[\'"]([^\'"]+)[\'"]\s*\)', content, re.IGNORECASE)
                for seq in seq_usage:
                    sequence_usage[file].append(seq.lower())

                # Find sequence creations
                seq_creations = re.findall(r'CREATE\s+SEQUENCE.*?(\w+)', content, re.IGNORECASE)
                for seq in seq_creations:
                    sequence_creations[file].append(seq.lower())

                # Find function calls
                func_calls = re.findall(r'(\w+)\s*\(', content)
                func_calls = [f for f in func_calls if f not in ['CREATE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'EXECUTE', 'FUNCTION', 'TRIGGER', 'INDEX', 'TABLE', 'SEQUENCE', 'EXTENSION', 'COMMENT', 'GRANT', 'REVOKE', 'BEGIN', 'END', 'IF', 'THEN', 'ELSE', 'ELSIF', 'FOR', 'LOOP', 'WHILE', 'EXIT', 'CONTINUE', 'RETURN', 'RAISE', 'NOTICE', 'WARNING', 'EXCEPTION', 'WHEN', 'OTHERS', 'COALESCE', 'NULLIF', 'GREATEST', 'LEAST', 'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'EXTRACT', 'DATE_TRUNC', 'TO_CHAR', 'LPAD', 'RPAD', 'SUBSTRING', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'REPLACE', 'REGEXP_REPLACE', 'CONCAT', 'ARRAY', 'ROW', 'CAST', 'AS', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT', 'EXISTS', 'IN', 'NOT', 'AND', 'OR', 'IS', 'NULL', 'TRUE', 'FALSE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'BETWEEN', 'LIKE', 'ILIKE', 'SIMILAR', 'TO', 'COLLATE', 'ASC', 'DESC', 'PRIMARY', 'KEY', 'UNIQUE', 'CHECK', 'DEFAULT', 'REFERENCES', 'CASCADE', 'RESTRICT', 'SET', 'NO', 'ACTION', 'BEFORE', 'AFTER', 'INSTEAD', 'OF', 'EACH', 'ROW', 'STATEMENT', 'LANGUAGE', 'plpgsql', 'sql', 'VOLATILE', 'STABLE', 'IMMUTABLE', 'RETURNS', 'VOID', 'BOOLEAN', 'INTEGER', 'BIGINT', 'SMALLINT', 'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE', 'PRECISION', 'VARCHAR', 'TEXT', 'CHAR', 'BYTEA', 'JSON', 'JSONB', 'UUID', 'TIMESTAMP', 'TIMESTAMPTZ', 'DATE', 'TIME', 'TIMETZ', 'INTERVAL', 'INET', 'CIDR', 'MACADDR', 'POINT', 'LINE', 'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE', 'TSVECTOR', 'TSQUERY', 'INT4RANGE', 'INT8RANGE', 'NUMRANGE', 'TSRANGE', 'TSTZRANGE', 'DATERANGE', 'ARRAY', 'SERIAL', 'BIGSERIAL', 'MONEY', 'BIT', 'VARBIT']]
                for func in func_calls:
                    if len(func) > 2:  # Filter out short keywords
                        function_usage[file].append(func.lower())

                # Find function creations
                func_creations = re.findall(r'CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(\w+)', content, re.IGNORECASE)
                for func in func_creations:
                    function_creations[file].append(func.lower())

            except Exception as e:
                print(f"Error reading {file}: {e}")

    # Check for dependency issues
    print("\n2. DEPENDENCY ANALYSIS:")

    # Check table dependencies
    issues_found = False
    for file, deps in table_dependencies.items():
        file_num = file.split('_')[0]
        for dep_table in deps:
            # Check if dependency table is created in same or earlier file
            dep_created = False
            for other_file, created_tables in table_creations.items():
                other_num = other_file.split('_')[0]
                if other_num <= file_num and dep_table in created_tables:
                    dep_created = True
                    break
            if not dep_created:
                print(f"⚠️  {file}: references table '{dep_table}' which may not exist yet")
                issues_found = True

    # Check sequence dependencies
    for file, seqs in sequence_usage.items():
        for seq in seqs:
            seq_created = False
            for other_file, created_seqs in sequence_creations.items():
                if seq in created_seqs:
                    seq_created = True
                    break
            if not seq_created:
                print(f"⚠️  {file}: uses sequence '{seq}' which may not exist")
                issues_found = True

    if not issues_found:
        print("✓ No dependency issues found")

    print("\n3. MIGRATION ORDER VALIDATION:")
    expected_order = ['001', '002', '003', '004', '005', '006']
    actual_files = sorted([f for f in consolidated_files if os.path.exists(os.path.join('migrations_consolidated', f))])
    actual_order = [f.split('_')[0] for f in actual_files]

    if actual_order == expected_order:
        print("✓ Migration files are in correct order")
    else:
        print(f"⚠️  Migration order issue. Expected: {expected_order}, Found: {actual_order}")

    print("\n4. IDEMPOTENCY CHECK:")
    # Check for CREATE TABLE IF NOT EXISTS
    idempotent_tables = 0
    total_tables = 0

    for file in consolidated_files:
        filepath = os.path.join('migrations_consolidated', file)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                create_table_statements = re.findall(r'CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(\w+)', content, re.IGNORECASE | re.DOTALL)
                for conditional, table in create_table_statements:
                    total_tables += 1
                    if conditional.strip():
                        idempotent_tables += 1

            except Exception as e:
                print(f"Error checking {file}: {e}")

    print(f"Tables with IF NOT EXISTS: {idempotent_tables}/{total_tables}")

    if idempotent_tables == total_tables:
        print("✓ All CREATE TABLE statements are idempotent")
    else:
        print("⚠️  Some CREATE TABLE statements may not be idempotent")

    print("\n5. ERROR HANDLING CHECK:")
    # Check for DO $$ blocks with exception handling
    error_handling_blocks = 0

    for file in consolidated_files:
        filepath = os.path.join('migrations_consolidated', file)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Look for EXCEPTION blocks in DO statements
                if re.search(r'DO\s+\$\$.*?EXCEPTION.*?END\s*\$\$', content, re.DOTALL | re.IGNORECASE):
                    error_handling_blocks += 1

            except Exception as e:
                print(f"Error checking {file}: {e}")

    print(f"Files with error handling: {error_handling_blocks}/{len(consolidated_files)}")

    print("\n✓ MIGRATION LOGIC VALIDATION COMPLETED")

if __name__ == "__main__":
    validate_migration_logic()
