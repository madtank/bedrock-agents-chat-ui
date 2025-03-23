# CLAUDE.md - Agent Guidelines

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Code Style
- **Format**: Follow ESLint configuration with React-specific rules
- **Imports**: Group imports by type (React, AWS, components, styles)
- **Components**: Use functional components with hooks (useState, useEffect, useRef, useCallback)
- **Types**: Use PropTypes for component props validation
- **Naming**:
  - React components: PascalCase
  - Functions: camelCase
  - Variables: camelCase
  - Files: Component files are PascalCase.jsx
- **Error Handling**: Use try/catch blocks with console.error and user-friendly error messages
- **Comments**: Use JSDoc-style comments for components and functions
- **AWS Integration**: Use AWS Amplify for authentication and AWS SDK for Bedrock agent interactions
- **State Management**: Prefer React hooks over Redux
- **Documentation**: Update README.md when adding new features

This UI interacts with AWS Bedrock Agent Runtime to provide a chat interface with memory capabilities and session management.