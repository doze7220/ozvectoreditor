# RES: 作業計画・作業レポート (Phase 09-01b) : 曲線のパスと既存の線のつながり（描き足し・つながる・結合）
* 参照元REQ: `./_log/req/261119_1002_REQ_Phase09-01b_Curve_Join.md`

## 1. 作業目的
前の作業（Phase 09-01a。RES `261118_1937_RES_Phase09-01a_Curve_Tool`）で、曲線のパス（曲線の区間`'smooth'`を1つ以上持つパス）は「結合できる線」から外していた（`shapes/PathJoinRules.js`の`isJoinableLine`）。本作業（Phase 09-01 の後半（b））ではこの除外を外し、**曲線のパスと既存の線（直線・パス）が、直線のパスどうしと同じ操作でつながる**ようにする。対象の操作は、曲線のツールでの描き足し・つながる・閉じる、直線のツールでの曲線のパスへの描き足し・つながる、結合（ツールバーのボタン・`J`）、頂点の選択（`A`）での端点のハンドルのドラッグによる結合・閉じる。いずれの操作でも、**つながった後のパスは元の各区間の種類（直線か曲線か）を保つ**。

守ること（REQの最上位の要件）：
*   リポジトリのルートの`node --test`が全件通る。作業開始前の件数は **tests 1719 / suites 268 / pass 1719 / fail 0**。既存のテストの期待値を変えるのは、本作業で意味が変わるもの（曲線のパスが結合できる線に含まれること・曲線のツールが描き始めに吸い付くこと）だけで、変えるケースは「2. 要件H」に列挙する（理由つき）。
*   直線・直線の区間だけのパスどうしの結合・描き足し・吸い付き・閉じるの結果（頂点の並び・区間・id・重なり順・スタイル）を変えない。直線のツールの連続作成、曲線のツールで新しく引く・閉じる（09-01aのふるまい）も変えない。
*   今の曲線（`curve`）・弧・矩形・円・閉じたパスは今までどおり結合・吸い付きの対象外。
*   作業データ形式の版（2）・書き出し形式の版（3）は変えない。データに新しい項目を足さない。
*   改名・整形・「不要に見えるコードの削除」をしない。既存の公開関数名・メソッド名・フィールド名・DOMのid・クラス名は変えない（意味が広がる関数は名前を変えずにJSDocを実態に合わせる）。キーの割り当ての表は変えない。共通メソッド契約（18メソッド）を増やさない。
*   `InputTracker`・`VectorModel`・`main.js`のコードは変えない（`InputTracker`はJSDocの文言4か所だけ。要件F）。`InputTracker`・`VectorModel`に図形種別の文字列の比較を足さない。

**用語**（REQの用語のまま。コード・資料でも使い分ける）：
*   **曲線の区間**（`'smooth'`）・**直線の区間**（`'line'`）・**曲線の連なり**・**曲線のパス**・**今の曲線**（`curve`）：09-01aと同じ（`PROJECT_ARCHITECTURE.md` 2章`path`）。
*   **結合できる線・端点・描き足し・つながる・閉じる**：`PROJECT_ARCHITECTURE.md` 3章11.・12.・22.と同じ。
*   **間を埋める区間**：つなぐ2つの端点が重なっていない（距離が`tolerance`より大きい）ときに、2つの端点の間に新しくできる区間。端点が重なっているときは片方（Bの側）の端点を除いて1つにまとめるため、間を埋める区間はできない。
*   **描いた区間**：直線・曲線のツールで打った点の間の区間（付いてくる線の先＝描き終えの点までを含む）。直線のツールなら直線の区間、曲線のツールなら曲線の区間。
*   **区間の列**（本計画の設計用語。コードのJSDocでは「頂点と区間の種類の並び」と書く）：開いた線の頂点の並び`points`と、区間の種類の並び`kinds`（要素数`points.length - 1`）の組。`type`が`'line'`の図形は`kinds = ['line']`（直線の区間1つ）として扱う。

## 2. アーキテクチャ設計

### 全体の方針

*   **結合できる線を「続けて引く線の形」と同じ条件にする**：`isJoinableLine(shape)`の本体を`return isDrawnLineShape(shape);`にする（区間の種類の条件を外す）。`isJoinableLine`を通るすべての判定（`classifyJoin`・`buildClosedPath`・`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`・`canCloseByMergingEnds`・`planCloseOf`ほかの計画・`resolveEndpointHandle`・`findSnapTarget`・`findDrawnLineSnapTarget`）は、これだけで曲線のパスも対象になる。新たな除外は書かない。
    *   **委ねる向き（`isJoinableLine` → `isDrawnLineShape`）の理由**：(1) 今のコードが既に`isJoinableLine`から`isDrawnLineShape`を呼んでおり、区間の条件の1行を消すだけで条件の二重定義が生じない。(2) `isDrawnLineShape`は「線を引いている途中か」と作成途中の線の受け付け条件の唯一の箇所で、結合の概念に依存させない方が自然（逆向きにすると「続けて引く線の形」が「結合できる線」という別の意味の規則に依存する）。
    *   **2つの関数を残す理由**：意味が違う（結合・吸い付きの対象 ⇔ 続けて引く線の形）。今の曲線・弧の結合（Phase 09-03）で結合できる線を広げるときは`isJoinableLine`だけを変えればよく、続けて引く線の形（`EndpointSnapper.isDrawingLine`の判定）は変わらない。公開関数を消さない要件も満たす。
*   **区間の種類を保つ組み立て**：結合・描き足し・閉じるの結果のパスを、頂点の並びと一緒に区間の種類の並びを組み立てて作る。パスの作り方は「**`Path`のコンストラクタの第6引数に、区間ごとの種類の配列も渡せるようにする**」（要件B）。
    *   **この作り方を採る理由**：(1) `segments`の内部の形（`{ kind }`の配列）を知るのは図形クラス`Path`だけのまま保てる（`PathJoinRules`が`path.segments`へ代入する方法は、図形クラスの内部プロパティを読み書きしない約束（`PathJoinRules`は`type`・`id`・`toJSON()`だけを読む）に反する）。(2) 規則の側で`fromJSON`の形のデータを組み立てる方法は、`fromJSON`の検証が`try/catch`を持たない`PathJoinRules`の中で例外を投げ得る（スタイルが検証外の値の図形でも今は結合できるため、既存の結果を変える恐れがある）うえ、読み込み用の入口を組み立てに流用することになる。(3) 第6引数に文字列を渡す既存の呼び出し・省いた呼び出しの結果は変わらない（配列のときだけ新しい分岐を通る）。
*   **頂点の並べ方と区間の並べ方は同じ1か所で扱う**：開いたパスの組み立ては今の非公開`assembleOpenPath`（`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`が共有）が、頂点と区間の種類を一緒に並べる。閉じるときの並べ方は今の`buildClosedPath`が、頂点と区間の種類を一緒に扱う。Bの逆順は非公開の`reverseChain`1か所で頂点と区間の種類を一緒に逆にする。
*   **間を埋める区間の種類の決め方**：
    *   既定（結合のボタン・`J`の発注者の決定＝直線）は、非公開の定数`JOIN_GAP_SEGMENT_KIND`（値は`SEGMENT_KIND_LINE`）が唯一の定義。公開の組み立て関数`buildClosedPath`・`buildJoinedPathAt`・`buildExtendedPath`は、間を埋める区間（描き足しでは足す区間）の種類を**省ける末尾の引数**で受け取り、既定は`JOIN_GAP_SEGMENT_KIND`（既存の呼び出し・テストの結果は変わらない）。`buildJoinedPath`（`planJoin`の2本の結合）は常に`JOIN_GAP_SEGMENT_KIND`。
    *   非公開の計画の関数（`planCloseOf`・`planJoinAt`・`planCloseWithPoints`・`planJoinWithPoints`・`extendWithPoints`）は、種類を**必須の引数**で受け取って組み立て関数へ渡すだけ（呼び出し箇所ごとに種類を明示させ、取り違えを防ぐ）。
    *   種類を決めるのは公開の計画の入口の3つだけ：`planJoin`＝既定（直線）、`planDrawnLineJoin`＝描いた区間の種類（非公開`drawnSegmentKind`で作成途中の線から読む）、`planEndpointDragJoin`＝`JOIN_GAP_SEGMENT_KIND`を渡す（端点が重なっているので間を埋める区間はできない。形式上の値）。
*   **曲線のツールの描き始めの吸い付き**：`EndpointSnapRules.isSnapDrawShapeType`を`'line'`と`'curve'`（曲線のツールの図形種別）で真にする（要件D）。引いている途中の吸い付き（`findDrawnLineSnapTarget`）は、`isJoinableLine(drawn)`が曲線のツールの作成途中の線（開いたパス）でも真になるため、コードを変えずに既存の端点を候補にする（実コードで確認済み：`findDrawnLineSnapTarget`は`isJoinableLine(drawn)`が偽のときだけ端点の走査を省いている）。
*   **点2つで開いたまま終えた描き足しの落とし穴**：`EndpointSnapper.finishDrawnLine`は`buildFinishedDrawnLine(drawn, false)`の結果（点2つなら区間の種類を持たない`Line`）を計画へ渡しているため、曲線のツールで描いた情報が消える。`planDrawnLineJoin`に**省ける第6引数`drawnKindSource`（描いた区間の種類を読む作成途中の線。省くと`drawn`）**を足し、`finishDrawnLine`だけが作成途中の線（`model.getDraftShape()`の値）を渡す（要件C・E）。`edit/`は区間の種類の文字列を扱わず、図形を渡すだけ。端点に吸い付いていないときに点2つで`Line`を作る09-01aのふるまい（`buildFinishedDrawnLine`）は変えない。
*   **新しい再描画・同期の経路・新しいファイルは足さない**。描き足し・つながる・閉じる・結合・端点のドラッグの流れ（`EndpointSnapper`・`PathJoiner`・`PathJoinRules`・`EndpointSnapRules`）を使い回す。`InputTracker`・`VectorModel`・`main.js`・`CanvasManager`・`io/`・`check/`のコードは変えない。

**状態の持ち主（二重に持たない）**：区間の種類は図形（`Path.segments`）だけが持つ。結合の規則は`toJSON()`から読み、結果を新しい`Path`として作るだけ（状態を持たない）。曲線の区間の制御点は今までどおり作業データにも図形にも持たず、頂点と区間の種類から式で求める（データに新しい情報を足さない。つなぎ目がなめらかになるのは今の式の性質）。

### 要件A: 結合できる線を広げる（`js/shapes/PathJoinRules.js`の`isJoinableLine`。既存へ変更）

*   `isJoinableLine(shape)`の本体を`return isDrawnLineShape(shape);`だけにする（区間がすべて`SEGMENT_KIND_LINE`かの1行を取り除く。条件は`isDrawnLineShape`に任せ、書き直さない）。`SEGMENT_KIND_LINE`のimportは`segmentKindsOf`・`JOIN_GAP_SEGMENT_KIND`（要件C）・`buildDrawnDraft`などが使い続けるため残る。
*   **JSDoc**（実態に合わせる）：
    *   `isJoinableLine`：「結合できる線か。直線、または区間の種類によらず開いたパス（曲線のパスを含む。Phase 09-01bで広げた）。条件は`isDrawnLineShape`と同じで、ここでは書き直さず任せる。2つの関数を分けて残すのは意味が違うため（結合・吸い付きの対象／続けて引く線の形）で、今の曲線・弧の結合（Phase 09-03）で結合できる線を広げるときはこの関数だけを変える。結合・吸い付きの対象の判定はすべてこの関数に従う。図形を書き換えない」。09-01aの「後半（b）でここを広げる」の文を消す。
    *   `isDrawnLineShape`：「結合できる線（`isJoinableLine`）は、この形のうち区間がすべて直線のもの」→「結合できる線（`isJoinableLine`）は今はこの形と同じ条件（`isJoinableLine`がこの関数に任せる）」。
    *   `classifyJoin`：「曲線のパス1本は'close'にならない（結合できる線でないため）」を消し、`@returns`の「'close'＝頂点3つ以上の開いた（区間がすべて直線の）パス1本」→「頂点3つ以上の開いたパス1本（区間の種類によらない）」。
    *   `buildClosedPath`の`@returns`の「（曲線のパスを含む）」、`canCloseByMergingEnds`の`@returns`の「（曲線のパスでない）」を消す。
    *   ファイル先頭の責務定義（3行以内のまま）：1行目の「結合できる線＝直線と区間がすべて直線の開いたパス」→「結合できる線＝直線と開いたパス（区間の種類によらない）。結果は元の区間の種類を保つ」の趣旨に改める。
*   **変えないもの**：`classifyJoin`・`canCloseByMergingEnds`・`isDrawnLineShape`のコード、`JOIN_TOLERANCE_SCREEN_PX`・`CLOSED_MIN_POINTS`・`LINE_POINT_COUNT`の値、作成途中の線の6関数（`addDrawnPoint`ほか）。

### 要件B: 区間ごとに種類を指定してパスを作る（`js/shapes/Path.js`のコンストラクタ。既存へ変更）

*   コンストラクタの第6引数`segmentKind`の型を`{string|string[]}`へ広げる。
    *   **文字列（既存）**：今のまま、全区間をその種類で作る（`Array.from({ length: 開いた n−1／閉じた n }, () => ({ kind: segmentKind }))`）。省いたときは`SEGMENT_KIND_LINE`（今のまま）。
    *   **配列（新規）**：区間ごとの種類の並びとして、`segmentKind.map((kind) => ({ kind }))`で`segments`を作る（要素ごとに新しいオブジェクト。渡された配列を保持しない）。要素数・種類は検証しない（頂点数と同じく呼び出し側の責任。検証は`fromJSON`だけという今の約束のまま）。要素数は開いたパス`points.length - 1`・閉じたパス`points.length`であること、をJSDocに書く。
    *   分岐は`Array.isArray(segmentKind)`の1か所。
*   **JSDoc**：コンストラクタの`@param`（型と配列の約束）、コンストラクタの説明とクラスのJSDocにある「区間の種類を区間ごとに変えるのは`fromJSON`（`segments`を作り直す）だけ」を「区間ごとに種類を指定して作るのは、コンストラクタへ種類の配列を渡す場合（`PathJoinRules`の結合・描き足し・閉じる）と`fromJSON`（`segments`を作り直す）」へ改める。クラスJSDocの「パスは…`PathJoinRules`が作り」の記述に「結合・描き足し・閉じるの結果は元の区間の種類を保つ」を足してよい。ファイル先頭の責務定義は変えない。
*   **変えないもの**：`fromJSON`（今のまま`segments`を作り直す）・`toJSON`・18メソッドのすべて・定数。
*   **テストの観点**（`test/shapes/Path.test.js`へ`describe`を追加。既存のケースは変えない）：(1) 配列を渡すと区間ごとの種類になる（開いた`n−1`・閉じた`n`、`'line'`と`'smooth'`の混在）。(2) 構築後に渡した配列を書き換えても`segments`が変わらない（共有しない）。(3) 同じ頂点・種類の`fromJSON`で作ったパスと`toJSON()`・`toDrawElement()`が一致する。(4) 第6引数に文字列を渡す・省くときの結果が今と同じ（既存のケースが通ること＋全区間`'line'`/`'smooth'`の1件ずつ）。

### 要件C: 区間の種類を保つ組み立てと計画（`js/shapes/PathJoinRules.js`。既存へ変更）

*   **定数（新規・非公開）**：`const JOIN_GAP_SEGMENT_KIND = SEGMENT_KIND_LINE;`　JSDoc：「結合（ボタン・`J`）で間を埋める区間の種類（発注者の決定：直線）で、間を埋める区間・描き足す区間の種類を受け取る組み立て関数の既定値。唯一の定義箇所」。
*   **区間の列の補助（新規・非公開。いずれもJSDocを書く。引数を書き換えない）**：
    *   typedef`SegmentChain`：`{ points: Array<{x, y}>, kinds: string[] }`（開いた線の頂点と区間の種類の並び。`kinds.length === points.length - 1`）。
    *   `segmentKindsOf(data)`：`toJSON()`の値から区間の種類の並びを新しい配列で返す。`data.type === 'line'`なら`[SEGMENT_KIND_LINE]`（直線は直線の区間1つ）、それ以外は`data.segments.map((s) => s.kind)`。開いた線（結合できる線・作成途中の線。いずれも続けて引く線の形）の値だけを渡す。**「`type`が`'line'`の図形は直線の区間1つ」という規則の唯一の定義箇所**（JSDocにそう書く）。
    *   既存の非公開`drawnSegmentKind(data)`（作成途中の線の足す区間の種類）は、この規則を自分で書かず`segmentKindsOf`に任せる（規則の二重定義を避ける）：本体を`const kinds = segmentKindsOf(data); return kinds[kinds.length - 1];`にする（作成途中の線の区間はすべて同じ種類なので、最後の区間の種類＝足す区間の種類。直線なら`[SEGMENT_KIND_LINE]`の最後＝`SEGMENT_KIND_LINE`で、今の結果と同じ）。JSDocの「`type`が`'line'`なら`SEGMENT_KIND_LINE`、パスなら最後の区間の`kind`」を「`segmentKindsOf`の最後の要素（直線は直線の区間1つとして扱う規則は`segmentKindsOf`に任せる）。作成途中の線の区間はすべて同じ種類」の趣旨に改める。呼び出し元（`addDrawnPoint`・`removeLastDrawnPoint`・`buildFinishedDrawnLine`）のコードは変えない。
    *   `chainOf(data)`：`{ points: data.points, kinds: segmentKindsOf(data) }`。
    *   `reverseChain(chain)`：`{ points: chain.points.slice().reverse(), kinds: chain.kinds.slice().reverse() }`（Bを逆順にして並べるときの唯一の箇所。区間の種類の並びも逆順にする。形の決め方の式は向きを逆にしても同じ形になるため、逆順にしても形は変わらない）。
*   **`assembleOpenPath(dataA, bChain, aFirst, merge, gapSegmentKind)`**（既存の非公開。引数を区間の列と種類へ広げる。頂点の並べ方と区間の並べ方の唯一の箇所）：
    ```js
    const aChain = chainOf(dataA);
    const bPoints = bChain.points.slice();
    if (merge) {
        if (aFirst) bPoints.shift();
        else bPoints.pop();
    }
    const joint = merge ? [] : [gapSegmentKind];
    const points = aFirst ? aChain.points.concat(bPoints) : bPoints.concat(aChain.points);
    const kinds = aFirst ? aChain.kinds.concat(joint, bChain.kinds) : bChain.kinds.concat(joint, aChain.kinds);
    return new Path(points, false, dataA.strokeColor, dataA.strokeWidth, dataA.fillColor, kinds);
    ```
    *   端点が重なってまとめるときは、Bの側の端点を除く（今の規則のまま）。除いた端点につながっていた区間（`bChain.kinds`の先頭／末尾）は、残ったAの端点につながる区間として種類を保つ（`kinds`から何も除かない）。離れているときは、Aの区間とBの区間の間に間を埋める区間`gapSegmentKind`を1つ入れる。
    *   JSDocを実態に合わせる（`bSeq`→`bChain`、`gapSegmentKind`の意味、区間の種類の並べ方、結果は元の区間の種類を保つこと）。
*   **公開の組み立て関数**（名前・既存の引数の意味は変えない。省ける末尾の引数を足す関数は、省いた呼び出しの結果が今と同じ）：
    *   `buildJoinedPath(a, b, tolerance)`：引数は変えない。`const bChain = chainOf(b.toJSON())`・`const bReversed = reverseChain(bChain)`とし、4つの候補の`seq`を区間の列（`bChain`／`bReversed`）にする（距離は今と同じく`dataA.points`と`bChain.points`の端点で測る。優先順・同距離の扱いは変えない）。`assembleOpenPath(dataA, best.chain, best.aFirst, best.d <= tolerance, JOIN_GAP_SEGMENT_KIND)`。JSDocに「区間の種類は元の区間の種類を保ち（Bを逆順にするときは区間の種類も逆順）、間を埋める区間は直線（発注者の決定）」を足す。
    *   `buildJoinedPathAt(a, aEnd, b, bEnd, tolerance, gapSegmentKind = JOIN_GAP_SEGMENT_KIND)`：Bは`chainOf(b.toJSON())`、`aEnd === bEnd`なら`reverseChain`。`assembleOpenPath(dataA, bChain, aEnd === 'end', 距離 <= tolerance, gapSegmentKind)`。`@param {string} [gapSegmentKind]`：「端点が離れているときに間を埋める区間の種類。省くと直線。端点が重なってまとめるときは使わない」。
    *   `buildExtendedPath(shape, end, point, tolerance, segmentKind = JOIN_GAP_SEGMENT_KIND)`：`assembleOpenPath(dataA, { points: [{ x: point.x, y: point.y }], kinds: [] }, end === 'end', false, segmentKind)`。`@param {string} [segmentKind]`：「描き足す区間（足す頂点と端点の間の区間）の種類。省くと直線（直線のツールでの描き足しは今どおり直線）」。元の線の区間の種類は保つ。
    *   `buildClosedPath(shape, tolerance, gapSegmentKind = JOIN_GAP_SEGMENT_KIND)`：
        ```js
        const points = data.points.slice();
        const kinds = segmentKindsOf(data);
        // 始点と終点が重なる：最後の頂点を除く。除いた頂点につながっていた区間（最後の区間）は、閉じる区間として種類を保つ
        if (Math.hypot(...) <= tolerance) points.pop();
        // 離れている：閉じる区間（終点→始点）＝間を埋める区間を足す
        else kinds.push(gapSegmentKind);
        if (points.length < CLOSED_MIN_POINTS) return null;
        return new Path(points, true, data.strokeColor, data.strokeWidth, data.fillColor, kinds);
        ```
        先頭の`isJoinableLine`・閉じた・頂点数の判定は今のまま。`@param {string} [gapSegmentKind]`：「始点と終点が離れているときの閉じる区間の種類。省くと直線。重なっているときは使わない（閉じる区間は最後の区間の種類のまま。全区間が曲線なら1周なめらかな輪）」。
    *   `planJoin(shapes, tolerance)`：コードは変えない（既定の直線を使う）。JSDocに「間を埋める区間・閉じる区間は直線」を足す。
*   **非公開の計画の関数**（種類を必須の引数で受け取り、組み立て関数へ渡すだけ）：
    *   `planJoinAt(shapes, first, second, tolerance, gapSegmentKind)` → `buildJoinedPathAt(baseShape, base.end, otherShape, other.end, tolerance, gapSegmentKind)`。
    *   `planCloseOf(shapes, shapeId, tolerance, gapSegmentKind)` → `buildClosedPath(shapes[i], tolerance, gapSegmentKind)`。
    *   `extendWithPoints(shape, end, points, tolerance, segmentKind)` → 各点で`buildExtendedPath(current, end, point, tolerance, segmentKind)`。
    *   `planCloseWithPoints(shapes, ref, interior, tolerance, segmentKind)` → `extendWithPoints(…, segmentKind)`の後に`buildClosedPath(extended, tolerance, segmentKind)`（打った途中の点の区間も、最後の点から元の線のもう一方の端点までの閉じる区間も描いた区間）。
    *   `planJoinWithPoints(shapes, startRef, endRef, interior, tolerance, segmentKind)` → `extendWithPoints(baseShape, base.end, seq, tolerance, segmentKind)`の後に`buildJoinedPathAt(extended, base.end, otherShape, other.end, tolerance, segmentKind)`。
    *   それぞれのJSDocに引数を足す。今の処理の順・`?? shapes[i]`・`?? baseShape`の扱いは変えない。
*   **公開の計画の入口**：
    *   `planDrawnLineJoin(shapes, drawn, startSnap, endSnap, tolerance, drawnKindSource = drawn)`：両方`null`の早期`return`の後に`const segmentKind = drawnSegmentKind(drawnKindSource.toJSON());`を求め、上の5つの非公開の計画の関数（単点の描き足しの`extendWithPoints`を含む）すべてへ渡す。分岐の順・頂点の取り出し方は変えない。JSDoc：「描き足す区間・間を埋める区間・閉じる区間は描いた区間の種類（作成途中の線の足す区間の種類＝直線のツールなら直線、曲線のツールなら曲線）。`drawnKindSource`＝描いた区間の種類を読む作成途中の線（`toJSON()`を持つ直線か開いたパス）。省くと`drawn`。開いたまま終えたときは`drawn`に終えた線（点2つなら区間の種類を持たない`Line`）を渡すため、呼び出し側が作成途中の線を渡す」。`drawn`のJSDocの「頂点2つ以上の直線か開いたパス」は今のまま。
    *   `planEndpointDragJoin`：`planCloseOf(shapes, dragged.shapeId, tolerance, JOIN_GAP_SEGMENT_KIND)`・`planJoinAt(shapes, dragged, snap, tolerance, JOIN_GAP_SEGMENT_KIND)`。JSDocに「ドラッグした頂点は吸い付いた端点の座標にあり端点が重なっているため、間を埋める区間はできない（形式上、既定の種類を渡す）。区間の種類は元の区間の種類を保つ」を足す。
*   **直線のパスどうしの結果が今と同じであること**：区間がすべて直線の入力で間を埋める区間も直線なら、`kinds`はすべて`'line'`で、`new Path(points, closed, …, kinds)`の`toJSON()`は今の`new Path(points, closed, …)`と同じ。頂点の並び・まとめ方・id・`targetId`・`keepId`・`removeIds`・スタイルの扱いはコードを変えない。
*   **テストの観点**は要件Hに列挙する。

### 要件D: 曲線のツールの描き始めの吸い付き（`js/shapes/EndpointSnapRules.js`。既存へ変更）

*   `isSnapDrawShapeType(shapeType)`：`return shapeType === 'line' || shapeType === 'curve';`（「直線・曲線のツールで描くときだけ吸い付く」の規則の唯一の定義箇所のまま）。JSDoc：「`'curve'`は曲線のツールの図形種別（`ShapeFactory`の`curve`。作成途中の図形は曲線のパスで、今の曲線を作るわけではない）。弧・矩形・円は偽」。`@returns`を「`'line'`・`'curve'`のときだけ真」へ。
*   `findDrawnLineSnapTarget`・`findSnapTarget`・`resolveEndpointHandle`・`findNearestEndpoint`のコードは変えない（`isJoinableLine`の広がりで曲線のパスが対象になる。`findDrawnLineSnapTarget`の`isJoinableLine(drawn)`の条件はコードに残す。作成途中の線は続けて引く線の形なので、09-01b以降は直線・曲線のツールのどちらでも真）。
*   **JSDoc**（実態に合わせる）：`resolveEndpointHandle`の「結合できない線（曲線・曲線の区間を含むパス・矩形・円・弧・閉じたパス）…結合できる線は直線・区間がすべて直線の開いたパス」→「結合できない線（今の曲線・矩形・円・弧・閉じたパス）…結合できる線は直線・開いたパス（曲線のパスを含む）」。`findSnapTarget`の「結合できる線（直線・区間がすべて直線の開いたパス）」→「結合できる線（直線・開いたパス。曲線のパスを含む）」。`findDrawnLineSnapTarget`の手順1.の「（直線・区間がすべて直線の開いたパス）…（偽なら…曲線のツールの作成途中の線は既存の線の端点に吸い付かない）」→「作成途中の線は続けて引く線の形で常に結合できる線のため、直線・曲線のツールのどちらでも既存の端点を候補にする（偽なら端点を走査しない分岐はコードに残る）」。ファイル先頭の責務定義は変えない。

### 要件E: 開いたまま終えた描き足しへ描いた区間の種類を伝える（`js/edit/EndpointSnapper.js`。既存へ変更）

*   `finishDrawnLine(startSnap)`の手順4.：`this.#reflectDrawnJoin(finished, startSnap, null)` → `this.#reflectDrawnJoin(finished, startSnap, null, drawn)`（`drawn`はメソッドの先頭で取った`model.getDraftShape()`の値＝作成途中の線）。
*   `#reflectDrawnJoin(drawn, startSnap, endSnap, drawnKindSource)`：第4引数を足し、`planDrawnLineJoin(shapes, drawn, startSnap, endSnap, tolerance, drawnKindSource)`へそのまま渡す（`commitDrawnLine`からは3引数のまま呼び、`undefined`が渡って`planDrawnLineJoin`の既定（`drawn`＝作成途中の図形）になる）。処理の順（計画 → `cancelDraft` → `beginEdit` → `replaceShape` → `commitEdit`）・`screenLengthToWorld`の呼び出し回数は変えない。
*   **JSDoc**（実態に合わせる。3行以内の責務定義を守る）：ファイル先頭の責務定義の「直線を描くとき」→「直線・曲線のツールで描くとき」。`findDrawSnap`の「直線を描くときの」→「直線・曲線のツールで描き始めるときの」（`isSnapDrawShapeType`が偽＝直線・曲線のツール以外）。`commitDrawnLine`の「描き終えた直線を」→「描き終えた線を」、クラスJSDocの前提「`commitDrawnLine`は作成途中の直線があるときに呼ぶ」→「作成途中の線」。`finishDrawnLine`の手順4.に「描いた区間の種類は作成途中の線から読む（点2つの終えた線は`Line`で区間の種類を持たないため）」を足す。`#reflectDrawnJoin`の`@param`に`drawnKindSource`を足す。
*   **変えないもの**：ほかのメソッドのコード、importの並び（新しいimportは無い）、`isDrawingLine`・`clickDrawnLine`の判定の順。
*   `PathJoiner.js`はコードもJSDocも変えない（責務定義・`canJoin`のJSDocは「直線・開いたパス」「開いたパス1本で頂点3つ以上」のままで実態に合う）。

### 要件F: `InputTracker`のJSDocの文言（`js/core/InputTracker.js`。**コードは変えない**）

*   **理由**：09-01b以降、描き始めの吸い付き（`#drawStartSnap`）と引いている途中の吸い付き（`#drawEndSnap`）は曲線のツールでも働くが、JSDocの4か所が「直線を描くとき」のままで実態と食い違う（開発資料の第一の目的＝ハルシネーションの防止のため直す）。配線・判定は変えない（REQの「変える必要がある場合は配線だけ」より狭い、文言だけの修正。09-01aの要件Hと同じ扱い）。行数は変わらない（1行の中の文言だけを直す）。
*   直す箇所（文言の置き換えだけ）：
    1.  クラスのJSDoc「端点への吸い付きの照会と反映（直線を描くときの描き足し・結合・閉じる）」→「（直線・曲線のツールで描くときの描き足し・結合・閉じる）」。
    2.  `#drawStartSnap`のJSDoc「直線を描き始めたときに吸い付いていた端点」→「直線・曲線のツールで描き始めたときに吸い付いていた端点」。
    3.  `#drawEndSnap`のJSDoc「直線を描いている途中の直前のmousemoveで」→「直線・曲線のツールで描いている途中の直前のmousemoveで」。
    4.  `handleMouseMove`のJSDoc「（直線以外では常に表示されない。」→「（直線・曲線のツール以外では常に表示されない。」。
*   ほかの文言・コード・行の数は変えない。

### 要件G: 保存・書き出し（コードの変更なし。テストで確認）

*   直線と曲線の区間が混ざったパスは`Path.toJSON`/`fromJSON`（区間の種類を写す）・描画要素`bezierPath`（区間ごとに`line`／`cubic`）でそのまま表せる。キャンバスの切り替え・コピー＆ペースト・複製・取り消し/やり直しは、いずれも`DocumentSerializer`（`toJSON`/`fromJSON`）を通るため保たれる。`SpriteSerializer`・`CodeExporter`・`DocumentSerializer`・`check/`は変えない。
*   **既にあるテスト（足さない）**：`test/io/DocumentSerializer.roundtrip.test.js`の`describe('曲線のパスの往復')`の「直線と曲線の混在」（オブジェクト層・文字列層。区間の種類まで`deepStrictEqual`）、`test/io/SpriteSerializer.test.js`の「直線と曲線が混在するパスの区間は line と cubic」、`test/io/CodeExporter.test.js`の「直線と曲線の混在（閉じる区間が直線／曲線）」（閉じたパス）。
*   **足すテスト**（つなぎ目が角になる区間となめらかになる区間を両方持つ開いたパス。結合の結果と同じ形）：要件Hの(H-7)。

### 要件H: テスト（REQ要件6）と、変える既存のテスト

**足すテスト**（既存のファイルへ追加。新しいテストファイルは作らない。補助関数はファイルの中に書き、JSDocを付ける。公開APIだけを通す。図形の`id`は公開プロパティへ直接代入する）：

*   (H-1) `test/shapes/Path.test.js`：要件Bのテストの観点。
*   (H-2) `test/shapes/PathJoinRules.test.js`（新しい`describe('PathJoinRules 区間の種類を保つ組み立て（Phase 09-01b）')`。区間の種類の比較用の補助`kindsOf(path)`＝`path.toJSON().segments.map((s) => s.kind)`を足してよい）：
    *   `isJoinableLine`：曲線の区間を持つ開いたパス（全区間・混在・頂点2つ）は真。閉じた曲線のパス・今の曲線・矩形・円・弧は偽。`isJoinableLine`と`isDrawnLineShape`が様々な図形で同じ結果。
    *   `classifyJoin`・`planJoin`：曲線のパス1本（頂点3つ以上）は`'close'`、頂点2つの曲線のパス1本は`null`、曲線のパスと直線の2本は（順を入れ替えても）`'join'`。
    *   `buildJoinedPath`の4通りの端点の組：A＝区間`['line', 'smooth']`の頂点3つのパス、B＝区間`['smooth', 'smooth', 'line']`の頂点4つのパス（向きが分かる非対称な並び）。各組が選ばれる座標を作り、端点が離れているとき（間を埋める区間は`'line'`）と重なるとき（間を埋める区間なし）の結果の区間の種類が次のとおりで、頂点の並びも今の規則どおり：(1) A＋B＝`A.kinds ++ [gap] ++ B.kinds`、(2) A＋逆順B＝`A.kinds ++ [gap] ++ reverse(B.kinds)`、(3) B＋A＝`B.kinds ++ [gap] ++ A.kinds`、(4) 逆順B＋A＝`reverse(B.kinds) ++ [gap] ++ A.kinds`（重なるときは`[gap]`なし）。
    *   `buildJoinedPathAt`：第6引数を省くと間を埋める区間は`'line'`、`'smooth'`を渡すと`'smooth'`、端点が重なるときは第6引数によらず間を埋める区間ができない。
    *   `buildClosedPath`：両端が離れた曲線のパス（区間`['line', 'smooth', 'smooth']`など）は、第3引数を省くと閉じる区間が`'line'`、`'smooth'`を渡すと`'smooth'`（元の区間の種類はそのまま）。両端が重なる（最後の頂点＝始点）パスは最後の頂点を除き、区間の種類の並びは元のまま（閉じる区間＝元の最後の区間の種類。全区間`'smooth'`なら閉じた結果も全区間`'smooth'`）。
    *   `buildExtendedPath`：終点側・始点側とも、第5引数を省くと足す区間は`'line'`、`'smooth'`を渡すと`'smooth'`（終点側＝`[...元, 足す]`、始点側＝`[足す, ...元]`）。直線（`Line`）への描き足しは`['line', 足す]`。
    *   `planJoin`：曲線のパス1本の閉じる（両端が離れている）は閉じる区間`'line'`・元のid、曲線のパスどうしの2本（離れている）は間を埋める区間`'line'`、重なっているときは間を埋める区間なしで全区間`'smooth'`。
    *   直線のパスどうし（直線・直線の区間だけのパス）の`buildJoinedPath`・`buildJoinedPathAt`・`buildClosedPath`・`buildExtendedPath`の結果が全区間`'line'`（既存の補助`assertAllLineSegments`）。
    *   **形（区間ごとの制御点）**：(a) 逆順でも形が変わらない：全区間`'smooth'`の頂点4つのパスBを直線Aと(2)の組（Bを逆順。離れている）で結合した結果の`toDrawElement().segments`のうちBの部分が、B自身の`toDrawElement().segments`を逆順にして`control1`と`control2`を入れ替えたものと一致（誤差1e-9）。(1)の組（逆順なし）ではBの部分がB自身の制御点と一致。(b) つなぎ目で元の線の形が変わらない：全区間`'smooth'`のパスの終点へ`'line'`の区間を描き足した結果、元の区間の制御点が元のパスの`toDrawElement()`と一致し、足した区間は`kind: 'line'`。直線の区間だけのパスへ`'smooth'`の区間を描き足した結果、元の区間はすべて`'line'`のまま・頂点も同じで、足した区間（連なりの区間が1つだけ）の制御点は直線の1/3・2/3の点と一致。(c) 曲線の区間どうしがつながるとつなぎ目がなめらかになる：全区間`'smooth'`の頂点4つのパスA・Bを端点が重なる組で結合すると、結果は全区間`'smooth'`で、Aのつなぎ目の区間（最後の区間）の制御点がA単独のときと変わり、つなぎ目から離れた区間（区間0・1）の制御点は変わらない。
    *   引数の図形の`toJSON()`が呼び出しの前後で変わらず、結果の頂点を動かしても元が変わらない（曲線のパスの入力で）。
*   (H-3) `test/shapes/PathJoinRules.test.js`（新しい`describe('planDrawnLineJoin・planEndpointDragJoin の区間の種類（Phase 09-01b）')`）：
    *   作成途中の線が曲線のツールの線（全区間`'smooth'`の開いたパス）：描き始めだけ吸い付き（直線のパスの終点）→足した区間がすべて`'smooth'`・元の区間の種類はそのまま・`keepId: true`。描き終えだけ吸い付き→逆順に足した区間がすべて`'smooth'`。同じ線の両端（途中の点なし）→閉じる区間が`'smooth'`、（途中の点あり）→足した区間と閉じる区間が`'smooth'`。別の線の両端（途中の点なし・端点が離れている）→間を埋める区間が`'smooth'`、（途中の点あり）→途中の区間と最後の間を埋める区間が`'smooth'`。
    *   作成途中の線が直線のツールの線（`Line`・直線の区間だけのパス）で、相手が曲線のパス：足す区間・間を埋める区間が`'line'`で、曲線のパスの区間の種類はそのまま。
    *   第6引数`drawnKindSource`：`drawn`に点2つの`Line`（終えた線）、第6引数に全区間`'smooth'`の作成途中の線を渡すと、描き足した区間が`'smooth'`。第6引数を省くと`drawn`（`Line`）から読み`'line'`。
    *   `planEndpointDragJoin`：曲線のパスどうしの結合（ドラッグした端点が吸い付いた端点と同じ座標）→間を埋める区間なしで全区間`'smooth'`。頂点4つ以上の全区間`'smooth'`のパスを閉じる（ドラッグした終点が始点と同じ座標）→最後の頂点を除いた閉じたパスで全区間`'smooth'`（1周なめらかな輪）。
*   (H-4) `test/shapes/ShapeGeometry.test.js`（`describe('computeSmoothSegmentControls')`へ追加でも新しい`describe`でもよい）：開いたパス（頂点5つ・区間の種類が混在、例`[true, true, false, true]`）で、頂点と区間の種類の並びを逆順にした`computeSmoothSegmentControls`の区間`m−1−i`が、元の区間`i`の`control1`と`control2`を入れ替えたものと一致（`null`の位置も対応。誤差1e-9）。
*   (H-5) `test/shapes/EndpointSnapRules.test.js`：`findSnapTarget`が曲線のパスの端点を候補にする。`dragged`が曲線のパスの端点のとき、もう一方の端点は頂点4つ以上なら候補・頂点3つなら候補にしない（今の`canCloseByMergingEnds`の規則が曲線のパスにも働く）。`resolveEndpointHandle`が曲線のパスの`'vertex-0'`で`'start'`・最後の頂点で`'end'`・途中の頂点で`null`。`findDrawnLineSnapTarget`は作成途中の線が曲線のツールの線でも既存の端点（直線・直線のパス・曲線のパス）を返し、`startSnap`の端点だけを除く（同じ線のもう一方の端点は返す）。打った点が3つ以上で始点と既存の端点が近いときの選び方（厳密に近い方・同距離なら端点）が直線のツールの線と同じ。
*   (H-6) `test/edit/EndpointSnapper.test.js`：
    *   `findDrawSnap('curve', …)`が`SnapTarget`を返し、`screenLengthToWorld`が8で呼ばれる。
    *   偽物の依存：全区間`'smooth'`の頂点3つの作成途中の線（打った点2つ＋付いてくる線の先）で`finishDrawnLine(startSnap)`→呼び出しの順が`cancelDraft` → `beginEdit` → `replaceShape` → `commitEdit`のまま、`replaceShape`へ渡るパスの最後の区間が`'smooth'`。
    *   実物の組み合わせ（`setupReal`・`startSmoothDraft`など既存の補助を使う）：(a) 曲線のツールで直線のパスの終点から描き始め、点2つで開いたまま終える→同じid・同じ位置・区間`[...元の'line', 'smooth']`・履歴1件・取り消しで元へ・やり直しで描き足し後へ。(b) 曲線のパスの終点から曲線のツールで点3つ→足した区間がすべて`'smooth'`（元も`'smooth'`）。(c) 曲線のツールで引いている途中に別の線の端点へ吸い付いてクリック（`findDrawnLineSnap`の結果を`clickDrawnLine`へ）→1本の開いたパス・基準の線（奥）の位置に新しいid・もう一方を除く・区間の種類。(d) 同じ線の両端の間を曲線のツールで描く→閉じたパス・元のid・閉じる区間が`'smooth'`。(e) 直線のツール（既存の`drawLine`）で曲線のパスの終点から描き足す（`commitDrawnLine`）→区間`[...元の'smooth', 'line']`。(f) `joinDraggedEndpoint`で曲線のパスどうしを結合→結果だけが選択・全区間`'smooth'`、頂点4つ以上の曲線のパスを閉じる→閉じたパス。
*   (H-7) `test/io/SpriteSerializer.test.js`（`describe('SpriteSerializer: 版3・bezierPath')`へ追加）：区間`['line', 'smooth', 'smooth', 'line']`の頂点5つの開いたパス（要件Bのコンストラクタで作る）の描画要素の区間が`['line', 'cubic', 'cubic', 'line']`で、制御点が`toDrawElement()`と同じ、外枠が既存の補助`sampleBezierPathRange`の範囲と一致（誤差1e-3）。`test/io/CodeExporter.test.js`（`describe('CodeExporter.toModuleText: 見た目の一致（曲線のパス）')`へ追加）：同じ形の開いたパス（つなぎ目が角になる区間となめらかになる区間を両方持つ）でエディタの`draw`と書き出した`draw`の描画命令の記録が一致（既存の`assertSameAsEditor`）。
*   (H-8) `test/edit/PathJoiner.test.js`（結合（ボタン・`J`）の手順で区間の種類を保つことの確認。既存の補助`setupFake`・`setupReal`などを使う。`js/edit/PathJoiner.js`は変えない）：(a) 全区間`'smooth'`の曲線のパス2本を端点が重なる組で`join`→結果は1本の開いたパスで全区間`'smooth'`（間を埋める区間なし）。(b) 同じ2本を端点が離れている組で`join`→間を埋める区間だけが`'line'`で、ほかの区間は`'smooth'`のまま。(c) 両端が重なる（最後の頂点＝始点）頂点4つ以上の全区間`'smooth'`の曲線のパス1本を`join`→元のidの閉じたパスで全区間`'smooth'`（1周なめらかな輪）。いずれも`replaceShape`へ渡る（実物の組み合わせではモデルに残る）パスの`toJSON().segments`で確かめる。表の#12の書き換え（タスク2）で確かめる項目（曲線のパス1本の閉じる・曲線のパスと直線の結合の呼び出しの順・取り消し/やり直し）は繰り返さない。

**変える既存のテスト**（いずれも本作業で意味が変わるもの。理由：曲線のパスが結合できる線に含まれるようになった／曲線のツールが描き始めに吸い付くようになった）：

| # | ファイル | ケース（今の名前） | 変え方 | 書き換えるタスク |
| --- | --- | --- | --- | --- |
| 1 | `test/shapes/PathJoinRules.test.js` | `isJoinableLine` › 曲線の区間を持つ開いたパス（全区間・混在・頂点2つ）は偽 | 「…は真」へ（期待値`false`→`true`） | タスク2 |
| 2 | 同上 | `isDrawnLineShape` › 結合できる線は続けて引く線の形のうち区間がすべて直線のもの | 「`isJoinableLine`と`isDrawnLineShape`は同じ結果」へ（期待式から区間の条件を外す） | タスク2 |
| 3 | 同上 | 結合・閉じる（曲線のパスは対象外） › classifyJoin・planJoin：曲線のパス1本・曲線のパスと直線の2本はnull | `'close'`・`'join'`・計画が`null`でないことへ（`describe`名も「曲線のパスも対象」へ） | タスク2 |
| 4 | 同上 | 同上 › buildClosedPath・canCloseByMergingEnds：曲線のパスはnull／false | 曲線のパスも`null`でない・`true`へ | タスク2 |
| 5 | `test/shapes/EndpointSnapRules.test.js` | isSnapDrawShapeType は line だけ真 | 「line と curve が真」へ（偽の並びから`'curve'`を外し、`'curve'`が真を足す） | タスク4 |
| 6 | 同上 | findSnapTarget は曲線のパスの端点を候補にせず、近くの直線の端点を選ぶ | 曲線のパスの端点を（より近ければ）選ぶへ | タスク2 |
| 7 | 同上 | resolveEndpointHandle は曲線のパスの端点のハンドルで null | `'vertex-0'`→`'start'`・最後の頂点→`'end'`へ（今のケースは`'start'`/`'end'`というパスにないハンドル名で調べており、広げても`null`のまま通ってしまうため、意味のある名前に直す） | タスク4 |
| 8 | 同上 | 作成途中の線が曲線のパス（打った点2つ）なら近くの直線の端点があっても null | 直線の端点を返すへ | タスク2 |
| 9 | 同上 | 作成途中の線が曲線のパス（打った点3つ以上）なら始点だけを返す | 近い方（既存の端点／始点）を返すへ | タスク2 |
| 10 | `test/edit/EndpointSnapper.test.js` | findDrawSnap: 直線以外の種別ではnull。screenLengthToWorldもgetShapesも呼ばない | 種別の並びから`'curve'`を外し、名前を「直線・曲線以外の種別では…」へ | タスク4 |
| 11 | 同上 | findDrawnLineSnap（曲線のツール）: 既存の線の端点の近くでもnull（吸い付かない） | 既存の線の端点を返すへ | タスク2 |
| 12 | `test/edit/PathJoiner.test.js` | canJoin・join（曲線のパスを含む選択）: …結合できず、何もしない・記録しない | 曲線のパス1本（頂点3つ・両端が離れている）は`canJoin`が真・`join`で閉じたパス（元のid・閉じる区間`'line'`・元の区間`'smooth'`）、曲線のパスと直線は`canJoin`が真・`join`で`beginEdit`→`replaceShape`→`commitEdit`（偽物の依存）、実物の組み合わせ（`setupReal`）で結合後に取り消し1回で元の2本へ・やり直しで結合後へ（履歴1件）・区間の種類を保つ、へ | タスク2 |

*   **書き換えるタスクの決め方**（どのタスクも、終えた時点で`node --test`が全件通る順にする）：
    *   `isJoinableLine`を広げた時点（タスク2）で、#1〜#4・#6・#8・#9・#11・#12の9ケースが落ちる（いずれも`isJoinableLine`が偽→真になり期待値と食い違う。計画立案の修正時に、作業用の複製へ要件Aの変更だけを当てて`node --test`で確認済み：fail 9、ほかは合格）。そのため9ケースの書き換えはすべて`isJoinableLine`の変更と同じタスク2で行う。
    *   `isSnapDrawShapeType`を`'curve'`でも真にした時点（タスク4）で、#5・#10の2ケースが落ちる（同じく確認済み）。そのため#5・#10の書き換えはタスク4で行う。
    *   #7は広げても`null`のまま通る（パスにないハンドル名`'start'`/`'end'`で調べているため）ので、吸い付きの規則のテストを足すタスク4で、意味のある名前に直す。
    *   タスク3（計画の関数）・タスク5（`EndpointSnapper`）のコードの変更で落ちる既存のケースは無い見込み（直線のツールの線は区間の種類が`'line'`で結果が変わらず、曲線のツールの作成途中の線を使う既存のケースは端点に吸い付かない`null`で呼んでいる）。
*   ほかの既存のケース（今の曲線`Curve`を「結合できない」として使うケースなど）の期待値は変えない。`InputTracker`・`main.js`にはテストを置かない（既存の方針）。

### 要件I: ふるまいの確認（テストプレイの確認項目。REQ要件7）

最後のタスクで、次を発注者へ提示する（画面・操作・挙動の言葉で）。
0.  **準備**：ブラウザで画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。
1.  **曲線のツールで直線のパスから描き足す**：直線のツール（`1`）で折れ線を引いておく。曲線のツール（〜・`2`）でその端点に近づけると青い正方形が出て、そこから点を打つと、折れ線の続きとして曲線が伸びる。つなぎ目は角が立ち、元の折れ線の形は変わらない。点を1つだけ打って終えた（描き足した区間が1つの）ときは、足した区間は直線と同じ形に見える。取り消し1回で描き足す前に戻る。
2.  **曲線のツールで曲線のパスから描き足す**：曲線のツールで曲線を引いておく。その端点から曲線のツールで描き足すと、つなぎ目がなめらかにつながる。描いている間はつなぎ目が仮の点で曲がり、確定した瞬間につなぎ目の近くの形が少し変わるのは正常。
3.  **曲線のツールで別の線につながる・閉じる**：曲線のツールで引いている途中に、別の開いた線（直線・折れ線・曲線）の端点に近づけると青い正方形が出て、クリックすると1本につながる（奥にあった線の位置に入る）。同じ線のもう一方の端点で終えると、閉じた形になる。
4.  **直線のツールで曲線のパスにつながる**：直線のツールで曲線のパスの端点から描き始める・引いている途中に曲線のパスの端点に吸い付いてクリックすると、つながる。元の曲線の形は変わらず、つなぎ目は角が立つ。
5.  **結合（`J`・ボタン）**：
    *   曲線のパスと直線・折れ線・曲線のパスを2本選ぶと、ツールバーの結合のボタン（🔗）が押せ、`J`で1本になる。
    *   端点が離れていれば間は直線でつながる。端点が重なっていれば1つにまとまる（曲線どうしならつなぎ目がなめらか）。
    *   頂点3つ以上の開いた曲線のパスを1本選んで`J`で閉じる。両端が離れていれば閉じる区間は直線、重なっていればなめらかな輪になる。
    *   閉じた後に塗りを付けると内側が塗られる。
6.  **端点のドラッグ**：頂点の選択（`A`）で曲線のパスを選び、端点をほかの線の端点へドラッグすると青い正方形が出て吸い付き、離すと結合する。同じ曲線のパスのもう一方の端点へドラッグすると閉じる（頂点4つ以上のとき）。ほかの線の端点を曲線のパスの端点へドラッグしても吸い付く。
7.  **取り消し・やり直し**：上の各操作が、取り消し1回で元の2本（または元の1本）に戻り、やり直しで結合後に戻る。
8.  **保存・書き出し**：直線と曲線が混ざったパスを保存して開き直す（キャンバスの切り替え・コピー＆ペースト・複製も）と同じ形に戻る。書き出して確認用ページ（`sprite-check.html`）で開くと、つなぎ目の角・なめらかさを含めて同じ形で描かれ、外枠が形を囲む。
9.  **対象外のまま**：今までに描いた曲線（1本の2次の曲線）・弧・矩形・円・閉じたパスには吸い付かず、それらを含む選択では結合のボタンも押せない。弧・矩形・円のツールで描き始めても青い正方形は出ない。
10. **ほかが今までどおり**：直線のツールの連続作成（直線・パス・始点で閉じる・描き足し・つながり）、曲線のツールで新しく引く・閉じる（吸い付きのない場所から）、直線のパスどうしの結合・端点のドラッグ、`Ctrl`を押している間は吸い付かないこと、選択・頂点の選択・保存・読み込み・書き出しが今までどおり動く。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/shapes/`（図形クラスと図形をまたぐ規則）、`./js/edit/`（手順）、`./js/core/`（`InputTracker`のJSDocのみ）、`./test/shapes/`・`./test/edit/`・`./test/io/`。
*   **関連する論理クラス**:
    *   `Path`（図形クラス。コンストラクタの第6引数を区間ごとの種類の配列へ広げる）。
    *   `PathJoinRules`（図形をまたぐ規則。`isJoinableLine`を広げ、区間の種類を保つ組み立て・間を埋める区間の種類の受け渡しを足す）。
    *   `EndpointSnapRules`（図形をまたぐ規則。`isSnapDrawShapeType`に曲線のツールを足す）。
    *   `EndpointSnapper`（手順。開いたまま終えた描き足しへ作成途中の線を渡す）。
    *   `PathJoiner`（手順。変更なし。テストのみ）。
    *   `InputTracker`（JSDocの文言のみ）。
    *   新しい論理クラス・ファイルは無い。

### 参照する責務
（`PROJECT_ARCHITECTURE.md`と`_doc/arch/`からの抜粋。以後のタスク実行チャットは、この項目のみを責務情報源とする）
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。例外は(1)`edit/PathJoiner → shapes/PathJoinRules`、`edit/EndpointSnapper → shapes/EndpointSnapRules`・`shapes/PathJoinRules`、(2)`shapes/EndpointSnapRules → shapes/PathJoinRules`（`PathJoinRules`は`Line`・`Path`のみimportするため循環しない）など。`core/`は`edit/`・`io/`をimportしない。`shapes/`は`io/`をimportしない。循環importは無い。本作業でimportは足さない。
*   **`shapes/`の図形クラス**：図形種別ごとのデータ保持・描画・当たり判定・図形データとの相互変換。共通メソッド契約は18メソッド（増やさない）。`Path`は`points`・`closed`・`segments`（`segments[i]`＝`points[i]`→`points[i+1]`、閉じたパスの最後＝`points[n-1]`→`points[0]`。要素数は開いた`n−1`・閉じた`n`。`kind`は`'line'`・`'smooth'`）を持つ。区間の種類の定数`SEGMENT_KIND_LINE`・`SEGMENT_KIND_SMOOTH`は`Path.js`が唯一の定義で`export`。コンストラクタは引数を検証しない（検証は`fromJSON`のみ）。曲線の区間の制御点は作業データにも図形にも持たず、`ShapeGeometry.computeSmoothSegmentControls`（形の決め方の式の唯一の箇所。一様なCatmull-Rom）で求める。曲線の連なり（曲線の区間が途切れず続く部分）で形が決まり、直線の区間とのつなぎ目は角が立つ。連なりの区間が1つだけなら直線と同じ形。
*   **`PathJoinRules.js`**：図形をまたぐ規則（結合と、直線・曲線のツールで続けて引く線の点の並び）。状態を持たない`export`した関数と定数のみ。読むのは図形の`type`・公開プロパティ`id`・`toJSON()`の図形データだけで、図形クラスの内部プロパティを読まない。importは`./Line.js`・`./Path.js`（`Path`と`SEGMENT_KIND_LINE`）のみ。結果は`Path`・`Line`のコンストラクタで作る。表示倍率・`VectorModel`・履歴・DOM・操作モード・idの形式を知らない。許容距離はワールドの長さで引数に受け取る。`try/catch`を持たない。結果は元の図形と配列・頂点を共有しない。頂点の並べ方・まとめ方は非公開の組み立て関数が共有しているため、規則を変えると`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`が同時に変わる。直線とパスの作り分けは非公開の`buildLineOrPath`が唯一の箇所。足す区間の種類は作成途中の線が持つ（`drawnSegmentKind`）。`planDrawnLineJoin`の`startSnap`/`endSnap`は`null`で渡す前提。同じ線を閉じる計画は`planDrawnLineJoin`と`planEndpointDragJoin`が非公開の`planCloseOf`で共有する。結果の`fillColor`は基準の線A（描き足し・閉じるは元の線）のもの。
*   **結合の規則（3章11.。発注者の決定）**：基準の線A＝重なり順で奥の図形。結果の向き・色・太さ・塗りはAのもの。2本の結合はAの位置に新しいidで結果を置きBを除く。閉じるは元のidと位置を保つ。端点が重なっている＝画面上5px以内（ちょうどを含む。`main.js`が換算した`tolerance`）。重なる端点は1つにまとめ（Bの側を除く）、離れていればそのまま区間でつなぐ。自動で閉じない・3本以上の結合はしない。描き足しは元のid・色・太さ・塗り・重なり順の位置・元の線の向きを保ち、足す頂点が端点と重なる場合は何も起きない。吸い付きでの結合は吸い付いた端点でつなぐ。
*   **`EndpointSnapRules.js`**：端点への吸い付きの規則（状態なし）。importは`./PathJoinRules.js`のみ（`isJoinableLine`・`canCloseByMergingEnds`・`canCloseDrawnLine`）。吸い付く距離＝画面上8px（`SNAP_TOLERANCE_SCREEN_PX`。`JOIN_TOLERANCE_SCREEN_PX`とは別の定義）。対象は結合できる線の端点だけ。`isSnapDrawShapeType`は「描く図形種別が吸い付く種別か」の唯一の定義箇所。`findDrawnLineSnapTarget`は描き始めの端点を除き、描き始めが端点でなく打った点が3つ以上のとき自分の始点も候補にし、同距離なら端点を優先する（始点の結果は`kind: 'drawnStart'`で区別）。使う側は`edit/EndpointSnapper`のみ。
*   **`edit/`共通**：DOM・図形種別の分岐・図形固有のプロパティ名・図形のid形式・操作モードを知らない。`InputTracker`に依存しない。
*   **`EndpointSnapper.js`**：端点への吸い付きの照会と、吸い付いた端点での描き足し・結合・閉じるのモデルへの反映、直線・曲線のツールで線を続けて引く手順。`model`は`getShapes`・`getDraftShape`・`cancelDraft`・`replaceShape`・`replaceDraft`・`commitDraft`のみ使う。`editRecorder`・`screenLengthToWorld`は注入。`try/catch`を持たない。記録：描き足し・つながり・閉じる＝`cancelDraft` → `beginEdit` → `replaceShape`（`select: false`）→ `commitEdit`の1件、吸い付きなし＝`replaceDraft` → `beginEdit` → `commitDraft` → `commitEdit`。`joinDraggedEndpoint`は記録しない（呼び出し側のドラッグの編集操作の中。`select: true`）。クリックの判定の順（`clickDrawnLine`）＝1.始点で閉じる → 2.最後の点と重なる＝開いたまま終える → 3.端点につながる（`commitDrawnLine`） → 4.点を打つ。
*   **`PathJoiner.js`**：選択中の線の結合を`PathJoinRules.planJoin`の計画で反映する1件の編集操作と`canJoin`の照会。`model`は`getShapes`・`isSelected`・`replaceShape`のみ。結合できない選択では何もせず記録しない。
*   **`InputTracker.js`**：図形種別の分岐を一切行わない。吸い付きの候補の探索・距離の判定・結果の組み立てを持たず、注入された`EndpointSnapper`を呼ぶだけ（描く図形種別は不透明な値として`findDrawSnap(this.currentShapeType, point)`へ渡す）。`#drawStartSnap`＝描き始めの端点、`#drawEndSnap`＝直前の`mousemove`の照会結果。1729行で、状態の所有者の再分離は行っていない。本作業ではコードを変えない。
*   **履歴（3章6.）**：結合（ボタン・`J`）は`PathJoiner.join`で`replaceShape`の前後に1件。直線・曲線のツールで線を終えたときは`EndpointSnapper`の中で1回の終わり方につき1件。端点のハンドルの結合・閉じるは移動と同じ1件。Undo1回・Redo1回で往復する。
*   **新しく描く図形のスタイル（2章）**：描き足し・つながり・既存の線を閉じるでは当てない（作成途中の線は捨てられ、`PathJoinRules`の基準の線Aのスタイルになる）。
*   **保存・書き出し（2章）**：作業データの版は2、書き出し形式の版は3。`path`の図形データは`{ type, id, points, closed, segments: [{ kind }], strokeColor, strokeWidth, fillColor }`。曲線の区間を1つ以上持つ`path`の描画要素は`bezierPath`（区間ごとに`{kind: 'line'}`／`{kind: 'cubic', control1, control2}`）。外枠は全頂点と`cubic`の区間の各軸の極値（制御点そのものは含めない）。
*   **テスト（`_doc/arch/16_test.md`）**：`node:test`・`node:assert/strict`のみ。先頭行に単一責務のJSDoc（3行以内）、補助関数にもJSDoc。公開APIのみを通し、テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。共有の補助モジュールを置かず、補助関数は各テストファイルの中。注入される依存は素のオブジェクトの偽物。例外として`test/edit/PathJoiner.test.js`・`test/edit/EndpointSnapper.test.js`は実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`と実物の対象クラスを組み合わせてよい（`EndpointSnapper.test.js`は`PathJoiner`をimportしない）。図形の`id`は公開プロパティへ直接代入する。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止。`InputTracker`・`main.js`はテストを置かない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（資料本体への反映は最終タスク（タスク11）で行う。各タスクで影響が判明した場合はここへ追記する）
*   **`PROJECT_ARCHITECTURE.md` 1章**：
    *   「存在しないもの」：「曲線のパスの結合・描き足し・端点への吸い付き・曲線のツールでの既存の線とのつながり（Phase 09-01b）」を消す。Phase 09-01bの「やらないこと」として「曲線の連なりの途中に角を立てる『この点は角』という情報」「描いている間に元の線を含めた結合後の形を見せる仕組み」を足す（区間の直線／曲線の切り替え（09-02）・今の曲線・弧の結合（09-03）は既に載っている）。
    *   「フォルダ分割の方針」の`shapes/`の`PathJoinRules`の説明「結合できる線＝直線・区間がすべて直線の開いたパス、と続けて引く線の形＝直線・開いたパス（区間の種類を問わない）を区別する」を「結合できる線（`isJoinableLine`）は続けて引く線の形（`isDrawnLineShape`）と同じ条件（09-01bで広げた。名前は意味の違いのため分けて残す）。結合・描き足し・閉じるの結果は元の区間の種類を保つ」へ。
*   **2章`path`**：「作られるのは結合・描き足し・閉じる…」の項に「結合・描き足し・閉じるの結果は元の各区間の種類を保つ（Bを逆順にするときは区間の種類も逆順。端点をまとめるときは除いた端点につながっていた区間の種類を保つ）。曲線の区間どうしがつながるとつなぎ目は1つの連なりになりなめらかになる（データに新しい情報は足さない）」を足す。`Path`のコンストラクタの第6引数が区間ごとの種類の配列も受けることは4章（`_doc/arch/12_shapes.md`）へ。2章「新しく描く図形のスタイル」の「当てないもの」の括弧書き「（曲線のツールにはこれらが無い。曲線のパスは結合・描き足しの対象外。Phase 09-01a）」を「（直線・曲線のツールとも。Phase 09-01b）」の趣旨へ。
*   **3章11.（結合）**：見出しの説明「選択モードで選んだ線（直線・開いたパス）」は今のまま。「結合できる線」の項を「直線、または開いたパス（区間の種類によらない。曲線のパスを含む。Phase 09-01bで広げた）。`isJoinableLine`が`isDrawnLineShape`に任せる1か所の判定」へ。**区間の種類**の項を新設：結果は元の各区間の種類を保つ／Bの逆順では区間の種類も逆順（形は変わらない）／端点が重なりまとめるときは除いた端点につながっていた区間の種類を保つ／**間を埋める区間**の種類＝結合のボタン・`J`では直線（`JOIN_GAP_SEGMENT_KIND`。発注者の決定 2026-11-19。閉じる区間も直線）、線を描いて終えたとき（`planDrawnLineJoin`）は描いた区間の種類、端点のドラッグでは端点が重なるため生じない／閉じるで両端が重なれば閉じる区間は最後の区間の種類のまま（全区間が曲線なら1周なめらかな輪）／直線の区間と曲線の区間のつなぎ目は角（09-01aの決定）・曲線の区間どうしのつなぎ目はなめらか（発注者の決定 2026-11-19）で、確定した瞬間につなぎ目の近くの形が少し変わるのは許容。「やらないこと」の「曲線（今の曲線・曲線のパス）」を「今の曲線」へ。「端点を指定する入口」の項に、`buildClosedPath`・`buildJoinedPathAt`・`buildExtendedPath`が間を埋める区間（描き足す区間）の種類を省ける末尾の引数で受け取ること（既定は直線）、`planDrawnLineJoin`の第6引数`drawnKindSource`を足す。「描き足しの規則」に「描き足す区間は描いた区間の種類」を足す。
*   **3章12.（端点への吸い付き）**：見出しの説明・「流れ（直線の描き始め）」の「直線を描くとき」を「直線・曲線のツールで描くとき」へ。「流れ（描いている途中。弧・矩形・円）」の括弧書きの「`isSnapDrawShapeType`が`'line'`でないとき」を「`'line'`・`'curve'`でないとき」へ、「曲線のツールの作成途中の線は照会するが既存の端点は候補にならない」を消す。「流れ（描き終え）」の「直線のツールの線は（曲線のツールの線は既存の端点を候補にしないため…`commitDrawnLine`は呼ばない…）」を「直線・曲線のツールの線は」へ。「発注者の決定」の「対象は結合できる線（直線・区間がすべて直線の開いたパス。11.）の端点だけ。曲線のパスの端点へは吸い付かない」を「対象は結合できる線（直線・開いたパス。曲線のパスを含む）の端点だけ」へ、「曲線のツールは既存の線の端点に吸い付かない（Phase 09-01a）…」の項を「曲線のツールも吸い付く（Phase 09-01b）：描き始めは`isSnapDrawShapeType`が`'curve'`でも真。引いている途中は`findDrawnLineSnapTarget`の`isJoinableLine(drawn)`が曲線のツールの作成途中の線でも真になるため既存の端点を候補にする。開いたまま終えた描き足しでは、`EndpointSnapper.finishDrawnLine`が作成途中の線を`planDrawnLineJoin`の第6引数へ渡して描いた区間の種類を伝える（点2つの終えた線は`Line`のため）」へ。「やらないこと」の「曲線（今の曲線・曲線のパス）」を「今の曲線」へ。
*   **3章22.（直線・曲線のツールで線を続けて引く）**：「曲線のツール（Phase 09-01a）」の項の「曲線のパスは既存の線とつながらない（…後半（Phase 09-01b）で足す予定）」を「既存の線と直線のツールと同じ操作でつながる（Phase 09-01b。描き足し・つながる・閉じるで描いた区間は曲線の区間。描き始めが端点で点2つで開いたまま終えたときは、`line`を作らず元の線に曲線の区間を1つ描き足す）」へ。「現場設計セッションが決めた点」の最後の文「結合できる線（`isJoinableLine`）は続けて引く線の形のうち区間がすべて直線のもの（11.）」を「Phase 09-01bで結合できる線は続けて引く線の形と同じ条件になった（11.）」へ。「既存の線とつながる・閉じる」の項に「結果は元の区間の種類を保ち、足す区間・間を埋める区間は描いた区間の種類」を足す。発注者の決定（2026-11-19：曲線の区間どうしのつなぎ目はなめらか・結合で間を埋める区間は直線）を足す。
*   **`_doc/arch/12_shapes.md`**：`PathJoinRules.js`の項の`isJoinableLine`の記述（「意味が変わった：直線、または区間がすべて直線の開いたパス…後半で広げる予定」）を09-01bの実態（`isDrawnLineShape`へ任せる・曲線のパスを含む・2つを分けて残す理由）へ。公開関数の引数の追加（`buildClosedPath`・`buildJoinedPathAt`・`buildExtendedPath`の末尾の省ける引数、`planDrawnLineJoin`の第6引数）。非公開の`JOIN_GAP_SEGMENT_KIND`・`segmentKindsOf`（「直線は直線の区間1つ」の唯一の定義箇所。`drawnSegmentKind`はその最後の要素を返す）・`chainOf`・`reverseChain`と、`assembleOpenPath`が頂点と区間の種類を一緒に並べる唯一の箇所であること（注意の項）。「読むもの」の「結果は`Path`・`Line`のコンストラクタで作る」に「区間の種類の配列を渡す」を足す。`EndpointSnapRules.js`の項：`isSnapDrawShapeType`が`'line'`・`'curve'`で真、`findDrawnLineSnapTarget`の「作成途中の線が結合できる線でないとき（曲線のツールの線）は既存の線の端点を走査せず」を実態へ、`findSnapTarget`・`resolveEndpointHandle`の対象（曲線のパスを含む）、注意の「Phase 09-01bで曲線のパスを広げるときを含む」を消す。`Path.js`の項：コンストラクタの第6引数が区間ごとの種類の配列も受けること（`PathJoinRules`の結合・描き足し・閉じる用）。
*   **`_doc/arch/14_edit.md`**：`PathJoiner.js`の項の「（直線・区間がすべて直線の開いたパス。曲線の区間を含むパスを含む選択は結合できず…Phase 09-01aの時点）」を「（直線・開いたパス。曲線のパスを含む。Phase 09-01bからコードの変更なしで対象になった）」へ。`EndpointSnapper.js`の項の「（曲線のツールの線は結合できる線でないため既存の端点を候補にせず、`findDrawnLineSnap`は自分の始点だけを返し得る…）」を実態へ、`finishDrawnLine`が作成途中の線を`planDrawnLineJoin`の第6引数へ渡すこと（非公開`#reflectDrawnJoin`の第4引数）を足す。
*   **`_doc/arch/06_InputTracker.md`**：「行数」の項に「Phase 09-01bはJSDocの文言4か所だけを直し（コードは変えていない）、行数は変わらない」を足す。
*   **`_doc/arch/16_test.md`**：Phase 09-01bの追加・書き換え分（ファイルごとの件数・内容。追加は(H-1)〜(H-8)）、書き換えた既存のテスト（要件Hの表の12ケースと理由）、テストできない箇所（`InputTracker`の配線を通る実際のマウス操作・`CanvasManager`での見た目・確認用ページでの表示）、件数（完了時）。`test/shapes/PathJoinRules.test.js`・`test/shapes/EndpointSnapRules.test.js`の「既存のテストファイルと検証範囲」の記述（対象が曲線のパスを含むこと）。
*   `_doc/arch/15_io.md`：変更なしの見込み（`io/`のコードを変えないため）。

## 3. タスクリスト
*   [ ] タスク1: 要件B 区間ごとに種類を指定してパスを作る（`shapes/Path`のコンストラクタ）
    *   **対象ファイル** :
        *   `./js/shapes/Path.js` : 更新（コンストラクタの第6引数と、コンストラクタ・クラスのJSDocのみ）
        *   `./test/shapes/Path.test.js` : 更新（`describe`の追加のみ）
    *   **作業内容** :
        *   「2. 要件B」のとおり、第6引数に配列を渡せるようにする（`Array.isArray`の1か所の分岐。文字列・省略の結果は変えない）。`fromJSON`・18メソッドは変えない。
        *   コンストラクタの`@param`（型`{string|string[]}`・配列の要素数の約束・検証しないこと・保持しないこと）と、コンストラクタ・クラスのJSDocの「区間の種類を区間ごとに変えるのは`fromJSON`だけ」を実態に合わせる。
        *   「2. 要件H」の(H-1)のテストを足す。既存のケースは変えない。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク1に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する（資料本体は直さない）。
*   [ ] タスク2: 要件A・要件C（前半） 結合できる線を広げ、組み立てで区間の種類を保つ（`shapes/PathJoinRules`の`isJoinableLine`と組み立て関数）
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` : 更新（`isJoinableLine`・`JOIN_GAP_SEGMENT_KIND`・区間の列の補助・`drawnSegmentKind`の本体・`assembleOpenPath`・`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`・`buildClosedPath`と、関係するJSDoc・ファイル先頭の責務定義）
        *   `./test/shapes/PathJoinRules.test.js` : 更新（(H-2)の`describe`の追加と、要件Hの表の#1〜#4の書き換え）
        *   `./test/shapes/EndpointSnapRules.test.js` : 更新（要件Hの表の#6・#8・#9の書き換えのみ）
        *   `./test/edit/EndpointSnapper.test.js` : 更新（要件Hの表の#11の書き換えのみ）
        *   `./test/edit/PathJoiner.test.js` : 更新（要件Hの表の#12の書き換えのみ）
    *   **作業内容** :
        *   「2. 要件A」のとおり`isJoinableLine`を`isDrawnLineShape`に任せ、JSDoc（`isJoinableLine`・`isDrawnLineShape`・`classifyJoin`・`buildClosedPath`・`canCloseByMergingEnds`）とファイル先頭の責務定義（3行以内）を実態に合わせる。
        *   「2. 要件C」の「定数」「区間の列の補助」（`drawnSegmentKind`を`segmentKindsOf`に任せる変更を含む）「`assembleOpenPath`」「公開の組み立て関数」のとおりにする（`planJoin`のコードは変えずJSDocだけ）。非公開の計画の関数・`planDrawnLineJoin`・`planEndpointDragJoin`は本タスクでは変えない（タスク3。本タスクの間は、それらが組み立て関数を末尾の引数を省いて呼ぶため、間を埋める区間・描き足す区間は直線になる）。
        *   新しい定数・補助関数・広げた引数にJSDocを書く。
        *   「2. 要件H」の(H-2)のテストを足し、表の#1〜#4・#6・#8・#9・#11・#12を書き換える（`isJoinableLine`を広げると落ちる9ケース。理由は表のとおり。テスト名も実態に合わせる）。`test/shapes/EndpointSnapRules.test.js`・`test/edit/EndpointSnapper.test.js`・`test/edit/PathJoiner.test.js`は該当ケースの書き換えだけで、ケースの追加・ほかのケースの変更はしない（それらのファイルへの追加はタスク4〜6）。ほかの既存のケースは変えない。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク2に作業内容（書き換えたテストの一覧と理由を含む）を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク3: 要件C（後半） 計画で間を埋める区間・描き足す区間の種類を渡す（`shapes/PathJoinRules`の計画の関数）
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` : 更新（`planJoinAt`・`planCloseOf`・`extendWithPoints`・`planCloseWithPoints`・`planJoinWithPoints`・`planDrawnLineJoin`・`planEndpointDragJoin`と、それらのJSDoc）
        *   `./test/shapes/PathJoinRules.test.js` : 更新（(H-3)の`describe`の追加のみ）
    *   **作業内容** :
        *   「2. 要件C」の「非公開の計画の関数」「公開の計画の入口」のとおりにする（非公開の計画の関数は種類を必須の引数で受け取る。`planDrawnLineJoin`は省ける第6引数`drawnKindSource`を足し、両方`null`の早期`return`の後に`drawnSegmentKind(drawnKindSource.toJSON())`で種類を求めて渡す。`planEndpointDragJoin`は`JOIN_GAP_SEGMENT_KIND`を渡す）。分岐の順・頂点の取り出し方・`?? shapes[i]`・`?? baseShape`は変えない。
        *   各関数のJSDocに引数と区間の種類の決め方を書く。
        *   「2. 要件H」の(H-3)のテストを足す。既存のケースは変えない。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク3に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク4: 要件D 曲線のツールの描き始めの吸い付きと、吸い付きの規則のテスト（`shapes/EndpointSnapRules`）
    *   **対象ファイル** :
        *   `./js/shapes/EndpointSnapRules.js` : 更新（`isSnapDrawShapeType`のコードとJSDoc、`resolveEndpointHandle`・`findSnapTarget`・`findDrawnLineSnapTarget`のJSDocのみ）
        *   `./test/shapes/EndpointSnapRules.test.js` : 更新（(H-5)の追加と、要件Hの表の#5・#7の書き換え）
        *   `./test/edit/EndpointSnapper.test.js` : 更新（要件Hの表の#10の書き換えのみ）
        *   `./test/shapes/ShapeGeometry.test.js` : 更新（(H-4)の追加のみ）
    *   **作業内容** :
        *   「2. 要件D」のとおり`isSnapDrawShapeType`を`'line'`・`'curve'`で真にし、JSDocを実態に合わせる。ほかの関数のコードは変えない。ファイル先頭の責務定義は変えない。
        *   「2. 要件H」の(H-4)・(H-5)のテストを足し、表の#5・#7・#10を書き換える（#5・#10は`isSnapDrawShapeType`の変更で落ちるため本タスク。理由は表のとおり）。`test/edit/EndpointSnapper.test.js`は#10の書き換えだけ（(H-6)の追加はタスク5）。#6・#8・#9はタスク2で書き換え済み。ほかの既存のケースは変えない。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク4に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク5: 要件E 開いたまま終えた描き足しへ描いた区間の種類を伝える（`edit/EndpointSnapper`）
    *   **対象ファイル** :
        *   `./js/edit/EndpointSnapper.js` : 更新（`finishDrawnLine`の1行・`#reflectDrawnJoin`の引数と、要件Eに挙げたJSDoc・ファイル先頭の責務定義）
        *   `./test/edit/EndpointSnapper.test.js` : 更新（(H-6)の追加のみ）
    *   **作業内容** :
        *   「2. 要件E」のとおりにする（`finishDrawnLine`だけが作成途中の線を`#reflectDrawnJoin`の第4引数へ渡し、`#reflectDrawnJoin`は`planDrawnLineJoin`の第6引数へそのまま渡す）。処理の順・`screenLengthToWorld`の呼び出し回数・ほかのメソッドのコードは変えない。importは変えない。
        *   要件Eに挙げたJSDoc（責務定義は3行以内のまま）を実態に合わせる。
        *   「2. 要件H」の(H-6)のテストを足す（表の#11はタスク2、#10はタスク4で書き換え済み）。既存のケースは変えない。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク5に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク6: 要件A（確認） 結合（ボタン・`J`）の手順のテスト（`edit/PathJoiner`。コードは変えない）
    *   **対象ファイル** :
        *   `./test/edit/PathJoiner.test.js` : 更新（(H-8)の追加のみ）
    *   **作業内容** :
        *   `js/edit/PathJoiner.js`は変えない（JSDocも実態に合っている。要件E）。
        *   「2. 要件H」の(H-8)のテストを足す。表の#12はタスク2で書き換え済み（`isJoinableLine`を広げると落ちるため）で、本タスクでは既存のケースを変えない。
        *   `node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク6に作業内容（足したテスト）を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク7: 要件G 直線と曲線が混ざったパスの書き出し・外枠のテスト（`io/`。コードは変えない）
    *   **対象ファイル** :
        *   `./test/io/SpriteSerializer.test.js` : 更新（(H-7)の追加のみ）
        *   `./test/io/CodeExporter.test.js` : 更新（(H-7)の追加のみ）
    *   **作業内容** :
        *   `js/io/`・`js/check/`は変えない。
        *   「2. 要件H」の(H-7)のテストを足す（パスはタスク1で広げたコンストラクタに区間の種類の配列を渡して作る）。既存のケースは変えない。往復のテストは既にあるため足さない（要件G）。
        *   `node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク7に作業内容（既存のテストで確かめられている項目も）を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク8: 要件F `InputTracker`のJSDocの文言（コードは変えない）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新（JSDocの文言4か所のみ）
    *   **作業内容** :
        *   「2. 要件F」の4か所の文言だけを置き換える。コード・ほかの文言・行の数は変えない（作業後も1729行であることを確かめる）。
        *   `node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク8に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク9: 仕上げの確認（JSDoc・スコープ・全テスト）
    *   **対象ファイル** :
        *   （確認のみ。不備があればタスク1〜8の対象ファイルの中でだけ直す）
    *   **作業内容** :
        *   タスク1〜8で足した・変えた関数・定数・typedef・引数のJSDocに漏れが無いこと、ファイル先頭の責務定義が3行以内で実態に合うこと、09-01aの「後半（b）で広げる」「曲線のツールは既存の線の端点に吸い付かない」の文言が`js/`に残っていないことを確かめる（`Grep`で「後半（b）」「09-01b」「吸い付かない」「区間がすべて直線の開いたパス」を調べる）。
        *   変えたファイルがタスクの対象ファイルだけであること（`git status`・`git diff --stat`で確かめる。`js/core/InputTracker.js`はJSDocの文言だけ・行数1729のまま、`js/main.js`・`js/core/VectorModel.js`・`js/edit/PathJoiner.js`・`js/io/`・`js/check/`・`index.html`は不変）、改名・整形・不要に見えるコードの削除をしていないことを確かめる。
        *   `node --test`が全件通ることを確かめ、件数（tests / suites / pass / fail）を記録する。
        *   完了後、本RESの「4. 詳細作業内容」のタスク9に確認結果を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク10: 要件I テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   （本RESのみ）
    *   **作業内容** :
        *   「2. 要件I」の確認項目0〜10を、本RESの「4. 詳細作業内容」のタスク10へ写し、実装の結果に合わせて文言を確かめる（実装で判明した注意点があれば足す）。最終報告でも提示する。
*   [ ] タスク11: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
        *   `./_doc/arch/12_shapes.md` : 更新
        *   `./_doc/arch/14_edit.md` : 更新
        *   `./_doc/arch/06_InputTracker.md` : 更新
        *   `./_doc/arch/16_test.md` : 更新
    *   **作業内容** :
        *   本タスクは、実装AIによる開発資料の書き換えが原則禁止の本ワークフローにおいて、**明示的な例外**として行う（後続タスクが無く、資料の変更で他タスクの前提が動く危険が無いため）。上の5ファイル（本タスクでパス指定する`_doc/arch/`のファイル）だけを読み・直す。
        *   本RESの「2. 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」と、各タスクで追記された分を確かめ、資料へ反映する。09-01aの「曲線のパスは結合・吸い付きの対象外。後半（b）で外す予定」の記述を、`PROJECT_ARCHITECTURE.md`の2章`path`・3章11.・12.・22.・1章「存在しないもの」と`_doc/arch/12_shapes.md`の`isJoinableLine`の項を含め、すべて実態に合わせる。
        *   資料の記載基準（`PROJECT_ARCHITECTURE.md`冒頭）に従い、1つのファイルのJSDocを読めば分かることは書かない。誤った記述は直すか消す。
        *   `_doc/arch/16_test.md`の件数はタスク9で記録した値を使う。
        *   完了後、本RESの「4. 詳細作業内容」のタスク11に反映した箇所を記載する。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件B 区間ごとに種類を指定してパスを作る（`shapes/Path`のコンストラクタ）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク2: 要件A・要件C（前半） 結合できる線を広げ、組み立てで区間の種類を保つ（`shapes/PathJoinRules`の`isJoinableLine`と組み立て関数）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク3: 要件C（後半） 計画で間を埋める区間・描き足す区間の種類を渡す（`shapes/PathJoinRules`の計画の関数）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク4: 要件D 曲線のツールの描き始めの吸い付きと、吸い付きの規則のテスト（`shapes/EndpointSnapRules`）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク5: 要件E 開いたまま終えた描き足しへ描いた区間の種類を伝える（`edit/EndpointSnapper`）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク6: 要件A（確認） 結合（ボタン・`J`）の手順のテスト（`edit/PathJoiner`。コードは変えない）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク7: 要件G 直線と曲線が混ざったパスの書き出し・外枠のテスト（`io/`。コードは変えない）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク8: 要件F `InputTracker`のJSDocの文言（コードは変えない）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク9: 仕上げの確認（JSDoc・スコープ・全テスト）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク10: 要件I テストプレイの確認項目を発注者へ提示する
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク11: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
*   **作業内容** :
    *   （タスク実行時に記入）

## 5. 懸念事項・要確認ポイント
*   **`InputTracker`のJSDocの修正（要件F）**：REQは「`InputTracker`を変えない見込み。変える必要がある場合は配線だけ」としているが、本計画はコードも配線も変えず、実態と食い違うJSDocの文言4か所だけを直す（行数は変わらない）。開発資料の第一の目的（ハルシネーションの防止）のため。問題があればタスク8を外しても、ほかのタスクとテストには影響しない。
*   **確定の瞬間の形の変化**：曲線のパスの端から曲線のツールで描き足したとき、曲線のパスどうしを端点が重なる組で結合（ボタン・`J`・端点のドラッグ）したとき、両端が重なった曲線のパスを閉じたときは、つなぎ目が1つの曲線の連なりになり、つなぎ目のすぐ近くの区間の形が確定した瞬間に少し変わる（REQで許容済み。描いている間に元の線を含めた形を見せる仕組みは作らない）。テストプレイの確認項目2で発注者に確かめてもらう。
*   **`findDrawnLineSnapTarget`の`isJoinableLine(drawn)`の条件**：09-01b以降、作成途中の線（続けて引く線の形）では常に真になるが、「不要に見えるコードの削除」をしない方針どおりコードに残し、JSDocで実態を書く。
*   **`planEndpointDragJoin`の間を埋める区間の種類**：ドラッグした頂点は吸い付いた端点の座標に置かれているため端点は重なり、間を埋める区間はできない。形式上`JOIN_GAP_SEGMENT_KIND`（直線）を渡す。表示倍率の変化などで万一重なっていないと判定された場合は、間が直線でつながる（結合のボタン・`J`と同じ）。
*   **`Path`のコンストラクタの配列は検証しない**：頂点数と同じく呼び出し側の責任（呼び出し元は`PathJoinRules`だけで、要素数は組み立ての式で必ず合う）。
*   **書き換える既存のテストは12ケース**（要件Hの表）。いずれも本作業で意味が変わるもの。
*   **書き換えのタスクへの割り当て**：各タスクを終えた時点で`node --test`が全件通るよう、既存のケースは「そのケースを落とすコードの変更と同じタスク」で書き換える（要件Hの表の「書き換えるタスク」列と「書き換えるタスクの決め方」）。このためタスク2の対象ファイルに、`isJoinableLine`の広がりで落ちるケースを持つ`test/shapes/EndpointSnapRules.test.js`（#6・#8・#9）・`test/edit/EndpointSnapper.test.js`（#11）・`test/edit/PathJoiner.test.js`（#12）を、タスク4の対象ファイルに`test/edit/EndpointSnapper.test.js`（#10）を、それぞれ該当ケースの書き換えだけの範囲で含める。#12をタスク2へ移したため、タスク6は#12の書き換えに代えて(H-8)（結合（ボタン・`J`）で区間の種類を保つことの確認）を足す。
