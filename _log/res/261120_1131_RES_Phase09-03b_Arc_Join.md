# RES: 作業計画・作業レポート (Phase 09-03b) : 弧の結合
* 参照元REQ: `./_log/req/261120_1122_REQ_Phase09-03b_Arc_Join.md`

## 1. 作業目的
弧（`type: 'arc'`。`shapes/Ellipse.js`。軸に沿った楕円の上半分）を、直線・開いたパス・今の曲線と同じように端点で結合できる線にする。結合のボタン（ツールバー）・`J`・ほかの線の端点のドラッグでの吸い付き・直線／曲線のツールでのつながる・伸ばすのすべてで、弧の左端（始点）・右端（終点）が端点として働く。結合すると弧の部分はパスの曲がり方を持つ区間`'bezier'`2つ（頂点は左端・頂上・右端の3つ）になり、形は楕円の4分の1を3次ベジェ1つで表す標準の近似（ずれは半径の約0.03%以内）で元の弧とほぼ同じになる。

最上位の要件：`node --test`が全件通る（作業前 tests 2002 / suites 322。既存のケースの期待値は変えない。「弧は結合できない・吸い付かない」ことを確かめているケースだけを、下の要件Dの一覧どおり書き換える）。弧を結合しない限り、作業データ・描画・当たり判定・書き出しの結果は今と同じ（結合していない弧の描画・書き出しの`ellipse`・当たり判定、今の曲線・直線・パスの結合の結果を含む）。作業データの版2・書き出しの版3・区間の種類・図形データのキー・共通メソッド契約（18メソッド）・`KeyboardShortcuts.js`の対応表・公開の名前は変えない。

## 2. アーキテクチャ設計
### 全体の方針
* **変えるソースは`js/shapes/PathJoinRules.js`・`js/shapes/EndpointSnapRules.js`の2つ（コード）と、`js/edit/PathJoiner.js`（先頭の責務定義のJSDocだけ）**。`Ellipse`・`Path`・`PathCornerRules`・`PathSegmentKindRules`・`ShapeGeometry`、`edit/`（`PathJoiner`のJSDoc以外）・`core/`・`io/`・`palette/`・`main.js`・`index.html`はコードを変えない（要件Cで経路を確かめた）。
* **弧から区間への変換は今の曲線と同じ1か所**：`PathJoinRules`の非公開`chainSourceOf`に弧の分岐を足し、弧を「頂点3つ（左端・頂上・右端）と`'bezier'`の区間2つの開いたパス」の図形データに読み替える。楕円の4分の1の近似の式と係数`k`は新しい非公開の`arcChainSourceOf`と定数`QUARTER_ELLIPSE_BEZIER_K`の1か所だけに置く。結合・描き足し・閉じる・端点のドラッグ・ツールのつながるは、どれも今の`chainOf`（→`chainSourceOf`）を通るため、弧の変換を別々に書かない。
* **端点の読み方を1か所にする**：結合できる線の端点＝`chainSourceOf`で読み替えた頂点の並びの先頭（`'start'`）・末尾（`'end'`）。これを外から読む公開の関数`lineEndpointOf(data, end)`と、端点のハンドルの判定に使う頂点の番号の読み方`endpointVertexIndexOf(data, end)`を`PathJoinRules`に新設し、`toJSON().points`の先頭・末尾を結合できる線の端点として直接読む箇所を残さない。
* **結合できる線の判定は`isJoinableLine`の1か所**：弧（`type === 'arc'`）を足す。円は足さない。続けて引く線の形`isDrawnLineShape`は変えない。`classifyJoin`の2本の受け付けは図形種別の列挙（`typeOk`）をやめて`isJoinableLine`に任せる（実コードで同じ結果になることを確かめた。要件A）。
* 依存方向は今のまま（`edit/EndpointSnapper → shapes/EndpointSnapRules → shapes/PathJoinRules → shapes/Line・Path`）。新しいファイル・新しいimportの向きは無い（`EndpointSnapRules`が`PathJoinRules`から読む名前が2つ増えるだけ）。

### 要件A: 弧を結合できる線にし、区間として読む（`js/shapes/PathJoinRules.js`）
* **ファイル先頭の責務定義**（3行以内のまま）：「結合できる線＝直線・開いたパス（区間の種類によらない）・今の曲線」に弧を足す（「結合できる線＝直線・開いたパス（区間の種類によらない）・今の曲線・弧」）。ほかの文は変えない。
* **定数`QUARTER_ELLIPSE_BEZIER_K`（非公開。新設）**：`const QUARTER_ELLIPSE_BEZIER_K = 4 * (Math.SQRT2 - 1) / 3;`。JSDoc：楕円の4分の1を3次ベジェ1つで表す標準の係数の唯一の定義箇所。両端の点と中点（`t = 0.5`）が楕円の上にちょうど乗り、両端の接線の向きが楕円と同じ。円に対するずれは外側へ最大で半径の約0.027%（楕円は円を軸ごとに伸ばした形のため、横・縦の半径で割った比で同じ割合）。置き場所は既存の定数（`JOIN_GAP_SEGMENT_KIND`）の後。
* **typedef`EndpointRef`**：`end`の説明を「'start'＝始点／'end'＝終点（結合できる線として読んだ頂点の並び＝`chainSourceOf`の結果の先頭／末尾。直線・パスは`points`の先頭／末尾、今の曲線は始点／終点、弧は左端／右端）」に直す。プロパティ名・形は変えない。
* **`isDrawnLineShape`**：コードは変えない。JSDocの「結合できる線（`isJoinableLine`）はこの形に今の曲線を足した条件（Phase 09-03a。今の曲線はこの関数では偽のまま）」を「今の曲線・弧を足した条件（Phase 09-03a・09-03b。今の曲線・弧はこの関数では偽のまま）」に直す。
* **`isJoinableLine`**：`return isDrawnLineShape(shape) || shape.type === 'curve' || shape.type === 'arc';`。JSDoc：直線・開いたパス・今の曲線（09-03a）・弧（Phase 09-03bで足した。円は含めない）。「弧の結合（Phase 09-03b）で結合できる線を広げるときはこの関数だけを変える」を「結合できる線を広げるときはこの関数だけを変える（Phase 09-03bで弧を足した）」に直す。`isDrawnLineShape(arc)`は`type`だけを見て偽を返し`toJSON()`を呼ばないため、弧でも`toJSON()`を呼ばずに真を返す。
* **`chainSourceOf(data)`（非公開。今の関数に分岐を1つ足す）**：先頭に`if (data.type === 'arc') return arcChainSourceOf(data);`を足す。今の曲線の分岐（2次→3次の式）・それ以外の図形をそのまま返す処理は変えない。JSDocの1行目を「今の曲線・弧を区間として読む（非公開。今の曲線・弧から区間への変換の唯一の箇所。2次から3次への変換の式はここ、楕円の4分の1の近似の式は`arcChainSourceOf`）」に直し、「弧なら`arcChainSourceOf`の結果（頂点3つと曲がり方を持つ区間2つの開いたパス）」を足す。
* **`arcChainSourceOf(data)`（非公開。新設。`chainSourceOf`の直後）**：弧の`toJSON()`の値を開いたパスの図形データに読み替える。楕円の4分の1の近似の式の唯一の箇所。
  * 読み方は弧の`points`の約束だけ：`[center, right, top] = data.points`（`[0]`中心・`[1]`右端の制御点・`[2]`上端の制御点）、`xc = center.x`・`yc = center.y`、**半径は`Ellipse`の描画と同じ求め方**`rx = Math.abs(right.x - xc)`・`ry = Math.abs(top.y - yc)`。`points[3]`・`[4]`（開始角・終了角の制御点）・`Ellipse`の内部プロパティ・`startAngle`等は読まない（`fromJSON`で`[3]`・`[4]`が正準の位置でない弧でも、描画と同じ形になる）。
  * `kx = QUARTER_ELLIPSE_BEZIER_K * rx`・`ky = QUARTER_ELLIPSE_BEZIER_K * ry`として、戻り値は`{ type: 'path', points: [{ x: xc - rx, y: yc }, { x: xc, y: yc - ry }, { x: xc + rx, y: yc }], closed: false, segments: [{ kind: SEGMENT_KIND_BEZIER, control1: { x: xc - rx, y: yc - ky }, control2: { x: xc - kx, y: yc - ry } }, { kind: SEGMENT_KIND_BEZIER, control1: { x: xc + kx, y: yc - ry }, control2: { x: xc + rx, y: yc - ky } }], strokeColor: data.strokeColor, strokeWidth: data.strokeWidth, fillColor: data.fillColor }`（`corners`なし）。
  * JSDocに書くこと：弧の描く向き（左端π→頂上3π/2→右端2π）と同じ並び＝始点が左端・終点が右端／頂上で2つに分けた楕円の4分の1ずつ／両端と頂上の点は弧の上にちょうど乗り、そこでの接線の向きも弧と同じ（左端・右端は縦、頂上は横）／ずれは半径の約0.03%以内（`QUARTER_ELLIPSE_BEZIER_K`）／半径が0の弧（点・線分に縮んだ弧）も同じ式で、縮んだ形（今の描画と同じ）になる／スタイル3つは元の値／引数を書き換えない。
* **`lineEndpointOf(data, end)`（公開。新設。`chainOf`の直後）**：結合できる線の端点の座標を返す。端点の読み方の唯一の箇所（外から読む入口）。`const points = chainSourceOf(data).points; const p = end === 'end' ? points[points.length - 1] : points[0]; return { x: p.x, y: p.y };`（新しいオブジェクト）。JSDoc：`chainSourceOf`で読み替えた頂点の並びの先頭（`'start'`）・末尾（`'end'`）。直線・パスは`points`の先頭・末尾、今の曲線は始点・終点、弧は左端・右端（弧の`points`の先頭の中心・末尾の終了角の制御点ではない）。結合できる線の`toJSON()`の値を渡す。使う側は`PathJoinRules`の中（`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`）と`EndpointSnapRules`（`findNearestEndpoint`）。引数を書き換えない。
* **`endpointVertexIndexOf(data, end)`（公開。新設。`lineEndpointOf`の直後）**：結合できる線の端点が図形データの何番目の頂点か（`getVertexIndexForHandle`が返す番号＝`points[i]`の`i`）を返す。端点のハンドルの判定（`EndpointSnapRules.resolveEndpointHandle`）の頂点の番号の読み方の唯一の箇所。`if (data.type === 'arc') return null; return end === 'end' ? data.points.length - 1 : 0;`。JSDoc：直線・パスは0／`points.length - 1`、今の曲線は0／2（制御点の番号1は端点でない）。**弧は`null`**（弧の端は`chainSourceOf`が中心と半径から求めた点で、弧のハンドル（`'left'`・`'right'`・`'up'`・`'down'`・`'move'`）は半径の編集のハンドルであり端点のハンドルではない＝発注者の決定。`getVertexIndexForHandle`の対応は弧のために変えない）。結合できる線の`toJSON()`の値を渡す。引数を書き換えない。
* **`chainOf`**：コードは変えない。JSDocの引数の説明「開いた線か今の曲線の`toJSON()`の値」を「開いた線・今の曲線・弧の`toJSON()`の値」に、「今の曲線は`chainSourceOf`で曲がり方を持つ区間1つの開いたパスとして読む（今の曲線を区間として読むのはここを通る）」を「今の曲線・弧は`chainSourceOf`で曲がり方を持つ区間の開いたパスとして読む（今の曲線・弧を区間として読むのはここを通る）」に直す。
* **`segmentSpecsOf`**：コードは変えない。JSDocの「今の曲線は`chainSourceOf`を通してから渡す」を「今の曲線・弧は…」に直す。
* **`classifyJoin`**：2本の分岐を`const [a, b] = shapes; return isJoinableLine(a) && isJoinableLine(b) ? 'join' : null;`にする（`typeOk`の行と`if (!typeOk(a) || !typeOk(b)) return null;`を消す）。理由：`typeOk`（`'line'`・`'path'`・`'curve'`の列挙）は`isJoinableLine`と別に図形種別を列挙しており、弧のために列挙を増やすと判定が2か所になるため。**結果は今の図形で同じ**：`isJoinableLine`は`'line'`・`'path'`・`'curve'`以外（矩形・円・弧）を`type`だけで判定し`toJSON()`を呼ばない（`typeOk`と同じ負荷）、閉じたパスは`typeOk`を通った後も`isJoinableLine`で偽になっていた。1本の分岐（`type !== 'path'`ならnull）は変えない＝弧1本は閉じない（結合のボタンは押せず`J`も何もしない）。JSDocの「負荷回避のため、図形の数 → `type` → `toJSON()` の順に判定し…」を「図形の数 → `isJoinableLine`（`type`を先に見て、パスのときだけ`toJSON()`を呼ぶ）の順に判定し…」に、戻り値の説明の「今の曲線1本は閉じない」を「今の曲線・弧1本は閉じない」、「結合できる線2本（今の曲線を含む）」を「（今の曲線・弧を含む）」に直す。
* **`buildJoinedPath`**：Aの端点の読み方だけを変える。`const A = dataA.points;`・`const aStart = A[0];`・`const aEnd = A[A.length - 1];`を`const aStart = lineEndpointOf(dataA, 'start');`・`const aEnd = lineEndpointOf(dataA, 'end');`にする（`A`の変数はほかで使っていないため消える）。Bは今どおり`chainOf(b.toJSON())`の並びの先頭・末尾（`chainSourceOf`の結果と同じ並び）から読む。直線・パス・今の曲線では同じ座標になるため結果は今と同じ。JSDocに「端点は`lineEndpointOf`（Bは`chainOf`の並び）で読む（弧は左端・右端）」を足す。
* **`buildJoinedPathAt`**：`const A = dataA.points;`と`const pa = aEnd === 'end' ? A[A.length - 1] : A[0];`を`const pa = lineEndpointOf(dataA, aEnd);`にする。Bの`pb`は今どおり`chainOf`の並びから読む。
* **`buildExtendedPath`**：`const A = dataA.points;`と`const p = end === 'end' ? A[A.length - 1] : A[0];`を`const p = lineEndpointOf(dataA, end);`にする。
* **`buildClosedPath`・`canCloseByMergingEnds`**：コードは変えない（どちらも`type !== 'path'`で弧は`null`／偽。`buildClosedPath`は`chainOf`の並びを読み、`canCloseByMergingEnds`は頂点の数だけを読むため、結合できる線の端点を`toJSON().points`から読む箇所ではない）。`buildClosedPath`のJSDocに「今の曲線・弧1本は`null`（`type`が`'path'`でない）」を足す。
* **変えないで働く関数（実コードで確かめた）**：`assembleOpenPath`（`aChain = chainOf(dataA)`で弧も3頂点・2区間として並ぶ）・`reverseChain`・`reverseSegmentSpec`（弧の2つの曲がり方を持つ区間を逆順にし引っ張る点を入れ替える）・`planJoin`・`planJoinAt`・`planCloseOf`（弧は`buildClosedPath`で`null`）・`extendWithPoints`（1点目の`buildExtendedPath`で弧がパスになり、以降はパス）・`planCloseWithPoints`・`planJoinWithPoints`・`planDrawnLineJoin`・`planEndpointDragJoin`。作成途中の線の関数（`addDrawnPoint`・`removeLastDrawnPoint`・`buildFinishedDrawnLine`・`getLastDrawnPoint`・`isOnLastDrawnPoint`・`canCloseDrawnLine`）は`isDrawnLineShape`のままで弧を受け付けない。これらと`planDrawnLineJoin`の`drawn.toJSON().points`が読むのは作成途中の線の約束（先頭＝打った始点・末尾＝付いてくる線の先）で、結合できる線の端点の読み方ではないため変えない。
* **結合の結果のふるまい**（今の規則のまま）：基準の線A（重なり順で奥）の向き・色・太さ・塗り（弧がAなら弧の塗りの色も結果に引き継がれる）。2本の結合は新しいid／描き足し・閉じるは元のidと位置。端点が重なっていればまとめ（Bの端点を除きAの端点の座標を残す）・離れていれば間を埋める区間（ボタン・`J`は直線、ツールは描いた区間の種類）。Bを逆順にするときは区間も逆順（曲がり方を持つ区間は引っ張る点を入れ替える）。つながってできた点はなめらかな点（`chainOf`が端の点を偽にする）。**端点をまとめるとき、除いたBの端点の側の引っ張る点は動かさない**（09-03aと同じ。`_doc/COWORK_STATUS.md` 2章B。5px以内で離れていた場合だけ、その差の分Bの区間の端の近くの形が変わる）。
* **閉じる**：弧1本だけは閉じない（`classifyJoin`の1本の分岐と`buildClosedPath`が`'path'`だけを受け付ける。今の曲線1本と同じ）。弧は頂点3つになるため、弧1本と直線1本の半月形は結合した後に閉じられる（例：弧の右端に始点・左端に終点を重ねた直線と弧を`J`で結合すると、頂点4つで始点と終点が重なる開いたパス。もう一度`J`で頂点3つの閉じたパス）。**直線・曲線のツールで、弧の一方の端から引き始め途中に点を打たずに同じ弧のもう一方の端で終えたとき**は、`planDrawnLineJoin`→`planCloseOf`→`buildClosedPath(弧)`が`null`のため何も起きない（作成途中の線を捨てるだけで記録しない。直線・今の曲線の同じ操作と同じ今の規則のまま。途中に点を1つ以上打てば`planCloseWithPoints`で閉じた形になる）。「5. 懸念事項」にも書く。

### 要件B: 端点の読み方と吸い付き（`js/shapes/EndpointSnapRules.js`）
* **import**：`import { isJoinableLine, canCloseByMergingEnds, canCloseDrawnLine, lineEndpointOf, endpointVertexIndexOf } from './PathJoinRules.js';`（名前を2つ足すだけ。向きは今のまま）。
* **typedef`SnapTarget`**：`end`の説明を`EndpointRef`と同じに直す（「'start'＝始点（結合できる線として読んだ頂点の並びの先頭。弧は左端）／'end'＝終点（末尾。弧は右端）」）。
* **`resolveEndpointHandle(shape, handleName)`**：
  ```js
  if (!isJoinableLine(shape)) return null;
  const index = shape.getVertexIndexForHandle(handleName);
  if (index === null) return null;
  const data = shape.toJSON();
  if (index === endpointVertexIndexOf(data, 'start')) return 'start';
  if (index === endpointVertexIndexOf(data, 'end')) return 'end';
  return null;
  ```
  弧は`endpointVertexIndexOf`が`null`を返し、`index`は`null`でないため、どのハンドル（`'left'`・`'right'`・`'up'`・`'down'`・`'move'`ほか）でも`null`（端点として解決しない＝現場設計の決定）。直線・パス・今の曲線は今と同じ結果（番号0が始点・`points.length - 1`が終点）。JSDocの「『頂点の番号`i`＝図形データの`points[i]`』に依る：…番号が0なら始点、`points.length - 1`なら終点」を「端点の頂点の番号は`endpointVertexIndexOf`に任せる（直線・パス・今の曲線は0が始点・`points.length - 1`が終点）」に、「結合できない線（矩形・円・弧・閉じたパス）」を「結合できない線（矩形・円・閉じたパス）」に、結合できる線の列挙に「弧（結合できる線だが、弧のハンドルは半径の編集のハンドルで端点として解決しない＝null）」を足す。
* **`findSnapTarget`**：コードは変えない。JSDocの対象の列挙に弧を足す（「…・今の曲線・弧の始点・終点だけ（今の曲線の制御点、弧の中心・頂上・制御点は対象にならない。弧の始点・終点は左端・右端）」）。
* **`findNearestEndpoint`（非公開）**：`const points = shape.toJSON().points;`と`ends`の組み立てを、`const data = shape.toJSON();`・`{ end: 'start', p: lineEndpointOf(data, 'start') }`・`{ end: 'end', p: lineEndpointOf(data, 'end') }`にする（走査の順・距離の比べ方・除外は変えない）。JSDocに「端点は`lineEndpointOf`で読む」を足す。直線・パス・今の曲線では同じ座標のため結果は今と同じ。
* **`findDrawnLineSnapTarget`**：コードは変えない（端点の走査は`findNearestEndpoint`を共有するため弧の端点も候補になる。描き始めの端点の除外は図形のidと`end`で行うため、弧の端から引き始めたときは弧のその端だけを除き、もう一方の端は候補になる。`drawn.toJSON().points[0]`は作成途中の線の始点で、作成途中の線の約束の読み方のまま）。
* **`isSnapDrawShapeType`**：変えない（弧のツールで描く途中は今までどおり吸い付かない）。
* ファイル先頭の責務定義は変えない（図形種別の列挙を含まないため）。

### 要件C: 変えないファイルと経路の確認
* **`shapes/Ellipse.js`**：変えない。弧の描画・ハンドル・当たり判定・`toJSON`・`toDrawElement`（`ellipse`）・`isFillable`（弧は偽）は、結合しない限り今のまま。結合した弧は`VectorModel.replaceShape`で`Path`に置き換わるため、`Ellipse`は結合後の形を知らない。
* **`shapes/Path.js`・`ShapeGeometry.js`**：変えない。弧から作った`'bezier'`の区間は09-03aの約束どおり扱われる（描画・当たり判定・範囲選択・塗りの内側・書き出しは`Path.#segmentControls`の結果を共有。`setVertex`はその頂点を始点とする区間の`control1`と終点とする区間の`control2`を同じ差だけ動かすため、頂上を動かすと両側の引っ張る点が頂上と一緒に横に並んだまま動き、頂上でなめらかなまま。`translate`はすべての引っ張る点を動かす。頂点の選択では`vertex-0`〜`vertex-2`の3つの点が出て、引っ張る点は出ない）。
* **`shapes/PathCornerRules.js`・`PathSegmentKindRules.js`**：変えない。頂上の点・パスの途中になった両端の点は曲がり方を持つ区間に接するため`LINE_CORNER`（「角」はチェックが入った見た目で押せない＝発注者の決定）。「直線に」で曲がり方を持つ区間は直線の区間になり引っ張る点を捨てる、「曲線に」では変わらない（09-03aのまま）。結合していない弧は頂点の選択で点が出ないため、区間の切り替え・角の切り替えの対象にならない（今のまま）。
* **`edit/PathJoiner.js`**：コードは変えない（`classifyJoin`・`planJoin`の結果に従うだけ）。先頭の責務定義の「選択中の線（直線・開いたパス・今の曲線）」を「選択中の線（直線・開いたパス・今の曲線・弧）」に直す（3行以内のまま。ほかのJSDocは変えない）。
* **`edit/EndpointSnapper.js`**：変えない（`resolveEndpointHandle`・`findSnapTarget`・`findDrawnLineSnapTarget`・`planDrawnLineJoin`・`planEndpointDragJoin`の結果に従うだけ。JSDocに図形種別の列挙で直すべき箇所は無い：`isDrawingLine`の「弧・矩形・円の作成途中の図形は当たらない」は今も正しい）。
* **`core/`（`InputTracker`・`VectorModel`・`CanvasManager`ほか）・`palette/`・`main.js`・`index.html`**：変えない。`InputTracker`は注入された`EndpointSnapper`の照会結果に従うだけ（図形種別を見ない）。弧のハンドルは選択（`V`）では当たりに含めず（`includeHandles`が偽）、頂点の選択（`A`）では弧の`getVertexHandleNames()`が空のため当たらない（Phase 08-02a）。よって弧自身の端のドラッグで吸い付く経路は画面からも無く、規則でも`resolveEndpointHandle`が`null`を返す。結合の記録は今の`PathJoiner.join`・`EndpointSnapper`の`beginEdit`/`commitEdit`（端点のドラッグは移動と同じ1件）で、取り消し1回で戻る。
* **`io/`**：変えない。結合した弧は`'bezier'`の区間を持つパスとして`DocumentSerializer`で往復し（作業データの版2のまま）、`SpriteSerializer`は`toDrawElement()`の`bezierPath`（`cubic`の制御点＝引っ張る点）と`cubicAxisRange`の外枠を今のまま扱う（書き出しの版3のまま）。結合していない弧は今どおり`ellipse`。

### 要件D: テスト（REQ要件4）
`palette/`・`main.js`・`index.html`はテストを置かない（`_doc/arch/16_test.md`）。書き方は`16_test.md`の決まり（`node:test`・`node:assert/strict`のみ、公開APIのみ、先頭行に責務のJSDoc、補助関数にJSDoc、idは公開プロパティ`id`へ代入）に従う。係数はテストの中で`const K = 4 * (Math.SQRT2 - 1) / 3;`と書き（ソースの非公開の定数をexportしない）、引っ張る点の比較は`1e-9`の許容量、形のずれは「横・縦の半径で割った距離」`Math.hypot((x - xc) / rx, (y - yc) / ry)`と1の差が`3e-4`以下で確かめる。区間の上の点は`js/shapes/ShapeGeometry.js`がexportする`cubicBezierPoint(p0, p1, p2, p3, t)`で求める（`test/shapes/PathJoinRules.test.js`は既に`import { cubicBezierPoint, quadraticBezierPoint } from '../../js/shapes/ShapeGeometry.js';`を持つため、importを足さない）。

**書き換える既存のケースと理由**（どれも「弧は結合できない・吸い付かない」ことを確かめていたため、本作業で意味が変わる。**タスク1の`isJoinableLine`・`findNearestEndpoint`の変更で結果が変わるため、すべてタスク1で書き換える**。これ以外の既存のケースが落ちたら直さずに作業を中断し、質問として報告する）：
1. `test/shapes/PathJoinRules.test.js`の補助`JOIN_REJECTED_KINDS`：`UNJOINABLE_KINDS.filter((kind) => kind !== 'curve')`を`UNJOINABLE_KINDS.filter((kind) => kind !== 'curve' && kind !== 'arc')`にし、JSDocを「結合できない図形の種類名の並び（`UNJOINABLE_KINDS`から今の曲線・弧を除いたもの）」に直す。補助`makeUnjoinable`・`UNJOINABLE_KINDS`のJSDocの「（今の曲線を含む。今の曲線はPhase 09-03aから結合できる線）」を「（今の曲線・弧を含む。今の曲線はPhase 09-03a、弧はPhase 09-03bから結合できる線）」に直す（`UNJOINABLE_KINDS`の中身は変えない：続けて引く線の形でない図形の並びとして弧を含んだまま使う）。これで次の3ケースの意味が変わる：
   * (1a) `describe('classifyJoin')`の`it('結合できない図形を1つでも含む2つはnull（順も問わない）')`：弧が繰り返しから外れる（名前・本体は変えない）。
   * (1b) `describe('isJoinableLine')`の`it('閉じたパス・矩形・円・弧は false')`：名前を`'閉じたパス・矩形・円は false'`に直す（本体は変えない）。
   * (1c) `isDrawnLineShape`の`it('今の曲線のほかはisJoinableLineとisDrawnLineShapeが同じ結果。今の曲線は結合できるが続けて引く線の形ではない')`：名前を`'今の曲線・弧のほかはisJoinableLineとisDrawnLineShapeが同じ結果。今の曲線・弧は結合できるが続けて引く線の形ではない'`に直し、末尾に`assert.equal(isJoinableLine(makeUnjoinable('arc')), true);`・`assert.equal(isDrawnLineShape(makeUnjoinable('arc')), false);`を足す。
2. `test/shapes/EndpointSnapRules.test.js`の`it('矩形・円・弧・閉じたパスの点には吸い付かない')`：弧（`withId(new Ellipse(0, 0, 100, 100, 'arc'), 'A')`）の行を`shapes`から除き、名前を`'矩形・円・閉じたパスの点には吸い付かない'`に直す（弧の`points[1]`・`[3]`・`[4]`は弧の右端・左端の位置にあり、本作業で吸い付く対象になるため）。後半の`findSnapTarget(shapes, …)`の2つの`null`の期待値は変えない。
* 書き換えないことを確かめた既存のケース：`classifyJoin`の`'曲線・矩形・円・弧の1つはnull'`（弧1本は閉じない）、`isDrawnLineShape`の`'閉じたパス・今の曲線・矩形・円・弧は偽'`、`EndpointSnapRules.test.js`の`resolveEndpointHandle`の`'閉じたパス・矩形・円・弧は null'`（弧のハンドルは端点として解決しない）、`isSnapDrawShapeType`・`EndpointSnapper.test.js`の`findDrawSnap`の`'arc'`（弧のツールは吸い付かない）、`io/`の弧のケース（結合していない弧は今のまま）。

**足すケース**（下の補助・座標は例。共通の弧`ARC = new Ellipse(100, 200, 160, 230, 'arc')`＝中心(100,200)・横の半径60・縦の半径30・左端L(40,200)・頂上T(100,170)・右端R(160,200)。引っ張る点は`B0 = { control1: (40, 200 − 30K), control2: (100 − 60K, 170) }`・`B1 = { control1: (100 + 60K, 170), control2: (160, 200 − 30K) }`）：
* **タスク2：`test/shapes/PathJoinRules.test.js`**（新しい`describe('PathJoinRules 弧の結合（Phase 09-03b）')`。importに`lineEndpointOf`・`endpointVertexIndexOf`を足す）：
  * 判定：`isJoinableLine(弧)`が真・`isDrawnLineShape(弧)`が偽・`isJoinableLine(円)`が偽。`classifyJoin`：弧と直線・直線の開いたパス・曲線の開いたパス・今の曲線・別の弧は`'join'`（順も問わない）、弧と円・矩形・閉じたパスは`null`、弧1本は`null`。作成途中の線の関数（`addDrawnPoint`・`buildFinishedDrawnLine`）は弧で`null`、`canCloseDrawnLine(弧)`は偽。
  * 変換：`buildJoinedPath(ARC, 直線R→(200,200), 0)`の頂点が`[L, T, R, (200,200)]`・区間が`[B0, B1, line]`（`'bezier'`2つ。引っ張る点は`1e-9`で一致）・`corners`のキー無し。各`'bezier'`の区間の`t = 0, 0.05, …, 1`で`cubicBezierPoint`（`js/shapes/ShapeGeometry.js`のexport。既存のimportを使う）の点の「半径で割った距離」と1の差が`3e-4`以下、かつ`y ≤ yc`（上半分）。両端と頂上は弧の上にちょうど乗り（L・T・Rと一致）、接線の向き（左端・右端で`control`の`x`が端と同じ＝縦、頂上で`control`の`y`が頂上と同じ＝横）。横と縦の半径が同じ弧（円の上半分）でも同じ許容量。
  * 半径0：`new Ellipse(10, 10, 10, 10, 'arc')`（点）と`new Ellipse(10, 30, 10, 10, 'arc')`（横の半径0・縦の半径20。左端・右端(10,30)・頂上(10,10)）を直線と結合でき、頂点3つ・`'bezier'`2つで、区間の上の点が縮んだ形（点なら1点、線分なら`x = 10`で`10 ≤ y ≤ 30`）に乗る（`NaN`を含まない）。
  * `planJoin`／`buildJoinedPath`：端点が重なる・離れている（間に直線の区間）／直線＋弧（Bの弧を逆順にして区間を`[line, B1の逆, B0の逆]`＝引っ張る点を入れ替える）／弧＋直線の開いたパス・曲線の開いたパス（曲線の区間を保つ）・今の曲線（`'bezier'`3つ）・別の弧（`new Ellipse(220, 200, 280, 230, 'arc')`で頂点5つ・`'bezier'`4つ）／スタイルは基準の線A（弧がAなら弧の線の色・太さ・塗り。直線がAなら直線のもの）／`keepId: false`・`targetId`・`removeIds`／引数（弧の`toJSON()`）を書き換えず、結果は引数と頂点を共有しない。
  * 閉じる（半月形）：`planJoin([弧A, 直線B（R→L）], 0)`が頂点4つ（始点と終点が重なる開いたパス）・区間`[B0, B1, line]`、その結果を`planJoin([結果], 5)`で閉じると頂点3つ`[L, T, R]`の閉じたパス・区間`[B0, B1, line]`・`isFillable()`が真・塗りの色を持つと内側（例(100,190)）の`hitTestFill`が真。弧1本は`buildClosedPath`が`null`・`planJoin([弧])`が`null`。
  * `buildJoinedPathAt`（弧の始点側・終点側で向きを保つ）・`buildExtendedPath`（弧の始点側・終点側に描き足し、区間の種類は引数のもの。端点と重なる点は`null`）。
  * `planDrawnLineJoin`：描き始めだけ弧の端点（弧のidを保つ`keepId: true`・足した区間は描いた区間の種類）／描き終えだけ弧の端点／同じ弧の両端で途中の点なし＝`null`／途中の点ありで同じ弧の両端＝閉じたパス（弧のid）／弧の端と直線の端の間＝結合。
  * `planEndpointDragJoin`：直線の終点を弧の始点Lへ（同じ座標）＝結合（`[(0,200), L, T, R]`・区間`[line, B0, B1]`。弧が奥でも手前でも頂点の並びは同じ）／弧の端点を`dragged`にした自分のもう一方の端点への`planEndpointDragJoin`は`null`（弧1本は閉じない）。
  * 結合した後の頂点の操作（`Path`の公開APIで確かめる。要件2.1）：頂上`vertex`番号1を`setVertex`で(+5, −7)動かすと区間0の`control2`と区間1の`control1`だけが同じ差だけ動き、2つの`y`が頂上の`y`と同じまま（頂上でなめらか）。左端（番号0）を動かすと区間0の`control1`だけが動く。`translate`ですべての引っ張る点が動く。
  * 端点の読み方：`lineEndpointOf`が直線・開いたパス・今の曲線（始点・終点）・弧（左端・右端）の端点を新しいオブジェクトで返し、引数を書き換えない。`Ellipse.fromJSON`で`points[1].x`が中心より左・`points[3]`・`[4]`が正準の位置でない弧（例：`points: [(100,200), (40,200), (100,230), (999,999), (-5,-5)]`）でも、左端(40,200)・右端(160,200)（半径は絶対値で読み、`[3]`・`[4]`を読まない）。`endpointVertexIndexOf`：直線0／1、頂点4つのパス0／3、今の曲線0／2、弧は`null`／`null`。
* **タスク3：`test/shapes/EndpointSnapRules.test.js`**（新しい`describe('EndpointSnapRules 弧の吸い付き（Phase 09-03b）')`）：弧の左端・右端が吸い付く対象（`findSnapTarget`が`{ shapeId, end: 'start'|'end', x, y }`を返す）、中心・頂上は対象でない、`fromJSON`で`points[3]`・`[4]`を正準でない位置にした弧ではその位置に吸い付かず左端・右端に吸い付く／`resolveEndpointHandle(弧, 名前)`が`'left'`・`'right'`・`'up'`・`'down'`・`'move'`で`null`（`fromJSON`の弧でも）／ほかの線をドラッグしているとき（`dragged`がほかの線）に弧の端点が候補になる／`findDrawnLineSnapTarget`で描き始めが弧の始点のとき、弧の終点は候補・始点は候補でない。円の点には吸い付かないまま（`findSnapTarget([円], 円の各点)`が`null`）。
* **タスク3：`test/shapes/PathCornerRules.test.js`・`test/shapes/PathSegmentKindRules.test.js`**（それぞれ新しい`describe('… と弧の結合（Phase 09-03b）')`を1つ。09-03aの`describe('… と曲がり方を持つ区間（Phase 09-03a）')`の書き方にそろえる）：弧と直線を`planJoin`で結合したパスの頂上（番号1）・弧の右端だった点（パスの途中の点）が`CornerState.LINE_CORNER`、それらを選んだ「角」の見た目（`resolveCornerToggleView`）が押せない・チェックありの見た目／左端と頂上を選んだ「直線に」（`planSegmentKindSwitch`）で区間0だけが`{ kind: 'line' }`になり区間1の`'bezier'`は引っ張る点ごと残る、「曲線に」では変わる区間が無い（`resolveSegmentSwitchAvailability`で押せない側）。
* **タスク4：`test/edit/PathJoiner.test.js`**：偽の依存で弧と直線の`canJoin`が真・弧1本の`canJoin`が偽、`join`の`replaceShape`の区間の種類が`['bezier', 'bezier', 'line']`／実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`で弧と直線を結合 → 取り消し1回で弧と直線に戻る（弧の`toJSON()`が元と同じ）→ やり直しで結合した後に戻る。
* **タスク4：`test/edit/EndpointSnapper.test.js`**：`resolveDragEndpoint`が弧のハンドル（`'left'`・`'right'`・`'up'`・`'down'`・`'move'`）で`null`／`findDrawSnap('line'・'curve', 弧の左端の近く)`が弧の始点の`SnapTarget`／`findDragSnap`（ほかの線の端点のドラッグ）が弧の右端を返す／`joinDraggedEndpoint`（直線の端点を弧の端点へ）が`replaceShape`（`select: true`）で`'bezier'`2つを含むパスを渡す／`commitDrawnLine`（描き始めが弧の端点）が弧のidを保つ（`keepId: true`）・区間`['bezier', 'bezier', 'line']`／実物の組み合わせ：直線のツールで弧の端点から引き始めて終える → 弧のidで弧の色・太さの開いたパス・履歴1件・取り消しで弧に戻る。
* **タスク5：`test/io/DocumentSerializer.roundtrip.test.js`**（新しい`describe('弧を結合した結果の往復（Phase 09-03b）')`）：弧と直線（開いた）・半月形の閉じた塗りありのパス・弧2本の結合の結果が、既存の`ROUTES`（オブジェクト層・文字列層）で`toJSON()`と`segments`が同じまま往復し、`version`が2、`console.warn`が0回。
* **タスク5：`test/io/SpriteSerializer.test.js`**（新しい`describe('SpriteSerializer: 弧を結合した結果（Phase 09-03b）')`）：`bezierPath`の区間`['cubic', 'cubic', 'line']`の`control1`・`control2`が作業データの引っ張る点と一致・`toDrawElement().segments`と一致・`formatVersion`が3／外枠が`sampleBezierPathRange`（線の太さの半分を足す）と`1e-3`で一致（形を囲む）／弧と、弧の外接矩形の内側に収まる直線（例：R→(100,200)）を結合した結果の外枠が、元の弧だけの外枠（`ellipse`）と`1e-6`で一致（両端と頂上で極値を取るため）／半月形の閉じた塗りありは`closed: true`で`fillColor`を持つ。

### 要件E: ふるまいの確認（テストプレイの確認項目。REQ要件5）
タスク7で、実装の結果に合わせて文言を確かめ、次の項目を発注者へ提示する（下は計画時点の文言。**注意点を足した**：(1) 弧の半径のハンドルはPhase 08-02aから画面に出ない（選択（`V`）ではハンドルを出さず、頂点の選択（`A`）では弧に点が出ない）ため、REQの項目2の「弧自身の左右の端のハンドルをドラッグすると、今までどおり半径が変わる」操作は今の画面ではできない。弧自身の端が端点として解決されないことは自動テスト（`resolveEndpointHandle`・`resolveDragEndpoint`）で確かめる。(2) 同じ弧の両端の間を途中の点なしで引いても何も起きない）。
0. **準備**：ブラウザで画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。弧は弧のツール（`3`）で描く。
1. **結合のボタン・`J`**：弧と直線（または直線のパス・曲線のパス・今の曲線・別の弧）を選択（`V`）で2本選ぶと、結合のボタンが押せる。押す（`J`でも）と1本のパスになり、弧の部分の形は見た目で変わらない。端点が離れていれば、間が直線でつながる。弧1本だけでは押せない。弧と円・矩形の2つでは押せない。
2. **ほかの線から吸い付ける**：頂点の選択（`A`）で直線・パスの端の点をドラッグして弧の端（左端・右端）に近づけると吸い付き（青い四角）、離すと結合する。弧の中心・頂上には吸い付かない。弧そのものは、頂点の選択で選んでも点が出ず（今までどおり）、弧の線の上を押してドラッグすると範囲選択になって弧は動かず、どこにも吸い付かない（弧の半径のハンドルは今の画面では出ないため、半径をドラッグで変える操作は無い）。
3. **ツールでつながる・伸ばす**：直線のツール・曲線のツールで、弧の端から引き始める（弧の端に青い四角が出る）と、終えたときにその弧の続きとして伸びる（色・太さは弧のもの）。引いている途中に弧の端でクリックすると、その弧とつながる。弧の一方の端から引き始め、途中に点を打たずに同じ弧のもう一方の端でクリックすると何も起きない（直線・今の曲線と同じ。途中に点を1つ以上打ってから弧のもう一方の端でクリックすると閉じた形になる）。弧のツールで描いている途中は吸い付かない。
4. **閉じた形と塗り**：弧と直線1本で半月形を作り（直線の両端を弧の両端に重ねて置き、2本を選んで`J`で結合し、もう一度`J`で閉じる）、塗りの色を付けると内側が塗られる。内側のクリックで選べる。弧と曲線・パスを組み合わせた閉じた形も同じ。
5. **結合した後の編集**：頂点の選択（`A`）で、元の弧の部分は両端と頂上の3つの点が出る（半径のハンドルは出ない）。頂上を動かすと両側の曲がりが一緒に動き、頂上でなめらかなまま。端の点を動かすと、その点の側の曲がりが一緒に動く。パス全体を動かすと形ごと動く。
6. **角と切り替え**：頂上の点を選ぶと「角」はチェックが入った見た目で押せない。頂上と端を選んで「直線に」を押すとその間が直線になる。「曲線に」では変わらない。
7. **取り消し**：どの結合も、取り消し（`Ctrl`+`Z`）1回で結合の前に戻り、やり直しで結合した後に戻る。
8. **保存・書き出し**：結合したパスを保存して開き直す（キャンバスの切り替え・コピー＆ペースト・複製（`Ctrl`+`D`）も）と同じ形に戻る。書き出して確認用ページ（`sprite-check.html`）で開くと、同じ形で描かれ、外枠が形を囲む。
9. **ほかが今までどおり**：結合していない弧（塗れない・頂点の選択で点が出ない・選択（`V`）で動かせる・書き出すと弧のまま）、円（結合の対象にならない・吸い付かない）、今の曲線・直線・パスの結合・描き足し・閉じる、曲線のツール・直線のツールの連続作成、弧のツールで描く、「角」・「直線に」「曲線に」、選択・頂点の選択・位置の数値入力・整列・重なり順・保存・読み込み・書き出しが今までどおり動く。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/shapes/` - 図形をまたぐ規則（第3の種類）：`PathJoinRules`（弧を結合できる線にする・弧を区間として読む・端点の読み方）、`EndpointSnapRules`（弧の端点への吸い付き・弧のハンドルを端点にしない）。
    *   `./js/edit/` - `PathJoiner`（先頭の責務定義のJSDocだけ）。
    *   `./test/shapes/`・`./test/edit/`・`./test/io/` - 自動テスト（新しいファイルは作らない）。
*   **関連する論理クラス**: `PathJoinRules`（`isJoinableLine`・`classifyJoin`・`chainSourceOf`・新設の非公開`arcChainSourceOf`・`QUARTER_ELLIPSE_BEZIER_K`・新設の公開`lineEndpointOf`・`endpointVertexIndexOf`・`buildJoinedPath`系）、`EndpointSnapRules`（`resolveEndpointHandle`・`findNearestEndpoint`）、`Ellipse`（弧。変えない）、`Path`（曲がり方を持つ区間。変えない）、`PathCornerRules`・`PathSegmentKindRules`（変えない）、`PathJoiner`・`EndpointSnapper`（規則の結果に従う手順。変えない）。新しい論理クラス・ファイルは無い。

### 参照する責務
*   **フォルダ分割の方針（1章）**：`shapes/`＝図形クラス（種別ごとに1ファイル）・図形クラスだけが使う共通の関数（`ShapeGeometry`・`ShapeDataValidation`）・図形をまたぐ規則（第3の種類。`PathJoinRules`＝結合の規則と、直線・曲線のツールで続けて引く線の点の並びの規則。結合できる線（`isJoinableLine`）は続けて引く線の形（`isDrawnLineShape`）に今の曲線を足した条件で、今の曲線は頂点2つと曲がり方を持つ区間1つとして読む＝`chainSourceOf`。`EndpointSnapRules`＝端点への吸い付きの規則。`PathCornerRules`・`PathSegmentKindRules`。`shapes/`の外から使う）。**図形種別の判定、弧から区間への変換、端点の読み方、引っ張る点の計算は`shapes/`に置き、`core/`・`edit/`・`io/`・`palette/`・`main.js`・`CanvasManager`に書かない**（REQ）。
*   **依存方向（1章）**：`main.js → edit → io → core → shapes`の一方向。外れるimportは(1)`edit/PathJoiner → shapes/PathJoinRules`、`edit/EndpointSnapper → shapes/EndpointSnapRules`・`shapes/PathJoinRules`、`edit/PathCornerEditor → shapes/PathCornerRules`・`shapes/PathSegmentKindRules`、(2)`shapes/`内：`EndpointSnapRules → PathJoinRules`、`PathCornerRules → Path`、`PathSegmentKindRules → Path`・`Line`・`PathJoinRules`・`PathCornerRules`（`PathJoinRules`は`Line`・`Path`のみimport（`Path`からは`readCornerFlags`も）するため循環しない）、(3)`edit/ → core/`の規則（4ファイル）。`core/`から`shapes/`をimportするのは`ShapeFactory`だけ。**循環importは無い**。
*   **`edit/`（1章）**：操作モードを知らない。`PathJoiner`・`EndpointSnapper`は図形種別の分岐・図形固有のプロパティ名・idの形式・操作モードの知識を持たず、規則の計画に従ってモデルへ反映する（`model.replaceShape`、`beginEdit`／`commitEdit`）。`core/InputTracker`は`edit/`をimportせず、`main.js`が注入した`EndpointSnapper`のメソッドを呼ぶだけ。
*   **`PathJoinRules`（`_doc/arch/12_shapes.md`）**：状態を持たない`export`した関数と定数のみ。読むのは図形の`type`・公開プロパティ`id`・`toJSON()`の図形データだけ（図形クラスの内部プロパティを読まない）。importは`./Line.js`・`./Path.js`（`Path`・`SEGMENT_KIND_LINE`・`SEGMENT_KIND_BEZIER`・`readCornerFlags`）のみ。表示倍率・モデル・履歴・DOM・操作モード・idの形式を知らず、許容距離はワールドの長さで受け取る。`try/catch`を持たない。結果は元の図形と配列・頂点を共有しない。`chainSourceOf`が今の曲線を区間として読む唯一の箇所（2次→3次の式もここ）、`chainOf`が端の点の角の情報を偽にする唯一の箇所、`assembleOpenPath`が頂点・区間・角の点を一緒に並べる唯一の箇所、`segmentKindsOf`が「直線は直線の区間1つ」の唯一の箇所。
*   **`EndpointSnapRules`（`_doc/arch/12_shapes.md`）**：読むのは図形の`type`（`isJoinableLine`経由）・公開プロパティ`id`・`toJSON()`・`getVertexIndexForHandle`。importは`./PathJoinRules.js`のみ。使う側は`edit/EndpointSnapper`のみ。走査は`findSnapTarget`と非公開の`findNearestEndpoint`で共有（名前・引数・結果は不変）。`SNAP_TOLERANCE_SCREEN_PX`（8）は`JOIN_TOLERANCE_SCREEN_PX`（5）とも`hitTolerance`とも別の定義。
*   **`Ellipse`（2章・`_doc/arch/12_shapes.md`）**：円・弧（`type`で分岐）。`points[0]`＝中心・`[1]`＝右端の制御点・`[2]`＝上端の制御点・`[3]`＝開始角の制御点・`[4]`＝終了角の制御点。半径は`rx = |points[1].x − xc|`・`ry = |points[2].y − yc|`（描画・当たり判定・書き出しと同じ式）。弧は画面の上半分（π〜2π）。`getVertexIndexForHandle`は`right`／`left`→1、`up`／`down`→2。`getVertexHandleNames()`は空（円・弧は頂点の選択で点が出ない。発注者の決定）。弧は塗れない（`isFillable`が偽）。`fromJSON`は`[3]`・`[4]`を再計算しない。
*   **`path`・曲がり方を持つ区間（2章）**：`segments[i]`＝`points[i]`→`points[i+1]`。`'bezier'`は`{ kind, control1, control2 }`（ワールド座標の絶対座標。`control1`＝始点側）。描画・当たり判定・範囲選択・塗りの内側・書き出し（`cubic`）は`Path.#segmentControls`の結果を共有。`setVertex`はその頂点を始点とする区間の`control1`と終点とする区間の`control2`を同じ差だけ動かし、`translate`はすべての引っ張る点を動かす。隣の区間とのつなぎ目は常に角。閉じたパスの頂点数の下限は3。区間の種類・図形データのキー・作業データの版（2）・書き出しの版（3）は増やさない・変えない（REQ）。
*   **結合（3章11.）**：基準の線A＝重なり順で奥。結果の向き・色・太さ・塗りはA。2本の結合はAの位置に新しいid・Bを除く、閉じるは元のidと位置。端点が重なっている＝画面上5px以内。重なる端点は1つにまとめ（Bの端点を除く）、離れていれば区間でつなぐ（ボタン・`J`は直線）。結合後は結果だけを選択（`PathJoiner`）。結合は1件の編集操作で取り消し1回（6.）。自動で閉じない・3本以上の結合はしない。つながってできた点はなめらかな点。
*   **端点への吸い付き（3章12.）**：吸い付く距離＝画面上8px。対象は結合できる線の端点だけ。表示＝中を青で塗った正方形。ハンドルのドラッグで吸い付いて離すと結合・閉じる（閉じられない場合は自身のもう一方の端点に吸い付かない。頂点2つの線は閉じない）。描き足しは元のid・色・太さ・塗り・位置を保つ。吸い付きでの結合のつなぐ端点は吸い付いた端点。`Ctrl`の間は照会しない。
*   **続けて引く（3章22.）**：線を引いているかの判定は`isDrawnLineShape`（直線・開いたパス）で、変えない（REQ：続けて引く線の形は変えない）。同じ線のもう一方の端点で終えると閉じる（途中の点が要るのは相手が頂点2つの線のとき）。
*   **角（3章23.）**：角を操作できる点＝両側とも打った点の曲線の区間（`'smooth'`）の点。曲がり方を持つ区間に接する点は`LINE_CORNER`（チェックが入った見た目で押せない）。**区間の切り替え（3章24.）**：「直線に」で曲がり方を持つ区間は直線の区間になり引っ張る点を捨てる。「曲線に」では変わらない。
*   **テスト（`_doc/arch/16_test.md`）**：`node:test`・`node:assert/strict`のみ。公開APIのみを通し、テストのためにソースへ`export`の追加・privateの公開をしない。補助関数は各テストファイルの中に書き、JSDocを付ける。`test/edit/PathJoiner.test.js`・`EndpointSnapper.test.js`は実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`を組み合わせてよい。図形の`id`は公開プロパティへ代入。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章 構成図**：`PathJoinRules.js`の行の「今の曲線を区間として読む」を「今の曲線・弧を区間として読む」に直す。
*   **1章 フォルダ分割の方針（`shapes/`）**：結合できる線（`isJoinableLine`）＝続けて引く線の形に今の曲線（09-03a）・弧（Phase 09-03b。弧は頂点3つ（左端・頂上・右端）と曲がり方を持つ区間2つとして読む＝`chainSourceOf`→`arcChainSourceOf`）を足した条件、に直す。結合できる線の端点の読み方は`lineEndpointOf`・`endpointVertexIndexOf`（`PathJoinRules`。`chainSourceOf`で読み替えた頂点の並びの先頭・末尾）を足す。
*   **1章「存在しないもの」**：「弧の結合と曲線の区間としての取り込み（Phase 09-03b。…）」を消す。足す：弧自身の端のハンドルのドラッグでの吸い付き・結合（弧の半径のハンドルはPhase 08-02aから画面に出ない）、頂点の選択で弧に点を出すこと、弧1本の閉じる（同じ弧の両端の間を途中の点なしで引いても何も起きない）、結合で弧の形を誤差なく保つこと（楕円の4分の1の近似で半径の約0.03%のずれを許す）、弧の回転・弧の角度の変更、弧のツールで描くときの吸い付き。
*   **2章**：
    *   `path`の「作られるのは…」に弧の結合（Phase 09-03b。弧の部分は曲がり方を持つ区間2つ・頂点3つ）を足す。
    *   曲がり方を持つ区間`'bezier'`の「作られるのは今の曲線の結合だけ」を「今の曲線の結合と弧の結合」に直し、弧の近似（`arcChainSourceOf`の式・係数`k = 4(√2 − 1)/3`の唯一の箇所`QUARTER_ELLIPSE_BEZIER_K`。両端と頂上は弧の上にちょうど乗り接線も同じ。ずれは半径の約0.027%以内）を足す。
    *   弧（`Ellipse`の`arc`）について：結合できる線で、結合すると`Path`に置き換わる（弧の始点＝左端・終点＝右端。`points`の先頭・末尾ではない）。結合しない限り描画・ハンドル・当たり判定・書き出しの`ellipse`・塗れないは今のまま。
    *   書き出し`bezierPath`の「`'bezier'`（今の曲線の結合。Phase 09-03a）も`cubic`になる。弧は09-03b」を「今の曲線・弧の結合でできた`'bezier'`も`cubic`になる」に直す。`ellipse`は結合していない弧・円。
*   **3章6.**：結合（結合ボタン・`J`）・吸い付きの記録の項は変わらない（弧の結合も同じ1件）。必要なら一言足す。
*   **3章11.**：冒頭・「結合できる線」に弧を足す（`isJoinableLine`＝`isDrawnLineShape`＋今の曲線＋弧）。「今の曲線の結合（Phase 09-03a）」の後に「弧の結合（Phase 09-03b）」の項を足す（`chainSourceOf`の読み替え・近似・端点の読み方`lineEndpointOf`・弧がAなら弧のスタイル・弧1本は閉じない・半月形は結合した後に閉じられる・同じ弧の両端の間を途中の点なしで引いても何も起きない・端点をまとめるとき引っ張る点を動かさない）。`classifyJoin`の2本の受け付けは`isJoinableLine`だけ（`typeOk`をやめた）。「やらないこと」の「矩形・円・弧・閉じたパスの結合（…弧は09-03b）」を「矩形・円・閉じたパスの結合」に直す。
*   **3章12.**：発注者の決定の「対象は結合できる線（…）の端点だけ」に弧の左端・右端を足し、弧のハンドル（`'left'`・`'right'`・`'up'`・`'down'`・`'move'`）は端点のハンドルとして解決されない（`endpointVertexIndexOf`が`null`）こと、弧の中心・頂上は吸い付き先にならないことを足す。「今の曲線の…始点・終点は頂点の番号0・`points.length - 1`の約束どおり」を`endpointVertexIndexOf`の記述に直す。「やらないこと」の「矩形・円・弧・閉じたパスの点」を「矩形・円・閉じたパスの点・弧の中心と頂上」に直し、弧自身のハンドルのドラッグでの吸い付きを足す。
*   **3章22.**：続けて引く線の形（`isDrawnLineShape`）は変わらず今の曲線・弧を含まないこと、弧の端点から引き始める・弧の端点で終えるとつながること（弧の部分は曲がり方を持つ区間2つ）、同じ弧の両端の間を途中の点なしで引いても何も起きないことを足す。
*   **3章23.**：弧の結合でできた頂上の点・パスの途中になった弧の端の点も曲がり方を持つ区間に接する点として`LINE_CORNER`（チェックが入った見た目で押せない）を足す。
*   **`_doc/arch/12_shapes.md`**：`PathJoinRules`（公開に`lineEndpointOf`・`endpointVertexIndexOf`を足す、`isJoinableLine`に弧、`classifyJoin`の`typeOk`をやめたこと、`chainSourceOf`の弧の分岐と非公開の`arcChainSourceOf`・`QUARTER_ELLIPSE_BEZIER_K`、`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`のAの端点を`lineEndpointOf`で読むこと、Bは`chainOf`の並び、作成途中の線の約束の読み方は別）。`EndpointSnapRules`（importに2つ足したこと、`resolveEndpointHandle`は`endpointVertexIndexOf`に任せ弧のハンドルは`null`、`findNearestEndpoint`は`lineEndpointOf`、「注意」の頂点の番号の約束の記述を直す）。`Ellipse.js`（弧は結合できる線で、結合すると`PathJoinRules`が区間として読みパスになる。`Ellipse`のコードは変えていない）。
*   **`_doc/arch/14_edit.md`**：`PathJoiner`（責務の結合できる線に弧）・`EndpointSnapper`の結合できる線の列挙に弧を足す（コードは変えていない）。
*   **`_doc/arch/15_io.md`**：`bezierPath`の`cubic`になる区間に弧の結合でできた`'bezier'`を足す（`io/`のコードは変えていない）。
*   **`_doc/arch/16_test.md`**：Phase 09-03bの追加分（ファイルごとの件数と観点）・書き換えた既存のテスト（要件Dの1.(1a)(1b)(1c)・2.の計4ケース＋補助`JOIN_REJECTED_KINDS`の中身とJSDoc）・テストできない箇所・完了時の件数。

## 3. タスクリスト
*   [x] タスク1: 要件A・要件B 弧を結合できる線にし、区間として読み、端点の読み方を1か所にする（`shapes/PathJoinRules`・`shapes/EndpointSnapRules`）と既存のケースの書き換え
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` : 更新
        *   `./js/shapes/EndpointSnapRules.js` : 更新
        *   `./test/shapes/PathJoinRules.test.js` : 更新（要件Dの書き換え1.だけ）
        *   `./test/shapes/EndpointSnapRules.test.js` : 更新（要件Dの書き換え2.だけ）
    *   **作業内容** :
        *   要件Aのとおり`PathJoinRules.js`を変える（`QUARTER_ELLIPSE_BEZIER_K`・`arcChainSourceOf`・`lineEndpointOf`・`endpointVertexIndexOf`の新設、`isJoinableLine`・`chainSourceOf`・`classifyJoin`・`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`のコード、ファイル先頭の責務定義と各JSDoc）。新設の関数・定数にはJSDoc（責務・`@param`・`@returns`）を書く。
        *   要件Bのとおり`EndpointSnapRules.js`を変える（importに2つ、`resolveEndpointHandle`・`findNearestEndpoint`のコード、typedef`SnapTarget`・`resolveEndpointHandle`・`findSnapTarget`・`findNearestEndpoint`のJSDoc）。
        *   要件Dの「書き換える既存のケース」1.・2.をこのタスクで書き換える（ほかのケースは変えない・足さない）。
        *   `node --test`が全件通ることを確かめ、件数を記録する（ケースを足さないため tests 2002 / suites 322 のまま）。書き換え以外の既存のケースが落ちたら直さずに中断し、質問として報告する。
        *   コード修正完了後、JSDocコメントの記載漏れがないことを確認し、作業レポート（本RESファイル）の4.のタスク1の詳細作業内容を記載し、開発資料の記載に影響が出る場合は資料本体を修正せず『開発資料の更新予定』欄に追記する。
*   [x] タスク2: 要件D 結合の規則のテストを足す（`test/shapes/PathJoinRules.test.js`）
    *   **対象ファイル** :
        *   `./test/shapes/PathJoinRules.test.js` : 更新（ケースの追加）
    *   **作業内容** :
        *   要件Dの「足すケース」のタスク2の分を足す（既存のケースは変えない。補助関数を足すときはJSDocを書く。形のずれの点は`js/shapes/ShapeGeometry.js`がexportする`cubicBezierPoint`で求める＝このテストファイルは既に`../../js/shapes/ShapeGeometry.js`からimportしている）。ソースは変えない。
        *   `node --test`が全件通ることを確かめ、件数を記録する。テストが落ちてソースの直しが要ると判断したときは、直さずに中断して質問として報告する。
        *   コード修正完了後、JSDocコメントの記載漏れがないことを確認し、作業レポート（本RESファイル）の4.のタスク2の詳細作業内容を記載し、開発資料の記載に影響が出る場合は資料本体を修正せず『開発資料の更新予定』欄に追記する。
*   [x] タスク3: 要件D 吸い付き・角・区間の切り替えの規則のテストを足す（`test/shapes/`の残り3ファイル）
    *   **対象ファイル** :
        *   `./test/shapes/EndpointSnapRules.test.js` : 更新（ケースの追加）
        *   `./test/shapes/PathCornerRules.test.js` : 更新（ケースの追加）
        *   `./test/shapes/PathSegmentKindRules.test.js` : 更新（ケースの追加）
    *   **作業内容** :
        *   要件Dの「足すケース」のタスク3の分を足す（既存のケースは変えない。補助関数を足すときはJSDocを書く）。ソースは変えない。タスク1の後であればタスク2と順序を問わない（タスク2の結果に依らない）。
        *   `node --test`が全件通ることを確かめ、件数を記録する。テストが落ちてソースの直しが要ると判断したときは、直さずに中断して質問として報告する。
        *   コード修正完了後、JSDocコメントの記載漏れがないことを確認し、作業レポート（本RESファイル）の4.のタスク3の詳細作業内容を記載し、開発資料の記載に影響が出る場合は資料本体を修正せず『開発資料の更新予定』欄に追記する。
*   [x] タスク4: 要件C 手順の層の確認とテスト（`edit/PathJoiner`のJSDoc・`edit/`のテスト）
    *   **対象ファイル** :
        *   `./js/edit/PathJoiner.js` : 更新（先頭の責務定義のJSDocだけ）
        *   `./test/edit/PathJoiner.test.js` : 更新（ケースの追加）
        *   `./test/edit/EndpointSnapper.test.js` : 更新（ケースの追加）
    *   **作業内容** :
        *   `PathJoiner.js`の先頭の責務定義の括弧書きを「直線・開いたパス・今の曲線・弧」に直す（3行以内のまま。コード・ほかのJSDocは変えない）。
        *   要件Cの経路（`PathJoiner`・`EndpointSnapper`・`InputTracker`が規則の結果に従うだけであること）を実コードで確かめ、要件Dの「足すケース」のタスク4の分を足す（既存のケースは変えない。`Ellipse`のimportを足してよい）。
        *   `node --test`が全件通ることを確かめ、件数を記録する。
        *   コード修正完了後、JSDocコメントの記載漏れがないことを確認し、作業レポート（本RESファイル）の4.のタスク4の詳細作業内容を記載し、開発資料の記載に影響が出る場合は資料本体を修正せず『開発資料の更新予定』欄に追記する。
*   [x] タスク5: 要件D 保存・書き出しのテスト（`io/`。コードは変えない）
    *   **対象ファイル** :
        *   `./test/io/DocumentSerializer.roundtrip.test.js` : 更新（ケースの追加）
        *   `./test/io/SpriteSerializer.test.js` : 更新（ケースの追加）
    *   **作業内容** :
        *   要件Dの「足すケース」のタスク5の分を足す（既存のケース・補助は変えない。結合の結果は`shapes/PathJoinRules`の`planJoin`で作る。09-03aの`describe('曲がり方を持つ区間を含むパスの往復（Phase 09-03a）')`・`describe('SpriteSerializer: 曲がり方を持つ区間を含むパス（Phase 09-03a）')`の書き方にそろえる）。`io/`のソースは変えない。
        *   `node --test`が全件通ることを確かめ、件数を記録する。
        *   コード修正完了後、JSDocコメントの記載漏れがないことを確認し、作業レポート（本RESファイル）の4.のタスク5の詳細作業内容を記載し、開発資料の記載に影響が出る場合は資料本体を修正せず『開発資料の更新予定』欄に追記する。
*   [x] タスク6: 仕上げの確認（JSDoc・スコープ・全テスト）
    *   **対象ファイル** :
        *   なし（確認のみ。漏れがあればタスク1〜5の対象ファイルの範囲で直す）
    *   **作業内容** :
        *   コード修正完了後、JSDocコメントの記載漏れがないことを確認する（新設の関数・定数・補助関数、意味が広がった関数のJSDoc、ファイル先頭の責務定義が3行以内）。
        *   変更したファイルがタスク1〜5の対象ファイルだけであること、`core/`・`edit/`（`PathJoiner`のJSDoc以外）・`io/`・`palette/`・`main.js`・`index.html`・`Ellipse`・`Path`・`PathCornerRules`・`PathSegmentKindRules`・`ShapeGeometry`・`KeyboardShortcuts.js`の対応表を変えていないこと、改名・整形・削除（`classifyJoin`の`typeOk`と、`buildJoinedPath`系のAの頂点の変数`A`は要件Aで消す）が無いこと、`toJSON().points`の先頭・末尾を結合できる線の端点として直接読む箇所が`PathJoinRules`・`EndpointSnapRules`に残っていないこと（作成途中の線の約束の読み方は除く）を`git diff`と検索で確かめる。
        *   `node --test`の全件の合格と件数を記録する。
        *   作業レポート（本RESファイル）の4.のタスク6の詳細作業内容を記載し、開発資料の記載に影響が出る場合は資料本体を修正せず『開発資料の更新予定』欄に追記する。
*   [x] タスク7: 要件E テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   `./_log/res/261120_1131_RES_Phase09-03b_Arc_Join.md` : 更新（4.のタスク7の欄）
    *   **作業内容** :
        *   要件Eの確認項目を、実装の結果に合わせて文言を確かめて4.のタスク7の欄に書く（注意点があれば足す）。
        *   開発資料の記載に影響が出る点に気づいた場合は、資料本体を修正せず『開発資料の更新予定』欄に追記する。
*   [x] タスク8: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
        *   `./_doc/arch/12_shapes.md` : 更新
        *   `./_doc/arch/14_edit.md` : 更新
        *   `./_doc/arch/15_io.md` : 更新
        *   `./_doc/arch/16_test.md` : 更新
    *   **作業内容** :
        *   各タスクで記録した『開発資料の更新予定』を確認し、開発資料（`PROJECT_ARCHITECTURE.md`と、`_doc/arch/`の該当ファイル）へ反映する（※実装AIによる開発資料の書き換えは原則禁止であるが、この最終タスクのみ明示的な例外とする）。
        *   反映で直す箇所は少なくとも次のとおり：`PROJECT_ARCHITECTURE.md`の2章`arc`（結合できること・結合した後の形）・`path`（弧から作られること・近似のずれ）、3章11.・12.（結合できる線・吸い付く対象に弧を足す。弧自身のハンドルは吸い付かないこと。「やらないこと」の弧の結合を直す）・22.（続けて引く線の形は変わらないこと）・23.（頂上の点の扱い）、1章「存在しないもの」（弧の結合を消し、弧の側からの吸い付きなどを足す）。`_doc/arch/`の該当ファイル（`12_shapes.md`・`14_edit.md`・`15_io.md`・`16_test.md`）。
        *   作業レポート（本RESファイル）の4.のタスク8の詳細作業内容を記載する（タスク1〜7は各タスクの作業内容のとおり資料本体を直さず『開発資料の更新予定』へ追記する。本タスクだけが資料本体を直す）。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件A・要件B 弧を結合できる線にし、区間として読み、端点の読み方を1か所にする（`shapes/PathJoinRules`・`shapes/EndpointSnapRules`）と既存のケースの書き換え
*   **作業内容** :
    *   `js/shapes/PathJoinRules.js`：責務定義に弧を追加。定数`QUARTER_ELLIPSE_BEZIER_K`・非公開`arcChainSourceOf`・公開`lineEndpointOf`・`endpointVertexIndexOf`を新設。`isJoinableLine`に弧を追加、`chainSourceOf`に弧の分岐、`classifyJoin`の2本分岐を`isJoinableLine`のみに（`typeOk`削除）、`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`の端点を`lineEndpointOf`で読むよう変更。関連JSDoc（`EndpointRef`・`isDrawnLineShape`・`segmentSpecsOf`・`chainOf`・`buildClosedPath`・`classifyJoin`・`buildJoinedPath`）を更新。
    *   `js/shapes/EndpointSnapRules.js`：importに2名追加、`resolveEndpointHandle`は`endpointVertexIndexOf`で判定（弧は常にnull）、`findNearestEndpoint`は`lineEndpointOf`で端点を読む。JSDoc（`SnapTarget`・`resolveEndpointHandle`・`findSnapTarget`・`findNearestEndpoint`）更新。
    *   テスト書き換え（要件D 1.・2.）：`PathJoinRules.test.js`の`JOIN_REJECTED_KINDS`・補助JSDoc・2ケース名・(1c)の末尾にアサーション2つ、`EndpointSnapRules.test.js`の弧の行除去と名前変更。
    *   `node --test`：tests 2002 / suites 322 / pass 2002 / fail 0。

### タスク2: 要件D 結合の規則のテストを足す（`test/shapes/PathJoinRules.test.js`）
*   **作業内容** :
    *   `test/shapes/PathJoinRules.test.js`：importに`lineEndpointOf`・`endpointVertexIndexOf`を追加。末尾に補助（`ARC_K`・`makeArc`・`arcBeziers`・`assertSegmentsNear`・`assertArcPartOnEllipse`・`assertDegenerateArcPart`。すべてJSDoc付き）と`describe('PathJoinRules 弧の結合（Phase 09-03b）')`を追加。観点：結合できる線の判定、変換（形のずれ3e-4・接線・円の上半分・半径0の2種）、`planJoin`／`buildJoinedPath`（重なる・離れる・直線＋弧の逆順・パス・曲線のパス・今の曲線・別の弧・スタイル・id・引数不変）、半月形で閉じる・弧1本はnull、`buildJoinedPathAt`・`buildExtendedPath`、`planDrawnLineJoin`、`planEndpointDragJoin`、結合後の`setVertex`・`translate`、`lineEndpointOf`・`endpointVertexIndexOf`（`fromJSON`の正準でない弧を含む）。既存のケース・ソースは変えていない。
    *   `node --test`：tests 2038 / suites 332 / pass 2038 / fail 0（作業前 2002 / 322。足したのは36ケース・10 describe）。

### タスク3: 要件D 吸い付き・角・区間の切り替えの規則のテストを足す（`test/shapes/`の残り3ファイル）
*   **作業内容** :
    *   `test/shapes/EndpointSnapRules.test.js`：末尾に`describe('EndpointSnapRules 弧の吸い付き（Phase 09-03b）')`（補助`makeArc`・`makeOddArc`はJSDoc付き）。観点：左端・右端が吸い付く、中心・頂上は対象外、`fromJSON`で`[3]`・`[4]`が正準でない弧は左端・右端のみ、`resolveEndpointHandle`が弧の5ハンドルで`null`、ほかの線のドラッグ中に弧の端点が候補、`findDrawnLineSnapTarget`で描き始めが弧の始点なら終点のみ候補、円の点には吸い付かない。7ケース。
    *   `test/shapes/PathCornerRules.test.js`：`planJoin`のimportを追加し、`describe('PathCornerRules と弧の結合（Phase 09-03b）')`（頂上・弧の右端だった点が`LINE_CORNER`、「角」が押せない・チェックあり）。2ケース。
    *   `test/shapes/PathSegmentKindRules.test.js`：`planJoin`のimportを追加し、`describe('PathSegmentKindRules と弧の結合（Phase 09-03b）')`（左端と頂上で「直線に」のみ押せる、区間0だけ`line`で区間1の`bezier`は残る、「曲線に」は空配列）。3ケース。
    *   既存のケース・ソースは変えていない。`node --test`：tests 2050 / suites 335 / pass 2050 / fail 0（タスク2後 2038 / 332 から12ケース・3 describe 増）。

### タスク4: 要件C 手順の層の確認とテスト（`edit/PathJoiner`のJSDoc・`edit/`のテスト）
*   **作業内容** :
    *   `js/edit/PathJoiner.js`：先頭の責務定義の括弧書きを「直線・開いたパス・今の曲線・弧」に直した（3行のまま。コード・ほかのJSDocは変えていない）。
    *   経路の確認：`PathJoiner`は`classifyJoin`・`planJoin`、`EndpointSnapper`は`resolveEndpointHandle`・`findSnapTarget`・`findDrawnLineSnapTarget`・`planDrawnLineJoin`・`planEndpointDragJoin`の結果に従うだけで、図形種別を見ていない（コードは変えていない）。
    *   `test/edit/PathJoiner.test.js`：`Ellipse`のimportと補助`makeArc`（JSDoc付き）を追加。2ケース（偽の依存：弧と直線の`canJoin`真・弧1本の`canJoin`偽・`replaceShape`の区間`['bezier', 'bezier', 'line']`／実物：結合→取り消し1回で弧と直線に戻る（弧の`toJSON()`が元と同じ）→やり直しで結合後）。
    *   `test/edit/EndpointSnapper.test.js`：`Ellipse`のimportと補助`makeArc`（JSDoc付き）を追加。6ケース（`resolveDragEndpoint`が弧の5ハンドルで`null`／`findDrawSnap('line'・'curve')`が弧の始点／`findDragSnap`が弧の右端／`joinDraggedEndpoint`が`select: true`で`bezier`2つを含むパス／`commitDrawnLine`が弧のidを保つ・区間`['bezier', 'bezier', 'line']`／実物：直線のツールで弧の右端から引き始めて終える→弧のid・色・太さの開いたパス・履歴1件・取り消しで弧に戻る）。既存のケースは変えていない。
    *   `node --test`：tests 2058 / suites 335 / pass 2058 / fail 0（タスク3後 2050 / 335 から8ケース増。新しいdescribeは作らず`test`を追加）。

### タスク5: 要件D 保存・書き出しのテスト（`io/`。コードは変えない）
*   **作業内容** :
    *   `test/io/DocumentSerializer.roundtrip.test.js`：末尾に補助`joinForArcRoundtrip`（JSDoc付き）と`describe('弧を結合した結果の往復（Phase 09-03b）')`を追加。弧と直線（開いた）・半月形の閉じた塗りありのパス・弧2本の結合の3状態を`ROUTES`（オブジェクト層・文字列層）で往復し、`toJSON()`・`segments`が同じ・`version`が2・`console.warn`が0回を確かめる（6ケース）。
    *   `test/io/SpriteSerializer.test.js`：末尾に`describe('SpriteSerializer: 弧を結合した結果（Phase 09-03b）')`（describe内の補助`joinArc`はJSDoc付き）。3ケース（区間`['cubic','cubic','line']`・`control1`/`control2`が作業データと一致・`toDrawElement().segments`と一致・`formatVersion`3・外枠が`sampleBezierPathRange`＋線の太さの半分と1e-3で一致／弧と外接矩形内の直線R→(100,200)の結合の外枠が元の弧の`ellipse`の外枠と1e-6で一致／半月形は`closed: true`・`fillColor`あり）。
    *   既存のケース・補助・`io/`のソースは変えていない。`node --test`：tests 2067 / suites 337 / pass 2067 / fail 0（タスク4後 2058 / 335 から9ケース・2 describe 増）。

### タスク6: 仕上げの確認（JSDoc・スコープ・全テスト）
*   **作業内容** :
    *   `git diff`で、変更ファイルがタスク1〜5の対象ファイル（`PathJoinRules`・`EndpointSnapRules`・`PathJoiner`のJSDoc・`test/`の各ファイル）だけであることを確かめた。`core/`・`io/`・`palette/`・`main.js`・`index.html`・`Ellipse`・`Path`・`PathCornerRules`・`PathSegmentKindRules`・`ShapeGeometry`・`KeyboardShortcuts.js`は変更なし。
    *   `toJSON().points`の先頭・末尾の直接読みを検索：`PathJoinRules`の`lineEndpointOf`内（`chainSourceOf`の結果を読む）、`buildClosedPath`（`type==='path'`のみ）、作成途中の線の約束の読み方（`tip`）、`EndpointSnapRules`の作成途中の線の始点のみ。結合できる線の端点を直接読む箇所は残っていない。
    *   監査の軽微な指摘3点を直した：(1)`PathJoinRules.js`の`chainSourceOf`の`@returns`を「今の曲線・弧なら…」に、(2)`buildClosedPath`のJSDocの一文「今の曲線・弧1本は`null`」を`@param`より前へ移動、(3)`PathJoinRules.test.js`の「半径0の弧（点）」のケースに`coordsOf(data.points).slice(0, 3)`が`[[10,10],[10,10],[10,10]]`であるassertを追加。
    *   `node --test`：tests 2067 / suites 337 / pass 2067 / fail 0（ケース数は変わらず）。開発資料への影響は新たになし。
    *   再指摘の修正：`buildClosedPath`のJSDocで、一文「今の曲線・弧1本は`null`」が`@param tolerance`の続きに読まれていたため、最初の`@param {Object} shape`より前の本文末尾へ移した。`node --test`は全件合格（2067 / fail 0）。

### タスク7: 要件E テストプレイの確認項目を発注者へ提示する
*   **テストプレイ結果** : 2026-11-20 発注者が下の確認項目0〜9でテストプレイを行い、OK（不具合の報告なし）。
*   **作業内容** :
    *   タスク1〜6の実装結果（要件Eの文言と、5.懸念事項の内容）に照らして要件Eの項目0〜9の文言を確かめた。実装と食い違う箇所は無く、計画時点の文言のまま次を発注者へ提示する。コードは変えていない。
    *   **確認項目（発注者のテストプレイ用）**
        0. **準備**：ブラウザで画面を開き、`Ctrl`+`F5`で最新の状態にする。弧は弧のツール（`3`）で描く。
        1. **結合のボタン・`J`**：弧と直線（直線のパス・曲線のパス・今の曲線・別の弧でも）を選択（`V`）で2本選ぶと結合のボタンが押せる。押す（`J`でも）と1本のパスになり、弧の部分の形は見た目で変わらない（ずれは半径の約0.03%以内）。端点が離れていれば間が直線でつながる。弧1本だけでは押せない。弧と円・矩形の2つでは押せない。
        2. **ほかの線から吸い付ける**：頂点の選択（`A`）で直線・パスの端の点をドラッグして弧の左端・右端に近づけると吸い付き（青い四角）、離すと結合する。弧の中心・頂上には吸い付かない。弧そのものは頂点の選択で点が出ず（今までどおり）、弧の線の上を押してドラッグすると範囲選択になって弧は動かず、どこにも吸い付かない（弧の半径のハンドルは今の画面では出ないため、半径をドラッグで変える操作は無い）。
        3. **ツールでつながる・伸ばす**：直線のツール・曲線のツールで、弧の端から引き始める（弧の端に青い四角が出る）と、終えたときにその弧の続きとして伸びる（色・太さは弧のもの）。引いている途中に弧の端でクリックすると、その弧とつながる。弧の一方の端から引き始め、途中に点を打たずに同じ弧のもう一方の端でクリックしても何も起きない（途中に点を1つ以上打ってから弧のもう一方の端でクリックすると閉じた形になる）。弧のツールで描いている途中は吸い付かない。
        4. **閉じた形と塗り**：弧と直線1本で半月形を作り（直線の両端を弧の両端に重ねて置き、2本を選んで`J`で結合し、もう一度`J`で閉じる）、塗りの色を付けると内側が塗られ、内側のクリックで選べる。弧と曲線・パスを組み合わせた閉じた形も同じ。
        5. **結合した後の編集**：頂点の選択（`A`）で、元の弧の部分は両端と頂上の3つの点が出る（半径のハンドルは出ない）。頂上を動かすと両側の曲がりが一緒に動き、頂上でなめらかなまま。端の点を動かすとその点の側の曲がりが一緒に動く。パス全体を動かすと形ごと動く。
        6. **角と切り替え**：頂上の点を選ぶと「角」はチェックが入った見た目で押せない。頂上と端を選んで「直線に」を押すとその間が直線になる。「曲線に」では変わらない。
        7. **取り消し**：どの結合も、取り消し（`Ctrl`+`Z`）1回で結合の前に戻り、やり直しで結合した後に戻る。
        8. **保存・書き出し**：結合したパスを保存して開き直す（キャンバスの切り替え・コピー＆ペースト・複製（`Ctrl`+`D`）も）と同じ形に戻る。書き出して確認用ページ（`sprite-check.html`）で開くと、同じ形で描かれ、外枠が形を囲む。
        9. **ほかが今までどおり**：結合していない弧（塗れない・頂点の選択で点が出ない・選択（`V`）で動かせる・書き出すと弧のまま）、円（結合の対象にならない・吸い付かない）、今の曲線・直線・パスの結合・描き足し・閉じる、曲線のツール・直線のツールの連続作成、弧のツールで描く、「角」・「直線に」「曲線に」、選択・頂点の選択・位置の数値入力・整列・重なり順・保存・読み込み・書き出しが今までどおり動く。
    *   開発資料の記載に影響が出る点：新たになし（既存の『開発資料の更新予定』のとおり）。

### タスク8: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
*   **作業内容** :
    *   『開発資料の更新予定』に従い、次を反映した（コードは変えていない）。
    *   `PROJECT_ARCHITECTURE.md`：1章 構成図（`PathJoinRules`の行）・フォルダ分割の方針（`shapes/`。結合できる線に弧、`lineEndpointOf`・`endpointVertexIndexOf`）・「存在しないもの」（弧の結合の項を消し、弧自身のハンドルでの吸い付き・頂点の選択で弧に点を出すこと・弧1本の閉じる・誤差なく保つこと・弧の回転と角度変更・弧のツールでの吸い付きを足した）／2章 `path`（弧の結合で作られること）・`'bezier'`（弧の近似の式・係数・ずれ）・書き出しの`bezierPath`と`ellipse`の記述／3章 11.（結合できる線・`classifyJoin`の`typeOk`廃止・新項「弧の結合（Phase 09-03b）」・「やらないこと」）・12.（対象・弧のハンドルは`null`・やらないこと）・22.（続けて引く線の形は変わらない・弧の端点からつながる・同じ弧の両端は何も起きない）・23.（頂上の点・弧の端の点は`LINE_CORNER`）。3章6.は変更なし（弧の結合も同じ1件の記録で、記述の変更が不要）。
    *   `_doc/arch/12_shapes.md`：`PathJoinRules`（`isJoinableLine`・公開に`lineEndpointOf`・`endpointVertexIndexOf`・`classifyJoin`・`chainSourceOf`の弧の分岐と`arcChainSourceOf`・`QUARTER_ELLIPSE_BEZIER_K`・Aの端点の読み方）、`EndpointSnapRules`（import・`resolveEndpointHandle`・`findNearestEndpoint`・「注意」・`findSnapTarget`の対象）、`Ellipse.js`（弧は結合できる線）。
    *   `_doc/arch/14_edit.md`（`PathJoiner`・`EndpointSnapper`）、`_doc/arch/15_io.md`（弧の結合でできた`'bezier'`の往復・`bezierPath`）、`_doc/arch/16_test.md`（Phase 09-03bの追加分の件数と観点・書き換えた既存の4ケース＋補助・テストできない箇所・完了時の件数 tests 2067 / suites 337）。
    *   `node --test`は実行していない（ドキュメントのみの変更）。

## 5. 懸念事項・要確認ポイント
* **弧の半径のハンドルは今の画面では操作できない**：Phase 08-02aから、選択（`V`）ではハンドルを当たりに含めず、頂点の選択（`A`）では弧に点が出ない。REQのテストプレイの項目2の「弧自身の左右の端のハンドルをドラッグすると、今までどおり半径が変わり、どこにも吸い付かない」は今の画面ではその操作自体ができないため、要件Eの項目2・9の文言を「弧は頂点の選択で点が出ず、線の上を押してドラッグすると範囲選択になり、どこにも吸い付かない」に直した。弧自身のハンドルが端点として解決されないことは自動テスト（`resolveEndpointHandle`・`resolveDragEndpoint`）で確かめる。
* **同じ弧の両端の間を途中の点なしで引いても何も起きない**：`planCloseOf`→`buildClosedPath`は`'path'`だけを受け付けるため（今の規則のまま。直線・今の曲線の同じ操作と同じで、弧1本の閉じるは対象外という決定とも合う）。半月形は、弧と直線を結合して`J`で閉じる・途中に点を1つ以上打つ・頂点の選択で結合したパスの端の点をもう一方の端へドラッグする（頂点4つ以上のため閉じられる）のどれかで作れる。発注者が「直線のツールで弧の両端を結ぶだけで半月形にしたい」と言う場合は、別の作業で`buildClosedPath`の受け付けを見直す必要がある。
* **端点をまとめるとき、除いたBの端点の側の引っ張る点は動かさない**（09-03aと同じ。`_doc/COWORK_STATUS.md` 2章B）：弧がBで端点が5px以内で離れていた場合だけ、その差の分弧の端の近くの形がわずかに変わる（吸い付きでの結合・完全に重なる場合は元のまま）。
* **形のずれ**：結合した弧の部分は楕円の4分の1の標準の近似で、ずれは半径の最大約0.027%（半径100pxで約0.03px）。両端と頂上は弧の上にちょうど乗る。見た目で区別できない想定だが、テストプレイの項目1で確かめる。結合した後の当たり判定・範囲選択・塗りの内側は`Path`の折れ線近似（分割数100）を使う（結合する前の弧の当たり判定とは別の式で、許容量の考え方が少し違う）。
* **`fromJSON`で`points[3]`・`[4]`が正準の位置でない弧**：結合の端点は中心と半径から求めた左端・右端で、描画と同じ形になる（`points[3]`・`[4]`の位置には吸い付かない）。エディタが作る弧では`[3]`・`[4]`は常に左端・右端の位置にある。
* **既存のテストの書き換え**：要件Dの1.(1a)(1b)(1c)・2.の計4ケース（と補助`JOIN_REJECTED_KINDS`の中身・補助のJSDoc）。`JOIN_REJECTED_KINDS`から弧を除くため、(1a)(1b)(1c)は弧を確かめなくなり、弧の判定は要件Dのタスク2の新しいケースで確かめる。
* **タスク4で気づいた点**：実物の組み合わせ（弧の端点から描き足す）は、`finishDrawnLine`の前に`clickDrawnLine`で点を1つ打つ必要がある（`startDraft`＋`updateDraft`だけだと作成途中の線は始点＋付いてくる先だけで、終えるときに先が捨てられ始点だけになり何も残らない。既存の直線のテストと同じ手順）。
* **タスク8で気づいた点**：`PROJECT_ARCHITECTURE.md`の1章「存在しないもの」には「弧の曲線の区間としての取り込み」に当たる項が他にも残っていないことを検索で確かめた。`_doc/arch/`の`17_sprite_check.md`ほかは弧の結合に触れる記述が無く変更していない。今後、弧の閉じる（同じ弧の両端の間を途中の点なしで引く）を許す場合は`buildClosedPath`の受け付けとともに3章11.・22.の該当記述を直すこと。
* **タスク5で気づいた点**：弧2本の結合（弧(100,200)と弧(220,200)）は右端と左端(160,200)が重なるため端点がまとめられ、区間は`['bezier'×4]`（頂点5つ・間の直線の区間なし）になる。要件Dの記述の「頂点5つ・`'bezier'`4つ」と同じ。
