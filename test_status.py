from decimal import Decimal

def _compute_status(quantity: Decimal, reorder_level: Decimal, min_stock_level: Decimal = Decimal('0')) -> str:
    if quantity <= Decimal('0'):
        return 'Out of Stock'
    if min_stock_level > Decimal('0'):
        if quantity <= min_stock_level:
            return 'Critical'
    elif reorder_level > Decimal('0') and quantity <= reorder_level * Decimal('0.25'):
        return 'Critical'
    if reorder_level > Decimal('0') and quantity <= reorder_level:
        return 'Low Stock'
    return 'Sufficient'

# Test cases
tests = [
    # quantity, reorder_level, min_stock_level
    (Decimal('0'), Decimal('100'), Decimal('60'), 'Out of Stock'),
    (Decimal('50'), Decimal('100'), Decimal('60'), 'Critical'),
    (Decimal('80'), Decimal('100'), Decimal('60'), 'Low Stock'),
    (Decimal('150'), Decimal('100'), Decimal('60'), 'Sufficient'),
    # No min_stock_level (fallback to 25% of reorder)
    (Decimal('20'), Decimal('100'), Decimal('0'), 'Critical'),
    (Decimal('50'), Decimal('100'), Decimal('0'), 'Low Stock'),
    (Decimal('150'), Decimal('100'), Decimal('0'), 'Sufficient'),
]

print("Running _compute_status tests...")
for i, (q, r, m, expected) in enumerate(tests):
    result = _compute_status(q, r, m)
    status = "PASS" if result == expected else f"FAIL (got {result}, expected {expected})"
    print(f"Test {i+1}: q={q}, r={r}, m={m} -> {status}")
