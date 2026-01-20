// API configuration
// For local development: http://localhost:3000
// For production: your Coolify URL
const API_BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://your-coolify-domain.com'; // Replace with your Coolify URL after deployment

export async function analyzeImage(base64Image) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Analyze API error:', error);
    throw error;
  }
}

export async function searchProducts(query, barcode = null) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, barcode }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Search API error:', error);
    throw error;
  }
}

export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return await response.json();
  } catch (error) {
    console.error('Health check error:', error);
    return { status: 'error', error: error.message };
  }
}

export function setApiBaseUrl(url) {
  // For dynamic URL configuration if needed
  console.log('API URL configured:', url);
}
