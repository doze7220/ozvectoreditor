# RES: 作業計画・作業レポート (Phase 01-03) : キャンバス全体化、右側固定フロートUI、およびツールモード切り替えの基盤確立
* 参照元REQ: `./_log/req/20260808_2345_REQ_Phase01-03_CanvasFullscreen_And_FloatUI.md`

## 1. 作業目的
Phase01-02で確立したLINE専用の入力・描画・座標基盤を土台に、以下4つの基盤整備を並行して行う。
1.  Canvasを画面全体に拡張し、ウィンドウリサイズに追従させる。
2.  画面右側に固定されるフロートUI（コントロールパネル）のDOM/CSSの土台を構築する。
3.  `select`/`line`の明示的なツールモードを導入し、ツールに応じて入力解釈を排他的に切り替えるとともに、選択中図形の削除機能を追加する。
4.  `ShapeFactory`を新設し、`VectorModel`から`Line`への直接依存を排除することで、将来の図形種別追加時に`core/`層を変更不要にする設計へ拡張する。

いずれの整備も、既存の「Model→変更通知→CanvasManager再描画」というPull型MVC構造、および`core/`層への図形種別分岐の非混入を維持したまま行う。

## 2. アーキテクチャ設計

### 要件1: `index.html` / CSSの全画面化とフロートUIの土台構築
*   `body`の`display: flex; justify-content: center; align-items: center;`によるキャンバス中央寄せレイアウトを撤去し、`margin: 0; overflow: hidden;`を基本とした全画面レイアウトへ置き換える。
*   `#editor-canvas`は`position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1;`とし、HTML属性の`width="800" height="600"`は削除する（内部バッファサイズは`CanvasManager.resize()`がJS側で計算・設定するため、CSS上の表示サイズとHTML属性を混同しないこと）。
*   `<div id="control-panel">`をCanvasより手前（`z-index`をCanvasの`1`より大きい値、例: `10`）に固定配置(`position: fixed; top: 0; right: 0;`)する。内部に「ヘッダー領域（将来のドラッグバー想定、本Phaseでは見た目のみ）」と「本体領域（ツールボタン群）」を別要素として分離する。
*   本体領域に「選択ツール」「直線ツール」の2ボタンを配置する。外部アイコンライブラリは使用せず、テキストまたは絵文字＋CSSで表現する。アクティブなツールのボタンを識別するためのCSSクラス（例: `.tool-btn.active`）を用意する。
*   本要件はDOM構造とCSSのみの変更であり、`core/`層のロジックには一切影響しない。

### 要件2: `CanvasManager.resize()`の一本化とdprスケールリセット
*   既存の`initCanvasSize()`を`resize()`という公開メソッドへ改称・一本化し、コンストラクタからの初期化呼び出しと、`main.js`からのリサイズ時呼び出しの両方で同一ロジックを再利用する（ロジックの重複定義を禁止）。
*   `resize()`の先頭で`this.ctx.setTransform(1, 0, 0, 1, 0, 0)`を呼び、それまでの`ctx.scale(dpr, dpr)`によるスケール適用を確実にリセットしてから、最新の`clientWidth`/`clientHeight`・`dpr`に基づき内部バッファサイズと`ctx.scale(dpr, dpr)`を再適用する。これにより、リサイズの度に拡大率が累積するバグを防止する。
*   `CanvasManager`は本要件の変更後も一切shapes配列やModelへの参照を持たない。`resize()`はバッファサイズとdprスケールの再計算のみを行い、`render()`の呼び出しは行わない（再描画トリガーの責務は`main.js`に置く。要件3参照）。これは`PROJECT_ARCHITECTURE.md`に定義された「CanvasManagerは状態を持たない純粋なレンダラー」という責務を維持するための設計判断である。

### 要件3: `main.js`のresizeイベント配線と再描画トリガーの一元化
*   `window.addEventListener('resize', ...)`を`main.js`に追加する。
*   ハンドラ内では、まず`canvasManager.resize()`を呼んでバッファサイズ・スケールを同期させ、その直後に`model.onChange`で登録済みのコールバックと同一の引数構成（`selectedId`/`hoveredId`/`draftLine`）で`canvasManager.render(model.getShapes(), {...})`を呼び出す。
*   `model.onChange`内の再描画呼び出しロジックとresizeハンドラ内の再描画呼び出しロジックで引数構成が重複するため、共通の再描画関数（例: `renderCurrentState()`）を`main.js`内にローカル関数として定義し、`model.onChange`のコールバックとresizeハンドラの双方から呼び出す形に整理する。これは責務の分離ではなく`main.js`内の重複排除であり、MVCの層構造には影響しない。

### 要件4: `ShapeFactory`による図形生成の一元化
*   新規ファイル`./js/core/ShapeFactory.js`を作成し、先頭に「図形オブジェクトの生成責務（Factoryパターン）を担う。」という趣旨の3行以内のJSDoc責務コメントを記述する。
*   `create(type, x1, y1, x2, y2)`静的メソッド（クラスの状態を持たないため`static`メソッドとして実装する）を実装し、`type === 'line'`の場合に`new Line(x1, y1, x2, y2)`を返す。
*   **未知のtypeが渡された場合の方針**: `Error`をthrowする方針を採用する。理由: `null`を返す設計にした場合、呼び出し元（`VectorModel`）でのnullチェック漏れが、`#draftLine`への`null`代入や`shape.draw is not a function`のような、発生箇所から離れた場所での分かりにくいエラーを誘発するリスクがある。生成失敗を呼び出し元へ即座に伝播させ、早期に問題を検知できる`Error`throwを採用することで、将来の図形種別追加時の実装ミスを早期発見しやすくする。
*   `type`によるif/switch分岐は、`core/`層全体を通じてこの`ShapeFactory.create()`内のみに存在することを許容する唯一の例外とする（`PROJECT_ARCHITECTURE.md`および本REQの制約に基づく）。

### 要件5: `VectorModel`のLine直接依存排除とドラフト生成方式の変更
*   ファイル先頭の`import { Line } from '../shapes/Line.js';`を削除し、代わりに`import { ShapeFactory } from './ShapeFactory.js';`を追加する。
*   `startDraft(x, y)`のシグネチャを`startDraft(x, y, type = 'line')`へ変更する（`type`は**末尾に**デフォルト値付きで追加する。JavaScriptのデフォルト引数は該当位置の引数が省略された場合にのみ適用されるため、`type`を先頭に置くと既存の2引数呼び出し`model.startDraft(x, y)`が`x`を`type`として誤って受け取ってしまう。末尾に置くことで、既存呼び出しは`type`省略＝`'line'`デフォルトとして正しく後方互換動作する）。内部の`new Line(x, y, x, y)`を`ShapeFactory.create(type, x, y, x, y)`へ置き換える。この設計により、`InputTracker`側の呼び出し引数更新（要件6）が別タスクとして分割されても、既存の`model.startDraft(x, y)`という呼び出しがその間も直線としてそのまま機能し、タスクの区切り目で動作確認が壊れない。
*   `updateDraft(x, y)`内の`this.#draftLine.x2 = x; this.#draftLine.y2 = y;`という直接プロパティアクセスを、`this.#draftLine.setVertex(1, x, y)`へのポリモーフィックな呼び出しに置き換える。
*   `deleteShape(id)`を新設する。`#shapes`から該当idの図形を除去し、削除対象が`#selectedId`または`#hoveredId`と一致していた場合はそれらも同時に`null`へクリアしたうえで、`#notifyChange()`を呼ぶ（存在しない図形のidが選択/ホバー状態に残留することを防ぐ）。
*   `#draftLine`のJSDoc型注記`@type {Line|null}`を、Line依存排除の趣旨に合わせて`@type {Object|null}`（draw/setVertex等の共通インターフェースを持つ図形オブジェクト、である旨の説明を付記）へ更新する。
*   本要件の変更後も、`VectorModel`内に図形種別のif/switch分岐は一切持ち込まない（生成は`ShapeFactory`へ完全委譲、更新は既存の`setVertex`/`translate`へのポリモーフィック委譲を維持）。

### 要件6: `InputTracker`へのツールモード導入と図形削除
*   コンストラクタに`this.currentTool = 'select'`を追加する。
*   `setTool(tool)`を新設し、呼び出し時に必ず次の3点を行う: (1)`this.currentTool`の更新、(2)`this.model.clearSelection()`と`this.model.clearHovered()`の無条件呼び出し、(3)呼び出し時点の状態が`DRAWING`または`DRAGGING_HANDLE`であれば`model.cancelDraft()`を呼び、`this.state`を強制的に`IDLE`へリセットする。
*   `handleMouseMove`のIDLE時ホバー判定処理を`this.currentTool === 'select'`の場合のみ実行するようガードする（`line`ツール中はホバー判定・`setHovered`/`clearHovered`を一切呼ばない）。
*   `handleMouseDown`のハンドル検出処理（`hitTestHandle`呼び出し）を`this.currentTool === 'select'`の場合のみ実行するようガードする。
*   `handleClick`のIDLE時分岐を、`currentTool`に応じて次のように書き換える。
    *   `select`ツール中: `hoveredId`があれば`selectShape`のみ、なければ選択中なら`clearSelection`のみを呼ぶ。`startDraft`は一切呼ばない。
    *   `line`ツール中: ホバー判定を行っていないため、常に`this.model.startDraft(x, y, 'line')`を呼び`DRAWING`へ遷移する（引数順序は要件5の`startDraft(x, y, type = 'line')`に合わせる）。
*   `DRAWING`状態での`commitDraft()`実行後は`this.state`のみを`IDLE`へ戻し、`currentTool`は変更しない（連続作成を可能にするため）。
*   `keydown`イベントリスナーを新設する。**購読先は`document`とする**（`<canvas>`要素はデフォルトでフォーカスを持てずキーボードイベントを受け取れないため、既存のマウスイベント群のように`this.canvas`へバインドしてはならない）。`this.currentTool === 'select'`かつ`this.model.getSelectedId()`が存在し、押下キーが`Delete`または`Backspace`である場合のみ、`event.preventDefault()`を呼んだうえで`this.model.deleteShape(selectedId)`を実行する。
*   `getLogicalCoordinate`のDPI対応・CSSズーム吸収ロジックには一切手を加えない（本REQの制約事項に基づく）。
*   本要件の変更後も、`InputTracker`内に図形種別のif/switch分岐は一切持ち込まない（`hitTest`/`hitTestHandle`へのポリモーフィックな呼び出しのみを維持）。

### 要件7: `main.js`のツールボタン配線とイベント伝播制御
*   フロートパネル内の「選択ツール」「直線ツール」ボタンの`click`イベントを購読し、それぞれ`inputTracker.setTool('select')`/`inputTracker.setTool('line')`を呼ぶ。
*   コントロールパネルのコンテナ要素に対し、`mousedown`/`click`/`mousemove`の各イベントで`event.stopPropagation()`を実行し、UI操作がCanvas側の`InputTracker`へ伝播して意図しない選択解除・ライン描画開始を引き起こさないようにする。
*   アクティブなツールのボタンへCSSクラス（要件1で用意する`.active`等）を付与/削除する処理を、`setTool`呼び出しと同じクリックハンドラ内で行う。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./`（`index.html`）, `./js/core/`, `./js/shapes/`
*   **関連する論理クラス**: `CanvasManager`, `VectorModel`, `InputTracker`, `ShapeFactory`（新設）, `Line`（変更なし、生成経路のみ変化）
*   **参照する責務**（`PROJECT_ARCHITECTURE.md`より抜粋）:
    *   `VectorModel.js`: 「描画データ（Shape配列）と選択状態を保持する単一の真実（SSOT）」
    *   `CanvasManager.js`: 「Canvasへの純粋な描画（レンダラーの責務）。状態は持たない。」
    *   `InputTracker.js`: 「マウス・キーボード入力の解釈、キャンバス座標への変換」

### 開発資料（PROJECT_ARCHITECTURE.md）の更新予定
本Phaseの実装が完了した時点で、以下の更新が必要になる見込みである（実際の更新はタスク8で行う）。
*   セクション1のフォルダ構造図に`js/core/ShapeFactory.js`を追記する。
*   セクション4に`ShapeFactory.js`の責務記述を新規追加する（例:「図形typeに応じたインスタンス生成を一元的に担うFactory。`core/`層で図形種別分岐を許容する唯一の例外。」）。
*   `VectorModel.js`の責務記述に、`Line`への直接依存を廃し`ShapeFactory`経由で生成する旨、`deleteShape(id)`の追加、`startDraft(x, y, type = 'line')`へのシグネチャ変更を追記する。
*   `CanvasManager.js`の責務記述に、`initCanvasSize()`が`resize()`へ一本化された旨を追記する。
*   `InputTracker.js`の責務記述に、`currentTool`（`select`/`line`）の保持と`setTool(tool)`によるツール切り替え、ツールに応じた排他的な入力解釈、`Delete`/`Backspace`による図形削除を追記する。

## 3. タスクリスト
*   [x] タスク1: `index.html`/CSSの全画面化とフロートUI（コントロールパネル）のDOM/CSS土台構築
    *   **対象ファイル** :
        *   `./index.html` : 更新
    *   **作業内容** :
        *   `body`の中央寄せflexboxレイアウトを撤去し、全画面表示用スタイル（`margin: 0; overflow: hidden;`）に置き換える。
        *   `#editor-canvas`を`position: absolute; top:0; left:0; width:100vw; height:100vh; z-index:1;`とし、HTML属性`width="800" height="600"`を削除する。
        *   `<div id="control-panel">`（ヘッダー領域・本体領域を分離したDOM構造）を右側固定(`position: fixed; top:0; right:0;`, `z-index`をCanvasより大きい値)で新設し、「選択ツール」「直線ツール」ボタンを配置、アクティブツール強調用CSSクラスを用意する。
        *   本タスクはHTML/CSSのみの変更のため、JSDoc記載漏れ確認は対象外（`.js`ファイルの変更なし）。

*   [x] タスク2: `CanvasManager.resize()`の一本化とdprスケールリセット
    *   **対象ファイル** :
        *   `./js/core/CanvasManager.js` : 更新
    *   **作業内容** :
        *   `initCanvasSize()`を公開メソッド`resize()`へ改称し、コンストラクタから`this.resize()`を呼ぶ形に変更する。
        *   `resize()`の先頭に`this.ctx.setTransform(1, 0, 0, 1, 0, 0)`を追加し、その後に既存のバッファサイズ計算・`ctx.scale(dpr, dpr)`適用ロジックを続ける。
        *   `render()`の呼び出しは`resize()`内に含めないことを確認する（shapes/Model参照を持たない状態を維持）。
        *   JSDocコメント（メソッドの責務説明）の記載漏れがないことを確認し、`initCanvasSize`から`resize`への改称に合わせて内容を更新する。

*   [x] タスク3: `main.js`のresizeイベント配線と再描画トリガーの一元化
    *   **対象ファイル** :
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   `model.onChange`コールバックと同一の引数構成で`canvasManager.render(...)`を呼び出すローカル関数（例: `renderCurrentState`）を定義し、`model.onChange`のコールバックから呼び出す形に整理する。
        *   `window.addEventListener('resize', ...)`を追加し、ハンドラ内で`canvasManager.resize()`を呼んだ直後に`renderCurrentState()`を呼び出す。
        *   JSDocコメントの記載漏れがないことを確認する。

*   [x] タスク4: `ShapeFactory.js`の新設
    *   **対象ファイル** :
        *   `./js/core/ShapeFactory.js` : 新規
    *   **作業内容** :
        *   ファイル先頭に「図形オブジェクトの生成責務（Factoryパターン）を担う。」という趣旨の3行以内のJSDoc責務コメントを記述する。
        *   `Line`をimportし、`create(type, x1, y1, x2, y2)`静的メソッドを実装する。`type === 'line'`なら`new Line(x1, y1, x2, y2)`を返し、未知の`type`の場合は`Error`をthrowする（アーキテクチャ設計の要件4に記載の方針に従う）。
        *   JSDocコメント（クラス・メソッドの責務、引数、戻り値、例外）の記載漏れがないことを確認する。

*   [x] タスク5: `VectorModel.js`のLine直接依存排除とドラフト生成方式の変更
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` : 更新
    *   **作業内容** :
        *   `import { Line } from '../shapes/Line.js';`を`import { ShapeFactory } from './ShapeFactory.js';`に置き換える。
        *   `startDraft(x, y)`を`startDraft(x, y, type = 'line')`に変更し（`type`は末尾・デフォルト値付き。理由は「2. アーキテクチャ設計」要件5を参照）、内部で`ShapeFactory.create(type, x, y, x, y)`を呼び出す形に変更する。
        *   `updateDraft(x, y)`内の直接プロパティ代入を`this.#draftLine.setVertex(1, x, y)`へ置き換える。
        *   `deleteShape(id)`を新設し、`#shapes`からの除去、`#selectedId`/`#hoveredId`が一致する場合のクリア、`#notifyChange()`呼び出しを実装する。
        *   `#draftLine`のJSDoc型注記を`Line`依存を含まない表現へ更新する。
        *   JSDocコメント（`startDraft`のシグネチャ変更、`deleteShape`の新規追加分）の記載漏れがないことを確認する。

*   [x] タスク6: `InputTracker.js`へのツールモード導入と図形削除機能の追加
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   コンストラクタに`this.currentTool = 'select'`を追加する。
        *   `setTool(tool)`を新設し、ツール更新・選択/ホバー状態の無条件クリア・進行中操作の強制中断（`cancelDraft`＋`IDLE`復帰）を実装する。
        *   `handleMouseMove`のホバー判定、`handleMouseDown`のハンドル検出を、いずれも`this.currentTool === 'select'`のガード付きに変更する。
        *   `handleClick`のIDLE時分岐を`currentTool`に応じた排他処理（`select`: 選択/選択解除のみ、`line`: 常に`startDraft(x, y, 'line')`）に書き換える。
        *   `commitDraft()`実行後も`currentTool`を維持したまま`IDLE`へ戻す（既存の実装が該当箇所であることを確認のうえ、ツール自動切り替えが発生しないことを確認する）。
        *   `document`を購読先として`keydown`イベントリスナーを追加し、`select`ツール中に選択中図形がある状態での`Delete`/`Backspace`押下で`event.preventDefault()`＋`model.deleteShape(selectedId)`を実行する。
        *   `getLogicalCoordinate`には一切変更を加えないことを確認する。
        *   JSDocコメント（`setTool`、`keydown`ハンドラ、`currentTool`プロパティ等）の記載漏れがないことを確認する。

*   [x] タスク7: `main.js`のツールボタン配線とイベント伝播制御
    *   **対象ファイル** :
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   「選択ツール」「直線ツール」ボタンの`click`イベントを購読し、`inputTracker.setTool('select')`/`inputTracker.setTool('line')`を呼び出す。
        *   同ハンドラ内でアクティブツールのボタンへCSSクラス（`.active`等）を付与/削除する処理を実装する。
        *   コントロールパネルのコンテナ要素に対し、`mousedown`/`click`/`mousemove`イベントで`event.stopPropagation()`を実装する。
        *   JSDocコメントの記載漏れがないことを確認する。

*   [x] タスク8（固定タスク）: `PROJECT_ARCHITECTURE.md`の更新確認
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（影響がある場合のみ）
    *   **作業内容** :
        *   タスク1〜7の実装内容が、本RES「2. アーキテクチャ設計」内の「開発資料（PROJECT_ARCHITECTURE.md）の更新予定」に記載した内容と相違ないか確認し、セクション1（フォルダ構造）およびセクション4（各モジュールの責務リファレンス）を実装結果に合わせて更新する。

## 4. 詳細作業内容
### タスク1: `index.html`/CSSの全画面化とフロートUI（コントロールパネル）のDOM/CSS土台構築
*   **作業内容** :
    *   `body`の中央寄せflexboxレイアウト（`display: flex; justify-content: center; align-items: center; height: 100vh;`）を撤去し、`margin: 0; overflow: hidden;`を基本とした全画面レイアウトへ置き換えた。
    *   `#editor-canvas`を`position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1;`に変更し、HTML属性`width="800" height="600"`を削除した（内部バッファサイズは今後`CanvasManager.resize()`側で設定する想定。本タスクではJS未変更のため、現時点では内部バッファサイズがブラウザデフォルト値のままである点に注意）。
    *   キャンバスの`border`/`box-shadow`はフルスクリーン化に伴い撤去した（画面端に枠線があると全画面感を損なうため）。
    *   `<div id="control-panel">`を`position: fixed; top: 0; right: 0; z-index: 10;`で新設し、内部を`#control-panel-header`（ヘッダー領域、将来のドラッグバー想定・本Phaseでは見た目のみ）と`#control-panel-body`（本体領域、ツールボタン群）に分離した。
    *   本体領域に「🖱 選択ツール」（`#tool-select`）「／ 直線ツール」（`#tool-line`）の2ボタンを配置し、両方に共通クラス`.tool-btn`、アクティブ識別用に`.tool-btn.active`を用意した。外部アイコンライブラリは使用せず、絵文字＋テキストで表現した。初期状態は選択ツールを`active`とした（`InputTracker`のデフォルト`currentTool = 'select'`と整合させる意図。実際の配線はタスク7で行う）。
    *   本タスクはHTML/CSSのみの変更であり、`.js`ファイルには一切触れていない（JSDoc記載漏れ確認は対象外）。

### タスク2: `CanvasManager.resize()`の一本化とdprスケールリセット
*   **作業内容** :
    *   `initCanvasSize()`を公開メソッド`resize()`へ改称し、コンストラクタ内の呼び出しを`this.initCanvasSize()`から`this.resize()`へ変更した。
    *   `resize()`の先頭（`dpr`取得の直後、`logicalWidth`/`logicalHeight`取得の前）に`this.ctx.setTransform(1, 0, 0, 1, 0, 0)`を追加し、既存の`ctx.scale(dpr, dpr)`適用を確実にリセットしてから、後続のバッファサイズ計算・`ctx.scale(dpr, dpr)`再適用ロジックを実行する構成にした。
    *   `resize()`内に`render()`の呼び出しは追加していない。`this.canvas`/`this.ctx`以外のプロパティ（shapes配列やModelへの参照）も本タスクでは一切追加しておらず、「状態を持たない純粋なレンダラー」の責務を維持している。
    *   メソッド先頭のJSDocコメントを、`initCanvasSize`から`resize`への改称に合わせて「コンストラクタからの初期化と、ウィンドウリサイズ時の再同期（呼び出し元は`main.js`）の両方から呼ばれる公開メソッドである」旨、および「render()を呼ばない」旨を明記する内容へ更新した。

### タスク3: `main.js`のresizeイベント配線と再描画トリガーの一元化
*   **作業内容** :
    *   `model.onChange`のコールバック内にインライン記述されていた`canvasManager.render(model.getShapes(), { selectedId, hoveredId, draftLine })`呼び出しを、`DOMContentLoaded`ハンドラ内のローカル関数`renderCurrentState()`として切り出した。
    *   `model.onChange(() => { ... })`のアロー関数本体を、切り出した`renderCurrentState`への参照渡し（`model.onChange(renderCurrentState)`）に置き換えた。
    *   `window.addEventListener('resize', ...)`を新設し、ハンドラ内で`canvasManager.resize()`を呼んだ直後に`renderCurrentState()`を呼ぶ順序を厳守して実装した（要件3・作業計画書の指示通り）。
    *   `renderCurrentState`の定義位置は、`inputTracker`生成後・`model.onChange`登録前とした（`model.onChange`とresizeハンドラの両方から参照する前に関数宣言が完了している必要があるため）。
    *   `renderCurrentState`関数自体にJSDocコメントを追加し、「model.onChangeのコールバックとresizeハンドラの双方から呼び出す共通の再描画関数」である旨を明記した。既存の`main.js`先頭の責務コメント（各モジュールの初期化と連携を担う）の範囲を逸脱しないことを確認した。

### タスク4: `ShapeFactory.js`の新設
*   **作業内容** :
    *   新規ファイル`./js/core/ShapeFactory.js`を作成した。ファイル先頭に「図形typeに応じたインスタンス生成を一元的に担うFactory。`core/`層で図形種別分岐を許容する唯一の例外。」という趣旨の2行のJSDoc責務コメントを記述した（3行以内の制約を満たす）。
    *   `import { Line } from '../shapes/Line.js';`を追加し、`ShapeFactory`クラス内に`create(type, x1, y1, x2, y2)`静的メソッドを実装した。`type === 'line'`の場合は`new Line(x1, y1, x2, y2)`を返す。
    *   未知の`type`が渡された場合は、要件4の方針に従い`Error`をthrowする実装とした（`throw new Error(`ShapeFactory: unknown shape type "${type}"`);`）。エラーメッセージに渡された`type`の値を含めることで、呼び出し元でのデバッグを容易にした（本Phaseの要件には明記されていないが、Error throw方針の実効性を高めるための軽微な補足であり、責務や設計方針の逸脱ではない）。
    *   `create`メソッドは状態を持たないため`static`として実装し、クラス自体もインスタンス化を想定しない設計とした。
    *   JSDocコメントはクラス責務コメント、`create`メソッドの`@param`（type/x1/y1/x2/y2）、`@returns`、`@throws`を全て記載し、記載漏れがないことを確認した。
    *   本タスクは新規ファイル`./js/core/ShapeFactory.js`のみを対象とし、既存ファイル（`VectorModel.js`等）には一切触れていない（タスク5以降で対応予定のため）。

### タスク5: `VectorModel.js`のLine直接依存排除とドラフト生成方式の変更
*   **作業内容** :
    *   `import { Line } from '../shapes/Line.js';`を`import { ShapeFactory } from './ShapeFactory.js';`に置き換えた。
    *   `startDraft(x, y)`を`startDraft(x, y, type = 'line')`へ変更した（`type`は末尾・デフォルト値付き。既存の2引数呼び出し`model.startDraft(x, y)`が後方互換動作するようにするため、要件5の設計方針通り末尾に配置した）。内部の`new Line(x, y, x, y)`を`ShapeFactory.create(type, x, y, x, y)`へ置き換えた。
    *   `updateDraft(x, y)`内の`this.#draftLine.x2 = x; this.#draftLine.y2 = y;`という直接プロパティ代入を、`this.#draftLine.setVertex(1, x, y)`へのポリモーフィックな呼び出しに置き換えた（`Line.setVertex(vertexIndex, x, y)`の実装を`./js/shapes/Line.js`で事前に確認し、`vertexIndex=1`が終点を指すことを確認済み）。
    *   `deleteShape(id)`を新設した。`#shapes`から`findIndex`で該当idを検索し、存在すれば`splice`で除去、削除対象が`#selectedId`または`#hoveredId`と一致していた場合はそれぞれを`null`へクリアしたうえで`#notifyChange()`を呼ぶ実装とした。該当図形が存在しない場合（`findIndex`が`-1`）は何もせず早期returnする（既存の`updateVertex`/`moveShape`と同様の「存在しない場合は何もしない」規約に合わせた）。
    *   `#draftLine`のJSDoc型注記を`@type {Line|null}`から`@type {Object|null}`へ変更し、「draw/setVertex等の共通インターフェースを持つ図形オブジェクト。ShapeFactory経由で生成される」旨を付記した。`getDraftLine()`の`@returns`コメントも同様に`Line|null`から`Object|null`へ更新した。
    *   本タスクの変更後も、`VectorModel`内に図形種別のif/switch分岐は一切追加していない（生成は`ShapeFactory.create()`へ完全委譲、更新は既存の`setVertex`/`translate`へのポリモーフィック委譲を維持）。
    *   JSDocコメントの記載漏れ（`startDraft`の`@param {string} [type='line']`追加、`deleteShape`の`@param`/責務コメント）を確認し、全て記載した。

### タスク6: `InputTracker.js`へのツールモード導入と図形削除機能の追加
*   **作業内容** :
    *   コンストラクタに`this.currentTool = 'select'`を追加した（`this.state`の初期化直後、既存プロパティ群の宣言順序を崩さない位置に配置）。JSDocで「setTool()経由でのみ更新する」旨を明記した。
    *   `setTool(tool)`を新設した。呼び出し時は必ず(1)`this.currentTool = tool`による更新、(2)`this.model.clearSelection()`・`this.model.clearHovered()`の無条件呼び出し（早期returnなしで両方常に実行）、(3)`this.state`が`DRAWING`または`DRAGGING_HANDLE`の場合のみ`this.model.cancelDraft()`を呼び`this.state`を`InputState.IDLE`へ強制リセット、の3処理をこの順序で実装した。
    *   `handleMouseMove`のIDLE時ホバー判定分岐のガード条件を`if (this.state !== InputState.IDLE) { return; }`から`if (this.state !== InputState.IDLE || this.currentTool !== 'select') { return; }`へ変更し、`line`ツール中はホバー判定（`setHovered`/`clearHovered`）を一切呼ばないようにした。
    *   `handleMouseDown`のガード条件を同様に`if (this.state !== InputState.IDLE || this.currentTool !== 'select') { return; }`へ変更し、`hitTestHandle`呼び出しを含むハンドル検出処理全体を`select`ツール中のみに限定した。
    *   `handleClick`のIDLE時分岐を、`currentTool`による分岐へ書き換えた。`select`ツール中は、`hoveredId`があれば`this.model.selectShape(hoveredId)`のみを呼んでreturnし、`hoveredId`がなく選択中図形がある場合は`this.model.clearSelection()`のみを呼んでreturnする（いずれの経路でも`startDraft`は呼ばない）。`line`ツール中は、ホバー判定を行っていない前提のため無条件に`this.model.startDraft(x, y, 'line')`を呼び`this.state = InputState.DRAWING`へ遷移する（要件5で確定した`startDraft(x, y, type = 'line')`のシグネチャに合わせ、`x, y, 'line'`の順序で渡した）。
    *   `handleClick`冒頭の`DRAWING`状態分岐（`commitDraft()` → `this.state = InputState.IDLE`）は既存実装のまま変更していないことを確認した。`this.currentTool`を書き換える処理は追加していないため、`commitDraft()`実行後も直前の`currentTool`（`line`）が維持され、連続してLine作成を続行できる。
    *   `keydown`イベントリスナーを`this.canvas`ではなく`document`へ`addEventListener`で登録した（`<canvas>`要素はデフォルトでフォーカスを持てずキーボードイベントを受け取れないため。コンストラクタ内、既存の4つのcanvas向けリスナー登録に続けて追加）。
    *   `handleKeyDown(event)`を新設した。`this.currentTool !== 'select'`なら即return、`this.model.getSelectedId()`が`null`なら即return、押下キーが`event.key !== 'Delete' && event.key !== 'Backspace'`なら即return、という3段の早期returnを経て、条件を満たす場合のみ`event.preventDefault()`を呼んだ直後に`this.model.deleteShape(selectedId)`を実行する実装とした。
    *   `getLogicalCoordinate`には一切変更を加えていないことを確認した（差分なし）。
    *   JSDocコメントは、`currentTool`プロパティ、`setTool`メソッド（責務・`@param`）、`handleKeyDown`メソッド（責務・`document`購読である理由・`@param`）について全て記載し、記載漏れがないことを確認した。既存メソッド（`handleMouseMove`/`handleMouseDown`/`handleClick`）のJSDocは、ガード条件の追加のみで処理の大枠自体は変わっていないため、既存の記述内容と齟齬がないことを確認したうえで変更していない。
    *   本タスクの変更後も、`InputTracker`内に図形種別のif/switch分岐は一切追加していない（`hitTest`/`hitTestHandle`へのポリモーフィックな呼び出しのみを維持。`currentTool`による分岐はツールモードの分岐であり図形種別の分岐ではない）。

### タスク7: `main.js`のツールボタン配線とイベント伝播制御
*   **作業内容** :
    *   `DOMContentLoaded`ハンドラ内、`resize`イベント配線の直後に「4. フロートパネル（コントロールパネル）配線」ブロックを追加した。`document.getElementById`で`#control-panel`・`#tool-select`・`#tool-line`を取得した。
    *   ツールボタンのクリックハンドラを生成するローカル関数`createToolClickHandler(tool, activeBtn, inactiveBtn)`を定義し、`inputTracker.setTool(tool)`の呼び出しと、アクティブ化対象ボタンへの`classList.add('active')`／非アクティブ化対象ボタンへの`classList.remove('active')`を同一クロージャ内で行う実装とした（要件7「同じクリックハンドラ内で行う」という制約に従うため、`setTool`呼び出しとCSSクラス操作を分離せず1つの関数にまとめた）。
    *   `toolSelectBtn`に`createToolClickHandler('select', toolSelectBtn, toolLineBtn)`を、`toolLineBtn`に`createToolClickHandler('line', toolLineBtn, toolSelectBtn)`をそれぞれ`click`イベントで購読させた。`index.html`の初期状態（`#tool-select`のみ`active`）と初期`currentTool = 'select'`（`InputTracker`側）が整合しているため、初期化時点で追加のクラス操作は行っていない。
    *   `controlPanel`に対し、`mousedown`/`click`/`mousemove`の3イベントそれぞれに`(event) => event.stopPropagation()`という個別のリスナーを登録した（要件7「3イベットすべてに実装すること」に従い、1つのリスナーで複数イベントをまとめて処理するのではなく、イベントごとに独立したリスナーを登録する方式を採った）。
    *   `stopPropagation`はコントロールパネルの最上位コンテナ`#control-panel`（`controlPanel`変数）にのみ登録した。`#control-panel-header`/`#control-panel-body`/各`.tool-btn`は`#control-panel`の子要素であり、バブリングにより`#control-panel`側のリスナーで捕捉されるため、子要素個別へのリスナー登録は行っていない。
    *   ツールボタンの`click`イベントは、`document.addEventListener('click', ...)`のようなdocument購読ではなくボタン要素自体への直接購読であるため、`controlPanel`の`click`リスナー（`stopPropagation`のみを行う）とはバブリングの順序上、ボタン要素側のリスナー（`createToolClickHandler`が返す関数）が先に発火し、その後バブリングで`controlPanel`側の`stopPropagation`が発火する。両リスナーの実行順序が処理内容に影響しないこと（`setTool`呼び出し自体は`stopPropagation`の有無に依存しない）を確認済み。
    *   JSDocコメントは、新設した`createToolClickHandler`関数に責務・`@param`（`tool`/`activeBtn`/`inactiveBtn`）・`@returns`を記載した。`main.js`ファイル先頭の責務コメント（「各モジュールの初期化と連携(依存性の注入)を担う」）の範囲内の変更（DOM要素取得とイベント購読の追加）であり、責務の逸脱はないことを確認した。
    *   本タスクの変更は`./js/main.js`のみが対象であり、`index.html`・`InputTracker.js`等の既存実装には一切手を加えていない（タスク1・6で完了済みのボタンDOM・`setTool`メソッドをそのまま利用した）。

### タスク8（固定タスク）: `PROJECT_ARCHITECTURE.md`の更新確認
*   **作業内容** :
    *   `PROJECT_CONSTITUTION.md`を読み込んだうえで、本RES「2. アーキテクチャ設計」内「開発資料（PROJECT_ARCHITECTURE.md）の更新予定」に記載の5項目それぞれについて、実際の実装ファイル（`./index.html`、`./js/core/ShapeFactory.js`、`./js/core/VectorModel.js`、`./js/core/CanvasManager.js`、`./js/core/InputTracker.js`、`./js/main.js`）を直接確認し、記載予定内容と実装内容に相違がないことを確認した（相違点はなかった）。
    *   `./PROJECT_ARCHITECTURE.md`のセクション1（フォルダ構造図）の`js/core/`配下リストに`ShapeFactory.js`を追記した。
    *   セクション4（各モジュールの責務リファレンス）を以下の通り更新した。
        *   `VectorModel.js`の記述末尾に、`Line`への直接依存を持たず`ShapeFactory.create(type, x1, y1, x2, y2)`へ生成を完全委譲する旨、`startDraft(x, y, type = 'line')`のシグネチャである旨、`deleteShape(id)`が選択中/ホバー中状態のクリアも行う旨を追記した。
        *   `CanvasManager.js`の記述末尾に、`initCanvasSize()`を一本化・改称した公開メソッド`resize()`がコンストラクタ初期化と`main.js`からのリサイズ時再同期の両方から呼ばれる旨、`resize()`は`render()`を呼ばずバッファサイズ・スケール再計算のみを行う旨を追記した。
        *   `InputTracker.js`の記述末尾に、`currentTool`(`'select'`/`'line'`)の保持と`setTool(tool)`によるツール切り替え（選択/ホバー状態の無条件クリア、進行中操作の強制中断）、`currentTool`に応じた`handleMouseMove`/`handleMouseDown`/`handleClick`の排他的な入力解釈、`document`購読の`keydown`ハンドラによる`Delete`/`Backspace`図形削除を追記した。
        *   `ShapeFactory.js`の責務記述を新規箇条書きとして`InputTracker.js`の直後（`shapes/`セクションの手前、`core/`層の並び順を維持する位置）に追加した。
    *   本タスクでは`./PROJECT_ARCHITECTURE.md`以外のファイルには一切触れていない（`PROJECT_CONSTITUTION.md`の「REQ指定外ファイル参照の絶対禁止ルール」に基づき、本タスクの確認対象として明示された実装ファイル群と本RESファイル自体を除き、他のドキュメント（`_doc/`配下等）は読み込んでいない）。

## 5. 懸念事項・要確認ポイント
*   `ShapeFactory.create()`の未知type時の挙動について、本計画では「Errorをthrowする」方針を採用したが、発注者の意図と合致するか実装前に確認を推奨する（要件4参照）。
*   コントロールパネルの`z-index`をCanvas（`z-index: 1`）より確実に大きい値に設定できているか、実機のブラウザ上で目視確認を推奨する（要件1・タスク1）。
*   `resize()`のdprスケールリセットについて、ウィンドウサイズを複数回変更した際に描画の拡大率が累積しないことを、実際にブラウザ上でリサイズを繰り返して目視確認することを強く推奨する（要件2・タスク2、REQ内で明示的に警告されているバグのため）。
*   `line`ツール中はホバー判定自体を行わないため、ホバー時の視覚的フィードバック（カーソル形状の変化等）が本Phaseの範囲では一切ないことを認識しておくこと。カーソル形状の出し分け等が必要な場合は後続Phaseでの追加要件となる。
*   `Delete`/`Backspace`キーによる図形削除で`event.preventDefault()`を呼ぶ際、将来的にテキスト入力可能なUI要素（カラーコード入力欄等）が追加された場合は、フォーカス中の要素を判定して除外するロジックの追加が必要になる（本Phaseでは対象要素が存在しないため対応不要、REQにも明記された既知の将来課題）。
*   フロートパネルの「選択ツール」「直線ツール」ボタンのアクティブ状態CSSが、意図通りに視覚的な強調として機能しているか目視確認を推奨する（要件1・7、タスク1・7）。
*   【タスク4実施分・追記】`ShapeFactory.create()`は本タスク単体では`VectorModel.js`から一切呼び出されていない（`VectorModel.js`の`import`切り替え・呼び出し箇所の置き換えはタスク5で対応予定）。そのため、本タスク完了時点ではアプリの動作に変化はなく、`ShapeFactory.js`は未使用の孤立ファイルとして存在する状態である。これは意図した中間状態であり、タスク5完了までは実際に動作確認できない点に注意すること。
*   未知の`type`が渡された際に`Error`をthrowする実装としたが、呼び出し元（タスク5で変更予定の`VectorModel.startDraft`）でこの例外を`try/catch`する設計にはしていない（本REQ・RESの要件にも記載がないため）。そのため、将来的にUI側（`main.js`のツールボタン配線等）が`ShapeFactory.create`に渡す`type`文字列を誤って生成した場合、キャッチされない例外としてコンソールにスタックトレースが出力され、以降の処理が中断される。ツール種別を増やす際は、呼び出し元の`type`文字列の綴りに注意すること。
*   【タスク1実施分・追記】本タスクではHTML属性`width="800" height="600"`を削除したのみで、`CanvasManager`側の内部バッファサイズ設定（`resize()`）はまだ未実装（タスク2で対応予定）。そのため、タスク2着手前にブラウザで`index.html`を開くと、Canvasの内部解像度がブラウザデフォルト（300x150）のままCSSで100vw/100vhに引き伸ばされ、描画がぼやける・座標がズレる状態になる。これは意図した中間状態であり、タスク2完了までは正常表示されない点を認識しておくこと。
*   `#editor-canvas`の`border`/`box-shadow`をフルスクリーン化に伴い削除した。中央寄せカード風だった旧デザインからキャンバス端の視覚的な区切りがなくなるため、意図通りかどうか目視確認を推奨する。将来的にキャンバス領域の境界を示したい場合は、`body`の背景色とキャンバスの背景色を変える等の代替案を検討すること。
*   `#control-panel-header`は本Phaseでは非機能（ドラッグ不可、見た目のみ）。将来ドラッグ移動機能を実装する際は、`mousedown`のイベント伝播制御（要件7でパネル全体に`stopPropagation`を予定）との整合を確認すること。
*   【タスク2実施分・追記】本タスクの完了時点では`resize()`を呼び出す経路がコンストラクタのみ（`main.js`のresizeイベント配線はタスク3で対応予定）であるため、実際にウィンドウをリサイズしても`resize()`は再実行されず、拡大率が累積しないことの目視確認はタスク3完了後まで行えない。タスク3実装後に改めてウィンドウサイズを複数回変更し、描画が意図通りの拡大率で維持されるか確認することを推奨する。
*   `resize()`内で`render()`を呼んでいないため、本タスク単体の変更後も`main.js`側でresize時の再描画配線（タスク3）が入るまでは、リサイズ時に画面上の図形描画が一時的に消える・ズレる状態になり得る。これは要件2・3で意図された責務分割（`CanvasManager`はバッファ再計算のみ、再描画トリガーは`main.js`側で一元管理）による正常な中間状態であり、タスク2の実装漏れではない点に注意すること。
*   【タスク3実施分・追記】`renderCurrentState()`は`model.getShapes()`/`model.getSelectedId()`/`model.getHoveredId()`/`model.getDraftLine()`を呼び出す都度、その時点のModel最新状態を参照する（クロージャで値をキャプチャしているのではなく、呼び出しの都度Modelへ問い合わせる構造）。そのため、resizeハンドラ内で`canvasManager.resize()`の直後に呼んでも、リサイズ操作自体はModelの状態（選択中図形やドラフト等）を変化させないため、リサイズ前後で選択状態やドラフト中の図形が保持されたまま正しい位置に再描画される。この前提（`renderCurrentState`が副作用なしにModelの現在値を読むだけの関数である）を崩すような変更を将来加える場合は、resizeハンドラ側への影響も併せて確認すること。
*   `window.addEventListener('resize', ...)`はリスナー登録のみで、`removeEventListener`によるクリーンアップ処理は実装していない（本アプリはページ全体で単一のCanvas/Model/InputTrackerインスタンスのみを扱うSPA的構成であり、`DOMContentLoaded`ハンドラが再実行されることも`canvas`要素が動的に破棄・再生成されることもないため、リスナーの多重登録やメモリリークは発生しない）。将来、複数Canvasインスタンスの動的生成・破棄を行うような設計変更が入る場合は、対応するクリーンアップ処理の追加を検討すること。
*   ブラウザの`resize`イベントはウィンドウサイズ変更中に連続発火する（デバウンス・スロットリングを行っていない）。現状の`resize()`＋`renderCurrentState()`は軽量な処理のため本Phaseでは問題にならない想定だが、将来的に図形数が大幅に増加し描画コストが上がった場合は、パフォーマンス低下の可能性があるため、必要に応じてデバウンス処理の追加を検討すること（本Phaseの要件には含まれていないため未実装）。
*   タスク2の懸念事項に記載の「リサイズを繰り返した際に拡大率が累積しないか」の目視確認は、本タスク（タスク3）の完了によりresize時の再描画経路が揃ったため、実際にブラウザ上でウィンドウサイズを複数回変更して確認可能な状態になった。次回の実機確認時に併せて検証することを推奨する。
*   【タスク6実施分・追記】本タスク完了時点では、`main.js`側のツールボタン配線（`inputTracker.setTool(...)`の呼び出し）がまだ存在しない（タスク7で対応予定）。そのため、`InputTracker`の`currentTool`は常にコンストラクタ初期値の`'select'`のままとなり、`setTool('line')`を実際に呼んで`line`ツールへ切り替える経路は本タスク単体では動作確認できない。タスク7完了後、フロートパネルの「直線ツール」ボタンをクリックして`currentTool`が`'line'`に切り替わり、ホバー判定なしで直線描画ができること、および「選択ツール」へ戻した際に選択/ホバー状態がクリアされ描画中断が正しく行われることを実機のブラウザ上で目視確認することを強く推奨する。
*   `setTool(tool)`の引数`tool`には型・値のバリデーションを設けていない（`'select'`/`'line'`以外の文字列が渡された場合でも`this.currentTool`へそのまま代入される）。`handleMouseMove`/`handleMouseDown`は`this.currentTool === 'select'`の一致判定でガードしているため、未知の`tool`が渡された場合は事実上「selectでもlineでもない状態」となり、ホバー判定・ハンドル検出・`startDraft`のいずれも実行されない（クリックしても何も起きない）UIフリーズ的な挙動になる。呼び出し元は本タスクの範囲では`main.js`のみ（タスク7で追加予定）であり、そちらで渡す文字列リテラルの綴りに注意する限り実害はないが、将来ツール種別を追加する際は`setTool`側にバリデーションを追加するか、呼び出し元の文字列を定数化することを検討すること。
*   `keydown`リスナーを`document`へ登録したことにより、フォーカスがどのDOM要素にあっても（将来`control-panel`内にボタン以外のフォーカス可能要素が増えた場合も含め）`Delete`/`Backspace`押下を拾う。現時点では`control-panel`内にテキスト入力等のフォーカス可能要素が存在しないため実害はないが、タスク5の懸念事項にも記載の通り、将来的にカラーコード入力欄等のテキスト入力UIが追加された場合は、`event.target`がテキスト入力要素かどうかを判定して除外するロジックを`handleKeyDown`側に追加する必要がある。
*   `handleClick`のIDLE時・`select`ツール分岐で「`hoveredId`がなく選択中でもない」場合（早期returnの`if`条件のいずれにも合致しない場合）は、Modelへの呼び出しを一切行わずに`return`する（何もしない）。これは要件6の記載通りの意図した挙動（`select`ツール中は`startDraft`を一切呼ばない）であり、空白部分をクリックしても新規図形が作成されない`select`ツールの排他動作として正しい。
*   `this.ctx.setTransform(1, 0, 0, 1, 0, 0)`の呼び出し位置は、`dpr`取得直後・`logicalWidth`/`logicalHeight`取得前とした（`canvas.width`/`canvas.height`への再代入自体もブラウザの仕様上コンテキストの変形をリセットするが、明示的に`setTransform`を先頭で呼ぶことでリセットタイミングをコード上で自己文書化し、将来この関数の処理順序が入れ替わった場合でも累積バグを踏みにくくする意図）。将来この関数を修正する際は、`setTransform`によるリセットが必ず`ctx.scale(dpr, dpr)`より先に実行される順序を崩さないこと。
*   【タスク5実施分・追記】`startDraft(x, y, type = 'line')`は`ShapeFactory.create(type, ...)`を呼び出すが、`ShapeFactory.create()`は未知の`type`に対して`Error`をthrowする実装（タスク4参照）であり、`startDraft`側では`try/catch`を一切設けていない。そのため、`InputTracker`（タスク6で対応予定）が誤った`type`文字列を渡した場合、`startDraft`の呼び出し元まで例外が伝播し、キャッチされない例外としてコンソールにスタックトレースが出力される。現時点（タスク5完了時点）では`InputTracker`側の呼び出しが未更新（既存の`model.startDraft(x, y)`という2引数呼び出しのまま）であるため、`type`は常にデフォルト値`'line'`となり実害はないが、タスク6で`model.startDraft(x, y, 'line')`のような明示呼び出しに変更する際は、渡す`type`文字列の綴りに誤りがないか特に注意すること。
*   `updateDraft(x, y)`を`this.#draftLine.setVertex(1, x, y)`のポリモーフィックな呼び出しへ変更したことに伴い、今後`ShapeFactory`が`Line`以外の図形種別（矩形・円等）を生成できるよう拡張された場合、その図形クラスも`setVertex(vertexIndex, x, y)`を実装している必要がある（`VectorModel`側は図形の具象クラスを一切意識しないため、このインターフェース契約が破られると`updateDraft`実行時に`TypeError: ... setVertex is not a function`という、発生箇所からは原因が分かりにくい実行時エラーになる）。将来新しい図形クラスを追加する際は、`Line`と同一のインターフェース（`setVertex`/`translate`/`draw`等）を必ず実装すること。
*   `deleteShape(id)`の実装では、`#shapes`からの除去に`Array.prototype.splice`を用いた（`filter`による新配列生成でも実装可能だが、他の既存メソッド（`updateVertex`/`moveShape`）が`find`で該当要素を検索してから直接ミューテートする方式を採っているため、それに合わせて`findIndex`+`splice`という「検索してから直接操作する」一貫したスタイルを採用した。設計方針としての本質的な違いはない）。
*   本タスクの動作確認（実際にブラウザで直線を1本以上描画した状態から`deleteShape`が意図通り動くか等）は、`InputTracker`側に`Delete`/`Backspace`キー押下時の`model.deleteShape(selectedId)`呼び出し配線がまだ存在しない（タスク6で対応予定）ため、タスク5単体では実施できない。タスク6完了後に、選択中図形をキー削除した際に画面から消え、かつ`#selectedId`/`#hoveredId`が正しくクリアされていることを実機のブラウザ上で目視確認することを強く推奨する。
*   【タスク7実施分・追記】これで本Phaseで想定されていた「選択ツール」「直線ツール」ボタンの実配線が完了し、`InputTracker.currentTool`をUI操作から実際に切り替えられる状態になった。タスク6の懸念事項に記載した「`setTool('line')`を実際に呼んで切り替える経路の動作確認」が本タスク完了によりようやく可能になったため、次回の実機確認時に、(1)「直線ツール」クリックでホバー判定なしの直線描画ができること、(2)「選択ツール」へ戻した際に選択/ホバー状態がクリアされること、(3)各ボタンクリック時にアクティブ状態のCSSクラスが正しく片方のボタンのみに付与されること、(4)コントロールパネル上でのクリック・ドラッグ・マウス移動がCanvas側の選択解除やライン描画開始を一切引き起こさないこと、の4点を目視確認することを強く推奨する。
*   `stopPropagation`は`mousedown`/`click`/`mousemove`の3イベントのみに実装しており、`mouseup`には実装していない（REQ・RESの要件7に明記された対象がこの3イベントのみであるため）。現状`InputTracker`側は`mouseup`をリッスンしていない（`handleClick`は`click`イベント、ドラッグ系は`mousedown`/`mousemove`で完結する設計）ため実害はないが、将来`InputTracker`に`mouseup`ハンドラを追加する場合は、コントロールパネル上での`mouseup`がCanvas側へ伝播しないか改めて確認し、必要であれば`controlPanel`への`mouseup`用`stopPropagation`リスナーの追加を検討すること。
*   `createToolClickHandler`は`activeBtn`/`inactiveBtn`の2ボタン限定の実装であり、将来ツール種別が3つ以上に増えた場合（例: 矩形ツール追加）は、この「アクティブ化対象1つ・非アクティブ化対象1つ」という前提が崩れる。その場合は、全ツールボタンをボタン配列として保持し、クリックされたボタンのみ`active`を付与・他の全ボタンから`active`を除去する汎用的な実装へ書き換える必要がある（本Phaseの範囲では2ツールのみのため、現状の実装で要件を満たしている）。
*   ツールボタンの`click`イベントハンドラ（`inputTracker.setTool`呼び出し＋CSSクラス操作）と、`controlPanel`の`click`イベントに対する`stopPropagation`は、別々の`addEventListener`呼び出しによる別リスナーとして登録した（1つのリスナー内で両方の処理をまとめて行う実装にはしていない）。ボタン要素上のクリックはバブリングにより「ボタン側のハンドラ→`controlPanel`側の`stopPropagation`」の順で発火するため、`stopPropagation`が呼ばれる前にツール切り替え自体は完了しており、動作上の問題はない。
*   【タスク8実施分・追記】`PROJECT_ARCHITECTURE.md`のセクション1・セクション4の更新は、本RESの「開発資料の更新予定」に列挙された5項目のみを機械的に反映したものであり、それ以外の既存記述（例: セクション1の`_log/_req/closed`・`_log/_res/closed`というパス表記が、実際のリポジトリの`_log/req/`・`_log/res/`という実フォルダ名と一致していない点）には一切手を加えていない。この`_log`配下のパス表記の齟齬は本Phase（タスク1〜7）の実装内容とは無関係の既存の記載であり、本タスクのスコープ（「開発資料の更新予定」に記載された5項目の反映）外と判断したため意図的に修正対象から除外した。修正が必要かどうかは発注者側で改めて判断のうえ、必要であれば別途REQを起票することを推奨する。
*   セクション4への`ShapeFactory.js`の新規記述は、`core/`層内での掲載順序を`VectorModel.js`→`CanvasManager.js`→`InputTracker.js`→`ShapeFactory.js`とし、既存3モジュールの直後・`shapes/`セクションの直前に配置した。これはセクション1のフォルダ構造図における`core/`配下の列挙順（`VectorModel.js`→`CanvasManager.js`→`InputTracker.js`→`ShapeFactory.js`）と一致させる意図的な判断であり、将来`core/`層に新規モジュールを追加する際も、セクション1の列挙順とセクション4の記述順を一致させる方針を踏襲することを推奨する。
