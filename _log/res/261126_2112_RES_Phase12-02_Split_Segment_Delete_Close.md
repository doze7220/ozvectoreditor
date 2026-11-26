# RES: 作業計画・作業レポート Phase 12-02 : 分割・区間の削除・閉じる
* 参照元REQ: `./_log/req/261126_2026_REQ_Phase12-02_Split_Segment_Delete_Close.md`

## 1. 作業目的
頂点の選択（`A`）で選んだ点・区間を使って、線・パスを切り分け（「分割」）、区間を消し（「区間を消す」）、開いた線を閉じられる（結合`J`の1本のとき。弧1本も閉じる）ようにする。分割・区間の削除はオプションバーの新しい2つのボタン（キーなし）で行い、分かれた線は元の行のすぐ上に同じ名前で入る。結合のボタンは「押せる見た目なら必ず何かが起き、何も起きないなら押せない見た目」にそろえる。どの操作も取り消し1回で戻る1件の編集操作で、作業データ・書き出し形式の版は上げない。Phase 12-01の点の追加・削除、「曲線に」「直線に」「角」、2本の結合、端点への吸い付きの結果は変えない。

## 2. アーキテクチャ設計

### 用語（全タスク共通）
*   **輪郭の元・区間・選んだ点（target）**：Phase 12-01の`shapes/PathVertexRules`のとおり。輪郭の元（`outlineSourceOf`）は直線＝点2つ・開いた・`line`1つ、矩形＝点4つ（topLeft→topRight→bottomRight→bottomLeft）・閉じた・`line`×4、今の曲線＝点2つ（始点・終点）・`bezier`1つ、パス＝そのまま。選んだ点は`{ shape, vertexIndex }`（`vertexIndex`は図形の`getVertexIndexForHandle`の番号＝図形データの`points`の番号）。
*   **輪郭の番号**：選んだ点の番号を輪郭の元の点の番号へ読み替えたもの。直線・矩形・パスは同じ番号、今の曲線は始点0→0・終点2→1・制御点1→無し（線の上に無い）。読み替えの唯一の箇所は`PathVertexRules.outlineVertexIndexOf`（新設）。
*   **選んでいる区間**：輪郭の元の区間`i`（`points[i]`→`points[(i+1) % n]`。閉じた形の最後の区間を含み、開いた線は折り返さない）で、両端の輪郭の番号がどちらも選ばれているもの。判定の唯一の箇所は`PathVertexRules.selectedSegmentIndexesOf`（新設。`PathSegmentKindRules`の「切り替える区間」もこれを使うように括り直す）。
*   **切れる点**：輪郭の番号があり、輪郭の元が閉じている（閉じたパス・矩形）か、開いた線の端でない点。開いた線の端の判定は`PathJoinRules.endpointVertexIndexOf`（今あるもの）を使う。今の曲線は始点・終点が端で制御点は輪郭の番号を持たないため、切れる点が無い。円・弧は頂点のハンドルが無く点を選べない。
*   **ピース**：分割・区間の削除でできる線1本。輪郭の元の点の番号の並び（`indices`）と区間の番号の並びで表し、`start`＝最初の点の番号。点が1つだけのピースは消える（図形にしない）。
*   **元の行を引き継ぐ1本（keeper）**：ピースのうち、(a)`start`が0のもの、無ければ(b)点の番号0を含むもの、無ければ(c)`start`がいちばん小さいもの。残りのピースが「新しくできた線」で、`start`の小さい順に並べ、元の行のすぐ上へその順に入れる（後のものほど上＝手前）。決める箇所は`PathSplitRules`の非公開の1か所。

### 最初の表（図形の種類ごとの結果。テストはこの表の行ごとに書く）
共通：分かれた線（ピース）はすべて開いたパス（`path`・`closed: false`）。区間の種類・`bezier`の引っ張る点・点の角（`corners`。端になった点の角の値も元の値のまま写す＝Phase 12-01の点の削除と同じ）・線の色・太さ・塗り（`fillColor`。開いた線でも値を保つ）は元のまま（`smooth`の区間は端になった点の近くの曲がり方が少し変わる。`line`・`bezier`は形が変わらない）。元の行を引き継ぐ1本は`replaceShape`の`keepId`で`id`・名前・表示・ロック・一覧の位置・フォルダの所属を保ち、新しくできた線は元の行のすぐ上（同じフォルダの中）に同じ名前・新しい`id`で入る。操作の後は、元の選択（消えた図形を除く）に新しくできた線を足したものが選ばれ、頂点の選択は空になる。

#### 表A：分割（選んだ切れる点のすべてで切る）
| 元の図形 | 切れる点／切れない点 | 結果（元の行を引き継ぐ1本） | 新しくできる線（下から上の順） | 「分割」が押せるか |
| --- | --- | --- | --- | --- |
| 直線（`line`） | 切れる点なし（始点・終点は端） | — | — | 押せない |
| 今の曲線（`curve`） | 切れる点なし（始点・終点は端、制御点は線の上に無い） | — | — | 押せない |
| 円・弧 | 点を選べない（頂点のハンドルが無い） | — | — | 押せない |
| 開いたパス（点2つ） | 切れる点なし | — | — | 押せない |
| 開いたパス（点`n`≥3） | 切れる点＝`points[1]`〜`points[n−2]`／切れない点＝`points[0]`・`points[n−1]`（選んでいても数えない） | 切った点`c1<…<ck`で`k+1`本。`[0..c1]` | `[c1..c2]`、…、`[ck..n−1]` | 途中の点を1つ以上選んでいれば押せる |
| 閉じたパス（点`n`≥3）・1点`c`で切る | すべての点が切れる点 | 1本だけ：`[c, c+1, …, n−1, 0, …, c]`（点`n+1`・区間`n`。始点と終点が`c`で重なる開いた線） | なし | 押せる |
| 閉じたパス・2点以上`c1<…<ck`で切る | 同上 | `k`本。`c1 = 0`なら`[0..c2]`、そうでなければ折り返しの`[ck, …, n−1, 0, …, c1]` | 残り（`[c1..c2]`…）を`start`の小さい順 | 押せる |
| 矩形（`rect`。閉じた4点・直線の区間4つとして読む） | すべての角の点が切れる点 | 1点`i`：`[i, i+1, i+2, i+3, i]`（番号は4で割った余り。点5つ・`line`×4の開いたパス）。2点以上：閉じたパスの行と同じ（4点すべてなら点2つの線が4本） | 閉じたパスの行と同じ | 押せる |
| 複数の図形の点 | 図形ごとに上の規則 | 図形ごと | 図形ごと（それぞれの元の行のすぐ上） | 1つでも切れる点があれば押せる |

#### 表B：区間を消す（選んでいる区間をすべて消す）
| 元の図形 | 選んでいる区間 | 結果（元の行を引き継ぐ1本） | 新しくできる線（下から上の順） | 「区間を消す」が押せるか |
| --- | --- | --- | --- | --- |
| 直線 | 始点と終点を両方選ぶ＝区間1つ | 両方の点が1つだけになり**図形ごと消える** | — | 両端を選んでいれば押せる |
| 今の曲線 | 始点と終点を両方選ぶ＝区間1つ（制御点は関係しない） | 図形ごと消える | — | 始点と終点を選んでいれば押せる |
| 円・弧 | 点を選べない | — | — | 押せない |
| 開いたパス（点2つ） | 区間1つ | 図形ごと消える | — | 押せる |
| 開いたパス（点`n`≥3）・区間`s`を1つ | 隣り合う2点 | `s = 0`：`[1..n−1]`（点0は消える）。`s = n−2`：`[0..n−2]`（最後の点は消える）。途中：`[0..s]` | 途中なら`[s+1..n−1]` | 押せる |
| 開いたパス・区間を複数 | 隣り合う点の組を複数 | 消した区間で分けたピースのうち点2つ以上のもの。`[0..]`が残ればそれ、点0が消えれば残ったうち最初の1本 | 残りを`start`の小さい順。続けて消した区間の間の点・端の点は1つだけになり消える | 押せる |
| 開いたパス・すべての区間 | — | 図形ごと消える | — | 押せる |
| 閉じたパス（点`n`）・区間`d`を1つ | 隣り合う2点（最後の点と始点の組を含む） | 1本だけ：`[d+1, …, n−1, 0, …, d]`（点`n`・区間`n−1`の開いた線） | なし | 押せる |
| 閉じたパス・区間を`m`個（2≤`m`<`n`） | 同上 | 消した区間のすぐ後の点から始まるピース（続けて消した区間に挟まれた点は消える）。keeperの規則（`start`が0→0を含む→`start`が最小） | 残りを`start`の小さい順 | 押せる |
| 閉じたパス・すべての区間（`m = n`） | すべての点を選ぶ | 図形ごと消える | — | 押せる |
| 矩形・区間1つ（辺`i`） | 隣り合う2つの角 | `[i+1, i+2, i+3, i]`（点4つ・`line`×3） | なし | 押せる |
| 矩形・隣り合う2辺（角`j`を挟む） | 3つの角 | 点3つの1本（角`j`は消える） | なし | 押せる |
| 矩形・4辺 | 4つの角すべて | 図形ごと消える | — | 押せる |
| 矩形・向かい合う2辺／3辺（規則のテストだけ） | 画面では起きない（選んでいる区間は選んだ点で決まり、2辺の4つの角を選ぶと4辺すべてになる） | 向かい合う2辺＝点2つのピース2本、3辺＝点2つの1本 | 向かい合う2辺＝1本 | — |
| 矩形・対角の2つの角だけ | 区間なし | — | — | 押せない |
| 複数の図形 | 図形ごと | 図形ごと（消えた図形は一覧から消え、入っていたフォルダは空になっても残る） | 図形ごと | 1つでも選んでいる区間があれば押せる |

#### 表C：1本で結合（`J`・🔗）
| 選んでいる変えられる図形1本 | 結果 | ボタン |
| --- | --- | --- |
| 直線・今の曲線・開いたパス（点2つ） | 何も起きない（閉じると点が2つ以下） | 押せない（今のまま） |
| 開いたパス（点3つ）で両端が重なる（画面上5px以内） | 何も起きない（まとめると点2つ） | **押せない**（今は押せるのに何も起きない。変える） |
| 開いたパス（点3つ以上）で両端が離れている | 最後の点から始点への直線の区間を足した閉じたパス（`id`・名前・位置を保つ。今のまま） | 押せる |
| 開いたパス（点4つ以上）で両端が重なる | 最後の点を除いて閉じる（今のまま） | 押せる |
| 弧（`arc`） | **閉じたパス（点3つ＝始点・頂上・終点、区間`bezier`・`bezier`・`line`。弧の部分の引っ張る点は`chainSourceOf`の値そのもの＝見た目の弧は変わらない）**。`id`・名前（「弧 n」のまま）・位置を保つ。塗りの値があれば塗りが現れる | **押せる**（変える。両端の距離が画面上5px以内の小さな弧だけは押せない） |
| 閉じたパス・矩形・円 | 何も起きない | 押せない（今のまま） |
| 2本（結合できる線どうし） | 今のまま（必ず結果ができる） | 押せる（今のまま） |
| 直線・曲線のツールで同じ弧の両端の間を途中に点を打たずに引く | 弧を閉じたパスにする（足す区間は引いた線のツールの種類：直線のツール＝`line`、曲線のツール＝`smooth`。途中に点を打つ今の`planCloseWithPoints`と同じ）。`id`を保つ。記録1件 | — |

### 要件1・2：分割・区間を消す（規則 `shapes/PathSplitRules.js` 新規）
*   **置き場所の理由**：切れる点・選んでいる区間の判定とピースの組み立ては、図形種別の分岐と図形データの読み方を要するため`shapes/`の図形をまたぐ規則（第3の種類）に置く。ピースの組み立て・元の行を引き継ぐ1本の決め方・押せるかの判定は、Phase 12-01の`PathVertexRules`の責務（点の追加・削除と、その計算のための輪郭の元の読み方）の外のため`PathVertexRules`には足さず、新しいファイルにする（憲法3章。`edit/`・`core/`へ図形種別を持ち込まない）。輪郭の元の読み方に属する「輪郭の番号への読み替え」と「選んでいる区間」の判定の2関数だけは`PathVertexRules`に置く（理由は『判定の共有』）。
*   **import**：`./Path.js`（`Path`・`readCornerFlags`）・`./PathVertexRules.js`（`outlineSourceOf`・`outlineVertexIndexOf`・`selectedSegmentIndexesOf`）・`./PathJoinRules.js`（`endpointVertexIndexOf`）。どれもこのファイルをimportしないため循環しない。輪郭の元への読み替え・矩形の読み方・2次→3次の式・選んでいる区間・開いた線の端の判定は写さない。
*   **公開**：
    *   typedef`SplitTarget`（`{ shape, vertexIndex }`。`PathVertexRules.VertexTarget`と同じ形）・`SplitAvailability`（`{ split: boolean, deleteSegments: boolean }`。`palette/OptionBarSplitGroup.js`に同じ内容の二重定義を置き、互いに存在を書く）・`SplitPlanItem`（`{ targetId, pieces: Path[] }`。`pieces[0]`が元の行を引き継ぐ1本、`pieces[1..]`が新しくできた線（下から上の順）、空配列は図形ごと消える。ピースの`id`は`null`）。
    *   `resolveSplitAvailability(targets)` → `SplitAvailability`。`split`＝切れる点を1つ以上持つ図形があるか、`deleteSegments`＝選んでいる区間を1つ以上持つ図形があるか。計画の関数と同じ非公開の判定を使う（押せるとき必ず計画が1件以上になる）。
    *   `planSplitAtVertices(targets)` → `SplitPlanItem[]`（切れる点を1つ以上持つ図形だけ。図形は`targets`に最初に現れた順）。
    *   `planSegmentDeletion(targets)` → `SplitPlanItem[]`（選んでいる区間を1つ以上持つ図形だけ。同じ順）。
*   **非公開**：
    *   `collectEntries(targets)`：図形ごと（図形のオブジェクトで束ね、最初に現れた順）に`{ shape, data, source, vertexIndexes }`を集める。`type`が`line`・`rect`・`curve`・`path`以外は`toJSON()`を呼ばず飛ばす（`planVertexRemoval`と同じ読み方）。選んだ点を図形ごとに束ねて番号を範囲の中に絞る手順は`planVertexRemoval`・`PathSegmentKindRules.collectSwitchEntries`にもある写しで、承知のうえで残す（理由は5章「選んだ点を図形ごとに束ねる手順の写し」）。
    *   `cutPointsOf(entry)`：切れる点の輪郭の番号の集合（用語の定義どおり。`outlineVertexIndexOf`で読み替え、輪郭の元が開いているときは`endpointVertexIndexOf(data, 'start')`・`(data, 'end')`と同じ図形の番号を除く）。
    *   `buildPieces(source, cutPoints, removedSegments)`：**ピースを作る唯一の箇所**（分割と区間の削除が共有）。開いた線は点0から、閉じた形は「切る点」か「直前の区間が消える点」のうち番号の最も小さい点から、区間を1つずつたどる。消える区間に来たらそこでピースを終えて次の点から新しいピースを始め、切る点に着いたら（開いた線の最後の点を除く）そこでピースを終えて同じ点から新しいピースを始める。閉じた形は元の点に戻ったら終える。点が1つだけのピースは捨てる。ピースの区間は元の区間の値をそのまま渡し（`Path`のコンストラクタが写す）、角は`readCornerFlags(source)`の値を点と同じ並びで写す。
    *   `orderPieces(pieces)`：用語の「元の行を引き継ぐ1本」の規則で並べる唯一の箇所。
*   **結果の`Path`**：`new Path(点, false, source.strokeColor, source.strokeWidth, source.fillColor, 区間, 角)`。点2つでも`path`のまま（Phase 12-01と同じ）。閉じた形は点3つ以上のため、ピースは常に点2つ以上の開いた線になり、`Path.fromJSON`の受理範囲（開いた2点以上）に入る。点1つのパス・点2つの閉じたパスは作らない。
*   **引数を書き換えない。結果は引数と配列・点を共有しない**（`Path`のコンストラクタが点・区間を写す）。

### 要件1・2：判定の共有（`shapes/PathVertexRules.js`・`shapes/PathSegmentKindRules.js`の更新）
*   `PathVertexRules`に2つの関数を足す（輪郭の元への読み替えの一部。ファイル先頭の責務を「輪郭の元への読み替え（選んだ点の番号と、両端の点が選ばれている区間の読み方を含む）」の趣旨へ3行以内で直す）。先頭の責務を書き換えてまで取り込む理由：2関数は今ある責務の「輪郭の元への読み替え」（`outlineSourceOf`）の点・区間の番号の読み方そのもので、`outlineSourceOf`の点の並び（今の曲線＝始点・終点の2点、矩形＝4つの角の閉じた4区間）と一体のため、別ファイルにすると輪郭の元の点の並びの約束が2か所に分かれる。今回`outlineSourceOf`も`PathSplitRules`から使うようになり、`PathVertexRules`は輪郭の元の読み方を`PathSplitRules`・`PathSegmentKindRules`へ渡す共有の箇所になる：
    *   `outlineVertexIndexOf(data, vertexIndex)` → `number|null`：直線・矩形・パスは0以上・`points.length`未満の整数ならそのまま、今の曲線は0→0・2→1・1→`null`、ほか（円・弧・範囲外・整数でない）は`null`。
    *   `selectedSegmentIndexesOf(data, vertexIndexes)` → `number[]`（昇順）：`outlineSourceOf(data)`が`null`なら空。選んだ点を`outlineVertexIndexOf`で読み替え、輪郭の元の区間`i`（`0`〜`segments.length − 1`）のうち`i`と`(i + 1) % n`がどちらも選ばれているもの。同じ点の重複は1つ。引数を書き換えない。
*   `PathSegmentKindRules`の非公開`collectSwitchEntries`の区間の判定（今の曲線の`0`と`2`の分岐と、区間を持つ線の`i`と`(i + 1) % n`の分岐）を`selectedSegmentIndexesOf(data, [...selected])`の1行に置き換える（`dataOf`が矩形・円・弧を対象外にするのは今のまま＝矩形は区間の切り替えの対象にならない。結果は今と同じで、既存のテストの全件合格で確かめる）。importに`./PathVertexRules.js`を足す（`PathVertexRules`は`PathSegmentKindRules`をimportしないため循環しない）。

### 要件1〜3：1件の編集操作（`edit/PathSplitEditor.js` 新規）と、対象の集め方の共有（`core/VertexTargetRules.js` 新規）
*   **対象の集め方を1か所に括る（`core/VertexTargetRules.js` 新規。状態なし）**：`collectVertexTargets(mode, selectedIds, selectedVertices, shapes)` → `Array<{ shape, vertexIndex }>`。中身は今の`PathCornerEditor.#collectTargets`・`PathVertexEditor.#collectTargets`と同じ手順（`resolveNudgeTarget(mode, selectedIds, selectedVertices)`が`'vertices'`のときだけ、`shapes`から`id`で図形を探し、`getVertexIndexForHandle(handle)`が`null`でない組を頂点の選択の順に並べる。図形が無い組・番号が得られない組は飛ばす。ほかは空配列）。importは`./NudgeTargetRules.js`（`resolveNudgeTarget`）のみ（規則どうしの一方向のimport）。図形は共通プロパティ`id`と共通メソッド`getVertexIndexForHandle`だけを使い、図形種別・ハンドル名の形式を知らない。`PathCornerEditor`・`PathVertexEditor`の`#collectTargets`はこれを呼ぶだけにする（ふるまいは変えない。既存のテストで確かめる）。3つ目の写しを作らない。
*   **`edit/PathSplitEditor.js`（新規）**：`PathCornerEditor`・`PathVertexEditor`と同じ形の手順のクラス。
    *   `constructor({ model, editRecorder, getMode })`。
    *   `getAvailability()` → `SplitAvailability`（`resolveSplitAvailability(#collectTargets())`。純粋な照会）。
    *   `splitAtSelectedVertices()` → `boolean`（`#apply(planSplitAtVertices(#collectTargets()))`）。
    *   `deleteSelectedSegments()` → `boolean`（`#apply(planSegmentDeletion(#collectTargets()))`）。
    *   `#collectTargets()`：`collectVertexTargets(getMode(), model.getSelectedIds(), model.getSelectedVertices(), model.getShapes())`。
    *   `#apply(plan)`：①計画が空なら記録先・モデルに触れず`false`。②置き換える前に、元の選択`getSelectedIds()`・選んでいるフォルダ`getSelectedGroupIds()`と、図形のアイテムの並び`listShapeItems(getItems())`（`core/ItemTreeRules`）を控える。③`beginEdit` → `clearSelectedVertices()`（先に空にして、途中の通知で古いハンドル名が残らないようにする）→ 計画の図形ごとに：ピースが空なら消す図形の`id`へ控える／そうでなければ`replaceShape(targetId, pieces[0], { keepId: true, select: false })`、ピースが2つ以上なら`addShapesWithNewIds(pieces.slice(1).map((shape) => ({ kind: ITEM_KIND.SHAPE, shape, name: 元のアイテムの名前 })), { place: { kind: PLACE_KIND.ABOVE, id: targetId } })`（元のアイテムの名前＝②で控えた並びのうち`item.shape.id === targetId`のアイテムの`name`。戻り値の新しい`id`を控える）→ 消す図形があれば`deleteShapes(ids)`（図形のアイテムだけを除き、フォルダは空になっても残る）→ `setSelection([...元の選択, ...新しい id], { groupIds: 元の選んでいるフォルダ })`（現存しない`id`は`VectorModel`が落とす）→ `commitEdit()`（鍵なし。複数の図形でも1件）。④`true`。
    *   **表示・ロックの引き継ぎ**：新しいアイテムには`visible`・`locked`を渡さない（補う値`true`・`false`になる）。対象の図形は頂点の選択に入っている＝変えられる図形（自分も上のフォルダも隠れておらずロックされていない）なので、元の行の値は必ず`visible: true`・`locked: false`で、同じフォルダの中に入るため上のフォルダから受け継ぐ値も同じ。`edit/`で`visible`・`locked`の値を読まない約束（読むのは`ItemStateRules`だけ）を保つ。
    *   **入る場所**：`PLACE_KIND.ABOVE`は「その行のすぐ上（同じ並びのすぐ後ろ）」で、渡した順に並ぶため、後のピースほど上（手前）になる。
    *   **import**：`../core/VertexTargetRules.js`（`collectVertexTargets`）・`../core/ItemTreeRules.js`（`ITEM_KIND`・`listShapeItems`）・`../core/ItemPlaceRules.js`（`PLACE_KIND`）・`../shapes/PathSplitRules.js`（`resolveSplitAvailability`・`planSplitAtVertices`・`planSegmentDeletion`）のみ。
    *   **`model`が使うもの**：`getShapes`・`getSelectedIds`・`getSelectedVertices`・`getSelectedGroupIds`・`getItems`・`clearSelectedVertices`・`replaceShape`・`addShapesWithNewIds`・`deleteShapes`・`setSelection`だけ。`editRecorder`は`beginEdit`・`commitEdit`だけ。操作モードの値を解釈しない・図形種別の分岐・ハンドル名の形式・DOMを持たない・`try/catch`を持たない・再描画を呼ばない。
    *   **モデルの公開操作は足さない**：今ある`replaceShape`・`addShapesWithNewIds`（`place`）・`deleteShapes`・`setSelection`・`clearSelectedVertices`の組み合わせで足りる。`replaceShape`・`addShapesWithNewIds`のJSDocにある「呼び出し側が選択モードであること」という前提は、選択集合の不変条件（選択モード・頂点の選択モード以外では空）より狭い古い記述で、頂点の選択から呼んでも不変条件は崩れない（Phase 12-01の`PathVertexEditor`と同じ扱い。`VectorModel.js`は変えず、資料に正しい記述を残す）。
    *   **通知の回数**：`replaceShape`・`addShapesWithNewIds`・`deleteShapes`・`setSelection`がそれぞれ1回ずつ通知する（途中の通知の時点でも状態は正しい。`PathCornerEditor`と同じ考え方）。取り消しは1件。
    *   **前提（呼び出し側の責務）**：ドラッグ中でないこと（`main.js`の配線が判定する）。

### 要件4：ボタン（`palette/OptionBarSplitGroup.js` 新規・`index.html`・`main.js`）
*   **置き場所**：`index.html`の2行目、角のまとまり`#option-corner-group`のすぐ右に新しいまとまり`<div id="option-split-group" class="toolbar-group">`を置き、ボタン2つ（`class="tool-btn icon-btn"`・初期`disabled`）：「分割」`#option-split-at-vertices`（記号`✂`。仮）・「区間を消す」`#option-delete-segments`（記号`✕`。仮）。`title`は「分割（頂点の選択で選んだ点で線を切り分ける）」「区間を消す（頂点の選択で両端の点を選んだ区間を消す）」。キーの表記は書かない（キーなし）。区切りは`.toolbar-group + .toolbar-group`のCSSで自動で付く。幅の見積もりのコメント（2行目 約1026px）に「＋区切り17px＋分割約68px（ボタン32×2＋間隔4）」を足して約1111px（1280px幅に収まる）に直す。
*   **まとまりを分ける理由**：オプションバーは「まとまりごとに1つのUI部品」の方針で、`OptionBarCornerGroup`（角・区間の種類の切り替え）の責務に入れない。今回のボタンに関係しない`palette/`は変えない。
*   **`palette/OptionBarSplitGroup.js`（新規。importなし・DOM操作専任）**：`constructor(groupElement, { onSplit, onDeleteSegments })`（どちらかが関数でなければ`Error`、要素`#option-split-at-vertices`・`#option-delete-segments`のどちらかが欠ければ`console.warn`して配線しない）、`render(availability)`（`disabled`＝`!(availability && availability.split === true)`・`!(availability && availability.deleteSegments === true)`。無ければ両方押せない）。`click`はコールバックを呼ぶだけ（戻り値は使わない）。`blur`しない・`aria-pressed`を付けない（「直線に」「曲線に」・整列のボタンと同じ理由。`FocusKeyYieldRules`が`Space`をパンに、`Ctrl`なしのキーを今どおりにするため）。typedef`SplitAvailability`は`shapes/PathSplitRules.js`との二重定義。
*   **`main.js`（配線だけ）**：`// 7.16.`の後（`// 8.`の前）に`// 7.17. オプションバー（分割のまとまり）配線`を立てる。`const pathSplitEditor = new PathSplitEditor({ model, editRecorder: historyManager, getMode: () => inputTracker.getMode() });`、ドラッグ中は不受理の`performPathSplit(applySplit)`（`performSegmentKindSwitch`と同じ形）、`new OptionBarSplitGroup(document.getElementById('option-split-group'), { onSplit: () => performPathSplit(() => pathSplitEditor.splitAtSelectedVertices()), onDeleteSegments: () => performPathSplit(() => pathSplitEditor.deleteSelectedSegments()) })`、`syncOptionBarSplitGroup()`（`optionBarSplitGroup.render(pathSplitEditor.getAvailability())`）を`model.onChange`に登録し、起動時の明示の同期の列（`syncOptionBarCornerGroup();`の後）でも1回呼ぶ。操作モードの判定・計算を書かない（モードの切り替えは`setMode`の選択の解除で通知が来るため、今の`model.onChange`の経路だけで追従する）。
*   **キー**：割り当てない（`KeyboardShortcuts.js`は変えない）。
*   **ロック・非表示**：頂点の選択は`VectorModel`が変えられる図形の組しか持たない（今の不変条件）ため、ロック・非表示の図形の点は対象にならない。テストで確かめて保つ（コードは足さない）。

### 要件5：閉じる（`shapes/PathJoinRules.js`・`edit/PathJoiner.js`・`main.js`の更新）
*   **`classifyJoin`の1本の分岐**：`isJoinableLine(shape)`で、`chainSourceOf(shape.toJSON()).points.length >= CLOSED_MIN_POINTS`なら`'close'`、ほかは`null`。開いたパス（点3つ以上）は今までどおり`'close'`、直線・今の曲線・点2つのパスは`chainSourceOf`の点が2つで今までどおり`null`、閉じたパス・矩形・円は`isJoinableLine`が偽で今までどおり`null`、**弧は点3つで`'close'`**（変わる）。2本の分岐は変えない。JSDocの「ボタンの押せる/押せないの同期からも呼ばれる（表示倍率は見ない）」は、押せる・押せないは`planJoin`の結果で決まる旨へ直す（`classifyJoin`は表示倍率を見ない分類のまま）。
*   **`buildClosedPath`**：受け付けを`isJoinableLine(shape)`にし、`chainOf(data)`の点が`CLOSED_MIN_POINTS`未満なら`null`（今の`data.closed`・`data.points.length`の判定はこれに含まれる：閉じたパスは`isJoinableLine`が偽、直線・今の曲線・点2つは`chainOf`の点が2つ）。残りの手順（両端が許容距離以内なら最後の点を除く、離れていれば閉じる区間を`gapSegmentKind`で足す、点が3つ未満なら`null`）は今のまま。弧は`chainOf`（→`chainSourceOf`→`arcChainSourceOf`）の点3つ・`bezier`2つに閉じる区間を足した半月形になる（形の式は写さない）。
*   **同じ弧の両端の間を途中の点なしで引いたとき**：`planDrawnLineJoin` → `planCloseOf` → `buildClosedPath(弧, tolerance, 描いた区間の種類)`が閉じたパスを返すようになり、`EndpointSnapper.commitDrawnLine`の今の手順（`cancelDraft` → `beginEdit` → `replaceShape`（`keepId: true`）→ `commitEdit`）で閉じる。`EndpointSnapper`・`EndpointSnapRules`・`InputTracker`は変えない。
*   **`planEndpointDragJoin`**：同じ`planCloseOf`を通るため、弧の自分の端点どうしの計画も閉じたパスになる（弧は頂点のハンドルを持たず`resolveEndpointHandle`が`null`のため、この入力は実際の操作では起きない。分岐は足さない）。
*   **`PathJoiner.canJoin()`**：`planJoin(#selectedShapesInOrder(), screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)) !== null`にする（`join()`と同じ計画の入口。押せる見た目なら必ず計画ができ、計画ができないなら押せない）。importから`classifyJoin`を外す。JSDoc（クラス・`canJoin`）の「表示倍率は見ない」を「表示倍率で換算した許容距離で計画を作れるかを見る」へ直す。`join()`は変えない。
*   **表示倍率の変化への追従（`main.js`）**：押せる・押せないが表示倍率で変わる（両端の距離が画面上5pxをまたぐ）ため、`syncJoinButtonState`を`model.onChange`に加え`viewTransform.onChange`にも登録する（今ある同期の経路への登録。機能専用の経路は足さない）。`syncJoinButtonState`のJSDocの「canJoin()は表示倍率を見ない」を直す。
*   **2本の結合のふるまい・端点への吸い付き・描き足しは変えない**。

### 要件6：取り消しと保存
*   分割・区間の削除は`PathSplitEditor`の`beginEdit`／`commitEdit`の1組、閉じるは今の`PathJoiner.join`・`EndpointSnapper.commitDrawnLine`の1組で、どれも取り消し1回・やり直し1回。計画が空・`null`なら`beginEdit`も呼ばない。スナップショットは頂点の選択を含まないため、取り消し・やり直しの後は頂点の選択が外れ図形の選択だけが戻る（今の角・区間の切り替え・点の削除と同じ）。
*   結果は今の`path`の形（`points`・`closed`・`segments`・`corners`）のまま。`io/`は変えない（作業データの版4・書き出し形式の版4のまま）。

### 要件7：自動テストと、既存のテストで値を変えるもの
*   **足すテストファイル**：`test/core/VertexTargetRules.test.js`（タスク1）・`test/shapes/PathVertexRules.select.test.js`（タスク2）・`test/shapes/PathSplitRules.split.test.js`（タスク3）・`test/shapes/PathSplitRules.segments.test.js`（タスク4）・`test/shapes/PathJoinRules.close.test.js`・`test/edit/PathJoiner.close.test.js`（タスク5）・`test/edit/PathSplitEditor.test.js`・`test/edit/PathSplitEditor.items.test.js`（タスク6）。
*   **既存のテストで値を変えるもの（タスク5で、この5件だけ。要件5の発注者の決定で変わる値）**：
    1.  `test/shapes/PathJoinRules.test.js`の`it('classifyJoin：弧と円・矩形・閉じたパスは null、弧1本は null')`の最後の`assert.equal(classifyJoin([makeArc()]), null)` → `'close'`（テスト名の「弧1本は null」も「弧1本は close」へ直す。円・矩形・閉じたパスとの2本の`null`はそのまま）。
    2.  同ファイル`describe('閉じる（半月形）')`の`it('弧1本は buildClosedPath が null、planJoin も null')` → `buildClosedPath(makeArc(), 0)`が点3つ（`[L, T, R]`）・`closed: true`・区間`[...arcBeziers(), { kind: 'line' }]`のパス、`planJoin([withId(makeArc(), 'A')], 0)`が`keepId: true`・`targetId: 'A'`・`removeIds: []`で同じパス（テスト名も直す）。
    3.  同ファイル`describe('planDrawnLineJoin')`の`it('同じ弧の両端で途中の点なしは null')` → 計画が`keepId: true`・`targetId: 'A'`で、パスが`closed: true`・点`[L, T, R]`・区間`[...arcBeziers(), { kind: 'line' }]`（テスト名も直す）。
    4.  同ファイル`describe('planEndpointDragJoin')`の`it('弧のもう一方の端点への自分のドラッグは null（弧1本は閉じない）')` → 両方の向きとも`keepId: true`の閉じたパスの計画（実際の操作では起きない入力である旨をテスト名に書く）。
    5.  `test/edit/PathJoiner.test.js`の`test('canJoin・join（弧を含む選択。Phase 09-03b）: …弧1本は結合できない…')`の`one`の3つの検証 → `canJoin()`が`true`、`join()`が`true`、呼び出しが`beginEdit`・`replaceShape`（`'r'`・閉じたパス・`{ keepId: true, removeIds: [] }`）・`commitEdit`（テスト名も直す）。
*   上の5件のほかに値が変わるテストが出たら、そのタスクを中断して質問する（`canJoin`が許容距離を見るようになるため、点3つで両端が重なる開いたパスを`canJoin`で`true`と確かめているテストがあれば該当する。現場設計と計画時の確認では見つかっていない）。タスク1・2の括り直しは結果を変えないため、既存のテストの値は変えない。

### モジュールの分担（全体）
| 層 | ファイル | 持つもの | 持たないもの |
| --- | --- | --- | --- |
| `shapes/` | `PathSplitRules.js`（新規） | 切れる点・ピースの組み立て（分割と区間の削除の共有）・元の行を引き継ぐ1本の決め方・押せるかの判定 | モデル・履歴・選択・操作モード・名前・一覧の位置 |
| `shapes/` | `PathVertexRules.js`（更新） | `outlineVertexIndexOf`・`selectedSegmentIndexesOf`（輪郭の元の読み方の一部） | 分割・区間の削除の組み立て |
| `shapes/` | `PathSegmentKindRules.js`（更新） | 切り替える区間の判定を`selectedSegmentIndexesOf`へ任せる | 結果の変更 |
| `shapes/` | `PathJoinRules.js`（更新） | `classifyJoin`の1本の分岐・`buildClosedPath`の受け付け（弧を含む結合できる線の点3つ以上） | 2本の結合・描き足しの変更 |
| `core/` | `VertexTargetRules.js`（新規） | 頂点の選択から`{ shape, vertexIndex }`を集める唯一の箇所 | 図形種別・ハンドル名の形式・モデル・DOM |
| `edit/` | `PathSplitEditor.js`（新規） | 分割・区間の削除の1件の編集操作・押せるかの照会 | 図形種別・操作モードの解釈・DOM・`visible`・`locked`の値 |
| `edit/` | `PathCornerEditor.js`・`PathVertexEditor.js`（更新） | `#collectTargets`を`collectVertexTargets`の呼び出しにする | ふるまいの変更 |
| `edit/` | `PathJoiner.js`（更新） | `canJoin`を`planJoin`の結果にする | `join`の変更 |
| `palette/` | `OptionBarSplitGroup.js`（新規） | 2つのボタンの押せる・押せないの表示と`click`の通知 | 判定・import |
| `js/`・`index.html` | `main.js`・`index.html`（更新） | 生成・注入・同期・ドラッグ中の受理判定／ボタンのマークアップと幅の見積もり | 判定・計算・操作モードの判定 |
| 変えない | `VectorModel`・`HistoryManager`・`InputTracker`・`KeyboardShortcuts`・`CanvasManager`・`EndpointSnapper`・`EndpointSnapRules`・`PathCornerRules`・`OptionBarCornerGroup`・`io/`・ほかの`palette/` | — | — |

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/shapes/`（図形をまたぐ規則）・`./js/core/`（規則の関数）・`./js/edit/`（編集操作の手順）・`./js/palette/`（UI部品）・`./js/`（`main.js`）・`./index.html`・`./test/`
*   **関連する論理クラス**: 新規＝`shapes/PathSplitRules`（規則の関数）・`core/VertexTargetRules`（規則の関数）・`edit/PathSplitEditor`（手順のクラス）・`palette/OptionBarSplitGroup`（UI部品）。更新＝`shapes/PathVertexRules`・`shapes/PathSegmentKindRules`・`shapes/PathJoinRules`・`edit/PathCornerEditor`・`edit/PathVertexEditor`・`edit/PathJoiner`・`main.js`・`index.html`。変えない＝`core/VectorModel`・`core/HistoryManager`・`core/InputTracker`・`core/KeyboardShortcuts`・`core/CanvasManager`・`core/NudgeTargetRules`・`core/ItemTreeRules`・`core/ItemPlaceRules`・`edit/EndpointSnapper`・`shapes/EndpointSnapRules`・`shapes/PathCornerRules`・`shapes/Path`・`palette/OptionBarCornerGroup`・`io/`のすべて・ほかの`palette/`。

### 参照する責務
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`・`palette/`・`wiring/`をimportしない。`palette/`は何もimportしない。循環importは無い。列から外れるのは(1)`edit/ → shapes/`（`PathJoiner`・`EndpointSnapper`・`PathCornerEditor`・`PathVertexEditor`。今回`PathSplitEditor → shapes/PathSplitRules`を足す）、(2)`shapes/`内で規則のファイルが図形クラス・ほかの規則のファイルをimportする向き（図形クラスは規則のファイルをimportしない。今回`PathSplitRules → Path`・`PathVertexRules`・`PathJoinRules`、`PathSegmentKindRules → PathVertexRules`を足す）、(3)`edit/ → core/`の状態を持たない規則の関数（`VectorModel`・`HistoryManager`は注入。今回`PathSplitEditor → core/VertexTargetRules`・`ItemTreeRules`・`ItemPlaceRules`を足し、`PathCornerEditor`・`PathVertexEditor`は`NudgeTargetRules`から`VertexTargetRules`へ替える）。`core/`の規則どうしのimportは使われる側が使う側をimportしない一方向に限る（今回`VertexTargetRules → NudgeTargetRules`を足す）。
*   **`shapes/`**：図形クラス（種別ごとに1ファイル）・図形クラスだけが使う共通の関数（`ShapeGeometry`）・図形をまたぐ規則（第3の種類。`PathJoinRules`・`EndpointSnapRules`・`PathCornerRules`・`PathSegmentKindRules`・`PathVertexRules`。`shapes/`の外から使う。状態を持たない`export`した関数と定数のみ。図形の`type`・`id`・`toJSON()`だけを読む）。唯一の箇所：`PathJoinRules.segmentKindsOf`（直線は直線の区間1つ）・`segmentSpecsOf`（区間の指定を引っ張る点ごと運ぶ）・`chainSourceOf`（今の曲線・弧を区間として読む。2次→3次の式・`arcChainSourceOf`の楕円の4分の1の近似の式）・`lineEndpointOf`／`endpointVertexIndexOf`（結合できる線の端点の座標／番号）・`chainOf`（開いた線の端の点の角を偽にする）・`buildClosedPath`（1本を閉じる組み立て）、`Path.readCornerFlags`（`corners`の読み方）・`Path.resolveSegmentControls`（区間の制御点の分岐）、`PathVertexRules.outlineSourceOf`（直線・矩形・今の曲線・パスを「パスの図形データの形」に読む。矩形を閉じた4つの直線の区間として読む）。`Path`の区間の約束：`segments[i]`＝`points[i]`→`points[(i+1)%n]`、要素数は開いた`n−1`・閉じた`n`、頂点数の下限は開いた2・閉じた3（`Path.fromJSON`だけが検証。点1つのパス・点2つの閉じたパスをモデルに入れない）、`corners`は頂点と同じ並び、`bezier`の引っ張る点は絶対座標で頂点ではない。`Path`のコンストラクタは点・区間・角を写す。共通メソッド契約は18メソッド（増やさない）。
*   **結合（3章11.）**：`PathJoiner`が選んでいる変えられる図形（`getEditableSelectedShapes()`の重なり順）に`planJoin(shapes, screenLengthToWorld(5))`を当て、`beginEdit` → `replaceShape(targetId, path, { keepId, removeIds })` → `commitEdit`。操作モードを見ない（選択・頂点の選択の両方で効く）。閉じるは`keepId: true`で`id`・一覧の位置を保つ。`main.js`の`performJoin`はドラッグ中は不受理。`syncJoinButtonState`が`model.onChange`で`canJoin()`を当てる。
*   **線を引いて閉じる（3章12.・22.）**：直線・曲線のツールで描き始めと描き終えが同じ線の別の端点に吸い付いていれば`EndpointSnapper.commitDrawnLine` → `planDrawnLineJoin`。途中の点が無ければ`planCloseOf` → `buildClosedPath(shape, tolerance, 描いた区間の種類)`、途中の点があれば`planCloseWithPoints`。計画が`null`なら作成途中の線を捨てるだけで記録しない。
*   **`core/`の規則のファイル**：状態・DOMを持たない関数。引数を書き換えない。何もimportしないか、`InputModes`の値・決められたほかの規則だけをimportする。図形は共通プロパティ・共通メソッドだけを使い、図形種別の分岐・図形固有のプロパティ名を持たない。
*   **`edit/`のクラス**：1件の編集操作の手順（`beginEdit` → 変更 → `commitEdit`）。何も変えないときは記録先に一切触れない。操作モードを解釈しない（`getMode`は規則へ渡すだけ）。図形種別の分岐・図形固有のプロパティ名（ハンドル名の形式を含む）を持たない。DOMに触れない。`try/catch`を持たない。`VectorModel`・`HistoryManager`は注入で受け取り、規則の関数だけをimportする。表示・ロックは`VectorModel`の照会で絞るだけで、`visible`・`locked`の値を読まない（読むのは`core/ItemStateRules`だけ。不備を補う`ItemAttributeRules`と`DocumentSerializer`を除く）。
*   **`VectorModel`**：図形・アイテムの入れ子・選択・選んでいるフォルダ・頂点の選択・描き込む先の唯一の持ち主。`replaceShape(targetId, shape, { keepId, removeIds, select })`は位置のアイテムの`shape`だけを差し替える（名前・表示・ロック・所属・位置を引き継ぐ。`select`が偽なら選択を作り直さず現存しないidだけ外す）。`addShapesWithNewIds(values, { place })`は新しい`id`を振って`place`（`{ kind: PLACE_KIND.ABOVE, id }`＝その行のすぐ上・同じ並び。渡した順に並ぶ）へ入れ、`values`のアイテム`{ kind: 'shape', shape, name }`の名前はそのまま（空なら自動の名前）、`visible`・`locked`が無ければ`true`・`false`を補い、選択を追加した図形だけに置き換える（追加した図形を含む閉じたフォルダは開く）。`deleteShapes(ids)`は図形のアイテムだけを除き、フォルダは空になっても残す（選択・ホバー・頂点の選択から除き、描き込む先を付け替える）。`setSelection(ids, { groupIds })`は現存しないidを除いて選択を置き換え、頂点の選択から選択中でない図形の組を落とす。`setSelectedVertices`・頂点の選択は選択集合に含まれ変えられる図形の組だけを持つ。各操作は1回ずつ通知する。
*   **`HistoryManager`・スナップショット**：前後の作業データを丸ごと比べ、同じなら記録しない。スナップショットは`document`（名前・表示・ロック・入れ子を含む）・`selectedIds`・`selectedGroupIds`・`collapsedGroupIds`で、頂点の選択を含まない。
*   **`palette/`**：1つのUI部品（オプションバーはまとまりごとに1ファイル）。importを持たず、表示とコールバックの通知だけ。`VectorModel`・`InputTracker`・`HistoryManager`・図形を知らない。押せない見た目は`disabled`だけで表す。
*   **`main.js`**：生成・注入・同期の配線だけ。判定・計算・操作モードの判定を書かない。オプションバーの表示は`model.onChange`（ほか今ある`onChange`）で同期し、起動時にも明示的に1回同期する。ドラッグ中の受理判定（`inputTracker.isDragging()`）は配線の関数が持つ。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章 構成図**：`core/VertexTargetRules.js`（頂点の選択から点を対象にする編集操作へ渡す図形と頂点の番号の組を集める規則。状態なし。importは`NudgeTargetRules`のみ。`edit/PathCornerEditor`・`edit/PathVertexEditor`・`edit/PathSplitEditor`から使う。Phase 12-02）、`shapes/PathSplitRules.js`（図形クラスではない。図形をまたぐ規則（分割と区間の削除：切れる点・ピースの組み立て・元の行を引き継ぐ1本の決め方・押せるか）。`shapes/`の外から使う）、`edit/PathSplitEditor.js`（分割・区間の削除の1件の編集操作の手順と押せるかの照会）、`palette/OptionBarSplitGroup.js`（オプションバーの「分割」のまとまり。2つのボタンの表示と通知のみ）。テストの一覧に`test/core/VertexTargetRules.test.js`・`test/shapes/PathVertexRules.select.test.js`・`PathSplitRules.split.test.js`・`PathSplitRules.segments.test.js`・`PathJoinRules.close.test.js`・`test/edit/PathJoiner.close.test.js`・`PathSplitEditor.test.js`・`PathSplitEditor.items.test.js`。`NudgeTargetRules`の行の「使う」（`PathCornerEditor`・`PathVertexEditor`を除き`VertexTargetRules`を足す）、`ItemTreeRules`・`ItemPlaceRules`の行の「使う」に`edit/PathSplitEditor`、`PathVertexRules`の行（選んだ点の番号・両端の点が選ばれている区間の読み方。`PathSegmentKindRules`・`PathSplitRules`からも使う）、`PathJoinRules`の行（`endpointVertexIndexOf`を`PathSplitRules`からも使う）、`index.html`の行（2行目に分割のまとまり）。
*   **1章「存在しないもの」**：「パスの分割」「Phase 12-01でやらないと決めたこと」の中の「線を切る・区間を消す・開いた線を閉じる操作」、「弧1本の閉じる（同じ弧の両端の間を途中の点なしで引いても何も起きない）」、「パスを開く／閉じる」を、Phase 12-02で入ったことに合わせて直す（閉じたパスを開くのは「分割」・「区間を消す」で兼ねる。弧1本は`J`と線を引く両方で閉じる）。Phase 12-02でやらないと決めたこと（REQの「今回やらないこと」：ほかの図形の頂点への吸い付き・端点への吸い付きの対象を広げること、点2つの閉じたパス（半月形・レンズ形を点2つで作ること）、円を開く・切ること、円・弧の点の分割・区間の削除、区間をクリックして選ぶ仕組み・ハサミのツール・点を足す専用のツール・分割・区間を消す・開くのキー、分かれた線を自動でまとめる（フォルダに入れる）こと、切った点の位置をずらすこと、点の本当の共有・1つの図形に輪郭を複数持たせること・複合パス、版を上げること。加えて計画で決めたこと：分かれた線の端になった点の角の値をそろえ直すこと）を足す。
*   **1章「フォルダ分割の方針」「依存方向」**：`shapes/`の第3の種類に`PathSplitRules`（ピースの組み立ての唯一の箇所。輪郭の元・選んでいる区間は`PathVertexRules`、開いた線の端の判定は`endpointVertexIndexOf`に任せ写さない）。`PathVertexRules`の`outlineVertexIndexOf`・`selectedSegmentIndexesOf`（「両端の点が選ばれている区間」の判定の唯一の箇所。`PathSegmentKindRules`の切り替える区間もこれを使う）。`edit/`の一覧に`PathSplitEditor`（分割・区間の削除）。依存方向の(1)に`edit/PathSplitEditor → shapes/PathSplitRules`、(2)に`PathSplitRules → Path`・`PathVertexRules`・`PathJoinRules`と`PathSegmentKindRules → PathVertexRules`、(3)に`PathSplitEditor`（`core/VertexTargetRules`・`ItemTreeRules`・`ItemPlaceRules`）を足し、`PathCornerEditor`・`PathVertexEditor`のimport先を`core/VertexTargetRules`に直す（ファイルの数を数え直す）。`core/`内の規則どうしのimportの列に`VertexTargetRules → NudgeTargetRules`。
*   **2章 `path`**：「作られるのは次のとき」に(7)分割・区間の削除（`PathSplitRules`。開いたパスのピース。直線・矩形・今の曲線もパスになる）を足し、(1)の結合・閉じるに弧1本を閉じた半月形（点3つ・`bezier`×2・閉じる区間）を足す。新しい項「分割・区間の削除（Phase 12-02）」に最初の表（表A・表B）の要約（ピースの作り方・点1つのピースは消える・元の行を引き継ぐ1本の決め方・角の値は元のまま・`fillColor`の値を保つ・作業データの版は4のまま）。2章「アイテム」の`addShapesWithNewIds`・`replaceShape`の前提の記述があれば、頂点の選択から呼んでも不変条件を崩さない旨。
*   **3章2.の同期の経路**：`syncJoinButtonState`を`viewTransform.onChange`にも登録したこと（結合のボタンの押せる・押せないが表示倍率で変わるため）。
*   **3章6.（履歴）**：「記録する操作と時点」に分割・区間の削除（`PathSplitEditor`。`clearSelectedVertices` → `replaceShape`×k → `addShapesWithNewIds`×k' → `deleteShapes` → `setSelection`の前後。鍵なし・複数の図形でも1件）。結合の項に、弧1本の閉じる・押せる条件が`planJoin`の結果になったこと。
*   **3章11.（結合）**：1本のときの規則（`classifyJoin`の1本は`chainSourceOf`の点3つ以上の結合できる線＝開いたパス（点3つ以上）と弧。`buildClosedPath`の受け付け）、押せる条件（`canJoin`＝`planJoin`が`null`でない。表示倍率で換算した許容距離を見る。`viewTransform.onChange`でも同期）、「弧の結合」の「弧1本は閉じない」「同じ弧の両端の間を…何も起きない」の記述と、「今の曲線の結合」の「何も起きないのは…」（点3つで両端が重なる線はボタンが押せない見た目になった）の記述、「やらないこと」の「閉じたパスを開く」を直す。発注者の決定（2026-11-26。閉じた形は点3つ以上・押せる見た目なら必ず何かが起きる）。
*   **3章12.（端点への吸い付きと描き足し）**：線を引いて閉じる経路で、同じ弧の両端の間を途中の点なしで引くと弧を閉じること（足す区間は描いた区間の種類）。「流れ（描き終え）」の「計画が何も起こさない場合（同じ端点・頂点2つの線の閉じる…）」は弧を含めない旨。`planEndpointDragJoin`の弧の自分の端点どうしは閉じた計画を返すが、弧は端点のハンドルを持たないため起きないこと。
*   **3章18.（頂点の選択）**：頂点の選択で働く操作に「分割」「区間を消す」（オプションバーの分割のまとまり）を足す。モジュールの分担に`VertexTargetRules`・`PathSplitEditor`・`PathSplitRules`。
*   **3章23.・24.**：`PathCornerEditor`の対象の集め方が`core/VertexTargetRules.collectVertexTargets`になったこと（「`#collectTargets`を共有するため同じクラス」の理由の記述を直す）、`PathSegmentKindRules`の切り替える区間の判定が`PathVertexRules.selectedSegmentIndexesOf`を使うこと（結果は変わらない）。
*   **3章29.**：`PathVertexEditor.#collectTargets`が`collectVertexTargets`の呼び出しになったこと（計画で決めたこと(j)の「写し」の記述を直す）。
*   **3章 新しい節「30. 線の分割と区間の削除」**（Phase 12-02）：流れ（表示・入力）、モジュールの分担、最初の表の要約（表A・表B）、元の行を引き継ぐ1本と新しい線の並び・名前・選択、発注者の決定（REQの2026-11-26の決定：分割は頂点の選択＋オプションバー、選んだ切れる点のすべてで切る、`smooth`の近くの曲がり方が少し変わるのは許す、区間を消すは隣り合う2点＋オプションバー、新しい線は元の行のすぐ上に同じ名前、キーは割り当てない、閉じた形は点3つ以上）、計画で決めたこと（5章の項目）、確認の状況（`node --test`で確かめられない＝`OptionBarSplitGroup`・`main.js`の`// 7.17.`・`index.html`の見た目と幅）。
*   **4章の一覧と`_doc/arch/`**：新規`67_VertexTargetRules.md`（一覧の表に足す）。更新`01_index_html.md`（分割のまとまり・2行目の幅の見積もり）、`02_main.md`（`// 7.17.`の生成と注入・`performPathSplit`・`syncOptionBarSplitGroup`と起動時の同期・`syncJoinButtonState`の`viewTransform.onChange`・importの2行・行数）、`03_VectorModel.md`（`addShapesWithNewIds`・`replaceShape`・`deleteShapes`・`setSelection`の呼び出し元に`PathSplitEditor`、頂点の選択から呼んでも不変条件を崩さないこと）、`12_shapes.md`（新しい節`PathSplitRules.js`、`PathVertexRules`の2関数と使う側、`PathSegmentKindRules`のimportと区間の判定、`PathJoinRules`の`classifyJoin`・`buildClosedPath`・`endpointVertexIndexOf`の使う側）、`13_palette.md`（新しい節`OptionBarSplitGroup.js`、「ツールバーの位置づけ」の2行目のまとまりの列）、`14_edit.md`（新しい節`PathSplitEditor.js`、`PathJoiner`の`canJoin`、`PathCornerEditor`・`PathVertexEditor`の依存）、`16_test.md`（新しいテストファイル・値を変えた既存のテスト5件・件数）、`41_NudgeTargetRules.md`（使う側）、`46_ItemTreeRules.md`・`62_ItemPlaceRules.md`（使う側に`PathSplitEditor`。使う側を列挙している場合）。`main.js`の行数・テストの件数は実測して直す。

## 3. タスクリスト
※ 全タスク共通：(a) コード修正の後、JSDocの記載漏れ（新しいファイルの先頭の3行以内の責務、関数・メソッド・引数・戻り値・typedef、意味が変わった既存のJSDoc・importの記述・「`model`は…だけを使う」の記述）が無いことを確認する。(b) リポジトリのルートで`node --test`が全件合格することを確認する（既存のテストファイルは、タスク5で『要件7』に挙げた5件の値を直すほかは変更しない。ほかに値を変えざるを得ないテストが出たら中断して質問する）。(c) 本RESの「4. 詳細作業内容」の担当の欄を書き、タスクを`[x]`にする。(d) 開発資料に影響が出たら資料本体は直さず『開発資料の更新予定』欄へ追記する。(e) 既存のファイルは書き換える前に行末（CRLF／LF）を実測して保ち、新規のファイルは同じフォルダの既存のファイルに合わせる。(f) 対象ファイル以外は変更しない。

*   [x] タスク1: 頂点の選択から対象を集める手順を1か所に括る
    *   **対象ファイル** :
        *   `./js/core/VertexTargetRules.js` :（新規）
        *   `./js/edit/PathCornerEditor.js` :（更新）
        *   `./js/edit/PathVertexEditor.js` :（更新）
        *   `./test/core/VertexTargetRules.test.js` :（新規）
    *   **作業内容** :
        *   `VertexTargetRules.js`：先頭に3行以内の責務（頂点の選択から、点を対象にする編集操作へ渡す図形と頂点の番号の組を集める規則を状態を持たない関数として提供する。importは`NudgeTargetRules`のみ。DOM・`VectorModel`・履歴・図形種別・ハンドル名の形式を知らない）。`collectVertexTargets(mode, selectedIds, selectedVertices, shapes)`をJSDoc付きで作る（『要件1〜3』の仕様。戻り値のtypedef`VertexTargetPair`＝`{ shape, vertexIndex }`。`PathVertexRules.VertexTarget`・`PathCornerRules.CornerTarget`・`PathSegmentKindRules.SegmentSwitchTarget`と同じ形である旨）。
        *   `PathCornerEditor.js`・`PathVertexEditor.js`：`import { resolveNudgeTarget } from '../core/NudgeTargetRules.js';`を`import { collectVertexTargets } from '../core/VertexTargetRules.js';`に替え、`#collectTargets()`の本体を`return collectVertexTargets(this.#getMode(), this.#model.getSelectedIds(), this.#model.getSelectedVertices(), this.#model.getShapes());`だけにする（メソッド名・JSDocの戻り値は変えない）。クラスのJSDocの「依存の制約」のimportの記述を直す（`model`が使うメソッドの列は変わらない）。ほかのメソッド・ファイル先頭の責務は変えない。
        *   テスト（`VertexTargetRules.test.js`。図形は実物の`Path`・`Line`・`Curve`・`Ellipse`で作る）：`VERTEX`で頂点の選択の順に`{ shape, vertexIndex }`が並ぶ（パス・直線・今の曲線の制御点の番号1を含む）、`SELECT`・`CREATE`・`PAN`では空、`VERTEX`で頂点の選択が空なら空、図形が無い組・`getVertexIndexForHandle`が`null`の組（円のハンドル名・知らない名前）は飛ばす、同じ組が2回あれば2回並ぶ（今の手順と同じ）、引数の配列を書き換えない。`PathCornerEditor`・`PathVertexEditor`の既存のテストが変更なしで全件合格すること（ふるまいが変わらないことの確認）。

*   [x] タスク2: 選んだ点の番号と選んでいる区間の判定を1か所に括る
    *   **対象ファイル** :
        *   `./js/shapes/PathVertexRules.js` :（更新）
        *   `./js/shapes/PathSegmentKindRules.js` :（更新）
        *   `./test/shapes/PathVertexRules.select.test.js` :（新規）
    *   **作業内容** :
        *   `PathVertexRules.js`：`outlineVertexIndexOf(data, vertexIndex)`・`selectedSegmentIndexesOf(data, vertexIndexes)`をJSDoc付きでexportする（『要件1・2：判定の共有』の仕様。「輪郭の番号」「選んでいる区間」の唯一の箇所である旨と、使う側＝`PathSegmentKindRules`・`PathSplitRules`を書く）。ファイル先頭の責務を3行以内のまま「輪郭の元への読み替え（選んだ点の番号と両端の点が選ばれている区間の読み方を含む）」を含む形へ直す。今ある関数の中身は変えない。
        *   `PathSegmentKindRules.js`：`import { selectedSegmentIndexesOf } from './PathVertexRules.js';`を足し、`collectSwitchEntries`の区間の判定（`data.type === 'curve'`の分岐と`for`の分岐）を`const segmentIndexes = selectedSegmentIndexesOf(data, [...selected]);`に置き換える。`dataOf`（矩形・円・弧を対象外にする）・番号の受け付け・エントリの順は変えない。JSDoc（`collectSwitchEntries`の「切り替える区間の決め方の唯一の箇所」）を「両端の点が選ばれている区間の判定は`PathVertexRules.selectedSegmentIndexesOf`に任せる。区間の切り替えの対象（パス・直線・今の曲線。矩形は含まない）の絞り込みはここ」の趣旨に直す。
        *   テスト（`PathVertexRules.select.test.js`）：`outlineVertexIndexOf`（直線・矩形・パスは同じ番号、今の曲線0→0・1→`null`・2→1、円・弧・範囲外・整数でない値は`null`）。`selectedSegmentIndexesOf`（開いたパスの隣り合う2点・3点続き・始点と終点だけは区間なし（折り返さない）、閉じたパスの最後の点と始点＝最後の区間、矩形の隣り合う角・対角だけは空・4つの角で4区間、直線の両端、今の曲線の始点と終点＝区間0・制御点は関係しない、円・弧は空、同じ点の重複、引数を書き換えない）。「曲線に」「直線に」が変わらないこと：`resolveSegmentSwitchAvailability`・`planSegmentKindSwitch`を、今の曲線の始点と終点・閉じたパスの終点→始点の区間・開いたパスの始点と終点だけ・矩形の隣り合う角（押せない・空のまま）に当てた結果がリテラルで書いた今の値のままであること。`PathSegmentKindRules`・`PathCornerEditor`・`PathVertexRules`の既存のテストが変更なしで全件合格すること。

*   [x] タスク3: 分割の規則（ピースの組み立て）
    *   **対象ファイル** :
        *   `./js/shapes/PathSplitRules.js` :（新規）
        *   `./test/shapes/PathSplitRules.split.test.js` :（新規）
    *   **作業内容** :
        *   `PathSplitRules.js`：先頭に3行以内の責務（頂点の選択で選んだ点・区間から、線・パスの分割と区間の削除で切れる点・消える区間を決め、分かれた線（開いたパス）と元の行を引き継ぐ1本を組み立てる規則と押せるかの判定を、状態を持たない関数として提供する。モデル・履歴・選択・操作モード・名前・一覧の位置を知らない）。import（このタスクでは`Path`・`readCornerFlags`・`outlineSourceOf`・`outlineVertexIndexOf`・`endpointVertexIndexOf`。`selectedSegmentIndexesOf`はタスク4で足す）、typedef`SplitTarget`・`SplitPlanItem`・ピースの内部の形、非公開`collectEntries`・`cutPointsOf`・`buildPieces`（消える区間の引数も受ける。このタスクでは空の集合を渡す）・`orderPieces`・ピースから`Path`を作る関数、export`planSplitAtVertices(targets)`をJSDoc付きで作る（『要件1・2：分割・区間を消す』と表Aのとおり）。
        *   テスト（表Aの行ごと）：直線・今の曲線（始点・制御点・終点のどれを選んでも）・点2つの開いたパスは計画が空。開いたパスの途中の点1つ・2つ・続いた2点（間が点2つの線になる）・端の点を混ぜて選んでも数えない、閉じたパスの1点（点0・途中の点・最後の点。点`n+1`で始点と終点が同じ座標）・2点・すべての点（点2つの線が`n`本）、矩形の1点（点5つ・`line`×4・開始が切った角）・2点・4点、回した矩形。各ピースの点・`closed: false`・区間の種類と`bezier`の`control1`・`control2`の値・角（途中の点の角、端になった点の角の値も元のまま）・スタイル3つ（矩形・閉じたパスの`fillColor`の値を含む）・`id`が`null`。元の行を引き継ぐ1本（`pieces[0]`）と新しい線の並び（`start`の小さい順）：開いたパスは`[0..c1]`、閉じたパスは点0で切れば`[0..]`・点0を切らなければ折り返しのピース。複数の図形の点（`targets`に最初に現れた順・図形ごとに束ねる）、範囲外・整数でない番号・同じ点の重複は無視、`bezier`・`line`のピースの形が元の区間と同じ（多数の`t`で評価した点が一致）、`smooth`のピースは点・区間の種類が元のまま、引数を書き換えない・結果が引数と配列・点を共有しない、結果の`toJSON()`が`Path.fromJSON`で読める。

*   [ ] タスク4: 区間の削除の規則と押せるかの判定
    *   **対象ファイル** :
        *   `./js/shapes/PathSplitRules.js` :（更新）
        *   `./test/shapes/PathSplitRules.segments.test.js` :（新規）
    *   **作業内容** :
        *   `PathSplitRules.js`：importに`selectedSegmentIndexesOf`を足し、export`planSegmentDeletion(targets)`（`buildPieces`へ切る点の空の集合と選んでいる区間を渡す。ピースが空なら`pieces: []`＝図形ごと消える）と`resolveSplitAvailability(targets)`、typedef`SplitAvailability`（`palette/OptionBarSplitGroup.js`との二重定義である旨。ファイルはタスク7で作る）をJSDoc付きで足す（表Bのとおり。押せるかは計画と同じ非公開の判定を使う）。
        *   テスト（表Bの行ごと）：直線・今の曲線・点2つのパスの区間＝`pieces: []`、開いたパスの最初の区間（点0が消え`[1..]`が引き継ぐ）・最後の区間・途中の区間（2本・`[0..s]`が引き継ぐ）・続いた2区間（間の点が消える）・離れた2区間・すべての区間、閉じたパスの1区間（途中・最後の区間＝点`n−1`→点0。点`n`の開いた線）・2区間（隣り合う・離れた）・点0を挟む2区間（点0が消え、`start`の最小が引き継ぐ）・すべての区間、矩形の1辺・隣り合う2辺・向かい合う2辺・3辺・4辺・対角の2つの角だけ（計画が空）。区間の種類・引っ張る点・角・スタイル3つ・`id`が`null`・引数を書き換えない。`resolveSplitAvailability`：選択なし・切れる点なし・区間なしは両方`false`、表A・表Bの各行の押せる・押せない、`split`が真なら`planSplitAtVertices`が1件以上・偽なら空、`deleteSegments`が真なら`planSegmentDeletion`が1件以上・偽なら空（多数の選択の組で確かめる＝押せるときは必ず計画ができる）。

*   [ ] タスク5: 閉じる（弧1本・押せる見た目と結果の一致）
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` :（更新）
        *   `./js/edit/PathJoiner.js` :（更新）
        *   `./test/shapes/PathJoinRules.test.js` :（更新。『要件7』の1.〜4.の4件の値とテスト名だけ）
        *   `./test/edit/PathJoiner.test.js` :（更新。『要件7』の5.の1件の値とテスト名だけ）
        *   `./test/shapes/PathJoinRules.close.test.js` :（新規）
        *   `./test/edit/PathJoiner.close.test.js` :（新規）
    *   **作業内容** :
        *   `PathJoinRules.js`：`classifyJoin`の1本の分岐と`buildClosedPath`の受け付けを『要件5』のとおりに変え、JSDoc（`classifyJoin`の戻り値の説明・「ボタンの押せる/押せないの同期からも呼ばれる」、`buildClosedPath`の「今の曲線・弧1本は`null`」・`@returns`、`planCloseOf`・`planEndpointDragJoin`の弧の扱い、`CLOSED_MIN_POINTS`の使う側）を直す。ファイル先頭の責務の「閉じる」の括弧書きに弧1本を含める（3行以内のまま）。2本の結合・描き足し・作成途中の線の関数は変えない。
        *   `PathJoiner.js`：`canJoin()`を`planJoin(this.#selectedShapesInOrder(), this.#screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)) !== null`にし、importから`classifyJoin`を外す。クラス・`canJoin`のJSDoc（表示倍率で換算した許容距離で計画を作れるかを見る。押せるときは必ず`join`が計画を作る）を直す。ファイル先頭の責務の括弧書きの「閉じる」に弧を含める。`join()`は変えない。
        *   既存のテスト：『要件7』の1.〜5.の値とテスト名だけを直す（ほかの行は変えない）。
        *   テスト（`PathJoinRules.close.test.js`）：表Cの行ごとに`classifyJoin`・`planJoin`・`buildClosedPath`の結果（直線・今の曲線・点2つのパス＝`null`、点3つで両端が重なる開いたパス＝`classifyJoin`は`'close'`のまま・`planJoin`は`null`、点3つ以上で離れている・点4つ以上で重なるパス＝今の値のまま、弧＝点`[始点, 頂上, 終点]`・区間`bezier`・`bezier`・`line`で`bezier`の引っ張る点が`chainSourceOf(弧)`の値と同じ・`corners`なし・`closed: true`・スタイル3つ（`fillColor`の値を含む）・`isFillable()`が真・`keepId: true`、回した・左右に裏返した弧、両端の距離が許容距離以内の小さな弧＝`null`、閉じたパス・矩形・円＝`null`）、`planJoin`が`null`でないとき`classifyJoin`も`null`でない（多数の図形で）。`planDrawnLineJoin`：同じ弧の両端・途中の点なしで直線のツール＝閉じる区間`line`、曲線のツール（`drawnKindSource`が`smooth`のパス）＝`smooth`、途中の点ありは今の値のまま、同じ端点は`null`のまま。2本の結合の結果が今の値のまま（直線2本・弧と直線の代表の組）。
        *   テスト（`PathJoiner.close.test.js`）：偽の依存で、点3つの開いたパス（両端の距離4）は許容距離5で`canJoin()`が`false`・`join()`が`false`で記録先に触れない、許容距離3で両方`true`。いくつもの選択（0本・直線・今の曲線・点2つのパス・点3つで重なる・点3つ以上・弧・閉じたパス・矩形・円・2本・3本）で`canJoin()`が真のときは必ず`join()`が真、偽のときは`join()`が偽で記録先に触れない。実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`で、弧1本の`join()`が`id`・名前（「弧 1」等の元の名前）・一覧の位置・フォルダの所属を保った閉じたパスにし、取り消し1回で元の弧・やり直しで閉じたパスに戻る。実物の`EndpointSnapper`（`model.getEditableShapes()`に弧を入れた組み合わせ）で、作成途中の直線を弧の始点から終点への吸い付きで`commitDrawnLine`すると弧の`id`の閉じたパスになり履歴が1件増える（既存の`test/edit/EndpointSnapper.test.js`の組み立て方に合わせる。組み立てが重ければ`planDrawnLineJoin`の規則のテストだけにして、その旨を詳細作業内容に書く）。

*   [ ] タスク6: 分割・区間の削除の編集操作
    *   **対象ファイル** :
        *   `./js/edit/PathSplitEditor.js` :（新規）
        *   `./test/edit/PathSplitEditor.test.js` :（新規）
        *   `./test/edit/PathSplitEditor.items.test.js` :（新規）
    *   **作業内容** :
        *   先頭に3行以内の責務（頂点の選択で選んだ点・区間を対象に、線・パスの分割と区間の削除を規則（`shapes/PathSplitRules`）でそれぞれ1件の編集操作として行う手順と、押せるかの照会。DOM・操作モードの解釈・図形種別の判定・ハンドル名の形式・表示とロックの値を持たない）。クラスのJSDocに手順（『要件1〜3：1件の編集操作』の①〜④）・表示とロックを渡さない理由・入る場所の順・通知の回数・依存の制約（importの4つ、`model`の10メソッド、`editRecorder`の2メソッド、`try/catch`・再描画なし）・前提（ドラッグ中でないことは`main.js`が判定する）を書く。`constructor`・`getAvailability`・`splitAtSelectedVertices`・`deleteSelectedSegments`・非公開`#collectTargets`・`#apply`をJSDoc付きで作る。
        *   テスト（`PathSplitEditor.test.js`。実物の`VectorModel`・図形クラスと、呼び出しを記録する偽の記録先）：`getAvailability`（選択（`V`）のモード・点なし・端の点だけ・途中の点・区間ありの各組）。分割：開いたパスの途中の点で2本（元の`id`・名前・位置が`[0..c]`、新しい線が元の行のすぐ上で同じ名前・新しい`id`）、途中の点2つで3本（後の線ほど上）、閉じたパス・矩形の1点で同じ`id`の開いた線1本（新しい行なし）、フォルダの中の図形で新しい線も同じフォルダ、複数の図形の点をまとめて切る（記録先が`beginEdit`・`commitEdit`の1組）。区間の削除：2本に分かれる、片方が点1つで消える、直線の両端で図形ごと消える（入っていたフォルダは空で残る）、複数の図形にまたがる。どの操作も、操作の後は元の選択（消えた図形を除く）と新しい線が選ばれ頂点の選択は空、計画が空なら`false`で記録先・モデルに触れない（通知0回）、ロックした図形・隠した図形（上のフォルダから受け継いだものを含む）の点は頂点の選択に入らず対象にならない、新しい線は表示・ロックが元と同じ（変えられる）。
        *   テスト（`PathSplitEditor.items.test.js`。実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`DocumentSerializer`）：分割・区間の削除がそれぞれ取り消し1回で元の図形・名前・並び・フォルダ・選択に戻り（頂点の選択は外れる）、やり直しで操作の後に戻る。複数の図形をまとめて切った・消したときも1回で戻る。図形ごと消えて空になったフォルダが残り、取り消しで図形が戻る。何も変わらないときは履歴に入らない。作業データ（`DocumentSerializer`の往復）で結果の`path`・名前・並びが保たれ`version`が4のまま。Phase 12-01の点の追加・削除（`PathVertexEditor`）を同じモデルで続けて使っても結果が今のまま（分割した線に点を足す・消す）。

*   [ ] タスク7: ボタンと配線（`palette/`・`index.html`・`main.js`）
    *   **対象ファイル** :
        *   `./js/palette/OptionBarSplitGroup.js` :（新規）
        *   `./index.html` :（更新）
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `OptionBarSplitGroup.js`：先頭に3行以内の責務（オプションバーの「分割」のまとまり（`#option-split-group`）の「分割」「区間を消す」のボタンの押せる・押せないの表示と、操作のコールバックへの通知を担う。判定・選択状態には関与しない。DOM操作専任）。typedef`SplitAvailability`（`shapes/PathSplitRules.js`との二重定義である旨）・`OptionBarSplitGroupActions`、クラス`OptionBarSplitGroup`（`constructor`・`render`。『要件4』のとおり。importなし）をJSDoc付きで作る。
        *   `index.html`：`#option-corner-group`の`</div>`の直後に『要件4』の`#option-split-group`と2つのボタンを足す。幅の見積もりのコメントの2行目を直す（約1111px）。ほかのマークアップ・CSSは変えない。
        *   `main.js`：importに`PathSplitEditor`・`OptionBarSplitGroup`を足す。`// 6.`の`model.onChange(syncJoinButtonState);`の後に`viewTransform.onChange(syncJoinButtonState);`を足し、`syncJoinButtonState`のJSDoc（表示倍率で換算した許容距離で結合の計画を作れるかに同期する。`model.onChange`と`viewTransform.onChange`に登録する）と近くのコメントを直す。`// 7.16.`の後に『要件4』の`// 7.17.`のブロック（`pathSplitEditor`・`performPathSplit`（JSDoc付き。ドラッグ中は不受理で`false`）・`optionBarSplitGroup`・`syncOptionBarSplitGroup`（JSDoc付き）・`model.onChange(syncOptionBarSplitGroup)`）を足し、判定・計算を書かない旨の説明コメントを付ける。起動時の明示の同期の列の`syncOptionBarCornerGroup();`の後に`syncOptionBarSplitGroup();`とその説明コメントを足す。行数を実測して『開発資料の更新予定』へ書く。
        *   テスト：このタスクでは足さない（DOMと配線は`node --test`の対象外。判定はタスク4、手順はタスク6で確かめている。既存の全件合格だけを確かめる）。

*   [ ] タスク8: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
    *   **作業内容** :
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、この最終タスクのみ明示的な例外とする。
        *   『開発資料の更新予定』を確認し、1章（構成図・依存方向の列挙・「存在しないもの」・「フォルダ分割の方針」）、2章（`path`の分割・区間の削除の規則、「作られるのは次のとき」の列）、3章（2.の同期の経路・6.履歴・11.結合の1本のときの規則と押せる条件・12.の線を引いて閉じる経路・18.頂点の選択・23.・24.・29.の対象の集め方・新しい節30.）、4章の一覧（`67_VertexTargetRules.md`）へ反映する。書く内容は実コードで確かめる。「弧1本は閉じない」「同じ弧の両端の間を途中の点なしで引いても何も起きない」「`canJoin`は表示倍率を見ない」「パスの分割は存在しない」「閉じたパスを開くはやらない」「`#collectTargets`の写し」という古い記述を残さない。書き換える前に行末を実測して保つ。

*   [ ] タスク9: 開発資料の反映（`_doc/arch/`）
    *   **対象ファイル** :
        *   `./_doc/arch/`の`01_index_html.md`・`02_main.md`・`03_VectorModel.md`・`12_shapes.md`・`13_palette.md`・`14_edit.md`・`16_test.md`・`41_NudgeTargetRules.md`（と、使う側を列挙していれば`46_ItemTreeRules.md`・`62_ItemPlaceRules.md`） :（更新）
        *   `./_doc/arch/67_VertexTargetRules.md` :（新規）
    *   **作業内容** :
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、この最終タスクのみ明示的な例外とする。
        *   『開発資料の更新予定』を確認して反映する。`main.js`の行数（`02`）とテストの件数（`16`。tests・suites・テストファイルの数、作業前は tests 3801 / suites 631 / 144ファイル）は`wc -l`・`node --test`で実測して直す。値を変えた既存のテスト5件を`16_test.md`に記す。書き換える前に各ファイルの行末（CRLF／LF）を実測し、保つ（ファイルごとに混在している）。新規の`67_VertexTargetRules.md`は近い番号の既存のファイル（`66_VertexEditRules.md`）の書き方・行末に合わせる。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 頂点の選択から対象を集める手順を1か所に括る
*   **作業内容** :
    *   `js/core/VertexTargetRules.js`を新規作成（`collectVertexTargets(mode, selectedIds, selectedVertices, shapes)`・typedef`VertexTargetPair`。importは`NudgeTargetRules`のみ）。
    *   `PathCornerEditor`・`PathVertexEditor`のimportを`collectVertexTargets`へ替え、`#collectTargets()`を呼び出し1行にした。クラスJSDocの「依存の制約」のimport記述も直した。ふるまいは変えていない（既存のテストは変更なしで全件合格）。
    *   `test/core/VertexTargetRules.test.js`を新規作成（6件。順序・非VERTEXモードで空・選択空・飛ばす組・重複・引数を書き換えない）。
    *   `node --test`：3807件すべて合格。行末は既存のファイルのまま（`PathVertexEditor.js`はCRLF、ほかはLF）。

### タスク2: 選んだ点の番号と選んでいる区間の判定を1か所に括る
*   **作業内容** :
    *   `js/shapes/PathVertexRules.js`：`outlineVertexIndexOf(data, vertexIndex)`・`selectedSegmentIndexesOf(data, vertexIndexes)`をJSDoc付きでexport（今ある関数の中身は変えていない）。先頭の責務は、監査check1の指摘（追加仕様）に従い、輪郭の元への読み替え（選んだ点の番号と、両端の点が選ばれている区間の読み方を含む。`PathSegmentKindRules`・`PathSplitRules`へ渡す共有の箇所）を、頂点の追加・削除の規則と並ぶ項目として2行で書き直した。
    *   `js/shapes/PathSegmentKindRules.js`：`selectedSegmentIndexesOf`をimportし、`collectSwitchEntries`の区間の判定を`selectedSegmentIndexesOf(data, [...selected])`の1行に置き換えた。`dataOf`（矩形・円・弧を対象外）・番号の受け付け・エントリの順は変えていない。JSDocを新しい分担（判定は`PathVertexRules`、対象の絞り込みはここ）に直した。
    *   `test/shapes/PathVertexRules.select.test.js`を新規作成（`outlineVertexIndexOf`3件・`selectedSegmentIndexesOf`7件・「曲線に」「直線に」が変わらないこと5件）。
    *   `node --test`：3822件すべて合格（既存のテストは変更なし）。行末は2つの既存ファイルともLFのまま。
    *   diff監査の修正：`PathVertexRules.js`先頭の責務2行目を「…表示倍率を知らず、ワールド座標の許容幅を引数で受け取る。」に戻した（3行以内、行末LFのまま）。

### タスク3: 分割の規則（ピースの組み立て）
*   **作業内容** :
    *   `js/shapes/PathSplitRules.js`を新規作成（先頭の責務3行以内）。typedef`SplitTarget`・`SplitPlanItem`・非公開の`SplitEntry`・`Piece`、非公開`collectEntries`・`cutPointsOf`（開いた線の端は`endpointVertexIndexOf`と図形の番号で比べる）・`buildPieces(source, cutPoints, removedSegments)`（消える区間も扱う一般形。このタスクでは空の`Set`を渡す）・`orderPieces`・`pieceToPath`、export`planSplitAtVertices(targets)`。importは`Path`・`readCornerFlags`・`outlineSourceOf`・`outlineVertexIndexOf`・`endpointVertexIndexOf`（`selectedSegmentIndexesOf`・`SplitAvailability`・`resolveSplitAvailability`・`planSegmentDeletion`はタスク4）。
    *   `test/shapes/PathSplitRules.split.test.js`を新規作成（20件。表Aの行：切れない図形・開いたパス・閉じたパス・矩形・複数の図形・引数を書き換えない）。
    *   `node --test`：3842件すべて合格（既存のテストは変更なし）。新規ファイルの行末はLF。

### タスク4: 区間の削除の規則と押せるかの判定
*   **作業内容** :
    *   (未記入)

### タスク5: 閉じる（弧1本・押せる見た目と結果の一致）
*   **作業内容** :
    *   (未記入)

### タスク6: 分割・区間の削除の編集操作
*   **作業内容** :
    *   (未記入)

### タスク7: ボタンと配線（`palette/`・`index.html`・`main.js`）
*   **作業内容** :
    *   (未記入)

### タスク8: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
*   **作業内容** :
    *   (未記入)

### タスク9: 開発資料の反映（`_doc/arch/`）
*   **作業内容** :
    *   (未記入)

## 5. 懸念事項・要確認ポイント
*   **計画で決めたこと（REQの文言から一意に決まらなかった点。発注者の確認を推奨）**：
    *   **操作の後の選択**：REQは「残った線がすべて選ばれ、頂点の選択は空」。分割・区間の削除に関わらなかった図形も選んでいた場合は、それらも選ばれたままにする（元の選択から消えた図形を除き、新しくできた線を足す。Phase 12-01の点の削除の「残った図形は選ばれたまま」と同じ）。選んでいたフォルダも保つ。
    *   **新しい線の並び（閉じた形）**：「元の点の並びで後の線ほど上」を、ピースの最初の点の番号（`start`）の小さい順と読んだ。閉じたパスで点0を切らないとき、元の行を引き継ぐのは点0を含む折り返しのピースで、新しい線は`start`の小さい順に下から並ぶ。
    *   **元の始点が1点だけになって消えるときの引き継ぎ**：「残ったもののうち元の点の並びで最初の1本」を、`start`のいちばん小さいピースと読んだ（点0を含むピースが無いとき）。
    *   **端になった点の角**：切った点・端になった点の`corners`の値は元のまま写す（端の点では形に効かない。Phase 12-01の点の削除と同じ。`J`で閉じ直すと`chainOf`が端の点の角を偽にする今の規則のため、角だった切った点は閉じ直すとなめらかな点になる）。
    *   **新しい線の表示・ロック**：値を読まずに補う値（表示・ロックなし）にする。対象は必ず変えられる図形のため、元の行の値と同じになる（『要件1〜3：1件の編集操作』）。
    *   **ボタンの記号**：「分割」`✂`・「区間を消す」`✕`（どちらも仮）。置き場所は角のまとまりのすぐ右の新しいまとまり。
    *   **選んだ点を図形ごとに束ねる手順の写し**：`PathSplitRules`の非公開`collectEntries`の「選んだ点を図形のオブジェクトで束ね（最初に現れた順）、番号を0以上・点の数未満の整数に絞る」手順は、`PathVertexRules.planVertexRemoval`（`js/shapes/PathVertexRules.js:427-442`）・`PathSegmentKindRules.collectSwitchEntries`（`js/shapes/PathSegmentKindRules.js:76-86`）に続く3つ目の写しになる（REQの「写しを作らない4項目」には入っていない）。承知のうえで残し、括らない。理由：(1)共有できるのは束ねる10行ほどで、対象にする図形の種類（点の削除・分割＝`line`・`rect`・`curve`・`path`、区間の切り替え＝`rect`を含まない）・データの読み方（`collectSwitchEntries`は`dataOf`の使い回し先を通し、有効な番号が無い図形もエントリに残す）・束ねた後の使い方（番号のまま使う／輪郭の番号へ読み替える）が3か所で違い、括ると分岐を引数で渡す形になる。(2)括るとPhase 12-01の2つの手順を書き換えることになり、今回のスコープが広がる。番号を輪郭の番号・選んでいる区間へ読み替える判定は`outlineVertexIndexOf`・`selectedSegmentIndexesOf`の1か所に括るため、写しが判定の食い違いを生まない。4つ目が要るときに括り直しを検討する。
*   **既存のテストの値を変えるもの**：『要件7』の5件（弧1本の`classifyJoin`・`buildClosedPath`／`planJoin`・同じ弧の両端の`planDrawnLineJoin`・弧の自分の端点どうしの`planEndpointDragJoin`・`PathJoiner`の弧1本の`canJoin`／`join`）。4件目（`planEndpointDragJoin`）は弧が端点のハンドルを持たないため実際の操作では起きない入力で、`planDrawnLineJoin`と共有する`planCloseOf`の結果が変わることによる。
*   **結合のボタンが表示倍率で変わる**：点3つの開いたパスの両端の距離が画面上5pxをまたぐと、ズームだけで押せる・押せないが変わる（`viewTransform.onChange`で同期するため見た目と`J`の結果は一致する）。小さな弧（両端の距離が画面上5px以内）も同じ。
*   **「閉じようとしても何も起きない形」（`_doc/COWORK_STATUS.md` 2章A）の解消の見込み**：(1)頂点3つで両端が重なった開いた線＝ボタンが押せない見た目になり、「押せるのに何も起きない」は解消（閉じられないのは発注者の決定どおり。点を1つ足せば閉じられる）。(2)今の曲線と直線の半月形・今の曲線2本のレンズ形＝2本の結合は今のまま成功し、結果の線は(1)の形のためボタンが押せない見た目になる（同じく解消。点を足せば閉じられる）。(3)同じ弧の両端の間を途中の点なしで引く＝閉じるようになり解消。`_doc/COWORK_STATUS.md`は実装AIが書き換えない。
*   **切った点のドラッグ**：分割した直後は切った点の位置に2本の線の端の点が重なっている。頂点の選択でその点を押すと手前（新しい線）の端の点が選ばれ（ハンドルは手前優先）、少しだけドラッグして離すと、もう一方の線の端点へ吸い付いて（画面上8px以内）結合し直る（今の端点への吸い付きのふるまい。変えない）。離したまま動かしたいときは8pxより遠くへ動かすか、`Ctrl`を押したままドラッグする（`Ctrl`の間は吸い付かない）。
*   **`smooth`の区間の形**：分割・区間の削除で端になった点の隣の`smooth`の区間は、点を通る曲線の式で端の仮の点を使うようになるため曲がり方が少し変わる（REQで許容）。テストプレイの確認項目4で見てほしい。
*   **`VectorModel`のJSDocの前提**：`replaceShape`・`addShapesWithNewIds`のJSDocの「呼び出し側が選択モードであること」は古い（不変条件は「選択モード・頂点の選択モード以外では空」）。`VectorModel.js`は今回の変更対象ではないため直さず、資料（`03_VectorModel.md`）に正しい記述を残す。
*   **通知の回数**：分割・区間の削除の1回の操作で`model.onChange`が複数回出る（`replaceShape`・`addShapesWithNewIds`が図形ごと、`deleteShapes`・`setSelection`が1回ずつ）。途中の通知でも状態は正しく、取り消しは1件（`PathCornerEditor`と同じ考え方）。
*   **確認の状況**：`OptionBarSplitGroup`（DOM）・`main.js`の`// 7.17.`・`viewTransform.onChange`への登録・`index.html`の見た目と1280px幅での収まり（見積もり約1111px）は`node --test`で確かめられない（テストプレイで確かめる範囲）。

### テストプレイの確認項目（発注者がブラウザで確かめる手順）
0.  **準備**：画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。直線のツールの折れ線（点5つほど。クリックで点を打ち、最後は`Esc`で終える）・曲線のツールの曲線（点4つほど）・塗った閉じたパス（直線のツールで始点をクリックして閉じ、塗りを付ける）・塗った矩形・弧を、フォルダの中にも外にも描き、一覧で名前を付けておく。2点だけの直線（直線のツールで2回クリック）も1本描く。
1.  **分割（開いた線）**：頂点の選択（`A`）で折れ線の線の上をクリックして選び（点が出る）、途中の点をクリックして選び、オプションバー2行目の右端の「分割」（✂）を押すと2本になる。一覧では新しい線が元の行のすぐ上に同じ名前で入る。2本とも選ばれている（両方の点が出ている）。形は変わらない。途中の点を2つ（2つ目は`Ctrl`+クリック）選ぶと3本になり、一覧では後の線ほど上に並ぶ。端の点だけを選んでいるときは「分割」は押せない見た目。2点の直線の点・曲線の端の点だけでも押せない。
2.  **分割（閉じた形）**：塗った閉じたパス・矩形の点を1つ選んで「分割」を押すと、その点で開いた線になる（塗りが消える。一覧の行は増えない）。そのまま`J`（または🔗）を押すと閉じ直り、塗りが戻る。点を2つ選んで「分割」を押すと2本に分かれる。
3.  **区間を消す**：折れ線の隣り合う2点（クリック＋`Ctrl`+クリック）を選んで「区間を消す」（✕）を押すと、その間が消えて2本に分かれる。最初の2点を選んで押すと、端の1点だけの側は消えて1本が残る。閉じたパス・矩形の隣り合う2点で押すと、その辺が消えて開いた線になる。2点の直線の両端を選んで押すと直線ごと消える（一覧からも消える。フォルダの中なら、フォルダは空のまま残る）。隣り合っていない2点（矩形の対角など）だけを選んでいるときは押せない見た目。
4.  **曲線**：曲線のツールの曲線を分割・区間を消しても、切った所の近くの曲がり方が少し変わるほかは形が変わらない。
5.  **閉じる**：選択（`V`）で開いた折れ線を選んで`J`を押すと、最後の点から始点への直線で閉じる（一覧の名前・位置は変わらない）。弧を選んで`J`を押すと半月形の閉じた形になる（一覧の名前は「弧 n」のまま。塗りの色を付けておけば塗りが現れる）。別の弧を描き、直線のツールで弧の一方の端（青い四角が出る所）をクリックし、途中に点を打たずにもう一方の端（青い四角）をクリックしても閉じる。2点の直線や、分割・区間の削除でできた点2つの線を1本選んでいるときは結合のボタン（🔗）が押せない見た目で、`J`を押しても何も起きない。点3つで両端が重なった線（直線のツールで点を2つ打ち、3つ目を1つ目の点にほぼ重ねて打って`Esc`で終える）も、ボタンが押せない見た目で`J`で何も起きない（重ねた点がわずかにずれているときは、拡大して両端が画面上で5pxより離れて見えると押せる見た目になり、`J`で閉じる。点を1つ足せば（線の上をダブルクリック）どの倍率でも閉じられる）。
6.  **取り消し**：分割・区間の削除・閉じる（`J`・弧の両端を結ぶ線）は、それぞれ`Ctrl`+`Z` 1回で元に戻り（一覧の行・名前・並びも戻る）、`Ctrl`+`Y`（または`Ctrl`+`Shift`+`Z`）でやり直せる。複数の図形の点をまとめて切った・消したときも1回で戻る。取り消した後は点の選択が外れる（図形は選ばれたまま）。
7.  **ロック・非表示**：一覧の鍵でロックした図形・目で隠した図形は、キャンバスのクリックでは選べず（後ろの図形か空白の扱い）、一覧の行から選んでも点が出ないため、「分割」「区間を消す」は押せない見た目のまま。
8.  **保存**：分割・区間の削除・閉じた結果が、ページを開き直しても（自動保存）、作業データの出力→開くでも保たれる。書き出したJSを確認用ページ（`sprite-check.html`）で見ても同じ形。
9.  **ほかが今までどおり**：2本の結合（`J`）・直線・曲線のツールでの端点への吸い付きと描き足し・点の追加（頂点の選択で線の上をダブルクリック）と削除（点を選んで`Delete`）・「曲線に」「直線に」「角」が今までどおり動く。
    *   注意：分割した直後、切った点には2本の線の端の点が重なっている。その点を押して少しだけ（画面上8px以内）ドラッグして離すと、重なっていたもう一方の端へ吸い付いて結合し直る（今の端点への吸い付き）。離したまま動かすときは8pxより遠くへ動かすか、`Ctrl`を押したままドラッグする。
    *   注意：オプションバー2行目の右端に「分割」のまとまりが増える。1280px幅の画面で2行目が切れずに見えることを確かめてほしい。
