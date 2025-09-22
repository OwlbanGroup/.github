# Contributing to AI Dashboard

Thank you for your interest in contributing to the AI Dashboard project! This document provides guidelines for contributing to this open-source project.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/ai-dashboard.git
   cd ai-dashboard
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make your changes** and test them
6. **Submit a pull request**

## 📋 Contribution Guidelines

### Code Style

- Follow the existing code style and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Use async/await for asynchronous operations

### Commit Messages

Use clear, descriptive commit messages that follow this format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(auth): add JWT token refresh functionality
fix(api): resolve memory leak in financial data service
docs: update API documentation with new endpoints
test: add unit tests for validation middleware
```

### Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** and ensure they work correctly
3. **Add tests** for new functionality
4. **Update documentation** if needed
5. **Run the test suite**:
   ```bash
   npm test
   ```
6. **Submit a pull request** with:
   - Clear title and description
   - Reference to any related issues
   - Screenshots for UI changes
   - Testing instructions if needed

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Run tests with UI
npm run test:ui
```

### Writing Tests

- Add tests for new features
- Ensure tests cover edge cases
- Use descriptive test names
- Mock external dependencies
- Test both success and error scenarios

### Test Structure

```
tests/
├── e2e/
│   ├── dashboard.spec.js    # End-to-end tests
│   └── api.spec.js         # API endpoint tests
├── unit/
│   ├── services/           # Unit tests for services
│   └── utils/             # Utility function tests
└── integration/
    └── workflows/         # Integration tests
```

## 📚 Documentation

### Code Documentation

- Add JSDoc comments for functions and classes
- Document API endpoints with examples
- Include parameter and return type information
- Add usage examples for complex functions

### README Updates

- Update README.md for new features
- Add setup instructions for new dependencies
- Document breaking changes
- Include troubleshooting guides

## 🔧 Development Setup

### Prerequisites

- Node.js 18+
- MongoDB (optional, for full functionality)
- Redis (optional, for caching)
- Git

### Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Fill in your API keys and configuration:
   ```env
   # Required
   OPENAI_API_KEY=your_openai_key
   HF_API_KEY=your_huggingface_key

   # Optional (for full functionality)
   MONGODB_URI=mongodb://localhost:27017/dashboard
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=your_jwt_secret
   ```

3. Start the development server:
   ```bash
   npm start
   ```

## 🐛 Bug Reports

When reporting bugs, please include:

- **Description**: Clear description of the bug
- **Steps to reproduce**: Step-by-step instructions
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: Node.js version, OS, browser (if applicable)
- **Screenshots**: If it's a UI issue
- **Logs**: Relevant error logs

## 💡 Feature Requests

Feature requests are welcome! Please include:

- **Use case**: Why is this feature needed?
- **Description**: Detailed description of the feature
- **Examples**: Code examples or mockups
- **Alternatives**: Alternative solutions considered
- **Priority**: How important is this feature?

## 🔒 Security

### Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT** create a public issue
2. **Email** the maintainers directly
3. **Include** detailed information about the vulnerability
4. **Allow** time for the issue to be investigated and fixed

### Security Guidelines

- Never commit sensitive information (API keys, passwords)
- Use environment variables for configuration
- Validate all input data
- Implement proper error handling
- Keep dependencies updated
- Use security headers

## 📝 Code Review Process

All submissions require review. Reviewers will check:

- **Functionality**: Does it work as expected?
- **Code quality**: Is the code well-written and maintainable?
- **Tests**: Are there adequate tests?
- **Documentation**: Is it properly documented?
- **Security**: Are there any security concerns?
- **Performance**: Does it impact performance?

## 🎯 Project Structure

```
ai-dashboard/
├── app.js                    # Main application file
├── package.json             # Dependencies and scripts
├── ecosystem.config.js      # PM2 configuration
├── middleware/              # Custom middleware
├── services/               # Business logic services
├── models/                 # Database models
├── routes/                 # API routes
├── utils/                  # Utility functions
├── tests/                  # Test files
├── dashboard/              # Frontend assets
├── docs/                   # Documentation
└── scripts/                # Utility scripts
```

## 🤝 Community

- **Discussions**: Use GitHub Discussions for questions and ideas
- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Code**: Follow the established patterns and conventions
- **Respect**: Be respectful and constructive in all interactions

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the original project (MIT License).

---

Thank you for contributing to the AI Dashboard project! Your help makes this project better for everyone. 🎉
