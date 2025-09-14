const bcrypt = require('bcrypt');

const hashPassword = async (password) => {
  try {
    console.log('Password utils: Hashing password...');
    console.log('Password utils: Password provided:', !!password);
    console.log('Password utils: Password length:', password ? password.length : 0);
    
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    console.log('Password utils: Password hashed successfully');
    console.log('Password utils: Hash length:', hashedPassword.length);
    console.log('Password utils: Hash starts with:', hashedPassword.substring(0, 10));
    
    return hashedPassword;
  } catch (error) {
    console.error('Password utils: Error hashing password:', error.message);
    throw new Error('Failed to hash password');
  }
};

const comparePassword = async (plainPassword, hashedPassword) => {
  try {
    console.log('Password utils: Comparing passwords...');
    console.log('Password utils: Plain password provided:', !!plainPassword);
    console.log('Password utils: Plain password length:', plainPassword ? plainPassword.length : 0);
    console.log('Password utils: Hashed password provided:', !!hashedPassword);
    console.log('Password utils: Hashed password length:', hashedPassword ? hashedPassword.length : 0);
    console.log('Password utils: Hashed password starts with:', hashedPassword ? hashedPassword.substring(0, 10) : 'N/A');
    
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    
    console.log('Password utils: Password comparison result:', isMatch);
    return isMatch;
  } catch (error) {
    console.error('Password utils: Error comparing passwords:', error.message);
    console.error('Password utils: Error details:', error);
    return false;
  }
};

module.exports = {
  hashPassword,
  comparePassword
};