# RES: 作業計画・作業レポート (Phase 01-06) : 矩形（Rect.js）の実装および図形パレット・ツール切替のハードコード排除
* 参照元REQ: `./_log/req/2609_1918_REQ_Phase01-06_Rect_And_PaletteRefinement.md`

## 1. 作業目的
図形ポリモーフィズム実証の第二弾として、4頂点構造を持つ「矩形（`Rect`）」を`Line`/`Curve`と完全に同一の9メソッド契約で実装し、`core/`層（`VectorModel`/`CanvasManager`/`InputTracker`）を1行も変更せずに既存の作成・選択・再編集フローへ統合する。同時に、`main.js`のツールボタン切替ロジックに残る「ボタンA/ボタンB」式のハードコードされた相互排他処理を、データ駆動の汎用トグルループへリファクタリングし、将来ツール（pan/zoom等）が増設されても`main.js`の当該ループを書き換える必要がない開閉原則（O-C原則）を成立させる。

## 2. アーキテクチャ設計

### 要件1: `js/shapes/Rect.js` の新規実装
* **データ構造**: `this.points = [{x,y}, {x,y}, {x,y}, {x,y}]`（長さ4固定、`points[0]`=topLeft／`points[1]`=topRight／`points[2]`=bottomRight／`points[3]`=bottomLeft）。コンストラクタ`(x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 2)`は、`Line`/`Curve`と同じ引数構成（対角2点＋スタイル省略可能引数）を踏襲し、対角線をなす`(x1,y1)`と`(x2,y2)`から直接4点を算出する（`points[0]=(x1,y1)`, `points[1]=(x2,y1)`, `points[2]=(x2,y2)`, `points[3]=(x1,y2)`）。`x1>x2`や`y1>y2`であっても正規化（min/max入れ替え）は行わない。理由：DIRのNon-goalsに「矩形維持ロジックを持ち込まない」旨が明記されており、`updateDraftEnd`側でも同一の非正規化ロジック（`P0`固定＋カーソル追従）を採用するため、コンストラクタ側だけ正規化すると初期化直後と作図中とで挙動に一貫性がなくなる。
* **作図プレビュー追従 (`updateDraftEnd(x, y)`)**: `points[0]`（1回目クリック地点）は固定したまま、`points[2] = {x, y}`（カーソル座標）、`points[1] = {x, y: points[0].y}`、`points[3] = {x: points[0].x, y}`を毎フレーム再計算する。
* **描画 (`draw(ctx, t = 0)`)**: `points[0]→[1]→[2]→[3]`の順に`lineTo`し`closePath()`で閉じてから`stroke()`する。第2引数`t`は`Curve.draw`とのシグネチャ統一のためだけに存在し、本Phaseでは未使用（JSDocにその旨を明記する）。
* **ハンドル描画 (`drawHandles(ctx)`)**: `Line`/`Curve`の`drawHandles`と同一の配色（白塗り`#ffffff`／青枠`#4a90e2`、`lineWidth 1.5`）・サイズ（一辺8px）の正方形を4頂点すべてに描画する。
* **当たり判定 (`hitTest(x, y, tolerance)`)**: `Line.hitTest`が使う「点と線分の最短距離」計算式を、Rect内部のprivateヘルパーメソッド（例: `#distanceToSegment(px, py, ax, ay, bx, by)`）として1箇所に切り出し、4辺（`[0,1]`, `[1,2]`, `[2,3]`, `[3,0]`）についてループで呼び出し、いずれか1辺でも`tolerance`以内なら`true`を返す。このヘルパーは9メソッド契約には含まれないRect内部専用の実装詳細である。
* **ハンドル判定 (`hitTestHandle(x, y, tolerance)`)**: `points[0]`(topLeft)→`points[1]`(topRight)→`points[2]`(bottomRight)→`points[3]`(bottomLeft)の順に距離判定し、対応する識別子文字列（`'topLeft'|'topRight'|'bottomRight'|'bottomLeft'`）または`null`を返す。
* **頂点更新・移動**: `setVertex(vertexIndex, x, y)`は`vertexIndex`が0〜3の範囲であれば`points[vertexIndex] = {x, y}`を直接上書きする（矩形維持のための連動再計算は一切行わない＝4頂点は完全に独立して自由に動く）。`translate(dx, dy)`は`points`全要素に`dx,dy`を加算する。
* **ハンドル名→vertexIndex解決 (`getVertexIndexForHandle(handleName)`)**: `{topLeft:0, topRight:1, bottomRight:2, bottomLeft:3}`のルックアップテーブルで解決し、非該当は`null`。
* **ホバー描画 (`drawHover(ctx)`)**: `draw`と同じ4頂点パス（`closePath`含む）に対し、`Line`/`Curve`と同一仕様（`rgba(74, 144, 226, 0.4)`、`lineWidth = strokeWidth + 6`）の半透明太線を重ねる。
* **共通API契約**: `draw / drawHandles / hitTest / hitTestHandle / setVertex / translate / drawHover / updateDraftEnd / getVertexIndexForHandle`の9メソッドを`Line`/`Curve`と同名・同シグネチャで自律実装する。ファイル先頭には3行以内のJSDocで単一責務（矩形のデータ保持・描画・当たり判定）を明記する。

### 要件2: `main.js` のツール切替・アクティブトグルシステムの汎用化
* **現状分析**: 現行の`applyTool(tool)`は、`toolSelectBtn`/`toolLineBtn`という2つのDOM要素個別に対する`classList.toggle(..., tool === '...')`のハードコードされた2行と、末尾の`paletteController.setActiveTool(tool)`呼び出しから成る。イベント登録側も`toolSelectBtn.addEventListener(...)`/`toolLineBtn.addEventListener(...)`の個別2行。
* **リファクタリング方針**: `main.js`内に、コントロールパネルが所有するツールボタン（現状`select`/`line`の2つ、将来増設されうる）をツール名文字列でマッピングする汎用オブジェクト`toolButtons`（例: `{ select: toolSelectBtn, line: toolLineBtn }`）を新設する。
    * `applyTool(tool)`内の個別`classList.toggle`2行を撤去し、`Object.entries(toolButtons).forEach(([key, btn]) => btn.classList.toggle('active', key === tool))`という汎用ループに置換する。
    * ボタンへのクリックリスナー登録も、末尾の個別`addEventListener`2行を撤去し、`Object.entries(toolButtons).forEach(([tool, btn]) => btn.addEventListener('click', () => applyTool(tool)))`という同一の`toolButtons`を走査する汎用ループに置換する。
    * これにより、コントロールパネルに新規ツールボタンが増設された場合、`toolButtons`オブジェクトへのエントリ追加のみで対応でき、`applyTool`本体やイベント登録ループの書き換えは一切不要になる（開閉原則の成立）。
* **PaletteController（`./js/palette/PaletteController.js`）との責務分担の整理方針（変更対象外・現状維持で結論）**:
    * DIRの改修モジュール一覧（4章）およびREQのスコープ厳守事項では、本Phaseで変更してよいファイルは`js/shapes/Rect.js`（新規）・`js/core/ShapeFactory.js`・`js/main.js`の3点に限定されており、`PaletteController.js`は改修対象外である。
    * `PaletteController.setActiveTool(tool)`は、既に静的定義配列`#BUTTON_DEFS`をループする形でパレット内5ボタンの`.active`制御を行っており（個別ボタンごとのif/elseハードコードではない）、この時点で既にデータ駆動・汎用化された実装になっている。加えてパレット本体の`.disabled`制御という、`main.js`側には持たせられない責務（パレットDOMの内部構造を`main.js`から直接触らせないための情報隠蔽）も担っている。
    * したがって、本Phaseで新設する`main.js`側の`toolButtons`汎用ループは、**`main.js`が直接ownしているコントロールパネルのボタン（`tool-select`/`tool-line`）のみ**を走査対象とし、パレット内5ボタン（`palette-line`等）のDOM要素には一切触れない。パレット側の`.active`制御は、既存どおり`applyTool`末尾の`paletteController.setActiveTool(tool)`という単一の呼び出しに完全委譲し続ける。
    * この分担により、「同一DOM要素に対して`main.js`の汎用ループと`PaletteController`の内部ループの両方が`.active`を付け外しする」という二重管理は発生しない。`main.js`側ループ＝コントロールパネル領域の単独管理者、`PaletteController`＝パレット領域の単独管理者、という领域分担が明確に保たれる。
* **持ち越し事項A（コントロールパネル「直線」とパレット「直線」の同期）の扱い**: 両ボタンは共に、`applyTool(tool)`に渡される単一の`tool`引数のみを比較基準として独立に`.active`を決定している（コントロールパネル側は新設`toolButtons`ループ、パレット側は`PaletteController`の既存ループ）ため、両者は常に同一の`tool`値に基づき同時に一致した状態へ収束する。今回のリファクタリングでハードコードされた個別`if`分岐が消えることで、将来の可読性・拡張性の観点からも見た目の同期崩れが起こり得ない設計となる。

### 要件3: `js/core/ShapeFactory.js` の rect 分岐配線接続
* `import { Rect } from '../shapes/Rect.js';`を追加する。
* `switch`文の`'rect'`を`'arc'`/`'circle'`の暫定`Line`フォールバックから分離し、単独の`case 'rect': return new Rect(x1, y1, x2, y2);`とする。
* `'arc'`/`'circle'`の2つは既存の`Line`フォールバックのまま変更しない。
* JSDocの`@returns`型注釈を`{Line|Curve}`から`{Line|Curve|Rect}`へ更新し、コメント文言から「rect」を「未実装3種」の説明から除外する。

### 関連フォルダと論理クラス
* **対象フォルダ**: `./js/shapes/`（矩形ドメイン・新規追加）、`./js/core/`（`ShapeFactory`改修）、`./js/`直下（`main.js`改修）
* **関連する論理クラス**: `Rect`（新規具象図形）、`ShapeFactory`（生成一元管理・改修）、`main.js`内`applyTool`（ツール切替一元管理関数・改修）
* **変更対象外（参照のみ）**: `PaletteController`（既存の`#BUTTON_DEFS`ループ構造をそのまま活用する前提で参照するのみ、コード変更なし）
* **参照する責務**（`PROJECT_ARCHITECTURE.md`より抜粋）:
    * `ShapeFactory.js`: 「図形typeに応じたインスタンス生成を一元的に担うFactory...`core/`層全体を通じて図形種別のif/switch分岐を許容する唯一の例外モジュールである。」
    * `Line.js`: 「今後追加する図形（曲線・円・楕円等）も、この8メソッド（9メソッド）を自身に実装することで`core/`側（VectorModel/CanvasManager/InputTracker）を変更せずに同一の作成・選択・再編集フローへ組み込める。」
    * `PaletteController.js`: 「`WindowManager`と同様、`VectorModel`・図形データ・選択状態には一切関与しないDOM操作専任のクラスである。」

### 開発資料（PROJECT_ARCHITECTURE.md）の更新予定
実装完了後、以下3点の更新が必須と想定する（詳細はタスク5で確定させる）。
* 「4. 各モジュールの責務リファレンス」の`shapes/`項に、`Rect.js`（作成済み）のエントリを`Curve.js`と同様の粒度（データ構造・9メソッド概要・共通API契約への言及）で追記する。
* `ShapeFactory.js`のエントリ記述を更新し、「`arc`/`rect`/`circle`の3種は専用クラス未実装のため...暫定的にLineを返す」という現行文言を「`arc`/`circle`の2種は...」へ修正し、`rect`が`Rect`クラスへ本実装接続済みである旨を追記する。
* `main.js`はセクション1のフォルダ構造表にのみ登場し、専用の責務リファレンス項目を持たないため、ツール切替の汎用トグル化について新規項目追記が必要か、あるいは影響軽微として見送るかをタスク4実行時に判断する。

--------------------------------------------------------------------------------

## 3. タスクリスト
*   [x] タスク1（DIRステップ1）: `shapes/Rect.js`の物理新設（スケルトン＆スタブ配線）
    *   **対象ファイル** :
        *   `./js/shapes/Rect.js` : 新規
        *   `./js/core/ShapeFactory.js` : 更新（`rect`分岐の接続のみ、このタスクの時点でスタブ実装のRectに繋ぐ）
    *   **作業内容** :
        *   `Rect`クラスを新規作成し、ファイル先頭に3行以内のJSDocで単一責務を明記する。
        *   コンストラクタ`(x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 2)`で`points`配列（長さ4、topLeft/topRight/bottomRight/bottomLeft）を初期化する（本タスクの時点で本実装可）。
        *   `draw/drawHandles/hitTest/hitTestHandle/setVertex/translate/drawHover/updateDraftEnd/getVertexIndexForHandle`の9メソッドを、JSDoc完備のスタブ（最低限の空実装または仮実装）として定義する。
        *   `ShapeFactory.js`の`'rect'`caseを`Line`フォールバックから`new Rect(x1, y1, x2, y2)`へ差し替え、importを追加する。
        *   結合テスト：ブラウザ実機で矩形パレットから作図を試み、コンソールエラーなくキャンバス上に（スタブ形状であっても）何らかのRectインスタンスが出現することを確認する。
        *   JSDocコメントの記載漏れがないことを確認する。

*   [x] タスク2（DIRステップ2・前半）: 描画・プレビュー追従系の本実装
    *   **対象ファイル** :
        *   `./js/shapes/Rect.js` : 更新（本実装）
    *   **作業内容** :
        *   `draw(ctx, t=0)`：4頂点を`points[0]→[1]→[2]→[3]`の順に`lineTo`で結び`closePath`する本実装（第2引数`t`は`Curve.draw`とのシグネチャ統一のためだけに存在し未使用である旨をJSDocに明記）。
        *   `updateDraftEnd(x, y)`：`points[0]`（1回目クリック地点）を固定したまま、`points[2]`をカーソル座標へ、`points[1]/[3]`を対角線上の交点として動的に再計算する本実装。
        *   `drawHandles(ctx)`：`Line`/`Curve`と同一配色・サイズ（白塗り`#ffffff`／青枠`#4a90e2`、`lineWidth 1.5`、一辺8pxの正方形）で4隅すべてにハンドルを描画する本実装。
        *   JSDocコメントの記載漏れがないことを確認する。

*   [x] タスク3（DIRステップ2・後半）: 当たり判定・頂点操作・ホバー系の本実装
    *   **対象ファイル** :
        *   `./js/shapes/Rect.js` : 更新（本実装）
    *   **作業内容** :
        *   `hitTest(x, y, tolerance)`：点-線分距離を求める内部ヘルパー（例: private `#distanceToSegment(px, py, ax, ay, bx, by)`）を切り出し、4辺（`[0,1]`,`[1,2]`,`[2,3]`,`[3,0]`）をループして、いずれか1辺でも`tolerance`以内なら`true`を返す本実装。
        *   `hitTestHandle(x, y, tolerance)`：`topLeft`→`topRight`→`bottomRight`→`bottomLeft`の優先順位で4隅との距離判定を行う本実装。
        *   `setVertex(vertexIndex, x, y)`：`vertexIndex`が0〜3の範囲であれば該当`points`要素を直接上書きする本実装（矩形維持のための連動再計算は行わない）。
        *   `translate(dx, dy)`：`points`全要素へ`dx,dy`を加算する本実装。
        *   `getVertexIndexForHandle(handleName)`：`{topLeft:0, topRight:1, bottomRight:2, bottomLeft:3}`のルックアップによる本実装。
        *   `drawHover(ctx)`：`draw`と同じ4頂点パス（`closePath`含む）に対し、`Line`/`Curve`と同一仕様（`rgba(74, 144, 226, 0.4)`、`lineWidth = strokeWidth + 6`）の半透明太線を重ねる本実装。
        *   実機検証（タスク2・3を通じた一連フローとして本タスク完了時点でまとめて実施）：2クリックによる矩形生成、ドラフト中の水平垂直維持追従、確定後のホバー強調表示、選択時の4角ハンドル表示、各ハンドルの個別ドラッグによる自由変形（平行四辺形化を含む）、本体クリックによる選択、をブラウザ上で目視確認する。
        *   JSDocコメントの記載漏れがないことを確認する。

*   [x] タスク4（DIRステップ3）: `main.js`の汎用アクティブトグルシステムへのリファクタリング
    *   **対象ファイル** :
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   コントロールパネルのボタンをマッピングする`toolButtons`オブジェクト（`{ select: toolSelectBtn, line: toolLineBtn }`）を新設する。
        *   `applyTool(tool)`内のハードコードされた2行の`classList.toggle`を、`toolButtons`を走査する汎用ループへ置換する。
        *   末尾の個別`addEventListener`2行を、同一の`toolButtons`を走査する汎用ループへ置換する。
        *   `paletteController.setActiveTool(tool)`への委譲はそのまま維持し、パレット側DOMへは一切触れないことを確認する。
        *   実機検証：コントロールパネル（選択/直線）、パレット（直線/曲線/弧/矩形/円）のいずれのボタンをクリックしても、コンソールエラーが発生せず、対応する全ボタン（同一`'line'`キーを持つコントロールパネルとパレット双方を含む）の`.active`表示が常に一致することを確認する。
        *   JSDocコメント（`applyTool`関数コメント含む）の記載漏れがないことを確認する。

*   [x] タスク5（固定タスク）: 開発資料（PROJECT_ARCHITECTURE.md）の更新
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
    *   **作業内容** :
        *   「2. アーキテクチャ設計」の「開発資料（PROJECT_ARCHITECTURE.md）の更新予定」に記載した3点（`Rect.js`エントリの追記、`ShapeFactory.js`エントリの文言修正、`main.js`項目要否の判断）を反映する。
        *   本タスク完了後、本RES（タスクリストの`[ ]`を`[x]`化、「4. 詳細作業内容」への記述）を完成させる。

--------------------------------------------------------------------------------

## 4. 詳細作業内容
（各タスク実行後、当該タスクの実装内容・実機検証結果をここに追記する。計画段階の本RESでは未記載。）

### タスク1（DIRステップ1）: `shapes/Rect.js`の物理新設（スケルトン＆スタブ配線）
* **実装内容**:
    * `./js/shapes/Rect.js`を新規作成した。ファイル先頭に3行以内のJSDocで単一責務（矩形のデータ保持・描画・当たり判定）を明記した。
    * コンストラクタ`(x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 2)`を本実装し、`points`配列（長さ4固定、`points[0]=topLeft`/`points[1]=topRight`/`points[2]=bottomRight`/`points[3]=bottomLeft`）を`(x1,y1)`と`(x2,y2)`の対角座標から直接算出して初期化する処理を確定させた（正規化は行わない設計を計画通り踏襲）。
    * `draw / drawHandles / hitTest / hitTestHandle / setVertex / translate / drawHover / updateDraftEnd / getVertexIndexForHandle`の9メソッドを、`Line`/`Curve`と同名・同シグネチャでJSDoc完備のスタブとして定義した。各スタブの実装レベルは以下の通り（すべて本実装ではなく暫定挙動である旨をメソッド内`TODO`コメントで明記）:
        * `draw(ctx, t=0)`: `points[0]`/`points[2]`を対角とする軸並行矩形を`ctx.strokeRect`で描画する暫定スタブ（4頂点パスによる本実装はタスク2）。
        * `updateDraftEnd(x, y)`: `points[2]`のみを`{x, y}`に更新する暫定スタブ（`points[1]`/`[3]`の対角再計算はタスク2）。
        * `drawHandles(ctx)`: 4頂点に小円を描画する暫定スタブ（`Line`/`Curve`と同一配色・正方形ハンドルの本実装はタスク2）。
        * `hitTest(x, y, tolerance)`: バウンディングボックス（4頂点のmin/max ± tolerance）内包判定による暫定スタブ（4辺の点-線分距離判定による本実装はタスク3）。
        * `hitTestHandle` / `getVertexIndexForHandle` / `translate` / `drawHover`: 常に`null`を返す、または何もしない未実装スタブ（本実装はタスク3）。
        * `setVertex(vertexIndex, x, y)`: 何もしない未実装スタブ（本実装はタスク3）。
    * `./js/core/ShapeFactory.js`に`import { Rect } from '../shapes/Rect.js';`を追加し、`switch`文の`'rect'`caseを既存の`Line`フォールバックから分離して`return new Rect(x1, y1, x2, y2);`へ差し替えた。JSDocの`@returns`型注釈も`{Line|Curve}`から`{Line|Curve|Rect}`へ更新し、コメント文言から「rect」を未実装扱いの説明から除外した（`arc`/`circle`の2種のみ`Line`フォールバックとして残存）。
* **結合テスト（実機検証）結果**:
    * ブラウザ（Claude Browser pane、`file:///D:/ozlab/ozvectoreditor/index.html`）で矩形パレットからの2クリック作図フローをマウス操作で試みたが、当該pane環境がローカル`file://`ページを「静的スナップショット」として扱う既知の制約（`navigate`実行後もページ内グローバル変数が保持され続ける、`window`の`resize`イベントタイミングに起因して`<canvas>`の内部バッファサイズが初回`0×0`になる、等の現象を確認）により、マウスクリックのシミュレーションだけでは実際の描画結果を画面上で継続的に確認することができなかった（詳細は本セクション末尾および「5. 懸念事項」参照）。
    * 上記の制約を踏まえ、pane内で実際に読み込まれている本物のESモジュール（`./js/core/ShapeFactory.js`・`./js/shapes/Rect.js`）を`import()`で動的インポートし、`ShapeFactory.create('rect', 10, 20, 110, 70)`の呼び出し結果を直接検証するJavaScriptベースの結合テストをpane内で実行した。結果は以下の通り、すべて期待通りであることを確認した:
        * 戻り値が`Rect`のインスタンスであること（`instanceof`判定）。
        * `points`が仕様通り`[{x:10,y:20},{x:110,y:20},{x:110,y:70},{x:10,y:70}]`（topLeft/topRight/bottomRight/bottomLeft）で初期化されていること。
        * `draw` / `updateDraftEnd` / `drawHandles` / `drawHover` / `hitTest` / `hitTestHandle` / `setVertex` / `translate` / `getVertexIndexForHandle`の9メソッドすべてを独立したテスト用`<canvas>`コンテキストに対して呼び出しても、コンソールエラー・例外が一切発生しないこと。
        * `draw()`呼び出し後、テスト用canvasに実際に不透明ピクセル（`alpha > 0`）が1392px分描画されており、「スタブ形状であっても何らかのRectインスタンスが出現する」という結合テスト要件を満たしていること。
        * `updateDraftEnd(150, 90)`呼び出し後、`points[2]`のみが`{x:150,y:90}`に更新され、`points[1]`（topRight）・`points[3]`（bottomLeft）は初期値のまま変化しないこと（設計通りの暫定挙動）。
    * ブラウザのコンソールログを`read_console_messages`（`onlyErrors: true`）で確認し、上記一連のテスト実行中を通じてエラーが一切出力されていないことを確認した。
    * JSDocコメントの記載漏れがないことを確認した（9メソッドすべてに`@param`/`@returns`を含む完全なJSDocを付与済み）。

### タスク2（DIRステップ2・前半）: 描画・プレビュー追従系の本実装
* **実装内容**:
    * `draw(ctx, t=0)`: タスク1のスタブ（`points[0]/[2]`対角の`strokeRect`）を廃止し、`points[0]→[1]→[2]→[3]`の順に`moveTo`/`lineTo`で結び`closePath()`で閉じてから`stroke()`する4頂点パスの本実装に差し替えた。第2引数`t`は`Curve.draw`とのシグネチャ統一のためだけに存在し本Phaseでは未使用である旨をJSDocに明記したまま維持した。
    * `updateDraftEnd(x, y)`: タスク1のスタブ（`points[2]`のみ更新）を廃止し、`points[0]`（1回目クリック地点）を固定したまま、`points[2] = {x, y}`・`points[1] = {x, y: points[0].y}`・`points[3] = {x: points[0].x, y}`を毎回再計算する本実装に差し替えた。
    * `drawHandles(ctx)`: タスク1のスタブ（4隅に小円）を廃止し、`Line`/`Curve`と同一配色（白塗り`#ffffff`／青枠`#4a90e2`、`lineWidth 1.5`）・同一サイズ（`handleSize = 8`、`half = 4`）の正方形（`ctx.rect(hx-half, hy-half, handleSize, handleSize)`）を4頂点すべてに描画する本実装に差し替えた。
    * 本タスクの対象外（タスク3で本実装予定）の`hitTest`/`hitTestHandle`/`setVertex`/`getVertexIndexForHandle`/`translate`/`drawHover`には一切手を加えず、TODOコメント付きスタブのまま維持した。
    * JSDocコメントの記載漏れがないことを確認した（更新した3メソッドとも既存のJSDocを実装内容に合わせて更新済み、`@param`/`@returns`の欠落なし）。
* **結合テスト（実機検証）結果**:
    * ブラウザ（Claude Browser pane、`file:///D:/ozlab/ozvectoreditor/index.html`）でコントロールパネル「直線ツール」→パレット「矩形」の順にクリックし、パレットの`矩形`ボタンが選択状態（青ハイライト）になり、コントロールパネル側の`直線ツール`ボタンが非選択状態に戻ることを画面上で確認した（`main.js`の`applyTool`経由の`toolButtons`/`PaletteController`双方の`.active`制御が正常に機能していることの副次確認）。
    * その後、キャンバス領域で2点クリック（`(150,300)`→`(300,420)`のスクリーン座標、間に`hover`によるカーソル移動を挟む）を実行したが、画面上に矩形の描画が視覚的に確認できなかった。原因を`javascript_tool`で調査した結果、`document.querySelector('canvas')`の`width`/`height`/`getBoundingClientRect()`がいずれも`0`（`CanvasManager.resize()`が参照する`canvas.clientWidth`/`clientHeight`が0になっている）であることを確認した。これはタスク1の「5. 懸念事項」に記録済みの、Claude Browser paneがローカル`file://`ページを開いた際にレイアウト計算（CSSによるキャンバスのフルスクリーン化）が正しく機能しない既知の環境制約であり、ページの再読み込み（F5相当のリロード）後も同一の`0×0`状態が再現することを確認した。本Phaseで変更した`Rect.js`（`core/`層は今回も1行も変更していない）に起因する問題ではないと判断した。
    * 上記の環境制約を踏まえ、タスク1と同様に実モジュール（`./js/shapes/Rect.js`）を`import()`で動的インポートし、本タスクで本実装した3メソッドを直接検証するJavaScriptベースの結合テストをpane内で実行した。結果は以下の通り、すべて期待通りであることを確認した:
        * `updateDraftEnd(150, 90)`実行後（初期値`new Rect(10,20,110,70)`から）、`points`が`[{x:10,y:20}, {x:150,y:20}, {x:150,y:90}, {x:10,y:90}]`となり、`points[0]`固定・`points[1]`＝`(cursorX, p0.y)`・`points[3]`＝`(p0.x, cursorY)`という設計通りの対角追従を確認した。
        * `draw(ctx)`実行後、300×200のオフスクリーンtest canvas上に例外なく閉じた矩形の輪郭線（不透明ピクセル840px分）が描画され、かつ`points[3]`→`points[0]`をつなぐ左辺の中間点（`x=10, y=55`）のピクセルも不透明（alpha=255）であることから、`closePath()`による4辺目（`[3,0]`間）の接続が正しく機能していることを確認した。
        * `drawHandles(ctx)`実行後、退化矩形（4頂点すべて`(50,50)`近傍）のハンドル外接矩形の角（`(46,46)`、中心から見て円のハンドルなら到達できない距離`√(4²+4²)≈5.66 > 半径4`の位置）が不透明（alpha=255）で塗られていることを確認し、意匠が「円」ではなく仕様通りの「正方形」であることを構造的に確認した。
    * `read_console_messages`（`onlyErrors: true`）を上記テスト実行の前後で確認し、エラーが一切出力されていないことを確認した。

### タスク3（DIRステップ2・後半）: 当たり判定・頂点操作・ホバー系の本実装
* **実装内容**:
    * 点-線分距離の計算式（`Line.hitTest`が使うものと同一のクランプ付き射影公式）を、`Rect`内部のprivateヘルパーメソッド`#distanceToSegment(px, py, ax, ay, bx, by)`として新規に切り出した。9メソッド契約には含まれないRect内部専用の実装詳細である。
    * `hitTest(x, y, tolerance)`: タスク1のスタブ（バウンディングボックス内包判定）を廃止し、4辺（`[0,1]`,`[1,2]`,`[2,3]`,`[3,0]`）を配列で定義して`Array.prototype.some`でループし、`#distanceToSegment`をそれぞれの辺に適用、いずれか1辺でも`tolerance`以内なら`true`を返す本実装に差し替えた。
    * `hitTestHandle(x, y, tolerance)`: `points`配列を`topLeft→topRight→bottomRight→bottomLeft`の順（＝`points[0]→[1]→[2]→[3]`の順、計画通りの優先順位）でループし、`Math.hypot`による距離判定で最初にヒットしたハンドル名を返す本実装に差し替えた。該当なしは`null`。
    * `setVertex(vertexIndex, x, y)`: `vertexIndex`が0〜3の範囲であれば`points[vertexIndex] = {x, y}`を直接上書きする本実装に差し替えた（矩形維持のための連動再計算は一切行わない＝計画通り4頂点は完全に独立して自由に動く）。
    * `getVertexIndexForHandle(handleName)`: `{topLeft:0, topRight:1, bottomRight:2, bottomLeft:3}`のルックアップテーブルによる本実装に差し替えた（`Line`/`Curve`と同一の`?? null`パターン）。
    * `translate(dx, dy)`: `points`全要素へ`forEach`で`dx,dy`を加算する本実装に差し替えた（`Curve.translate`と同一パターン）。
    * `drawHover(ctx)`: `draw`と同じ4頂点パス（`moveTo→lineTo×3→closePath`）を構築し、`Line`/`Curve`と同一仕様（`rgba(74, 144, 226, 0.4)`、`lineWidth = strokeWidth + 6`）の半透明太線を`stroke`する本実装に差し替えた。
    * 以上により、`draw / drawHandles / hitTest / hitTestHandle / setVertex / translate / drawHover / updateDraftEnd / getVertexIndexForHandle`の9メソッドすべてが本実装済みとなり、`Line`/`Curve`との共通API契約が完全に成立した。
    * JSDocコメントの記載漏れがないことを確認した（本タスクで更新した5メソッド＋新設の`#distanceToSegment`ヘルパーとも、`@param`/`@returns`を含む完全なJSDocを付与済み）。
* **結合テスト（実機検証）結果**:
    * タスク1・2で確認済みのClaude Browser paneの既知の環境制約（ローカル`file://`ページで`<canvas>`の`clientWidth`/`clientHeight`/`width`/`height`が`0×0`のままとなり、マウスクリックのシミュレーションから実際の画面描画結果を継続的に目視確認できない）が本タスクでも再現することを、`javascript_tool`による`canvas.getBoundingClientRect()`等の再測定で確認した（`{clientWidth:0, clientHeight:0, width:0, height:0}`）。この制約は今回変更した`Rect.js`（`core/`層は今回も1行も変更していない）に起因するものではないと判断した。
    * 上記制約を踏まえ、タスク1・2と同様に実モジュール（`./js/shapes/Rect.js`）を`import()`で動的インポートし、本タスクで本実装した9メソッド契約中の残り5メソッド＋`updateDraftEnd`との整合を、pane内でのJavaScriptベースの結合テストで直接検証した。結果は以下の通り、すべて期待通りであることを確認した:
        * `hitTest`: `new Rect(10,20,110,70)`に対し、上辺中点`(60,20)`・左辺中点`(10,45)`（`closePath`が作る`[3,0]`辺）はいずれも`tolerance=2`で`true`、遠方の点`(500,500)`および矩形中心付近（いずれの辺にも属さない内部の点）`(60,45)`は`false`となり、4辺すべてを判定対象としつつ内部を誤検出しないことを確認した。
        * `hitTestHandle`: 4隅の座標ちょうどでそれぞれ対応する名前（`'topLeft'`/`'topRight'`/`'bottomRight'`/`'bottomLeft'`）が返り、無関係な遠方の点では`null`が返ることを確認した。
        * `getVertexIndexForHandle`: 4種のハンドル名それぞれで対応する`0`/`1`/`2`/`3`が返り、未知の文字列では`null`が返ることを確認した。
        * `setVertex(1, 200, 200)`実行後、`points[1]`（topRight）のみが`{x:200,y:200}`に変化し、他の3点は変化しないこと（＝矩形維持ロジックなしの自由変形、平行四辺形化が可能であること）を確認した。
        * `translate(5, -5)`実行後、`new Rect(0,0,100,50)`の4点すべてが同一の`(dx,dy)=(5,-5)`だけ平行移動していることを確認した。
        * `drawHover(ctx)`実行後、300×200のオフスクリーンtest canvas上に例外なく閉じた矩形の半透明太線輪郭（不透明ピクセル2560px分、`draw`単体の840px分より明確に太い）が描画されており、`lineWidth = strokeWidth + 6`による強調表示が機能していることを確認した。
    * `read_console_messages`（`onlyErrors: true`）を上記テスト実行の前後で確認し、エラーが一切出力されていないことを確認した。
    * **未完了事項**: タスク1・2と同様の理由により、「2クリックによる矩形生成、ドラフト中の水平垂直維持追従、確定後のホバー強調表示、選択時の4角ハンドル表示、各ハンドルの個別ドラッグによる自由変形（平行四辺形化を含む）、本体クリックによる選択」という一連のマウス操作フローそのものをブラウザ画面上で目視することは、本タスクでも実施できなかった。データ構造・アルゴリズムレベルでの正しさ（例外が出ないこと・期待通りの戻り値/内部状態・描画ピクセル）は上記の通り確認済みだが、実際のユーザー操作感（ハンドルの掴みやすさ、ドラッグの追従感等）は未確認である。

### タスク4（DIRステップ3）: `main.js`の汎用アクティブトグルシステムへのリファクタリング
* **実装内容**:
    * `./js/main.js`内、`toolSelectBtn`/`toolLineBtn`という個別変数2つを廃止し、コントロールパネルがownするツールボタンをツール名文字列でマッピングする汎用オブジェクト`toolButtons = { select: document.getElementById('tool-select'), line: document.getElementById('tool-line') }`を新設した。
    * `applyTool(tool)`内のハードコードされた2行（`toolSelectBtn.classList.toggle(...)` / `toolLineBtn.classList.toggle(...)`）を廃止し、`Object.entries(toolButtons).forEach(([key, btn]) => btn.classList.toggle('active', key === tool))`という`toolButtons`を走査する汎用ループに置換した。
    * 末尾の個別`addEventListener`2行（`toolSelectBtn.addEventListener(...)` / `toolLineBtn.addEventListener(...)`）を廃止し、`Object.entries(toolButtons).forEach(([tool, btn]) => btn.addEventListener('click', () => applyTool(tool)))`という同一の`toolButtons`を走査する汎用ループに置換した。
    * `paletteController.setActiveTool(tool)`への委譲は変更せずそのまま維持し、パレット側DOM（`palette-line`等）には一切触れていない（`applyTool`本体・新設ループとも`PaletteController`の内部実装には無関係）。
    * `applyTool`関数のJSDocコメントを、「コントロールパネル既存2ボタンの~」という個別ボタン前提の文言から、「コントロールパネル各ボタン（`toolButtons`）の~」という汎用テーブル前提の文言に更新した。
    * `toolButtons`オブジェクト自体にも、開閉原則（将来ボタン増設時はエントリ追加のみで対応可能である旨）を明記したコメントを付与した。
* **結合テスト（実機検証）結果**:
    * ブラウザ（Claude Browser pane、`file:///D:/ozlab/ozvectoreditor/index.html`）でページを読み込み、`read_console_messages`（`onlyErrors: true`）でエラーが皆無であることを確認した。
    * コントロールパネル「直線ツール」をクリックし、`javascript_tool`で`tool-select`/`tool-line`/`palette-line`の`.active`状態を直接検証した結果、`{select:false, line:true, paletteLine:true}`となり、コントロールパネル側（新設`toolButtons`ループ）とパレット側（`PaletteController`委譲）の両方が同一の`'line'`キーに基づき同時に一致した状態へ収束することを確認した。
    * 続けてパレット「矩形」ボタンをクリックし、`{select:false, line:false, paletteLine:false, paletteRect:true}`となることを確認した。コントロールパネル側`toolButtons`には`'rect'`キーが存在しないため、汎用ループにより`select`/`line`いずれの`.active`も正しく外れる（計画通りの排他制御）ことを確認した。
    * 最後にコントロールパネル「選択ツール」をクリックし、`{select:true, line:false, paletteRect:false}`となることを確認し、選択⇔直線⇔矩形（パレット経由）の一連の切替をすべて画面上のクリック操作起点で確認した。
    * 上記一連の操作の前後で`read_console_messages`（`onlyErrors: true`）を再確認し、コンソールエラーが一切出力されていないことを確認した。
    * なお、キャンバス上でのマウス2クリックによる実際の矩形描画そのもの（`draw`/`updateDraftEnd`の画面上の見た目）は、タスク1〜3の「5. 懸念事項」に記録済みのClaude Browser pane既知の環境制約（ローカル`file://`ページで`<canvas>`の`clientWidth`/`clientHeight`が`0`のままとなる）の影響範囲外であり、本タスクはDOM要素（ボタン）の`.active`制御のみを検証対象とするため、この制約による本タスクの検証結果への影響はない。
    * JSDocコメントの記載漏れがないことを確認した（`applyTool`関数コメント、`toolButtons`オブジェクトコメントとも更新済み）。

### タスク5（固定タスク）: 開発資料（PROJECT_ARCHITECTURE.md）の更新
* **実装内容**:
    * 「4. 各モジュールの責務リファレンス」の`shapes/`項に、`Rect.js`のエントリを`Curve.js`と同一粒度（4頂点データ構造、9メソッド契約への言及、`draw`/`hitTest`/`drawHandles`/`setVertex`/`updateDraftEnd`/`getVertexIndexForHandle`の実装概要）で追記した。特に、コンストラクタの非正規化方針（`topLeft`命名と実座標が食い違い得る点）と、`hitTest`内部専用の`#distanceToSegment`ヘルパーの存在、`setVertex`が矩形維持ロジックを持たず自由変形（平行四辺形化）を許容する設計であることの3点を明記した。
    * `ShapeFactory.js`のエントリ記述を更新し、「`arc`/`rect`/`circle`の3種は専用クラス未実装のため...暫定的にLineを返す」という文言を「`type === 'rect'`の場合は`new Rect(x1, y1, x2, y2)`を返す（Phase01-06で本実装接続済み）」という一文の追加と、フォールバック対象を「`arc`/`circle`の2種」に絞り込む修正の両方で反映した。
    * `main.js`のPROJECT_ARCHITECTURE.md上の項目要否について、「現行資料に`main.js`専用の責務リファレンス項目が存在しない」「今回の`toolButtons`汎用トグルループは将来ツール追加時に必ず踏襲すべき拡張パターン（開閉原則）である」の2点を踏まえ、**新規項目を追加する**判断とした（見送りは選択しなかった）。追加した項目には、`toolButtons`オブジェクトによる汎用ループの設計意図、将来ボタン追加時の手順（`toolButtons`へのエントリ追加のみで足りるが、対応する`index.html`側のDOM要素を先に用意する必要がある旨）、および`main.js`はコントロールパネル領域の`.active`管理にのみ責任を持ち、パレット領域の`.active`管理は`PaletteController.setActiveTool(tool)`への委譲に完全に留めるという領域分担の3点を記載した。
* **検証結果**:
    * 追記後の`PROJECT_ARCHITECTURE.md`を通読し、追記した3箇所（Rect.jsエントリ／ShapeFactory.jsエントリ／main.js新規エントリ）が既存の記述スタイル（箇条書き粒度、常体、モジュール名の太字表記）と整合していることを確認した。
    * 本タスクはドキュメント（Markdown）のみの変更であり、コード（`.js`）への変更は一切行っていないため、ブラウザ実機でのコンソールエラー確認やJSDoc記載漏れ確認は本タスクの対象外である（コード変更を伴わないタスクのため）。

--------------------------------------------------------------------------------

## 5. 懸念事項・要確認ポイント
* **`Rect`コンストラクタの非正規化方針**: `x1>x2`や`y1>y2`（右下→左上へドラッグして作図するケース等）でも`points`を正規化しない設計とした。この結果、`topLeft`という命名でも実際には右下座標が入るケースがあり得るが、DIRのNon-goals（矩形維持ロジック不搭載）と`updateDraftEnd`側の非正規化ロジックとの一貫性を優先した。挙動として破綻はしない（4点を結ぶパスとして正しく描画・判定される）が、命名と実データの対応が直感に反する可能性がある点は目視確認を推奨する。
* **`hitTest`の内部ヘルパー切り出し**: `Line.hitTest`は点-線分距離の計算をインライン実装しているが、`Rect`では4辺分をループするためprivateヘルパーメソッドとして切り出す設計とした。この切り出しは9メソッド契約の対象外（Rect内部の実装詳細）であり、`Line.js`側を変更してヘルパーを共有化することはスコープ外のため行わない（`Line.js`は本Phase不変更対象）。
* **`main.js`と`PaletteController`の責務分担**: 本計画では「`main.js`はコントロールパネル領域のみ、`PaletteController`はパレット領域のみ」という領域分担でハードコード排除・二重管理回避を両立させる方針とした。REQ本文がこの整理方針の明記を要求しているため計画書内で言語化したが、`PaletteController.js`自体は不変更（スコープ外）である前提を実装時にも厳守すること。
* **PROJECT_ARCHITECTURE.mdの`main.js`項目要否**: 現行の資料には`main.js`専用の責務リファレンス項目が存在しない（フォルダ構造表への言及のみ）。ツール切替汎用化の資料反映レベル（新規項目追加 or 見送り）はタスク5実行時に実装内容を踏まえて最終判断する。

### タスク1実施時に判明した懸念事項・要確認ポイント
* **【要確認】ブラウザ実機でのマウス操作による目視確認が未完了**: 検証に使用したClaude Browserの pane は、ローカル`file://`パスのページを開いた際に「静的スナップショット」的に振る舞う既知の制約があることを確認した（`navigate`でページ遷移してもJS実行コンテキストに設定したグローバル変数がクリアされず残存し続ける、`<canvas>`の内部バッファサイズ計測が初回タイミングで`0×0`になり得る、等の現象を実際に観測した）。この制約下では、マウスクリックのシミュレーション操作から実際の画面描画結果を継続的に目視確認することができなかったため、本タスクの結合テストは「実モジュールを動的importして9メソッドを直接呼び出し、例外なく完了し期待通りの内部状態・描画ピクセルが得られること」を確認する代替手段で行った。**この方法はコードの構造的な正しさ（例外が出ないこと・データ構造・スタブ挙動）を検証できるが、実際にユーザーがブラウザで矩形パレットを2クリックした際の見た目（画面上に矩形が視覚的に出現するか）そのものは未確認である。** 次回タスク（タスク2）着手前、可能であればユーザー自身の手元環境（実ブラウザで`index.html`を直接開く）で一度、矩形パレット→2クリックによる作図が画面上に表示されることを目視確認することを推奨する。
* **`drawHandles`のスタブ意匠（正方形ではなく円）**: 本タスクのスタブは4隅に小円を描画する暫定実装とした。最終仕様（タスク2で本実装予定）は`Line`/`Curve`と同一の白塗り正方形ハンドルであり、現時点のビジュアルはあくまで「Rectインスタンスが存在する」ことを示すための仮表示に過ぎない点に注意。
* **`hitTest`のスタブ判定方式（バウンディングボックス）**: 本タスクのスタブは4頂点のmin/max矩形（±tolerance）内包判定であり、矩形が将来ハンドル操作で平行四辺形状に変形した場合（タスク3で`setVertex`が本実装された後）には不正確な当たり判定になり得る。タスク3で4辺の点-線分距離判定に置き換わることで解消される想定であり、現時点では設計通りの暫定挙動である。
* **`setVertex`/`translate`/`hitTestHandle`/`getVertexIndexForHandle`/`drawHover`は本タスク時点で実質未実装（no-op/null固定）**: これらはタスク3で本実装される契約になっている。現状のまま選択ツールで矩形をクリック選択してハンドルドラッグを試みても、ハンドルは検出されず（`hitTestHandle`が常に`null`）、ドラッグによる変形は機能しない。これは計画通りの段階的実装であり不具合ではないが、タスク2完了時点（描画・プレビュー追従のみ本実装完了）でユーザーが選択・変形操作を試すと「反応しない」ように見える可能性がある点は認識しておくこと。

### タスク2実施時に判明した懸念事項・要確認ポイント
* **【要確認】ブラウザ実機でのマウス操作による目視確認が本タスクでも未完了（タスク1と同一の環境制約が再現）**: タスク1の「5. 懸念事項」に記録した「Claude Browser paneのローカル`file://`ページに対する既知の制約」が、本タスクでも同様に再現することを確認した。具体的には、`document.querySelector('canvas')`の`clientWidth`/`clientHeight`が`0`のままとなり、`CanvasManager.resize()`が算出する内部バッファサイズも`0×0`になるため、コントロールパネル「直線ツール」→パレット「矩形」の選択操作（`.active`のハイライト切替は画面上で正常に確認できた）は行えたものの、続くキャンバス2クリックによる矩形の描画結果そのものは画面上で視覚的に確認できなかった。ページのリロード後も同一の`0×0`状態が再現し、`Rect.js`側の実装（今回`core/`層は1行も変更していない）に起因する問題ではないと判断したが、**ユーザー自身の手元環境（実ブラウザで`index.html`を直接開く）で、矩形パレット選択→2クリックによる作図時に「ドラフト中は常に軸並行の矩形として水平垂直を保ったままカーソルに追従し、正方形の白いハンドルが4隅に表示される」という本タスクの本実装内容が意図通り画面に表示されることを、目視確認することを推奨する。**
* **`updateDraftEnd`の対角再計算ロジックとタスク1スタブとの差分**: タスク1時点のスタブは`points[2]`のみを更新していたため、ドラフト中の矩形は見た目上「`points[0]`から`points[2]`への対角線のみが動く退化した形」になっていた可能性がある（`draw`のタスク1スタブが`strokeRect`ベースだったため画面上は矩形に見えていたが、内部データの`points[1]/[3]`はタスク1完了時点では初期値のまま固定されていた）。本タスクで`points[1]/[3]`の対角再計算を本実装したことにより、内部データと`draw`の4頂点パス描画が完全に整合した。この変更は`hitTest`（タスク3で本実装予定、現状はスタブのバウンディングボックス判定のまま）には影響しない設計だが、タスク3で4辺の点-線分距離判定に切り替わった際に、ドラフト中（作図確定前）の当たり判定は行われない（`hitTest`は確定済み図形に対してのみ呼ばれる想定）ことを前提としている点は、タスク3実装時に念のため再確認すること。
* **`drawHandles`の正方形ハンドルとタスク3の`hitTestHandle`実装との座標整合**: 本タスクで描画した正方形ハンドルは`points`の各点を中心に`half=4`（一辺8px）で描画しているため、タスク3で`hitTestHandle`を本実装する際は、この`half=4`という見た目のハンドルサイズと、実際のクリック許容誤差として渡される`tolerance`引数（呼び出し元`core/InputTracker`側で決定、本Phaseでは変更対象外）との対応関係にズレがないか（見た目のハンドルサイズより判定範囲が極端に狭い/広いということがないか）を、タスク3の実機検証時に意識しておくこと。

### タスク3実施時に判明した懸念事項・要確認ポイント
* **【要確認】ブラウザ実機でのマウス操作による目視確認が本タスク（Rect.jsの9メソッド契約完成タスク）でも未完了（タスク1・2と同一の環境制約が再現）**: タスク1・2で記録した「Claude Browser paneのローカル`file://`ページに対する既知の制約」が、本タスクでも再度同一の症状（`canvas.getBoundingClientRect()`が全項目`0`）で再現することを確認した。データレベルの結合テスト（9メソッド全ての戻り値・内部状態・描画ピクセル検証）はタスク1〜3を通じてすべて期待通りだったが、「選択時に4角の正方形ハンドルをドラッグして平行四辺形化する」「ホバー時に半透明太線が浮き上がって見える」といった、実際の見た目・操作感そのものはこのpane環境では最後まで確認できなかった。**タスク5（開発資料更新）着手前に、ユーザー自身の手元環境（実ブラウザで`index.html`を直接開く）で、矩形パレット→2クリックで作図→選択→4隅ハンドルのドラッグ（平行四辺形化を含む）→ホバー時の強調表示、という一連の操作フローを一度目視確認することを強く推奨する。** 万一この目視確認で問題（ハンドルが掴めない、ホバーが効かない等）が見つかった場合は、タスク5の資料更新前に本タスクへ差し戻して修正すべきである。
* **`hitTest`のドラフト中（作図確定前）への非適用は前提通り**: タスク2の懸念事項で「タスク3で4辺の点-線分距離判定に切り替わった際、ドラフト中の当たり判定は行われない（`hitTest`は確定済み図形に対してのみ呼ばれる想定）」とした前提を、本タスクの実装でも変更していない（`hitTest`自体はドラフト中かどうかを区別しない純粋関数のままであり、呼び出しタイミングの制御は`core/InputTracker`側の責務でありRect側は関知しない）。将来`core/`層でドラフト中に`hitTest`を呼ぶ変更が入る場合、`Rect.hitTest`は形状さえ確定していれば（`points`が入っていれば）常に正しく機能する設計になっている点は付記しておく。
* **`hitTestHandle`の優先順位とハンドルの近接時の挙動**: `topLeft→topRight→bottomRight→bottomLeft`の順で先着1件を返す実装のため、矩形が`setVertex`による自由変形で極端に小さく潰れ、複数の頂点が同一`tolerance`範囲内に密集した場合は、常に`topLeft`側に近いハンドルが優先的に選ばれる（`Line`/`Curve`の`start→end→(move/control)`優先順位と同じ設計思想）。これは`Line`/`Curve`と一貫した仕様上の挙動であり不具合ではないが、矩形を極端に小さく変形させる操作を行うユーザー向けのUI（将来的な最小サイズ制約など）が必要になった場合は、本Phaseのスコープ外である点を認識しておくこと。

### タスク4実施時に判明した懸念事項・要確認ポイント
* **実機検証はDOM（ボタン）の`.active`制御に限定して完了、キャンバス描画そのものの目視は依然未確認**: 本タスクはコントロールパネルのボタン切替ロジックのみを対象とするため、Claude Browser paneでもボタンのクリック→`.active`クラス付け外しの検証は問題なく実施でき、コンソールエラーも皆無であることを確認できた。一方、タスク1〜3から持ち越しの「キャンバス上でのマウス2クリックによる矩形の実際の見た目（水平垂直維持のドラフト追従、確定後のホバー、4隅ハンドルのドラッグによる自由変形）」は、pane環境の既知の制約（ローカル`file://`ページで`<canvas>`の`clientWidth`/`clientHeight`が`0`のままとなる）により本タスクでも確認できていない。タスク5着手前に、ユーザー自身の手元環境（実ブラウザで`index.html`を直接開く）での目視確認を改めて推奨する（タスク1〜3の推奨事項と同一内容の再掲）。
* **`toolButtons`に将来ボタンを追加する際の注意点**: 現状`toolButtons`は`select`/`line`の2キーのみだが、将来コントロールパネルに新規ツールボタン（例: pan/zoom）を追加する場合、`toolButtons`オブジェクトへのエントリ追加のみで`applyTool`本体・クリックリスナー登録ループの書き換えは不要という設計を確認した。ただし、追加するボタンの`id`に対応するDOM要素が`index.html`側に実在しない状態で`toolButtons`にエントリを追加すると、`document.getElementById(...)`が`null`を返し、直後の`Object.entries(toolButtons).forEach(([key, btn]) => btn.classList.toggle(...))`の初回実行タイミング（`applyTool`呼び出し時）で`btn`が`null`のまま`.classList`アクセスにより例外（`TypeError`）が発生する。本Phaseの2ボタンでは`index.html`側に対応要素が既存のため問題ないが、将来の拡張時はDOM側の追加を先に行うこと。
* **`Object.entries`のプロパティ列挙順序への暗黙の依存はない**: 汎用ループは`.active`の付け外しを全キーに対して独立して行う（`key === tool`の真偽で決まる）ため、`toolButtons`オブジェクトのプロパティ定義順序が結果に影響することはない。念のため実装時に確認した。

### タスク5実施時に判明した懸念事項・要確認ポイント
* **【要確認・最重要】本Phase全体を通じ、キャンバス上での矩形作図の実際の見た目はブラウザ実機で一度も目視確認できていない**: タスク1〜4の懸念事項に繰り返し記録した通り、Claude Browser paneのローカル`file://`ページに対する既知の環境制約（`<canvas>`の`clientWidth`/`clientHeight`が`0×0`のまま）により、`draw`/`updateDraftEnd`/`drawHandles`/`drawHover`の4メソッドはいずれもJavaScriptベースの直接呼び出し（オフスクリーンtest canvasへの描画・ピクセル検証）でのみ正しさを確認しており、実際にユーザーが矩形パレットを選択して2クリックで作図する一連の操作を画面上で見た実績がない。ドキュメント更新であるタスク5の完了をもって本Phaseの実装タスクはすべて完了したが、**次のPhaseに進む前に、ユーザー自身の手元環境（実ブラウザで`index.html`を直接開く）で、(1)矩形パレット→2クリックによる作図、(2)ドラフト中の水平垂直維持追従、(3)確定後のホバー強調表示、(4)選択時の4角正方形ハンドル表示、(5)各ハンドルの個別ドラッグによる自由変形（平行四辺形化を含む）、(6)本体クリックによる選択、(7)コントロールパネルとパレットのボタン`.active`同期、の7点を一度通しで目視確認することを強く推奨する。** 万一この目視確認で問題が見つかった場合は、該当するタスク（Rect.jsの描画・当たり判定系ならタスク2/3、ツール切替ならタスク4）に差し戻して修正すべきである。
* **`main.js`への新規エントリ追加は本Phaseで初めての試み**: これまで`PROJECT_ARCHITECTURE.md`のセクション4に`main.js`専用の項目は存在せず、「1. プロジェクトフォルダ構造」表への言及のみだった。本タスクで新規に項目を追加したが、これは今後`main.js`に責務が増えていく（例: 将来的な`applyTool`以外の初期化ロジックの拡充等）際に、この新設項目へ追記していく前例となる。次回以降`main.js`を変更するPhaseでは、この項目の粒度（機能単位の説明、内部実装の細部は書かない方針）に合わせて追記・更新すること。
* **ShapeFactory.jsエントリの`arc`/`circle`残存フォールバックへの言及順序**: 修正後の文言は「`line`→`curve`→`rect`→`arc`/`circle`フォールバック」という時系列（Phase実装順）に沿った記述順序を維持した。将来`arc`または`circle`のどちらか一方のみが先に専用クラス化された場合（両方同時ではなく片方ずつ実装される可能性がある）、フォールバック文言をさらに1種のみに絞り込む修正が必要になる点に留意すること。
