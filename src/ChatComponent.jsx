import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from "react-markdown"
import rehypeRaw from 'rehype-raw'
import ChatBubble from "@cloudscape-design/chat-components/chat-bubble";
import Avatar from "@cloudscape-design/chat-components/avatar";
import LoadingBar from "@cloudscape-design/chat-components/loading-bar";
import LiveRegion from "@cloudscape-design/components/live-region";
import Box from "@cloudscape-design/components/box";
import {
  Container,
  Form,
  FormField,
  PromptInput,
  Button,
  Modal,
  SpaceBetween,
  TopNavigation,
  Tabs,
  Alert,
  Icon
} from "@cloudscape-design/components";
import PropTypes from 'prop-types';
import * as AWSAuth from '@aws-amplify/auth';
import { BedrockAgentRuntimeClient, InvokeAgentCommand, GetAgentMemoryCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import './ChatComponent.css';

/**
 * Main chat interface component that handles message interaction with Bedrock agent
 * @param {Object} props - Component properties
 * @param {Object} props.user - Current authenticated user information
 * @param {Function} props.onLogout - Callback handler for logout action
 * @param {Function} props.onConfigEditorClick - Callback for configuration editor
 * @returns {JSX.Element} The chat interface
 */
const ChatComponent = ({ user, onLogout, onConfigEditorClick }) => {
  // AWS Bedrock client instance for agent communication
  const [bedrockClient, setBedrockClient] = useState(null);
  // Array of chat messages in the conversation
  const [messages, setMessages] = useState([]);
  // Current message being composed by the user
  const [newMessage, setNewMessage] = useState('');
  // Unique identifier for the current chat session
  const [sessionId, setSessionId] = useState(null);
  // Memory ID for context persistence across sessions
  const [memoryId, setMemoryId] = useState(null);
  // Reference to automatically scroll to latest messages
  const messagesEndRef = useRef(null);
  // Reference to the messages container for manual scrolling
  const messagesContainerRef = useRef(null);
  // Tracks when the AI agent is processing a response
  const [isAgentResponding, setIsAgentResponding] = useState(false);
  // Controls visibility of the clear conversation modal
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  // Controls visibility of the end session modal
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  // Name of the AI agent for display purposes
  const [agentName, setAgentName] = useState({value: 'Agent'});
  // Tracks completed tasks and their explanation
  const [tasksCompleted, setTasksCompleted] = useState({count: 0, latestRationale: ''});
  // Tracks streaming stats
  const [streamStats, setStreamStats] = useState({chunkCount: 0, streamingTime: 0, startTime: null});
  // Active tab in interface (chat or memory)
  const [activeTab, setActiveTab] = useState('chat');
  // Memory summaries retrieved from Bedrock Agent
  const [memorySummaries, setMemorySummaries] = useState([]);
  // Loading state for memory retrieval
  const [loadingMemory, setLoadingMemory] = useState(false);
  // Error notification for memory operations
  const [memoryError, setMemoryError] = useState(null);
  // Tracks whether memory feature is supported for this agent
  const [memorySupported, setMemorySupported] = useState(true);
  // Tracks whether the agent is currently ending a session
  const [isEndingSession, setIsEndingSession] = useState(false);
  
  /**
   * Shows the modal for confirming conversation clearing
   */
  const handleClearData = () => {
    setShowClearDataModal(true);
  };

  /**
   * Handles the confirmation action for clearing conversation data
   * Clears all local storage and reloads the application
   */
  const confirmClearData = () => {
    // Clear all stored data from localStorage
    localStorage.clear();
    // Reload the application to reset state
    window.location.reload();
  };

  /**
   * Shows the modal for confirming session end and summarization
   */
  const handleEndSession = () => {
    setShowEndSessionModal(true);
  };

  /**
   * Handles the confirmation action for ending the current session
   * and generating a summary for memory
   */
  const confirmEndSession = async () => {
    setShowEndSessionModal(false);
    setIsEndingSession(true);
    
    // Add a system message indicating session is ending
    const systemMessage = { 
      id: `system-${Date.now()}`, 
      text: 'Ending session and generating a conversation summary...', 
      sender: 'system' 
    };
    setMessages(prevMessages => [...prevMessages, systemMessage]);
    
    try {
      // Send a final message to trigger summary generation with endSession=true
      await sendMessageToAgent("Please summarize our conversation.", true);
      
      // Show success message
      const summarySuccessMessage = { 
        id: `system-summary-${Date.now()}`, 
        text: 'Conversation has been summarized and stored in memory.', 
        sender: 'system',
        isSummary: true
      };
      setMessages(prevMessages => [...prevMessages, summarySuccessMessage]);
      
      // Refresh memory summaries after a delay to allow for processing
      setTimeout(() => {
        fetchMemorySummaries();
      }, 3000);
      
      // Create a new session after ending the current one
      createNewSession();
    } catch (error) {
      console.error('Error ending session:', error);
      const errorMessage = { 
        id: `error-${Date.now()}`,
        text: `Error ending session: ${error.message || JSON.stringify(error)}`, 
        sender: 'system',
        isError: true 
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsEndingSession(false);
    }
  };

  /**
   * Creates a new chat session with a unique identifier
   * Retains memory ID for context persistence
   * Clears existing messages and initializes storage for the new session
   */
  const createNewSession = useCallback(() => {
    // Generate new session ID using current timestamp
    const newSessionId = Date.now().toString();
    // Update session state
    setSessionId(newSessionId);
    // Clear existing messages
    setMessages([]);
    // Store session information in localStorage
    localStorage.setItem('lastSessionId', newSessionId);
    localStorage.setItem(`messages_${newSessionId}`, JSON.stringify([]));
    console.log('New session created:', newSessionId);
    
    // Add system message for new session - removed permanently stored message issue
    const systemMessage = { 
      id: `system-${Date.now()}`, 
      text: 'Starting a new conversation. Previous context will be accessible through memory.', 
      sender: 'system',
      temporary: true // Mark as temporary so it can be removed after user interaction
    };
    setMessages([systemMessage]);
  }, []);

  /**
   * Retrieves messages for a specific chat session from localStorage
   * @param {string} sessionId - The identifier of the session to fetch messages for
   * @returns {Array} Array of messages for the session, or empty array if none found
   */
  const fetchMessagesForSession = useCallback((sessionId) => {
    const storedMessages = localStorage.getItem(`messages_${sessionId}`);
    return storedMessages ? JSON.parse(storedMessages) : [];
  }, []);

  /**
   * Persists messages to localStorage for a specific session
   * Merges new messages with existing ones before storing
   * @param {string} sessionId - The identifier of the session to store messages for
   * @param {Array} newMessages - New messages to add to storage
   */
  const storeMessages = useCallback((sessionId, newMessages) => {
    // Retrieve existing messages for the session
    const currentMessages = fetchMessagesForSession(sessionId);
    // Merge existing and new messages
    const updatedMessages = [...currentMessages, ...newMessages];
    // Save updated message list to localStorage
    localStorage.setItem(`messages_${sessionId}`, JSON.stringify(updatedMessages));
  }, [fetchMessagesForSession]);

  /**
   * Attempts to load the last active chat session
   * Creates a new session if no existing session is found
   * Restores messages from localStorage for existing sessions
   */
  const loadExistingSession = useCallback(() => {
    // Try to get the ID of the last active session
    const lastSessionId = localStorage.getItem('lastSessionId');
    if (lastSessionId) {
      // If found, restore the session and its messages
      setSessionId(lastSessionId);
      const loadedMessages = fetchMessagesForSession(lastSessionId);
      setMessages(loadedMessages);
    } else {
      // If no existing session, create a new one
      createNewSession();
    }
  }, [createNewSession, fetchMessagesForSession]);

  /**
   * Effect hook to initialize AWS Bedrock client and fetch credentials
   * Sets up the connection to AWS Bedrock service using stored configuration
   */
  useEffect(() => {
    /**
     * Fetches AWS credentials and initializes Bedrock client
     * Retrieves configuration from localStorage and establishes AWS session
     */
    const fetchCredentials = async () => {
      try {
        // Get Bedrock configuration from localStorage
        const bedrockConfig = JSON.parse(localStorage.getItem('appConfig')).bedrock
        // Configure the region from settings
        const region = bedrockConfig.region || "us-west-2";
        // Fetch AWS authentication session
        const session = await AWSAuth.fetchAuthSession();
        const newClient = new BedrockAgentRuntimeClient({
          region: region,
          credentials: session.credentials
        });
        setBedrockClient(newClient);
        if(bedrockConfig.agentName && bedrockConfig.agentName.trim()){
          setAgentName({value: bedrockConfig.agentName})
        }
        
        // Initialize memory ID if not already set
        // Use username as memory ID for persistence across sessions
        if (!memoryId) {
          const userMemoryId = `memory-${user.username}`;
          setMemoryId(userMemoryId);
          localStorage.setItem('memoryId', userMemoryId);
          console.log('Memory ID set:', userMemoryId);
        }
        
      } catch (error) {
        console.error('Error fetching credentials:', error);
      }
    };

    fetchCredentials();
  }, [memoryId, user.username]);

  useEffect(() => {
    if (bedrockClient && !sessionId) {
      loadExistingSession();
      
      // Load memory ID from localStorage if available
      const storedMemoryId = localStorage.getItem('memoryId');
      if (storedMemoryId) {
        setMemoryId(storedMemoryId);
      } else {
        // Create a new memory ID based on the username
        const userMemoryId = `memory-${user.username}`;
        setMemoryId(userMemoryId);
        localStorage.setItem('memoryId', userMemoryId);
      }
    }
  }, [bedrockClient, sessionId, loadExistingSession, user.username]);

  /**
   * Effect hook to scroll to latest messages
   * Triggered whenever messages array is updated
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * Scrolls the chat window to the most recent message
   * Uses smooth scrolling behavior for better user experience
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /**
   * Manually scroll to a specific position in the messages container
   * @param {number} position - The scroll position to set
   */
  // const scrollToPosition = (position) => {
  //   if (messagesContainerRef.current) {
  //     messagesContainerRef.current.scrollTop = position;
  //   }
  // };

  /**
   * Retrieves memory summaries from Bedrock Agent
   * Fetches session summaries stored in the agent's memory
   */
  const fetchMemorySummaries = async () => {
    if (!bedrockClient || !memoryId) {
      console.error('Bedrock client or memory ID not available');
      return;
    }

    setLoadingMemory(true);
    setMemoryError(null);

    try {
      const bedrockConfig = JSON.parse(localStorage.getItem('appConfig')).bedrock;
      console.log('Fetching memory with ID:', memoryId);
      
      const command = new GetAgentMemoryCommand({
        agentId: bedrockConfig.agentId,
        agentAliasId: bedrockConfig.agentAliasId,
        memoryId: memoryId,
        memoryType: 'SESSION_SUMMARY' // Only SESSION_SUMMARY is currently supported
      });

      const response = await bedrockClient.send(command);
      
      if (response.memoryContents && response.memoryContents.length > 0) {
        // Extract and format the session summaries
        const summaries = response.memoryContents
          .filter(content => content.sessionSummary)
          .map(content => {
            const summary = content.sessionSummary;
            return {
              sessionId: summary.sessionId,
              summaryText: summary.summaryText,
              startTime: summary.sessionStartTime,
              endTime: summary.sessionEndTime || summary.sessionExpiryTime
            };
          });
        
        setMemorySummaries(summaries);
        console.log('Memory summaries retrieved:', summaries);
      } else {
        setMemorySummaries([]);
        console.log('No memory summaries found');
      }
    } catch (error) {
      console.error('Error fetching memory summaries:', error);
      
      // Check if this is an unsupported operation error
      if (error.name === 'ValidationException' || 
          (error.message && error.message.includes('Memory is not enabled'))) {
        setMemorySupported(false);
        setMemoryError('Memory features are not enabled for this agent. Enable memory in the Bedrock Agent console.');
      } else {
        setMemoryError(`Error retrieving memory: ${error.message}`);
      }
    } finally {
      setLoadingMemory(false);
    }
  };

  /**
   * Sends a message to the Bedrock agent with optional session ending
   * @param {string} messageText - Text message to send to the agent
   * @param {boolean} endSession - Whether to end the session after this message
   * @returns {Promise<string>} The agent's response text
   */
  const sendMessageToAgent = async (messageText, endSession = false) => {
    if (!messageText.trim() || !sessionId || !bedrockClient) {
      console.error('Cannot send message: missing required parameters');
      return;
    }

    const bedrockConfig = JSON.parse(localStorage.getItem('appConfig')).bedrock;
    
    // Create message object with user information if not ending session
    // For end session requests, we don't add to the visible messages
    if (!endSession) {
      const userMessage = { 
        id: `user-${Date.now()}`,
        text: messageText, 
        sender: user.username 
      };
      setMessages(prevMessages => [...prevMessages, userMessage]);
    }
    
    setIsAgentResponding(true);
    
    // Set up streaming statistics
    setStreamStats({
      chunkCount: 0,
      streamingTime: 0,
      startTime: Date.now()
    });
    
    // Get a fresh AWS session
    const credentials = await AWSAuth.fetchAuthSession();
    
    const sessionAttributes = {
      aws_session: credentials
    };

    console.log(`Sending message to agent with sessionId: ${sessionId}, memoryId: ${memoryId}, endSession: ${endSession}`);
    
    // Create the command with memory support
    const command = new InvokeAgentCommand({
      agentId: bedrockConfig.agentId,
      agentAliasId: bedrockConfig.agentAliasId,
      sessionId: sessionId,
      memoryId: memoryId, // Include memory ID for context persistence
      endSession: endSession, // Controls whether to end session and generate summary
      enableTrace: true,
      inputText: messageText,
      promptSessionAttributes: sessionAttributes,
      streamingConfigurations: {
        streamFinalResponse: true,
        applyGuardrailInterval: 300
      }
    });

    try {
      let completion = "";
      const response = await bedrockClient.send(command);

      if (response.completion === undefined) {
        throw new Error("Completion is undefined");
      }
      
      let chunkCount = 0;

      // Create a placeholder for the agent's response
      // Only add visible message if not ending session
      let agentMessageId = null;
      
      if (!endSession) {
        agentMessageId = `agent-${Date.now()}`;
        const agentMessage = { 
          id: agentMessageId,
          text: '', 
          sender: agentName.value,
          isStreaming: true
        };
        
        setMessages(prevMessages => [...prevMessages, agentMessage]);
      }

      for await (const chunkEvent of response.completion) {
        if(chunkEvent.trace){
          console.log("Trace: ", chunkEvent.trace);
          tasksCompleted.count++;
          if(typeof(chunkEvent.trace.trace.failureTrace) !== 'undefined'){
            throw new Error(chunkEvent.trace.trace.failureReason);
          }
          if(chunkEvent.trace.trace.orchestrationTrace.rationale){
            tasksCompleted.latestRationale = chunkEvent.trace.trace.orchestrationTrace.rationale.text;
            scrollToBottom();
          }
          setTasksCompleted({...tasksCompleted});
        }else if(chunkEvent.chunk){
          chunkCount++;
          const chunk = chunkEvent.chunk;
          const decodedResponse = new TextDecoder("utf-8").decode(chunk.bytes);
          completion += decodedResponse;
          
          // Update the message in real-time as chunks arrive if not ending session
          if (!endSession && agentMessageId) {
            setMessages(prevMessages => 
              prevMessages.map(msg => 
                msg.id === agentMessageId 
                  ? { ...msg, text: completion } 
                  : msg
              )
            );
          }
          
          // Update streaming stats
          setStreamStats(prev => ({
            chunkCount: chunkCount,
            streamingTime: Date.now() - prev.startTime,
            startTime: prev.startTime
          }));
          
          scrollToBottom();
        }
      }

      console.log('Full completion:', completion);

      // Final update to the agent message
      if (!endSession && agentMessageId) {
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === agentMessageId 
              ? { ...msg, text: completion, isStreaming: false } 
              : msg
          )
        );

        // Store the new messages if not ending session
        storeMessages(sessionId, [
          { id: `user-${Date.now()}`, text: messageText, sender: user.username },
          { id: agentMessageId, text: completion, sender: agentName.value }
        ]);
      }

      // If session ended, log successful summary
      if (endSession) {
        console.log('Session ended and summary created for memory ID:', memoryId);
      }

      return completion;
    } catch (err) {
      console.error('Error invoking agent:', err);
      const errorMessage = { 
        id: `error-${Date.now()}`,
        text: `An error occurred while processing your request. Error: ${err.message || JSON.stringify(err)}`, 
        sender: 'system',
        isError: true 
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
      
      if (!endSession) {
        storeMessages(sessionId, [
          { id: `user-${Date.now()}`, text: messageText, sender: user.username },
          errorMessage
        ]);
      }
      
      return null;
    } finally {
      setIsAgentResponding(false);
      setTasksCompleted({count: 0, latestRationale: ''});
    }
  };

  /**
   * Handles the submission of new messages to the chat
   * @param {Event} e - Form submission event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newMessage.trim() && sessionId && bedrockClient) {
      // Remove any temporary system messages when user sends a message
      setMessages(prevMessages => prevMessages.filter(msg => !msg.temporary));
      
      const message = newMessage;
      setNewMessage('');
      await sendMessageToAgent(message);
      
      // Focus the input element after sending a message
      const inputElement = document.querySelector('.awsui-prompt-input input');
      if (inputElement) {
        setTimeout(() => {
          inputElement.focus();
        }, 0);
      }
    }
  };
  
  /**
   * Handles user logout process
   */
  const handleLogout = async () => {
    try {
      await AWSAuth.signOut();
      onLogout();
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  /**
   * Formats a date string for display
   * @param {string} dateString - ISO date string to format
   * @returns {string} Formatted date string
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (error) {
      return dateString.toString();
    }
  };

  return (
    <div className="chat-component">
      <Container stretch>
        <div className="chat-container">
          <div className="nav-container">
            <TopNavigation
              identity={{
                href: "#",
                title: `Chat with ${agentName.value}`
              }}
              utilities={
                [
                  // End & Summarize button as a primary action
                  {
                    type: "button",
                    iconName: "save",
                    iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='white' d='M13.1,0H2.9C1.9,0,1,0.9,1,2v12c0,1.1,0.9,2,2,2h10.2c1.1,0,2-0.9,2-2V3.3L13.1,0z M8,1h4v3H8V1z M14,14 c0,0.6-0.4,1-1,1H3c-0.6,0-1-0.4-1-1V2c0-0.6,0.4-1,1-1h4v4h5h1v-1l2,2v8H14z M12,8H4C3.4,8,3,8.4,3,9v4c0,0.6,0.4,1,1,1h8 c0.6,0,1-0.4,1-1V9C13,8.4,12.6,8,12,8z M12,13H4v-4h8V13z'/%3E%3C/svg%3E",
                    text: "End & Summarize",
                    ariaLabel: "End and Summarize current chat, save to memory",
                    title: "End the current chat and save a summary to memory",
                    disableUtilityCollapse: true,
                    data: { testId: "end-summarize-btn" },
                    onClick: handleEndSession,
                    disabled: isEndingSession
                  },
                  // New Chat button as a standalone action
                  {
                    type: "button",
                    iconName: "add-plus",
                    text: "New Chat",
                    ariaLabel: "Start a new chat",
                    title: "Start a new conversation",
                    disableUtilityCollapse: true,
                    data: { testId: "new-chat-btn" },
                    onClick: createNewSession
                  },
                  //This is the settings handler
                  {
                    type: "menu-dropdown",
                    iconName: "settings",
                    ariaLabel: "Settings",
                    title: "Settings",
                    disableUtilityCollapse: true,
                    onItemClick: ({ detail }) => {
                      switch(detail.id){
                        case "edit-settings":
                          onConfigEditorClick();
                          break;
                        case "clear-settings":
                          handleClearData();
                          break;
                        case "refresh-memory":
                          fetchMemorySummaries();
                          break;
                      }
                    },
                    items: [
                      {
                        id: "refresh-memory",
                        type: "button",
                        iconName: "refresh",
                        text: "Refresh Memory Summaries",
                      },
                      {
                        id: "clear-settings",
                        type: "button",
                        iconName: "remove",
                        text: "Clear settings and local storage",
                      },
                      {
                        id: "edit-settings",
                        text: "Edit Settings",
                        iconName: "edit",
                        type: "icon-button",
                      }
                    ]
                  },
                  //This is the user session menu options
                  {
                    type: "menu-dropdown",
                    text: user.username,
                    iconName: "user-profile",
                    title: user.username,
                    ariaLabel: "User",
                    disableUtilityCollapse: true,
                    onItemClick: ({ detail }) => {
                      switch(detail.id){
                        case "logout":
                          handleLogout();
                          break;
                      }
                    },
                    items: [
                      {
                        id: "logout",
                        text: "Logout",
                        iconName: "exit",
                        type: "icon-button",
                      }
                    ]
                  }
                ]
              }
            />
            
            <Tabs
              onChange={({ detail }) => setActiveTab(detail.activeTabId)}
              activeTabId={activeTab}
              tabs={[
                {
                  id: "chat",
                  label: "Chat",
                  content: (
                    <div className="chat-tab-content">
                      <div className="messages-container scrollable" ref={messagesContainerRef}>
                        {messages.map((message, index) => (
                          <div key={message.id || index}>
                            <ChatBubble
                              ariaLabel={`${message.sender} message`}
                              type={
                                message.sender === user.username 
                                  ? "outgoing" 
                                  : message.sender === "system" 
                                    ? "system" 
                                    : "incoming"
                              }
                              avatar={
                                message.sender !== "system" && (
                                  <Avatar
                                    ariaLabel={message.sender}
                                    tooltipText={message.sender}
                                    color={
                                      message.sender === user.username 
                                        ? "default"
                                        : "gen-ai"
                                    }
                                    initials={message.sender.substring(0, 2).toUpperCase()}
                                  />
                                )
                              }
                              variant={message.isError ? "error" : undefined}
                            >
                              {message.isStreaming && !message.text ? (
                                <div className="typing-indicator">
                                  <span></span>
                                  <span></span>
                                  <span></span>
                                </div>
                              ) : (
                                message.text.split('\n').map((line, i) => (
                                  <ReactMarkdown 
                                    key={`md-rendering-${message.id}-${i}`}
                                    rehypePlugins={[rehypeRaw]} // Enables HTML parsing
                                  >
                                    {line}
                                  </ReactMarkdown>
                                ))
                              )}
                            </ChatBubble>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                        {isAgentResponding && (
                          <LiveRegion>
                          <Box
                              margin={{ bottom: "xs", left: "l" }}
                              color="text-body-secondary"
                          >
                            {tasksCompleted.count > 0 && (
                              <div>
                                {agentName.value} is working on your request | Tasks completed ({tasksCompleted.count})
                                <br/> 
                                <i>{tasksCompleted.latestRationale}</i>
                              </div>
                            )}
                            {streamStats.chunkCount > 0 && (
                              <div>
                                Receiving chunks: {streamStats.chunkCount} | 
                                Time: {Math.round(streamStats.streamingTime / 1000)}s
                              </div>
                            )}
                            <LoadingBar variant="gen-ai" />
                          </Box>
                        </LiveRegion>
                        )}
                      </div>
                      <div className="message-form-container">
                        <form onSubmit={handleSubmit} className="message-form">
                          <Form>
                            <FormField stretch>
                              <PromptInput 
                                type='text'
                                value={newMessage}
                                onChange={({detail}) => setNewMessage(detail.value)}
                                placeholder='Type your question here...'
                                actionButtonAriaLabel="Send message"
                                actionButtonIconName="send"
                                disabled={isAgentResponding || isEndingSession}
                              />
                            </FormField>
                          </Form>
                        </form>
                      </div>
                    </div>
                  ),
                },
                {
                  id: "memory",
                  label: "Memory Summaries",
                  content: (
                    <div className="memory-panel">
                      <div className="memory-header">
                        <Button 
                          onClick={fetchMemorySummaries}
                          loading={loadingMemory}
                          iconName="refresh"
                        >
                          Refresh Memory
                        </Button>
                        <Box margin={{ top: "s" }}>
                          Memory ID: {memoryId}
                        </Box>
                      </div>
                      
                      {memoryError && (
                        <Alert type="error" header="Memory Error">
                          {memoryError}
                        </Alert>
                      )}
                      
                      {!memorySupported ? (
                        <Alert type="info" header="Memory Not Enabled">
                          Memory features appear to be disabled for this agent. To enable memory:
                          <ol>
                            <li>Go to the Amazon Bedrock console</li>
                            <li>Edit your agent configuration</li>
                            <li>Enable the memory feature</li>
                            <li>Ensure you&apos;re using a supported foundation model (Claude 3 Sonnet, Claude 3 Haiku, etc.)</li>
                          </ol>
                        </Alert>
                      ) : loadingMemory ? (
                        <Box padding="l" textAlign="center">
                          <LoadingBar label="Loading memory summaries..." />
                        </Box>
                      ) : memorySummaries.length === 0 ? (
                        <Box padding="l" textAlign="center">
                          No memory summaries found. End a conversation to generate a summary.
                        </Box>
                      ) : (
                        <div className="memory-summaries">
                          {memorySummaries.map((summary, index) => (
                            <div key={index} className="memory-summary-item">
                              <Box
                                padding="m"
                                margin={{ bottom: "s" }}
                                border="divider"
                                borderRadius="standard"
                              >
                                <h4>Session: {summary.sessionId}</h4>
                                <div className="memory-timestamp">
                                  {formatDate(summary.startTime)} - {formatDate(summary.endTime)}
                                </div>
                                <div className="memory-content">
                                  {summary.summaryText}
                                </div>
                              </Box>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* Clear Data Confirmation Modal */}
          <Modal 
            onDismiss={() => setShowClearDataModal(false)}
            visible={showClearDataModal}
            header="Confirm clearing data"
            footer={
              <Box float="right">
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="link" onClick={() => setShowClearDataModal(false)}>Cancel</Button>
                  <Button variant="primary" onClick={confirmClearData}>Ok</Button>
                </SpaceBetween>
              </Box>
            }
          >
            <strong>This action cannot be undone.</strong> Configuration for this application will be deleted along with the chat history with {agentName.value}. Do you want to continue?
          </Modal>

          {/* End Session Confirmation Modal */}
          <Modal 
            onDismiss={() => setShowEndSessionModal(false)}
            visible={showEndSessionModal}
            header={
              <span className="top-nav-button-icon">
                <Icon name="save" />
                End and summarize conversation
              </span>
            }
            footer={
              <Box float="right">
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="link" onClick={() => setShowEndSessionModal(false)}>Cancel</Button>
                  <Button variant="primary" onClick={confirmEndSession}>
                    <span className="top-nav-button-icon">
                      <Icon name="save" />
                      End Conversation
                    </span>
                  </Button>
                </SpaceBetween>
              </Box>
            }
          >
            <p>Do you want to end the current conversation and generate a summary?</p>
            <p>The summary will be stored in memory and can be accessed later to provide context for future conversations.</p>
          </Modal>
        </div>
      </Container>
    </div>
  );
};

ChatComponent.propTypes = {
  user: PropTypes.object.isRequired,
  onLogout: PropTypes.func.isRequired,
  onConfigEditorClick: PropTypes.func.isRequired
};

export default ChatComponent;
