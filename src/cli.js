#!/usr/bin/env node
import "dotenv/config";
import { spawnSync } from "child_process";
import { program } from "commander";
import fs from "fs";
import open from "open";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import { startServer } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.resolve(__dirname, "../ui");

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status}`,
    );
  }
}

async function askPermission(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function detectShellName() {
  const shellPath = (
    process.env.SHELL ||
    process.env.ComSpec ||
    ""
  ).toLowerCase();

  if (shellPath.includes("zsh")) return "zsh";
  if (shellPath.includes("fish")) return "fish";
  if (shellPath.includes("bash")) return "bash";
  if (
    shellPath.includes("pwsh") ||
    shellPath.includes("powershell") ||
    process.platform === "win32"
  )
    return "powershell";

  return process.platform === "darwin" ? "zsh" : "bash";
}

function getShellProfilePath(shellName) {
  const homeDir = os.homedir();

  switch (shellName) {
    case "zsh":
      return path.join(homeDir, ".zshrc");
    case "bash":
      return path.join(homeDir, ".bashrc");
    case "fish":
      return path.join(homeDir, ".config", "fish", "config.fish");
    case "powershell":
      return path.join(
        homeDir,
        "Documents",
        "PowerShell",
        "Microsoft.PowerShell_profile.ps1",
      );
    default:
      return path.join(homeDir, ".zshrc");
  }
}

function buildShellSnippet(checkoutDir, shellName) {
  const cliPath = path.join(checkoutDir, "src", "cli.js");
  const escapedCheckoutDir = checkoutDir.replace(/\\/g, "\\\\");
  const escapedCliPath = cliPath.replace(/\\/g, "\\\\");

  if (shellName === "powershell") {
    return [
      `$env:ARCHIFIND_HOME = "${escapedCheckoutDir}"`,
      `function archifind { node "${escapedCliPath}" $args }`,
    ].join("\n");
  }

  if (shellName === "fish") {
    return [
      `set -gx ARCHIFIND_HOME \"${checkoutDir}\"`,
      "function archifind",
      '  node "$ARCHIFIND_HOME/src/cli.js" $argv',
      "end",
    ].join("\n");
  }

  return [
    `export ARCHIFIND_HOME=\"${checkoutDir}\"`,
    "archifind() {",
    '  node "$ARCHIFIND_HOME/src/cli.js" "$@"',
    "}",
  ].join("\n");
}

function buildInstallInstructions() {
  if (process.platform === "darwin") {
    return [
      "1. Install Node.js with Homebrew:",
      "   brew install node",
      "2. From the archifind checkout, install dependencies and link the CLI:",
      "   npm install",
      "   npm link",
    ];
  }

  if (process.platform === "win32") {
    return [
      "1. Install Node.js with winget:",
      "   winget install OpenJS.NodeJS.LTS",
      "2. From the archifind checkout, install dependencies and link the CLI:",
      "   npm install",
      "   npm link",
    ];
  }

  return [
    "1. Install Node.js with your package manager.",
    "2. From the archifind checkout, install dependencies and link the CLI:",
    "   npm install",
    "   npm link",
  ];
}

function writeProfileSnippet(profilePath, snippet) {
  const markerStart = "# archifind setup start";
  const markerEnd = "# archifind setup end";
  const block = [markerStart, snippet, markerEnd].join("\n");

  fs.mkdirSync(path.dirname(profilePath), { recursive: true });

  if (!fs.existsSync(profilePath)) {
    fs.writeFileSync(profilePath, `${block}\n`, "utf-8");
    return { created: true, updated: false };
  }

  const current = fs.readFileSync(profilePath, "utf-8");
  const existingBlockPattern = new RegExp(
    `${markerStart}[\\s\\S]*?${markerEnd}`,
    "m",
  );

  if (existingBlockPattern.test(current)) {
    fs.writeFileSync(
      profilePath,
      current.replace(existingBlockPattern, block),
      "utf-8",
    );
    return { created: false, updated: true };
  }

  const nextContent = current.endsWith("\n")
    ? `${current}${block}\n`
    : `${current}\n${block}\n`;
  fs.writeFileSync(profilePath, nextContent, "utf-8");
  return { created: false, updated: true };
}

function ensureUiIsBuilt({ autoBuild, forceRebuild }) {
  const uiIndexPath = path.join(uiDir, "dist", "index.html");
  const uiNodeModulesPath = path.join(uiDir, "node_modules");
  const distExists = fs.existsSync(uiIndexPath);

  if (!autoBuild) {
    return;
  }

  if (!forceRebuild && distExists) {
    return;
  }

  if (!fs.existsSync(uiNodeModulesPath)) {
    console.log("[archifind] Installing UI dependencies...");
    runCommand("npm", ["install", "--no-audit", "--no-fund"], uiDir);
  }

  console.log("[archifind] Building UI...");
  runCommand("npm", ["run", "build"], uiDir);
}

program
  .name("archifind")
  .description(
    "A cross-platform CLI tool that scans your project and visualizes architecture visually",
  )
  .version("1.0.0");

program
  .command("setup")
  .description(
    "Print or write OS-specific install and shell setup instructions",
  )
  .option(
    "--home <path>",
    "Path to the local archifind checkout",
    process.cwd(),
  )
  .option(
    "--shell <name>",
    "Shell to configure: zsh, bash, fish, or powershell",
  )
  .option("--write", "Write the shell snippet to the detected profile file")
  .action(async (options) => {
    try {
      const checkoutDir = path.resolve(options.home);
      const shellName = String(
        options.shell || detectShellName(),
      ).toLowerCase();
      const profilePath = getShellProfilePath(shellName);
      const installSteps = buildInstallInstructions();
      const snippet = buildShellSnippet(checkoutDir, shellName);

      console.log("[archifind] Install steps");
      installSteps.forEach((step) => console.log(step));
      console.log("");
      console.log("[archifind] Shell snippet");
      console.log(snippet);

      if (options.write) {
        const result = writeProfileSnippet(profilePath, snippet);
        console.log("");
        console.log(`[archifind] Wrote setup snippet to ${profilePath}`);
        if (result.created) {
          console.log("[archifind] Created a new shell profile file.");
        }
        console.log("[archifind] Reload your shell after this change.");
      }
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });

program
  .argument("[dir]", "Directory to scan", ".")
  .option("-p, --port <number>", "Port to run the UI server on", "4000")
  .option("--no-build-ui", "Skip automatic UI build before server startup")
  .option("--rebuild-ui", "Force a UI rebuild before server startup")
  .option("--no-ai-assist", "Disable Hugging Face role classification assist")
  .option("--no-ai-components", "Disable Hugging Face component classification")
  .option(
    "--hf-model <model>",
    "Hugging Face model to use for zero-shot classification",
  )
  .option(
    "--hf-token <token>",
    "Hugging Face access token (optional, can also come from env)",
  )
  .option("--no-ai-native", "Disable AI-native architecture generation")
  .option(
    "--allow-env",
    "Include .env files in the architecture analysis (may contain sensitive data)",
  )
  .option("--no-open", "Do not open the browser automatically")
  .action(async (dir, options) => {
    try {
      let includeEnv = options.allowEnv || false;
      const targetDir = path.resolve(dir || ".");

      if (
        !includeEnv &&
        fs.existsSync(targetDir) &&
        fs.lstatSync(targetDir).isDirectory()
      ) {
        const envFiles = fs
          .readdirSync(targetDir)
          .filter((f) => f === ".env" || f.startsWith(".env."));
        if (envFiles.length > 0) {
          if (process.stdin.isTTY) {
            console.log(
              `\n[archifind] Potential configuration files found: ${envFiles.join(", ")}`,
            );
            const answer = await askPermission(
              "[archifind] Do you want to include these in the architecture analysis? (y/N) ",
            );
            includeEnv = answer.toLowerCase().startsWith("y");
          } else {
            console.log(
              `[archifind] Skipping ${envFiles.length} configuration (.env) files in non-interactive session. Use --allow-env to include them.`,
            );
          }
        }
      }
      process.env.ARCHIFIND_INCLUDE_ENV = includeEnv ? "true" : "false";

      // Alredy loaded!, Intentionally commented out for reference
      // const envPath = path.resolve(process.cwd(), ".env");
      // if (fs.existsSync(envPath)) {
      //   const envContent = fs.readFileSync(envPath, "utf-8");
      //   envContent.split("\n").forEach((line) => {
      //     const [key, ...values] = line.split("=");
      //     if (key && values.length > 0 && !process.env[key.trim()]) {
      //       process.env[key.trim()] = values
      //         .join("=")
      //         .trim()
      //         .replace(/^["']|["']$/g, "");
      //     }
      //   });
      // }

      process.env.archifind_AI_ASSIST = options.aiAssist ? "true" : "false";
      process.env.archifind_AI_COMPONENTS = options.aiComponents
        ? "true"
        : "false";

      if (options.hfModel) {
        process.env.HF_MODEL = options.hfModel;
      }

      if (options.hfToken) {
        process.env.HF_TOKEN = options.hfToken;
      }

      process.env.archifind_AI_NATIVE = options.aiNative ? "true" : "false";

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
