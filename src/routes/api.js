const express = require('express');
const router = express.Router();
const googleMapsService = require('../services/googleMapsService');
const plateauService = require('../services/plateauService');

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

// PLATEAU API エンドポイント
router.post('/plateau/building', async (req, res) => {
  try {
    const { lat, lng, searchKeyword } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        status: 'error',
        message: '緯度・経度が指定されていません'
      });
    }

    console.log(`PLATEAU API呼び出し: lat=${lat}, lng=${lng}, keyword=${searchKeyword || 'なし'}`);

    const buildingData = await plateauService.getBuildingDataByCoordinates(lat, lng, searchKeyword);
    
    res.json({
      status: 'success',
      data: buildingData
    });
  } catch (error) {
    console.error('PLATEAU API error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      warning: 'PLATEAU配信サービスは試験運用中です。一時的に利用できない場合があります。'
    });
  }
});

router.get('/plateau/status', async (req, res) => {
  try {
    const status = await plateauService.checkApiStatus();
    
    res.json({
      status: 'success',
      data: status
    });
  } catch (error) {
    console.error('PLATEAU status check error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// PLATEAU 建物属性取得エンドポイント
router.post('/plateau/building-attributes', async (req, res) => {
  try {
    const { fileUrl, lat, lng, searchKeyword } = req.body;

    if (!fileUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'CityGMLファイルのURLが指定されていません'
      });
    }

    console.log(`PLATEAU 建物属性取得: fileUrl=${fileUrl}, keyword=${searchKeyword || 'なし'}`);

    // まず建物IDを取得
    const buildingIds = await plateauService.getBuildingIdsFromFile(fileUrl);
    
    if (buildingIds.length === 0) {
      return res.json({
        status: 'success',
        data: {
          buildings: [],
          message: '建物情報が見つかりませんでした'
        }
      });
    }

    // 建物属性を取得（バッチ処理の進捗情報も含む）
    const totalBatches = Math.ceil(buildingIds.length / 50);
    console.log(`建物属性を${totalBatches}バッチで取得開始`);
    
    const attributes = await plateauService.getBuildingAttributes(fileUrl, buildingIds);
    
    // キーワードでフィルタリング（座標が提供されている場合）
    let filteredBuildings = attributes;
    if (lat && lng && Array.isArray(attributes)) {
      console.log(`キーワード"${searchKeyword || ''}"でフィルタリング中...`);
      filteredBuildings = plateauService.filterBuildingsByKeyword(
        attributes, 
        searchKeyword || '', 
        lat, 
        lng
      );
      console.log(`フィルタリング完了: ${filteredBuildings.length}件が該当`);
    }
    
    res.json({
      status: 'success',
      data: {
        fileUrl: fileUrl,
        buildingCount: buildingIds.length,
        totalCount: Array.isArray(attributes) ? attributes.length : 0,
        filteredCount: Array.isArray(filteredBuildings) ? filteredBuildings.length : 0,
        buildings: filteredBuildings,
        searchKeyword: searchKeyword || null,
        batchInfo: {
          totalBatches: totalBatches,
          batchSize: 50,
          message: `${buildingIds.length}件の建物データを処理しました`
        },
        processInfo: {
          xmlParsed: true,
          batchesProcessed: totalBatches,
          filterApplied: (searchKeyword || lat || lng) ? true : false
        }
      }
    });
  } catch (error) {
    console.error('PLATEAU building attributes error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      warning: 'PLATEAU配信サービスは試験運用中です。一時的に利用できない場合があります。'
    });
  }
});

module.exports = router;