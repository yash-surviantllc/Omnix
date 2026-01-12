#!/usr/bin/env python3
import os
import re

def check_table_definitions():
    """Check that consolidated files include all required columns from original migrations"""

    print("=== TABLE DEFINITION VALIDATION ===\n")

    # Required columns for key tables based on original migrations
    required_columns = {
        'users': ['id', 'email', 'username', 'password_hash', 'full_name', 'first_name', 'last_name',
                 'phone', 'phone_number', 'is_active', 'is_verified', 'email_verified',
                 'last_login', 'created_at', 'updated_at', 'created_by', 'updated_by'],
        'products': ['id', 'code', 'name', 'description', 'category', 'unit', 'is_active',
                    'created_at', 'updated_at', 'created_by', 'updated_by'],
        'purchase_orders': ['id', 'order_number', 'product_id', 'quantity', 'unit', 'status',
                             'priority', 'due_date', 'start_date', 'end_date', 'customer_name',
                             'assigned_team', 'is_archived', 'archived_at', 'archived_by',
                             'quantity_completed', 'quantity_in_fg', 'quantity_dispatched',
                             'quantity_reworked', 'quantity_scrapped', 'progress_percentage',
                             'created_at', 'updated_at', 'created_by', 'updated_by'],
        'work_orders': ['id', 'work_order_number', 'purchase_order_id', 'product_id',
                       'target_qty', 'unit', 'priority', 'status', 'scheduled_start', 'scheduled_end',
                       'actual_start', 'actual_end', 'operation', 'assigned_team', 'shift',
                       'completed_qty', 'rejected_qty', 'quantity_completed', 'quantity_reworked',
                       'quantity_scrapped', 'created_at', 'updated_at', 'created_by', 'updated_by'],
        'inventory': ['id', 'product_id', 'location_id', 'lot_number', 'available_qty',
                     'allocated_qty', 'free_qty', 'last_transaction_at', 'created_at', 'updated_at'],
        'finished_goods': ['id', 'product_id', 'purchase_order_id', 'work_order_id', 'batch_number',
                          'quantity', 'available_quantity', 'allocated_quantity', 'dispatched_quantity',
                          'unit', 'production_date', 'expiry_date', 'location_id', 'quality_status',
                          'status', 'created_at', 'updated_at', 'created_by', 'updated_by']
    }

    consolidated_files = [
        '001_initial_schema.sql',
        '002_inventory_and_products.sql',
        '003_production_and_work_orders.sql',
        '005_gate_entries_and_finished_goods.sql',
        '006_working_orders_consolidated.sql'
    ]

    for table, columns in required_columns.items():
        print(f"\n{table.upper()} TABLE:")
        found_columns = []

        for file in consolidated_files:
            filepath = os.path.join('migrations_consolidated', file)
            if os.path.exists(filepath):
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # Find table definition
                    table_pattern = rf'CREATE TABLE.*?{table}\s*\((.*?)\);'
                    match = re.search(table_pattern, content, re.DOTALL | re.IGNORECASE)

                    if match:
                        table_def = match.group(1)
                        for col in columns:
                            if re.search(rf'\b{col}\b', table_def, re.IGNORECASE):
                                if col not in found_columns:
                                    found_columns.append(col)

                except Exception as e:
                    print(f"Error reading {file}: {e}")

        print(f"Found {len(found_columns)}/{len(columns)} required columns")
        missing_columns = [col for col in columns if col not in found_columns]
        if missing_columns:
            print(f"Missing columns: {missing_columns}")
        else:
            print("✓ All required columns present")

def check_foreign_keys():
    """Check that foreign key constraints are properly defined"""

    print("\n=== FOREIGN KEY VALIDATION ===\n")

    consolidated_files = [
        '001_initial_schema.sql',
        '002_inventory_and_products.sql',
        '003_production_and_work_orders.sql',
        '005_gate_entries_and_finished_goods.sql',
        '006_working_orders_consolidated.sql'
    ]

    fk_patterns = [
        (r'REFERENCES users\(id\)', 'users(id)'),
        (r'REFERENCES products\(id\)', 'products(id)'),
        (r'REFERENCES purchase_orders\(id\)', 'purchase_orders(id)'),
        (r'REFERENCES work_orders\(id\)', 'work_orders(id)'),
        (r'REFERENCES locations\(id\)', 'locations(id)'),
        (r'REFERENCES customers\(id\)', 'customers(id)')
    ]

    total_fk_found = 0

    for file in consolidated_files:
        filepath = os.path.join('migrations_consolidated', file)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                file_fk_count = 0
                for pattern, description in fk_patterns:
                    matches = re.findall(pattern, content, re.IGNORECASE)
                    if matches:
                        file_fk_count += len(matches)

                if file_fk_count > 0:
                    print(f"{file}: {file_fk_count} foreign key references")
                    total_fk_found += file_fk_count

            except Exception as e:
                print(f"Error reading {file}: {e}")

    print(f"\nTotal foreign key references found: {total_fk_found}")

def check_indexes():
    """Check that indexes are properly defined"""

    print("\n=== INDEX VALIDATION ===\n")

    consolidated_files = [
        '001_initial_schema.sql',
        '002_inventory_and_products.sql',
        '003_production_and_work_orders.sql',
        '005_gate_entries_and_finished_goods.sql',
        '006_working_orders_consolidated.sql'
    ]

    total_indexes = 0

    for file in consolidated_files:
        filepath = os.path.join('migrations_consolidated', file)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Count CREATE INDEX statements
                index_matches = re.findall(r'CREATE.*?INDEX.*?;', content, re.DOTALL | re.IGNORECASE)
                indexes_in_file = len(index_matches)

                if indexes_in_file > 0:
                    print(f"{file}: {indexes_in_file} indexes")
                    total_indexes += indexes_in_file

            except Exception as e:
                print(f"Error reading {file}: {e}")

    print(f"\nTotal indexes found: {total_indexes}")

if __name__ == "__main__":
    check_table_definitions()
    check_foreign_keys()
    check_indexes()
    print("\n✓ COMPREHENSIVE VALIDATION COMPLETED")
