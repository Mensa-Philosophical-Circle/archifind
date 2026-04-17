#!/usr/bin/env node
import { program } from 'commander';
import open from 'open';
import { startServer } from './server.js';

program
  .name('archfind')
  .description('A cross-platform CLI tool that scans your project and visualizes architecture visually')
  .version('1.0.0');

program
  .argument('[dir]', 'Directory to scan', '.')
  .option('-p, --port <number>', 'Port to run the UI server on', '4000')
  .option('--no-open', 'Do not open the browser automatically')
  .action((dir, options) => {
    startServer(dir, parseInt(options.port, 10))
      .then(async ({ url }) => {
        if (options.open) {
          await open(url);
        }
      })
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
  });

program.parse();
