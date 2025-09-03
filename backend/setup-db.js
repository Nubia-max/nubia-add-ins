#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Nubia database...\n');

// Check if .env exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found. Please create one with DATABASE_URL and JWT_SECRET');
  console.log('Example:');
  console.log('DATABASE_URL="postgresql://username:password@localhost:5432/nubia"');
  console.log('JWT_SECRET="your-super-secret-jwt-key"');
  process.exit(1);
}

try {
  // Step 1: Generate Prisma client
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit', cwd: __dirname });
  
  // Step 2: Push database schema
  console.log('\n🗄️  Pushing database schema...');
  execSync('npx prisma db push', { stdio: 'inherit', cwd: __dirname });
  
  console.log('\n✅ Database setup completed successfully!');
  console.log('🚀 You can now start the backend server with: npm run dev');
  
} catch (error) {
  console.error('\n❌ Database setup failed:', error.message);
  console.log('\n💡 Make sure:');
  console.log('   - PostgreSQL is running');
  console.log('   - DATABASE_URL in .env is correct');
  console.log('   - Database exists and is accessible');
  process.exit(1);
}