# Browser Client for Amazon Bedrock Agents

A React-based web application that enables interaction with Amazon Bedrock Agents directly from the browser. The application uses AWS Amplify, and leverages temporary credentials from Amazon Cognito User and Identity Pools for secure API access.

## UI main components

### Application configuration form
![410521698-6d60dcf5-3fbe-4d5e-a201-9ee1d22958c0](https://github.com/user-attachments/assets/a2421c88-6fb4-45d8-9deb-7146d1ffad97)

### Login process
![login](https://github.com/user-attachments/assets/c563e4d6-f17f-4699-9055-be88dcb11c69)

### Chat interaction
![chatprompt](https://github.com/user-attachments/assets/6ea57a4d-503a-4936-a2c4-a7d0c8b2b8a5)

## Memory Feature

This application supports Bedrock Agents' memory capabilities, allowing agents to maintain context across multiple conversations. The memory feature works as follows:

### How Memory Works

- **Session Summaries**: When you end a conversation using the "End & Summarize" button, the application automatically generates a summary of the conversation and stores it in the agent's memory.
- **Persistent Context**: The agent can recall information from previous conversations, providing a more coherent and personalized experience.
- **Memory Tab**: Access previous conversation summaries through the Memory tab in the interface.

### Key Features

- **End & Summarize**: Explicitly end a conversation and create a summary for future reference.
- **Memory ID**: Each user is assigned a unique memory ID based on their username, ensuring personalized context persistence.
- **Memory Retrieval**: The agent can access relevant information from past conversations to inform current responses.

### Using Memory

1. Make sure memory is enabled for your Bedrock Agent (see setup instructions below).
2. Start a conversation with your agent.
3. When you want to end the session and save a summary, click the "End & Summarize" button.
4. For future conversations, the agent will be able to reference information from previous sessions.
5. View all conversation summaries in the Memory tab.

## Prerequisites

- Node.js (v18 or later recommended)
- npm (latest version)
- AWS Account with access to:
  - Amazon Bedrock
  - Amazon Cognito
  - IAM permissions to manage Bedrock and Cognito resources
  - AWS Amplify (optional - only if using Amplify for deployment)

## AWS Setup (Optional - Only if using AWS Amplify)

If you plan to use AWS Amplify for deployment, follow these steps:

1. Configure AWS Amplify

```bash
# Install Amplify CLI globally
npm install -g @aws-amplify/cli

# Configure Amplify CLI with your AWS credentials
amplify configure

# Initialize Amplify in your project
amplify init

# Push the backend resources to AWS
amplify push
```

2. Set up Amazon Bedrock Agent
- Create and configure your Bedrock Agent in the AWS Console
- Enable the Memory feature in your Bedrock Agent:
  - In the Amazon Bedrock console, navigate to your agent
  - Click on "Edit"
  - In the "Advanced settings" section, enable "Memory"
  - Choose a supported foundation model (Claude 3 Sonnet, Claude 3 Haiku, etc.)
  - Save your changes
- Note down the Agent ID and Agent Alias ID for configuration in this application

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

The application will be available at http://localhost:5173

## Building for Production

1. Build the application:

```bash
npm run build
```

2. Test the production build locally:

```bash
npm run preview
```

## Deployment to AWS Amplify

### Option 1: Manual Deployment
1. Build the application:

```bash
npm run build
```

2. Package the dist folder contents:

```bash
cd dist
zip -r ../deployment.zip ./*
```

3. Upload the deployment.zip file through the AWS Amplify Console

### Option 2: Continuous Deployment
1. Connect your repository to AWS Amplify:
   - Go to AWS Amplify Console
   - Click "New App" > "Host Web App"
   - Choose your repository provider
   - Follow the setup wizard

2. Amplify will automatically build and deploy your application when you push changes to your repository

## Additional Resources

- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Vite Documentation](https://vitejs.dev/guide/)

## Support

For issues and feature requests, please file an issue in the repository.
