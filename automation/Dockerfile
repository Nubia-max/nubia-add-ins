# Automation Service Dockerfile
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies for GUI automation and Excel manipulation
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libc6-dev \
    libffi-dev \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim AS production

WORKDIR /app

# Install runtime dependencies for GUI automation
RUN apt-get update && apt-get install -y \
    python3-tk \
    python3-dev \
    xvfb \
    x11vnc \
    fluxbox \
    wget \
    curl \
    scrot \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs output

# Create non-root user
RUN useradd -m -u 1001 nubia && \
    chown -R nubia:nubia /app

# Switch to non-root user
USER nubia

# Set environment variables
ENV PYTHONPATH=/app
ENV DISPLAY=:99

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start virtual display and application
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x24 -ac +extension GLX +render -noreset & uvicorn main:app --host 0.0.0.0 --port 8000"]