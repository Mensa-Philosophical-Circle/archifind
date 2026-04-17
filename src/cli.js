#!/usr/bin/env node
import { program } from 'commander';
import { startServer } from './server.js';

program
  .name('archfind')
  .description('A cross-platform CLI tool that scans your project and visualizes architecture visually')
  .version('1.0.0');

program
  .argument('[dir]', 'Directory to scan', '.')
  .option('-p, --port <number>', 'Port to run the UI server on', '4000')
  .action((dir, options) => {
    startServer(dir, parseInt(options.port, 10));
  });

program.parse();
