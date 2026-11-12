# RES: 作業計画・作業レポート (Phase 06-03) : 塗った内側の当たり判定
* 参照元REQ: `./_log/req/261112_1503_REQ_Phase06-03_Fill_Hit_Test.md`

## 1. 作業目的
塗られた図形（矩形・円・閉じたパス）の内側をクリックして選べるようにする。
*   図形クラスの共通メソッド契約に、内側の当たり判定`hitTestFill(x, y)`を足す（14メソッド → 15メソッド）。多角形の内側の判定（nonzero）は共通モジュール`js/shapes/ShapeGeometry.js`の状態を持たない関数として足し、`Rect`・`Path`から呼ぶ。
*   選択モードの当たり分類（`PointHit`の`bodyId`）の「本体」の決め方を「見た目どおり」（手前優先・線の近くか塗った内側かを区別しない。ただし選択集合の図形の輪郭は優先）に変える。規則はDOMに触れない関数として`js/core/PointHitRules.js`（新設）へ切り出し、`node --test`で確かめる。
*   図形データの形・作業データの版・書き出し形式の版・描画・`hitTest`・`intersectsRect`・ハンドルの規則は変えない。
*   持ち越し事項として`js/shapes/ShapeDataValidation.js`の`DEFAULT_STROKE_WIDTH`のJSDocの食い違いを直す（JSDocのみ）。
*   **既存の振る舞いの変化（発注者了承済み）**：塗りのない図形どうしの輪郭が重なる所をクリックすると、今は奥の図形が選ばれるが、**手前の図形が選ばれるようになる**。また、選択集合の図形が複数当たる場合も、今は奥（図形配列の先頭）が採られるが、手前（図形配列の後ろ）が採られるようになる。

## 2. アーキテクチャ設計

### 用語（本RESでの意味）
*   **塗られている**：図形の`draw`が塗りを描く条件と同じ`this.isFillable() && typeof this.fillColor === 'string'`を満たすこと。
*   **輪郭の当たり**：今の`hitTest(x, y, tolerance)`（輪郭線から画面上5pxの許容誤差以内）。本作業で変えない。
*   **内側の当たり**：本作業で足す`hitTestFill(x, y)`。許容誤差を使わない。

### 要件1: 内側の当たり判定（図形クラス）

#### 1-1. 共通モジュール`ShapeGeometry.js`に足す関数
*   **関数名・形**：`export function isPointInPolygonNonzero(px, py, points)` → `boolean`。
    *   `px`・`py`：判定する点（ワールド座標）。`points`：多角形の頂点の並び（`{x, y}`の配列）。**最後の頂点から最初の頂点へ戻る辺を常に含む閉じた多角形**として扱う（呼び出し側は始点を重複させない）。
    *   状態を持たず、引数を書き換えず、例外を投げない。
*   **規則（nonzero）**：点の巻き数（winding number）が0でなければ内側。Canvasの`fill()`（引数なし＝nonzero）と同じ規則のため、自己交差する多角形（五芒星など）の中心は内側（巻き数2）、逆向きに回った内側の穴（巻き数0）は外側になる。
*   **境界上の点（決定）：内側に含めない（偽）**。
    *   判定の順序：(1) 頂点数が3未満なら`false`。(2) 各辺`points[i]`→`points[(i + 1) % n]`について、点が辺の上にある（外積`(bx - ax) * (py - ay) - (by - ay) * (px - ax)`がちょうど`0`で、かつ`px`・`py`が辺の両端の座標の最小〜最大の範囲内。頂点の上を含む）なら`false`を返す。(3) 巻き数を数える（Sundayの方法：辺が上向きに点の高さをまたぎ（`ay <= py && by > py`）点が辺の左（外積`> 0`）なら`+1`、下向きにまたぎ（`ay > py && by <= py`）点が辺の右（外積`< 0`）なら`-1`）。巻き数`!== 0`なら`true`。
    *   理由：境界（輪郭線の中心線）上の点は、輪郭の当たり（距離0 ≤ 許容誤差）が必ず受け持つため、内側に含めなくても「どちらにも当たらない点」は生じない。境界を含めないことで、面積0の多角形（全頂点が一直線上等）は辺の上でも外でも常に偽になり、Canvasが何も塗らないことと一致する。
    *   浮動小数の注意（JSDocに書く）：「辺の上」は外積がちょうど0の点に限る。小数の座標で辺のごく近く（ちょうど上ではない）にある点は、丸めによりどちら側にも判定され得る。
*   **頂点数3未満・面積0**：(1)により頂点0〜2個は`false`。面積0（一直線上・すべて同じ点・長さ0の辺を含む）は(2)(3)で常に`false`（巻き数は辺の上以外で0になる）。0除算は無い（除算をしない）。
*   **ファイル先頭の責務の記述**に「多角形の内側の判定（nonzero）」を足す（3行以内を保つ）。

#### 1-2. `hitTestFill(x, y)`（5クラス共通の契約。第15メソッド）
*   引数はワールド座標、戻り値は真偽値。許容誤差を受け取らない。
*   **5クラス共通の先頭の判定**：`if (!this.isFillable() || typeof this.fillColor !== 'string') { return false; }`（塗られていなければ常に偽。塗れるかは必ず`isFillable()`を通し、規則を二重に書かない）。この後に各クラスの形の内側の判定を書く。
*   **`Rect`**：`isPointInPolygonNonzero(x, y, this.points)`。4頂点の並び`points[0]`→`[1]`→`[2]`→`[3]`（`draw`と同じ。閉じる辺`[3]`→`[0]`を含む）の多角形として判定し、軸に平行・凸・自己交差なしを前提にしない（`setVertex`で頂点を動かせるため）。
*   **`Path`**：`isPointInPolygonNonzero(x, y, this.points)`。`draw`（`#tracePath`）と同じ頂点の並び（`points[0]`→…→`points[n-1]`→閉じる区間で`points[0]`）。開いたパスは`isFillable()`が偽のため先頭の判定で偽。**JSDocに書くこと**：区間の種類（`segments[i].kind`）による分岐の置き場所はここ。本作業の区間はすべて直線のため分岐しない。曲線の区間を足すとき（パスの編集のPhase）は、曲線の区間を折れ線で近似した頂点の並び等にしてから判定するよう、ここで分岐を足す（`#tracePath`・`#someSegment`と揃える）。
*   **`Ellipse`**：楕円の式で厳密に判定する。
    *   `xc`・`yc`・`rx`・`ry`は`draw`と同じ式（`rx = Math.abs(points[1].x - xc)`、`ry = Math.abs(points[2].y - yc)`）。
    *   **つぶれた円の扱い（決定）**：`if (!(rx * rx > 0 && ry * ry > 0)) { return false; }`（半径0、および2乗が0へ丸められるほど小さい半径は面積0として偽）。この判定により以後の除算の分母は0にならず、`NaN`・`Infinity`は生じない。`rx < 1 || ry < 1`でも半径が正なら下の式で厳密に判定する（輪郭の当たりの縮退の分岐`rx < 1 || ry < 1`とは別の条件。内側を偽にしないことで、つぶれた円でも内側と輪郭の当たりの間に隙間が生じない）。
    *   **式**：`(dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) < 1`（`dx = x - xc`、`dy = y - yc`）。`hitTest`の`value`と同じ式にする（両者の境目で丸めの差が出ないため）。
    *   **境界上の点（決定）：含めない**（`< 1`。REQの`≤ 1`の表記は境界の扱いを計画で決める前提のものと解釈し、多角形の判定と揃える。境界は輪郭の当たりが受け持つ）。
    *   弧は`isFillable()`が偽のため先頭の判定で偽（`fillColor`に色の文字列を持っていても）。
    *   **JSDocに書くこと**：弧の塗り（弓形・扇形）・`Ellipse`の回転を入れるときは、本メソッドの式（回転を含まない軸平行の楕円の式）と、塗れる形の判定を見直すこと。
    *   **`ELLIPSE_TYPES`のJSDoc**（`Ellipse.js`先頭付近。種別を増やす場合に揃える箇所の列挙）に`hitTestFill`を加える。`hitTestFill`自体は種別の分岐を持たない（塗れるかは`isFillable()`を通すだけ）が、塗れる楕円の種別（扇形など）を増やすときは式の見直しが要るため、揃える箇所として辿れるようにする（列挙の中で「種別の分岐は持たないが、塗れる種別を増やすときは式を見直す」趣旨を添える）。
*   **`Line`・`Curve`**：先頭の判定の後、`return false`（面積を持たないため内側の点は無い。現在`isFillable()`は常に偽のため先頭の判定で必ず偽になる）。引数`x`・`y`は使わないがJSDocに書く。
*   **置き場所**：各クラスの`hitTest`の直後に置く。5クラスのクラスJSDocの共通メソッド契約の列挙を「15メソッド：…・isFillable・hitTestFill」に揃える（各クラスのタスクで行う）。メソッドのJSDocに「共通メソッド契約の第15メソッド」と書く。
*   **変えないもの**：`hitTest`・`intersectsRect`・`draw`・`drawHover`・`drawHandles`・`toDrawElement`・`toJSON`/`fromJSON`の結果と既存のJSDoc（クラスJSDocの契約の列挙と、`Ellipse.js`の`ELLIPSE_TYPES`のJSDocの列挙を除く）。

#### 1-3. `Ellipse.hitTest`（輪郭の近似）と内側の関係（隙間が無いことの確認）
*   `Ellipse.hitTest`の平均半径による近似は見直さない（現場設計AIの決定）。
*   **`rx ≥ 1`かつ`ry ≥ 1`（通常の分岐）**：`value = dx²/rx² + dy²/ry²`、`r = √value`、`a = (tolerance + strokeWidth / 2) / ((rx + ry) / 2)`。内側の当たり＝`value < 1`（⇔`r < 1`）、輪郭の当たり＝`|r − 1| ≤ a`。`tolerance > 0`（`InputTracker`は画面上5pxのワールド換算値を渡す）かつ`strokeWidth > 0`より`a > 0`のため、両者の和は`r ≤ 1 + a`の全体（中心から輪郭の外側の許容幅まで）を隙間なく覆う。`value`は`hitTest`と同じ式で求めるため、境目（`value`がちょうど1付近）で両者が食い違うことはない（`value < 1`なら内側、`value ≥ 1`なら`r ≥ 1`で、`r ≤ 1 + a`までは輪郭の当たり）。
*   **`rx < 1`または`ry < 1`（縮退の分岐。半径は正）**：内側は真の楕円の内側（`value < 1`）全体、輪郭は内接する100分割の折れ線までの距離が`tolerance + strokeWidth / 2`以下。楕円の内側の点はすべて内側の当たりが受け持つため、内側と輪郭の間に帯はできない。どちらにも当たらない点は、楕円の外側で輪郭の近似の許容幅を超えた点だけで、今の輪郭の当たりと同じ（境界ちょうどの点が折れ線の弦から許容幅より離れる極端な場合に、境界の線の上の点が当たらないことはあり得る。面積を持たない）。
*   **半径0**：内側は常に偽、輪郭の当たりは今どおり（縮退の分岐）。
*   **`Rect`・`Path`**：内側（境界を除くnonzeroの内側）∪輪郭（中心線から許容誤差以内。境界を含む）＝塗られている範囲と輪郭の許容幅の和。隙間は無い。

#### 1-4. JSDocの食い違いの修正（`ShapeDataValidation.js:18`）
*   `DEFAULT_STROKE_WIDTH`のJSDocの「図形クラスのコンストラクタの`strokeWidth`の既定値（新しく描く図形の太さ）とは別の定義。」を、次の趣旨に直す：「図形クラスのコンストラクタの`strokeWidth`の既定値（引数を省略して生成したときの値。新しく描く図形の太さは`core/VectorModel.js`の`DEFAULT_NEW_SHAPE_STYLE`が決める）とは別の定義。」
*   JSDocのみの変更。コード・他の行・エラー文は変えない（`shapes/`は`core/`をimportしない。コメントで名前を挙げるだけ）。

### 要件2: どの図形が選ばれるか（当たり分類の優先順位）

#### 2-1. 規則の置き場所（決定）：`js/core/PointHitRules.js`（新設）
*   **決定**：当たり分類の規則（ハンドル・本体）を、`core/`の新しいモジュール`PointHitRules.js`の状態を持たない`export`した関数として切り出す。`InputTracker`の`#classifyPoint`は、この関数へモデルの図形配列・選択中かの照会・座標・許容誤差を渡して結果を返すだけの薄い非公開メソッドにする。
*   **理由**：
    *   `node --test`で優先順位の規則を確かめるため（`InputTracker.js`は`DragTracker`・DOMのイベント・`HTMLInputElement`等に依存し、テストのためにソースを書き換えない規則（`_doc/arch/16_test.md`）のもとでは非公開メソッドを確かめられない）。
    *   `InputTracker.js`の`export`する関数として切り出す案は、テストが`InputTracker.js`全体（`DragTracker.js`・`ShapeFactory.js`を経由する図形クラス一式）をimportすることになり、DOMに触れない規則の置き場所として独立していないため採らない。
    *   切り出すのは当たり分類の規則だけ（ハンドルの規則は今のコードをそのまま移す。本体の規則だけを変える）。状態・入力状態・カーソル・ホバーの扱いは`InputTracker`に残す（`InputTracker`の再分離（状態の所有者設計）はしない）。
*   **依存**：`PointHitRules.js`は何もimportしない（図形は引数で受け取り、公開メソッドをポリモーフィックに呼ぶだけ）。`core/InputTracker.js` → `./PointHitRules.js`（`core/`内）。`shapes/`・`io/`・`edit/`・`VectorModel`・`ViewTransform`・DOMを知らない。
*   **責務（先頭行）**：「責務: 選択モードの当たり分類の規則（ある点が選択集合の図形のハンドル・図形の本体・空白のどれに当たるか）を、図形の公開メソッドと選択中かの照会だけで判定する、状態を持たない関数として提供する。」の趣旨（3行以内）。

#### 2-2. 公開する関数と型
*   `export function classifyPointHit(shapes, isSelected, x, y, tolerance)` → `PointHit`。
    *   `shapes`：図形の配列（描画順。後ろが手前。`model.getShapes()`の戻り値）。読むだけで書き換えない。
    *   `isSelected`：`(id) => boolean`（選択集合に含まれるか。`InputTracker`は`(id) => this.model.isSelected(id)`を渡す）。
    *   `x`・`y`：判定する点（ワールド座標）。`tolerance`：輪郭・ハンドルの当たりの許容誤差（ワールドの長さ）。
    *   呼ぶ図形のメソッドは`hitTestHandle`・`hitTest`・`hitTestFill`と公開プロパティ`id`だけ。図形種別の分岐・`isFillable()`・`fillColor`の読み取りは持たない。
*   **typedef`PointHit`の正本**を`PointHitRules.js`へ移す（`handle: {shapeId, handle} | null`、`bodyId: string | null`。両方`null`は空白）。`InputTracker.js`の`PointHit`のtypedefは`@typedef {import('./PointHitRules.js').PointHit} PointHit`に置き換える（`#resolveCursor`・`#updateCursor`のJSDocが参照しているため名前を残す。`import()`型の書き方は`edit/CanvasLibrary.js`等で使われている）。
*   非公開の補助関数（`export`しない）に分けてよい（例：ハンドルの判定・本体の判定）。各関数にJSDoc（`@param`・`@returns`）を書く。

#### 2-3. 規則（`classifyPointHit`の中身）
1.  **ハンドル（今のまま）**：図形配列の後ろ（手前）から、`isSelected(shape.id)`が真の図形だけ`shape.hitTestHandle(x, y, tolerance)`を呼び、最初に非`null`になった図形とハンドル名を`handle`に入れる（`CanvasManager`がハンドルを図形配列の順に描くため、重なり順と一致する）。
2.  **本体・選択集合の図形の輪郭の当たり**：図形配列の後ろ（手前）から、`isSelected(shape.id)`が真で`shape.hitTest(x, y, tolerance)`が真の最初の図形を`bodyId`に採る（今は図形配列の先頭＝奥。向きを3と揃える）。
3.  **本体・それ以外**：2で決まらなければ、図形配列の後ろ（手前）から順に、`shape.hitTest(x, y, tolerance) || shape.hitTestFill(x, y)`が真になった最初の図形を`bodyId`に採る。選択集合の図形の内側もこの順番の中で扱い、選択集合だからといって内側を優先しない。
*   `handle`と`bodyId`は今と同じく独立に求める（ハンドルが当たっても`bodyId`を求める。押下・クリックの分岐の表がハンドルを先に見る）。
*   どれにも当たらなければ`bodyId: null`（空白）。

#### 2-4. 結果として起きること（押下・クリック・ホバー・カーソル）
*   `handleMouseDown`・`handleClick`・`handleMouseMove`・`#resolveCursor`は`#classifyPoint`の結果を今と同じに使うため、コードの分岐・JSDocの分岐の表は変えない。
    *   塗った図形の内側をクリック → その図形の単一選択。重なっている所では手前の図形。
    *   手前の塗った図形に隠れている奥の図形の輪郭の近く → 手前の塗った図形（奥の図形が選択集合に入っていれば、規則2により奥の図形）。
    *   塗りのない図形どうしの輪郭の重なり → 手前の図形（**既存の振る舞いの変化。発注者了承済み**）。
    *   塗りなしの図形の内側、塗れない形の図形の内側（`fillColor`を持っていても）→ 空白（範囲選択の開始・選択の解除）。
    *   選択集合内の図形の内側で押してドラッグ → 選択集合の移動。選択集合外の図形の内側で押してドラッグ → 動かない（1回クリックで選んでからドラッグ）。塗った内側で押しても範囲選択は始まらない。
    *   塗った内側にカーソルを乗せると、その図形のホバーの強調（`drawHover`。輪郭の強調）が出る。カーソルの形は選択集合内なら`move`、外なら`pointer`。
*   `InputTracker`のクラスJSDoc・`#classifyPoint`のJSDoc・`PointHit`の記述を新しい規則（正本は`PointHitRules.classifyPointHit`）に揃える。`InputTracker`は図形のメソッドを直接呼ばなくなる（`hitTest`・`hitTestHandle`・`hitTestFill`は`PointHitRules`が呼ぶ。範囲選択の`intersectsRect`・`getVertexIndexForHandle`等は今どおり`InputTracker`が呼ぶ）。

### 要件3: 見えない図形の選び方
*   変えない。見えない図形（線なしで塗れない形、または線も塗りもない図形）は塗られていないため`hitTestFill`は常に偽で、規則2・3のもとでも輪郭の当たりだけで選ばれる。範囲選択・全選択・ホバー・ハンドルも今どおり。
*   線なしで塗られた図形の輪郭付近（塗りの外側の5pxを含む）も、輪郭の当たり（`hitTest`。線の有無を見ない）で今どおり当たる。

### 要件4: 範囲選択
*   `intersectsRect`・範囲選択の流れ（`InputTracker`の`#finishLeftDrag`の確定）を変えない。塗った内側が矩形にかかっても選ばれない。

### 要件5: 書き出しとの整合
*   `hitTestFill`の先頭の判定（`isFillable() && typeof fillColor === 'string'`）は`draw`の`shouldFill`と同じ式。`toDrawElement()`は`fillColor: isFillable() ? fillColor : null`、`closed`は`Rect`・円が`true`、`Path`が`closed`のとおり、`Line`・弧が`false`（`Curve`は`quadratic`）のため、書き出し側（`io/CodeExporter.js`の`DRAW_SOURCE`の「`fillColor`が文字列で`polyline`/`ellipse`かつ`closed === true`」）が塗る要素と、`hitTestFill`が真になり得る図形は一致する。
*   各図形クラスのテストで、塗られている条件の一致（`toDrawElement()`の`fillColor`が文字列・`kind`が`polyline`/`ellipse`・`closed === true`のときに限り、形の内側の点で`hitTestFill`が真）を確かめる。`io/`は変更しない。

### 要件6: 自動テスト（`_doc/arch/16_test.md`の規則に従う）
*   **新設**：
    *   `test/shapes/ShapeGeometry.test.js`：`isPointInPolygonNonzero`だけを対象にする（既存の関数のテストは足さない）。
    *   `test/core/PointHitRules.test.js`：`classifyPointHit`。図形は実物の図形クラス（`Rect`・`Ellipse`・`Path`・`Line`等）で作り、`id`は公開プロパティへ文字列を直接代入する。`isSelected`はテストファイル内の`Set`による素の関数。
*   **追加（既存ファイルに`describe`を足す）**：`test/shapes/Rect.test.js`・`Path.test.js`・`Ellipse.test.js`・`Line.test.js`・`Curve.test.js`に`<クラス名>.hitTestFill`の`describe`を足す。
*   **既存のテストの書き換え**：計画時点で書き換えが必要なケースは見つかっていない（既存のテストに契約のメソッド数を確かめるケースは無く、`hitTest`・`intersectsRect`のケースは変えずに通る見込み）。実装中に書き換えが必要になった場合は、テストファイルとケース名・理由を該当タスクの詳細作業内容と5章に列挙する。
*   各タスクの完了時に`node --test`が`fail 0`であること（計画時点の件数：tests 841・pass 841・fail 0）。

### 要件7: テストプレイの準備と確認項目
*   テストプレイ用のファイル（自己交差する閉じたパス、巻き数0の穴を持つパス、頂点を動かした矩形等）は現場設計AIがテストプレイ時に用意する。実装AIは作成しない。確認項目は5章。

### 要件8: 開発資料への記載
*   「開発資料の更新予定」に列挙し、最終タスク（タスク11）で反映する。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/shapes/` - 図形クラス5つ（`Line`・`Curve`・`Rect`・`Ellipse`・`Path`。`hitTestFill`の追加とクラスJSDocの契約の列挙）、`ShapeGeometry.js`（`isPointInPolygonNonzero`の追加）、`ShapeDataValidation.js`（JSDocのみ）
    *   `./js/core/` - `PointHitRules.js`（新設。当たり分類の規則）、`InputTracker.js`（`#classifyPoint`を`PointHitRules`へ委ねる・JSDoc）
    *   `./test/shapes/`・`./test/core/` - 自動テスト（新設2ファイル、既存5ファイルへの追加）
*   **関連する論理クラス**: 図形クラス5つ（共通メソッド契約を自律実装。基底クラスなし）、`ShapeGeometry`（状態を持たない関数群）、`PointHitRules`（新設。状態を持たない関数群）、`InputTracker`（当たり分類の結果を押下・クリック・ホバー・カーソルで共用。分岐の表は変えない）、`VectorModel`（`getShapes`・`isSelected`を使う。変更しない）、`CanvasManager`（ハンドルの描画順。変更しない）
*   **新設のファイル**：`js/core/PointHitRules.js`・`test/core/PointHitRules.test.js`・`test/shapes/ShapeGeometry.test.js`。
*   **変更しないファイル**：`js/io/`・`js/edit/`・`js/palette/`・`js/check/`・`js/main.js`・`index.html`・`sprite-check.html`・`js/core/`のうち`InputTracker.js`以外の既存のファイル・`js/shapes/PathJoinRules.js`・`js/shapes/EndpointSnapRules.js`。

### 参照する責務
（`PROJECT_ARCHITECTURE.md`と`_doc/arch/`からの抜粋。以後のタスク実行は、この項目を責務の情報源とする）
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`をimportしない。`shapes/`は`core/`・`io/`をimportしない。共通モジュール（`ShapeGeometry.js`・`ShapeDataValidation.js`）は`shapes/`の外および互いをimportせず、importするのは`shapes/`の図形クラスのみ（`core/`・`io/`等からは使わない）。本作業で`core/InputTracker.js` → `core/PointHitRules.js`（`core/`内）を足す。`PointHitRules.js`は何もimportしない。
*   **同期の経路（全機能共通）**：再描画・UI同期は既存の経路（`model.onChange`・`viewTransform.onChange`・`historyManager.onChange`・`canvasLibrary.onChange`・`canvasFileOperations.onChange`、`applyMode`・`applyShapeType`）のみで行う。機能専用の再描画・同期処理を足さない（本作業は当たり分類の結果を変えるだけで、ホバーは今どおり`model.setHovered`/`clearHovered`で通知される）。
*   **shapes/**：図形種別ごとのデータ保持・描画・当たり判定・図形データとの相互変換を担う。座標はすべてワールド座標。共通基底クラスは無い。図形クラスの間で共通の幾何の計算と図形データの検証は、共通モジュールの関数を呼ぶ（継承ではなく関数の切り出し）。幾何の計算を図形クラスへ複製しない。
    *   **共通モジュール**：状態を持たない`export`した関数のみで、クラスにしない。`ShapeGeometry.js`は今`distanceToSegment`・`segmentIntersectsRect`・`quadraticBezierPoint`を持つ。式を変えると複数の図形の当たり判定が同時に変わるため、変えるときは`test/shapes/`の全テストを確かめる。
    *   **共通メソッド契約（現在14メソッド。本作業で15）**：`draw(ctx, t)`、`drawHandles(ctx, viewScale = 1)`、`drawHover(ctx, viewScale = 1)`、`hitTest(x, y, tolerance)`、`hitTestHandle(x, y, tolerance)`、`setVertex(vertexIndex, x, y)`、`translate(dx, dy)`、`updateDraftEnd(x, y)`、`getVertexIndexForHandle(handleName)`、`intersectsRect(minX, minY, maxX, maxY)`、`toDrawElement()`、`toJSON()`、`static fromJSON(data)`、`isFillable()`（＋本作業の`hitTestFill(x, y)`）。5クラスはいずれも自律実装し、各クラスのクラスJSDocは契約を列挙している（メソッドを増減する場合は5クラスのクラスJSDocも更新する）。
    *   **`isFillable()`**：塗れる形かの真偽値（データに保存しない）。`Line`・`Curve`は常に`false`、`Rect`は常に`true`、`Ellipse`は`type === 'circle'`（弧は`false`）、`Path`は`closed === true`。**塗れるかの規則はこのメソッドだけに置く**。
    *   **`draw`の描き方**：`shouldFill = this.isFillable() && typeof this.fillColor === 'string'`、`shouldStroke = typeof this.strokeColor === 'string'`。形のパス → 塗り（`fill()`引数なし＝nonzero）→ 線。`io/CodeExporter.js`の`DRAW_SOURCE`と命令・引数・順序を揃えている（本作業で`draw`は変えない）。
    *   `fillColor`は塗れない形でも保持する。`toDrawElement()`の`fillColor`は`this.isFillable() ? this.fillColor : null`。
    *   **`hitTest`**：輪郭の当たり。`Ellipse`は`strokeWidth/2`を許容誤差に足し、通常は平均半径`(rx+ry)/2`による比率の近似、`rx < 1 || ry < 1`では輪郭の100分割の折れ線までの距離で判定する。他4クラス（`Path`を含む）は`strokeWidth`を足さない。閉じたパスは終点→始点の区間も対象。
    *   **`intersectsRect`**：範囲選択用。輪郭線の中心線が一部でも掛かれば`true`。塗り内部は判定しない。
    *   **`Rect`**：4頂点`points[0]`=topLeft／`[1]`=topRight／`[2]`=bottomRight／`[3]`=bottomLeft。矩形維持の正規化はしない（4隅の自由変形が可能。`topLeft`等は論理名で見た目の位置を保証しない）。
    *   **`Ellipse`**：5頂点`points[0]`=中心／`[1]`=右端制御点／`[2]`=上端制御点／`[3]`・`[4]`=角の制御点。`rx = |points[1].x − xc|`、`ry = |points[2].y − yc|`。`type`（`'circle'`|`'arc'`）で振る舞いが分岐する。弧は画面の上半分。回転は表現できない（回転角は0固定）。
    *   **`Path`**：頂点数可変の`points`・`closed`・`segments`（`kind`は現在`'line'`のみ）。区間の種類による分岐の置き場所は`#tracePath`（描画）・`#someSegment`（当たり判定・範囲選択）。曲線の区間を足すときは描画・当たり判定・範囲選択・`toDrawElement`のすべてで分岐が要る。
    *   各図形クラス・`ShapeFactory`は`try/catch`を持たない。往復（`toJSON`→`fromJSON`）で描画・当たり判定の結果は一致する。
    *   **`ShapeDataValidation.js`の`DEFAULT_STROKE_WIDTH`の正しい位置づけ**（開発資料2章「線の太さ2pxの4つの定義と位置づけ」）：(1) `core/VectorModel.js`の`DEFAULT_NEW_SHAPE_STYLE.strokeWidth`＝新しく描く図形の既定の太さの唯一の定義。(2) 各図形クラスのコンストラクタの既定値`strokeWidth = 2`＝引数を省略して生成したときの値（新しく描く図形の太さを決めない）。(3) `ShapeDataValidation.js`の`DEFAULT_STROKE_WIDTH`＝読み込みでキーが無いときの値。(4) `io/SpriteSerializer.js`の`DEFAULT_STROKE_WIDTH`（(3)と同じ値であるべき）。
*   **InputTracker.js**：ユーザー入力の解釈とModel・ビュー変換への反映、状態依存の操作の公開、編集操作の開始・確定の通知、カーソル形状のフィードバックを担う。
    *   **知らないこと**：図形種別（if/switch分岐を一切行わず、図形の公開メソッドをポリモーフィックに呼ぶのみ。`vertexIndex`規約を`core/`層にハードコードしない）。`isFillable()`・`fillColor`を読まない。`HistoryManager.js`をimportしない。`main.js`の関数を呼ばない。
    *   **当たり分類**：1つの分類処理の結果をホバー・押下・クリック・カーソルの4箇所で共用し、クリックの解釈にホバー状態を参照しない。ハンドルの優先順位（図形配列の後ろ＝前面優先）は`CanvasManager`のハンドル描画順と一致させる。範囲選択の矩形の正規化は確定処理の1箇所のみ。当たり判定の許容誤差は画面上5px（`hitTolerance`）相当をワールド換算して渡す（`#getWorldHitTolerance()`）。
    *   **押下・クリックの分岐の表**（`handleMouseDown`・`handleClick`のJSDoc。本作業で変えない）：押下は、ハンドル`'move'`→移動、それ以外のハンドル→頂点の変形、本体が選択集合内→移動、本体が選択集合外→何もしない（離した後のclickで判定）、空白→範囲選択。クリックは、ハンドル上→何もしない、本体→その図形の単一選択、空白→選択集合が空でなければ全解除。
    *   **再分離（状態の所有者設計）はしない**（DIRの「やらないこと」。精度のPhase）。
*   **test/**：`node:test`・`node:assert/strict`のみ。置き場所と命名は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。先頭行に単一責務のJSDoc（3行以内）。補助関数にもJSDoc（`@param`・`@returns`）。対象は相対パスでimportし、公開APIのみを通す。テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。`globalThis`・`window`へ代入しない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止する。図形の`id`は公開プロパティ`id`へ文字列を直接代入して設定する。画面の操作や描画のテストは行わない。`test/`以下に共有の補助モジュール・テスト以外の`.js`を置かない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（資料本体への反映は最終タスク（タスク11）で行う。各タスクで判明した事項はここへ追記する）
*   **`PROJECT_ARCHITECTURE.md` 1章**：
    *   フォルダ構造の`core/`に`PointHitRules.js`を追加（`InputTracker.js`の後。コメント「当たり分類の規則（状態なし）」程度）。`test/core/`に`PointHitRules.test.js`、`test/shapes/`に`ShapeGeometry.test.js`を追加。
    *   「存在しないもの」から「塗った内側のクリックでの選択（内側の当たり判定）」を削除し、代わりに「塗った内側による範囲選択」を加える（DIRの「やらないこと」）。
    *   依存方向の段落に「`core/InputTracker`は`core/PointHitRules`をimportする（`core/`内。`PointHitRules`は何もimportしない）」を加える。
    *   「フォルダ分割の方針」の`core/`の記述（今は「横断的な処理（入力→状態→描画の複数層にまたがるもの）。」）を、`PointHitRules`が字義どおりの「横断的な処理」に当たらないことと食い違わないよう改める：「横断的な処理（入力→状態→描画の複数層にまたがるもの）と、その処理だけが使う状態を持たない規則の関数（`PointHitRules`（当たり分類の規則）。`InputTracker`から使う。DOM・状態に触れない形で`node --test`で確かめるために切り出したもので、`InputTracker`の再分離ではない）。」の趣旨。
*   **`PROJECT_ARCHITECTURE.md` 2章**：
    *   「スタイル3つの読み書き」の「共通メソッド契約は14メソッドのまま」を、本作業で15メソッドになった（`hitTestFill`の追加。スタイルの読み書きのためのメソッドは無い）旨へ改める。
    *   「塗れる形」の「06-03で内側の当たり判定に使う予定」を「内側の当たり判定（各図形クラスの`hitTestFill`）も使う」へ改める。
    *   「JSDocの食い違い（JSDocが直るまでの正しい記述）」の項目を削除する（JSDocを直したため）。
*   **`PROJECT_ARCHITECTURE.md` 3章**：3.「入力監視」に「当たり分類（クリック・押下・ホバー・カーソル）」の項を足す：規則の正本は`core/PointHitRules.classifyPointHit`、ハンドル（選択集合・手前優先・今のまま）→ 本体（選択集合の図形の輪郭・手前優先 → それ以外は手前から輪郭または塗った内側。選択集合の内側を優先しない）、塗った内側で押しても範囲選択は始まらない、選択集合外の図形は押してそのままドラッグでは動かない、範囲選択は輪郭のみ（`intersectsRect`）、Phase 06-03での振る舞いの変化（塗りのない図形どうしの輪郭の重なり・選択集合の図形が複数当たる場合に手前が選ばれるようになった。発注者了承済み）、見えない図形は輪郭の当たりだけで選ばれる（2026-11-12 発注者の決定）。
*   **`PROJECT_ARCHITECTURE.md` 4章の一覧**：`PointHitRules.js`の行を追加（`_doc/arch/18_PointHitRules.md`）。
*   **`_doc/arch/18_PointHitRules.md`（新設）**：責務、公開（`classifyPointHit`・typedef`PointHit`の正本）、読むもの（図形の`id`・`hitTestHandle`・`hitTest`・`hitTestFill`、引数の`isSelected`）、使う側（`InputTracker`の`#classifyPoint`のみ）、知らないこと（図形種別・`isFillable()`・`fillColor`・`VectorModel`・`ViewTransform`・表示倍率（許容誤差はワールドの長さで受け取る）・DOM）、規則の要約（正本はJSDoc）、置き場所の理由（`node --test`で確かめるため。`InputTracker`の再分離ではない）、注意（ハンドルの優先順位は`CanvasManager`のハンドル描画順と一致させること）。
*   **`_doc/arch/12_shapes.md`**：
    *   共通モジュールの`ShapeGeometry.js`の関数一覧に`isPointInPolygonNonzero`（多角形の内側の判定。nonzero・境界を含まない・頂点3未満と面積0は偽。`Rect`・`Path`の`hitTestFill`が使う）を追加。
    *   「JSDocの食い違い」の記述を削除。
    *   「14メソッド契約」を「15メソッド契約」に改め、一覧に`hitTestFill(x, y)`を追加。「`Line`/`Curve`/`Rect`/`Ellipse`/`Path`はいずれもこの14メソッドを自律実装する」を15メソッドへ。「各図形クラスのクラスJSDocは契約（`isFillable`を含む14メソッド）を列挙」を15メソッド（`hitTestFill`を含む）へ。
    *   `hitTestFill`の項を新設：塗られている（`isFillable() && typeof fillColor === 'string'`。`draw`の`shouldFill`・書き出し側の塗る条件と同じ結果）ときだけ真、許容誤差を使わない、境界を含まない（輪郭の当たりが受け持つ）、`Rect`・`Path`は`isPointInPolygonNonzero`（`Rect`は4頂点の多角形として。`Path`は`#tracePath`と同じ並び）、`Ellipse`は`hitTest`と同じ式の`value < 1`で厳密に（半径0は偽、`rx < 1 || ry < 1`でも半径が正なら厳密）、`Line`・`Curve`は常に偽、`hitTest`と分けた理由（選択集合の図形の輪郭と内側を別の優先順位で扱うため）、呼び出し元は`core/PointHitRules`のみ。`Ellipse.hitTest`の近似は見直していない（内側と輪郭の和に隙間が無いこと。1-3の要約）。
    *   `isFillable()`の項の「06-03（内側の当たり判定）でも使う予定」を「各図形クラスの`hitTestFill`が使う」へ。
    *   新規図形を追加する際の注意に、`hitTestFill`の実装（塗れない形は常に偽）と、幾何の計算に多角形の内側の判定を共通モジュールから使うこと、`test/shapes/<クラス名>.test.js`へ`hitTestFill`のテストを足すことを追加。
    *   `Path.js`の「将来の注意」に、曲線の区間を足すときは`hitTestFill`（内側の判定の頂点の並び）にも分岐が要ることを追加。`Ellipse.js`の項に、弧の塗り・回転を入れるときは`hitTestFill`の式を見直すことを追加。
*   **`_doc/arch/10_ShapeFactory.md`**：
    *   「図形種別の追加手順」の①「図形クラスを`shapes/`に追加（14メソッド契約を満たす。…）」を「15メソッド契約」へ改める（他の記述は変えない）。
    *   （計画時の確認：`PROJECT_ARCHITECTURE.md`・`_doc/arch/`で「14メソッド」の記述が残るのは、`PROJECT_ARCHITECTURE.md`2章「スタイル3つの読み書き」・`_doc/arch/12_shapes.md`（契約の見出し・「この14メソッドを自律実装する」・クラスJSDocの列挙の記述）・本ファイルの3箇所のみで、いずれも本欄に列挙済み。）
*   **`_doc/arch/06_InputTracker.md`**：
    *   「知らないこと」を「図形の当たり判定のメソッド（`hitTest`・`hitTestHandle`・`hitTestFill`）は`PointHitRules`経由でのみ呼ぶ。`intersectsRect`・`getVertexIndexForHandle`は直接ポリモーフィックに呼ぶ。`isFillable()`・`fillColor`を読まない」の趣旨に改める。
    *   「当たり分類」に、規則の正本は`core/PointHitRules.classifyPointHit`で、`#classifyPoint`はモデルの図形配列・`isSelected`・許容誤差を渡すだけであることを加える。
    *   「行数」を実装後の行数へ更新する。
*   **`_doc/arch/16_test.md`**：
    *   既存のテストファイルと検証範囲に、`test/shapes/ShapeGeometry.test.js`（`isPointInPolygonNonzero`）・`test/core/PointHitRules.test.js`（当たり分類の規則）を追加。各図形クラスのテストの検証範囲に`hitTestFill`（塗られている条件・形の内側・境界・頂点を動かした矩形・凹型と自己交差・つぶれた円・平行移動と往復の後・書き出し側の塗る条件との一致）を追加。
    *   「共通モジュール（`ShapeGeometry`・`ShapeDataValidation`）の関数そのもののテストは無く」を、`isPointInPolygonNonzero`だけは`test/shapes/ShapeGeometry.test.js`で直接確かめる旨へ改める。
    *   テストできない箇所に、`InputTracker`の当たり分類の配線（`#classifyPoint`から`classifyPointHit`への受け渡し・ホバー・カーソル・押下・クリックの分岐）はテストプレイで確かめる旨を追加。
    *   書き換えた既存のテストがあれば記録する（計画時点では無し）。

## 3. タスクリスト
*   [x] タスク1: 多角形の内側の判定（`ShapeGeometry.js`）とそのテスト
    *   **対象ファイル** :
        *   `./js/shapes/ShapeGeometry.js` : 更新（関数の追加・先頭の責務の記述の更新）
        *   `./test/shapes/ShapeGeometry.test.js` : 新規
    *   **作業内容** :
        *   2章1-1のとおり`isPointInPolygonNonzero(px, py, points)`を足す。JSDoc（`@param`・`@returns`、nonzeroの規則、閉じた多角形として扱うこと、境界を含まないこと、頂点3未満・面積0は偽、浮動小数の注意、例外を投げないこと、引数を書き換えないこと）を書く。先頭の責務の記述に多角形の内側の判定（nonzero）を足す（3行以内）。既存の3関数は変えない。
        *   テスト：凸（正方形・三角形）・凹（`ship.js`の機体のような4頂点の矢じり形。例`(20,0)`,`(-10,-10)`,`(-4,0)`,`(-10,10)`でくぼみ`(-7,0)`が外）の内側／外側、境界上（辺の上・頂点の上は偽）、五芒星（正五角形の頂点を1つおきに結ぶ）の中心が真・星の先端の三角形の内側が真、巻き数0の穴（外側を一方向・内側を逆方向に回り、橋の辺でつないだ1つの多角形。穴の中は偽・外側の帯は真）、頂点0・1・2個で偽、面積0（3点が一直線・すべて同じ点）で辺の上も外も偽で例外を投げない、頂点の向き（時計回り・反時計回り）によらず同じ結果、引数の配列・頂点を書き換えないこと。
        *   プロジェクトのルートで`node --test`を実行し、`fail 0`と件数を詳細作業内容に記録する。詳細作業内容を記入し、本タスクを`[x]`にする。開発資料に影響があれば更新予定欄へ追記する。
*   [x] タスク2: `Rect.hitTestFill`とそのテスト
    *   **対象ファイル** :
        *   `./js/shapes/Rect.js` : 更新
        *   `./test/shapes/Rect.test.js` : 更新（`describe('Rect.hitTestFill')`の追加）
    *   **作業内容** :
        *   2章1-2のとおり`hitTestFill(x, y)`を`hitTest`の直後に足す（先頭の判定 → `isPointInPolygonNonzero(x, y, this.points)`。`ShapeGeometry.js`のimportに追加）。JSDoc（第15メソッド、塗られている条件、許容誤差を使わないこと、境界を含まないこと、4頂点の多角形としてnonzeroで判定し軸平行・凸・自己交差なしを前提にしないこと、`@param`・`@returns`）。クラスJSDocの契約の列挙を15メソッド（末尾に`hitTestFill`）へ。
        *   テスト：塗られた矩形の内側で真・外側で偽・辺の上と頂点の上で偽、`fillColor: null`で偽、`strokeColor: null`でも塗られていれば真、頂点を動かした矩形（軸に平行でない（菱形）・凹（1頂点を内へ）のくぼみは偽・自己交差（蝶ネクタイ形。`points`を`(0,0)`,`(100,0)`,`(0,100)`,`(100,100)`等）の2つの三角形の内側は真で交差していない左右のすき間は偽）、`translate`後に移動先で真・元の位置で偽、`toJSON`→`fromJSON`の往復後も同じ結果、塗られている条件が`toDrawElement()`の塗る条件（`fillColor`が文字列・`kind`が`polyline`・`closed === true`）と一致すること。既存の`Rect.hitTest`・`Rect.intersectsRect`のケースは変えない。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。開発資料に影響があれば更新予定欄へ追記する。
*   [x] タスク3: `Path.hitTestFill`とそのテスト
    *   **対象ファイル** :
        *   `./js/shapes/Path.js` : 更新
        *   `./test/shapes/Path.test.js` : 更新（`describe('Path.hitTestFill')`の追加）
    *   **作業内容** :
        *   2章1-2のとおり`hitTestFill(x, y)`を`hitTest`の直後に足す（先頭の判定 → `isPointInPolygonNonzero(x, y, this.points)`。importに追加）。JSDoc（第15メソッド、塗られている条件、許容誤差を使わないこと、境界を含まないこと、`#tracePath`と同じ頂点の並び（閉じる区間を含む）でnonzeroで判定すること、**曲線の区間を足すときに区間の種類による分岐をここに足すこと**、`@param`・`@returns`）。クラスJSDocの契約の列挙を15メソッドへ。
        *   テスト：塗られた閉じたパスの内側で真・外側で偽・境界上で偽、`fillColor: null`で偽、開いたパスは`fillColor`が色の文字列でも（閉じれば内側になる位置でも）偽、`strokeColor: null`でも塗られていれば真、凹型（`ship.js`の機体のような4頂点）のくぼみが偽で本体が真、自己交差（五芒星の閉じたパス）の中心が真、巻き数0の穴を持つ閉じたパスの穴が偽、長さ0の区間（重複する頂点）を含んでも例外を投げない、`translate`後・`toJSON`→`fromJSON`の往復後も同じ結果、塗られている条件が`toDrawElement()`の塗る条件と一致すること（開いた／閉じた × `fillColor`の有無）。既存のケースは変えない。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。開発資料に影響があれば更新予定欄へ追記する。
*   [x] タスク4: `Ellipse.hitTestFill`とそのテスト
    *   **対象ファイル** :
        *   `./js/shapes/Ellipse.js` : 更新
        *   `./test/shapes/Ellipse.test.js` : 更新（`describe('Ellipse.hitTestFill')`の追加）
    *   **作業内容** :
        *   2章1-2のとおり`hitTestFill(x, y)`を`hitTest`の直後に足す（先頭の判定 → `rx`・`ry`を`draw`と同じ式で求める → `rx * rx > 0 && ry * ry > 0`でなければ偽 → `(dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) < 1`）。JSDoc（第15メソッド、塗られている条件（弧は常に偽）、許容誤差を使わないこと、境界を含まないこと、つぶれた円の扱い（半径0は偽・半径が正なら`rx < 1 || ry < 1`でも厳密）、`hitTest`の`value`と同じ式にしている理由、`hitTest`の平均半径の近似との和に隙間が無いこと（2章1-3の要約）、**弧の塗り・回転を入れるときは本メソッドの式と塗れる形の判定を見直すこと**、`@param`・`@returns`）。クラスJSDocの契約の列挙を15メソッドへ。ファイル先頭付近の`ELLIPSE_TYPES`のJSDoc（種別を増やす場合に揃える箇所の列挙）に`hitTestFill`を加える（2章1-2。`hitTestFill`は`isFillable()`を通すだけで種別の分岐を持たないが、塗れる楕円の種別（扇形など）を増やすときは式の見直しが要る箇所として辿れるようにする。その趣旨を列挙の中に短く添える。列挙の他の項目・文は変えない）。
        *   テスト：塗られた円・楕円（`rx ≠ ry`）の中心と内側（比率0.9程度）で真・外側（比率1.1程度）で偽・軸上の境界ちょうど（例`(xc + rx, yc)`）で偽、`fillColor: null`で偽、弧は`fillColor`が色の文字列でも中心・弧の内側で偽、`strokeColor: null`でも塗られていれば真、つぶれた円（`rx = 0`・`ry = 0`・両方0）は中心を含めどこでも偽で例外を投げない、`rx = 0.5`・`ry = 50`は中心で真・離れた点（例`(xc + 1000, yc + 1000)`や`(xc + 2, yc)`）で偽、`translate`後・`toJSON`→`fromJSON`の往復後も同じ結果、塗られている条件が`toDrawElement()`の塗る条件（`kind`が`ellipse`・`closed === true`・`fillColor`が文字列）と一致すること（円／弧 × `fillColor`の有無）、内側と輪郭の当たりの間に隙間が無いこと（例：`rx = 100`・`ry = 50`の円の中心から外へ向かう線上の点を細かく取り、`hitTestFill(x, y) || hitTest(x, y, 5)`が比率`1 + (5 + strokeWidth/2)/r_avg`より十分内側では常に真になること。境界付近は浮動小数の誤差に余裕を持たせる）。既存のケースは変えない。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。開発資料に影響があれば更新予定欄へ追記する。
*   [ ] タスク5: `Line.hitTestFill`とそのテスト
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` : 更新
        *   `./test/shapes/Line.test.js` : 更新（`describe('Line.hitTestFill')`の追加）
    *   **作業内容** :
        *   2章1-2のとおり`hitTestFill(x, y)`を`hitTest`の直後に足す（先頭の判定 → `return false`）。JSDoc（第15メソッド、塗れない形（`isFillable()`が常に偽）のため常に偽であること、直線は面積を持たないこと、`x`・`y`は使わないこと、`@param`・`@returns`）。クラスJSDocの契約の列挙を15メソッドへ。
        *   テスト：`fillColor`が色の文字列でも`null`でも、線の上・線の近く・離れた点で常に偽、`strokeColor: null`でも偽、`toDrawElement()`が塗る条件を満たさないこと（`closed: false`）と一致すること。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。
*   [ ] タスク6: `Curve.hitTestFill`とそのテスト
    *   **対象ファイル** :
        *   `./js/shapes/Curve.js` : 更新
        *   `./test/shapes/Curve.test.js` : 更新（`describe('Curve.hitTestFill')`の追加）
    *   **作業内容** :
        *   2章1-2のとおり`hitTestFill(x, y)`を`hitTest`の直後に足す（先頭の判定 → `return false`）。JSDoc（第15メソッド、塗れない形のため常に偽、曲線と弦で囲まれた部分も内側としないこと、`x`・`y`は使わないこと、`@param`・`@returns`）。クラスJSDocの契約の列挙を15メソッドへ。
        *   テスト：`fillColor`が色の文字列でも`null`でも、曲線と弦で囲まれる部分・曲線の上・離れた点で常に偽、`toDrawElement()`の`kind`が`quadratic`（塗らない）であることと一致すること。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。この時点で5クラスすべてに`hitTestFill`が実装されていることを確かめる。
*   [ ] タスク7: `DEFAULT_STROKE_WIDTH`のJSDocの食い違いの修正
    *   **対象ファイル** :
        *   `./js/shapes/ShapeDataValidation.js` : 更新（JSDocのみ）
    *   **作業内容** :
        *   2章1-4のとおり、`DEFAULT_STROKE_WIDTH`のJSDocの「（新しく描く図形の太さ）」を実態に合わせて直す。コード・他のJSDoc・エラー文は変えない。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。
*   [ ] タスク8: 当たり分類の規則（`core/PointHitRules.js`）とそのテスト
    *   **対象ファイル** :
        *   `./js/core/PointHitRules.js` : 新規
        *   `./test/core/PointHitRules.test.js` : 新規
    *   **作業内容** :
        *   2章2-1〜2-3のとおり、先頭行の責務（3行以内）、typedef`PointHit`（正本）、`export function classifyPointHit(shapes, isSelected, x, y, tolerance)`を作る。何もimportしない。ハンドルの規則は今の`InputTracker`の`#classifyPoint`のハンドルの部分と同じ（選択集合の図形だけ・図形配列の後ろから・最初の非`null`）。本体は規則2（選択集合の図形の輪郭・後ろから）→ 規則3（後ろから`hitTest || hitTestFill`）。図形種別の分岐・`isFillable()`・`fillColor`の読み取りを持たない。すべての関数・typedefにJSDoc（`@param`・`@returns`、規則と理由、`shapes`・`isSelected`を書き換えない／呼ぶだけであること）。本タスクでは`InputTracker`をまだ変えない（画面の振る舞いは変わらない）。
        *   テスト（図形は実物の図形クラス、`id`は直接代入、`isSelected`は`Set`による関数）：
            *   規則1：選択集合の図形のハンドルが当たる（`handle`に`shapeId`とハンドル名）、選択されていない図形のハンドルは当たらない、ハンドルが重なるときは手前（図形配列の後ろ）の図形、ハンドルが当たっても`bodyId`も求められること。
            *   規則2：選択集合の図形の輪郭が、手前の選択されていない塗った図形の内側より優先される。選択集合の図形が複数当たるとき手前が選ばれる。
            *   規則3：選択中の奥の大きな塗った図形の上にある手前の図形の内側で、手前の図形が選ばれる（選択集合だからといって内側を優先しない）。塗った図形の内側で、その図形が選ばれる（手前に何も無ければ選択中の図形の内側でもその図形）。塗った図形が重なる所で手前が選ばれる。手前の塗った図形に隠れた奥の図形（選択されていない）の輪郭の近くで手前の塗った図形が選ばれる。塗りのない図形どうしの輪郭の重なりで手前が選ばれる。
            *   空白：塗りなしの図形の内側、塗れない形（開いたパス・弧）の`fillColor`を持つ図形の内側は`bodyId: null`。図形0個で`handle: null`・`bodyId: null`。
            *   見えない図形（`strokeColor: null`・`fillColor: null`）が輪郭の当たりで選ばれ、内側では選ばれない。線なしで塗られた図形の塗りの外側の許容誤差以内（輪郭の当たり）で選ばれる。
            *   引数の図形配列の並びを書き換えないこと。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。開発資料に影響があれば更新予定欄へ追記する。
*   [ ] タスク9: `InputTracker`の当たり分類を`PointHitRules`へ委ねる
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `import { classifyPointHit } from './PointHitRules.js';`を足す。`#classifyPoint(point)`の本体を`return classifyPointHit(this.model.getShapes(), (id) => this.model.isSelected(id), point.x, point.y, this.#getWorldHitTolerance());`に置き換える（引数・戻り値・呼び出し元4箇所は変えない）。
        *   JSDocを揃える：`PointHit`のtypedefを`@typedef {import('./PointHitRules.js').PointHit} PointHit`（正本は`PointHitRules.js`である旨の説明付き）に置き換える。`#classifyPoint`のJSDocの規則の記述を、規則の正本は`PointHitRules.classifyPointHit`で、ハンドル（今のまま）→ 本体（選択集合の図形の輪郭・手前優先 → 手前から輪郭または塗った内側）の要約と、図形のメソッドを直接呼ばないことへ改める。クラスJSDocの当たり分類の記述（「当たり分類（#classifyPoint）」の箇所と「図形種別の分岐・図形固有のプロパティ名は持たない」の近く）に、当たり分類の規則は`PointHitRules`に委ねる旨を足す。`handleMouseDown`・`handleClick`の分岐の表、`handleMouseMove`・`#resolveCursor`のコードとJSDocは変えない。
        *   `isFillable()`・`fillColor`・図形種別の分岐を持ち込まない。`main.js`・他の`core/`ファイルは変えない。
        *   `node --test`の`fail 0`と件数を記録する（`InputTracker`の自動テストは無い。画面の振る舞いはテストプレイで確かめる）。詳細作業内容を記入して`[x]`にする。実装後の`InputTracker.js`の行数を詳細作業内容に記録する（開発資料の「行数」の更新に使う）。
*   [ ] タスク10: JSDocの記載漏れの確認
    *   **対象ファイル** :
        *   タスク1〜9で変更・新設したファイル（確認のみ。漏れがあればそのファイルを修正）
    *   **作業内容** :
        *   新設・変更したメソッド・関数・typedefのJSDoc（`@param`・`@returns`）、新設ファイルの先頭行の責務（3行以内）、`ShapeGeometry.js`の先頭の責務の記述、5クラスのクラスJSDocの共通メソッド契約の列挙（15メソッド。`Path`を含む）、`InputTracker`の当たり分類の記述（クラスJSDoc・`#classifyPoint`・`PointHit`）、`Path.hitTestFill`の曲線の区間の注意・`Ellipse.hitTestFill`の弧の塗り・回転の注意・`Ellipse.js`の`ELLIPSE_TYPES`のJSDocの列挙に`hitTestFill`があることを確認する。テストファイルの補助関数のJSDocも確認する。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。
*   [ ] タスク11: 開発資料への反映（最終タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（1章・2章・3章・4章の一覧）
        *   `./_doc/arch/12_shapes.md` : 更新
        *   `./_doc/arch/10_ShapeFactory.md` : 更新（「図形種別の追加手順」の契約のメソッド数のみ）
        *   `./_doc/arch/06_InputTracker.md` : 更新
        *   `./_doc/arch/16_test.md` : 更新
        *   `./_doc/arch/18_PointHitRules.md` : 新規
    *   **作業内容** :
        *   2章「開発資料の更新予定」の各項目（タスク実行中に追記された項目を含む）を、`PROJECT_ARCHITECTURE.md`冒頭の記載基準（1つのファイルのJSDocを読めば分かることは書かない・責務と境界・流れ・設計判断の理由・やらないと決めたことを残す）に従って反映する。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、本最終タスクのみ明示的な例外とする（後続タスクが無く、他タスクの前提が動く危険が無いため）。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 多角形の内側の判定（`ShapeGeometry.js`）とそのテスト
*   **作業内容** :
    *   `js/shapes/ShapeGeometry.js`に`isPointInPolygonNonzero(px, py, points)`を追加（2章1-1の順序どおり：頂点3未満で偽 → 辺の上・頂点の上で偽 → Sundayの方法の巻き数が0でなければ真）。JSDocに規則・閉じた多角形・境界を含まない・面積0は偽・浮動小数の注意・非破壊・例外なしを記載。先頭の責務の記述に多角形の内側の判定（nonzero）を追加（3行以内）。既存3関数は未変更。
    *   `test/shapes/ShapeGeometry.test.js`を新規作成（凸・凹・境界上・五芒星・巻き数0の穴・頂点0〜2個・面積0・向き不変・非破壊）。
    *   `node --test`：tests 851・pass 851・fail 0（新規10ケース追加、既存ケースの書き換えなし）。

### タスク2: `Rect.hitTestFill`とそのテスト
*   **作業内容** :
    *   `js/shapes/Rect.js`：`ShapeGeometry.js`のimportに`isPointInPolygonNonzero`を追加。`hitTest`の直後（`intersectsRect`の直前）に`hitTestFill(x, y)`を追加（先頭の判定`!isFillable() || typeof fillColor !== 'string'`で偽 → `isPointInPolygonNonzero(x, y, this.points)`）。JSDoc（第15メソッド・塗られている条件・許容誤差なし・境界を含まない・4頂点の多角形nonzero・軸平行/凸/自己交差なしを前提にしない）を記載。クラスJSDocの契約の列挙を15メソッド（末尾`hitTestFill`）へ。他のメソッドは未変更。
    *   `test/shapes/Rect.test.js`：`describe('Rect.hitTestFill')`を追加（11ケース：内側/外側、辺・頂点の上、fillColor null、strokeColor null、許容誤差を使わない、菱形、凹、蝶ネクタイ、translate、往復、toDrawElementの塗る条件との一致）。先頭の責務の記述に「（輪郭・内側）」を追記。既存ケースの書き換えなし。
    *   `node --test`：tests 862・pass 862・fail 0。

### タスク3: `Path.hitTestFill`とそのテスト
*   **作業内容** :
    *   `js/shapes/Path.js`：`ShapeGeometry.js`のimportに`isPointInPolygonNonzero`を追加。`hitTest`の直後（`intersectsRect`の直前）に`hitTestFill(x, y)`を追加（先頭の判定で偽 → `isPointInPolygonNonzero(x, y, this.points)`）。JSDoc（第15メソッド・塗られている条件・開いたパスは偽・許容誤差なし・境界を含まない・`#tracePath`と同じ頂点の並びでnonzero・曲線の区間を足すときはここで`kind`により分岐を足すこと）を記載。クラスJSDocの契約の列挙を15メソッド（末尾`hitTestFill`）へ。他のメソッドは未変更。
    *   `test/shapes/Path.test.js`：`describe('Path.hitTestFill')`を追加（13ケース：内側/外側、境界上、fillColor null、strokeColor null、開いたパス、凹型、五芒星、巻き数0の穴、長さ0の区間、許容誤差を使わない、translate、往復、toDrawElementの塗る条件との一致）。補助関数`makeFilledClosed`を追加。先頭の責務の記述に「（輪郭・内側）」を追記。既存ケースの書き換えなし。
    *   `node --test`：tests 875・pass 875・fail 0。

### タスク4: `Ellipse.hitTestFill`とそのテスト
*   **作業内容** :
    *   `js/shapes/Ellipse.js`：`hitTest`の直後（`#distanceToOutline`の直前）に`hitTestFill(x, y)`を追加（先頭の判定で偽 → `rx`・`ry`を`draw`と同じ式で求める → `rx * rx > 0 && ry * ry > 0`でなければ偽 → `dx²/rx² + dy²/ry² < 1`）。JSDoc（第15メソッド・塗られている条件・弧は常に偽・許容誤差なし・境界を含まない・つぶれた円の扱い・`hitTest`の`value`と同じ式の理由・内側と輪郭の和に隙間が無いこと・弧の塗り/回転を入れるときは式と`isFillable()`を見直すこと）を記載。クラスJSDocの契約の列挙を15メソッド（末尾`hitTestFill`）へ。`ELLIPSE_TYPES`のJSDocの列挙の後ろに、`hitTestFill`は種別の分岐を持たないが塗れる種別を増やすときは式の見直しが要る旨を1文添えた（既存の列挙は未変更）。他のメソッドは未変更。
    *   `test/shapes/Ellipse.test.js`：`describe('Ellipse.hitTestFill')`を追加（13ケース：円の内外、楕円、軸上の境界、fillColor null、strokeColor null、弧、許容誤差を使わない、つぶれた円、rx=0.5・ry=50、translate、往復、toDrawElementの塗る条件との一致、内側と輪郭の隙間なし）。先頭の責務の記述に「輪郭（縮退時の分岐を含む）・内側」を反映。既存ケースの書き換えなし。
    *   `node --test`：tests 888・pass 888・fail 0。

### タスク5: `Line.hitTestFill`とそのテスト
*   **作業内容** :
    *   (未実施)

### タスク6: `Curve.hitTestFill`とそのテスト
*   **作業内容** :
    *   (未実施)

### タスク7: `DEFAULT_STROKE_WIDTH`のJSDocの食い違いの修正
*   **作業内容** :
    *   (未実施)

### タスク8: 当たり分類の規則（`core/PointHitRules.js`）とそのテスト
*   **作業内容** :
    *   (未実施)

### タスク9: `InputTracker`の当たり分類を`PointHitRules`へ委ねる
*   **作業内容** :
    *   (未実施)

### タスク10: JSDocの記載漏れの確認
*   **作業内容** :
    *   (未実施)

### タスク11: 開発資料への反映
*   **作業内容** :
    *   (未実施)

## 5. 懸念事項・要確認ポイント

### 計画時の判断・注意
*   **既存の振る舞いの変化（発注者了承済み。作業レポートにも明記すること）**：(1) 塗りのない図形どうしの輪郭が重なる所をクリックすると、今は奥の図形が選ばれるが、手前の図形が選ばれるようになる。(2) 選択集合の図形が複数当たる場合、今は奥（図形配列の先頭）が採られるが、手前が採られるようになる（押下では選択集合の移動になるため結果は同じ。クリックでは単一選択される図形が変わる）。(3) 塗った図形の内側が「本体」になるため、そこで押しても範囲選択は始まらない（今は空白として範囲選択が始まっていた）。
*   **境界上の点を内側に含めない（決定）**：多角形・楕円とも境界ちょうどの点は`hitTestFill`が偽で、輪郭の当たり（距離0）が受け持つ。REQ要件1の楕円の式は`≤ 1`と書かれているが、境界の扱いは計画で決めるとされているため`< 1`とし、多角形と揃えた。境界上の点は輪郭の当たりで必ず選べるため、利用者から見た違いは無い。
*   **つぶれた円の内側（決定）**：半径0（2乗が0へ丸められる半径を含む）は偽。半径が正なら`rx < 1 || ry < 1`でも楕円の式で厳密に判定する（REQは偽としてもよいとしているが、内側を偽にしないほうが内側と輪郭の当たりの間に隙間が生じないため）。除算の分母は0にならず、`NaN`・`Infinity`は生じない。
*   **`Ellipse.hitTest`の近似との関係**：2章1-3のとおり、通常の分岐では内側（`value < 1`）と輪郭（`|r − 1| ≤ a`、`a > 0`）の和が`r ≤ 1 + a`を隙間なく覆う。`hitTestFill`の`value`を`hitTest`と同じ式にしているため境目で食い違わない。将来`hitTest`の式を見直すときは、`hitTestFill`との和に隙間ができないことを確かめ直すこと。
*   **規則の置き場所**：`core/PointHitRules.js`に切り出した（理由は2章2-1）。`core/`の「横断的な処理」の方針に対して、入力（`InputTracker`）から使われる規則の関数という位置づけで置く（`ShapeFactory`のような層内の補助と同じ扱い）。方針と実態が食い違わないよう、開発資料1章「フォルダ分割の方針」の`core/`の記述をタスク11で改める（2章「開発資料の更新予定」）。ハンドルの規則は今のコードをそのまま移すだけで変えない。
*   **`Line`・`Curve`の`hitTestFill`**：先頭の判定（`isFillable()`を通す）の後に`return false`を置くため、現在は先頭の判定で必ず偽になり、後の`return false`は到達しても結果が同じ。塗れるかの規則を`isFillable()`の外へ書かないための形である（「直線は塗れない」を`hitTestFill`に直書きしない）。
*   **将来この箇所を修正する際の注意**：
    *   曲線の区間を`Path`に足すとき（パスの編集のPhase）：`Path.hitTestFill`は頂点の並びをそのまま多角形として判定しているため、曲線の区間を折れ線で近似した頂点の並びにする等の分岐が要る（`#tracePath`・`#someSegment`と同じく区間の種類で分ける）。閉じる区間が曲線の場合にも注意。
    *   弧の塗り・`Ellipse`の回転を入れるとき：`Ellipse.hitTestFill`は軸平行の楕円の式で、弧は`isFillable()`の偽で除外しているだけ。弓形・扇形の塗り・回転角を入れるときは、式と`isFillable()`を見直す。
    *   `ShapeGeometry.isPointInPolygonNonzero`の式を変えると`Rect`・`Path`の内側の当たりが同時に変わるため、`test/shapes/`の全テストと`test/core/PointHitRules.test.js`を確かめる。
    *   当たり分類の規則を変えるときは`PointHitRules.js`だけを変え、`InputTracker`の押下・クリックの分岐の表と食い違わないこと（`bodyId`が選択集合内か外かで押下の振る舞いが決まる）。
*   **テストできない箇所**：`InputTracker`の`#classifyPoint`から`classifyPointHit`への受け渡し、ホバーの強調・カーソルの形・押下・クリックの分岐（DOM・`DragTracker`に依存）。テストプレイで確かめる。

### テストプレイで確認すべき項目（操作手順 → 期待する結果）
※ 自己交差する閉じたパス・巻き数0の穴を持つパス・頂点を動かした矩形等のファイルは現場設計AIが用意する。特記がなければ選択モード・表示倍率100%。

**A. 塗った内側のクリック（DIR Phase 06-03の実装要件）**
1.  矩形・円・閉じたパスをそれぞれ描き、プロパティパネルで塗りを「あり」にする。各図形の内側の、輪郭線から十分離れた位置（中央付近）をクリック → その図形が選ばれる（ハンドルが出る）。
2.  自分自身と交差する閉じたパス（五芒星）を開き塗りを付ける。中心の五角形の部分をクリック → 選ばれる（nonzeroで塗られている）。星の先端の三角形の内側 → 選ばれる。星の外 → 選ばれない（選択が解除される）。
3.  巻き数0の穴を持つ閉じたパス（外側と内側を逆向きに回るもの）を開き塗りを付ける。穴の中（塗られていない部分）の輪郭から離れた位置をクリック → 選ばれない。塗られている帯の部分 → 選ばれる。
4.  塗りなしの矩形・円・閉じたパスの内側（輪郭から離れた位置）をクリック → 選ばれない（今どおり）。
5.  何も選んでいない状態でプロパティパネルの塗りを「あり」にし、その直後に直線・曲線・弧を新しく描く（新しく描く図形は直前に使った値を塗れない形にも当てるため、`fillColor`を持つ塗れない形になる）。さらに、そうして描いた直線を2本以上つないで（結合`J`。閉じない）開いたパスにする（結合の基準の線の`fillColor`を引き継ぐ）。弧の下側・曲線と弦で囲まれる部分・開いたパスの「閉じれば内側」になる位置をクリック → 選ばれない（画面上も塗られていない）。
6.  塗った2つの図形を一部重ねて描き、重なっている所をクリック → 手前に描かれている図形（後から描いた図形）が選ばれる。

**B. 優先順位（REQ要件2の「結果として次が起きること」）**
7.  大きな塗った矩形Bを描いて選び、その上（手前）に小さな塗った円Aを描く。Bを選んだままAの内側をクリック → Aが選ばれる。
8.  塗りなしの円Aの上（手前）に大きな塗った矩形Bを描く（AはBに隠れる）。Bも選ばれていない状態で、Aの輪郭の近く（Bの内側）をクリック → Bが選ばれる。
9.  8の配置でAを選んでから（範囲選択や全選択で）、Aの輪郭の近く（Bの内側）をクリック → Aのまま（Aが選ばれる）。そのまま押してドラッグ → Aが動く（選択集合の移動）。
10. 塗りのない2本の直線（または矩形）を、輪郭が重なるように描く。重なっている所をクリック → 手前（後から描いた方）が選ばれる（**以前は奥が選ばれていた。了承済みの変化**）。
11. 2つの図形を両方選び（範囲選択）、2つの輪郭が重なる所をクリック → 手前の図形だけが選ばれる。

**C. 押下・ドラッグ**
12. 塗った矩形を選んだ状態で、その内側を押してドラッグ → 選択集合（矩形）が移動する。Undo1回で元の位置に戻り、Redo1回で移動後に戻る。
13. 塗った矩形を選んでいない状態で、その内側を押してそのままドラッグ → 何も動かず、範囲選択の矩形も出ない。離した位置がその矩形の内側なら、離したときのクリックでその矩形が選ばれる（押下でドラッグのセッションを開始しないため、選択されていない図形の輪郭で押してドラッグした今の扱いと同じ）。選ばれた後、内側を押してドラッグ → 移動する。
14. 何も無い所（どの図形の内側でもない所）を押してドラッグ → 範囲選択の矩形が出る（今どおり）。
15. 塗りなしの矩形の内側（輪郭から離れた位置）を押してドラッグ → 範囲選択が始まる（今どおり）。

**D. ホバーの強調・カーソルの形**
16. 塗った図形（選んでいない）の内側にカーソルを乗せる → その図形のホバーの強調（青い半透明の輪郭）が出て、カーソルが`pointer`（指）になる。外へ出す → 強調が消え、カーソルが矢印に戻る。
17. 塗った図形を選んだ状態で内側にカーソルを乗せる → カーソルが`move`（十字の矢印）になる。
18. 塗りなしの図形の内側にカーソルを乗せる → 強調は出ず、カーソルは矢印のまま。
19. 7の配置（Bを選んだまま）でAの内側にカーソルを乗せる → Aのホバーの強調が出て、カーソルは`pointer`。

**E. 見えない図形（REQ要件3）・線なしの塗り**
20. 線なし・塗りなしの矩形（見えない図形）を作る。輪郭があった位置の近くをクリック → 選ばれ、ハンドルが出る。内側をクリック → 選ばれない。カーソルを輪郭の近くに乗せる → ホバーの強調が出る。範囲選択・全選択（`Ctrl`+`A`）で選べる。
21. 線なしの直線（見えない図形）も、線があった位置の近くのクリック・範囲選択・全選択で選べる。
22. 線なしで塗った矩形の、塗りの外側5px以内（塗りのすぐ外）をクリック → 選ばれる。内側をクリック → 選ばれる。

**F. 範囲選択（REQ要件4）**
23. 大きな塗った矩形の内側だけを囲むように範囲選択する（矩形の辺にかからない）→ 矩形は選ばれない（今どおり）。辺にかかるように囲む → 選ばれる。

**G. 表示倍率**
24. 拡大（例400%）・縮小（例25%）した状態でA-1・A-6・B-7・D-16を行う → 同じ結果になる。縮小時、小さく表示された塗った図形の内側をクリックして選べる。拡大時、塗った図形の内側の輪郭から離れた位置（画面上で5pxより十分内側）をクリックして選べる。
25. 拡大した状態で、輪郭の外側の画面上5px以内をクリック → 今どおり選ばれる（内側と輪郭の間に、どちらにも当たらない帯が無い：円の内側から輪郭の外へカーソルを少しずつ動かしても、ホバーの強調が途切れない）。楕円（横長・縦長）でも同じ。
26. つぶれた円（高さ・幅がほぼ0の楕円）を描く → 画面全体で当たる等の異常は起きず、線の近くでだけ選べる。

**H. 頂点を動かした矩形**
27. 塗った矩形の頂点をハンドルで動かして、軸に平行でない形・凹んだ形（1頂点を内側へ）・自己交差した形（隣り合わない頂点を入れ替えるように動かして蝶ネクタイ形）にする。それぞれ塗られて見えている部分の内側をクリック → 選ばれる。凹みの部分・蝶ネクタイの塗られていない部分 → 選ばれない。

**I. 既存の機能（これまでと同じに動くこと）**
28. 各図形（直線・曲線・矩形・円・弧）の作成、パス（結合・描き足し・閉じる）の作成 → 今どおり。
29. 選択（クリック・範囲選択・全選択・解除）、移動（本体のドラッグ・moveハンドル）、変形（頂点のハンドル）、削除（ボタン・`Delete`）、結合（`J`）、端点への吸い付き、コピー・貼り付け・複製 → 今どおり。ハンドルの優先順位（選択集合の図形のハンドルが重なるとき手前）も今どおり。
30. 上記の各操作の取り消し/やり直し → 今どおり1件ずつ戻る・進む。
31. 自動保存（ページを再読み込みして戻る）、出力（作業ファイル）→ 開く（ファイル）、出力（エンジン用）→ `sprite-check.html`での表示 → 塗り・線なしを含め今どおり。作業データの版は2、書き出し形式の版は2のまま。
32. プロパティパネルの変更（塗り・線）→ 今どおり。塗りを「なし」にした図形の内側をクリック → 選ばれなくなる。塗りを「あり」に戻す → 内側で選べる。
