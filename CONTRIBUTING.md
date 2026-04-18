# Contributing to archifind

Thank you for your interest in contributing to archifind! This document outlines our contribution process and quality standards.

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to maintain a welcoming community for all contributors.

## Setting Up Development Environment

1. Clone the repository:

   ```bash
   git clone https://github.com/Mensa-Philosophical-Circle/archifind.git
   cd archifind
   ```

2. Install dependencies:

   ```bash
   npm ci
   npm --prefix ui ci
   ```

3. **Husky git hooks are automatically installed!**

   When you run `npm ci`, the `prepare` script automatically sets up Husky git hooks. These hooks will:
   - **Pre-commit**: Run ESLint, Prettier, and TypeScript type checking on staged files
   - **Commit message**: Validate commit message format (Conventional Commits)

   If you need to manually install or reinstall hooks:

   ```bash
   npm run prepare
   ```

   ✨ **That's it!** Hooks are now active and will run automatically on every commit.

## Contribution Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Follow the naming convention:

- `feature/descriptive-name` for new features
- `fix/descriptive-name` for bug fixes
- `docs/descriptive-name` for documentation updates
- `refactor/descriptive-name` for code improvements

### 2. Make Your Changes

Edit files and ensure you follow the code style guidelines (see below).

### 3. Quality Checks (REQUIRED)

Before pushing, run these checks locally:

```bash
# Lint code
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code
npm run format

# Check type safety
npm run type-check

# Run all quality checks
npm run quality

# Fix all auto-fixable issues
npm run quality:fix
```

### 4. Commit Messages (REQUIRED)

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Valid Types:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning (formatting, missing semicolons, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to build process, dependencies, tooling, etc.
- **ci**: Changes to CI/CD configuration
- **security**: Security-related fixes
- **revert**: Reverts a previous commit

#### Example Commit Messages:

```
feat(cli): add support for custom output formats

docs(readme): update installation instructions

fix(ui): resolve graph rendering performance issue

security(api): validate input to prevent injection attacks
```

#### Guidelines:

- Use imperative mood ("add feature" not "adds feature")
- Don't capitalize the subject line
- No period (.) at the end of the subject
- Max 72 characters for the subject line
- Leave a blank line between subject and body
- Wrap body at 100 characters
- Explain what and why, not how

**❌ Bad:**

```
Fixed the bug in the analyzer
```

**✅ Good:**

```
fix(analyzer): prevent infinite loop in circular dependencies

The analyzer would hang when processing circular dependencies.
Added cycle detection using path tracking to prevent revisiting nodes.
```

### 5. Push to Your Fork

```bash
git push origin your-branch-name
```

### 6. Create a Pull Request

- Open a PR against the `production` branch
- Use our PR template
- Describe what you changed and why
- Reference any related issues (e.g., "Closes #123")
- Ensure all CI checks pass

## Git Hooks with Husky

We use **Husky** to automatically validate code quality before commits. This catches issues locally before they reach the CI pipeline.

### What Happens on Commit?

**Pre-commit hook** (`npm run quality`):

- ✅ ESLint fixes linting errors on staged files
- ✅ Prettier auto-formats staged files
- ✅ TypeScript type checking validates code
- ❌ Commit is rejected if hooks fail

**Commit-msg hook** (Conventional Commits):

- ✅ Validates commit message format
- ❌ Rejects non-compliant commit messages

### Troubleshooting Git Hooks

**Hooks not running?**

```bash
# Reinstall hooks
npm run prepare
```

**Need to skip hooks temporarily?** (not recommended)

```bash
# Skip all hooks
git commit --no-verify

# Skip only pre-commit
HUSKY=0 git commit
```

**Fix auto-fixable issues before committing:**

```bash
npm run quality:fix  # Fixes linting and formatting
```

**Manual lint check:**

```bash
npm run lint         # Check for errors
npm run lint:fix     # Auto-fix errors
npm run format       # Format code
```

## Code Style Guide

### JavaScript/TypeScript

**Linting**: We use ESLint with strict rules enforcing:

- **No unused variables** (except parameters starting with `_`)
- **No `console.log()`** in production code (use `console.error()` or `console.info()`)
- **Const/let only** (no var)
- **Strict equality** (`===` and `!==`)
- **No eval()** or implicit eval
- **No loose functions** (no Function constructor abuse)

**Formatting**: We use Prettier with these settings:

- 2-space indentation
- Single quotes for strings
- Semicolons required
- Trailing commas (ES5 mode)
- 100-character line width
- Always include parentheses in arrow functions

**React/TypeScript Specific**:

- Use functional components with hooks
- Export components as named exports
- Type all props and state
- Use descriptive variable names

### Example Code Style

```typescript
// ✅ Good
export function analyzeFile(filePath: string): AnalysisResult {
  if (!filePath) {
    throw new Error('File path is required');
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const result = parseCode(content);

  return result;
}

// ❌ Bad
export function analyzeFile(filePath) {
  if (!filePath) console.log('No path');
  let content = fs.readFileSync(filePath, 'utf-8');
  var result = parseCode(content);
  return result;
}
```

## Security Requirements

All contributions must pass security checks:

1. **Dependency Audit**: No high/critical vulnerabilities

   ```bash
   npm audit --audit-level=moderate
   ```

2. **Best Practices**:
   - No hardcoded secrets or credentials
   - Validate all external inputs
   - Use `const` for immutability by default
   - Avoid `eval()` and `Function()` constructor
   - Sanitize user input where needed

3. **Code Review**:
   - Security reviewers will check for vulnerabilities
   - Address security concerns before merge

## Testing

**Current Status**: Test suite is being developed.

When writing code:

- Consider edge cases
- Test your changes manually
- Document any manual test steps in your PR

## Documentation

- Update README.md if your changes affect how users interact with archifind
- Add JSDoc comments for public APIs
- Include examples for new CLI commands
- Keep docs in sync with code changes

## PR Review Process

1. **Automated Checks**: All GitHub Actions must pass:
   - ESLint and Prettier
   - TypeScript type checking
   - Security audit
   - Commit message validation

2. **Code Review**: Team members will review your code for:
   - Code quality and style adherence
   - Security implications
   - Performance considerations
   - Design and architecture

3. **Approval & Merge**: We require at least one approval before merging.

## Getting Help

- **Questions**: Open a discussion or issue
- **Bug Reports**: Provide detailed reproduction steps
- **Feature Requests**: Explain the use case and benefits
- **Documentation**: Suggest improvements on discussions

## Recognition

Contributors are recognized in:

- Git commit history
- GitHub contributors page
- Release notes for significant contributions

Thank you for helping make archifind better! 🎉
