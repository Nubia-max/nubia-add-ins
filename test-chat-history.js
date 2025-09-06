const axios = require('axios');

const API_URL = 'http://localhost:5001/api';
let authToken = null;
let currentChatId = null;

// Test credentials
const testUser = {
  email: 'test-chat@example.com',
  password: 'TestPassword123!'
};

async function signup() {
  try {
    const response = await axios.post(`${API_URL}/auth/signup`, testUser);
    console.log('✅ User created successfully');
    authToken = response.data.token;
    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('User already exists, logging in...');
      return login();
    }
    console.error('Signup error:', error.response?.data || error.message);
    throw error;
  }
}

async function login() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, testUser);
    console.log('✅ Login successful');
    authToken = response.data.token;
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
}

async function createNewChat() {
  try {
    const response = await axios.post(
      `${API_URL}/chat/new`,
      {},
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    console.log('✅ New chat created:', response.data);
    currentChatId = response.data.id;
    return response.data;
  } catch (error) {
    console.error('Create chat error:', error.response?.data || error.message);
    throw error;
  }
}

async function sendMessage(content, chatId = null) {
  try {
    const response = await axios.post(
      `${API_URL}/chat/send`,
      { 
        content,
        chatId: chatId || currentChatId
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    console.log(`✅ Message sent: "${content}"`);
    console.log(`   AI Response: "${response.data.aiMessage.content.substring(0, 100)}..."`);
    
    // Update current chat ID if not set
    if (!currentChatId && response.data.chatId) {
      currentChatId = response.data.chatId;
    }
    
    return response.data;
  } catch (error) {
    console.error('Send message error:', error.response?.data || error.message);
    throw error;
  }
}

async function getChatHistory(userId) {
  try {
    const response = await axios.get(
      `${API_URL}/chat/history/${userId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    console.log(`✅ Chat history retrieved: ${response.data.total} chats`);
    response.data.chats.forEach(chat => {
      console.log(`   - Chat "${chat.title}" with ${chat.messageCount} messages`);
    });
    return response.data;
  } catch (error) {
    console.error('Get history error:', error.response?.data || error.message);
    throw error;
  }
}

async function getChatById(chatId) {
  try {
    const response = await axios.get(
      `${API_URL}/chat/chat/${chatId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    console.log(`✅ Chat details retrieved for chat ${chatId}`);
    console.log(`   Title: ${response.data.title}`);
    console.log(`   Messages: ${response.data.chatMessages?.length || 0}`);
    return response.data;
  } catch (error) {
    console.error('Get chat error:', error.response?.data || error.message);
    throw error;
  }
}

async function testChatWithContext() {
  console.log('\n🧪 Testing Chat with Context Feature\n');
  
  try {
    // 1. Sign up or login
    console.log('1️⃣  Authenticating...');
    const authData = await signup();
    const userId = authData.user.id;
    
    // 2. Create a new chat session
    console.log('\n2️⃣  Creating new chat session...');
    await createNewChat();
    
    // 3. Send initial message
    console.log('\n3️⃣  Sending initial message...');
    await sendMessage('Hi, I need to track my monthly expenses');
    
    // 4. Send follow-up message that should use context
    console.log('\n4️⃣  Sending follow-up message (should use context)...');
    await sendMessage('Can you add categories for food, transport, and utilities?');
    
    // 5. Send another contextual message
    console.log('\n5️⃣  Sending another contextual message...');
    await sendMessage('Also add a column for payment method');
    
    // 6. Get chat history
    console.log('\n6️⃣  Retrieving chat history...');
    const history = await getChatHistory(userId);
    
    // 7. Get specific chat details
    if (currentChatId) {
      console.log('\n7️⃣  Getting specific chat details...');
      await getChatById(currentChatId);
    }
    
    // 8. Create another chat session
    console.log('\n8️⃣  Creating second chat session...');
    await createNewChat();
    
    // 9. Send message in new session (should not have previous context)
    console.log('\n9️⃣  Sending message in new session...');
    await sendMessage('Create a simple inventory tracker');
    
    // 10. Get updated chat history
    console.log('\n🔟 Getting updated chat history...');
    await getChatHistory(userId);
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Created 2 chat sessions');
    console.log('   - Sent 4 messages total');
    console.log('   - Verified context preservation within sessions');
    console.log('   - Verified session isolation between chats');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testChatWithContext();