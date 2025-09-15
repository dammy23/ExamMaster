const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

async function testUpload() {
  try {
    console.log('Testing CSV upload with new format...');
    
    // Test file path
    const testFile = path.join(__dirname, 'test_questions_new_format.csv');
    
    if (!fs.existsSync(testFile)) {
      throw new Error('Test CSV file not found');
    }
    
    console.log('Creating form data with test CSV file...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFile));
    
    // Make the upload request
    const response = await axios.post('http://localhost:3000/api/questions/bulk-upload', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': 'Bearer YOUR_TOKEN_HERE' // You'll need a valid token
      }
    });
    
    console.log('Upload successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Upload failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test if this is being executed directly
if (require.main === module) {
  testUpload();
}

module.exports = { testUpload };