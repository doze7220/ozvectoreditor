# RES: 作業計画・作業レポート (Phase 03-01) : シリアライズ契約
* 参照元REQ: `./_log/req/261101_2257_REQ_Phase03-01_Serialization_Contract.md`

## 1. 作業目的
図形データは現状メモリ上のインスタンスとしてのみ存在し、JSONとの相互変換の手段がない。Phase 03の後続サブフェイズ（Undo/Redo・コピー＆ペースト・ブラウザ内保存・ファイル入出力）はすべてこの変換を土台とする。
本作業では、以下を確立する。
* 全図形に共通する「図形データ（1図形のJSON表現）への変換／図形データからの復元」の契約（10メソッド契約 → 12メソッド契約）
* キャンバス全体を版番号付きの作業データ形式へ変換・復元する仕組み（マイグレーション表を含む）
* 図形種別一覧の`ShapeFactory.js`への一本化（`_doc/COWORK_STATUS.md` 2章Aの持ち越し事項の解消）
* 例外を呼び出し元へ素通りさせない、結果オブジェクト型のデシリアライズ
* 開発者向け確認用ウィンドウ（`?dev`時のみ）と、ワールド座標の原点(0, 0)の表示

**用語**（REQの定義に従い、本RES・コード内JSDocで統一する）：作業データ形式／図形データ／シリアライズ・デシリアライズ／図形種別／スキップ。座標はすべて「ワールド座標」と表記する。

## 2. アーキテクチャ設計

### 要件1: 図形種別プロパティと種別一覧の一本化
**(a) `type`プロパティ**
* `Line`→`'line'`、`Curve`→`'curve'`、`Rect`→`'rect'`をコンストラクタで`this.type`に設定する（JSDoc：「図形種別（`ShapeFactory`が受理する文字列と一致）」）。
* `Ellipse`は既存の`this.type = shapeType`（`'circle'`|`'arc'`）を維持し、JSDocを「図形種別。`'circle'`|`'arc'`で振る舞いも分岐する」へ更新する。
* `Line`の内部表現（`x1, y1, x2, y2`）は変更しない。

**(b) `ShapeFactory.js`の対応表（種別一覧の正本）**
`switch`を、図形種別をキーとする凍結済みの対応表（モジュールスコープの`const`）へ置き換える。並び順は図形パレットのボタン順（直線・曲線・弧・矩形・円）。

```js
/** 図形種別の対応表（正本）。並び順＝図形パレットのボタン順＝数字キーの割り当て順 */
const SHAPE_REGISTRY = Object.freeze([
    Object.freeze({ type: 'line',   create: (x1, y1, x2, y2) => new Line(x1, y1, x2, y2),              fromJSON: (data) => Line.fromJSON(data) }),
    Object.freeze({ type: 'curve',  create: (x1, y1, x2, y2) => new Curve(x1, y1, x2, y2),             fromJSON: (data) => Curve.fromJSON(data) }),
    Object.freeze({ type: 'arc',    create: (x1, y1, x2, y2) => new Ellipse(x1, y1, x2, y2, 'arc'),    fromJSON: (data) => Ellipse.fromJSON(data) }),
    Object.freeze({ type: 'rect',   create: (x1, y1, x2, y2) => new Rect(x1, y1, x2, y2),              fromJSON: (data) => Rect.fromJSON(data) }),
    Object.freeze({ type: 'circle', create: (x1, y1, x2, y2) => new Ellipse(x1, y1, x2, y2, 'circle'), fromJSON: (data) => Ellipse.fromJSON(data) }),
]);
const REGISTRY_BY_TYPE = new Map(SHAPE_REGISTRY.map((entry) => [entry.type, entry]));  // 検索用（非公開）
export const SHAPE_TYPES = Object.freeze(SHAPE_REGISTRY.map((entry) => entry.type));
```
* `ShapeFactory.create(type, x1, y1, x2, y2)`：`REGISTRY_BY_TYPE.get(type)`で引き、未登録なら従来どおり`Error`をthrowする（仕様変更なし）。
* `ShapeFactory.fromJSON(data)`（新設・静的）：`data`がプレーンオブジェクト（`null`・配列以外の`object`）でなければ`Error`、`data.type`が未登録なら`Error`（未知の図形種別）をthrowする。登録済みならエントリの`fromJSON(data)`へ委譲する。**ここでは`try/catch`しない**（捕捉は要件4のとおり`DocumentSerializer`の1箇所）。
* 依存方向は`ShapeFactory → shapes/`の一方向のままで、循環importは生じない（`shapes/`は`ShapeFactory`をimportしない）。

**(c) 参照元の追従**
* `InputTracker.js`：`SHAPE_TYPES`の自前定義を削除し、`import { SHAPE_TYPES } from './ShapeFactory.js';`のうえ`export { SHAPE_TYPES };`で再exportする（`setShapeType`のバリデーションでもこれを使う）。`KeyboardShortcuts.js`は`InputTracker.js`からのimportのまま無変更で動作する（モジュールの評価順は`ShapeFactory → InputTracker → KeyboardShortcuts`で、`KeyboardShortcuts`の最上位での`SHAPE_TYPES.map(...)`の時点で値は確定済み）。
* `InputTracker`の`currentShapeType`の初期値`'line'`を`SHAPE_TYPES[0]`へ、`VectorModel.startDraft`の既定引数`type = 'line'`を`SHAPE_TYPES[0]`（`ShapeFactory.js`からimport）へ置き換え、JSDocの`'line'|'curve'|'arc'|'rect'|'circle'`という列挙は`string`（`SHAPE_TYPES`のいずれか）へ置き換える（`InputTracker.js`・`main.js`・`PaletteController.js`・`ShapeFactory.js`・`VectorModel.js`）。図形種別の文字列一覧がコメントにも多重に残らないようにする。
* `PaletteController`：静的対応表`#BUTTON_DEFS`を廃止し、コンストラクタを`constructor(paletteRootElement, shapeTypes, onTypeSelected)`へ変更する。各種別のボタンをid命名規則`palette-${type}`で解決する。初期化時に次の2点を`console.warn`で報告する（静かに除外していた従来仕様を置き換える）。
  * 種別一覧にあるのにボタンが見つからない（そのtypeは配線しない）
  * ルート要素内に、種別一覧にない`[id^="palette-"]`要素がある（配線しない）
* `main.js`：`import { SHAPE_TYPES } from './core/ShapeFactory.js';`（正本から直接import）し、`new PaletteController(shapePaletteEl, SHAPE_TYPES, applyShapeType)`とする。
* `index.html`のパレットボタン（アイコン・表示名・`title`）は静的記述のまま変更しない。

**(d) 一本化後の参照関係**

| 場所 | 図形種別の扱い | 種別一覧を自前で列挙するか |
|---|---|---|
| `core/ShapeFactory.js` | `SHAPE_REGISTRY`（正本）。`SHAPE_TYPES`をexport | **する（唯一の正本）** |
| `core/InputTracker.js` | `ShapeFactory.js`から`SHAPE_TYPES`をimportして再export。`setShapeType`の検証、初期値`SHAPE_TYPES[0]` | しない |
| `core/KeyboardShortcuts.js` | `InputTracker.js`から`SHAPE_TYPES`をimport（無変更） | しない |
| `core/VectorModel.js` | `startDraft`の既定値に`SHAPE_TYPES[0]`、生成・復元は`ShapeFactory`へ委譲 | しない |
| `palette/PaletteController.js` | コンストラクタ引数`shapeTypes`で受け取る | しない |
| `main.js` | `ShapeFactory.js`から`SHAPE_TYPES`をimportし、`PaletteController`へ渡す | しない |
| `io/DocumentSerializer.js` | `ShapeFactory.fromJSON`へ委譲のみ | しない |
| `shapes/*.js` | 自分自身の`type`値のみ（`Ellipse`は`'circle'`/`'arc'`） | しない |
| `index.html` | 静的ボタン`#palette-${type}`（表示情報） | 静的記述（警告で整合を監視） |

```text
ShapeFactory.js (SHAPE_REGISTRY → SHAPE_TYPES)
 ├─→ InputTracker.js（import ＋ 再export）─→ KeyboardShortcuts.js（従来どおり）
 ├─→ VectorModel.js（create / 既定値）
 ├─→ main.js ─→ PaletteController（コンストラクタ引数） ⇔ index.html #palette-${type}（警告で照合）
 └─→ io/DocumentSerializer.js（fromJSON の委譲のみ）
```

### 要件2: 図形のシリアライズ契約（12メソッド契約）
**図形データ（バージョン1）の形**（全図形共通・キー順もこの順）：
```js
{ type: string, id: string, points: [{ x: number, y: number }, ...], strokeColor: string, strokeWidth: number }
```
| 図形 | `type` | `points`の要素数と並び |
|---|---|---|
| `Line` | `'line'` | 2：`[始点(x1,y1), 終点(x2,y2)]` |
| `Curve` | `'curve'` | 3：`[始点, 制御点, 終点]` |
| `Rect` | `'rect'` | 4：`[topLeft, topRight, bottomRight, bottomLeft]` |
| `Ellipse` | `'circle'`/`'arc'` | 5：`[中心, 右端制御点, 上端制御点, 開始角制御点, 終了角制御点]` |

**`toJSON()`**（インスタンスメソッド）
* 上記の形の新しいプレーンオブジェクトを返す。`points`は各頂点を`{ x, y }`として新規生成する（内部配列・頂点オブジェクトを共有しない）。`Line`は`x1, y1, x2, y2`から2点を組み立てる。
* `Ellipse`の`startAngle`/`endAngle`は出力しない（`type`から決まる固定値のため）。
* 作成中の図形のように`id`が`null`の場合も、そのまま`id: null`として出力する（キャンバス全体のシリアライズでは作成中の図形は対象外のため、通常は発生しない）。
* 補足：`toJSON`という名前のため、`JSON.stringify(shape)`でも自動的に図形データが出力される（副作用はなく、むしろ整合的）。

**`static fromJSON(data)`**
* 次の場合に`Error`をthrowする（メッセージは「`クラス名.fromJSON: 理由`」形式の日本語）：
  1. `data`がプレーンオブジェクトでない（`null`・配列・プリミティブ）
  2. `data.type`が自クラスの図形種別でない（`Line`/`Curve`/`Rect`は各1値、`Ellipse`は`'circle'`|`'arc'`）
  3. `data.points`が配列でない、または要素数が自クラスの頂点数と一致しない
  4. `points`の要素がオブジェクトでない、または`x`/`y`が有限の数値（`Number.isFinite`）でない
  5. `strokeColor`が文字列でない
  6. `strokeWidth`が有限の数値でない、または0以下（Canvasは0以下の`lineWidth`代入を無視し、直前の値が残って描画が前後の図形に依存するため。懸念事項5参照）
* `id`は検証しない。`data.id`の値を（欠落なら`undefined`のまま）そのまま`this.id`に保持する。振り直しは`VectorModel`が行う（要件5）。
* `data`に余分なプロパティがあっても無視する（エラーにしない）。
* 生成手順：コンストラクタで仮生成（`Line`は始点・終点から、`Curve`/`Rect`は先頭点・末尾点など任意の2点から、`Ellipse`は中心と`type`から）した後、`points`（`Line`は`x1..y2`）を`data.points`の各座標値から**新規オブジェクトとして**設定し直し、`id`・`strokeColor`・`strokeWidth`を設定する。`data`内の配列・オブジェクトは流用しない。
* `Ellipse`の`startAngle`/`endAngle`は、コンストラクタが`type`から求める（既存ロジックのまま）。`points[3]`/`points[4]`も`data`の値をそのまま採用する（再計算しない。往復で`toJSON()`の内容が一致するため。描画・当たり判定は`points[0..2]`と角度のみに依存する）。
* 検証ロジックは各図形クラスのprivate staticヘルパー（例：`static #validateData(data)`）として各クラス内に閉じる（`#segmentIntersectsRect`と同じく各クラスが個別に持つ。共通モジュールの新設はスコープ外）。

**往復の一致**：`fromJSON`は`toJSON`の出力の座標・色・太さ・種別をそのまま復元し、角度は`type`から同一値に決まるため、`draw`・`hitTest`・`hitTestHandle`・`intersectsRect`・`setVertex`・`translate`の結果と`toJSON()`の内容は元の図形と一致する（JSON文字列を経由する場合も、JavaScriptの数値の文字列化は往復で同値になる。`-0`のみ`0`になるが描画・判定に影響しない）。

### 要件3: キャンバス全体の作業データ形式とマイグレーション
新設`js/io/DocumentSerializer.js`（静的メソッドのみのクラス。インスタンス状態を持たない。DOM非依存）。

**定数**（モジュールスコープ）
* `DOCUMENT_FORMAT = 'oz-vector-editor'`
* `CURRENT_DOCUMENT_VERSION = 1`（現行版の唯一の定義箇所）
* `MIGRATIONS`：キー＝変換元の版n、値＝「版nの作業データ（プレーンオブジェクト）を受け取り版n+1の新しいオブジェクトを返す関数」の凍結オブジェクト。現時点では空`{}`。

**公開API**（文字列とオブジェクトの両層を提供する。Phase 03-02のスナップショットはオブジェクト層、確認用ウィンドウ・Phase 03-04/05は文字列層を使う想定）
| メソッド | 内容 |
|---|---|
| `static serialize(shapes)` | 図形の配列（描画順）→ `{ format, version, shapes: shapes.map(s => s.toJSON()) }` |
| `static serializeToString(shapes)` | `JSON.stringify(serialize(shapes), null, 2)`（字下げ2） |
| `static deserialize(documentData)` | 作業データ（オブジェクト）→ 結果オブジェクト。**例外をthrowしない** |
| `static deserializeFromString(text)` | `JSON.parse`を`try/catch`し、失敗なら読み込み失敗の結果を返す。成功なら`deserialize`へ。**例外をthrowしない** |

**`deserialize`の処理順**
1. 最上位がプレーンオブジェクトでない → 失敗
2. `format !== DOCUMENT_FORMAT` → 失敗
3. `version`が整数でない／1未満／`CURRENT_DOCUMENT_VERSION`より大きい → 失敗
4. マイグレーション：`v = version`から`CURRENT_DOCUMENT_VERSION - 1`まで`MIGRATIONS[v]`を順に適用（関数が未定義、または関数が例外を投げた場合は失敗。この`try/catch`は全体失敗用）
5. マイグレーション後の`shapes`が配列でない → 失敗
6. `shapes`の各要素を`ShapeFactory.fromJSON(item)`で復元。**図形単位の`try/catch`はここ1箇所**。失敗した要素はスキップとして`{ index, type, reason }`を記録し、残りを続行する（`type`は要素が`type`に文字列を持てばその値、なければ`null`。`reason`は`Error.message`）。

**結果オブジェクト（`DeserializeResult`、JSDocの`@typedef`で定義）**
```js
{ ok: boolean,                  // 全体の読み込みに成功したか
  shapes: Array<Object>,        // 復元できた図形インスタンス（ok=falseなら空配列。描画順）
  skipped: Array<{ index: number, type: string|null, reason: string }>,  // スキップした図形（ok=falseなら空配列）
  error: string|null }          // 全体の読み込み失敗の理由（ok=trueならnull）
```
* 全図形がスキップされた場合・`shapes`が空配列の場合も`ok: true`（図形0個のキャンバス）とする（懸念事項6）。
* `console.warn`は`deserialize`内で、スキップ1件ごと、および全体失敗時に出す（要件4の「利用者への伝え方」の一方）。
* 保存対象は図形データのみ（選択集合・ホバー・作成中の図形・選択矩形・ビュー変換は含めない）。
* 版の追加手順（JSDocに記載）：①`MIGRATIONS`へ`[旧版]: (doc) => 新版のdoc`を追加 ②`CURRENT_DOCUMENT_VERSION`を+1 ③図形クラスの`toJSON`/`fromJSON`を新版の図形データへ更新（図形クラスは常に現行版のみを扱い、旧版の知識は`MIGRATIONS`に閉じる）。

### 要件4: 読み込めなかった図形の扱い
* 要件3の結果オブジェクトで表現する。未知の図形種別は`ShapeFactory.fromJSON`が、不正な図形データは各図形クラスの`fromJSON`が`Error`をthrowし、`DocumentSerializer.deserialize`の1箇所で捕捉してスキップに変換する。
* 各図形クラス・`ShapeFactory`は`try/catch`を持たない。`main.js`・`DevPanel`へは例外が届かない（`JSON.parse`の失敗も`deserializeFromString`内で結果へ変換）。
* 利用者への伝え方：確認用ウィンドウの結果表示（要件6）と`console.warn`のみ。

### 要件5: 図形一式の入れ替えとidの扱い
**`VectorModel.replaceAllShapes(shapes)`**（新設）
1. 引数の配列をコピー（`[...shapes]`）して新しい内部配列とする（引数配列を流用しない。図形インスタンス自体は受け取ったものを保持する）。
2. idの正規化（先頭から順に）：
   * `id`が空でない文字列で、それまでに出現していない → そのまま採用（「保持id」）
   * それ以外（欠落・文字列でない・空文字・重複の後出し）→ 「振り直し対象」
3. 保持idのうち`/^shape-(\d+)$/`に一致し、数値が`Number.isSafeInteger`のものの最大値`maxN`を求め、`#nextId = Math.max(#nextId, maxN + 1)`とする（連番は減らさない）。
4. 振り直し対象に`#issueId()`で新しいidを採番する（`#nextId`は保持idの最大値より大きいため、保持idとは衝突しない）。
5. 選択集合・ホバー状態・作成中の図形・選択矩形をクリアする。
6. 変更通知を1回だけ発行する。
7. 戻り値：振り直したidの件数（`number`。確認用ウィンドウの結果表示用）。
* id形式の知識を`VectorModel`内に閉じるため、private static定数`#ID_PREFIX = 'shape-'`（または同等のモジュール定数）と、採番用のprivateメソッド`#issueId()`（`` `${ID_PREFIX}${this.#nextId++}` ``）を新設し、既存の`commitDraft()`もこれを使うよう置き換える（挙動は同一）。
* 貼り付け・インポート時の振り直し（既存図形と合わせる場合）はPhase 03-03の範囲であり行わない。

**`InputTracker.abortOngoingOperation()`**（新設・公開。入れ替え前の中断手段）
* `setMode`内の強制中断処理（ドラッグセッションの`DragTracker.cancel()`、`IDLE`以外なら`cancelDraft()`して`IDLE`へ）をprivateメソッド`#abortOngoingOperation()`へ抽出し、`setMode`と新設の公開メソッドの両方から呼ぶ。
* 受理条件：**常に受け付ける**（どの操作モード・入力状態からでも呼べる。何も進行していなければ何もしない）。
* 中断するもの：パン・左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択。範囲選択は選択矩形を破棄して確定しない。ドラッグ中に反映済みの頂点・位置は残る）・作成途中の図形（破棄）。
* 変更しないもの：操作モード・図形種別・選択集合・ホバー状態（これらのクリアは呼び出し側・`replaceAllShapes`の責務）。
* 最後にカーソル形状を再評価する。戻り値：何かを中断したら`true`。
* Phase 03-02（Undo/Redo）でも「履歴適用の前処理」として再利用する前提である旨をJSDocに明記する。
* `setMode`の処理順は「中断（ドラッグ→作成途中の図形）→ モード更新 → 選択集合・ホバーのクリア → カーソル」となり、従来の「ドラッグ中断 → モード更新 → クリア → 作成途中の図形の破棄」から作成途中の図形の破棄の順序のみ前に移る（最終状態は同一。懸念事項8）。

**呼び出し順（`main.js`の復元コールバック）**：`deserializeFromString(text)` → 成功時のみ `inputTracker.abortOngoingOperation()` → `model.replaceAllShapes(result.shapes)`。再描画・削除ボタンの同期は`model.onChange`経路のみで行う。

### 要件6: 開発者向けの確認用ウィンドウ
**`index.html`**
* `<div id="window-dev-panel" class="float-window" hidden>`を静的に追加（ヘッダー：タイトル「開発者用：作業データ」＋既存と同じ`×`ボタン）。本体に、ボタン`#dev-export`（JSONへ変換）・`#dev-import`（JSONから復元）・`<textarea id="dev-json" spellcheck="false">`・結果表示`<pre id="dev-result">`。
* 初期位置は`top: 16px; left: 16px; width: 360px;`（右側のコントロールパネル・図形パレットと重ならない）。`textarea`は等幅フォント・`width: 100%`・`box-sizing: border-box`・`rows`で十数行・`resize: vertical`。結果表示は`white-space: pre-wrap`・`max-height`＋`overflow: auto`。
* `.float-window`の`user-select: none`は変更せず、`#dev-json`と`#dev-result`に限って`user-select: text`を当てる（懸念事項9）。
* `hidden`属性は、`.float-window`が`display`を指定していないためそのまま効く。`WindowManager`はコンストラクタ時点でDOMに存在する要素を検知するため、非表示のまま配線対象になる（`WindowManager.js`の変更は不要）。

**`js/palette/DevPanel.js`**（新設・自己完結UI部品）
* `constructor(rootElement, { onExport, onImport })`：ルート内の`#dev-export`/`#dev-import`/`#dev-json`/`#dev-result`を解決してclickを配線する（見つからなければ`console.warn`）。
  * `onExport(): string` … 作業データ形式のJSON文字列を返す。DevPanelは`textarea`へ表示し、結果表示欄に「JSONへ変換しました」と出す（図形数は扱わない。DevPanelが作業データの中身を解釈しないため）。
  * `onImport(text): ImportSummary` … `ImportSummary = { ok, restoredCount, reassignedCount, skipped: [{ index, type, reason }], error }`（JSDoc `@typedef`）。DevPanelはこれを結果表示欄へ整形して表示する（成功：復元した図形数・振り直したid数・スキップ件数と各行「#index type: reason」／失敗：「読み込み失敗：理由（キャンバスは変更していません）」）。
* `show()`：ルート要素の`hidden`を解除する。
* `VectorModel`・`InputTracker`・`DocumentSerializer`・図形インスタンスをimport/参照しない（受け取るのは文字列と要約オブジェクトのみ）。

**`main.js`**
* `const isDevMode = new URLSearchParams(window.location.search).has('dev');`（読み取りのみ。グローバルへの公開はしない）。
* `isDevMode`のときのみ`new DevPanel(...)`を生成して`show()`する。コールバック：
  * `onExport: () => DocumentSerializer.serializeToString(model.getShapes())`
  * `onImport: (text) => { 結果 = DocumentSerializer.deserializeFromString(text); 成功時のみ abortOngoingOperation() → replaceAllShapes(); ImportSummary を組み立てて返す }`
* `window`への関数・インスタンスの公開は行わない。

**テキスト入力中の誤作動防止**：`isTextInputElement`は`HTMLTextAreaElement`を真と判定するため、`KeyboardShortcuts`（V/P/H/数字/Delete/Backspace/Esc/Ctrl+A等）と`InputTracker`のスペースパンは、`textarea`にフォーカス中は受理されない想定（判定ロジックは変更しない）。確認項目は懸念事項に列挙する。

### 要件7: 原点(0, 0)の表示
* `CanvasManager`に`#drawOrigin(view)`を新設し、`render()`で`#drawGrid(view)`の直後・図形描画の前に呼ぶ。描画順：背景グリッド → 軸線・原点マーク → 図形 → ハンドル → 作成中の図形 → 選択矩形。
* 可視範囲の計算（描画変換の逆行列でバッファ四隅を写す処理）を`#drawGrid`からprivate`#getVisibleWorldBounds()`へ抽出し、グリッド・原点表示で共用する（変換式の重複を避ける）。
* 軸線：`x = 0`が可視範囲内ならY軸（`(0, minY)-(0, maxY)`）、`y = 0`が可視範囲内ならX軸（`(minX, 0)-(maxX, 0)`）を描く。線幅`1 / scale`、色`ORIGIN_AXIS_COLOR = 'rgba(0, 0, 0, 0.32)'`（グリッド太線0.14より濃い）。
* 原点マーク：画面上の大きさを定数（`ORIGIN_MARK_SIZE = 12`＝十字の全長px、`ORIGIN_MARK_RADIUS = 3`px）で定め、`÷ scale`でワールド長へ換算。十字（`±6/scale`）と円（半径`3/scale`）を線幅`1 / scale`、色`ORIGIN_MARK_COLOR = 'rgba(0, 0, 0, 0.6)'`で描く。
* `save()`/`restore()`でスタイルを後続へ残さない。`scale`が正の有限値でなければ何もしない（`#drawGrid`と同じガード）。状態は持たない。
* `ViewTransform`は変更しない（初期表示・リセット時の原点は従来どおりキャンバス左上）。

### 要件8: 回帰防止
* 既存の操作フローは、`type`プロパティの追加・`ShapeFactory`の表引き化（同一の生成結果）・`SHAPE_TYPES`の再export（同一の値・並び）・`setMode`の中断処理の抽出（同一の最終状態）・`PaletteController`の配線元の変更（同一のid・同一のコールバック）によってのみ影響を受け、いずれも挙動を変えない設計とする。
* 目視確認項目は「5. 懸念事項・要確認ポイント」に列挙する。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/shapes/` - 図形ドメイン（`type`プロパティ、`toJSON`/`fromJSON`の追加）
    *   `./js/core/` - `ShapeFactory`（種別一覧の正本・対応表・`fromJSON`振り分け）、`VectorModel`（`replaceAllShapes`・id採番）、`InputTracker`（`SHAPE_TYPES`再export・`abortOngoingOperation`）、`CanvasManager`（軸線・原点マーク）
    *   `./js/io/` - **新設**`DocumentSerializer`（作業データ形式・マイグレーション）
    *   `./js/palette/` - `PaletteController`（種別一覧の受け取りと警告）、**新設**`DevPanel`（確認用ウィンドウ）
    *   `./js/main.js`・`./index.html` - 配線、確認用ウィンドウのDOM・スタイル
*   **関連する論理クラス**: `Line`/`Curve`/`Rect`/`Ellipse`（具象図形）, `ShapeFactory`, `VectorModel`, `InputTracker`, `CanvasManager`, `DocumentSerializer`（新設）, `PaletteController`, `DevPanel`（新設）
*   **変更しないファイル**: `KeyboardShortcuts.js`／`ViewTransform.js`／`DragTracker.js`／`WindowManager.js`（変更不要と確認済み）

### 参照する責務
*   **プロジェクト憲法（抜粋）**: Vanilla JS（ES Modules）のみ・フレームワーク/ビルドツール/外部ライブラリ禁止。状態（Model）と描画（Canvas）の分離。`window`・グローバル空間の汚染禁止。全`.js`ファイル先頭に単一責務のJSDoc（3行以内）を記述し、責務を逸脱するロジックを追記しない（合わない機能は別ファイルへ分離）。クラス・関数・メソッド・データ構造にJSDocを記述する。
*   **2章 データ構造**: 図形は`shapes/`の図形クラスのインスタンスで、共通プロパティは`id`（`VectorModel`が採番）・`strokeColor`・`strokeWidth`のみ。頂点保持形式は図形ごとに異なる（`Line`は`x1, y1, x2, y2`、`Curve`/`Rect`/`Ellipse`は`points`配列。`type`を持つのは`Ellipse`のみ）。座標はすべてワールド座標で、ビュー変換は図形データに含まれず`ViewTransform`が保持する。選択集合・選択矩形は`VectorModel`が保持する。
*   **3章 描画・操作フロー**: 描画は常時ループを持たず、状態変化の通知で同期的に再描画する。再描画の経路は`VectorModel.onChange`・`ViewTransform.onChange`・ウィンドウリサイズの3経路で、同一関数`renderCurrentState()`を使う。`document`の`keydown`は`Space`を`InputTracker`、それ以外を`KeyboardShortcuts`が排他的に担当し、`KeyboardShortcuts`の受理判定順は「IME変換中 → テキスト入力中（`isTextInputElement`）→ 対応表照合 → ドラッグ中またはキーリピート → コールバック実行」。`ctrl: true`のエントリがドラッグ中・キーリピートで実行されなかった場合のみ例外的に`preventDefault()`だけ行う。
*   **index.html**: スタイルは`<style>`に内包。フロートウィンドウ全体の非活性は`.disabled`、ボタン単体の押せない状態は`disabled`属性（混用しない）。各ボタンの`title`にショートカットを併記（`SHORTCUT_BINDINGS`と手動同期）。
*   **main.js**: エントリポイント。各クラスのインスタンス化・依存の注入・イベントバインド。`applyMode(mode)`が操作モード切替を一元管理し、パレットの活性・ハイライトは`PaletteController`へ委譲。図形種別の切替は`applyShapeType(type)`。起動時に`applyMode(OperationMode.SELECT)`、最後に`renderCurrentState()`・`syncZoomDisplay()`・`syncDeleteButtonState()`を1回ずつ呼ぶ。削除ボタンの状態は`model.onChange`に登録した`syncDeleteButtonState()`が担う。
*   **VectorModel.js**: 描画データ（Shape配列）と選択集合を保持する単一の真実（SSOT）。選択集合`#selectedIds`・ホバー`#hoveredId`・作成中図形`#draftLine`・選択矩形`#selectionRect`を保持。図形idの採番（連番）は`commitDraft()`実行時に行う。`updateVertex`/`moveShapes`は図形固有の頂点構造を意識せず`setVertex`/`translate`へポリモーフィックに委譲する（`core/`側にshapeの内部プロパティ名を持ち込まない）。図形の生成は`ShapeFactory.create`へ完全委譲。`deleteShapes`は削除したidを選択集合・ホバーからも除去。`moveShapes`/`deleteShapes`の変更通知は1操作につき1回。
*   **CanvasManager.js**: Canvasへの純粋な描画（状態を持たない）。`render(shapes, { hoveredId, selectedIds, draftLine, selectionRect, view })`。`view`とdprを合成した描画変換を毎フレーム`setTransform`で設定。図形より先にワールド座標上の背景グリッド（細線10/太線100、画面上8px未満なら10倍ずつ繰り上げ、線幅は画面上1px一定、可視範囲のみ）を描く。描画順は「背景グリッド → 全図形の`draw`（＋`drawHover`）→ 選択集合の`drawHandles` → `draftLine` → 選択矩形」。線幅・破線は`÷ scale`で画面上一定。`ViewTransform`はimportしない。
*   **InputTracker.js**: ユーザー入力の解釈とModel・ビュー変換への反映、状態依存の操作（一括削除・取消・全選択）の公開、カーソル形状。図形種別のif/switch分岐は一切行わず、ポリモーフィック呼び出しのみ。`IDLE`/`DRAWING`/`DRAGGING_HANDLE`/`MOVING_SELECTION`/`MARQUEE_SELECTING`の5状態。`setMode(mode)`は選択集合/ホバーのクリアと進行中操作の強制中断（ドラッグセッションの中断・範囲選択の破棄・IDLE復帰）を伴う。`setShapeType(type)`は作成途中の図形のみ破棄。未知の値は`console.warn`のうえ無視。定数`OperationMode`/`SHAPE_TYPES`をexport。テキスト入力中判定`isTextInputElement(element)`をexport（`input`はテキスト系`type`のみ、`textarea`・`contenteditable`は真、`select`は対象外）。
*   **KeyboardShortcuts.js**（変更しない）: 図形種別のエントリは`SHAPE_TYPES`の並びから生成する（並び＝図形パレットの並び順が前提）。`InputTracker.js`からは定数`OperationMode`/`SHAPE_TYPES`と関数`isTextInputElement`のみをimport。テキスト入力中・ドラッグ中は受け付けない。
*   **ShapeFactory.js**: 図形typeに応じたインスタンス生成を一元的に担うFactory。`create(type, x1, y1, x2, y2)`は`'line' | 'curve' | 'arc' | 'rect' | 'circle'`を受理（`circle`/`arc`→`Ellipse`）。未知の`type`は`Error`をthrow。`core/`層で図形種別のif/switch分岐を許容する唯一の例外モジュール。
*   **WindowManager.js**（変更しない）: `.float-window`の動的検知（コンストラクタ時点のDOMのみ）、ドラッグ移動・最前面化・イベント遮断（`mousedown`/`click`/`mousemove`/`mouseup`の`stopPropagation`）。
*   **shapes/**: `Line`/`Curve`/`Rect`/`Ellipse`は同一シグネチャの10メソッド（`draw`、`drawHandles`、`drawHover`、`hitTest`、`hitTestHandle`、`setVertex`、`translate`、`updateDraftEnd`、`getVertexIndexForHandle`、`intersectsRect`）を自律実装し、この契約を満たす限り`core/`層を変更せずに組み込める。座標はすべてワールド座標。頂点：`Line`は`x1, y1`=始点／`x2, y2`=終点、`Curve`は`points[0]`=始点／`[1]`=制御点／`[2]`=終点、`Rect`は`[0]`=topLeft／`[1]`=topRight／`[2]`=bottomRight／`[3]`=bottomLeft、`Ellipse`は`[0]`=中心／`[1]`=右端制御点／`[2]`=上端制御点／`[3]`=開始角制御点／`[4]`=終了角制御点（内部の`type`（`'circle'`|`'arc'`）で振る舞いを分岐）。
*   **palette/PaletteController.js**: 図形選択パレット（5ボタン）の配線を担う自己完結UI部品。`InputTracker`へ直接依存せず、汎用コールバック`onTypeSelected(type)`を受け取る。`setEnabled(enabled)`で`.disabled`制御、`setActiveType(type)`で`.active`の排他制御。操作モードの知識は持たない。`VectorModel`・図形データ・選択状態には一切関与しないDOM操作専任のクラス。
*   **io/**（未実装）: `CodeExporter.js`（ゲーム向けJS出力）・`CodeImporter.js`（再ロード）。本作業の対象外。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章 フォルダ構造**: `io/`に`DocumentSerializer.js`、`palette/`に`DevPanel.js`を追加。
*   **2章 データ構造**: 全図形クラスが`type`プロパティ（図形種別。`ShapeFactory`の受理文字列と一致）を持つ旨へ更新（「`type`を持つのは`Ellipse`のみ」を削除）。図形データ（`{type, id, points, strokeColor, strokeWidth}`。`Line`も`points`2点）と作業データ形式（`{format: "oz-vector-editor", version, shapes}`。保存対象は図形データのみ）の概要を追記。
*   **3章 描画・操作フロー**: 描画順へ「軸線・原点マーク」を追加。起動処理に`?dev`時の`DevPanel`生成を追記。
*   **4章 index.html**: 確認用ウィンドウ`#window-dev-panel`（`hidden`で初期非表示、`?dev`時のみ表示、`textarea`・結果表示のみ`user-select: text`）を追記。パレットボタンのidが`palette-${type}`規則で`PaletteController`に照合される旨を追記。
*   **4章 main.js**: `SHAPE_TYPES`を`ShapeFactory.js`からimportして`PaletteController`へ渡す旨、`?dev`判定と`DevPanel`の配線（`onExport`/`onImport`。復元は`abortOngoingOperation()`→`replaceAllShapes()`の順、UI同期は`model.onChange`経路のみ）を追記。
*   **4章 VectorModel.js**: `replaceAllShapes(shapes)`（全図形の入れ替え、選択集合・ホバー・作成中の図形・選択矩形のクリア、通知1回、引数配列を流用しない、id正規化と`#nextId`の繰り上げ、戻り値は振り直し件数）と、id採番規則（`shape-<連番>`。知識は`VectorModel`内に閉じる）を追記。`startDraft`の既定種別が`SHAPE_TYPES[0]`である旨。（タスク6追記）「図形idの採番（連番）は`commitDraft()`実行時に行う」を「採番はprivate`#issueId()`に一本化（`commitDraft()`・`replaceAllShapes()`の振り直し）。`#nextId`は単調増加で減らさない」へ更新。`replaceAllShapes`は進行中の入力操作を中断しない（呼び出し側が先に`InputTracker.abortOngoingOperation()`を呼ぶ）旨と、振り直し時は受け取ったインスタンスの`id`を直接書き換える旨を記載。
*   **4章 CanvasManager.js**: 描画順を「背景グリッド → 軸線・原点マーク → 全図形 → …」へ更新し、軸線・原点マークの仕様（画面上1px・12px十字＋円、`÷ scale`、可視範囲のみ）を追記。（タスク7追記）可視範囲の計算はprivate`#getVisibleWorldBounds()`に一本化され、背景グリッドと原点表示が共用する旨（描画変換の設定後に呼ぶ・回転を含まない変換が前提）、原点表示の色は軸線`rgba(0, 0, 0, 0.32)`・原点マーク`rgba(0, 0, 0, 0.6)`である旨、先頭責務の「原点表示」追加を記載。
*   **4章 InputTracker.js**: `SHAPE_TYPES`は`ShapeFactory.js`からの再exportである旨。状態依存の公開メソッドに`abortOngoingOperation()`（常に受理・進行中操作の中断のみ・Phase 03-02でも再利用）を追記し、`setMode`がこれと同じ中断処理を使う旨。（タスク6追記）`setMode(mode)`の記述を「進行中操作の中断（`abortOngoingOperation`と共通のprivate`#abortOngoingOperation()`）→ モード更新 → 選択集合・ホバーのクリア → カーソル再評価」の処理順へ更新。`abortOngoingOperation()`は操作モード・図形種別・選択集合・ホバー・スペース押下状態を変更せず、戻り値は何かを中断したか（`boolean`）である旨。責務定義の「状態依存の操作」に「進行中操作の中断」が加わった旨。
*   **4章 ShapeFactory.js**: `switch`から対応表`SHAPE_REGISTRY`（種別一覧の正本。並び＝パレット順）への変更、`SHAPE_TYPES`のexport、`fromJSON(data)`（未知の`type`・オブジェクトでないデータで`Error`。捕捉しない）の追加、「図形種別の対応づけを許容する唯一の例外」の表現への更新。（タスク3追記）`ShapeFactory`は`shapes/`以外の`core/`モジュールをimportしない（`InputTracker`が`ShapeFactory`をimportするため、逆向きは循環importとなる）旨の依存制約を記載。
*   **4章 shapes/**: 10メソッド契約 → 12メソッド契約（`toJSON()`・`static fromJSON(data)`）へ更新。図形データの形、`fromJSON`のthrow条件、`id`は検証しない旨、独立性（内部配列を共有しない）、`Ellipse`の角度は保存しない旨を追記。
*   **4章 palette/PaletteController.js**: `#BUTTON_DEFS`廃止、コンストラクタ引数`shapeTypes`、id規則`palette-${type}`、不一致時の`console.warn`を反映。（タスク4追記）照合はコンストラクタ実行時の1回・ルート要素内の`[id^="palette-"]`要素のみが対象で、パレット内の種別ボタン以外に`palette-`接頭辞のidを使うと警告される旨、`PaletteController`はimportを持たず種別一覧を注入で受け取る旨を記載。
*   **4章 palette/DevPanel.js（新設）**: 責務（確認用ウィンドウのDOM操作専任。`onExport`/`onImport`コールバックを呼び結果を表示。Model・InputTracker・DocumentSerializer・図形データに依存しない）。
*   **（タスク9追記）**：JSDocの補完（クラスJSDoc・`VectorModel`のコンストラクタ）はコメントのみで、開発資料の記載内容に影響する変更はない。
*   **（タスク10追記）実装中の判明事項のうち、上記に未記載だったもの**：
    *   **2章 データ構造**：`fromJSON`直後の図形の`id`は未検証（欠落なら`undefined`、任意の型を取り得る）で、`VectorModel.replaceAllShapes`の正規化を経て初めて`shape-<連番>`等の一意な文字列になる旨（懸念事項C-13）。
    *   **4章 shapes/（タスク1・2の補足）**：`fromJSON`のエラーメッセージは「`クラス名.fromJSON: 理由`」形式の日本語である旨。頂点数は各ファイルのモジュール定数（`LINE_POINT_COUNT`等）で持つ旨。`strokeWidth`は0以下・非有限を不正とする旨（C-5）。`Rect`は4頂点を独立に採用し軸平行へ再計算しない旨（C-19）、`Ellipse`は`points[3]`/`[4]`を再計算せず、`type`検証用に自分自身の種別一覧`ELLIPSE_TYPES`を持つ旨（C-17）。4図形のクラスJSDocが12メソッド契約を列挙している旨（契約の増減時は追従が必要）。
    *   **4章 ShapeFactory.js（補足）**：`create()`のエラーメッセージは従来の英語、`fromJSON()`は日本語であり、意図的に混在している旨（C-24）。図形種別の追加手順（対応表へ1エントリ＋`index.html`へ`#palette-<type>`ボタン）（C-27）。
    *   **4章 palette/DevPanel.js（タスク8の補足）**：結果表示の文言（成功「復元した図形：n個／振り直したid：n件／スキップ：n件」＋各行「#index type: reason」、失敗「読み込み失敗：理由（キャンバスは変更していません）」、変換「JSONへ変換しました」）、要素が1つでも欠ければ一切配線しない旨、コールバックの例外を捕捉しない旨（C-47・C-48）。
    *   **4章 main.js（タスク8の補足）**：確認用ウィンドウの配線は番号「9」で、キーボードショートカット配線（8）の直後・起動時初期化の前に置く旨（C-50）。
    *   **4章 index.html（補足）**：フロートウィンドウの`×`ボタンは全ウィンドウとも無機能である旨（C-46）。
    *   **3章 キーボード操作（既知の挙動）**：テキスト入力欄にフォーカス中は`Ctrl`+`+`/`-`/`0`がブラウザのページズームになる旨、および中ボタンでのパンではテキスト入力欄のフォーカスが外れずショートカットが無効のままになる旨（B-5・B-6）。テキスト入力欄の追加時の確認項目としてB-1〜B-11を参照できる旨。
*   **4章 io/DocumentSerializer.js（新設）**: 責務（作業データ形式のシリアライズ・デシリアライズ、マイグレーション表、結果オブジェクト、図形単位の例外捕捉の唯一の箇所）。`io/`の「（未実装）」表記を更新。（タスク5追記）全体の読み込み失敗の条件に「マイグレーション関数の戻り値がプレーンオブジェクトでない」を含める旨、importは`ShapeFactory`のみ（依存方向`io → core → shapes`）である旨、デシリアライズ系のみ例外をthrowしない（`serialize`系は入力を検証しない）旨を記載。

## 3. タスクリスト
*   [x] タスク1: `Line`・`Curve`に`type`プロパティと`toJSON`/`fromJSON`を追加
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` : 更新
        *   `./js/shapes/Curve.js` : 更新
    *   **作業内容** :
        *   コンストラクタで`this.type = 'line'`／`'curve'`を設定（JSDoc：図形種別。`ShapeFactory`の受理文字列と一致）。`Line`の内部表現`x1..y2`は変更しない。
        *   `toJSON()`を追加：`{ type, id, points, strokeColor, strokeWidth }`の新しいオブジェクトを返す（`Line`は`[{x: x1, y: y1}, {x: x2, y: y2}]`を組み立てる。`Curve`は`points`を`map(p => ({ x: p.x, y: p.y }))`で複製）。
        *   private static検証ヘルパー（例：`static #validateData(data)`）と`static fromJSON(data)`を追加：「2. 要件2」のthrow条件1〜6（頂点数：`Line`=2、`Curve`=3）。`id`は検証せずそのまま保持。`data`内の配列・オブジェクトを流用しない。
        *   JSDoc：図形データの形（プロパティと頂点の並び）、`fromJSON`のthrow条件、`id`を検証しない理由、独立性、往復の一致を明記。`@returns`/`@throws`を記述。新規JSDocは「ワールド座標」で記述（既存の「論理座標系」表記はNon-goalのため触らない）。
        *   先頭の責務JSDocへ「図形データとの相互変換」を追記（3行以内）。
        *   この時点では呼び出し元がないため、既存の作成・選択・編集の挙動は変わらないことを確認する。
*   [x] タスク2: `Rect`・`Ellipse`に`type`プロパティと`toJSON`/`fromJSON`を追加
    *   **対象ファイル** :
        *   `./js/shapes/Rect.js` : 更新
        *   `./js/shapes/Ellipse.js` : 更新
    *   **作業内容** :
        *   `Rect`：コンストラクタで`this.type = 'rect'`。`toJSON()`・検証ヘルパー・`static fromJSON(data)`をタスク1と同じ規約で追加（頂点数4）。
        *   `Ellipse`：既存の`type`（`'circle'`|`'arc'`）の意味・値は変えず、JSDocを「図形種別。`'circle'`|`'arc'`で振る舞いも分岐する」へ更新。`toJSON()`は`startAngle`/`endAngle`を出力しない。`fromJSON(data)`は`type`が`'circle'`|`'arc'`以外ならthrow、頂点数5を検証し、`new Ellipse(中心x, 中心y, 中心x, 中心y, data.type, strokeColor, strokeWidth)`で角度を`type`から求めたうえで`points`5点を`data`の値から新規オブジェクトとして設定する（`points[3]`/`[4]`も再計算しない）。
        *   JSDoc：タスク1と同様。`Ellipse`は「角度は保存しない（弧の角度編集の実装時に保存対象へ加え版番号を上げる）」旨と、`points[3]`/`[4]`を再計算しない理由を明記。
        *   先頭の責務JSDocへ「図形データとの相互変換」を追記（3行以内）。
*   [x] タスク3: `ShapeFactory`の対応表化・`SHAPE_TYPES`の正本化・`fromJSON`の追加と、`InputTracker`の再export
    *   **対象ファイル** :
        *   `./js/core/ShapeFactory.js` : 更新
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `ShapeFactory.js`：「2. 要件1(b)」の`SHAPE_REGISTRY`・`REGISTRY_BY_TYPE`・`export const SHAPE_TYPES`を追加し、`create()`を表引きへ置換（未知の`type`で`Error`をthrowする仕様は維持）。`static fromJSON(data)`を追加（プレーンオブジェクトでない／未知の`type`で`Error`。`try/catch`しない）。
        *   `ShapeFactory.js`の先頭責務JSDocを「図形種別一覧の正本（対応表）と、種別に応じたインスタンス生成・図形データからの復元の振り分けを一元的に担う。`core/`層で図形種別の対応づけを許容する唯一の例外。」の趣旨へ更新（3行以内）。`create`の`@param type`の列挙を「`SHAPE_TYPES`のいずれか」へ変更。
        *   `InputTracker.js`：`SHAPE_TYPES`の自前定義を削除し、`import { SHAPE_TYPES } from './ShapeFactory.js';`＋`export { SHAPE_TYPES };`で再export（JSDocに「正本は`ShapeFactory.js`。既存のimport元（`KeyboardShortcuts.js`）を変えないための再export」と記載）。`currentShapeType`の初期値を`SHAPE_TYPES[0]`へ。JSDocの種別列挙（`'line'|'curve'|…`）を`string`（`SHAPE_TYPES`のいずれか）へ置換。
        *   **同一タスク内で完結させ、中間状態を作らない**（`KeyboardShortcuts.js`は無変更で、数字キー1〜5の割り当てが従来と同じであることを確認する）。
        *   タスク完了時点で、作成5種・数字キー・パレットが従来どおり動くことを確認する。
*   [x] タスク4: `PaletteController`の種別一覧の受け取りと整合警告、`main.js`からの受け渡し
    *   **対象ファイル** :
        *   `./js/palette/PaletteController.js` : 更新
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   `PaletteController`：`#BUTTON_DEFS`を廃止し、`constructor(paletteRootElement, shapeTypes, onTypeSelected)`へ変更。`palette-${type}`でボタンを解決し、見つからない種別、および種別一覧にない`[id^="palette-"]`要素を`console.warn`で報告（配線はしない）。`setActiveType`の`@param`の列挙を`string`へ。先頭責務JSDoc・クラスJSDocの「5ボタン」等の固定数表記を「図形種別一覧に対応するボタン」へ更新。
        *   `main.js`：`import { SHAPE_TYPES } from './core/ShapeFactory.js';`を追加し、`new PaletteController(shapePaletteEl, SHAPE_TYPES, applyShapeType)`へ変更。`applyMode`/`applyShapeType`のJSDocの種別列挙を`string`へ置換。
        *   **コンストラクタのシグネチャ変更と呼び出し元を同一タスクで変更する**（中間状態を作らない）。
        *   警告が通常起動時に1件も出ないこと（`index.html`の既存idが規則に一致していること）を確認する。
*   [x] タスク5: `DocumentSerializer`（作業データ形式・マイグレーション・結果オブジェクト）の新設
    *   **対象ファイル** :
        *   `./js/io/DocumentSerializer.js` : 新規
    *   **作業内容** :
        *   先頭に単一責務JSDoc（3行以内）：作業データ形式のシリアライズ・デシリアライズと旧版からのマイグレーションを担い、図形単位の変換は`ShapeFactory`・図形クラスへ委譲する。
        *   定数`DOCUMENT_FORMAT`・`CURRENT_DOCUMENT_VERSION`・`MIGRATIONS`（空の凍結オブジェクト）と、静的メソッド`serialize`/`serializeToString`/`deserialize`/`deserializeFromString`を「2. 要件3」のとおり実装。図形種別の分岐・図形固有プロパティ名を持たない（要素の`type`読み取りはスキップ記録用のみ）。
        *   図形単位の`try/catch`は`deserialize`内の1箇所のみ。`JSON.parse`の失敗、マイグレーションの失敗も結果オブジェクトへ変換し、例外をthrowしない。スキップ・全体失敗時に`console.warn`。
        *   JSDoc：作業データ形式の最上位の形と版番号、全体の読み込み失敗の条件、`DeserializeResult`の`@typedef`、マイグレーション関数の契約（版nを受け取り版n+1の新しいオブジェクトを返す）、**版を追加する手順**（①`MIGRATIONS`追加 ②現行版定数の更新 ③図形クラスの`toJSON`/`fromJSON`更新）を明記。
        *   この時点では呼び出し元がないため、既存の挙動は変わらない。
*   [x] タスク6: `VectorModel`の図形一式の入れ替え・id採番と、`InputTracker`の進行中操作の中断手段
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` : 更新
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `VectorModel`：id形式の定数（`shape-`）とprivate`#issueId()`を新設し、`commitDraft()`の採番をこれに置換（挙動同一）。`replaceAllShapes(shapes)`を「2. 要件5」の手順1〜7で実装。`startDraft`の既定引数を`SHAPE_TYPES[0]`（`ShapeFactory.js`からimport）へ。
        *   `VectorModel`のJSDoc：idの採番規則（`shape-<連番>`、`#nextId`は減らさない、保持idの判定と振り直し規則、重複時は後に出現した方を振り直す）、入れ替え時にクリアされる状態（選択集合・ホバー・作成中の図形・選択矩形）、通知1回、引数配列を流用しない、戻り値。`#nextId`のJSDocに繰り上げ規則を追記。
        *   `InputTracker`：`setMode`の強制中断処理をprivate`#abortOngoingOperation()`へ抽出し、公開`abortOngoingOperation()`を新設（「2. 要件5」の受理条件・中断対象・非変更対象・戻り値・Phase 03-02での再利用をJSDocに明記）。`setMode`のJSDocを処理順の変更に合わせて更新。先頭責務JSDocの「状態依存の操作（一括削除・取消・全選択）」に「進行中操作の中断」を追加（3行以内）。
        *   タスク完了時点で、モード切替（ボタン・V/P/H）時の作成途中の図形の破棄・ドラッグ中断・範囲選択の破棄が従来どおりであることを確認する。
*   [x] タスク7: `CanvasManager`の軸線・原点マークの描画
    *   **対象ファイル** :
        *   `./js/core/CanvasManager.js` : 更新
    *   **作業内容** :
        *   定数`ORIGIN_AXIS_COLOR`・`ORIGIN_MARK_COLOR`・`ORIGIN_MARK_SIZE`（12）・`ORIGIN_MARK_RADIUS`（3）をJSDoc付きで追加。
        *   可視範囲の計算を`#getVisibleWorldBounds()`へ抽出して`#drawGrid`から使用（グリッドの描画結果は不変）。`#drawOrigin(view)`を`#drawGrid`の隣に新設し、`render()`でグリッドの直後・図形の前に呼ぶ（「2. 要件7」の仕様）。`save()`/`restore()`でスタイルを残さない。状態を持たない。
        *   `render()`のJSDocの描画順、先頭責務JSDoc（「背景グリッド・原点表示・選択矩形を含む」）を更新。
*   [x] タスク8: 確認用ウィンドウ（`DevPanel`）の新設と`index.html`・`main.js`の配線
    *   **対象ファイル** :
        *   `./js/palette/DevPanel.js` : 新規
        *   `./index.html` : 更新
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   `index.html`：「2. 要件6」の`#window-dev-panel`（`hidden`、`float-window`、ヘッダー＋本体）と、スタイル（`#window-dev-panel`の初期位置・幅、`#dev-json`・`#dev-result`の体裁と`user-select: text`）を追加。`.float-window`の既存指定は変更しない。
        *   `DevPanel.js`：先頭に単一責務JSDoc（確認用ウィンドウのDOM操作専任。変換・復元は注入されたコールバックへ委譲）。`constructor(rootElement, { onExport, onImport })`・`show()`・結果表示の整形（private）を実装。`ImportSummary`の`@typedef`を定義。`VectorModel`・`InputTracker`・`DocumentSerializer`・図形インスタンスを参照しない。
        *   `main.js`：`DocumentSerializer`・`DevPanel`をimport。`?dev`判定（`URLSearchParams(...).has('dev')`）のときのみ`DevPanel`を生成・表示し、`onExport`/`onImport`を「2. 要件6」のとおり注入（復元は成功時のみ`inputTracker.abortOngoingOperation()`→`model.replaceAllShapes()`。再描画・削除ボタン同期は`model.onChange`経路のみ。`window`へ公開しない）。配線箇所に番号付きコメント（「9. 開発者向け確認用ウィンドウ配線」）を付与。
        *   テキスト入力中の誤作動防止（懸念事項の確認項目B）と、`textarea`での範囲選択・コピー・貼り付けを確認する。確認できなかった項目は懸念事項へ記載する。
*   [x] タスク9: JSDocの記載漏れ確認
    *   **対象ファイル** :
        *   タスク1〜8の変更・新規ファイル全て : 確認（必要に応じ更新）
    *   **作業内容** :
        *   改修対象の全`.js`ファイルの先頭責務JSDoc（3行以内）が改修後の実態と一致していることを確認。
        *   次の事項がJSDocから読み取れることを確認：図形データの形式（プロパティと頂点の並び）／`fromJSON`が`Error`をthrowする条件／作業データ形式の最上位の形と版番号／マイグレーションの追加手順／デシリアライズ結果の形／idの採番規則／図形一式の入れ替え時にクリアされる状態／`abortOngoingOperation`の名称・受理条件。
        *   図形種別の文字列一覧が`ShapeFactory.js`の対応表以外（コメント含む。`shapes/`の自分自身の値と`index.html`の静的ボタンを除く）に残っていないことを検索で確認。
*   [x] タスク10: 作業レポートの完成
    *   **対象ファイル** :
        *   `./_log/res/261102_0003_RES_Phase03-01_Serialization_Contract.md` : 更新
    *   **作業内容** :
        *   「4. 詳細作業内容」の各タスク欄を記入し、「開発資料の更新予定」「懸念事項・要確認ポイント」に実装中の判明事項を追記して完成させる。
*   [x] タスク11: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映（固定タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
    *   **作業内容** :
        *   「開発資料の更新予定」に記録した内容（1章・2章・3章・4章の各項目）を確認し、資料へ反映する。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止であるが、**この最終タスクのみ明示的な例外**とする（後続タスクが存在せず、他タスクの前提が動く危険がないため）。個別の実装タスク内で資料を書き換えてはならない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: `Line`・`Curve`に`type`プロパティと`toJSON`/`fromJSON`を追加
*   **作業内容** :
    *   `js/shapes/Line.js`・`js/shapes/Curve.js`共通
        *   先頭の責務JSDocに「図形データとの相互変換」を追記（`Line`は1行、`Curve`は2行で3行以内）。
        *   頂点数のモジュール定数（`LINE_POINT_COUNT = 2`／`CURVE_POINT_COUNT = 3`、JSDoc付き）を追加。
        *   コンストラクタの先頭で`this.type = 'line'`／`'curve'`を設定（JSDoc：図形種別。`ShapeFactory`が受理する文字列と一致）。`Line`の内部表現`x1..y2`は変更なし。
        *   `toJSON()`をクラス末尾に追加：`{ type, id, points, strokeColor, strokeWidth }`（キー順固定）の新しいオブジェクトを返す。`Line`は`x1..y2`から2点を新規に組み立て、`Curve`は`points.map(p => ({ x: p.x, y: p.y }))`で複製。`id`が`null`でもそのまま出力。
        *   `static fromJSON(data)`を追加：`#validateData`で検証後、`Line`は`new Line(始点, 終点, strokeColor, strokeWidth)`で生成、`Curve`は始点・終点で仮生成した後に`points`3点を`data`の座標値から新規オブジェクトとして設定し直す。`id`は検証せず`data.id`をそのまま代入（欠落なら`undefined`）。`try/catch`は持たない。
        *   private staticヘルパー`static #validateData(data)`を追加：要件2のthrow条件1〜6を判定し、「`クラス名.fromJSON: 理由`」形式の日本語メッセージで`Error`をthrow（例：`Line.fromJSON: pointsが2要素の配列ではありません`）。頂点の判定は「`null`・配列以外のオブジェクト かつ `x`/`y`が`Number.isFinite`」。余分なプロパティは無視。
        *   JSDoc：図形データの形（キー順・頂点の並び）、契約メソッド番号（第11・第12）、ワールド座標、独立性（内部配列・頂点を共有しない）、`id`を検証しない理由（id規則は`VectorModel`の責務）、往復の一致、`@returns`/`@throws`（throw条件の列挙）、`strokeWidth`の0以下を不正とする理由、例外を捕捉しない旨（捕捉は`DocumentSerializer`）を記述。既存JSDocの「論理座標系」表記は変更していない。
    *   確認（Node.jsでESモジュールとして直接import。リポジトリ外の一時スクリプトで実施し、成果物には含めない）
        *   `JSON.stringify(shape)` → `JSON.parse` → `fromJSON` → `JSON.stringify`の往復で文字列が完全一致（`Line`、制御点を動かした`Curve`の双方）。
        *   `toJSON()`の戻り値・`fromJSON`の入力を書き換えても、元の図形・復元した図形に影響しないこと（独立性）。
        *   `null`／配列／数値／種別違い／頂点数不足／座標が文字列／頂点が`null`／`strokeColor`が数値／`strokeWidth`が0 の各入力で、想定どおりのメッセージの`Error`がthrowされること。`id`欠落・余分なプロパティ付きでは復元でき、`id`が`undefined`・`type`が`'line'`となること。
        *   既存メソッドは無変更で、`fromJSON`/`toJSON`の呼び出し元もまだ存在しないため、作成・選択・編集の挙動は変わらない（ブラウザでの目視確認は未実施。追加されたのは`type`プロパティのみで、既存コードは参照していない）。

### タスク2: `Rect`・`Ellipse`に`type`プロパティと`toJSON`/`fromJSON`を追加
*   **作業内容** :
    *   `js/shapes/Rect.js`
        *   先頭の責務JSDocに「図形データとの相互変換」を追記（2行）。頂点数のモジュール定数`RECT_POINT_COUNT = 4`（JSDoc付き）を追加。
        *   コンストラクタの先頭で`this.type = 'rect'`を設定（JSDoc：図形種別。`ShapeFactory`が受理する文字列と一致）。
        *   `toJSON()`・`static fromJSON(data)`・`static #validateData(data)`をタスク1（`Curve`）と同じ規約・同じメッセージ形式でクラス末尾に追加（頂点数4、種別`'rect'`）。`fromJSON`はtopLeft・bottomRightで仮生成後、4頂点を`data`の座標値から新規オブジェクトとして設定し直す（4頂点は独立して編集され得るため軸平行矩形としての再計算はしない旨をJSDocに明記）。
    *   `js/shapes/Ellipse.js`
        *   先頭の責務JSDocに「図形データとの相互変換」を追記（2行）。モジュール定数`ELLIPSE_POINT_COUNT = 5`と、`type`検証用の`ELLIPSE_TYPES = Object.freeze(['circle', 'arc'])`（いずれもJSDoc付き）を追加。
        *   既存の`this.type = shapeType`は値・意味とも変更せず、JSDocを「図形種別（`ShapeFactory`が受理する文字列と一致）。'circle'|'arc'で振る舞いも分岐する。」へ更新（従来の「内部判定でのみ用いる」を削除）。
        *   `toJSON()`を追加：`startAngle`/`endAngle`は出力しない（JSDocに「`type`から決まる固定値のため。弧の角度編集の実装時に保存対象へ加え版番号を上げること」を明記）。
        *   `static fromJSON(data)`を追加：`#validateData`で`type`が`'circle'`|`'arc'`以外・頂点数5以外などを検出してthrow。`new Ellipse(中心x, 中心y, 中心x, 中心y, data.type, strokeColor, strokeWidth)`で角度を`type`から求めたうえで、5頂点を`data`の座標値から新規オブジェクトとして設定（`points[3]`/`[4]`も再計算しない。理由をJSDocに明記）。`id`はそのまま代入。
        *   `static #validateData(data)`を追加（メッセージ形式「`Ellipse.fromJSON: 理由`」）。
    *   確認（Node.jsでESモジュールとして直接import。リポジトリ外の一時スクリプトで実施し、成果物には含めない）
        *   `Rect`（頂点を個別に動かし平行移動したもの）、`Ellipse`の`'circle'`・`'arc'`（半径変更・平行移動したもの）それぞれで、`JSON.stringify` → `JSON.parse` → `fromJSON` → `JSON.stringify`の往復で文字列が完全一致。復元後の`type`・`startAngle`/`endAngle`・`hitTest`・`hitTestHandle`・`intersectsRect`の結果が元の図形と一致。`toJSON()`に`startAngle`が含まれないこと。
        *   `Ellipse`の`points[4]`を任意値に書き換えた図形データから復元すると、その値がそのまま保持されること（再計算しない）。
        *   独立性：`toJSON()`の戻り値を書き換えても元図形が変わらない／`fromJSON`の入力を書き換えても復元図形が変わらない／復元図形を`translate`しても入力が変わらない。
        *   `null`／配列／数値／文字列／種別違い（`Ellipse`に`'line'`・`'rect'`）／頂点数不足／`points`がオブジェクト／座標が文字列・`NaN`／頂点が`null`・配列／`strokeColor`が数値／`strokeWidth`が0・負・`Infinity` の各入力で、「`クラス名.fromJSON: `」で始まるメッセージの`Error`がthrowされること。`id`欠落・余分なプロパティ付きでは復元でき、`id`が`undefined`・`type`が元の値となること。
        *   既存メソッドは無変更で、`fromJSON`/`toJSON`の呼び出し元もまだ存在しないため、作成・選択・編集の挙動は変わらない（ブラウザでの目視確認は未実施。`Rect`に追加されたのは`type`プロパティのみで、既存コードは参照していない。`Ellipse`はJSDocの変更のみ）。

### タスク3: `ShapeFactory`の対応表化・`SHAPE_TYPES`の正本化・`fromJSON`の追加と、`InputTracker`の再export
*   **作業内容** :
    *   `js/core/ShapeFactory.js`
        *   先頭の責務JSDocを「図形種別一覧の正本（対応表）と、種別に応じたインスタンス生成・図形データからの復元の振り分けを一元的に担うFactory。`core/`層で図形種別の対応づけを許容する唯一の例外。」へ更新（2行）。
        *   対応表1エントリの`@typedef ShapeRegistryEntry`（`type`／`create`／`fromJSON`）を追加。
        *   要件1(b)のとおり、凍結済みの`SHAPE_REGISTRY`（並び：line・curve・arc・rect・circle＝パレット順＝数字キー順）、非公開の検索用`REGISTRY_BY_TYPE`（`Map`）、`export const SHAPE_TYPES`（対応表から導出・凍結）をモジュールスコープに追加。各定数にJSDoc（並び順の前提、種別追加時の手順＝対応表へ1エントリ＋`index.html`に`#palette-${type}`）を記述。
        *   `create()`の`switch`を`REGISTRY_BY_TYPE.get(type)`による表引きへ置換。未知の`type`で`Error`をthrowする仕様・メッセージ（`ShapeFactory: unknown shape type "…"`）は従来のまま。`@param type`の列挙を「`SHAPE_TYPES`のいずれか」へ変更。
        *   `static fromJSON(data)`を追加：`data`がプレーンオブジェクト（`null`・配列以外の`object`）でなければ`ShapeFactory.fromJSON: 図形データがオブジェクトではありません`、`data.type`が未登録なら`ShapeFactory.fromJSON: 未知の図形種別です: <type>`の`Error`をthrow。登録済みならエントリの`fromJSON`（各図形クラスの`static fromJSON`）へ委譲。`try/catch`は持たない（捕捉は`DocumentSerializer`の1箇所である旨をJSDocに明記）。
    *   `js/core/InputTracker.js`
        *   `SHAPE_TYPES`の自前定義を削除し、`import { SHAPE_TYPES } from './ShapeFactory.js';`（import群の末尾）と、旧定義位置での`export { SHAPE_TYPES };`による再exportへ置換。JSDocに「正本は`ShapeFactory.js`。既存のimport元（`KeyboardShortcuts.js`）を変えないための再export」と用途（`setShapeType`の検証・初期値）を記載。
        *   `currentShapeType`の初期値を`'line'`→`SHAPE_TYPES[0]`へ（値は同じ`'line'`）。
        *   JSDocの種別列挙`'line'|'curve'|'arc'|'rect'|'circle'`（`currentShapeType`の`@type`、`setShapeType`の`@param`、`getShapeType`の`@returns`の3箇所）を`string`（説明文の「`SHAPE_TYPES`のいずれか」は維持）へ置換。`InputTracker.js`内に図形種別の文字列は残っていない（grepで確認）。
    *   `js/core/KeyboardShortcuts.js`は無変更（`git diff`で差分なしを確認）。
    *   確認（Node.jsでESモジュールとして直接import。リポジトリ外の一時スクリプトで実施し、成果物には含めない）
        *   `ShapeFactory.js`・`InputTracker.js`・`KeyboardShortcuts.js`を順にimportしてエラーなく評価されること（`KeyboardShortcuts`の最上位の`SHAPE_TYPES.map(...)`が値確定後に実行されること）。
        *   `ShapeFactory.SHAPE_TYPES`と`InputTracker.SHAPE_TYPES`が同一参照・凍結済みで、値が従来の`['line', 'curve', 'arc', 'rect', 'circle']`と完全一致。したがって数字キーの割り当ては従来どおり `1→line（直線）`／`2→curve（曲線）`／`3→arc（弧）`／`4→rect（矩形）`／`5→circle（円）`（`Digit`/`Numpad`とも）。
        *   5種すべてで`create()`が従来と同じクラス・`type`（`arc`/`circle`は`Ellipse`の該当種別）を生成し、`ShapeFactory.fromJSON(JSON.parse(JSON.stringify(shape)))`の`toJSON()`が元と一致。
        *   `fromJSON`に`null`／配列／数値／文字列 → 「オブジェクトではありません」、`type: 'triangle'`・`type`欠落 → 「未知の図形種別です」、`{ type: 'line', points: [] }` → `Line.fromJSON`のエラーがそのまま伝播。`create('triangle', …)`は従来どおりthrow。
        *   ブラウザでの目視確認（作成5種・数字キー・パレット）は未実施。上記のとおり生成結果・種別一覧の値と並びは従来と同一のため、挙動の変化はない想定（懸念事項C-21）。

### タスク4: `PaletteController`の種別一覧の受け取りと整合警告、`main.js`からの受け渡し
*   **作業内容** :
    *   `js/palette/PaletteController.js`
        *   静的対応表`#BUTTON_DEFS`を廃止。id接頭辞のモジュール定数`PALETTE_BUTTON_ID_PREFIX = 'palette-'`（JSDoc付き）を追加。
        *   コンストラクタを`constructor(paletteRootElement, shapeTypes, onTypeSelected)`へ変更（`@param {ReadonlyArray<string>} shapeTypes`：正本は`ShapeFactory.js`の`SHAPE_TYPES`）。ルート要素内の`[id^="palette-"]`要素を`querySelectorAll`で一度だけ集めてidをキーとする`Map`にし、`shapeTypes`の並び順に`palette-${type}`を引いて配線する（`querySelector`用のCSSセレクタ文字列を種別名から組み立てないため、種別名にセレクタの特殊文字が含まれても誤動作しない）。
        *   不整合の`console.warn`（いずれも配線しない）：①種別一覧にあるのにボタンが見つからない種別（`PaletteController: 図形種別 "<type>" のボタン（#palette-<type>）が見つかりません。この種別は配線しません。`）②ルート要素内にあって種別一覧で消費されなかった`palette-`要素（`PaletteController: 要素 #<id> は図形種別一覧にありません。配線しません。`）。従来の「見つからないボタンを静かに除外する」挙動を置き換えた。
        *   `#buttons`は種別一覧の並び順で配線済みボタンのみを保持（JSDocを更新）。`setActiveType`の`@param`を`{string}`（`SHAPE_TYPES`のいずれか）へ変更し、本文・JSDocの「5ボタン」表記を「配線済みボタン」「すべてのボタン」へ置換。
        *   先頭の責務JSDoc（3行のまま）の「5ボタン」を「図形種別一覧に対応するボタン」へ、クラスJSDocに「種別一覧は注入される（InputTracker・ShapeFactoryへ直接依存しない）」旨を追記。`PaletteController.js`はimportを一切持たない（従来どおり）。
    *   `js/main.js`
        *   `import { SHAPE_TYPES } from './core/ShapeFactory.js';`を追加し（`InputTracker.js`の再exportではなく正本から直接）、`new PaletteController(shapePaletteEl, SHAPE_TYPES, applyShapeType)`へ変更（直前に「正本から渡す・id`palette-${type}`で照合」の1行コメントを追加）。
        *   `applyShapeType`のJSDoc：`@param`の種別列挙を`{string}`（`SHAPE_TYPES`のいずれか）へ、「パレット5ボタン」を「パレットの各図形種別ボタン」へ置換。`main.js`・`PaletteController.js`内に図形種別の文字列は残っていない（grepで確認）。
        *   `applyMode`の`@param {'select'|'create'|'pan'}`は操作モードの列挙であり図形種別ではないため変更していない（懸念事項C-25）。
    *   シグネチャ変更と呼び出し元（`main.js`の1箇所。`grep`で他に呼び出し元がないことを確認）を同一タスク内で変更し、中間状態は作っていない。`index.html`は無変更。
    *   確認（ローカルHTTPサーバー＋ブラウザで実施。ES Modulesのため）
        *   通常起動（リロード2回）で`console.warn`・エラーが1件も出ないこと（コンソール取得が機能していることは任意の`console.warn`で別途確認済み）。起動時に選択モードがアクティブ・パレットが`.disabled`・`#palette-line`がハイライトされていること。
        *   図形作成モードでパレットが活性化し、曲線→弧→矩形→円→直線の順にクリックすると、クリックしたボタン1つのみが`.active`になること。選択モードへ戻すと再び`.disabled`になること。
        *   不整合時の警告：`<button id="palette-line">`と`<button id="palette-star">`のみを持つ仮のルート要素に`shapeTypes = ['line', 'curve']`で生成すると、`curve`のボタン欠落と`#palette-star`の種別一覧外の2件が警告され、`palette-line`のclickのみがコールバックへ届き（`palette-star`は届かない）、`setActiveType('line')`が効くこと。
        *   図形の作成・ハンドル操作など描画を伴う目視確認は未実施（本タスクの変更はパレットの配線元のみで、同一のid・同一のコールバックを配線しているため）。

### タスク5: `DocumentSerializer`（作業データ形式・マイグレーション・結果オブジェクト）の新設
*   **作業内容** :
    *   `js/io/DocumentSerializer.js`（新規。`js/io/`フォルダも新設）
        *   先頭の責務JSDoc（2行）：「作業データ形式（キャンバス全体の版番号付きJSON表現）のシリアライズ・デシリアライズと旧版からのマイグレーションを担う。図形単位の変換はShapeFactory・図形クラスへ委譲する。」
        *   importは`ShapeFactory`（`../core/ShapeFactory.js`）のみ。依存方向は`io → core → shapes`の一方向で、循環importは生じない。
        *   モジュール定数（すべて非公開・JSDoc付き）：`DOCUMENT_FORMAT = 'oz-vector-editor'`、`CURRENT_DOCUMENT_VERSION = 1`（現行版の唯一の定義箇所）、`MIGRATIONS = Object.freeze({})`。`MIGRATIONS`のJSDocにマイグレーション関数の契約（版nを受け取り版n+1の新しいオブジェクトを返す・引数を書き換えない・変換不能時はthrow可＝全体失敗）と**版を追加する手順**（①`MIGRATIONS`追加 ②`CURRENT_DOCUMENT_VERSION`を+1 ③図形クラスの`toJSON`/`fromJSON`更新。旧版の知識は`MIGRATIONS`に閉じる）を記載。
        *   `@typedef`：`DocumentData`（作業データ最上位の形`{ format, version, shapes }`）、`SkippedShape`（`{ index, type, reason }`）、`DeserializeResult`（`{ ok, shapes, skipped, error }`）。
        *   静的メソッドのみのクラス`DocumentSerializer`（インスタンス状態なし・DOM非依存）：
            *   `serialize(shapes)`：`{ format, version, shapes: shapes.map(s => s.toJSON()) }`（キー順固定）。
            *   `serializeToString(shapes)`：`JSON.stringify(serialize(shapes), null, 2)`。
            *   `deserialize(documentData)`：要件3の処理順1〜6のとおり。全体失敗の各条件で`ok: false`の結果を返す。マイグレーションは`v = version`から`CURRENT_DOCUMENT_VERSION - 1`まで順に適用し、関数未定義（`MIGRATIONS`自身のプロパティのみ参照）・関数のthrow・**戻り値がプレーンオブジェクトでない**場合を全体失敗とする（最後の条件は計画外の追加。懸念事項C-29）。図形単位の`try/catch`はこのメソッド内の1箇所のみで、捕捉時に`{ index, type, reason }`を記録して続行する。
            *   `deserializeFromString(text)`：`JSON.parse`を`try/catch`し、失敗時は「JSONとして解析できません: …」の全体失敗、成功時は`deserialize`へ委譲。
            *   privateヘルパー：`#failure(reason)`（全体失敗の結果生成＋`console.warn`）、`#isPlainObject(value)`、`#messageOf(error)`（`Error`以外がthrowされた場合は`String()`化）。
        *   `console.warn`：スキップ1件ごと（`DocumentSerializer: 図形 #<index>（<type|種別不明>）を読み飛ばしました: <reason>`）と全体失敗時（`DocumentSerializer: 作業データを読み込めませんでした: <reason>`）。
        *   図形種別の分岐・図形固有のプロパティ名は持たない（要素の`type`はスキップ記録用に読むのみ）。引数のオブジェクトは書き換えない。
    *   確認（Node.js v24でESモジュールとして直接import。リポジトリ外の一時スクリプトで実施し、成果物には含めない）
        *   5種の図形（制御点移動・平行移動を含む）で`serializeToString` → `deserializeFromString` → `serializeToString`の文字列が完全一致。キー順`format,version,shapes`・字下げ2。成功時は`console.warn`が0件。オブジェクト層`serialize` → `deserialize`でも復元でき、元とは別インスタンス。
        *   `shapes: []`、全要素スキップの場合とも`ok: true`。
        *   `type: 'triangle'`／頂点数不足／`strokeWidth: 0`／`null`／数値／`type`欠落の要素が混在する作業データで、正常な2図形のみ復元、6件がそれぞれ正しい`index`・`type`（文字列でなければ`null`）・各クラスのエラーメッセージでスキップされ、`console.warn`が6件。入力オブジェクトは変更されない。
        *   `null`・配列・数値・文字列・`{}`・`format`違い・`version`が`99`/`0`/`1.5`/`"1"`・`shapes`が`{}`/欠落、および文字列層で`'{'`・`''`・`'abc'`・`undefined`・`'null'`相当・`123`・`'[1]'`で、いずれも例外を投げず`ok: false`・空配列・理由文字列が返り、`console.warn`が1件。
        *   マイグレーション経路：一時コピーで`CURRENT_DOCUMENT_VERSION = 4`・`MIGRATIONS`に版1→2・2→3のみを定義し、版1の入力で「版3から版4へのマイグレーションが定義されていません」、2→3がthrowすると「…マイグレーションに失敗しました: boom」、`null`を返すと「…結果がオブジェクトではありません」となること、版4の入力はマイグレーションなしで復元されること、`serialize`が版4で出力することを確認（成果物の定数は版1のまま）。
        *   呼び出し元はまだ存在しないため、既存の挙動は変わらない。

### タスク6: `VectorModel`の図形一式の入れ替え・id採番と、`InputTracker`の進行中操作の中断手段
*   **作業内容** :
    *   `js/core/VectorModel.js`
        *   importを`import { ShapeFactory, SHAPE_TYPES } from './ShapeFactory.js';`へ変更。
        *   モジュール定数（非公開・JSDoc付き）`ID_PREFIX = 'shape-'`と、採番形式に一致して連番を取り出す`ID_PATTERN`（`ID_PREFIX`から`new RegExp(`^${ID_PREFIX}(\\d+)$`)`で組み立て。接頭辞の二重定義を避けるため）を追加。id形式の知識は本ファイル内に閉じる旨をJSDocに記載。
        *   private`#issueId()`（`` `${ID_PREFIX}${this.#nextId++}` ``）を`#notifyChange()`の直前に新設し、`commitDraft()`の採番をこれへ置換（生成されるidは従来と同一の`shape-1, shape-2, …`）。
        *   `replaceAllShapes(shapes)`を`deleteShapes`の直後に新設（要件5の手順1〜7）：①`[...shapes]`で新配列化 ②先頭から順に「空でない文字列かつ未出現」なら保持id、それ以外（欠落・非文字列・空文字・重複の後出し）は振り直し対象 ③保持idのうち`ID_PATTERN`に一致し`Number.isSafeInteger`の連番の最大値`n`で`#nextId = Math.max(#nextId, n + 1)` ④振り直し対象へ`#issueId()` ⑤選択集合・ホバー・作成中の図形・選択矩形をクリア ⑥通知1回 ⑦振り直し件数を返す。
        *   `startDraft`の既定引数を`type = SHAPE_TYPES[0]`へ（値は従来と同じ`'line'`）、`@param`を`[type=SHAPE_TYPES[0]]`（`SHAPE_TYPES`のいずれか）へ。
        *   JSDoc：`#nextId`に単調増加・繰り上げ規則を追記。`replaceAllShapes`に処理順(1)〜(6)・保持idの判定と振り直し規則（重複時は後に出現した方）・クリアされる状態・通知1回・引数配列を流用しない・戻り値・中断は呼び出し側の責務（先に`abortOngoingOperation()`）を記載。`commitDraft`のJSDocに採番形式を追記。
    *   `js/core/InputTracker.js`
        *   private`#abortOngoingOperation()`を新設し、旧`setMode`内の強制中断処理（①ドラッグセッション中なら`DragTracker.cancel()`、②なお`IDLE`以外なら`cancelDraft()`して`IDLE`へ）を移動。戻り値は何かを中断したら`true`。カーソル再評価は呼び出し側で行う（`setMode`でモード更新前の古いモードによる再評価を挟まないため）。
        *   公開`abortOngoingOperation()`を「公開API（状態依存の操作）」区画の末尾（`selectAll`の直後）に新設：`#abortOngoingOperation()`→`#updateCursor()`→戻り値を返す。受理条件なし（常に受理）。JSDocに用途（`replaceAllShapes`の前処理・Phase 03-02の履歴適用の前処理として再利用）、受理条件、中断するもの、変更しないもの（操作モード・図形種別・選択集合・ホバー、およびスペース押下状態）、カーソル再評価、戻り値を記載。
        *   `setMode`の本体を「`#abortOngoingOperation()` → `currentMode`更新 → `clearSelection()`・`clearHovered()` → `#updateCursor()`」へ変更し、JSDocを新しい処理順と、作成途中の図形の破棄がクリアより前へ移った旨（最終状態は同一）へ更新。
        *   先頭の責務JSDoc（2行のまま）の「状態依存の操作（一括削除・取消・全選択）」を「（一括削除・取消・全選択・進行中操作の中断）」へ。クラスJSDocの公開メソッドの説明・区画名、区切りコメントを「削除・取消・全選択・中断」へ更新。`#beginLeftDrag`・`#onLeftDragCancel`・`#beginPan`・`#finishPan`のJSDocの中断契機（`blur・setMode`）に`abortOngoingOperation`を追記。
    *   確認（Node.js v24でESモジュールとして直接import。DOMは最小限のスタブ。リポジトリ外の一時スクリプトで実施し、成果物には含めない）
        *   **モード切替の回帰（旧実装との比較）**：`InputTracker.js`の`setMode`本体のみを旧コードへ戻した複製（旧）と現行（新）で、同一の操作列を実行して状態を比較した。中断前の状態は ①作成途中（`DRAWING`）②作成途中＋中ボタンパン中 ③ハンドルドラッグ（閾値超過）④同（閾値以前）⑤本体ドラッグ ⑥範囲選択（閾値超過・選択矩形あり）⑦同（閾値以前）⑧キャンバス移動モードの左ドラッグパン ⑨選択＋ホバーのみ（`IDLE`）⑩スペース＋左ドラッグパン の10種、切替先は`select`/`create`/`pan`の3種（ボタン・`V`/`P`/`H`はいずれも`applyMode`→`setMode`の同一経路）で計30通り。切替直後の`state`・操作モード・図形種別・カーソル・ドラッグ中か・全図形の図形データ・選択集合・ホバー・作成中の図形・選択矩形・ビュー変換・作業用フィールド、切替時の変更通知回数、および切替後に`mouseup`（左・中）・`click`・`mousemove`を送った後の同項目が、30通りすべてで新旧完全一致した。
        *   上記で、作成途中の図形は破棄され、ドラッグは中断（ハンドル・本体ドラッグで反映済みの頂点・位置は残る）、範囲選択は選択矩形が破棄され確定しない、選択集合・ホバーは解除、`IDLE`へ復帰することを確認。
        *   `abortOngoingOperation()`：上記10種の状態から呼ぶと、⑨のみ`false`・他は`true`を返し、すべて`IDLE`・ドラッグなし・作成中の図形なし・選択矩形なしとなり、操作モード・図形種別・選択集合・ホバーは呼び出し前と同一（範囲選択中の呼び出しでも選択集合は変わらない）。
        *   `VectorModel`：`commitDraft`のidが従来どおり`shape-1`, `shape-2`。`startDraft`の既定種別が`'line'`。`['shape-10', undefined, '', 42, 'shape-10'(重複), 'custom', 'shape-99999999999999999999', 'shape-3']`で入れ替えると振り直し4件・結果id`["shape-10","shape-11","shape-12","shape-13","shape-14","custom","shape-99999999999999999999","shape-3"]`（一意）、通知1回、選択集合・ホバー・作成中の図形・選択矩形がクリア、引数配列を後から変更しても内部配列は不変、図形インスタンスは同一参照、次の`commitDraft`は`shape-15`。続けて`['shape-2', null]`で入れ替えると振り直しidは`shape-16`（`#nextId`は減らない）。空配列での入れ替えも可。
        *   ブラウザでの目視確認は未実施（呼び出し元となる`main.js`の配線はタスク8。モード切替は上記の比較で最終状態の同一性を確認済み）。

### タスク7: `CanvasManager`の軸線・原点マークの描画
*   **作業内容** :
    *   `js/core/CanvasManager.js`
        *   先頭の責務JSDoc（2行のまま）を「背景グリッド・原点表示・選択矩形を含む」へ更新。
        *   モジュール定数（非公開・JSDoc付き）を`GRID_MAJOR_COLOR`の直後に追加：`ORIGIN_AXIS_COLOR = 'rgba(0, 0, 0, 0.32)'`（グリッド太線より濃い旨を記載）、`ORIGIN_MARK_COLOR = 'rgba(0, 0, 0, 0.6)'`、`ORIGIN_MARK_SIZE = 12`（十字の全長px）、`ORIGIN_MARK_RADIUS = 3`（円の半径px）。後2者は「`÷ view.scale`して画面上一定」とJSDocに明記。
        *   private`#getVisibleWorldBounds()`を新設し、`#drawGrid`内の可視範囲の計算（描画変換の逆行列でバッファの対角2隅を写し、`{minX, maxX, minY, maxY}`を返す）をそのまま移動。式・評価順は変更していない（`#drawGrid`では従来と同じく間隔の決定後に呼ぶ）。`#drawGrid`のJSDocの可視範囲の説明を「`#getVisibleWorldBounds()`で求める（原点表示と共用）」へ置換。
        *   private`#drawOrigin(view)`を`#drawGrid`の直後に新設：`scale`が正の有限値でなければ何もしない（`#drawGrid`と同じガード）→ `#getVisibleWorldBounds()` → `save()` → 線幅`1 / scale` → 軸線（`x = 0`が可視範囲内ならY軸`(0, minY)-(0, maxY)`、`y = 0`が可視範囲内ならX軸`(minX, 0)-(maxX, 0)`。両軸を1パスで`ORIGIN_AXIS_COLOR`）→ 原点マーク（十字`±ORIGIN_MARK_SIZE / 2 / scale`と円`半径ORIGIN_MARK_RADIUS / scale`を1パスで`ORIGIN_MARK_COLOR`）→ `restore()`。インスタンス状態は持たない。
        *   `render()`で`#drawGrid(view)`の直後・図形描画の前に`#drawOrigin(view)`を呼ぶ（番号付きコメント「3-2. 軸線・原点マーク」。既存の4〜7の番号は振り直していない）。`render()`のJSDocの冒頭説明と描画順を「背景グリッド → 軸線・原点マーク → (1)全図形 …」へ更新。
    *   確認（成果物には含めない一時スクリプト・一時ページをリポジトリ外で実施）
        *   **背景グリッドの描画結果が従来と同一であることの確認（その1：描画命令の比較）**：Node.jsで描画命令をすべて記録するモックの2Dコンテキストを作り、旧`CanvasManager.js`（変更前のコピー）と、新`CanvasManager.js`から`this.#drawOrigin(view);`の1行のみを除いた複製で`render()`を実行し、記録した全描画命令（`setTransform`・`save`/`restore`・プロパティ代入・`moveTo`/`lineTo`の座標値まで）を比較した。キャンバス3サイズ（800×600・1366×768・1×1）× dpr 3種（1・1.5・2）× ビュー58種（倍率0.1〜10の9段階×オフセット6種、および倍率0・`NaN`・`Infinity`・負）＝522通り（図形・ハンドル・作成中の図形・選択矩形を含む）で完全一致。さらに新`CanvasManager.js`そのものでも、旧の描画命令列のグリッド直後に連続した1ブロック（原点表示）が挿入されているだけで、前後はすべて一致することを確認。
        *   **同（その2：実ブラウザでの画素比較）**：ローカルHTTPサーバー＋ブラウザで、上記の旧版と「`#drawOrigin`呼び出しを除いた新版」を同サイズのCanvas（800×600 CSS px）に描画し、`getImageData`の全画素を比較。ビュー54種（倍率9段階×オフセット6種）について、dpr 1・dpr 2の双方で全画素一致（差分0ビュー）。
        *   **原点表示の確認（実アプリ）**：キャンバス移動モードでパンして原点を画面内に移すと、原点に十字＋円、`x = 0`・`y = 0`に軸線が描かれ、グリッドの太線より濃く区別できること（スクリーンショットで目視・画素のアルファ値で確認）。ホイールで倍率0.1・1.0・10.0へ変えても、軸線の太さ（デバイス画素2px＝画面上1px、dpr 2）・十字の半長（同12px＝画面上6px）が一定であること。倍率0など不正値では原点表示の描画命令が発行されないこと（上記モック）。コンソールにエラーなし（出力されたのは確認用の画素読み取りに対するブラウザの性能注意のみ）。
        *   図形との前後関係（図形より背面）は描画命令の順序で確認したが、図形を重ねた状態のスクリーンショットでの目視確認は未実施（A-10）。

### タスク8: 確認用ウィンドウ（`DevPanel`）の新設と`index.html`・`main.js`の配線
*   **作業内容** :
    *   `js/palette/DevPanel.js`（新規）
        *   先頭の責務JSDoc（2行）：確認用ウィンドウのDOM操作専任。注入されたコールバック（変換・復元）を呼び結果を表示する。VectorModel・InputTracker・DocumentSerializer・図形データに関与しない。importは持たない。
        *   `@typedef ImportSummary`（`ok`・`restoredCount`・`reassignedCount`・`skipped`・`error`）と`@typedef DevPanelActions`（`onExport(): string`・`onImport(text): ImportSummary`）を定義。
        *   `constructor(rootElement, { onExport, onImport })`：ルート内の`#dev-export`・`#dev-import`・`#dev-json`・`#dev-result`を`querySelector`で解決し、いずれかが見つからなければ`console.warn`のうえ配線しない。見つかれば2ボタンのclickを配線。
        *   `show()`：ルート要素の`hidden`を`false`にする。
        *   private`#handleExport()`：`onExport()`の戻り値を`textarea`へ設定し、結果表示欄に「JSONへ変換しました」（図形数は扱わない）。
        *   private`#handleImport()`：`textarea`の値を`onImport(text)`へ渡し、private static`#formatImportSummary(summary)`の整形結果を結果表示欄へ`textContent`で設定。成功：「復元した図形：n個／振り直したid：n件／スキップ：n件」＋スキップ1件ごとに「  #index type: reason」（`type`が`null`なら「(種別なし)」）。失敗：「読み込み失敗：理由（キャンバスは変更していません）」。
    *   `index.html`
        *   `<style>`末尾に`#window-dev-panel`（`top: 16px; left: 16px; width: 360px;`）・`.dev-button-row`（2ボタンの横並び）・`#dev-json`（`width: 100%`・`box-sizing: border-box`・等幅12px・`resize: vertical`・`user-select: text`）・`#dev-result`（`margin: 0`・`max-height: 120px`・`overflow: auto`・`white-space: pre-wrap`・等幅12px・`user-select: text`）を追加。`.float-window`の既存指定は変更していない。
        *   図形選択パレットの後ろ（`<script>`の直前）に`<div id="window-dev-panel" class="float-window" hidden>`を追加（ヘッダー「開発者用：作業データ」＋既存と同じ`×`ボタン、本体に`#dev-export`「JSONへ変換」・`#dev-import`「JSONから復元」（`.tool-btn`）・`<textarea id="dev-json" rows="14" spellcheck="false">`・`<pre id="dev-result">`）。
    *   `js/main.js`
        *   `DocumentSerializer`・`DevPanel`をimport。
        *   番号付きコメント「9. 開発者向け確認用ウィンドウ配線」をキーボードショートカット配線（8）の直後・起動時初期化の前に追加。`const isDevMode = new URLSearchParams(window.location.search).has('dev');`がtrueのときのみ`new DevPanel(...)`→`show()`。
        *   `onExport: () => DocumentSerializer.serializeToString(model.getShapes())`。
        *   `onImport`：`deserializeFromString(text)`→ 失敗なら`{ ok: false, restoredCount: 0, reassignedCount: 0, skipped: [], error }`を返しキャンバスを変更しない → 成功時のみ`inputTracker.abortOngoingOperation()`→`model.replaceAllShapes(result.shapes)`（戻り値＝振り直し件数）→`{ ok: true, restoredCount: result.shapes.length, reassignedCount, skipped: result.skipped, error: null }`。再描画・削除ボタン同期は呼ばない（`model.onChange`経路のみ）。`window`への公開なし。
    *   確認（ローカルHTTPサーバー＋アプリ内ブラウザ。確認用の一時設定・スクリプトは成果物に含めない）
        *   `?dev`で左上にウィンドウが表示され、右側のコントロールパネル・図形パレットと重ならない。`?dev`なしでは`hidden`のまま（`display: none`）で、起動時の`console.warn`なし。
        *   5種の図形を作成 →「JSONへ変換」→「JSONから復元」→再度「JSONへ変換」で、文字列が完全一致（結果表示「復元した図形：5個／振り直したid：0件／スキップ：0件」）。
        *   `type: "triangle"`・`strokeWidth: 0`・idの重複・id欠落を含むJSONで「復元した図形：3個／振り直したid：2件／スキップ：2件」と各行（`#0 triangle: ShapeFactory.fromJSON: 未知の図形種別です: triangle`等）が表示され、`console.warn`にも出た。振り直し後のidは`shape-6`・`shape-7`（重複していない）。
        *   `version: 99`・壊れたJSONで「読み込み失敗：…（キャンバスは変更していません）」と表示され、図形数は変わらなかった。
        *   図形作成の途中（1クリック目の後）に「JSONから復元」すると、作成途中の図形が消え、図形作成モードのまま状態が壊れない。
        *   `textarea`でのドラッグによる範囲選択・Shift+矢印による選択拡張を確認。コピー・切り取り・貼り付けは確認できなかった（懸念事項B-11）。
        *   テキスト入力中の誤作動防止（懸念事項B）の確認結果はB-1〜B-10に記載。

### タスク9: JSDocの記載漏れ確認
*   **作業内容** :
    *   確認対象：タスク1〜8の変更・新規の`.js`全12ファイル（`shapes/`4ファイル・`ShapeFactory`・`InputTracker`・`VectorModel`・`CanvasManager`・`PaletteController`・`DevPanel`・`DocumentSerializer`・`main.js`）。
    *   **先頭責務JSDoc（3行以内）**：全12ファイルが3行以内で、改修後の実態と一致していることを確認（`shapes/`「図形データとの相互変換」、`ShapeFactory`「種別一覧の正本・復元の振り分け」、`InputTracker`「進行中操作の中断」、`CanvasManager`「原点表示」、`PaletteController`「図形種別一覧に対応するボタン」、新規2ファイル）。変更なし。`VectorModel`（C-39）・`main.js`は現状のままで実態を包含すると判断（C-39は発注者判断どおり変更していない）。
    *   **指定事項がJSDocから読み取れることの確認**（いずれも記載済みのため変更なし）：
        *   図形データの形式（プロパティと頂点の並び）：各図形クラスの`toJSON()`、`DocumentSerializer`の`@typedef DocumentData`。
        *   `fromJSON`が`Error`をthrowする条件：各図形クラスの`fromJSON`の`@throws`（条件1〜6）、`ShapeFactory.fromJSON`の`@throws`。
        *   作業データ形式の最上位の形と版番号：`@typedef DocumentData`、定数`DOCUMENT_FORMAT`・`CURRENT_DOCUMENT_VERSION`。
        *   マイグレーションの追加手順：定数`MIGRATIONS`のJSDoc（①〜③）。
        *   デシリアライズ結果の形：`@typedef DeserializeResult`・`SkippedShape`、`deserialize`の全体失敗条件。
        *   idの採番規則：`VectorModel`の`ID_PREFIX`・`#nextId`・`#issueId()`・`commitDraft()`・`replaceAllShapes()`。
        *   図形一式の入れ替え時にクリアされる状態：`replaceAllShapes()`の(5)。
        *   `abortOngoingOperation`の名称・受理条件：`InputTracker.abortOngoingOperation()`（受理条件・中断対象・非変更対象・戻り値）。
    *   **記載漏れの補完（JSDocコメントのみ追加。コードは無変更）**：憲法「クラス…にJSDocを記述」に対し、クラス宣言にJSDocがなかった7クラスへクラスJSDocを追加した（いずれも本フェイズ以前からの欠落）。
        *   `Line`・`Curve`・`Rect`・`Ellipse`：図形種別・頂点の並び・12メソッド契約の一覧・ワールド座標である旨（`Ellipse`は角度を図形データに保存しない旨も）。
        *   `ShapeFactory`：`create`/`fromJSON`の静的メソッド群で、対応づけは`SHAPE_REGISTRY`の表引きのみ・状態を持たない旨。
        *   `VectorModel`：SSOTの保持内容・変更通知・id採番・`ShapeFactory`への委譲。あわせてJSDocのなかった`constructor()`に初期状態の説明を追加。
        *   `CanvasManager`：引数のみから描画し、アプリケーション状態を持たない（保持はCanvas要素・2Dコンテキスト・dprのみ）旨。
        *   `InputTracker`・`PaletteController`・`DevPanel`・`DocumentSerializer`は既にクラスJSDocがあるため変更なし。
    *   機械的確認：対象ファイルの`class`宣言・メソッド・モジュール定数のうち、直前にJSDocを持たないものを抽出するスクリプトで、上記補完後に該当0件であることを確認。
    *   **図形種別の文字列一覧の検索**：`js/`全体を`'line'`・`'curve'`・`'arc'`・`'rect'`・`'circle'`（ダブルクォート含む）、`'line'|'curve'`形式の列挙、「直線・曲線…」の和文列挙、「5ボタン」「5種」「10メソッド」で検索。該当は`ShapeFactory.js`の`SHAPE_REGISTRY`と、`shapes/`の自分自身の値（`Line`/`Curve`/`Rect`の`type`・検証・JSDoc、`Ellipse`の`ELLIPSE_TYPES`等。C-17）のみで、除外対象外の残存はなかった。
    *   動作確認：変更した7ファイルを含む対象全ファイルの`node --check`（構文）が成功。Node上で5種の図形を`ShapeFactory.create`→`serializeToString`→`deserializeFromString`→再`serializeToString`し、文字列の完全一致・スキップ0件を確認（コメントのみの変更のため挙動は不変）。

### タスク10: 作業レポートの完成
*   **作業内容** :
    *   「4. 詳細作業内容」のタスク1〜9の各欄が記入済みであること、「3. タスクリスト」のタスク1〜9が`[x]`であることを確認した（タスク11は未着手のため未記入のまま）。
    *   作業レポートと実装の突き合わせ（コードは無変更）：
        *   `git status`で、変更・新規ファイルが「関連フォルダと論理クラス」の対象（`shapes/`4ファイル・`ShapeFactory`・`InputTracker`・`VectorModel`・`CanvasManager`・`PaletteController`・`main.js`・`index.html`、新規`io/DocumentSerializer.js`・`palette/DevPanel.js`）と一致し、「変更しないファイル」（`KeyboardShortcuts.js`・`ViewTransform.js`・`DragTracker.js`・`WindowManager.js`）に差分がないことを確認。
        *   変更・新規の全`.js`ファイルで`node --check`（構文）が成功。
        *   Node上で5種の図形を`ShapeFactory.create`→`serializeToString`→`deserializeFromString`→再`serializeToString`し、`SHAPE_TYPES`が`line,curve,arc,rect,circle`の並び、`ok: true`・スキップ0件・文字列の完全一致を確認（リポジトリ外の一時スクリプト。成果物に含めない）。
        *   `main.js`の番号付きコメントが1〜9の並び（9＝開発者向け確認用ウィンドウ配線）であることを確認。
    *   「開発資料の更新予定」に、各タスクの懸念事項に記載されたまま更新予定へ転記されていなかった事項（タスク1・2・8の補足、2章の`id`の未正規化、3章のキーボードの既知の挙動）を「（タスク10追記）」として追記した。
    *   「5. 懸念事項・要確認ポイント」に、A・Bの各確認項目の実施状況の一覧（テストプレイ時に残っている目視確認の範囲）と、本フェイズの範囲外で発注者側の対応が必要な事項を「（タスク10）」として追記した。

### タスク11: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
*   **作業内容** :
    *   方針：開発資料冒頭の方針（直接コードを読めば分かる内部ロジックの詳細は記載しない）に従い、責務・データ構造の概要・メソッドの契約・依存の制約・将来の修正で守るべき手順のみを反映した。「開発資料の更新予定」のうち当初予定文と「（タスクn追記）」が上書き関係にある項目（`VectorModel`の採番、`InputTracker.setMode`の処理順）は追記側を優先した。反映前に`js/`の実ファイルで、新設2ファイルの存在・各ファイルの先頭責務・`ShapeFactory`/`shapes/`/`io/`/`palette/`のimport・`replaceAllShapes`/`#issueId`/`abortOngoingOperation`/`SHAPE_TYPES`の再export・`main.js`の`?dev`配線が計画書の記載と一致することを確認した（コードは無変更）。
    *   **1章 フォルダ構造**：`palette/`に`DevPanel.js`、`io/`に`DocumentSerializer.js`を追加。
    *   **2章 データ構造**：共通プロパティに`type`（`ShapeFactory`の受理文字列と一致）を追加し、「`type`を持つのは`Ellipse`のみ」「図形種別の共通プロパティは未定義」を削除。図形データの形（`Line`も`points`2点）と、`fromJSON`直後の`id`が未検証・未正規化で`replaceAllShapes`を経て一意な文字列になる旨を追記。作業データ形式（`{ format: "oz-vector-editor", version, shapes }`、保存対象は図形データのみ、旧版の知識はマイグレーション表に閉じる）を追記。
    *   **3章 描画・操作フロー**：起動処理に`?dev`時の`DevPanel`生成、描画サイクルに背景グリッド・軸線・原点マークを図形より先に描く旨（全体の描画順は4章へ委ねる）を追記。項目「5. 作業データの変換・復元」を新設し、`DocumentSerializer`→`ShapeFactory.fromJSON`→図形クラスの復元経路と、成功時のみ`abortOngoingOperation()`→`replaceAllShapes()`の呼び出し順・UI同期は`model.onChange`経路のみである旨を記載（更新予定では4章`main.js`の項目だったが、複数モジュールにまたがる流れのため3章にも置いた）。
    *   **4章 index.html**：パレットボタンのid規則`palette-${type}`と`PaletteController`による照合（パレット内で種別ボタン以外に`palette-`接頭辞を使わない制約）、確認用ウィンドウ（`hidden`で初期非表示・`?dev`時のみ表示・`#dev-json`/`#dev-result`のみ`user-select: text`）、`×`ボタンが全ウィンドウとも無機能である旨を追記。
    *   **4章 main.js**：`SHAPE_TYPES`を正本の`ShapeFactory.js`から直接importして`PaletteController`へ渡す旨、「開発者向け確認用ウィンドウ配線」（`?dev`判定・`window`へ公開しない・`onExport`/`onImport`の内容・UI同期は`model.onChange`経路のみ）を追記。
    *   **4章 VectorModel.js**：`startDraft`の既定値を`SHAPE_TYPES[0]`へ。「採番は`commitDraft()`実行時」を「採番は`#issueId()`に一本化（`commitDraft()`・`replaceAllShapes()`の振り直し）・`#nextId`は単調増加・id形式の知識は`VectorModel`内に閉じる」へ置換。生成のみ`ShapeFactory.create`へ委譲し、図形データからの復元は`DocumentSerializer`→`ShapeFactory.fromJSON`が行い、`VectorModel`は復元済みの図形一式を`replaceAllShapes`で受け取るのみ（図形データ・作業データ形式・`DocumentSerializer`を知らない）である旨を追記。小項目「図形一式の入れ替え」を新設し、`replaceAllShapes`の契約（引数配列をコピー・インスタンスは複製しない・idの正規化規則と振り直しはインスタンスの`id`を直接書き換える・`#nextId`の繰り上げ・クリアされる状態・通知1回・戻り値・進行中の入力操作は中断しない・同一インスタンスを重複して渡さない）を記載。
    *   **4章 CanvasManager.js**：描画順を「背景グリッド → 軸線・原点マーク → 全図形 …」へ更新し、原点表示の仕様（軸線は可視範囲内のみ・十字＋円・`÷ scale`で画面上一定・`save()`/`restore()`）、初期表示・リセット時の原点が左上である旨、`#getVisibleWorldBounds()`の共用とその前提（描画変換の設定後に呼ぶ・回転/せん断を含まない変換が前提で、回転を加える場合は四隅を写す実装へ変更が必要）、グリッド・原点表示の色を変える際は見分けやすさを再確認する旨を追記。
    *   **4章 InputTracker.js**：責務に「進行中操作の中断」を追加。`currentShapeType`の初期値を`SHAPE_TYPES`の先頭要素へ、`SHAPE_TYPES`が`ShapeFactory.js`の正本の再exportである旨（理由付き）を追記。`setMode`の記述を新しい処理順（中断→モード更新→クリア→カーソル）へ置換。状態依存の公開メソッドに`abortOngoingOperation()`（常に受理・中断するもの・変更しないもの・戻り値・Phase 03-02での再利用・private版はカーソルを再評価しない注意）を追記。
    *   **4章 KeyboardShortcuts.js**：`SHAPE_TYPES`が`ShapeFactory.js`の正本の再exportである旨を括弧書きで追記（それ以外は無変更）。
    *   **4章 ShapeFactory.js**：全面的に書き換え。責務（種別一覧の正本・生成・復元の振り分け。対応づけは表引きのみ）、対応表と`SHAPE_TYPES`（並び順が決めるもの・並べ替え時の`index.html`の手動同期）、`create`/`fromJSON`の契約（throw条件・`try/catch`を持たない）、依存の制約（`shapes/`のみをimportし`core/`の他モジュールをimportしない理由。`shapes/`も`ShapeFactory`・`core/`をimportしない）、図形種別の追加手順（図形クラス→対応表→`index.html`の`#palette-<type>`）を小項目で記載。
    *   **4章 shapes/**：10メソッド契約→12メソッド契約（`toJSON()`・`static fromJSON(data)`）へ更新し、組み込める範囲に`io/`と変換・復元フローを追加。クラスJSDocが契約を列挙している旨（増減時の追従）を追記。小項目「図形データとの相互変換」（独立性・`fromJSON`のthrow条件・`id`を検証しない・余分なプロパティは無視・`try/catch`を持たない・往復の一致）と「変換の実装上の注意」（検証ヘルパーが4クラスに個別に存在・コンストラクタで仮生成してから頂点を差し替える手順の注意・図形データの形の変更は版の追加手順に従う）を新設。`Line`は図形データで`points`2点へ変換する旨、`Rect`は`fromJSON`でも4頂点を独立に採用する旨、`Ellipse`は角度を保存しない（角度編集の実装時は保存対象へ加え版を上げる）・`points[3]`/`[4]`を再計算しない・種別を増やす際に揃える3箇所を追記。
    *   **4章 palette/PaletteController.js**：「5ボタン」の固定数表記を廃し、コンストラクタ引数`shapeTypes`、importを持たない旨、id規則`palette-${type}`、照合の時機と範囲・不一致時の`console.warn`（2種）へ更新。
    *   **4章 palette/DevPanel.js（新設）**：責務、コンストラクタ・`show()`、`onExport`/`onImport`の契約と`ImportSummary`の形、要素が1つでも欠ければ一切配線しない旨、依存しないもの、コールバックの例外を捕捉しない旨を記載。
    *   **4章 io/DocumentSerializer.js（新設）**：`io/`の「（未実装）」表記を`CodeExporter.js`・`CodeImporter.js`の各項目へ移し、`DocumentSerializer.js`の責務・依存方向、公開API（オブジェクト層・文字列層、デシリアライズ系は例外をthrowしない・`serialize`系は入力を検証しない・`DeserializeResult`の形）、全体の読み込み失敗の条件（マイグレーション関数の戻り値がプレーンオブジェクトでない場合を含む）、スキップ（図形単位の`try/catch`の唯一の箇所・空/全スキップでも`ok: true`・実装不具合の吸収への注意）、マイグレーション関数の契約（新しいオブジェクトを返し引数を書き換えない。理由付き）と版の追加手順①〜③を記載。
    *   **反映しなかった項目と理由**：
        *   **エラーメッセージ・結果表示の文言**（図形クラス・`ShapeFactory.fromJSON`の「`クラス名.fromJSON: 理由`」形式、`create()`の英語メッセージとの言語の混在（C-24）、`DevPanel`の結果表示「復元した図形：n個…」「読み込み失敗：…」「JSONへ変換しました」、`console.warn`の文言）：発注者指示により除外。文言はコードを読めば分かり、変更しても他モジュールの契約に影響しない。なお「検証メッセージ以外の理由が出たら実装不具合を疑う」という判断の手がかりは、文言を書かずに`DocumentSerializer.js`の項へ残した。
        *   **定数の名前と値**（`DOCUMENT_FORMAT`・`CURRENT_DOCUMENT_VERSION`・`MIGRATIONS`の名前、`ORIGIN_AXIS_COLOR`/`ORIGIN_MARK_COLOR`の色の値、`ORIGIN_MARK_SIZE`/`ORIGIN_MARK_RADIUS`の大きさ、`LINE_POINT_COUNT`等の頂点数定数、`ID_PREFIX`/`ID_PATTERN`・`PALETTE_BUTTON_ID_PREFIX`・`ELLIPSE_TYPES`の名前）：発注者指示により除外。いずれもファイル内に閉じた非公開定数で、定義箇所を読めば分かる。資料ではそれぞれ「マイグレーション表」「現行版番号（唯一の定義箇所）」「画面上一定の十字＋円」「自クラスの頂点数」「自クラスの受理種別一覧」など役割の言葉で記述した。ただし作業データの識別文字列`"oz-vector-editor"`とid形式`shape-<連番>`は、保存されるデータの形そのもの（2章）・採番規則の契約であるため記載した。
        *   **`main.js`の番号付きコメントの位置**（確認用ウィンドウの配線が番号「9」でキーボードショートカット配線（8）の直後・起動時初期化の前にある旨（C-50））：発注者指示により除外。コード上のコメントの配置であり、契約ではない。
        *   **テキスト入力欄の既知の挙動（B-5・B-6）**と、**テキスト入力欄の追加時の確認項目としてB-1〜B-11を参照できる旨**：前者は発注者指示により除外。後者は同じ項目（タスク10追記の3章キーボード操作）の一部であることに加え、開発資料から作業ログ（RES）の確認項目番号を参照させると、資料が単独で読めなくなり、またREQのヘッダー指定外ファイルの参照を誘発し得るため除外した。
        *   **タスク9追記**（JSDocの補完はコメントのみで資料に影響しない）：反映すべき内容がないため対象外。ただし同じくタスク9の注意点「図形クラスのクラスJSDocが12メソッド契約を列挙している」は将来の修正手順に当たるため`shapes/`の項へ反映した。
        *   **Phase固有の経緯**（`setMode`の処理順の変更で`model.onChange`の通知順が変わった件（C-8・C-35）、`DragTracker`経由でもカーソルが再評価される件（C-36の後半）、`?dev=0`でも表示される件（C-10）、`Ellipse`コンストラクタが`type`を検証しない件（C-18）、原点マークが可視範囲外でも描画命令を発行する件（C-42）、`version: "1"`の表記（C-32）、`console.warn`の件数（C-34）、ブラウザキャッシュ（C-45））：更新予定に含まれておらず、内部実装の詳細またはこのフェイズの確認上の注意であるため反映していない。`setMode`については新しい処理順のみを記載しており、通知順は処理順から読み取れる。
    *   確認：反映後の`PROJECT_ARCHITECTURE.md`を検索し、「10メソッド」「5ボタン」・図形種別の文字列（`'line'`等）・`type = 'line'`・「`commitDraft()`実行時」といった旧記述が残っていないこと、および「（未実装）」が`CodeExporter.js`・`CodeImporter.js`の2項目のみに付いていることを確認した。コード（`js/`・`index.html`）は変更していない。

## 5. 懸念事項・要確認ポイント
**A. テストプレイでの目視確認項目（要件8）**
1. 5種の図形（直線・曲線・弧・矩形・円）を作成し、ハンドルで変形・本体ドラッグした後、「JSONへ変換」→「JSONから復元」して、見た目・ハンドル位置・ハンドル操作・範囲選択・ホバー表示が変わらない。復元後に再度「JSONへ変換」した内容が復元前と一致する。
2. 復元後に新しい図形を作成・選択・削除しても、idの衝突による異常（1クリックで2図形が選ばれる、削除で別図形が消える等）がない。
3. `type`を`"triangle"`に書き換えた図形を含むJSONで、その図形だけが読み飛ばされ、結果表示に位置・種別・理由が出て、`console.warn`にも出る。残りの図形は復元される。
4. `version`を`99`／`0`／`1.5`／`"1"`にしたJSON、`format`を書き換えたJSON、`shapes`を配列以外にしたJSON、壊れたJSON（括弧の欠け等）で、キャンバスが変わらず理由が表示される。
5. `points`の要素数を減らした図形、座標を`"abc"`や`null`にした図形、`strokeWidth`を`0`にした図形が、その図形だけスキップされる。
6. 作成途中（図形作成のクリックとクリックの間）に「JSONから復元」しても、作成途中の図形が残らず、状態が壊れない（次のクリックで新規作成が始まる）。範囲選択の途中など、ドラッグ中には通常ボタンを押せないが、押せた場合も状態が壊れない。
7. `id`を削除・重複・数値にした図形を含むJSONでも図形が復元され、新しいid（`shape-<連番>`）が振られる（再度「JSONへ変換」で確認）。結果表示に振り直し件数が出る。
8. `textarea`で文字の範囲選択（ドラッグ・Shift+矢印）・コピー・貼り付け・切り取りができる。
9. `?dev`なしの通常起動でウィンドウが出ない。通常起動で`console.warn`（パレットの整合警告を含む）が1件も出ない。
10. 原点マーク・軸線がパン・ズーム（ホイール・キーボード・リセット）に追従し、倍率0.1〜10.0のどこでも画面上の太さ・大きさが一定。図形より背面に描かれ、グリッドと区別できる。初期表示・リセット時に原点が左上に位置する（軸線は画面の上端・左端に沿う）。
11. 既存操作の回帰がない：図形作成5種・クリック選択・範囲選択・本体ドラッグ・ハンドル操作・削除ボタン・全ショートカット・パン3通り・ホイールズーム・倍率表示・リセット・モードボタン・図形パレットのハイライトと活性/非活性・数字キー1〜5の種別割り当て。

**B. テキスト入力中の誤作動防止の確認項目（要件6。`textarea`にフォーカスした状態で）**
1. `V`・`P`・`H`・数字`1`〜`5`が文字として入力され、モード・図形種別が切り替わらない。
2. `Delete`・`Backspace`が文字削除になり、選択中の図形が削除されない。
3. `Ctrl`+`A`が`textarea`内の全選択になり、図形の全選択が起きない。
4. `Space`が空白文字として入力され、スペースパン（カーソル`grab`）にならない。`Esc`で選択解除・作成中断が起きない。
5. **既知の想定挙動**：`Ctrl`+`+`/`-`/`0`は`KeyboardShortcuts`がテキスト入力中として受理せず、`preventDefault()`の例外処理（ドラッグ中・キーリピート時のみ）にも該当しないため、ブラウザのページズームが働く。判定ロジックは変更しない方針のため本作業では対応しない。問題となる場合は別途判断が必要。
6. **既知の想定挙動**：`textarea`にフォーカスしたままキャンバスを**中ボタン**でパンすると、`InputTracker`が中ボタンの`mousedown`で`preventDefault()`するためフォーカスが`textarea`に残り、パン後もショートカットが無効のままとなる（左クリックではフォーカスが外れるため解消する）。

**（タスク8）確認結果**（REQの追加仕様に従い、B-7〜B-10の4項目をRES `261031_2121`の確認項目との差分として追加した。判定ロジック（`isTextInputElement`・`KeyboardShortcuts`）は変更していない）
*   確認方法の区別：「実キー」＝ブラウザ自動操作による実際のキー入力（`keydown`/`keyup`が発生し、文字が入力される）。「合成イベント」＝`KeyboardEvent`を`dispatchEvent`して受理判定のみを確認したもの（文字は挿入されないため、文字入力の可否は確認できない）。
*   **B-1（確認済み・実キー）**：`textarea`で`V`・`P`・`H`・`1`〜`5`が文字として入力され（値`"vph12345"`）、操作モード（選択）・図形種別のハイライトは変化しなかった。
*   **B-2（確認済み・実キー）**：`Backspace`・`Delete`がそれぞれ文字削除として働き、選択中の矩形は削除されなかった（削除ボタンは押せる状態のまま、ハンドル表示も残存）。
*   **B-3（確認済み・実キー）**：`Ctrl`+`A`で`textarea`の全文字が選択され（selection 0〜6）、図形の全選択は起きなかった（選択は矩形1個のまま）。
*   **B-4（確認済み・実キー）**：`Space`が空白文字として入力され、キャンバスのカーソルは`default`のまま。`Esc`で図形の選択解除は起きなかった。
*   B-5・B-6は確認していない（既知の想定挙動のため）。
*   **B-7 テンキーの数字（要件1）：受理判定のみ確認・文字入力は未確認**。使用した自動操作ツールではテンキーのキー（`event.code`が`Numpad1`〜`5`）を発生させられなかった（空の`code`のイベントになり、文字も入力されなかった）。合成イベントで、`textarea`フォーカス中の`Numpad1`〜`5`の`keydown`はいずれも`preventDefault()`されず、操作モード・図形種別は変化しなかった。対照として、フォーカスなし（`body`）で同じ`Numpad1`を送ると受理され、図形作成モード・直線へ切り替わった（合成イベントでも判定が働くことを確認）。`isTextInputElement`の判定はキー種別に依存せず`KeyboardShortcuts`の受理判定の手順2で一律に弾くため、実キーでも同じ結果になる見込みだが、**実機のテンキーでの文字入力は目視確認をお願いしたい**。
*   **B-8 IME変換中（要件2）：受理判定のみ確認・実際のIME操作は未確認**。自動操作ではIMEを起動できない。合成イベントで、`textarea`フォーカス中に`isComposing: true`・`key: 'Process'`の`Escape`・`Backspace`・`Digit1`・`Numpad2`を送ると、いずれも`preventDefault()`されず状態は変化しなかった。さらに、フォーカスなし（`body`）で`isComposing: true`の`Numpad1`を送っても受理されないこと（手順1の`isComposing`判定が単独で働くこと）を確認した。スペースパンは`InputTracker`が`isTextInputElement`で判定するため、`textarea`内の変換中の`Space`（変換キー）も奪わない。**変換の取り消し・文字削除・候補選択が正しく働くかは、実機の日本語入力での目視確認をお願いしたい**。
*   **B-9 フォーカスを外した後の復帰（要件3）：確認済み・実キー**。`textarea`入力中にキャンバスの空き部分を左クリックすると`document.activeElement`が`BODY`になり、続く`P`で図形作成モード、`V`で選択モードへ切り替わった。`Space`の`keydown`も`preventDefault()`され、スペースパンの受理経路に入ることを確認した（ただし自動操作ではキーを押したまま保持できないため、スペースを押したままのドラッグによるパンは未確認。B-6のとおり中ボタンでのパンではフォーカスが外れない点に注意）。
*   **B-10 スペース押下状態の残留（要件4）：残留しない（合成イベントで確認）**。自動操作ではキーを押したまま保持できないため、合成イベントで「フォーカスなしでSpaceの`keydown`（`preventDefault()`され、カーソル`grab`）→ `textarea.focus()`（カーソルは`grab`のまま＝押下中の状態を維持）→ `textarea`を対象にSpaceの`keyup`」を再現した。`keyup`後のカーソルは`default`に戻り、残留しなかった。`InputTracker.handleKeyUp`はテキスト入力中でも押下状態の解除を行う（`preventDefault()`のみ省く）実装であり、コード上も残留しない。なお`textarea`へのフォーカス移動を「スペースを押したままのクリック」で行った場合、押下中は左クリックがスペースパンとして扱われ`mousedown`で`preventDefault()`される可能性があるため、フォーカスが移らない場合がある（実機での挙動は未確認）。
*   **B-11 `textarea`のコピー・切り取り・貼り付け：未確認**。自動操作の`Ctrl`+`C`/`X`/`V`は`code`が空のイベントとなり、ブラウザの編集コマンドが実行されなかった（値は変化しなかった）。アプリ側では、これらのキーは`KeyboardShortcuts`の対応表に一致しない（`KeyV`は`ctrl: false`のエントリのみ）ため`preventDefault()`されないことを、ログで確認した（`defaultPrevented: false`）。**実機での目視確認をお願いしたい**（A-8）。

**（タスク9）確認結果・注意点**
*   **C-13・C-39は変更していない**：発注者判断のとおり、図形の`id`の`@type {string|number|null}`と`VectorModel`の先頭責務JSDocは現状のまま据え置いた。なお、タスク9で追加した`VectorModel`のクラスJSDocにはid採番を担う旨を記載したため、先頭責務JSDocに書かれていないid採番の責務はクラスJSDocから読み取れる。
*   **クラスJSDocの追加はタスク9の確認項目の外側**：作業内容に明示された確認項目ではないが、「タスク1〜8の変更・新規ファイル」の範囲内で、憲法の「クラスにJSDocを記述」の欠落を補完したもの（コメントのみ）。本フェイズで触れていない他ファイル（`KeyboardShortcuts.js`・`ViewTransform.js`・`DragTracker.js`・`WindowManager.js`）は確認対象外のため、同種の欠落があっても未確認である。
*   **図形クラスのクラスJSDocは12メソッド契約を列挙している**：将来、共通メソッド契約にメソッドを増減する場合は、4図形クラスのクラスJSDoc（および`toJSON`/`fromJSON`の「第11・第12メソッド」の表記）も更新すること。
*   **目視確認**：コメントのみの変更のため挙動の目視確認は不要と判断した（構文確認と往復の一致は上記のとおり確認済み）。追加したクラスJSDocの文言が開発資料の用語と食い違っていないか、タスク11の反映時に一読されたい。

**（タスク10）確認項目の実施状況の一覧**（タスク1〜9の記録の集約。「ブラウザ」＝実アプリでの確認、「Node」＝Node.js上の一時スクリプトでの確認）
| 項目 | 状況 | テストプレイで残っている確認 |
|---|---|---|
| A-1 往復の一致 | 一部確認（ブラウザ：5種の変換→復元→変換で文字列一致。Node：変形・平行移動した図形の往復と`hitTest`等の一致） | 復元後の見た目・ハンドル位置・ハンドル操作・範囲選択・ホバー表示の目視 |
| A-2 復元後のid衝突 | 一部確認（ブラウザ：振り直しidが重複しないこと。Node：`#nextId`の繰り上げ） | 復元後に新規作成・選択・削除しての目視 |
| A-3 未知の図形種別 | 確認済み（ブラウザ） | なし |
| A-4 全体の読み込み失敗 | 一部確認（ブラウザ：`version: 99`・壊れたJSON。Node：`0`/`1.5`/`"1"`・`format`違い・`shapes`が配列以外を含む全条件） | `version`の`0`/`1.5`/`"1"`・`format`・`shapes`の各ケースをブラウザで |
| A-5 不正な図形データ | 一部確認（ブラウザ：`strokeWidth: 0`。Node：頂点数不足・座標が文字列/`null`を含む全条件） | 頂点数不足・座標不正をブラウザで |
| A-6 操作途中の復元 | 一部確認（ブラウザ：作成途中。Node：ドラッグ・範囲選択中の`abortOngoingOperation()`） | ドラッグ中に押せた場合（通常は押せない） |
| A-7 idの欠落・重複・数値 | 一部確認（ブラウザ：重複・欠落。Node：数値・空文字等） | 数値idをブラウザで |
| A-8 `textarea`の編集操作 | 一部確認（範囲選択・Shift+矢印） | **コピー・切り取り・貼り付け（B-11）** |
| A-9 通常起動 | 確認済み（ブラウザ） | なし |
| A-10 原点表示 | 一部確認（ブラウザ：ホイールズーム時の太さ・大きさの一定性。Node/ブラウザ：グリッドの描画結果が不変） | **図形との前後関係、キーボードズーム・リセット時の追従、初期表示・リセット時の見え方（C-44）** |
| A-11 既存操作の回帰 | 一部確認（Node：モード切替30通りの新旧一致。ブラウザ：パレットのハイライト・活性/非活性） | **作成5種（パレット・数字キー）、選択・移動・ハンドル・削除・パン・ズーム全般（C-20・C-21・C-28）** |
| B-1〜B-4・B-9 | 確認済み（ブラウザ・実キー） | なし |
| B-5・B-6 | 未確認（既知の想定挙動） | 挙動の許容可否の判断 |
| B-7 テンキー・B-8 IME | 受理判定のみ（合成イベント） | **実機のテンキー入力・日本語入力** |
| B-10 スペース押下の残留 | 確認済み（合成イベント・コード確認） | スペースを押したままのクリックでのフォーカス移動（任意） |
| B-11 コピー・貼り付け | 未確認 | **実機で確認** |
*   太字はテストプレイで優先して目視確認されたい項目（自動操作では確認できなかった、または回帰の影響範囲が広いもの）。

**（タスク10）本フェイズの範囲外で発注者側の対応が必要な事項**
*   **DIRのサブフェイズ状態**：`_log/dir/261101_2154_DIR_Phase03-00_Editing_Foundation.md`のPhase 03-01の状態は作業ツリー上で「進行中」となっている（本タスクでは変更していない）。タスク11完了後の「完了」への更新は、本RESのタスクに含まれないため発注者側で行われたい。
*   **`_doc/COWORK_STATUS.md` 2章Aの持ち越し事項**：「1. 作業目的」の種別一覧の一本化により解消した（懸念事項C-1）が、同ファイルは本RESのヘッダー外資料のため参照・更新していない。持ち越し事項の消し込みは発注者側で行われたい。
*   **未コミット**：本フェイズの変更（タスク1〜10）はすべて未コミットである。
*   **タスク11の反映時の注意**：「開発資料の更新予定」は各タスクの追記が項目ごとに分散している（「（タスクn追記）」）。特に「4章 VectorModel.js」「4章 InputTracker.js」は当初の予定文とタスク6追記で記述が上書き関係にある（採番は`#issueId()`に一本化、`setMode`の処理順の変更）ため、追記側を優先して反映されたい。

**（タスク11）判断に迷った点・目視確認を推奨する箇所・今後の修正における注意点**
*   **作業データ形式の流れを3章にも置いた**：更新予定では`abortOngoingOperation()`→`replaceAllShapes()`の呼び出し順は「4章 main.js」の項目だったが、`DocumentSerializer`・`ShapeFactory`・`InputTracker`・`VectorModel`にまたがる流れであり、Phase 03-02以降（スナップショット・ファイル入出力）でも同じ順序を守る必要があるため、3章に「5. 作業データの変換・復元」を新設した（4章 main.jsにも具体的な配線を記載）。3章への項目追加が過剰であれば4章のみに戻されたい。
*   **定数の値の除外と、記載した例外**：色・大きさ・頂点数・定数名は除外したが、作業データの識別文字列`"oz-vector-editor"`（2章）と、id形式`shape-<連番>`（4章 VectorModel.js）は記載した。前者は保存されるデータの形そのもの、後者はPhase 03-03（貼り付け時の振り直し）で守るべき採番規則の契約と判断したため。除外の対象と見なす場合は削除されたい。なお、既存の記述にある定数値（背景グリッドの細線10/太線100・8px、`MIN_SCALE`=0.1〜`MAX_SCALE`=10.0、閾値3px等）は本タスクの範囲外のため触れていない。
*   **「対応表の表引きのみで、if/switch分岐は持たない」**：旧資料の「図形種別のif/switch分岐を許容する唯一の例外」を、対応表化に合わせて「図形種別の対応づけを許容する唯一の例外（対応づけは表引きのみ）」と書き換えた。`ShapeFactory.js`内の`if`は未登録判定・プレーンオブジェクト判定のみであることを確認済み。今後`ShapeFactory`に種別ごとの分岐を足す場合は、資料の当該記述も見直すこと。
*   **目視確認の推奨**：反映した文面と、タスク9で各図形クラス・`ShapeFactory`・`VectorModel`・`CanvasManager`に追加したクラスJSDocの用語（「図形データ」「作業データ形式」「ワールド座標」「12メソッド契約」等）に食い違いがないかを一読されたい（タスク9の依頼事項。本タスクでは主要な用語の一致を確認したが、全JSDocとの逐語的な突き合わせはしていない）。
*   **今後の修正における注意点**：開発資料の4章 `shapes/`・`ShapeFactory.js`・`DocumentSerializer.js`の各項は「図形種別の追加手順」「版の追加手順」「12メソッド契約」を相互に参照している。いずれかの手順を変える場合（例：対応表のエントリ項目の追加、図形データの共通項目の変更）は、3項目と2章の図形データの形をあわせて更新すること。
*   **発注者側の対応事項（タスク10からの継続）**：DIR `261101_2154`のPhase 03-01の状態更新（「完了」）、`_doc/COWORK_STATUS.md` 2章Aの持ち越し事項の消し込み、本フェイズの変更（タスク1〜11）のコミットはいずれも未実施である。

**C. 設計判断・注意点**
1. **`ShapeFactory.create()`の例外（DIR持ち越し事項）**：REQのとおり`create()`の「未知の`type`で`Error`」仕様は変えない。呼び出し元（`VectorModel.startDraft`）に渡る種別は`InputTracker.setShapeType`が`SHAPE_TYPES`（＝対応表）で検証済みの値のみとなり、種別一覧の一本化によって「受理種別と対応表の食い違い」が構造上起こらなくなるため、`try/catch`の追加なしで持ち越し事項を解消したものとみなす。
2. **検証ロジックの重複**：`fromJSON`の検証ヘルパーは4クラスに個別に置く（`#segmentIntersectsRect`の前例に倣う。`shapes/`への共通モジュール新設はREQのスコープ外）。将来、図形データの共通項目を変更する際は4クラスすべてを追従させる必要がある。
3. **`Ellipse`の`points[3]`/`[4]`**：復元時に再計算せず保存値を採用する。手でJSONを編集して不整合な値にしても描画・当たり判定には影響しないが、その後のハンドル操作で正準位置へ再計算される。
4. **`DocumentSerializer`を文字列・オブジェクトの両層で提供**：Phase 03-02のスナップショットは文字列化を省けるようオブジェクト層を使う想定。オブジェクト層の`deserialize`も例外をthrowしない。
5. **`strokeWidth`の0以下を不正とした**：REQは「数値」のみ規定。Canvasは0以下・非有限の`lineWidth`代入を無視して直前の値を残すため、描画結果が前の図形に依存する不具合を防ぐ目的で不正（スキップ）とした。0を許容すべき用途があれば見直しが必要。
6. **全図形がスキップされた場合**：全体の読み込み失敗の条件に該当しないため`ok: true`・図形0個として扱い、キャンバスは空になる。「1つも復元できなければキャンバスを変えない」方が望ましければ方針の再決定が必要。
7. **`#nextId`は減らさない**：入れ替え後の`#nextId`は`max(現在値, 保持idの最大連番 + 1)`とする。Undo（Phase 03-02）で過去の状態へ戻しても、以後のidは単調増加する。`shape-`に続く数値が`Number.MAX_SAFE_INTEGER`を超えるidは最大値の計算から除外する（実用上、新規idとの衝突は起こらない）。
8. **`setMode`の処理順の微変更**：中断処理の抽出により、作成途中の図形の破棄（`cancelDraft`の通知）が選択集合・ホバーのクリアより前に移る。最終状態・描画結果は同一だが、`model.onChange`の通知順が変わる。
9. **`user-select: text`の事前付与**：Chromium系では親の`user-select: none`が`textarea`内の選択を妨げないが、ブラウザにより差があるため、`#dev-json`・`#dev-result`に限って`user-select: text`を予防的に付与する（`.float-window`全体の指定は変更しない）。
10. **`?dev`の判定**：`URLSearchParams.has('dev')`のため、`?dev=0`や`?dev=false`でも表示される（開発者用のため許容）。
11. **ヘッダー外資料の不参照**：憲法2章に従い、RES `261031_2121`（5章「将来テキスト入力欄を追加した際の確認項目」）および用語定義元のREQ `261018_0212`・`261008_2031`は参照していない。上記Bの確認項目は、開発資料3章のキーボード操作の記述と実コード（`isTextInputElement`・`KeyboardShortcuts`の受理判定順）から作成したものであり、RES `261031_2121`の5章と項目に差異がある可能性がある。発注者側で突き合わせをお願いしたい。
12. **変更しないファイルの確認**：`KeyboardShortcuts.js`・`ViewTransform.js`・`DragTracker.js`・`WindowManager.js`の変更は不要と判断した（`SHAPE_TYPES`は再exportで同値、`WindowManager`は静的DOM・`hidden`要素も初期化時に検知可能）。
13. **（タスク1）`id`プロパティのJSDoc型**：`fromJSON`は`data.id`を検証せず代入するため、`replaceAllShapes`で正規化されるまでの間、`id`は`undefined`や任意の型を取り得る。既存の`@type {string|number|null}`は本タスクでは変更していない（正規化後は文字列になるため）。JSDocの厳密さを求める場合はタスク9で`{*}`等への変更を検討されたい。
14. **（タスク1）頂点検証の「オブジェクト」の解釈**：要件2の条件4「`points`の要素がオブジェクトでない」は、図形データ本体と同じく「`null`・配列以外の`object`」と解釈した（配列`[x, y]`の頂点も不正）。
15. **（タスク1）`Curve.fromJSON`の生成手順**：コンストラクタが作る中点の制御点は直後に`data`の値で上書きされる（仮生成）。将来コンストラクタに初期化処理（派生値のキャッシュ等）を足す場合は、`fromJSON`で`points`を差し替えた後に整合が崩れないか確認すること。タスク2の`Rect`・`Ellipse`も同様の手順となる。
16. **（タスク1）検証ヘルパーの重複**：`#validateData`は`Line`・`Curve`でほぼ同一（クラス名・種別・頂点数のみ異なる）。C-2のとおり、共通項目の検証規則を変える場合は4クラスすべてを追従させること。
17. **（タスク2）`Ellipse`の種別一覧`ELLIPSE_TYPES`**：`fromJSON`の`type`検証のため、`Ellipse.js`内に`['circle', 'arc']`を定数として持たせた。これは「`shapes/`の自分自身の値」に当たるため、タスク9の「種別文字列が`ShapeFactory.js`以外に残っていないか」の検索で検出されても除外対象と判断した。将来`Ellipse`が扱う種別を増やす場合は、この定数・コンストラクタの`endAngle`/`points[4]`の分岐・`ShapeFactory`の対応表の3箇所を揃えて更新すること。
18. **（タスク2）`Ellipse`コンストラクタは`type`を検証しない**：`new Ellipse(..., 'foo')`は従来どおり`'arc'`相当（`endAngle = π`）の振る舞いになる。`fromJSON`経由では`#validateData`が先に弾くため問題は生じない。コンストラクタの挙動は本タスクの範囲外として変更していない。
19. **（タスク2）`Rect`の4頂点の整合**：`Rect.fromJSON`は4頂点を独立に採用するため、手編集で軸平行でない（菱形などの）四角形を与えても復元される。これは既存の`setVertex`が連動再計算をしない（4頂点独立構造）仕様と一致させたもので、意図どおりである。
20. **（タスク2）目視確認**：`Ellipse`の`type`のJSDoc変更・`Rect`の`type`追加のみが既存経路に触れる変更であり、ブラウザでの確認は未実施。円・弧・矩形の作成・ハンドル操作・範囲選択が従来どおりであることを、A-11の回帰確認時にあわせて目視確認されたい。
21. **（タスク3）目視確認**：ブラウザでの確認は未実施。作成5種（パレット・数字キー1〜5の双方から種別を切り替えて作成）、起動直後の図形作成モードで直線が作られること（初期値`SHAPE_TYPES[0]`）を、A-11の回帰確認時にあわせて目視確認されたい。
22. **（タスク3）モジュールの評価順と循環importの禁止**：`InputTracker.js`は`ShapeFactory.js`をimportするようになったため、評価順は`shapes/*` → `ShapeFactory` → `DragTracker`/`InputTracker` → `KeyboardShortcuts`となる。将来`ShapeFactory.js`または`shapes/`側から`InputTracker.js`（や`KeyboardShortcuts.js`）をimportすると循環importとなり、`KeyboardShortcuts`の最上位の`SHAPE_TYPES.map(...)`が未初期化参照（TDZ）で失敗し得る。`ShapeFactory`は`core/`内の他モジュールに依存させないこと。
23. **（タスク3）種別一覧の並び順の意味**：`SHAPE_REGISTRY`の並び替えは、数字キーの割り当て（`KeyboardShortcuts`）と`currentShapeType`の初期値（先頭要素）、さらにタスク6で導入する`VectorModel.startDraft`の既定値を同時に変える。並びを変える場合は`index.html`のパレットのボタン順・各ボタンの`title`（ショートカット併記）も手動で揃えること。
24. **（タスク3）エラーメッセージの言語**：`create()`の既存メッセージ（英語）は「仕様変更なし」の方針で据え置き、新設の`fromJSON()`は要件2の図形クラスに合わせて日本語（`ShapeFactory.fromJSON: 理由`形式）とした。同一クラス内で言語が混在している点は意図的である。
25. **（タスク4）`applyMode`のJSDoc**：作業内容に「`applyMode`/`applyShapeType`のJSDocの種別列挙を`string`へ」とあるが、`applyMode`のJSDocに図形種別の列挙はなく、`@param {'select'|'create'|'pan'}`は操作モード（`OperationMode`の値）の列挙であるため変更しなかった。操作モードの列挙も型として一般化したい場合は別途指示されたい（タスク9の検索対象は図形種別の文字列のみと解釈した）。
26. **（タスク4）警告の出る時機と範囲**：整合警告はコンストラクタ実行時（起動時）の1回のみで、以後にDOMへ追加・削除されたボタンは検知しない（`WindowManager`と同じく静的DOM前提）。照合範囲はパレットのルート要素内のみで、ルート外に`palette-`で始まるidの要素があっても警告しない。将来、パレット内に`palette-`で始まるid（例：`palette-header`）の非ボタン要素を置くと「種別一覧にない要素」として警告されるため、パレット内の種別ボタン以外の要素にはこの接頭辞を使わないこと。
27. **（タスク4）図形種別の追加手順**：`ShapeFactory.js`の`SHAPE_REGISTRY`へ1エントリ追加し、`index.html`のパレットに`id="palette-<type>"`のボタン（アイコン・表示名・`title`のショートカット併記）を手で追加する。後者を忘れると起動時に①の警告が出て、その種別はパレットから選べない（数字キーでは選べる）。
28. **（タスク4）目視確認**：パレットの見た目・クリック・ハイライト・活性/非活性はブラウザ上でDOM状態として確認したが、スクリーンショットでの見た目確認と、パレットで切り替えた種別で実際に図形を作成する確認は未実施。A-11の回帰確認時にあわせて目視確認されたい。
29. **（タスク5）マイグレーション結果の検証を追加**：要件3の処理順4は「関数が未定義、または例外」のみを全体失敗としているが、マイグレーション関数が`null`等を返した場合に処理順5の`shapes`参照で例外が起き「例外をthrowしない」契約が破れるため、「戻り値がプレーンオブジェクトでない」も全体失敗とした。また`MIGRATIONS`の参照は自身のプロパティのみ（`hasOwnProperty`）とし、`Object.prototype`由来の値を関数と誤認しないようにした。
30. **（タスク5）図形単位の`try/catch`は想定外の例外も吸収する**：図形クラスの`fromJSON`に実装バグ（`TypeError`等）があっても、その図形はスキップとして記録され処理は続行する（理由欄に`TypeError`のメッセージが出る）。結果表示や`console.warn`に検証メッセージ（「`クラス名.fromJSON: `」形式）以外の理由が出た場合は、データ不正ではなく実装不具合を疑うこと。
31. **（タスク5）`serialize`系は例外を投げ得る**：「例外をthrowしない」のはデシリアライズ系のみ。`serialize`/`serializeToString`は入力を検証せず、`toJSON`を持たない要素が混ざると`TypeError`となる（呼び出し元は`model.getShapes()`のみを渡す想定）。
32. **（タスク5）エラーメッセージの値表記**：版番号・`format`は`String()`で埋め込むため、`version: "1"`（文字列）は「対応していない版番号です: 1」と数値の1と同じ表記になる。原因が型違いであることは表示からは読み取りにくい（A-4の確認時に留意）。
33. **（タスク5）マイグレーションの参照共有**：版が現行版と同じ場合、マイグレーションを適用せず入力オブジェクトをそのまま読む（コピーしない）。将来マイグレーション関数を書く際は、契約どおり引数を書き換えず新しいオブジェクトを返すこと（書き換えると呼び出し元の作業データ、Phase 03-02ではUndo履歴のスナップショットが壊れる）。
34. **（タスク5）`console.warn`の件数**：スキップ1件ごとに1行出すため、大量の不正図形を含む作業データではコンソールが多量の警告で埋まる。現状の用途（確認用ウィンドウ）では許容と判断した。
35. **（タスク6）`setMode`の通知順の変化（C-8の実測）**：作成途中からの切替では、変更通知の回数（3回）は従来と同じだが、順序が「選択解除 → ホバー解除 → 作成途中の破棄」から「作成途中の破棄 → 選択解除 → ホバー解除」へ変わった。現状のリスナー（`renderCurrentState`・`syncDeleteButtonState`）は通知順に依存しないため影響はない。将来、通知の中間状態を観測するリスナー（Phase 03-02の履歴記録など）を追加する場合は留意すること。
36. **（タスク6）カーソル再評価の位置**：`#abortOngoingOperation()`自体はカーソルを再評価せず、公開`abortOngoingOperation()`と`setMode`がそれぞれ最後に1回行う（`setMode`で古いモードのカーソルを一瞬挟まないため）。ただしドラッグ中断時は`onCancel`経由（`#finishPan`/`#finishLeftDrag`）でも従来どおり再評価される。新たな呼び出し元から`#abortOngoingOperation()`を直接使う場合は、カーソルの再評価を忘れないこと。
37. **（タスク6）`abortOngoingOperation()`はスペース押下状態を解除しない**：スペースを押したまま復元した場合、復元後もスペースパンのカーソル（`grab`）・挙動が続く（キーの物理状態であり、進行中の操作ではないため）。確認用ウィンドウのボタンをクリックする時点ではスペースパン（左ドラッグ）は成立しないため、実用上の問題はない想定。
38. **（タスク6）同一インスタンスが配列内に重複している場合**：`replaceAllShapes`のidの重複判定は図形インスタンスではなくidの値で行うため、同じインスタンスが2回含まれると、2回目の出現でそのインスタンスのidが振り直され、1回目の要素も同じ新idになる（両要素が同一idを持つ）。`DocumentSerializer.deserialize`は要素ごとに新規インスタンスを生成するため通常は発生しない。Phase 03-03（貼り付け）等で既存インスタンスを渡す場合は、呼び出し側で複製すること。
39. **（タスク6）`VectorModel`の先頭責務JSDocは変更していない**：既存の「図形データ…の状態管理（SSOT）と更新通知」に図形一式の入れ替え・id採番が含まれると判断した（作業内容にも先頭責務JSDocの更新指示はない）。タスク9の確認時に、id採番の明記が必要か判断されたい。
40. **（タスク6）`replaceAllShapes`のid書き換えは引数の図形インスタンスに対して行う**：振り直し対象の図形の`id`は、受け取ったインスタンス上で直接書き換える（要件5のとおり、インスタンスは複製しない）。呼び出し側が入れ替え後も同じインスタンスを別用途で保持している場合、そのidも変わる点に注意。
41. **（タスク7）`#getVisibleWorldBounds()`の前提**：現在の描画変換（`ctx.getTransform()`）から可視範囲を求めるため、`render()`内でワールド座標の描画変換を設定した後、かつ`save()`/`restore()`の外（または変換を変えていない区間）で呼ぶ必要がある。また対角2隅のみを写すため、描画変換が拡大縮小＋平行移動である（回転・せん断を含まない）ことを前提とする。将来ビューに回転を加える場合は四隅すべてを写す実装へ変更すること（グリッド・原点表示の両方に影響）。
42. **（タスク7）原点マークは可視範囲外でも描画命令を発行する**：軸線は可視範囲判定で省略するが、十字＋円は常に発行する（数本のパスのみで、範囲外はCanvasが切り捨てるため判定を省いた）。同様に、両軸とも範囲外の場合は空のパスに対して`stroke()`が1回呼ばれる（描画結果への影響はない）。描画命令の数を厳密に抑えたい場合は判定を追加されたい。
43. **（タスク7）軸線とグリッド線の重なり**：`x = 0`・`y = 0`は常にグリッドの細線・太線の位置でもあるため、軸線はグリッド線の上に重ねて描かれる（半透明色の合成で、軸線単独の`0.32`より濃く見える。実測でアルファ値約0.45）。グリッドの色を変える場合は軸線との見分けやすさを再確認すること。
44. **（タスク7）目視確認**：画面上の太さ・大きさの一定性と原点マークの見た目はブラウザで確認したが、図形を重ねた状態での前後関係（図形より背面）、キーボードによるズーム・リセット時の追従、初期表示・リセット時に軸線が画面の上端・左端に沿う見え方（線の中心が画面端にあるため半分のみ見える）は未確認。A-10の確認時にあわせて目視確認されたい。
45. **（タスク7）確認環境の注意（ブラウザキャッシュ）**：確認時、同じポートで以前に配信された旧版のモジュールがブラウザにキャッシュされており、更新後のファイルが読まれない事象があった（別ポートで再確認して解消）。テストプレイ時に原点表示が出ない場合は、強制再読み込み（キャッシュ無効化）を試されたい。
46. **（タスク8）ウィンドウの`×`ボタンは何もしない**：既存の2ウィンドウと同じく、`×`ボタンにはクリック処理が配線されていない（`WindowManager`・既存の`main.js`にも閉じる処理はない）。確認用ウィンドウも同じ見た目を揃えるために置いただけで、押しても閉じない。閉じる機能が必要なら全ウィンドウ共通の機能として別途検討されたい。
47. **（タスク8）`DevPanel`の要素解決はルート要素内の`querySelector`**：`#dev-*`のidで解決するが、探索範囲はルート要素内に限る（`PaletteController`と同じくルート外の同名idには反応しない）。要素が1つでも欠けた場合はボタンを一切配線しない（部分的な配線で`null`参照の例外が出るのを防ぐため）。
48. **（タスク8）`onImport`の例外**：`DevPanel`はコールバックの例外を捕捉しない。`deserializeFromString`は例外を投げない契約であり、`abortOngoingOperation`・`replaceAllShapes`も通常は例外を投げないため捕捉していない。将来`onImport`内の処理を増やす場合は、例外がclickハンドラから漏れると結果表示が更新されない点に注意。
49. **（タスク8）復元直後の図形作成モードのカーソル**：作成途中の復元で`abortOngoingOperation()`がカーソルを再評価するが、マウスはウィンドウ上にあるため、キャンバスへ戻った時点の`mousemove`で通常どおり更新される（確認時に異常なし）。
50. **（タスク8）開発資料への影響**：「開発資料の更新予定」の「4章 index.html」「4章 main.js」「4章 palette/DevPanel.js（新設）」「3章 起動処理」の記載どおりで、追加の更新事項はない。補足として、確認用ウィンドウの配線は`main.js`の番号「9」でキーボードショートカット配線（8）の直後・起動時初期化（`applyMode`）の前に置いた旨、`DevPanel`の結果表示の文言（成功・失敗）を4章に記載するとよい。資料本体は修正していない（タスク11で反映）。
