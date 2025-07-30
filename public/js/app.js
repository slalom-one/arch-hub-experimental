let map;
let marker;
let autocomplete;
let currentPlaceId = null;
let currentPlaceName = null;
let currentPlaceAddress = null;
let orbitAnimation = null;  // 回転アニメーションの参照

// 建物タイプごとの推定高さ（メートル）
const BUILDING_HEIGHT_CONFIG = {
    // 高層建築物
    'lodging': { height: 50, cameraHeight: 800 },           // ホテル（平均的な高さ）
    'skyscraper': { height: 200, cameraHeight: 1500 },      // 超高層ビル
    'office': { height: 80, cameraHeight: 1000 },           // オフィスビル
    
    // 中層建築物
    'hospital': { height: 40, cameraHeight: 600 },          // 病院
    'school': { height: 20, cameraHeight: 400 },            // 学校
    'shopping_mall': { height: 25, cameraHeight: 500 },     // ショッピングモール
    'department_store': { height: 35, cameraHeight: 600 },  // デパート
    
    // 低層建築物
    'restaurant': { height: 8, cameraHeight: 200 },         // レストラン
    'store': { height: 8, cameraHeight: 200 },              // 店舗
    'convenience_store': { height: 6, cameraHeight: 150 },  // コンビニ
    'bank': { height: 15, cameraHeight: 300 },              // 銀行
    
    // 特殊建築物
    'train_station': { height: 30, cameraHeight: 500 },     // 駅
    'airport': { height: 25, cameraHeight: 600 },           // 空港
    'stadium': { height: 50, cameraHeight: 800 },           // スタジアム
    'museum': { height: 20, cameraHeight: 400 },            // 博物館
    'church': { height: 30, cameraHeight: 500 },            // 教会
    'temple': { height: 15, cameraHeight: 300 },            // 寺院
    'shrine': { height: 10, cameraHeight: 250 },            // 神社
    
    // デフォルト
    'default': { height: 20, cameraHeight: 400 }
};

document.addEventListener('DOMContentLoaded', () => {
    initializeConsole();
    logToConsole('アプリケーションを初期化しています...', 'info');
    checkApiConfiguration();
    initializeEventListeners();
    loadGoogleMapsAPI();
    initializeCesiumEventHandlers();
});

function initializeConsole() {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleInfo = console.info;
    const originalConsoleWarn = console.warn;

    console.log = function(...args) {
        originalConsoleLog.apply(console, args);
        logToConsole(args.join(' '), 'log');
    };

    console.error = function(...args) {
        originalConsoleError.apply(console, args);
        logToConsole(args.join(' '), 'error');
    };

    console.info = function(...args) {
        originalConsoleInfo.apply(console, args);
        logToConsole(args.join(' '), 'info');
    };

    console.warn = function(...args) {
        originalConsoleWarn.apply(console, args);
        logToConsole(args.join(' '), 'warn');
    };
}

function logToConsole(message, type = 'log') {
    const consoleContent = document.getElementById('consoleContent');
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    const logEntry = document.createElement('div');
    logEntry.className = `console-${type}`;
    logEntry.innerHTML = `<span class="console-timestamp">[${timestamp}]</span> ${escapeHtml(message)}`;
    consoleContent.appendChild(logEntry);
    consoleContent.scrollTop = consoleContent.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function checkApiConfiguration() {
    console.info('API設定を確認しています...');
    fetch('/api/config')
        .then(response => response.json())
        .then(data => {
            console.log('API設定レスポンス:', {
                ...data,
                data: {
                    ...data.data,
                    apiKey: data.data.apiKey ? '***HIDDEN***' : null
                }
            });
            const statusElement = document.getElementById('googleMapsStatus');
            if (data.data.googleMapsApiConfigured) {
                if (data.data.apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
                    statusElement.textContent = 'サンプルキーのまま';
                    statusElement.className = 'status-value status-error';
                    console.warn('APIキーがサンプルのままです。実際のAPIキーに変更してください。');
                    showError('APIキーがサンプルのままです。.envファイルに実際のAPIキーを設定してください。');
                } else {
                    statusElement.textContent = '設定済み';
                    statusElement.className = 'status-value status-ok';
                    console.info('Google Maps APIキーが設定されています');
                }
            } else {
                statusElement.textContent = 'APIキーが設定されていません';
                statusElement.className = 'status-value status-error';
                showError('Google Maps APIキーが設定されていません。.envファイルを確認してください。');
            }
        })
        .catch(error => {
            console.error('API configuration check failed:', error);
            document.getElementById('googleMapsStatus').textContent = 'エラー';
        });
}

function initializeEventListeners() {
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    const clearConsoleBtn = document.getElementById('clearConsole');

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    clearConsoleBtn.addEventListener('click', () => {
        document.getElementById('consoleContent').innerHTML = '';
        logToConsole('コンソールをクリアしました', 'info');
    });

    console.info('イベントリスナーを設定しました');
}

function loadGoogleMapsAPI() {
    fetch('/api/config')
        .then(response => response.json())
        .then(data => {
            if (data.data.googleMapsApiConfigured && data.data.apiKey) {
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${data.data.apiKey}&libraries=places&callback=initMap&language=ja&region=JP&v=beta&loading=async`;
                script.async = true;
                script.defer = true;
                script.onerror = () => {
                    showError('Google Maps APIの読み込みに失敗しました。APIキーを確認してください。');
                };
                document.head.appendChild(script);
            } else {
                showError('Google Maps APIキーが設定されていません。');
            }
        })
        .catch(error => {
            console.error('Failed to load Google Maps API:', error);
            showError('Google Maps APIの設定の取得に失敗しました。');
        });
}

window.initMap = async function() {
    const defaultLocation = { lat: 35.6762, lng: 139.6503 };
    
    try {
        console.info('Maps APIを初期化しています...');
        
        // Cesiumを使用した3D Tilesの初期化
        initializeCesium3DTiles(defaultLocation);
        
        // 自動補完の初期化
        initializeAutocomplete();
        
    } catch (error) {
        console.error('Maps API初期化エラー:', error);
    }
};

async function initializeCesium3DTiles(defaultLocation) {
    console.info('Cesium 3D Tilesを初期化しています...');
    console.info('Cesiumバージョン:', window.Cesium ? Cesium.VERSION : 'Cesium未読み込み');
    
    if (!window.Cesium || !window.Cesium.Cesium3DTileset) {
        console.error('Cesiumが正しく読み込まれていません');
        return;
    }
    
    // パフォーマンス最適化: 同時リクエスト数を増やす
    Cesium.RequestScheduler.requestsByServer["tile.googleapis.com:443"] = 18;
    
    const mapContainer = document.getElementById('map');
    mapContainer.innerHTML = '';
    
    try {
        // APIキーを取得
        const response = await fetch('/api/config');
        const data = await response.json();
        
        if (data.data.apiKey) {
                // Cesiumのトークンを設定（オプション）
                Cesium.Ion.defaultAccessToken = undefined;
                
                // Cesium Viewerを作成
                window.cesiumViewer = new Cesium.Viewer('map', {
                    imageryProvider: false,
                    baseLayerPicker: false,
                    requestRenderMode: false,
                    shadows: false,
                    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
                    geocoder: false,
                    homeButton: false,
                    sceneModePicker: false,
                    navigationHelpButton: false,
                    animation: false,
                    timeline: false,
                    fullscreenButton: false,
                    scene3DOnly: true,
                    contextOptions: {
                        requestWebgl2: true
                    }
                });
                
                // 地球を非表示
                window.cesiumViewer.scene.globe.show = false;
                
                // 背景色を設定
                window.cesiumViewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#87CEEB');
                
                // Google Photorealistic 3D Tilesを追加
                console.log('3D Tiles URLを設定中...');
                console.log('APIキー長:', data.data.apiKey.length);
                
                try {
                    // 直接URLを使用してGoogle 3D Tilesを追加
                    const tilesetUrl = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${data.data.apiKey}`;
                    
                    console.log('3D Tiles URLを生成:', tilesetUrl);
                    
                    // 新しいfromUrl()メソッドを使用してCesium3DTilesetを作成
                    console.log('fromUrl()メソッドで3D Tilesetを作成中...');
                    const tileset = await Cesium.Cesium3DTileset.fromUrl(
                        tilesetUrl,
                        {
                            showCreditsOnScreen: true
                        }
                    );
                    
                    console.info('3D Tilesetを作成しました');
                    
                    // シーンに追加
                    window.cesiumViewer.scene.primitives.add(tileset);
                    
                    console.info('3D Tilesをシーンに追加しました');
                    
                    // タイルセットの境界を取得してカメラをズーム
                    await window.cesiumViewer.zoomTo(tileset);
                    
                    console.info('カメラをタイルセットにズームしました');
                    
                    window.cesium3DTileset = tileset;
                    
                } catch (error) {
                    console.error('3D Tileset作成エラー:', error);
                    console.error('詳細:', error.message);
                    console.error('スタック:', error.stack);
                }
                
                // デフォルトの位置に移動（東京の全体が見える高さ）
                const defaultLocation3D = window.cesiumViewer.entities.add({
                    position: Cesium.Cartesian3.fromDegrees(defaultLocation.lng, defaultLocation.lat),
                    point: {
                        pixelSize: 0,  // 見えないポイント
                        color: Cesium.Color.TRANSPARENT
                    }
                });
                
                window.cesiumViewer.flyTo(defaultLocation3D, {
                    duration: 0,  // 即座に移動
                    offset: new Cesium.HeadingPitchRange(
                        Cesium.Math.toRadians(0),      // heading
                        Cesium.Math.toRadians(-45),    // pitch
                        10000                          // 10kmの高さ
                    )
                });
                
                console.info('Cesium 3D Tilesを初期化しました');
        }
    } catch (error) {
        console.error('Cesium初期化エラー:', error);
    }
}

function initializeGoogleMaps(defaultLocation) {
    console.info('通常のGoogle Mapsを初期化しています...');
    
    map = new google.maps.Map(document.getElementById('map'), {
        center: defaultLocation,
        zoom: 17,
        mapTypeId: 'hybrid',
        tilt: 45,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true
    });
    
    window.isGoogleMaps = true;
}

function initializeAutocomplete() {
    const input = document.getElementById('searchInput');
    
    autocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'jp' },
        fields: ['place_id', 'geometry', 'formatted_address', 'name', 'types'],
        types: ['establishment', 'geocode']
    });

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
            updateMapWithPlace(place);
        }
    });
}

async function performSearch() {
    const address = document.getElementById('searchInput').value.trim();
    
    if (!address) {
        showError('住所または建物名を入力してください');
        return;
    }

    // 新しい検索時は既存のアニメーションを停止
    stopOrbitAnimation();

    console.info(`検索を開始: "${address}"`);
    clearError();
    showLoading(true);

    try {
        console.log('Geocoding APIを呼び出しています...');
        const response = await fetch('/api/geocode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ address })
        });

        console.log(`レスポンスステータス: ${response.status}`);
        const data = await response.json();
        console.log('Geocoding APIレスポンス:', JSON.stringify(data, null, 2));

        if (data.status === 'error') {
            throw new Error(data.message);
        }

        const geocodeData = data.data;
        currentPlaceId = geocodeData.placeId;
        currentPlaceAddress = geocodeData.formattedAddress;

        console.info(`Place ID: ${currentPlaceId}`);
        console.info(`座標: ${geocodeData.location.lat}, ${geocodeData.location.lng}`);
        console.info(`位置精度: ${geocodeData.locationType || '不明'}`);

        // typesを取得（geocodeDataから）
        const types = geocodeData.types || [];
        
        // 精度が低い場合は警告を表示
        if (geocodeData.locationType && geocodeData.locationType !== 'ROOFTOP') {
            console.warn(`位置精度が建物レベルではありません: ${geocodeData.locationType}`);
        }
        
        updateMap(geocodeData.location, null, geocodeData.formattedAddress, types);
        displayBasicInfo(geocodeData);

        if (currentPlaceId) {
            fetchPlaceDetails(currentPlaceId);
        }

        document.getElementById('infoSection').style.display = 'block';

    } catch (error) {
        console.error('検索エラー:', error.message);
        showError(error.message || '検索中にエラーが発生しました');
    } finally {
        showLoading(false);
    }
}

function updateMapWithPlace(place) {
    if (!place.geometry || !place.geometry.location) {
        showError('場所の情報を取得できませんでした');
        return;
    }

    const location = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
    };

    currentPlaceId = place.place_id;
    currentPlaceName = place.name || null;
    currentPlaceAddress = place.formatted_address;
    
    // Autocompleteの結果は通常より精度が高い
    console.info('Autocompleteから選択された場所を使用（高精度）');
    
    const types = place.types || [];
    updateMap(location, place.name, place.formatted_address, types);
    
    displayBasicInfo({
        formattedAddress: place.formatted_address,
        location: location,
        placeId: place.place_id,
        types: types,
        locationType: 'AUTOCOMPLETE'  // Autocompleteからの結果を示す
    });

    if (place.place_id) {
        fetchPlaceDetails(place.place_id);
    }

    document.getElementById('infoSection').style.display = 'block';
}

function estimateBuildingHeight(types) {
    if (!types || types.length === 0) {
        return BUILDING_HEIGHT_CONFIG.default;
    }
    
    // 建物タイプから該当する設定を探す
    for (const type of types) {
        if (BUILDING_HEIGHT_CONFIG[type]) {
            console.info(`建物タイプ '${type}' から高さを推定: ${BUILDING_HEIGHT_CONFIG[type].height}m`);
            return BUILDING_HEIGHT_CONFIG[type];
        }
    }
    
    // 特定のキーワードを含む場合の判定
    for (const type of types) {
        if (type.includes('hotel') || type.includes('lodging')) {
            console.info(`建物タイプ '${type}' をホテルとして判定`);
            return BUILDING_HEIGHT_CONFIG.lodging;
        }
        if (type.includes('office')) {
            console.info(`建物タイプ '${type}' をオフィスビルとして判定`);
            return BUILDING_HEIGHT_CONFIG.office;
        }
        if (type.includes('station')) {
            console.info(`建物タイプ '${type}' を駅として判定`);
            return BUILDING_HEIGHT_CONFIG.train_station;
        }
    }
    
    console.info('建物タイプから高さを推定できなかったため、デフォルト値を使用');
    return BUILDING_HEIGHT_CONFIG.default;
}

function updateMap(location, name = null, address = null, buildingTypes = null) {
    if (window.cesiumViewer) {
        // Cesiumの場合
        console.info(`座標に移動: lat=${location.lat}, lng=${location.lng}`);
        
        // 既存のエンティティをクリア
        window.cesiumViewer.entities.removeAll();
        
        // 表示する名前を決定（建物名を優先）
        const displayName = name || currentPlaceName || address || currentPlaceAddress || '検索位置';
        
        // Google Maps風のピンマーカーを作成
        const pinBuilder = new Cesium.PinBuilder();
        
        const entity = window.cesiumViewer.entities.add({
            name: displayName,
            position: Cesium.Cartesian3.fromDegrees(location.lng, location.lat, 0),
            billboard: {
                image: pinBuilder.fromColor(Cesium.Color.RED, 32).toDataURL(),  // サイズを48から32に縮小
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.NONE,  // 絶対高度を使用（地面レベルに固定）
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scale: 1.0  // スケールを明示的に設定
            },
            label: {
                text: displayName,
                font: '14pt sans-serif',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, 10),  // ピンとラベルの間隔を調整
                heightReference: Cesium.HeightReference.NONE,  // 絶対高度を使用（地面レベルに固定）
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 1.5e7, 0.5)
            }
        });
        
        // エンティティを保存（回転アニメーション用）
        window.currentEntity = entity;
        
        // 建物タイプから適切なカメラ高さを決定
        const heightConfig = buildingTypes ? estimateBuildingHeight(buildingTypes) : BUILDING_HEIGHT_CONFIG.default;
        const cameraHeight = heightConfig.cameraHeight;
        
        // Cesiumの自動中央配置機能を使用
        window.cesiumViewer.flyTo(entity, {
            duration: 2.0,
            offset: new Cesium.HeadingPitchRange(
                Cesium.Math.toRadians(0),      // heading（北向き）
                Cesium.Math.toRadians(-60),    // pitch（60度下向き）
                cameraHeight                    // range（距離）
            )
        }).then(() => {
            console.info(`カメラ移動完了 (高さ: ${cameraHeight}m)`);
            // カメラ移動完了後に自動回転を開始
            startOrbitAnimation(heightConfig);
        });
        
        console.info(`Cesiumカメラを移動: ${location.lat}, ${location.lng}`);
    } else if (map) {
        // Google Mapsの場合
        map.setCenter(location);
        map.setZoom(18);
        map.setTilt(45);
        
        if (marker) {
            marker.setMap(null);
        }
        
        marker = new google.maps.Marker({
            position: location,
            map: map,
            title: '選択された建物'
        });
        
        console.info(`Google Mapsを移動: ${location.lat}, ${location.lng}`);
    }
}

function displayBasicInfo(data) {
    document.getElementById('buildingAddress').textContent = data.formattedAddress || '-';
    document.getElementById('buildingLat').textContent = data.location.lat.toFixed(6);
    document.getElementById('buildingLng').textContent = data.location.lng.toFixed(6);
    document.getElementById('buildingPlaceId').textContent = data.placeId || '-';
    
    const types = data.types || [];
    document.getElementById('buildingTypes').textContent = types.length > 0 ? types.join(', ') : '-';
}

async function fetchPlaceDetails(placeId) {
    try {
        const response = await fetch(`/api/place/${placeId}`);
        const data = await response.json();

        if (data.status === 'success') {
            const placeName = data.data.name;
            document.getElementById('buildingName').textContent = placeName || '-';
            
            // 建物名を保存
            if (placeName) {
                currentPlaceName = placeName;
                console.info(`建物名を取得: ${placeName}`);
                
                // Place Details APIから取得した詳細な位置情報があれば使用
                if (data.data.geometry && data.data.geometry.location) {
                    const placeLocation = data.data.geometry.location;
                    console.info(`Place Details APIから正確な座標を取得: ${placeLocation.lat}, ${placeLocation.lng}`);
                    
                    // 現在のtypesを取得
                    const typesText = document.getElementById('buildingTypes').textContent;
                    const types = typesText !== '-' ? typesText.split(', ') : [];
                    
                    // Place Details APIの座標でマップを更新
                    updateMap(placeLocation, placeName, currentPlaceAddress, types);
                    
                    // 表示情報も更新
                    document.getElementById('buildingLat').textContent = placeLocation.lat.toFixed(6);
                    document.getElementById('buildingLng').textContent = placeLocation.lng.toFixed(6);
                } else {
                    // Place Details APIから座標が取得できない場合は既存の座標を使用
                    const location = {
                        lat: parseFloat(document.getElementById('buildingLat').textContent),
                        lng: parseFloat(document.getElementById('buildingLng').textContent)
                    };
                    
                    const typesText = document.getElementById('buildingTypes').textContent;
                    const types = typesText !== '-' ? typesText.split(', ') : [];
                    
                    updateMap(location, placeName, currentPlaceAddress, types);
                }
            }
            
            if (data.data.rating) {
                // 既存の評価要素を削除
                const existingRating = document.querySelector('.info-grid .rating-item');
                if (existingRating) {
                    existingRating.remove();
                }
                
                const ratingText = `${data.data.rating} (${data.data.totalRatings}件のレビュー)`;
                const ratingElement = document.createElement('div');
                ratingElement.className = 'info-item rating-item'; // rating-itemクラスを追加
                ratingElement.innerHTML = `
                    <span class="info-label">評価:</span>
                    <span class="info-value">${ratingText}</span>
                `;
                document.querySelector('.info-grid').appendChild(ratingElement);
            }
        }
    } catch (error) {
        console.error('Failed to fetch place details:', error);
    }
}

function showError(message) {
    const errorElement = document.getElementById('searchError');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function clearError() {
    const errorElement = document.getElementById('searchError');
    errorElement.textContent = '';
    errorElement.style.display = 'none';
}

function showLoading(show) {
    const button = document.getElementById('searchButton');
    button.disabled = show;
    button.textContent = show ? '検索中...' : '検索';
}

// 自動回転アニメーション機能
function startOrbitAnimation(heightConfig) {
    // 既存のアニメーションを停止
    stopOrbitAnimation();
    
    if (!window.cesiumViewer || !window.currentEntity) return;
    
    console.info('自動回転アニメーションを開始');
    
    // カメラコントローラーを一時的に無効化
    const scene = window.cesiumViewer.scene;
    scene.screenSpaceCameraController.enableRotate = false;
    scene.screenSpaceCameraController.enableTranslate = false;
    scene.screenSpaceCameraController.enableZoom = false;
    scene.screenSpaceCameraController.enableTilt = false;
    scene.screenSpaceCameraController.enableLook = false;
    
    // エンティティの位置を取得
    const entityPosition = window.currentEntity.position.getValue(window.cesiumViewer.clock.currentTime);
    
    let angle = 0;
    const distance = heightConfig.cameraHeight;
    
    // アニメーションループ
    orbitAnimation = scene.postRender.addEventListener(function() {
        angle += 0.5; // 回転速度（度/フレーム）
        if (angle >= 360) angle = 0;
        
        const heading = Cesium.Math.toRadians(angle);
        
        // エンティティ（ピン）を中心に回転
        window.cesiumViewer.camera.lookAt(
            entityPosition,
            new Cesium.HeadingPitchRange(
                heading,                        // 方位角
                Cesium.Math.toRadians(-30),    // 俯角（見下ろし角度）
                distance                        // 距離
            )
        );
    });
}

function stopOrbitAnimation() {
    if (orbitAnimation && window.cesiumViewer) {
        // アニメーションを停止
        window.cesiumViewer.scene.postRender.removeEventListener(orbitAnimation);
        orbitAnimation = null;
        
        // カメラコントローラーを再度有効化
        const scene = window.cesiumViewer.scene;
        scene.screenSpaceCameraController.enableRotate = true;
        scene.screenSpaceCameraController.enableTranslate = true;
        scene.screenSpaceCameraController.enableZoom = true;
        scene.screenSpaceCameraController.enableTilt = true;
        scene.screenSpaceCameraController.enableLook = true;
        
        // 現在の視点を維持したまま通常のカメラに戻す
        window.cesiumViewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        
        console.info('自動回転アニメーションを停止');
    }
}

function initializeCesiumEventHandlers() {
    // Cesiumビューアーが初期化された後にイベントハンドラーを設定
    const checkInterval = setInterval(() => {
        if (window.cesiumViewer) {
            clearInterval(checkInterval);
            
            // Cesiumのデフォルトイベントハンドラーを使用
            const handler = window.cesiumViewer.cesiumWidget.screenSpaceEventHandler;
            
            // 左クリックで回転停止
            handler.setInputAction(function() {
                if (orbitAnimation) {
                    stopOrbitAnimation();
                }
            }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
            
            // 右クリックでも回転停止
            handler.setInputAction(function() {
                if (orbitAnimation) {
                    stopOrbitAnimation();
                }
            }, Cesium.ScreenSpaceEventType.RIGHT_DOWN);
            
            // マウスホイールでも回転停止
            handler.setInputAction(function() {
                if (orbitAnimation) {
                    stopOrbitAnimation();
                }
            }, Cesium.ScreenSpaceEventType.WHEEL);
            
            // タッチ開始でも回転停止（モバイル対応）
            handler.setInputAction(function() {
                if (orbitAnimation) {
                    stopOrbitAnimation();
                }
            }, Cesium.ScreenSpaceEventType.PINCH_START);
            
            console.info('Cesiumイベントハンドラーを設定しました');
        }
    }, 1000); // 1秒ごとにチェック
}