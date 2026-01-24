"""
Verification script for configurable WIP stages implementation
Tests database connectivity, data integrity, and service layer
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import get_db
from app.services.stage_service import stage_service

async def test_database_stages():
    """Test that stages exist in database"""
    print("=" * 60)
    print("TEST 1: Database Connectivity & Stage Data")
    print("=" * 60)
    
    try:
        db = get_db()
        result = db.table('wip_stages').select('*').order('sequence_number').execute()
        
        if result.data:
            print(f"✅ Found {len(result.data)} stages in database:")
            for stage in result.data:
                print(f"   - {stage['sequence_number']}. {stage['name']} ({stage['code']}) - Active: {stage['is_active']}")
            return True
        else:
            print("❌ No stages found in database")
            return False
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False

async def test_product_stages_table():
    """Test that product_stages table exists"""
    print("\n" + "=" * 60)
    print("TEST 2: Product Stages Table")
    print("=" * 60)
    
    try:
        db = get_db()
        result = db.table('product_stages').select('count').execute()
        print(f"✅ product_stages table exists")
        print(f"   Current assignments: {len(result.data) if result.data else 0}")
        return True
    except Exception as e:
        print(f"❌ product_stages table error: {e}")
        return False

async def test_stage_service():
    """Test stage service layer"""
    print("\n" + "=" * 60)
    print("TEST 3: Stage Service Layer")
    print("=" * 60)
    
    try:
        # Test list_stages
        stages = await stage_service.list_stages(active_only=True)
        print(f"✅ stage_service.list_stages() works")
        print(f"   Returned {len(stages)} active stages")
        
        if stages:
            first_stage = stages[0]
            print(f"   First stage: {first_stage.name} (ID: {first_stage.id})")
            
            # Test get_stage_by_id
            stage_detail = await stage_service.get_stage_by_id(first_stage.id)
            print(f"✅ stage_service.get_stage_by_id() works")
            print(f"   Retrieved: {stage_detail.name}")
            
            # Test get_stage_usage
            usage = await stage_service.get_stage_usage(first_stage.id)
            print(f"✅ stage_service.get_stage_usage() works")
            print(f"   Products using stage: {usage.products_using_stage}")
            print(f"   Active work orders: {usage.active_work_orders}")
            print(f"   Is in use: {usage.is_in_use}")
        
        return True
    except Exception as e:
        print(f"❌ Stage service error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_helper_functions():
    """Test database helper functions"""
    print("\n" + "=" * 60)
    print("TEST 4: Database Helper Functions")
    print("=" * 60)
    
    try:
        db = get_db()
        
        # Test get_product_stages function with a dummy UUID
        # This should return default stages since no product has custom stages yet
        dummy_product_id = '00000000-0000-0000-0000-000000000000'
        result = db.rpc('get_product_stages', {'p_product_id': dummy_product_id}).execute()
        
        print(f"✅ get_product_stages() RPC function works")
        print(f"   Returned {len(result.data)} default stages for non-existent product")
        
        return True
    except Exception as e:
        print(f"❌ Helper function error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all tests"""
    print("\n" + "🧪 CONFIGURABLE WIP STAGES VERIFICATION" + "\n")
    
    results = []
    
    # Run tests
    results.append(await test_database_stages())
    results.append(await test_product_stages_table())
    results.append(await test_stage_service())
    results.append(await test_helper_functions())
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("✅ All tests passed! Implementation is working correctly.")
    else:
        print(f"❌ {total - passed} test(s) failed. Please review errors above.")
    
    return passed == total

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
