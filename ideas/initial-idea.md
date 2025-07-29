Google Maps APIとPLATEAU配信サービスのCityGML属性APIを連携させて建物情報を取得する流れを整理します。Google Maps APIとPLATEAU配信サービスのAPIを連携させて建物情報を取得する流れを整理します。

## 📐 Google Maps API → PLATEAU CityGML属性API 連携フロー

### 1. **Google Maps APIで建物位置を特定**

```javascript
// Step 1: ユーザーが建物名を入力
const buildingName = "ANAクラウンプラザホテル大阪";

// Step 2: Google Geocoding APIで緯度経度を取得
const geocoder = new google.maps.Geocoder();

geocoder.geocode({ 
    address: buildingName + " 日本",
    region: 'JP'
}, (results, status) => {
    if (status === 'OK' && results[0]) {
        const location = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
            formatted_address: results[0].formatted_address
        };
        
        // 次のステップへ
        fetchPlateauBuildingInfo(location);
    }
});
```

### 2. **PLATEAU配信サービスAPIへのリクエスト**

PLATEAU配信サービスではPLATEAU VIEWで利用されている各種データセットを無償で利用可能です。現在、PLATEAU配信サービスは以下のエンドポイントを提供しています：

```javascript
// Step 3: PLATEAU APIで建物情報を取得
async function fetchPlateauBuildingInfo(location) {
    // データカタログAPIのエンドポイント
    const catalogApiUrl = 'https://api.plateau.reearth.io/datacatalog';
    
    try {
        // 1. まず該当エリアのCityGMLデータセットを検索
        const datasetResponse = await fetch(`${catalogApiUrl}/datasets?bbox=${location.lng-0.001},${location.lat-0.001},${location.lng+0.001},${location.lat+0.001}`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        const datasets = await datasetResponse.json();
        
        // 2. 該当する建物データを取得
        const buildingDataUrl = datasets.items.find(item => 
            item.type === 'bldg' && item.format === 'citygml'
        )?.url;
        
        if (buildingDataUrl) {
            // 3. CityGML属性データを取得
            const attributeResponse = await fetch(`${buildingDataUrl}/attributes?lat=${location.lat}&lng=${location.lng}`, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            const buildingAttributes = await attributeResponse.json();
            return parsePlateauAttributes(buildingAttributes);
        }
    } catch (error) {
        console.error('PLATEAU API Error:', error);
    }
}
```

### 3. **CityGML属性データの解析**

CityGMLの属性情報にはPLATEAUの標準仕様として定義されているものと、都市ごとに定義されているものがあります：

```javascript
// Step 4: PLATEAU属性データを解析
function parsePlateauAttributes(data) {
    return {
        // 基本情報（gen名前空間）
        basic: {
            gmlId: data.gmlId,
            name: data.attributes['gen:stringAttribute']?.['建物名称'],
            usage: data.attributes['bldg:usage'],
            class: data.attributes['bldg:class'],
            yearOfConstruction: data.attributes['bldg:yearOfConstruction']
        },
        
        // 建築情報（bldg名前空間）
        architecture: {
            measuredHeight: data.attributes['bldg:measuredHeight']?.value,
            storeysAboveGround: data.attributes['bldg:storeysAboveGround'],
            storeysBelowGround: data.attributes['bldg:storeysBelowGround'],
            roofType: data.attributes['bldg:roofType']
        },
        
        // 都市計画情報（uro名前空間）
        urbanPlanning: {
            buildingFootprintArea: data.attributes['uro:buildingDataQualityAttribute']?.['uro:buildingFootprintArea'],
            totalFloorArea: data.attributes['uro:BuildingDetails']?.['uro:totalFloorArea'],
            buildingStructureType: data.attributes['uro:BuildingDetails']?.['uro:buildingStructureType'],
            fireproofStructureType: data.attributes['uro:BuildingDetails']?.['uro:fireproofStructureType']
        },
        
        // 位置情報
        location: {
            coordinates: data.geometry.coordinates,
            address: data.attributes['xAL:LocalityName'] || data.attributes['bldg:address']
        }
    };
}
```

### 4. **完全な実装例**

```javascript
class PlateauBuildingService {
    constructor(googleMapsApiKey) {
        this.googleMapsApiKey = googleMapsApiKey;
        this.plateauApiBase = 'https://api.plateau.reearth.io';
    }
    
    // 建物名から完全な情報を取得
    async getBuildingInfo(buildingName) {
        try {
            // 1. Google Maps APIで位置を特定
            const location = await this.geocodeBuilding(buildingName);
            
            // 2. PLATEAU APIで詳細情報を取得
            const plateauData = await this.fetchPlateauData(location);
            
            // 3. データを統合
            return {
                source: {
                    google: location,
                    plateau: plateauData
                },
                display: this.formatDisplayData(location, plateauData)
            };
            
        } catch (error) {
            console.error('建物情報取得エラー:', error);
            throw error;
        }
    }
    
    // Geocoding処理
    async geocodeBuilding(buildingName) {
        return new Promise((resolve, reject) => {
            const geocoder = new google.maps.Geocoder();
            
            geocoder.geocode({
                address: buildingName + ' 日本',
                region: 'JP'
            }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    resolve({
                        name: buildingName,
                        lat: results[0].geometry.location.lat(),
                        lng: results[0].geometry.location.lng(),
                        formattedAddress: results[0].formatted_address,
                        placeId: results[0].place_id
                    });
                } else {
                    reject(new Error('Geocoding failed: ' + status));
                }
            });
        });
    }
    
    // PLATEAU データ取得
    async fetchPlateauData(location) {
        // メッシュコードを計算（簡略版）
        const meshCode = this.calculateMeshCode(location.lat, location.lng);
        
        const url = `${this.plateauApiBase}/citygml/buildings`;
        const params = new URLSearchParams({
            lat: location.lat,
            lng: location.lng,
            meshCode: meshCode,
            lod: 2  // LOD2データを要求
        });
        
        const response = await fetch(`${url}?${params}`, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('PLATEAU API request failed');
        }
        
        const data = await response.json();
        return this.parseCityGMLAttributes(data);
    }
    
    // CityGML属性を解析
    parseCityGMLAttributes(data) {
        const attributes = data.cityObject?.attributes || {};
        
        return {
            id: data.gmlId,
            name: attributes['gen:stringAttribute']?.find(attr => 
                attr.name === '建物名称'
            )?.value,
            usage: attributes['bldg:usage'],
            yearBuilt: attributes['bldg:yearOfConstruction'],
            height: attributes['bldg:measuredHeight'],
            floors: {
                above: attributes['bldg:storeysAboveGround'],
                below: attributes['bldg:storeysBelowGround']
            },
            area: {
                building: attributes['uro:buildingFootprintArea'],
                total: attributes['uro:totalFloorArea']
            },
            structure: attributes['uro:buildingStructureType']
        };
    }
    
    // メッシュコード計算（簡略版）
    calculateMeshCode(lat, lng) {
        // 実際の実装では正確なメッシュコード計算が必要
        const latIndex = Math.floor(lat * 1.5);
        const lngIndex = Math.floor((lng - 100) * 1);
        return `${latIndex}${lngIndex}`;
    }
    
    // 表示用データ整形
    formatDisplayData(googleData, plateauData) {
        return {
            基本情報: {
                建物名: plateauData.name || googleData.name,
                住所: googleData.formattedAddress,
                用途: plateauData.usage || '不明',
                建築年: plateauData.yearBuilt || '不明'
            },
            建築詳細: {
                階数: plateauData.floors.above ? 
                    `地上${plateauData.floors.above}階` + 
                    (plateauData.floors.below ? `・地下${plateauData.floors.below}階` : '') 
                    : '不明',
                高さ: plateauData.height ? `${plateauData.height}m` : '不明',
                建築面積: plateauData.area.building ? `${plateauData.area.building}㎡` : '不明',
                延床面積: plateauData.area.total ? `${plateauData.area.total}㎡` : '不明'
            },
            位置情報: {
                緯度: googleData.lat.toFixed(6),
                経度: googleData.lng.toFixed(6),
                GoogleプレイスID: googleData.placeId
            }
        };
    }
}

// 使用例
const service = new PlateauBuildingService('YOUR_GOOGLE_MAPS_API_KEY');

service.getBuildingInfo('ANAクラウンプラザホテル大阪')
    .then(info => {
        console.log('建物情報:', info.display);
    })
    .catch(error => {
        console.error('エラー:', error);
    });
```

### 5. **API連携の注意点**

1. **座標系の変換**
   - WGS84 と JGD2011 はほぼ誤差がなく同一のものとして扱えます
   - ただし高度情報は楕円体高と標高の違いに注意

2. **データの粒度**
   - PLATEAUデータは地域メッシュ単位で管理
   - 建物が複数のメッシュにまたがる場合の考慮が必要

3. **APIレート制限**
   - 両APIのレート制限を考慮した実装
   - キャッシュ機構の実装推奨

4. **エラーハンドリング**
   - 建物が見つからない場合
   - PLATEAU データが未整備の地域
   - ネットワークエラー

この流れにより、ユーザーが入力した建物名から、Google Maps APIで位置を特定し、その位置情報を使ってPLATEAU配信サービスから詳細な建物属性情報を取得できます。