# CI/CD and Deployment Guide for Bedrock Agents Chat UI

This guide provides detailed instructions for setting up Continuous Integration and Continuous Deployment (CI/CD) for the Bedrock Agents Chat UI using GitHub Actions and AWS Amplify.

## Overview

The CI/CD pipeline for this project consists of:

1. GitHub Actions for automated testing and deployment
2. AWS Amplify for hosting and deployment
3. Multi-environment support (development and production)
4. Secure configuration management using environment variables

## GitHub Actions Workflow

The project includes a GitHub Actions workflow file (`.github/workflows/amplify-deploy.yml`) that automates the build, test, and deployment process. The workflow:

- Runs on pushes to `main` and `develop` branches and pull requests
- Builds and tests the application
- Deploys to AWS Amplify for `main` (production) and `develop` (development) branches

### Workflow Steps

1. **Build and Test Job**:
   - Checks out code
   - Sets up Node.js environment
   - Installs dependencies
   - Runs linting
   - Builds the application
   - This job runs for all pushes and pull requests

2. **Deploy Job**:
   - Only runs for pushes to `main` or `develop` branches
   - Uses environment-specific secrets based on the branch
   - Configures AWS credentials
   - Builds the application with environment variables
   - Deploys to AWS Amplify

## Environment Configuration

### GitHub Secrets

Set up the following secrets in your GitHub repository:

| GitHub Secret Name | Description | Maps to Environment Variable |
|-------------|-------------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key with Amplify permissions | (Used for AWS authentication) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | (Used for AWS authentication) |
| `AWS_REGION` | AWS region for deployment | (Used for AWS authentication) |
| `COGNITO_REGION` | Region for Cognito resources | `VITE_COGNITO_REGION` |
| `COGNITO_USER_POOL_ID` | Cognito user pool ID | `VITE_COGNITO_USER_POOL_ID` |
| `COGNITO_USER_POOL_CLIENT_ID` | Cognito app client ID | `VITE_COGNITO_USER_POOL_CLIENT_ID` |
| `COGNITO_IDENTITY_POOL_ID` | Cognito identity pool ID | `VITE_COGNITO_IDENTITY_POOL_ID` |
| `BEDROCK_REGION` | Region for Bedrock (e.g., us-west-2) | `VITE_BEDROCK_REGION` |
| `BEDROCK_AGENT_ID` | Bedrock agent ID | `VITE_BEDROCK_AGENT_ID` |
| `BEDROCK_AGENT_ALIAS_ID` | Bedrock agent alias ID | `VITE_BEDROCK_AGENT_ALIAS_ID` |
| `BEDROCK_AGENT_NAME` | Display name for your agent | `VITE_BEDROCK_AGENT_NAME` |

> **Note**: The GitHub workflow automatically maps these secrets to the corresponding environment variables with the `VITE_` prefix needed by the application.

### Environment-Specific Settings

For multi-environment deployments (development/production), create environment-specific secrets in GitHub:

1. Go to your repository settings
2. Navigate to Environments
3. Create "production" and "development" environments
4. Add environment-specific secrets to each

## AWS Amplify Setup

### Initial Setup

1. Install the Amplify CLI:
   ```bash
   npm install -g @aws-amplify/cli
   ```

2. Configure the Amplify CLI:
   ```bash
   amplify configure
   ```

3. Initialize Amplify in your project:
   ```bash
   amplify init
   ```

4. Add authentication:
   ```bash
   amplify add auth
   ```

5. Push the resources:
   ```bash
   amplify push
   ```

### Multi-Environment Support

Amplify supports multiple environments for your application:

1. Create a development environment:
   ```bash
   amplify env add
   # Enter "dev" as the environment name
   ```

2. Create a production environment:
   ```bash
   amplify env checkout main
   amplify env add
   # Enter "prod" as the environment name
   ```

3. Switch between environments:
   ```bash
   amplify env checkout dev  # Switch to development
   amplify env checkout prod  # Switch to production
   ```

### Amplify.yml Configuration

The repository includes an `amplify.yml` file that configures the build process in AWS Amplify Console:

```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - amplifyPush --simple
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

## Manual Deployment Options

### Using Amplify CLI

The project includes npm scripts for manual deployment:

1. Deploy to development:
   ```bash
   npm run deploy:dev
   ```

2. Deploy to production:
   ```bash
   npm run deploy:prod
   ```

### Using Amplify Console

1. Build the application:
   ```bash
   npm run build
   ```

2. Package the build:
   ```bash
   cd dist
   zip -r ../deployment.zip ./*
   ```

3. Upload the `deployment.zip` file in the Amplify Console.

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check build logs in GitHub Actions
   - Verify that all dependencies are correctly installed
   - Ensure that environment variables are properly set

2. **Deployment Failures**:
   - Check AWS credentials in GitHub secrets
   - Verify IAM permissions for the AWS user
   - Check Amplify logs in the AWS Console

3. **Configuration Issues**:
   - Verify that all required environment variables are set
   - Check for typos in environment variable names
   - Ensure environment variables are correctly passed to the build process

### Getting Help

If you encounter issues with the CI/CD pipeline:

1. Check the GitHub Actions logs for detailed error messages
2. Review the AWS Amplify Console logs
3. File an issue in the repository with details about the problem

## Best Practices

1. **Test Before Deploying**:
   - Always create a pull request to test changes before merging to main branches
   - Use the development environment for testing before promoting to production

2. **Secure Secret Management**:
   - Never commit sensitive information like access keys to the repository
   - Use GitHub secrets or environment variables for all sensitive values

3. **Monitoring**:
   - Monitor deployments in AWS Amplify Console
   - Set up notifications for build and deployment failures

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS Amplify Deployment Documentation](https://docs.amplify.aws/cli/usage/cicd)
- [AWS Amplify Environment Management](https://docs.amplify.aws/cli/teams/overview)