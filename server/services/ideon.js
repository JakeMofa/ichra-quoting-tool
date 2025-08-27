// server/services/ideon.js
require('dotenv').config();
const axios = require('axios');

const IDEON_API_KEY = process.env.IDEON_API_KEY;
const IDEON_BASE_URL = 'https://api.ideonapi.com';

// Axios instance
const api = axios.create({
  baseURL: IDEON_BASE_URL,
  headers: {
    'Vericred-Api-Key': IDEON_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// Retry wrapper for rate limiting
async function requestWithRetry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (err) {
    const status = err.response?.status;
    if (status === 429 && retries > 0) {
      console.warn(`Rate limited. Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
      return requestWithRetry(fn, retries - 1, delay * 2);
    }
    console.error('Ideon API error:', err.response?.data || err.message);
    throw err;
  }
}

// === Service Methods ===

// 1. Create a Group
async function createGroup(groupData) {
  return requestWithRetry(() => api.post('/groups', groupData));
}

// 2. Add Members to a Group
async function addMember(groupId, memberData) {
  return requestWithRetry(() => api.post(`/groups/${groupId}/members`, memberData));
}

// 3. Calculate ICHRA Affordability
async function calculateICHRA(groupId, affordabilityData) {
  return requestWithRetry(() =>
    api.post(`/groups/${groupId}/ichra_affordability`, affordabilityData)
  );
}

module.exports = {
  createGroup,
  addMember,
  calculateICHRA
};
