import { Amplify, API } from 'aws-amplify';

/**
 * Configure Amplify REST API for Bedrock 
 * @param {string} region - AWS region for Bedrock agent
 * @param {string} endpoint - Optional custom endpoint
 */
export const configureBedrockAPI = (region, endpoint) => {
  const existingConfig = Amplify.getConfig();
  
  Amplify.configure({
    ...existingConfig,
    API: {
      REST: {
        bedrockAgent: {
          endpoint: endpoint || `https://bedrock-agent-runtime.${region}.amazonaws.com`,
          region,
        },
      },
    },
  });
};

/**
 * Invoke Bedrock Agent using Amplify API for consistent credential management
 * @param {string} agentId - Bedrock agent ID
 * @param {string} agentAliasId - Bedrock agent alias ID
 * @param {string} inputText - User message text
 * @param {string} sessionId - Conversation session ID
 * @param {string} memoryId - Memory context ID
 * @param {boolean} endSession - Whether to end the session (for summarization)
 * @returns {Promise} - Response from Bedrock agent
 */
export const invokeAgent = async (agentId, agentAliasId, inputText, sessionId, memoryId, endSession = false) => {
  const path = `/agents/${agentId}/agent-aliases/${agentAliasId}/sessions/${sessionId}/text`;
  
  const init = {
    body: {
      inputText,
      enableTrace: true,
      memoryId,
      endSession,
      streamingConfigurations: {
        streamFinalResponse: true,
        applyGuardrailInterval: 300
      }
    },
    headers: {
      'Content-Type': 'application/json',
    },
  };

  try {
    return await API.post('bedrockAgent', path, init);
  } catch (error) {
    console.error('Error invoking Bedrock agent:', error);
    throw error;
  }
};

/**
 * Retrieve memory summaries from Bedrock Agent
 * @param {string} agentId - Bedrock agent ID
 * @param {string} agentAliasId - Bedrock agent alias ID
 * @param {string} memoryId - Memory context ID
 * @returns {Promise} - Memory content from Bedrock agent
 */
export const getAgentMemory = async (agentId, agentAliasId, memoryId) => {
  const path = `/agents/${agentId}/agent-aliases/${agentAliasId}/memory/${memoryId}`;
  
  const init = {
    headers: {
      'Content-Type': 'application/json',
    },
    queryStringParameters: {
      memoryType: 'SESSION_SUMMARY'
    }
  };

  try {
    return await API.get('bedrockAgent', path, init);
  } catch (error) {
    console.error('Error retrieving Bedrock agent memory:', error);
    throw error;
  }
};