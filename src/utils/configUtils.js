import { Amplify } from 'aws-amplify';

/**
 * Configuration utility that handles multiple configuration methods
 * Priority: 
 * 1. Local storage overrides
 * 2. Environment variables
 * 3. aws-exports.js (if available)
 * 4. Manual configuration through UI
 */

// Try to import aws-exports.js if it exists
let awsExports = null;
try {
  // Use dynamic import to avoid build errors if file doesn't exist
  awsExports = await import('../aws-exports').catch(() => null);
} catch (error) {
  console.info('No aws-exports.js file found');
}

/**
 * Retrieve configuration values with priority order
 * @returns {Object} Configuration object with cognito and bedrock settings
 */
export const getConfig = () => {
  // Check for stored configuration in localStorage (highest priority)
  const storedConfig = localStorage.getItem('appConfig');
  if (storedConfig) {
    return JSON.parse(storedConfig);
  }

  // Next, check for environment variables
  const envConfig = {
    cognito: {
      region: import.meta.env.VITE_COGNITO_REGION,
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
    },
    bedrock: {
      region: import.meta.env.VITE_BEDROCK_REGION,
      agentId: import.meta.env.VITE_BEDROCK_AGENT_ID,
      agentAliasId: import.meta.env.VITE_BEDROCK_AGENT_ALIAS_ID,
      agentName: import.meta.env.VITE_BEDROCK_AGENT_NAME || 'Agent',
    }
  };

  // If we have all required environment variables, use them
  if (envConfig.cognito.region && 
      envConfig.cognito.userPoolId && 
      envConfig.cognito.userPoolClientId &&
      envConfig.bedrock.region && 
      envConfig.bedrock.agentId && 
      envConfig.bedrock.agentAliasId) {
    return envConfig;
  }

  // Next, check for aws-exports.js
  if (awsExports && awsExports.default) {
    const exports = awsExports.default;
    return {
      cognito: {
        region: exports.aws_cognito_region,
        userPoolId: exports.aws_user_pools_id,
        userPoolClientId: exports.aws_user_pools_web_client_id,
        identityPoolId: exports.aws_cognito_identity_pool_id,
      },
      bedrock: {
        // These might not be in aws-exports, so fallback to env vars or empty strings
        region: envConfig.bedrock.region || '',
        agentId: envConfig.bedrock.agentId || '',
        agentAliasId: envConfig.bedrock.agentAliasId || '',
        agentName: envConfig.bedrock.agentName || 'Agent',
      }
    };
  }

  // Return empty config - app will show configuration UI
  return {
    cognito: {
      region: '',
      userPoolId: '',
      userPoolClientId: '',
      identityPoolId: '',
    },
    bedrock: {
      region: '',
      agentId: '',
      agentAliasId: '',
      agentName: 'Agent',
    }
  };
};

/**
 * Configure Amplify with the merged configuration
 */
export const configureAmplify = () => {
  const config = getConfig();
  
  Amplify.configure({
    Auth: {
      Cognito: {
        region: config.cognito.region,
        userPoolId: config.cognito.userPoolId,
        userPoolClientId: config.cognito.userPoolClientId,
        identityPoolId: config.cognito.identityPoolId,
      },
    },
  });

  return config;
};