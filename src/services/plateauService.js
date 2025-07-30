const axios = require('axios');

class PlateauService {
  constructor() {
    this.baseUrl = 'https://api.plateauview.mlit.go.jp';
    this.datacatalogUrl = `${this.baseUrl}/datacatalog`;
  }

  /**
   * 緯度経度からメッシュコードを計算
   * @param {number} lat - 緯度
   * @param {number} lng - 経度
   * @returns {Object} メッシュコード
   */
  latLngToMeshCode(lat, lng) {
    // 1次メッシュ（4桁）
    const lat1 = Math.floor(lat * 1.5);
    const lng1 = Math.floor(lng - 100);
    
    // 2次メッシュ（6桁）
    const lat_r = (lat * 1.5) - lat1;
    const lng_r = lng - 100 - lng1;
    const lat2 = Math.floor(lat_r * 8);
    const lng2 = Math.floor(lng_r * 8);
    
    // 3次メッシュ（8桁）
    const lat_r2 = (lat_r * 8) - lat2;
    const lng_r2 = (lng_r * 8) - lng2;
    const lat3 = Math.floor(lat_r2 * 10);
    const lng3 = Math.floor(lng_r2 * 10);
    
    return {
      mesh1: String(lat1).padStart(2, '0') + String(lng1).padStart(2, '0'),
      mesh2: String(lat1).padStart(2, '0') + String(lng1).padStart(2, '0') + lat2 + lng2,
      mesh3: String(lat1).padStart(2, '0') + String(lng1).padStart(2, '0') + lat2 + lng2 + lat3 + lng3
    };
  }

  /**
   * 緯度経度からPLATEAUの建物データを取得
   * @param {number} lat - 緯度
   * @param {number} lng - 経度
   * @param {string} searchKeyword - 検索キーワード（オプション）
   * @returns {Object} 建物データ
   */
  async getBuildingDataByCoordinates(lat, lng, searchKeyword = '') {
    try {
      console.log('PLATEAU API呼び出し:', {
        lat: lat,
        lng: lng,
        searchKeyword: searchKeyword
      });

      // Step 1: 座標からメッシュコードを計算
      const meshCodes = this.latLngToMeshCode(lat, lng);
      console.log('計算されたメッシュコード:', meshCodes);
      
      // メッシュコード情報をクライアントに返す
      this.currentMeshCodes = meshCodes;

      // Step 2: メッシュコードでCityGMLファイルを検索
      const citygmlData = await this.searchCityGMLFiles(meshCodes);
      
      if (!citygmlData || !citygmlData.cities || citygmlData.cities.length === 0) {
        console.log('No CityGML files found for the given coordinates');
        // エラーではなく、空のデータとして返す
        return {
          cities: [],
          files: [],
          attributes: null,
          metadata: {
            searchLocation: { lat, lng },
            meshCode: meshCodes.mesh3,
            timestamp: new Date().toISOString(),
            apiWarning: 'PLATEAU配信サービスは試験運用中です。該当エリアのデータが見つかりませんでした。'
          }
        };
      }

      console.log(`${citygmlData.cities.length}件の都市データが見つかりました`);
      
      // APIアクセス情報を保存
      this.lastApiUrl = citygmlData.apiUrl || null;

      // Step 3: 各都市のCityGMLファイルから建物データを取得
      const buildingFiles = [];
      for (const city of citygmlData.cities) {
        if (city.files && city.files.bldg) {
          // bldg (建物) ファイルのみを収集
          buildingFiles.push(...city.files.bldg.map(file => ({
            ...file,
            cityCode: city.cityCode,
            cityName: city.cityName,
            year: city.year
          })));
        }
      }

      console.log(`${buildingFiles.length}件の建物ファイルが見つかりました`);

      // Step 4: 建物ファイル情報を整形
      const buildingData = this.formatBuildingFiles(buildingFiles, meshCodes.mesh3);

      return {
        cities: citygmlData.cities.map(city => ({
          cityCode: city.cityCode,
          cityName: city.cityName,
          year: city.year
        })),
        files: buildingFiles,
        buildingData: buildingData,
        metadata: {
          searchLocation: { lat, lng },
          meshCode: meshCodes.mesh3,
          mesh3: meshCodes.mesh3,
          mesh2: meshCodes.mesh2,
          timestamp: new Date().toISOString(),
          apiUrl: this.lastSearchUrl,
          apiWarning: 'PLATEAU配信サービスは試験運用中です。APIは予告なく変更される可能性があります。'
        }
      };

    } catch (error) {
      console.error('PLATEAU API エラー:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw error;
    }
  }

  /**
   * メッシュコードからCityGMLファイルを検索
   * @param {Object} meshCodes - メッシュコードオブジェクト
   * @returns {Object} CityGMLファイルデータ
   */
  async searchCityGMLFiles(meshCodes) {
    try {
      // 3次メッシュコードによる検索（m:メッシュコード）
      const searchUrl = `${this.datacatalogUrl}/citygml/m:${meshCodes.mesh3}`;
      
      console.log('CityGMLファイル検索URL:', searchUrl);
      
      // API URLを保存
      this.lastSearchUrl = searchUrl;

      const response = await axios.get(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ArchHub-Experimental/1.0'
        },
        timeout: 30000 // 30秒のタイムアウト
      });

      console.log('PLATEAU API Response Status:', response.status);
      console.log('PLATEAU API Response Cities:', response.data.cities?.length || 0, 'cities found');

      // APIが成功した場合はデータを返す
      if (response.data && response.data.cities) {
        // 3次メッシュコードに該当する都市データを返す
        return {
          cities: response.data.cities,
          meshCode: meshCodes.mesh3,
          mesh3: meshCodes.mesh3,
          apiUrl: searchUrl
        };
      }

      return null;
    } catch (error) {
      if (error.response) {
        console.error('CityGML検索APIエラー:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
        
        if (error.response.status === 404) {
          return null; // データが見つからない場合はnullを返す
        }
      }
      throw new Error(`CityGMLファイルの検索に失敗しました: ${error.message}`);
    }
  }

  /**
   * CityGMLファイルから建物IDを取得
   * @param {string} fileUrl - CityGMLファイルのURL
   * @returns {Array} 建物IDのリスト
   */
  async getBuildingIdsFromFile(fileUrl) {
    try {
      console.log('CityGMLファイルから建物IDを取得:', fileUrl);
      
      // CityGMLファイルを取得
      const response = await axios.get(fileUrl, {
        headers: {
          'Accept': 'application/xml,text/xml',
          'User-Agent': 'ArchHub-Experimental/1.0'
        },
        timeout: 30000
      });

      // 簡易的なXML解析で建物IDを抽出
      const xmlText = response.data;
      const buildingIds = [];
      
      // gml:id属性を持つbldg:Building要素を検索
      const buildingMatches = xmlText.match(/<bldg:Building[^>]+gml:id="([^"]+)"/g) || [];
      
      for (const match of buildingMatches) {
        const idMatch = match.match(/gml:id="([^"]+)"/);
        if (idMatch && idMatch[1]) {
          const buildingId = idMatch[1];
          // BuildingInstallation IDを除外（建物本体のIDのみを取得）
          if (!buildingId.includes('_BuildingInstallation')) {
            buildingIds.push(buildingId);
          }
        }
      }
      
      console.log(`${buildingIds.length}件の建物IDを取得しました（BuildingInstallationを除外）`);
      return buildingIds; // 全ての建物IDを返す
      
    } catch (error) {
      console.error('建物ID取得エラー:', error.message);
      return [];
    }
  }

  /**
   * 建物属性を取得（バッチ処理対応）
   * @param {string} fileUrl - CityGMLファイルのURL
   * @param {Array} buildingIds - 建物IDのリスト
   * @returns {Object} 建物属性データ
   */
  async getBuildingAttributes(fileUrl, buildingIds) {
    try {
      if (!buildingIds || buildingIds.length === 0) {
        return {
          error: '建物IDが指定されていません',
          details: '対象となる建物が見つかりませんでした'
        };
      }

      const attributesUrl = `${this.baseUrl}/citygml/attributes`;
      const batchSize = 50; // 一度に処理する建物IDの数
      const allBuildings = [];
      
      console.log(`建物属性を取得します: 合計${buildingIds.length}件を${batchSize}件ずつ処理`);

      // バッチ処理
      for (let i = 0; i < buildingIds.length; i += batchSize) {
        const batchIds = buildingIds.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(buildingIds.length / batchSize);
        
        console.log(`バッチ ${batchNumber}/${totalBatches} を処理中... (${batchIds.length}件)`);

        try {
          const response = await axios.get(attributesUrl, {
            params: {
              url: fileUrl,
              id: batchIds.join(',')
            },
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'ArchHub-Experimental/1.0'
            },
            timeout: 30000
          });

          if (response.data && Array.isArray(response.data)) {
            const buildings = this.parseBuildingAttributesArray(response.data);
            allBuildings.push(...buildings);
            console.log(`バッチ ${batchNumber} 完了: ${buildings.length}件の建物属性を取得`);
          }
        } catch (batchError) {
          console.error(`バッチ ${batchNumber} エラー:`, batchError.message);
          // バッチエラーが発生しても続行
        }

        // APIレート制限を考慮して少し待機（最後のバッチ以外）
        if (i + batchSize < buildingIds.length) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 0.5秒待機
        }
      }
      
      console.log(`属性取得完了: 合計${allBuildings.length}件の建物属性を取得しました`);
      
      if (allBuildings.length > 0) {
        return allBuildings;
      }

      return {
        error: '建物属性の取得に失敗しました',
        details: 'すべてのバッチ処理でエラーが発生しました'
      };

    } catch (error) {
      console.error('建物属性取得エラー:', error.message);
      if (error.response) {
        console.error('エラーレスポンス:', error.response.data);
      }
      return {
        error: '建物属性の取得に失敗しました',
        details: error.message
      };
    }
  }

  /**
   * CityGML属性データの配列を解析
   * @param {Array} dataArray - 生のCityGML属性データの配列
   * @returns {Array} 整形された建物属性の配列
   */
  parseBuildingAttributesArray(dataArray) {
    const buildings = [];
    
    for (const data of dataArray) {
      const building = this.parseSingleBuildingAttributes(data);
      if (building) {
        buildings.push(building);
      }
    }
    
    return buildings;
  }

  /**
   * 単一の建物属性データを解析
   * @param {Object} data - 生のCityGML属性データ
   * @returns {Object} 整形された建物属性
   */
  parseSingleBuildingAttributes(data) {
    if (!data) {
      return null;
    }
    
    const building = {
      gmlId: data['gml:id'] || null,
      type: data._type || null,
      basic: {},
      architecture: {},
      urbanPlanning: {},
      location: {},
      detailedInfo: {}
    };

    // 基本情報
    building.basic.name = data['gml:name'] || null;
    // 住所（配列形式に対応）
    if (data['bldg:address']) {
      building.basic.address = Array.isArray(data['bldg:address']) 
        ? data['bldg:address'][0] 
        : data['bldg:address'];
    }
    // 用途（配列形式に対応）
    if (data['bldg:usage']) {
      building.basic.usage = Array.isArray(data['bldg:usage'])
        ? data['bldg:usage'].join('、')
        : data['bldg:usage'];
    }
    building.basic.usageCode = data['bldg:usage_code'] || null;
    building.basic.class = data['bldg:class'] || null;
    building.basic.classCode = data['bldg:class_code'] || null;
    building.basic.yearOfConstruction = data['bldg:yearOfConstruction'] || null;
    building.basic.creationDate = data['core:creationDate'] || null;
    
    // 建築情報
    building.architecture.measuredHeight = data['bldg:measuredHeight'] || null;
    building.architecture.storeysAboveGround = data['bldg:storeysAboveGround'] || null;
    building.architecture.storeysBelowGround = data['bldg:storeysBelowGround'] || null;
    building.architecture.roofType = data['bldg:roofType'] || null;
    
    // 都市計画情報（uro名前空間）- 配列形式に対応
    if (data['uro:buildingDetailAttribute']) {
      const detailArray = Array.isArray(data['uro:buildingDetailAttribute']) 
        ? data['uro:buildingDetailAttribute'] 
        : [data['uro:buildingDetailAttribute']];
      
      if (detailArray.length > 0) {
        const details = detailArray[0];
        building.urbanPlanning.totalFloorArea = details['uro:totalFloorArea'] || null;
        building.urbanPlanning.buildingFootprintArea = details['uro:buildingFootprintArea'] || null;
        building.urbanPlanning.buildingStructureType = details['uro:buildingStructureType'] || null;
        building.urbanPlanning.fireproofStructureType = details['uro:fireproofStructureType'] || null;
        
        // 新しい属性を追加
        building.urbanPlanning.areaClassificationType = details['uro:areaClassificationType'] || null;
        building.urbanPlanning.buildingRoofEdgeArea = details['uro:buildingRoofEdgeArea'] || null;
        building.urbanPlanning.detailedUsage = details['uro:detailedUsage'] || null;
        building.urbanPlanning.detailedUsageCode = details['uro:detailedUsage_code'] || null;
        building.urbanPlanning.districtsAndZonesType = details['uro:districtsAndZonesType'] || null;
        building.urbanPlanning.landUseType = details['uro:landUseType'] || null;
        building.urbanPlanning.specifiedBuildingCoverageRate = details['uro:specifiedBuildingCoverageRate'] || null;
        building.urbanPlanning.specifiedFloorAreaRate = details['uro:specifiedFloorAreaRate'] || null;
        building.urbanPlanning.surveyYear = details['uro:surveyYear'] || null;
        building.urbanPlanning.urbanPlanType = details['uro:urbanPlanType'] || null;
      }
    }
    // 旧形式の対応も残す
    else if (data['uro:BuildingDetailAttribute']) {
      const details = data['uro:BuildingDetailAttribute'];
      building.urbanPlanning.totalFloorArea = details['uro:totalFloorArea'] || null;
      building.urbanPlanning.buildingFootprintArea = details['uro:buildingFootprintArea'] || null;
      building.urbanPlanning.buildingStructureType = details['uro:buildingStructureType'] || null;
      building.urbanPlanning.fireproofStructureType = details['uro:fireproofStructureType'] || null;
    }
    
    // バウンディングボックス情報
    if (data._bbox) {
      building.location.bbox = data._bbox;
    }
    
    // 住所情報（配列形式に対応）
    if (data['uro:buildingIDAttribute']) {
      const idAttrArray = Array.isArray(data['uro:buildingIDAttribute'])
        ? data['uro:buildingIDAttribute']
        : [data['uro:buildingIDAttribute']];
      
      if (idAttrArray.length > 0) {
        const idAttr = idAttrArray[0];
        building.location.buildingID = idAttr['uro:buildingID'] || null;
        building.location.prefecture = idAttr['uro:prefecture'] || null;
        building.location.prefectureCode = idAttr['uro:prefecture_code'] || null;
        building.location.city = idAttr['uro:city'] || null;
        building.location.cityCode = idAttr['uro:city_code'] || null;
        building.location.town = idAttr['uro:town'] || null;
        building.location.branch = idAttr['uro:branch'] || null;
        
        // 完全な住所を構築
        const addressParts = [];
        if (idAttr['uro:prefecture']) addressParts.push(idAttr['uro:prefecture']);
        if (idAttr['uro:city']) addressParts.push(idAttr['uro:city']);
        if (idAttr['uro:town']) addressParts.push(idAttr['uro:town']);
        if (idAttr['uro:branch']) addressParts.push(idAttr['uro:branch']);
        if (addressParts.length > 0) {
          building.location.fullAddress = addressParts.join('');
        }
      }
    }
    // 旧形式の対応も残す
    else if (data['uro:BuildingIDAttribute']) {
      const idAttr = data['uro:BuildingIDAttribute'];
      if (idAttr['uro:prefecture']) building.location.prefecture = idAttr['uro:prefecture'];
      if (idAttr['uro:city']) building.location.city = idAttr['uro:city'];
      if (idAttr['uro:town']) building.location.town = idAttr['uro:town'];
      if (idAttr['uro:branch']) building.location.branch = idAttr['uro:branch'];
      
      // 完全な住所を構築
      const addressParts = [];
      if (idAttr['uro:prefecture']) addressParts.push(idAttr['uro:prefecture']);
      if (idAttr['uro:city']) addressParts.push(idAttr['uro:city']);
      if (idAttr['uro:town']) addressParts.push(idAttr['uro:town']);
      if (idAttr['uro:branch']) addressParts.push(idAttr['uro:branch']);
      if (addressParts.length > 0) {
        building.location.fullAddress = addressParts.join('');
      }
    }
    
    // gen:stringAttributeから追加情報を抽出
    if (data['gen:stringAttribute']) {
      const stringAttrs = Array.isArray(data['gen:stringAttribute']) 
        ? data['gen:stringAttribute'] 
        : [data['gen:stringAttribute']];
      
      building.additionalInfo = {};
      for (const attr of stringAttrs) {
        if (attr.name && attr.value) {
          // 建物名称は基本情報に設定
          if (attr.name === '建物名称') {
            building.basic.name = attr.value;
          }
          // その他の属性も保存
          building.additionalInfo[attr.name] = attr.value;
        }
      }
    }
    
    // gen:intAttributeから整数属性を抽出
    if (data['gen:intAttribute']) {
      const intAttrs = Array.isArray(data['gen:intAttribute'])
        ? data['gen:intAttribute']
        : [data['gen:intAttribute']];
      
      if (!building.additionalInfo) building.additionalInfo = {};
      for (const attr of intAttrs) {
        if (attr.name && attr.value !== undefined) {
          building.additionalInfo[attr.name] = attr.value;
        }
      }
    }
    
    // gen:measureAttributeから計測属性を抽出
    if (data['gen:measureAttribute']) {
      const measureAttrs = Array.isArray(data['gen:measureAttribute'])
        ? data['gen:measureAttribute']
        : [data['gen:measureAttribute']];
      
      if (!building.additionalInfo) building.additionalInfo = {};
      for (const attr of measureAttrs) {
        if (attr.name && attr.value !== undefined) {
          building.additionalInfo[attr.name] = attr.value;
        }
      }
    }
    
    // gen:genericAttributeから汎用属性を抽出（新しい形式）
    if (data['gen:genericAttribute']) {
      const genericAttrs = Array.isArray(data['gen:genericAttribute'])
        ? data['gen:genericAttribute']
        : [data['gen:genericAttribute']];
      
      if (!building.additionalInfo) building.additionalInfo = {};
      for (const attr of genericAttrs) {
        if (attr.name && attr.value !== undefined) {
          building.additionalInfo[attr.name] = attr.value;
        }
      }
    }
    
    return building;
  }

  /**
   * 属性値を抽出するヘルパー関数
   */
  extractAttribute(attributes, namespace, key) {
    if (attributes[namespace] && Array.isArray(attributes[namespace])) {
      const attr = attributes[namespace].find(item => item.name === key);
      return attr ? attr.value : null;
    }
    return null;
  }

  /**
   * ネストされた属性値を抽出するヘルパー関数
   */
  extractNestedAttribute(attributes, namespace, key) {
    if (attributes[namespace] && attributes[namespace][key]) {
      return attributes[namespace][key];
    }
    return null;
  }

  /**
   * 建物ファイル情報を整形
   * @param {Array} buildingFiles - 建物ファイルのリスト
   * @param {string} mesh3 - 3次メッシュコード
   * @returns {Object} 整形された建物情報
   */
  formatBuildingFiles(buildingFiles, mesh3) {
    // 3次メッシュコードに一致するファイルを探す
    const targetFile = buildingFiles.find(file => file.code === mesh3);
    
    if (targetFile) {
      console.log(`3次メッシュ ${mesh3} に一致するCityGMLファイルが見つかりました`);
      return {
        meshCodeMatch: '3次メッシュ',
        targetFile: targetFile,
        message: '指定された座標の詳細な建物情報が利用可能です'
      };
    }
    
    // 2次メッシュコードで検索
    const mesh2Files = buildingFiles.filter(file => file.code.startsWith(mesh3.substring(0, 6)));
    if (mesh2Files.length > 0) {
      console.log(`2次メッシュコードで${mesh2Files.length}件のファイルが見つかりました`);
      return {
        meshCodeMatch: '2次メッシュ',
        targetFiles: mesh2Files,
        message: '指定された座標の周辺エリアの建物情報が利用可能です'
      };
    }
    
    return {
      meshCodeMatch: 'なし',
      message: '指定された座標の詳細な建物情報は見つかりませんでした'
    };
  }

  /**
   * PLATEAU APIの状態を確認
   * @returns {Object} API状態
   */
  async checkApiStatus() {
    try {
      const testLat = 35.6762;
      const testLng = 139.6503;
      const meshCodes = this.latLngToMeshCode(testLat, testLng);
      const searchUrl = `${this.datacatalogUrl}/citygml/m:${meshCodes.mesh2}`;
      
      const response = await axios.get(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ArchHub-Experimental/1.0'
        },
        timeout: 10000
      });

      return {
        status: 'available',
        message: 'PLATEAU APIは正常に動作しています',
        responseTime: response.headers['x-response-time'] || 'N/A',
        warning: 'PLATEAU配信サービスは試験運用中です'
      };

    } catch (error) {
      return {
        status: 'error',
        message: 'PLATEAU APIに接続できませんでした',
        error: error.message,
        warning: 'PLATEAU配信サービスは試験運用中のため、一時的に利用できない場合があります'
      };
    }
  }

  /**
   * 2点間の距離を計算（ハバーサイン公式）
   * @param {number} lat1 - 地点1の緯度
   * @param {number} lng1 - 地点1の経度
   * @param {number} lat2 - 地点2の緯度
   * @param {number} lng2 - 地点2の経度
   * @returns {number} 距離（メートル）
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 地球の半径（メートル）
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * 建物をキーワードでフィルタリング
   * @param {Array} buildings - 建物の配列
   * @param {string} keyword - 検索キーワード
   * @param {number} targetLat - 検索地点の緯度
   * @param {number} targetLng - 検索地点の経度
   * @returns {Array} フィルタリング・ソートされた建物の配列
   */
  filterBuildingsByKeyword(buildings, keyword, targetLat, targetLng) {
    if (!buildings || buildings.length === 0) {
      return [];
    }

    // 各建物にマッチ情報と距離を追加
    const processedBuildings = buildings.map(building => {
      const result = {
        ...building,
        matchInfo: {
          keyword: false,
          matchType: null,
          distance: null
        }
      };

      // 距離計算（バウンディングボックスの中心座標を使用）
      if (building.location && building.location.bbox && building.location.bbox.center) {
        const center = building.location.bbox.center;
        result.matchInfo.distance = this.calculateDistance(
          targetLat, targetLng, 
          center.lat, center.lng
        );
      }

      // キーワードマッチング（キーワードが指定されている場合）
      if (keyword && keyword.trim()) {
        const lowerKeyword = keyword.toLowerCase();
        
        // 建物名でマッチ
        if (building.basic && building.basic.name) {
          if (building.basic.name.toLowerCase().includes(lowerKeyword)) {
            result.matchInfo.keyword = true;
            result.matchInfo.matchType = 'name';
          }
        }

        // 住所でマッチ（cityやbranchを確認）
        if (!result.matchInfo.keyword && building.location) {
          if (building.location.city && building.location.city.includes(keyword)) {
            result.matchInfo.keyword = true;
            result.matchInfo.matchType = 'address';
          } else if (building.location.branch && building.location.branch.includes(keyword)) {
            result.matchInfo.keyword = true;
            result.matchInfo.matchType = 'address';
          }
        }
      }

      return result;
    });

    // ソート（キーワードマッチを優先、次に距離でソート）
    processedBuildings.sort((a, b) => {
      // キーワードマッチしたものを優先
      if (keyword && a.matchInfo.keyword !== b.matchInfo.keyword) {
        return a.matchInfo.keyword ? -1 : 1;
      }
      
      // 距離でソート（近い順）
      if (a.matchInfo.distance !== null && b.matchInfo.distance !== null) {
        return a.matchInfo.distance - b.matchInfo.distance;
      }
      
      return 0;
    });

    return processedBuildings;
  }
}

module.exports = new PlateauService();