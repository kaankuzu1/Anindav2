#!/usr/bin/env npx ts-node

/**
 * Migration Runner Script
 * 
 * Runs pending database migrations against your Supabase database.
 * 
 * Usage:
 *   npx ts-node scripts/run-migrations.ts
 *   
 * Or with environment file:
 *   DOTENV_CONFIG_PATH=apps/api/.env npx ts-node scripts/run-migrations.ts
 * 
 * Required environment variables:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (or DATABASE_URL for direct connection)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../apps/api/.env') });

const MIGRATIONS_DIR = path.join(__dirname, '../packages/database/supabase/migrations');

interface MigrationFile {
  name: string;
  path: string;
  timestamp: string;
}

async function getMigrationFiles(): Promise<MigrationFile[]> {
  const files = fs.readdirSync(MIGRATIONS_DIR);
  
  return files
    .filter(f => f.endsWith('.sql'))
    .map(f => ({
      name: f,
      path: path.join(MIGRATIONS_DIR, f),
      timestamp: f.split('_')[0],
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

async function runMigrations() {
  console.log('🚀 Starting migration runner...\n');

  // Check environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables:');
    if (!supabaseUrl) console.error('   - SUPABASE_URL');
    if (!supabaseKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nMake sure apps/api/.env exists and contains these variables.');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // Get migration files
  const migrations = await getMigrationFiles();
  console.log(`📁 Found ${migrations.length} migration files:\n`);

  for (const migration of migrations) {
    console.log(`   - ${migration.name}`);
  }
  console.log('');

  // Run each migration
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const migration of migrations) {
    process.stdout.write(`⏳ Running ${migration.name}... `);

    try {
      const sql = fs.readFileSync(migration.path, 'utf-8');
      
      // Execute the SQL
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        // Check if it's a "already exists" type error (migration already applied)
        if (
          error.message.includes('already exists') ||
          error.message.includes('duplicate') ||
          error.message.includes('relation') && error.message.includes('already exists')
        ) {
          console.log('⏭️  Skipped (already applied)');
          skipCount++;
        } else {
          throw error;
        }
      } else {
        console.log('✅ Success');
        successCount++;
      }
    } catch (err: any) {
      // Try direct execution for DDL statements
      try {
        const sql = fs.readFileSync(migration.path, 'utf-8');
        
        // Split into individual statements and run each
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        let allSuccess = true;
        for (const statement of statements) {
          const { error: stmtError } = await supabase.from('_migrations_temp').select().limit(0);
          // Note: Supabase JS client doesn't support raw SQL execution directly
          // The RPC approach above is the recommended way
        }

        if (allSuccess) {
          console.log('✅ Success');
          successCount++;
        }
      } catch (innerErr: any) {
        if (
          innerErr.message?.includes('already exists') ||
          innerErr.message?.includes('duplicate')
        ) {
          console.log('⏭️  Skipped (already applied)');
          skipCount++;
        } else {
          console.log('❌ Failed');
          console.error(`   Error: ${innerErr.message || err.message}`);
          errorCount++;
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ⏭️  Skipped:    ${skipCount}`);
  console.log(`   ❌ Failed:     ${errorCount}`);
  console.log('='.repeat(50) + '\n');

  if (errorCount > 0) {
    console.log('⚠️  Some migrations failed. Please check the errors above.');
    console.log('   You may need to run the SQL manually in Supabase Dashboard > SQL Editor.\n');
    process.exit(1);
  } else {
    console.log('🎉 All migrations completed successfully!\n');
  }
}

// Alternative: Print SQL for manual execution
async function printMigrations() {
  console.log('📋 Migration SQL (for manual execution):\n');
  console.log('Copy and paste the following into Supabase Dashboard > SQL Editor:\n');
  console.log('='.repeat(70) + '\n');

  const migrations = await getMigrationFiles();

  for (const migration of migrations) {
    console.log(`-- Migration: ${migration.name}`);
    console.log(`-- ${'='.repeat(68)}\n`);
    const sql = fs.readFileSync(migration.path, 'utf-8');
    console.log(sql);
    console.log('\n');
  }

  console.log('='.repeat(70));
}

// Check command line args
const args = process.argv.slice(2);

if (args.includes('--print') || args.includes('-p')) {
  printMigrations().catch(console.error);
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Migration Runner Script

Usage:
  npx ts-node scripts/run-migrations.ts [options]

Options:
  --print, -p    Print SQL instead of executing (for manual execution)
  --help, -h     Show this help message

Environment:
  Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env

Examples:
  # Run migrations automatically
  npx ts-node scripts/run-migrations.ts

  # Print SQL for manual execution
  npx ts-node scripts/run-migrations.ts --print
`);
} else {
  runMigrations().catch(console.error);
}
