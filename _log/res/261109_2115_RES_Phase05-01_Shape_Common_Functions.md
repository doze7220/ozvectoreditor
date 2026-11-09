# RES: 作業計画・作業レポート (Phase 05-01) : 図形クラスの共通の関数の切り出し
* 参照元REQ: `./_log/req/261109_2107_REQ_Phase05-01_Shape_Common_Functions.md`

## 1. 作業目的
次のサブフェイズ（Phase 05-02）でパスの図形クラスを足す前に、4つの図形クラス（`js/shapes/`の`Line`・`Curve`・`Rect`・`Ellipse`）に重複している幾何の関数と図形データの検証を、`js/shapes/`の下の共通モジュール（`export`した関数。クラスにしない）へ切り出す。パスの図形クラスはこの共通モジュールを使って書けるようにする。

本作業は**振る舞いを一切変えないリファクタリング**である。画面の見た目・操作・当たり判定の結果・保存/読み込み/書き出しの結果・エラー文は変更前と同じでなければならない。そのため、ソースを変更するどのタスクよりも前に、5種の図形（`line`・`curve`・`arc`・`rect`・`circle`）の`hitTest`・`intersectsRect`と、4クラスの`fromJSON`のエラー文の自動テスト（安全網）を追加し、変更前のソースのまま全件成功させる。

## 2. アーキテクチャ設計

### 全体構成と依存の向き
*   新設する共通モジュールは2ファイル（憲法3章の1ファイル1責務。幾何の計算と図形データの検証は責務が異なるため分ける）。
    *   `js/shapes/ShapeGeometry.js`：図形クラスが当たり判定・範囲選択で使う幾何の計算（状態を持たない関数）。
    *   `js/shapes/ShapeDataValidation.js`：図形クラスの`fromJSON`が使う図形データの共通項目の検証（状態を持たない関数）。
*   依存の向き：`core/ShapeFactory → shapes/の図形クラス → shapes/の共通モジュール`の一方向。
    *   共通モジュールは`js/shapes/`の外のモジュールを`import`しない（`ShapeGeometry.js`・`ShapeDataValidation.js`はどちらも`import`文を持たない）。共通モジュールどうしも`import`しない。
    *   共通モジュールを`import`するのは`js/shapes/`の4つの図形クラスのみ。`core/`・`io/`・`edit/`・`palette/`・`check/`・`main.js`・`index.html`は変更しない（`ShapeFactory`の`import`も変えない）。
*   継承・共通の基底クラス・ミックスインは導入しない（発注者の決定）。各図形クラスが13メソッドを自分で実装し、13メソッドの名前・引数・戻り値・JSDocの契約（`@param`・`@returns`・`@throws`）は変えない。図形クラスは`try/catch`を持たないまま（共通モジュールも`try/catch`を持たない）。
*   変更対象（全タスク合計）：`js/shapes/`の4ファイル（更新）、`js/shapes/ShapeGeometry.js`・`js/shapes/ShapeDataValidation.js`（新規）、`test/shapes/`の4テストファイル（新規。`test/shapes/`フォルダも新設）、本RES。最終タスクのみ`PROJECT_ARCHITECTURE.md`・`_doc/arch/12_shapes.md`・`_doc/arch/16_test.md`。既存のテストファイルは変更しない。

### 要件1: 切り出しの前の自動テスト（安全網）

#### 1-1. テストファイルの置き場所と書き方（4ファイル共通）
*   置き場所と名前（開発資料4章`test/`の規則`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`）：対象モジュールは図形クラスごとのため、1クラス1ファイルとし、当たり判定と`fromJSON`のエラーを同じファイルの別の`describe`に書く。
    *   `test/shapes/Line.test.js`（`line`）
    *   `test/shapes/Curve.test.js`（`curve`）
    *   `test/shapes/Rect.test.js`（`rect`）
    *   `test/shapes/Ellipse.test.js`（`circle`・`arc`）
*   書き方（開発資料`_doc/arch/16_test.md`の決まりに従う）：
    *   先頭行に単一責務のJSDoc（3行以内）。補助関数にもJSDoc（`@param`・`@returns`）。
    *   `import`は`node:test`（`describe`・`it`）・`node:assert/strict`・対象の図形クラス1つ（例：`import { Line } from '../../js/shapes/Line.js';`）のみ。`ShapeFactory`・`DocumentSerializer`・共通モジュールは`import`しない（要件1のテストは図形クラスの公開APIだけを通すため。共通モジュールの新設後も変えない）。
    *   使う公開API：コンストラクタ・`setVertex`・`translate`・`hitTest`・`intersectsRect`・`toJSON`・`static fromJSON`。private項目・非公開の定数に触れない。`globalThis`・`window`へ代入しない。図形クラスは`console.warn`を出さないため抑止は不要。
    *   テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。**本タスク群ではソース（`js/`）を一切変更しない。**
    *   補助関数（各ファイル内に書く。共有の補助モジュールは作らない）：
        *   `makeValidData()`：正常な図形データを返す（対象クラスのインスタンスの`toJSON()`の戻り値に`id`を入れたもの。呼ぶたびに新しいオブジェクト）。
        *   `assertFromJSONError(data, reason)`：`assert.throws(() => <クラス>.fromJSON(data), { name: 'Error', message: '<クラス名>.fromJSON: ' + reason })`で、`Error`（`TypeError`等ではない）であることとメッセージの全文の一致を確かめる。
*   期待値について：下の1-2〜1-5の表は、計画時に現在のソースで実際に呼び出して確かめた結果である（Node.js v24.15.0）。テストが失敗した場合は、まず表の転記・図形の作り方の誤りを疑う。ソースの不具合と考えられる場合は**ソースを直さず**、5章に記録して報告する。表のケースは最低限であり、実コードを読んで観点を足してよい（足したケースも変更前のソースで成功させる）。
*   浮動小数の注意：`Line`・`Rect`・`Curve`の表の「ちょうど」の値（距離5の3-4-5の三角形、`t=0.5`の頂点、`Math.cos(0)`等）は誤差が出ない値を選んである。`Ellipse`の比率の式（`hitTest`の通常の分岐）は境界ちょうどで誤差が出る（例：`Ellipse(0,0,50,50,'circle')`の`hitTest(55, 0, 4)`は許容幅ちょうどだが`false`）。`Ellipse`の境界付近は表のとおり内側・外側に0.5程度の余裕を持たせた値で確かめ、境界ちょうどの値をテストに使わない。

#### 1-2. `Line`（`test/shapes/Line.test.js`）
図形：`new Line(0, 0, 100, 0)`（既定の色・太さ）。

| 観点 | 呼び出し | 期待 |
| --- | --- | --- |
| 輪郭線の上 | `hitTest(50, 0, 0)` | `true` |
| 許容誤差ちょうど（距離5） | `hitTest(50, 5, 5)` | `true` |
| 許容誤差の外 | `hitTest(50, 5.5, 5)` | `false` |
| 端点の外側の延長上（距離5） | `hitTest(-5, 0, 5)` | `true` |
| 端点の外側の延長上（距離6） | `hitTest(-6, 0, 5)` / `hitTest(106, 0, 5)` | `false` / `false` |
| 端点付近の斜め（終点から距離5） | `hitTest(103, 4, 5)` | `true` |
| 範囲選択：輪郭に掛かる | `intersectsRect(40, -10, 60, 10)` | `true` |
| 範囲選択：全体を含む | `intersectsRect(-10, -10, 110, 10)` | `true` |
| 範囲選択：外れる（上下） | `intersectsRect(40, 5, 60, 10)` | `false` |
| 範囲選択：線分の延長上だけに掛かる | `intersectsRect(110, -10, 120, 10)` / `intersectsRect(-10, -10, -0.5, 10)` | `false` / `false` |
| 境界に接する（辺） | `intersectsRect(40, 0, 60, 10)` | `true` |
| 境界に接する（終点が矩形の角） | `intersectsRect(100, 0, 110, 10)` | `true` |
| 境界のわずか外 | `intersectsRect(40, 0.5, 60, 10)` / `intersectsRect(100.5, -10, 110, 10)` | `false` / `false` |
| 大きさ0の矩形が線上 | `intersectsRect(50, 0, 50, 0)` | `true` |

*   頂点を動かした後：`new Line(0, 0, 100, 0)`に`setVertex(1, 0, 100)`（縦の線分(0,0)-(0,100)）→ `hitTest(0, 50, 0)`=`true`、`hitTest(50, 0, 1)`=`false`、`intersectsRect(-5, 40, 5, 60)`=`true`、`intersectsRect(10, 40, 20, 60)`=`false`。
*   平行移動の後：`new Line(0, 0, 100, 0)`に`translate(10, 20)` → `hitTest(60, 20, 0)`=`true`、`hitTest(50, 0, 1)`=`false`、`intersectsRect(40, -10, 60, 10)`=`false`、`intersectsRect(50, 15, 70, 25)`=`true`。
*   長さ0：`new Line(10, 10, 10, 10)` → `hitTest(13, 14, 5)`=`true`（距離5）、`hitTest(10, 16, 5)`=`false`、`intersectsRect(0, 0, 20, 20)`=`true`、`intersectsRect(10, 10, 20, 20)`=`true`（矩形の角に接する）、`intersectsRect(11, 11, 20, 20)`=`false`。

#### 1-3. `Curve`（`test/shapes/Curve.test.js`）
図形A（曲がった曲線）：`new Curve(0, 0, 100, 0)`に`setVertex(1, 50, 100)`（始点(0,0)・制御点(50,100)・終点(100,0)。`x = 100t`、`y = 200t(1−t)`で、頂点は`t=0.5`の(50,50)）。図形B（まっすぐな曲線）：`new Curve(0, 0, 100, 0)`（制御点は中点(50,0)）。

| 図形 | 観点 | 呼び出し | 期待 |
| --- | --- | --- | --- |
| A | 輪郭線の上（`t=0.5`の分割点） | `hitTest(50, 50, 0)` | `true` |
| A | 許容誤差ちょうど（頂点から距離5） | `hitTest(50, 55, 5)` | `true` |
| A | 許容誤差の外 | `hitTest(50, 56, 5)` | `false` |
| A | 制御点は輪郭ではない | `hitTest(50, 100, 5)` | `false` |
| A | 端点 | `hitTest(0, 0, 0)` / `hitTest(100, 0, 0)` | `true` / `true` |
| A | 始点の外側（距離5／6） | `hitTest(-5, 0, 5)` / `hitTest(-6, 0, 5)` | `true` / `false` |
| B | 終点の外側の延長上（距離5／6） | `hitTest(105, 0, 5)` / `hitTest(106, 0, 5)` | `true` / `false` |
| A | 範囲選択：輪郭に掛かる | `intersectsRect(45, 45, 55, 55)` | `true` |
| A | 範囲選択：全体を含む | `intersectsRect(-10, -10, 110, 110)` | `true` |
| A | 範囲選択：曲線の内側（凹んだ側）だけ | `intersectsRect(40, 10, 60, 40)` | `false` |
| A | 範囲選択：頂点と制御点の間だけ（早期棄却を通過し、分割で外れる） | `intersectsRect(40, 60, 60, 90)` | `false` |
| A | 範囲選択：完全に外れる（早期棄却） | `intersectsRect(200, 200, 300, 300)` | `false` |
| A | 境界に接する（頂点が矩形の上辺） | `intersectsRect(45, 50, 55, 60)` | `true` |
| A | 境界のわずか外 | `intersectsRect(45, 50.5, 55, 60)` | `false` |
| B | 輪郭線の上 | `hitTest(50, 0, 0)` | `true` |
| B | 境界に接する（辺／終点が矩形の角） | `intersectsRect(40, 0, 60, 10)` / `intersectsRect(100, 0, 110, 10)` | `true` / `true` |
| B | 境界のわずか外 | `intersectsRect(40, 0.5, 60, 10)` / `intersectsRect(100.5, -10, 110, 10)` | `false` / `false` |

*   頂点を動かした後：図形Aそのもの（`setVertex(1, …)`で制御点を動かしている）で確かめている。
*   平行移動の後：図形Aに`translate(10, 10)` → `hitTest(60, 60, 0)`=`true`、`hitTest(50, 50, 1)`=`false`、`intersectsRect(55, 55, 65, 65)`=`true`、`intersectsRect(45, 45, 55, 55)`=`false`。
*   縮退（3点が同じ位置）：`new Curve(10, 10, 10, 10)` → `hitTest(13, 14, 5)`=`true`、`hitTest(10, 16, 5)`=`false`、`intersectsRect(0, 0, 20, 20)`=`true`、`intersectsRect(11, 11, 20, 20)`=`false`。

#### 1-4. `Rect`（`test/shapes/Rect.test.js`）
図形：`new Rect(0, 0, 100, 50)`（頂点(0,0)・(100,0)・(100,50)・(0,50)）。

| 観点 | 呼び出し | 期待 |
| --- | --- | --- |
| 4辺の上 | `hitTest(50, 0, 0)` / `hitTest(100, 25, 0)` / `hitTest(50, 50, 0)` / `hitTest(0, 25, 0)` | すべて`true` |
| 塗り内部（中央）は当たらない | `hitTest(50, 25, 5)` | `false` |
| 許容誤差ちょうど（外側・内側に距離5） | `hitTest(50, -5, 5)` / `hitTest(50, 5, 5)` | `true` / `true` |
| 許容誤差の外（外側・内側に距離6） | `hitTest(50, -6, 5)` / `hitTest(50, 6, 5)` | `false` / `false` |
| 角の外側の斜め（距離5／約5.66） | `hitTest(103, -4, 5)` / `hitTest(104, -4, 5)` | `true` / `false` |
| 辺の延長上（角から距離6） | `hitTest(106, 0, 5)` | `false` |
| 範囲選択：辺に掛かる | `intersectsRect(90, 10, 110, 20)` | `true` |
| 範囲選択：全体を含む | `intersectsRect(-10, -10, 110, 60)` | `true` |
| 範囲選択：塗り内部だけを囲む | `intersectsRect(10, 10, 90, 40)` | `false` |
| 範囲選択：完全に外れる | `intersectsRect(200, 200, 300, 300)` | `false` |
| 境界に接する（辺／角） | `intersectsRect(100, 10, 110, 20)` / `intersectsRect(-10, 50, 0, 60)` | `true` / `true` |
| 境界のわずか外 | `intersectsRect(100.5, 10, 110, 20)` | `false` |

*   頂点を動かした後（4頂点の自由変形）：`setVertex(2, 200, 100)` → `hitTest(150, 50, 0)`=`true`（新しい辺(100,0)-(200,100)の中点）、`hitTest(100, 25, 1)`=`false`（元の右辺は無くなる）、`intersectsRect(95, 20, 105, 30)`=`false`、`intersectsRect(145, 45, 155, 55)`=`true`。
*   平行移動の後：`translate(10, 10)` → `hitTest(60, 10, 0)`=`true`、`hitTest(50, 0, 1)`=`false`、`intersectsRect(40, -5, 60, 5)`=`false`、`intersectsRect(40, 5, 60, 15)`=`true`。
*   縮退（4点が同じ位置）：`new Rect(10, 10, 10, 10)` → `hitTest(13, 14, 5)`=`true`、`hitTest(10, 16, 5)`=`false`、`intersectsRect(0, 0, 20, 20)`=`true`、`intersectsRect(11, 11, 20, 20)`=`false`。

#### 1-5. `Ellipse`（`test/shapes/Ellipse.test.js`）
コンストラクタの引数は`(x1, y1, x2, y2, shapeType, strokeColor, strokeWidth)`（`x1, y1`＝中心、半径は`|x2−x1|`・`|y2−y1|`）。`hitTest`は他3クラスと違い`strokeWidth / 2`を許容誤差に足す（既定の太さ2では+1）。図形C：`new Ellipse(0, 0, 50, 50, 'circle')`（半径50の円）。図形D：`new Ellipse(0, 0, 50, 50, 'arc')`（同じ大きさの弧。画面の上半分＝yが負の側を描く）。

| 図形 | 観点 | 呼び出し | 期待 |
| --- | --- | --- | --- |
| C | 輪郭線の上（右・上・下・左） | `hitTest(50, 0, 0)` / `hitTest(0, -50, 0)` / `hitTest(0, 50, 0)` / `hitTest(-50, 0, 0)` | すべて`true` |
| C | 許容幅（4+1）の内側の付近（外側・内側） | `hitTest(54.5, 0, 4)` / `hitTest(45.5, 0, 4)` | `true` / `true` |
| C | 許容幅の外側の付近（外側・内側） | `hitTest(55.5, 0, 4)` / `hitTest(44.5, 0, 4)` | `false` / `false` |
| C | 塗り内部（中心）は当たらない | `hitTest(0, 0, 5)` | `false` |
| C | `strokeWidth / 2`を足すこと（太さ2では外） | `hitTest(54, 0, 0)` | `false` |
| C' | 同じ円で太さ10（`new Ellipse(0, 0, 50, 50, 'circle', '#000000', 10)`） | `hitTest(54, 0, 0)` / `hitTest(56, 0, 0)` | `true` / `false` |
| C | 範囲選択：輪郭に掛かる | `intersectsRect(45, -5, 55, 5)` | `true` |
| C | 範囲選択：全体を含む | `intersectsRect(-60, -60, 60, 60)` | `true` |
| C | 範囲選択：塗り内部だけを囲む | `intersectsRect(-20, -20, 20, 20)` / `intersectsRect(-10, -5, 10, 5)` | `false` / `false` |
| C | 範囲選択：完全に外れる（早期棄却） | `intersectsRect(100, 100, 200, 200)` | `false` |
| C | 境界に接する（右端(50,0)が矩形の左辺） | `intersectsRect(50, -10, 60, 10)` | `true` |
| C | 境界のわずか外 | `intersectsRect(50.5, -10, 60, 10)` | `false` |
| C | 下半分にも掛かる（円） | `intersectsRect(-5, 45, 5, 55)` / `intersectsRect(-60, 10, 60, 60)` | `true` / `true` |
| D | 上半分の輪郭（上・右端・左端） | `hitTest(0, -50, 0)` / `hitTest(50, 0, 0)` / `hitTest(-50, 0, 0)` | すべて`true` |
| D | 下半分は当たらない | `hitTest(0, 50, 0)` / `hitTest(0, 54.5, 4)` | `false` / `false` |
| D | 上半分の許容幅の内側の付近 | `hitTest(0, -54.5, 4)` | `true` |
| D | 端点のわずか下（角度の範囲外） | `hitTest(50, 0.5, 0)` / `hitTest(-50, 0.5, 0)` | `false` / `false` |
| D | 範囲選択：上半分に掛かる | `intersectsRect(-5, -55, 5, -45)` / `intersectsRect(45, -5, 55, 5)` | `true` / `true` |
| D | 範囲選択：下半分だけ | `intersectsRect(-5, 45, 5, 55)` / `intersectsRect(-60, 10, 60, 60)` | `false` / `false` |
| D | 範囲選択：弦（両端を結ぶ線）の位置だけ | `intersectsRect(-10, -5, 10, 5)` | `false` |
| D | 境界に接する（右端）／わずか下 | `intersectsRect(50, -10, 60, 10)` / `intersectsRect(50, 0.5, 60, 10)` | `true` / `false` |
| D | 範囲選択：全体を含む | `intersectsRect(-60, -60, 60, 60)` | `true` |

*   頂点を動かした後：図形Cに`setVertex(1, 100, 999)`（yは無視され、半径x=100・半径y=50になる）→ `hitTest(100, 0, 0)`=`true`、`hitTest(50, 0, 0)`=`false`。図形Cに`setVertex(0, 10, 10)`（中心の移動。半径は保つ）→ `hitTest(60, 10, 0)`=`true`、`hitTest(50, 0, 0)`=`false`。
*   楕円（半径が異なる）：`new Ellipse(0, 0, 100, 50, 'circle')` → `hitTest(100, 0, 0)`=`true`、`hitTest(0, -50, 0)`=`true`、`hitTest(0, -55, 0)`=`false`。
*   平行移動の後：図形Cに`translate(10, 20)` → `hitTest(60, 20, 0)`=`true`、`hitTest(50, 0, 0)`=`false`、`intersectsRect(55, 15, 65, 25)`=`true`、`intersectsRect(49, -1, 51, 1)`=`false`。
*   縮退（`rx < 1 || ry < 1`の分岐。輪郭の折れ線までの距離が`tolerance + strokeWidth / 2`以下かで判定）：
    *   半径0の円`new Ellipse(0, 0, 0, 0, 'circle')`：`hitTest(0.5, 0, 0)`=`true`、`hitTest(3, 0, 0)`=`false`、`hitTest(3, 4, 4)`=`true`（距離5＝4+1）、`hitTest(3, 4, 3.9)`=`false`、`intersectsRect(-1, -1, 1, 1)`=`true`、`intersectsRect(0, 0, 1, 1)`=`true`（矩形の角に接する）、`intersectsRect(1, 1, 2, 2)`=`false`。
    *   つぶれた円（半径y=0）`new Ellipse(0, 0, 50, 0, 'circle')`：`hitTest(0, 0, 0)`=`true`（中心も輪郭の線分上。比率の式なら0除算になる箇所）、`hitTest(49, 0, 0)`=`true`、`hitTest(0, 1.9, 1)`=`true`、`hitTest(0, 2.1, 1)`=`false`、`hitTest(51.9, 0, 1)`=`true`、`hitTest(52.1, 0, 1)`=`false`、`intersectsRect(-5, -1, 5, 1)`=`true`、`intersectsRect(-5, 1, 5, 5)`=`false`。
    *   つぶれた弧（半径x=0）`new Ellipse(0, 0, 0, 50, 'arc')`（中心から上へ伸びる線分(0,0)-(0,−50)だけ）：`hitTest(0, -25, 0)`=`true`、`hitTest(0, 25, 0)`=`false`（下半分は描かれていない）、`intersectsRect(-5, -40, 5, -10)`=`true`、`intersectsRect(-5, 10, 5, 40)`=`false`。比較として同じ大きさの円`new Ellipse(0, 0, 0, 50, 'circle')`：`hitTest(0, 25, 0)`=`true`、`intersectsRect(-5, 10, 5, 40)`=`true`。
    *   半径が0でないが1未満：`new Ellipse(0, 0, 0.5, 50, 'circle')` → `hitTest(0, 0, 0)`=`true`、`hitTest(0, 49, 0)`=`true`（縮退の分岐に入ることの確認）。

#### 1-6. `fromJSON`のエラー文（4ファイル共通の観点）
`N`はクラスの頂点数（`Line`2・`Curve`3・`Rect`4・`Ellipse`5）。メッセージは`<クラス名>.fromJSON: <理由>`の全文で比べる（`assertFromJSONError`）。正常なデータは`makeValidData()`の戻り値を必要な箇所だけ書き換えて作る。

| 観点 | 入力の例 | 理由（`<クラス名>.fromJSON: `の後ろ） |
| --- | --- | --- |
| オブジェクトでない | `null`・`[]`・`'line'`・`42`・`undefined` | `図形データがオブジェクトではありません` |
| 種別の不一致（`Line`の例） | `type: 'curve'` / `type`を消す | `図形種別が'line'ではありません（curve）` / `図形種別が'line'ではありません（undefined）` |
| 種別の不一致（`Curve`・`Rect`） | 他の種別・`type`を消す | `図形種別が'curve'ではありません（…）`・`図形種別が'rect'ではありません（…）` |
| 種別の不一致（`Ellipse`） | `type: 'line'` / `type: 'rect'` / `type`を消す | `図形種別が'circle'・'arc'のいずれでもありません（line）`（以下同様に括弧内が`rect`・`undefined`） |
| 頂点数の不一致 | `N−1`個・`N+1`個・`points`を消す・`points: {}` | `pointsがN要素の配列ではありません`（`N`は数字。例：`pointsが2要素の配列ではありません`） |
| 頂点の座標が有限の数値でない（何番目か） | 最後の頂点を`{ x: 0, y: NaN }` / 先頭を`null` / `{ x: '1', y: 0 }` / `{ x: Infinity, y: 0 }` | `points[N−1]のx・yが有限の数値ではありません`（`N−1`は数字）/ `points[0]のx・yが有限の数値ではありません` / … |
| `strokeColor`が文字列でない | `strokeColor: 123` / 消す | `strokeColorが文字列ではありません` |
| `strokeWidth`が正の有限の数値でない | `0`・`-1`・`NaN`・`Infinity`・`'2'`・消す | `strokeWidthが正の有限の数値ではありません` |
| 検査の順序 | 種別と頂点数がともに不正 | 種別の理由 |
| 検査の順序 | 頂点数と`strokeColor`がともに不正 | 頂点数の理由 |
| 検査の順序 | 先頭と2番目の頂点がともに不正 | `points[0]…`（先に報告されるのは小さい番号） |
| 検査の順序 | 頂点と`strokeColor`がともに不正 | 頂点の理由 |
| 検査の順序 | `strokeColor`と`strokeWidth`がともに不正 | `strokeColor`の理由 |
| 正常 | `makeValidData()`そのまま（`Ellipse`は`circle`・`arc`の両方） | 例外を投げない |

*   疎な配列（穴のある`points`）はテストしない（5章の懸念事項を参照。現在の`TypeError`を固定するテストを書かない）。

### 要件2: 幾何の関数の共通化（`js/shapes/ShapeGeometry.js`）

#### 2-1. 共通化する関数
| 関数（`export`） | 移す前の場所 | 置き換える箇所 |
| --- | --- | --- |
| `segmentIntersectsRect(ax, ay, bx, by, minX, minY, maxX, maxY)` → `boolean` | `Line`・`Curve`・`Rect`・`Ellipse`の`#segmentIntersectsRect`（4つは一字一句同じ。本体をそのまま移す） | `Line.intersectsRect`、`Curve.intersectsRect`のループ内、`Rect.intersectsRect`の各辺、`Ellipse.intersectsRect`のループ内。4クラスの`#segmentIntersectsRect`は削除する |
| `distanceToSegment(px, py, ax, ay, bx, by)` → `number` | `Rect.#distanceToSegment`（本体をそのまま移す）と、`Line.hitTest`の中の計算（同じ式） | `Line.hitTest`（`return distanceToSegment(x, y, this.x1, this.y1, this.x2, this.y2) <= tolerance;`）、`Rect.hitTest`の各辺。`Rect.#distanceToSegment`は削除する |
| `quadraticBezierPoint(p0, p1, p2, t)` → `{x: number, y: number}`（新しいオブジェクト） | `Curve.hitTest`・`Curve.intersectsRect`のループ内の`oneMinusT`・`bx`・`by`の計算 | 同2箇所（`const { x: bx, y: by } = quadraticBezierPoint(p0, p1, p2, t);`）。分割数・`t = i / segments`・ループ・早期棄却・`Math.hypot`による距離は`Curve`側に残す |

*   同じ値になることの根拠（式が同じであること）：
    *   `segmentIntersectsRect`：本体を変えずに移すだけ（`this.`の有無以外に違いがない）。
    *   `distanceToSegment`：`Line.hitTest`の`dx = this.x2 − this.x1`・`lengthSquared`・`t`の三項演算（`lengthSquared === 0 ? 0 : …`）・`Math.max(0, Math.min(1, t))`・`closestX = this.x1 + t * dx`・`Math.sqrt(distX * distX + distY * distY)`は、`Rect.#distanceToSegment`の`ax = x1, ay = y1, bx = x2, by = y2, px = x, py = y`と置いたものと演算の順序・使う関数・長さ0の扱いまで同じ。`<= tolerance`の比較は`Line.hitTest`側に残す。
    *   `quadraticBezierPoint`：本体は`const oneMinusT = 1 - t;`と`x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x`・`y`も同じ形。現在の式をそのまま写す（項の順序・掛ける順序を変えない）。`t`は呼び出し側で`i / segments`として求めて渡す（現在と同じ値）。
*   `quadraticBezierPoint`の頂点の引数は`{x, y}`のオブジェクト（`Curve`の`points`の要素をそのまま渡す。パスの編集のPhaseでパスの曲線の区間に使い回す想定。発注者の決定）。戻り値を毎回新しいオブジェクトにすることで呼び出し側のループの割り当てが増える（最大101回／呼び出し）が、値は変わらない。
*   JSDoc：各関数に`@param`・`@returns`。`segmentIntersectsRect`は既存の`#segmentIntersectsRect`のJSDocから「契約メソッドではない内部ヘルパー（同一ロジックをshapes/の各図形クラスが個別に持つ）」を除き、Liang–Barsky法・境界を含む・長さ0の線分は点の内包判定（0除算は起きない）・矩形は正規化済み（min ≤ max）が前提、を残す。`distanceToSegment`は長さ0の線分は点までの距離（0除算しない）を書く。`quadraticBezierPoint`は`B(t) = (1−t)^2 P0 + 2(1−t)t P1 + t^2 P2`・`t`の範囲（0〜1を想定。範囲外も式どおりに計算し、検査しない）・戻り値は新しいオブジェクト、を書く。どの関数も例外を投げない（`@throws`なし）。

#### 2-2. 共通化しない重複（理由）
| 重複している計算 | 場所 | 共通化しない理由 |
| --- | --- | --- |
| 点と線分の最短距離（`Math.hypot`版） | `Ellipse.#distanceToOutline`のループ内 | `Math.hypot`を使い、長さ0の扱いも`if (lengthSquared > 0)`の書き方で、最近点も`prevX + abx * t`の形のため、`distanceToSegment`（`Math.sqrt`）と同じ値になることが式から明らかでない。DIRの「`Ellipse`の近似は振る舞いを変えない」に従い、そのまま残す（REQの例示どおり）。 |
| 楕円の輪郭上の点`xc + rx * Math.cos(θ)`・`yc + ry * Math.sin(θ)` | `Ellipse.#distanceToOutline`と`Ellipse.intersectsRect`（それぞれ開始点とループ内） | 1クラスの中だけの重複で、Phase 05-02のパス・パスの曲線の区間（2次ベジェ）が使う見込みがない。軸ごとに1項の式で、関数にしても誤りを防ぐ効果が小さい。`Ellipse`の近似に触る箇所を減らすため残す。 |
| 輪郭のサンプリングのループ（角度の分割・前の点の更新） | `Ellipse.#distanceToOutline`と`Ellipse.intersectsRect` | ループの中身（距離の最小値／交差判定）が異なり、まとめるにはコールバック等の新しい形が要る。分割数・ループは図形側に残す方針（REQの`Curve`についての決定）と同じ扱い。 |
| 2次ベジェのサンプリングのループ | `Curve.hitTest`（分割数`100`の直書き）と`Curve.intersectsRect`（`CURVE_INTERSECT_SEGMENTS`） | REQの決定（分割数・ループ・早期棄却は`Curve`側に残す。分割数の違いも変えない）。 |
| 外接矩形による早期棄却 | `Curve.intersectsRect`（制御多角形の`Math.min`/`Math.max`）、`Ellipse.intersectsRect`（`xc ± rx`・`yc ± ry`） | REQの決定（早期棄却は`Curve`側に残す）。`Ellipse`は外接矩形の求め方と比較の書き方が異なる。 |
| 楕円の半径`Math.abs(this.points[1].x − xc)`・`Math.abs(this.points[2].y − yc)` | `Ellipse`の`draw`・`drawHover`・`drawHandles`・`hitTestHandle`・`hitTest`・`intersectsRect`・`toDrawElement`・`setVertex` | `Ellipse`の`points`の約束（右端・上端制御点）に依存する図形固有の計算で、共通の幾何ではない。また組み込み関数1つ（`Math.abs`）で書ける（REQにより対象外）。 |
| 点と点の距離`Math.hypot(x − hx, y − hy)` | 4クラスの`hitTestHandle`、`Curve.hitTest` | REQにより対象外（組み込み関数1回）。 |
| 中点`(x1 + x2) / 2` | `Line.hitTestHandle`・`Line.drawHandles`（moveハンドルの位置）、`Curve`のコンストラクタ・`updateDraftEnd`（制御点の初期位置） | 1式の算術で、図形ごとに意味（moveハンドルの位置／制御点の初期位置）が異なる。関数にする利点がない。 |
| 4辺の組`[[0, 1], [1, 2], [2, 3], [3, 0]]` | `Rect.hitTest`・`Rect.intersectsRect` | 幾何の計算ではなく矩形の頂点の並びのデータで、`Rect`固有。 |
| 全頂点の平行移動（`points.forEach`で`x += dx`） | `Curve`・`Rect`・`Ellipse`の`translate` | 図形の状態を書き換える13メソッドの実装そのもので、共通モジュール（状態を持たない計算・検証）の責務に合わない。 |
| 頂点の配列の複製（`points.map(({x, y}) => ({x, y}))`） | `Curve`・`Rect`・`Ellipse`の`toJSON`・`fromJSON` | 幾何の計算でも検証でもない図形データとの変換で、本作業の範囲（REQ要件2・3）の外。 |

### 要件3: 図形データの検証の共通化（`js/shapes/ShapeDataValidation.js`）
*   関数（`export`）：`validateShapeData(data, className, acceptedTypes, pointCount)` → `void`。違反があれば最初の1件を`<className>.fromJSON: <理由>`のメッセージの`Error`でthrowする。
    *   `data`：検証対象（`*`）。
    *   `className`：エラー文の先頭に付けるクラス名（`'Line'`・`'Curve'`・`'Rect'`・`'Ellipse'`の文字列リテラルを各クラスが渡す。`Line.name`等は使わない）。
    *   `acceptedTypes`：受理する`type`の配列（1つ以上）。`Line`・`Curve`・`Rect`は`fromJSON`の中で配列リテラル`['line']`・`['curve']`・`['rect']`を渡し、`Ellipse`は既存の定数`ELLIPSE_TYPES`を渡す。
    *   `pointCount`：頂点数。各クラスの既存の定数`LINE_POINT_COUNT`・`CURVE_POINT_COUNT`・`RECT_POINT_COUNT`・`ELLIPSE_POINT_COUNT`を渡す（定数は各クラスに残す）。
*   検査の順序と理由の文言（現在の4つの`#validateData`と同じ。順序を変えない）：
    1.  `isPlainObject(data)`でなければ`図形データがオブジェクトではありません`。
    2.  `acceptedTypes.includes(data.type)`でなければ`図形種別が${describeAcceptedTypes(acceptedTypes)}（${String(data.type)}）`。
    3.  `!Array.isArray(data.points) || data.points.length !== pointCount`なら`pointsが${pointCount}要素の配列ではありません`。
    4.  `data.points.forEach((point, index) => { … })`で、`!isPlainObject(point) || !Number.isFinite(point.x) || !Number.isFinite(point.y)`なら`points[${index}]のx・yが有限の数値ではありません`。**`forEach`のまま書く**（`for`文に変えると疎な配列の穴の扱いが変わるため。5章）。
    5.  `typeof data.strokeColor !== 'string'`なら`strokeColorが文字列ではありません`。
    6.  `!Number.isFinite(data.strokeWidth) || data.strokeWidth <= 0`なら`strokeWidthが正の有限の数値ではありません`。
*   図形ごとに文言が違う種別の箇所の渡し方：`acceptedTypes`から文言を作る（モジュール内の非公開の補助関数`describeAcceptedTypes(acceptedTypes)`）。各種別を`'`で囲んで`・`でつなぎ、1つなら`ではありません`、2つ以上なら`のいずれでもありません`を続ける。
    *   `['line']` → `'line'ではありません` → 全文`Line.fromJSON: 図形種別が'line'ではありません（curve）`（現在と同じ）。
    *   `['circle', 'arc']` → `'circle'・'arc'のいずれでもありません` → 全文`Ellipse.fromJSON: 図形種別が'circle'・'arc'のいずれでもありません（line）`（現在と同じ）。
    *   2つ以上の分岐は既存の`Ellipse`のために要るもので、まだ存在しない図形のための分岐ではない。
*   同じ結果になることの根拠：`Line`・`Curve`・`Rect`の`data.type !== '<種別>'`と`['<種別>'].includes(data.type)`の否定は、すべての値で同じ真偽になる（`includes`の比較（SameValueZero）が`===`と異なるのは`NaN`・`±0`だけで、どちらも文字列と一致しない）。`Ellipse`は現在も`ELLIPSE_TYPES.includes`。文言は種別の箇所以外は現在の文字列をそのまま写す。
*   モジュール内の非公開の補助関数（`export`しない。JSDocは書く）：`isPlainObject(value)`（`value !== null && typeof value === 'object' && !Array.isArray(value)`。現在の4クラスの同名の矢印関数と同じ式）、`describeAcceptedTypes(acceptedTypes)`。エラーを投げる処理は現在と同じく関数内の`fail`（`throw new Error(\`${className}.fromJSON: ${reason}\`)`）で書いてよい。
*   JSDoc：`validateShapeData`に`@param`（4つ）・`@returns {void}`・`@throws {Error}`（条件の列挙と、メッセージの形`<className>.fromJSON: <理由>`、最初の違反1件だけを報告すること、検査の順序）。`strokeWidth`の0以下を不正とする理由（Canvasが0以下の`lineWidth`の代入を無視して直前の値が残り、描画結果が前に描いた図形に依存するため）は、各クラスの`#validateData`のJSDocから本関数のJSDocへ移す。`id`は検証しないこと・余分なプロパティは見ないことも書く。
*   各図形クラスの置き換え：`static #validateData`を削除し、`fromJSON`の先頭の`<クラス>.#validateData(data);`を`validateShapeData(data, '<クラス名>', <受理する種別>, <頂点数の定数>);`に置き換える。`fromJSON`のJSDocの`@param`・`@returns`・`@throws`は変えない（検証の実体が`ShapeDataValidation.js`の`validateShapeData`であることを本文に1句足すのはよい）。
*   Phase 05-02への考慮：パスの図形は頂点数が固定でない見込みだが、本作業では`pointCount`以外の引数・分岐（最小頂点数・可変長等）を足さない。5章に「Phase 05-02で拡張する」とだけ記録する。

### 要件4: 共通モジュールの形
*   `js/shapes/ShapeGeometry.js`
    *   先頭行の責務JSDoc（案）：「責務: 図形クラスが当たり判定・範囲選択で共通に使う幾何の計算（点と線分の距離・線分と軸平行矩形の交差・2次ベジェ曲線の点）を、状態を持たない関数として提供する。」
    *   `export function`のみ（クラス・定数・状態を持たない）。`import`文なし。DOM・Canvasに触れない。
*   `js/shapes/ShapeDataValidation.js`
    *   先頭行の責務JSDoc（案）：「責務: 図形クラスの`fromJSON`が共通に使う、図形データ（1図形のJSON表現）の共通項目の検証を、状態を持たない関数として提供する。」
    *   `export function validateShapeData`のみを公開する。`import`文なし。`try/catch`を持たない。
*   切り出した関数そのもののテストは足さない（決定）。理由：`Line.intersectsRect`は`segmentIntersectsRect`に`Line`の両端点を渡すだけ、`Line.hitTest`は`distanceToSegment(...) <= tolerance`だけになるため、要件1の`Line`のテストが実質的に両関数を直接確かめる。`quadraticBezierPoint`は`Curve`のテスト、`validateShapeData`は4クラスの`fromJSON`のテストで全分岐が通る。共通の関数を拡張するPhase（05-02等）で必要になったら、その関数のテスト（`test/shapes/ShapeGeometry.test.js`等）を足す。
*   図形クラスに残る、実態と合わなくなるJSDocの記述（置き換えタスクで直す）：
    *   4クラスの`#segmentIntersectsRect`のJSDocの「同一ロジックをshapes/の各図形クラスが個別に持つ」→ メソッドごと削除される。
    *   4クラスの`#validateData`のJSDocの「同等のロジックをshapes/の各図形クラスが個別に持つ」→ メソッドごと削除される。
    *   `Rect.#distanceToSegment`のJSDoc → メソッドごと削除される。`Rect.hitTest`のJSDocの「点-線分距離を求め」は実態どおりのため残す。
    *   各タスクで、対象ファイル内に「個別に持つ」「各図形クラスが」等の削除済みのヘルパーを前提とする記述が残っていないことを確かめる。

### 要件5: 回帰防止
*   各タスクの完了時に、プロジェクトのルートで`node --test`を実行し、`fail 0`と件数（`tests`・`pass`・`fail`）を4章へ記録する。計画時点の件数は`tests 270`・`pass 270`・`fail 0`（Node.js v24.15.0）。タスク1〜4で件数が増え、タスク5以降は増減しない（タスク5〜10はテストを足さない）。
*   置き換えのタスク（7〜10）では、要件1のテストに加え、既存のテスト（作業データの往復・エラー・書き出し・読み込み等）がすべて通ることを確かめる。失敗したら置き換えの誤りであり、テストを直さずにソースの置き換えを見直す。
*   テストプレイの確認項目は5章に列挙する。

### 要件6: 開発資料への記載
*   最終タスク（タスク12）でのみ反映する。内容は下の「開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」。記載先は`PROJECT_ARCHITECTURE.md`冒頭の記載基準（責務と境界・依存方向・設計判断の理由・やらないと決めたこと・誰が呼ぶか、を残し、1ファイルのJSDocで分かることは書かない）に従って決めた。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/shapes/` - 図形ドメイン（図形クラス4つの更新、共通モジュール2つの新設）
    *   `./test/shapes/` - 図形クラスの自動テスト（新設）
*   **関連する論理クラス・モジュール**:
    *   `Line`・`Curve`・`Rect`・`Ellipse`（具象の図形クラス。共通の基底クラスは持たない。13メソッドを自律実装）
    *   `ShapeGeometry`（新設。幾何の計算の関数群：`distanceToSegment`・`segmentIntersectsRect`・`quadraticBezierPoint`）
    *   `ShapeDataValidation`（新設。図形データの検証の関数：`validateShapeData`）
    *   変更しないが関係するもの：`core/ShapeFactory`（図形クラスを`import`する唯一の`core/`モジュール）、`io/DocumentSerializer`（`fromJSON`の例外を図形単位で捕捉する）

### 参照する責務
*   （`PROJECT_ARCHITECTURE.md` 1章）`shapes/`：1種類の図形。**依存方向**：`main.js → edit → io → core → shapes`の一方向。`test/`：依存は`test/ → js/`の一方向で、`index.html`・`js/`は`test/`を参照しない。
*   （`_doc/arch/12_shapes.md`）**shapes/**：図形種別ごとのデータ保持・描画・当たり判定・図形データとの相互変換を担う。座標はすべてワールド座標。共通基底クラスは無い。
    *   **13メソッド契約**：`draw(ctx, t)`、`drawHandles(ctx, viewScale = 1)`、`drawHover(ctx, viewScale = 1)`、`hitTest(x, y, tolerance)`、`hitTestHandle(x, y, tolerance)`、`setVertex(vertexIndex, x, y)`、`translate(dx, dy)`、`updateDraftEnd(x, y)`、`getVertexIndexForHandle(handleName)`、`intersectsRect(minX, minY, maxX, maxY)`、`toDrawElement()`、`toJSON()`、`static fromJSON(data)`。`Line`/`Curve`/`Rect`/`Ellipse`はいずれもこの13メソッドを自律実装する。メソッドを増減する場合は4クラスのクラスJSDocも更新する（本作業では増減しない）。
    *   **`intersectsRect`**：引数はワールド座標の正規化済み（min ≤ max）軸平行矩形（境界を含む）。描画されている輪郭線の中心線（`strokeWidth`は含めない）が一部でも掛かれば`true`。塗り内部は判定しない。`Line`・`Rect`は線分の厳密判定、`Curve`・`Ellipse`は輪郭を100分割した折れ線による近似判定。`Ellipse`の弧は描画されている弧部分のみが対象。
    *   **`toJSON`/`fromJSON`**：`fromJSON`は不正な入力で`Error`をthrowする（条件は各クラスの`@throws`。`strokeWidth`の0以下も不正）。`id`は検証せずそのまま保持する。余分なプロパティは無視する。各図形クラス・`ShapeFactory`は`try/catch`を持たない（捕捉は`DocumentSerializer`）。
    *   **変換の変更時の注意**（現在の記述。本作業で変わる）：検証ロジックは各図形クラスのprivate staticヘルパーとして個別に持つ（共通モジュールはない）。図形データの共通項目の規則を変える場合は4クラスすべてを追従させる。
    *   **Ellipse.js**：`type`（`'circle'`|`'arc'`）で振る舞いも分岐する。弧は画面の上半分を描く（`startAngle`=π、`endAngle`=2π）。`hitTest`・`intersectsRect`も同じ。`hitTest`は他3クラスと異なり`strokeWidth/2`を許容誤差に足す。`setVertex(1)`はyを、`setVertex(2)`はxを無視する。
    *   **Curve.js**：3頂点：`points[0]`=始点／`[1]`=制御点／`[2]`=終点。**Rect.js**：4頂点。コンストラクタは対角2点から4点を算出するのみで、矩形維持のための正規化は行わない。**Line.js**：`x1, y1`=始点／`x2, y2`=終点で保持する。
*   （`_doc/arch/10_ShapeFactory.md`）`ShapeFactory`は`shapes/`のみを`import`する。`shapes/`も`ShapeFactory`・`core/`を`import`しない。
*   （`_doc/arch/16_test.md`）`node:test`・`node:assert/strict`のみで書き、プロジェクトのルートの`node --test`で実行する。置き場所と命名は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。`test/`以下の`.js`はすべてテストとして実行されるため、共有の補助モジュールを置かず、補助関数は各テストファイルの中に書く。先頭行に単一責務のJSDoc（3行以内）。補助関数にもJSDoc（`@param`・`@returns`）。対象は相対パスで`import`し、公開APIのみを通す。テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。`globalThis`・`window`へ代入しない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **`PROJECT_ARCHITECTURE.md` 1章 フォルダ構成**：
    *   `js/shapes/`に共通モジュールを追加し、`# 図形クラスは種別ごとに1ファイル`の注記との関係を示す。案：
        ```text
        │   ├── shapes/
        │   │   ├── Line.js
        │   │   ├── Curve.js
        │   │   ├── Rect.js
        │   │   ├── Ellipse.js          # 図形クラスは種別ごとに1ファイル
        │   │   ├── ShapeGeometry.js    # 以下2つは図形クラスではない。図形クラスだけが使う共通の関数
        │   │   └── ShapeDataValidation.js
        ```
    *   `test/`に`shapes/`（`Line.test.js`・`Curve.test.js`・`Rect.test.js`・`Ellipse.test.js`）を追加する（`io/`の前に置く）。
*   **`PROJECT_ARCHITECTURE.md` 1章 フォルダ分割の方針**：`shapes/：1種類の図形。` → 「`shapes/`：1種類の図形（図形クラス。種別ごとに1ファイル）と、図形クラスだけが使う共通の関数（幾何の計算・図形データの検証。継承ではなく関数の切り出し）。」のように改める（詳細は4章`shapes/`）。
*   **`_doc/arch/12_shapes.md`**：
    *   1行目「共通基底クラスは無い。」に、図形クラスの間で共通の幾何の計算と図形データの検証は共通モジュールの関数を呼ぶこと（継承ではなく関数の切り出し。2026-11-09 発注者の決定）を足す。
    *   **共通モジュール**の項を新設：`ShapeGeometry.js`（公開関数`distanceToSegment`・`segmentIntersectsRect`・`quadraticBezierPoint`）・`ShapeDataValidation.js`（公開関数`validateShapeData`）。状態を持たない`export`した関数のみ（クラスにしない）。`import`するのは`shapes/`の図形クラスのみ（`core/`・`io/`等からは使わない）。共通モジュールは`shapes/`の外（および互い）を`import`しない。式を変えると複数の図形の当たり判定・検証が同時に変わるため、変えるときは`test/shapes/`の全テストを確かめる。
    *   置き換えなかった重複（やらないと決めたこと）：`Ellipse.#distanceToOutline`は`Math.hypot`版の点と線分の距離を自前で持つ（`distanceToSegment`と式が異なり、統一すると値が変わり得るため置き換えていない）。`Curve`の分割数・サンプリングのループ・早期棄却は`Curve`側にある（`hitTest`の分割数`100`の直書きと`CURVE_INTERSECT_SEGMENTS`の違いも残っている）。
    *   「変換の変更時の注意」の「検証ロジックは各図形クラスのprivate staticヘルパーとして個別に持つ（共通モジュールはない）。図形データの共通項目の規則を変える場合は4クラスすべてを追従させる。」を、「`fromJSON`の共通項目の検証は`ShapeDataValidation.validateShapeData`が行う（エラー文のクラス名・受理する種別・頂点数を各図形クラスが引数で渡す。種別の文言は受理する種別の並びから作る）。共通項目の規則を変える場合はこの関数を変え、`test/shapes/`の4クラスのエラー文のテストを確かめる。」に改める。
    *   13メソッド契約の「新規図形を追加する際は…」の箇所に、新しい図形クラスは幾何の計算（点と線分の距離・線分と矩形の交差・2次ベジェの点）と`fromJSON`の共通項目の検証に共通モジュールの関数を使い、図形クラスへ複製しないこと、図形種別を追加したら`test/shapes/<クラス名>.test.js`へ当たり判定と`fromJSON`のエラー文のテストを足すことを書き加える。
*   **`_doc/arch/16_test.md`**：「既存のテストファイルと検証範囲」に`test/shapes/Line.test.js`・`Curve.test.js`・`Rect.test.js`・`Ellipse.test.js`を追加する（`hitTest`・`intersectsRect`の当たる／当たらない・許容誤差の境界付近・端点と延長上・範囲選択の矩形が掛かる／含む／内部だけ／外れる／境界に接する・頂点の移動と平行移動の後・縮退（`Ellipse`の縮退の分岐を含む）・弧は上半分だけ・`Ellipse`の`strokeWidth / 2`、`fromJSON`の不正な図形データのエラー文の全文と検査の順序）。`Ellipse`の比率の式は境界ちょうどで浮動小数の誤差が出るため、境界付近は余裕を持たせた値で確かめていることも書く。共通モジュール（`ShapeGeometry`・`ShapeDataValidation`）の関数そのもののテストは無く、図形クラスのテストを通して確かめていることを書く。
*   `_doc/arch/10_ShapeFactory.md`：変更なし（図形種別の追加手順①は4章`shapes/`を参照しており、手順は`12_shapes.md`に書くため）。最終タスクで記述が実態と食い違っていないことだけ確かめる。
*   （各タスクの実行時に影響が判明した場合は、この欄へ追記する。資料本体への反映はタスク12で行う。）

## 3. タスクリスト
*   [x] タスク1: `Line`の当たり判定と`fromJSON`のエラー文のテストの新設
    *   **対象ファイル** :
        *   `./test/shapes/Line.test.js` :（新規。`test/shapes/`フォルダも新設）
    *   **作業内容** :
        *   2章要件1の1-1（書き方）・1-2（`Line`の表）・1-6（`fromJSON`のエラー文。`N`=2・種別`'line'`）のケースをすべて書く。表のケースは最低限で、実コードを読んで観点を足してよい。
        *   先頭行に単一責務JSDoc（3行以内）。案：「責務: 直線（Line）の当たり判定（hitTest・intersectsRect）とfromJSONの不正な図形データのエラー文を、公開APIのみを通して検証する。」補助関数`makeValidData()`・`assertFromJSONError(data, reason)`にJSDoc（`@param`・`@returns`）を書く。
        *   `import`は`node:test`・`node:assert/strict`・`../../js/shapes/Line.js`のみ。ソース（`js/`）を変更しない。
        *   完了時にプロジェクトのルートで`node --test`を実行し、全テストの成功と件数（`tests`・`pass`・`fail`）を4章の本タスクの欄へ記録する。失敗した場合、テストの誤り（表の転記・図形の作り方）なら直し、ソースの不具合と考えられる場合はソースを直さずに5章へ記録して報告する。開発資料への影響が判明したら2章の更新予定欄へ追記し、判断に迷った点は5章へ記述する。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク2: `Curve`の当たり判定と`fromJSON`のエラー文のテストの新設
    *   **対象ファイル** :
        *   `./test/shapes/Curve.test.js` :（新規）
    *   **作業内容** :
        *   2章要件1の1-1・1-3（`Curve`の表）・1-6（`N`=3・種別`'curve'`）のケースをすべて書く。
        *   先頭行に単一責務JSDoc（3行以内）。案：「責務: 2次ベジェ曲線（Curve）の当たり判定（hitTest・intersectsRect）とfromJSONの不正な図形データのエラー文を、公開APIのみを通して検証する。」補助関数にJSDoc。
        *   `import`は`node:test`・`node:assert/strict`・`../../js/shapes/Curve.js`のみ。ソースを変更しない。
        *   完了時に`node --test`を実行し、全テスト（タスク1を含む）の成功と件数を4章へ記録する。失敗時の扱い・開発資料への影響・判断に迷った点の記録はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク3: `Rect`の当たり判定と`fromJSON`のエラー文のテストの新設
    *   **対象ファイル** :
        *   `./test/shapes/Rect.test.js` :（新規）
    *   **作業内容** :
        *   2章要件1の1-1・1-4（`Rect`の表）・1-6（`N`=4・種別`'rect'`）のケースをすべて書く。
        *   先頭行に単一責務JSDoc（3行以内）。案：「責務: 矩形（Rect）の当たり判定（hitTest・intersectsRect）とfromJSONの不正な図形データのエラー文を、公開APIのみを通して検証する。」補助関数にJSDoc。
        *   `import`は`node:test`・`node:assert/strict`・`../../js/shapes/Rect.js`のみ。ソースを変更しない。
        *   完了時に`node --test`を実行し、全テスト（タスク1〜2を含む）の成功と件数を4章へ記録する。失敗時の扱い等はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク4: `Ellipse`（円・弧）の当たり判定と`fromJSON`のエラー文のテストの新設
    *   **対象ファイル** :
        *   `./test/shapes/Ellipse.test.js` :（新規）
    *   **作業内容** :
        *   2章要件1の1-1・1-5（`Ellipse`の表。円・弧・縮退の分岐・`strokeWidth / 2`）・1-6（`N`=5・種別`'circle'`・`'arc'`。種別の文言は`'circle'・'arc'のいずれでもありません`）のケースをすべて書く。境界付近は1-1の浮動小数の注意に従い、境界ちょうどの値を使わない。
        *   先頭行に単一責務JSDoc（3行以内）。案：「責務: 円・弧（Ellipse）の当たり判定（hitTest・intersectsRect。縮退時の分岐を含む）とfromJSONの不正な図形データのエラー文を、公開APIのみを通して検証する。」補助関数にJSDoc。
        *   `import`は`node:test`・`node:assert/strict`・`../../js/shapes/Ellipse.js`のみ。ソースを変更しない。
        *   完了時に`node --test`を実行し、全テスト（タスク1〜3を含む）の成功と件数を4章へ記録する。失敗時の扱い等はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク5: 幾何の計算の共通モジュール`ShapeGeometry.js`の新設
    *   **対象ファイル** :
        *   `./js/shapes/ShapeGeometry.js` :（新規）
    *   **作業内容** :
        *   2章要件2の2-1と要件4に従い、`export function segmentIntersectsRect(ax, ay, bx, by, minX, minY, maxX, maxY)`・`export function distanceToSegment(px, py, ax, ay, bx, by)`・`export function quadraticBezierPoint(p0, p1, p2, t)`を作る。`segmentIntersectsRect`は`Line.js`の`#segmentIntersectsRect`の本体を、`distanceToSegment`は`Rect.js`の`#distanceToSegment`の本体を、`quadraticBezierPoint`は`Curve.hitTest`の`oneMinusT`・`bx`・`by`の式を、**演算の順序・使う関数を変えずに**写す（`this.`を除く以外の変更をしない）。
        *   先頭行に単一責務JSDoc（3行以内。案は2章要件4）。各関数にJSDoc（`@param`・`@returns`。内容は2章2-1の「JSDoc」）。`import`文・クラス・定数・状態を持たない。
        *   本タスクでは図形クラスを変更しない（3関数は未使用のままでよい）。
        *   完了時に`node --test`を実行し、全テストの成功と件数（タスク4の完了時と同じ件数）を4章へ記録する。開発資料への影響・判断に迷った点の記録はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク6: 図形データの検証の共通モジュール`ShapeDataValidation.js`の新設
    *   **対象ファイル** :
        *   `./js/shapes/ShapeDataValidation.js` :（新規）
    *   **作業内容** :
        *   2章要件3と要件4に従い、`export function validateShapeData(data, className, acceptedTypes, pointCount)`と、非公開の補助関数`isPlainObject(value)`・`describeAcceptedTypes(acceptedTypes)`を作る。検査の順序・各理由の文言は2章要件3の1〜6のとおり（現在の`#validateData`の文字列をそのまま写す）。頂点の検査は`forEach`で書く。
        *   先頭行に単一責務JSDoc（3行以内。案は2章要件4）。`validateShapeData`にJSDoc（`@param`・`@returns`・`@throws`。`strokeWidth`の0以下を不正とする理由、`id`を検証しないこと、最初の違反1件だけを報告すること、検査の順序を含む）。非公開の補助関数にもJSDoc（`@param`・`@returns`）。`import`文・`try/catch`を持たない。
        *   本タスクでは図形クラスを変更しない（未使用のままでよい）。
        *   完了時に`node --test`を実行し、全テストの成功と件数（タスク5と同じ件数）を4章へ記録する。開発資料への影響・判断に迷った点の記録はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク7: `Line`の共通モジュールへの置き換え
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` :（更新）
    *   **作業内容** :
        *   `import { distanceToSegment, segmentIntersectsRect } from './ShapeGeometry.js';`と`import { validateShapeData } from './ShapeDataValidation.js';`を責務JSDocの直後に足す。
        *   `hitTest`の本体を`return distanceToSegment(x, y, this.x1, this.y1, this.x2, this.y2) <= tolerance;`に置き換える（2章2-1の根拠）。`intersectsRect`は`segmentIntersectsRect(this.x1, this.y1, this.x2, this.y2, minX, minY, maxX, maxY)`を返す。`#segmentIntersectsRect`を削除する。
        *   `fromJSON`の`Line.#validateData(data);`を`validateShapeData(data, 'Line', ['line'], LINE_POINT_COUNT);`に置き換え、`static #validateData`を削除する。
        *   JSDoc：13メソッドの`@param`・`@returns`・`@throws`は変えない。削除したヘルパーを前提とする記述（「個別に持つ」等）がファイル内に残っていないことを確かめる。必要なら`hitTest`・`intersectsRect`・`fromJSON`の本文に共通の関数を使う旨を1句足す。責務JSDoc（先頭行）は変えない。それ以外（描画・ハンドル・`toJSON`等）に触れない。
        *   完了時に`node --test`を実行し、全テストの成功と件数（タスク4と同じ件数）を4章へ記録する。失敗したらテストを直さず置き換えを見直す。開発資料への影響・判断に迷った点の記録はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク8: `Curve`の共通モジュールへの置き換え
    *   **対象ファイル** :
        *   `./js/shapes/Curve.js` :（更新）
    *   **作業内容** :
        *   `import { quadraticBezierPoint, segmentIntersectsRect } from './ShapeGeometry.js';`と`import { validateShapeData } from './ShapeDataValidation.js';`を足す。
        *   `hitTest`・`intersectsRect`のループ内の`oneMinusT`・`bx`・`by`の計算を`const { x: bx, y: by } = quadraticBezierPoint(p0, p1, p2, t);`に置き換える。`const t = i / segments;`・`hitTest`の`const segments = 100;`・`intersectsRect`の`CURVE_INTERSECT_SEGMENTS`・ループの範囲（`hitTest`は`i = 0`から、`intersectsRect`は`i = 1`から）・早期棄却・`Math.hypot`による距離・最小値の更新は変えない。
        *   `intersectsRect`の`this.#segmentIntersectsRect(...)`を`segmentIntersectsRect(...)`に置き換え、`#segmentIntersectsRect`を削除する。
        *   `fromJSON`の`Curve.#validateData(data);`を`validateShapeData(data, 'Curve', ['curve'], CURVE_POINT_COUNT);`に置き換え、`static #validateData`を削除する。
        *   JSDoc：13メソッドの契約は変えない。`hitTest`の「B(t) = …を100分割し」等の説明は実態どおりのため残す。削除したヘルパーを前提とする記述が残っていないことを確かめる。それ以外に触れない。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。失敗時の扱い等はタスク7と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク9: `Rect`の共通モジュールへの置き換え
    *   **対象ファイル** :
        *   `./js/shapes/Rect.js` :（更新）
    *   **作業内容** :
        *   `import { distanceToSegment, segmentIntersectsRect } from './ShapeGeometry.js';`と`import { validateShapeData } from './ShapeDataValidation.js';`を足す。
        *   `hitTest`の`this.#distanceToSegment(x, y, pa.x, pa.y, pb.x, pb.y)`を`distanceToSegment(x, y, pa.x, pa.y, pb.x, pb.y)`に、`intersectsRect`の`this.#segmentIntersectsRect(...)`を`segmentIntersectsRect(...)`に置き換え、`#distanceToSegment`・`#segmentIntersectsRect`を削除する。辺の組・`some`は変えない。
        *   `fromJSON`の`Rect.#validateData(data);`を`validateShapeData(data, 'Rect', ['rect'], RECT_POINT_COUNT);`に置き換え、`static #validateData`を削除する。
        *   JSDoc：13メソッドの契約は変えない。削除したヘルパーを前提とする記述が残っていないことを確かめる。それ以外に触れない。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。失敗時の扱い等はタスク7と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク10: `Ellipse`の共通モジュールへの置き換え
    *   **対象ファイル** :
        *   `./js/shapes/Ellipse.js` :（更新）
    *   **作業内容** :
        *   `import { segmentIntersectsRect } from './ShapeGeometry.js';`と`import { validateShapeData } from './ShapeDataValidation.js';`を足す（`distanceToSegment`は`import`しない）。
        *   `intersectsRect`の`this.#segmentIntersectsRect(...)`を`segmentIntersectsRect(...)`に置き換え、`#segmentIntersectsRect`を削除する。`#distanceToOutline`・`hitTest`・輪郭の点の計算・早期棄却は**変えない**（2章2-2）。
        *   `fromJSON`の`Ellipse.#validateData(data);`を`validateShapeData(data, 'Ellipse', ELLIPSE_TYPES, ELLIPSE_POINT_COUNT);`に置き換え、`static #validateData`を削除する。`ELLIPSE_TYPES`のJSDoc（「`fromJSON`の`type`検証に用いる」）が実態と合っていることを確かめる。
        *   JSDoc：13メソッドの契約は変えない。削除したヘルパーを前提とする記述が残っていないことを確かめる。それ以外に触れない。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。失敗時の扱い等はタスク7と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク11: JSDocの確認とRESの完成
    *   **対象ファイル** :
        *   `./js/shapes/ShapeGeometry.js`、`./js/shapes/ShapeDataValidation.js`、`./js/shapes/Line.js`、`./js/shapes/Curve.js`、`./js/shapes/Rect.js`、`./js/shapes/Ellipse.js`、`./test/shapes/`の4ファイル :（確認・必要ならJSDoc・コメントのみ更新）
        *   `./_log/res/261109_2115_RES_Phase05-01_Shape_Common_Functions.md` :（更新）
    *   **作業内容** :
        *   新設の2ファイルの先頭行の単一責務JSDoc（3行以内）、すべての関数（非公開の補助関数を含む）のJSDoc（`@param`・`@returns`、`validateShapeData`は`@throws`も）があることを確認する。4つのテストファイルの先頭行JSDoc・補助関数のJSDocを確認する。
        *   4つの図形クラスに`#segmentIntersectsRect`・`#distanceToSegment`・`#validateData`と、それらを前提とする記述（「個別に持つ」等）が残っていないこと、13メソッドのJSDocの`@param`・`@returns`・`@throws`が変わっていないこと、共通モジュールが`import`文を持たないこと、`js/shapes/`以外の`js/`・`index.html`・既存のテストファイルに変更が無いこと（`git status`・`git diff --stat`で確かめる。git の状態を変える操作はしない）を確認する。
        *   プロジェクトのルートで`node --test`を実行し、全テストの成功と件数を4章の本タスクの欄へ記録する。
        *   本RESの仕上げとして、4章の本タスクの欄を記入し（タスク1〜10の欄は書き換えない）、開発資料への影響を2章の更新予定欄へ（資料本体は修正しない）、判断に迷った点・目視確認を推奨する箇所・将来修正する際の注意点を5章へ追記する。
        *   完了時に本タスクを [x] にする。
*   [ ] タスク12: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。1章のフォルダ構成・フォルダ分割の方針）
        *   `./_doc/arch/12_shapes.md` :（更新）
        *   `./_doc/arch/16_test.md` :（更新）
    *   **作業内容** :
        *   2章「開発資料の更新予定」（各タスクで追記された項目を含む）を確認し、`PROJECT_ARCHITECTURE.md`冒頭の記載基準に従って上記3ファイルへ反映する。1つのファイルのJSDocを読めば分かること（関数の引数と戻り値の詳細、非公開の補助関数）は書かない。`_doc/arch/10_ShapeFactory.md`は記述が実態と食い違っていないことだけ確かめ、変更しない（食い違いがあれば5章に記録して報告する）。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止であるが、本タスクのみ明示的な例外とする（後続タスクが存在せず、資料の変更によって他タスクの前提が動く危険がないため）。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章の本タスクの欄へ記録する（資料の変更のみのため件数は変わらない）。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ反映した箇所を記入する。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: `Line`の当たり判定と`fromJSON`のエラー文のテストの新設
*   **作業内容** :
    *   `test/shapes/Line.test.js`を新規作成（`test/shapes/`も新設）。`describe`3つ（`Line.hitTest`・`Line.intersectsRect`・`Line.fromJSON のエラー文`）。1-2の表（頂点移動後・平行移動後・長さ0を含む）と1-6のケース（N=2・種別`'line'`）をすべて記述。補助関数`makeValidData()`・`assertFromJSONError()`にJSDoc付き。`import`は`node:test`・`node:assert/strict`・`Line`のみ。`js/`は変更なし。
    *   観点の追加：正常データの`fromJSON`が`toJSON()`と一致する往復の確認。
    *   `node --test`の結果：`tests 294`・`pass 294`・`fail 0`（計画時270から+24）。失敗なし。
    *   開発資料への影響：なし。判断に迷った点：なし。

### タスク2: `Curve`の当たり判定と`fromJSON`のエラー文のテストの新設
*   **作業内容** :
    *   `test/shapes/Curve.test.js`を新規作成。`describe`3つ（`Curve.hitTest`・`Curve.intersectsRect`・`Curve.fromJSON のエラー文`）。1-3の表（図形A・B、平行移動後、縮退）と1-6のケース（N=3・種別`'curve'`）をすべて記述。補助関数`makeValidData()`・`assertFromJSONError()`・図形A/Bを作る`curveA()`・`curveB()`にJSDoc付き。`import`は`node:test`・`node:assert/strict`・`Curve`のみ。`js/`は変更なし。
    *   `node --test`の結果：`tests 320`・`pass 320`・`fail 0`（タスク1完了時294から+26）。失敗なし。
    *   開発資料への影響：なし。判断に迷った点：なし。

### タスク3: `Rect`の当たり判定と`fromJSON`のエラー文のテストの新設
*   **作業内容** :
    *   `test/shapes/Rect.test.js`を新規作成。`describe`3つ（`Rect.hitTest`・`Rect.intersectsRect`・`Rect.fromJSON のエラー文`）。1-4の表（頂点移動後・平行移動後・縮退を含む）と1-6のケース（N=4・種別`'rect'`）をすべて記述。補助関数`makeValidData()`・`assertFromJSONError()`・標準の矩形を作る`makeRect()`にJSDoc付き。`import`は`node:test`・`node:assert/strict`・`Rect`のみ。`js/`は変更なし。
    *   `node --test`の結果：`tests 345`・`pass 345`・`fail 0`（タスク2完了時320から+25）。失敗なし。
    *   開発資料への影響：なし。判断に迷った点：なし。

### タスク4: `Ellipse`（円・弧）の当たり判定と`fromJSON`のエラー文のテストの新設
*   **作業内容** :
    *   `test/shapes/Ellipse.test.js`を新規作成。`describe`3つ（`Ellipse.hitTest`・`Ellipse.intersectsRect`・`Ellipse.fromJSON のエラー文`）。1-5の表（円C・太さ10のC'・弧D・頂点移動後・楕円・平行移動後・縮退4種）と1-6のケース（N=5・種別`'circle'`・`'arc'`。種別の文言は`'circle'・'arc'のいずれでもありません`）をすべて記述。境界ちょうどの値は使わず、0.5程度の余裕を持たせた値のみ。補助関数`makeValidData(type)`・`assertFromJSONError()`・`makeCircle()`・`makeArc()`にJSDoc付き。`import`は`node:test`・`node:assert/strict`・`Ellipse`のみ。`js/`は変更なし。
    *   観点の追加：正常データの`fromJSON`が`toJSON()`と一致する往復の確認（circle・arc両方）。
    *   `node --test`の結果：`tests 385`・`pass 385`・`fail 0`（タスク3完了時345から+40）。失敗なし。
    *   開発資料への影響：なし。判断に迷った点：なし。

### タスク5: 幾何の計算の共通モジュール`ShapeGeometry.js`の新設
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク6: 図形データの検証の共通モジュール`ShapeDataValidation.js`の新設
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク7: `Line`の共通モジュールへの置き換え
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク8: `Curve`の共通モジュールへの置き換え
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク9: `Rect`の共通モジュールへの置き換え
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク10: `Ellipse`の共通モジュールへの置き換え
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク11: JSDocの確認とRESの完成
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク12: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
*   **作業内容** :
    *   （タスク実行時に記入）

## 5. 懸念事項・要確認ポイント
*   **テストプレイで確認すべき項目**（タスク10の完了後。`index.html`をブラウザで開いて行う。期待する結果はすべて「変更前と同じ」）：
    1.  作成：「図形作成」モードで直線・曲線・弧・矩形・円をそれぞれ選び、キャンバス上をクリック → カーソルを動かす → もう一度クリックして作る。→ 作成中の追従と確定後の形が変更前と同じ（弧は上半分だけ）。
    2.  クリック選択：「選択」モードで各図形の線の上をクリック。→ その図形が選択される（ハンドルが出る）。線から少し離れた位置・矩形と円の内側（塗り内部）・弧の下側（描かれていない側）・曲線の制御点の位置をクリック。→ その図形は選択されない。線の近くにカーソルを置くとホバーの強調が出る。
    3.  範囲選択：空白からドラッグして、各図形の線の一部に掛かる矩形・図形全体を囲む矩形を描く。→ その図形が選択される。矩形・円の内側だけを囲む矩形、弧の下側だけを囲む矩形、直線の延長上だけに掛かる矩形を描く。→ 選択されない。
    4.  移動：選択した図形の線をドラッグ、直線・円のmoveハンドル（中点・中心）をドラッグ。→ 図形が平行移動する。移動後の位置でクリック選択・範囲選択ができ、元の位置ではできない。
    5.  ハンドル操作：直線の始点・終点、曲線の始点・制御点・終点、矩形の4隅、円・弧の右・上・左・下のハンドルをドラッグ。→ 変更前と同じように変形する（矩形は4隅が独立に動く。円・弧の左・下は右・上と同じく半径が変わる）。変形後の形でクリック選択・範囲選択ができる。半径0近くまで潰した円・弧もクリック選択・範囲選択ができる。
    6.  取り消し・やり直し：上記の作成・移動・変形を`Ctrl`+`Z`／`Ctrl`+`Y`で戻す・やり直す。→ 変更前と同じ。
    7.  保存と読み込み：5種の図形を置いたキャンバスを「出力（作業ファイル）」でダウンロードし、「開く」で開き直す。→ 図形がすべて同じ位置・形で戻り、選択・移動・変形ができる。ページを再読み込みして自動保存から戻した場合も同じ。
    8.  書き出し：同じキャンバスを「出力（エンジン用）」でJSとしてダウンロードし、`sprite-check.html`で開く。→ エディタと同じ見た目で描かれる。そのJSをエディタの「開く」で開き直すと図形が戻る。
    9.  不正なファイル：図形データの一部を手で壊した作業ファイル（例：`strokeWidth`を0にした図形を含む）を開く。→ 変更前と同じく「一部読めない」通知が出て、壊した図形だけが読み飛ばされる（`console.warn`の理由の文言も変更前と同じ）。
*   **既存の振る舞いの不具合の候補（ソースは直さない。現場設計AIへ報告）**：`fromJSON`の検証は頂点を`forEach`で調べるため、疎な配列（穴のある`points`。例：`[ , {x: 0, y: 0}]`）の穴を検査せずに通し、その後の頂点の読み出しで`TypeError`（`Cannot read properties of undefined (reading 'x')`）になる（計画時に`Line.fromJSON`で確認）。`JSON.parse`の結果には穴が生じないため作業データファイルからは起きない。オブジェクト層（`DocumentSerializer.deserialize`へ直接オブジェクトを渡す経路）でのみ起こり得て、その場合も`DocumentSerializer`の`try/catch`で図形単位のスキップになる（理由の文言が検証メッセージではなくなるだけ）。本作業は振る舞いを変えないため、共通の関数でも`forEach`を保ち、この挙動を固定するテストも書かない。
*   **Phase 05-02で拡張する**：`validateShapeData`の`pointCount`は固定の頂点数のみを受ける。パスの図形（頂点数が固定でない見込み）のための引数・分岐は本作業では足さない。
*   **`Ellipse`の境界ちょうどの浮動小数の誤差**：`Ellipse.hitTest`の比率の式は許容幅ちょうどの点で`false`になる場合がある（例：半径50の円で`hitTest(55, 0, 4)`）。既存の振る舞いであり変えない。テストは境界付近を余裕を持たせた値で確かめる（2章1-1）。
*   **性能**：`quadraticBezierPoint`は呼び出しごとに新しいオブジェクトを返すため、`Curve.hitTest`・`intersectsRect`の1回の呼び出しで最大101個のオブジェクトが割り当てられる。値は変わらない。図形の数が非常に多いキャンバスでのホバーの体感が変わらないかをテストプレイで見る（変わった場合は報告する。式を変えない範囲での対処はPhase 05-02以降で検討する）。
*   **Node.jsの版**：計画時の実行環境はNode.js v24.15.0（`_doc/arch/16_test.md`の「確認したNode.jsの版はv24.20.0」と異なる）。v24.15.0でも既存の270件は全件成功した。
