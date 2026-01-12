import pytest

# Enable asyncio support for all tests
pytest_plugins = ('pytest_asyncio',)

# Configure asyncio to use the same event loop for all tests
@pytest.fixture(scope="session")
def event_loop():
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
