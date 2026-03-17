FROM python:3.11-slim

# System deps for Playwright, Pillow, and other native packages
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    wget \
    gnupg \
    # Pillow deps
    libjpeg-dev \
    libpng-dev \
    libfreetype6-dev \
    # Playwright system deps
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (chromium only to keep image lean)
RUN playwright install chromium

# Copy all ai_agency source files
COPY . /app/

# Create leads_generated output directory
RUN mkdir -p /app/leads_generated

EXPOSE 8000

CMD ["python", "api_server.py"]
