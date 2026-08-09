# RES: 作業計画・作業レポート (Phase 01-05) : ベジエ曲線（Curve.js）の完全実装と幾何ポリモーフィズムの確立
* 参照元REQ: `./_log/req/20260809_1735_REQ_Phase01-05_BezierCurve_Implementation.md`
* 参照元DIR: `./_log/dir/20260809_1727_DIR_Phase01-05_BezierCurve_Implementation.md`

## 1. 作業目的
5大図形パレットの空スタブとして残っている `curve` に対し、最初の新規具象図形クラス `Curve.js`（2次ベジェ曲線、始点・制御点・終点の3頂点構造）を完全実装する。`Line.js` が確立した7つの共通API（`hitTest`/`hitTestHandle`/`draw`/`drawHandles`/`drawHover`/`setVertex`/`translate`）を同名・同シグネチャで自律実装することで、`core/`層（`VectorModel`/`CanvasManager`/`InputTracker`）を1行も変更せずに「頂点数・形状の異なる図形」を扱える幾何ポリモーフィズムを実証し、後続の `arc`/`rect`/`circle` 実装の拡張基盤を確立する。`ShapeFactory.js` の `curve` 分岐を暫定 `Line` フォールバックから本物の `Curve` 接続に切り替える。

## 2. アーキテクチャ設計

### 要件1: `shapes/Curve.js` の新規実装（幾何ポリモーフィズムの確立）
* **責務定義（ファイル先頭JSDoc・3行以内）**: 2次ベジェ曲線（始点・制御点・終点）のデータ保持・Canvasへの描画処理・当たり判定を担う、という`Line.js`と対をなす責務文を記述する。
* **データ構造**: `this.id = null`（採番はVectorModel側で行うため`Line`同様に外部設定を待つ）、`this.points = [{x: x1, y: y1}, {x: (x1+x2)/2, y: (y1+y2)/2}, {x: x2, y: y2}]`（`points[0]`=始点／`points[1]`=制御点／`points[2]`=終点）。`Line`が`this.strokeColor`/`this.strokeWidth`をコンストラクタのデフォルト引数（`'#000000'`/`2`）として保持しているのと同じ設計で、`Curve`のコンストラクタも`(x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 2)`のシグネチャを踏襲し、`draw`/`drawHover`がスタイルを自身のプロパティから参照できるようにする（`ShapeFactory.create`からは`x1〜y2`の4引数のみ渡されるため、色・太さは常にデフォルト値が使われる＝`Line`の現行挙動と対称）。
* **`draw(ctx, t = 0)`**: `ctx.beginPath()` → `ctx.moveTo(points[0].x, points[0].y)` → `ctx.quadraticCurveTo(points[1].x, points[1].y, points[2].x, points[2].y)` → `strokeStyle`/`lineWidth`を自身のプロパティから適用 → `ctx.stroke()`。第2引数`t`は将来のモーフィング用でデフォルト`0`、本Phaseでは未使用（内部ロジックで参照しない）。
* **`drawHandles(ctx)`**: `Line.drawHandles`と同じ`fillStyle='#ffffff'`/`strokeStyle='#4a90e2'`/`lineWidth=1.5`をベースに、始点・終点（`points[0]`, `points[2]`）は`Line`と同一の正方形（一辺8px）で描画し、制御点（`points[1]`）はひし形（対角線8px＝中心から上下左右に4pxの頂点を持つパスをmoveTo/lineToで結ぶ）で描き分ける。加えて、始点⇔制御点・終点⇔制御点を結ぶ点線ヘルパー（半透明グレー、太さ1px、`ctx.setLineDash([2, 2])`）を描画し、描画後は必ず`ctx.setLineDash([])`でクリアする（他図形の描画に影響を残さないため）。
* **`hitTest(x, y, tolerance)`**: $B(t) = (1-t)^2 P_0 + 2(1-t)t P_1 + t^2 P_2$ を$t=0$から$1$まで100分割（`i=0..100`, `t=i/100`）で反復し、各分割点と入力点$(x,y)$との距離の最小値を求め、`tolerance`以内なら`true`を返す。
* **`hitTestHandle(x, y, tolerance)`**: `Math.hypot`による距離判定を、始点→終点→制御点の優先順位（DIR要件5準拠）で行い、該当があれば`'start'|'end'|'control'`を返す。三択とも該当しなければ`null`。`Line`の`'move'`に相当するハンドルは持たない。
* **`setVertex(vertexIndex, x, y)`**: `vertexIndex === 0`で`points[0]`、`=== 1`で`points[1]`（制御点）、`=== 2`で`points[2]`を`{x, y}`に更新する。それ以外の値は何もしない（`Line`の未該当時仕様に合わせる）。
* **`translate(dx, dy)`**: `points`配列の3要素すべての`x`/`y`に`dx`/`dy`を加算する。
* **`drawHover(ctx)`**: `draw`と同じ`moveTo`→`quadraticCurveTo`のパスを構築し、`strokeStyle = 'rgba(74, 144, 226, 0.4)'`、`lineWidth = this.strokeWidth + 6`で重ね描画する（`Line.drawHover`と同一の配色・太さルールをベジェパスに適用）。

### 要件2: `ShapeFactory.js` の `curve` 分岐接続
* `switch`文中の`case 'curve':`を`case 'arc': case 'rect': case 'circle':`のグループから分離し、単独で`return new Curve(x1, y1, x2, y2);`を返すようにする。`arc`/`rect`/`circle`の3種は既存の`Line`フォールバックのcaseグループのまま変更しない。
* ファイル先頭のJSDoc（クラス責務コメント・`create`メソッドのコメント）を、`curve`が実装済みになった事実に合わせて更新する（「未実装4種」→「未実装3種（arc/rect/circle）」等の表現修正、`@returns`の型表記見直し）。
* `import { Line } from '../shapes/Line.js';`に加えて`import { Curve } from '../shapes/Curve.js';`を追加する。

### 関連フォルダと論理クラス
* **対象フォルダ**: `./js/shapes/`（図形ドメイン、`Curve.js`を新規追加）、`./js/core/`（`ShapeFactory.js`のみ改修対象）
* **関連する論理クラス**:
    * `Curve`（新規具象図形。`points`3点構造を持つ2次ベジェ曲線）
    * `Line`（既存。実装の型として参照するのみで、本Phaseでは一切変更しない）
    * `ShapeFactory`（`curve`分岐の接続改修）
* **参照する責務**（`PROJECT_ARCHITECTURE.md`より抜粋）:
    * `shapes/` : 「図形種別ごとの定義・当たり判定。各図形が自身のプロパティと描画ロジック(`draw`メソッド)を持つ。」
    * `Line.js` : 「共通インターフェースとして `hitTest`/`hitTestHandle`/`drawHandles`/`drawHover`/`setVertex`/`translate` を実装する。今後追加する図形（曲線・円・楕円等）も、この6メソッドを自身に実装することで`core/`側を変更せずに同一の作成・選択・再編集フローへ組み込める。」
    * `ShapeFactory.js` : 「図形typeに応じたインスタンス生成を一元的に担うFactory。（中略）`core/`層全体を通じて図形種別のif/switch分岐を許容する唯一の例外モジュールである。」

### 開発資料（PROJECT_ARCHITECTURE.md）の更新予定
* 「4. 各モジュールの責務リファレンス」内の`shapes/`項目に、`Line.js`の記載に続けて`Curve.js`（作成済み）の責務説明を追記する（`points`3点構造、`Line`と同一7メソッドの自律実装、ひし形制御点ハンドル、moveハンドル非搭載である旨を明記）。
* 同章の`ShapeFactory.js`項目の記述を更新し、「`curve`/`arc`/`rect`/`circle`の4種はスタブ」という現行表現を、「`curve`は`Curve`本実装済み、`arc`/`rect`/`circle`の3種は引き続き`Line`スタブフォールバック」という内容に修正する。

## 3. タスクリスト
* [x] タスク1: `shapes/Curve.js` のスケルトン作成と `ShapeFactory` 配線（DIR 7章ステップ1）
    * **対象ファイル** :
        * `./js/shapes/Curve.js` : 新規
        * `./js/core/ShapeFactory.js` : 更新
    * **作業内容** :
        * `Curve.js`を新規作成し、先頭に単一責務のJSDoc（3行以内）を記述する。
        * コンストラクタ`(x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 2)`を実装し、`this.id = null`と`this.points`（制御点=始点終点の中点）を初期化する。各プロパティにJSDoc（`@param`）を付与する。
        * `draw(ctx, t = 0)`を、本タスクでは暫定的に`points[0]`→`points[2]`への直線描画（`moveTo`/`lineTo`）としてスタブ実装する（ステップ2で本実装に差し替える前提の一時実装であることをコメントで明記）。
        * `ShapeFactory.js`の`switch`文から`case 'curve':`を独立させ、`import { Curve } from '../shapes/Curve.js';`を追加のうえ`return new Curve(x1, y1, x2, y2);`を返すよう改修する。`arc`/`rect`/`circle`のcaseグループとJSDocの型表記・コメントも整合するよう更新する。
        * コード修正完了後、JSDocコメントの記載漏れ（クラス責務・コンストラクタ引数）がないことを確認する。
        * タスク完了後、本RESの「4. 詳細作業内容」にタスク1の実施内容を追記し、チェックボックスを`[x]`にする。
        * 実装中に判断に迷った点・目視確認推奨箇所・将来の注意点があれば「5. 懸念事項・要確認ポイント」に追記する。

* [x] タスク2: ベジェ描画・ハンドル描画・点線ヘルパーの本実装（DIR 7章ステップ2）
    * **対象ファイル** :
        * `./js/shapes/Curve.js` : 更新
    * **作業内容** :
        * `draw(ctx, t = 0)`をタスク1の暫定直線実装から`ctx.quadraticCurveTo(points[1].x, points[1].y, points[2].x, points[2].y)`を用いた本実装に差し替える。
        * `drawHandles(ctx)`を実装する。始点・終点は正方形（一辺8px、白塗り青枠）、制御点はひし形（対角線8px、白塗り青枠）で描き分ける。
        * 始点⇔制御点・終点⇔制御点を結ぶ点線ヘルパー（`ctx.setLineDash([2, 2])`、半透明グレー、太さ1px）を`drawHandles(ctx)`内に実装し、描画完了後は必ず`ctx.setLineDash([])`でクリアする。
        * 各メソッドにJSDoc（`@param`/戻り値の説明）を付与する。
        * コード修正完了後、JSDocコメントの記載漏れがないことを確認する。
        * タスク完了後、本RESの「4. 詳細作業内容」にタスク2の実施内容を追記し、チェックボックスを`[x]`にする。
        * 実装中に判断に迷った点（点線ヘルパーの具体的な色・太さの確定値など）・目視確認推奨箇所・将来の注意点があれば「5. 懸念事項・要確認ポイント」に追記する。

* [x] タスク3: 当たり判定・頂点更新・ホバー描画の実装（DIR 7章ステップ3）
    * **対象ファイル** :
        * `./js/shapes/Curve.js` : 更新
    * **作業内容** :
        * `hitTest(x, y, tolerance)`を実装する。$B(t)$の方程式に基づき$t=0〜1$を100分割して反復し、入力点との最短距離が`tolerance`以内かを判定する。
        * `hitTestHandle(x, y, tolerance)`を実装する。始点→終点→制御点の優先順位で距離判定を行い、`'start'|'end'|'control'|null`を返す。
        * `setVertex(vertexIndex, x, y)`を実装する（`0`=始点／`1`=制御点／`2`=終点、それ以外は無処理）。
        * `translate(dx, dy)`を実装する（`points`全3点を相対移動）。
        * `drawHover(ctx)`を実装する。ベジェパス（`quadraticCurveTo`）に沿って`strokeStyle = 'rgba(74, 144, 226, 0.4)'`、`lineWidth = this.strokeWidth + 6`の半透明幅広ハイライト線を描画する。
        * 各メソッドにJSDoc（`@param`/`@returns`）を付与する。
        * コード修正完了後、JSDocコメントの記載漏れがないことを確認する。
        * タスク完了後、本RESの「4. 詳細作業内容」にタスク3の実施内容を追記し、チェックボックスを`[x]`にする。
        * 実装中に判断に迷った点（ひし形ハンドルの当たり判定を正方形ハンドルと同様の円形近似距離判定としてよいか等）・目視確認推奨箇所・将来の注意点があれば「5. 懸念事項・要確認ポイント」に追記する。

* [x] タスク4: 開発資料（PROJECT_ARCHITECTURE.md）の更新
    * **対象ファイル** :
        * `./PROJECT_ARCHITECTURE.md` : 更新
    * **作業内容** :
        * 「4. 各モジュールの責務リファレンス」の`shapes/`項目に`Curve.js`（作成済み）の責務説明を追記する（本RES「2. アーキテクチャ設計」の開発資料更新予定案に準拠）。
        * `ShapeFactory.js`項目の記述を、`curve`が本実装接続済みである内容に更新する。
        * タスク完了後、本RESの「4. 詳細作業内容」にタスク4の実施内容を追記し、チェックボックスを`[x]`にする。
        * 実装中に判断に迷った点があれば「5. 懸念事項・要確認ポイント」に追記する。

## 4. 詳細作業内容
（本ファイルは「計画立案アプローチ」Step1（REQ→RES）の成果物であり、この時点ではソースコードの修正を一切行っていない。各タスクの実装完了後、承認されたRESに基づき「1回のレスポンスで1タスク」の原則でコードを修正し、完了の都度、本節に当該タスクの実施内容を追記し、上記チェックボックスを`[x]`に更新すること。）

### タスク1: 完了
* `./js/shapes/Curve.js` を新規作成した。ファイル先頭に「2次ベジェ曲線（始点・制御点・終点）のデータ保持・Canvasへの描画処理・当たり判定を担う」旨の単一責務JSDoc（1行）を記述。
* コンストラクタは`(x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 2)`のシグネチャで`Line`と対称に実装。`this.id = null`、`this.points = [{x1,y1}, {中点}, {x2,y2}]`（points[0]=始点／points[1]=制御点／points[2]=終点）を初期化し、各プロパティに`@param`JSDocを付与した。
* `draw(ctx, t = 0)`は本タスクの計画通り、`points[0]`→`points[2]`への直線描画（`moveTo`/`lineTo`）による暫定スタブとして実装した。メソッドJSDocに「タスク2で`quadraticCurveTo`による本実装に差し替える暫定実装」である旨を明記。`t`引数はシグネチャのみ維持し、内部ロジックでは未参照（YAGNI/DIR要件2準拠）。
* `hitTest`/`hitTestHandle`/`drawHandles`/`drawHover`/`setVertex`/`translate`の6メソッドは本タスクのスコープ外（タスク2・3で実装）のため、意図的に未実装のまま据え置いた。
* `./js/core/ShapeFactory.js`を更新。`import { Curve } from '../shapes/Curve.js';`を追加し、`switch`文の`case 'curve':`を`case 'arc': case 'rect': case 'circle':`のグループから分離、単独で`return new Curve(x1, y1, x2, y2);`を返すよう改修した。`arc`/`rect`/`circle`の3caseは変更せず`Line`フォールバックのまま維持。クラス責務JSDoc・`create`メソッドの`@returns`（`Line`→`Line|Curve`）・コメント文言（「未実装4種」→「未実装3種」、「上記5種以外」の判定は変更なし）を実態に合わせて更新した。
* `Line.js`は本タスクを通じて一切変更していない（参照専用ルール準拠）。
### タスク2: 完了
* `draw(ctx, t = 0)`をタスク1の暫定直線実装（`moveTo`/`lineTo`）から、計画通り`ctx.quadraticCurveTo(points[1].x, points[1].y, points[2].x, points[2].y)`を用いた本実装に差し替えた。`strokeStyle`/`lineWidth`は変更前と同様に自身の`strokeColor`/`strokeWidth`プロパティから適用。メソッドJSDocの「暫定実装」注記は削除し、実装内容に即した1文に更新した。
* `drawHandles(ctx)`を新規実装。`Line.drawHandles`と同じ`fillStyle='#ffffff'`/`strokeStyle='#4a90e2'`/`lineWidth=1.5`をベースに、始点・終点（`points[0]`, `points[2]`）は一辺8pxの正方形（`ctx.rect`）で、制御点（`points[1]`）は対角線8pxのひし形（`moveTo`/`lineTo`4点→`closePath`）で描き分けた。
* 始点⇔制御点・終点⇔制御点を結ぶ点線ヘルパーを`drawHandles`冒頭（正方形・ひし形ハンドルを描く前）に実装。`ctx.setLineDash([2, 2])`、`strokeStyle = 'rgba(0, 0, 0, 0.4)'`（半透明グレー）、`lineWidth = 1`で2本の破線を1つの`beginPath`にまとめて描画し、`ctx.stroke()`直後に`ctx.setLineDash([])`で明示的にクリアしてから、後続の正方形・ひし形ハンドル描画（実線）に影響が残らないようにした。
* `draw`/`drawHandles`双方にJSDoc（`@param`）を付与済み。記載漏れなし。
* タスク3のスコープである`hitTest`/`hitTestHandle`/`setVertex`/`translate`/`drawHover`はフライング実装せず、本タスクでは着手しなかった。
### タスク3: 完了
* `hitTest(x, y, tolerance)`を実装した。計画通り$B(t) = (1-t)^2 P_0 + 2(1-t)t P_1 + t^2 P_2$を`t=0`から`1`まで`i=0..100`（`t=i/100`）で反復し、各分割点と入力点`(x,y)`の`Math.hypot`距離の最小値`minDistance`を求め、`tolerance`以内であれば`true`を返す形で実装した。
* `hitTestHandle(x, y, tolerance)`を実装した。`Math.hypot`による距離判定を、計画通り始点→終点→制御点の優先順位（DIR要件5準拠）で行い、該当があれば`'start'|'end'|'control'`を返し、三択とも該当しなければ`null`を返す。
* `setVertex(vertexIndex, x, y)`を実装した。`vertexIndex`が`0`（始点）／`1`（制御点）／`2`（終点）のいずれかであれば該当する`points[vertexIndex]`を`{x, y}`で置き換え、それ以外の値は何もしない（`Line`の未該当時仕様に合わせる）。
* `translate(dx, dy)`を実装した。`points`配列の3要素すべてに対し`forEach`で`x`/`y`に`dx`/`dy`を加算する。
* `drawHover(ctx)`を実装した。`draw`と同じ`moveTo`→`quadraticCurveTo`のパスを構築し、`strokeStyle = 'rgba(74, 144, 226, 0.4)'`、`lineWidth = this.strokeWidth + 6`で重ね描画する（`Line.drawHover`と同一の配色・太さルールをベジェパスに適用）。
* 追加した5メソッド全てにJSDoc（`@param`/`@returns`）を付与済み。記載漏れなし。
* この時点で`Curve`は`Line`と同名・同シグネチャの7メソッド（`draw`/`drawHandles`/`hitTest`/`hitTestHandle`/`setVertex`/`translate`/`drawHover`）を全て自律実装しており、`core/`層（`VectorModel`/`CanvasManager`/`InputTracker`）を一切変更せずにcurve図形の選択・ハンドル操作・ホバー表示が可能な状態になった。
* タスク4（`PROJECT_ARCHITECTURE.md`の更新）はスコープ外のためフライング着手しなかった。
### タスク4: 完了
* `./PROJECT_ARCHITECTURE.md`「4. 各モジュールの責務リファレンス」の`shapes/`項目を更新した。`Line.js`の記載に続けて`Curve.js`（作成済み）の責務説明を新規追記し、`points`3点構造（始点／制御点／終点）、`Line`と同名・同シグネチャの7メソッド（`draw`/`drawHandles`/`hitTest`/`hitTestHandle`/`setVertex`/`translate`/`drawHover`）を自律実装している旨、`draw`の`quadraticCurveTo`実装と`hitTest`の$B(t)$100分割サンプリング判定、`drawHandles`の正方形（始点・終点）／ひし形（制御点）ハンドル描き分けと点線ヘルパー、`Line`の`'move'`ハンドルに相当するものを持たず`hitTestHandle`の戻り値が`'start'|'end'|'control'|null`である旨を明記した。
* 同章`ShapeFactory.js`項目の記述を更新した。従来の「`curve`/`arc`/`rect`/`circle`の4種はスタブ」という表現を、「`type === 'curve'`の場合は`new Curve(x1, y1, x2, y2)`を返す（Phase01-05で本実装接続済み）」「`arc`/`rect`/`circle`の3種は専用クラス未実装のため引き続き`Line`スタブフォールバック」という内容に修正した。
* 本RESの「2. アーキテクチャ設計」内「開発資料（PROJECT_ARCHITECTURE.md）の更新予定」に記載の方針通りの内容で追記・修正を行い、それ以外の章（1. プロジェクトフォルダ構造／2. データ構造／3. 描画・操作フロー）は変更していない。
* `PROJECT_ARCHITECTURE.md`以外のファイル（`Curve.js`/`ShapeFactory.js`/`Line.js`等のソースコード）は本タスクでは一切変更していない（タスク4のスコープはドキュメント更新のみ）。

## 5. 懸念事項・要確認ポイント
* **`Curve`コンストラクタのデフォルト引数について**: `ShapeFactory.create('curve', x1, y1, x2, y2)`は4引数のみを渡すため、`strokeColor`/`strokeWidth`は常にデフォルト値（`'#000000'`/`2`）が使われる。これは現行`Line`と全く同じ挙動であり本Phaseでは問題ないが、将来カラーピッカー等から色・太さを指定して作図する機能を追加する際は、`ShapeFactory.create`のシグネチャ自体の拡張が必要になる点に留意すること（本Phaseのスコープ外）。
* **ひし形ハンドルの当たり判定**: DIRは`hitTestHandle`の距離判定方式を明記していないため、正方形ハンドル（始点・終点）と同様に「ハンドル中心からの距離（`Math.hypot`）が`tolerance`以内か」という円形近似判定を、ひし形ハンドル（制御点）にもそのまま適用する設計とする。ひし形の輪郭に沿った厳密な当たり判定は行わない（`Line`の正方形ハンドルも同様に円形近似で判定しているため、既存設計との一貫性を優先する）。実装後、制御点ハンドルの操作感（掴みやすさ）を目視・実操作で確認することを推奨する。
* **点線ヘルパーの具体的な配色・太さ**: DIR要件3は「例：半透明のグレー、太さ1px」と例示表現に留まり確定値ではない。本計画では`rgba(0, 0, 0, 0.4)`相当の半透明グレー・`lineWidth = 1`を実装時のデフォルト案とするが、実装後にキャンバス上での視認性（既存のホバー色`rgba(74, 144, 226, 0.4)`やハンドル枠色`#4a90e2`との区別のしやすさ）を目視確認し、必要に応じて微調整することを推奨する。
* **`draw(ctx, t = 0)`の`t`引数**: 本Phaseでは未使用（将来のモーフィング機能用の伏線としてシグネチャのみ維持）。実装時に`t`を参照するロジックを先回りして書き込まないこと（YAGNI原則、DIR要件2準拠）。
* **100分割ループの計算コスト**: DIR 8章にて「現状のベクター数（数十個程度）であれば無視できる計算量」と評価済み。将来的に頂点数が数千を超える場合はAABBによる早期判定フィルタリングの検討が申し送り事項となっている（本Phaseでは対応不要）。
* **`Line.js`は一切変更しない**: 本Phaseのスコープ厳守ルールにより`Line.js`は参照専用とし、共通API実装時の突き合わせ元としてのみ用いる。
* **【タスク1完了時点の暫定状態に関する注意】`Curve`は`draw`以外の6メソッド（`hitTest`/`hitTestHandle`/`drawHandles`/`drawHover`/`setVertex`/`translate`）が未実装**: タスク1は計画書の記載通り「スケルトン作成」の範囲に厳密に留め、これら6メソッドはフライング実装せずタスク2・3に持ち越した。この結果、現時点で`ShapeFactory.create('curve', ...)`から生成された`Curve`インスタンスに対し、`core/`層（`CanvasManager`/`InputTracker`）が選択・ホバー・ハンドル操作のために`hitTest`等を呼び出すと`TypeError`（未定義メソッド呼び出し）が発生する状態にある。これは意図した中間状態であり、タスク2・3の実装完了までは「curveパレットで作図した図形を選択・ドラッグ操作しようとするとエラーになる」挙動が残る。**タスク2・3が完了するまでは、ブラウザ上でcurve図形の選択・編集操作の動作確認を行わないこと**（`draw`のみのスタブ直線描画自体は正常に表示される想定）。
* **【タスク2完了時点の追記】点線ヘルパーの配色・太さを確定値として実装**: 懸念事項に記載した案の通り、`strokeStyle = 'rgba(0, 0, 0, 0.4)'`（半透明グレー）・`lineWidth = 1`をそのまま確定値として採用した。既存のホバー色`rgba(74, 144, 226, 0.4)`（青系半透明）およびハンドル枠色`#4a90e2`（青）とは色相が異なるため区別自体は取れる想定だが、**実際のCanvas描画結果（特に白背景・グリッド線との重なり時の視認性）は目視確認を推奨する**。微調整が必要と判断された場合は、この`drawHandles`内の2箇所（`strokeStyle`/`lineWidth`）のみを変更すればよい。
* **【タスク2完了時点の追記】`hitTest`/`hitTestHandle`/`setVertex`/`translate`/`drawHover`は依然未実装**: タスク2はDIR 7章ステップ2の範囲（`draw`本実装・`drawHandles`・点線ヘルパー）に厳密に留め、これら5メソッドはタスク3に持ち越した。したがって、タスク2完了時点でも`core/`層からの選択・当たり判定・ドラッグ操作は`TypeError`を引き起こす状態が継続している。**タスク3完了までは、curve図形の選択・編集操作をブラウザ上で試さないこと。**
* **【タスク2完了時点の追記】`drawHandles`は`core/`層から未呼び出しの状態**: `hitTest`等が未実装のため現状は選択状態に到達できず、`drawHandles`が実際にCanvas上へ描画される経路はまだ存在しない。タスク3で`hitTest`/`hitTestHandle`が実装され選択操作が可能になった後、初めて`drawHandles`の見た目（正方形・ひし形ハンドルの大きさ・点線ヘルパーの視認性）を実機で目視確認できる点に留意すること。
* **【タスク3完了時点の追記】ひし形ハンドルの当たり判定は懸念事項記載の通り円形近似で確定実装した**: `hitTestHandle`の制御点判定は、ひし形の輪郭に沿った厳密判定ではなく`Math.hypot`によるハンドル中心からの距離判定（円形近似）を採用した。始点・終点（正方形ハンドル）と判定ロジックを共通化しており`Line`の既存設計と一貫性がある。**実機で制御点ハンドルの掴みやすさ（特にひし形の頂点付近をクリックした際に判定漏れがないか）を目視・実操作で確認することを推奨する**。もし操作感に問題があれば、`tolerance`値の調整（呼び出し元の`InputTracker`側）で対応可能であり、`Curve.js`側のロジック変更は不要と想定される。
* **【タスク3完了時点の追記】これでcurve図形はTypeErrorなく選択・編集操作が可能な状態になった**: タスク1・2の懸念事項に記載していた「`hitTest`等未実装によるTypeError」の制約はタスク3の実装完了により解消された。**curveパレットで作図→選択→始点/制御点/終点のドラッグ操作→ホバー表示、の一連の操作フローをブラウザ上で目視確認することを推奨する**（本タスクのレスポンス内ではブラウザ動作確認までは実施していない）。
* **【タスク3完了時点の追記】`hitTest`の100分割ループは`i<=100`のため実質101点でサンプリングしている**: 計画書の「100分割（`i=0..100`）」の記載通り、`t=0`（始点）と`t=1`（終点）を含む101点で最短距離を求める実装とした。分割数を変更する場合は`segments`変数（`Curve.js`内`hitTest`メソッド冒頭）のみを書き換えればよい。
* **【タスク4完了時点の追記】`PROJECT_ARCHITECTURE.md`更新はREQ指定外ファイル参照禁止ルールに従い、本RES自身（タスク1〜3の「4. 詳細作業内容」の完了報告記述）を一次情報として記述した**: PROJECT_CONSTITUTION.mdの「REQ指定外ファイル参照の絶対禁止ルール」に従い、本タスクでは`Curve.js`/`ShapeFactory.js`の実ソースコードを直接読み返すことはせず、本RES内タスク1〜3の完了報告（実装内容の詳細記述）を根拠に開発資料の文言を作成した。RES記載内容と実コードの間に齟齬がないことは、タスク1〜3実装時点で都度確認済みという前提に立っているが、**将来この記述を参照する際は、念のため実コード（`Curve.js`/`ShapeFactory.js`）とPROJECT_ARCHITECTURE.mdの記述に差異がないか目視確認することを推奨する**。
