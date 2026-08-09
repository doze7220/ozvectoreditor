# RES: 作業計画・作業レポート (Phase 01-04) : フロートウィンドウシステムの構築と図形パレットの統合
* 参照元REQ: `./_log/req/20260809_1157_REQ_Phase01-04_FloatWindowManager_And_PaletteP.md`
* 参照元DIR: `./_log/dir/20260808_1952_DIR_Phase01-04_FloatWindowManager_And_PaletteP.md`

## 1. 作業目的
将来乱立するフロートウィンドウ（プロパティ、レイヤー、カラーサークル等）の衝突バグ（z-index崩壊、イベント透過、ドラッグロジックの重複）を構造的に防止するため、`core/WindowManager.js` として「ドラッグ移動」「アクティブ最前面化」「イベント透過防止」を一元管理する共通基盤を新設する。
その最初の実証例として、既存「コントロールパネル」を共通マークアップ規格（`.float-window`）へ移行してWindowManagerの管理下に置き、新規「図形選択パレットウィンドウ」（直線・曲線・弧・矩形・円の5ボタン）を追加してSELECT/DRAWモードに応じた活性・非活性連携を配線する。また`ShapeFactory`に5大図形の受理分岐（未実装4種はLineスタブへフォールバック）を追加し、パレット→ツール切替→作図までのパイプラインをエラーなく開通させる。

## 2. アーキテクチャ設計

### 要件1: `core/WindowManager.js` の新設（ドラッグ・最前面化・イベント遮断の中央統治）
* 新規クラス`WindowManager`を`core/`直下に追加する。コンストラクタで`document.querySelectorAll('.float-window')`により対象要素を動的検知し、各要素に対して以下を一元的に注入する。
    * **イベント透過防止**: 各`.float-window`要素自身に対し、`mousedown`/`click`/`mousemove`/`mouseup`の4種のリスナーをバブリングフェーズで登録し、`event.stopPropagation()`を実行する。ウィンドウ内の子要素（ボタン等）からバブリングしてきたイベントはこの1点で遮断されるため、個々のウィンドウ・ボタン側に遮断コードは一切不要になる。
    * **アクティブ最前面化**: 上記`.float-window`要素の`mousedown`リスナー内で、内部プライベートカウンター`#currentMaxZIndex`（初期値`10`）を`++`した値を`windowEl.style.zIndex`へ書き込む処理を同居させる（`mousedown`1本で「遮断」と「最前面化」の両方を担う。DIRが許容する「mousedown（または click）」のうち`mousedown`を採用し、`click`との二重発火を避ける）。
    * **ドラッグ移動**: 各`.float-window`内の`.window-header`要素に対してのみ`mousedown`リスナーを追加し、ドラッグ開始（`#startDrag`）をトリガーする。実際の追従処理は`WindowManager`が`window`に対して1本だけ登録する共通の`mousemove`/`mouseup`リスナーが担い、内部の単一ドラッグ状態（`#draggingWindow`等のプライベートフィールド）を見て「ドラッグ中か否か」を判定する。これにより、マウスがウィンドウ外やブラウザ外に外れても`window`レベルで追従・解除が継続され、状態が壊れない。
    * **設計判断（要確認）**: ドラッグ中の位置更新は、ドラッグ開始時に`getBoundingClientRect()`で現在位置を取得し、以後は`style.left`/`style.top`にマウス移動量(dx, dy)を加算して追従させる方式とする。DIRのマークアップ例は初期配置に`top`/`right`を用いているため、ドラッグ開始時点で`style.right`を`'auto'`にクリアし、`left`基準へ切り替える（`position: fixed`のままなので見た目には影響しない）。この切替は「dx/dyに同期してスムーズに追従」というDIR要件を、初期アンカー（top/right）に関わらず安定して満たすための実装上の判断であり、実装後にこの点を目視確認すること。
* `WindowManager`は**DOM操作（ドラッグ・z-index・イベント遮断）のみ**を担当し、図形データ・選択状態・ツール状態など`VectorModel`/`InputTracker`が持つ状態には一切関与しない（MVC厳守）。
* 動的に後から追加される`.float-window`の再検知（MutationObserver等）は本Phaseでは実装しない（本Phase時点で対象2ウィンドウは初期DOMに存在するため不要。将来Phaseの課題とする）。

### 要件2: 既存コントロールパネルの「フロートウィンドウ化」
* `index.html`内の`#control-panel`を、DIR要件1の共通マークアップ規格（`id="window-control-panel"` / `class="float-window"` / `.window-header`（`.window-title` + `.window-close-btn`）/ `.window-body`）へ完全移行する。
* 既存の`#control-panel-header`は`.window-header`＋`.window-title`（テキスト「OZ Vector Editor」）＋`.window-close-btn`（`×`、機能未実装のボタン構造のみ）に置き換える。
* 既存の`#control-panel-body`はそのまま`.window-body`にリネームし、内部の`#tool-select`/`#tool-line`ボタンは変更しない。
* `js/main.js`末尾（77〜79行目）にベタ書きされている`controlPanel`への`mousedown`/`click`/`mousemove`の`stopPropagation`実装は削除する（`WindowManager`への一元化により不要かつ責務違反となるため）。

### 要件3: 新規「図形選択パレットウィンドウ」の追加
* `index.html`に`id="window-shape-palette"` / `class="float-window"`を新設し、要件1と同一の共通マークアップ規格（`.window-header`＋`.window-body`）に準拠させる。
* `.window-body`内に直線・曲線・弧・矩形・円の5ボタンを配置する（例: `id="palette-line"`(type=`line`) / `id="palette-curve"`(type=`curve`) / `id="palette-arc"`(type=`arc`) / `id="palette-rect"`(type=`rect`) / `id="palette-circle"`(type=`circle`)、共通クラス`.tool-btn`を流用して見た目を統一）。
* モード連携: `select`モード中はパレット本体（`#window-shape-palette`）に`.disabled`クラスを付与し、CSSで`opacity`低下＋`pointer-events: none`によりクリック不可にする。`draw`系モード（`line`等、`select`以外）中は`.disabled`を除去し活性化する。この配線ロジック自体は`main.js`側（要件5）に置き、CSSは本タスクでルールのみ定義する。
* 初期配置はコントロールパネルと重ならないよう、コントロールパネル（`top:16px; right:16px;`）の下に縦積みで配置する（`top:320px; right:16px;` を仮の初期値とする。ウィンドウ高さは実装後の見た目に応じて微調整可、要目視確認）。

### 要件4: `ShapeFactory`への5大図形スタブ配備
* `core/ShapeFactory.js`の`create(type, x1, y1, x2, y2)`内の分岐を、`if`から`switch`（またはif-elseチェーン）に拡張し、`line, curve, arc, rect, circle`の5種を受理する。
* `line`は現行通り`new Line(x1, y1, x2, y2)`を返す。
* `curve, arc, rect, circle`の4種は、いずれも暫定的に`new Line(x1, y1, x2, y2)`を返す「安全なスタブフォールバック」とし、スタブである旨をコードコメントで明記する（例: `// TODO(Phase未定): 専用クラス未実装のためLineへポリモーフィックにフォールバックするスタブ`）。
* 上記5種以外の未知の`type`は、既存仕様通り`Error`をthrowする挙動を維持する（`default`節等で対応）。
* `ShapeFactory`は引き続き`core/`層で図形種別分岐を許容する唯一の例外モジュールであり、この改修によって`VectorModel`/`CanvasManager`/`InputTracker`に分岐ロジックを持ち込まない。

### 要件5: `js/main.js`の配線改修（縮小版：コントロールパネル既存2ボタン＋PaletteController統合のみ）
* `WindowManager`をインポートし、DOMContentLoaded内で`new WindowManager()`をインスタンス化する（他モジュールのインスタンス化と同列に配置。戻り値の保持有無は実装時に要否判断——本Phaseでは`WindowManager`に対する後続の外部呼び出しがないため、ローカル変数保持のみで良い）。
* 要件2の通り、既存`controlPanel`への個別`stopPropagation`バインド（3行）を削除する。
* `PaletteController`（要件6）をインポートし、`#window-shape-palette`要素と`inputTracker`を渡して`new PaletteController(paletteRootElement, inputTracker)`としてインスタンス化する（他モジュールと同列の依存性注入。以降の呼び出しに使うため変数として保持する）。
* ツール切替: 既存の`createToolClickHandler`（またはそれに相当する共通関数、例: `applyTool(tool)`）は、**コントロールパネル既存2ボタン（`select`/`line`）のみ**を対象範囲とする。具体的には`inputTracker.setTool(tool)`の呼び出しと、コントロールパネルの`select`/`line`ボタンの`.active`クラスの排他的な付け外しのみを担う。
    * パレットの活性・非活性制御、パレット内5ボタンのアクティブ表示は`main.js`側では一切行わず、`applyTool(tool)`の末尾で`paletteController.setActiveTool(tool)`を呼び出すことで`PaletteController`へ委譲する。
* 新設パレット5ボタンへの`click`リスナー登録は`main.js`側では行わない（要件6の通り`PaletteController`が自身のコンストラクタ内で行うため、`main.js`は`PaletteController`のインスタンス化のみで完結する）。
* 初期状態（DOMContentLoaded直後）でパレットが非活性表示になっている必要があるが、これは要件3の通りHTML初期クラス（`#window-shape-palette`への初期`.disabled`付与）で担保する想定とし、`main.js`側での初期化時呼び出しは必須としない（`PaletteController`インスタンス化時点でHTMLの初期クラスをそのまま尊重する設計のため）。

### 要件6: `js/palette/PaletteController.js`の新設
* `PROJECT_ARCHITECTURE.md`（1章）に予約されている`js/palette/`フォルダ（自己完結するUI部品を置くフォルダ）の最初の入居者として、新規図形選択パレットの配線ロジック一式を切り出す。
* コンストラクタ`constructor(paletteRootElement, inputTracker)`で、パレットのルート要素（`#window-shape-palette`）と`InputTracker`インスタンスを受け取る。
* コンストラクタ内で、パレット内5ボタン（直線・曲線・弧・矩形・円）それぞれに`click`リスナーを登録し、クリック時に`inputTracker.setTool(type)`を呼び出す（`WindowManager`と同様、図形種別のif/switch分岐は伴わず、ボタンごとに対応する`type`文字列を渡すのみ）。
* 公開メソッド`setActiveTool(tool)`を持つ。呼び出されるたびに以下を行う:
    * `tool === 'select'`の場合はパレット本体（ルート要素）に`.disabled`クラスを付与し、それ以外の場合は除去する。
    * パレット内5ボタンのうち`tool`と一致するものにのみ`.active`クラスを付与し、他のボタンからは除去する（`tool`が`select`/`line`等パレット外由来の値であっても、一致するボタンがあればそのボタンに`.active`が付く。一致しない場合は全ボタンとも`.active`を持たない）。
* `VectorModel`・図形データ・選択状態には一切関与せず、DOM操作（`click`購読、`.disabled`/`.active`クラスの付与・除去）のみを責務とする（`WindowManager`と同様の設計原則。MVCのVには一切触れない）。
* ファイル先頭にJSDocで単一責務（3行以内）を明記する。

### 関連フォルダと論理クラス
* **対象フォルダ**:
    * `./js/core/`（横断的処理を置くフォルダ。DOM統治を担う新規クラスの置き場として適切）
    * `./js/palette/`（自己完結するUI部品を置くフォルダ。図形選択パレットの配線ロジックの置き場として適切）
* **関連する論理クラス**:
    * `WindowManager`（新規、`core/WindowManager.js`）
    * `ShapeFactory`（改修、`core/ShapeFactory.js`）
    * `PaletteController`（新規、`palette/PaletteController.js`）
* **参照する責務**（`PROJECT_ARCHITECTURE.md`より抜粋）:
    * 「横断的な処理（入力→状態→描画の複数層にまたがるもの）は`core/`に置く。自己完結する機能（1種類の図形、1つのUI部品など）は、それぞれ専用フォルダにまとめる」（1章）
    * 「`ShapeFactory.js`: 図形typeに応じたインスタンス生成を一元的に担うFactory。（中略）`core/`層全体を通じて図形種別のif/switch分岐を許容する唯一の例外モジュールである」（4章）
    * 「`palette/` : ツールバー・カラーピッカー等のUI部品。追加され次第、ここに列挙していく」（4章）

### 開発資料（PROJECT_ARCHITECTURE.md）の更新予定
* 4章「各モジュールの責務リファレンス」に、`WindowManager.js`の責務説明を新規追記する（`.float-window`の動的検知、ドラッグ移動、最前面化、イベント遮断の一元管理を担い、図形データ・選択状態には関与しないこと、を明記）。
* 4章の`ShapeFactory.js`の説明を更新し、受理する`type`が`line, curve, arc, rect, circle`の5種へ拡張されたこと、および`curve/arc/rect/circle`が暫定的にLineスタブへフォールバックする実装であることを追記する。
* 4章の`palette/`の説明（現状「追加され次第、ここに列挙していく」の薄い記載）へ、`PaletteController.js`の責務（図形選択パレットの5ボタン配線・活性/非活性制御・アクティブボタン表示を担い、`VectorModel`・図形データ・選択状態には関与しないDOM専任クラスであること）を追記する。
* 1章「プロジェクトフォルダ構造」の`core/`配下リストに`WindowManager.js`を、`palette/`配下リストに`PaletteController.js`を追記する。
* 影響が大きいため、本更新は必須タスクとして下記タスクリストに含める。

## 3. タスクリスト
* [x] タスク1: `core/WindowManager.js`の新設
    * **対象ファイル**:
        * `./js/core/WindowManager.js`: 新規
    * **作業内容**:
        * 上記「要件1」のアーキテクチャ設計に従い、`WindowManager`クラスを実装する（`.float-window`の自動検知、`mousedown`/`click`/`mousemove`/`mouseup`の一元`stopPropagation`、`mousedown`起点の最前面化、`.window-header`起点かつ`window`レベル`mousemove`/`mouseup`で完結する安全なドラッグステートマシン）。
        * ファイル先頭にJSDocで単一責務（3行以内）を明記する。
        * クラス・メソッドにJSDocコメント（引数・戻り値・責務）を記述する。コード修正完了後、JSDoc記載漏れがないか確認する。
        * タスク完了後、本RESの「4. 詳細作業内容」該当欄に作業内容を追記する。
        * 実装中に判断に迷った点（特にドラッグ位置計算のtop/right→left/top切替方式）、目視確認を推奨する箇所があれば「5. 懸念事項・要確認ポイント」に記述する。

* [x] タスク2: `index.html` の共通CSS定義とコントロールパネルのフロートウィンドウ化
    * **対象ファイル**:
        * `./index.html`: 更新
    * **作業内容**:
        * 上記「要件2」に従い、`.float-window`/`.window-header`/`.window-title`/`.window-close-btn`/`.window-body`の共通CSSを定義する（`cursor: move`は`.window-header`に付与）。
        * `#control-panel`一式を共通マークアップ規格（`id="window-control-panel"` / `class="float-window"`）へ移行する。
        * コード修正完了後、（本タスクはCSS/HTMLのためJSDoc対象外。該当なしと明記する）。
        * タスク完了後、本RESの「4. 詳細作業内容」該当欄に作業内容を追記する。
        * 実装中に判断に迷った点、目視確認を推奨する箇所（初期配置座標、既存ボタンの見た目崩れ有無等）があれば「5. 懸念事項・要確認ポイント」に記述する。

* [x] タスク3: `index.html` への図形選択パレットウィンドウの追加
    * **対象ファイル**:
        * `./index.html`: 更新
    * **作業内容**:
        * 上記「要件3」に従い、`id="window-shape-palette"` / `class="float-window"`を新設し、直線・曲線・弧・矩形・円の5ボタンを配置する。
        * `.disabled`クラス（`opacity`低下＋`pointer-events: none`）のCSSルールを定義する。
        * 初期状態（`select`モード起動時）でパレットが非活性で表示されるよう、初期HTMLに`.disabled`クラスを付与しておく。
        * タスク完了後、本RESの「4. 詳細作業内容」該当欄に作業内容を追記する。
        * 実装中に判断に迷った点、目視確認を推奨する箇所（初期配置座標の重なり有無、ボタンラベルの見た目）があれば「5. 懸念事項・要確認ポイント」に記述する。

* [x] タスク4: `core/ShapeFactory.js` への5大図形スタブ分岐の追加
    * **対象ファイル**:
        * `./js/core/ShapeFactory.js`: 更新
    * **作業内容**:
        * 上記「要件4」に従い、`line, curve, arc, rect, circle`を受理する分岐へ拡張し、未実装4種はコメント付きでLineスタブへフォールバックする。未知typeは`Error`をthrowする挙動を維持する。
        * JSDocの`@param`/`@returns`/`@throws`記載を、5種対応・スタブ挙動の説明を含めて更新する。コード修正完了後、JSDoc記載漏れがないか確認する。
        * タスク完了後、本RESの「4. 詳細作業内容」該当欄に作業内容を追記する。
        * 実装中に判断に迷った点があれば「5. 懸念事項・要確認ポイント」に記述する。

* [x] タスク5: `js/palette/PaletteController.js` の新設
    * **対象ファイル**:
        * `./js/palette/PaletteController.js`: 新規
    * **作業内容**:
        * 上記「要件6」に従い、`PaletteController`クラスを実装する（コンストラクタでのパレット5ボタンへの`click`購読＋`inputTracker.setTool(type)`呼び出し、公開メソッド`setActiveTool(tool)`によるパレット本体の`.disabled`制御と5ボタンの`.active`排他制御）。
        * ファイル先頭にJSDocで単一責務（3行以内）を明記する。
        * クラス・メソッドにJSDocコメント（引数・戻り値・責務）を記述する。コード修正完了後、JSDoc記載漏れがないか確認する。
        * タスク完了後、本RESの「4. 詳細作業内容」該当欄に作業内容を追記する。
        * 実装中に判断に迷った点、目視確認を推奨する箇所（`tool`が5種いずれとも一致しない場合の全ボタン非アクティブ表示等）があれば「5. 懸念事項・要確認ポイント」に記述する。

* [x] タスク6: `js/main.js` の配線改修（WindowManager統合・コントロールパネル既存2ボタンの配線・PaletteController統合）
    * **対象ファイル**:
        * `./js/main.js`: 更新
    * **作業内容**:
        * 上記「要件5」に従い、`WindowManager`をインポート・インスタンス化する。
        * 既存の`controlPanel`への個別`stopPropagation`バインド（末尾3行）を削除する。
        * `PaletteController`をインポートし、`#window-shape-palette`要素と`inputTracker`を渡してインスタンス化する。
        * `createToolClickHandler`（またはそれに相当する`applyTool(tool)`等の共通関数）は、コントロールパネル既存2ボタン（`select`/`line`）の配線のみを対象範囲に縮小し、末尾で`paletteController.setActiveTool(tool)`を呼び出してパレット側の活性/非活性・アクティブ表示更新を委譲する。パレット5ボタンへの`click`購読は`main.js`側では行わない。
        * JSDocコメント（縮小後の`applyTool`等の責務・引数）を記述する。コード修正完了後、JSDoc記載漏れがないか確認する。
        * タスク完了後、本RESの「4. 詳細作業内容」該当欄に作業内容を追記する。
        * 実装中に判断に迷った点（初期`.disabled`状態とJS側状態の整合等）、目視確認を推奨する箇所（モード切替時のパレット活性/非活性の見た目）があれば「5. 懸念事項・要確認ポイント」に記述する。

* [x] タスク7（固定）: `PROJECT_ARCHITECTURE.md` の更新
    * **対象ファイル**:
        * `./PROJECT_ARCHITECTURE.md`: 更新
    * **作業内容**:
        * 上記「開発資料の更新予定」に記載した内容（`WindowManager.js`の責務追記、`ShapeFactory.js`の責務更新、`palette/`セクションへの`PaletteController.js`の責務追記、フォルダ構造への`WindowManager.js`・`PaletteController.js`追記）を反映する。
        * タスク完了後、本RESの「4. 詳細作業内容」該当欄に作業内容を追記する。

## 4. 詳細作業内容
### タスク1: `core/WindowManager.js`の新設
* **作業内容**:
    * `./js/core/WindowManager.js`を新規作成し、`WindowManager`クラスを実装した。
    * コンストラクタで`document.querySelectorAll('.float-window')`により対象要素を動的検知し、`#setupWindow(windowEl)`で各要素へ配線を行う設計とした。
    * イベント遮断と最前面化: 要件通り`mousedown`リスナー1本の中で`event.stopPropagation()`と`#currentMaxZIndex`（初期値10）の`++`＆`windowEl.style.zIndex`書き込みを同居させた。`click`/`mousemove`/`mouseup`の3種は伝播遮断のみを行う個別リスナーとした。
    * 最前面化・ドラッグ状態はいずれも`WindowManager`インスタンス内のプライベートフィールド（`#currentMaxZIndex`, `#draggingWindow`, `#dragStartMouseX`, `#dragStartMouseY`, `#dragStartLeft`, `#dragStartTop`）で保持し、`VectorModel.js`と同様のES2022クラスフィールド（`#`構文）で実装してプロジェクトの既存コーディングスタイルに合わせた。
    * ドラッグ移動: `.window-header`要素にのみ`mousedown`リスナーを追加し`#startDrag(event, windowEl)`を起動。実際の追従（`mousemove`）と終了（`mouseup`）は`window`に対して各1本だけ登録した共通ハンドラ（`#handleWindowMouseMove`/`#handleWindowMouseUp`）が担い、`#draggingWindow`の非null/nullで状態を判定する設計とした。これによりマウスがウィンドウ外・ブラウザ外に外れてもドラッグの追従・解除が破綻しない。
    * `.window-header`が存在しない`.float-window`要素（想定外だが）に対しては、ドラッグ配線をスキップし遮断・最前面化のみ有効とするガード（`if (!header) return;`）を入れた。
    * 動的に後から追加される`.float-window`の再検知（MutationObserver等）は要件通り本タスクでは未実装。
    * ファイル先頭にJSDocで単一責務（3行）を明記し、クラスの全プライベートフィールド・コンストラクタ・各メソッドにJSDoc（責務説明、`@param`、`@private`等）を記載した。記載漏れがないことを確認済み。
    * 本タスクは`WindowManager.js`単体の新設のみであり、`index.html`側に`.float-window`/`.window-header`が実在しないため、実機での動作確認（目視確認）はタスク2（コントロールパネルのフロートウィンドウ化）完了後に行うこと。

### タスク2: `index.html` の共通CSS定義とコントロールパネルのフロートウィンドウ化
* **作業内容**:
    * `index.html`の`<style>`内にあった`#control-panel`/`#control-panel-header`/`#control-panel-body`の個別CSSルールを削除し、代わりに要件2通りの共通クラス`.float-window`/`.window-header`/`.window-title`/`.window-close-btn`/`.window-body`を新規定義した。`cursor: move`は指示通り`.window-header`にのみ付与し、`.float-window`自体には付与していない。
    * 位置・サイズ（`top:16px; right:16px; width:220px;`）と背景色・ボーダー・box-shadow・font-familyといった見た目に関わるプロパティは、共通クラス側（汎用的な値）と`#window-control-panel`のIDセレクタ側（このウィンドウ固有の配置・幅）に分割して定義した。将来追加されるウィンドウ（タスク3の図形選択パレット等）は共通クラスの見た目を継承しつつ、固有の配置はIDセレクタ側で上書きする設計とした。
    * `#control-panel`のマークアップを`id="window-control-panel" class="float-window"`へ変更し、内部を`.window-header`（`.window-title`のテキスト「OZ Vector Editor」＋`.window-close-btn`（`×`、クリックハンドラ等の機能は本タスクでは未実装、構造のみ））、`.window-body`（旧`#control-panel-body`をリネーム、内部の`#tool-select`/`#tool-line`ボタンのid・クラス・並び順は変更なし）の構成へ完全移行した。
    * 本タスクはCSS/HTMLの変更のみのため、JSDoc追記は該当なし。
    * `js/main.js`の`document.getElementById('control-panel')`および末尾の`controlPanel`に対する`stopPropagation`配線（要件2でこのタスクの範囲外と明記されているタスク6の担当分）は本タスクでは一切変更していない。そのため、この時点で`index.html`をブラウザで開くと`main.js`側が`id="control-panel"`要素を取得できず（`getElementById`が`null`を返す）、直後の`controlPanel.addEventListener(...)`でエラーが発生し、以降のスクリプトが停止する状態になる。これはタスク6（`main.js`の配線改修）で`id="window-control-panel"`への参照修正と`WindowManager`統合が行われるまでの計画上想定内の一時的な不整合であり、本タスク単体の実装ミスではない。

### タスク3: `index.html` への図形選択パレットウィンドウの追加
* **作業内容**:
    * `index.html`の`<style>`内、`#window-control-panel`の直後に`#window-shape-palette { top: 320px; right: 16px; width: 220px; }`を新規追加した。コントロールパネル（`top:16px; right:16px; width:220px;`）の直下に304px分の余白を空けて縦積み配置する形とした（要件3の仮値`top:320px; right:16px;`をそのまま採用）。
    * `.disabled`クラスのCSSルール（`opacity: 0.4; pointer-events: none;`）を、要件3の指示通り「ルールのみ」新規定義した。特定のIDに紐付けず、`.float-window`一般に付与可能な汎用クラスとして定義しており、将来追加されるウィンドウでも同じクラスで非活性化を表現できる。
    * `<body>`内、`#window-control-panel`の`</div>`直後に`<div id="window-shape-palette" class="float-window disabled">`を新規追加した。要件2で確立済みの共通マークアップ規格（`.window-header`＝`.window-title`＋`.window-close-btn`、`.window-body`）に完全準拠させ、`.window-title`のテキストは「図形選択パレット」、`.window-close-btn`はコントロールパネルと同様に構造のみ（機能未実装）とした。
    * `.window-body`内に、直線・曲線・弧・矩形・円の5ボタンを要件3で指定された通りのid（`palette-line`/`palette-curve`/`palette-arc`/`palette-rect`/`palette-circle`）で配置し、共通クラス`.tool-btn`を流用して既存ボタンと見た目を統一した。各ボタンラベルはコントロールパネルの`／ 直線ツール`表記に倣い、記号＋図形名（`／ 直線`/`〜 曲線`/`◠ 弧`/`▭ 矩形`/`◯ 円`）とした。
    * 初期状態で非活性表示となるよう、要件3の指示通り初期HTMLの時点で`#window-shape-palette`のクラス属性に`float-window disabled`と`.disabled`を付与済みとした（`select`モードが初期ツールであるため、これと整合する）。
    * 本タスクは`index.html`のCSS/HTML変更のみのスコープであり、`type`属性やクリックイベント配線（`PaletteController`によるボタンごとの`type`判定・`click`購読）はタスク5・6の担当範囲として一切実装していない。ボタン要素はidのみを持ち、`data-*`属性等の付加情報は付与していない（要件3の記載範囲を超える実装判断を避けるため）。
    * タスク完了後時点でも`main.js`側は未修正（タスク6待ち）のため、`index.html`をブラウザで開くと引き続きタスク2で確認済みの`TypeError`（`controlPanel`が`null`）でスクリプトが停止する状態であり、`WindowManager`によるドラッグ・最前面化・イベント遮断は本タスク単体では有効化されていない。したがって新設した`#window-shape-palette`自体の動作確認（ドラッグ・活性化切替）はタスク6完了後まで持ち越しとなる。

### タスク4: `core/ShapeFactory.js` への5大図形スタブ分岐の追加
* **作業内容**:
    * `./js/core/ShapeFactory.js`の`create(type, x1, y1, x2, y2)`内の分岐を、既存の`if`単独分岐から`switch (type)`文へ拡張した。
    * `case 'line':`は現行通り`new Line(x1, y1, x2, y2)`を返す。
    * `case 'curve':` / `case 'arc':` / `case 'rect':` / `case 'circle':`の4種は`case`をまとめて連結（フォールスルー）し、いずれも暫定的に`new Line(x1, y1, x2, y2)`を返す「安全なスタブフォールバック」とした。当該箇所には要件4で指定された文面に準拠したコメント（`// TODO(Phase未定): 専用クラス未実装のためLineへポリモーフィックにフォールバックするスタブ`）を明記した。
    * 上記5種（`line, curve, arc, rect, circle`）以外の未知の`type`は、`default:`節で既存仕様通り`Error`をthrowする挙動を維持した。
    * JSDocの`@param {string} type`の説明を5種列挙（`'line' | 'curve' | 'arc' | 'rect' | 'circle'`）に更新し、`@returns`の説明に「未実装4種も暫定的にLineインスタンスを返す」旨を追記、`@throws`の説明を「上記5種以外の未知のtype」に更新した。コード修正完了後、クラス・メソッドともJSDoc記載漏れがないことを確認済み。
    * 本タスクは`ShapeFactory.js`単体の分岐拡張のみのスコープであり、`PaletteController`（タスク5）や`main.js`の配線（タスク6）は一切実装していない。そのため、パレット5ボタン経由で本分岐（`curve`/`arc`/`rect`/`circle`）を実機で呼び出す動作確認は、タスク5・6完了後まで持ち越しとなる。

### タスク5: `js/palette/PaletteController.js` の新設
* **作業内容**:
    * `./js/palette/PaletteController.js`を新規作成し、`PaletteController`クラスを実装した（`js/palette/`フォルダ自体もこのファイルの新設に伴い新規作成）。
    * コンストラクタ`constructor(paletteRootElement, inputTracker)`で、パレット内5ボタンのDOM id（`palette-line`/`palette-curve`/`palette-arc`/`palette-rect`/`palette-circle`）と対応する図形種別type（`line`/`curve`/`arc`/`rect`/`circle`）の対応表を`static #BUTTON_DEFS`として保持し、`paletteRootElement.querySelector('#' + id)`で各ボタン要素を解決した上で`{el, type}`の配列（`#buttons`）としてインスタンスに保持する設計とした。
    * `#buttons`の各要素に対し、コンストラクタ内で`click`リスナーを登録し、クリック時に`inputTracker.setTool(type)`を呼び出すのみとした（要件6の通り、図形種別のif/switch分岐は伴わず、ボタンごとに対応する`type`文字列を渡すのみ）。
    * 公開メソッド`setActiveTool(tool)`を実装した。`tool === 'select'`の場合はルート要素（`#rootElement`）に`.disabled`クラスを付与し、それ以外の場合は除去する。パレット内5ボタンは`classList.toggle('active', type === tool)`により、`tool`と一致するボタンにのみ`.active`を付与し、他のボタンからは除去する排他制御とした。
    * `VectorModel`・図形データ・選択状態には一切関与せず、DOM操作（`click`購読、`.disabled`/`.active`クラスの付与・除去）のみに責務を限定した（`WindowManager`と同様の設計原則を踏襲）。
    * ファイル先頭にJSDocで単一責務（3行）を明記し、クラスの全プライベートフィールド・コンストラクタ・`setActiveTool`メソッドにJSDoc（責務説明、`@param`、`@private`等）を記載した。記載漏れがないことを確認済み。
    * 本タスクは`PaletteController.js`単体の新設のみのスコープであり、`main.js`側でのインポート・インスタンス化（タスク6の担当範囲）は一切行っていない。そのため、本タスク完了時点では本クラスはまだどこからも呼び出されておらず、実機での動作確認（クリックでのツール切り替え、`.disabled`/`.active`の見た目）はタスク6完了後に行うこと。

### タスク6: `js/main.js` の配線改修
* **作業内容**:
    * `import`文に`./core/WindowManager.js`の`WindowManager`と`./palette/PaletteController.js`の`PaletteController`を追加した。
    * `DOMContentLoaded`ハンドラ内、`InputTracker`インスタンス化・`renderCurrentState`/`resize`配線の直後に「4. フロートウィンドウ統治」ブロックとして`new WindowManager()`を追加した（要件5通り、戻り値は保持せずインスタンス化のみ）。`WindowManager`のコンストラクタは`document.querySelectorAll('.float-window')`でDOMを走査するため、この呼び出し位置が`DOMContentLoaded`内（＝`#window-control-panel`/`#window-shape-palette`が既にDOMに存在する時点）であることを確認済み。
    * 旧`const controlPanel = document.getElementById('control-panel')`（タスク2でIDが`window-control-panel`へ変更されたため`null`を返しスクリプト停止の原因になっていた行）を削除し、以後`controlPanel`変数への参照ごと完全撤去した。要件2の指示通り、末尾にあった`controlPanel`への`mousedown`/`click`/`mousemove`の`stopPropagation`個別バインド3行も削除した（`WindowManager`のイベント遮断機能に一元化されたため責務違反かつ不要となるため）。
    * 「6. 図形選択パレット配線」ブロックとして、`document.getElementById('window-shape-palette')`で取得した要素と既存の`inputTracker`を渡し、`const paletteController = new PaletteController(shapePaletteEl, inputTracker)`をインスタンス化した（以後`applyTool`から呼び出すため変数として保持）。パレット5ボタンへの`click`リスナー登録は要件5の指示通り`main.js`側では一切行っていない（`PaletteController`コンストラクタ内で完結）。
    * 既存の`createToolClickHandler`（ファクトリ関数）を廃止し、要件5が指す「`applyTool(tool)`等の共通関数」として`function applyTool(tool)`を新設した。内部は`inputTracker.setTool(tool)`の呼び出し、コントロールパネル`select`/`line`2ボタンの`.active`排他的トグル（`classList.toggle('active', tool === 'select'/'line')`）、末尾での`paletteController.setActiveTool(tool)`呼び出しの3処理のみに限定し、対象範囲をコントロールパネル既存2ボタンに縮小した。`toolSelectBtn`/`toolLineBtn`の`click`リスナーはそれぞれ`() => applyTool('select')`/`() => applyTool('line')`に差し替えた。
    * `applyTool(tool)`にJSDoc（責務説明・`@param {string} tool`）を記述した。コード修正完了後、JSDoc記載漏れがないことを確認済み（本タスクで新設・変更した関数は`applyTool`のみ）。
    * **実機動作確認（ブラウザ、DevTools Console経由でのDOM状態検証）**: `index.html`をブラウザで開いた時点でJSエラーが発生せず全スクリプトが最後まで実行されることを確認した（タスク2〜3で申し送られていた`controlPanel`が`null`になる`TypeError`は本タスクの参照修正により解消）。初期状態で「選択ツール」が`.active`、パレットが`.disabled`（半透明・クリック不可）であることを確認。「直線ツール」クリックで`toolLineBtn`が`.active`化、`toolSelectBtn`の`.active`が外れ、パレット本体の`.disabled`が外れて活性化し、パレット内「直線」ボタンが`.active`化されることを確認（`paletteController.setActiveTool('line')`への委譲が機能）。「選択ツール」へ戻すと逆方向（パレット`.disabled`再付与、パレット内`.active`全解除）も正しく機能することを確認。コンソールエラーは終始0件。
    * なお、実機確認の過程でブラウザプレビュー環境固有の注意点を把握した：本プロジェクトフォルダ（`D:\ozlab\ozvectoreditor`）はブラウザプレビューツールの管理対象プロジェクト外にあるため、`file://`直接オープンが「静的スナップショット」的な描画になる場合があり、スクリーンショット上にCanvas由来ではない线（線）が現れることがあった。Canvas要素への`mousedown`/`mouseup`/`click`/`mousemove`イベントを直接ログ計測したところ、当該線が現れた際もCanvasへのイベント発火は0件であり、`InputTracker`側のロジック（Canvas要素に直接`addEventListener`する設計、`js/core/InputTracker.js:70-73`）に起因する実バグではなく、プレビューツール側の描画アーティファクトであると判断した。ボタンクリックの実際のターゲット要素・DOM状態（`.active`/`.disabled`のクラス付与）はJS経由で直接検証し、いずれも設計通りであることを確認済み。

### タスク7: `PROJECT_ARCHITECTURE.md` の更新
* **作業内容**:
    * 1章「プロジェクトフォルダ構造」の`core/`配下リストに`WindowManager.js`を、`palette/`配下リストに`PaletteController.js`を追記した。
    * 4章「各モジュールの責務リファレンス」の`ShapeFactory.js`の説明を更新し、受理する`type`が`'line' | 'curve' | 'arc' | 'rect' | 'circle'`の5種へ拡張されたこと、`curve`/`arc`/`rect`/`circle`の4種が専用クラス未実装のため暫定的に`Line`スタブへフォールバックする実装であること、将来専用クラスを実装する際は該当`case`を個別に差し替える設計であることを追記した。
    * 4章に新規項目`WindowManager.js`を追加し、`.float-window`の動的検知、ドラッグ移動・最前面化・イベント遮断の一元管理を担うこと、動的追加ウィンドウの再検知は未対応であること、`VectorModel`が持つ図形データ・選択状態・ツール状態には一切関与しないDOM統治専任クラスであることを明記した（掲載位置は`ShapeFactory.js`の直後、`shapes/`の直前とした）。
    * 4章の`palette/`の説明に新規項目`PaletteController.js`を追加し、パレット5ボタンの`click`配線・`inputTracker.setTool(type)`呼び出し、公開メソッド`setActiveTool(tool)`による`.disabled`制御と5ボタンの`.active`排他制御、`VectorModel`・図形データ・選択状態には関与しないDOM専任クラスであることを追記した。
    * 本タスクはドキュメント更新のみのスコープであり、ソースコード（`.js`/`.html`）は一切変更していない。

## 5. 懸念事項・要確認ポイント
* ドラッグ位置計算方式について: DIRのマークアップ例は初期配置に`top`/`right`を用いているが、本計画ではドラッグ開始時に`style.right`を`'auto'`へ切り替え`left`/`top`基準へ移行する設計とした（dx/dy追従を安定させるための実装判断）。見た目上の影響はないはずだが、実装後に両ウィンドウのドラッグ挙動を目視確認すること。
* **タスク1実装結果（top/right→left/top切替方式について）**: 計画通り、`#startDrag`内で`getBoundingClientRect()`により現在の描画位置（left/top換算値）を取得したうえで`windowEl.style.right = 'auto'`をセットし、続けて`style.left`/`style.top`に同じ座標を明示的に書き込むことで基準を切り替えた。以後は`window`レベルの`mousemove`でドラッグ開始時点のマウス座標との差分(dx, dy)を、この開始時点のleft/top値に加算する方式（開始点固定＋差分加算方式。前回mousemove位置を都度更新する方式ではない）とした。`position: fixed`のままrightをautoにしてleft/topを明示するため理論上は瞬間的な位置ジャンプは発生しないはずだが、**この切替の瞬間に見た目上のガタつき（1フレームのズレ）が起きないかは、タスク2でコントロールパネルが実際に`.float-window`化されて`.window-header`を持つまでは実機確認ができていない**。タスク2完了後、コントロールパネルをドラッグして「掴んだ瞬間に位置が飛ばないか」を必ず目視確認すること。
* **目視確認を推奨する箇所**: (1) ドラッグ開始の瞬間（top/right→left/top切替時）に要素が動かないか。(2) マウスをウィンドウ外・ブラウザウィンドウ外まで高速に振り切ってからボタンを離した際、ドラッグが正しく終了し以後の`mousemove`で要素が動き続けないか（`#draggingWindow`のnullリセットがmouseupで確実に効いているかの確認）。(3) 複数の`.float-window`が存在する状態（タスク3以降）で、片方をクリックした際にもう片方が最前面化されず、z-indexの排他制御が意図通り機能しているか。
* **将来この箇所を修正する際の注意点**: `#handleWindowMouseMove`/`#handleWindowMouseUp`は`window`に対して`WindowManager`インスタンス生成時に1本だけ登録される設計であり、`.float-window`が何個増えてもこの2本のリスナーだけで全ウィンドウのドラッグを賄う（ウィンドウごとに`mousemove`/`mouseup`を追加登録しない）。将来複数ウィンドウの同時ドラッグ（マルチタッチ等）に対応する場合は、単一の`#draggingWindow`フィールドという設計そのものを見直す必要がある。また、動的に追加される`.float-window`は本タスクの`querySelectorAll`による初回検知の対象外のため、将来ウィンドウを動的生成する機能を追加する場合は`WindowManager`側に再検知用の公開メソッド（例: `registerWindow(el)`）を追加する対応が必要になる。
* 図形選択パレットの初期配置座標（`top:320px; right:16px;`仮値）は、コントロールパネルの実際の高さに応じて重なりが生じないか実装後に目視確認し、必要なら微調整すること。
* コントロールパネル側の`applyTool(tool)`（縮小版）は、パレット由来の新規図形（curve/arc/rect/circle）選択時にコントロールパネルの`select`/`line`どちらの`.active`も非表示にする設計としたが、この見た目がREQ/DIRの意図と合致するか実装後に確認すること（DIR/REQに明記がないための実装側判断）。また`PaletteController.setActiveTool(tool)`は`tool`がパレット外由来（`select`/`line`）の場合、パレット内5ボタンをすべて非アクティブ表示とする設計であることも合わせて目視確認すること。
* `WindowManager`はコンストラクタ実行時点でDOMに存在する`.float-window`のみを検知する設計（動的追加の再検知は非対応）。本Phase範囲では問題ないが、将来ウィンドウを動的生成するPhaseが来た際は`WindowManager`側に再検知APIの追加が必要になる点を申し送る。

* **タスク2実装結果（要目視確認）**:
    * `#window-control-panel`のCSS配置（`top:16px; right:16px; width:220px;`）と、`.window-header`/`.window-title`/`.window-close-btn`/`.window-body`の見た目（背景色・境界線・パディング・ボタン配色等）は、旧`#control-panel`一式の見た目をほぼそのまま踏襲する設計とした（唯一の意図的な見た目変更は、旧`top:0; right:0;`（画面端に密着）から`top:16px; right:16px;`（16pxの余白）への移動）。実装上は崩れる要素がないと判断しているが、ブラウザでの実機の見た目確認（特に`.window-close-btn`の×ボタンのサイズ・位置バランス、`.window-header`のタイトルとの横並び）は未実施のため、次タスク以降の適当なタイミングで一度目視確認を推奨する。
    * **タスク1で申し送られた「ドラッグを掴んだ瞬間に位置が飛ばないか」の確認について**: 本タスク完了時点で実機確認を試みたが、`js/main.js`が`document.getElementById('control-panel')`（旧ID）を参照したまま残っているため（要件2よりタスク6の担当範囲と明記されており、本タスクでは意図的に未修正）、`index.html`をブラウザで開くと`controlPanel`が`null`となり、`main.js:77`の`controlPanel.addEventListener(...)`で`TypeError: Cannot read properties of null (reading 'addEventListener')`が発生してスクリプトが停止することを確認した（ブラウザConsoleで実証済み）。また`WindowManager`自体も`main.js`内でまだ一度もインポート・インスタンス化されていない（タスク6の担当）ため、そもそも`window-header`へのドラッグ配線が有効になっていない。
    * 従って、「掴んだ瞬間に位置が飛ばないか」の目視確認は、本タスク（タスク2）完了時点ではまだ実行不可能であり、`main.js`側で（a）`getElementById`の参照先を`window-control-panel`に修正し、（b）`WindowManager`をインポート・インスタンス化するタスク6の完了を待って初めて実施できる。この確認は本RESの完了条件から外さず、**タスク6完了後に必ず実施する項目として引き続き申し送る**。

* **タスク3実装結果（要目視確認）**:
    * **初期配置座標の重なり有無について**: `#window-shape-palette`の`top:320px;`は、コントロールパネル（`top:16px;`起点、`.window-header`のpadding・font-size、`.window-body`のボタン2個分の高さから概算）が収まるであろう高さを見込んだ仮値である。厳密なpx計算ではなく目分量のため、実際にブラウザで両ウィンドウを並べた際に上下の間隔が狭すぎる／広すぎる可能性がある。タスク6完了後、両ウィンドウが実際にドラッグ・活性化可能になった時点で重なりの有無と間隔の見た目を必ず目視確認し、必要なら`top`値を調整すること。
    * **ボタンラベルの見た目について**: パレット5ボタンのラベル（`／ 直線`/`〜 曲線`/`◠ 弧`/`▭ 矩形`/`◯ 円`）は、コントロールパネルの`／ 直線ツール`表記に合わせて記号（Unicode文字）＋図形名の形式を踏襲したが、記号のフォントによる見た目（特に`◠`（弧）が意図した弧のような見た目でレンダリングされるか）はOS・ブラウザ依存で崩れる可能性がある。目視確認のうえ、崩れる場合は記号の変更または省略を検討すること。
    * **`.disabled`クラスの設計判断について**: 要件3では「クリック不可にする」とだけ求められていたが、`opacity`と`pointer-events`をどの要素（`.float-window`本体か、あるいは`.window-body`のみか）に適用するかの明記はなかったため、本タスクでは`.float-window`本体（ルート要素、`#window-shape-palette`）に`.disabled`を付与し、ヘッダーごと薄く表示する設計とした。この結果、`select`モード中は`.window-header`（タイトル・×ボタン）も含めてクリック不可・半透明になる。ヘッダーのドラッグ機能自体は非活性化する設計意図か（＝非活性中はウィンドウ移動もさせない）については要件に明記がなく本タスクの実装判断であるため、タスク6実装時または実機確認時に、この挙動（非活性中にドラッグで動かせないこと）がREQ/DIRの意図と合致するか確認することを推奨する。
    * `.disabled`クラスはIDセレクタに紐付けない汎用クラスとして定義したため、将来他の`.float-window`（プロパティウィンドウ、レイヤーウィンドウ等）でもそのまま流用できる。この点は設計として意図通りだが、将来同じ`.disabled`の意味（不透明度0.4、pointer-events:none）が全ウィンドウ共通で適切かは、ウィンドウの種類が増えた時点で改めて検討が必要になる可能性がある点を申し送る。

* **タスク5実装結果（判断に迷った点・要確認ポイント）**:
    * **`tool`が5種いずれとも一致しない場合の全ボタン非アクティブ表示について**: 要件6に明記されていた挙動（`tool`が`select`/`line`等パレット外由来の値であっても、一致するボタンがあればそのボタンに`.active`が付き、一致しない場合は全ボタン非アクティブ）をそのまま実装した。`classList.toggle('active', type === tool)`を5ボタン全件に対して無条件に実行する設計のため、`tool`の値によって分岐を書く必要がなく実装は単純だったが、判断に迷った点として「`select`ツール時にパレット自体が`.disabled`（pointer-events:none）で操作不可になる一方、内部の5ボタンの`.active`状態はCSS上見えなくなるだけで実際には全て非アクティブのまま保持される」という二重の非活性表現（`.disabled`による見た目の無効化と、ボタン単位の`.active`排除）が要件6の記述からは意図的な冗長設計か単なる自然な帰結かの明記がなかった。本実装では要件6の文言通り両方を独立に評価する設計（`.disabled`の判定と`.active`の判定を別々の条件式で行う）とし、`select`時はどのみち`.disabled`で操作不可になるため実害はないと判断したが、将来この2つの状態管理を1つに統合すべきか（例:`.disabled`中はボタンの`.active`計算自体をスキップする等）は設計判断の余地がある点として申し送る。
    * **目視確認を推奨する箇所**: 本タスク単体では`PaletteController`がまだ`main.js`から一度もインスタンス化されていないため、実機確認は一切できていない。タスク6完了後、(1) パレット5ボタンをクリックした際に対応するボタンにのみ`.active`（既存`.tool-btn.active`のCSS、コントロールパネルの`select`/`line`ボタンと同一の見た目）が付与されるか、(2) コントロールパネル側で`select`/`line`を選び直した際にパレット5ボタンの`.active`が全て外れ、かつパレット本体が`.disabled`表示（`select`選択時のみ）に戻るか、(3) パレット非活性中（`.disabled`付与中）に5ボタンをクリックしても`pointer-events: none`によりクリックイベント自体が発火せず`setTool`が呼ばれないこと、の3点を必ず目視確認すること。
    * **将来この箇所を修正する際に注意すべき点**: `#buttons`は`paletteRootElement.querySelector('#' + id)`による解決結果を`filter(({ el }) => el !== null)`で除外可能な設計とした（`index.html`側でボタンidが変更・削除された場合にエラーで停止せず、単に対応ボタンが配線対象から静かに除外される）。これは意図的な防御的実装だが、要件6や本RESに明記のない範囲の実装判断であるため、将来ボタンidの命名規則を変更する際は`static #BUTTON_DEFS`の対応表も同時に更新する必要がある点、および「該当ボタンが見つからない」ケースがエラーとして表面化しない仕様である点に注意すること。

* **タスク4実装結果（要確認）**:
    * `curve`/`arc`/`rect`/`circle`の4`case`は要件4の指示通り「いずれも暫定的にLineスタブへフォールバック」させるため、4つの`case`ラベルを連続で並べて処理本体（`return new Line(...)`＋TODOコメント）を1箇所に共有させるフォールスルー構文を採用した。将来これら4種の専用クラス（`Curve`/`Arc`/`Rect`/`Circle`等）を実装する際は、この`switch`文の各`case`を個別の`return new XXX(...)`に差し替えるだけで済むよう分岐の粒度は`case`単位のまま維持しており、統合しすぎていない点に注意（誤って4種の専用クラスをまとめて1つの`case`グループに実装しないこと）。
    * 現状の`Line`スタブフォールバックは、`curve`/`arc`/`rect`/`circle`いずれも受け取った`(x1, y1, x2, y2)`の4引数のみをそのまま`Line`コンストラクタへ渡す設計である。将来`rect`（矩形）や`circle`（円）等、直線とはコンストラクタの引数の意味・個数が異なりうる専用クラスを実装する際は、`ShapeFactory.create`の呼び出し元（`InputTracker`等、作図確定処理を担うモジュール）側の引数の渡し方も合わせて見直す必要がある点に注意。本タスクでは呼び出し元の改修は範囲外のため一切変更していない。
    * 本タスクは`ShapeFactory.js`の分岐拡張のみで完結する軽微な変更のため、目視確認を要する見た目上の懸念事項はない。ただし上記の通り、パレット5ボタン経由で実際に`curve`/`arc`/`rect`/`circle`が選択され作図された際に、意図通りLine形状（フォールバック挙動）で描画されることの実機確認は、タスク5・6完了後に行うこと。

* **タスク6実装結果（判断に迷った点・要確認ポイント）**:
    * **初期`.disabled`状態とJS側状態の整合について**: `index.html`側（タスク3）で`#window-shape-palette`に初期HTMLクラスとして`float-window disabled`が付与済みであり、`InputTracker`の初期`currentTool`も`'select'`（`js/core/InputTracker.js:39`）であるため、両者は初期状態で矛盾なく整合している。要件5の記述通り、`main.js`側では`DOMContentLoaded`直後に`paletteController.setActiveTool(...)`を明示的に呼び出す初期化処理を**あえて追加していない**（HTML初期クラスをそのまま尊重する設計のため）。ただし、これは「初期ツールが将来`'select'`以外に変更された場合でも、`index.html`側の初期`.disabled`クラスを手動で同期させる必要がある」という暗黙の結合を意味する。将来`InputTracker`の初期`currentTool`を変更する際は、`index.html`の`#window-shape-palette`の初期クラスも忘れずに追随させること（あるいは`main.js`側で`paletteController.setActiveTool(inputTracker.currentTool)`を明示的に一度呼ぶ設計へ変更することを検討する余地がある）。
    * **パレット5ボタンを直接クリックした場合に`.active`表示が更新されない挙動について（要確認・要将来対応）**: 実機確認の過程で、パレット内5ボタン（`palette-line`等）を直接クリックした場合、`PaletteController`のコンストラクタ内click配線（タスク5で実装済み、`js/palette/PaletteController.js:53-55`）は`inputTracker.setTool(type)`を呼び出すのみで、`this.setActiveTool(type)`を自ら呼び出さない設計になっていることを確認した。一方`main.js`側の`applyTool(tool)`は要件5の指示通りコントロールパネルの`select`/`line`2ボタンのみを対象範囲としており、パレット5ボタンのクリックとは独立している。結果として、パレット内の「円」等をクリックすると`InputTracker`内部のツールは正しく`'circle'`等へ切り替わるにもかかわらず、パレット自身の`.active`表示（どのボタンがアクティブか）およびコントロールパネル側の`select`/`line`ボタンの`.active`表示のどちらも更新されないままになる（コンソールでDOM状態を直接検証し確認済み：`document.getElementById('palette-circle').click()`実行後も`circleActive`は`false`のまま、`tool-line`の`.active`も外れず残留する）。これは要件5・要件6のいずれにも「パレットボタン自身のクリックが`setActiveTool`を呼び出す」という記述がなく、本タスクの指示範囲（「コントロールパネル既存2ボタンのみを対象とする」）を厳密に守った結果として生じる、REQ/RES設計上の仕様間ギャップである。本タスクの指示範囲外の挙動改修（`PaletteController`側の修正、または`main.js`側でパレットボタンにも折り返しの`setActiveTool`呼び出しを追加する等）は独断で行わず、次タスク（タスク7）着手前にユーザーへ確認し、必要であれば別タスクとして起票することを推奨する。
    * **目視確認を推奨する箇所**: (1) コントロールパネルの「選択ツール」⇔「直線ツール」切り替え時、パレット本体の活性/非活性（半透明化・クリック可否）が正しく連動するか。(2) 上記の通りパレット5ボタンを直接クリックした際、`.active`表示が更新されない見た目（クリックしても押した図形ボタンがハイライトされない）が実際に発生することを目視でも確認し、ユーザーの意図した挙動と合致するか判断すること。(3) `WindowManager`統合後、コントロールパネル・パレット双方のドラッグ移動・最前面化・イベント遮断が実機で機能するか（本タスクでは`file://`直接オープン時のブラウザプレビュー環境の制約により、ドラッグ操作自体の目視確認は本タスクの自動検証では実施できていない。別途通常のブラウザで`index.html`を開いての確認を推奨する）。
    * **将来この箇所を修正する際に注意すべき点**: `applyTool(tool)`は意図的に「コントロールパネル2ボタン専用」に縮小されており、汎用的な「全ツール切り替え共通関数」ではない。将来パレット側にも`.active`同期を持たせる場合、`applyTool`をそのままパレットボタンにも使い回すと`toolSelectBtn`/`toolLineBtn`の`.active`を毎回強制的に更新してしまい、パレット由来のツール（`curve`/`arc`/`rect`/`circle`）選択時にもコントロールパネル側の見た目に干渉する。安易に`applyTool`を共有せず、「ツール切り替え時の状態同期」を`main.js`外（例:`InputTracker`が現在ツールの変更を通知するコールバック機構を持ち、`main.js`はそれを購読して両UIへ同期する設計）へ引き上げることを検討するのが望ましい。

---

### Interrupt: Phase01-04 テストプレイで発見されたフロートウィンドウ関連3件の不具合修正
* 参照元REQ: `./_log/req/20260809_1633_REQ_Interrupt_Phase01-04_DragAndPaletteSyncFix.md`

#### 追加作業目的:
* Phase01-04完了後のテストプレイで発見された3件の不具合（フロートウィンドウのドラッグ不具合／パレットのアクティブ表示同期／テキスト選択防止）を、REQの指示通り即時実行アプローチで修正する。3件は互いに独立しており、まとめて実装した。

#### 対象ファイル
* `./js/core/WindowManager.js` : 更新（不具合1）
* `./js/palette/PaletteController.js` : 更新（不具合2）
* `./js/main.js` : 更新（不具合2に付随）
* `./index.html` : 更新（不具合3）
* `./PROJECT_ARCHITECTURE.md` : 更新（不具合2に伴うPaletteController.jsの責務説明の変更）

#### 対応:(作業概要)

**不具合1：フロートウィンドウのドラッグが機能しない（最重要）**
* **原因・理由**: `WindowManager.js`の`#setupWindow(windowEl)`が各`.float-window`要素自身に対して`mousemove`/`mouseup`のバブルフェーズ通常リスナーで`stopPropagation()`を実行する一方、ドラッグ追従を担う`#handleWindowMouseMove`/`#handleWindowMouseUp`も`window`に対してバブルフェーズ通常リスナーとして登録されていた。マウスがウィンドウ内側にある間は`mousemove`/`mouseup`がウィンドウ要素の時点で遮断され`window`まで届かず、マウスがウィンドウ外に出て初めてドラッグ追従リスナーが発火する状態になっていた。これが「マウスに追従しない／ウィンドウ外に出た瞬間にワープする／ウィンドウ上で離しても終わらない」という報告挙動の原因である。
* **対応**: `js/core/WindowManager.js`のコンストラクタ内、`window.addEventListener('mousemove', ...)`および`window.addEventListener('mouseup', ...)`の2箇所に、第3引数`true`（キャプチャフェーズ登録）を追加した。キャプチャフェーズは対象要素に到達する前に発火するため、バブルフェーズの`stopPropagation()`の影響を受けなくなる。`#setupWindow`側の`stopPropagation`実装・`#startDrag`のドラッグ開始ロジックは指示通り無改変。既存JSDocの記述内容と齟齬がないため、JSDocは変更していない。

**不具合2：図形選択パレットの5ボタンをクリックしても、アクティブ表示（`.active`）が更新されない**
* **原因・理由**: `PaletteController.js`のコンストラクタがパレット5ボタンの`click`時に`this.#inputTracker.setTool(type)`を直接呼び出す設計になっており、`.active`表示や`.disabled`制御を一元的に担う`main.js`の`applyTool(tool)`（および`paletteController.setActiveTool`）を一切経由していなかった。そのため実際のツール切り替えは行われるが、表示更新（パレット自身の`.active`・コントロールパネル側`.active`）が反映されなかった。
* **対応**:
    * `js/palette/PaletteController.js`: コンストラクタ引数を`inputTracker`直接依存から汎用コールバック`onToolSelected(type)`を受け取る設計へ変更した。privateフィールド`#inputTracker`を廃止し`#onToolSelected`を新設。5ボタンのclickリスナー内の呼び出しを`this.#onToolSelected(type)`へ置き換えた。ファイル先頭JSDoc・`#onToolSelected`フィールドJSDoc・コンストラクタJSDoc（`@param`）を、コールバック仕様に合わせて更新した。
    * `js/main.js`: `new PaletteController(shapePaletteEl, inputTracker)`を`new PaletteController(shapePaletteEl, applyTool)`に変更した（`applyTool`は関数宣言のホイスティングにより、テキスト上の定義位置がインスタンス化より後でも参照可能）。これにより、コントロールパネルの2ボタン・パレットの5ボタンのいずれを押した場合も、必ず`applyTool(tool)`を経由して「`inputTracker.setTool(tool)`」「コントロールパネル`select`/`line`の`.active`排他制御」「`paletteController.setActiveTool(tool)`によるパレット側表示更新」の3処理が一貫して実行されるようになった。`applyTool(tool)`のJSDocも、コントロールパネル2ボタンに加えパレット5ボタンからも呼び出される共通関数であることが分かるよう更新した。
    * `PROJECT_ARCHITECTURE.md`: 4章の`PaletteController.js`の説明を、`inputTracker`への直接依存ではなく汎用コールバック`onToolSelected(type)`（`main.js`の`applyTool`）を受け取る設計である旨に更新した。
    * 実機確認（ローカルHTTPサーバー経由でのブラウザ実行）: パレット内「弧」「円」ボタンをクリックした際、押したボタンにのみ`.active`が付与され、他ボタン・コントロールパネル`select`/`line`の`.active`は正しく排他的に外れることを確認。コントロールパネル「選択ツール」に戻すとパレットが再び`.disabled`化され、パレット内`.active`が全て解除されることも確認した。

**不具合3（軽微）：Ctrl+Aやダブルクリックでウィンドウ内のテキストが選択状態になる**
* **原因・理由**: `.float-window`のCSSルールに`user-select: none;`が定義されておらず、ブラウザ標準のテキスト選択（ドラッグ選択・ダブルクリック選択・Ctrl+A全選択）の対象になっていた。
* **対応**: `index.html`の`<style>`内、`.float-window`のCSSルールに`user-select: none;`を追加した。`.float-window`全体に適用することで、ヘッダー・ボディ内のボタン等すべてが対象になる。実機確認で、ウィンドウタイトルへのトリプルクリック後に`window.getSelection().toString()`が空文字になることを確認した。

**動作確認について（補足）**: 本プロジェクトフォルダ（`D:\ozlab\ozvectoreditor`）はブラウザプレビューツールの管理対象プロジェクト外にあり、`file://`直接オープンでは「静的スナップショット」的な描画になりJSの状態変化が正しく反映されないことを確認した（タスク6の懸念事項で申し送られていた制約と同じ事象）。そのため今回はPythonの`http.server`でプロジェクトルートを一時的にローカル配信（`http://localhost:8743/`）し、実際のブラウザ実行としてドラッグ・パレット同期・テキスト選択防止の3件すべてを実機確認した（確認後、当該サーバーは停止済み）。
