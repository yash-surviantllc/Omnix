FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /Backend

# Install system dependencies
# - build-essential for building wheels
# - libpq-dev for PostgreSQL support
# - libmagic-dev for python-magic library
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libmagic-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Railway overrides this with $PORT)
EXPOSE 80

# The CMD is overrides by Railway Start Command if specified,
# but providing one guarantees a valid fallback.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80", "--proxy-headers", "--forwarded-allow-ips=*"]
