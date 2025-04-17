FROM node:20-slim

# Install Python and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Create and activate virtual environment
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"
ENV PYTHONPATH="/app/venv/lib/python3.9/site-packages"

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies in virtual environment
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create a simple health check script
RUN echo '#!/bin/bash\ncurl -f http://localhost:8080/_ah/health || exit 1' > /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh

# Expose port
EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /app/healthcheck.sh

# Start the application
CMD ["node", "server.js"] 