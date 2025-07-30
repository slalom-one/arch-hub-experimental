const axios = require('axios');

class GoogleMapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.geocodeBaseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    this.placeDetailsBaseUrl = 'https://maps.googleapis.com/maps/api/place/details/json';
  }

  validateApiKey() {
    if (!this.apiKey) {
      throw new Error('Google Maps API key is not configured. Please set GOOGLE_MAPS_API_KEY in your .env file');
    }
  }

  async geocodeAddress(address) {
    try {
      this.validateApiKey();

      console.log('Geocoding request:', {
        address: address,
        apiKeyConfigured: !!this.apiKey
      });

      const response = await axios.get(this.geocodeBaseUrl, {
        params: {
          address: address,
          key: this.apiKey,
          language: 'ja',
          region: 'jp',
          components: 'country:JP'  // 日本に限定して精度向上
        }
      });

      console.log('Geocoding response:', {
        status: response.data.status,
        error_message: response.data.error_message,
        results_count: response.data.results ? response.data.results.length : 0
      });

      if (response.data.status === 'ZERO_RESULTS') {
        throw new Error('住所が見つかりませんでした');
      }

      if (response.data.status !== 'OK') {
        const errorMessage = response.data.error_message || response.data.status;
        if (errorMessage.includes('not authorized')) {
          throw new Error(`Geocoding APIが有効化されていません。Google Cloud ConsoleでGeocoding APIを有効化してください。`);
        }
        throw new Error(`Geocoding API error: ${errorMessage}`);
      }

      const result = response.data.results[0];
      
      // location_typeをログに出力して精度を確認
      console.log('Geocoding location type:', result.geometry.location_type);
      
      return {
        formattedAddress: result.formatted_address,
        location: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        },
        locationType: result.geometry.location_type,  // 精度情報を追加
        placeId: result.place_id,
        addressComponents: result.address_components,
        types: result.types
      };
    } catch (error) {
      if (error.response) {
        throw new Error(`Google Maps API error: ${error.response.data.error_message || error.message}`);
      }
      throw error;
    }
  }

  async getPlaceDetails(placeId) {
    try {
      this.validateApiKey();

      const response = await axios.get(this.placeDetailsBaseUrl, {
        params: {
          place_id: placeId,
          key: this.apiKey,
          language: 'ja',
          fields: 'name,formatted_address,geometry,types,address_components,photos,rating,user_ratings_total'
        }
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Place Details API error: ${response.data.status}`);
      }

      return response.data.result;
    } catch (error) {
      if (error.response) {
        throw new Error(`Google Maps API error: ${error.response.data.error_message || error.message}`);
      }
      throw error;
    }
  }

  extractBuildingInfo(placeDetails) {
    const buildingInfo = {
      name: placeDetails.name || '不明',
      geometry: placeDetails.geometry,  // 座標情報を含める
      address: placeDetails.formatted_address || '不明',
      location: placeDetails.geometry?.location || null,
      types: placeDetails.types || [],
      rating: placeDetails.rating || null,
      totalRatings: placeDetails.user_ratings_total || 0
    };

    if (placeDetails.address_components) {
      const components = {};
      placeDetails.address_components.forEach(component => {
        component.types.forEach(type => {
          components[type] = component.long_name;
        });
      });
      buildingInfo.addressComponents = components;
    }

    return buildingInfo;
  }
}

module.exports = new GoogleMapsService();