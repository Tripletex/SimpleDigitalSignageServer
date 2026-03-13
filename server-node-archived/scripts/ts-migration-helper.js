#!/usr/bin/env node

/**
 * Helper script to handle TypeScript migrations properly
 * Usage:
 *   node ts-migration-helper.js create <migration-name>  - Create a new TS migration
 *   node ts-migration-helper.js convert-all              - Convert all JS migrations to TS
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

// Template for TypeScript migration file
const TS_TEMPLATE = `import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  // Your migration code here
}

export function down(pgm: MigrationBuilder): void {
  // Code to revert the migration
}
`;

function createMigration(name) {
  if (!name) {
    console.error('Error: Please provide a migration name');
    process.exit(1);
  }

  // Run node-pg-migrate create command
  console.log(`Creating migration: ${name}`);
  try {
    const result = execSync(`cd ${path.dirname(MIGRATIONS_DIR)} && npx node-pg-migrate create ${name}`, { encoding: 'utf-8' });
    
    // Extract the generated file path
    const match = result.match(/Created migration -- (.+?\.js)/);
    if (!match || !match[1]) {
      console.error('Could not determine created migration file path');
      return;
    }
    
    const jsFilePath = match[1];
    const tsFilePath = jsFilePath.replace(/\.js$/, '.ts');
    
    // Convert the file to TypeScript by renaming and writing the template
    fs.writeFileSync(tsFilePath, TS_TEMPLATE);
    fs.unlinkSync(jsFilePath);
    
    console.log(`Created TypeScript migration: ${tsFilePath}`);
  } catch (error) {
    console.error('Error creating migration:', error.message);
    process.exit(1);
  }
}

function convertJsToTs(jsFilePath) {
  const tsFilePath = jsFilePath.replace(/\.js$/, '.ts');
  const content = fs.readFileSync(jsFilePath, 'utf-8');

  // Simple conversion from CommonJS to ESM
  let tsContent = content
    .replace(/exports\.shorthands = undefined;/, 'export const shorthands: ColumnDefinitions | undefined = undefined;')
    .replace(/exports\.up = (\(\w+\)) => {/, 'export function up(pgm: MigrationBuilder): void {')
    .replace(/exports\.down = (\(\w+\)) => {/, 'export function down(pgm: MigrationBuilder): void {')
    .replace(/exports\.up = async (\(\w+\)) => {/, 'export async function up(pgm: MigrationBuilder): Promise<void> {');

  // Add the import at the top
  tsContent = `import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';\n\n${tsContent}`;

  fs.writeFileSync(tsFilePath, tsContent);
  console.log(`Converted ${jsFilePath} to ${tsFilePath}`);
  
  // Optionally remove the JS file
  fs.unlinkSync(jsFilePath);
}

function convertAllMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR);
  const jsFiles = files.filter(file => file.endsWith('.js'));

  if (jsFiles.length === 0) {
    console.log('No JavaScript migration files found to convert');
    return;
  }

  console.log(`Found ${jsFiles.length} JavaScript migration files to convert`);
  
  jsFiles.forEach(file => {
    convertJsToTs(path.join(MIGRATIONS_DIR, file));
  });

  console.log(`Converted ${jsFiles.length} migration files to TypeScript`);
}

// Main execution
const command = process.argv[2];
const migrationName = process.argv[3];

switch (command) {
  case 'create':
    createMigration(migrationName);
    break;
  case 'convert-all':
    convertAllMigrations();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.log('Usage:');
    console.log('  node ts-migration-helper.js create <migration-name>');
    console.log('  node ts-migration-helper.js convert-all');
    process.exit(1);
}