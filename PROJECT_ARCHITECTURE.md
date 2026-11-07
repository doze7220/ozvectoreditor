# PROJECT_ARCHITECTURE.md
## OZ Vector Editor 全体仕様および実装定義書

**読者**：このリポジトリのコードを読めるAI。

**記載基準**
*   第一の目的はハルシネーションの防止、第二がコンテキストの削減。第二のために第一を犠牲にしない。
*   残す：責務と「何を知らないか」という境界、依存方向、複数モジュールにまたがる流れと順序の保証、誰が呼ぶか・誰が注入するか、保存形式、設計判断の理由、やらないと決めたこと、未実装のもの、呼んではいけない経路、公開メソッド名の一覧。
*   書かない：1つのファイルのJSDocを読めば分かること（引数と戻り値、private項目、typedefの中身、定数の値、1クラス内の処理順）。
*   JSDocが実コードと食い違う項目を見つけたら、JSDocが直るまで正しい記述をここに残す。
*   消すか迷ったら残す。誤った記述は長さに関係なく直すか消す。

---

### 1. プロジェクトフォルダ構造
新規にファイルを作成、あるいはログを記録する際、必ずこの構造に準拠すること。各ファイルの責務は4章を正とする。

```text
/oz-vector-editor/
├── index.html                  # スタイルはCSSファイル分割せず<style>タグに内包。フロートウィンドウも静的に置く
├── js/
│   ├── main.js
│   ├── core/
│   │   ├── VectorModel.js
│   │   ├── CanvasManager.js
│   │   ├── ViewTransform.js
│   │   ├── InputTracker.js
│   │   ├── KeyboardShortcuts.js
│   │   ├── DragTracker.js
│   │   ├── HistoryManager.js
│   │   ├── ShapeFactory.js
│   │   └── WindowManager.js
│   ├── shapes/
│   │   ├── Line.js
│   │   ├── Curve.js
│   │   ├── Rect.js
│   │   └── Ellipse.js          # 図形クラスは種別ごとに1ファイル
│   ├── palette/
│   │   ├── PaletteController.js
│   │   ├── DevPanel.js
│   │   ├── CanvasPalette.js
│   │   └── PaletteLauncher.js  # 自己完結するUI部品をここに追加する
│   ├── edit/
│   │   ├── ShapeInserter.js
│   │   ├── ClipboardController.js
│   │   ├── SnapshotAdapter.js
│   │   ├── CanvasLibrary.js
│   │   └── CanvasFileOperations.js
│   └── io/
│       ├── DocumentSerializer.js
│       ├── CanvasStorage.js
│       ├── DocumentFileIO.js
│       ├── SpriteSerializer.js
│       └── CodeExporter.js
├── test/                       # 自動テスト（node --test でのみ実行。index.html・js/からは参照しない）。中はjs/の構成に合わせる
│   ├── io/
│   │   ├── DocumentSerializer.roundtrip.test.js
│   │   ├── DocumentSerializer.errors.test.js
│   │   ├── SpriteSerializer.test.js
│   │   ├── CodeExporter.test.js
│   │   └── DocumentFileIO.test.js
│   └── edit/
│       ├── CanvasFileOperations.test.js
│       └── CanvasFileOperations.export.test.js
│
├── PROJECT_CONSTITUTION.md
├── PROJECT_ARCHITECTURE.md
│
├── _doc/
│   ├── arch/                   # 本資料4章の本文。本資料を読む許可がある作業では、4章の一覧をパス指定として該当ファイルを読む
│   # arch/以外は人間・設計AI用の資料。明示的な指示がない限り読んで行動してはならない
│
└── _log/
    ├── req/
    │   └── closed/    # フェイズ大番号移行時にアーカイブ済みREQの退避先
    └── res/
        └── closed/    # フェイズ大番号移行時にアーカイブ済みRESの退避先
```

**存在しないもの**：JS形式の入力（書き出し済みJSの再読み込み。`CodeImporter`は作らない。`_doc/PROJECT_MILESTONE.md`の将来の野望）、スプライト（JS・JSON）の読み込み（確認用ページ、「開く」「インポート」でのスプライトの読み込み。Phase 04-03で予定）、組み立て用のJSの書き出し（P7）、複数キャンバスの一括出力、PNG・SVG等の形式、カラーピッカー、ツールバー、塗りつぶし、レイヤー、グループ化、`package.json`・`node_modules`・ビルド手順、テストの自動実行（保存時・コミット時のフック、CI）、画面の操作や描画のテスト。

**フォルダ分割の方針**
*   `core/`：横断的な処理（入力→状態→描画の複数層にまたがるもの）。
*   `shapes/`：1種類の図形。`palette/`：1つのUI部品。
*   `io/`：作業データ形式の変換（`DocumentSerializer`）、IndexedDBへの読み書き（`CanvasStorage`）、作業データファイル・スプライトのファイルのブラウザ内での読み書き（`DocumentFileIO`）、スプライト（書き出し形式）の組み立て（`SpriteSerializer`）とスプライトJSのテキストの組み立て（`CodeExporter`）のみ。
*   `edit/`：`io/`・`core/`の機能を組み合わせて図形一式を扱う手順（貼り付け・複製、履歴のスナップショットの取得・適用、キャンバス一覧の管理、ファイル操作の組み立て）。操作モードを知らない。操作モードに依存する判定・処理は`shouldRestoreSelection`・`prepareSwitch`・`prepareInsert`のような中立な注入関数で受け取る。
*   `test/`：自動テスト。Node.jsはテストの実行（`node --test`）にのみ使い、エディタのビルド・配信には使わない。依存は`test/ → js/`の一方向で、`index.html`・`js/`は`test/`を参照しない。規則は4章`test/`。
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`をimportしない。`core/`・`io/`は`edit/`をimportしない。

---

### 2. データ構造（Model）の概要
*   **図形（Shape）**：`shapes/`の図形クラスのインスタンス。
    *   共通プロパティ：`type`（`ShapeFactory`が受理する文字列と一致）・`id`（`VectorModel`が採番）・`strokeColor`・`strokeWidth`。
    *   頂点の保持形式は図形クラスごとに異なる（`Line`は`x1, y1, x2, y2`、`Curve`/`Rect`/`Ellipse`は`points`配列。4章`shapes/`）。
    *   塗りつぶしの共通プロパティは未定義。
*   **図形データ**（1図形のJSON表現）：全図形共通で`{ type, id, points: [{ x, y }, ...], strokeColor, strokeWidth }`。
    *   各図形クラスの`toJSON()`/`static fromJSON(data)`で相互変換する。
    *   `Line`も`points`2点＝[始点, 終点]で表す。`points`の並びは各図形クラスの頂点の並びと同じ。
    *   `fromJSON`直後の`id`は未検証・未正規化（欠落なら`undefined`、任意の型を取り得る）。`VectorModel.replaceAllShapes`の正規化を経て初めて一意な文字列になる。
*   **作業データ形式**（キャンバス全体の版番号付きJSON表現）：`{ format: "oz-vector-editor", version, shapes: [図形データ, ...] }`（`shapes`は描画順）。
    *   変換は`io/DocumentSerializer.js`が担う。
    *   保存対象は図形データのみ。選択集合・ホバー・作成中の図形・選択矩形・ビュー変換は含めない。
    *   図形クラスは常に現行版の図形データのみを扱う。旧版の知識は`DocumentSerializer`のマイグレーション表に閉じる。
*   **作業データファイル**：作業データ形式のJSON文字列を内容とするファイル（既定の拡張子`.ozve.json`。読み込みは従来の`.json`も可）。キャンバス名は内容に含まれない。ファイル名との変換は`io/DocumentFileIO`が担う（3章9.。規則は下記「ファイル名の規則」）。
*   **スプライト（書き出し形式）**：開いているキャンバスをゲームが`import`して描けるようにしたもの。`<名前>.js`（ESモジュール）と`<名前>.json`のセット。どちらも同じスプライトデータを持ち、JSはさらに`draw(ctx)`を持つ。組み立ては`io/SpriteSerializer`（データ・JSON文字列）と`io/CodeExporter`（JSのテキスト）が担う。本項がスプライトの形の唯一の記載箇所（他の箇所はここを参照する）。
    *   **スプライトデータ（書き出し形式の版1）**：`{ format: "oz-vector-editor-sprite", formatVersion: 1, bounds: {minX, minY, maxX, maxY} | null, elements: [描画要素, ...], source: 作業データ }`。キーはこの順で出力するが、読む側はキーの順に依存しないこと。
        *   `source`：`DocumentSerializer.serialize`の戻り値そのもの（作業データ形式。`source.version`は作業データの版）。`DocumentSerializer.deserialize`で元の図形に戻せる。JS・JSONの両方に入るため図形の情報を2重に持つ（薄い書き出しとして許容）。
        *   含めないもの：スプライトごとの変わらないID、キャンバス名、作成日時（参照はファイル名で行う）。
        *   単位はpx、角度はラジアン。基準点はワールド座標の原点(0, 0)、y軸は下向き。エディタのワールド座標をそのまま使い、平行移動・拡大・丸めをしない。
    *   **描画要素**（`elements`の1要素＝図形1つ。描画順＝`model.getShapes()`の並び。`id`は図形の`id`そのまま、頂点は作業データの`points`の並び順のまま。回転のキーは持たない）。図形クラスの`toDrawElement()`が作る。共通のキーは`kind`・`id`・`strokeColor`・`strokeWidth`。
        *   `"polyline"`（`line`・`rect`）：`kind, id, points: [{x, y}, ...], closed, strokeColor, strokeWidth`。`line`は`closed: false`・2点、`rect`は`closed: true`・4点。`beginPath` → `moveTo(points[0])` → `lineTo`（i=1…）→ `closed`なら`closePath`。
        *   `"quadratic"`（`curve`）：`kind, id, points: [始点, 制御点, 終点], strokeColor, strokeWidth`。`beginPath` → `moveTo` → `quadraticCurveTo(制御点, 終点)`。
        *   `"ellipse"`（`circle`・`arc`）：`kind, id, x, y, radiusX, radiusY, startAngle, endAngle, closed, strokeColor, strokeWidth`。`ellipse(x, y, radiusX, radiusY, 0, startAngle, endAngle)`（回転は常に0）→ `closed`なら`closePath`。`circle`は`closed: true`・0〜2π、`arc`は`closed: false`・π〜2π。値は`Ellipse.draw`と同じ式（読む側は`Ellipse`の`points`の約束を知らなくてよい）。
        *   どの`kind`もパスの後に`strokeStyle` → `lineWidth` → `stroke()`（エディタの各図形の`draw`と同じ順・同じ命令）。
    *   **読む側の規則**（P5・P6で項目を足しても既存の項目の意味を変えないための規則。書き出したJSの`draw`もこれに従う）：
        *   未知のキー（最上位・描画要素とも）は無視する。未知の`kind`の要素は描かない。
        *   `strokeWidth`が正の有限の数値でない（キーが無い・`undefined`を含む）要素は線の太さ2pxとして扱う（描画・外枠とも。`DEFAULT_STROKE_WIDTH`の唯一の定義箇所は`SpriteSerializer.js`）。
        *   `strokeColor`が文字列でない要素は**線を描かない**（線のパスと`strokeStyle`・`lineWidth`・`stroke()`を呼ばない）。これは線についての規則であり、要素を捨てる規則ではない。版1は線のみのため結果として何も呼ばれない。P5で塗り等を足すときの塗りの扱いはこの規則に縛られず、足す項目の側で決める。
        *   形の項目が足りない要素は描かない：`polyline`は`points`が2点以上、`quadratic`は3点以上、`ellipse`は`radiusX`・`radiusY`が0以上の数値（`NaN`不可）。
    *   **2つの版**：書き出し形式の版は`formatVersion`（唯一の定義箇所は`SpriteSerializer.js`）、作業データの版は`source.version`（`DocumentSerializer`）。最上位に`version`キーは置かない。書き出し形式の版は、エンジンが読む部分（`format`・`formatVersion`・`bounds`・`elements`の形と意味、JSのexportの形）が変わったとき（項目の追加で、古い読み手が未知の項目として無視すると正しく描けなくなる場合を含む）に上げる。作業データの版（`source.version`）は、作業データの保存形式が変わったとき（`DocumentSerializer`の`MIGRATIONS`へ関数を足すとき）に上げる。作業データだけ版が上がっても書き出し形式の版は上げなくてよい。
    *   **識別子**：`format: "oz-vector-editor-sprite"`（作業データの`"oz-vector-editor"`とは別の値。Phase 04-03で本アプリが書き出したものかを見分ける手がかり）。スプライトのJSONを現行の「開く」「インポート」で選ぶと`format`不一致で`DocumentSerializer`の全体失敗となり通知`readFailed`になる（停止しない）。
    *   **外枠`bounds`**：ワールド座標の最小・最大（`minX ≤ maxX`・`minY ≤ maxY`。幅・高さは読む側で引き算する）。図形0個のとき`null`（0×0の原点の点にするとP7で外枠の和を取るとき原点が誤って含まれるため）。読む側は`null`を確かめること。外枠は書き出し時にエディタが計算した値であり、読む側は再計算しない。
        *   求め方：描画要素ごとの形の範囲（中心線の外接矩形）を線の太さの半分（太さが不正なら2pxの半分）だけ四方へ広げ、全要素の和を取る。`polyline`は全頂点、`quadratic`は端点と各軸の極値（制御点は含めない）、`ellipse`は弧の両端と軸上の端点（`closed`の弦は影響しない）。未知の`kind`は`Error`をthrowする。
        *   近似：鋭い角の継ぎ目（`miter`）の尖りは考慮しない（はみ出すことがある）。線の端・長さ0の線も太さの半分を広げるため実際より大きくなることがある（保守的な値）。弧の両端は三角関数の誤差（1e-15程度）を含む。
    *   **JSONの出力形**：`JSON.stringify(data, null, 2)`（字下げ2。最小化しない。関数は含まない）。
    *   **JSの形**（`CodeExporter.toModuleText`）：`import`文を含まず単体で`import`できる。固定の説明コメント → `const spriteData = <JSON>;` → `const DEFAULT_STROKE_WIDTH = 2;` → `function draw(ctx)`・`function drawElement(ctx, element)` → `export default { ...spriteData, draw };`。**既定のexportのみ**（名前付きexportなし。`import body from './body.js'`と`import`する側が名前を付けるため衝突しない）。値はスプライトデータの全キーと`draw`。`draw`は`this`を使わず、`const { draw } = body`と取り出しても動く。スプライトデータはJSONのまま式として埋め込む（ES2019以降が前提。キーは本アプリが組み立てる固定のもの。利用者の入力を含む値はJSONの文字列としてのみ埋め込まれ、コードとして解釈されない）。
        *   `draw(ctx)`：`ctx.save()` → `try { 明示設定 → 各要素を順に描く } finally { ctx.restore() }`。明示する設定は`lineCap='butt'` → `lineJoin='miter'` → `miterLimit=10` → `setLineDash([])`（エディタの図形の線が既定値で描かれているため、ゲーム側の`ctx`の値に左右されないよう明示する）。
        *   明示しないもの：`globalAlpha`・`globalCompositeOperation`・影・`filter`・変換。ゲーム側が意図して使う合成・効果と配置であり、`ctx`の現在の変換の上に描く要件のため。配置は`ctx`の変換で行う。
        *   図形0個：`draw`は`save`・設定の明示・`restore`のみで、パスも`stroke`も呼ばない。ダウンロードは図形があるときと同じく2つとも行い、専用の通知は出さない。
        *   組み立て用のJSからの使い方の例（P7で書き出す想定。名前の頭に`_`を付ける。配置は`ctx`の変換）：
            ```js
            // _hero.js
            import body from './body.js';
            import head from './head.js';
            export default {
                draw(ctx) {
                    body.draw(ctx);              // 原点(0, 0)を基準に描く
                    ctx.save();
                    ctx.translate(0, -40);
                    head.draw(ctx);
                    ctx.restore();
                }
            };
            ```
*   **ファイル名の規則**（唯一の定義箇所は`io/DocumentFileIO`。`CanvasFileOperations`はキャンバス名を渡すだけで拡張子・MIMEタイプを知らない）：
    *   共通の手順：使えない文字（`\ / : * ? " < > |`と制御文字）を`_`へ置換 → 前後の空白を除く → 末尾のピリオドと空白を除く → 空なら`無題`。
    *   作業データファイル：`<名前>.ozve.json`（先頭の`_`は除かない）。開くときは末尾の`.ozve.json`または`.json`を**1回だけ**除く（大文字小文字を区別しない）ため、キャンバス名がどのような拡張子らしい文字列で終わっても往復で変わらない（`a.json` → `a.json.ozve.json` → `a.json`）。従来の`ship.json`も読め、名前は`ship`になる。末尾のピリオド・使えない文字を含む名前は従来どおり往復で変わる。
    *   スプライト：`<名前>.js`・`<名前>.json`。共通の手順に加え、使えない文字の置換の後に先頭の`_`と空白をすべて除く（`_hero` → `hero`、`___` → `無題`）。DIRの組み立て用のJSは名前の頭に`_`を付け、パーツのJSは付けないため。
*   **キャンバス**：名前を持ち、ブラウザ内に保存される1つの作品の単位。画面に開くキャンバスは常に1枚。
*   **キャンバス記録**（キャンバスの保存単位）：`{ id, name, updatedAt, document }`（typedef`CanvasRecord`は`io/CanvasStorage.js`）。
    *   `id`：形式`canvas-<Date.now()の36進>-<Math.randomの36進8文字>`。採番と形式の知識は`CanvasLibrary`に閉じ、他のモジュールは解釈しない。図形のid`shape-<連番>`とは別体系。
    *   `name`：前後の空白を除いた1〜100文字。重複は許す。
    *   `updatedAt`：`Date.now()`のミリ秒。名前の変更では更新しない。
    *   `document`：作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値）。保存処理・キャンバス一覧の管理とも中身を解釈しない。読み込みは`DocumentSerializer.deserialize`を通す。
    *   保存しないもの：Undo/Redoの履歴・選択集合・ホバー・作成中の図形・選択矩形・ビュー変換・クリップボード・操作モード。
*   **保存先**：IndexedDB。設定は`CanvasStorage.js`の`STORAGE_CONFIG`が唯一の定義箇所。ストアはキャンバス記録と、「最後に開いていたキャンバスの識別子」を保持するメタ情報の2つ。
    *   オリジン単位のため、`file://`で開いた場合とローカルサーバー経由で開いた場合、ポート番号が違う場合は別のキャンバス一覧になる。
    *   複数タブで同時に開いた場合の整合は扱わない（後から書き込んだ側が残る）。
*   **座標**：図形の座標はすべてワールド座標。ビュー変換（表示倍率・オフセット）は図形データに含まれず、表示専用の状態として`core/ViewTransform.js`が保持する。パン・ズームで図形データは書き換わらない。
*   **選択状態**：`core/VectorModel.js`が保持する。
    *   **選択集合**：選択中の図形idの集合。0個以上で、常に現存図形のidのみを含む。選択モード以外では空（不変条件）。
    *   **選択矩形**：範囲選択中の表示用。ワールド座標の対角2点（押下点と現在のカーソル位置）。正規化しない。

---

### 3. 描画・操作フロー（実行サイクル）
**同期の経路（全機能共通）**：再描画・UI同期は既存の経路（`model.onChange`・`viewTransform.onChange`・`historyManager.onChange`・`canvasLibrary.onChange`・`canvasFileOperations.onChange`、モードと図形種別は`applyMode`・`applyShapeType`）のみで行う。機能専用の再描画・同期処理を足さない。

1.  **起動処理 (`main.js`)**：DOMの読み込み完了後、インスタンス化・依存の注入・イベントバインドを行う（配線は4章`main.js`）。URLに`?dev`があるときのみ`DevPanel`も生成・表示する。
    *   **キャンバスの非同期の読み込み**：初期化の最後に`canvasLibrary.start()`を呼ぶ（`await`しない）。起動直後は空のキャンバスで描画され、読み込み完了時に切り替え処理（8.）で図形一式が入る（倍率100%・選択モード・履歴は空）。
    *   **開くキャンバスの決定**：候補は「最後に開いていたキャンバス（一覧にあれば）→ 残りを最終更新日時の新しい順」。先頭から読み込みを試し、全体として読めた最初の1枚を開く。読めない記録は一覧に残し、保存先からも消さない。形式不正の記録（`id`・`name`・`updatedAt`の型が違う）は一覧から除外し、保存先からは消さない。候補が無い・すべて読めない場合は新しい空のキャンバスを作成して開く（初回起動を含む）。
    *   **保存先を利用できない場合**：保存先へ一切書き込まず、メモリ上だけの空のキャンバス「無題 1」を開く（`'unavailable'`。8.）。
    *   **読み込み完了前の操作**：`index.html`で表示状態から始まる覆い要素`#canvas-loading-cover`がキャンバスへのマウス入力を遮る（読み込み完了時の切り替えで利用者の操作が消されたり別のキャンバスに保存されたりしないため）。キーボードショートカットとフロートウィンドウ上のボタンは働く。読み込み中は図形0個・クリップボード空・履歴空のため図形一式を変えない。唯一図形一式を変え得る`?dev`の「復元」は読み込み中は受理しない。`CanvasLibrary`も読み込み中の開く・新規作成等を受理しない。図形一式を変える操作を新しく足す場合は読み込み中の扱いが要る。
2.  **描画サイクル (`CanvasManager.js`)**：常時ループ（rAF）は持たない。`VectorModel.onChange`・`ViewTransform.onChange`・ウィンドウリサイズの3経路から同一関数`renderCurrentState()`（`main.js`）で同期的に再描画する。描画順は4章`CanvasManager.js`。
3.  **入力監視 (`InputTracker.js`・`KeyboardShortcuts.js` → `VectorModel.js`)**：状態が更新されると`VectorModel`が更新イベントを発火し、再描画を促す。
    *   **ドラッグのライフサイクル**：左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）とパンの、押下から解放まで（開始ボタン・移動量閾値・追従/終了検知・中断・終了直後のclick抑止）は`DragTracker`が`window`へのcapture購読で一元管理する。ドラッグの意味の解釈（パン量・頂点変形・選択集合の平行移動・範囲選択）は`InputTracker`が行う。閾値判定のみスクリーン座標で行い、当たり判定・移動量・選択矩形はワールド座標で扱う。
    *   **範囲選択の流れ**：選択モードで空白を左ボタンで押下 → 閾値超過後、押下点と現在のカーソル位置で`VectorModel`の選択矩形を更新（描画は`CanvasManager`）→ 解放時に矩形を正規化し、各図形の`intersectsRect`をポリモーフィックに呼んで掛かった図形で選択集合を置き換え、選択矩形を破棄する（0件なら全解除）。中断（blur・モード切替）時は選択矩形を破棄するのみで確定しない。
    *   **キーボード操作**：`document`の`keydown`は、`Space`を`InputTracker`（スペースパン）、それ以外のキーを`KeyboardShortcuts`が排他的に担当する（同一キーを二重に解釈しない）。`keyup`は`Space`のみ`InputTracker`が購読する。操作の実体は`main.js`から注入されたコールバック（`applyMode`/`applyShapeType`/`viewTransform`/`InputTracker`の公開メソッド/`performUndo`・`performRedo`/`ClipboardController`の`copy`・`cut`・`paste`・`duplicate`）で実行する。
4.  **座標系とビュー変換 (`ViewTransform.js`)**：図形データが保持する座標を「ワールド座標」、キャンバス要素の左上を原点とするCSSピクセル座標を「スクリーン座標」と呼ぶ。`スクリーン = ワールド × 倍率 ＋ オフセット`。
    *   **入力**：`InputTracker`がマウスイベントからスクリーン座標を取得し、`ViewTransform.screenToWorld`でワールド座標へ逆変換して`VectorModel`・当たり判定へ渡す。パン量・ズーム中心はスクリーン座標のまま`ViewTransform`へ渡す。
    *   **描画**：`renderCurrentState()`が`viewTransform.getState()`を`CanvasManager.render()`へ渡し、`CanvasManager`がdprと合成した描画変換を毎回設定する。
5.  **作業データの変換・`?dev`の復元 (`DocumentSerializer.js` ⇔ `VectorModel.js`)**
    *   **変換**：`DocumentSerializer`が各図形の`toJSON()`から作業データを組み立てる。
    *   **図形インスタンスの生成**：`DocumentSerializer`のデシリアライズ（`ShapeFactory.fromJSON`→各図形クラスの`fromJSON`）。
    *   **`?dev`の「JSONから復元」の順序**：成功時のみ`InputTracker.abortOngoingOperation()` → `HistoryManager.beginEdit()` → `VectorModel.replaceAllShapes(shapes)` → `HistoryManager.commitEdit()`。中断を先に行うのは、ドラッグ中だった場合にその中断分を先に1件確定させるため。全体の読み込みに失敗したらキャンバスを変更せず、履歴にも記録しない。
    *   この順序は`?dev`の復元専用。キャンバスの切り替えは8.（履歴を消す）、貼り付け等は`ShapeInserter.insertDocument`（7.）を通る。
6.  **履歴（取り消し・やり直し） (`InputTracker.js`・`edit/ShapeInserter.js`・`main.js` → `HistoryManager.js`)**：編集操作（図形一式を変化させる利用者の1回の操作）の前後の図形一式を丸ごと記録するスナップショット方式。スナップショットは`{ document: 作業データ, selectedIds: 選択集合 }`。取得・適用の実体は`edit/SnapshotAdapter`（`HistoryManager`へ`capture`/`restore`として注入）。
    *   **記録の規則**：変更処理を`HistoryManager.beginEdit()`と`commitEdit()`で挟む。`model.onChange`ごとの記録はしない。後続の編集操作も挟むだけで履歴の対象になる。前後の作業データ部分の`JSON.stringify`が一致する場合（閾値以内のクリック・元の位置へ戻したドラッグ等）は記録せず、やり直しの履歴も破棄しない（選択集合は比較しない）。
    *   **記録する操作と時点**：
        *   図形の作成：`InputTracker.handleClick`の`DRAWING`確定時、`model.commitDraft()`の前後。
        *   削除（削除ボタン・`Delete`/`Backspace`）と切り取り（`Ctrl`+`X`）：`InputTracker.deleteSelection()`の受理時、`model.deleteShapes(ids)`の前後。
        *   本体ドラッグ・moveハンドルによる移動、ハンドルによる変形：閾値超過時に開始し、ドラッグの終了・中断の共通後始末で確定。中断（`blur`・モード切替・`abortOngoingOperation()`）で残った変化も1件として記録する（記録しないと次の編集操作の前の状態に混ざり、単独で取り消せなくなるため）。
        *   `?dev`の「JSONから復元」：5.の順序。
        *   貼り付け・複製（`Ctrl`+`V`／`Ctrl`+`D`）・インポート：`ShapeInserter.insertDocument`で、`model.addShapesWithNewIds(shapes)`の前後。追加0件では記録しない。
    *   **記録しない操作**：範囲選択・クリック選択・全選択・選択解除・ホバー・パン・ズーム・ビューのリセット・操作モード/図形種別の切り替え、作成途中の図形の開始・破棄、コピー、出力（作業ファイル・エンジン用）、開く（ファイル）・キャンバスの切り替え。
    *   **適用の流れ**：ショートカット（`Ctrl`+`Z`／`Ctrl`+`Y`・`Ctrl`+`Shift`+`Z`）とボタン（`#history-undo`／`#history-redo`）は、どちらも`main.js`の`performUndo()`／`performRedo()`を呼ぶ（`historyManager.undo()`/`redo()`を直接呼ばない）。
        1.  ドラッグ中（`inputTracker.isDragging()`）なら不受理。
        2.  `inputTracker.abortOngoingOperation()`。取り消しは、作成途中の図形を破棄した場合はそこで終了し履歴を変化させない。やり直しは破棄したうえで続行する。
        3.  `HistoryManager.undo()`／`redo()` → 注入された`restore`＝`SnapshotAdapter.restore(snapshot)`。
        4.  `DocumentSerializer.deserialize`。失敗・スキップ1件以上なら`console.warn`してキャンバスを変更せず、履歴の位置も動かさない。
        5.  `model.replaceAllShapes`。
        6.  注入関数`shouldRestoreSelection()`が真（実体は`main.js`の「選択モードのときのみ」）のときのみ`model.setSelection(snapshot.selectedIds)`。
    *   **戻り値**：ドラッグ中でなければ、履歴がなくても受理（`true`）を返し、ブラウザ標準の動作を抑止する。
    *   **適用後の選択集合**：記録時点のもの（前の状態＝操作開始時、後の状態＝操作完了時。選択モード以外では空）。
    *   **適用時の通知**：`model.onChange`（選択モードでは2回、それ以外では1回）→`historyManager.onChange`（1回）。
    *   **履歴のリセット**：`HistoryManager.clear()`の呼び出し元は`CanvasLibrary`の切り替え処理（8.）のみ。キャンバスを開く・開く（ファイル）・新規作成・削除後の切り替え・起動時の復元で履歴を空にする。切り替えそのものは編集操作として記録しない（`beginEdit`/`commitEdit`を呼ばない）。
7.  **コピー・貼り付け・複製 (`KeyboardShortcuts.js` → `main.js` → `ClipboardController.js` → `ShapeInserter.js` → `VectorModel.js`)**：`Ctrl`+`C`／`X`／`V`／`D`で操作する（ボタンはない）。段数・ずらし量の規則は`ClipboardController`のクラスJSDoc。
    *   **クリップボード**：アプリ内部（メモリ上）。OSのクリップボードは使わない。作業データ形式で保持するため図形インスタンスを参照しない。履歴の対象外。インスタンスは`main.js`が1つだけ生成し、キャンバスを切り替えても消えない（ページの再読み込みで空になる）。
    *   **コピー・切り取り**：選択集合の図形を描画順で`serialize`して記録する。切り取りは先に`serialize`したうえで唯一の削除経路`InputTracker.deleteSelection()`（`main.js`が注入）を呼び、受理された場合のみクリップボードを置き換える。選択集合が空（選択モード以外を含む）なら何もせず`false`を返し、`preventDefault()`しない（ページ上の文字の標準のコピーを妨げないため）。
    *   **貼り付け・複製**：貼り付けはクリップボードの内容を、複製は選択集合の図形を`serialize`した作業データを（クリップボードを経由せず）、`ShapeInserter.insertDocument`へ渡す。追加した図形は毎回新しいインスタンス・新しいidで最前面へ追加され、追加した図形だけが選択される。
    *   **選択モード以外での貼り付け**：`main.js`の`paste`コールバックは、クリップボードが空なら何もしない（モードも切り替えない）。空でなければ、選択モード以外のとき先に`applyMode(OperationMode.SELECT)`で切り替えてから貼り付ける（作成途中の図形は`setMode`の強制中断で破棄される）。
    *   **`insertDocument`の前提**：進行中の入力操作の中断・モード切り替えは行わない（呼び出し側の責務）。
8.  **キャンバス管理（自動保存・切り替え） (`CanvasPalette.js` → `main.js` → `CanvasLibrary.js` → `CanvasStorage.js`・`DocumentSerializer.js`・`VectorModel.js`・`HistoryManager.js`)**：受理判定と処理本体は`CanvasLibrary`が担う。細則の正本は`CanvasLibrary`のクラスJSDoc（手順・`#isSwitching`・削除・直列化・`Promise`・`issue`の種類と解除条件）。本節は主にモジュールをまたぐ流れを書く。
    *   **表示の同期**：開いているキャンバスの名前の表示・ページのタイトル・覆い要素は`canvasLibrary.onChange`の通知で`canvasLibrary.getState()`から同期する。パレットの一覧は`canvasFileOperations.onChange`（`canvasLibrary.onChange`の転送を含む1経路）で`canvasFileOperations.getState()`から同期する。
    *   **自動保存**：
        *   契機は`historyManager.onChange`のみ（`model.onChange`は使わない）。選択の変更・ホバー・パン・ズーム・作成途中の図形の開始/破棄・ドラッグ中の途中経過では保存しない。
        *   通知のたびに待ち時間を張り直し、最後の通知から待ち時間後に1回、開いているキャンバスの記録全体を書き込む。
        *   予約しないのは、開いているキャンバスが無い（読み込み完了前）・`'unavailable'`・`#isSwitching`のとき。
        *   保存の作業データは書き込みの呼び出し時点で同期的に取得する。予約時点のキャンバスと開いているキャンバスが一致する場合のみ、そのキャンバスの記録へ書く。
    *   **ページ非表示時の確定**：`main.js`が`document`の`visibilitychange`（`hidden`のとき）と`window`の`pagehide`で`canvasLibrary.flushPendingSave()`を呼ぶ（`CanvasLibrary`自体は`document`・`window`のイベントを購読しない）。作業データの取得と書き込みの開始はハンドラ内で同期的に行われる。
    *   **保存に失敗した変更**：利用者が明示的に捨てない限り失わない（発注者の決定）。
        *   失敗した変更は保留のまま残り、次の編集・切り替え・ページ非表示時に書き込みを再試行する。タイマーでの自動再試行はしない。
        *   失敗する限り、開く・開く（ファイル）・新規作成は切り替えを中止する。変更を捨てて移るための確認の小窓は無い（発注者の決定）。逃げ道は出力（作業ファイル）、再読み込み・タブを閉じるときのブラウザの確認、開いているキャンバスの削除（確認の小窓が明示的に捨てる操作に当たる）。
        *   再読み込み・タブを閉じるとき：`main.js`が`window`の`beforeunload`で`canvasLibrary.hasUnsavedChanges()`が真なら`preventDefault()`する。
        *   新規作成・開く（ファイル）で新しい記録を書けないとき：`CanvasLibrary` → 注入された`confirmOpenUnsaved`（実体`canvasPalette.confirmOpenUnsaved()`。文言と`window.confirm`はパレット）で確認する。「いいえ」は作らず今のキャンバスのまま（ファイルの中身はファイルに残る）。「はい」は記録の無いまま開き、保存できるまで別のキャンバスへは移れない。起動時・削除後は開く先が他に無いため確認せずに開く。
    *   **切り替え処理の順序**：開く・開く（ファイル）・新規作成・開いているキャンバスの削除後の切り替え・起動時の復元が共通して通る。手順の番号と細則はクラスJSDoc「■ 切り替え処理」。起動時の復元・削除後の切り替えは読み込みから入り、確定手順を通らない。
        *   モジュールをまたぐ順序：`prepareSwitch()`（実体`applyMode(OperationMode.SELECT)`）→ 切り替え前の保存の確定（`flushPendingSave()`）→ 切り替え先の読み込み（`CanvasStorage`・`DocumentSerializer`）→ もう一度`prepareSwitch()`のうえ保留・書き込み中の保存が無くなるまで確定（確定手順）→ `await`を挟まずに`model.replaceAllShapes` → `historyManager.clear()` → `resetView()` → 開いているキャンバスの更新と変更通知。
        *   中止しても最初の`prepareSwitch()`の副作用は残る（選択モードへの切り替え・選択解除・作成途中の図形の破棄）。
        *   クリップボードには触れない。
    *   **非同期保存と切り替えの順序の保証**：次の3点により、切り替え前のキャンバスの記録を切り替え後の内容で上書きすることも、切り替え後のキャンバスの記録へ切り替え前の内容を書くことも起きない。
        *   `CanvasStorage`はすべての書き込みのトランザクションを呼び出し時点で同期的に生成し、IndexedDBはそれを生成順に実行するため、書き込みは呼び出し順に反映される。
        *   切り替え前の保存の確定と確定手順で、図形一式の入れ替え前に保留中の保存を確定する。
        *   保存の作業データの同期取得と、予約時点のキャンバスとの一致の確認（上記「自動保存」）。
    *   **名前の変更**：一覧の任意のキャンバスが対象。保存先へは名前のみを書き、最終更新日時は更新しない（一覧の並びが入れ替わると押そうとした行が動いて紛らわしいため）。
    *   **削除**：一覧の任意のキャンバスが対象（確認の小窓は`CanvasPalette`）。
        *   開いていないキャンバス：開いているキャンバス・図形一式・履歴・自動保存に触れない。
        *   開いているキャンバス：進行中の入力操作の中断 → 保留中の保存の破棄（確定しない）→ 予約の停止（`#isSwitching`）→ 記録の削除。成功したら残りを最終更新日時の新しい順に試して開く（無ければ新しい空のキャンバス）。失敗したら中止して開いているキャンバスのままとし、自動保存を予約し直す。
        *   記録の削除に成功してから切り替えが完了するまでは、`openCanvasName`が`null`で、`openCanvasId`は一覧に無いidを指す。
    *   **処理中の直列化**：ファイルの読み取り中は`CanvasFileOperations`の処理中によりパレットの全操作が押せなくなる。処理中もキャンバスの編集は止めない（確定手順で整合を取る）。
    *   **保存・読み込みの問題（`issue`）**：アプリは停止せず、最後に起きた問題を1つだけ保持する。種類と解除条件はtypedef`CanvasIssue`。キャンバスパレットの文言（`CanvasPalette`の`ISSUE_MESSAGES`）と、保存の問題（`'unavailable'`・`'writeFailed'`）ではコントロールパネルのキャンバス名の先頭の`⚠ `で示す。`'unavailable'`でも出力（作業ファイル・エンジン用）・インポートは使える（インポートは履歴に記録されるが保存されない）。
9.  **ファイル入出力（出力（作業ファイル）・出力（エンジン用）・開く（ファイル）・インポート） (`CanvasPalette.js` → `main.js` → `CanvasFileOperations.js` → `DocumentFileIO.js`・`DocumentSerializer.js`・`SpriteSerializer.js`・`CodeExporter.js`・`CanvasLibrary.js`・`ShapeInserter.js`・`VectorModel.js`)**：`CanvasFileOperations`（DOMに触れない）が手順の組み立てと通知の状態を担う。ブラウザAPI（`Blob`・`File`）は`DocumentFileIO`（`CanvasFileOperations`へ注入。作業データの中身は解釈しない）に閉じる。読み込みの判定の表・通知の解除条件の正本は`CanvasFileOperations`のクラスJSDoc。
    *   **用語**：**出力（作業ファイル）**（コード上は`exportCanvas`）＝開いているキャンバスを作業データファイルとしてダウンロードする。**出力（エンジン用）**（`exportSprite`）＝開いているキャンバスをスプライトのJSとJSONとしてダウンロードする。**開く（ファイル）**＝ファイルを新しいキャンバスとして一覧へ登録し、開いているキャンバスと入れ替える（一覧の行を押す`openCanvas`とは別）。**インポート**＝ファイルの図形を開いているキャンバスへ追加する。
    *   **出力（作業ファイル）**：`serializeToString(model.getShapes())`を`DocumentFileIO.downloadText`へ渡す。図形・選択集合・履歴・ビュー変換・操作モードに触れず、`beginEdit`/`commitEdit`も呼ばないため自動保存の契機にならない。
    *   **出力（エンジン用）**：形式を選ぶ小窓は出さない。受理条件・通知の消去は出力（作業ファイル）と同じ。`SpriteSerializer.serialize(model.getShapes())` → `SpriteSerializer.stringify`・`CodeExporter.toModuleText`で2つのテキストを先にそろえる → `DocumentFileIO.downloadSpriteModule`（JS）→ `downloadSpriteJson`（JSON）の順。組み立ての失敗ではどちらも落とさず、1つ目の失敗で2つ目を呼ばない。失敗は通知`spriteExportFailed`（2つ目だけ失敗するとJSだけが落ちているため、文言で出し直しを促す）。2つのダウンロードは同じクリックの中で間隔を空けずに続けて行う（ブラウザが複数ダウンロードの許可を尋ねる場合がある。2つ目が落ちないブラウザがあれば間隔の追加を検討する）。図形・選択集合・履歴・ビュー変換・操作モードに触れず、`beginEdit`/`commitEdit`も呼ばないため自動保存の契機にならない。成功時は通知を出さない。スプライトの形は2章「スプライト（書き出し形式）」。
    *   **開く（ファイル）**：読み取り → `deserializeFromString` → 判定 → 読めた場合のみ`CanvasLibrary.createCanvasFromShapes(toCanvasName(ファイル名), 読めた図形)`（切り替え処理をすべて通る。編集操作として記録しない）。`issue`は`'partialLoad'`にせず、一部が読めない旨は通知`partialRead`で示す。
    *   **インポート**：読み取り → `deserializeFromString` → 判定 → キャンバスの同一性の確認（読み取り中に開いているキャンバスが変わっていない・読み込み中でない・処理中でない。`canvasLibrary.getState()`の値で判定する）→ `prepareInsert()`（実体`applyMode(OperationMode.SELECT)`）→ `ShapeInserter.insertDocument(serialize(読めた図形), 0, 0)`。読めた図形を`serialize`し直して渡すのは、`insertDocument`内の再`deserialize`でスキップの`console.warn`が重複しないため。失敗・図形0個では図形一式・選択集合・履歴・操作モード・作成途中の図形に一切触れない。
    *   **ファイル操作の通知**：`fileNotice`は`CanvasFileOperations`が1つだけ保持し、`getState()`でパレットへ渡す。`CanvasLibrary`の`issue`には種類を足さない（解除条件が異なるため）。互いに隠さず別々に表示する。
    *   **読み取り中**：`getState().busy`が真になり、パレットの全操作が押せなくなる。図形の編集（キャンバス操作・ショートカット）は止めない。
    *   **ファイル名とキャンバス名の変換**：`DocumentFileIO`が拡張子（作業データファイル`.ozve.json`・スプライト`.js`/`.json`）と使えない文字・スプライトの先頭の`_`を扱う（規則は2章「ファイル名の規則」）。長さの切り詰め・空の場合の「無題 n」は`CanvasLibrary`が名前の変更と同じ規則で行う。
    *   **旧版のファイル**：読み込みは必ず`DocumentSerializer.deserializeFromString`を通す。`DocumentFileIO`・`CanvasFileOperations`・`CanvasLibrary`・`CanvasPalette`は版の知識を持たない。

---

### 4. 各モジュールの責務リファレンス
本文はモジュールごとのファイルに分かれている。**作業では、該当するモジュールのファイルだけを読むこと。開発資料への反映も該当するモジュールのファイルに対して行うこと。** 新しいモジュールは`_doc/arch/`に同じ形式のファイルを作り、下の一覧に1行追加する。

| モジュール | ファイル |
| --- | --- |
| `index.html` | `_doc/arch/01_index_html.md` |
| `main.js` | `_doc/arch/02_main.md` |
| `VectorModel.js` | `_doc/arch/03_VectorModel.md` |
| `CanvasManager.js` | `_doc/arch/04_CanvasManager.md` |
| `ViewTransform.js` | `_doc/arch/05_ViewTransform.md` |
| `InputTracker.js` | `_doc/arch/06_InputTracker.md` |
| `KeyboardShortcuts.js` | `_doc/arch/07_KeyboardShortcuts.md` |
| `HistoryManager.js` | `_doc/arch/08_HistoryManager.md` |
| `DragTracker.js` | `_doc/arch/09_DragTracker.md` |
| `ShapeFactory.js` | `_doc/arch/10_ShapeFactory.md` |
| `WindowManager.js` | `_doc/arch/11_WindowManager.md` |
| `shapes/` | `_doc/arch/12_shapes.md` |
| `palette/` | `_doc/arch/13_palette.md` |
| `edit/` | `_doc/arch/14_edit.md` |
| `io/` | `_doc/arch/15_io.md` |
| `test/`（自動テスト） | `_doc/arch/16_test.md` |
