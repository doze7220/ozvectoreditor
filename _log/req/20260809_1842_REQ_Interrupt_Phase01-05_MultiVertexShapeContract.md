# 作業指示書 REQ: Interrupt : 3頂点図形（Curve）の作図・再編集フローにおけるvertexIndex意味不一致の解消
*  ルール: `./PROJECT_CONSTITUTION.md`
*  開発資料: `./PROJECT_ARCHITECTURE.md`
*  参考資料: `./_log/res/20260809_1745_RES_Phase01-05_BezierCurve_Implementation.md`（`Curve.js`の実装内容）、`./_log/res/20260809_1830_RES_Interrupt_Phase01-05_DraftTypeHardcoded.md`（直前に修正した関連Interrupt）

## 【作業手順（厳守事項）】
本プロンプトは、Phase01-05完了後の実機テストプレイで発見された、`Curve`（3頂点図形）特有の2件の不具合に対するInterruptである。必ず以下の順序で作業を行うこと。
1. ルール（`PROJECT_CONSTITUTION.md`）および開発資料（`PROJECT_ARCHITECTURE.md`）を熟読・把握すること。
2. 参考資料（上記2件のRES）を読み、`Curve.js`の`points`構造（`points[0]`=始点／`points[1]`=制御点／`points[2]`=終点）と、直前のInterruptで解消した内容を把握すること。
3. 以下の【実装要件】に従って、2件の修正をすべて実装すること（互いに関連するため、まとめて実行してよい）。
4. コード修正が完了したら、Interrupt作業レポートテンプレート（`./_log/TEMPLATE_RES_Interrupt.md`）を元に、作業レポートを新規作成して出力すること。
    * 出力先・ファイル名: `./_log/res/20260809_1842_RES_Interrupt_Phase01-05_MultiVertexShapeContract.md`
5. 開発資料（`PROJECT_ARCHITECTURE.md`）の「4. 各モジュールの責務リファレンス」内、`Line.js`/`Curve.js`/`VectorModel.js`/`InputTracker.js`の各記述に、本Interruptで追加・変更した内容を反映すること（詳細は【実装要件】各項末尾を参照）。
6. すべての作業が完了したら、チャットにて「実装が完了しました。ビルド・動作確認をお願いします」と報告すること。

## 【背景・原因の共通説明】
`Line`（2頂点：`start`=0, `end`=1）と`Curve`（3頂点：`start`=0, `control`=1, `end`=2）とでは、`vertexIndex`の`1`が指す意味が異なる。`core/`層（`VectorModel`/`InputTracker`）は図形種別分岐を持ち込まない設計方針のため、`vertexIndex`の意味そのものを知らないが、現状は以下2箇所で暗黙的に「`vertexIndex=1`は常に終点」という`Line`前提の規約がハードコードされており、`Curve`に対して誤動作している。

## 【実装要件】

### 不具合1：2クリック作図中、終点がカーソルに追従せず制御点だけが動く
*   **現象**: パレットで「曲線」を選び1回目のクリック（始点確定）後、マウスを動かしてもプレビューがマウスまでの半分の距離までしか伸びない。2回目のクリックで確定しても、始点と終点が同一座標のまま図形が生成される（選択してもハンドルが2点分しか見えない）。
*   **原因**: `js/core/VectorModel.js`の`updateDraft(x, y)`が`this.#draftLine.setVertex(1, x, y)`を呼んでいる。`Curve`にとって`vertexIndex=1`は制御点であるため、終点（`points[2]`）は始点作成時の座標のまま更新されず、制御点だけがカーソルを追従してしまう。
*   **修正内容**:
    1.  `js/shapes/Line.js`に新規インスタンスメソッド`updateDraftEnd(x, y)`を追加する。実装は`this.setVertex(1, x, y);`と同義（終点をそのまま更新する）。ファイル先頭の責務定義（JSDoc）は変更不要だが、メソッド自体にJSDoc（`@param`、用途：作図中に終点をカーソル位置へ追従させる旨）を付与すること。
    2.  `js/shapes/Curve.js`に新規インスタンスメソッド`updateDraftEnd(x, y)`を追加する。以下のロジックで実装する。
        ```js
        updateDraftEnd(x, y) {
            this.points[2] = { x, y };
            this.points[1] = {
                x: (this.points[0].x + x) / 2,
                y: (this.points[0].y + y) / 2,
            };
        }
        ```
        終点を`(x, y)`に更新し、制御点を「始点と新しい終点の中点」として再計算する（コンストラクタの初期配置ロジックと同一の考え方）。これにより、作図プレビュー中は常に直線に見える状態を保ち、確定後にユーザーが制御点ハンドルをドラッグして初めて曲率がつく、という自然な操作感になる。同様にJSDocを付与すること。
    3.  `js/core/VectorModel.js`の`updateDraft(x, y)`内、`this.#draftLine.setVertex(1, x, y);`を`this.#draftLine.updateDraftEnd(x, y);`に置き換える。メソッドのJSDoc（「作成中Lineの終点をカーソル位置に追従させる」旨の記述）は、`updateDraftEnd`へポリモーフィックに委譲する設計に即して1文程度更新すること。
    4.  開発資料への反映：`PROJECT_ARCHITECTURE.md`の`Line.js`/`Curve.js`エントリに`updateDraftEnd(x, y)`（作図中に終点をカーソルへ追従させる。`Curve`は制御点も中点として再計算する）を追記し、`VectorModel.js`エントリの`updateDraft`に関する記述を実態に合わせて更新すること。

### 不具合2：選択後、終点ハンドルをドラッグしても制御点が動いてしまう
*   **現象**: `Curve`を選択して再編集する際、`hitTestHandle`が`'end'`を返すハンドル（正方形）をドラッグしても、実際には制御点（ひし形の位置）が動いてしまい、真の終点を単独で編集する手段がない。
*   **原因**: `js/core/InputTracker.js`の`handleMouseMove`内、`DRAGGING_HANDLE`状態の分岐（`this.activeHandle !== 'move'`の場合）で
    ```js
    const vertexIndex = this.activeHandle === 'start' ? 0 : 1;
    ```
    という2値のみの三項演算子でハンドル名からインデックスを決めている。`'start'`以外は無条件に`1`（`Line`にとっての終点）とみなす実装のため、`Curve`の`'end'`（本来index2）が`'control'`と同じindex1に誤って丸められてしまう。
*   **修正内容**:
    1.  `js/shapes/Line.js`に新規インスタンスメソッド`getVertexIndexForHandle(handleName)`を追加する。実装：
        ```js
        getVertexIndexForHandle(handleName) {
            return { start: 0, end: 1 }[handleName] ?? null;
        }
        ```
    2.  `js/shapes/Curve.js`に新規インスタンスメソッド`getVertexIndexForHandle(handleName)`を追加する。実装：
        ```js
        getVertexIndexForHandle(handleName) {
            return { start: 0, control: 1, end: 2 }[handleName] ?? null;
        }
        ```
        いずれも`hitTestHandle`が返しうる文字列（`'move'`を除く）と、対応する`vertexIndex`の対応関係を自己申告する、副作用のない純粋なルックアップメソッドとする。JSDocに引数・戻り値（該当なしの場合は`null`）を明記すること。
    3.  `js/core/InputTracker.js`の`handleMouseMove`内、該当箇所を以下のように書き換える。
        ```js
        } else {
            const shape = this.model.getShapes().find((s) => s.id === this.activeShapeId);
            const vertexIndex = shape.getVertexIndexForHandle(this.activeHandle);
            this.model.updateVertex(this.activeShapeId, vertexIndex, x, y);
        }
        ```
        `this.model.getShapes()`は既に`handleMouseDown`内で同種の`find`呼び出しに使われている既存の公開メソッドであり、新規APIの追加は不要。三項演算子は完全に撤去すること。
    4.  開発資料への反映：`PROJECT_ARCHITECTURE.md`の`Line.js`/`Curve.js`エントリに`getVertexIndexForHandle(handleName)`（ハンドル名から対応する`vertexIndex`を自己申告する。該当なしは`null`）を追記し、`InputTracker.js`エントリの該当記述（ハンドル種別からのvertexIndex解決方法）を実態に合わせて更新すること。

## 【絶対遵守ルール (Constraints)】
*   **既存契約の非破壊**: 既存の`setVertex(vertexIndex, x, y)`のシグネチャ・挙動、`hitTestHandle`の戻り値（`'start'|'end'|'move'|null`または`'start'|'end'|'control'|null`）は一切変更しないこと。本Interruptは新規メソッド2つ（`updateDraftEnd`/`getVertexIndexForHandle`）の追加のみで解決すること。
*   **`core/`層への図形種別分岐の非混入**: `VectorModel.js`・`InputTracker.js`のいずれにも、`if (type === 'curve')`のような図形種別分岐を一切持ち込まないこと。修正後もすべて`shape.メソッド名(...)`という同一の呼び出し規約でポリモーフィックに解決すること。
*   **修正範囲の限定**: `js/shapes/Line.js`・`js/shapes/Curve.js`・`js/core/VectorModel.js`・`js/core/InputTracker.js`・`PROJECT_ARCHITECTURE.md`以外のファイルは変更しないこと。`ShapeFactory.js`・`WindowManager.js`・`PaletteController.js`・`main.js`等は無改変とする。
*   **`'move'`ハンドルの扱いは不変**: `activeHandle === 'move'`の分岐（`moveShape`呼び出し）は既存のまま変更しないこと。`getVertexIndexForHandle`は`'move'`を扱う必要はない（呼び出し側で既に分岐済みのため）。
