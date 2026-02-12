#!/bin/bash

# Migration Runner Script
# 
# This script helps you run the database migrations.
# 
# Usage:
#   ./scripts/run-migrations.sh          # Print SQL for manual execution
#   ./scripts/run-migrations.sh --apply  # Apply using psql (requires DATABASE_URL)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/packages/database/supabase/migrations"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Aninda Database Migration Runner${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# List migrations
echo -e "${YELLOW}Found migrations:${NC}"
for f in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$f" ]; then
    echo "  - $(basename "$f")"
  fi
done
echo ""

if [ "$1" == "--apply" ]; then
  # Apply migrations using psql
  if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo ""
    echo "Set it with your Supabase connection string:"
    echo "  export DATABASE_URL='postgresql://postgres:[password]@[host]:5432/postgres'"
    echo ""
    echo "Or run without --apply to print SQL for manual execution."
    exit 1
  fi

  echo -e "${YELLOW}Applying migrations...${NC}"
  echo ""

  for f in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$f" ]; then
      filename=$(basename "$f")
      echo -n "  Applying $filename... "
      
      if psql "$DATABASE_URL" -f "$f" > /dev/null 2>&1; then
        echo -e "${GREEN}Done${NC}"
      else
        # Try again and capture error
        error_output=$(psql "$DATABASE_URL" -f "$f" 2>&1) || true
        
        if echo "$error_output" | grep -q "already exists"; then
          echo -e "${YELLOW}Skipped (already applied)${NC}"
        else
          echo -e "${RED}Failed${NC}"
          echo "    Error: $error_output"
        fi
      fi
    fi
  done

  echo ""
  echo -e "${GREEN}Migration process complete!${NC}"

else
  # Print SQL for manual execution
  echo -e "${YELLOW}SQL for manual execution:${NC}"
  echo ""
  echo "Copy the following SQL and run it in Supabase Dashboard > SQL Editor:"
  echo ""
  echo -e "${BLUE}========== START SQL ==========${NC}"
  echo ""

  for f in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$f" ]; then
      echo "-- =================================================="
      echo "-- Migration: $(basename "$f")"
      echo "-- =================================================="
      echo ""
      cat "$f"
      echo ""
      echo ""
    fi
  done

  echo -e "${BLUE}=========== END SQL ===========${NC}"
  echo ""
  echo -e "${YELLOW}To apply automatically, run:${NC}"
  echo "  export DATABASE_URL='your-supabase-connection-string'"
  echo "  ./scripts/run-migrations.sh --apply"
  echo ""
  echo -e "${YELLOW}Or copy the SQL above and paste into:${NC}"
  echo "  Supabase Dashboard > SQL Editor > New Query"
fi
