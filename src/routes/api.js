const express = require('express');
const router = express.Router();
const googleMapsService = require('../services/googleMapsService');

router.post('/geocode', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        status: 'error',
        message: '住所が指定されていません'
      });
    }

    const geocodeResult = await googleMapsService.geocodeAddress(address);
    
    res.json({
      status: 'success',
      data: geocodeResult
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

router.get('/place/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;

    if (!placeId) {
      return res.status(400).json({
        status: 'error',
        message: 'Place IDが指定されていません'
      });
    }

    const placeDetails = await googleMapsService.getPlaceDetails(placeId);
    const buildingInfo = googleMapsService.extractBuildingInfo(placeDetails);
    
    res.json({
      status: 'success',
      data: buildingInfo
    });
  } catch (error) {
    console.error('Place details error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

router.get('/config', (req, res) => {
  const hasApiKey = !!process.env.GOOGLE_MAPS_API_KEY;
  
  res.json({
    status: 'success',
    data: {
      googleMapsApiConfigured: hasApiKey,
      apiKey: process.env.GOOGLE_MAPS_API_KEY || null
    }
  });
});

router.get('/test-api', async (req, res) => {
  try {
    const axios = require('axios');
    
    // Test different Google APIs
    const tests = [];
    
    // Test Geocoding API
    try {
      const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: '東京タワー',
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });
      tests.push({
        api: 'Geocoding API',
        status: geocodeResponse.data.status,
        error: geocodeResponse.data.error_message || null
      });
    } catch (error) {
      tests.push({
        api: 'Geocoding API',
        status: 'ERROR',
        error: error.message
      });
    }
    
    // Test Map Tiles API
    try {
      const tilesResponse = await axios.get(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${process.env.GOOGLE_MAPS_API_KEY}`);
      tests.push({
        api: 'Map Tiles API',
        status: 'OK',
        error: null
      });
    } catch (error) {
      tests.push({
        api: 'Map Tiles API',
        status: 'ERROR',
        error: error.response ? error.response.data.error.message : error.message
      });
    }
    
    res.json({
      status: 'success',
      data: {
        apiKeyLength: process.env.GOOGLE_MAPS_API_KEY ? process.env.GOOGLE_MAPS_API_KEY.length : 0,
        tests: tests
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;