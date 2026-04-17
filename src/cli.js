#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { program } from 'commander';
import fs from 'fs';
import open from 'open';
import path from 'path';
import { fileURLToPath } from 'url';
import { startServer } from './server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.resolve(__dirname, '../ui');

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function ensureUiIsBuilt({ autoBuild, forceRebuild }) {
  const uiIndexPath = path.join(uiDir, 'dist', 'index.html');
  const uiNodeModulesPath = path.join(uiDir, 'node_modules');
  const distExists = fs.existsSync(uiIndexPath);

  if (!autoBuild) {
    return;
  }

  if (!forceRebuild && distExists) {
    return;
  }

  if (!fs.existsSync(uiNodeModulesPath)) {
    console.log('[archifind] Installing UI dependencies...');
    runCommand('npm', ['install', '--no-audit', '--no-fund'], uiDir);
  }

  console.log('[archifind] Building UI...');
  runCommand('npm', ['run', 'build'], uiDir);
}

program
  .name('archifind')
  .description('A cross-platform CLI tool that scans your project and visualizes architecture visually')
  .version('1.0.0');

program
  .argument('[dir]', 'Directory to scan', '.')
  .option('-p, --port <number>', 'Port to run the UI server on', '4000')
  .option('--no-build-ui', 'Skip automatic UI build before server startup')
  .option('--rebuild-ui', 'Force a UI rebuild before server startup')
  .option('--no-ai-assist', 'Disable Hugging Face role classification assist')
  .option('--no-ai-components', 'Disable Hugging Face component classification')
  .option('--hf-model <model>', 'Hugging Face model to use for zero-shot classification')
  .option('--hf-token <token>', 'Hugging Face access token (optional, can also come from env)')
  .option('--no-ai-native', 'Disable AI-native architecture generation')
  .option('--no-open', 'Do not open the browser automatically')
  .action(async (dir, options) => {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
          const [key, ...values] = line.split('=');
          if (key && values.length > 0 && !process.env[key.trim()]) {
            process.env[key.trim()] = values.join('=').trim().replace(/^["']|["']$/g, '');
          }
        });
      }

      process.env.archifind_AI_ASSIST = options.aiAssist ? 'true' : 'false';
      process.env.archifind_AI_COMPONENTS = options.aiComponents ? 'true' : 'false';

      if (options.hfModel) {
        process.env.HF_MODEL = options.hfModel;
      }

      if (options.hfToken) {
        process.env.HF_TOKEN = options.hfToken;
      }

      process.env.archifind_AI_NATIVE = options.aiNative ? 'true' : 'false';

      ensureUiIsBuilt({
        autoBuild: options.buildUi,
        forceRebuild: Boolean(options.rebuildUi),
      });

      const { url } = await startServer(dir, parseInt(options.port, 10));

      if (options.open) {
        await open(url);
      }
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });

program.parse();
