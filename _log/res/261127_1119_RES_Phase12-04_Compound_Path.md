# RES: 作業計画・作業レポート Phase 12-04 : 複合パス
* 参照元REQ: `./_log/req/261127_1100_REQ_Phase12-04_Compound_Path.md`

## 1. 作業目的
フォルダを「複合パス」に切り替えて、穴のあいた形を作れるようにする。図形の一覧の下端に「複合パス」のボタンを足し、フォルダの行を1つだけ選んでいるときに押すと、そのフォルダが複合パス⇔普通のフォルダに切り替わる（取り消し1回で戻る）。複合パスのフォルダは、中の見えている図形の輪郭をまとめて1つの形にし、**一番下の図形**の線・塗り・太さで、`evenodd`（重なりの数が奇数の所が塗られる）で描く。中の図形は今までどおり別々に選べ・動かせ、色・太さの変更とスポイトは一番下の図形に当たる。塗られた所のクリックは中の図形のうちその点を自分の輪郭で囲む一番手前の図形を選び、穴は素通りする。一覧ではフォルダの絵で見分ける。複合パスかどうかはフォルダのアイテムの属性`compound`として保存し（作業データの版5）、書き出しでは輪郭を複数持つ1つの描画要素`compoundPath`にする（書き出し形式の版5）。切り替え・戻し・中への出し入れで中の図形のスタイル（`strokeColor`・`strokeWidth`・`fillColor`）は書き換えない。普通のフォルダ・フォルダの外の図形の描画・当たり判定・スタイル・書き出しの結果、版4以前の作業データ・版1〜4のJSの読み込み結果、折りたたみの扱い、キーの対応表は変えない。

## 2. アーキテクチャ設計

### 用語（全タスク共通）
*   **複合パスのフォルダ**：フォルダのアイテムが`compound: true`を持つもの（閉じた`collapsed`と同じく「複合パスのときだけキーを持つ」）。属性の値は、外側の複合パスの中にあっても残る（効かないだけ）。
*   **効いている複合パス**：複合パスのフォルダのうち、上のフォルダのどれも複合パスでない（いちばん外側の）もの。以下で単に「複合パス」と書いたときはこれ。
*   **複合パスの中の図形（中の図形）**：効いている複合パスの子孫（中のフォルダの中も、内側の複合パスのフォルダの中も含む）の図形のうち、見えている（`ItemStateRules`で`hidden`が偽）もの。描画順（前順）に並べる。ロックされた図形も入る。
*   **一番下の図形**：中の図形の先頭（描画順で最初＝一覧でいちばん下）。中の図形が1つも無い（空・すべて隠れている）複合パスは「描く単位を作らない」（下の`listCompoundPaths`は返さない）。
*   **複合パスのスタイル**：一番下の図形の共通プロパティ`strokeColor`・`strokeWidth`・`fillColor`をそのまま写した`{ strokeColor, strokeWidth, fillColor }`。`isFillable()`は見ない（`fillColor`が文字列なら塗る。複合パスは全体として塗れる形）。
*   **輪郭の内側**（図形クラスの新しい共通メソッド`isInsideOutline`）：図形自身の輪郭（開いた線は始点と終点を結んで閉じたもの）の中に点があるかを、重なりの数が奇数かで決めたもの。スタイルを読まない。境界の上は内側に含めない。
*   **複合パスの塗られた所**：複合パスのスタイルの`fillColor`が文字列で、かつ中の図形の「輪郭の内側」の真の数が奇数の所（`evenodd`。各輪郭の交差の数の和の偶奇＝各図形の内外の排他的論理和）。**穴**＝塗りがあり偶数の所。

### 最初の表（場面ごとの結果。各欄＝今と変わるか・どう変わるか。テストはこの表の欄ごとに書く）
| 場面 | 普通のフォルダ | 複合パスのフォルダ | 複合パスの中のフォルダ（入れ子） | 一番下の図形が隠れている | 一番下の図形が塗れない形（直線・曲線・弧・開いたパス） | 中が空・1つだけ |
| --- | --- | --- | --- | --- | --- | --- |
| エディタのキャンバスの描画 | 変わらない（図形ごとに`draw`。描く単位は図形1つずつ） | 変わる：フォルダの重なり順の位置（中の図形の描画順の先頭の位置）で、中の図形の輪郭を1つのパスにまとめ（`beginPath`→各図形の`appendOutline`）、スタイルの`fillColor`が文字列なら`fill('evenodd')`、`strokeColor`が文字列なら線（太さは一番下の図形）。中の図形の`draw`は呼ばない。ホバーの強調は複合パスを描いた直後に、ホバー中の中の図形の`drawHover`（図形ごと） | 中のフォルダ（普通・複合パスとも）の図形も外側の複合パスに入り、1つの形になる。内側の複合パスの値は効かない。外側が普通のフォルダで内側が複合パスなら、内側が左の欄と同じ | 隠れた図形は形に入らない。見えている図形のうち描画順で最初のもののスタイルで描く | 一番下の図形の`fillColor`が文字列なら塗る。開いた輪郭は塗りでは始点と終点を結んで数に入り（Canvasの`fill`の自動の閉じと同じ）、線は開いたまま | 空・すべて隠れている＝何も描かない（描く単位が無い）。1つ＝その図形の輪郭だけの複合パスで、その図形のスタイルで描く（塗れない形でも`fillColor`が文字列なら`evenodd`で塗る） |
| アウトライン表示（`Z`） | 変わらない | 変わらない（図形ごとに`drawOutline`。まとめない）。ホバー・頂点のハンドル・外枠も今までどおり | 変わらない | 変わらない（隠れた図形は今までどおり描かれない） | 変わらない | 変わらない |
| キャンバスのクリック（塗られた所／穴／線の上） | 変わらない（図形ごとに`hitTest`・`hitTestFill`） | 線の上＝今までどおり図形ごとの`hitTest`（選択集合の輪郭の優先も同じ）。塗られた所＝中の変えられる図形のうち、その点が自分の輪郭の内側にある一番手前の図形が当たる（中の図形自身の`hitTestFill`は使わない）。穴＝中の図形は当たらず、後ろの図形へ進む（無ければ空白）。スタイルの`fillColor`が`null`＝塗りの内側では当たらない。アウトライン表示の間は塗りの内側を含めない（今と同じ）。囲む図形がロックされているときは素通り（その奥で囲む変えられる中の図形、無ければ後ろへ） | 中のフォルダの図形も外側の複合パスとして判定（左と同じ） | 隠れた図形は形に入らず当たらない（塗られた所・穴は見えている図形で決まる） | 一番下の図形の`fillColor`が文字列なら塗りの内側で当たる（開いた輪郭は始点と終点を結んだ形） | 空＝当たる図形が無い。1つ＝その図形の輪郭の内側で当たる（塗れない形でも`fillColor`が文字列なら） |
| 範囲選択 | 変わらない | 変わらない（図形ごとの輪郭の`intersectsRect`。全選択・選択の反転も図形ごと） | 変わらない | 変わらない | 変わらない | 変わらない |
| オプションバーの表示と色・太さの変更 | 変わらない | 選択中の変えられる図形のうち中の図形は、その複合パスの一番下の図形に読み替える（同じ複合パスは1つにまとめる）。表示・反映の対象はこの読み替えた図形で、一番下の図形は塗りの対象にもなる（`isFillable()`を問わない）。一番下の図形がロックされている複合パスの分は、表示にも反映にも入れない（読み替えた対象が空なら選択なしと同じ＝直前に使った値だけ） | 中のフォルダの図形を選んでも外側の複合パスの一番下の図形に読み替える | 一番下＝見えている最初の図形（隠れた図形の値は変わらない） | 塗りの欄は有効。塗りの変更は一番下の図形の`fillColor`に入る | 1つ＝その図形自身（塗れない形でも塗りの欄が有効）。空のフォルダだけを選んでいる＝図形の選択が空なので今までどおり選択なし |
| スポイト（拾う／当てる） | 変わらない | 拾う＝中の図形をクリックすると、その複合パスのスタイル（線の色・太さ・塗りの色の3つとも。塗りは`isFillable()`を問わない）を拾う。当てる＝オプションバーの変更と同じ読み替え（`ShapeStyleEditor.applyStyle`）。クリックで当たる図形は上の「クリック」の行 | 外側の複合パスの値を拾う・外側の一番下の図形に当てる | 見えている最初の図形の値を拾う・当てる | 塗れない形の`fillColor`も拾う・当てる | 1つ＝その図形の値（塗りも） |
| 一覧の行の見た目 | 変わらない | フォルダの行の絵が複合パスの絵（`.item-row-folder-icon`に`is-compound`）。中の図形の行のサムネイルは今までどおり自分のスタイル。そのフォルダだけを選んでいると下端の「複合パス」ボタンが押された見た目 | 内側の複合パスのフォルダも複合パスの絵（値を持つため）。内側の普通のフォルダは普通の絵 | 変わらない（サムネイルは自分のスタイル） | 変わらない | 空の複合パスのフォルダも複合パスの絵 |
| 保存して開き直す | 版5で書く（普通のフォルダの要素のキーは増えない）。読み込み結果は変わらない | フォルダの要素に`compound: true`を書き、読んで戻る。取り消し・やり直し・キャンバスの切り替え・自動保存でも保たれる | 内側の値もそのまま保つ | 変わらない（図形の値はそのまま） | 変わらない | 空・1つでも値を保つ。版4以前の作業データは今までどおり開け、`compound`のキーがあっても移行で消える（複合パスは無い） |
| コピー・貼り付け・複製 | 変わらない | 複合パスのフォルダごと写すと複合パスのまま入る（新しいid）。中の図形だけを写すと普通の図形として入る（入る場所が複合パスの中ならその中で複合パスの一部になる） | 入れ子・内側の値も保つ | 変わらない | 変わらない | 空・1つでも値を保つ |
| 書き出し（`elements`・`bounds`） | 版5（`formatVersion: 5`）。要素は今までどおり図形ごと（値は変わらない） | 複合パスごとに描画要素1つ`{ kind: 'compoundPath', outlines: [...], strokeColor, strokeWidth, fillColor }`をその位置に置く。`outlines`は中の図形の`toDrawElement()`からスタイルの3キーを除いたもの（今の`kind`と形の項目だけ）、スタイルは複合パスのスタイル（`fillColor`は塗れない形でも値のまま）。`bounds`は輪郭すべての形の範囲の和を、`strokeColor`が文字列なら太さの半分だけ広げたもの | 中のフォルダの図形も外側の要素の`outlines`に入る（内側の要素は作らない） | 隠れた図形は`outlines`・`bounds`に入らない | `fillColor`をそのまま出す（文字列なら塗る要素） | 空・すべて隠れている＝要素を作らず`bounds`にも入らない。1つ＝`outlines`が1つの`compoundPath` |
| 書き出したJSの`draw`・確認用ページ | 変わらない（命令の順も同じ） | `compoundPath`：塗る（`fillColor`が文字列）も線（`strokeColor`が文字列）も偽なら何もしない → `outlines`が空でない配列で、すべての輪郭の形の項目が足りていなければ何もしない → `beginPath` → 輪郭ごとのパス（楕円の輪郭は先に始点へ`moveTo`。閉じた輪郭は`closePath`）→ `fillStyle`→`fill('evenodd')` → `strokeStyle`→`lineWidth`→`stroke()`。確認用ページはコードを変えずに同じ見た目 | 上と同じ（1つの要素） | 上と同じ | 上と同じ（開いた輪郭も塗りの数に入る） | 1つ＝輪郭1つの`compoundPath`として描く |
| 書き出したJSをエディタで開く | 変わらない（版1〜5とも。フォルダは戻らない＝今と同じ） | `compoundPath`→複合パスのフォルダ（自動の名前「フォルダ n」・表示・ロックなし）。輪郭ごとに図形（自動の名前）になり、線・塗り・太さはすべて要素の値（塗れない形でも`fillColor`は要素の値）。輪郭を変換できない要素は要素ごと1件の読み飛ばし、図形データとして不正な輪郭はその図形だけ読み飛ばし | 平らに外側の複合パスのフォルダ1つの中に並ぶ（内側のフォルダは戻らない） | 隠れていた図形は戻らない（書き出していない） | 戻った図形も`fillColor`を持ち、一番下なら塗られる | 1つ＝図形1つの複合パスのフォルダ。空＝何も無い |

### 要件2・3：図形クラスの新しい共通メソッド2つ（`shapes/`。共通メソッド契約は18→20）
*   **`appendOutline(ctx)`（第19メソッド）**：`beginPath`を呼ばず、自分の輪郭を`ctx`の今のパスへ新しいサブパスとして足す。`moveTo`から始め、閉じた形は`closePath`で終わり、開いた形は閉じない。塗り・線・スタイルは呼ばない／読まない。命令は各図形の`draw`のパスの部分（`beginPath`の後〜塗りの前）と同じ並び・同じ値。ただし`Ellipse`だけは、前のサブパスとつながる直線を作らないため、`ctx.ellipse`の前に輪郭の始点（`#pointOnOutline(g, g.startAngle)`）へ`moveTo`する（`draw`は変えない）。
    *   `Line`：`moveTo(p0)`→`lineTo(p1)`。`Curve`：`moveTo(p0)`→`quadraticCurveTo(p1, p2)`。`Rect`：`moveTo([0])`→`lineTo([1])`・`[2]`・`[3]`→`closePath`。`Path`：今の非公開`#tracePath`から`beginPath`を除いた非公開`#traceSubpath(ctx)`を作り、`#tracePath`は`beginPath`→`#traceSubpath`にする（`draw`・`drawHover`・`drawOutline`の命令は変わらない）。`appendOutline`は`#traceSubpath`を呼ぶ。`Ellipse`：`g = #readGeometry()`→`moveTo(#pointOnOutline(g, g.startAngle))`→`ellipse(g.x, g.y, g.radiusX, g.radiusY, g.rotation, g.startAngle, g.endAngle)`→円なら`closePath`。
*   **`isInsideOutline(x, y)`（第20メソッド）**：自分の輪郭（開いた形は始点と終点を結んで閉じたもの）の内側かを`evenodd`（交差の数が奇数）で判定する。スタイル・`isFillable()`を見ない。境界の上は偽。
    *   新しい共有の関数`ShapeGeometry.isPointInPolygonEvenOdd(px, py, points)`（多角形の交差の数の偶奇。境界の上は偽・頂点3未満は偽。`isPointInPolygonNonzero`と同じ境界の扱い・引数の形）を使う。
    *   `Line`：常に偽（面積0）。`Curve`：`CURVE_INTERSECT_SEGMENTS`（100）分割の点（`t=0〜1`の101点）の多角形。`Rect`：4点の多角形。`Path`：今の非公開`#fillPolygon()`の頂点の並びに、**開いたパスのときだけ**最後の頂点`points[n-1]`を末尾に足したもの（`#fillPolygon`の開いたパスの並びは最後の頂点を含まないため。閉じたパスの並びは変えない。`hitTestFill`は開いたパスで早く偽を返すので結果は変わらない）の多角形。`Ellipse`：円は今の`hitTestFill`と同じ式（局所座標の`(lx²/rx²)+(ly²/ry²) < 1`。半径の2乗が0なら偽）、弧は`ELLIPSE_INTERSECT_SEGMENTS`（100）分割で`startAngle`〜`endAngle`を`#pointOnOutline`で取った101点の多角形（弦で閉じる）。
*   **共通メソッド契約の数の記述**：各図形クラスのクラスのJSDoc（「18メソッド：…」）に2つを足して20にする。`hitTestFill`・`draw`・`toDrawElement`等は変えない。

### 要件2・3・6：中身の集め方・一番下の図形・描く単位・塗りの判定・スタイルの読み替え（`core/CompoundPathRules.js`の新規。唯一の箇所）
*   **置き場所の理由**：描画（`main.js`→`CanvasManager`）・当たり判定（`PointHitRules`）・スタイル（`edit/`）・書き出し（`io/SpriteSerializer`）の4か所から使う。`io/`は`core/`をimportできるが`edit/`はimportできず、`shapes/`はアイテム（フォルダ・表示）を知らない（図形クラスは規則をimportしない）。表示の判定は`core/ItemStateRules`だけが持つため、それを使える`core/`の状態を持たない規則に置く。依存は`CompoundPathRules → ItemTreeRules`・`ItemStateRules`だけ（どちらもこのファイルをimportしないため循環しない）。
*   **持つもの（状態なし・DOMなし。引数を書き換えない。図形は共通メソッド`isInsideOutline`・`isFillable`と共通プロパティのスタイル3つだけを読み、種別の分岐・固有のプロパティ名を持たない。図形はインスタンスで引き、idは読まない。フォルダは`id`・`children`・`compound`を読む）**：
    *   `isCompoundGroup(item)`：フォルダのアイテムで`compound === true`か。**`compound`の値を意味として読むのはここだけ**（作業データへの読み書き`DocumentSerializer`と不備の補い`ItemAttributeRules`を除く）。
    *   `setCompound(items, id, compound)`：そのidのフォルダの`compound`を変えた新しい入れ子（真なら`compound: true`、偽ならキーを消す）。変わらない（無いid・フォルダでない・同じ値）なら引数と同じ参照。通り道と変わるフォルダだけ新しいオブジェクト（図形インスタンスは共有）。**キーを書くのはここだけ**（作業データの読み書き`DocumentSerializer`を除く。描画要素から読むときも、フォルダの要素に組み立てるのは`DocumentSerializer`）。
    *   `resolveCompoundToggle(items, id)`：`{ id, compound: !今の値 }`、無い・フォルダでないなら`null`。
    *   `collectCompoundGroupIds(items)`：`compound`がtrueのフォルダのid（入れ子の中・隠れたものも）の`Set`。
    *   typedef`CompoundStyle`＝`{ strokeColor, strokeWidth, fillColor }`、typedef`CompoundPath`＝`{ groupId, shapes, style, baseEditable }`（`shapes`＝中の図形（描画順、1つ以上）、`style`＝一番下の図形から写した`CompoundStyle`、`baseEditable`＝一番下の図形が変えられるか（`ItemStateRules`の`editable`））。
    *   `listCompoundPaths(items)`：効いている複合パスを前順で返す。`listItemStates(items)`のアイテム（参照）→状態の`Map`を作り、入れ子を前順にたどって、複合パスのフォルダに当たったら中の図形（`listShapeItems(children)`のうち状態の`hidden`が偽のもの）を集めて1つ以上なら1件にし、その中へは降りない（内側の複合パスは外側に入る）。普通のフォルダは中へ降りる。
    *   `DRAW_UNIT_KIND`（`{ SHAPE: 'shape', COMPOUND: 'compound' }`。凍結）、typedef`DrawUnit`＝`{ kind: 'shape', shapes: [図形] }`または`{ kind: 'compound', groupId, shapes, style, baseEditable }`。
    *   `mapCompoundsByShape(compoundPaths)`：`compoundPaths`（`listCompoundPaths`の結果）から、中の図形（インスタンス）→その図形が入っている複合パス（`CompoundPath`の参照）の`Map`を返す（`compoundPaths`が空なら空の`Map`。引数を書き換えない）。図形→複合パスの引き方の計算はこの関数だけに置き、`buildDrawUnits`・`findCompoundOf`・`resolveStyleTargets`と`PointHitRules.classifyPointHit`はこれを使う（同じ計算を2か所に書かない）。
    *   `buildDrawUnits(shapes, compoundPaths)`：見えている図形の並び（描画順）から描く単位の並びを作る。`mapCompoundsByShape(compoundPaths)`で中の図形の`Map`（インスタンス→複合パス）を作り、図形ごとに、複合パスに入っていなければ図形1つの単位、入っていて最初に出会ったならその複合パスの単位（`kind: 'compound'`と`CompoundPath`の項目）、2回目以降は飛ばす。`compoundPaths`が空なら図形1つずつの単位（並びは`shapes`と同じ）。
    *   `findCompoundOf(compoundPaths, shape)`：図形（インスタンス）が入っている複合パス、無ければ`null`（`mapCompoundsByShape(compoundPaths)`で引く）。
    *   `isInsideCompoundFill(compound, x, y)`：スタイルの`fillColor`が文字列で、中の図形の`isInsideOutline(x, y)`の真の数が奇数なら真。
    *   `hitTestCompoundFill(compound, shape, x, y)`：`isInsideCompoundFill(compound, x, y) && shape.isInsideOutline(x, y)`（塗られた所で、その図形が点を囲むか）。
    *   `resolveStyleTargets(shapes, compoundPaths)`：選択中の変えられる図形（描画順）を、スタイルの反映先へ読み替えた`{ shapes, fillShapes }`。中の図形（`mapCompoundsByShape(compoundPaths)`で引く）は一番下の図形へ（`baseEditable`が偽の複合パスは飛ばす。同じ複合パスは最初の1回だけ）・塗りの対象に入れる。そうでない図形はそのまま、塗りの対象は`isFillable()`が真のものだけ。並びは最初に出た順。複合パスが無ければ`shapes`は引数と同じ並び・`fillShapes`は`isFillable()`の絞り込みと同じ。
*   **ファイル先頭の責務（3行以内）**：「複合パスのフォルダの規則（属性の読み書き・効いている複合パスの中身と一番下の図形・描く単位・塗られた所の判定・スタイルの反映先への読み替え）。状態を持たずDOMに触れない。importは`ItemTreeRules`・`ItemStateRules`のみ。」

### 要件1・5：属性の持ち方とモデルの操作（`core/ItemTreeRules.js`・`core/ItemAttributeRules.js`・`core/VectorModel.js`）
*   `ItemTreeRules.js`：typedef`GroupItem`に`@property {true} [compound]`（複合パスのときだけtrue。普通のフォルダはキー自体が無い）を足す（JSDocだけ。コードは変えない。`toItems`等はスプレッドで写すため値は保たれる）。
*   `ItemAttributeRules.resolveItems`：`collapsed`と同じく、フォルダの`compound`が`true`以外ならキーを消す（図形のアイテムには触れない）。JSDoc・ファイル先頭の責務（3行以内）に複合パスの値の補いを足す。
*   `VectorModel`：
    *   `getCompoundPaths()`：`listCompoundPaths(this.#items)`を返す照会（毎回求める。キャッシュしない）。
    *   `setGroupCompound(id, compound)`：`setCompound(this.#items, id, compound)`が同じ参照なら何もせず（通知なし）`false`、変われば`#applyState({ items })`して通知1回・`true`。選択・選んでいるフォルダ・描き込む先・作成途中の図形・頂点の選択・ホバー・折りたたみ（`onCollapsedChange`）に触れない。**履歴の記録はしない**（記録は`edit/CompoundPathEditor`が挟む。折りたたみ`setGroupCollapsed`と違い、切り替えは履歴の対象）。
    *   ファイル先頭の責務（3行以内）とクラスのJSDocに「フォルダの複合パスの値の変更と、効いている複合パスの照会（規則へ委ねる）」を足す。import に`CompoundPathRules`の`setCompound`・`listCompoundPaths`を足す。

### 要件1：切り替えの操作（`core/GroupCommandRules.js`・`edit/CompoundPathEditor.js`の新規・一覧の配線）
*   **ボタンの状態の規則（`GroupCommandRules`に足す。importは`InputModes`のままで、判定に要る照会は関数で受ける）**：
    *   `resolveCompoundButtonState({ unitIds, selectedGroupIds, isEditable, isCompound })` → `{ groupId, enabled, pressed }`：`unitIds`（選んでいるまとまり）がちょうど1つで、それが`selectedGroupIds`に入っている（フォルダの行を1つだけ選んでいる）ときだけ`groupId`がそのid、ほかは`null`。`pressed`＝`groupId`があり`isCompound(groupId)`。`enabled`＝`groupId`があり`isEditable(groupId)`（隠れている・ロックされている＝上から受け継いだものを含め変えられないなら偽）。
    *   `canToggleCompound({ state, isDragging, isRowDragging, isLocked })`：`state.enabled`で、ロック中・ドラッグ中・行のドラッグ中でないとき真（「フォルダを作る」ボタンの`none`の条件と揃える）。
    *   **計画で決めたこと（操作モード）**：操作モードは見ない。フォルダを選べるのは選択（`V`）・頂点の選択（`A`）だけで、ほかのモードでは選択が空になり`groupId`が`null`（押せない）になるため、モードの条件は選択の条件に含まれる。「フォルダを作る」ボタンと揃えたのはロック中・ドラッグ中・行のドラッグ中の受け付けない条件。**見た目**（押せる／押された）はドラッグ中・ロック中を含めない（同期の契機が`model.onChange`だけで、ドラッグの終わりに描き直されないため）。ドラッグ中・ロック中は押しても何もしない。押された見た目は、選んでいるフォルダが複合パスなら押せないとき（ロック等）も出す。
*   **`edit/CompoundPathEditor.js`（新規）**：`constructor({ model, editRecorder })`、`toggle(groupId)`：`resolveCompoundToggle(model.getItems(), groupId)`が`null`なら`beginEdit`も呼ばず`false`。そうでなければ`beginEdit()`→`model.setGroupCompound(change.id, change.compound)`→`commitEdit()`で`true`（1件の編集操作。鍵なし）。受理の判定（変えられるか・ドラッグ中等）は呼び出し側（`ItemListWiring`）が行う。`model`は`getItems`・`setGroupCompound`だけを使う。importは`core/CompoundPathRules`の`resolveCompoundToggle`だけ。DOMに触れない・`try/catch`を持たない。`GroupEditor`に足さない理由：`GroupEditor`の責務は入れ子を変える操作（`rearrangeItems`）で、属性の切り替えは別の責務のため（`ItemStateEditor`と同じ形の別のクラス）。
*   **一覧（DOMと配線）**：
    *   `index.html`：`.item-list-footer`の「フォルダを作る」ボタンの後ろに`<button type="button" id="item-list-compound" class="item-list-compound" title="複合パス（選んだフォルダを複合パス⇔普通のフォルダに切り替える）" aria-pressed="false" disabled><span class="item-row-folder-icon is-compound"></span><span>複合パス</span></button>`を足す（同じ1行の中へ。キーの表記は付けない）。CSS：`.item-list-compound`（`.item-list-add-group`と同じ並べ方）、`.item-list-compound[aria-pressed="true"]`（`.tool-btn.active`と同じ地の色`#dbe9ff`・枠`#6699ff`）、`.item-list-compound:disabled`（うすく`opacity: 0.4`・`cursor: default`）、`.item-row-folder-icon.is-compound`（普通のフォルダと見分けられる絵：地の色を変え、真ん中に丸い穴（`::after`で背景色の丸）を描く。📁などの文字は使わない）。
    *   `palette/ItemListPanel.js`：省けない新しいコールバック`onCompoundToggle`（`#item-list-compound`のクリックで`blur()`してから呼ぶ。「フォルダを作る」ボタンと同じ扱い。関数でなければ`Error`）と、公開メソッド`renderCompoundButton({ enabled, pressed })`（`disabled`と`aria-pressed`を書くだけ）。フォルダの行の絵`.item-row-folder-icon`に`RowView.compound`が真なら`is-compound`のクラスを付け、同じ行の描き直しでも値が変われば付け外しする（行の控えに`compound`を持つ。`collapsed`と同じ扱い）。importなしのまま。typedef`RowView`の写しに`compound`を足す。
    *   `core/ItemRowRules.js`：行`Row`と行の見た目`RowView`に`compound`（フォルダなら`isCompoundGroup(item)`、図形は`false`）を足す。import に`CompoundPathRules`の`isCompoundGroup`を足す（ファイル先頭の責務のimportの列も直す）。
    *   `wiring/ItemListWiring.js`：依存に`compoundPathEditor`を足す。`sync()`の`panel.render(views)`の後に`panel.renderCompoundButton(this.#resolveCompoundButtonState())`。非公開`#resolveCompoundButtonState()`＝`items = model.getItems()`から`collectEditableIds(items)`（`ItemStateRules`）・`collectCompoundGroupIds(items)`（`CompoundPathRules`）を求め、`resolveCompoundButtonState({ unitIds: this.#resolveUnitIds(), selectedGroupIds: model.getSelectedGroupIds(), isEditable, isCompound })`。非公開`#handleCompoundToggle()`＝その状態を`canToggleCompound({ state, isDragging: this.#isDragging(), isRowDragging: this.#rowDrag.isActive(), isLocked: isListLocked(this.#canvasLibrary.getState()) })`に渡し、真なら`compoundPathEditor.toggle(state.groupId)`、最後に`this.sync({ allowScroll: false })`。判定・計算は規則に任せる。
    *   `main.js`：`// 7.`の編集操作の並び（`itemStateEditor`の生成の近く）で`new CompoundPathEditor({ model, editRecorder: historyManager })`を作り、`ItemListWiring`へ`compoundPathEditor`として渡す。

### 要件2：描画（`core/CompoundPathRenderer.js`の新規・`core/CanvasManager.js`・`main.js`）
*   **`core/CompoundPathRenderer.js`（新規。状態を持たないレンダラー。importなし）**：`drawCompoundPath(ctx, compound)`：`style`の`fillColor`が文字列（塗る）・`strokeColor`が文字列（線）のどちらも偽、または`shapes`が空なら何も呼ばない。そうでなければ`beginPath()` → 中の図形ごとに`shape.appendOutline(ctx)` → 塗るなら`fillStyle = fillColor`→`fill('evenodd')` → 線なら`strokeStyle = strokeColor`→`lineWidth = strokeWidth`→`stroke()`。書き出したJSの`compoundPath`の描き方と同じ命令の順（テストで確かめる）。`ThumbnailRenderer`と同じく、`node --test`で確かめるために`CanvasManager`から分けて置く。
*   **`CanvasManager.render(shapes, { ..., compoundPaths = [] })`**：引数`compoundPaths`（`CompoundPath`の配列。省略時は空＝今までと同じ）を足す。4.の図形の描画を「`buildDrawUnits(shapes, compoundPaths)`の単位ごと」にする：単位が複合パスでアウトライン表示でないなら`drawCompoundPath(this.ctx, unit)`を呼び、単位の図形ごとに、複合パスとして描いたのでなければ今までどおり`draw`（アウトライン表示なら`drawOutline`）、ホバー中なら`drawHover`。複合パスの単位でもアウトライン表示なら図形ごとの`drawOutline`（まとめない）。複合パスが無ければ命令の並びは今と同じ。import に`CompoundPathRules`（`buildDrawUnits`・`DRAW_UNIT_KIND`）・`CompoundPathRenderer`（`drawCompoundPath`）を足す（レンダラーが規則・レンダラーをimportする向き）。状態は持たないまま。JSDoc（`render`の`@param`・描画順の説明）とファイル先頭の責務（3行以内。「複合パスの描画」を足す）を直す。
*   **`main.js`の`renderCurrentState`**：`canvasManager.render`の引数に`compoundPaths: model.getCompoundPaths()`を足し、JSDocを直す（判定・計算は書かない）。

### 要件3：当たり判定（`core/PointHitRules.js`・`core/InputTracker.js`）
*   `classifyPointHit(shapes, isSelected, x, y, tolerance, includeFill = true, includeHandles = true, compoundPaths = [])`：第8引数を足す。`findBodyHit`の2つ目のループの塗りの部分を「その図形が複合パスに入っていれば`hitTestCompoundFill(compound, shape, x, y)`、入っていなければ今までどおり`shape.hitTestFill(x, y)`」にする（`includeFill`が偽なら今と同じくどちらも見ない）。複合パスの引き方は、呼び出しごとに`mapCompoundsByShape(compoundPaths)`（`CompoundPathRules`）で図形インスタンス→複合パスの`Map`を1回作って引く（`Map`を自前で組み立てない。`findCompoundOf`は使わない）。1つ目のループ（選択集合の輪郭の優先）・ハンドル・`hitTest`は変えない。複合パスが空なら結果は今と同じ。import に`CompoundPathRules`（`mapCompoundsByShape`・`hitTestCompoundFill`）を足す（規則どうしの一方向。`CompoundPathRules`は`PointHitRules`をimportしない）。ファイル先頭の責務（3行以内）・JSDocを直す（「`isFillable()`・`fillColor`を読まない」は保たれる：塗りの有無の判断は`CompoundPathRules`）。
*   `InputTracker`の`#classifyPoint`：第8引数に`this.model.getCompoundPaths()`を渡すだけ（JSDocの規則の要約に1行足す）。importは変えない。ほかは変えない。

### 要件3：スタイルとスポイト（`edit/StylePanelRules.js`・`edit/ShapeStyleEditor.js`・`edit/StyleEyedropper.js`・`main.js`）
*   `StylePanelRules.buildStylePanelView({ selectedShapes, fillableShapes, newShapeStyle, rememberedColors })`：省ける引数`fillableShapes`を足す（省くと今までどおり`selectedShapes.filter(isFillable)`）。塗りの欄はこの並びで決める。ほかは変えない。importなしのまま。
*   `ShapeStyleEditor`：非公開`#selectedShapes()`を、`resolveStyleTargets(model.getEditableSelectedShapes(), model.getCompoundPaths())`の結果`{ shapes, fillShapes }`を返す非公開`#styleTargets()`に置き換える。`COLOR_ITEMS`の`selectTargets`は`(targets) => targets.shapes`（線）・`(targets) => targets.fillShapes`（塗り）にする。`getPanelView`は`selectedShapes: targets.shapes, fillableShapes: targets.fillShapes`を渡す。`setStrokeWidth`・`applyStyle`・`previewColor`・`#setEnabled`の「選択中の図形」は`targets.shapes`。複合パスが無ければ今と同じ値・同じ呼び出し。importに`../core/CompoundPathRules.js`の`resolveStyleTargets`を足す（`edit/ → core/`の規則）。クラスのJSDocの依存の制約（importの列・`model`の使うメソッドに`getCompoundPaths`）・ファイル先頭の責務（3行以内。「複合パスの中の図形は一番下の図形へ」）を直す。`#finishPreview`は変えない。
*   `StyleEyedropper`：省ける依存`getCompoundPaths`（既定`() => []`）を足す。`pickFrom`で手本の図形が`findCompoundOf(getCompoundPaths(), shape)`の複合パスに入っていれば`{ ...compound.style }`（3項目とも）、入っていなければ今までどおり`sampleStyleFromShape(shape)`を`applyStyle`へ渡す。importに`../core/CompoundPathRules.js`の`findCompoundOf`を足す。JSDocを直す。
*   `main.js`：`new StyleEyedropper({ model, applyStyle, getCompoundPaths: () => model.getCompoundPaths() })`。
*   **計画で決めたこと**：一番下の図形がロックされている複合パスは、反映先からも表示からも外す（表示と反映先を一致させる。表示だけ一番下の値を出すと、変えても変わらない値が出るため）。

### 要件5：作業データの版5（`io/DocumentSerializer.js`）
*   `CURRENT_DOCUMENT_VERSION`を5、`MIGRATIONS`に`4: migrateVersion4To5`を足す。
*   **キーの足し方（`collapsed`の前例と合わせる）**：フォルダの要素に、複合パスのときだけ`compound: true`を書く（普通のフォルダはキー自体が無い）。キー順は`{ type: 'group', id, name, visible, locked, (collapsed), (compound), children }`。`#itemToElement`が`item.compound === true`のときだけ書く。読む側（`#readElements`）はフォルダの要素の`compound`を値のまま持ち、`ItemAttributeRules.resolveItems`が`true`以外を消す。図形の要素には付けない。
*   **版4→版5の移行`migrateVersion4To5`**：版4以前に`compound`の意味は無いため、`shapes`の要素を再帰でたどり、`type: 'group'`のプレーンオブジェクトから`compound`のキーを除いた新しいオブジェクトにする（`children`が配列ならその中も同じく。配列でなければそのまま＝後段の読み飛ばしに任せる）。ほかの要素・配列でない`shapes`はそのまま。引数を書き換えない。極端に深い・循環する入れ子は再帰の限界の例外が移行の失敗として全体の読み込み失敗になる（`ok: false`・警告1回は今と同じ。`error`の文言は「版4から版5へのマイグレーションに失敗しました: …」になる）。**版を上げた理由**：古いエディタ（版4まで）が複合パスを未知のキーとして黙って普通のフォルダとして開くと見た目が変わるため（版を上げれば全体が断られる）。
*   JSDoc（ファイル先頭の責務・typedef`DocumentData`・`MIGRATIONS`の「現時点の登録」・`#itemToElement`・`#readElements`）を直す。
*   スナップショット（`edit/SnapshotAdapter`）は`DocumentSerializer.serialize(withoutCollapsed(...))`で、`withoutCollapsed`は`collapsed`だけを消すため`compound`は履歴の比較・記録に入る（コードは変えない）。コピー・貼り付け・複製・インポート（`serialize`→`deserialize`→`addShapesWithNewIds`）も値を保つ（コードは変えない）。

### 要件6：書き出し形式の版5（`io/SpriteSerializer.js`・`io/CodeExporter.js`）
*   `SPRITE_FORMAT_VERSION`を5（JSDocの版の履歴に「版5: 複合パスの描画要素`compoundPath`を足した。古い読み手は未知の`kind`として描かず正しく描けないため版を上げた」）。`checkFormat`は1〜5を受理（コードは定数のまま）。
*   **描画要素`compoundPath`**：`{ kind: 'compoundPath', outlines: [輪郭, ...], strokeColor, strokeWidth, fillColor }`（このキー順）。輪郭＝中の図形の`toDrawElement()`から`strokeColor`・`strokeWidth`・`fillColor`を除いたもの（`kind`と形の項目だけ。新しい形の語彙を作らない）。スタイルは複合パスのスタイル。`serialize`は`toItems(values)`から`buildDrawUnits(listVisibleShapes(items), listCompoundPaths(items))`の単位ごとに、図形の単位は今までどおり`toDrawElement()`、複合パスの単位は`compoundPath`の要素にする（importに`core/CompoundPathRules`を足す。`io/ → core/`の下向き）。
*   **外枠**：`SHAPE_RANGE_BY_KIND`に`compoundPath: compoundPathRange`を足す。`compoundPathRange`＝輪郭ごとに表の範囲関数（`polyline`・`bezierPath`・`quadratic`・`ellipse`）で求めた形の範囲の和（輪郭の`kind`が表に無ければ`Error`。入れ子の`compoundPath`も`Error`）。線の太さの半分を広げる規則は今の`#computeBounds`のまま（要素の`strokeColor`・`strokeWidth`）。`computeShapesBounds`・`computeShapesGeometryBounds`（図形ごと）は変えない。
*   **書き出したJSの`draw`（`DRAW_SOURCE`）**：
    *   今の`drawElement`の`switch`の各`case`の「形の項目の確かめ」と「パスの組み立て（`beginPath`を除く）」を、命令の順を変えずに2つの関数へ分ける：`canTrace(element)`（形の項目が足りるか。今の`case`の`return`の条件と同じ。未知の`kind`は偽）と`traceElement(ctx, element)`（今の`moveTo`以降〜`closePath`）。`drawElement`は 塗る・線のどちらも偽なら`return` → `canTrace`が偽なら`return` → `beginPath` → `traceElement` → 塗り → 線（今までの`kind`の命令の並び・値は同じ）。
    *   `drawElement`の冒頭で`kind === 'compoundPath'`なら`drawCompoundPath(ctx, element)`を呼んで終える（今の`shouldFill`の式は`compoundPath`では使わない）。`drawCompoundPath`：塗る＝`fillColor`が文字列（`closed`・輪郭の種類を問わない）、線＝`strokeColor`が文字列。どちらも偽なら`return` → `outlines`が配列でない・空・`canTrace`が偽の輪郭が1つでもあれば`return`（**計画で決めたこと**：1つでも足りなければ要素ごと描かない。一部だけ描くと穴が塗られた形になり、何も描かないより見た目を誤らせるため。`compoundPath`の入れ子・未知の`kind`の輪郭も同じ） → `beginPath` → 輪郭ごとに、`ellipse`なら始点`(x + ex·cosR − ey·sinR, y + ex·sinR + ey·cosR)`（`ex = radiusX·cos(startAngle)`・`ey = radiusY·sin(startAngle)`・`R`は`rotation`が有限の数値ならその値、でなければ0。エディタの`Ellipse.#pointOnOutline`と同じ式の並び）へ`moveTo`してから`traceElement`、ほかは`traceElement` → 塗るなら`fillStyle`→`fill('evenodd')` → 線なら`strokeStyle`→`lineWidth`（今と同じ既定の太さの読み方）→`stroke()`。
    *   JSDoc・`DRAW_SOURCE`の中のコメントに`compoundPath`の規則を書く。`HEADER_COMMENT`・取り出しは変えない。

### 要件6：書き出したJSをエディタで開く（`io/DrawElementReader.js`・`io/DocumentSerializer.js`・`io/FileContentReader.js`）
*   **責務の境界（計画で決めたこと）**：作業データのフォルダ（`type: 'group'`）と`compound`のキーを知るのは`DocumentSerializer`だけ（2章「アイテム」）、`DrawElementReader`は「描画要素1つを図形データ（図形クラスの`toJSON()`の形）へ変換する規則」だけを持つ（ファイル先頭の責務）、`FileContentReader`の規則「描画要素→図形データの変換は`DrawElementReader`、作業データ・旧版の変換と読み飛ばしの記録は`DocumentSerializer`だけが知る」を保つ。そのため`DrawElementReader`は`compoundPath`を**輪郭ごとの図形データの配列**（作業データの語彙を含まない値）にするだけで、それを複合パスのフォルダの要素に組み立てて読むのは`DocumentSerializer`にする。
*   `DrawElementReader.toCompoundPathShapeData(element)`（新規の静的メソッド）：描画要素`compoundPath`を、輪郭ごとの図形データ（図形クラスの`toJSON()`の形）の配列にして返す。`compoundPath`でない要素（プレーンなオブジェクトでない・`kind`が`'compoundPath'`でない）は`null`を返す（対象外。呼び出し側が今までどおり`toShapeData`で読む）。`outlines`が配列でない・空なら`Error`。輪郭ごとに、プレーンなオブジェクトでない・`kind`が変換表（`polyline`・`bezierPath`・`quadratic`・`ellipse`）に無ければ`Error`（要素ごと読み飛ばし）。輪郭に要素のスタイル（`strokeColor`・`strokeWidth`・`fillColor`）を足したものを今の変換関数で図形データにし、`fillColor`だけを要素の値（文字列ならその値、でなければ`null`。塗れない形でも保つ）で上書きする。**作業データの語彙（`type: 'group'`・`compound`・`children`・`id`・`name`・`visible`・`locked`）を書かない**。`toShapeData`・変換表・今の変換関数は変えない（`toShapeData`に`compoundPath`を渡すと今までどおり未知の`kind`の`Error`）。ファイル先頭の責務（3行以内のまま）に「`compoundPath`は輪郭ごとの図形データの並びへ変換する」を足す（描画要素→図形データの知識はここだけ、は保つ）。
*   `DocumentSerializer.deserializeShapeElements(elements, toShapeData, toCompoundShapeData = null)`：省ける第3引数`toCompoundShapeData`（要素1つを、複合パスのフォルダにまとめる図形データの配列へ変換する関数。対象外なら`null`を返し、変換できなければ`Error`を投げる）を足す。要素ごとに、第3引数があればまず呼び、配列を返したら、作業データのフォルダの要素`{ type: 'group', compound: true, children: その配列 }`（`id`・`name`・`visible`・`locked`は無し＝読み込みの規則で自動の名前・表示・ロックなしになる）を**このファイルの中で**組み立て、作業データのフォルダとして読む。今の`#readElements`の1要素分の処理を非公開`#readElement(element, path, skipped)`（アイテムまたは`null`を返す）に切り出し（`#readElements`はそれを呼ぶだけ。結果・記録は今と同じ）、組み立てたフォルダの要素を`#readElement(folder, [position], skipped)`で読む（中の不正な図形データは`path: [position, j]`の1件ずつの読み飛ばし）。第3引数が`Error`を投げた（RangeErrorは今までどおり全体失敗）・配列でも`null`でもない値を返したときは、元の描画要素で`[position]`の1件の読み飛ばし。第3引数が無い・`null`を返したときは今までどおり（`toShapeData`の変換と`ShapeFactory.fromJSON`を同じ`try`で囲み、読み飛ばしの記録は元の描画要素で`[position]`）。第3引数を省いた結果・記録は今と同じ。JSDoc（`@param`・説明の「フォルダは作らない」を「第3引数が図形データの配列を返した要素は複合パスのフォルダにする」へ）とファイル先頭の責務（3行以内のまま。「変換関数つきの図形の並びの読み込み」に「複合パスの図形データの並びは複合パスのフォルダとして」を足す）を直す。
*   `FileContentReader`：`source`の無いJSの組み立てを`DocumentSerializer.deserializeShapeElements(elements, DrawElementReader.toShapeData, DrawElementReader.toCompoundPathShapeData)`にする（クラスのJSDocの表・規則を直す。規則の「描画要素→図形データの変換は`DrawElementReader`、作業データ・旧版の変換と読み飛ばしの記録は`DocumentSerializer`だけが知る」は保ち、「`compoundPath`の図形データの並びを複合パスのフォルダに組み立てるのも`DocumentSerializer`」を足す。ファイル先頭の責務は意味が変わらないため変えない）。版1〜4のJSには`compoundPath`が無いため結果は今と同じ。

### 要件7：自動テストと、版の数字だけを直す既存のテスト
*   新しいテストファイル（すべてLF）：`test/shapes/ShapeGeometry.evenodd.test.js`・`test/shapes/OutlineMethods.test.js`・`test/core/CompoundPathRules.test.js`・`test/core/ItemAttributeRules.compound.test.js`・`test/core/VectorModel.compound.test.js`・`test/core/CompoundPathRenderer.test.js`・`test/core/PointHitRules.compound.test.js`・`test/edit/CompoundStyle.test.js`・`test/io/DocumentSerializer.compound.test.js`・`test/io/SpriteSerializer.compound.test.js`・`test/io/CodeExporter.compound.test.js`・`test/io/DrawElementReader.compound.test.js`・`test/core/GroupCommandRules.compound.test.js`・`test/edit/CompoundPathEditor.test.js`・`test/core/ItemRowRules.compound.test.js`・`test/edit/CompoundPath.flow.test.js`。
*   **既存のテストの値は変えない**。ただし版の数字そのものを確かめているテストは版の数字だけを直す（見出しの文字列は、確かめる版の数字を述べているものだけ数字を直す）。計画時の調べ（タスクで`node --test`を走らせ、実際に直したものを詳細作業内容に列挙する。ここに無いものが落ちたら、版の数字だけの修正で済むときに限り直して列挙し、それ以外は中断して質問する）：
    *   **作業データの版4→5（タスク8）**：`test/edit/ItemStateEditor.test.js`（`values.version, 4`）・`test/edit/PathSplitEditor.items.test.js`（`document.version, 4`）・`test/edit/PathVertexEditor.items.test.js`（`document.version, 4`）・`test/edit/TransformInputEditor.test.js`（`work.version, 4`）・`test/io/DocumentSerializer.collapsed.test.js`（`data.version, 4`・`closedSource.version, 4`）・`test/io/DocumentSerializer.items.test.js`（`data.version, 4`、「版5以上は全体失敗」の`doc(5, [])`を6へ・見出しの数字）・`test/io/DocumentSerializer.roundtrip.test.js`（`.version, 4`の8か所）・`test/io/SpriteSerializer.items.test.js`（`work.version, 4`）・`test/io/SpriteSerializer.test.js`（`work.version, 4`・`serialize([])`の`version: 4`・`source.version, 4`）・`test/io/SpriteSerializer.visibility.test.js`（`serialize(items).version, 4`）。
    *   **書き出し形式の版4→5（タスク9）**：`test/edit/TransformInputEditor.test.js`（`sprite.formatVersion, 4`）・`test/io/FileContentReader.test.js`（`data.formatVersion, 4`）・`test/io/SpriteSerializer.items.test.js`（`data.formatVersion, 4`）・`test/io/SpriteSerializer.test.js`（`formatVersion, 4`の各所、「checkFormat は版4・3・2・1を supported、5を unsupportedVersion」→版5・4・3・2・1／6、「formatVersionは4で、checkFormatは版1〜4をsupported・版5をunsupportedVersion」→5／1〜5／6）・`test/io/SpriteSerializer.visibility.test.js`（`data.formatVersion, 4`）。
    *   版を入力として作るテスト（`version: 4`・`formatVersion: 4`の作業データ・JSを読ませるもの）は版4のまま読めるため直さない。

### モジュールの分担（全体）
| 層 | ファイル | 持つもの | 持たないもの |
| --- | --- | --- | --- |
| `shapes/` | 図形クラス5つ（更新） | `appendOutline`（輪郭をサブパスとして足す）・`isInsideOutline`（自分の輪郭の`evenodd`の内側） | フォルダ・複合パス・スタイルの読み替え |
| `shapes/` | `ShapeGeometry.js`（更新） | `isPointInPolygonEvenOdd`（唯一の箇所） | — |
| `core/` | `CompoundPathRules.js`（新規） | 属性の読み書き・効いている複合パスの中身と一番下の図形・描く単位・塗られた所・スタイルの反映先（唯一の箇所） | 表示・ロックの値そのもの（`ItemStateRules`の結果だけ）・DOM・描き方 |
| `core/` | `CompoundPathRenderer.js`（新規） | 複合パス1つの描き方（`evenodd`） | 状態・中身の集め方 |
| `core/` | `CanvasManager.js`（更新） | 単位ごとの描画の呼び分け | 状態・中身の集め方 |
| `core/` | `PointHitRules.js`（更新） | 塗りの当たりの呼び分け | 塗られた所の計算 |
| `core/` | `VectorModel.js`（更新） | `compound`の値を変える唯一の公開操作`setGroupCompound`・照会`getCompoundPaths` | 規則の中身・履歴の記録 |
| `core/` | `InputTracker.js`（更新） | `#classifyPoint`の第8引数の受け渡し | 判定 |
| `core/` | `ItemTreeRules.js`（JSDocだけ）・`ItemAttributeRules.js`・`ItemRowRules.js`・`GroupCommandRules.js`（更新） | typedef・不備の補い・行の`compound`・ボタンの状態 | — |
| `edit/` | `CompoundPathEditor.js`（新規） | 切り替えの1件の編集操作 | 受理の判定 |
| `edit/` | `ShapeStyleEditor.js`・`StylePanelRules.js`・`StyleEyedropper.js`（更新） | 反映先・表示の対象の差し替え、手本の読み替え | 中身の集め方 |
| `io/` | `DocumentSerializer.js`・`SpriteSerializer.js`・`CodeExporter.js`・`DrawElementReader.js`・`FileContentReader.js`（更新） | 版5・`compound`の読み書き・移行・`compoundPath`の組み立て・外枠・`draw`・`compoundPath`の輪郭ごとの図形データ（`DrawElementReader`）・それを複合パスのフォルダに組み立てて読むこと（`DocumentSerializer`） | 中身の集め方（`CompoundPathRules`）・`DrawElementReader`は作業データの語彙 |
| `palette/`・`wiring/`・`js/`・`index.html` | `ItemListPanel.js`・`ItemListWiring.js`・`main.js`・`index.html`（更新） | ボタン・絵のDOMと配線 | 判定・計算 |
| 変えない | `KeyboardShortcuts`・`HistoryManager`・`SnapshotAdapter`・`ClipboardController`・`ShapeInserter`・`GroupEditor`・`GroupCollapseRules`・`ItemStateRules`・`ThumbnailRenderer`・`ShapeExtentReader`・`check/`・`sprite-check.html`・`asset/` | — | — |

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/shapes/`（図形クラス・幾何）・`./js/core/`（規則・レンダラー・モデル・入力・描画）・`./js/edit/`（手順）・`./js/io/`（作業データ・書き出し・読み込み）・`./js/palette/`・`./js/wiring/`・`./js/`（`main.js`）・`./index.html`・`./test/`
*   **関連する論理クラス**: 新規＝`core/CompoundPathRules`（規則の関数）・`core/CompoundPathRenderer`（レンダラー）・`edit/CompoundPathEditor`（1件の編集操作）。更新＝`shapes/Line`・`Curve`・`Rect`・`Ellipse`・`Path`・`ShapeGeometry`、`core/VectorModel`・`CanvasManager`・`PointHitRules`・`InputTracker`・`ItemAttributeRules`・`ItemRowRules`・`GroupCommandRules`、JSDocだけ＝`core/ItemTreeRules`、`edit/ShapeStyleEditor`・`StylePanelRules`・`StyleEyedropper`、`io/DocumentSerializer`・`SpriteSerializer`・`CodeExporter`・`DrawElementReader`・`FileContentReader`、`palette/ItemListPanel`、`wiring/ItemListWiring`、`main.js`、`index.html`。

### 参照する責務
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`・`palette/`・`wiring/`をimportしない。`io/`のimportは`io/`内と`core/ShapeFactory`・`core/ItemTreeRules`・`core/ItemAttributeRules`・`core/ItemStateRules`のみ（今回`core/CompoundPathRules`を足す）。`palette/`は何もimportしない。`check/ → io`のみ。循環importは無い。外れるのは(1)`edit/ → shapes/`（今回は足さない）、(2)`shapes/`内の規則→図形クラス・規則（図形クラスは規則をimportしない）、(3)`edit/ → core/`の状態を持たない規則の関数（今回`ShapeStyleEditor`・`StyleEyedropper`・`CompoundPathEditor`を足す）。`core/`内は処理・レンダラー・状態を持つクラスが規則をimportする向き、規則どうしは使われる側が使う側をimportしない一方向に限る。フォルダ・一覧の規則は段に分かれ自分より前の段だけをimportする（`ItemTreeRules`→`GroupTreeRules`→`ItemPlaceRules`・`ItemStateRules`・`GroupSelectionRules`・`GroupCollapseRules`→`InsertTargetRules`・`ItemRowRules`・`RemovalRules`・`SoloVisibilityRules`→`ListDragRules`。今回`CompoundPathRules`（`ItemTreeRules`・`ItemStateRules`をimport）を足し、それをimportする`ItemRowRules`は1つ後の段になる）。
*   **図形の共通プロパティ（2章）**：スタイル3つ（`strokeColor`・`strokeWidth`・`fillColor`）は共通プロパティで、`VectorModel`が書き、`StylePanelRules`・`ShapeStyleEditor`（・`ThumbnailRenderer`の`strokeWidth`）が読む例外。今回`CompoundPathRules`（一番下の図形のスタイルを写す）を読む側に足す。書くのは今までどおり`VectorModel.updateShapeStyles`だけ。共通メソッド契約は18メソッド（今回20へ）。`fillColor`は塗れない形でも保持し、塗れる形のときだけ描く（図形の`draw`の規則は変えない）。
*   **アイテム（2章）**：フォルダのアイテム`{ kind: 'group', id, name, visible, locked, (collapsed), children }`。`VectorModel`は`#items`だけを状態に持ち、`#items`への代入はコンストラクタと`#applyState`だけ。入れ子を動かす公開操作は`rearrangeItems`だけ（構造が同じなら`false`のため属性の切り替えには使えない）。折りたたみ`setGroupCollapsed`は履歴に記録しない。表示・ロックの値を見るのは`ItemStateRules`だけ（補う`ItemAttributeRules`・読み書きする`DocumentSerializer`を除く）。照会`getVisibleShapes`・`getEditableShapes`は毎回`#items`から求める。
*   **作業データ形式（2章）**：版4のフォルダの要素`{ type: 'group', id, name, visible, locked, (collapsed), children }`。`collapsed`は閉じているときだけ書き、読む側は値のまま持って`resolveItems`が`true`以外を消す。旧版の知識は`DocumentSerializer`の`MIGRATIONS`に閉じる。版より大きい作業データは全体が断られる。スナップショットの`document`は`collapsed`を外した`serialize`。
*   **スプライト（2章）**：`SPRITE_FORMAT_VERSION`の唯一の定義は`SpriteSerializer`。`elements`・`bounds`は見えている図形（`listVisibleShapes`）から。描画要素は図形クラスの`toDrawElement()`。読む側の規則：未知の`kind`は描かない・形の項目が足りない要素は描かない・`strokeColor`が文字列でなければ線を描かない・塗るのは`fillColor`が文字列で閉じた`polyline`・`ellipse`・`bezierPath`だけ・描き方の順は形のパス→塗り→線。版は古い読み手が正しく描けなくなるときに上げ、版を上げたらエンジンへ連絡票（今回は次のサブフェイズ）。エディタで開くとき`source`の無いJSは`deserializeShapeElements(elements, 変換関数)`で組み立てる（描画要素の語彙は`DrawElementReader`だけが知る。`DrawElementReader`の責務は描画要素1つを図形データ（`toJSON()`の形）へ変換する規則で、作業データのフォルダ（`type: 'group'`）を知るのは`DocumentSerializer`だけ。`FileContentReader`の規則も「描画要素→図形データの変換は`DrawElementReader`、作業データ・旧版の変換と読み飛ばしの記録は`DocumentSerializer`だけが知る」）。確認用ページは書き出したJSの`draw`で描き、版の値を直書きしていない。
*   **`CanvasManager`**：状態を持たず、`render`の引数だけから描く。図形種別を知らずポリモーフィックに呼ぶ。描画順は背景→グリッド→原点→図形（＋ホバー）→頂点のハンドル→外枠→作成中の図形→吸い付き→選択矩形。
*   **`PointHitRules`**：`InputTracker.#classifyPoint`だけが使う。図形種別・`isFillable()`・`fillColor`を読まず、`hitTest`・`hitTestFill`のポリモーフィックな呼び出しだけ。渡される図形は`getEditableShapes()`。
*   **`edit/`のクラス**：DOMに触れない。操作モードを解釈しない。図形種別の分岐・固有のプロパティ名を持たない。`VectorModel`・`HistoryManager`は注入で受け取り、規則の関数だけをimportする。`try/catch`を持たない。1件の編集操作は`beginEdit`→変更→`commitEdit`。
*   **`main.js`・`wiring/`**：生成・注入・同期の配線だけ。判定・計算を書かない（規則の結果を渡すだけ）。`palette/`の部品は表示とコールバックの通知だけ。
*   **一覧（3章28.）**：フォルダの行は三角・CSSで描くフォルダの絵（`.item-row-folder-icon`）・名前。パネル下端`.item-list-footer`の「フォルダを作る」ボタンは`blur()`してから`onAddGroup`、動作は`GroupCommandRules.resolveFolderButtonAction`（ロック中・ドラッグ中・行のドラッグ中は`none`）。同期は`model.onChange`の1フレーム1回。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章 構成図**：`core/CompoundPathRules.js`（複合パスのフォルダの規則。属性の読み書き・効いている複合パスの中身と一番下の図形・描く単位・塗られた所・スタイルの反映先。状態なし。importは`ItemTreeRules`・`ItemStateRules`のみ。`VectorModel`・`CanvasManager`・`PointHitRules`・`ItemRowRules`・`edit/ShapeStyleEditor`・`edit/StyleEyedropper`・`edit/CompoundPathEditor`・`io/SpriteSerializer`・`wiring/ItemListWiring`から使う。Phase 12-04。3章31.）・`core/CompoundPathRenderer.js`（複合パス1つを`evenodd`で描くレンダラー。状態なし・importなし。`CanvasManager`から使う）・`edit/CompoundPathEditor.js`（複合パスの切り替えの1件の編集操作）を足す。更新：`index.html`の行（一覧の下端に「複合パス」ボタン`#item-list-compound`と複合パスのフォルダの絵`is-compound`のCSS）、`PointHitRules`（importに`CompoundPathRules`）、`ItemAttributeRules`（`compound`の補い）、`ItemRowRules`（importに`CompoundPathRules`・行の`compound`）、`GroupCommandRules`（ボタンの状態`resolveCompoundButtonState`・`canToggleCompound`）、`ItemListPanel`（ボタン・`onCompoundToggle`・`renderCompoundButton`・絵のクラス）、`ItemListWiring`（`compoundPathEditor`を注入で受ける）、`ShapeStyleEditor`・`StyleEyedropper`（複合パスの読み替え）、テストの一覧に今回の16ファイル。
*   **1章「存在しないもの」**：Phase 12-01・12-02・12-03の「点の本当の共有・1つの図形に輪郭を複数持たせること・複合パス」のうち、複合パスはPhase 12-04で入った（フォルダの属性として。1つの図形に輪郭を複数持たせることは今も無い）旨。「弧・曲線・直線・開いたパスの塗り（塗れるのは`rect`・`circle`・閉じた`path`のみ）」に「複合パスの中では一番下の図形の`fillColor`で塗られる（図形の`draw`は変わらない）」を添える。Phase 11の「フォルダの役割（穴・切り抜き・縁取り）」のうち穴は複合パスとして入った旨。**Phase 12-04でやらないと決めたこと**（REQの「今回やらないこと」：塗り方の規則の切り替え（`nonzero`等）・図形どうしの合体・型抜きなどの形の計算、図形を選んだ状態から1回の操作で複合パスを作ること・`Ctrl`+`8`などのキーの割り当て・右クリックのメニュー、中の図形の行のサムネイルを複合パスの色で描くこと・フォルダの行のサムネイル・複合パス専用のホバーの強調、PNG出力・半透明・線の位置、OZ Engineへの連絡票。加えて計画で決めたこと：ボタンの見た目にドラッグ中・ロック中を含めない、一番下の図形がロックされた複合パスはスタイルの表示・反映から外す、囲む図形がロックされているときの塗られた所のクリックは素通り、`compoundPath`の輪郭が1つでも足りなければ要素ごと描かない、内側の複合パスのフォルダも一覧では複合パスの絵、選択の外枠・⛶の外枠は図形ごとの太さのまま）を足す。
*   **1章「フォルダ分割の方針」「依存方向」**：`core/`の図形の一覧・フォルダの規則の段落に`CompoundPathRules`（置き場所の理由＝描画・当たり・スタイル・書き出しの4か所が使い、`io/`が使えて表示の判定を持つ`ItemStateRules`の結果を使える層が`core/`だけ）と`CompoundPathRenderer`（`ThumbnailRenderer`と同じく`node --test`のために`CanvasManager`から分けたレンダラー）。`io/`のimportの列に`core/CompoundPathRules`。`io/`の段落の`DocumentSerializer`（`deserializeShapeElements`は複合パスの図形データの並びを複合パスのフォルダとして読む）・`DrawElementReader`（`compoundPath`は輪郭ごとの図形データの並びへ。作業データの語彙は持たない）。(3)`edit/ → core/`の列に`ShapeStyleEditor`・`StyleEyedropper`・`CompoundPathEditor`（ファイルの数を直す）。`edit/`内のimportの例外の記述（`ShapeStyleEditor`・`StyleEyedropper → StylePanelRules`）は変わらない。`core/`内：`CanvasManager → CompoundPathRules`・`CompoundPathRenderer`、`VectorModel → CompoundPathRules`、`PointHitRules → CompoundPathRules`（規則どうし）、フォルダ・一覧の規則の段（`CompoundPathRules`は`InsertTargetRules`等と同じ段、`ItemRowRules`は次の段、`ListDragRules`はその次）。
*   **2章「図形の共通プロパティ」**：共通メソッド契約の数の経緯に「Phase 12-04で第19メソッド`appendOutline`（輪郭を共有のパスへ足す）・第20メソッド`isInsideOutline`（自分の輪郭の`evenodd`の内側）を足して20メソッド」。スタイル3つを読む側に`CompoundPathRules`。「塗れる形」の項に「複合パスの中では`isFillable()`を問わず一番下の図形の`fillColor`で塗る（3章31.）」。
*   **2章「アイテム」「フォルダ」**：フォルダのアイテムに`(compound)`（複合パスのときだけ`compound: true`）。値を変える公開操作は`VectorModel.setGroupCompound`だけ（履歴は`CompoundPathEditor`が挟む）。値を意味として読むのは`CompoundPathRules`だけ（補う`ItemAttributeRules`・読み書きする`DocumentSerializer`を除く）。照会`getCompoundPaths()`。
*   **2章「作業データ形式」**：現行版5（Phase 12-04で4→5）。フォルダの要素のキー順`{ type, id, name, visible, locked, (collapsed), (compound), children }`。版4→版5の移行（`compound`のキーを消す。理由）。「版5の作業データを古いエディタ（版4まで対応）で開くと全体が断られる」。保存対象にフォルダの複合パスの値。スナップショットの`document`は`compound`を含む（取り消しの対象）。
*   **2章「スプライト（書き出し形式）」**：版5（`formatVersion: 5`）。描画要素`compoundPath`（キー・輪郭の形・スタイル・描画順の位置・単位の作り方）。描き方の順（`fill('evenodd')`・楕円の輪郭の始点への`moveTo`）。読む側の規則に`compoundPath`（塗るのは`fillColor`が文字列なら輪郭によらず、`outlines`が空・配列でない・足りない輪郭が1つでもあれば描かない）。外枠（輪郭すべての範囲の和）。エディタで開くときの組み立て（`compoundPath`→複合パスのフォルダ、輪郭ごとの図形、スタイルは要素の値、読み飛ばしの単位。`DrawElementReader.toCompoundPathShapeData`が輪郭ごとの図形データの配列（作業データの語彙を含まない）を返し、複合パスのフォルダの要素に組み立てて読むのは`DocumentSerializer.deserializeShapeElements`の第3引数の経路。`FileContentReader`が両方の変換関数を渡す）。2つの版の履歴（書き出し形式の版5・作業データの版5、どちらもPhase 12-04。今は同じ数字だが無関係）。エンジンとの約束(c)に「版5への版上げ（Phase 12-04）は次のサブフェイズで連絡票を出す」。
*   **3章**：1.（変わらない）、2.描画（`renderCurrentState`が`compoundPaths: model.getCompoundPaths()`を渡し、`CanvasManager`が描く単位ごとに描く）、3.当たり分類（第8引数`compoundPaths`・塗られた所のクリック・穴は素通り）、5.（版5）、6.記録する操作（複合パスの切り替え＝`CompoundPathEditor.toggle`の`beginEdit`→`setGroupCompound`→`commitEdit`）・記録しない操作は変わらない、7.（複合パスの値を保つ）、9.（書き出し・開く）、10.（確認用ページはコードの変更なしで版5・`compoundPath`を描く）、13.スタイル（反映先・表示の読み替え）、15.（アウトライン表示は図形ごとのまま）、16.スポイト（拾う・当てる）、28.図形の一覧（複合パスの絵・ボタン）。新しい項**31. 複合パス（Phase 12-04）**（用語・最初の表の要約・モジュールの分担・流れ（切り替え・描画・当たり・スタイル・保存・書き出し・開く）・計画で決めたこと・確認の状況）。
*   **4章の一覧と`_doc/arch/`**：新規`69_CompoundPathRules.md`・`70_CompoundPathRenderer.md`（一覧の表に足す）。更新`01_index_html.md`（ボタン・CSS）・`02_main.md`（`renderCurrentState`・`StyleEyedropper`の依存・`CompoundPathEditor`の生成と注入・行数）・`03_VectorModel.md`（`getCompoundPaths`・`setGroupCompound`・importの列）・`04_CanvasManager.md`（`compoundPaths`・描画順の単位）・`06_InputTracker.md`（`#classifyPoint`の第8引数・行数）・`08_HistoryManager.md`（記録する操作の列があれば切り替えを足す）・`10_ShapeFactory.md`・`12_shapes.md`・`52_ThumbnailRenderer.md`（共通メソッド契約の数・新しい2つのメソッド・`isPointInPolygonEvenOdd`）・`13_palette.md`（`ItemListPanel`）・`14_edit.md`（`CompoundPathEditor`の節・`ShapeStyleEditor`・`StylePanelRules`・`StyleEyedropper`）・`15_io.md`（`DocumentSerializer`・`SpriteSerializer`・`CodeExporter`・`DrawElementReader`・`FileContentReader`）・`16_test.md`（新しいテスト・版の数字を直したテスト・件数）・`17_sprite_check.md`（版5もコードの変更なしで描かれる）・`18_PointHitRules.md`・`46_ItemTreeRules.md`・`47_ItemAttributeRules.md`・`53_ItemListWiring.md`・`59_GroupCollapseRules.md`（`withoutCollapsed`が`compound`を保つこと）・`60_GroupCommandRules.md`・`61_ItemRowRules.md`・`63_ItemStateRules.md`（使う側に`CompoundPathRules`）。`main.js`・`InputTracker.js`の行数・テストの件数は実測して直す（作業前は`main.js`1297行・`InputTracker.js`2124行・tests 4010）。

## 3. タスクリスト
※ 全タスク共通：(a) コード修正の後、JSDocの記載漏れ（新しいファイルの先頭の3行以内の責務、関数・メソッド・引数・戻り値・typedef、意味が変わった既存のJSDoc・ファイル先頭の責務・importの記述・「`model`は…だけを使う」の記述・共通メソッド契約の数）が無いことを確認する。(b) リポジトリのルートで`node --test`が全件合格することを確認する（既存のテストファイルの値は変えない。版の数字だけを直すテストは2章『要件7』の列挙のとおりで、実際に直したものを詳細作業内容に列挙する。それ以外で値を変えざるを得ないテストが出たら中断して質問する）。(c) 本RESの「4. 詳細作業内容」の担当の欄を書き、タスクを`[x]`にする。(d) 開発資料に影響が出たら資料本体は直さず『開発資料の更新予定』欄へ追記する。(e) 行末：既存のファイルは書き換える前に行末（CRLF／LF）を実測して保つ。計画時の実測（CR数/LF数）：**CRLF**＝`js/main.js`(1297/1297)・`js/core/InputTracker.js`(2124/2124)・`js/core/ItemRowRules.js`(266/266)・`js/core/GroupCommandRules.js`(52/52)・`js/shapes/Ellipse.js`(709/709)・`js/shapes/Path.js`(691/691)・`js/io/SpriteSerializer.js`(375/375)・`js/io/CodeExporter.js`(231/231)・`js/io/FileContentReader.js`(100/100)・`PROJECT_ARCHITECTURE.md`(1091/1091)。**LF**＝`index.html`(0/939)・`js/core/CanvasManager.js`(0/540)・`js/core/PointHitRules.js`(0/100)・`js/core/VectorModel.js`(0/1484)・`js/core/ItemTreeRules.js`(0/140)・`js/core/ItemAttributeRules.js`(0/140)・`js/shapes/ShapeGeometry.js`(0/241)・`js/shapes/Line.js`(0/331)・`js/shapes/Curve.js`(0/384)・`js/shapes/Rect.js`(0/363)・`js/edit/ShapeStyleEditor.js`(0/353)・`js/edit/StylePanelRules.js`(0/217)・`js/edit/StyleEyedropper.js`(0/148)・`js/io/DocumentSerializer.js`(0/462)・`js/io/DrawElementReader.js`(0/262)・`js/palette/ItemListPanel.js`(0/696)・`js/wiring/ItemListWiring.js`(0/489)。版の数字を直す既存のテストは書き換える前にファイルごとに行末を実測し、混在のファイルは行ごとの今の行末を保つ。**新規のファイル**：`js/core/`・`js/edit/`・`test/`の各フォルダはLFが多いため、新しい`.js`はすべてLF。`_doc/arch/`の新しい資料は書き方を合わせる`68_VertexDragRules.md`と同じCRLF。(f) 対象ファイル以外は変更しない。(g) 用語は2章『用語』のとおり（「複合パス」＝効いている複合パス、「中の図形」＝見えている子孫の図形、「一番下の図形」）で書く。

*   [x] タスク1: 図形クラスの共通メソッド2つ（輪郭を共有のパスへ足す・自分の輪郭の`evenodd`の内側）
    *   **対象ファイル** :
        *   `./js/shapes/ShapeGeometry.js` :（更新。行末はLF）
        *   `./js/shapes/Line.js`・`./js/shapes/Curve.js`・`./js/shapes/Rect.js` :（更新。行末はLF）
        *   `./js/shapes/Ellipse.js`・`./js/shapes/Path.js` :（更新。行末はCRLF）
        *   `./test/shapes/ShapeGeometry.evenodd.test.js` :（新規。行末はLF）
        *   `./test/shapes/OutlineMethods.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件2・3：図形クラスの新しい共通メソッド2つ』のとおり、`ShapeGeometry.isPointInPolygonEvenOdd(px, py, points)`（JSDoc付き。`isPointInPolygonNonzero`と同じ境界・頂点数・面積0の扱いで、規則だけが交差の数の偶奇）を足し、5つの図形クラスに`appendOutline(ctx)`（第19メソッド）・`isInsideOutline(x, y)`（第20メソッド）をJSDoc付きで足す（`appendOutline`は`draw`のパスと同じ命令の並びで`beginPath`を呼ばない旨・`Ellipse`の始点への`moveTo`の理由、`isInsideOutline`はスタイル・`isFillable()`を読まない・開いた形は始点と終点を結ぶ・境界は偽、を書く）。`Path`は`#traceSubpath`を切り出して`#tracePath`から呼び（`draw`等の命令は変えない）、`#fillPolygon`は開いたパスのときだけ末尾に最後の頂点を足す（JSDocに理由と「`hitTestFill`は開いたパスで先に偽を返すため結果は変わらない」）。各クラスのJSDocの「共通メソッド契約（18メソッド：…）」を20メソッドにして2つの名前を足す（`grep -rn "18メソッド" js`で漏れを確かめる）。ほかのメソッドは変えない。
        *   テスト（`ShapeGeometry.evenodd.test.js`）：四角の内側・外側、自己交差（五芒星）の中心は偶数で外側（nonzeroでは内側になる点）、逆向きに回った多角形でも内側、辺の上・頂点の上は偽、頂点3未満・面積0は偽、引数を書き換えない。
        *   テスト（`OutlineMethods.test.js`。命令を記録する偽の`ctx`）：`appendOutline`＝5種それぞれの命令の並びと値（`beginPath`・`fill`・`stroke`・スタイルの代入を呼ばない）、`Rect`・`Path`（直線の区間・曲線の区間・閉じる区間が直線／曲線）・`Line`・`Curve`は`draw`の`beginPath`の後〜塗りの前の命令と同じ、`Ellipse`は円・弧・回した楕円で先に`#pointOnOutline`相当の始点へ`moveTo`→`ellipse`（引数は`toDrawElement()`の値と同じ）→円だけ`closePath`、2回続けて呼ぶとサブパスが2つ並ぶ。`isInsideOutline`＝矩形（回した矩形も）の内側・外側・辺の上、閉じたパス（曲線の区間を含む）、開いたパス（始点と終点を結んだ形の内側が真）、直線は常に偽、今の曲線（曲線と弦の間が真）、円（回した楕円も）、弧（弧と弦の間が真・外側が偽）、`fillColor`が`null`・線なしでも結果が同じ（スタイルを読まない）、図形を書き換えない。既存の図形のテスト（`draw`・`drawHover`・`drawOutline`・`hitTestFill`）が変更なしで全件合格すること。

*   [x] タスク2: 複合パスの規則（中身の集め方・一番下の図形・描く単位・塗られた所・スタイルの反映先）と属性の補い
    *   **対象ファイル** :
        *   `./js/core/CompoundPathRules.js` :（新規。行末はLF）
        *   `./js/core/ItemTreeRules.js` :（更新。typedef`GroupItem`のJSDocだけ。行末はLF）
        *   `./js/core/ItemAttributeRules.js` :（更新。行末はLF）
        *   `./test/core/CompoundPathRules.test.js` :（新規。行末はLF）
        *   `./test/core/ItemAttributeRules.compound.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件2・3・6：中身の集め方…』のとおり`CompoundPathRules.js`を作る（先頭に3行以内の責務、import＝`./ItemTreeRules.js`の`ITEM_KIND`・`listShapeItems`（必要なら`listItems`）、`./ItemStateRules.js`の`listItemStates`だけ。`isCompoundGroup`・`setCompound`・`resolveCompoundToggle`・`collectCompoundGroupIds`・typedef`CompoundStyle`・`CompoundPath`・`DrawUnit`・`listCompoundPaths`・`DRAW_UNIT_KIND`・`mapCompoundsByShape`・`buildDrawUnits`・`findCompoundOf`・`isInsideCompoundFill`・`hitTestCompoundFill`・`resolveStyleTargets`をJSDoc付きで。`compound`を意味として読む・書くのはこのファイルだけである旨（作業データの読み書き・書き出したJSからの組み立てをする`DocumentSerializer`と、不備の補いをする`ItemAttributeRules`を除く）、図形→複合パスの引き方は`mapCompoundsByShape`だけに置き`buildDrawUnits`・`findCompoundOf`・`resolveStyleTargets`はそれを使う旨、内側の複合パスは外側に入る旨、一番下の図形＝見えている中の図形の先頭である旨、図形はインスタンスで引く旨、`isFillable()`を問わず`fillColor`で塗る旨を書く）。
        *   `ItemTreeRules.js`の`GroupItem`に`@property {true} [compound]`（JSDocだけ）。`ItemAttributeRules.resolveItems`に「フォルダの`compound`が`true`以外ならキーを消す」を足し、JSDocとファイル先頭の責務（3行以内）を直す。
        *   テスト（`CompoundPathRules.test.js`。実物の`Rect`・`Ellipse`・`Line`・`Path`・`Curve`）：`isCompoundGroup`（`true`だけ真・`'true'`・`1`・図形のアイテムは偽）。`setCompound`（真でキーが付く・偽でキーが消える・同じ値・無いid・図形のidは同じ参照・入れ子の中のフォルダ・引数を書き換えない・図形インスタンスを共有）。`resolveCompoundToggle`・`collectCompoundGroupIds`（入れ子・隠れたフォルダも）。`listCompoundPaths`＝最初の表の欄ごと：普通のフォルダは返さない、複合パス（中の図形が描画順・一番下の図形のスタイルが`style`）、中のフォルダ（普通・複合パス）の図形も外側に入り内側の複合パスを別に返さない、外側が普通で内側が複合パスなら内側を返す、一番下の図形を隠すと次の図形が先頭・`style`も次の図形、フォルダごと隠すと返さない、空・すべて隠れは返さない、1つだけは1件、ロックした図形は入る・一番下がロックなら`baseEditable`が偽・フォルダごとロックも偽、塗れない形が一番下でも`style.fillColor`はその値、図形を書き換えない。`mapCompoundsByShape`（空の`compoundPaths`で空の`Map`、中の図形がそれぞれ自分の複合パス（`listCompoundPaths`の結果と同じ参照）に引ける、中のフォルダ・内側の複合パスの図形も外側の複合パスに引ける、複合パスの外の図形・隠れた図形はキーに無い、2つの複合パス、引数を書き換えない）。`buildDrawUnits`（複合パスなしで図形1つずつ・同じ並び、複合パスは先頭の位置に1つ・中の図形は並びから消える、前後の図形の順、2つの複合パス）。`findCompoundOf`。`isInsideCompoundFill`・`hitTestCompoundFill`（大きな円の中に小さな円＝輪の所で真・穴で偽・外で偽、塗りなしは偽、開いたパスの弦の内側も数に入る、囲む図形だけが真＝小さな円は輪の所で偽・大きな円は真）。`resolveStyleTargets`（複合パスなしは同じ並び・`fillShapes`は`isFillable()`、中の図形は一番下の図形へ・同じ複合パスは1回、一番下が塗れない形でも`fillShapes`に入る、一番下がロックの複合パスは外れる、フォルダの外の図形と混ざった並び）。
        *   テスト（`ItemAttributeRules.compound.test.js`）：`resolveItems`が`compound: true`を残し、`false`・`'true'`・`undefined`のキーを消す、入れ子の中のフォルダも、図形のアイテムには触れない、2回通しても同じ。

*   [ ] タスク3: 一覧の行の値（行・行の見た目の`compound`）
    *   **対象ファイル** :
        *   `./js/core/ItemRowRules.js` :（更新。行末はCRLF）
        *   `./test/core/ItemRowRules.compound.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件1』の「一覧（DOMと配線）」の`core/ItemRowRules.js`の項のとおり、行`Row`と行の見た目`RowView`に`compound`（フォルダなら`isCompoundGroup(item)`、図形は`false`）をJSDoc付きで足す（importに`./CompoundPathRules.js`の`isCompoundGroup`を足し、ファイル先頭の責務（3行以内）のimportの列・typedefを直す）。ほかの項目・関数は変えない。`ItemListPanel`・`ItemListWiring`はこのタスクでは変えない（`compound`を絵のクラスに使うのはタスク13）。
        *   テスト（`ItemRowRules.compound.test.js`）：`buildItemRows`のフォルダの行の`compound`（複合パスで真・普通のフォルダと図形の行で偽・内側の複合パスも真・閉じたフォルダの行も）、`resolveRowViews`の`compound`が行の値のまま、ほかの項目が今と同じ。既存の`ItemRowRules.test.js`が変更なしで合格すること（行・見た目のオブジェクト全体を`deepEqual`していないことをコードで確かめて詳細作業内容に書く）。既存の一覧のテスト（`ItemListWiring`等の行の見た目を使うもの）も変更なしで全件合格すること。

*   [ ] タスク4: モデルの照会と、値を変える唯一の公開操作
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新。行末はLF）
        *   `./test/core/VectorModel.compound.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件1・5：属性の持ち方とモデルの操作』のとおり`getCompoundPaths()`・`setGroupCompound(id, compound)`をJSDoc付きで足す（`setGroupCompound`は履歴に記録しない・記録は`CompoundPathEditor`が挟む・選択等に触れない、を書く）。importに`setCompound`・`listCompoundPaths`を足し、ファイル先頭の責務（3行以内のまま）・クラスのJSDocを直す。ほかのメソッドは変えない。
        *   テスト：`setGroupCompound`で`getItems()`のフォルダに`compound: true`が付く・戻すとキーが無い、通知1回・同じ値・無いid・図形のidは`false`で通知なし、選択集合・選んでいるフォルダ・描き込む先・頂点の選択・ホバー・作成途中の図形・折りたたみが変わらず`onCollapsedChange`を呼ばない、図形のスタイルが変わらない（切り替え・戻しで`strokeColor`・`strokeWidth`・`fillColor`がそのまま）。`getCompoundPaths()`が`listCompoundPaths(getItems())`と同じ中身、`setItemStates`で一番下を隠すと先頭が変わる。`replaceAllShapes`・`addShapesWithNewIds`（`asUnits`）で入れた`compound: true`が保たれる。

*   [ ] タスク5: 描画（複合パスのレンダラー・描く単位ごとの描画・受け渡し）
    *   **対象ファイル** :
        *   `./js/core/CompoundPathRenderer.js` :（新規。行末はLF）
        *   `./js/core/CanvasManager.js` :（更新。行末はLF）
        *   `./js/main.js` :（更新。行末はCRLF）
        *   `./test/core/CompoundPathRenderer.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件2：描画』のとおり`CompoundPathRenderer.drawCompoundPath(ctx, compound)`をJSDoc付きで作り（先頭に3行以内の責務。書き出したJSの`compoundPath`と同じ命令の順である旨）、`CanvasManager.render`に`compoundPaths`を足して4.を描く単位ごとにする（JSDoc・ファイル先頭の責務を直す。ほかの描画・定数は変えない）。`main.js`の`renderCurrentState`に`compoundPaths: model.getCompoundPaths()`を足し、JSDocを直す。`main.js`の行数を実測して『開発資料の更新予定』へ書く。
        *   テスト（命令を記録する偽の`ctx`と実物の図形）：大きな円＋小さな円の複合パスで`beginPath`1回→`moveTo`・`ellipse`・`closePath`×2→`fillStyle`→`fill('evenodd')`→`strokeStyle`→`lineWidth`→`stroke`、値は一番下の図形のスタイル（2つ目の図形の色は使われない）、塗りなし（`fillColor: null`）は`fill`を呼ばない、線なしは線の3つを呼ばない、両方なし・`shapes`が空は何も呼ばない、一番下が塗れない形（弧・開いたパス）でも`fillColor`が文字列なら`fill('evenodd')`、図形1つでも同じ形、図形の`draw`を呼ばない・図形を書き換えない。`CanvasManager`・`main.js`はテストを置かない（DOM）。

*   [ ] タスク6: 当たり判定（塗られた所のクリック・穴の素通り）
    *   **対象ファイル** :
        *   `./js/core/PointHitRules.js` :（更新。行末はLF）
        *   `./js/core/InputTracker.js` :（更新。行末はCRLF）
        *   `./test/core/PointHitRules.compound.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件3：当たり判定』のとおり`classifyPointHit`に第8引数`compoundPaths`を足し、`findBodyHit`の塗りの部分を呼び分ける（図形→複合パスは呼び出しごとにタスク2の`mapCompoundsByShape(compoundPaths)`で`Map`を1回作って引く。importは`CompoundPathRules`の`mapCompoundsByShape`・`hitTestCompoundFill`。JSDoc・ファイル先頭の責務（3行以内）を直す）。`InputTracker.#classifyPoint`は第8引数に`this.model.getCompoundPaths()`を渡すだけ（JSDocに1行）。`InputTracker.js`の行数を実測して『開発資料の更新予定』へ書く。
        *   テスト（実物の`VectorModel`で入れ子を作り、`getEditableShapes()`・`getCompoundPaths()`を渡す。最初の表の「クリック」の行の欄ごと）：普通のフォルダは今と同じ結果（複合パスなしの`classifyPointHit`と同じ）、ドーナツの輪＝大きな円、穴＝後ろの図形・後ろが無ければ`null`、輪郭の上＝その図形（小さな円の輪郭の上は小さな円）、選択集合の輪郭の優先が今と同じ、塗りなしの複合パスは内側で当たらない（輪郭だけ）、`includeFill`が偽なら塗られた所でも当たらない、中の図形の`hitTestFill`を使わない（中の小さな円に塗りがあっても穴では当たらない）、一番下を隠す・フォルダの中のフォルダ・内側の複合パスは外側で判定、一番下が開いたパス・弧でも`fillColor`が文字列なら弦の内側で当たる、図形1つの複合パス（塗れない形）、囲む図形がロックされていると素通り（奥で囲む変えられる図形、無ければ後ろ）、手前の普通の図形が先に当たる。

*   [ ] タスク7: スタイルとスポイトの読み替え
    *   **対象ファイル** :
        *   `./js/edit/StylePanelRules.js`・`./js/edit/ShapeStyleEditor.js`・`./js/edit/StyleEyedropper.js` :（更新。行末はLF）
        *   `./js/main.js` :（更新。行末はCRLF）
        *   `./test/edit/CompoundStyle.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件3：スタイルとスポイト』のとおり、`buildStylePanelView`の省ける`fillableShapes`、`ShapeStyleEditor`の`#styleTargets()`と`COLOR_ITEMS`の差し替え、`StyleEyedropper`の省ける依存`getCompoundPaths`と手本の読み替え、`main.js`の`getCompoundPaths`の注入をJSDoc付きで行う（各ファイルの依存の制約・importの列・`model`の使うメソッドの記述・ファイル先頭の責務（3行以内）を直す）。
        *   テスト（実物の`VectorModel`・`HistoryManager`・`SnapshotAdapter`・`ShapeStyleEditor`・`StyleEyedropper`。最初の表の「オプションバー」「スポイト」の行の欄ごと）：中の図形（2つ目）を選んで塗り・線の色・太さ・有無を変えると一番下の図形だけが変わり選んだ図形は変わらない、`getPanelView()`の表示が一番下の図形の値、中の2つを選んでも一番下の図形の1件だけ・履歴1件で取り消し1回で戻る、一番下が塗れない形（直線・弧・開いたパス）でも塗りの欄が有効で`fillColor`が変わる、一番下がロック＝その複合パスの分は変わらず表示も選択なしと同じ（ほかに対象が無いとき）、フォルダの外の図形と一緒に選ぶと両方に当たる（外の図形は今までどおり塗れる形だけ塗り）、一番下を隠すと次の図形に当たる、中のフォルダの図形も外側の一番下へ、ピッカーの操作中（`previewColor`→`commitColor`）も一番下の図形に1件、`D`（`resetColors`）も一番下へ。タスク8の前なので、取り消し・やり直しの後の複合パスの値（`compound`・`getCompoundPaths()`）は確かめない（取り消し・やり直しの後に複合パスを前提とする操作も続けない）。確かめるのは履歴が1件積まれること・取り消し1回で1件戻ること（図形のスタイルの値が戻ること）等、`compound`の直列化に依らない事柄だけ。スポイト：中の図形から拾うと一番下の図形のスタイル（塗れない形の`fillColor`も）を拾う・当てる先に中の図形があれば一番下に当たる、複合パスでない図形から拾う結果は今と同じ。`buildStylePanelView`の`fillableShapes`を省いた結果が今と同じ。既存の`ShapeStyleEditor.test.js`・`StyleEyedropper.test.js`（偽のmodelのものを含む）・`EditableTargets.style.test.js`が変更なしで全件合格すること。

*   [ ] タスク8: 作業データの版5（`compound`の読み書き・版4→5の移行）
    *   **対象ファイル** :
        *   `./js/io/DocumentSerializer.js` :（更新。行末はLF）
        *   2章『要件7』の「作業データの版4→5」に列挙した既存のテスト :（更新。版の数字だけ。行末は書き換える前に実測して保つ）
        *   `./test/io/DocumentSerializer.compound.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件5：作業データの版5』のとおり`CURRENT_DOCUMENT_VERSION`を5にし、`migrateVersion4To5`（JSDoc付き）・`MIGRATIONS`の4・`#itemToElement`の`compound`・`#readElements`の`compound`を足し、JSDoc（ファイル先頭の責務・typedef・`MIGRATIONS`の登録の列）を直す。
        *   版の数字を確かめている既存のテストの数字だけを直し、直したファイル・箇所を詳細作業内容に列挙する。
        *   テスト：書き出し（複合パスのフォルダだけ`compound: true`・キー順`collapsed`の後`children`の前・普通のフォルダにキーが無い・図形の要素に付かない・版5）、往復（入れ子の内側の複合パス・閉じた複合パス（`collapsed`と`compound`の両方）・空の複合パス）、読み込みの規則（`compound`が`true`以外なら読み込み結果にキーが無い）、移行（版4・版3・版1の作業データの`compound: true`は消える・入れ子の中も・`children`が配列でないフォルダは今までどおり1件の読み飛ばし・引数を書き換えない・版4の普通の作業データの読み込み結果が今と同じ）、版6は全体失敗、スナップショット（`SnapshotAdapter.capture`の`document`に`compound`が入り、`restore`で戻る・折りたたみの扱いは今と同じ）、切り替えの履歴の往復（実物の`VectorModel`・`HistoryManager`・`SnapshotAdapter`で`beginEdit`→`model.setGroupCompound`→`commitEdit`として切り替え→取り消し→やり直しをし、取り消しで`compound`のキーが無く`getCompoundPaths()`が空・やり直しで`compound: true`と`getCompoundPaths()`の中身が戻る。`CompoundPathEditor`はタスク12で作るため使わない）。

*   [ ] タスク9: 書き出し形式の版5（描画要素`compoundPath`の組み立て・外枠）
    *   **対象ファイル** :
        *   `./js/io/SpriteSerializer.js` :（更新。行末はCRLF）
        *   2章『要件7』の「書き出し形式の版4→5」に列挙した既存のテスト :（更新。版の数字だけ。行末は書き換える前に実測して保つ）
        *   `./test/io/SpriteSerializer.compound.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件6：書き出し形式の版5』のとおり、`SPRITE_FORMAT_VERSION`を5、`serialize`を描く単位ごとに、`compoundPath`の要素の組み立て（スタイル3キーを除いた輪郭）、`compoundPathRange`と表への登録をJSDoc付きで行う（`DrawElement`・`SpriteData`のtypedef・版の履歴・ファイル先頭の責務を直す）。今の`kind`の要素の値は変えない。`CodeExporter.js`（`DRAW_SOURCE`）はこのタスクでは変えない（タスク10）。
        *   版の数字を確かめている既存のテストの数字だけを直し、直したファイル・箇所を詳細作業内容に列挙する。
        *   テスト（`SpriteSerializer.compound.test.js`。最初の表の「書き出し」の行の欄ごと）：要素のキー順と`outlines`の中身（各輪郭が`toDrawElement()`からスタイル3キーを除いたものと同じ）、位置（前後の図形の要素の間）、スタイルは一番下の図形（塗れない形の`fillColor`もそのまま）、中のフォルダ・内側の複合パスは外側の1要素、一番下を隠すと次の図形・隠した図形は入らない、空・すべて隠れは要素なし（ほかの図形だけの`bounds`・すべて無ければ`null`）、1つは輪郭1つ、普通のフォルダは今と同じ要素、`bounds`（輪郭すべての和＋一番下の太さの半分。線なしは広げない。回した楕円・曲線の輪郭の極値）、`formatVersion: 5`・`checkFormat`の1〜5が`supported`・6が`unsupportedVersion`。

*   [ ] タスク10: 書き出したJSの`draw`（`compoundPath`の描き方）
    *   **対象ファイル** :
        *   `./js/io/CodeExporter.js` :（更新。行末はCRLF）
        *   `./test/io/CodeExporter.compound.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件6：書き出し形式の版5』の「書き出したJSの`draw`（`DRAW_SOURCE`）」のとおり、`DRAW_SOURCE`の`canTrace`・`traceElement`・`drawCompoundPath`への分け方をJSDoc付きで行う（`DRAW_SOURCE`の中のコメント・保守上の注意・ファイル先頭の責務（3行以内。意味が変わる場合だけ）を直す）。今の`kind`の命令の並び・値は変えない。`HEADER_COMMENT`・取り出しは変えない。
        *   テスト（`CodeExporter.compound.test.js`。今の`CodeExporter.test.js`の取り込み方・記録する`ctx`に合わせる。`compoundPath`の要素はテストの中で手で作る（`SpriteSerializer`の組み立てに頼らない））：`compoundPath`の命令の順（`beginPath`1回→輪郭ごとのパス（楕円は始点へ`moveTo`）→`fillStyle`→`fill('evenodd')`→`strokeStyle`→`lineWidth`→`stroke`）が、同じ複合パスをタスク5の`drawCompoundPath`で描いた命令と同じ（円・回した楕円・弧・矩形・曲線のパス・今の曲線・直線の組み合わせ）、塗りなし・線なし・両方なし、`outlines`が空・配列でない・輪郭の1つが形の項目不足（点1つの`polyline`・区間の数が合わない`bezierPath`・半径が負の`ellipse`）・未知の`kind`・入れ子の`compoundPath`なら何も描かない、開いた輪郭も`closed`によらず塗る、今の`kind`の要素の命令が今と同じ（既存の`CodeExporter.test.js`が変更なしで合格）、版1〜4のデータを渡しても今と同じ。

*   [ ] タスク11: 書き出したJSをエディタで開く（`compoundPath`→複合パスのフォルダ）
    *   **対象ファイル** :
        *   `./js/io/DrawElementReader.js`・`./js/io/DocumentSerializer.js` :（更新。行末はLF）
        *   `./js/io/FileContentReader.js` :（更新。行末はCRLF）
        *   `./test/io/DrawElementReader.compound.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件6：書き出したJSをエディタで開く』のとおり、`DrawElementReader.toCompoundPathShapeData`（JSDoc付き。作業データの語彙を書かない旨を書く。ファイル先頭の責務（3行以内のまま）に「`compoundPath`は輪郭ごとの図形データの並びへ」を足す）、`DocumentSerializer.deserializeShapeElements`の省ける第3引数`toCompoundShapeData`と複合パスのフォルダの要素の組み立て・`#readElement`の切り出し（`deserializeShapeElements`のJSDoc（`@param`・「フォルダは作らない」の記述）とファイル先頭の責務（3行以内のまま）を直す）、`FileContentReader`の第3引数の受け渡し（クラスのJSDocの表・規則を直す。「描画要素→図形データの変換は`DrawElementReader`、作業データ・旧版の変換と読み飛ばしの記録は`DocumentSerializer`だけが知る」の規則は保ち、複合パスのフォルダに組み立てるのも`DocumentSerializer`である旨を足す）を行う。`toShapeData`・今の変換関数は変えない。`DrawElementReader`のコード・JSDocに`type: 'group'`・`compound`のキー・`children`を書かないこと（`grep`で確かめて詳細作業内容に書く）。作業の順は、まず`DrawElementReader.toCompoundPathShapeData`とその単体のテスト → `DocumentSerializer.deserializeShapeElements`の第3引数 → `FileContentReader`の受け渡し → 往復のテスト、とする。
        *   テスト（テストファイルは`DrawElementReader.compound.test.js`の1つで、`DrawElementReader.toCompoundPathShapeData`単体のテストと、`DocumentSerializer.deserializeShapeElements`の第3引数・`FileContentReader`を通した往復のテストの両方を持つ。最初の表の「エディタで開く」の行の欄ごと）：`toCompoundPathShapeData`（`compoundPath`→輪郭ごとの図形データの配列で、それぞれ`ShapeFactory.fromJSON`で図形になり線・塗り・太さが要素の値、塗れない形（直線・弧・今の曲線）も`fillColor`が要素の値、`strokeColor`が文字列でなければ`null`・`strokeWidth`が不正なら2、結果の配列の要素に`type`・`compound`・`children`のキーが無い、`compoundPath`でない要素（今の`kind`・未知の`kind`・オブジェクトでない）は`null`、`outlines`が配列でない・空・輪郭が未知の`kind`・オブジェクトでないなら`Error`、引数を書き換えない）。`deserializeShapeElements`＋`toShapeData`・`toCompoundPathShapeData`（複合パスのフォルダ1つ・自動の名前「フォルダ 1」と図形の自動の名前・表示・ロックなし・`compound: true`、前後の図形の並び、輪郭の変換ができない要素は`[position]`の1件の読み飛ばし・図形データとして不正な輪郭は`[position, j]`の1件で残りは入る、第3引数が配列でも`null`でもない値を返すと`[position]`の1件の読み飛ばし、第3引数を省いた結果・読み飛ばしの記録が今と同じ）。`FileContentReader.deserializeFromText`の往復（タスク9の書き出し→`CodeExporter.toModuleText`→読み込みで、複合パスのフォルダに戻り、もう一度書き出すと同じ`elements`・`bounds`。中のフォルダは平らになる。一番下を隠して書き出すと隠した図形は戻らない）。既存の`FileContentReader*.test.js`・`DrawElementReader.test.js`・`DocumentSerializer.shapeElements.test.js`が変更なしで（タスク9で版の数字を直したものを除き）全件合格すること。

*   [ ] タスク12: 切り替えの規則と1件の編集操作
    *   **対象ファイル** :
        *   `./js/core/GroupCommandRules.js` :（更新。行末はCRLF）
        *   `./js/edit/CompoundPathEditor.js` :（新規。行末はLF）
        *   `./test/core/GroupCommandRules.compound.test.js` :（新規。行末はLF）
        *   `./test/edit/CompoundPathEditor.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件1：切り替えの操作』のとおり`resolveCompoundButtonState`・`canToggleCompound`をJSDoc付きで足し（操作モードを見ない理由・見た目にドラッグ中等を含めない理由を書く。ファイル先頭の責務（3行以内）を直す。importは`InputModes`のまま）、`CompoundPathEditor`をJSDoc付きで作る（先頭に3行以内の責務・依存の制約）。
        *   テスト（`GroupCommandRules.compound.test.js`）：フォルダを1つだけ選んでいる＝`groupId`・押せる、複合パスなら押された見た目、何も選んでいない・図形だけ・フォルダ2つ・フォルダと外の図形・空のフォルダ1つ（押せる）、変えられない（`isEditable`が偽）＝押せないが押された見た目は値のまま、`canToggleCompound`（押せない・ロック中・ドラッグ中・行のドラッグ中は偽）。
        *   テスト（`CompoundPathEditor.test.js`。実物の`VectorModel`・`HistoryManager`・`SnapshotAdapter`）：`toggle`で複合パスになり、もう一度で戻る、それぞれ履歴1件で`undo`1回で戻り`redo`で戻る（取り消し・やり直しの後も`compound`・`getCompoundPaths()`がその時点の状態のとおり保たれる）、無いid・図形のidは`beginEdit`を呼ばず`false`、中の図形のスタイル・選択・選んでいるフォルダが変わらない、閉じたフォルダの折りたたみが取り消し・やり直しで今の状態のまま。

*   [ ] タスク13: 一覧での見分けとボタン（パネル・配線・`index.html`）
    *   **対象ファイル** :
        *   `./js/palette/ItemListPanel.js`・`./js/wiring/ItemListWiring.js`・`./index.html` :（更新。行末はLF）
        *   `./js/main.js` :（更新。行末はCRLF）
    *   **作業内容** :
        *   『要件1』の「一覧（DOMと配線）」のうち`core/ItemRowRules.js`以外の項（`ItemRowRules`の`Row`・`RowView`の`compound`はタスク3で済み）のとおり、`ItemListPanel`の`onCompoundToggle`・`renderCompoundButton`・絵のクラス（タスク3の`RowView.compound`を読む）、`ItemListWiring`の`compoundPathEditor`・`#resolveCompoundButtonState`・`#handleCompoundToggle`と`sync`での反映、`index.html`のボタンとCSS、`main.js`の`CompoundPathEditor`の生成と注入を、JSDoc付きで行う（各ファイル先頭の責務・typedef・コンストラクタの`@param`・`@throws`・クラスのJSDocを直す）。`main.js`の行数を実測して『開発資料の更新予定』へ書く。
        *   テスト：`ItemListPanel`・`ItemListWiring`・`main.js`・CSSはテストを置かない（DOM）。既存のテストが変更なしで全件合格すること。

*   [ ] タスク14: 通しの確かめ（実物を組み合わせた流れ）
    *   **対象ファイル** :
        *   `./test/edit/CompoundPath.flow.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   製品コードは変えない。実物の`VectorModel`・`HistoryManager`・`SnapshotAdapter`・`GroupEditor`・`CompoundPathEditor`・`ShapeStyleEditor`・`StyleEyedropper`・`ClipboardController`・`ShapeInserter`・`DocumentSerializer`・`SpriteSerializer`・`CodeExporter`・`FileContentReader`を組み合わせ、テストプレイの確認項目0〜8に当たる流れを確かめる：円を2つ描いて（`addShapesWithNewIds`）大きい円に塗り→`groupSelection`でまとめ→フォルダだけを選んで`resolveCompoundButtonState`が押せる→`toggle`で`getCompoundPaths()`が1件（一番下＝大きい円）・`buildDrawUnits`が1単位・ドーナツの輪と穴の`classifyPointHit`の結果→`undo`で戻り`redo`で戻る、小さい円を動かす（`moveShapes`）と穴の位置の当たりが変わる、小さい円をフォルダの外へ出す（`ShapeOrderEditor.moveTo`または`rearrangeItems`）と複合パスの単位に入らず自分のスタイル、小さい円を選んで塗りを変えると大きい円の`fillColor`が変わり小さい円は変わらない・普通のフォルダに戻すと小さい円は元の値、一番下を隠すと先頭が次の図形、保存（`serialize`→`deserialize`→`replaceAllShapes`）とコピー・貼り付け（`copy`→`paste`）で複合パスのまま、書き出し→JSのテキスト→開くで複合パスのフォルダに戻る、版4の作業データ・版4のJS（今の書き出しの`formatVersion`を4に書き換えたもの・`compoundPath`を含まないもの）が今までどおり開ける。

*   [ ] タスク15: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。行末はCRLF）
    *   **作業内容** :
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、この最終タスクのみ明示的な例外とする。
        *   『開発資料の更新予定』を確認し、1章（構成図・「存在しないもの」の複合パスの項とPhase 12-04でやらないと決めたこと・フォルダ分割の方針・依存方向）、2章（共通プロパティと共通メソッド契約の数・塗れる形・アイテムのフォルダ・作業データ形式（版5・移行・古いエディタ）・スプライト（版5・`compoundPath`・読む側の規則・外枠・エディタで開くときの組み立て・2つの版の履歴・エンジンとの約束(c)））、3章（2.・3.・5.・6.・7.・9.・10.・13.・15.・16.・28.と新しい31.）、4章の一覧（`69_CompoundPathRules.md`・`70_CompoundPathRenderer.md`）へ反映する。書く内容は実コードで確かめる。用語は2章『用語』のとおり。OZ Engineへの連絡は書かず、版5の連絡は次のサブフェイズである旨だけ書く。書き換える前に行末を実測して保つ。`_doc/COWORK_STATUS.md`は書き換えない。

*   [ ] タスク16: 開発資料の反映（`_doc/arch/`）
    *   **対象ファイル** :
        *   `./_doc/arch/`の`01_index_html.md`・`02_main.md`・`03_VectorModel.md`・`04_CanvasManager.md`・`06_InputTracker.md`・`10_ShapeFactory.md`・`12_shapes.md`・`13_palette.md`・`14_edit.md`・`15_io.md`・`16_test.md`・`17_sprite_check.md`・`18_PointHitRules.md`・`46_ItemTreeRules.md`・`47_ItemAttributeRules.md`・`52_ThumbnailRenderer.md`・`53_ItemListWiring.md`・`59_GroupCollapseRules.md`・`60_GroupCommandRules.md`・`61_ItemRowRules.md`・`63_ItemStateRules.md`（と、記述が食い違えば`08_HistoryManager.md`） :（更新）
        *   `./_doc/arch/69_CompoundPathRules.md`・`./_doc/arch/70_CompoundPathRenderer.md` :（新規。行末はCRLF）
    *   **作業内容** :
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、この最終タスクのみ明示的な例外とする。
        *   『開発資料の更新予定』を確認して反映する。`main.js`の行数（`02`）・`InputTracker.js`の行数（`06`）とテストの件数（`16`。tests・suites・テストファイルの数。作業前は tests 4010）は`wc -l`・`node --test`で実測して直す。書き換える前に各ファイルの行末（CRLF／LF）を実測し、保つ（ファイルごとに混在している）。新規の2つは近い番号の既存のファイル（`68_VertexDragRules.md`）の書き方・行末に合わせる。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 図形クラスの共通メソッド2つ（輪郭を共有のパスへ足す・自分の輪郭の`evenodd`の内側）
*   **作業内容** :
    *   `ShapeGeometry.isPointInPolygonEvenOdd(px, py, points)`を追加（境界・頂点数3未満・面積0は`isPointInPolygonNonzero`と同じく偽。規則は半直線との交差の数の偶奇）。ファイル先頭の責務に「nonzero・evenodd」を反映。
    *   5つの図形クラスに`appendOutline(ctx)`（第19）・`isInsideOutline(x, y)`（第20）をJSDoc付きで追加し、クラスJSDocの「共通メソッド契約」を20メソッドに更新（`grep -rn "18メソッド" js`の残りは`createTransformed`の「第18メソッド」の序数のみで契約の数ではない）。
    *   `Line`は`isInsideOutline`が常に偽。`Curve`は101点の多角形、`Rect`は4点の多角形、`Ellipse`は円＝`hitTestFill`と同じ式・弧＝101点の多角形、`Path`は`#fillPolygon`（開いたパスのみ末尾に最後の頂点を追加）の多角形。`Ellipse.appendOutline`は`ctx.ellipse`の前に始点へ`moveTo`。
    *   `Path`は`#tracePath`を`beginPath`→`#traceSubpath`に分け、`appendOutline`は`#traceSubpath`を呼ぶ（`draw`・`drawHover`・`drawOutline`の命令は不変）。
    *   新規テスト：`test/shapes/ShapeGeometry.evenodd.test.js`・`test/shapes/OutlineMethods.test.js`（LF）。`node --test`は4032件すべて合格。既存テストの値は変更なし。
    *   行末：`Ellipse.js`・`Path.js`はCRLF維持、ほかはLF。

### タスク2: 複合パスの規則（中身の集め方・一番下の図形・描く単位・塗られた所・スタイルの反映先）と属性の補い
*   **作業内容** :
    *   `js/core/CompoundPathRules.js`（新規・LF）を作成。`isCompoundGroup`・`setCompound`・`resolveCompoundToggle`・`collectCompoundGroupIds`・`listCompoundPaths`・`DRAW_UNIT_KIND`・`mapCompoundsByShape`・`buildDrawUnits`・`findCompoundOf`・`isInsideCompoundFill`・`hitTestCompoundFill`・`resolveStyleTargets`とtypedef`CompoundStyle`・`CompoundPath`・`DrawUnit`。importは`ItemTreeRules`の`ITEM_KIND`・`listShapeItems`と`ItemStateRules`の`listItemStates`のみ。図形→複合パスの引きは`mapCompoundsByShape`だけで、他3関数はそれを使う。
    *   `ItemTreeRules.js`の`GroupItem`に`@property {true} [compound]`（JSDocのみ）。`ItemAttributeRules.resolveItems`にフォルダの`compound`が`true`以外ならキーを消す処理を足し、ファイル先頭の責務・JSDocを更新（LF維持）。
    *   新規テスト：`test/core/CompoundPathRules.test.js`・`test/core/ItemAttributeRules.compound.test.js`（LF）。`node --test`は4057件すべて合格。既存テストの値・版の数字のテストは変更なし。

### タスク3: 一覧の行の値（行・行の見た目の`compound`）
*   **作業内容** :
    *   （未実施）

### タスク4: モデルの照会と、値を変える唯一の公開操作
*   **作業内容** :
    *   （未実施）

### タスク5: 描画（複合パスのレンダラー・描く単位ごとの描画・受け渡し）
*   **作業内容** :
    *   （未実施）

### タスク6: 当たり判定（塗られた所のクリック・穴の素通り）
*   **作業内容** :
    *   （未実施）

### タスク7: スタイルとスポイトの読み替え
*   **作業内容** :
    *   （未実施）

### タスク8: 作業データの版5（`compound`の読み書き・版4→5の移行）
*   **作業内容** :
    *   （未実施）

### タスク9: 書き出し形式の版5（描画要素`compoundPath`の組み立て・外枠）
*   **作業内容** :
    *   （未実施）

### タスク10: 書き出したJSの`draw`（`compoundPath`の描き方）
*   **作業内容** :
    *   （未実施）

### タスク11: 書き出したJSをエディタで開く（`compoundPath`→複合パスのフォルダ）
*   **作業内容** :
    *   （未実施）

### タスク12: 切り替えの規則と1件の編集操作
*   **作業内容** :
    *   （未実施）

### タスク13: 一覧での見分けとボタン（パネル・配線・`index.html`）
*   **作業内容** :
    *   （未実施）

### タスク14: 通しの確かめ（実物を組み合わせた流れ）
*   **作業内容** :
    *   （未実施）

### タスク15: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
*   **作業内容** :
    *   （未実施）

### タスク16: 開発資料の反映（`_doc/arch/`）
*   **作業内容** :
    *   （未実施）

## 5. 懸念事項・要確認ポイント
*   **計画で決めたこと（REQの文言から一意に決まらなかった点。発注者の確認を推奨）**：
    *   (a) **ボタンの押せる条件**：操作モードは見ず、「フォルダを1つだけ選んでいる（選んでいるまとまりがそのフォルダ1つ）・そのフォルダが変えられる」で押せる見た目にする（フォルダを選べるのは選択・頂点の選択だけのため、ほかのモードでは押せない）。ロック中・ドラッグ中・行のドラッグ中は見た目に含めず、押しても何もしない（「フォルダを作る」ボタンと同じ受け付けない条件）。選んでいるフォルダが複合パスなら、ロック等で押せないときも押された見た目にする。
    *   (b) **一番下の図形がロックされた複合パス**：色・太さの変更・スポイトの当てる先から外し、オプションバーの表示にも入れない（表示と反映先を一致させるため。ほかに対象が無ければ選択なしと同じ表示＝直前に使った値）。
    *   (c) **囲む図形がロックされているときの塗られた所のクリック**：その図形は当たらず（ロックは素通りの今の規則）、奥で点を囲む変えられる中の図形、無ければ複合パスの後ろの図形へ進む。
    *   (d) **`compoundPath`の輪郭が1つでも足りないとき**：要素ごと描かない（一部だけ描くと穴が塗られて見えるため）。エディタで開くときは、輪郭の変換ができない要素は要素ごと1件の読み飛ばし、図形データとして不正な輪郭はその図形だけ読み飛ばす（フォルダと残りは入る）。エディタが書き出すJSにはどちらも現れない。
    *   (e) **図形1つ・塗れない形の複合パスの書き出し**：普通の要素にせず`compoundPath`（輪郭1つ）にする（普通の要素では塗れない形が塗られないため）。
    *   (f) **内側の複合パスのフォルダ**：値は保ち、一覧では複合パスの絵を出す（外側の中では効かないことは絵では示さない）。ボタンで内側のフォルダだけを選べば切り替えられる。
    *   (g) **作業データの移行**：版4以前の作業データに`compound`のキーがあっても移行で消す（版4以前に意味は無く、手で書いた値で複合パスにしないため）。極端に深い・循環する版4以前のデータは今までどおり全体の読み込み失敗だが、`error`の文言が「版4から版5へのマイグレーションに失敗しました: …」に変わる（`ok`・警告の回数は同じ）。
*   **複合パスの中へ描く・貼り付ける図形**：描き込む先が複合パスの中なら、新しく描いた・貼り付けた図形は入ったとたんに複合パスの一部になり、自分のスタイルでは見えない（一番下にならない限り）。中の図形の行のサムネイルは自分のスタイルのまま（REQの要件4）で、キャンバスの見た目と違って見える。
*   **選択の外枠・⛶・ステータスバーの大きさ**：`ShapeExtentReader`（`computeShapesBounds`等）は図形ごとの自分の線の太さで外枠を求めるため、複合パスの線の太さ（一番下の図形の太さ）と違う図形を含むと、⛶の外枠が書き出しの`bounds`とわずかに違うことがある（外枠のハンドルの位置は線を含まない外枠のため影響しない）。今回は変えない。
*   **自己交差するパス**：複合パスの中では`evenodd`で塗るため、自己交差する閉じたパス（五芒星など）は、複合パスに入れると今の`nonzero`の見た目と違う（中心が抜ける）。図形1つの複合パスでも同じ。仕様どおり（REQの要件2）。
*   **（タスク1の実施メモ）`isInsideOutline`の重さと開いたパス**：`Curve`・`Ellipse`の弧は呼ぶたびに101点の多角形を作る（キャッシュしない）。`Path.#fillPolygon`は開いたパスのとき末尾に最後の頂点を足すようにした（`hitTestFill`は開いたパスで先に偽を返すため結果は変わらないが、今後`#fillPolygon`を別の用途で使うときは末尾の頂点の有無に注意）。`Ellipse`の円の`isInsideOutline`は`hitTestFill`と式を重複して持つ（`hitTestFill`の式を直すときは両方を見直す）。
*   **当たり判定の重さ**：塗られた所の判定は、クリック・ホバー・カーソルのたびに中の図形すべての`isInsideOutline`（曲線は100分割の多角形）を調べる。中の図形が極端に多い複合パスで重くなるかは確かめていない。
*   **OZ Engineへの連絡**：書き出し形式の版を5に上げ、新しい描画要素`compoundPath`（`fill('evenodd')`）を足すため、**次のサブフェイズで連絡票を出す**（今回は出さない）。版5のJSを古い読み手（版4まで）で描くと、複合パスが描かれない。
*   **確認の状況**：`CanvasManager`の複合パスの描画・`ItemListPanel`のボタンと絵・`ItemListWiring`・`main.js`の配線・実際の見た目（`evenodd`の穴・アンチエイリアス）は`node --test`で確かめられない（テストプレイで確かめる範囲）。

### テストプレイの確認項目（発注者がブラウザで確かめる手順）
0.  **準備と切り替え**：画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。円のツールで大きい円を描き、その中に小さい円を描く。選択（`V`）で大きい円を選び、オプションバーで塗りを「あり」にして色を付ける。2つの円を選んで（`Ctrl`+クリック）`Ctrl`+`G`でフォルダにまとめる。一覧でフォルダの行をクリックして選び、一覧の下端の「複合パス」ボタンを押すと、ドーナツ型（小さい円の所が抜ける）になり、ボタンが押された見た目になる。もう一度押すと元の2つの円（小さい円は自分の見た目）に戻る。`Ctrl`+`Z`で切り替えが戻り、`Ctrl`+`Y`でやり直せる（1回ずつ）。
1.  **一覧の見分けと押せないとき**：複合パスのフォルダの行の絵が、普通のフォルダの絵と違う（穴のある絵）。何も選んでいないとき・図形だけを選んでいるとき・フォルダを2つ選んでいるとき（`Ctrl`+クリック）は、ボタンがうすく押せない。フォルダの鍵を押してロックすると（中のフォルダを選んだときも、上のフォルダのロックを受け継ぐと）押せない。目で隠したフォルダも押せない。
2.  **中の図形を動かす**：ドーナツの小さい円の輪郭をクリックして選び、ドラッグして動かすと、穴も一緒に動く。小さい円を大きい円の外へ半分出すと、重なっていない所（小さい円だけの所）は塗られる。一覧で小さい円の行をフォルダの外へドラッグして出すと、小さい円は自分の見た目に戻り、大きい円は穴の無い円になる（`Ctrl`+`Z`で戻す）。
3.  **色の変更**：小さい円を選び、オプションバーの塗りの色を変えると、ドーナツ全体の色が変わる（オプションバーにはドーナツの色が出る）。線の太さを変えるとドーナツの両方の輪郭の線が太くなる。フォルダを選んで「複合パス」ボタンで普通のフォルダに戻すと、小さい円は元の自分の色・太さに戻り、大きい円は変えた色のまま。
4.  **クリック**：選択を外してから、ドーナツの輪（塗られた所）をクリックすると大きい円が選ばれる。穴をクリックすると、後ろに図形があればその図形が選ばれ、無ければ何も選ばれない。小さい円の輪郭の線の上をクリックすると小さい円が選ばれる。大きい円の塗りを「なし」にすると、輪の所をクリックしても選ばれない（輪郭の線の上だけで選ばれる）。
5.  **一番下の図形と塗れない形**：一覧で大きい円（一番下）の目を押して隠すと、残りの図形（小さい円）の見た目で描かれる（小さい円だけの複合パス）。目を戻し、弧のツールで弧を、直線のツールで開いた折れ線をフォルダの中に描く（一覧でフォルダの行を押してから描く）と、どちらも塗りの形に入る（弧・折れ線の始点と終点を結んだ所が、重なりの数で塗られる／抜ける）。弧を一覧でフォルダの一番下へドラッグすると、弧の線・塗りでドーナツ全体が描かれる（弧に塗りの色があれば塗られる）。
6.  **保存と貼り付け**：ページを再読み込みしても、キャンバスの一覧で別のキャンバスを開いて戻っても、複合パスのまま（ボタン・絵も）。フォルダを選んで`Ctrl`+`C`・`Ctrl`+`V`すると、貼り付けたフォルダも複合パス。`Ctrl`+`D`の複製・`Alt`+ドラッグの複製も同じ。キャンバスパレットの「出力（作業ファイル）」で保存したファイルを「開く（ファイル）」で開いても複合パスのまま。
7.  **書き出し**：「出力（エンジン用）」で書き出したJSを、確認用ページ（`sprite-check.html`）で開くと、エディタと同じドーナツ型に描かれ、外枠の矩形がドーナツを囲む（情報欄の書き出し形式の版は5）。その書き出したJSをエディタの「開く（ファイル）」で開くと、一覧に複合パスのフォルダ（「フォルダ 1」）があり、中に円が2つ入っていて同じドーナツ型に描かれる。
8.  **前のファイル**：前に書き出したJS（版4以前）と前に保存した作業データ（版4以前）が、今までどおり開ける（フォルダは普通のフォルダで、複合パスは無い）。`asset/sprite`のツールのアイコンも今までどおり表示される。
9.  **アウトライン表示**：`Z`でアウトライン表示にすると、ドーナツの2つの円の輪郭がそれぞれ細い線で描かれる（今までどおり）。もう一度`Z`で戻すとドーナツ型。
