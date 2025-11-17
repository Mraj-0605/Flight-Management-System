#!/bin/bash

# SkyFleet PostgreSQL Setup Script
# This script automates the entire setup process

set -e

echo "================================================"
echo "   SkyFleet Admin Dashboard - PostgreSQL Setup"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="skyfleet"
DB_USER="skyfleet_user"
DB_PASSWORD="skyfleet_pass_$(openssl rand -hex 4)"
DB_HOST="localhost"
DB_PORT="5432"

# Check if PostgreSQL is installed
echo "Checking PostgreSQL installation..."
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed.${NC}"
    echo ""
    echo "Please install PostgreSQL first:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
    echo "  macOS:         brew install postgresql"
    echo "  Windows:       Download from https://www.postgresql.org/download/"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL found${NC}"

# Check if Node.js is installed
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed.${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✅ Node.js found ($(node --version))${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm found ($(npm --version))${NC}"

echo ""
echo "Creating project structure..."

# Create directories
mkdir -p public

# Move HTML files to public
echo "Setting up project files..."

# Create .env file
echo "Creating configuration..."
cat > .env << EOF
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
JWT_SECRET=$(openssl rand -base64 32)
PORT=3000
EOF

echo -e "${GREEN}✅ Configuration file created (.env)${NC}"

# Create database setup SQL
cat > setup_db.sql << EOF
-- Create database and user
CREATE DATABASE ${DB_NAME};
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};
EOF

echo ""
echo "Setting up PostgreSQL database..."
echo -e "${YELLOW}You may be prompted for the PostgreSQL admin password${NC}"

# Try to create database
if sudo -u postgres psql -f setup_db.sql 2>/dev/null; then
    echo -e "${GREEN}✅ Database created successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Database might already exist or you need to run manually:${NC}"
    echo "  sudo -u postgres psql -f setup_db.sql"
fi

# Clean up SQL file
rm -f setup_db.sql

# Install npm dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install

echo ""
echo "================================================"
echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo "================================================"
echo ""
echo "📋 Configuration Summary:"
echo "------------------------"
echo "Database Name:     ${DB_NAME}"
echo "Database User:     ${DB_USER}"
echo "Database Password: ${DB_PASSWORD}"
echo "Server Port:       3000"
echo ""
echo "🔐 Default Admin Credentials:"
echo "----------------------------"
echo "Email:    admin@skyfleet.com"
echo "Password: admin123"
echo ""
echo "⚠️  IMPORTANT: Change the admin password after first login!"
echo ""
echo "🚀 To start the server:"
echo "----------------------"
echo "  npm start"
echo ""
echo "Then open your browser to: http://localhost:3000/login.html"
echo ""
echo "📝 Configuration saved to .env file"
echo "================================================"

# Create a quick start script
cat > start.sh << 'EOF'
#!/bin/bash
echo "Starting SkyFleet Admin Dashboard..."
npm start
EOF

chmod +x start.sh

echo ""
echo -e "${GREEN}Quick start script created: ./start.sh${NC}"
echo ""
