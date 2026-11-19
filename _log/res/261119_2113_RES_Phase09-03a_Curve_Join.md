# RES: 作業計画・作業レポート (Phase 09-03a) : 今の曲線の結合（曲がり方を持つ曲線の区間）
* 参照元REQ: `./_log/req/261119_2059_REQ_Phase09-03a_Curve_Join.md`

## 1. 作業目的
今の曲線（1本の2次の曲線。`type: 'curve'`）を、直線・開いたパスと同じように端点で結合できるようにする（結合のボタン・`J`、頂点の選択（`A`）での端点のドラッグ、直線・曲線のツールでのつながる・伸ばす）。結合すると、今の曲線の部分は形を保ったまま（誤差なし）パスの区間になる。今の曲線の形は打った点の曲線の区間（`'smooth'`）では表せないため、**区間ごとに3次ベジェの2つの制御点（引っ張る点）を持つ「曲がり方を持つ区間」**をパスの新しい区間の種類として足す。

最上位の要件（REQ）：
* リポジトリのルートの`node --test`が全件通る（作業前は tests 1926 / suites 306）。既存のテストの期待値は変えない（「今の曲線は結合できない」ことを確かめている既存のケースだけは書き換えてよい。書き換えるケースと理由は「2. 要件F」に列挙）。
* 今の曲線を結合しない限り、作業データ・描画・当たり判定・書き出しの結果を変えない（新しい区間の種類を含まないパスの`toJSON()`は今と同じ）。
* 作業データの版は2、書き出し形式の版は3のまま。新しい区間の種類を含むパスは、古いエディタでは未知の区間の種類としてその図形だけがスキップされる。書き出しは今の`bezierPath`の`cubic`で表す。
* 結合した瞬間の形は元の今の曲線とまったく同じ（2次の曲線は3次ベジェで誤差なく表せる。描画・当たり判定・書き出しのすべてで同じ形）。
* 改名・整形・不要に見えるコードの削除をしない。キーの割り当ての表を変えない。共通メソッド契約（18メソッド）を増やさない。

弧の結合は後半（Phase 09-03b）で行い、本作業では扱わない。

## 2. アーキテクチャ設計

### 全体の方針
* **変えるのは`js/shapes/`の4ファイルのコードだけ**：`Path.js`（曲がり方を持つ区間の保持・形・ついていくふるまい・変換）、`PathJoinRules.js`（結合できる線に今の曲線を足す・今の曲線を区間として読む・区間の並びが引っ張る点を運ぶ）、`PathCornerRules.js`（角の切り替えの組み立てで引っ張る点を保つ）、`PathSegmentKindRules.js`（「直線に」で曲がり方を持つ区間も変わる・組み立てで引っ張る点を保つ）。
* **JSDocだけを直すファイル**：`js/shapes/EndpointSnapRules.js`（「結合できない線（今の曲線…）」の記述）、`js/edit/PathJoiner.js`（先頭の責務定義の括弧書き「直線・開いたパス」。憲法3章の責務定義を実態に合わせるため。コードは変えない）。
* **変えないもの**：`ShapeGeometry.js`（打った点の曲線の区間の式。曲がり方を持つ区間は`smoothFlags`で偽として渡すため、隣の打った点の曲線の区間は今の「隣が曲線の区間でないとき仮の点」の分岐で角になり、式は変えずに済む。実コード（`computeSmoothSegmentControls`の`hasPrev`・`hasNext`）で確かめた）・`Curve.js`・`Line.js`・`Rect.js`・`Ellipse.js`・`ShapeDataValidation.js`・`ShapeFactory.js`・`core/`・`io/`・`edit/`（`PathJoiner.js`のJSDocを除く）・`palette/`・`wiring/`・`check/`・`main.js`・`index.html`・`sprite-check.html`。
* **新しいソースのファイルは作らない**。テストは既存のテストファイルへ`describe`を足す（新しいテストファイルも作らない）。
* **区間の種類・図形種別の分岐、今の曲線から区間への変換、引っ張る点の計算・ついていくふるまいは`shapes/`に閉じる**。`edit/`・`core/`・`io/`・`main.js`は今の経路（`setVertex`・`translate`・`toJSON`/`fromJSON`・`toDrawElement`・`PathJoinRules`の計画）をそのまま通るだけで、曲がり方を持つ区間を知らない（下の「要件E」で経路を確かめた）。

### 要件A: 曲がり方を持つ区間（`js/shapes/Path.js`）
* **作業データ上の名前**：区間の種類`'bezier'`（作業データの語彙。書き出しの描画要素の`'cubic'`とは別の語彙。09-01aで作業データの`'smooth'`と書き出しの`'cubic'`を分けたのと同じ考え）。定数`export const SEGMENT_KIND_BEZIER = 'bezier';`を`SEGMENT_KIND_SMOOTH`の直後に足す（唯一の定義箇所。JSDoc：「曲がり方を持つ区間（区間ごとに3次ベジェの2つの制御点＝引っ張る点を持ち、形が両端の頂点と引っ張る点で決まる曲線）の種類」）。
* **図形データの形**：`segments[i]`は今の`{ kind: 'line' }`・`{ kind: 'smooth' }`に加え、`{ kind: 'bezier', control1: { x, y }, control2: { x, y } }`（キー順もこの順）。`control1`＝区間の始点`points[i]`の側の引っ張る点、`control2`＝終点`points[(i + 1) % n]`の側の引っ張る点。**ワールド座標の絶対座標で持つ**（書き出しの`cubic`の制御点と同じ値。持ち方の理由は下の「ついていくふるまい」）。`'line'`・`'smooth'`の区間の`toJSON()`は今と同じ`{ kind }`だけ（キーは増えない）。
* **区間の指定（typedef`SegmentSpec`を新設）**：コンストラクタの第6引数が配列のときの要素の形。「区間の種類の文字列」または「区間の値`{ kind, control1?, control2? }`（`toJSON()`の`segments`の要素の形）」。`kind`が`'bezier'`の区間の値は`control1`・`control2`を持つこと（呼び出し側の責任。検証しない）。文字列の`'bezier'`・第6引数の文字列（全区間へ当てる種類）に`'bezier'`を渡してはならない（引っ張る点が無いため）ことをJSDocに書く。
* **区間の写しの唯一の箇所（非公開の関数`copySegment(spec)`を新設。モジュール内の関数）**：文字列なら`{ kind: spec }`、`kind`が`'bezier'`なら`{ kind, control1: { x, y }, control2: { x, y } }`（座標を新しいオブジェクトへ写す）、それ以外は`{ kind: spec.kind }`（余分なキーは捨てる）。コンストラクタ（配列の各要素）・`toJSON()`・`fromJSON`がこれを使う。
* **コンストラクタ**：第6引数が配列なら`segmentKind.map(copySegment)`で`segments`を作る（渡された配列・要素・座標を保持しない）。文字列のときは今のまま。第6引数のJSDocを「文字列なら全区間の種類（`'line'`か`'smooth'`）。配列なら区間ごとの区間の指定（`SegmentSpec`）の並び」に直す。既存の呼び出し（文字列の配列）はそのまま働く。
* **形の求め方は`#segmentControls`の1か所**：今の`computeSmoothSegmentControls(points, smoothFlags, closed, corners)`の結果（`smoothFlags`は今どおり`kind === SEGMENT_KIND_SMOOTH`。曲がり方を持つ区間は偽＝打った点の曲線の区間として数えない）を、区間ごとに見て、`kind`が`'bezier'`の区間だけ`{ control1, control2 }`（区間の値の座標の新しい写し）に置き換えて返す。描画（`#tracePath`）・当たり判定／範囲選択（`#someSegment`）・塗りの内側（`#fillPolygon`）・`toDrawElement`はこの結果を共有しているため、ほかの箇所に分岐を足さない。これで：
  * 曲がり方を持つ区間は3次ベジェ（`bezierCurveTo`）で描かれ、当たり判定・範囲選択・塗りの内側は`SMOOTH_SEGMENT_SAMPLE_COUNT`（100）の折れ線近似、`toDrawElement`は`bezierPath`の`{ kind: 'cubic', control1, control2 }`（絶対座標）になる。
  * 隣の打った点の曲線の区間は、隣が曲がり方を持つ区間でも`smoothFlags`が偽のため仮の点（`2a − b`・`2b − a`）を使い、つなぎ目は角になる（形は隣が直線の区間のときと同じで、結合で隣り合っても変わらない）。
  * `SMOOTH_SEGMENT_SAMPLE_COUNT`・`#segmentControls`・`#tracePath`・`#someSegment`・`#fillPolygon`・`toDrawElement`のJSDocの「曲線の区間」を、曲がり方を持つ区間も含む記述に直す（名前は変えない）。
* **ついていくふるまい（発注者の決定）**：
  * `setVertex(vertexIndex, x, y)`：今の検査（範囲内の整数）のまま、置き換える前の頂点との差`dx = x − 前のx`・`dy = y − 前のy`を求めて頂点を`{ x, y }`で置き換え、非公開の新しいメソッド`#shiftControlsAt(vertexIndex, dx, dy)`を呼ぶ。`#shiftControlsAt`は、**その頂点を始点とする区間**（番号`vertexIndex`。区間の数未満のとき）が`'bezier'`なら`control1`を、**その頂点を終点とする区間**（開いたパスは`vertexIndex − 1`（0以上のとき）、閉じたパスは`(vertexIndex − 1 + n) % n`）が`'bezier'`なら`control2`を、それぞれ`(dx, dy)`だけ動かした新しい`{ x, y }`で置き換える。反対側の引っ張る点は動かない。区間がまっすぐに変わることはない。`updateDraftEnd`は`setVertex`を通るため同じ（作成途中の線は曲がり方を持つ区間を持たない）。
  * `translate(dx, dy)`：今の全頂点の移動に加え、`'bezier'`の区間の`control1`・`control2`もすべて`(dx, dy)`だけ動かす。
  * **持ち方の理由（絶対座標）**：(1) 書き出しの`cubic`の制御点（絶対座標）と同じ値で、`toJSON()`・テストの期待値が読みやすい。(2) 変形のPhaseで、頂点と同じ1次の変換（拡大縮小（縦横別を含む）・回転・反転。平行移動を含めても）を引っ張る点にもそのまま当てれば形も同じように変わる（頂点からの差で持つと、変換の線形の部分だけを当てる別の扱いが要る）。(3) 頂点を動かす経路は`setVertex`（`VectorModel.updateVertices`の1か所から呼ばれる）と`translate`（`VectorModel.moveShapes`・`moveShapesBy`・`ShapeInserter`のずらし）だけで、どちらも`Path`の中で引っ張る点を動かせる（`core/`・`edit/`に分岐を持ち込まない）。
* **`toJSON()`**：`segments`を`this.segments.map(copySegment)`で出す（`'line'`・`'smooth'`は今と同じ`{ kind }`、`'bezier'`は`{ kind, control1, control2 }`の新しいオブジェクト）。キー順・`corners`の出し方は変えない。
* **`fromJSON(data)`**：
  * `ACCEPTED_SEGMENT_KINDS`に`SEGMENT_KIND_BEZIER`を足す（受理を広げる）。
  * **未知の区間の種類のエラー文は今の文面のまま**（`segments[i]のkindが'line'・'smooth'ではありません（<値>）`）：既存のテスト（`test/shapes/Path.test.js`の5か所。文面の完全一致）の期待値を変えないため（最上位の要件）。文面の並びは`ACCEPTED_SEGMENT_KINDS`から`SEGMENT_KIND_BEZIER`を除いたもの（`filter`）で作り、その理由（既存の文面を保つため）をコメント・`ACCEPTED_SEGMENT_KINDS`のJSDocに書く。並びの定義そのものは`ACCEPTED_SEGMENT_KINDS`の1か所のまま（別の定数を作らない）。
  * `kind`が`'bezier'`の区間は、`control1`・`control2`のそれぞれが`isPlainObject`で`x`・`y`が`Number.isFinite`であることを検証し、そうでなければ`Error`（文面：`segments[<i>]のcontrol1がx・yを有限の数値で持つオブジェクトではありません`／`control2`も同じ形）。検証の順は「`segments[i]`がオブジェクトか → `kind`の受理 → 曲がり方を持つ区間の引っ張る点」。`corners`の検査は今どおり`segments`の検査の後。
  * 区間の作り直しは`path.segments = data.segments.map(copySegment)`（`'line'`・`'smooth'`の区間の余分なキー（`control1`等を含む）は今どおり無視）。
  * `@throws`に引っ張る点の条件を足す。
* **ファイル先頭の責務定義（3行以内）・クラスJSDoc**：「直線の区間と点を通るなめらかな曲線の区間からなる線」を「直線の区間・点を通るなめらかな曲線の区間・曲がり方を持つ曲線の区間（引っ張る点を区間に持つ3次ベジェ）からなる線」に直す（3行以内を保つ）。クラスJSDocに、区間の種類の3つ、曲がり方を持つ区間の引っ張る点は頂点ではない（ハンドルにならない。`getVertexHandleNames`・`hitTestHandle`・`drawHandles`は`points`だけを扱う＝変えない）、つなぎ目は常に角、頂点を動かしたときのふるまいを書く。
* **18メソッドは増やさない**（`#shiftControlsAt`は非公開）。

### 要件B: 今の曲線を結合できる線にする（`js/shapes/PathJoinRules.js`）
* **結合できる線**：`isJoinableLine(shape)`を`return isDrawnLineShape(shape) || shape.type === 'curve';`にする（判定の唯一の箇所。直線・開いたパス（区間の種類によらない）・今の曲線）。`isDrawnLineShape`（続けて引く線の形）は**変えない**（今の曲線は偽のまま）。両関数のJSDocの「同じ条件」の記述を「`isJoinableLine`は続けて引く線の形に今の曲線を足した条件（Phase 09-03a）」に直す。ファイル先頭の責務定義の「結合できる線＝直線と開いたパス（区間の種類によらない）」に今の曲線を足す（3行以内）。
* **2本の結合の受け付け**：`classifyJoin`の2本の分岐の`typeOk`に`'curve'`を足す（`type === 'line' || type === 'path' || type === 'curve'`）。1本の分岐（`type !== 'path'`ならnull）は変えない＝今の曲線1本は閉じない（結合のボタンは押せず`J`も何もしない）。JSDocの戻り値の説明に今の曲線を足す。
* **今の曲線を区間として読む唯一の箇所（非公開の関数`chainSourceOf(data)`を新設。`segmentKindsOf`の直後に置く）**：`data.type`が`'curve'`なら、今の曲線の`toJSON()`の値を「頂点2つ（始点・終点）と曲がり方を持つ区間1つの開いたパス」の図形データ`{ type: 'path', points: [始点, 終点], closed: false, segments: [{ kind: SEGMENT_KIND_BEZIER, control1, control2 }], strokeColor, strokeWidth, fillColor }`（スタイル3つは元の値。`corners`なし）に読み替えて返す。それ以外の図形の値はそのまま返す。頂点の並びは2章の`points`の約束（`points[0]`＝始点・`[1]`＝制御点・`[2]`＝終点）から読む。**2次から3次への変換の式の唯一の箇所**：`control1 = 始点 + (制御点 − 始点) × 2 / 3`、`control2 = 終点 + (制御点 − 終点) × 2 / 3`（各軸。**計算の順は「差に2を掛けてから3で割る」**＝`s.x + (c.x − s.x) * 2 / 3`。差が3の倍数の座標で厳密な値になるため）。2次ベジェの次数を上げた3次ベジェはすべての`t`で同じ点を通る（誤差なく同じ形）ことをJSDocに書く。
* **区間の並びが引っ張る点を運ぶ（公開の関数`segmentSpecsOf(data)`を新設。`segmentKindsOf`の直後）**：`toJSON()`の値から区間の指定（`Path`のコンストラクタの第6引数の要素＝`SegmentSpec`）の新しい配列を返す。`type`が`'line'`なら`segmentKindsOf(data)`（直線は直線の区間1つ。規則は`segmentKindsOf`に任せて写さない）、それ以外は`data.segments.slice()`（要素は`toJSON()`が作った区間の値のまま。`Path`のコンストラクタが写すため結果は共有しない）。直線とパスの`toJSON()`の値を渡す（今の曲線は`chainSourceOf`を通してから渡す）。使う側は`PathJoinRules`の中（`chainOf`）と`PathSegmentKindRules`。引数を書き換えない。`segmentKindsOf`は**変えない**（JSDocの「使う側」に`segmentSpecsOf`を足すだけ）。
* **`chainOf(data)`**：先頭で`const source = chainSourceOf(data);`とし、以降は`source`から今の処理（`readCornerFlags(source)`・端の点を偽）を行い、`kinds`を`segmentSpecsOf(source)`にする（今は`segmentKindsOf(data)`。直線・パスでは要素が文字列か区間の値になるが、`Path`のコンストラクタが同じ区間を作るため結果は今と同じ）。typedef`SegmentChain`の`kinds`の説明を「区間の並び（区間の指定`SegmentSpec`。種類の文字列か、曲がり方を持つ区間は引っ張る点を持つ区間の値）」に直す（プロパティ名は変えない）。
* **逆順（`reverseChain`）**：`kinds: chain.kinds.slice().reverse().map(reverseSegmentSpec)`にする。非公開の関数`reverseSegmentSpec(spec)`を新設：区間の値で`kind`が`'bezier'`なら`{ kind, control1: spec.control2, control2: spec.control1 }`（区間の向きが逆になるため2つの引っ張る点を入れ替える）、それ以外（文字列・ほかの区間の値）はそのまま返す。曲がり方を持つ区間を逆順にしても形は変わらない（3次ベジェは制御点の並びを逆にすると同じ曲線を逆向きにたどる）ことをJSDocに書く。
* **変えないで働く関数（実コードで確かめた）**：`assembleOpenPath`（`kinds`の連結。間を埋める区間は文字列のまま混ざってよい）・`buildClosedPath`（`type !== 'path'`で今の曲線1本はnull）・`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`（端点の座標は`toJSON().points`の先頭・末尾から読む。今の曲線の`points`は[始点, 制御点, 終点]で先頭・末尾が端点のため、2章の約束どおり正しい）・`canCloseByMergingEnds`（`type !== 'path'`で今の曲線は偽＝自分のもう一方の端点に吸い付かない）・`planJoin`・`planDrawnLineJoin`・`planEndpointDragJoin`・`planJoinAt`・`planCloseOf`・`extendWithPoints`・`planCloseWithPoints`・`planJoinWithPoints`。今の曲線の変換は`chainOf`（→`chainSourceOf`）だけを通り、結合・描き足し・端点のドラッグ・ツールのつながるごとに別々に書かない。作成途中の線の関数（`addDrawnPoint`ほか）は`isDrawnLineShape`のままで今の曲線を受け付けない。
* **結合の結果のふるまい**（今の結合の規則のまま）：基準の線A（重なり順で奥）の向き・色・太さ・塗り。今の曲線がAなら今の曲線のスタイルが結果に引き継がれる。2本の結合は新しいid／描き足し・閉じるは元のidと位置。端点が重なっていればまとめ（Bの端点を除きAの端点の座標を残す）・離れていれば間を埋める区間（ボタン・`J`は直線、ツールは描いた区間の種類）。つながってできた点はなめらかな点（`chainOf`が端の点の角の情報を偽にする）。結合後の選択は呼び出し側（今のまま）。
* **端点をまとめるとき、除いたBの端点の側の引っ張る点は動かさない**（計画で決めた点）：除いた端点につながっていた区間は残ったAの端点につながる区間として種類と引っ張る点を保つ（今の「種類を保つ」の規則のまま）。理由：まとめは利用者が頂点を動かす操作ではなく、今の規則（Bの端点を除く）に区間の種類の分岐を持ち込まないため。端点が完全に重なる場合（端点のドラッグでの吸い付き・ツールでの吸い付き）は距離0で形は元のまま。端点が5px以内で離れて重なっているとみなされた場合だけ、その端点の位置の差の分だけBの区間の端が動く（直線の区間・打った点の曲線の区間の端点をまとめたときと同じ扱い）。「5. 懸念事項」にも書く。
* **閉じる**：今の曲線1本だけは閉じない（今と同じく閉じたパスは頂点3つ以上が要る）。今の曲線を含む線で閉じた形を作るには頂点が3つ以上要る（例：今の曲線＋直線2本、今の曲線から引き始め途中に点を1つ以上打って今の曲線のもう一方の端点で終える）。今の曲線1本と直線1本だけの半月形は頂点2つのため閉じられない（「5. 懸念事項」）。

### 要件C: 吸い付き（`js/shapes/EndpointSnapRules.js`。JSDocだけを直す）
* 実コードで確かめた結果、コードは変えずに要件2.2・2.3を満たす：`resolveEndpointHandle`は`isJoinableLine`と「頂点の番号0が始点、`points.length − 1`が終点」に依る。今の曲線の`getVertexIndexForHandle`は`'start'`→0・`'control'`→1・`'end'`→2で、`points.length − 1`＝2のため、始点・終点のハンドルは端点、制御点のハンドル`'control'`は`null`（端点でない＝吸い付かない）。`findNearestEndpoint`は`toJSON().points`の先頭・末尾を端点として走査するため、今の曲線の始点・終点が吸い付く対象になり、制御点は対象にならない。`findSnapTarget`のドラッグ中の自分のもう一方の端点は`canCloseByMergingEnds`が偽のため対象にならない。`findDrawnLineSnapTarget`の`isJoinableLine(drawn)`は作成途中の線（今の曲線ではない）で今どおり真。
* JSDocの直し：`resolveEndpointHandle`の「結合できない線（今の曲線・矩形・円・弧・閉じたパス）」から今の曲線を除き、「結合できる線は直線・開いたパス（曲線のパスを含む）」に今の曲線（始点・終点が端点、制御点は端点でない）を足す。`findSnapTarget`の「対象は…結合できる線（直線・開いたパス。曲線のパスを含む）」に今の曲線を足す。ファイル先頭の責務定義は変えない。

### 要件D: 角・区間の切り替え（`js/shapes/PathCornerRules.js`・`js/shapes/PathSegmentKindRules.js`）
* **角の状態の判定（`resolveCornerState`／`cornerStateOfData`）はコードを変えない**：今の判定は「両側とも`'smooth'`なら`CORNER`／`SMOOTH`、それ以外のパスの途中の点は`LINE_CORNER`」のため、曲がり方を持つ区間に接する点は`LINE_CORNER`（角を操作できない。「角」のチェックボックスはチェックが入った見た目で押せない）になり、現場設計の決定どおり。`CornerState.LINE_CORNER`・`resolveCornerState`・`cornerStateOfData`のJSDocの「片側でも直線の区間」を「片側でも打った点の曲線の区間でない（直線の区間・曲がり方を持つ区間）」に直す（値・名前は変えない）。
* **角の切り替えの組み立て（`planCornerToggle`）**：`new Path(…, data.segments.map((s) => s.kind), newCorners)`の第6引数を`data.segments`（区間の値の配列。コンストラクタが写す）にする。これで変わらない曲がり方を持つ区間は引っ張る点ごと残る。JSDocの「区間の種類…を元のままにし」を「区間（曲がり方を持つ区間の引っ張る点を含む）…を元のままにし」に直す。
* **区間の切り替え（`PathSegmentKindRules`）**：
  * importに`segmentSpecsOf`を足す（`import { segmentKindsOf, segmentSpecsOf } from './PathJoinRules.js';`）。
  * `changedSegmentIndexes`：「曲線に」は今どおり`kinds[i] === SEGMENT_KIND_LINE`の区間、「直線に」は`kinds[i] !== SEGMENT_KIND_LINE`の区間（打った点の曲線の区間と曲がり方を持つ区間）にする（変わる区間の決め方の唯一の箇所のまま）。今の曲線の分岐は変えない。これで曲がり方を持つ区間は「直線に」で変わり、「曲線に」では変わらない（ほかに変わる区間が無ければボタンは押せない）。JSDocを直す。
  * `buildCurvedPath`：区間の並びを`segmentSpecsOf(data)`で読み（今は`segmentKindsOf(data)`）、変わらない区間は区間の指定のまま`newKinds`へ入れる（曲がり方を持つ区間は引っ張る点ごと残る）。変わる区間（直線の区間）は今どおり`SEGMENT_KIND_SMOOTH`を2つ。両端の点の角の情報の決め方は今のまま（隣が曲がり方を持つ区間の点は`resolveCornerState`が`LINE_CORNER`を返すため角の点にならず、足した区間の形は直線と同じ1/3・2/3のまま、曲がり方を持つ区間の形・引っ張る点は変わらない）。JSDocを直す。
  * `buildStraightenedPath`：区間の並びを`segmentSpecsOf(data)`で読み、変わる区間を`SEGMENT_KIND_LINE`に置き換えて`new Path(…)`へ渡す（変わらない曲がり方を持つ区間は引っ張る点ごと残り、変わる曲がり方を持つ区間の引っ張る点は捨てる。点は増減しない）。JSDocを直す。
  * `collectSwitchEntries`・`buildLineFromCurve`（今の曲線の「直線に」）・公開の2関数は変えない（今の曲線は今までどおり。「曲線に」は何もしない）。

### 要件E: `edit/`・`core/`・`io/`・`main.js`はコードを変えない（経路の確認）
* **頂点を動かす操作**（頂点のドラッグ1つ・まとめて、矢印キーの微調整、位置の数値入力）：すべて`VectorModel.updateVertices` → `shape.setVertex`（`setVertex`を呼ぶ箇所は`updateVertices`の1か所）を通るため、要件Aの`setVertex`で引っ張る点がついていく。
* **図形全体を動かす操作**（選択で動かす・矢印キー・位置の数値入力・整列・分布・ペースト／複製のずらし・`Alt`+ドラッグの複製）：`VectorModel.moveShapes`・`moveShapesBy`・`ShapeInserter`の`shape.translate`を通るため、要件Aの`translate`で引っ張る点もすべて動く。
* **保存・読み込み・取り消し・やり直し・キャンバスの切り替え・コピー＆ペースト・複製**：すべて`toJSON()`と`ShapeFactory.fromJSON` → `Path.fromJSON`を通るため、要件Aで曲がり方が保たれる。`DocumentSerializer`の図形単位のスキップ（古いエディタでの未知の区間の種類）もそのまま。
* **書き出し**：`SpriteSerializer`は`toDrawElement()`を呼ぶだけで、`bezierPath`の`cubic`・外枠（`cubicAxisRange`）・`CodeExporter`の`draw`は今のまま正しく扱う（2次を次数上げした3次の各軸の極値は元の2次と同じ）。
* **結合・吸い付き・描き足しの手順**：`PathJoiner`（`classifyJoin`・`planJoin`）・`EndpointSnapper`（`resolveEndpointHandle`・`findSnapTarget`・`findDrawnLineSnapTarget`・`planDrawnLineJoin`・`planEndpointDragJoin`）・`InputTracker`（`#dragEndpoint`の解決と`joinDraggedEndpoint`の呼び出しは図形種別を見ない）は規則の結果に従うだけのため、規則が今の曲線を受け付ければ働く。記録（取り消し1回）も今の`beginEdit`/`commitEdit`のまま。
* **角・区間の切り替えの手順**：`PathCornerEditor`は`planCornerToggle`・`planSegmentKindSwitch`の結果に従うだけ。
* **`edit/PathJoiner.js`はJSDocだけ**：先頭の責務定義「選択中の線（直線・開いたパス）の結合」の括弧書きを「直線・開いたパス・今の曲線」に直す（3行以内のまま。コード・ほかのJSDocは変えない）。

### 要件F: テスト（REQ要件4）
既存のケースの期待値は変えない。ただし次のケースは「今の曲線は結合できない」ことを確かめているため、本作業で意味が変わり**書き換える**（書き換えはこの一覧だけ。これ以外の既存のケースが落ちたら直さずに作業を中断し、質問として報告する）。`palette/`・`main.js`・`index.html`はテストを置かない。座標は2/3・中点がちょうど表せる値（差が3の倍数・偶数）を使い、形の比較は厳密な一致か`1e-9`程度の許容量で行う。

* **書き換えるタスク（依存順序）**：既存のケースの書き換えは、期待値が変わる原因のコード変更と同じタスクで行う（後のタスクへ回すと、間のタスクで`node --test`が全件通らなくなるため）。下の1.〜11.はすべてタスク2の`isJoinableLine`・`classifyJoin`の変更で結果が変わる（10.は`PathJoiner.canJoin`が`classifyJoin(...) !== null`を返すだけのため、11.は`EndpointSnapper.resolveDragEndpoint`が`resolveEndpointHandle`→`isJoinableLine`に依るため）ので、**1.〜11.はすべてタスク2で書き換える**。タスク1（`Path`に`'bezier'`を足す。新しい区間の種類を含まないパスのふるまいと未知の区間の種類のエラー文は変えない）・タスク3（変わるのは曲がり方を持つ区間を含むパスのときだけ）で期待値が変わる既存のケースは無い（計画の見直しで、既存のテストに`'bezier'`を使うケース・`ACCEPTED_SEGMENT_KINDS`を直接確かめるケースが無いこと、作成途中の線の関数（`addDrawnPoint`等）と`isDrawingLine`のケースは`isDrawnLineShape`のままで変わらないことを確かめた）。
* **書き換える既存のケースと理由**：
  * `test/shapes/PathJoinRules.test.js`
    1. `classifyJoin`「結合できない図形を1つでも含む2つはnull（順も問わない）」：今の曲線と直線の2本は`'join'`になるため、回す並びから今の曲線を除く（下の新しい定数`JOIN_REJECTED_KINDS`を使う）。
    2. `isJoinableLine`「閉じたパス・曲線・矩形・円・弧は false」：今の曲線は真になるため、今の曲線を除き（`JOIN_REJECTED_KINDS`）、題名から「曲線」を除く。
    3. `buildJoinedPath`「結合できない線（閉じたパス・曲線）を含むとnull」：今の曲線は結合できるため、今の曲線の行を矩形（`makeUnjoinable('rect')`）に置き換え、題名を「（閉じたパス・矩形）」にする。
    4. `planJoin`「受理しない選択（0個・3つ以上・曲線を含む）はnull」：直線と今の曲線は計画が作られるため、その行を直線と矩形に置き換え、題名を「（0個・3つ以上・矩形を含む）」にする。
    5. `buildJoinedPathAt`「結合できない線で null」：今の曲線の行を矩形に置き換える。
    6. `buildExtendedPath`「結合できない線（閉じたパス・曲線）で null」：今の曲線の行を矩形に置き換え、題名を「（閉じたパス・矩形）」にする。
    7. `isDrawnLineShape`の「isJoinableLineとisDrawnLineShapeは同じ結果」：今の曲線だけは結果が分かれるため、比べる並びを`JOIN_REJECTED_KINDS`にし、今の曲線は`isJoinableLine`が真・`isDrawnLineShape`が偽であることを足して確かめる（題名を「今の曲線のほかは同じ結果、今の曲線は結合できるが続けて引く線の形ではない」の趣旨に直す）。
    * 補助：`UNJOINABLE_KINDS`・`makeUnjoinable`は残す（「閉じたパス・今の曲線・矩形・円・弧は偽」の`isDrawnLineShape`のケース・今の曲線1本の`classifyJoin`・`canCloseByMergingEnds`のケースは意味が変わらず、今の曲線を含めたまま使い続ける）。JSDocを「続けて引く線の形でない図形（今の曲線を含む。今の曲線はPhase 09-03aから結合できる線）」の趣旨に直し、`const JOIN_REJECTED_KINDS = UNJOINABLE_KINDS.filter((kind) => kind !== 'curve');`（JSDoc付き）を足す。
  * `test/shapes/EndpointSnapRules.test.js`
    8. `resolveEndpointHandle`「閉じたパス・曲線・矩形・円・弧は null」：今の曲線の始点・終点は端点になるため、`others`から今の曲線を除き、題名から「曲線」を除く（今の曲線は新しいケースで確かめる）。
    9. `findSnapTarget`「曲線・矩形・円・弧・閉じたパスの点には吸い付かない」：今の曲線の端点に吸い付くため、`shapes`から今の曲線を除き（後半の(0, 0)・(100, 100)の照会も残りの図形でnull）、題名から「曲線」を除く。
  * `test/edit/PathJoiner.test.js`
    10. `canJoin`「受理しない選択（0個・直線1本・3本・曲線を含む）でfalse」：直線と今の曲線の2本は押せるため、`[[a, k], ['a', 'k']]`のケースを今の曲線1本`[[k], ['k']]`（今と同じく押せない）に置き換え、題名を「（0個・直線1本・3本・今の曲線1本）」にする。
  * `test/edit/EndpointSnapper.test.js`
    11. `resolveDragEndpoint`「…無いid・曲線は null」：今の曲線の`'start'`は`'start'`になるため、期待値を`'start'`へ直し、`'end'`→`'end'`・`'control'`→`null`を足す。題名を「…無いid・今の曲線の制御点は null（始点・終点は端点）」の趣旨に直す。
* **(F-1) `test/shapes/Path.test.js`（`describe`を足す）**：
  * 定数`SEGMENT_KIND_BEZIER`が`'bezier'`。
  * 区間の指定：コンストラクタに文字列と区間の値の混ざった配列を渡すと`segments`が写される（`'bezier'`は引っ張る点を持ち、`'line'`・`'smooth'`の区間の値の余分なキーは捨てる）。渡した配列・区間の値・座標を後で書き換えても図形は変わらない。
  * 形：曲がり方を持つ区間1つの開いたパス（例：(0, 0)→(60, 0)、`control1` (20, 40)・`control2` (40, 40)＝制御点(30, 60)の2次を3次にしたもの）の`toDrawElement()`が`bezierPath`で`segments[0]`が`{ kind: 'cubic', control1: {x: 20, y: 40}, control2: {x: 40, y: 40} }`。描画の命令（記録する偽のctx）が`moveTo`→`bezierCurveTo(20, 40, 40, 40, 60, 0)`。`hitTest`が曲線の上の点（`t = 0.5`の(30, 30)）で真・離れた点で偽。`intersectsRect`が曲線の頂上付近の矩形で真・外れた矩形で偽。
  * 塗りの内側：閉じたパス（例：(0, 0)・(60, 0)・(60, 60)・(0, 60)、区間0が上へ膨らむ曲がり方を持つ区間（`control1` (20, −40)・`control2` (40, −40)）、残りは直線、塗りあり）で、膨らみの中の点（(30, −20)）が`hitTestFill`で真、膨らみの外（(30, −40)）が偽。
  * 隣の打った点の曲線の区間：曲がり方を持つ区間の隣の`'smooth'`の区間の`toDrawElement()`の制御点が、同じ位置の区間を`'line'`にしたパスのものと一致する（つなぎ目は角）。
  * ついていくふるまい：開いたパス（頂点3つ・区間2つともに曲がり方を持つ区間）で`setVertex(1, …)`すると区間0の`control2`と区間1の`control1`だけが頂点と同じだけ動き、区間0の`control1`・区間1の`control2`は動かない。`setVertex(0, …)`は区間0の`control1`だけ。閉じたパスで最後の区間が曲がり方を持つ区間なら`setVertex(0, …)`がその`control2`も動かす。範囲外の番号では何も変わらない。`translate`で全区間の引っ張る点が同じだけ動く。直線・打った点の曲線の区間だけのパスの`setVertex`・`translate`の結果（`toJSON()`）は今と同じ。
  * `toJSON()`：曲がり方を持つ区間は`{ kind: 'bezier', control1, control2 }`（キー順）。戻り値を書き換えても図形は変わらない。`'line'`・`'smooth'`の区間は`{ kind }`だけ。
  * `fromJSON`：往復（`toJSON` → `fromJSON` → `toJSON`）が一致し`toDrawElement()`も一致する（開いた・閉じた・`'line'`・`'smooth'`・`'bezier'`が混ざったもの・`corners`あり）。`data`を後で書き換えても図形は変わらない。不正な引っ張る点の`Error`（`control1`が無い・`null`・配列・数値、`x`が無い・`NaN`・`Infinity`・文字列、`control2`も同様）の文面の完全一致。`'line'`の区間が`control1`を持っていても無視される（`toJSON()`に出ない）。
* **(F-2) `test/shapes/PathJoinRules.test.js`（`describe`を足す）**：
  * `isJoinableLine`：今の曲線が真。`isDrawnLineShape`：今の曲線が偽（既存のケースでも確かめている）。
  * `classifyJoin`：今の曲線と直線（順を入れ替えても）・今の曲線と開いたパス（直線のパス・曲線のパス）・今の曲線2本が`'join'`。今の曲線と矩形・閉じたパスはnull。今の曲線1本はnull（既存）。
  * **今の曲線の変換**：今の曲線（例：始点(0, 0)・制御点(30, 60)・終点(60, 0)）を基準の線Aに直線と結合した結果の区間0が`{ kind: 'bezier', control1: {x: 20, y: 40}, control2: {x: 40, y: 40} }`で、`ShapeGeometry`の`cubicBezierPoint`（結果の区間）と`quadraticBezierPoint`（元の今の曲線）が`t = 0, 0.25, 0.5, 0.75, 1`で一致する（形が誤差なく同じ）。
  * `planJoin`／`buildJoinedPath`：今の曲線＋直線（端点が重なる＝まとめて頂点3つ・区間`['bezier', 'line']`／離れている＝間に直線の区間）、直線＋今の曲線でBの今の曲線を逆順にする組（区間が逆順で引っ張る点が入れ替わり、逆向きにたどった形が元の今の曲線と同じ）、今の曲線＋開いた直線のパス・曲線のパス（打った点の曲線の区間の`toDrawElement()`の制御点が結合の前と同じ）、今の曲線2本。スタイル（線の色・太さ・塗り）は基準の線Aのもの（今の曲線がAなら今の曲線のもの）、`keepId: false`・`targetId`＝Aのid・`removeIds`＝[Bのid]、つないだ点の`corners`は偽（`toJSON()`に`corners`が出ない）。
  * **閉じる（ボタン・`J`。`classifyJoin`が`'close'` → `planJoin`（→`buildClosedPath`））**：曲がり方を持つ区間を含む開いたパス1本（`Path`のコンストラクタに区間の値を渡して作るか、今の曲線と直線の結合で作る）を閉じた結果で、曲がり方を持つ区間が引っ張る点ごと保たれる（`toJSON().segments`の該当の区間が元と一致し、`toDrawElement()`の`cubic`の`control1`・`control2`も一致）。少なくとも次の2つ：(a) 両端が離れている＝閉じる区間に直線の区間が足され、曲がり方を持つ区間はそのまま。(b) **最後の区間が曲がり方を持つ区間で、始点と終点が重なっている（同じ座標）＝まとめて頂点が1つ減る**：閉じたパスの最後の区間（`points[n−2]`→`points[0]`）が`{ kind: 'bezier', control1, control2 }`のまま（`control2`は元の値＝除いた終点の側の引っ張る点を動かさない）で、`toDrawElement()`の最後の区間の`cubic`が閉じる前の最後の区間と一致する（形が変わらない）。閉じた結果は元のidと位置（`keepId: true`）。
  * `buildJoinedPathAt`・`buildExtendedPath`：今の曲線の始点側・終点側（向きを保つ。描き足した点が端点と重なれば null）。
  * `planDrawnLineJoin`：描き始めだけ今の曲線の端点に吸い付き点2つで終える＝今の曲線のidを保つ（`keepId: true`）開いたパスで区間0が曲がり方を持つ区間・足した区間は描いた区間の種類（直線のツール＝`'line'`、曲線のツール＝`'smooth'`を`drawnKindSource`で）、描き終えだけ今の曲線の端点、今の曲線の始点から引き始め途中の点を1つ以上打って今の曲線の終点で終える＝閉じたパス（頂点3つ以上・`isFillable()`が真・今の曲線のid）、途中の点なしで同じ今の曲線の両端＝null、今の曲線と直線の端点の間＝結合。
  * `planEndpointDragJoin`：今の曲線の終点をドラッグして直線の始点（同じ座標）に吸い付けた＝結合（形は元のまま）、直線の終点を今の曲線の始点へ＝結合、今の曲線の自分のもう一方の端点＝null。
  * `segmentSpecsOf`：直線＝`['line']`、パス＝`segments`の各要素（曲がり方を持つ区間は引っ張る点を含む）の新しい配列、引数を書き換えない。
  * 共通：引数の図形の`toJSON()`が変わらない・結果が引数と頂点・引っ張る点を共有しない。
* **(F-3) `test/shapes/EndpointSnapRules.test.js`（`describe`を足す）**：`resolveEndpointHandle(今の曲線, 'start')`が`'start'`・`'end'`が`'end'`・`'control'`が`null`。`findSnapTarget`が今の曲線の始点・終点に吸い付き（`shapeId`・`end`・座標）、制御点の位置には吸い付かない。ドラッグ中の今の曲線の端点は自分のもう一方の端点に吸い付かない。`findDrawnLineSnapTarget`が今の曲線の端点を候補にする。
* **(F-4) `test/shapes/PathCornerRules.test.js`（`describe`を足す）**：曲がり方を持つ区間に接する点が`LINE_CORNER`（両側とも打った点の曲線の区間の点は今どおり`SMOOTH`）、その点だけを選んだ`resolveCornerToggleView`が`{ enabled: false, checked: true, mixed: false }`、ほかの点の`planCornerToggle`で作ったパスの曲がり方を持つ区間が引っ張る点ごと元のまま（`toJSON().segments`の一致）。
* **(F-5) `test/shapes/PathSegmentKindRules.test.js`（`describe`を足す）**：曲がり方を持つ区間の両端を選ぶと`toLine`だけが押せる・「直線に」でその区間が`{ kind: 'line' }`になり点の数・`corners`は変わらない（`vertexIndexMap`は恒等）・「曲線に」は空配列。隣の直線の区間を「曲線に」すると、曲がり方を持つ区間の引っ張る点が変わらず、足した区間の制御点が1/3・2/3の位置で、曲がり方を持つ区間に接する点の角の情報が元のまま。別の打った点の曲線の区間を「直線に」しても曲がり方を持つ区間が残る。
* **(F-6) `test/edit/PathJoiner.test.js`**：（書き換え10.はタスク2で済ませる）偽物の依存で今の曲線と直線の2本の`canJoin`が真・`join`の`replaceShape`の図形に曲がり方を持つ区間がある。実物の`VectorModel`・`HistoryManager`・`SnapshotAdapter`（既存の`setupReal`）で、今の曲線と直線を結合 → 取り消し1回で元の今の曲線（`type: 'curve'`・`points`が同じ）と直線に戻る → やり直しで結合した後（`toJSON()`の一致）に戻る。
* **(F-7) `test/edit/EndpointSnapper.test.js`**：（書き換え11.はタスク2で済ませる）偽物の`model`で今の曲線の端点を直線の端点へドラッグして離した`joinDraggedEndpoint`が曲がり方を持つ区間を含むパスで`replaceShape`（`select: true`）を呼ぶ。`commitDrawnLine`で描き始めが今の曲線の端点のときに今の曲線のidを保つ（`keepId: true`）。
* **(F-8) `test/io/DocumentSerializer.roundtrip.test.js`（`describe`を足す）**：曲がり方を持つ区間を含むパス（開いた・閉じた（塗りあり）・`'line'`・`'smooth'`と混ざったもの・`corners`あり）と、今の曲線と直線を結合した結果の往復（オブジェクト・文字列。既存の補助を使う）で`toJSON()`が一致し、作業データの`version`が2のまま。
* **(F-9) `test/io/DocumentSerializer.errors.test.js`（`describe`を足す）**：引っ張る点が不正な曲がり方を持つ区間を含むパスはその図形だけがスキップされ、ほかの図形は読まれる（既存の書き方に合わせる）。
* **(F-10) `test/io/SpriteSerializer.test.js`（`describe`を足す）**：曲がり方を持つ区間を含むパスの`bezierPath`（`formatVersion`が3・区間の`cubic`の`control1`・`control2`が作業データの引っ張る点と一致）。曲がり方を持つ区間1つの開いたパスの外枠が、同じ形の今の曲線（`quadratic`）の外枠と一致する（`assertBoundsClose`）。今の曲線と直線を結合した結果の外枠が形を囲む（既存の`sampleBezierPathRange`）。
* **(F-11) 既存のテストで足りるところ**：`CodeExporter`の`draw`の`bezierPath`・`cubic`（既存のテスト）。新しい区間の種類を含まない作業データ・書き出しが今と同じことは既存のテスト全件で確かめる。

### 要件G: ふるまいの確認（テストプレイの確認項目。REQ要件5）
実装の最後（タスク7）に、本RESの「4. 詳細作業内容」へ写して実装の結果に合わせて確かめ、最終報告で発注者へ提示する。
0. **準備**：ブラウザで画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。今の曲線は曲線のツールでは新しく作れないため、次の内容をテキストエディタで`curve-test.ozve.json`という名前で保存し、エディタの「開く」で開いて用意する（今の曲線3本と直線2本。直線2本と左上の今の曲線は端点どうしが重なっている）。
    ```json
    {"format":"oz-vector-editor","version":2,"shapes":[
    {"type":"curve","id":"shape-1","points":[{"x":90,"y":300},{"x":240,"y":90},{"x":390,"y":300}],"strokeColor":"#000000","strokeWidth":2,"fillColor":null},
    {"type":"line","id":"shape-2","points":[{"x":390,"y":300},{"x":240,"y":450}],"strokeColor":"#000000","strokeWidth":2,"fillColor":null},
    {"type":"line","id":"shape-3","points":[{"x":240,"y":450},{"x":90,"y":300}],"strokeColor":"#000000","strokeWidth":2,"fillColor":null},
    {"type":"curve","id":"shape-4","points":[{"x":510,"y":300},{"x":660,"y":450},{"x":810,"y":300}],"strokeColor":"#cc0000","strokeWidth":4,"fillColor":null},
    {"type":"curve","id":"shape-5","points":[{"x":510,"y":150},{"x":660,"y":30},{"x":810,"y":150}],"strokeColor":"#0000cc","strokeWidth":2,"fillColor":null}
    ]}
    ```
1. **結合のボタン・`J`**：今の曲線と直線（または直線のパス・曲線のパス・別の今の曲線）を選択（`V`）で2本選ぶと、結合のボタンが押せる。押す（`J`でも）と1本のパスになり、今の曲線の部分の形はまったく変わらない。端点が離れていれば、間が直線でつながる。今の曲線1本だけを選んだときは押せない（今までどおり）。
2. **端点のドラッグ**：頂点の選択（`A`）で今の曲線の端の点をドラッグして、ほかの線の端点に近づけると吸い付き（青い四角）、離すと結合する。逆に、ほかの線の端点を今の曲線の端点へドラッグしても結合する。今の曲線の曲がりを引っ張る点はどこにも吸い付かず、ほかの線の端点も引っ張る点には吸い付かない。今の曲線の端の点は、自分のもう一方の端の点には吸い付かない。
3. **ツールでつながる・伸ばす**：直線のツール・曲線のツールで、今の曲線の端点から引き始めると、その線の続きとして伸びる（色・太さは今の曲線のもの）。引いている途中に今の曲線の端点でクリックすると、その線とつながる。
4. **閉じた形と塗り**：今の曲線と直線などをつないで閉じた形にすると、塗りの色を付けられ、内側が塗られる。内側のクリックで選べる（例：準備の左上の今の曲線と直線2本を順に結合し、最後に`J`で閉じる）。閉じた形には点が3つ以上要る（今の曲線1本と直線1本だけの半月形は閉じられない）。
5. **結合した後の編集**：頂点の選択（`A`）で、元の今の曲線の部分は両端だけが点として出る（曲がりを引っ張る点は出ない）。端の点を動かすと、その点のまわりの曲がりが点と一緒に動き、まっすぐにはならない（このふるまいの使い勝手を確かめる。違和感があれば発注者が改修を判断する）。パス全体を動かすと形ごと動く。矢印キー・位置の数値入力・整列でも同じ。
6. **角と切り替え**：元の今の曲線の部分の端の点を選ぶと、「角」はチェックが入った見た目で押せない。両端を選んで「直線に」を押すとその間が直線になる。「曲線に」は押せない（その区間が既に曲線のため）。ほかの点の「角」の切り替えや、隣の直線の区間の「曲線に」をしても、元の今の曲線の部分の形は変わらない。
7. **取り消し**：どの結合も、取り消し（`Ctrl`+`Z`）1回で結合の前に戻り、やり直しで結合した後に戻る。
8. **保存・書き出し**：結合したパスを保存して開き直す（キャンバスの切り替え・コピー＆ペースト・複製（`Ctrl`+`D`）も）と同じ形に戻る。書き出して確認用ページ（`sprite-check.html`）で開くと、同じ形で描かれ、外枠が形を囲む。
9. **今の曲線の「曲線に」**：今の曲線の両端を選んでも「曲線に」は押せない（今までどおり）。「直線に」は今までどおり直線になる。
10. **ほかが今までどおり**：結合していない今の曲線（制御点を含めて動かせる）、直線・パスの結合・描き足し・閉じる、曲線のツール・直線のツールの連続作成、「角」・「直線に」「曲線に」、弧（結合の対象にならない）、選択・頂点の選択・位置の数値入力・整列・重なり順・保存・読み込み・書き出しが今までどおり動く。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/shapes/`（図形クラス`Path`と図形をまたぐ規則）、`./js/edit/`（`PathJoiner.js`のJSDocのみ）、`./test/shapes/`・`./test/edit/`・`./test/io/`（自動テスト）。
*   **関連する論理クラス**:
    *   `shapes/Path`（既存。区間の種類`'bezier'`＝曲がり方を持つ区間を足す。定数`SEGMENT_KIND_BEZIER`・typedef`SegmentSpec`・非公開の`copySegment`・`#shiftControlsAt`を新設。`#segmentControls`・`setVertex`・`translate`・`toJSON`・`fromJSON`・コンストラクタを広げる。名前は変えず責務を広げる）
    *   `shapes/PathJoinRules`（既存。`isJoinableLine`・`classifyJoin`を広げ、公開の`segmentSpecsOf`、非公開の`chainSourceOf`（今の曲線を区間として読む・2次→3次の式の唯一の箇所）・`reverseSegmentSpec`を新設。`chainOf`・`reverseChain`を直す）
    *   `shapes/EndpointSnapRules`（既存。JSDocのみ）
    *   `shapes/PathCornerRules`（既存。`planCornerToggle`の第6引数とJSDoc）
    *   `shapes/PathSegmentKindRules`（既存。`changedSegmentIndexes`・`buildCurvedPath`・`buildStraightenedPath`とimport・JSDoc）
    *   `shapes/ShapeGeometry`・`shapes/Curve`・`shapes/Line`（既存。変えない。`computeSmoothSegmentControls`の式・今の曲線の`points`の約束・ハンドル名をそのまま使う）
    *   `edit/PathJoiner`（既存。先頭の責務定義の括弧書きのみ）

### 参照する責務
*   **依存方向（1章）**：`main.js → edit → io → core → shapes`の一方向。一方向の列から外れるimportは3種だけ：(1)`edit/ → shapes/`（`PathJoiner → PathJoinRules`、`EndpointSnapper → EndpointSnapRules`・`PathJoinRules`、`PathCornerEditor → PathCornerRules`・`PathSegmentKindRules`）、(2)`shapes/`内（`EndpointSnapRules → PathJoinRules`、`PathCornerRules → Path`、`PathSegmentKindRules → Path`・`Line`・`PathJoinRules`（`segmentKindsOf`）・`PathCornerRules`（`resolveCornerState`・`CornerState`）。`PathJoinRules`は`Line`・`Path`のみimport（`Path`からは`readCornerFlags`も）するため循環しない。`PathCornerRules`は`PathJoinRules`・`EndpointSnapRules`をimportしない）、(3)`edit/ → core/`。`core/`から`shapes/`をimportするのは`ShapeFactory`だけ。循環importは無い。**本作業で(2)の`PathSegmentKindRules → PathJoinRules`に`segmentSpecsOf`を足し、`PathJoinRules → Path`に`SEGMENT_KIND_BEZIER`を足す（どちらも既存の向き）。新しい向きは足さない。**
*   **`shapes/`の構成（1章・`_doc/arch/12_shapes.md`）**：図形クラス（種別ごとに1ファイル）、図形クラスだけが使う共通の関数（`ShapeGeometry`＝幾何の計算と打った点の曲線の区間の形の決め方の式の唯一の箇所、`ShapeDataValidation`＝図形データの検証。`shapes/`の外・図形をまたぐ規則からは使わない）、図形をまたぐ規則（第3の種類：`PathJoinRules`・`EndpointSnapRules`・`PathCornerRules`・`PathSegmentKindRules`）。図形をまたぐ規則は状態を持たない`export`した関数と定数のみ。図形の`type`・公開プロパティ`id`・`toJSON()`（`EndpointSnapRules`は`getVertexIndexForHandle`も）だけを読み、図形クラスの内部プロパティを読まない。表示倍率・`VectorModel`・履歴・DOM・操作モード・idの形式を知らない。`try/catch`を持たない。引数を書き換えず、結果は元の図形と配列・頂点を共有しない。
*   **`PathJoinRules`（3章11.・12.・22.・`_doc/arch/12_shapes.md`）**：結合できる線の判定は`isJoinableLine`の1か所（今は`isDrawnLineShape`＝直線・開いたパスに任せる。名前は意味の違いのため分けて残す。「今の曲線・弧の結合で結合できる線を広げるときはこの関数だけを変える」とJSDocにある）。`segmentKindsOf`＝「`type`が`'line'`の図形は直線の区間1つ」の唯一の定義箇所（公開。`PathSegmentKindRules`も使う）。`chainOf`は開いた線の端の点の`corners`を常に偽にする唯一の箇所（つながってできた点はなめらかな点）。`reverseChain`はBを逆順にするときの唯一の箇所。組み立ては`assembleOpenPath`・`buildClosedPath`・`buildExtendedPath`が`points`・`kinds`・`corners`を一緒に並べる。結果は元の区間の種類と途中の角の点を保つ。基準の線A＝重なり順で奥（向き・色・太さ・塗りはAのもの）。2本の結合は新しいid、閉じる・描き足しは元のidと位置。端点が重なっている＝`tolerance`以内（ボタン・`J`は画面上5px）。重なる端点はBの側を除きAの端点の座標を残す。間を埋める区間はボタン・`J`では直線（`JOIN_GAP_SEGMENT_KIND`）、ツールでは描いた区間の種類。自動で閉じない。閉じたパスは頂点3つ以上。
*   **`EndpointSnapRules`（3章12.）**：対象は結合できる線の端点だけ（`isJoinableLine`）。`resolveEndpointHandle`は「頂点の番号`i`＝図形データの`points[i]`」に依り、番号0が始点・`points.length − 1`が終点。吸い付く距離は画面上8px。ドラッグ中の自分のもう一方の端点は`canCloseByMergingEnds`が真のときだけ対象。
*   **`Path`（2章`path`・`_doc/arch/12_shapes.md`）**：`{ type: 'path', id, points, closed, segments: [{ kind }], corners?, strokeColor, strokeWidth, fillColor }`（キー順。`corners`は角の点が1つ以上あるときだけ`segments`の直後）。`segments[i]`＝`points[i]`→`points[i+1]`、閉じたパスの最後＝`points[n-1]`→`points[0]`、要素数は開いた`n − 1`・閉じた`n`。区間の要素の余分なキーは無視する。`'smooth'`は制御点を作業データに持たず頂点から式で求める。頂点数の下限は開いた2・閉じた3。コンストラクタは引数を検証せず頂点を複製し、第6引数が配列なら区間ごとの種類（要素数は呼び出し側の責任）、第7引数`corners`は写す。`readCornerFlags(data)`は`corners`の読み方の唯一の箇所。区間の種類の定数は`Path.js`が唯一の定義。制御点は`#segmentControls`（`computeSmoothSegmentControls`）が1か所で求め、描画（`#tracePath`）・当たり判定／範囲選択（`#someSegment`）・塗りの内側（`#fillPolygon`）・`toDrawElement`が共有する。曲線の区間の形：`control1 = a + (b − Q0)/6`・`control2 = b − (Q3 − a)/6`、`Q0`＝前の区間が曲線の区間かつ始点が角の点でなければ前の区間の始点、そうでなければ`2a − b`（`Q3`も同様）。直線の区間とのつなぎ目は常に角。分割数`SMOOTH_SEGMENT_SAMPLE_COUNT`（100）は当たり判定・範囲選択・塗りの内側の折れ線近似の唯一の定義。`fromJSON`の受理する区間の種類は`ACCEPTED_SEGMENT_KINDS`（エラー文はこの並びから作る）。往復（`toJSON`→`fromJSON`）で図形データの内容と描画・当たり判定の結果が一致する。どちらの方向でも内部配列・頂点オブジェクトを共有しない。ハンドルは頂点だけ（`'vertex-<i>'`）。古いエディタでは未知の区間の種類としてその図形だけがスキップされる（作業データの版は2のまま）。
*   **`Curve`（2章・`_doc/arch/12_shapes.md`）**：`points[0]`＝始点・`[1]`＝制御点・`[2]`＝終点。ハンドル名`'start'`・`'control'`・`'end'`（`getVertexIndexForHandle`は0・1・2）。書き出しは`quadratic`。
*   **共通メソッド契約（18メソッド。`_doc/arch/12_shapes.md`）**：増やさない。新規の公開メソッドは足さない。
*   **角（3章23.）**：角を操作できる点＝両側とも曲線の区間の点（`CORNER`・`SMOOTH`）、直線の角の点＝片側でも直線の区間のパスの点（`LINE_CORNER`。実際に角が立っていて操作できない）、角の考えがない点（`NONE`）。判定の唯一の箇所は`resolveCornerState`、押したときの結果の唯一の箇所は`planCornerToggle`（新しいパスは頂点・閉じているか・区間の種類・スタイルを元のまま）。
*   **区間の切り替え（3章24.）**：変わる区間の決め方の唯一の箇所は`PathSegmentKindRules`の`changedSegmentIndexes`（「曲線に」は直線の区間、「直線に」は曲線の区間。今の曲線は「直線に」だけ）。「曲線に」は中点に点を足し、両端の点のうち切り替えの後に角を操作できる点は角の点（判定は`resolveCornerState`）、そうでない点の角の情報は元の値のまま。「直線に」は区間の種類だけが変わり点は増減しない。今の曲線の「直線に」は`Line`。
*   **`edit/`（1章・`_doc/arch/14_edit.md`）**：操作モードを知らない。1件の編集操作の手順は`VectorModel`・`HistoryManager`を注入で受け取り、規則の関数だけをimportする。DOM・図形種別の分岐・図形固有のプロパティ名を持たない。`PathJoiner`は`classifyJoin`・`planJoin`の結果に従い、`beginEdit` → `replaceShape` → `commitEdit`（結合できない選択では何もせず記録しない）。
*   **`VectorModel`（`_doc/arch/03_VectorModel.md`）**：図形種別を関知しない。`updateVertices`が`shape.setVertex`を呼ぶ唯一の箇所。`moveShapes`・`moveShapesBy`は`shape.translate`へ委譲する。
*   **履歴（3章6.）**：変更処理を`beginEdit()`と`commitEdit()`で挟むスナップショット方式（作業データ＝各図形の`toJSON()`）。結合・描き足し・端点のドラッグでの結合は1件。
*   **書き出し（2章）**：`bezierPath`の`segments[i]`は直線`{ kind: 'line' }`・曲線`{ kind: 'cubic', control1, control2 }`（制御点は絶対座標。作業データの語彙とは別。「Phase 09-03で今の曲線・弧を3次ベジェの区間として表すため」）。外枠は全頂点と`cubic`の各軸の極値（制御点そのものは含めない）。書き出し形式の版は3、作業データの版は2。
*   **同期の経路（3章冒頭）**：再描画・UI同期は既存の経路（`model.onChange`ほか）のみ。機能専用の再描画・同期処理を足さない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章 構成図**：`shapes/PathJoinRules.js`の説明の「結合と、直線・曲線のツールで続けて引く線の点の並び」は変えず、必要なら今の曲線を区間として読むことを足す（構成図の行は短く保つ）。
*   **1章「存在しないもの」**：「今の曲線・弧の結合と曲線の区間としての取り込み（Phase 09-03）」を「弧の結合と曲線の区間としての取り込み（Phase 09-03b）」に直し、「今の曲線の「曲線に」（今の曲線をパスの曲線の区間にすること。Phase 09-03）」を「今の曲線の「曲線に」（今の曲線をパスにするには結合する。Phase 09-03aの発注者の決定）」に直す。曲がり方を持つ区間の引っ張る点（方向のハンドル）の表示・ドラッグでの直接の操作、曲がり方を持つ区間と隣の区間のつなぎ目をなめらかにすること、今の曲線への制御点の追加・削除、結合でまとめた端点の側の引っ張る点を動かすこと、頂点2つの閉じた形（今の曲線1本と直線1本の半月形）を足す（既にある「曲線の方向のハンドル」の項と重ならないように1つにまとめる）。
*   **1章 フォルダ分割の方針**：`shapes/`の`PathJoinRules`の説明の「結合できる線（`isJoinableLine`）は続けて引く線の形（`isDrawnLineShape`）と同じ条件」を「続けて引く線の形に今の曲線を足した条件（Phase 09-03a。今の曲線は頂点2つと曲がり方を持つ区間1つとして読む＝`chainSourceOf`）」に直す。`PathSegmentKindRules`が`PathJoinRules`の`segmentKindsOf`・`segmentSpecsOf`を使うこと。依存方向の(2)の`PathSegmentKindRules → PathJoinRules`の括弧に`segmentSpecsOf`を足す。
*   **2章`path`**：図形データの形の`segments`の要素に`{ kind: 'bezier', control1: {x, y}, control2: {x, y} }`を足す。区間の約束の`kind`に`'bezier'`（曲がり方を持つ区間。Phase 09-03a）：引っ張る点はワールド座標の絶対座標で作業データに持ち（`control1`＝始点の側、`control2`＝終点の側）、頂点ではない（ハンドルにならない）。形は両端の頂点と引っ張る点の3次ベジェで、描画・当たり判定・範囲選択・塗りの内側・書き出しはすべて`#segmentControls`の結果。隣の区間とのつなぎ目は常に角（打った点の曲線の区間の形の式では曲線の区間として数えない＝仮の点）。頂点を動かすとその頂点の側の引っ張る点が同じだけ動き（反対側は動かない）、図形全体を動かすとすべて動く（`setVertex`・`translate`）。持ち方の理由（書き出しと同じ値・変形のPhaseで頂点と同じ変換を当てればよい・動かす経路が`setVertex`と`translate`だけ）。作られるのは今の曲線の結合だけ（`PathJoinRules`が今の曲線を読み替える。2次→3次の式は`chainSourceOf`の1か所）。古いエディタでは未知の区間の種類としてその図形だけがスキップされる（作業データの版は2のまま）。`fromJSON`の引っ張る点の検証と、未知の区間の種類のエラー文は`'line'・'smooth'`のままにしたこと（既存の文面）。結合・描き足し・閉じるの結果は曲がり方を持つ区間を引っ張る点ごと保つ（Bを逆順にするときは引っ張る点を入れ替える）。区間の切り替えでの変化（「直線に」で直線の区間になり引っ張る点を捨てる、「曲線に」では変わらない）。`curve`の記述（書き出し・作られ方の近く）に、今の曲線も結合できる線で、結合するとパスの曲がり方を持つ区間になることを足す。書き出しの`bezierPath`の説明の「Phase 09-03で今の曲線・弧を3次ベジェの区間として表すため」を、今の曲線はPhase 09-03aで実施済み（弧は09-03b）に直す。
*   **3章11.（結合）**：冒頭と「結合できる線」に今の曲線を足す（`isJoinableLine`＝続けて引く線の形＋今の曲線）。今の曲線の部分は形を保ったまま曲がり方を持つ区間になること、今の曲線がAなら今の曲線のスタイル、今の曲線1本は閉じない、端点をまとめるときに除いたBの端点の側の引っ張る点は動かさないこと。「やらないこと」の「今の曲線（`curve`）・矩形・円・弧・閉じたパスの結合」から今の曲線を除く。発注者の決定（2026-11-19。分け方・形を保つ・結合した後の今の曲線の部分・頂点を動かしたときの曲がり方・今の曲線の「曲線に」は今までどおり）と現場設計の決定。
*   **3章12.（吸い付き）**：対象に今の曲線の端点（始点・終点。制御点は対象でない）を足す。「やらないこと」の「今の曲線（`curve`）・矩形…の点」から今の曲線を除く（今の曲線の制御点への吸い付きはやらない、に直す）。
*   **3章22.（線を続けて引く）**：続けて引く線の形（`isDrawnLineShape`）は変わらない（今の曲線は作成途中の線にならない）こと、「結合できる線は続けて引く線の形と同じ条件」の記述を直す。今の曲線の端点から引き始める・今の曲線の端点で終えるとつながること。
*   **3章23.（角）**：用語の「直線の角の点」を「片側でも打った点の曲線の区間でない（直線の区間・曲がり方を持つ区間）パスの点」に直し、曲がり方を持つ区間に接する点は角を操作できない（チェックが入った見た目で押せない）こと、角の切り替えで曲がり方を持つ区間が保たれることを足す。
*   **3章24.（区間の切り替え）**：「直線に」の変わる区間に曲がり方を持つ区間を足し（引っ張る点を捨てる・点は増減しない）、「曲線に」では変わらないこと、隣の直線の区間を「曲線に」しても曲がり方を持つ区間の形・引っ張る点は変わらないこと。「今の曲線は「直線に」だけ。「曲線に」は何もしない＝Phase 09-03」を「…何もしない（Phase 09-03aの発注者の決定。今の曲線をパスにするには結合する）」に直す。
*   **3章6.（履歴）**：記録する操作は変わらない（結合・描き足し・端点のドラッグでの結合に今の曲線が加わるだけ）。必要なら1文。
*   **3章16.・19.〜21.（図形全体・頂点を動かす操作）**：必要なら、曲がり方を持つ区間の引っ張る点は`setVertex`・`translate`で一緒に動くこと（`core/`・`edit/`は変えていない）を1文。
*   **`_doc/arch/12_shapes.md`**：`PathJoinRules.js`の項（公開に`segmentSpecsOf`、非公開の`chainSourceOf`＝今の曲線を区間として読む・2次→3次の式の唯一の箇所、`reverseSegmentSpec`、`isJoinableLine`の条件、`SegmentChain`の`kinds`が区間の指定を運ぶこと、まとめた端点の側の引っ張る点を動かさないこと）。`EndpointSnapRules.js`の項（今の曲線の端点が対象。「注意」の「結合できる線の種類を足すと…」に今の曲線で`points[0]`・`points[length − 1]`の約束が成り立つこと）。`PathCornerRules.js`の項（`LINE_CORNER`の意味の広がり・`planCornerToggle`が引っ張る点を保つ）。`PathSegmentKindRules.js`の項（「直線に」で曲がり方を持つ区間も変わる・組み立てで引っ張る点を保つ・`segmentSpecsOf`を使う）。`Path.js`の項（区間の種類の3つ・定数`SEGMENT_KIND_BEZIER`の使う側・コンストラクタの第6引数の区間の指定・`copySegment`・`#segmentControls`の1か所の分岐（「新しい区間の種類を足すときは、この4か所すべてに分岐が要る」を「`#segmentControls`の1か所」に直す）・`setVertex`／`translate`のついていくふるまい（「`corners`は…`setVertex`・`translate`では失われない」の近く）・`fromJSON`の引っ張る点の検証とエラー文・「曲線のパスは作業データに制御点を持たない」に曲がり方を持つ区間は持つことを足す）。
*   **`_doc/arch/14_edit.md`**：`PathJoiner.js`の項の「選択中の線（直線・開いたパス。曲線のパスを含む…）」に今の曲線（Phase 09-03aからコードの変更なしで対象。責務定義の括弧書きだけを直した）を足す。`EndpointSnapper.js`の項に今の曲線の端点も吸い付き・結合の対象（コードの変更なし）を必要なら1文。
*   **`_doc/arch/15_io.md`**：曲がり方を持つ区間（`segments`の`control1`・`control2`）も`toJSON()`・`Path.fromJSON`・`toDrawElement()`を通るため`io/`のコードを変えずに保存・読み込み・書き出しされること（`corners`の項と同じ形の1文）。
*   **`_doc/arch/16_test.md`**：Phase 09-03aの追加分（ファイルごとの検証範囲）、書き換えた既存のテスト（「2. 要件F」の11件とその理由）、テストできない箇所（画面での見え方・ドラッグでの吸い付きの表示・ついていくふるまいの使い勝手）、件数（タスク6で記録）。`test/shapes/Path.test.js`・`PathJoinRules.test.js`・`EndpointSnapRules.test.js`・`PathCornerRules.test.js`・`PathSegmentKindRules.test.js`・`test/edit/PathJoiner.test.js`・`EndpointSnapper.test.js`・`test/io/DocumentSerializer.roundtrip.test.js`・`DocumentSerializer.errors.test.js`・`SpriteSerializer.test.js`の検証範囲の行に追記。

## 3. タスクリスト
*   [x] タスク1: 要件A 曲がり方を持つ区間（`shapes/Path`）
    *   **対象ファイル** :
        *   `./js/shapes/Path.js` : 更新（定数`SEGMENT_KIND_BEZIER`・typedef`SegmentSpec`・非公開の`copySegment`・`#shiftControlsAt`の追加、`ACCEPTED_SEGMENT_KINDS`・コンストラクタ・`#segmentControls`・`setVertex`・`translate`・`toJSON`・`fromJSON`の変更、ファイル先頭の責務定義・クラスJSDoc・関係するJSDocの更新のみ）
        *   `./test/shapes/Path.test.js` : 更新（「2. 要件F」の(F-1)の`describe`の追加のみ）
    *   **作業内容** :
        *   「2. 要件A」のとおりにする。`computeSmoothSegmentControls`へ渡す`smoothFlags`は今どおり`kind === SEGMENT_KIND_SMOOTH`（曲がり方を持つ区間は偽）。`#tracePath`・`#someSegment`・`#fillPolygon`・`toDrawElement`のコードは変えない（分岐は`#segmentControls`の1か所）。`getVertexHandleNames`・`hitTestHandle`・`drawHandles`・`getHandlePosition`・`getVertexIndexForHandle`・`isFillable`・`hitTestFill`・`draw`・`drawHover`・`drawOutline`・`intersectsRect`・`hitTest`・`updateDraftEnd`・`readCornerFlags`のコードは変えない。
        *   未知の区間の種類のエラー文は今の文面（`'line'・'smooth'`）のまま（`ACCEPTED_SEGMENT_KINDS`から`SEGMENT_KIND_BEZIER`を除いて作り、理由をコメントとJSDocに書く）。
        *   足した定数・typedef・関数・メソッド、変えた引数・フィールド（`segments`の型）・`@throws`にJSDocを書く。ファイル先頭の責務定義は3行以内。
        *   (F-1)のテストを足す（既存のケースは変えない）。JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク1に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する（資料本体は直さない）。
*   [x] タスク2: 要件B・要件C 今の曲線を結合できる線にする（`shapes/PathJoinRules`・`shapes/EndpointSnapRules`）
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` : 更新（importへの`SEGMENT_KIND_BEZIER`の追加、`isJoinableLine`・`classifyJoin`・`chainOf`・`reverseChain`の変更、`segmentSpecsOf`・`chainSourceOf`・`reverseSegmentSpec`の追加、ファイル先頭の責務定義・typedef`SegmentChain`・関係するJSDocの更新のみ）
        *   `./js/shapes/EndpointSnapRules.js` : 更新（`resolveEndpointHandle`・`findSnapTarget`のJSDocのみ。コードは変えない）
        *   `./test/shapes/PathJoinRules.test.js` : 更新（「2. 要件F」の書き換え1.〜7.と補助の定数・JSDoc、(F-2)の`describe`の追加）
        *   `./test/shapes/EndpointSnapRules.test.js` : 更新（「2. 要件F」の書き換え8.・9.、(F-3)の`describe`の追加）
        *   `./test/edit/PathJoiner.test.js` : 更新（「2. 要件F」の書き換え10.のみ）
        *   `./test/edit/EndpointSnapper.test.js` : 更新（「2. 要件F」の書き換え11.のみ）
    *   **作業内容** :
        *   「2. 要件B」「2. 要件C」のとおりにする。2次→3次の式は`chainSourceOf`の1か所だけに書き、計算の順は「差に2を掛けてから3で割る」。`isDrawnLineShape`・`segmentKindsOf`・作成途中の線の関数・組み立て関数・計画の関数のコードは変えない。`isJoinableLine`の判定を他の関数に写さない。
        *   足した関数・変えた関数・typedefにJSDocを書く（`chainSourceOf`に頂点の並びの約束・式・次数上げで形が同じこと、`reverseSegmentSpec`に引っ張る点を入れ替える理由、`segmentSpecsOf`に使う側と直線を`segmentKindsOf`に任せること）。ファイル先頭の責務定義は3行以内。
        *   テストは書き換え1.〜11.（「2. 要件F」の一覧どおり。題名の直しを含む。10.・11.は`edit/`のテストだが、本タスクの`isJoinableLine`・`classifyJoin`の変更で期待値が変わるため本タスクで行う）と(F-2)・(F-3)を行う。`edit/`の2つのテストファイルは書き換え10.・11.だけを行い、(F-6)・(F-7)の追加はタスク4で行う。一覧にない既存のケースは変えない。一覧にない既存のケースが落ちたら直さずに中断して報告する。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク2に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [x] タスク3: 要件D 角・区間の切り替えで曲がり方を保つ（`shapes/PathCornerRules`・`shapes/PathSegmentKindRules`）
    *   **対象ファイル** :
        *   `./js/shapes/PathCornerRules.js` : 更新（`planCornerToggle`の`new Path`の第6引数を`data.segments`にする1か所と、`CornerState.LINE_CORNER`・`cornerStateOfData`・`resolveCornerState`・`planCornerToggle`のJSDocのみ）
        *   `./js/shapes/PathSegmentKindRules.js` : 更新（importへの`segmentSpecsOf`の追加、`changedSegmentIndexes`・`buildCurvedPath`・`buildStraightenedPath`の変更とJSDocのみ）
        *   `./test/shapes/PathCornerRules.test.js` : 更新（(F-4)の`describe`の追加のみ）
        *   `./test/shapes/PathSegmentKindRules.test.js` : 更新（(F-5)の`describe`の追加のみ）
    *   **作業内容** :
        *   「2. 要件D」のとおりにする。角の状態の判定（`cornerStateOfData`）のコードは変えない。`collectSwitchEntries`・`buildLineFromCurve`・`resolveSegmentSwitchAvailability`・`planSegmentKindSwitch`・`resolveCornerToggleView`・`statesOf`・`dataOf`のコードは変えない。形の決め方の式・角の状態の判定・`corners`の読み方・「直線は直線の区間1つ」を写さない。
        *   変えた関数・値のJSDocを実態に合わせる（名前・値は変えない）。
        *   (F-4)・(F-5)のテストを足す（既存のケースは変えない）。JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク3に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [x] タスク4: 要件E 手順の層の確認とテスト（`edit/PathJoiner`のJSDoc・`edit/`のテスト）
    *   **対象ファイル** :
        *   `./js/edit/PathJoiner.js` : 更新（ファイル先頭の責務定義の括弧書き「直線・開いたパス」を「直線・開いたパス・今の曲線」に直すのみ。コード・ほかのJSDocは変えない）
        *   `./test/edit/PathJoiner.test.js` : 更新（(F-6)のテストの追加のみ。書き換え10.はタスク2で済ませる）
        *   `./test/edit/EndpointSnapper.test.js` : 更新（(F-7)のテストの追加のみ。書き換え11.はタスク2で済ませる）
    *   **作業内容** :
        *   「2. 要件E」の経路（`setVertex`は`updateVertices`からだけ・`translate`は`moveShapes`・`moveShapesBy`・`ShapeInserter`から・`InputTracker`の端点のドラッグは図形種別を見ない）を実コードで確かめる。`js/edit/`（`PathJoiner.js`の責務定義を除く）・`js/core/`・`js/io/`・`js/main.js`のコードを変える必要が出たら、変えずに中断して理由を報告する。
        *   テストは(F-6)・(F-7)の追加だけを行う（書き換え10.・11.はタスク2で済んでいる）。既存の補助（`setupFake`・`setupReal`・`makeCurve`等）を使う。一覧にない既存のケースは変えない。
        *   `node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク4に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [x] タスク5: 要件A・E 保存・書き出しのテスト（`io/`。コードは変えない）
    *   **対象ファイル** :
        *   `./test/io/DocumentSerializer.roundtrip.test.js` : 更新（(F-8)の`describe`の追加のみ）
        *   `./test/io/DocumentSerializer.errors.test.js` : 更新（(F-9)の`describe`の追加のみ）
        *   `./test/io/SpriteSerializer.test.js` : 更新（(F-10)の`describe`の追加のみ）
    *   **作業内容** :
        *   (F-8)〜(F-10)のテストを足す（今の曲線と直線の結合の結果は`PathJoinRules.planJoin`で作る。既存の補助関数を使う。既存のケースは変えない）。`js/io/`のコードとJSDocは変えない。
        *   `node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク5に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [x] タスク6: 仕上げの確認（JSDoc・スコープ・全テスト）
    *   **対象ファイル** :
        *   （確認のみ。不備があればタスク1〜5の対象ファイルの中でだけ直す）
    *   **作業内容** :
        *   タスク1〜5で足した・変えた関数・定数・typedef・引数・フィールドのJSDocに漏れが無いこと、変えたファイルの先頭の責務定義が3行以内で実態に合うことを確かめる。
        *   変えたファイルがタスクの対象ファイルだけであること（`git status`・`git diff --stat`で確かめる。`js/core/`・`js/io/`・`js/check/`・`js/wiring/`・`js/palette/`・`js/main.js`・`index.html`・`sprite-check.html`・`asset/`・`ShapeGeometry`・`ShapeDataValidation`・`Curve`・`Line`・`Rect`・`Ellipse`・`edit/`の`PathJoiner.js`以外は不変。`PathJoiner.js`・`EndpointSnapRules.js`はJSDocだけ）、改名・整形・不要に見えるコードの削除をしていないこと、`KeyboardShortcuts.js`の対応表・共通メソッド契約（18メソッド）が変わっていないことを確かめる。
        *   規則の二重定義が無いこと（結合できる線の判定は`isJoinableLine`、「直線は直線の区間1つ」は`segmentKindsOf`、今の曲線を区間として読む規則と2次→3次の式は`chainSourceOf`、区間の写しは`copySegment`、制御点の求め方は`#segmentControls`、打った点の曲線の区間の式は`computeSmoothSegmentControls`、角の状態の判定は`resolveCornerState`、変わる区間の決め方は`changedSegmentIndexes`の各1か所）と、`edit/`・`core/`・`io/`・`palette/`・`main.js`に区間の種類（`'bezier'`・`'smooth'`）・図形種別（`'curve'`）・引っ張る点（`control1`・`control2`）の文字列が増えていないことを`Grep`で確かめる。
        *   `node --test`が全件通ることを確かめ、件数（tests / suites / pass / fail）を記録する（作業前は tests 1926 / suites 306）。書き換えた既存のケースが「2. 要件F」の11件だけであることを記録する。
        *   完了後、本RESの「4. 詳細作業内容」のタスク6に確認結果を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク7: 要件G テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   （本RESのみ）
    *   **作業内容** :
        *   「2. 要件G」の確認項目0〜10（準備の作業データを含む）を、本RESの「4. 詳細作業内容」のタスク7へ写し、実装の結果に合わせて文言を確かめる（実装で判明した注意点があれば足す）。最終報告でも提示する。
*   [ ] タスク8: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
        *   `./_doc/arch/12_shapes.md` : 更新
        *   `./_doc/arch/14_edit.md` : 更新
        *   `./_doc/arch/15_io.md` : 更新
        *   `./_doc/arch/16_test.md` : 更新
    *   **作業内容** :
        *   本タスクは、実装AIによる開発資料の書き換えが原則禁止の本ワークフローにおいて、**明示的な例外**として行う（後続タスクが無く、資料の変更で他タスクの前提が動く危険が無いため）。上のファイル（本タスクでパス指定する`_doc/arch/`のファイル）だけを読み・直す。
        *   本RESの「2. 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」と、各タスクで追記された分を確かめ、資料へ反映する。少なくとも、`PROJECT_ARCHITECTURE.md`の2章`path`（曲がり方を持つ区間の約束・作業データでの形・つなぎ目・頂点を動かしたときのふるまい・古いエディタでの扱い）・`curve`（結合できること）、3章11.・12.（結合できる線・吸い付く対象に今の曲線を足す。「やらないこと」の「今の曲線（`curve`）の結合」を直す）・22.（続けて引く線の形は変わらないこと）・23.・24.（曲がり方を持つ区間との関係）、1章「存在しないもの」（今の曲線の結合を消し、引っ張る点の表示・直接の操作などを足す）を直す。
        *   資料の記載基準（`PROJECT_ARCHITECTURE.md`冒頭）に従い、1つのファイルのJSDocを読めば分かることは書かない。誤った記述は直すか消す。
        *   `_doc/arch/16_test.md`の件数はタスク6で記録した値を使う。
        *   完了後、本RESの「4. 詳細作業内容」のタスク8に反映した箇所を記載する。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件A 曲がり方を持つ区間（`shapes/Path`）
*   **作業内容** :
    *   `js/shapes/Path.js`：定数`SEGMENT_KIND_BEZIER`・typedef`SegmentSpec`・非公開関数`copySegment`・非公開メソッド`#shiftControlsAt`を追加。`ACCEPTED_SEGMENT_KINDS`に`'bezier'`を追加（エラー文は`filter`で除いて既存の文面を保つ。コメント・JSDocに理由）。コンストラクタ（配列は`copySegment`で写す）・`#segmentControls`（`'bezier'`の区間だけ引っ張る点に置き換え）・`setVertex`（差分を`#shiftControlsAt`へ）・`translate`（引っ張る点も移動）・`toJSON`・`fromJSON`（`control1`/`control2`の検証と`copySegment`）を変更。ファイル先頭の責務定義（3行）・クラスJSDoc・関係するJSDocを更新。`#tracePath`等のコードは不変。
    *   `test/shapes/Path.test.js`：`describe('Path の曲がり方を持つ区間（Phase 09-03a）')`を追加（(F-1)の全項目。補助`bez`）。既存ケースは変更なし。
    *   `node --test`：tests 1943 / suites 307 / pass 1943 / fail 0。
    *   開発資料への影響：「開発資料の更新予定」の既存記載の範囲内。追加の更新予定なし。

### タスク2: 要件B・要件C 今の曲線を結合できる線にする（`shapes/PathJoinRules`・`shapes/EndpointSnapRules`）
*   **作業内容** :
    *   `js/shapes/PathJoinRules.js`：importに`SEGMENT_KIND_BEZIER`を追加。`isJoinableLine`を`isDrawnLineShape(shape) || shape.type === 'curve'`に、`classifyJoin`の2本の`typeOk`に`'curve'`を追加。非公開`chainSourceOf`（今の曲線→開いたパス。2次→3次の式は`s + (c - s) * 2 / 3`の1か所）・公開`segmentSpecsOf`・非公開`reverseSegmentSpec`を追加。`chainOf`は`chainSourceOf`→`segmentSpecsOf`、`reverseChain`は`.map(reverseSegmentSpec)`に変更。typedef`SegmentChain`・責務定義（3行）・関係するJSDocを更新。`isDrawnLineShape`・`segmentKindsOf`・組み立て／計画の関数のコードは不変。
    *   `js/shapes/EndpointSnapRules.js`：`resolveEndpointHandle`・`findSnapTarget`のJSDocのみ（コード不変）。
    *   テスト：書き換え1.〜11.を実施（`PathJoinRules.test.js` 1〜7＋補助`JOIN_REJECTED_KINDS`、`EndpointSnapRules.test.js` 8・9、`PathJoiner.test.js` 10、`EndpointSnapper.test.js` 11）。(F-2)・(F-3)の`describe`を追加（`PathJoinRules.test.js`に補助`makeCurve`・`idOf`・`makeSpecPath`）。
    *   監査の指摘の修正：`segmentKindsOf`のJSDocの「使う側」に`segmentSpecsOf`・`drawnSegmentKind`を記載（ファイル内の呼び出し箇所を確認。コード不変）。(F-2)に「今の曲線＋開いた直線のパス」のケースを追加、「今の曲線＋開いたパス」のケースで打った点の曲線の区間の`toDrawElement()`の制御点が結合の前と同じことも確認、スタイルのケースに塗りの確認を追加（テストの補助`makeCurve`・`makeLine`に塗りの引数を追加）。
    *   `node --test`：tests 1973 / suites 317 / pass 1973 / fail 0。一覧外で落ちた既存ケースなし。
    *   開発資料への影響：「開発資料の更新予定」の既存記載の範囲内。追加の更新予定なし。

### タスク3: 要件D 角・区間の切り替えで曲がり方を保つ（`shapes/PathCornerRules`・`shapes/PathSegmentKindRules`）
*   **作業内容** :
    *   `js/shapes/PathCornerRules.js`：`planCornerToggle`の`new Path`の第6引数を`data.segments`に変更。`CornerState.LINE_CORNER`・`resolveCornerState`・`planCornerToggle`のJSDocを実態に合わせた（`cornerStateOfData`のコードは不変）。
    *   `js/shapes/PathSegmentKindRules.js`：importに`segmentSpecsOf`を追加。`changedSegmentIndexes`の「直線に」を`kinds[i] !== SEGMENT_KIND_LINE`に（「曲線に」は`=== SEGMENT_KIND_LINE`のまま）。`buildCurvedPath`・`buildStraightenedPath`は区間の並びを`segmentSpecsOf(data)`で読む。3関数のJSDocを更新。`collectSwitchEntries`・`buildLineFromCurve`ほかは不変。
    *   テスト：`PathCornerRules.test.js`に(F-4)、`PathSegmentKindRules.test.js`に(F-5)の`describe`を追加（既存ケースは不変）。
    *   diff監査の軽微2件を修正：`buildCurvedPath`のJSDocに「曲がり方を持つ区間に接する点は元の値のまま」を追記。F-5の「隣の直線の区間を曲線に」のケースは、曲がり方を持つ区間に接する点の元の値を`false`にし（`[false, false, true, false]`）、期待を`[false, false, false, true, false]`として、その点の角の情報が元のまま残ることを見分けられるようにした。コードのふるまいは不変。
    *   `node --test`：tests 1981 / suites 319 / pass 1981 / fail 0。
    *   開発資料への影響：「開発資料の更新予定」の既存記載の範囲内。追加の更新予定なし。

### タスク4: 要件E 手順の層の確認とテスト（`edit/PathJoiner`のJSDoc・`edit/`のテスト）
*   **作業内容** :
    *   `js/edit/PathJoiner.js`：ファイル先頭の責務定義の括弧書きを「直線・開いたパス・今の曲線」に直した（3行以内のまま。コード・ほかのJSDocは不変）。
    *   経路の確認：`PathJoiner`は`classifyJoin`・`planJoin`の結果に従うだけ、`EndpointSnapper`は規則の結果に従うだけで、図形種別の分岐を持たないことをコードで確かめた。`js/edit/`（責務定義を除く）・`js/core/`・`js/io/`・`js/main.js`のコード変更は不要だった。
    *   `test/edit/PathJoiner.test.js`：(F-6)として、偽物の依存で今の曲線と直線の`canJoin`真・`join`の`replaceShape`の図形の区間が`['bezier','line']`のテストと、実物の組み合わせで結合 → 取り消し1回で元の今の曲線（`type:'curve'`・`points`同じ）と直線 → やり直しで結合後のテストを追加。
    *   `test/edit/EndpointSnapper.test.js`：(F-7)として、今の曲線の端点を直線の端点へドラッグした`joinDraggedEndpoint`が`replaceShape`（`select:true`）を呼び区間に`'bezier'`を含むテストと、`commitDrawnLine`で描き始めが今の曲線の端点のとき`keepId:true`で今の曲線のidを保つテストを追加。
    *   `node --test`：tests 1985 / suites 319 / pass 1985 / fail 0。
    *   開発資料への影響：「開発資料の更新予定」の既存記載の範囲内。追加の更新予定なし。

### タスク5: 要件A・E 保存・書き出しのテスト（`io/`。コードは変えない）
*   **作業内容** :
    *   `test/io/DocumentSerializer.roundtrip.test.js`：importに`planJoin`を追加し、(F-8)の`describe`を追加（曲がり方を持つ区間を含む開いた・閉じた塗りあり・直線／曲線と混在・角の点ありのパスの往復をオブジェクト層・文字列層で、今の曲線と直線を`planJoin`で結合した結果の往復と作業データの`version`が2のまま）。
    *   `test/io/DocumentSerializer.errors.test.js`：(F-9)の`describe`を追加（引っ張る点が欠ける・null・座標が数値でない・有限でない曲がり方を持つ区間のパスは、そのパスだけスキップされ残りが復元される）。
    *   `test/io/SpriteSerializer.test.js`：importに`planJoin`を追加し、(F-10)の`describe`を追加（`bezierPath`の`formatVersion`3・`cubic`の`control1`・`control2`が作業データと一致、区間1つのパスの外枠が同じ形の今の曲線（`quadratic`）の外枠と一致、今の曲線と直線の結合結果の外枠が`sampleBezierPathRange`で形を囲む）。既存ケース・`js/io/`は不変。
    *   `node --test`：tests 2002 / suites 322 / pass 2002 / fail 0。
    *   開発資料への影響：「開発資料の更新予定」の既存記載の範囲内。追加の更新予定なし。

### タスク6: 仕上げの確認（JSDoc・スコープ・全テスト）
*   **作業内容** :
    *   JSDoc・責務定義：タスク1〜5で足した・変えた定数・関数・typedefのJSDocに漏れなし。変えたファイル（`Path.js`・`PathJoinRules.js`・`EndpointSnapRules.js`・`PathCornerRules.js`・`PathSegmentKindRules.js`・`PathJoiner.js`）の先頭の責務定義はいずれも3行以内で実態に合う。
    *   タスク3の監査候補2点を実コードで照合し、食い違っていたためJSDocだけを直した（名前・値・コードは不変）。
        *   `js/shapes/PathCornerRules.js`の`CornerState.CORNER`・`SMOOTH`：`cornerStateOfData`は両側の`kind`が`'smooth'`（打った点の曲線の区間）のときだけ`CORNER`／`SMOOTH`を返し、曲がり方を持つ区間（`'bezier'`）は`LINE_CORNER`になる。「両側とも曲線の区間の点」は曲がり方を持つ区間も含むと読めるため、「両側とも打った点の曲線の区間の点」に直した。
        *   `js/shapes/PathSegmentKindRules.js`の`SegmentKindSwitch.TO_LINE`：`changedSegmentIndexes`は`kind !== 'line'`の区間（打った点の曲線の区間・曲がり方を持つ区間）を直線にする（今の曲線`type === 'curve'`も`buildLineFromCurve`で直線になる）ため、「打った点の曲線の区間・曲がり方を持つ区間を直線の区間にし、今の曲線は直線にする」に直した。
    *   スコープ：`git diff HEAD~5 --stat`の変更ファイルは対象ファイルだけ（`js/`は上の6ファイル、`test/`は対象のテスト10ファイル。`js/core/`・`js/io/`・`js/check/`・`js/wiring/`・`js/palette/`・`js/main.js`・`index.html`・`sprite-check.html`・`asset/`・`ShapeGeometry`・`ShapeDataValidation`・`Curve`・`Line`・`Rect`・`Ellipse`・`KeyboardShortcuts.js`は不変）。`PathJoiner.js`は責務定義の1行だけ。
    *   二重定義：`js/edit/`・`js/core/`・`js/io/`・`js/palette/`・`js/main.js`に今回の変更で増えた`'bezier'`・`'smooth'`・`'curve'`・`control1`・`control2`は無い（`Grep`。残る出現は`ShapeFactory.js`・`CodeExporter.js`・`SpriteSerializer.js`の既存分で差分に含まれない）。
    *   `node --test`：tests 2002 / suites 322 / pass 2002 / fail 0（作業前は tests 1926 / suites 306）。書き換えた既存のケースは「2. 要件F」の11件だけ。
    *   開発資料への影響：追加の更新予定なし（「開発資料の更新予定」の範囲内）。

### タスク7: 要件G テストプレイの確認項目を発注者へ提示する
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク8: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
*   **作業内容** :
    *   （タスク実行時に記入）

## 5. 懸念事項・要確認ポイント
* **（計画時）`fromJSON`の未知の区間の種類のエラー文**：REQの方針「受理する区間の種類（`ACCEPTED_SEGMENT_KINDS`）を広げる」と、最上位の要件「既存のテストの期待値は変えない」（`test/shapes/Path.test.js`の5か所がエラー文`…のkindが'line'・'smooth'ではありません（…）`を完全一致で確かめている）が、今の「エラー文は`ACCEPTED_SEGMENT_KINDS`の並びから作る」作りのままでは両立しない。計画では、受理は`ACCEPTED_SEGMENT_KINDS`に`'bezier'`を足して広げ、エラー文の並びは`'bezier'`を除いて作る（今の文面を保つ）ことにした。未知の区間の種類のエラー文に`'bezier'`が挙がらない点は、既存のテストの期待値を変えてよいと判断されるまで残る。
* **（計画時）端点をまとめるときの引っ張る点**：結合のボタン・`J`で端点が画面上5px以内で離れて「重なっている」とみなされ、基準の線Aでない側（B）が今の曲線（曲がり方を持つ区間）のとき、Bの端点はAの端点の座標に置き換わるが、その側の引っ張る点は動かさない（今の「Bの端点を除く」規則のまま）。このため、その端点の位置の差（5px以内）の分だけ、元の今の曲線の端の近くの形がわずかに変わる（端点が完全に重なっているとき・端点のドラッグやツールで吸い付いて結合したときは形は元のまま）。「頂点を動かすとその側の引っ張る点がついていく」と同じ扱いにするかは、テストプレイで違和感があれば発注者が判断する。
* **（計画時）頂点2つでは閉じられない形（今の曲線1本と直線1本の半月形、今の曲線2本のレンズ（葉）形）**：閉じたパスは頂点3つ以上が要る（今の作業データの約束。`Path.fromJSON`・`buildClosedPath`（`js/shapes/PathJoinRules.js:164-170`で、重なる端点をまとめた後に頂点が3つ未満なら`null`））。今の曲線と直線を両端で結合した開いたパス（頂点3つで始点と終点が重なる）、および今の曲線2本を両端で結合した開いたパス（同じく頂点3つで始点と終点が重なる。区間は曲がり方を持つ区間2つ）は、`classifyJoin`が`'close'`を返すため結合のボタンが押せる見た目になるが、まとめると頂点2つになり`planJoin`が`null`を返すため、押しても何も起きない（直線2本で同じ形を作った場合の今のふるまいと同じ。押せるのに何も起きないボタンになる）。今の曲線では自然に作りうる形のため、扱いを変えるか（頂点2つの閉じたパスを許す・ボタンを押せない見た目にする等）は発注者の判断が要る（本作業の範囲外。REQの「今の曲線1本だけでは閉じない（閉じるには頂点3つ以上のパスが要る）」に沿って今のままとした）。
* （タスク2）`chainOf`の`points`は`chainSourceOf`が返す新しい配列（今の曲線）か元の`data.points`（直線・パス。従来どおり共有）。`reverseSegmentSpec`は引っ張る点の座標オブジェクトを入れ替えて共有する（`Path`のコンストラクタが写すため結果は共有しない）。
* （タスク実行時に、確信が持てなかった箇所・目視確認してほしい箇所・『参照する責務』と実コードの相違があれば追記する）
