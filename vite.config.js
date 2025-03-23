import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      legacy({
        targets: ['defaults', 'not IE 11']
      })
    ],
    resolve: {
      alias: {
        './runtimeConfig': './runtimeConfig.browser', // This is needed for Amplify
      },
    },
    define: {
      // Make env variables available to the client
      'process.env.VITE_COGNITO_REGION': JSON.stringify(env.VITE_COGNITO_REGION),
      'process.env.VITE_COGNITO_USER_POOL_ID': JSON.stringify(env.VITE_COGNITO_USER_POOL_ID),
      'process.env.VITE_COGNITO_USER_POOL_CLIENT_ID': JSON.stringify(env.VITE_COGNITO_USER_POOL_CLIENT_ID),
      'process.env.VITE_COGNITO_IDENTITY_POOL_ID': JSON.stringify(env.VITE_COGNITO_IDENTITY_POOL_ID),
      'process.env.VITE_BEDROCK_REGION': JSON.stringify(env.VITE_BEDROCK_REGION),
      'process.env.VITE_BEDROCK_AGENT_ID': JSON.stringify(env.VITE_BEDROCK_AGENT_ID),
      'process.env.VITE_BEDROCK_AGENT_ALIAS_ID': JSON.stringify(env.VITE_BEDROCK_AGENT_ALIAS_ID),
      'process.env.VITE_BEDROCK_AGENT_NAME': JSON.stringify(env.VITE_BEDROCK_AGENT_NAME),
    },
    build: {
      sourcemap: true,
      outDir: 'dist',
    },
    server: {
      port: 3000,
      open: true
    }
  };
})