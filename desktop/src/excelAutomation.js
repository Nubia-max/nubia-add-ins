const { exec } = require('child_process');
const fs = require('fs');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkExcelInstalled() {
  console.log('🔍 Checking if Excel is installed...');
  if (process.platform === 'darwin') {
    const excelExists = fs.existsSync('/Applications/Microsoft Excel.app');
    console.log(`📊 Excel installation status: ${excelExists ? '✅ Found' : '❌ Not found'}`);
    return excelExists;
  } else if (process.platform === 'win32') {
    // Assume Windows has Excel if we're in a business environment
    console.log('💻 Windows platform detected - assuming Excel is available');
    return true;
  }
  console.log('❓ Unknown platform - cannot verify Excel installation');
  return false;
}

async function openExcel() {
  console.log('🚀 OPENING EXCEL NOW...');
  
  if (!checkExcelInstalled()) {
    throw new Error('Microsoft Excel is not installed on this system');
  }
  
  if (process.platform === 'darwin') {
    // macOS - use AppleScript to open Excel
    const script = `
      tell application "Microsoft Excel"
        activate
        if not (exists workbook 1) then
          set newWorkbook to make new workbook
        end if
      end tell
    `;
    
    return new Promise((resolve, reject) => {
      applescript.execString(script, (err, result) => {
        if (err) {
          console.error('Error opening Excel:', err);
          // Fallback to command line
          exec('open -a "Microsoft Excel"', (error) => {
            if (error) {
              reject(new Error('Could not open Excel. Please ensure Microsoft Excel is installed.'));
            } else {
              setTimeout(resolve, 3000);
            }
          });
        } else {
          console.log('✅ Excel opened successfully via AppleScript!');
          resolve();
        }
      });
    });
  } else if (process.platform === 'win32') {
    // Windows
    return new Promise((resolve, reject) => {
      exec('start excel', (error) => {
        if (error) {
          reject(new Error('Could not open Excel. Please ensure Microsoft Excel is installed.'));
        } else {
          setTimeout(resolve, 3000);
        }
      });
    });
  } else {
    throw new Error('Excel automation is not supported on this platform');
  }
}

async function typeInExcel(text, pressEnter = true) {
  console.log(`⌨️ TYPING IN CELLS: "${text}"`);
  
  if (process.platform === 'darwin') {
    // Use AppleScript for Mac
    const escapedText = text.replace(/"/g, '\\"').replace(/'/g, "''");
    const script = `
      tell application "Microsoft Excel"
        activate
        set value of active cell to "${escapedText}"
        ${pressEnter ? 'tell application "System Events" to key code 36' : ''}
      end tell
    `;
    
    return new Promise((resolve, reject) => {
      applescript.execString(script, (err) => {
        if (err) {
          console.error('Error typing in Excel:', err);
          // Fallback to robotjs
          robot.typeString(text);
          if (pressEnter) {
            robot.keyTap('enter');
          }
        }
        resolve();
      });
    });
  } else {
    // Use robotjs for Windows
    await sleep(500);
    robot.typeString(text);
    if (pressEnter) {
      await sleep(200);
      robot.keyTap('enter');
      console.log('↩️ Pressed Enter');
    }
  }
}

async function pressTab() {
  if (process.platform === 'darwin') {
    // Use AppleScript for Mac
    const script = `
      tell application "System Events"
        tell process "Microsoft Excel"
          key code 48
        end tell
      end tell
    `;
    
    return new Promise((resolve) => {
      applescript.execString(script, (err) => {
        if (err) {
          // Fallback to robotjs
          robot.keyTap('tab');
        }
        resolve();
      });
    });
  } else {
    await sleep(200);
    robot.keyTap('tab');
  }
}

async function executeRealExcelTask(command, token, onProgress) {
  console.log('🎯 Processing Excel task via Nubia backend:', command);
  console.log('🔑 Token provided:', token ? `${token.substring(0, 10)}...` : 'NO TOKEN');
  
  try {
    if (onProgress) onProgress(0, 'Processing with Nubia AI...');
    
    // Check if token is provided
    if (!token) {
      console.error('❌ No authentication token provided');
      throw new Error('Please log in to use Excel automation');
    }
    
    // Call YOUR backend API, not OpenAI directly
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001';
    console.log('📡 Making request to:', `${backendUrl}/api/generate-excel`);
    console.log('📦 Request body:', { userInput: command });
    
    const response = await fetch(`${backendUrl}/api/generate-excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userInput: command
      })
    });
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.status === 429) {
      const data = await response.json();
      throw new Error(data.error || 'Usage limit exceeded. Please upgrade your subscription.');
    }
    
    if (!response.ok) {
      console.error('❌ Backend response not OK:', response.status, response.statusText);
      let errorData;
      try {
        errorData = await response.json();
        console.error('❌ Backend error details:', errorData);
      } catch (parseError) {
        console.error('❌ Failed to parse error response:', parseError);
        const textResponse = await response.text();
        console.error('❌ Raw error response:', textResponse);
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${textResponse}`);
      }
      throw new Error(errorData.error || `API call failed: ${response.statusText}`);
    }
    
    console.log('✅ Response OK, parsing JSON...');
    const result = await response.json();
    console.log('📊 Backend result:', JSON.stringify(result, null, 2));
    
    if (onProgress) onProgress(2, 'AI analysis complete...');
    
    if (result.success) {
      // Handle the response from the new API format
      if (onProgress) onProgress(3, 'Excel file created...');
      if (onProgress) onProgress(4, 'Excel workbook generated and opened!');
      
      return {
        success: true,
        message: `✅ Excel generated successfully: ${result.filename}`,
        data: {
          filename: result.filename,
          filepath: result.filepath,
          structure: result.structure,
          worksheets: result.worksheets || []
        }
      };
    } else {
      throw new Error(result.error || 'Excel generation failed');
    }
    
  } catch (error) {
    console.error('Excel generation error:', error);
    
    // Check if it's a subscription/limit error
    if (error.message.includes('limit exceeded') || error.message.includes('upgrade')) {
      // Trigger upgrade prompt in the UI
      if (window.showUpgradePrompt) {
        window.showUpgradePrompt();
      }
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Test function to verify Excel is accessible
async function testExcelConnection() {
  try {
    await openExcel();
    return { success: true, message: 'Excel is accessible' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

module.exports = { 
  executeRealExcelTask,
  testExcelConnection,
  openExcel
};