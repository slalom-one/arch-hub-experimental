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
    initializePlateauHandlers();
});

// データ取得状況を表示する関数
function updateLoadingStatus(message) {
    const loadingElement = document.getElementById('plateauLoading');
    if (loadingElement && loadingElement.style.display !== 'none') {
        const statusText = loadingElement.querySelector('.loading-status-text');
        if (statusText) {
            statusText.textContent = message;
        } else {
            // 状況テキスト要素を作成
            const statusSpan = document.createElement('span');
            statusSpan.className = 'loading-status-text';
            statusSpan.textContent = message;
            loadingElement.appendChild(document.createElement('br'));
            loadingElement.appendChild(statusSpan);
        }
    }
    
    // コンソールにも出力
    console.info(`[取得状況] ${message}`);
}

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
            if (data.data.googleMapsApiConfigured) {
                if (data.data.apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
                    console.warn('APIキーがサンプルのままです。実際のAPIキーに変更してください。');
                    showError('APIキーがサンプルのままです。.envファイルに実際のAPIキーを設定してください。');
                } else {
                    console.info('Google Maps APIキーが設定されています');
                }
            } else {
                showError('Google Maps APIキーが設定されていません。.envファイルを確認してください。');
            }
        })
        .catch(error => {
            console.error('API configuration check failed:', error);
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
    document.getElementById('plateauSection').style.display = 'block';
        document.getElementById('plateauSection').style.display = 'block';

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
    document.getElementById('plateauSection').style.display = 'block';
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

// PLATEAU API関連の機能
function initializePlateauHandlers() {
    const plateauButton = document.getElementById('plateauButton');
    if (plateauButton) {
        plateauButton.addEventListener('click', fetchPlateauData);
    }
}

async function fetchPlateauData() {
    const lat = parseFloat(document.getElementById('buildingLat').textContent);
    const lng = parseFloat(document.getElementById('buildingLng').textContent);
    
    if (isNaN(lat) || isNaN(lng)) {
        showPlateauError('緯度・経度が取得できません。先に建物を検索してください。');
        return;
    }
    
    // 検索キーワードを取得（元の検索入力値または現在の建物名）
    const searchKeyword = document.getElementById('searchInput').value.trim() || currentPlaceName || '';
    
    console.info(`PLATEAUデータ取得開始: lat=${lat}, lng=${lng}, keyword=${searchKeyword}`);
    
    // UI状態を更新
    document.getElementById('plateauButton').disabled = true;
    document.getElementById('plateauLoading').style.display = 'block';
    document.getElementById('plateauError').style.display = 'none';
    document.getElementById('plateauData').style.display = 'none';
    
    // 取得状況を表示
    updateLoadingStatus('座標からメッシュコードを計算中...');
    
    try {
        updateLoadingStatus(`座標(${lat.toFixed(6)}, ${lng.toFixed(6)})のPLATEAUデータを検索中...`);
        const response = await fetch('/api/plateau/building', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lat, lng, searchKeyword })
        });
        
        updateLoadingStatus('該当エリアのデータを確認中...');
        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.message);
        }
        
        if (data.data) {
            // メタデータからメッシュコード情報を表示
            if (data.data.metadata) {
                const meta = data.data.metadata;
                updateLoadingStatus(`メッシュコード: 2次=${meta.mesh2}, 3次=${meta.mesh3}`);
                
                if (meta.apiUrl) {
                    const apiPath = meta.apiUrl.replace('https://api.plateauview.mlit.go.jp', '');
                    updateLoadingStatus(`PLATEAU APIにアクセス中: ${apiPath}`);
                }
            }
            
            // 簡潔なログ出力
            console.log(`PLATEAUデータ取得完了: ${data.data.cities?.length || 0}都市, ${data.data.files?.length || 0}ファイル`);
            
            // 都市名を表示
            if (data.data.cities && data.data.cities.length > 0) {
                updateLoadingStatus(`${data.data.cities.length}都市が見つかりました`);
                const cityNames = data.data.cities.map(c => `${c.cityName}(${c.year}年)`).join(', ');
                updateLoadingStatus(`${cityNames}のデータを確認しました`);
            }
            
            displayPlateauData(data.data);
            
            // 建物データがある場合は自動的に詳細を取得
            if (data.data.buildingData && data.data.buildingData.targetFile) {
                const fileName = data.data.buildingData.targetFile.code || 'unknown';
                updateLoadingStatus(`${fileName}_bldg_*.gml を使用`);
                updateLoadingStatus('CityGMLファイルを特定しました。建物詳細を取得中...');
                await window.fetchBuildingDetails(data.data.buildingData.targetFile.url);
            } else if (data.data.buildingData && data.data.buildingData.targetFiles && data.data.buildingData.targetFiles.length > 0) {
                updateLoadingStatus(`${data.data.buildingData.targetFiles.length}件のCityGMLファイルが見つかりました`);
                const firstFile = data.data.buildingData.targetFiles[0];
                const fileName = firstFile.code || 'unknown';
                updateLoadingStatus(`${fileName}_bldg_*.gml を使用`);
                await window.fetchBuildingDetails(firstFile.url);
            }
        } else {
            showPlateauError('建物データが見つかりませんでした。このエリアはPLATEAUデータが未整備の可能性があります。');
        }
        
    } catch (error) {
        console.error('PLATEAUデータ取得エラー:', error);
        showPlateauError(error.message || 'PLATEAUデータの取得に失敗しました。');
    } finally {
        document.getElementById('plateauButton').disabled = false;
        document.getElementById('plateauLoading').style.display = 'none';
    }
}

function displayPlateauData(data) {
    console.info('PLATEAUデータを表示します');
    
    // エラー要素を非表示
    document.getElementById('plateauError').style.display = 'none';
    
    // データコンテナを表示
    document.getElementById('plateauData').style.display = 'block';
    
    // メタデータを表示
    if (data.metadata) {
        console.log('メッシュコード情報:', {
            '2次メッシュ': data.metadata.meshCode,
            '3次メッシュ': data.metadata.mesh3
        });
    }
    
    // 都市計画情報セクションのみを表示（初期は空）
    const urbanPlanningElement = document.getElementById('plateauUrbanPlanningInfo');
    if (urbanPlanningElement) {
        displayPlateauSection('plateauUrbanPlanningInfo', {});
    }
}

function displayPlateauSection(elementId, data) {
    const container = document.getElementById(elementId);
    if (!container) {
        console.warn(`要素 ${elementId} が見つかりません`);
        return;
    }
    
    container.innerHTML = '';
    
    for (const [label, value] of Object.entries(data)) {
        const item = document.createElement('div');
        item.className = 'plateau-info-item';
        
        const labelSpan = document.createElement('span');
        labelSpan.className = 'plateau-label';
        labelSpan.textContent = label + ':';
        item.appendChild(labelSpan);
        
        const valueSpan = document.createElement('span');
        valueSpan.className = 'plateau-value';
        
        // DOM要素の場合は直接追加
        if (value instanceof HTMLElement) {
            valueSpan.appendChild(value);
        }
        // HTMLコンテンツ（リンクなど）の場合はそのまま挿入
        else if (typeof value === 'string' && value.includes('<')) {
            valueSpan.innerHTML = value;
        }
        // それ以外はエスケープして表示
        else {
            valueSpan.textContent = String(value);
        }
        
        item.appendChild(valueSpan);
        container.appendChild(item);
    }
}

function formatBuildingUsage(usage) {
    if (!usage) return '不明';
    
    // PLATEAUの用途コードを日本語に変換
    const usageMap = {
        '401': '業務施設',
        '402': '商業施設',
        '403': '宿泊施設',
        '404': '商業系複合施設',
        '411': '住宅',
        '412': '共同住宅',
        '413': '店舗等併用住宅',
        '414': '店舗等併用共同住宅',
        '415': '作業所併用住宅',
        '421': '官公庁施設',
        '422': '文教厚生施設',
        '431': '運輸倉庫施設',
        '441': '工場',
        '451': '農林漁業用施設',
        '452': '供給処理施設',
        '453': '防衛施設',
        '454': 'その他'
    };
    
    return usageMap[usage] || usage;
}

function formatStructureType(type) {
    if (!type) return '不明';
    
    // PLATEAUの構造種別コードを日本語に変換
    const typeMap = {
        '601': '木造・土蔵造',
        '602': '鉄骨鉄筋コンクリート造',
        '603': '鉄筋コンクリート造',
        '604': '鉄骨造',
        '605': '軽量鉄骨造',
        '606': 'レンガ造・コンクリートブロック造・石造',
        '607': '非木造',
        '608': 'その他'
    };
    
    return typeMap[type] || type;
}

function showPlateauError(message) {
    const errorElement = document.getElementById('plateauError');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    document.getElementById('plateauData').style.display = 'none';
}

// 建物詳細を取得して表示（グローバル関数として定義）
window.fetchBuildingDetails = async function(fileUrl) {
    console.info('建物詳細を取得:', fileUrl);
    
    // 座標とキーワードを取得
    const lat = parseFloat(document.getElementById('buildingLat').textContent);
    const lng = parseFloat(document.getElementById('buildingLng').textContent);
    const searchKeyword = document.getElementById('searchInput').value.trim() || currentPlaceName || '';
    
    // 詳細表示エリアを作成（まだない場合）
    let detailContainer = document.getElementById('plateauDetailContainer');
    if (!detailContainer) {
        detailContainer = document.createElement('div');
        detailContainer.id = 'plateauDetailContainer';
        detailContainer.className = 'plateau-detail-container';
        document.getElementById('plateauData').appendChild(detailContainer);
    }
    
    // ローディング表示
    detailContainer.innerHTML = '<div class="plateau-loading">建物詳細を取得中...<br><span id="loadingProgress"></span></div>';
    
    try {
        // CityGMLファイルから建物情報を取得
        updateLoadingStatus('CityGMLファイルをダウンロード中...');
        
        const response = await fetch('/api/plateau/building-attributes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fileUrl, lat, lng, searchKeyword })
        });
        
        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.message);
        }
        
        if (data.data && data.data.buildings) {
            // ファイルサイズの推定表示
            if (data.data.buildingCount) {
                const estimatedSize = Math.round(data.data.buildingCount * 0.05); // 概算MB
                updateLoadingStatus(`CityGMLファイル(約${estimatedSize}MB)を解析中...`);
                updateLoadingStatus(`XMLを解析中... ${data.data.buildingCount}件の建物IDを抽出`);
            }
            
            // バッチ処理情報を表示
            if (data.data.batchInfo) {
                const progressElement = document.getElementById('loadingProgress');
                if (progressElement) {
                    progressElement.textContent = data.data.batchInfo.message;
                }
                
                // バッチ処理の詳細を表示
                const totalBatches = data.data.batchInfo.totalBatches;
                if (totalBatches > 1) {
                    updateLoadingStatus(`建物属性を取得中: 合計${totalBatches}バッチで処理`);
                    updateLoadingStatus(`建物属性を${totalBatches}バッチで取得開始`);
                    updateLoadingStatus(`建物属性を取得します: 合計${data.data.buildingCount}件を50件ずつ処理`);
                    
                    // 実際のサーバー処理時間を考慮（26バッチで約13秒）
                    const timePerBatch = 500; // 0.5秒/バッチ
                    let currentBatch = 1;
                    
                    const batchInterval = setInterval(() => {
                        if (currentBatch <= totalBatches) {
                            const batchSize = currentBatch === totalBatches ? 
                                (data.data.buildingCount % 50) || 50 : 50;
                            updateLoadingStatus(`バッチ ${currentBatch}/${totalBatches} を処理中... (${batchSize}件)`);
                            
                            // 次のバッチ完了メッセージ
                            setTimeout(() => {
                                if (currentBatch <= totalBatches) {
                                    const completedCount = currentBatch === totalBatches ? 
                                        batchSize : 50;
                                    updateLoadingStatus(`バッチ ${currentBatch} 完了: ${completedCount}件の建物属性を取得`);
                                }
                            }, timePerBatch / 2);
                            
                            currentBatch++;
                        } else {
                            clearInterval(batchInterval);
                            updateLoadingStatus(`属性取得完了: 合計${data.data.totalCount}件の建物属性を取得しました`);
                        }
                    }, timePerBatch);
                }
            }
            
            // フィルタリング情報を表示
            if (searchKeyword) {
                updateLoadingStatus(`キーワード"${searchKeyword}"でマッチング中...`);
                if (data.data.filteredCount !== undefined) {
                    updateLoadingStatus(`${data.data.filteredCount}件が"${searchKeyword}"に該当`);
                }
            }
            
            if (data.data.totalCount > 0) {
                updateLoadingStatus('各建物までの距離を計算中...');
            }
            
            window.displayBuildingDetails(data.data.buildings);
        } else {
            detailContainer.innerHTML = '<div class="plateau-error">建物詳細情報が取得できませんでした</div>';
        }
        
    } catch (error) {
        console.error('建物詳細取得エラー:', error);
        detailContainer.innerHTML = `<div class="plateau-error">エラー: ${error.message}</div>`;
    }
}

// 建物詳細を表示
window.displayBuildingDetails = function(buildings) {
    const detailContainer = document.getElementById('plateauDetailContainer');
    
    if (!buildings || buildings.length === 0) {
        detailContainer.innerHTML = '<div class="plateau-info">建物情報が見つかりませんでした</div>';
        return;
    }
    
    console.log(`${buildings.length}件の建物情報を取得 (最も近い建物を表示)`);
    
    // 最も近い建物のデータを開発コンソールに出力
    if (buildings.length > 0 && buildings[0]) {
        console.log('最も近い建物の属性データ:');
        console.log(JSON.stringify(buildings[0], null, 2));
    }
    
    let html = '<div class="plateau-buildings">';
    html += '<h4>建物詳細情報</h4>';
    
    // 最も近い建瑩1件のみ表示
    const building = buildings[0];
    html += `<div class="plateau-building-item">`;
    
    // 距離情報の表示
    if (building.matchInfo && building.matchInfo.distance !== null) {
        html += '<div class="match-info">';
        const distanceText = building.matchInfo.distance < 1000 
            ? `${Math.round(building.matchInfo.distance)}m` 
            : `${(building.matchInfo.distance / 1000).toFixed(1)}km`;
        html += `<span class="distance-badge">距離: ${distanceText}</span>`;
        html += '</div>';
    }
        
        
    // 住所情報
    if (building.location) {
        html += '<div class="plateau-section">';
        html += '<strong>住所情報:</strong>';
        html += '<ul>';
        if (building.location.fullAddress) {
            html += `<li>住所: ${building.location.fullAddress}</li>`;
        } else {
            if (building.location.prefecture) html += `<li>都道府県: ${building.location.prefecture}</li>`;
            if (building.location.city) html += `<li>市区町村: ${building.location.city}</li>`;
            if (building.location.town) html += `<li>町名: ${building.location.town}</li>`;
            if (building.location.branch) html += `<li>番地: ${building.location.branch}</li>`;
        }
        html += '</ul>';
        html += '</div>';
    }
    
    // 基本情報
    if (building.basic) {
        html += '<div class="plateau-section">';
        html += '<strong>基本情報:</strong>';
        html += '<ul>';
        if (building.gmlId) html += `<li>建物ID: ${building.gmlId}</li>`;
        if (building.basic.name) html += `<li>名称: ${building.basic.name}</li>`;
        if (building.basic.address) html += `<li>住所: ${building.basic.address}</li>`;
        if (building.basic.usage) html += `<li>用途: ${building.basic.usage}</li>`;
        if (building.basic.class) html += `<li>建物分類: ${building.basic.class}</li>`;
        if (building.basic.yearOfConstruction) html += `<li>建築年: ${building.basic.yearOfConstruction}年</li>`;
        if (building.basic.creationDate) html += `<li>データ作成日: ${building.basic.creationDate}</li>`;
        html += '</ul>';
        html += '</div>';
    }
    
    // 建築情報
    if (building.architecture) {
        html += '<div class="plateau-section">';
        html += '<strong>建築情報:</strong>';
        html += '<ul>';
        if (building.architecture.measuredHeight) html += `<li>高さ: ${building.architecture.measuredHeight}m</li>`;
        if (building.architecture.storeysAboveGround) html += `<li>地上階数: ${building.architecture.storeysAboveGround}階</li>`;
        if (building.architecture.storeysBelowGround) html += `<li>地下階数: ${building.architecture.storeysBelowGround}階</li>`;
        html += '</ul>';
        html += '</div>';
    }
    
    // 都市計画情報
    if (building.urbanPlanning && Object.keys(building.urbanPlanning).length > 0) {
        html += '<div class="plateau-section">';
        html += '<strong>都市計画情報:</strong>';
        html += '<ul>';
        if (building.urbanPlanning.areaClassificationType) html += `<li>区域区分: ${building.urbanPlanning.areaClassificationType}</li>`;
        if (building.urbanPlanning.districtsAndZonesType) {
            const zones = Array.isArray(building.urbanPlanning.districtsAndZonesType) 
                ? building.urbanPlanning.districtsAndZonesType.join('、') 
                : building.urbanPlanning.districtsAndZonesType;
            html += `<li>用途地域: ${zones}</li>`;
        }
        if (building.urbanPlanning.detailedUsage) html += `<li>詳細用途: ${building.urbanPlanning.detailedUsage}</li>`;
        if (building.urbanPlanning.fireproofStructureType) html += `<li>防火構造: ${building.urbanPlanning.fireproofStructureType}</li>`;
        if (building.urbanPlanning.landUseType) html += `<li>土地利用種別: ${building.urbanPlanning.landUseType}</li>`;
        if (building.urbanPlanning.buildingFootprintArea) html += `<li>建築面積: ${building.urbanPlanning.buildingFootprintArea}㎡</li>`;
        if (building.urbanPlanning.totalFloorArea) html += `<li>延床面積: ${building.urbanPlanning.totalFloorArea}㎡</li>`;
        if (building.urbanPlanning.buildingRoofEdgeArea) html += `<li>屋上縁面積: ${building.urbanPlanning.buildingRoofEdgeArea}㎡</li>`;
        if (building.urbanPlanning.buildingStructureType) html += `<li>構造種別: ${building.urbanPlanning.buildingStructureType}</li>`;
        if (building.urbanPlanning.specifiedBuildingCoverageRate) html += `<li>指定建ぺい率: ${building.urbanPlanning.specifiedBuildingCoverageRate}%</li>`;
        if (building.urbanPlanning.specifiedFloorAreaRate) html += `<li>指定容積率: ${building.urbanPlanning.specifiedFloorAreaRate}%</li>`;
        if (building.urbanPlanning.surveyYear) html += `<li>調査年: ${building.urbanPlanning.surveyYear}</li>`;
        if (building.urbanPlanning.urbanPlanType) html += `<li>都市計画区分: ${building.urbanPlanning.urbanPlanType}</li>`;
        html += '</ul>';
        html += '</div>';
    }
    
    // 追加情報
    if (building.additionalInfo && Object.keys(building.additionalInfo).length > 0) {
        html += '<div class="plateau-section">';
        html += '<strong>追加情報:</strong>';
        html += '<ul>';
        for (const [key, value] of Object.entries(building.additionalInfo)) {
            if (value !== null && value !== undefined) {
                html += `<li>${key}: ${value}</li>`;
            }
        }
        html += '</ul>';
        html += '</div>';
    }
        
    html += '</div>';
    
    html += '</div>';
    detailContainer.innerHTML = html;
}