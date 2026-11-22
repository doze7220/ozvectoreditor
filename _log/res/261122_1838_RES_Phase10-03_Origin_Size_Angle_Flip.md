# RES: 作業計画・作業レポート (Phase 10-03) : 基準点・大きさと角度の数値入力・反転
* 参照元REQ: `./_log/req/261122_1710_REQ_Phase10-03_Origin_Size_Angle_Flip.md`

## 1. 作業目的
選択（`V`）で図形を選んでいるとき、**基準点（外枠の四隅・辺の中央・中心の9か所から1つ）を選べるようにし、幅・高さ・角度を数値で指定でき、縦横に反転できるようにする**。回転（ドラッグ・数値）・反転・数値での幅と高さの変更は基準点を動かさずに行い、位置の欄（X・Y）は**線を含まない外枠の上の基準点の位置**を表す。あわせて**オプションバーを2行にする**（ツールバーの高さ40px→80px）。

最上位の要件：
* `node --test`が全件通る（作業前 tests 2382 / suites 392）。既存の期待値を変えるのは、2章「要件I」に列挙したケースだけ（(a)位置の欄の意味の変更、(b)キーの対応表の2エントリの追加、(c)ドラッグの回転の中心）。
* 基準点を中心のまま、新しい欄・ボタン・キーを使わない限り、図形の編集のふるまいを変えない（変わるのは位置の欄が表す点と、オプションバーが2行になってキャンバスの領域が40px低くなること、位置の欄の後ろの`px`が無くなること（発注者の決定。2章「オプションバーの部品の作り」）だけ）。外枠のハンドルの拡大縮小は基準点を使わず今のまま。
* 作業データの版（3）・書き出し形式の版（4）は上げない。基準点・比率の鍵の状態は保存しない（作業データ・書き出し・履歴・`VectorModel`に入れない）。
* 改名・整形・削除をしない。既存の公開名・DOMのid・クラス名は変えない。`KeyboardShortcuts.js`の対応表は反転の2エントリを足すだけ。到達不能の枝は消さず直さない。

REQの要件と本計画の設計の対応：要件1（2行）＝要件A、要件2（基準点と位置の欄）＝要件B・C・G・H、要件3（幅・高さ・鍵）＝要件D・G・H、要件4（角度）＝要件D・G・H、要件5（反転）＝要件D・E・G・H、要件6（ドラッグの回転の中心）＝要件F、要件7（テスト）＝要件I、要件8（テストプレイの確認項目）＝5章の末尾とタスク13。

## 2. アーキテクチャ設計
### 全体の方針
* **状態の持ち主は1つ**：基準点と比率の鍵は、新しい`core/TransformInputSettings.js`（`UnitSnapSettings`と同じ形の設定の持ち主。保持・切り替え・変更通知のみ）だけが持つ。`main.js`が1つ生成する（`// 3.4.`。`InputTracker`より前）。作業データ・書き出し・スナップショット（履歴）・保存先・`VectorModel`に入れない。キャンバスの切り替え・選択の変更・取り消し/やり直しでは触れず、ページを開き直すと初期値（基準点＝中心・鍵＝外れている）に戻る。`InputTracker`・`edit/`の手順は、`main.js`が注入する照会関数（`getReferencePoint`・`isAspectLocked`）だけで読む（クラスを知らない）。
* **基準点の位置の求め方は1か所**：新しい`core/ReferencePointRules.js`の`resolveReferencePointPosition(bounds, referencePoint)`（状態なし）。中心の式は`ScaleHandleRules.computeFrameCenter`を呼ぶ（写さない）。使う側は3つ：`RotationRules.computeRotationCenter`（ドラッグの回転の中心）、`edit/PositionInputEditor`（位置の欄）、`edit/TransformInputEditor`（幅・高さ・角度・反転の動かない点）。外枠は常に`ShapeExtentReader.getSelectedGeometryBounds()`（線を含まない外枠）。基準点は名前（9か所の文字列）だけを覚え、座標は覚えない（毎回今の外枠から求める）。
* **変換の式は今の箇所を使う**：幅・高さ＝`ScaleHandleRules.toScaleTransform({ scaleX, scaleY, originX: 基準点.x, originY: 基準点.y })`、角度＝`RotationRules.toRotationTransform(基準点, −(度 × π / 180))`（時計回りが正の約束のため、角度の欄のプラス＝反時計回りをこの手前で符号を変えて渡す。90°の倍数のちょうどの値の扱いはそのまま効く）、反転＝`toScaleTransform`の倍率−1（横＝`scaleX: −1`、縦＝`scaleY: −1`。動かない点は基準点。「拡大縮小の倍率−1」として作れることを確かめた：`e = originX − (−1)·originX = 2·originX`）。当て方は図形の`createTransformed`と`VectorModel.replaceShapesKeepingIds`（`id`・並び・選択を保ったまま通知1回）。図形種別の分岐は持たない。
* **押せる条件の判定は1か所**：`edit/TransformInputRules.canTransformSelection(target, bounds)`（`target`＝`core/NudgeTargetRules.resolveNudgeTarget(getMode(), 選択, 頂点の選択)`の結果が`type: 'shapes'`＝選択（`V`）で図形を1つ以上選んでいる、かつ線を含まない外枠の4つの値が有限）。表示（欄・ボタンの`disabled`）と手順（受理しない）が同じ判定を共有する。操作モードの値は`edit/`で解釈しない（`PositionInputEditor`と同じく規則へ渡すだけ）。
* **オプションバーの部品の作り（3章13.）に載せる**：新しいまとまりは2つ＝「大きさ」（`#option-size-group`。`W:` 欄・比率の鍵・`H:` 欄・`px`）と「変形」（`#option-transform-group`。角度の欄・基準点の3×3・反転の2ボタン）。まとまりごとに`palette/`のUI部品1つ（`OptionBarSizeGroup`・`OptionBarTransformGroup`。DOMの表示と通知だけ・importなし）と`main.js`の配線ブロック1つ（`// 7.13.`・`// 7.14.`）。規則＝`edit/TransformInputRules`（状態なし）、手順＝`edit/TransformInputEditor`（1件の編集操作）。既存の「位置」のまとまり（`#option-position-group`・`OptionBarPositionGroup`）は、まとまり・UI部品・ブロックの分け方を変えない（資料3章13.「数値の欄を足すときは、まとまり・UI部品・ブロックを足すだけで既存のものを変えない（大きさ・角度の欄を足すときも同じ）」に従う）。ただし**【発注者の決定 2026-11-22】2行目の位置〜大きさの並びは`X: Y: │ W: 🔒 H: px`にする**：`index.html`の`#option-position-group`から`px`の`<span class="option-unit">px</span>`だけを消し、単位は大きさのまとまりの`px`1つにする。`OptionBarPositionGroup.js`が読む要素は`#option-position-x`・`#option-position-y`だけのため、JSは変わらない（`OptionBarPositionGroup`は「変えないファイル」のまま）。2行目の並びは`X: Y: │ W: 🔒 H: px │ ∠ ° 基準点 反転 │ 整列・分布 │ 角`になる（5章(1)）。
* **表示の同期の経路**：図形・選択・モードの変化は既存の`model.onChange`で同期する。基準点・比率の鍵を押したときは図形が変わらず`model.onChange`が来ないため、**設定の持ち主の変更通知`transformInputSettings.onChange`に、既存の3つの同期関数（`syncOptionBarPositionGroup`・`syncOptionBarSizeGroup`・`syncOptionBarTransformGroup`）だけを登録する**（`unitSnapSettings.onChange` → `syncUnitSnapGroup`・`syncCursorReadout`と同じ形。キャンバスは再描画しない＝基準点の印はキャンバスに出さない）。コールバックの中から同期関数を直接呼ぶ案は、設定に依存する表示が増えるたびにコールバックを直すことになり、設定の持ち主の作り（`UnitSnapSettings`）とも違うため採らない。これが本作業で足す唯一の通知元で、資料3章の「同期の経路（全機能共通）」に1項として書く。
* **`InputTracker`を太らせない**：第7引数`InputAssist`に6項目目の照会`getReferencePoint`を足し、回転の押下`#beginRotateSelection`で`computeRotationCenter(rotationHit.frame, this.#inputAssist.getReferencePoint())`と渡すだけ（計算・判定表を持たない。既定は`null`＝外枠の中心＝今と同じ値）。行数の見積もり：2027行 → 約2038行（+約11行。typedefの1項目・既定値・正規化の各3行前後と呼び出し1か所・JSDoc）。
* **依存方向**（新しい向き）：`core/ReferencePointRules → core/ScaleHandleRules`（`computeFrameCenter`・`SCALE_HANDLE_NAMES`）、`core/RotationRules → core/ReferencePointRules`（`resolveReferencePointPosition`。`computeFrameCenter`のimportは使わなくなるため外す）、`core/TransformInputSettings → core/ReferencePointRules`（値と判定）、`edit/PositionInputEditor → core/ReferencePointRules`、`edit/TransformInputEditor → core/NudgeTargetRules`・`core/ReferencePointRules`・`./TransformInputRules`、`edit/TransformInputRules → core/StatusReadoutRules`・`core/ScaleHandleRules`（`toScaleTransform`）・`core/RotationRules`（`toRotationTransform`）、`main.js → core/TransformInputSettings`・`edit/TransformInputEditor`・`edit/TransformInputRules`（`FLIP_AXIS`）・`palette/OptionBarSizeGroup`・`palette/OptionBarTransformGroup`。`ScaleHandleRules`は`InputModes`・`UnitSnapRules`だけ、`ReferencePointRules`は`ScaleHandleRules`だけをimportするため循環しない。`core/`から`edit/`・`io/`・`palette/`、`shapes/ → io/`、`io/ → shapes/`の向きは増やさない。`edit/ → core/`の例外（資料1章「依存方向」(3)）にファイルが増える（資料へ反映する）。
* **変えないファイル**：`ScaleHandleRules`・`CanvasManager`・`VectorModel`・`DragTracker`・`PressActionRules`・`CursorShapeRules`・`InputModes`・`FocusKeyYieldRules`・`UnitSnapSettings`・`StatusReadoutRules`・`NudgeTargetRules`・`edit/NudgeEditor`・`edit/PositionInputRules`・`edit/ShapeExtentReader`・`edit/ShapeAlignEditor`・`palette/OptionBarPositionGroup`・`wiring/`・`shapes/`・`io/`・`check/`・`sprite-check.html`・`asset/sprite/`。

### 要件A: オプションバーを2行にする（`index.html`）
* **寸法**：`:root`の`--toolbar-height`を`80px`にする（コメント「ツールバーの高さ（2行固定。各行はこの半分）」）。40pxを写した値を作らない。定規（`#ruler-horizontal`・`#ruler-corner`の`top: var(--toolbar-height)`）・キャンバスの領域（`--canvas-area-top`）・フロートウィンドウの既定の位置（`--float-window-top`）・読み込み中の覆いは今の`var()`の式のまま追従する（JSは高さを持たない。`CanvasManager`・`RulerRenderer`・`main.js`は`clientWidth`・`clientHeight`、`InputTracker.getScreenCoordinate`は`getBoundingClientRect`で読むため、マウスの座標はずれない。実コードで確かめた）。
* **行の作り**：`<header id="toolbar" class="toolbar">`の中に`<div class="toolbar-row">`を2つ置き、今のまとまり（`.toolbar-group`）を入れる（まとまりの中身・id・クラスは変えない。例外は`#option-position-group`の`px`の`<span class="option-unit">px</span>`を1つ消すことだけ＝下の「位置のまとまりの`px`を消す」）。1行目＝🧰📁・取り消しとやり直し・削除と結合・`#option-style-group`・`#option-order-group`。2行目＝`#option-position-group`・新しい`#option-size-group`・新しい`#option-transform-group`・`#option-align-group`・`#option-corner-group`。区切りの罫線は今の`.toolbar-group + .toolbar-group`が行ごとに付く（行の先頭のまとまりには付かない）。
* **CSS**：`.toolbar`のルールに`flex-direction: column; align-items: stretch;`を足す（`.toolbar, .status-bar`の共通ルールは変えず、`.toolbar`だけで上書き）。新しいルール`.toolbar-row { display: flex; flex-wrap: nowrap; align-items: center; flex: 1 1 0; min-height: 0; overflow: hidden; white-space: nowrap; }`（2行で高さを等分。行の高さの値を書かない）。各行は収まらない右側が切れる（今の1行と同じ規則）。幅・高さ・角度の欄は、今の`#option-stroke-width, #option-position-x, #option-position-y`のルールのセレクタに`#option-size-width, #option-size-height, #option-angle`を足して同じ大きさ（56×24・`user-select: text`）にする。基準点の3×3：`.option-reference-grid { display: grid; grid-template-columns: repeat(3, 10px); grid-template-rows: repeat(3, 10px); gap: 1px; flex: none; }`（32×32）、`.option-reference-btn { box-sizing: border-box; width: 10px; height: 10px; padding: 0; border: 1px solid #999; border-radius: 1px; background-color: #fff; cursor: pointer; }`、`.option-reference-btn[aria-pressed="true"] { background-color: #6699ff; border-color: #3366cc; }`、`.option-reference-btn:disabled { opacity: 0.4; cursor: default; }`。比率の鍵・反転のボタンは今の`.tool-btn.icon-btn`（押された見た目は`.tool-btn[aria-pressed="true"]`の今のルール）。
* **新しいまとまりのHTML**（記号は仮。ボタンの中身の1文字で差し替えられる）：
    *   `#option-size-group`：`<span class="option-unit">W:</span>` → `<input type="number" id="option-size-width" step="any" title="幅（線の太さを含まない外枠の幅。入れた幅になるよう基準点を動かさずに伸び縮みする）">` → `<button type="button" id="option-size-lock" class="tool-btn icon-btn" title="幅と高さの比率を保つ" aria-pressed="false" disabled>🔒</button>` → `<span class="option-unit">H:</span>` → `<input type="number" id="option-size-height" step="any" title="高さ（…同じ形…）">` → `<span class="option-unit">px</span>`。
    *   `#option-transform-group`：`<span class="option-unit">∠</span>` → `<input type="number" id="option-angle" step="any" title="回転（入れた角度だけ基準点の周りに回す。プラスで反時計回り。確定すると0に戻る）">` → `<span class="option-unit">°</span>` → `<div class="option-reference-grid" title="基準点（回転・反転・幅と高さの変更で動かない点。位置の欄が表す点）">`の中にボタン9つ（並びは左上・上中央・右上・左中央・中心・右中央・左下・下中央・右下。各`<button type="button" id="option-reference-<名前>" class="option-reference-btn" data-reference-point="<名前>" title="基準点：左上" aria-pressed="false" disabled></button>`。`<名前>`は`nw`・`n`・`ne`・`w`・`center`・`e`・`sw`・`s`・`se`＝要件Bの`REFERENCE_POINT`の値と同じ文字列）→ `<button type="button" id="option-flip-horizontal" class="tool-btn icon-btn" title="横に反転 (Shift+H)" disabled>⇆</button>` → `<button type="button" id="option-flip-vertical" class="tool-btn icon-btn" title="縦に反転 (Shift+V)" disabled>⇅</button>`。
    *   位置の欄の`title`を直す：X＝「基準点のX座標（線の太さを含まない外枠の上。頂点の選択では選んだ頂点の左上）」、Yも同じ形。
    *   **位置のまとまりの`px`を消す（発注者の決定 2026-11-22）**：`#option-position-group`の最後の`<span class="option-unit">px</span>`（`#option-position-y`の次）だけを消す。`X:`・`Y:`の`<span>`・2つの欄・まとまりのid・クラスは変えない。2行目の位置〜大きさは`X: [ ] Y: [ ] │ W: [ ] 🔒 H: [ ] px`の並びになる（単位は大きさのまとまりの`px`1つ）。`OptionBarPositionGroup.js`は`#option-position-x`・`#option-position-y`だけを読むため変えない。
* **幅の見積もり（1280px幅）**：1行目＝左右の余白16＋🧰📁68＋取り消し/やり直し68＋削除/結合68＋区切り17×4＋スタイル約218＋重なり順140＝**約646px**。2行目＝余白16＋位置約154（`X:`約15＋欄56＋`Y:`約15＋欄56＋gap4×3。`px`を消したため今の約174から約20減る）＋区切り17＋大きさ約210（`W:`約15＋欄56＋鍵32＋`H:`約15＋欄56＋`px`約16＋gap4×5）＋区切り17＋変形約188（`∠`約10＋欄56＋`°`約6＋3×3の32＋反転32×2＋gap4×5）＋区切り17＋整列・分布284＋区切り17＋角約106＝**約1026px**。どちらも1280pxに収まる。`index.html`の幅の見積もりのコメント（今の1行の約1261px）を、この2行分の見積もりに書き換える。
* **40pxを前提にしたコメントの数値を直す**：ツールパレット（`top`＝ツールバー80px＋定規20px＋余白8px＝108px、1280×800での範囲 y 108〜約450）、キャンバスパレット（`top`108px、y 108〜約625）、`?dev`の確認用ウィンドウ（y 108〜）、色の欄の包み（「ツールバーの1行（`--toolbar-height`の半分）に収まるよう欄は32×24px」）、`.toolbar, .status-bar`の共通ルールのコメント（ツールバーは2行・ステータスバーは1行で固定）、`.toolbar`のコメント（高さは`--toolbar-height`で固定・行`.toolbar-row`の中にまとまりを足す）。ステータスバーの上端（800−28＝772px）は変わらない。

### 要件B: 基準点の規則（新規`core/ReferencePointRules.js`）と設定の持ち主（新規`core/TransformInputSettings.js`）
* **`core/ReferencePointRules.js`**（状態なし。import＝`./ScaleHandleRules.js`の`SCALE_HANDLE_NAMES`・`computeFrameCenter`のみ。DOM・図形・`VectorModel`を知らない）：
    *   `export const REFERENCE_POINT = Object.freeze({ NW: SCALE_HANDLE_NAMES.NW, N: SCALE_HANDLE_NAMES.N, NE: SCALE_HANDLE_NAMES.NE, W: SCALE_HANDLE_NAMES.W, CENTER: 'center', E: SCALE_HANDLE_NAMES.E, SW: SCALE_HANDLE_NAMES.SW, S: SCALE_HANDLE_NAMES.S, SE: SCALE_HANDLE_NAMES.SE })`（基準点の名前の唯一の定義。四隅・辺の中央は外枠のハンドルの名前と同じ文字列＝外枠のハンドルの位置と同じ点、中心は`'center'`。`index.html`の`data-reference-point`はこの値と同じ文字列（二重定義。変えるときはそろえる））。
    *   `export const DEFAULT_REFERENCE_POINT = REFERENCE_POINT.CENTER`。
    *   非公開の表`REFERENCE_POINT_AXES`（名前 → `{ h: −1|0|1, v: −1|0|1 }`。−1＝最小側・0＝中心・+1＝最大側）。**名前の文字（`'w'`・`'e'`・`'n'`・`'s'`）を`includes`で読んではならない**（`'center'`は`'e'`・`'n'`を含むため）。表で引く。
    *   `export function isReferencePoint(value)`：`REFERENCE_POINT`の値の文字列なら`true`。
    *   `export function resolveReferencePointPosition(bounds, referencePoint)`：`center = computeFrameCenter(bounds)`、`x = h < 0 ? minX : (h > 0 ? maxX : center.x)`、`y = v < 0 ? minY : (v > 0 ? maxY : center.y)`。`referencePoint`が`REFERENCE_POINT`の値でない（`null`・`undefined`・未知の文字列）なら中心として扱う（`computeFrameCenter(bounds)`の値そのもの＝今の回転の中心と同じ値）。幅・高さが0の外枠も同じ式（両側が同じ値）。検証はしない（`bounds`は有限の値を持つ前提。`computeFrameCenter`と同じ）。引数を書き換えず新しいオブジェクトを返す。
* **`core/TransformInputSettings.js`**（`UnitSnapSettings`と同じ形。import＝`./ReferencePointRules.js`の`REFERENCE_POINT`・`DEFAULT_REFERENCE_POINT`・`isReferencePoint`のみ。DOM・`VectorModel`・`InputTracker`・図形を知らない）：
    *   typedef`TransformInputSettingsSnapshot`＝`{ referencePoint: string, aspectLocked: boolean }`。
    *   クラス`TransformInputSettings`：`#referencePoint = DEFAULT_REFERENCE_POINT`・`#aspectLocked = false`・`#listeners`。`getState()`（呼ぶたびに新しいプレーンオブジェクト）・`getReferencePoint()`・`isAspectLocked()`・`setReferencePoint(value)`（`isReferencePoint`でなければ`console.warn`して何もしない。同じ値なら通知しない。変われば1回通知）・`setAspectLocked(value)`（真偽値でなければ`console.warn`して何もしない。同じなら通知しない）・`toggleAspectLock()`（反転して1回通知）・`onChange(callback)`（関数以外は無視。通知は引数なし）。クラスJSDocに「作業データ・履歴・書き出し・保存先に含めない・`VectorModel`に持たせない・アプリ全体で1つ（キャンバスの切り替え・選択の変更・取り消し/やり直しでは触れない）・ページを開き直すと初期値」と書く。

### 要件C: 位置の欄の基準点（`edit/PositionInputEditor.js`）
* `PositionInputRules.js`・`OptionBarPositionGroup.js`・`NudgeEditor.js`は変えない（規則は「範囲の左上を入力値へ動かす量」のまま）。
* コンストラクタの依存に`getReferencePoint`（`function(): string|null`。関数でなければ`() => DEFAULT_REFERENCE_POINT`）を足す。`#shapeExtentReader`の型に`getSelectedGeometryBounds`を足す（`getSelectedBounds`は使わなくなる。`ShapeExtentReader`は変えない）。
* `#resolveTargetAndBounds`の図形（`target.type === 'shapes'`）の枝：`frame = this.#shapeExtentReader.getSelectedGeometryBounds()`、`null`なら`{ target, bounds: null }`、そうでなければ`p = resolveReferencePointPosition(frame, this.#getReferencePoint())`を求め、**基準点の位置の0×0の範囲**`{ minX: p.x, minY: p.y, maxX: p.x, maxY: p.y }`を範囲として返す（その左上＝基準点。規則は変えずに「基準点を入力値へ動かす量」になる）。頂点の枝は今のまま（`computeVertexHandlesBounds`の左上）。
* 先頭の責務定義・クラスJSDoc・`getPositionView`・`#resolveTargetAndBounds`のJSDocを「図形は線を含まない外枠の上の基準点、頂点は選んだ頂点全体の範囲の左上」に直す。基準点のボタンを押したときの表示の更新は`main.js`の`transformInputSettings.onChange`（要件H）。
* 線の太さを変えても図形の位置の表示は変わらなくなる（外枠が線を含まないため）。ステータスバーの`W:`・`H:`・整列・分布・書き出しの`bounds`は今のまま線を含む外枠。

### 要件D: 幅・高さ・角度・反転の規則と手順（新規`edit/TransformInputRules.js`・`edit/TransformInputEditor.js`）
* **`edit/TransformInputRules.js`**（状態なし・DOMなし。import＝`../core/StatusReadoutRules.js`の`formatReadoutNumber`・`../core/ScaleHandleRules.js`の`toScaleTransform`・`../core/RotationRules.js`の`toRotationTransform`のみ。図形・`VectorModel`・履歴・操作モードの値を知らない）：
    *   `export const SIZE_AXIS = Object.freeze({ WIDTH: 'width', HEIGHT: 'height' })`・`export const FLIP_AXIS = Object.freeze({ HORIZONTAL: 'horizontal', VERTICAL: 'vertical' })`（唯一の定義。`palette/`の2つの部品は同じ文字列を非公開の定数で持つ二重定義。変えるときはそろえる）・`export const ANGLE_INPUT_IDLE_TEXT = '0'`（押せるときの角度の欄）。
    *   typedef`SizeInputView`＝`{ width: string, height: string, widthDisabled: boolean, heightDisabled: boolean, lockDisabled: boolean, aspectLocked: boolean }`、typedef`TransformInputView`＝`{ angle: string, referencePoint: string|null, disabled: boolean }`（どちらも`palette/`の部品のtypedefと二重定義）。
    *   `export function canTransformSelection(target, bounds)`：`target`が`null`・`undefined`でなく`target.type === 'shapes'`、かつ`bounds`が`null`・`undefined`でなく4つの値が有限なら`true`（押せる条件の唯一の判定）。
    *   `export function buildSizeInputView(enabled, bounds, aspectLocked)`：`enabled`が偽 → `{ width: '', height: '', widthDisabled: true, heightDisabled: true, lockDisabled: true, aspectLocked: false }`。真 → `w = maxX − minX`・`h = maxY − minY`、`{ width: formatReadoutNumber(w), height: formatReadoutNumber(h), widthDisabled: w === 0, heightDisabled: h === 0, lockDisabled: false, aspectLocked: aspectLocked === true }`（長さ0の向きは`'0.0'`を出したまま押せない）。
    *   `export function buildTransformInputView(enabled, referencePoint)`：偽 → `{ angle: '', referencePoint: null, disabled: true }`。真 → `{ angle: ANGLE_INPUT_IDLE_TEXT, referencePoint, disabled: false }`。
    *   非公開`parseInputNumber(text)`：`typeof text !== 'string' || text.trim() === ''`なら`null`、`Number(text)`が有限でなければ`null`、そうでなければその値（`resolvePositionDelta`と同じ受理の形。`PositionInputRules`は変えないため、この3行はこのファイルにも書く。5章(9)）。
    *   `export function resolveSizeTransform(axis, text, bounds, origin, aspectLocked)`：①値＝`parseInputNumber(text)`、`null`・0以下なら`null`。②`axis`が`SIZE_AXIS`の値でなければ`null`。③その軸の長さ（幅または高さ）が0なら`null`、値が長さと等しい（`===`）なら`null`（今と同じ値）。④`s = 値 / 長さ`（丸める前の実際の長さ。表示の丸めを持ち込まない）。⑤もう一方の軸の倍率＝`aspectLocked === true`かつその軸の長さが0でなければ`s`、そうでなければ1。⑥`toScaleTransform({ scaleX, scaleY, originX: origin.x, originY: origin.y })`を返す。
    *   `export function resolveRotationTransform(text, origin)`：値＝`parseInputNumber(text)`、`null`・0なら`null`。`toRotationTransform(origin, −(値 × Math.PI / 180))`を返す（プラス＝反時計回り。360°以上・−360°以下もそのまま。刻みは当てない）。
    *   `export function resolveFlipTransform(axis, origin)`：`HORIZONTAL` → `toScaleTransform({ scaleX: −1, scaleY: 1, originX: origin.x, originY: origin.y })`、`VERTICAL` → `scaleY: −1`、それ以外は`null`。
    *   すべて引数を書き換えず、新しいオブジェクトを返す。
* **`edit/TransformInputEditor.js`**（1件の編集操作の手順。import＝`../core/NudgeTargetRules.js`の`resolveNudgeTarget`・`../core/ReferencePointRules.js`の`resolveReferencePointPosition`・`./TransformInputRules.js`のみ。DOM・操作モードの解釈・図形種別の分岐・スナップを持たない。`try/catch`を持たない）：
    *   コンストラクタ`{ model, getMode, shapeExtentReader, editRecorder, getReferencePoint, isAspectLocked }`（`model`は`getSelectedIds`・`getSelectedVertices`・`getShapes`・`replaceShapesKeepingIds`だけ、`shapeExtentReader`は`getSelectedGeometryBounds`だけ、`editRecorder`は`beginEdit`・`commitEdit`）。`getReferencePoint`・`isAspectLocked`が関数でなければ既定（`DEFAULT_REFERENCE_POINT`を返す・`false`を返す）。
    *   非公開`#resolveFrame()`：`target = resolveNudgeTarget(getMode(), model.getSelectedIds(), model.getSelectedVertices())`、`bounds = target?.type === 'shapes' ? shapeExtentReader.getSelectedGeometryBounds() : null`、`enabled = canTransformSelection(target, bounds)`を返す。
    *   `getSizeView()`：`buildSizeInputView(enabled, bounds, enabled && isAspectLocked())`。`getTransformView()`：`buildTransformInputView(enabled, getReferencePoint())`。どちらも純粋な照会（図形・選択・履歴を変えない）。
    *   `setSize(axis, text)`・`rotateBy(text)`・`flip(axis)`：`enabled`が偽なら`false`。`origin = resolveReferencePointPosition(bounds, getReferencePoint())`、変換＝`resolveSizeTransform(axis, text, bounds, origin, isAspectLocked())`／`resolveRotationTransform(text, origin)`／`resolveFlipTransform(axis, origin)`、`null`なら`false`（記録先に一切触れない）。それ以外は`#apply(target.shapeIds, 変換)`。
    *   非公開`#apply(shapeIds, transform)`：`model.getShapes()`のうち`shapeIds`の図形（描画順）を集め、0件なら`false`。`editRecorder.beginEdit()` → `model.replaceShapesKeepingIds(図形.map((s) => ({ id: s.id, shape: s.createTransformed(transform) })))`（通知1回）→ `editRecorder.commitEdit()`（まとめの鍵なし＝確定1回・反転1回が取り消し1件）→ `true`。前後が同じ（例：幅0の向きの反転、360°の回転）なら`HistoryManager`が記録しない（戻り値は`true`のまま）。選択・`id`・並びは変わらない（取り消し・やり直しでも選択は変わらない）。線の太さは変えない（`createTransformed`の約束）。
    *   クラスJSDocに：操作モードを知らない（`getMode`の値は規則へ渡すだけ）・ドラッグ中かを見ない（拒むかは`main.js`。幅・高さ・角度は拒まず、反転は`main.js`の`performFlip`が拒む）・スナップ・端点への吸い付きを通さない・保存しない状態を持たない。

### 要件E: 反転のキー（`core/KeyboardShortcuts.js`）
* 対応表`SHORTCUT_BINDINGS`の**末尾**（矢印キーの8エントリの後）に2エントリを足す（既存のエントリは変えない）：`{ codes: ['KeyH'], ctrl: false, shift: ShiftRule.REQUIRED, repeatable: false, action: 'flipHorizontal' }`・`{ codes: ['KeyV'], ctrl: false, shift: ShiftRule.REQUIRED, repeatable: false, action: 'flipVertical' }`（コメント1行：横に反転・縦に反転。`H`（キャンバス移動）・`V`（選択）とは`Shift`規則で、`Ctrl`+`V`・`Ctrl`+`Shift`+`V`とは`ctrl`の値で排他的。キーリピートでは実行しない）。`action`を2つに分けるのは、`core/`が`edit/`の`FLIP_AXIS`を知らないため（重なり順の4つのactionと同じ理由。`main.js`が`performFlip(FLIP_AXIS.…)`へつなぐ）。
* typedef`ShortcutActions`に`flipHorizontal`・`flipVertical`（`() => boolean`。選んでいる図形を基準点を通る縦（横）の線を軸に反転する。反転した場合のみ`true`。選択（`V`）で図形を選んでいない・外枠が求まらない・ドラッグ中は`false`＝`preventDefault()`しない）を足す。コンストラクタの必須名は対応表から自動で増える。
* JSDocの言い回しだけを直す：`ShiftRule`の`FORBIDDEN`・`REQUIRED`の説明（`REQUIRED`に`Shift`+`H`・`Shift`+`V`を足し、「`Shift`+`V`等は将来のShift併用操作のために予約」を直す）、対応表のコメントの修飾キー規則（`KeyV`は4通り＝`V`・`Ctrl`+`V`・`Ctrl`+`Shift`+`V`・`Shift`+`V`、`KeyH`は2通り＝`H`・`Shift`+`H`、`index.html`の反転のボタンの`title`も手で一致させる）、`#findBinding`のJSDocの`REQUIRED`の列挙と予約の記述。`#handleKeyDown`・`#findBinding`・`findCancelableDragBinding`・先頭の責務定義のコードは変えない。

### 要件F: ドラッグの回転の中心（`core/RotationRules.js`・`core/InputTracker.js`）
* **`RotationRules.computeRotationCenter(frame, referencePoint)`**：第2引数を足し、本体を`return resolveReferencePointPosition(frame.bounds, referencePoint);`にする。第2引数を省く・`REFERENCE_POINT`の値でないときは外枠の中心（`computeFrameCenter(frame.bounds)`と同じ値＝今の値）。importに`./ReferencePointRules.js`の`resolveReferencePointPosition`を足し、使わなくなる`computeFrameCenter`を`./ScaleHandleRules.js`のimportの並びから外す。先頭の責務定義（import先の列挙）・関数のJSDoc（中心＝引き始めの外枠の上の基準点）を直す。ほかの関数は変えない（回している間の外枠は`getRotationDragView()`の`center`＝控えた回転の中心の周りに回るため、自動的に基準点の周りに回る）。
* **`InputTracker`**：typedef`InputAssist`に`@property {() => (string|null)} getReferencePoint`（基準点の名前の照会。回転のドラッグの押下（`#beginRotateSelection`）で1回だけ呼び、戻り値は検証せず`RotationRules.computeRotationCenter`へ渡す。既定は常に`null`＝外枠の中心）、`NO_INPUT_ASSIST`に`getReferencePoint() { return null; }`、コンストラクタの正規化に1項目（ほかの項目と同じ形）を足す。`#beginRotateSelection`の`center`を`computeRotationCenter(rotationHit.frame, this.#inputAssist.getReferencePoint())`にする。JSDocの直し：クラスJSDocとコンストラクタの第7引数の項目の列挙（`getReferencePoint`を足す）、`#beginRotateSelection`・`#rotateDrag`の「回転の中心」（引き始めの外枠の上の基準点）。拡大縮小（`#beginScaleSelection`・`#applyScaleUpdate`）は変えない（基準点を使わない）。

### 要件G: UI部品（新規`palette/OptionBarSizeGroup.js`・`palette/OptionBarTransformGroup.js`）
`OptionBarPositionGroup.js`と同じ形（importなし・DOM操作専任・`VectorModel`・図形・選択・手順のクラスを知らない。要素が欠ければ`console.warn`して配線しない。コールバックが関数でなければ`Error`）。
* **`OptionBarSizeGroup`**：ルート要素`#option-size-group`、要素`#option-size-width`・`#option-size-height`・`#option-size-lock`。typedef`SizeInputView`（二重定義）・`OptionBarSizeGroupActions`＝`{ onSizeChange(axis: 'width'|'height', value: string) => boolean, onAspectLockToggle() => void }`。非公開の定数`AXIS_WIDTH = 'width'`・`AXIS_HEIGHT = 'height'`（`SIZE_AXIS`の二重定義）。`render(view)`：`#lastView`を覚え、幅の欄の`disabled = widthDisabled`・高さの欄の`disabled = heightDisabled`・鍵の`disabled = lockDisabled`・鍵の`aria-pressed = String(aspectLocked)`、欄の値はフォーカスがある欄だけ書き換えない（違うときだけ代入）。購読：欄の`change` → `onSizeChange(軸, value)`が`false`ならその欄を`#lastView`で書き戻す、`blur` → 書き戻す（`input`は購読しない）、鍵の`click` → `onAspectLockToggle()`。
* **`OptionBarTransformGroup`**：ルート要素`#option-transform-group`、要素`#option-angle`・`[data-reference-point]`のボタン（ルート要素内の`querySelectorAll`。0個なら配線しない）・`#option-flip-horizontal`・`#option-flip-vertical`。typedef`TransformInputView`（二重定義）・`OptionBarTransformGroupActions`＝`{ onAngleChange(value: string) => boolean, onReferencePointSelect(referencePoint: string) => void, onFlip(axis: 'horizontal'|'vertical') => boolean }`。非公開の定数`FLIP_HORIZONTAL = 'horizontal'`・`FLIP_VERTICAL = 'vertical'`（`FLIP_AXIS`の二重定義）。基準点の名前は持たず、ボタンの`dataset.referencePoint`を読んで渡すだけ。`render(view)`：角度の欄の`disabled`、欄の値はフォーカスがある間は書き換えない、基準点の各ボタンの`disabled = view.disabled`・`aria-pressed = String(!view.disabled && dataset.referencePoint === view.referencePoint)`、反転の2ボタンの`disabled`。購読：角度の欄の`change` → `onAngleChange(value)`を呼んだ後、**戻り値によらず`#lastView.angle`で欄を書き戻す**（受理すれば`model.onChange`の同期で`#lastView`は`'0'`のままのため、フォーカスが残っていても欄が0に戻る。受理しなくても0に戻る＝REQ「欄は0に戻る」「受け付けず欄を0へ戻す」）、`blur` → 書き戻す、基準点のボタンの`click` → `onReferencePointSelect(dataset.referencePoint)`、反転のボタンの`click` → `onFlip(軸)`（戻り値は使わない）。

### 要件H: `main.js`の配線
* import：`core/TransformInputSettings.js`の`TransformInputSettings`、`edit/TransformInputEditor.js`の`TransformInputEditor`、`edit/TransformInputRules.js`の`FLIP_AXIS`、`palette/OptionBarSizeGroup.js`・`palette/OptionBarTransformGroup.js`。
* `// 3.4.`（`// 3.3.`の後・`// 3.5.`の前）：`const transformInputSettings = new TransformInputSettings();`（コメント：基準点・比率の鍵の持ち主。保存しない・履歴の対象外・アプリ全体で1つ。`inputTracker`の第7引数が照会で参照するため前に生成）。
* `// 4.`：`inputTracker`の第7引数に`getReferencePoint: () => transformInputSettings.getReferencePoint()`を足す（コメント1行：回転のドラッグの中心にする基準点の照会）。`shapeExtentReader`のコメントの使う側に`// 7.13.`・`// 7.14.`を足す。
* `// 7.10.`：`PositionInputEditor`の依存に`getReferencePoint: () => transformInputSettings.getReferencePoint()`を足し、`model.onChange(syncOptionBarPositionGroup);`の次に`transformInputSettings.onChange(syncOptionBarPositionGroup);`を足す（コメント：基準点のボタンを押したとき、図形が変わらなくても位置の欄を基準点の位置に直す）。
* `// 7.13.`（`// 7.12.`の後）「オプションバー（大きさのまとまり）配線」：`transformInputEditor`を生成（`model`・`getMode: () => inputTracker.getMode()`・`shapeExtentReader`（`// 4.`の同じインスタンス）・`editRecorder: historyManager`・`getReferencePoint`・`isAspectLocked: () => transformInputSettings.isAspectLocked()`）、`optionBarSizeGroup`を生成（`onSizeChange: (axis, text) => transformInputEditor.setSize(axis, text)`、`onAspectLockToggle: () => { transformInputSettings.toggleAspectLock(); }`。`isDragging()`は見ない＝位置の欄と同じ）、`syncOptionBarSizeGroup()`（`optionBarSizeGroup.render(transformInputEditor.getSizeView())`）を`model.onChange`と`transformInputSettings.onChange`に登録。
* `// 7.14.`「オプションバー（変形のまとまり）配線」：`performFlip(axis)`（`inputTracker.isDragging()`なら`false`、それ以外は`transformInputEditor.flip(axis)`の戻り値。ボタンとキーの同じ経路。`performShapeAlign`と同じ形）、`optionBarTransformGroup`を生成（`onAngleChange: (text) => transformInputEditor.rotateBy(text)`・`onReferencePointSelect: (referencePoint) => { transformInputSettings.setReferencePoint(referencePoint); }`・`onFlip: (axis) => performFlip(axis)`）、`syncOptionBarTransformGroup()`（`optionBarTransformGroup.render(transformInputEditor.getTransformView())`）を`model.onChange`と`transformInputSettings.onChange`に登録。
* `// 8.`（タスク11で行う）：`KeyboardShortcuts`の注入に`flipHorizontal: () => performFlip(FLIP_AXIS.HORIZONTAL)`・`flipVertical: () => performFlip(FLIP_AXIS.VERTICAL)`を足す。
* 起動時の同期：`syncOptionBarCornerGroup();`の後に`syncOptionBarSizeGroup();`・`syncOptionBarTransformGroup();`を足す（今の起動時の同期と同じ形のコメント）。
* 判定・計算を書かない（`performFlip`のドラッグ中の受理判定だけ。`performShapeAlign`と同じ）。行数の見積もり：1094行 → 約1185行。

### 要件I: テスト
* **新規`test/core/ReferencePointRules.test.js`**：`REFERENCE_POINT`の9つの値と凍結・`DEFAULT_REFERENCE_POINT`が中心、`isReferencePoint`（9つは真・`null`・`'c'`・`'NW'`・数値は偽）、`resolveReferencePointPosition`の9か所の位置（外枠`{minX: 10, minY: 20, maxX: 50, maxY: 80}`で手計算の固定値）・中心が`computeFrameCenter`と同じ値・`null`／未知の名前は中心・幅0（`minX === maxX`）・高さ0・幅も高さも0の外枠・引数を書き換えず新しいオブジェクト。
* **新規`test/core/TransformInputSettings.test.js`**：初期値（中心・外れている）、`getState`が毎回新しいオブジェクト、`setReferencePoint`の通知（変わったとき1回・同じ値・未知の値は通知しない＋`console.warn`）、`setAspectLocked`・`toggleAspectLock`の通知、`onChange`が関数以外を無視。
* **`test/core/RotationRules.test.js`（追加のみ）**：`computeRotationCenter(frame, 名前)`が9か所の基準点の位置、第2引数を省く・`null`・未知の名前は今の値（`computeFrameCenter(frame.bounds)`と同じ値）。左上を基準点にした回転の変換で左上の角が動かない（`toRotationTransform(computeRotationCenter(frame, 'nw'), angle)`を角へ当てる）。
* **新規`test/edit/TransformInputRules.test.js`**：`canTransformSelection`（対象なし・`vertices`の対象・外枠なし・有限でない外枠は偽、`shapes`かつ有限なら真）、`buildSizeInputView`（押せない・小数第1位・幅0／高さ0の向きは`'0.0'`で押せない・`aspectLocked`）、`buildTransformInputView`、`resolveSizeTransform`（空・数値でない・0・負の値・今と同じ値・長さ0の軸・未知の軸は`null`、倍率＝入れた値÷実際の長さ（`99.99`の幅に`100`）、鍵なしはもう一方1、鍵ありはもう一方も同じ倍率、鍵ありでもう一方の長さ0は1、基準点が動かない（変換を基準点へ当てて同じ位置）、小数）、`resolveRotationTransform`（空・数値でない・0は`null`、`90`で`(10, 0)`が中心`(0, 0)`の周りに`(0, −10)`へ＝画面で反時計回り、`−90`で`(0, 10)`、`90`・`180`・`−90`・`450`で`a`〜`d`がちょうどの0・±1、`30`の`b`が負（反時計回り）、基準点の周り）、`resolveFlipTransform`（横＝`{a: −1, d: 1, e: 2·x}`・縦＝`{a: 1, d: −1, f: 2·y}`・未知の軸は`null`・基準点ごと）。
* **新規`test/edit/TransformInputEditor.test.js`**：実物の`VectorModel`・図形（`Rect`・`Line`・`Ellipse`の円と弧・`Path`）・`ShapeExtentReader`と、呼び出しを記録する偽の`editRecorder`で：押せる条件（選択なし・`VERTEX`（図形だけ選択・頂点を選択）・`CREATE`・`PAN`では`getSizeView`・`getTransformView`が押せない＋空、`setSize`・`rotateBy`・`flip`が`false`で記録先に触れない）、幅・高さ（基準点ごとに基準点が動かない・鍵あり・複数選択で選択全体の比率を保つ・水平な直線の高さは押せず幅だけ変わる・線を含まない外枠の幅が出る）、角度（左上を基準点に矩形を90°で座標がきれいな値・30°で反時計回り）、反転（横・縦・基準点ごと・弧の縦の反転で下半分の弧＝線を含まない外枠の`y`の範囲が中心より下）、確定1回で`beginEdit`・`commitEdit`が1回ずつ（鍵なし）、選択・`id`・並びが変わらない、線の太さが変わらない。実物の`HistoryManager`＋`SnapshotAdapter`（`test/edit/ClipboardController.test.js`等と同じ組み方）で、反転1回が取り消し1件・取り消しで元の形と選択に戻る。**保存・書き出し**：変形した図形を`DocumentSerializer`で直列化・復元して`toJSON`が同じ、`SpriteSerializer.serialize`の最上位のキーが今のまま（`format`・`formatVersion`（4）・`bounds`・`elements`・`source`）で`source.version`が3、基準点・鍵のキーが無い。
* **`test/edit/PositionInputEditor.test.js`（書き換えと追加）**：組み方A・Bの補助に省ける引数`referencePoint`を足し（渡したら`getReferencePoint: () => referencePoint`を注入。省けば注入しない＝既定の中心）、既存の図形のケースは`'nw'`を渡して「外枠の左上」の意味を保つ。追加：既定（注入なし）は中心、9か所の基準点ごとの表示と移動量、基準点を変えると表示だけが変わり図形は変わらない、頂点（`VERTEX`）は基準点によらず今のまま。
* **`test/core/KeyboardShortcuts.test.js`（追加のみ）**：`flipHorizontal`だけ・`flipVertical`だけを欠くと欠落名がそれだけになる配線検証。
* **新規`test/core/KeyboardShortcuts.keydown.test.js`**：`#handleKeyDown`を通した対応表の照合を確かめる。テストの中で`globalThis.document`（`activeElement: null`・`addEventListener`で`keydown`のハンドラを受け取るだけ）と`globalThis.HTMLInputElement`・`HTMLTextAreaElement`・`HTMLElement`（空のクラス。`FocusKeyYieldRules`の`instanceof`が評価できるため）を`before`で置き、`after`で元に戻す（ソースは変えない。`node --test`はファイルごとに別のプロセスで動く）。呼び出しを記録するコールバック群（`Proxy`。`isDragging`・`isCancelableDrag`は切り替えられる）と、`code`・`shiftKey`・`ctrlKey`・`metaKey`・`altKey`・`repeat`・`isComposing`・`preventDefault()`を持つ偽のイベントで：`Shift`+`H`→`flipHorizontal`（`preventDefault`あり）、`Shift`+`V`→`flipVertical`、`H`→`setMode(PAN)`、`V`→`setMode(SELECT)`、`Ctrl`+`V`→`paste`、`Ctrl`+`Shift`+`V`→`pasteInPlace`（反転を呼ばない）、`Ctrl`+`Shift`+`H`・`Alt`+`Shift`+`H`は何も呼ばない、キーリピートの`Shift`+`H`は呼ばない、ドラッグ中は呼ばず`preventDefault`もしない、コールバックが`false`なら`preventDefault`しない。
* **既存のテストの期待値を変えるケース（REQの(a)〜(c)）**：
    *   (a) `test/edit/PositionInputEditor.test.js`の6件（位置の欄が線を含む外枠の左上から線を含まない外枠の基準点に変わるため。既存のケースは`'nw'`を注入する）：「A: 図形1つ：外枠の左上が出て…」（表示`19.0`・`29.0`→`20.0`・`30.0`、X=100の後の`points[0].x` 101→100）、「A: 図形1つ：Yに値を入れると…」（Y=−5.5の後の`points[0].y` −4.5→−5.5）、「A: 図形複数：…」（表示`19.0`・`9.0`→`20.0`・`10.0`、X=0の後の`a`のx 1→0・`b`のx 31→30）、「A: 線の太さを変えると外枠の左上の表示が変わる（図形は動かない）」（線を含まない外枠になったため、線の太さを変えても表示は`20.0`・`30.0`のまま＝見出しも「変わらない」に直す）、「B: 受理しない入力（…同じ値…）」（同じ値の入力`'19'`・`'29'`→`'20'`・`'30'`）、「B: 受理する入力では…」（移動量`[-8.5, 0]`・`[0, -30]`→`[-9.5, 0]`・`[0, -31]`、`f`の`[-19, 0]`→`[-20, 0]`）。`test/edit/PositionInputRules.test.js`は変えない（規則を変えないため）。
    *   (b) 対応表の件数・一覧を数える既存のテストは無い（配線検証は対応表から必須名を作るため、2エントリを足しても今のケースは通る）。変えるケースなし（見込み）。
    *   (c) `test/core/RotationRules.test.js`の`computeRotationCenter`の既存のケースは第2引数なし＝中心で今と同じ値のため変えない（見込み）。
    *   上記以外の期待値を変える必要が出たら、実装を止めず、そのケースと理由をタスクの詳細作業内容と5章に書く。
* **テストできない箇所**：`index.html`（2行の見た目・1280px幅の収まり・定規・パレットの位置・キャンバスの座標）、`palette/OptionBarSizeGroup`・`OptionBarTransformGroup`（DOM。フォーカス中の書き戻し・角度の欄が0に戻ること・`aria-pressed`）、`main.js`の配線（`// 3.4.`・`// 7.10.`の追加・`// 7.13.`・`// 7.14.`・`performFlip`のドラッグ中の不受理・`transformInputSettings.onChange`の登録・`// 8.`の2つのコールバック）、`InputTracker`の`getReferencePoint`の受け渡し（`#beginRotateSelection`。`DragTracker`・DOMに依存。回転の中心の求め方は`computeRotationCenter`のテストで確かめる）、`type="number"`の`change`・`blur`。テストプレイで確かめる（5章末尾）。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./index.html`（オプションバーの2行・新しいまとまり）、`./js/core/`（基準点の規則・設定の持ち主・回転の中心・キーの対応表・入力の補助）、`./js/edit/`（変形の数値入力の規則と手順・位置の欄）、`./js/palette/`（新しいまとまりのUI部品）、`./js/main.js`（配線）、`./test/`（自動テスト）
*   **関連する論理クラス**:
    *   新規：`core/ReferencePointRules`（基準点の名前と位置の求め方。状態なし）・`core/TransformInputSettings`（基準点・比率の鍵の持ち主）・`edit/TransformInputRules`（幅・高さ・角度・反転の受理と変換・押せる条件・表示内容。状態なし）・`edit/TransformInputEditor`（幅・高さ・角度・反転の1件の編集操作と表示内容の照会）・`palette/OptionBarSizeGroup`（大きさのまとまり）・`palette/OptionBarTransformGroup`（変形のまとまり）
    *   更新：`core/RotationRules`（`computeRotationCenter`の第2引数）・`core/InputTracker`（`InputAssist`の`getReferencePoint`）・`core/KeyboardShortcuts`（2エントリ・typedef・JSDoc）・`edit/PositionInputEditor`（基準点）・`main.js`・`index.html`
    *   変えない：2章「全体の方針」の「変えないファイル」

### 参照する責務
*   **憲法・資料の約束**：`core/`（`VectorModel`・`InputTracker`・`CanvasManager`を含む）・`edit/`・`io/`・`palette/`・`main.js`は図形種別の分岐・図形固有のプロパティ名（`points`・`segments`・`control1`等）を持たない。`main.js`は判定・計算を持たず（ドラッグ中の受理判定`isDragging()`だけは`performShapeOrder`・`performShapeAlign`と同じ形で持てる）、機能専用の再描画・同期の経路を足さない。`InputTracker`に計算・判定表を持ち込まない（状態の持ち主の設計は分け直さない）。すべての`.js`の先頭に3行以内の責務定義、クラス・関数・メソッド・データ構造（typedef・定数）にJSDoc。テストのためにソースを書き換えない。
*   **依存方向**（資料1章）：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`・`palette/`・`wiring/`・`asset/`をimportしない。`palette/`は何もimportしない。`edit/ → core/`は状態を持たない規則の関数だけをimportする例外（今は`NudgeEditor`・`PositionInputEditor`・`PathCornerEditor → NudgeTargetRules`、`PositionInputEditor → VertexHandleRules`、`PositionInputRules → StatusReadoutRules`。本作業で2章「全体の方針」の向きを足す）。`VectorModel`・`HistoryManager`・`ShapeExtentReader`は注入で受け取る。`edit/`内は手順がその規則をimportする形だけ。`core/`内は処理・部品が規則をimportする向きで、規則どうしのimportは例外として資料に列挙する（今は`ScaleHandleRules → UnitSnapRules`・`CursorShapeRules → ScaleHandleRules`・`RotationRules → ScaleHandleRules`・`CursorShapeRules → RotationRules`）。`core/RotationRules → shapes/ShapeGeometry`は`import`文の例外。循環importは無い。
*   **`edit/`は操作モードを知らない**：`getMode`の戻り値を解釈せず`core/NudgeTargetRules.resolveNudgeTarget`へ渡すだけ（対象は選択（`V`）なら選んでいる図形、頂点の選択（`A`）なら選んでいる頂点、ほかは無し）。1件の編集操作の手順は`VectorModel`・`HistoryManager`（`beginEdit`／`commitEdit`）を注入で受け取る。
*   **選択状態**（資料2章）：外枠・外枠のハンドルの位置は選択集合の図形から毎回求め（`ShapeExtentReader.getSelectedGeometryBounds()`＝線を含まない外枠）、保存しない・履歴に入れない・作業データに入れない・`VectorModel`に持たせない。回した角度・回している間の外枠も同じ（`InputTracker`の`#rotateDrag`だけが持つ）。
*   **外枠の求め方**（3章25.）：線を含まない外枠＝`ShapeExtentReader.getSelectedGeometryBounds()` → `SpriteSerializer.computeShapesGeometryBounds`。線を含む外枠＝`getSelectedBounds()`（ステータスバーの`W:`・`H:`・整列・分布・書き出しの`bounds`。今のまま）。外枠の中心の式は`ScaleHandleRules.computeFrameCenter`の1か所、角の位置は`collectFrameCorners`。
*   **変換**（3章25.・26.、2章）：`AffineTransform`＝点`(x, y)`→`(a·x + c·y + e, b·x + d·y + f)`（式の唯一の箇所は`shapes/ShapeGeometry.applyAffineTransformToPoint`）。`ScaleHandleRules.toScaleTransform(scale)`＝`{ a: scaleX, b: 0, c: 0, d: scaleY, e: originX − scaleX·originX, f: originY − scaleY·originY }`。`RotationRules.toRotationTransform(center, angle)`＝画面の時計回りが正、90°の倍数から`1e-9`ラジアン以内はちょうどの`cos`・`sin`。図形の`createTransformed(transform)`は新しいインスタンスを返し、`type`・`id`・スタイル3つ（線の太さを含む）は同じ。`VectorModel.replaceShapesKeepingIds([{ id, shape }])`は同じ`id`の位置へ差し替え（通知1回、選択集合・頂点の選択・並びに触れない。履歴の記録は呼び出し側）。円・弧は5つの点を写すだけで回転・裏返し（弧の上下・左右）を表せる。
*   **履歴**（3章6.）：変更を`beginEdit()`と`commitEdit()`で挟む。前後の作業データが同じなら記録しない。まとめの鍵は矢印キーの微調整だけ（位置の数値入力・整列・分布は鍵なし＝1回が1件）。取り消し・やり直しの選択は記録時点のもの（選択モード・頂点の選択モードのときだけ戻す）。
*   **オプションバー**（3章13.・20.・21.）：まとまり（`.toolbar-group`）ごとに`palette/`のUI部品1つ（自分のまとまりの要素をルート要素として受け取る。要素idは接頭辞`option-`）と`main.js`の配線ブロック1つ。数値の欄を足すときは、まとまり・UI部品・ブロックを足すだけで既存のものを変えない（本作業では発注者の決定で、位置のまとまりの`px`の`<span>`だけを`index.html`から消す。まとまり・UI部品・ブロックの分け方は変えない。2章「全体の方針」）。表示は`model.onChange`で同期し、起動時にも1回呼ぶ。数値の欄は`<input type="number">`で`change`だけで確定（`input`は購読しない）、フォーカスがある間は書き換えず`blur`で最後の表示へ書き戻す、受理しなければ書き戻す。テキスト入力扱いのため欄にフォーカスがある間はショートカットが働かない。数字の形は`StatusReadoutRules.formatReadoutNumber`（小数第1位・`-0`は`0.0`・有限でなければ`—`）。表示の丸めを変形量へ持ち込まない。位置の欄・スタイルはドラッグ中も拒まない、整列・分布・重なり順はドラッグ中は受理しない（`main.js`が`inputTracker.isDragging()`を見る）。スナップ（`UnitSnapSettings`）・端点への吸い付きを数値の入力に当てない。
*   **キーボード**（3章3.、`_doc/arch/07_KeyboardShortcuts.md`）：キーは`event.code`で識別。`Alt`押下時は常に不一致。`ctrl: true`は`ctrlKey || metaKey`、`false`は両方偽。`Shift`は`ShiftRule`（`FORBIDDEN`・`ANY`・`REQUIRED`）。同じ`code`・修飾キーの組に一致するエントリが2件以上あってはならない。新しいショートカットはエントリの追加（＋注入コールバックの追加）で対応する。受理した（コールバックが`true`）キーだけ`preventDefault()`。ドラッグ中・リピート不可のキーリピートは実行しない。`index.html`のボタンの`title`は対応表と手で一致させる。
*   **ドラッグの回転**（3章26.）：回転の中心は押下時に`#beginRotateSelection`が`#rotateDrag.center`に控え、追従（`computeRotationAngle`・`toRotationTransform`）と回している間の外枠（`getRotationDragView()` → `resolveDisplayedScaleFrame`）はこの中心を使う。外枠のハンドルの拡大縮小（25.）の動かない点は反対側の辺（`Alt`で外枠の中心）。
*   **設定の持ち主**（`_doc/arch/31_UnitSnapSettings.md`）：保持・切り替え・変更通知のみ。`get…`／`set…`／`toggle…`／`onChange`。不正な値は`console.warn`して何もしない、値が変わらなければ通知しない。`main.js`だけが1つ生成し、使う側には照会関数を注入する。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章**：`index.html`の説明（上端のツールバーは2行（1行目＝操作のボタンとスタイル・重なり順、2行目＝位置・大きさ・変形・整列・分布・角）、高さは`--toolbar-height`（80px）が唯一の定義）。構成図に`core/ReferencePointRules.js`（基準点の名前と、外枠の上の基準点の位置の求め方の規則。状態なし。import＝`ScaleHandleRules`のみ。`RotationRules`・`TransformInputSettings`・`edit/PositionInputEditor`・`edit/TransformInputEditor`から使う）・`core/TransformInputSettings.js`（基準点・比率の鍵の持ち主。保存しない・履歴の対象外）・`edit/TransformInputRules.js`・`edit/TransformInputEditor.js`・`palette/OptionBarSizeGroup.js`・`palette/OptionBarTransformGroup.js`と、テスト`test/core/ReferencePointRules.test.js`・`test/core/TransformInputSettings.test.js`・`test/core/KeyboardShortcuts.keydown.test.js`・`test/edit/TransformInputRules.test.js`・`test/edit/TransformInputEditor.test.js`を足す。`RotationRules.js`（回転の中心＝基準点。import＝`ScaleHandleRules`・`ReferencePointRules`・`shapes/ShapeGeometry`）・`ScaleHandleRules.js`（使う側に`ReferencePointRules`・`edit/TransformInputRules`）・`StatusReadoutRules.js`（使う側に`edit/TransformInputRules`）・`NudgeTargetRules.js`（使う側に`edit/TransformInputEditor`）・`KeyboardShortcuts.js`（反転のキー）・`PositionInputRules.js`・`PositionInputEditor.js`（基準点）・`ShapeExtentReader.js`（線を含まない外枠の使う側）の説明を直す。「存在しないもの」：Phase 10-01・10-02の項から本作業で実装したもの（基準点の選択・幅と高さと角度の数値の欄・反転のボタンとキー・回転の中心を外枠の中心以外にすること・位置の欄を線を含まない外枠にそろえること）を除き、**Phase 10-03でやらないと決めたこと**（外枠のハンドルの拡大縮小の動かない点を基準点にすること・基準点の印をキャンバスに出すこと・9か所以外の基準点・図形ごとの今の角度の表示と保存・回した後も外枠を傾いたまま残すこと・角度の欄の刻みとスナップ・頂点の選択で選んだ頂点だけの拡大縮小・回転・反転・ステータスバーの「大きさ」・整列・分布・書き出しの`bounds`を線を含まない外枠にそろえること・線の太さを変形に合わせること・傾きの数値入力・`Shift`+`H`・`Shift`+`V`以外の新しいキー・オプションバーの出し分けと折りたたみ・基準点と比率の鍵の保存・エンジンでの版4の確認と連絡票（Phase 10-04））を足す。「図形の大きさ・角度の数値の欄（変形のPhase…）」の項を直す。「ツールバー・ステータスバーの折り返し…（1行固定で…）」を「ツールバーは2行・ステータスバーは1行で固定」に直す。フォルダ分割の方針の`core/`の段落に`ReferencePointRules`・`TransformInputSettings`（置く理由＝`InputTracker`（`core/`）と`edit/`の両方が使う・設定の持ち主は`UnitSnapSettings`と同じ形で、`UnitSnapSettings`へ足さないのはスナップ（入力の座標の丸め）とは別の設定のため）を、`edit/`の段落に`TransformInputRules`・`TransformInputEditor`を足す。依存方向に2章「全体の方針」の新しい向き（規則どうしの`ReferencePointRules → ScaleHandleRules`・`RotationRules → ReferencePointRules`、設定の持ち主が規則をimportする`TransformInputSettings → ReferencePointRules`、`edit/ → core/`の例外のファイル）を足す。
*   **2章**：選択状態の項に「基準点・比率の鍵（Phase 10-03。3章27.）：`core/TransformInputSettings`だけが持ち、保存しない・履歴に入れない・作業データ・書き出しに入れない・`VectorModel`に持たせない。基準点は名前だけを覚え、位置は毎回今の線を含まない外枠から求める」を足す。作業データ形式・キャンバス記録の「保存しないもの」に基準点・比率の鍵を足す。
*   **3章**：「同期の経路（全機能共通）」に`transformInputSettings.onChange`（登録先は位置・大きさ・変形のまとまりの同期の3つだけ。キャンバスは再描画しない）を足す。3.（キーボード操作に`Shift`+`H`・`Shift`+`V`）、6.（記録する操作に数値の幅・高さ・角度の確定と反転＝`TransformInputEditor`の`replaceShapesKeepingIds`の前後・鍵なし）、13.（オプションバーが2行・行の並び・まとまりの一覧に「大きさ」「変形」・`// 7.13.`・`// 7.14.`、「やらないこと」の大きさ・角度の欄を除く。**発注者の決定（2026-11-22）：2行目の位置〜大きさの並びは`X: Y: │ W: 🔒 H: px`とし、位置のまとまりの`px`を消して単位は大きさのまとまりの`px`1つにした。まとまり・UI部品・ブロックの分け方は変えていない**）、20.（位置の定義＝図形は線を含まない外枠の上の基準点・発注者の決定(1)(3)を本作業の決定で置き換える・線の太さを変えても表示は変わらない・`ShapeExtentReader`の使う入口・**発注者の決定（2026-11-22）：位置のまとまりの`px`を消し、単位は大きさのまとまりの`px`1つにした。まとまり・UI部品・ブロックの分け方は変えていない**）、21.（整列・分布は今のまま線を含む外枠。位置の欄と同じ値という記述を直す）、25.（拡大縮小は基準点を使わない。「位置の欄の値・`W:`・`H:`と外枠のハンドルの位置は線の太さの半分だけずれる」を「`W:`・`H:`と…」に直す）、26.（回転の中心＝引き始めの外枠の上の基準点。基準点が中心なら今と同じ値。`getReferencePoint`の注入）、**新しい27.「基準点・大きさと角度の数値入力・反転」**（流れ（表示・入力・基準点と鍵の押下）・モジュールの分担・押せる条件・基準点の位置の求め方・幅と高さの受理と倍率（鍵・0の向き）・角度の受理と向き・反転・数字の形・確定の契機とフォーカス・ドラッグ中・スナップ・回した図形・線の太さ・取り消し・発注者の決定・現場設計の決定・計画の設計判断・確認の状況）。27.の「計画の設計判断」には、**入力の数値の判定3行（`typeof text !== 'string' || text.trim() === ''`・`Number(text)`・`Number.isFinite`）が`PositionInputRules.resolvePositionDelta`と`TransformInputRules`の非公開`parseInputNumber`の2か所にあること**（`PositionInputRules`を変えないため本作業では共通の関数にまとめなかった。受理の条件は欄ごとに違う。まとめるときは`PositionInputRules`を変えることになる。5章(9)）を書く。
*   **4章**：一覧に`ReferencePointRules.js` → `_doc/arch/44_ReferencePointRules.md`、`TransformInputSettings.js` → `_doc/arch/45_TransformInputSettings.md`。
*   **`_doc/arch/`**：`44_ReferencePointRules.md`・`45_TransformInputSettings.md`（新規）、`01_index_html.md`（2行・新しいまとまり・位置のまとまりの`px`を消したこと（発注者の決定）・寸法・幅の見積もり）、`02_main.md`（`// 3.4.`・`// 4.`の注入・`// 7.10.`の追加・`// 7.13.`・`// 7.14.`・`// 8.`の2つ・起動時の同期・import・行数）、`06_InputTracker.md`（`InputAssist`の`getReferencePoint`・`#beginRotateSelection`の中心・行数）、`07_KeyboardShortcuts.md`（反転の2エントリ・`ShortcutActions`・テスト）、`13_palette.md`（`OptionBarSizeGroup`・`OptionBarTransformGroup`・まとまりの一覧・ツールバーの2行）、`14_edit.md`（`TransformInputRules`・`TransformInputEditor`・`PositionInputEditor`の基準点・`ShapeExtentReader`の使う側・入力の数値の判定3行が`PositionInputRules`と`TransformInputRules`の2か所にあること（5章(9)））、`16_test.md`（Phase 10-03の追加分・期待値を変えたケース・テストできない箇所・件数）、`26_StatusReadoutRules.md`・`41_NudgeTargetRules.md`・`42_ScaleHandleRules.md`（使う側の追加）、`43_RotationRules.md`（`computeRotationCenter`の第2引数・import）、`03_VectorModel.md`（`replaceShapesKeepingIds`の使う側に`TransformInputEditor`）。
*   （各タスクの実行時に影響が判明した場合は、この欄へ追記する。資料本体への反映は最終タスクで行う）

## 3. タスクリスト
*   [x] タスク1: 要件B 基準点の規則（新規`core/ReferencePointRules.js`）とテスト
    *   **対象ファイル** :
        *   `./js/core/ReferencePointRules.js` : 新規
        *   `./test/core/ReferencePointRules.test.js` : 新規
    *   **作業内容** :
        *   要件Bの`ReferencePointRules.js`の項のとおり実装する（先頭の責務定義3行以内、定数・非公開の表・関数すべてにJSDoc。importは`./ScaleHandleRules.js`の`SCALE_HANDLE_NAMES`・`computeFrameCenter`のみ。名前の文字を`includes`で読まない）。
        *   要件Iの`ReferencePointRules.test.js`を書く（先頭に責務定義）。`node --test`が全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク2: 要件B 基準点・比率の鍵の設定の持ち主（新規`core/TransformInputSettings.js`）とテスト
    *   **対象ファイル** :
        *   `./js/core/TransformInputSettings.js` : 新規
        *   `./test/core/TransformInputSettings.test.js` : 新規
    *   **作業内容** :
        *   要件Bの`TransformInputSettings.js`の項のとおり実装する（`UnitSnapSettings.js`と同じ形。先頭の責務定義・typedef・クラス・メソッド・非公開フィールドにJSDoc。importは`./ReferencePointRules.js`のみ）。
        *   要件Iの`TransformInputSettings.test.js`を書く。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク3: 要件F 回転の中心を基準点にする（`RotationRules.computeRotationCenter`の第2引数）とテスト
    *   **対象ファイル** :
        *   `./js/core/RotationRules.js` : 更新（`computeRotationCenter`・import・先頭の責務定義・JSDoc）
        *   `./test/core/RotationRules.test.js` : 更新（ケースの追加のみ）
    *   **作業内容** :
        *   要件Fの`RotationRules.computeRotationCenter`の項のとおり実装する。ほかの関数は変えない。使わなくなる`computeFrameCenter`のimportだけを外す（ほかのimportは変えない）。
        *   要件Iの該当ケースを足す。既存の`computeRotationCenter`のケースがそのまま通ることと、全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク4: 要件F `InputTracker`の入力の補助`getReferencePoint`
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新（typedef`InputAssist`・`NO_INPUT_ASSIST`・コンストラクタの正規化・`#beginRotateSelection`の1か所・JSDoc）
    *   **作業内容** :
        *   要件Fの`InputTracker`の項のとおり変える。計算・判定を足さない。拡大縮小の経路は変えない。変更後の行数を`wc -l`で実測して詳細作業内容に書く（見積もり約2038行）。
        *   `node --test`が全件通ることを確かめる（`InputTracker`のテストは無い。`main.js`が注入するまでは既定の`null`＝外枠の中心のため、ふるまいは今と同じ）。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク5: 要件C 位置の欄を基準点にする（`edit/PositionInputEditor.js`）とテスト
    *   **対象ファイル** :
        *   `./js/edit/PositionInputEditor.js` : 更新（依存の`getReferencePoint`・`#resolveTargetAndBounds`の図形の枝・import・先頭の責務定義・JSDoc）
        *   `./test/edit/PositionInputEditor.test.js` : 更新（要件Iの(a)の6件の書き換えと、補助の省ける引数・ケースの追加）
    *   **作業内容** :
        *   要件Cのとおり実装する。`PositionInputRules.js`・`NudgeEditor.js`・`ShapeExtentReader.js`は変えない。
        *   要件Iのとおりテストを書き換え・追加する（書き換えは(a)に列挙した6件だけ。ほかのケースの期待値は変えない）。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク6: 要件D 幅・高さ・角度・反転の規則（新規`edit/TransformInputRules.js`）とテスト
    *   **対象ファイル** :
        *   `./js/edit/TransformInputRules.js` : 新規
        *   `./test/edit/TransformInputRules.test.js` : 新規
    *   **作業内容** :
        *   要件Dの`TransformInputRules.js`の項のとおり実装する（先頭の責務定義・定数・typedef・関数・非公開の関数にJSDoc。importは`StatusReadoutRules`・`ScaleHandleRules`の`toScaleTransform`・`RotationRules`の`toRotationTransform`のみ。拡大縮小・回転の変換の式を写さない）。
        *   要件Iの`TransformInputRules.test.js`を書く（期待値は手計算の固定値）。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク7: 要件D 変形の数値入力・反転の手順（新規`edit/TransformInputEditor.js`）とテスト（保存・書き出しを含む）
    *   **対象ファイル** :
        *   `./js/edit/TransformInputEditor.js` : 新規
        *   `./test/edit/TransformInputEditor.test.js` : 新規
    *   **作業内容** :
        *   要件Dの`TransformInputEditor.js`の項のとおり実装する（先頭の責務定義・クラス・メソッド・非公開フィールドとメソッドにJSDoc。importは`NudgeTargetRules`の`resolveNudgeTarget`・`ReferencePointRules`の`resolveReferencePointPosition`・`./TransformInputRules.js`のみ。図形種別の分岐・図形固有のプロパティ名を持たない）。
        *   要件Iの`TransformInputEditor.test.js`を書く（保存・書き出しの往復を含む）。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク8: 要件G 大きさ・変形のまとまりのUI部品（新規`palette/OptionBarSizeGroup.js`・`palette/OptionBarTransformGroup.js`）
    *   **対象ファイル** :
        *   `./js/palette/OptionBarSizeGroup.js` : 新規
        *   `./js/palette/OptionBarTransformGroup.js` : 新規
    *   **作業内容** :
        *   要件Gのとおり実装する（`OptionBarPositionGroup.js`と同じ形。importなし。先頭の責務定義・typedef・定数・クラス・メソッド・非公開フィールドにJSDoc。二重定義のtypedef・定数には相手の箇所をコメントで書く）。
        *   `node --test`が全件通ることを確かめる（DOMの部品のためテストは置かない）。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [ ] タスク9: 要件A オプションバーの2行と新しいまとまり（`index.html`）
    *   **対象ファイル** :
        *   `./index.html` : 更新（`--toolbar-height`・`.toolbar`・`.toolbar-row`・欄の大きさのセレクタ・基準点の3×3のCSS・ツールバーの2行のHTML・新しい2つのまとまり・位置の欄の`title`・位置のまとまりの`px`の`<span>`を消す・40pxを前提にしたコメントの数値・幅の見積もりのコメント）
    *   **作業内容** :
        *   要件Aのとおり変える。既存のまとまりの中身・id・クラスは変えない（行の`<div>`で包むだけ）。例外は発注者の決定（2026-11-22）による`#option-position-group`の`<span class="option-unit">px</span>`1つの削除だけ（2行目の位置〜大きさが`X: Y: │ W: 🔒 H: px`になる。`OptionBarPositionGroup.js`は変えない）。幅の見積もりのコメントは要件Aの値（2行目約1026px）で書く。40pxを写した値・新しい寸法の定義箇所を作らない。
        *   `node --test`が全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する（`index.html`は`.js`ではないため、CSSのコメントが実態に合うことを確かめる）。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [ ] タスク10: 要件H `main.js`の配線（設定の持ち主・注入・大きさと変形のまとまり）
    *   **対象ファイル** :
        *   `./js/main.js` : 更新（import・`// 3.4.`・`// 4.`の注入とコメント・`// 7.10.`の注入と登録・`// 7.13.`・`// 7.14.`・起動時の同期）
    *   **作業内容** :
        *   要件Hのとおり配線する（`// 8.`の2つのコールバックはタスク11で足す）。判定・計算を書かない（`performFlip`のドラッグ中の受理判定だけ）。新しい関数（`performFlip`・`syncOptionBarSizeGroup`・`syncOptionBarTransformGroup`）にJSDocを書く。変更後の行数を`wc -l`で実測して詳細作業内容に書く。
        *   `node --test`が全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [ ] タスク11: 要件E 反転のキー（`KeyboardShortcuts`の2エントリ・`main.js`の`// 8.`）とテスト
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` : 更新（対応表の末尾の2エントリ・typedef`ShortcutActions`・JSDocの言い回し）
        *   `./js/main.js` : 更新（`// 8.`の`flipHorizontal`・`flipVertical`の2つのコールバックだけ）
        *   `./test/core/KeyboardShortcuts.test.js` : 更新（ケースの追加のみ）
        *   `./test/core/KeyboardShortcuts.keydown.test.js` : 新規
    *   **作業内容** :
        *   要件Eのとおり変える（既存のエントリ・`#handleKeyDown`・`#findBinding`・`findCancelableDragBinding`のコードは変えない）。`main.js`はタスク10の`performFlip`を呼ぶ2行（とコメント）だけを足す。
        *   要件Iの`KeyboardShortcuts.test.js`の追加と`KeyboardShortcuts.keydown.test.js`を書く（置いた仮の`globalThis`の値は`after`で必ず元に戻す）。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [ ] タスク12: 仕上げの確認（JSDoc・スコープ・全テスト）
    *   **対象ファイル** :
        *   なし（確認のみ。見つかった漏れは直してよいが、**直してよいファイルはタスク1〜11の対象ファイルに限る**（その箇所を含むタスクの対象ファイルの範囲で直す。それ以外のファイルは変えない）。直したことを詳細作業内容に書く）
    *   **作業内容** :
        *   本作業で変えた・作ったすべての`.js`の先頭の責務定義（3行以内）と、新しい・変えたクラス・関数・メソッド・typedef・定数のJSDocの記載漏れがないことを確認する。
        *   `git diff --stat`で、変えたファイルが本RESの対象ファイルだけであることを確かめる。2章「全体の方針」の「変えないファイル」に差分が無いこと、`KeyboardShortcuts.js`の対応表の既存のエントリ・到達不能の枝（各図形の`drawHandles`・`PressActionRules`の`dragHandle`・`CursorShapeRules`の(7)・`CanvasManager`の`showHandles`）に差分が無いこと、`index.html`の既存のid・クラスが残っていること（既存の要素で消したのは`#option-position-group`の`px`の`<span>`1つだけであること）を確かめる。
        *   2章の自己監査の観点（図形種別の分岐・図形固有のプロパティ名の持ち込み、`InputTracker`への計算の持ち込み、依存方向の逆転・循環、同じ規則・状態の二重定義、`main.js`への判定・計算・専用の同期の経路、テストのためのソースの書き換え）で差分を確かめる。
        *   `node --test`を実行し、全件の合格と件数（tests・suites）を詳細作業内容に書く。`InputTracker.js`・`main.js`の行数を`wc -l`で実測して書く。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [ ] タスク13: 要件8 テストプレイの確認項目を実コードで確かめ直して確定する
    *   **対象ファイル** :
        *   本RES（5章の末尾の確認項目のみ）
    *   **作業内容** :
        *   5章の末尾の確認項目（0〜9）を、実装したコード（`index.html`のid・`title`・記号、`main.js`の配線、規則の受理の条件）と照らして確かめ、違う記述（記号・`title`の文言・押せる条件・欄に出る値の例）を実コードに合わせて直し、確定させる。直した点を詳細作業内容に書く。
        *   ソースコードは変えない。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [ ] タスク14: 開発資料（`PROJECT_ARCHITECTURE.md`と、`_doc/arch/`の該当ファイル）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
        *   `./_doc/arch/`の該当ファイル（2章『開発資料の更新予定』に挙げたもの）: 更新、`./_doc/arch/44_ReferencePointRules.md`・`./_doc/arch/45_TransformInputSettings.md` : 新規
    *   **作業内容** :
        *   2章『開発資料の更新予定』（各タスクで追記したものを含む）を確認し、`PROJECT_ARCHITECTURE.md`（少なくとも1章＝構成図に足したファイル・「存在しないもの」の変形のPhaseの項、2章＝選択状態に基準点・比率の鍵を保存しないこと、3章＝13.のオプションバーが2行・20.の位置の定義と発注者の決定の置き換え・26.の回転の中心が基準点・キーボードの受理判定の対応表に反転の2つのキー・新しい27.）と`_doc/arch/`の該当ファイルへ反映する。新しいモジュールの資料ファイル（44・45）を同じ形式で作り、4章の一覧に1行ずつ足す。
        *   **書き換える前に各ファイルの行末（CRLF／LF）をバイト数で実測し（例：`tr -cd '\r' < ファイル | wc -c`で`\r`のバイト数、`tr -cd '\n' < ファイル | wc -c`で`\n`のバイト数を数えて比べる。`grep -c`では判別できない）、行末を保つこと**（ファイルごとに混在している）。新しいファイルは同じフォルダの既存のファイルの行末にそろえる。
        *   `_doc/arch/06_InputTracker.md`・`_doc/arch/02_main.md`に記録している`InputTracker.js`・`main.js`の行数を、本作業の後の実測値に直す。`_doc/arch/16_test.md`に本作業の追加分（新しいファイル・タスクごとの件数・期待値を変えたケース・テストできない箇所）と件数を書く。
        *   本タスクの例外：開発資料の書き換えはこの最終タスクでのみ行う（個別の実装タスクでは書き換えない）。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件B 基準点の規則（新規`core/ReferencePointRules.js`）とテスト
*   **作業内容** :
    *   `js/core/ReferencePointRules.js`を新規作成（`REFERENCE_POINT`・`DEFAULT_REFERENCE_POINT`・非公開の表`REFERENCE_POINT_AXES`・`isReferencePoint`・`resolveReferencePointPosition`。importは`ScaleHandleRules.js`の`SCALE_HANDLE_NAMES`・`computeFrameCenter`のみ。名前の文字は`includes`で読まず表で引く。先頭の責務定義・全項目にJSDoc記載済み）。
    *   `test/core/ReferencePointRules.test.js`を新規作成（9か所・中心＝`computeFrameCenter`・null/未知は中心・幅0/高さ0/両方0・非破壊）。
    *   `node --test`：tests 2391 / suites 395 / pass 2391 / fail 0。

### タスク2: 要件B 基準点・比率の鍵の設定の持ち主（新規`core/TransformInputSettings.js`）とテスト
*   **作業内容** :
    *   `js/core/TransformInputSettings.js`を新規作成（`UnitSnapSettings`と同じ形。typedef`TransformInputSettingsSnapshot`、クラス、`getState`・`getReferencePoint`・`isAspectLocked`・`setReferencePoint`・`setAspectLocked`・`toggleAspectLock`・`onChange`、非公開の`#notifyChange`。importは`./ReferencePointRules.js`の`DEFAULT_REFERENCE_POINT`・`isReferencePoint`のみ＝`REFERENCE_POINT`は使わないためimportしていない。先頭の責務定義・全項目にJSDoc記載済み）。
    *   `test/core/TransformInputSettings.test.js`を新規作成（初期値・`getState`の独立・基準点の通知/同値/未知値のwarn・鍵の通知/非真偽値のwarn/トグル・相互に影響しない・`onChange`の関数以外の無視と登録順）。
    *   `node --test`：tests 2403 / suites 399 / pass 2403 / fail 0。

### タスク3: 要件F 回転の中心を基準点にする（`RotationRules.computeRotationCenter`の第2引数）とテスト
*   **作業内容** :
    *   `js/core/RotationRules.js`：`computeRotationCenter(frame, referencePoint)`の本体を`resolveReferencePointPosition(frame.bounds, referencePoint)`に変更。`./ReferencePointRules.js`のimportを追加し、使わなくなった`computeFrameCenter`を`./ScaleHandleRules.js`のimportから外した。先頭の責務定義（import先の列挙）と関数のJSDocを更新。ほかの関数は未変更。
    *   `test/core/RotationRules.test.js`：ケースを3つ追加（9か所の基準点・第2引数省略/null/未知は中心・左上基準の90°回転で左上の角が動かない）。import に`computeFrameCenter`・`applyAffineTransformToPoint`を追加。既存ケースは未変更。
    *   `node --test`：tests 2406 / suites 399 / pass 2406 / fail 0。

### タスク4: 要件F `InputTracker`の入力の補助`getReferencePoint`
*   **作業内容** :
    *   `js/core/InputTracker.js`：typedef`InputAssist`に`getReferencePoint`、`NO_INPUT_ASSIST`に`getReferencePoint() { return null; }`、コンストラクタの正規化に1項目を追加。`#beginRotateSelection`の`center`を`computeRotationCenter(rotationHit.frame, this.#inputAssist.getReferencePoint())`に変更。JSDoc（NO_INPUT_ASSIST・クラス・コンストラクタ第7引数・`#beginRotateSelection`）の列挙・説明を更新。拡大縮小の経路は未変更。
    *   行数：`wc -l`実測 2035行（見積もり約2038行）。
    *   `node --test`：tests 2406 / suites 399 / pass 2406 / fail 0（`InputTracker`のテストは無い。注入前は既定`null`＝外枠の中心で今と同じ）。
    *   なお`#rotateDrag`のフィールドJSDoc（385行付近）の「center＝回転の中心」の文言は、意味が変わらないため未変更。

### タスク5: 要件C 位置の欄を基準点にする（`edit/PositionInputEditor.js`）とテスト
*   **作業内容** :
    *   `js/edit/PositionInputEditor.js`：依存に省ける`getReferencePoint`（関数でなければ`() => DEFAULT_REFERENCE_POINT`）を追加、`#shapeExtentReader`の型を`getSelectedGeometryBounds`に変更。`#resolveTargetAndBounds`の図形の枝は`getSelectedGeometryBounds()`（`null`なら`bounds: null`）→`resolveReferencePointPosition`→基準点の位置の0×0の範囲を返す。頂点の枝は未変更。import（`DEFAULT_REFERENCE_POINT`・`resolveReferencePointPosition`）・先頭の責務定義・クラスJSDoc・コンストラクタ・`#resolveTargetAndBounds`のJSDocを更新。行数93。
    *   `test/edit/PositionInputEditor.test.js`：補助A・Bに省ける引数`referencePoint`を追加（渡したら`getReferencePoint`を注入）。要件I(a)の6件（A:図形1つ×2・A:図形複数・A:線の太さ（見出しも「変わらない」に変更）・B:受理しない入力・B:受理する入力）だけ`'nw'`を渡して期待値を書き換え。追加4件：既定は中心、9か所の基準点ごとの表示と移動量、基準点を変えても表示だけ変わり図形は変わらない、頂点は基準点によらず今のまま。
    *   `node --test`：tests 2410 / suites 399 / pass 2410 / fail 0。
    *   `PositionInputRules.js`・`NudgeEditor.js`・`ShapeExtentReader.js`は変更なし。

### タスク6: 要件D 幅・高さ・角度・反転の規則（新規`edit/TransformInputRules.js`）とテスト
*   **作業内容** :
    *   `js/edit/TransformInputRules.js`を新規作成（先頭の責務定義・`SIZE_AXIS`・`FLIP_AXIS`・`ANGLE_INPUT_IDLE_TEXT`・typedef`SizeInputView`・`TransformInputView`・`canTransformSelection`・`buildSizeInputView`・`buildTransformInputView`・`resolveSizeTransform`・`resolveRotationTransform`・`resolveFlipTransform`・非公開の`parseInputNumber`・`hasFiniteBounds`。全項目にJSDoc記載済み。importは`StatusReadoutRules`の`formatReadoutNumber`・`ScaleHandleRules`の`toScaleTransform`・`RotationRules`の`toRotationTransform`のみ）。
    *   `test/edit/TransformInputRules.test.js`を新規作成（手計算の固定値。要件Iの項目を網羅）。
    *   `node --test`：tests 2433 / suites 399 / pass 2433 / fail 0。
    *   計画との差：外枠の有限判定を非公開の補助`hasFiniteBounds`に切り出した（`canTransformSelection`内の判定と同じ内容）。

### タスク7: 要件D 変形の数値入力・反転の手順（新規`edit/TransformInputEditor.js`）とテスト（保存・書き出しを含む）
*   **作業内容** :
    *   `js/edit/TransformInputEditor.js`を新規作成（先頭の責務定義・クラス・コンストラクタ・`getSizeView`・`getTransformView`・`setSize`・`rotateBy`・`flip`・非公開`#resolveFrame`・`#apply`・非公開フィールド6つにJSDoc記載済み。importは`NudgeTargetRules`の`resolveNudgeTarget`・`ReferencePointRules`の`DEFAULT_REFERENCE_POINT`・`resolveReferencePointPosition`・`./TransformInputRules.js`のみ。図形種別の分岐・`try/catch`なし）。
    *   `test/edit/TransformInputEditor.test.js`を新規作成（23件：押せない条件（SELECTで選択なし・VERTEX・CREATE・PAN）、表示、幅（9か所の基準点・鍵あり・複数選択・水平な直線の高さ）、高さ、角度（90度・30度）、反転（横・縦・基準点・弧）、円・パス、記録1回・通知1回、選択・id・並び・スタイル不変、実物の`HistoryManager`＋`SnapshotAdapter`で取り消し1件・360度は記録なし、`DocumentSerializer`の往復と`SpriteSerializer.serialize`の形（`formatVersion` 4・`source.version` 3・基準点/鍵のキー無し））。
    *   `node --test`：tests 2456 / suites 399 / pass 2456 / fail 0。
    *   計画との差：弧・円の座標に三角関数由来の約1e-14の誤差が出るため、弧の反転のテストは許容誤差（1e-9）で比べている。

### タスク8: 要件G 大きさ・変形のまとまりのUI部品（新規`palette/OptionBarSizeGroup.js`・`palette/OptionBarTransformGroup.js`）
*   **作業内容** :
    *   `js/palette/OptionBarSizeGroup.js`を新規作成（importなし。先頭の責務定義・typedef`SizeInputView`（二重定義の相手を明記）・`OptionBarSizeGroupActions`・定数`AXIS_WIDTH`/`AXIS_HEIGHT`・クラス・非公開フィールド・メソッドにJSDoc記載済み。幅・高さの欄の`change`/`blur`、鍵の`click`、`render`で`disabled`・`aria-pressed`）。
    *   `js/palette/OptionBarTransformGroup.js`を新規作成（importなし。typedef`TransformInputView`・`OptionBarTransformGroupActions`・定数`FLIP_HORIZONTAL`/`FLIP_VERTICAL`・クラス等にJSDoc記載済み。角度の欄は`change`のたび戻り値によらず`#lastView.angle`で書き戻し、基準点は`dataset.referencePoint`を渡すだけ）。
    *   コンストラクタの`Error`は、コールバックが関数でないときに投げる（SizeGroupは`onSizeChange`・`onAspectLockToggle`、TransformGroupは3つすべて）。テストは書いていない（DOM部品、計画どおり）。
    *   `node --test`：tests 2456 / suites 399 / pass 2456 / fail 0。

### タスク9: 要件A オプションバーの2行と新しいまとまり（`index.html`）
*   **作業内容** :
    *   （未記入）

### タスク10: 要件H `main.js`の配線（設定の持ち主・注入・大きさと変形のまとまり）
*   **作業内容** :
    *   （未記入）

### タスク11: 要件E 反転のキー（`KeyboardShortcuts`の2エントリ・`main.js`の`// 8.`）とテスト
*   **作業内容** :
    *   （未記入）

### タスク12: 仕上げの確認（JSDoc・スコープ・全テスト）
*   **作業内容** :
    *   （未記入）

### タスク13: 要件8 テストプレイの確認項目を実コードで確かめ直して確定する
*   **作業内容** :
    *   （未記入）

### タスク14: 開発資料（`PROJECT_ARCHITECTURE.md`と、`_doc/arch/`の該当ファイル）への反映
*   **作業内容** :
    *   （未記入）

## 5. 懸念事項・要確認ポイント
* (1) **2行目の並びと`px`（発注者の決定で解決済み 2026-11-22）**：REQは「並びは`X` `Y` `W` 鍵 `H` `px`」。資料3章13.の「数値の欄を足すときは、まとまり・UI部品・ブロックを足すだけで既存のものを変えない（大きさ・角度の欄を足すときも同じ）」に従い、幅・高さ・鍵は新しいまとまり`#option-size-group`に置き、位置のまとまり（`#option-position-group`・`OptionBarPositionGroup`）とは分けたまま（区切りの罫線が`Y`と`W`の間に入る）。**発注者の決定により、位置のまとまりの`px`の`<span class="option-unit">px</span>`だけを`index.html`から消し、2行目は`X: [ ] Y: [ ] │ W: [ ] 🔒 H: [ ] px │ ∠ [ ] ° 基準点 ⇆ ⇅ │ 整列・分布 │ 角`とする**（単位は大きさのまとまりの`px`1つ）。`OptionBarPositionGroup.js`が読む要素は`#option-position-x`・`#option-position-y`だけのため、JSは変わらない（「変えないファイル」のまま）。まとまり・UI部品・ブロックの分け方は変えない。資料3章13.・20.にこの決定を記録する（2章『開発資料の更新予定』）。角度・基準点・反転は1つのまとまり`#option-transform-group`にまとめた（並びは角度・基準点・反転）。
* (2) **位置の欄の初期値が中心になる**：基準点の初期は中心のため、今まで「線を含む外枠の左上」を出していた位置の欄が、ページを開いた直後から「線を含まない外枠の中心」を出す（REQの(a)のとおりの変化。テストプレイで発注者に確かめてもらう点）。
* (3) **基準点・鍵の表示の同期**：基準点・鍵のボタンは図形を変えないため、設定の持ち主の変更通知`transformInputSettings.onChange`を足し、既存の3つの同期関数だけを登録する（`unitSnapSettings.onChange`と同じ形。キャンバスは再描画しない）。資料3章の同期の経路の一覧に1項足す。
* (4) **キーの対応表のテスト**：対応表は非公開で、`#handleKeyDown`は`document`を購読するため、新しいテスト`KeyboardShortcuts.keydown.test.js`は`globalThis.document`等の仮の値を置いて`KeyboardShortcuts`のコンストラクタが登録したハンドラを直接呼ぶ（ソースは変えない）。今までの`KeyboardShortcuts.test.js`は「`document`を触らない範囲」に限っていたため、新しいやり方になる（ファイルを分け、`after`で元に戻す）。
* (5) **角度の欄の書き戻し**：角度の欄は`change`のたびに戻り値によらず最後の表示（押せるときは`0`）へ書き戻す（フォーカスが残っていても）。位置・幅・高さの欄は今の位置の欄と同じく、受理しなかったときと`blur`のときだけ書き戻す（受理したときはフォーカスが外れるまで打った値が残る）。
* (6) **前後が同じ変形**：幅0の向きの反転（垂直な直線の横の反転で基準点が線の上）・360°の回転などは図形が変わらず、`HistoryManager`が記録しない（取り消しは増えない）。キーの`Shift`+`H`・`Shift`+`V`は受理（`preventDefault`）する。
* (7) **`Shift`+`H`・`Shift`+`V`の今までのふるまい**：今までは一致せずブラウザの既定のまま（実質何も起きない）だった。本作業の後は、選択（`V`）で図形を選んでいるときだけ受理し、それ以外では今までどおり一致しても受理しない（`false`）。`Ctrl`+`Shift`+`H`は一致しない（今までどおりブラウザの操作）。
* (8) **ステータスバーの`W:`・`H:`と幅・高さの欄の違い**：ステータスバーは線を含む外枠（今のまま）、幅・高さの欄は線を含まない外枠のため、線の太さの分だけ値が違う（REQの発注者の決定どおり）。
* (9) **入力の数値の受理の3行**：空・数値でない文字列を弾く手順（`typeof text !== 'string' || text.trim() === ''`・`Number(text)`・`Number.isFinite`）は、`PositionInputRules.resolvePositionDelta`の中にもあり、`TransformInputRules`の非公開`parseInputNumber`にも書く（`PositionInputRules`を変えないため。受理の条件（正の値・0を弾く等）は欄ごとに違う）。共通の関数へまとめる場合は`PositionInputRules`を変えることになるため、本作業では行わない。この判断は開発資料（3章27.の「計画の設計判断」・`_doc/arch/14_edit.md`）にも残す（2章『開発資料の更新予定』）。
* (10) **`InputTracker`の行数**：見積もりは約2038行（+約11行）。

### テストプレイの確認項目（発注者がブラウザで確かめる。タスク13で実コードと照らして確定する）
* **0. 準備**：`Ctrl`+`F5`で最新にする。新しいキャンバスに、直線（`1`）・矩形（`4`）・円（`5`）・弧（`3`）・塗った矩形（オプションバーの🪣で塗りあり）・曲線のパス（`2`で3点以上打って終える）・水平な直線（`1`で`Shift`を押しながら横に引く）を描いておく。線の太い矩形も1つ用意する（太さの欄に`10`）。
* **1. オプションバーが2行**：ツールバーが2行になり、1行目に🧰📁・↶↷・🗑🔗・スタイル・重なり順、2行目に位置（X・Y）・区切りの罫線・大きさ（W・🔒・H・px）・角度（∠・°）・基準点の3×3・反転（⇆・⇅）・整列と分布・角が並ぶ（位置〜大きさは`X: [ ] Y: [ ] │ W: [ ] 🔒 H: [ ] px`。Yの欄の後ろに`px`が無く、`px`はHの欄の後ろの1つだけ）。ブラウザの幅を1280pxにして、どちらの行も右端が切れない。横の定規がツールバーのすぐ下に、ツールパレット・キャンバスパレット（📁）・`?dev`の確認用ウィンドウがキャンバスの左上・右上に出る（ツールバーや定規に重ならない）。キャンバスの上でカーソルを動かすと、ステータスバーの座標・定規の印がカーソルの位置に合い、クリック・ドラッグ・範囲選択の位置がずれない。
* **2. 基準点と位置の欄**：矩形を選ぶと3×3の中心が押された見た目で、位置の欄にその矩形の外枠の中心の座標が出る。左上のボタンを押すと押された見た目が左上に移り、位置の欄の値が外枠の左上の座標に変わる（図形は動かない）。位置の欄のXに`100`を入れて`Enter`すると、外枠の左上がX=100に来る。ほかの7か所でも同じ。線の太い矩形でも、位置・幅・高さの値が画面の青い外枠（ハンドルの枠）に合う（ステータスバーの`W:`・`H:`は線を含む大きさのまま、太さの分だけ大きい）。
* **3. 幅・高さの欄**：矩形を選び、基準点を左上にしてWに`200`を入れると、左上を動かさずに幅200になる。基準点を中心にすると中心を動かさずに変わる。🔒を押して押された見た目にしてからWを変えると、Hも同じ比率で変わる。2つの図形を選んで🔒ありでWを変えると、選択全体の縦横の比率を保って変わる。`0`・`-10`・`abc`・空を入れると図形は変わらず欄が元の値に戻る。水平な直線を選ぶとHの欄は`0.0`で押せない（🔒ありでWを変えても高さは0のまま）。
* **4. 角度の欄**：矩形を選び、角度の欄に`30`を入れて`Enter`すると、基準点の周りに反時計回りに30°回り、欄が`0`に戻る。`-30`で時計回りに戻る。基準点を左上にして`90`を入れると左上の角の周りに回る。回転前に整数の座標の矩形に`90`を入れて回した後、`?dev`の「JSONへ変換」で座標が整数のまま（`1e-16`のような値が無い）。`0`・`abc`・空は何も起きず欄が`0`に戻る。
* **5. 反転**：⇆・⇅のボタンと`Shift`+`H`・`Shift`+`V`で、選んだ図形が基準点を通る縦（横）の線を軸に反転する（基準点を左上にすると左上の角を軸に裏返る）。弧を⇅で反転すると下向きの弧になる。`H`（キャンバス移動）・`V`（選択）・`Ctrl`+`Shift`+`V`（同じ位置に貼り付け）は今までどおり働く。`Shift`+`H`を押したままにしても1回しか反転しない。図形を引いている最中（ドラッグ中）は⇆・⇅・`Shift`+`H`が効かない。
* **6. ドラッグの回転**：基準点を左上にして角の外側を引くと、左上の角の周りに回る（回している間の外枠も左上の周りに回る）。基準点を中心に戻すと今までどおり外枠の中心の周りに回る。外枠のハンドルを引く拡大縮小は、基準点によらず今のまま（引いたハンドルの反対側が動かない。`Alt`で中心）。
* **7. 取り消し**：幅・高さ・角度の数値の確定1回・反転1回（ボタン・キー）が、`Ctrl`+`Z`の取り消し1件で戻り、`Ctrl`+`Y`でやり直せる。取り消し・やり直しで選択は変わらない。基準点・🔒を押しただけでは取り消しの記録は増えない。
* **8. 押せないとき**：何も選んでいないとき、頂点の選択（`A`）のとき（図形だけ選んでいる・頂点を選んでいるどちらも）、図形作成・キャンバス移動のツールのときは、幅・高さ・🔒・角度・基準点の3×3・⇆・⇅が押せない見た目で、欄が空。`Shift`+`H`・`Shift`+`V`は何もしない。`A`で頂点を選ぶと位置の欄は今までどおり選んだ頂点の左上を出し、値を入れると頂点が動く。
* **9. 保存・書き出し**：幅・高さ・角度・反転で変形した図形を、キャンバスパレットの「出力（作業ファイル）」で出力して「開く」で開き直すと同じ形。「出力（エンジン用）」のJSを確認用ページ（`sprite-check.html`）で開くと同じ形。基準点（左上など）・🔒の状態は、ページを再読み込みすると初期（中心・🔒なし）に戻る。キャンバスを切り替えても基準点・🔒の状態は保たれる。
