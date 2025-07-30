```markdown
# 千代田区立スポーツセンター建物情報取得：GDAL `/vsicurl/` + `ogrinfo` のみ (MD形式)

Plateau の CityGML 建物レイヤ（bldg）をダウンロードせずに、GDAL の `/vsicurl/` 機能と `ogrinfo` で指定座標を含む建物フィーチャを抽出する手順を示します。

---

## 前提
- **GDAL**（`ogrinfo`）がインストール済み
- GDAL が **`/vsicurl/`** をサポート（HTTP Range リクエスト対応）
- 座標変換ツール（`cs2cs` または `proj`）が利用可能

---

## 手順

### 1. 座標変換 (緯度経度 → EPSG:6697)
```bash
# WGS84(4326) → JGD2011 / Japan Plane Rectangular CS IX (EPSG:6697)
echo "139.7700 35.6915" \
  | cs2cs +proj=longlat +datum=WGS84 +to +init=EPSG:6697 \
  | awk '{ printf("X=%f Y=%f\n", $1, $2) }'
# → 例: X=139.77005 Y=35.69150
```

### 2. `ogrinfo` でリモート GML に空間クエリ
```bash
ogrinfo "/vsicurl/https://assets.cms.plateau.reearth.io/assets/f0/8694c9-c697-4c07-96fc-720b6f61b06b/13101_chiyoda-ku_pref_2023_citygml_2_op/udx/bldg/53394621_bldg_6697_op.gml" \
  bldg \
  -where "INTERSECTS(geometry, GeomFromText('POINT(139.77005 35.69150)',6697))"
```
- `/vsicurl/...gml`: リモート GML をローカル保存なくストリーミング読み込み
- `bldg`: 対象レイヤ名
- `-where "INTERSECTS(...)"`: 指定点を含む建物のみ抽出

### 3. 実行結果例
```text
INFO: Open of `/vsicurl/.../53394621_bldg_6697_op.gml' using driver `GML' successful.
Layer name: bldg
Feature Count: 1

OGRFeature(bldg):0
  gml:id (String)               = bldg_b6100e60-3bf2-4d46-b16e-37c520f713e3
  bldg:measuredHeight (Real)    = 66.5
  bldg:storeysAboveGround (Integer) = 12
```

---

以上が、GDAL の `/vsicurl/` と `ogrinfo` のみを用いた取得方法です。
```

