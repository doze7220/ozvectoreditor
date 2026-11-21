# RES: 作業計画・作業レポート (Phase 09-01a) : 曲線のツールで点を通る曲線を続けて引く（曲線の区間を持つパス）
* 参照元REQ: `./_log/req/261118_1921_REQ_Phase09-01a_Curve_Tool.md`

## 1. 作業目的
パス（`path`）に**曲線の区間**（区間の種類`'smooth'`。両端の頂点と前後の頂点から形が決まる、点を通るなめらかな曲線）を足し、**曲線のツール**（ツールパレットの〜・数字キー`2`）を、クリックごとに点を打って打った点をなめらかに通る曲線を続けて引くツールに置き換える。操作は直線のツールの連続作成（`PROJECT_ARCHITECTURE.md` 3章22.）と同じで、足す区間の種類だけが曲線になる。点2つで終えたら直線（`line`）、3つ以上なら曲線のパス（開いた／始点で閉じた）。今までに描いた今の曲線（`curve`）は今までどおり扱い、新しい`curve`は作られなくなる。

本作業は Phase 09-01 の前半（a）。既存の線とのつながり（描き足し・つながる・結合）は後半（b）で行うため、本作業の間は**曲線のパスを「結合できる線」から外す**（判定は1か所）。

守ること（REQの最上位の要件）：
*   リポジトリのルートの`node --test`が全件通る。作業開始前の件数は **tests 1634 / suites 250 / pass 1634 / fail 0**。既存のテストの期待値を変えるのは、本作業で意味が変わるもの（曲線のツールで作る図形・書き出し形式の版・パスの区間の種類の受理）だけで、変えるケースは「2. 要件I」に列挙する（理由つき）。
*   曲線の区間を持たない図形（直線・弧・矩形・円・直線の区間だけのパス・今の曲線）の作り方・描画・当たり判定・選択・頂点の編集・結合・吸い付き・保存・書き出しの描画要素は今と同じ（書き出しの`formatVersion`の値だけ3になる）。
*   作業データ形式の版は2のまま。書き出し形式の版は2→3。`asset/sprite/`の生成物は書き換えない（版2のまま読める）。
*   改名・整形・「不要に見えるコードの削除」を行わない（例外は「2. 要件B」の`isPlainObject`の共通モジュールへの移動だけ。REQが計画で決めるよう求めた項目）。既存の公開メソッド名・フィールド名・DOMのid・クラス名は変えない。キーの割り当ての表（`KeyboardShortcuts.js`の`SHORTCUT_BINDINGS`）は変えない。共通メソッド契約（18メソッド）を増やさない。
*   `InputTracker`・`VectorModel`に図形種別の文字列の比較を足さない。`InputTracker`・`main.js`・`KeyboardShortcuts`・`VectorModel`は**JSDocの文言だけ**を直す（コードは変えない。下の設計により配線の追加も要らない）。

**用語**（REQの用語のまま。コード・資料でも使い分ける）：
*   **曲線の区間**：区間の種類`'smooth'`の区間。**直線の区間**：`'line'`の区間。
*   **曲線の連なり**：パスの中で、曲線の区間が途切れずに続いている部分（前後が直線の区間・パスの端で区切られる。閉じたパスで全区間が曲線なら1周がひとつの連なり）。
*   **曲線のパス**：曲線の区間を1つ以上持つパス。**今の曲線**：図形種別`curve`（1本の2次の曲線）。
*   **線を引いている途中・打った点・最後の点・付いてくる線・付いてくる線の先・開いたまま終える・閉じて終える・始点への吸い付き**：3章22.と同じ。本作業では直線のツールと曲線のツールの両方に当てはまる。
*   **作成途中の線**（コードのJSDocで使う語。3章22.と同じ）：線を引いている途中の作成途中の図形。頂点＝打った点＋付いてくる線の先（末尾の1つ）。
*   **端点への吸い付き**（3章12.）と**スナップ**（3章17.）は別の機能で、用語を混ぜない。

## 2. アーキテクチャ設計

### 全体の方針（作成途中の線が「足す区間の種類」を自分で持つ）

*   **曲線のツールの作成途中の線は、打った点が1つの間も「頂点2つ・区間1つ（`'smooth'`）の開いたパス」にする**（直線のツールは今のまま`Line`）。曲線の連なりの区間が1つだけなら形は直線と同じ（下の式）なので、見た目は「点が1つの間は始点からカーソルまでの直線」（REQの要件2）のまま。打った点が2つ以上なら、全区間が`'smooth'`の開いたパス。
    *   **理由**：足す区間の種類を作成途中の図形そのものが持つため、`InputTracker`・`EndpointSnapper`へ「どのツールか」「足す区間の種類」を渡す配線が要らない（`InputTracker`のコードを変えない。図形種別の文字列を`InputTracker`・`VectorModel`へ持ち込まない）。`PathJoinRules`の点の並びの組み立ては、作成途中の線から区間の種類を読むだけで、同じ関数を直線・曲線の両方に使い回せる。REQの「点1つの間は直線」は見た目の要件として満たす（`Line`のインスタンスにすると区間の種類を持てず、ツールの種別を別に配線する必要が出るため採らない）。
*   **曲線のツールで描き始めたときの作成途中の図形は、`ShapeFactory`の対応表の`curve`の`create`を変えて作る**（`create: (x1, y1, x2, y2) => new Path([{x: x1, y: y1}, {x: x2, y: y2}], false, undefined, undefined, undefined, SEGMENT_KIND_SMOOTH)`）。`fromJSON: Curve.fromJSON`は変えない（今の曲線は読み込みでだけ作られる）。
    *   **理由**：`ShapeFactory.create`の`js/`内の呼び出し元は`VectorModel.startDraft`だけで、`create`は実質「ツールで描き始めた作成途中の図形を作る」入口。対応表のエントリの`create`を変えるだけで、ツールと作成途中の図形の対応づけが`core/`で唯一許された`ShapeFactory`の対応表に1か所のまま閉じ、新しい項目・メソッドを足さずに済む（`VectorModel`・`InputTracker`は変えない）。`new Ellipse(…, 'arc')`と同じく、コンストラクタへ種類を渡す形。
    *   **影響**：`ShapeFactory.create('curve', …)`の戻り値の`type`が`'path'`になり、「`create(type)`の`type`が`type`と一致する」は`curve`では成り立たなくなる（既存のテストの期待値の変更。要件I）。既存のテストで`ShapeFactory.create('curve', …)`を「今の曲線を作る手段」として使っている箇所は、同じ引数の`new Curve(…)`へ置き換える（期待値は変えない。要件I）。
*   **線を引いている途中かの判定**（`EndpointSnapper.isDrawingLine()`）を「作成途中の図形が**続けて引く線の形**（直線、または区間の種類によらず開いたパス）か」へ改める（新しい規則関数`PathJoinRules.isDrawnLineShape`）。直線のツールの作成途中の線は常に直線か直線の区間だけの開いたパスなので結果は今と同じ。弧・矩形・円の作成途中の図形は偽のまま。今の曲線は作成途中の図形にならない。
*   **結合できる線**（`PathJoinRules.isJoinableLine`）を「直線、または**区間がすべて`'line'`**の開いたパス」へ改める。これ1か所で、曲線のパスは結合（ボタン・`J`）・端点への吸い付き（直線のツールの描き始め・引いている途中、端点のハンドルのドラッグ）・描き足しの対象から外れる。さらに「作成途中の線が結合できる線でなければ、既存の線の端点を吸い付きの候補にしない」（`EndpointSnapRules.findDrawnLineSnapTarget`）ことで、曲線のツールは自分の始点にだけ吸い付く。後半（b）で`isJoinableLine`を曲線のパスまで広げれば、これらの除外はまとめて外れる。
*   **形の決め方の式（一様なCatmull-Romの3次ベジェへの直し方）は`shapes/ShapeGeometry.js`の1関数に置く**。`Path`の描画・当たり判定・範囲選択・塗りの内側・描画要素（書き出し）はすべてこの関数の結果を使う。書き出しの外枠は描画要素の制御点から3次ベジェの極値で求める（`io/SpriteSerializer`。読む側の規則の計算で、Catmull-Romの式は持たない）。
*   **新しい再描画・同期の経路は足さない**。描画は`CanvasManager`が作成途中の図形・図形をポリモーフィックに描くだけ（変更なし）。頂点の選択・移動・微調整・整列・位置の数値入力は、既存の共通メソッド（`getVertexHandleNames`・`getHandlePosition`・`setVertex`・`translate`）と`SpriteSerializer.computeShapesBounds`（外枠）の経路のまま曲線のパスに働く（頂点を動かすと、作業データに制御点を持たないため形が自動で決まり直す）。

**状態の持ち主（二重に持たない）**：打った点の並びと足す区間の種類は`VectorModel`の作成途中の図形（`#draftShape`）だけが持つ（3章22.のまま）。曲線の区間の制御点は作業データにも図形にも持たず、描くたび・判定するたびに頂点の並びと区間の種類から求める。

### 要件A: 形の決め方の式（`js/shapes/ShapeGeometry.js`。既存へ追加）

*   **置き場所の理由**：式は頂点の座標だけで決まる純粋な幾何の計算で、使うのは図形クラス（`Path`）だけ。`ShapeGeometry.js`は「図形クラスだけが使う共通の幾何の関数」の置き場所で、importを持たず、`quadraticBezierPoint`と同じ並びに置ける。新しいファイル（`shapes/`の規則）にすると`shapes/`の外から使う第3の種類か、新しい種類のファイルになり、importの約束・資料の区分を増やすことになる。式は区間の種類の文字列を知らない形（「曲線の区間か」の真偽値の配列を受け取る）にし、`ShapeGeometry.js`が`Path.js`の定数をimportしない（共通モジュールは`shapes/`の他のファイルをimportしない約束のまま）。
*   **足す関数（`export`。いずれも状態なし・引数を書き換えない・新しいオブジェクトを返す・例外を投げない）**：
    *   `cubicBezierPoint(p0, p1, p2, p3, t)` → `{ x, y }`：3次ベジェ曲線 B(t) = (1−t)³P0 + 3(1−t)²t P1 + 3(1−t)t² P2 + t³P3 の点（`quadraticBezierPoint`と同じ書き方・引数の形）。
    *   `computeSmoothSegmentControls(points, smoothFlags, closed)` → `Array<{ control1: {x, y}, control2: {x, y} } | null>`：区間ごとの3次ベジェの制御点2つ。`points`＝頂点の並び（`n`個）、`smoothFlags`＝区間ごとの「曲線の区間か」（要素数は開いたパス`n − 1`・閉じたパス`n`。区間`i`＝`points[i]`→`points[(i+1) % n]`）、`closed`＝閉じたパスか。戻り値の要素数は`smoothFlags`と同じで、曲線の区間でない区間は`null`。
*   **式（REQの固定の式。変えないこと）**：区間`i`（`m`＝区間の数、`a = P[i]`、`b = P[(i+1) % n]`）が曲線の区間のとき、
    *   前の区間：閉じたパスなら番号`(i − 1 + m) % m`、開いたパスなら`i − 1`（`i = 0`なら無い）。それが存在し、`i`と別の区間で、かつ曲線の区間なら`Q0 = その区間の始点の頂点 = P[前の区間の番号]`、そうでなければ`Q0 = 2·a − b`（折り返した仮の点）。
    *   次の区間：閉じたパスなら番号`(i + 1) % m`、開いたパスなら`i + 1`（`i + 1 = m`なら無い）。それが存在し、`i`と別の区間で、かつ曲線の区間なら`Q3 = その区間の終点の頂点 = P[(次の区間の番号 + 1) % n]`、そうでなければ`Q3 = 2·b − a`。
    *   `control1 = a + (b − Q0) / 6`、`control2 = b − (Q3 − a) / 6`（x・yそれぞれ。式のとおりの順で計算する）。
    *   性質（JSDocに書く）：頂点の座標の1次式（頂点を拡大縮小（縦横別を含む）・回転・平行移動すると制御点も同じ変換を受ける）。連なりの区間が1つだけ（両側が仮の点）なら制御点は`a + (b − a)/3`・`b − (b − a)/3`で直線と同じ形。直線の区間と曲線の区間のつなぎ目は、曲線の側を連なりの端として扱う（＝角が立つ。直線の区間は直線のまま）。閉じたパスで全区間が曲線なら1周がひとつの連なり（始点のところもなめらか）。打った点の間隔が大きく違うと膨らむ・小さな輪ができることがあるのは式の性質（許容）。
*   **ファイル先頭の責務定義**（3行以内）に「3次ベジェ曲線の点」「点を通るなめらかな曲線の区間の制御点（パスの曲線の区間の形の決め方）」を足す。
*   **変えないもの**：既存の4関数（`segmentIntersectsRect`・`distanceToSegment`・`quadraticBezierPoint`・`isPointInPolygonNonzero`）。
*   **テストの観点**（`test/shapes/ShapeGeometry.test.js`へ`describe`を追加）：`cubicBezierPoint`のt=0・1・0.5の値。`computeSmoothSegmentControls`：(1) 開いた2点1区間（曲線）→直線の1/3・2/3の点、(2) 開いた4点3区間すべて曲線の中央の区間が前後の実の頂点を使う（手計算の値と一致）・両端の区間が仮の点を使う、(3) 直線の区間は`null`、直線の区間の隣の曲線の区間は仮の点を使う（連なりの区切り）、(4) 閉じたパスで全区間が曲線なら区間0の`Q0`が最後の頂点・最後の区間の`Q3`が`P[1]`（番号の一周）、(5) 閉じたパスで閉じる区間だけが直線なら、区間0の`Q0`・最後の曲線の区間の`Q3`が仮の点、(6) 1次式であること：頂点を縦横別の倍率で拡大縮小・平行移動した結果の制御点が、元の制御点に同じ変換を当てたものと一致（浮動小数の誤差を許す比較。例1e-9）、(7) 引数を書き換えない・毎回新しいオブジェクト。

### 要件B: パスの曲線の区間（`js/shapes/Path.js`・`js/shapes/ShapeDataValidation.js`。既存へ追加・変更）

*   **区間の種類の定数**：既存の非公開`SEGMENT_KIND_LINE`を**名前を変えずに`export`**し、`export const SEGMENT_KIND_SMOOTH = 'smooth';`を足す（唯一の定義箇所。`PathJoinRules`・`ShapeFactory`がimportする）。`ACCEPTED_SEGMENT_KINDS`を`[SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH]`にし、JSDocを改める（`fromJSON`のエラー文は既存のコードがこの並びから作るため、`'line'・'smooth'`になる）。
*   **曲線の区間の近似の分割数**：非公開の定数`SMOOTH_SEGMENT_SAMPLE_COUNT = 100`（曲線の区間1つを折れ線で近似するときの分割数。当たり判定・範囲選択・塗りの内側が共有する**唯一の定義**。今の曲線の`hitTest`の100分割と同程度）。
*   **コンストラクタ**：第6引数`segmentKind = SEGMENT_KIND_LINE`を足す（全区間をこの種類で作る）。**引数を省いた既存の呼び出しの結果は今と同じ**（全区間`'line'`）。JSDocに「区間の種類を区間ごとに変えるのは`fromJSON`（`segments`を作り直す）だけ」と書く。
*   **`isPlainObject`の移動（REQが計画で決めるよう求めた項目）**：**移す**。`ShapeDataValidation.js`の非公開関数`isPlainObject`に`export`を付け（中身・名前は変えない）、`Path.js`の同じ条件の非公開関数を消してimportに置き換える（`import { validateShapeData, isPlainObject } from './ShapeDataValidation.js';`）。理由：同じ判定を2か所に持つ二重定義で、本作業で`Path.fromJSON`の区間の検証を変える機会に、`Path`が既にimportしている図形データの検証の共通モジュールへ寄せる（条件は一字一句同じでふるまいは変わらない。共通モジュールは`shapes/`の図形クラスからだけ使われる約束のまま）。`ShapeDataValidation.js`の先頭の責務定義は変えない（「図形データの共通項目の検証」の範囲）が、`isPlainObject`のJSDocに「`Path.fromJSON`の区間の要素の判定にも使う」を足す。
*   **非公開の補助（`Path`の中だけ。区間の種類による分岐はすべてここに集める）**：
    *   `#segmentControls()`：`computeSmoothSegmentControls(this.points, this.segments.map((s) => s.kind === SEGMENT_KIND_SMOOTH), this.closed)`の結果（区間ごとの制御点または`null`）。
    *   `#tracePath(ctx)`（既存。中身を広げる）：`beginPath` → `moveTo(points[0])` → 区間`i`ごとに、終点`b = points[(i+1) % n]`へ、曲線の区間なら`bezierCurveTo(control1.x, control1.y, control2.x, control2.y, b.x, b.y)`、直線の区間なら`lineTo(b.x, b.y)`。ただし**閉じたパスの閉じる区間（最後の区間）が直線なら`lineTo`を呼ばない**（今と同じ）→ `closed`なら`closePath`。**区間がすべて直線のパスの命令の並び・引数は今と完全に同じ**（`lineTo`（i=1…n−1）→ `closePath`）。閉じる区間が曲線なら、その曲線を描いてから`closePath`。`draw`・`drawHover`・`drawOutline`は`#tracePath`を使うため、線・塗り・ホバーの強調・アウトライン表示が曲線の形に沿う（3つのメソッドの中身は変えない）。
    *   `#someSegment(predicate)`（既存。中身を広げる）：区間ごとに、直線の区間は今と同じく`predicate(a.x, a.y, b.x, b.y)`を1回、曲線の区間は`SMOOTH_SEGMENT_SAMPLE_COUNT`個の小区間（`k = 1…N`の点`cubicBezierPoint(a, control1, control2, b, k / N)`。ただし`k = N`は誤差を避けて`b`そのもの）について順に`predicate`を呼び、どれかが真なら真。`hitTest`・`intersectsRect`は中身を変えない（区間がすべて直線のパスでは呼び出しの引数・回数が今と同じ）。
    *   `#fillPolygon()`（新規）：塗りの内側の判定に使う頂点の並び。区間ごとに始点の頂点を並べ、曲線の区間ならその後に`k = 1…N − 1`の点を足す（閉じる区間の近似点は末尾）。区間がすべて直線なら`points`と同じ並び。`hitTestFill`は`isPointInPolygonNonzero(x, y, this.#fillPolygon())`にする（塗られていなければ偽・境界を含めないは今のまま）。
*   **`toDrawElement()`**：区間がすべて直線なら**今と同じ`polyline`**（キー・値・順とも変えない）。曲線の区間を1つ以上持つなら新しい描画要素`bezierPath`（下の形。制御点は`#segmentControls()`の値）。どちらも戻り値と自身は配列・頂点を共有しない。
    *   **`bezierPath`の形（キー順もこの順）**：`{ kind: 'bezierPath', id, points: [{x, y}, ...], closed, segments: [区間, ...], strokeColor, strokeWidth, fillColor }`。`points`は全頂点（閉じたパスも始点を重複させない）、`segments[i]`は`points[i]`→`points[(i+1) % n]`の区間で、直線は`{ kind: 'line' }`、曲線の区間は`{ kind: 'cubic', control1: {x, y}, control2: {x, y} }`（3次ベジェの制御点2つの座標。読む側はCatmull-Romの規則を知らなくてよい）。`fillColor`は`polyline`と同じく塗れる形（閉じたパス）なら図形の値、開いたパスなら`null`。描画要素の区間の種類の語は`'line'`・`'cubic'`（作業データの`'smooth'`とは別の語彙。Phase 09-03で今の曲線・弧を3次ベジェの区間として表せるように）。
*   **`fromJSON`**：`'smooth'`を受理し（`'line'`と混ざってよい）、`segments`を`data.segments`の`kind`から作り直す（今のまま）。受理しない`kind`はエラー（文言は`segments[i]のkindが'line'・'smooth'ではありません（…）`）。ほかの検証・順序・エラー文は変えない。
*   **JSDoc**：ファイル先頭の責務定義（「折れ線」→「直線の区間と点を通るなめらかな曲線の区間からなる線」等。3行以内）、クラスのJSDoc（区間の種類`'line'`・`'smooth'`、曲線の区間の形は`computeSmoothSegmentControls`で決まり制御点を持たないこと、`ShapeFactory.create`の曲線のツールの描き始めでも作られること（頂点2つ・区間1つの曲線）、直線・曲線のツールで続けて引く線もPathJoinRulesが作る）、`#tracePath`・`#someSegment`・`hitTestFill`・`toDrawElement`・`fromJSON`・`updateDraftEnd`（直線・曲線のツールで続けて引く作成途中の線）のJSDocを実態に合わせる。
*   **変えないもの**：`hitTestHandle`・`getVertexIndexForHandle`・`getHandlePosition`・`getVertexHandleNames`・`setVertex`・`translate`・`updateDraftEnd`（中身）・`isFillable`・`drawHandles`・`toJSON`（区間の要素は`{ kind }`のまま写す）・`draw`・`drawHover`・`drawOutline`の中身。頂点のハンドルは頂点（打った点）だけ（制御点は出さない）。
*   **テストの観点**（`test/shapes/Path.test.js`へ`describe`を追加。既存の`makeRecordingCtx`の記録する命令の名前の配列に`'bezierCurveTo'`を足すことだけは可（既存のケースの記録は変わらない）。ほかの補助関数は変えない）：
    *   コンストラクタ：第6引数を省くと全区間`'line'`、`'smooth'`を渡すと全区間`'smooth'`（開いた`n − 1`・閉じた`n`）。
    *   描画命令：開いた曲線のパス（`moveTo` → `bezierCurveTo`×区間の数、制御点が`computeSmoothSegmentControls`の値）、閉じた全区間曲線（閉じる区間も`bezierCurveTo`で始点へ → `closePath`）、直線と曲線が混ざったパス（直線の区間は`lineTo`。閉じる区間が直線なら`lineTo`なしで`closePath`）、区間がすべて直線のパスの記録が今と同じ（既存のケースが通ること）。塗り・線なし・`drawOutline`・`drawHover`も同じパス。
    *   当たり判定：曲線の区間の上の点（`cubicBezierPoint`で求めた点）に当たり、頂点を結ぶ直線の上でも曲線から離れた点には当たらない。`intersectsRect`：曲線だけが掛かる矩形で真、頂点を結ぶ直線にだけ掛かる矩形で偽。`hitTestFill`：閉じた曲線のパスで、曲線の膨らみの内側（頂点の多角形の外）が真、塗りなし・開いたパスは偽。
    *   `toDrawElement`：区間がすべて直線のパスは今と同じ`polyline`、曲線のパスは`bezierPath`の形・キー順・制御点の値・`fillColor`（開いた`null`・閉じた図形の値）、共有しないこと。
    *   `toJSON`/`fromJSON`：`'smooth'`を含む往復（混在を含む）で図形データ・描画・当たり判定が一致。未知の`kind`（`'curve'`・キーなし等）は不正（エラー文は`'line'・'smooth'`）。

### 要件C: 結合できる線と、続けて引く線の点の並び（`js/shapes/PathJoinRules.js`。既存へ変更・追加）

*   **import**：`import { Path, SEGMENT_KIND_LINE } from './Path.js';`（`Line`のimportは今のまま）。新しいimport先は無い（循環しない）。
*   **結合できる線の判定（唯一の箇所）**：`isJoinableLine(shape)`を「`type`が`'line'`、または`type`が`'path'`で`closed`が真でなく、**`segments`がすべて`SEGMENT_KIND_LINE`**」へ改める（`toJSON()`の図形データから読む）。JSDocに「曲線のパス（曲線の区間を1つ以上持つパス）は Phase 09-01a では結合できる線に含めない（結合・描き足し・端点への吸い付きの対象外。後半（b）でここを広げる）。結合・吸い付きの対象の判定はすべてこの関数に従う」と書く。
*   **この判定に従わせる既存の公開関数**（今の図形に対する結果は変えない）：
    *   `classifyJoin`の図形1つの枝：`type`が`'path'`でなければ、または`isJoinableLine`が偽なら`null`（曲線のパス1本は`'close'`にならない＝結合のボタンが押せない）。2つの枝は今のまま（`isJoinableLine`を使っている）。
    *   `buildClosedPath`・`canCloseByMergingEnds`：先頭で`isJoinableLine`が偽なら`null`／`false`（閉じたパス・直線・今の曲線などへの結果は今と同じ。曲線のパスを直線の区間だけの閉じたパスへ作り変える経路を作らないため）。
    *   ほかの結合・描き足しの関数（`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`・`planCloseOf`ほか）は既に`isJoinableLine`で弾いているため変えない。
*   **続けて引く線の形の判定（新規`export`）**：`isDrawnLineShape(shape)`＝`type`が`'line'`、または`type`が`'path'`で`closed`が真でない（区間の種類によらない）。「線を引いている途中か」（`EndpointSnapper.isDrawingLine`）と、作成途中の線の規則の関数の受け付け条件の唯一の箇所。
*   **作成途中の線の規則の関数の受け付け条件**：`addDrawnPoint`・`removeLastDrawnPoint`・`buildFinishedDrawnLine`・`getLastDrawnPoint`・`isOnLastDrawnPoint`・`canCloseDrawnLine`の先頭の`isJoinableLine(drawn)`を`isDrawnLineShape(drawn)`へ置き換える（直線のツールの作成途中の線では同じ結果）。
*   **足す区間の種類**（非公開`drawnSegmentKind(data)`）：作成途中の線の図形データから読む。`type`が`'line'`なら`SEGMENT_KIND_LINE`、パスなら最後の区間の`kind`（作成途中の線の区間はすべて同じ種類）。
*   **直線とパスの作り分け（唯一の箇所のまま）**：非公開`buildLineOrPath(points, closed, data, segmentKind)`へ第4引数を足す。「開いていて頂点が2つなら`Line`（区間の種類によらない＝曲線のツールで点を2つだけ打って終えても直線。発注者の決定）、それ以外は全区間`segmentKind`の`Path`」。
*   **作成途中の線の組み立て**（非公開`buildDrawnDraft(points, data, segmentKind)`。新規）：区間の種類が`SEGMENT_KIND_LINE`なら`buildLineOrPath(points, false, data, SEGMENT_KIND_LINE)`（今と同じ。頂点2つなら`Line`）、それ以外は頂点の数によらず全区間`segmentKind`の開いた`Path`（曲線のツールの作成途中の線は点が1つに戻っても曲線のパスのまま持ち、足す区間の種類を失わないため）。直線とパスの作り分けの規則そのものは持たない（直線の区間のときは`buildLineOrPath`へ任せる）。
*   **各関数の変更**：
    *   `addDrawnPoint(drawn)`：頂点＝今のまま（`drawn`の頂点＋末尾の写し）。結果を`buildDrawnDraft(points, data, drawnSegmentKind(data))`で作る（頂点は3つ以上なので常に開いた`Path`。直線のツールでは今と同じ全区間`'line'`、曲線のツールでは全区間`'smooth'`）。
    *   `removeLastDrawnPoint(drawn)`：頂点の除き方は今のまま。結果を`buildDrawnDraft(…)`で作る（直線のツールで残りが2つなら`Line`＝今と同じ、曲線のツールなら頂点2つの曲線のパス）。
    *   `buildFinishedDrawnLine(drawn, closed)`：打った点の取り出し・点の数の条件は今のまま。結果を`buildLineOrPath(points, closed, data, drawnSegmentKind(data))`で作る（開いたまま：2つで`Line`、3つ以上で全区間がその種類の開いた`Path`。閉じて：全区間がその種類の閉じた`Path`＝曲線のツールなら閉じる区間も曲線で、始点のところもなめらか）。
    *   `getLastDrawnPoint`・`isOnLastDrawnPoint`・`canCloseDrawnLine`：受け付け条件の置き換えだけ。
*   **変えないもの**：`JOIN_TOLERANCE_SCREEN_PX`・`CLOSED_MIN_POINTS`・`LINE_POINT_COUNT`の値、`planJoin`・`planDrawnLineJoin`・`planEndpointDragJoin`・`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`と非公開の組み立て・計画の関数の中身（いずれも結合できる線だけを扱う）。
*   **JSDoc**：ファイル先頭の責務定義（3行以内。「直線・曲線のツールで続けて引く作成途中の線の点の並びの規則（…足す区間の種類は作成途中の線のもの。点2つの開いた線は直線…）」「結合できる線＝直線と区間がすべて直線の開いたパス」）、変更・追加した関数のJSDocを実態に合わせる。
*   **テストの観点**（`test/shapes/PathJoinRules.test.js`へ`describe`を追加。既存のケース・補助関数は変えない）：`isJoinableLine`：曲線の区間を1つでも持つ開いたパス（全区間曲線・混在・頂点2つの曲線）は偽、直線・直線の区間だけの開いたパスは真（今のまま）。`classifyJoin`・`planJoin`：曲線のパス1本（頂点3つ以上）・曲線のパスと直線の2本は`null`。`buildClosedPath`・`canCloseByMergingEnds`：曲線のパスは`null`／`false`。`isDrawnLineShape`：直線・開いたパス（区間の種類によらない）は真、閉じたパス・今の曲線・矩形・円・弧は偽。作成途中の線が曲線のパスのとき：`addDrawnPoint`は全区間`'smooth'`の開いたパス、`removeLastDrawnPoint`は頂点3つ→頂点2つの曲線のパス（`Line`にならない）・頂点2つ→`null`、`buildFinishedDrawnLine`は打った点2つで`Line`・3つで全区間`'smooth'`の開いたパス・閉じて3つで全区間`'smooth'`（区間3つ）の閉じたパス、`getLastDrawnPoint`・`isOnLastDrawnPoint`・`canCloseDrawnLine`が直線の作成途中の線と同じ規則で働く。引数を書き換えず、結果と頂点を共有しない。直線のツールの作成途中の線の結果が今と同じ（既存のケースが通ること）。

### 要件D: 曲線のツールは既存の線の端点に吸い付かない（`js/shapes/EndpointSnapRules.js`。既存へ変更）

*   `findDrawnLineSnapTarget(shapes, drawn, point, tolerance, startSnap)`：**作成途中の線`drawn`が結合できる線（`isJoinableLine(drawn)`）のときだけ**既存の線の端点を候補にする（偽なら端点の走査をせず、結果なし・距離`Infinity`として扱う）。始点の候補の条件（`startSnap`が`null`で`canCloseDrawnLine(drawn)`）・同距離のときの優先は今のまま。直線のツールの作成途中の線は常に結合できる線なので結果は今と同じ。曲線のツールの作成途中の線は結合できる線でないため、自分の始点（打った点が3つ以上のとき）にだけ吸い付く。後半（b）で`isJoinableLine`を広げれば、曲線のツールも端点へ吸い付くようになる。
*   `findSnapTarget`・`resolveEndpointHandle`・`isSnapDrawShapeType`のコードは変えない（`isJoinableLine`経由で、曲線のパスの端点は候補にならず、曲線のパスの端点のハンドルは端点として解決されない）。曲線のツールの描き始めは`isSnapDrawShapeType('curve')`が偽のため今も吸い付かない（変えない）。
*   **JSDoc**：`findDrawnLineSnapTarget`の手順1.に条件を足す。`findSnapTarget`・`resolveEndpointHandle`のJSDocの「結合できる線（直線・開いたパス）」を「結合できる線（直線・区間がすべて直線の開いたパス）」へ。ファイル先頭の責務定義は変えない（3行のまま。中身は「端点への吸い付きの規則」の範囲）。
*   **テストの観点**（`test/shapes/EndpointSnapRules.test.js`へ`describe`を追加。既存のケースは変えない）：`findSnapTarget`は曲線のパスの端点を候補にしない（近くに直線の端点があればそちら）。`resolveEndpointHandle`は曲線のパスの端点のハンドルで`null`。`findDrawnLineSnapTarget`は、作成途中の線が曲線のパス（打った点2つ・3つ以上）のとき、近くに既存の直線の端点があっても`null`／始点だけを返す（打った点が3つ以上で始点に近いとき`drawnStart`）。作成途中の線が直線のパスのときの結果は今と同じ。

### 要件E: 線を引いている途中かの判定（`js/edit/EndpointSnapper.js`。既存へ変更）

*   `isDrawingLine()`：`isJoinableLine(drawn)`を`isDrawnLineShape(drawn)`へ置き換える（importも`isJoinableLine`を`isDrawnLineShape`へ。ほかに`isJoinableLine`を使っていなければ取り除く）。JSDoc：「作成途中の図形が続けて引く線の形（直線、または区間の種類によらず開いたパス）か。直線のツールの作成途中の線は直線か直線の区間だけの開いたパス、曲線のツールの作成途中の線は曲線の区間の開いたパス（打った点が1つの間も頂点2つの曲線のパス）。弧・矩形・円の作成途中の図形は当たらない」。
*   ほかのメソッドのコードは変えない（`clickDrawnLine`・`finishDrawnLine`・`removeDrawnLinePoint`・`findDrawnLineSnap`・`getDrawnLineLastPoint`は、規則の関数が区間の種類を作成途中の線から読むため、そのまま曲線のツールに働く。クリックの判定の順（始点で閉じる → 最後の点と重なる → 端点につながる → 点を打つ）も同じで、曲線のツールでは3.が起きない）。ファイル先頭の責務定義・クラスのJSDoc・各メソッドのJSDocの「直線のツール」を「直線・曲線のツール」へ実態に合わせる（3行以内のまま）。
*   **テストの観点**（`test/edit/EndpointSnapper.test.js`へテストを追加。既存のケース・補助関数は変えない。曲線のツールの作成途中の線は、要件G（`ShapeFactory`の切り替え）より前のタスクのため、実物の`VectorModel`で`startDraft`の後に`replaceDraft`で頂点2つの曲線のパス（`new Path([...], false, undefined, undefined, undefined, SEGMENT_KIND_SMOOTH)`）へ置き換えて作ってよい）：`isDrawingLine`は曲線のパスの作成途中の線で真・今の曲線（`Curve`）の作成途中の図形で偽（今のまま）。曲線の作成途中の線で`clickDrawnLine`→点を打つと全区間`'smooth'`、記録先に触れない。点2つで`finishDrawnLine`→`line`が1件の記録で確定、3つで開いた曲線のパス、打った点3つ以上で始点への吸い付きのクリック→閉じた曲線のパス（全区間`'smooth'`）、`removeDrawnLinePoint`で曲線のパスのまま点が減り始点だけでやめる。`findDrawnLineSnap`は曲線の作成途中の線で既存の線の端点を返さない。
*   **`edit/PathJoiner.js`はコードを変えない**（`planJoin`経由で曲線のパスの選択は結合できない）。`test/edit/PathJoiner.test.js`へ「曲線のパス1本・曲線のパスと直線では`canJoin`が偽で、`join`は何もせず記録しない」を足す（既存のケースは変えない）。

### 要件F: 書き出し（`js/io/SpriteSerializer.js`・`js/io/CodeExporter.js`。既存へ変更・追加。`check/`・`sprite-check.html`は変えない見込み）

*   **`SpriteSerializer`**：
    *   `SPRITE_FORMAT_VERSION`を`3`にする（唯一の定義箇所。`checkFormat`は1〜3を受理＝版1・版2のJS（`asset/sprite/`の生成物を含む）も今までどおり`'supported'`）。版を上げる理由（JSDoc）：曲線のパスの描画要素`bezierPath`を足し、古い読み手が未知の`kind`として描かないと正しく描けなくなるため（2章「2つの版」の規則）。
    *   typedef`DrawElement`・`SpriteData`のJSDocに`bezierPath`（キー列`kind, id, points, closed, segments, strokeColor, strokeWidth, fillColor`、区間の形）と版3を書く。
    *   形の範囲の表`SHAPE_RANGE_BY_KIND`へ`bezierPath: bezierPathRange`を足す。非公開`bezierPathRange(element)`＝全頂点の最小・最大と、`kind`が`'cubic'`の区間ごとの各軸の極値（制御点そのものは含めない）の和。区間`i`の始点は`points[i]`、終点は`points[(i + 1) % points.length]`。
    *   非公開`cubicAxisRange(p0, c1, c2, p3)`（3次ベジェの1軸分の最小・最大。`quadraticAxisRange`と同じ書き方）：始点・終点の最小・最大から始め、導関数の根 t∈(0, 1) の値を足す。導関数/3 ＝ a·t² + b·t + c、`a = −p0 + 3·c1 − 3·c2 + p3`、`b = 2·(p0 − 2·c1 + c2)`、`c = c1 − p0`。`a === 0`なら`b !== 0`のとき`t = −c / b`、`a !== 0`なら判別式`b² − 4ac ≥ 0`のとき`t = (−b ± √判別式) / (2a)`。各tで (1−t)³p0 + 3(1−t)²t c1 + 3(1−t)t² c2 + t³p3 を求める。**この3次ベジェの計算は`shapes/ShapeGeometry`の`cubicBezierPoint`とは別の定義**（`io/`は`shapes/`をimportできない。今の`quadraticAxisRange`と`quadraticBezierPoint`と同じ扱い）とJSDocに書く。
    *   **変えないもの**：`serialize`・`computeShapesBounds`・`stringify`・`checkFormat`の中身（版の値は定数で変わる）、`polyline`・`quadratic`・`ellipse`の範囲の求め方、`DEFAULT_STROKE_WIDTH`、線の太さの半分の広げ方。
    *   **テストの観点**（`test/io/SpriteSerializer.test.js`。既存の`formatVersion`の期待値`2`→`3`の書き換え1件（要件I）と`describe`の追加）：曲線のパス（開いた・閉じた・混在）の描画要素が`bezierPath`の形・キー順で、区間がすべて直線のパスは今と同じ`polyline`。外枠が曲線の膨らみ（極値）を含み制御点を含まない（手計算・または`cubicBezierPoint`相当の細かいサンプリングとの近い一致）・線の太さの半分を広げる・線なしなら広げない。`computeShapesBounds`も同じ値。`checkFormat`が`formatVersion: 3`・`2`・`1`を`'supported'`、`4`を`'unsupportedVersion'`。
*   **`CodeExporter`**：
    *   `DRAW_SOURCE`の`drawElement`へ`case 'bezierPath'`を足す：**パスを組み立てる前に**形の項目を確かめ、足りなければ`return`（`points`が配列で2点以上、`segments`が配列で要素数が`closed === true`なら`points.length`・それ以外は`points.length − 1`、各区間が`null`でないオブジェクトで、`kind`が`'line'`か、`kind`が`'cubic'`で`control1`・`control2`が`null`でないオブジェクト）。描き方：`beginPath` → `moveTo(points[0])` → 区間`i`ごとに終点`points[(i + 1) % points.length]`へ、`'cubic'`なら`bezierCurveTo(control1.x, control1.y, control2.x, control2.y, 終点.x, 終点.y)`、`'line'`なら`lineTo(終点)`（**閉じた要素の最後の区間が`'line'`なら`lineTo`を呼ばない**）→ `closed === true`なら`closePath`。エディタの`Path.draw`（要件Bの`#tracePath`）と命令・引数・順序を一致させる。
    *   塗りの条件を「`fillColor`が文字列で`closed === true`で、`kind`が`polyline`・`ellipse`・`bezierPath`のどれか」へ広げる。
    *   `DRAW_SOURCE`の中のJSDoc（塗りの規則・形の項目が足りない要素）と、`DRAW_SOURCE`の保守上の注意のJSDocを実態に合わせる。`HEADER_COMMENT`・宣言の行の形・`extractSpriteDataText`・`toModuleText`は変えない。`DRAW_SOURCE`の中でテンプレート文字列・`import`・外部の名前を使わない（今の約束）。
    *   **テストの観点**（`test/io/CodeExporter.test.js`。記録する偽の`ctx`の補助`createRecordingCtx`の命令の名前の配列に`'bezierCurveTo'`を足すことだけは可（既存のケースの記録は変わらない）。ほかは`describe`の追加のみ）：見た目の一致（エディタの`draw`と書き出したJSの`draw`の記録の比較）を、開いた曲線のパス・閉じた全区間曲線のパス・塗った閉じた曲線のパス・線なしで塗りだけ・直線と曲線の混在（閉じる区間が直線／曲線）・頂点を動かした曲線のパス・既存の図形との混在で確かめる。手で組み立てた`bezierPath`の要素で、形の項目が足りない（点1つ・`segments`の要素数違い・未知の区間の`kind`・`control1`なし）なら何も呼ばないこと、`closed`が`true`でなければ塗らないことを確かめる。既存の全ケースが通ること（`polyline`等の記録は今と同じ）。
*   **`FileContentReader`・`check/`・`sprite-check.html`は変えない見込み**：判別は`SpriteSerializer.checkFormat`だけを通るため、版3のJSは「開く」「インポート」（`source`を`DocumentSerializer`へ渡す）と確認用ページ（既定のexportの`draw`で描く）で読める。実装時にコードで確かめ、版の値を直書きしている箇所があれば本計画書の「5. 懸念事項」に書いて止める（勝手に変えない）。
    *   **テストの観点**（`test/io/FileContentReader.test.js`へ`describe`を追加。既存のケースは変えない）：曲線のパス（開いた・閉じた・塗った・混在）を含む図形一式を`SpriteSerializer.serialize`→`CodeExporter.toModuleText`したJS（版3）を`deserializeFromText`で読むと、区間の種類を含めて元に戻る。`formatVersion`を`2`に書き換えた同じJSも読める。

### 要件G: 曲線のツールの作成途中の図形（`js/core/ShapeFactory.js`。既存へ変更）

*   `SHAPE_REGISTRY`の`curve`のエントリの`create`を`(x1, y1, x2, y2) => new Path([{ x: x1, y: y1 }, { x: x2, y: y2 }], false, undefined, undefined, undefined, SEGMENT_KIND_SMOOTH)`にする（`undefined`でコンストラクタの既定のスタイルが当たる。新しく描く図形のスタイルは`VectorModel.startDraft`が直後に当てる＝今のまま）。importへ`SEGMENT_KIND_SMOOTH`を足す（`import { Path, SEGMENT_KIND_SMOOTH } from '../shapes/Path.js';`）。`fromJSON: (data) => Curve.fromJSON(data)`・ほかのエントリ・`SHAPE_TYPES`・並び・`create`/`fromJSON`のメソッドのコードは変えない（`Curve`のimportは`fromJSON`が使うため残る）。
*   **JSDoc**：typedef`ShapeRegistryEntry`の`create`（「ツールで描き始めたときの作成途中の図形を作る。`curve`のツールは頂点2つ・区間1つの曲線のパス（`type`は`'path'`）を作り、今の曲線（`Curve`）は`fromJSON`でのみ作られる」）、`SHAPE_REGISTRY`のJSDoc、`ShapeFactory.create`の`@returns`（`Line|Path|Rect|Ellipse`）と説明。ファイル先頭の責務定義は変えない。
*   `VectorModel.startDraft`は変えない（`ShapeFactory.create(type, x, y, x, y)`のまま。図形種別の比較を足さない）。`InputTracker`のコードは変えない（描き始めの`findDrawSnap(this.currentShapeType, …)`は`curve`で`null`のまま＝吸い付かない。`DRAWING`の枝は`isDrawingLine()`が真になるため、直線のツールと同じ線を引く流れ（`findDrawnLineSnap`・`clickDrawnLine`・`finishDrawnLine`・`removeDrawnLinePoint`・`getDrawnLineLastPoint`による`Shift`の限定・スナップ）をそのまま通る）。`main.js`の`selectShapeTool`・`selectModeTool`・`startEyedropper`は先に`finishLineDrawing()`を呼ぶため、同じ曲線のツールを選び直したときを含めツールの切り替えで描いた分が残る（今のまま）。
*   **テストの観点と既存のテストの変更**（要件I）：`test/core/ShapeFactory.test.js`の「`SHAPE_TYPES`の各種別で`type`が一致する図形を返す」を、`curve`以外の種別で一致を確かめ、`curve`は「開いた`Path`（`type`が`'path'`・`closed`が偽・頂点2つ・`segments`が`[{ kind: 'smooth' }]`）」を確かめる形に書き換える（期待値の変更。理由：曲線のツールで作る図形が変わるため）。ほかのケースは変えない。あわせて、`ShapeFactory.fromJSON`が`curve`の図形データを`Curve`として復元すること（今のまま）を確かめるケースが無ければ足す。

### 要件H: 意味が広がったJSDocの文言（`js/core/InputTracker.js`・`js/main.js`・`js/core/KeyboardShortcuts.js`・`js/core/VectorModel.js`。**コードは変えない**）

*   線を引いている途中・最後の点を消す・描いた分を残して終える等の説明のうち「直線のツール」と書いてある箇所を、曲線のツールにも当てはまる記述（「直線・曲線のツール」）へ直す。対象（実装時に`grep "直線のツール"`で確かめる）：`InputTracker.js`（ファイル先頭の責務定義の「図形作成（直線のツールでは点を打って続けて引く）」・typedef`EndpointSnapAssist`の`isDrawingLine`等・クラスのJSDoc・`cancelDraftOrClearSelection`・`finishLineDrawing`・`removeLastLinePoint`・`#isDrawingLine`・`handleMouseMove`・`handleClick`のJSDoc）、`main.js`（`performUndo`の(2)・(3)の「ここで中断し得るのは直線・曲線のツール以外（弧・矩形・円）の作成途中の図形のみ」、`selectShapeTool`の「同じ直線・曲線のツールを選び直したときも含む」）、`KeyboardShortcuts.js`（typedef`ShortcutActions`の`setMode`・`setShapeType`・`cancel`・`deleteSelection`・`undo`）、`VectorModel.js`（`#draftShape`・`replaceDraft`のJSDoc）。
*   **変えないもの**：コード・対応表`SHORTCUT_BINDINGS`・関数名・行の構成（できるだけ行数を変えない。`InputTracker.js`は1729行、`main.js`は1010行のまま見込み）。ファイル先頭の責務定義は3行以内のまま。直線のツールの固有の説明（直線のツールだけの事柄＝描き始め・引いている途中の既存の線の端点への吸い付き・つながる・描き足し）は「直線のツール」のまま残す。

### 要件I: テスト（REQ要件7）と、変える既存のテスト

*   **追加するテスト**：要件A〜Gの「テストの観点」のとおり、`test/shapes/ShapeGeometry.test.js`・`Path.test.js`・`PathJoinRules.test.js`・`EndpointSnapRules.test.js`、`test/edit/EndpointSnapper.test.js`・`PathJoiner.test.js`、`test/io/SpriteSerializer.test.js`・`CodeExporter.test.js`・`FileContentReader.test.js`・`DocumentSerializer.roundtrip.test.js`（曲線のパスの往復＝開いた・閉じた・直線と曲線の混在・頂点を動かした・塗りを付けた、を既存の`ROUTES`（作業データの文字列層・オブジェクト層等）で）、`test/core/ShapeFactory.test.js`へ足す。新しいテストファイルは作らない。`InputTracker`・`main.js`はテストを置かない（`_doc/arch/16_test.md`の方針）。
*   **期待値を書き換える既存のケース（理由つき。これ以外の既存の期待値は変えない）**：
    1.  `test/core/ShapeFactory.test.js`「`SHAPE_TYPES`の各種別で`type`が一致する図形を返す」：曲線のツールで作る図形が曲線のパス（`type: 'path'`）になるため（要件G）。
    2.  `test/shapes/Path.test.js`のエラー文の3つの期待値（`segments[2]のkindが'line'ではありません（curve）`・`segments[0]のkindが'line'ではありません（undefined）`・`segments[0]のkindが'line'ではありません（curve）`）を`'line'・'smooth'`へ：受理する区間の種類が増えたため（エラー文は受理する種類の並びから作られる。既存のJSDocがこの改めを予告している）。
    3.  `test/io/SpriteSerializer.test.js`の`formatVersion`の期待値`2`→`3`：書き出し形式の版を上げたため。
*   **期待値を変えずに図形の作り方だけを置き換える既存のケース**（`ShapeFactory.create('curve', …)`を「今の曲線を作る手段」として使っている箇所。同じ引数の`new Curve(…)`へ置き換え、必要なら`Curve`のimportを足す。置き換え前と同じインスタンスになる）：`test/io/DocumentSerializer.roundtrip.test.js`の`statesFor`の`curve`の枝（`mk`を使う3状態。`curve`の枝だけ`new Curve(...args)`で作る）・`makeMixed`の2か所（183行目付近・362行目付近）、`test/io/DocumentSerializer.errors.test.js`の`makeValidShapes`（34行目付近）、`test/edit/CanvasFileOperations.test.js`の`makeShapes`（141行目付近）。`test/edit/CanvasFileOperations.export.test.js`の`makeShape('curve', …)`（書き出しが図形を書き換えないことの確認）と`test/core/VectorModel.style.test.js`の`SHAPE_TYPES`の繰り返しは、曲線のパスでも同じ期待値で通るため変えない。上記以外に失敗するケースが出た場合は、勝手に期待値を変えず作業を止めて報告する。
*   **補助関数の変更として許すもの**：記録する偽の`ctx`の命令の名前の配列へ`'bezierCurveTo'`を足すこと（`test/shapes/Path.test.js`の`makeRecordingCtx`・`test/io/CodeExporter.test.js`の`createRecordingCtx`）。既存のケースの記録は変わらない。

### 要件J: ふるまいの確認（テストプレイの確認項目。REQ要件8）

最後のタスクで、実装後のコードで裏取りしてから、画面・操作・挙動の言葉で発注者へ提示する。少なくとも次を含める（REQの0〜14）：
0.  **準備**：ブラウザで画面を開き、`Ctrl`+`F5`で最新にする。曲線のツール（〜・`2`）を選ぶ。
1.  **点を打つ**：1回目のクリックの後は直線が付いてくる。2点目を打つと、付いてくる線が始点・2点目・カーソルを通る曲線になる。点を足すたびに打った点すべてをなめらかに通る1本の曲線になり、つなぎ目に角が立たない。カーソルを動かすと、最後の区間の前の区間も少し動く。
2.  **終える**：最後の点をもう1回クリック（ダブルクリック）で開いた曲線。点2つで終えると直線（選択で直線として選べる）。`Esc`でも開いたまま終わる。始点だけのときの`Esc`は何も残らない。
3.  **始点で閉じる**：点を3つ以上打ってから始点に近づけると青い正方形が出て、クリックで閉じた形になる（吸い付いて青い正方形が出ている間の付いてくる線は開いた形の見た目で、クリックで閉じると始点のところもなめらかになる）。塗りを付けると内側が塗られ、内側のクリックで選べる。
4.  **戻し**：引いている途中の`Backspace`・`Delete`・`Ctrl`+`Z`・取り消しボタンで最後の点が消え、引き続けられる。始点だけのときはやめる。
5.  **取り消し1回で丸ごと戻る**：点を5つ打って終えた曲線が`Ctrl`+`Z`1回で丸ごと消え、`Ctrl`+`Y`で戻る。
6.  **`Shift`とスナップ**：`Shift`の間、付いてくる線の先が最後の点から横・縦・斜め45°に限定される。グリッドのスナップ（10px）ONで打つ点が刻みに乗り、`Ctrl`の間は乗らない。
7.  **ツールの切り替え・パン・ズーム**：引いている途中に`V`などで切り替えると描いた分が残る（同じ曲線のツールのボタン・`2`でも残る）。パン・ズームしても描いている線は消えず引き続けられる。キャンバスの切り替え・貼り付けでは捨てられる。
8.  **選択で動かす**：線の上のクリック・範囲選択（曲線に掛かれば）で選べ、ドラッグ・`Shift`＋ドラッグ・`Alt`＋ドラッグで動かせる。ホバーの強調が曲線に沿う。矢印キー・位置の数値入力・整列と分布・複製・コピー＆ペースト・削除・スタイルの変更・スポイト・重なり順が働く。整列の基準の外枠（位置の欄の値）が曲線の形を囲む。
9.  **頂点の選択で形を変える**：`A`で打った点だけが四角のハンドルとして出る（制御点は出ない）。点をドラッグすると曲線がなめらかなまま形が変わり、前後の区間も少し変わる。複数の点を選んで矢印キーで動かせる。取り消し1回で戻る。
10. **保存して開き直す**：作業ファイルの出力→開くで同じ形に戻る。キャンバスを切り替えて戻っても同じ形。
11. **書き出し**：曲線（開いた・閉じた・塗った）を含むキャンバスを書き出し、確認用ページ（`sprite-check.html`）で開くとエディタで見たとおりに描かれ、版が3と表示される。書き出したJSをエディタの「開く」で開くと元の形に戻る。前に書き出した版2のJSも開ける。
12. **今の曲線が今までどおり**：今までに描いた今の曲線を含むファイルを開くと今までどおり描かれ、選べて、頂点の選択で曲がりを引っ張る点を含めて動かせる。
13. **結合の対象外（本作業の間だけ）**：曲線のパスを選んでも結合のボタンは押せず`J`も何もしない。直線のツールで曲線のパスの端点に近づけても吸い付かない（描き始め・引いている途中とも）。頂点の選択で曲線のパスの端点をほかの線の端点へドラッグしても吸い付かず、ほかの線の端点を曲線のパスの端点へドラッグしても吸い付かない。曲線のツールで既存の線の端点に近づけても吸い付かない。
14. **ほかが今までどおり**：直線のツールの連続作成（直線・パス・始点で閉じる・既存の線の描き足し・つながり）・弧・矩形・円・選択・頂点の選択・端点のハンドルのドラッグでの吸い付きと結合・結合（`J`）・保存・読み込み・書き出し・ツールのアイコンの表示。

自動テストで確かめられない箇所（特に確かめてほしい項目として添える）：`InputTracker`の配線を通る実際のマウス操作（付いてくる曲線の追従・ダブルクリック・`Shift`/`Ctrl`の読み取り・パン・ズームとの組み合わせ）、`CanvasManager`での見た目（なめらかさ・つなぎ目・アウトライン表示・ホバーの強調）、確認用ページでの表示。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/shapes/` - `ShapeGeometry`（形の決め方の式・3次ベジェの点）、`ShapeDataValidation`（`isPlainObject`の`export`）、`Path`（曲線の区間のデータ・描画・当たり・描画要素）、`PathJoinRules`（結合できる線の判定・続けて引く線の形の判定・足す区間の種類）、`EndpointSnapRules`（作成途中の線が結合できる線のときだけ端点を候補にする）。
    *   `./js/core/` - `ShapeFactory`（曲線のツールの作成途中の図形）。`InputTracker`・`KeyboardShortcuts`・`VectorModel`はJSDocのみ。
    *   `./js/edit/` - `EndpointSnapper`（線を引いている途中かの判定の置き換え）。`PathJoiner`は変更なし（テストのみ追加）。
    *   `./js/io/` - `SpriteSerializer`（版3・`bezierPath`の外枠）、`CodeExporter`（`DRAW_SOURCE`の`bezierPath`）。`FileContentReader`は変更なし（テストのみ追加）。
    *   `./js/` - `main.js`（JSDocのみ）。
    *   `./test/shapes/`・`./test/edit/`・`./test/io/`・`./test/core/` - 上記のテスト（新しいファイルは作らない）。
*   **関連する論理クラス**: `Path`、`Curve`（変更なし）、`Line`（変更なし）、`ShapeGeometry`・`ShapeDataValidation`・`PathJoinRules`・`EndpointSnapRules`（関数群）、`ShapeFactory`、`EndpointSnapper`、`PathJoiner`（変更なし）、`SpriteSerializer`、`CodeExporter`、`FileContentReader`（変更なし）、`InputTracker`・`VectorModel`・`KeyboardShortcuts`・`main.js`（JSDocのみ）。
*   **新しく作るファイル**：なし（ソース・テストとも）。
*   **変更しないファイル**：`index.html`・`sprite-check.html`・`js/check/`・`js/palette/`・`js/wiring/`・`asset/sprite/`・`js/shapes/Curve.js`・`Line.js`・`Rect.js`・`Ellipse.js`・`js/core/CanvasManager.js`・`HistoryManager.js`・`ToolRules.js`・`VertexHandleRules.js`・`PointHitRules.js`・`UnitSnapRules.js`・`MoveDirectionRules.js`・`js/io/DocumentSerializer.js`・`FileContentReader.js`・`js/edit/`の`EndpointSnapper.js`以外。

### 参照する責務
（以後のタスク実行チャットは、この項目のみを責務情報源とする。`PROJECT_ARCHITECTURE.md`・`_doc/arch/`からの抜粋）
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`・`palette/`・`wiring/`・`asset/`をimportしない。`core/`から`shapes/`をimportするのは`core/ShapeFactory`の1ファイルだけ。`io/`のimportは`io/`内と`core/ShapeFactory`のみ（`io/`は`shapes/`をimportしない）。一方向の列から外れるimportは、(1)`edit/PathJoiner → shapes/PathJoinRules`、`edit/EndpointSnapper → shapes/EndpointSnapRules`・`shapes/PathJoinRules`、(2)`shapes/`内：`shapes/EndpointSnapRules → shapes/PathJoinRules`（`PathJoinRules`は`Line`・`Path`のみimportするため循環しない）、(3)`edit/NudgeEditor`等→`core/`の規則、の3種だけ。循環importは無い。**本作業でimportの向きは増えない**（`PathJoinRules → Path`・`ShapeFactory → Path`・`Path → ShapeGeometry`・`ShapeDataValidation`は既存の向き）。
*   **`shapes/`**：図形クラス（種別ごとに1ファイル）と、図形クラスだけが使う共通の関数（`ShapeGeometry.js`＝幾何の計算、`ShapeDataValidation.js`＝図形データの検証。状態を持たない`export`した関数のみ。共通モジュールは`shapes/`の外および互いをimportしない。importするのは`shapes/`の図形クラスのみ）と、図形をまたぐ規則（`PathJoinRules`・`EndpointSnapRules`。第3の種類で`shapes/`の外から使う）。共通メソッド契約は18メソッド（`draw`・`drawHandles`・`drawHover`・`hitTest`・`hitTestHandle`・`setVertex`・`translate`・`updateDraftEnd`・`getVertexIndexForHandle`・`intersectsRect`・`toDrawElement`・`toJSON`・`static fromJSON`・`isFillable`・`hitTestFill`・`drawOutline`・`getHandlePosition`・`getVertexHandleNames`）で、増やさない。`draw`の順序：`shouldFill = isFillable() && typeof fillColor === 'string'`・`shouldStroke = typeof strokeColor === 'string'`、両方偽なら何も呼ばない → 形のパス → 塗り（`fillStyle` → `fill()`）→ 線（`strokeStyle` → `lineWidth` → `stroke()`）。**`io/CodeExporter.js`の`DRAW_SOURCE`と命令・引数・順序を揃え、一致は`test/io/CodeExporter.test.js`で確かめる**。`drawOutline`・`drawHover`の輪郭のパスは`draw`と同じ。`hitTestFill`は塗られているときだけ真になり得て、境界を含めない。`intersectsRect`は輪郭線の中心線が矩形に一部でも掛かれば真（曲線は折れ線の近似でよい）。`toDrawElement`は`draw`と同じ式で求め、呼び出し元は`SpriteSerializer`のみ。`toJSON`/`fromJSON`は内部配列・頂点を共有せず、`fromJSON`は不正な入力で`Error`（捕捉は`DocumentSerializer`）。各図形クラス・`ShapeFactory`は`try/catch`を持たない。
*   **`Path`**：頂点数可変の`points`・`closed`・`segments`。区間の約束：`segments[i]`＝`points[i]`→`points[i+1]`、閉じたパスの最後＝`points[n-1]`→`points[0]`、要素数は開いた`n − 1`・閉じた`n`。曲線の区間は`kind`の値と区間の要素のキーを足して拡張する（区間の要素の余分なキーは無視）。頂点数の下限は開いた2・閉じた3。ハンドルは`'vertex-<i>'`だけ（`move`なし）。`isFillable()`は`closed === true`。`hitTest`は`strokeWidth`を許容誤差に足さない。曲線の区間を足すときは描画・当たり判定・範囲選択・`hitTestFill`・`toDrawElement`のすべてで区間の種類による分岐が要り、`polyline`で表せなくなるため新しい`kind`と書き出し形式の版の判断が要る（既存の資料の予告）。
*   **`PathJoinRules`**：結合の規則と、続けて引く線の点の並びの規則。状態を持たない`export`した関数と定数のみ。読むものは図形の`type`・公開プロパティ`id`・`toJSON()`だけ（図形クラスの内部プロパティを読まない）。importは`./Line.js`・`./Path.js`のみ。使う側は`edit/PathJoiner`・`edit/EndpointSnapper`・`shapes/EndpointSnapRules`。表示倍率・`VectorModel`・履歴・DOM・操作モード・idの形式を知らない。結果は引数と配列・頂点を共有せず、引数を書き換えない。**直線とパスの作り分け（点2つの開いた線は`Line`）は非公開の`buildLineOrPath`の唯一の箇所**（`ShapeFactory`へは置かない）。結合できる線の判定（`isJoinableLine`）は吸い付く対象の判定にも使われる。
*   **`EndpointSnapRules`**：端点への吸い付きの規則。状態を持たない関数と定数のみ。読むものは`type`（`isJoinableLine`経由）・`id`・`toJSON()`・`getVertexIndexForHandle`。importは`./PathJoinRules.js`のみ。使う側は`edit/EndpointSnapper`のみ。`isSnapDrawShapeType`（`'line'`のときだけ真）は「直線を描くときだけ吸い付く」の唯一の定義。`findDrawnLineSnapTarget`は描き始めの端点を除いた端点と、条件を満たせば自分の始点（結果は`kind: 'drawnStart'`で区別）を候補にし、同距離なら端点を優先する。走査は`findSnapTarget`と非公開の`findNearestEndpoint`で共有する。
*   **`edit/EndpointSnapper`**：端点への吸い付きの照会と、描き足し・結合・閉じる操作・続けて引く線の点を打つ・最後の点を消す・終える操作のモデルへの反映（規則は`EndpointSnapRules`・`PathJoinRules`）。importはこの2つのみ。DOM・図形種別の分岐・図形固有のプロパティ名・操作モードを知らない。`main.js`が生成して`InputTracker`の第5引数へ注入する（`InputTracker`は注入されたものを呼ぶだけで、図形種別を知らない）。`isDrawingLine`は「線を引いている途中か」の判定で、図形種別の文字列を比べない。クリックの判定の順（`clickDrawnLine`）：1. 始点への吸い付きで閉じられる → 閉じて終える、2. 付いてくる線の先が最後の点と重なる → 開いたまま終える、3. 端点への吸い付き → つながって終える、4. それ以外 → 点を打つ（記録しない）。終えるたびに1件の記録（吸い付きなし＝`replaceDraft` → `beginEdit` → `commitDraft` → `commitEdit`）。
*   **`core/ShapeFactory`**：図形種別一覧の正本（対応表`SHAPE_REGISTRY`）と、種別に応じたインスタンス生成（`create`）・図形データからの復元の振り分け（`fromJSON`）。`core/`層で図形種別の対応づけを許容する唯一の例外。対応づけは対応表の表引きのみで、if/switch分岐を持たない。`shapes/`のみをimportする。`SHAPE_TYPES`は`create`が`null`でないエントリから導出（並び＝ツールパレットのボタン順＝数字キーの割り当て順）。`path`は`create: null`の読み込み専用。`ShapeFactory.create`の`js/`内の呼び出し元は`VectorModel.startDraft`だけ。
*   **`core/VectorModel`**：図形一式・選択集合・頂点の選択・ホバー・作成中の図形・選択矩形・吸い付きの表示の点・新しく描く図形のスタイルのSSOT。図形固有の頂点構造・プロパティ名を知らない。作成途中の図形を作る・置き換えるのは`startDraft`（`ShapeFactory.create`の直後に直前に使った値を当てる）と`replaceDraft`（呼び出し元は`edit/EndpointSnapper`のみ）だけ。
*   **`core/InputTracker`**：入力の解釈とModel・ビュー変換への反映。図形種別を知らない（if/switch分岐を一切行わない）。線を引いている途中かは注入された補助の`isDrawingLine()`（＋`InputState.DRAWING`）で決め、線を引く手順（`findDrawnLineSnap`・`getDrawnLineLastPoint`・`clickDrawnLine`・`finishDrawnLine`・`removeDrawnLinePoint`）を呼ぶだけ。描き始めの吸い付きは`findDrawSnap(this.currentShapeType, …)`（図形種別は不透明な値として渡すだけ）。状態の所有者の再分離はしない（1729行。`_doc/COWORK_STATUS.md`の注意）。
*   **`main.js`**：インスタンス化・依存の注入・イベントバインド。判定・計算のロジックを持たない。ツールの切り替え（`selectModeTool`・`selectShapeTool`・`startEyedropper`）は先に`inputTracker.finishLineDrawing()`を呼ぶ。`performUndo`は(1)ドラッグ中は不受理 →(2)`removeLastLinePoint()`が真なら終了 →(3)`abortOngoingOperation()`で作成途中の図形を破棄したら終了 →(4)履歴の取り消し。
*   **`core/KeyboardShortcuts`**：キー→操作の対応表（`SHORTCUT_BINDINGS`）と受理判定のみ。操作の実体は`main.js`から注入されたコールバック（typedef`ShortcutActions`が契約の正本）。対応表は変えない。
*   **`io/SpriteSerializer`**：書き出し形式の定義（識別子・版`SPRITE_FORMAT_VERSION`＝唯一の定義箇所・`DEFAULT_STROKE_WIDTH`）と、図形一式からの組み立て（描画要素・外枠・`source`）・JSON文字列化・`checkFormat`（版1以上・現行版以下の整数を受理）。DOM・図形種別の分岐・図形固有のプロパティ名を知らない（`toDrawElement`をポリモーフィックに呼ぶだけ。知っているのは描画要素の`kind`の語彙と形の項目名）。importは`DocumentSerializer`のみ。外枠で未知の`kind`は`Error`。`kind`を足す手順：①図形の`toDrawElement` ②`SpriteSerializer`の形の範囲の表 ③`CodeExporter`の描画処理 ④テスト ⑤版の判断。外枠の求め方：描画要素ごとの形の範囲（中心線の外接矩形）を、`strokeColor`が文字列の要素だけ線の太さの半分（不正なら2pxの半分）広げ、全要素の和。曲線は端点と各軸の極値（制御点は含めない）。図形0個は`null`。`computeShapesBounds`（`edit/ShapeExtentReader`が使う。整列・分布・位置の数値入力・ステータスバー・全体を画面に収めるの外枠）は`serialize(shapes).bounds`と同じ値。
*   **`io/CodeExporter`**：スプライトJSのテキストの組み立て（`toModuleText`）と実行しない取り出し（`extractSpriteDataText`）。importは`SpriteSerializer`のみ。`DRAW_SOURCE`の`drawElement`は読む側の規則（塗るのは`fillColor`が文字列で`closed === true`の塗れる`kind`の要素だけ、形のパス → 塗り → 線、塗りも線もない要素はパスも組み立てない、形の項目が足りない要素・未知の`kind`は描かない、`strokeWidth`が正の有限の数値でなければ2px）を持ち、各図形の`draw`と命令・引数・順序が一致する。`DRAW_SOURCE`の中で`import`・テンプレート文字列・外部の名前を使わない。
*   **書き出し形式の約束（2章）**：エンジンは既定のexportの`draw(ctx)`だけを読む。書き出し形式の版は、エンジンが読む部分（`format`・`formatVersion`・`bounds`・`elements`の形と意味、JSのexportの形）が変わったとき（古い読み手が未知の項目として無視すると正しく描けなくなる場合を含む）に上げる。版を上げるときはエンジンへ連絡票を出す（**本作業では出さない。Phase 09-04**）。作業データの版は`DocumentSerializer`の`MIGRATIONS`へ関数を足すときに上げる（本作業では上げない）。エディタの「開く」「インポート」は`FileContentReader.deserializeFromText`を通り、スプライトのJSは`checkFormat`で判別して`source`だけを使う。確認用ページ（`check/`）は`SpriteSerializer.checkFormat`だけを`io/`から使い、選んだJSの`draw`で描く。`asset/sprite/`は本アプリの書き出しの生成物で手で書き換えない（版2）。
*   **テストの規則（`_doc/arch/16_test.md`）**：`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。`node:test`・`node:assert/strict`のみ。先頭行に単一責務のJSDoc（3行以内）、補助関数にもJSDoc。公開APIのみを通し、テストのためにソースを書き換えない。`InputTracker`・`main.js`・`CanvasManager`はテストを置かない。
*   **憲法**：すべての`.js`の先頭に単一責務のJSDoc（3行以内）。責務を逸脱するロジックを足さない。クラス・関数・メソッド・データ構造にJSDoc。`CanvasManager`に状態を持たせない。グローバル変数・外部ライブラリ・ビルドツールを足さない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（資料本体への反映は最終タスクで行う。各タスクで判明したことはここへ追記する）
*   **1章**：
    *   フォルダ構造：新しいファイルは無い。`shapes/`の行のコメント（`PathJoinRules`＝結合と、続けて引く線の点の並び）は、直線・曲線のツールの両方であることが分かる書き方にする。
    *   「存在しないもの」：「直線のツールの連続引きでの曲線の連続作成（曲線のパスのPhase）」を外し（本作業で曲線のツールとして実装）、本作業の「今回やらないこと」を足す：曲線のパスの結合・描き足し・端点への吸い付き・曲線のツールでの既存の線とのつながり（Phase 09-01b）、区間の直線⇔曲線の切り替え（Phase 09-02。既にある「区間の直線／曲線の切り替え」と1つにまとめる）、今の曲線・弧の結合と曲線の区間としての取り込み（09-03）、エンジンでの確認と連絡票（09-04）、方向のハンドル・区間をクリックして選ぶ仕組み・引きながらの直線と曲線の切り替え。「曲線の作成時の制御点の丸め」は今の曲線のツールの記述のため、「今の曲線（`curve`）は作られなくなった」ことが分かる書き方へ。「弧・曲線・直線・開いたパスの塗り」の「曲線」は今の曲線を指すことが分かる書き方へ（開いた曲線のパスも塗らない）。
    *   フォルダ分割の方針の`shapes/`：`ShapeGeometry`に3次ベジェの点と点を通るなめらかな曲線の区間の制御点（形の決め方の式の唯一の箇所）が加わったこと、`PathJoinRules`が「結合できる線」（直線・区間がすべて直線の開いたパス）と「続けて引く線の形」を区別することを足す。
*   **2章**：
    *   `path`：区間の種類に`'smooth'`（曲線の区間）を足し、形の決め方の式（要件Aの式・連なりの定義・仮の点・閉じたパスの一周・1次式であること・連なりの区間が1つなら直線と同じ形・直線とのつなぎ目は角が立つ・式の性質として膨らむことがある）と、制御点を作業データに持たないこと、作られる操作（曲線のツールで点を3つ以上打って終えたとき。開いた／閉じた）を書く。作業データの版は上げていない（古いエディタでは未知の区間の種類として図形単位でスキップ）。「`kind`は現在`'line'`のみ」を改める。
    *   書き出し形式：版を3にした（`bezierPath`の追加。理由）。描画要素に`"bezierPath"`（形・キー順・区間の`line`/`cubic`・描き方・閉じる区間が`line`なら`lineTo`なしで`closePath`）を足し、`"polyline"`の「`path`」を「区間がすべて直線の`path`」へ。読む側の規則：塗るのは`polyline`・`ellipse`・`bezierPath`で`closed === true`、形の項目が足りない`bezierPath`（要件F）は描かない。外枠：`bezierPath`は全頂点と`cubic`の区間の各軸の極値（制御点は含めない）。「スプライトデータ（書き出し形式の版2）」を版3へ。エンジンとの約束(c)：版3への版上げの連絡票は未送付（Phase 09-04で出す。エンジンは既定のexportの`draw`だけを読むため、版3のJSもエンジンのコードの変更なしで描ける見込み＝09-04で確かめる）。本アプリ自身のツールのアイコン：生成物は版2のまま（`checkFormat`は1〜3を受理）。
*   **3章3.・16.・17.**：「直線のツールで線を引いている途中の付いてくる線の先」（`Shift`の限定・スナップ）を直線・曲線のツールへ。17.の「曲線は始点と終点が単位の倍数」「曲線の制御点（中点）は丸めない」は今の曲線のツールの記述のため改める（曲線のツールは打つ点のそれぞれを丸める。制御点は作業データに無い）。
*   **3章6.（履歴）**：図形の作成の記録に、曲線のツールも直線のツールと同じ（終えるたびに`EndpointSnapper`の中で1件）を足す。取り消しの1b.・2.の「直線のツール」を「直線・曲線のツール」へ。
*   **3章11.（結合）・12.（端点への吸い付き）**：結合できる線＝直線・区間がすべて直線の開いたパス。曲線のパスは結合・描き足し・端点への吸い付きの対象外（判定は`isJoinableLine`の1か所。後半（b）で外す予定）。曲線のツールは既存の線の端点に吸い付かない（描き始めは`isSnapDrawShapeType`、引いている途中は「作成途中の線が結合できる線のときだけ端点を候補にする」）。
*   **3章22.**：表題と冒頭を「直線・曲線のツールで線を続けて引く」へ。曲線のツールの作成途中の線（頂点2つの曲線のパスから始まる）、足す区間の種類は作成途中の線が持つこと、線を引いている途中の判定＝`isDrawnLineShape`（続けて引く線の形）、作り分けは`buildLineOrPath`・作成途中の線の組み立ては`buildDrawnDraft`、点2つで終えたら直線・3つ以上なら曲線のパス・閉じたら全区間曲線、「現場設計セッションが決めた点」の見直しが済んだこと、作業データの版・書き出しの記述（曲線のパスの追加で書き出し形式は版3）を実態に合わせる。用語（曲線の区間・曲線の連なり・曲線のパス・今の曲線）を足す。
*   **`_doc/arch/10_ShapeFactory.md`**：`curve`の`create`が頂点2つ・区間1つの曲線のパスを作り（`type`は`'path'`）、今の曲線は`fromJSON`でのみ作られること・`create(type)`の`type`が`curve`では一致しないこと・置き場所の理由（要件G）。
*   **`_doc/arch/12_shapes.md`**：`ShapeGeometry`の公開に`cubicBezierPoint`・`computeSmoothSegmentControls`（式の唯一の箇所・区間の種類の文字列を知らない）、`ShapeDataValidation`の`isPlainObject`の`export`（`Path`が使う。二重定義の解消）。`Path`：区間の種類・定数の`export`（`SEGMENT_KIND_LINE`・`SEGMENT_KIND_SMOOTH`）・コンストラクタの第6引数・分割数`SMOOTH_SEGMENT_SAMPLE_COUNT`（唯一の定義）・描画／当たり／範囲選択／塗りの内側の分岐の置き場所（非公開の補助）・`toDrawElement`の`bezierPath`・`ShapeFactory.create`でも作られること（「読み込み専用」の記述を改める）・「曲線の区間を足すときは…」の予告の項を実施済みへ。`PathJoinRules`：`isJoinableLine`の変更（曲線のパスを含めない。後半（b）で広げる）・`isDrawnLineShape`・`buildLineOrPath`の第4引数・`buildDrawnDraft`・`classifyJoin`・`buildClosedPath`・`canCloseByMergingEnds`の受け付け条件・importに`SEGMENT_KIND_LINE`。`EndpointSnapRules`：`findDrawnLineSnapTarget`の端点の候補の条件。「置き換えなかった重複」に`SpriteSerializer`の3次ベジェの計算を足すか検討。
*   **`_doc/arch/14_edit.md`**：`EndpointSnapper.isDrawingLine`の判定の置き換え（直線・曲線のツール）。`PathJoiner`：曲線のパスを含む選択は結合できない（コードの変更なし）。
*   **`_doc/arch/15_io.md`**：`SpriteSerializer`の現行の版3・`bezierPath`の範囲・`cubicAxisRange`は`ShapeGeometry`と別の定義。`CodeExporter`の`DRAW_SOURCE`の`bezierPath`・塗りの`kind`。`FileContentReader`は変更なし（版3を受理するのは`checkFormat`の定数による）。
*   **`_doc/arch/17_sprite_check.md`**：版3のスプライトも`checkFormat`で受理され、書き出したJSの`draw`で描かれる（`check/`のコードは変更なし）。
*   **`_doc/arch/06_InputTracker.md`・`02_main.md`・`07_KeyboardShortcuts.md`・`03_VectorModel.md`**：線を引いている途中が直線・曲線のツールに当てはまること（コードの変更なし。JSDocのみ）。行数は変わらない見込み（実装後に確認）。
*   **`_doc/arch/40_asset_sprite.md`**：生成物は版2のまま。現行の書き出し形式は版3になったが、`checkFormat`は版2を受理し、`ToolIconWiring`は`bounds`と`draw`だけを使うため差し替えは不要。
*   **`_doc/arch/16_test.md`**：本作業のテストの追加（ファイルごとの検証範囲）・書き換えた既存のケース（要件Iの3件と、図形の作り方の置き換え4ファイル）・件数（仕上げのタスクで控えた結果）。

## 3. タスクリスト

**タスクの分け方**：下の層（`shapes/`の式・図形・規則）から、手順（`edit/`）、書き出し（`io/`）、最後に曲線のツールの切り替え（`ShapeFactory`）の順に、1タスク＝1ファイル（＋そのテスト）を基本に分ける。タスク1〜7の間は曲線のツールは今の曲線（`Curve`）を作ったままで、曲線のパスは手で書いたファイルを開いたときにしか現れないため、途中の段階でもアプリのふるまいと`node --test`の結果は壊れない（タスク2〜5の後は曲線のパスが描け・選べ・結合の対象外になり、タスク6・7で書き出せるようになる）。タスク8で曲線のツールが切り替わる。タスク9はJSDocの文言だけ。

**全タスク共通の約束**：
*   本計画書の「2. アーキテクチャ設計」の該当の要件と「参照する責務」だけを責務情報源とする。対象ファイル以外を変更しない。改名・整形・不要に見えるコードの削除をしない（例外は要件Bの`isPlainObject`の移動だけ）。既存のテストのケース・期待値・補助関数は、要件Iに挙げたもの以外は変えない（足すだけ）。
*   到達不能な枝（各図形の`drawHandles`・`CanvasManager.render`のハンドルを描く段など）・`Curve`のコードは**残す**。
*   性能の改善を目的とした変更をしない。書き出しの際の座標の丸めをしない。作業データ形式の版を上げない。

*   [x] タスク1: 要件A 形の決め方の式（`shapes/ShapeGeometry`）
    *   **対象ファイル** :
        *   `./js/shapes/ShapeGeometry.js` :（更新。`cubicBezierPoint`・`computeSmoothSegmentControls`の追加と、先頭の責務定義の更新のみ）
        *   `./test/shapes/ShapeGeometry.test.js` :（更新。`describe`の追加と、必要なimportの追加のみ）
    *   **作業内容** :
        *   要件Aのとおり2関数を`quadraticBezierPoint`の後ろに足す。式は要件Aの文面のとおりに実装し（前の区間・次の区間の決め方、仮の点、`control1`・`control2`の式）、別の式にしない。各関数にJSDoc（責務・式・引数の約束（`smoothFlags`の要素数・区間`i`の両端）・戻り値・1次式であること・連なりの区間が1つなら直線と同じ形・引数を書き換えず新しいオブジェクトを返すこと・例外を投げないこと）を書く。importを足さない（区間の種類の文字列を知らない）。
        *   既存の4関数を変えない。ファイル先頭の責務定義（3行以内）を要件Aのとおりに更新する。
        *   `test/shapes/ShapeGeometry.test.js`へ要件Aのテストの観点(1)〜(7)を確かめる`describe`を足す（既存のケースは変えない。新しい補助関数にはJSDoc）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク2: 要件B パスの曲線の区間（`shapes/Path`・`shapes/ShapeDataValidation`）
    *   **対象ファイル** :
        *   `./js/shapes/Path.js` :（更新）
        *   `./js/shapes/ShapeDataValidation.js` :（更新。`isPlainObject`への`export`の付与とJSDocへの追記のみ）
        *   `./test/shapes/Path.test.js` :（更新。`describe`の追加、要件Iの2.のエラー文の期待値3件の書き換え、`makeRecordingCtx`の命令の名前への`'bezierCurveTo'`の追加、必要なimportの追加のみ）
    *   **作業内容** :
        *   要件Bのとおり、定数の`export`（`SEGMENT_KIND_LINE`は名前を変えずに`export`を付ける）・`SEGMENT_KIND_SMOOTH`・`ACCEPTED_SEGMENT_KINDS`・`SMOOTH_SEGMENT_SAMPLE_COUNT`、コンストラクタの第6引数、`ShapeGeometry`の`computeSmoothSegmentControls`・`cubicBezierPoint`のimport、`isPlainObject`の`ShapeDataValidation`からのimport（`Path.js`の同じ関数は消す）、非公開の`#segmentControls`・`#fillPolygon`、`#tracePath`・`#someSegment`・`hitTestFill`・`toDrawElement`の広げ方を実装する。**区間がすべて直線のパスの描画命令・当たり判定の呼び出し・`toDrawElement`の戻り値・`fromJSON`のふるまいが今と同じ**であること（既存のケースが通ること）を守る。
        *   要件Bの「変えないもの」を変えない。共通メソッド契約のメソッドを増やさない。
        *   ファイル先頭の責務定義（3行以内）・クラスのJSDoc・変更したメソッド・新しい定数・非公開の補助のJSDocを要件Bのとおりに書く。`ShapeDataValidation.js`は`isPlainObject`の`export`とJSDocへの追記だけ（中身・先頭の責務定義・ほかの関数は変えない）。
        *   `test/shapes/Path.test.js`へ要件Bのテストの観点を確かめる`describe`を足し、要件Iの2.の3件の期待値を書き換える（ほかの既存のケースは変えない）。
        *   JSDocコメントの記載漏れがないことを確認する。使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（`CodeExporter`・`SpriteSerializer`・`DocumentSerializer`の既存のテストがそのまま通ること）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク3: 要件C 結合できる線と、続けて引く線の点の並び（`shapes/PathJoinRules`）
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` :（更新）
        *   `./test/shapes/PathJoinRules.test.js` :（更新。`describe`の追加と、必要なimportの追加のみ）
    *   **作業内容** :
        *   要件Cのとおり、importへ`SEGMENT_KIND_LINE`を足し、`isJoinableLine`を改め、`classifyJoin`（図形1つの枝）・`buildClosedPath`・`canCloseByMergingEnds`を`isJoinableLine`に従わせ、`isDrawnLineShape`（`export`）・非公開の`drawnSegmentKind`・`buildDrawnDraft`を足し、`buildLineOrPath`に第4引数を足し、作成途中の線の規則の6関数の受け付け条件と組み立てを改める。**直線とパスの作り分けは`buildLineOrPath`の1か所のまま**にする（`buildDrawnDraft`は直線の区間のとき`buildLineOrPath`へ任せる）。
        *   要件Cの「変えないもの」を変えない。今の図形（直線・直線の区間だけのパス・閉じたパス・今の曲線・矩形・円・弧）に対する全関数の結果を変えない。
        *   ファイル先頭の責務定義（3行以内）と、変更・追加した関数のJSDocを要件Cのとおりに書く。
        *   `test/shapes/PathJoinRules.test.js`へ要件Cのテストの観点を確かめる`describe`を足す（既存のケース・補助関数は変えない。曲線のパスは`new Path(…, SEGMENT_KIND_SMOOTH)`か`Path.fromJSON`で作る。新しい補助関数にはJSDoc）。
        *   JSDocコメントの記載漏れがないことを確認する。使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（既存の`PathJoinRules`・`EndpointSnapRules`・`EndpointSnapper`・`PathJoiner`のテストがそのまま通ること）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク4: 要件D 曲線のツールは既存の線の端点に吸い付かない（`shapes/EndpointSnapRules`）
    *   **対象ファイル** :
        *   `./js/shapes/EndpointSnapRules.js` :（更新。`findDrawnLineSnapTarget`の端点の候補の条件と、JSDocの更新のみ）
        *   `./test/shapes/EndpointSnapRules.test.js` :（更新。`describe`の追加と、必要なimportの追加のみ）
    *   **作業内容** :
        *   要件Dのとおり、`findDrawnLineSnapTarget`で作成途中の線が結合できる線（`isJoinableLine(drawn)`）のときだけ既存の線の端点を候補にする。`findSnapTarget`・`findNearestEndpoint`・`resolveEndpointHandle`・`isSnapDrawShapeType`・`isDrawnStartSnap`のコードと、import・定数・typedefは変えない。
        *   要件DのとおりJSDocを改める（ファイル先頭の責務定義は変えない）。
        *   `test/shapes/EndpointSnapRules.test.js`へ要件Dのテストの観点を確かめる`describe`を足す（既存のケースは変えない）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク5: 要件E 線を引いている途中かの判定（`edit/EndpointSnapper`。`PathJoiner`はテストのみ）
    *   **対象ファイル** :
        *   `./js/edit/EndpointSnapper.js` :（更新。`isDrawingLine`の判定とimportの置き換え、JSDocの更新のみ）
        *   `./test/edit/EndpointSnapper.test.js` :（更新。テストの追加と、必要なimport・新しい補助関数の追加のみ）
        *   `./test/edit/PathJoiner.test.js` :（更新。テストの追加と、必要なimportの追加のみ）
    *   **作業内容** :
        *   要件Eのとおり、`isDrawingLine`を`isDrawnLineShape`で判定する（ほかのメソッド・コンストラクタ・フィールドのコードは変えない）。使わなくなった`isJoinableLine`のimportは取り除く。
        *   ファイル先頭の責務定義（3行以内）・クラスのJSDoc・`isDrawingLine`ほかのJSDocの「直線のツール」を、曲線のツールにも当てはまる部分だけ「直線・曲線のツール」へ実態に合わせる（端点への吸い付き・描き足し・つながりは直線のツールだけのまま）。
        *   `test/edit/EndpointSnapper.test.js`・`test/edit/PathJoiner.test.js`へ要件Eのテストの観点を確かめるテストを足す（既存のケース・`setupFake`・`setupReal`等の補助関数は変えない）。`js/edit/PathJoiner.js`は変えない。
        *   JSDocコメントの記載漏れがないことを確認する。使われなくなった`import`が残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク6: 要件F（前半） 書き出し形式の版3と`bezierPath`の外枠（`io/SpriteSerializer`）
    *   **対象ファイル** :
        *   `./js/io/SpriteSerializer.js` :（更新）
        *   `./test/io/SpriteSerializer.test.js` :（更新。`describe`の追加、要件Iの3.の期待値1件の書き換え、必要なimportの追加のみ）
    *   **作業内容** :
        *   要件Fのとおり、`SPRITE_FORMAT_VERSION`を3にし、非公開の`cubicAxisRange`・`bezierPathRange`と`SHAPE_RANGE_BY_KIND`の項目を足し、typedef・定数・関連するJSDocを実態に合わせる（版3・`bezierPath`の形・3次ベジェの計算が`ShapeGeometry`と別の定義であること）。要件Fの「変えないもの」を変えない。
        *   `test/io/SpriteSerializer.test.js`へ要件Fのテストの観点を確かめる`describe`を足し、要件Iの3.の1件を書き換える（ほかの既存のケースは変えない）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（`FileContentReader`・`CodeExporter`・`check/SpriteCheckInspector`・`CanvasFileOperations`の既存のテストがそのまま通ること）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク7: 要件F（後半） 書き出したJSの描画処理（`io/CodeExporter`）と読み込みの確認
    *   **対象ファイル** :
        *   `./js/io/CodeExporter.js` :（更新。`DRAW_SOURCE`の`bezierPath`の枝・塗りの条件・関連するJSDocのみ）
        *   `./test/io/CodeExporter.test.js` :（更新。`describe`の追加、`createRecordingCtx`の命令の名前への`'bezierCurveTo'`の追加、必要なimportの追加のみ）
        *   `./test/io/FileContentReader.test.js` :（更新。`describe`の追加と、必要なimport・新しい補助関数の追加のみ）
    *   **作業内容** :
        *   要件Fのとおり、`DRAW_SOURCE`へ`case 'bezierPath'`（形の項目の確認をパスの組み立ての前に行う・閉じる区間が`'line'`なら`lineTo`なし）を足し、塗りの条件に`bezierPath`を加える。エディタの`Path.draw`と命令・引数・順序を一致させる。`HEADER_COMMENT`・宣言の行の形・`toModuleText`・`extractSpriteDataText`は変えない。`DRAW_SOURCE`の中でテンプレート文字列・`import`・外部の名前を使わない。
        *   `js/io/FileContentReader.js`・`js/check/`・`sprite-check.html`のコードを読み、版3のJSが「開く」「インポート」と確認用ページで受理されること（版の値の直書きが無いこと）を確かめる（変更しない。直書きがあれば作業を止め、「5. 懸念事項」に書いて報告する）。
        *   `test/io/CodeExporter.test.js`・`test/io/FileContentReader.test.js`へ要件Fのテストの観点を確かめる`describe`を足す（既存のケースは変えない）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（`CodeExporter.assembly.test.js`を含む既存のテストがそのまま通ること）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク8: 要件G 曲線のツールの作成途中の図形（`core/ShapeFactory`）と既存のテストの図形の作り方
    *   **対象ファイル** :
        *   `./js/core/ShapeFactory.js` :（更新。`curve`のエントリの`create`・importへの`SEGMENT_KIND_SMOOTH`の追加・JSDocのみ）
        *   `./test/core/ShapeFactory.test.js` :（更新。要件Iの1.の書き換えと、テストの追加のみ）
        *   `./test/io/DocumentSerializer.roundtrip.test.js` :（更新。要件Iの図形の作り方の置き換えと、曲線のパスの往復の`describe`の追加、必要なimportの追加のみ）
        *   `./test/io/DocumentSerializer.errors.test.js` :（更新。要件Iの図形の作り方の置き換えと、必要なimportの追加のみ）
        *   `./test/edit/CanvasFileOperations.test.js` :（更新。要件Iの図形の作り方の置き換えと、必要なimportの追加のみ）
    *   **作業内容** :
        *   要件Gのとおり`curve`のエントリの`create`を改め、JSDocを実態に合わせる（ほかのエントリ・`SHAPE_TYPES`・並び・メソッドのコード・先頭の責務定義は変えない）。`js/core/VectorModel.js`・`InputTracker.js`・`main.js`のコードは変えない。
        *   要件Iのとおり、`test/core/ShapeFactory.test.js`の1件を書き換え（＋`fromJSON`の`curve`のケースが無ければ追加）、`ShapeFactory.create('curve', …)`を今の曲線を作る手段として使っている既存のテストの箇所を同じ引数の`new Curve(…)`へ置き換える（期待値は変えない）。`test/io/DocumentSerializer.roundtrip.test.js`へ曲線のパスの往復（要件I）の`describe`を足す。**上記以外に失敗する既存のケースが出たら、期待値を変えずに作業を止めて報告する**。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク9: 要件H 意味が広がったJSDocの文言（`core/InputTracker`・`main.js`・`core/KeyboardShortcuts`・`core/VectorModel`。コードは変えない）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新。JSDoc・コメントのみ）
        *   `./js/main.js` :（更新。JSDoc・コメントのみ）
        *   `./js/core/KeyboardShortcuts.js` :（更新。typedef`ShortcutActions`のJSDocのみ）
        *   `./js/core/VectorModel.js` :（更新。JSDocのみ）
    *   **作業内容** :
        *   要件Hのとおり、各ファイルの「直線のツール」の記述のうち曲線のツールにも当てはまるものを「直線・曲線のツール」へ直す（`grep "直線のツール"`で洗い出し、1件ずつ当てはまるかを判断する。直線のツールだけの事柄はそのまま）。**コード・対応表・関数名・importを変えない**。ファイル先頭の責務定義は3行以内のまま。できるだけ行数を変えない。
        *   `git diff`で、4ファイルの変更がコメント（JSDoc・行コメント）の中だけであることを確かめる。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない。`InputTracker.js`・`main.js`の変更後の行数を控える）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク10: 仕上げの確認（JSDoc・不要なコード・全テスト・スコープ）
    *   **対象ファイル** :
        *   （原則として変更なし。漏れが見つかった場合のみ、タスク1〜9で触れたファイルを直す）
    *   **作業内容** :
        *   タスク1〜9で更新した全ファイルについて、ファイル先頭の責務定義（3行以内）と、クラス・関数・メソッド・typedef・定数のJSDoc（責務・`@param`・`@returns`）の記載漏れがないこと、意味が広がった既存の公開メソッド・関数（`Path`のコンストラクタ・`toDrawElement`・`fromJSON`・`hitTestFill`・`updateDraftEnd`、`isJoinableLine`・`classifyJoin`・`buildClosedPath`・`canCloseByMergingEnds`・作成途中の線の規則の6関数、`findDrawnLineSnapTarget`、`EndpointSnapper.isDrawingLine`、`ShapeFactory.create`、`SpriteSerializer.checkFormat`・`serialize`）のJSDocが実態に合っていることを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（`Curve`・到達不能な枝は**残す**）。
        *   `git status`・`git diff --stat`で、変更したファイルが本計画書の対象ファイルだけであること（`js/shapes/ShapeGeometry.js`・`ShapeDataValidation.js`・`Path.js`・`PathJoinRules.js`・`EndpointSnapRules.js`、`js/edit/EndpointSnapper.js`、`js/io/SpriteSerializer.js`・`CodeExporter.js`、`js/core/ShapeFactory.js`、JSDocのみの`js/core/InputTracker.js`・`KeyboardShortcuts.js`・`VectorModel.js`・`js/main.js`、要件Iのテストファイルと本RES）を確認する。`index.html`・`sprite-check.html`・`js/check/`・`js/palette/`・`js/wiring/`・`asset/`・`js/shapes/Curve.js`・`Line.js`・`Rect.js`・`Ellipse.js`・`js/core/CanvasManager.js`・`js/io/DocumentSerializer.js`・`FileContentReader.js`・`js/edit/PathJoiner.js`が**変わっていないこと**。
        *   既存のテストの変更が、要件Iに挙げた期待値の書き換え（3か所）・図形の作り方の置き換え（4ファイル）・記録する偽の`ctx`の命令の名前の追加（2ファイル）と、ケース・`describe`・補助関数・importの**追加だけ**であることを`git diff`で確認する。
        *   作業データ形式の版が2のまま（`DocumentSerializer`を変えていない）、書き出し形式の版が3であることを確認する。`InputTracker`・`VectorModel`・`main.js`のコードの差分が無い（コメントのみ）ことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ること（`fail 0`）を確認し、`tests`・`suites`・`pass`の件数を控える（本作業前は tests 1634 / suites 250）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク11: 要件J テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   `./_log/res/261118_1937_RES_Phase09-01a_Curve_Tool.md` :（更新。詳細作業内容への記載のみ）
    *   **作業内容** :
        *   本計画書の「要件J」の0〜14を、**実装後のコードで裏取りしたうえで**、画面・操作・挙動の言葉で発注者へ提示する（とくに1.の付いてくる曲線、3.の始点への吸い付きの見た目と閉じた後のなめらかさ、7.の同じツールの選び直し、13.の除外の範囲は、`InputTracker`・`EndpointSnapper`・`PathJoinRules`・`EndpointSnapRules`・`main.js`の実コードで確かめてから書く）。
        *   自動テストで確かめられない箇所（要件Jの末尾）を、特に確かめてほしい項目として添える。本計画書の「5. 懸念事項」のうち発注者に目視で確かめてほしい点も添える。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ提示した内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク12: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/02_main.md`・`03_VectorModel.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`・`10_ShapeFactory.md`・`12_shapes.md`・`14_edit.md`・`15_io.md`・`16_test.md`・`17_sprite_check.md`・`40_asset_sprite.md` :（更新）
    *   **作業内容** :
        *   本計画書の『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄の全項目（各タスクでの追記を含む）を確認し、資料へ反映する。とくに1章（「存在しないもの」・フォルダ分割の方針の`shapes/`）、2章（`path`の区間の種類`'smooth'`と形の決め方の式、書き出し形式の版3・`bezierPath`・読む側の規則・外枠・エンジンへの連絡票が未送付であること・ツールのアイコンの生成物は版2のまま）、3章22.（曲線のツールにも当てはまること・線を引いている途中かの判定）、3章11.・12.（曲線のパスが結合・吸い付きの対象外であること。後半（b）で外す予定であること）、3章3.・6.・16.・17.の「直線のツール」の記述を実態に合わせる。
        *   `_doc/arch/`の各ファイルを更新予定欄のとおりに直す。`16_test.md`には本作業のテストの追加・書き換えた既存のケース・件数（タスク10で控えた結果）を書く。4章の一覧の表に新しい行が増えない（新しいモジュールは無い）ことを確認する。
        *   記載基準に従う（1つのファイルのJSDocを読めば分かることは書かない。責務・境界・依存方向・流れと順序・誰が呼ぶか・設計判断の理由・やらないと決めたことを残す）。実コードと食い違う記述を作らない。
        *   **本タスクは開発資料の書き換えが明示的に許された唯一のタスク**であり、後続タスクは無い。ソースコード（`js/`・`test/`・`index.html`）は変更しない。`_doc/`の`arch/`以外（`COWORK_STATUS.md`等）は変更しない。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

---

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件A 形の決め方の式（`shapes/ShapeGeometry`）
*   **作業内容** :
    *   `js/shapes/ShapeGeometry.js`に`cubicBezierPoint`・`computeSmoothSegmentControls`を追加（既存4関数は不変）。先頭の責務定義に3次ベジェの点・曲線の区間の制御点を追記。JSDocに式・性質を記載。
    *   `test/shapes/ShapeGeometry.test.js`に`cubicBezierPoint`・`computeSmoothSegmentControls`のdescribeを追加（観点(1)〜(7)）。同ファイル単体は20件合格。全体の`node --test`は未実行（オーケストレータ担当）。

### タスク2: 要件B パスの曲線の区間（`shapes/Path`・`shapes/ShapeDataValidation`）
*   **作業内容** :
    *   `js/shapes/Path.js`：`SEGMENT_KIND_LINE`を`export`、`SEGMENT_KIND_SMOOTH`を追加、`SMOOTH_SEGMENT_SAMPLE_COUNT = 100`、`ACCEPTED_SEGMENT_KINDS`に`smooth`を追加。コンストラクタ第6引数`segmentKind`。非公開の`#segmentControls`・`#fillPolygon`を追加し、`#tracePath`・`#someSegment`・`hitTestFill`・`toDrawElement`（`polyline`／`bezierPath`）を拡張。`isPlainObject`の二重定義を消し`ShapeDataValidation`からimport。JSDoc更新。
    *   `js/shapes/ShapeDataValidation.js`：`isPlainObject`に`export`とJSDocの追記のみ。
    *   `test/shapes/Path.test.js`：importと`makeRecordingCtx`の命令名に`bezierCurveTo`を追加、エラー文3件を`'line'・'smooth'`へ、曲線の区間の`describe`を5つ（コンストラクタ・定数／描画命令／当たり判定・範囲選択／toDrawElement／toJSON・fromJSON）・`it`を14件追加。全体の`node --test`は tests 1658 / pass 1658 / fail 0。
    *   懸念：`Path.test.js`先頭の責務JSDocは更新していない（スコープ外の整形を避けた）。

### タスク3: 要件C 結合できる線と、続けて引く線の点の並び（`shapes/PathJoinRules`）
*   **作業内容** :
    *   `js/shapes/PathJoinRules.js`：importへ`SEGMENT_KIND_LINE`を追加。`isDrawnLineShape`（`export`）を新設し、`isJoinableLine`は**追加仕様に従い`isDrawnLineShape(shape)`が真、かつ（パスなら）`segments`がすべて`SEGMENT_KIND_LINE`**として定義（「直線、または閉じていないパス」の条件は`isDrawnLineShape`1か所。JSDocに「結合できる線は続けて引く線の形のうち区間がすべて直線のもの」を記載）。`classifyJoin`（1本の枝）・`buildClosedPath`・`canCloseByMergingEnds`を`isJoinableLine`に従わせた。非公開`drawnSegmentKind`・`buildDrawnDraft`を追加、`buildLineOrPath`に第4引数`segmentKind`を追加（作り分けは`buildLineOrPath`の1か所のまま）。作成途中の線の規則の6関数の受け付け条件を`isDrawnLineShape`へ、`addDrawnPoint`・`removeLastDrawnPoint`は`buildDrawnDraft`、`buildFinishedDrawnLine`は`buildLineOrPath(…, drawnSegmentKind(data))`で組み立てるよう変更。先頭の責務定義・関連JSDocを更新。
    *   `test/shapes/PathJoinRules.test.js`：`isDrawnLineShape`のimportと、曲線のパス・続けて引く線の形・結合の対象外・曲線のパスの作成途中の線の`describe`を追加（補助関数`makeKindPath`・`makeMixedPath`）。既存のケースは不変。`node --test`は tests 1674 / pass 1674 / fail 0。
    *   開発資料への影響：`PathJoinRules`の責務・公開関数（`isDrawnLineShape`の追加、`isJoinableLine`の意味の変更）の記載に影響（資料本体は未修正。タスク12で反映）。

### タスク4: 要件D 曲線のツールは既存の線の端点に吸い付かない（`shapes/EndpointSnapRules`）
*   **作業内容** :
    *   `js/shapes/EndpointSnapRules.js`：`findDrawnLineSnapTarget`で`isJoinableLine(drawn)`が偽のとき端点の走査をせず`{target: null, distance: Infinity}`として扱う（始点の候補の条件・同距離の優先は不変）。JSDocの手順1.に条件を追記、`findSnapTarget`と`resolveEndpointHandle`のJSDocの「結合できる線」を「直線・区間がすべて直線の開いたパス」へ（`resolveEndpointHandle`は結合できない線の列挙に「曲線の区間を含むパス」も追加）。他の関数・import・定数・先頭の責務定義は不変。
    *   `test/shapes/EndpointSnapRules.test.js`：`SEGMENT_KIND_SMOOTH`のimportと、曲線のパス・曲線のツールの作成途中の線の`describe`（5件、補助関数`makeSmoothPath`）を追加。既存のケースは不変。`node --test`は tests 1679 / pass 1679 / fail 0。
    *   開発資料への影響：`EndpointSnapRules`の`findDrawnLineSnapTarget`の条件（曲線のツールの作成途中の線は端点に吸い付かない）の記載に影響（資料本体は未修正。タスク12で反映）。

### タスク5: 要件E 線を引いている途中かの判定（`edit/EndpointSnapper`。`PathJoiner`はテストのみ）
*   **作業内容** :
    *   `js/edit/EndpointSnapper.js`：importの`isJoinableLine`を`isDrawnLineShape`へ置き換え、`isDrawingLine`の判定を`isDrawnLineShape(drawn)`へ。`isDrawingLine`のJSDocを要件Eの文言へ、先頭の責務定義の「直線のツールで続けて引く線」を「直線・曲線のツールで…」へ。他のメソッド・コンストラクタ・フィールドのコードは不変。`isJoinableLine`はほかに使っておらずimportから除去済み。
    *   `test/edit/EndpointSnapper.test.js`：`SEGMENT_KIND_SMOOTH`のimportと補助関数（`makeSmoothDraft`・`startSmoothDraft`）、曲線のツールの作成途中の線のテスト7件（`isDrawingLine`、点を打つ、点2つで終える→line、点3つ→開いた曲線のパス、始点で閉じる、`removeDrawnLinePoint`、`findDrawnLineSnap`が端点を返さない）を追加。既存は不変。
    *   `test/edit/PathJoiner.test.js`：`SEGMENT_KIND_SMOOTH`のimportと、曲線のパスを含む選択は`canJoin`が偽・`join`が何もしない・記録しないテスト1件を追加。`js/edit/PathJoiner.js`は不変。
    *   `node --test`は tests 1687 / pass 1687 / fail 0。
    *   開発資料への影響：`EndpointSnapper.isDrawingLine`の判定（`isDrawnLineShape`）の記載に影響（資料本体は未修正。タスク12で反映）。

### タスク6: 要件F（前半） 書き出し形式の版3と`bezierPath`の外枠（`io/SpriteSerializer`）
*   **作業内容** :
    *   `js/io/SpriteSerializer.js`：`SPRITE_FORMAT_VERSION`を3へ（版を上げる理由をJSDocへ）。非公開`cubicAxisRange`・`bezierPathRange`と`SHAPE_RANGE_BY_KIND`の`bezierPath`項目を追加（`cubicAxisRange`は`ShapeGeometry.cubicBezierPoint`と別の定義であることをJSDocに明記）。typedef`DrawElement`・`SpriteData`のJSDocへ`bezierPath`（キー列・区間の形）と版3を記載。`serialize`・`computeShapesBounds`・`stringify`・`checkFormat`の中身は不変。
    *   `test/io/SpriteSerializer.test.js`：`formatVersion`の期待値2→3の書き換え1件、`SEGMENT_KIND_SMOOTH`・`cubicBezierPoint`のimportと補助関数2つ、`describe('SpriteSerializer: 版3・bezierPath')`（7件）を追加。`node --test`は tests 1694 / pass 1694 / fail 0。
    *   開発資料への影響：`SpriteSerializer`の版3・`bezierPath`の範囲・`cubicAxisRange`の記載に影響（資料本体は未修正。タスク12で反映）。

### タスク7: 要件F（後半） 書き出したJSの描画処理（`io/CodeExporter`）と読み込みの確認
*   **作業内容** :
    *   `js/io/CodeExporter.js`：`DRAW_SOURCE`へ`case 'bezierPath'`（形の項目＝点2つ以上・`segments`の要素数・各区間の`kind`・`cubic`の`control1`/`control2`の確認をパス組み立ての前に行い、足りなければ`return`。`beginPath`→`moveTo`→区間ごとに`bezierCurveTo`／`lineTo`（閉じた要素の最後の区間が`line`なら`lineTo`なし）→`closed`なら`closePath`）を追加。塗りの条件に`bezierPath`を追加し、`drawElement`のJSDocの塗りの規則を更新。`HEADER_COMMENT`・宣言の行・`toModuleText`・`extractSpriteDataText`は不変。
    *   読み込みの確認：`js/io/FileContentReader.js`・`js/check/`・`sprite-check.html`に版の値（`formatVersion`の数値）の直書きは無く、版は`SpriteSerializer.checkFormat`の定数による（変更なし）。
    *   `test/io/CodeExporter.test.js`：`createRecordingCtx`の命令名へ`bezierCurveTo`、importへ`SEGMENT_KIND_SMOOTH`を追加。`describe`を2つ追加（曲線のパスの見た目の一致8件、手で組み立てた`bezierPath`の規則3件）。`test/io/FileContentReader.test.js`：版3の曲線のパスを含むJS（LF・CRLF）が読み込めるテスト1件と、`formatVersion`を2に書き換えた同じJSも読めるテスト1件の`describe`1つの中に`it`2件を追加。`node --test`は tests 1707 / suites 267 / pass 1707 / fail 0。
    *   開発資料への影響：`CodeExporter`の`DRAW_SOURCE`の`bezierPath`・塗りの`kind`の記載に影響（資料本体は未修正。タスク12で反映）。

### タスク8: 要件G 曲線のツールの作成途中の図形（`core/ShapeFactory`）と既存のテストの図形の作り方
*   **作業内容** :
    *   `js/core/ShapeFactory.js`：importを`{ Path, SEGMENT_KIND_SMOOTH }`へ。`curve`の`create`を頂点2つ・開いた・`SEGMENT_KIND_SMOOTH`のパスへ変更（`fromJSON`・ほかのエントリ・並び・メソッドのコードは不変）。typedefの`create`・`SHAPE_REGISTRY`・`ShapeFactory.create`の`@returns`のJSDocを更新。
    *   `test/core/ShapeFactory.test.js`：type一致のケースを`curve`以外に限定して書き換え、`curve`が開いた`Path`（`type:'path'`・頂点2つ・`segments`が`[{kind:'smooth'}]`）を返すケースと、`fromJSON`が`curve`を`Curve`で復元するケースを追加（`Curve`をimport）。
    *   `test/io/DocumentSerializer.roundtrip.test.js`：`statesFor`の`mk`の`curve`の枝と`makeMixed`・`makeMixedWithPaths`の`curve`を`new Curve(...)`へ置き換え（期待値不変）。`describe('曲線のパスの往復')`（開いた・閉じた・直線と曲線の混在・頂点を動かした・塗り付き×2経路＝10件）を追加（`SEGMENT_KIND_SMOOTH`をimport）。`DocumentSerializer.errors.test.js`・`CanvasFileOperations.test.js`：`curve`を`new Curve(...)`へ置き換え、`Curve`をimport。
    *   `node --test`は tests 1719 / suites 268 / pass 1719 / fail 0。
    *   開発資料への影響：`10_ShapeFactory.md`・`16_test.md`（計画どおり。タスク12で反映）。

### タスク9: 要件H 意味が広がったJSDocの文言（`core/InputTracker`・`main.js`・`core/KeyboardShortcuts`・`core/VectorModel`。コードは変えない）
*   **作業内容** :
    *   `InputTracker.js`（10行）・`KeyboardShortcuts.js`（5行）・`VectorModel.js`（2行）・`main.js`（3行）の JSDoc・コメント中の「直線のツール」を `sed` で「直線・曲線のツール」へ置換（コード・対応表・import 不変。行数不変: InputTracker 1729行・main 1010行）。
    *   `EndpointSnapper.js` は対象外（タスク5で更新済み）。InputTracker の「直線以外では常に表示されない」（描き始めの吸い付き）は直線専用の説明のため変更せず。
    *   `node --test` は tests 1719 / suites 268 / pass 1719 / fail 0。
    *   開発資料への影響：`02_main.md`・`03_VectorModel.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`（JSDoc のみ。行数変化なし。タスク12で反映）。

### タスク10: 仕上げの確認（JSDoc・不要なコード・全テスト・スコープ）
*   **作業内容** :
    *   タスク1〜9の監査で持ち越した軽微指摘を、コメント・テスト名・RESの記述だけで修正（コードのふるまい不変）。
    *   `js/shapes/PathJoinRules.js`：`classifyJoin`のJSDocで「曲線のパス1本は'close'にならない」を本文側へ移し、`toJSON()`の記述を「呼ぶ回数を抑える（パス1本のときは複数回呼ぶ）」に直した。
    *   `test/io/SpriteSerializer.test.js`：3次ベジェの極値テストの名前を実データ（y軸 p0=0,c1=40,c2=40,p3=0）に合わせた。
    *   `js/main.js`：`performUndo`のJSDocを「直線・曲線のツール以外（弧・矩形・円）の作成途中」にした（行数不変）。
    *   本RES 4章タスク7欄（`describe`1つの中に`it`2件）・タスク9欄（置き換えた行数 10・5・2・3）の数え方を実態に合わせた。
    *   `node --test` は tests 1719 / suites 268 / pass 1719 / fail 0。
    *   開発資料への影響：なし（コメント・テスト名のみ）。

### タスク11: 要件J テストプレイの確認項目を発注者へ提示する
*   **作業内容** :
    *   要件Jの0〜14を、`EndpointSnapper`・`EndpointSnapRules`・`PathJoinRules`・`InputTracker`・`main.js`の実コードで裏取りし、下記の文言で提示用に整えた（ソース・テストは変更なし）。**実コードと要件Jの食い違いは見つからなかった。**
    *   裏取りの結果（実コードの根拠）：
        *   1.付いてくる曲線：作成途中の図形は頂点2つ・区間1つ（`'smooth'`）の開いたパス（最後の頂点が付いてくる先）。点1つの間は両側が仮の点なので直線と同じ形。クリックで`addDrawnPoint`が点を足すと、全区間`smooth`の開いたパスになる。`mousemove`は`updateDraft`で最後の頂点だけ動かす（カーソルに追従）が、式は隣の区間の頂点を使うので、最後の区間の1つ前の区間の形も動く。
        *   2.終える：`clickDrawnLine`は付いてくる先が最後の点と重なる（許容`JOIN_TOLERANCE_SCREEN_PX`）と`finishDrawnLine`（開いたまま終える）。打った点2つなら`buildLineOrPath`が`Line`を返す（3つ以上は開いた曲線のパス）。`Esc`も同じ`finishDrawnLine`。打った点が始点だけなら`cancelDraft`で何も残らない。
        *   3.始点への吸い付き：`canCloseDrawnLine`＝打った点（頂点数−1）が3つ以上のときだけ、`findDrawnLineSnapTarget`が始点を候補にする（曲線のツールは`startSnap`が常に`null`）。吸い付くと付いてくる線の先が始点に置かれ、青い正方形が出る＝見た目は「始点へ戻る開いた曲線」（始点のところは仮の点で曲がる）。クリックすると`buildFinishedDrawnLine(drawn, true)`で閉じた曲線のパスになり、全区間が曲線の閉じたパスは1周が1つの連なりなので始点のところもなめらかになる（吸い付き中と閉じた後で始点付近の形が少し変わる）。
        *   4.戻し：`removeLastLinePoint`（Backspace/Delete・取り消しボタン・`Ctrl+Z`の経路）が`removeDrawnLinePoint`を呼ぶ。打った点が始点だけならやめる（`IDLE`へ）。
        *   7.ツールの切り替え：`main.js`の`selectModeTool`（`V`・`A`・`P`・`H`・ボタン）と`selectShapeTool`（図形のボタン・数字キー）と`startEyedropper`の先頭で`finishLineDrawing()`が呼ばれる。`selectShapeTool`は同じ曲線のツールを選び直しても先に呼ぶので、描いた分は開いたまま残る（そのあと新しい線が始まる）。貼り付け・キャンバスの切り替え等の`applyMode`だけを通る経路は捨てる（今どおり）。
        *   13.除外の範囲：`isJoinableLine`が「直線、または区間がすべて直線の開いたパス」なので、曲線のパスは結合（ボタン・`J`の`PathJoiner.canJoin`）・端点への吸い付き・端点のハンドルのドラッグの吸い付き（`resolveEndpointHandle`）・描き足しの対象外。曲線のツールの作成途中の線は`isJoinableLine`が偽のため`findDrawnLineSnapTarget`が既存の線の端点を走査せず、自分の始点にだけ吸い付く。曲線のツールの描き始め（クリック前のホバー）は`isSnapDrawShapeType`が`'line'`のときだけ真のため、端点の吸い付き表示も出ない。なお直線と曲線の区間が混ざったパスを作る手段は本作業では無い（`fromJSON`で読み込んだ場合のみ。その場合も曲線の区間を含むため結合の対象外）。
    *   発注者へ提示する確認項目（0〜14は要件Jのとおり。実コードの裏取りで次の点を明確にした）：
        *   0.ブラウザで`Ctrl`+`F5`、曲線のツール（〜・`2`）を選ぶ。
        *   1.1回目のクリック後は直線が付いてくる。2点目以降は打った点すべてを通る1本のなめらかな曲線が付いてくる（つなぎ目に角なし）。カーソルを動かすと最後の区間とその1つ前の区間が動く。
        *   2.最後の点をもう1回クリックで開いた曲線（点2つなら直線）。`Esc`で開いたまま終わる。始点だけの`Esc`は何も残らない。
        *   3.点3つ以上打って始点に近づけると青い正方形が出て、クリックで閉じる。吸い付き中の見た目は「始点へ戻る開いた曲線」、閉じた後に始点のところもなめらかになる（始点付近の形が少し変わるのは正常）。塗りを付けると内側が塗られ、内側クリックで選べる。
        *   4.引いている途中の`Backspace`・`Delete`・`Ctrl+Z`・取り消しボタンで最後の点が消える（始点だけのときはやめる）。
        *   5.点5つで終えた曲線が`Ctrl+Z`1回で丸ごと消え、`Ctrl+Y`で戻る。
        *   6.`Shift`で最後の点から横・縦・45°に限定。スナップON（10px）で点が刻みに乗り、`Ctrl`の間は乗らない。
        *   7.引いている途中に`V`などで切り替えても、同じ曲線のツールのボタン・`2`を選び直しても、描いた分は開いたまま残る。パン・ズームしても消えず続けられる。キャンバスの切り替え・貼り付けでは捨てられる。
        *   8〜12は要件Jのとおり（選択・動かす・ホバー・矢印キー・位置の数値入力・整列・複製・コピペ・削除・スタイル・スポイト・重なり順／`A`で打った点だけがハンドル／保存と開き直し／書き出しと`sprite-check.html`（版3）と版2のJSの読み込み／今の曲線が今までどおり）。
        *   13.曲線のパスを選んでも結合ボタンは押せず`J`も何もしない。直線のツールで曲線のパスの端点に近づけても吸い付かない（描き始め・引いている途中）。頂点の選択で曲線のパスの端点を他の線の端点へ（逆も）ドラッグしても吸い付かない。曲線のツールで既存の線の端点に近づけても吸い付かない（自分の始点にだけ吸い付く）。
        *   14.直線のツールの連続作成（直線・パス・始点で閉じる・描き足し・つながり）・弧・矩形・円・選択・頂点の選択・端点ハンドルの吸い付きと結合・`J`・保存・読み込み・書き出し・ツールのアイコン表示が今までどおり。
    *   自動テストで確かめられず、特に確かめてほしい項目：`InputTracker`の配線を通る実際のマウス操作（付いてくる曲線の追従・ダブルクリック・`Shift`/`Ctrl`・パン・ズームとの組み合わせ）、`CanvasManager`での見た目（なめらかさ・つなぎ目・アウトライン表示・ホバーの強調）、確認用ページでの表示。加えて、5章の目視推奨：始点吸い付き中と閉じた後の形の違い、点の間隔が大きく違うときの膨らみ・小さな輪（式の性質で許容）、区間が多い曲線が多数あるときのホバーの重さ。
    *   開発資料への影響：なし。

### タスク12: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
*   **作業内容** :
    *   `PROJECT_ARCHITECTURE.md`：1章（`shapes/`の`PathJoinRules`コメント、「存在しないもの」の曲線の連続作成の削除と09-01b・09-02・09-03・09-04等の追記・塗りの記述・制御点の丸めの記述、フォルダ分割の方針の`shapes/`）、2章（`path`の区間の種類`'smooth'`・作られる操作・形の決め方の式と連なり・作業データの版は2のまま、書き出し形式を版3へ・`bezierPath`・読む側の規則・外枠・エンジンへの連絡票が未送付・版の履歴・ツールのアイコンの生成物は版2のまま）、3章3.・6.・11.・12.・16.・17.・22.（直線・曲線のツールへ。結合できる線の定義・曲線のパスの対象外・曲線のツールの吸い付き・線を引いている途中の判定が`isDrawnLineShape`になったこと）を更新。4章の一覧の表は変更なし（新しいモジュールは無い）。
    *   `_doc/arch/`：`02_main.md`・`03_VectorModel.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`（JSDocのみ。`InputTracker.js` 1729行・`main.js` 1010行のまま）、`10_ShapeFactory.md`、`12_shapes.md`、`14_edit.md`、`15_io.md`、`16_test.md`（追加85件の内訳・書き換えた既存のテスト・件数 tests 1719 / suites 268）、`17_sprite_check.md`、`40_asset_sprite.md`を更新。
    *   ソース（`js/`・`test/`・`index.html`）・`_doc/`のarch以外は変更していない。
    *   **diff監査の指摘による修正**：(1) `16_test.md`の`ShapeGeometry.test.js`の2か所（16行目・18行目）に、09-01aで`cubicBezierPoint`・`computeSmoothSegmentControls`を追加した旨を添えた。(2) 09-01aの内訳は`ShapeFactory.test.js`（+2件・書き換え1件）が133行目に既にあり、10+14+16+5+7+1+7+11+2+2+10＝85件で見出しと一致することを確認（変更なし。it +3/−1のうち1件は書き換えで純増は+2）。(3) 「期待値を変えたのは3件」を「計5ケース（Pathの3・SpriteSerializerの1・ShapeFactoryの1）」に直した。(4) `cubicAxisRange`を別に定義した理由を、実コードのJSDocに合わせ「`io/`は`shapes/`をimportできず、`quadraticAxisRange`と同じ扱い」に直した（`PROJECT_ARCHITECTURE.md`・`12_shapes.md`）。(5) `PROJECT_ARCHITECTURE.md` 3章22.の「`ShapeFactory`は変えていない」を「09-01aで変えたのは`curve`の`create`だけ」に直した。(6) 3章12.の括弧書きを、弧・矩形・円の`mousemove`も`findDrawSnap`を呼び、`isSnapDrawShapeType`が`'line'`でないとき`null`を返すため吸い付かない、という実コードどおりに直し、「上の発注者の決定」を「下の」に直した（449行目「流れ（描いている途中。直線・曲線のツール以外）」）。再監査の指摘により、450行目「流れ（描き終え）」の括弧書きの「上の発注者の決定」も「下の」に直した（指す決定は下の「発注者の決定」の項にある）。3章12.の節のほかの位置の参照（461行目「上の「流れ（描き終え）」」・462行目「（上記）」）は、指す項がいずれも上にあることを確認し、変更していない。
    *   開発資料への影響：本タスクで反映済み。

## 5. 懸念事項・要確認ポイント
*   **（計画時）曲線のツールの点1つの間の作成途中の図形**：REQの設計の方針の括弧書き「点1つの間は直線」を、`Line`のインスタンスではなく「頂点2つ・区間1つの曲線のパス」（形は直線と同じ）で満たす（理由は2章「全体の方針」）。見た目・操作は直線と同じだが、`ShapeFactory.create('curve', …)`の戻り値の`type`が`'path'`になる。
*   **（計画時）`ShapeFactory.create(type)`の`type`の一致**：`curve`では成り立たなくなる（既存のテスト1件の期待値を書き換える）。`js/`内で`create`の戻り値の`type`を見ている箇所は無い（呼び出し元は`VectorModel.startDraft`だけで、戻り値を作成途中の図形として持つだけ）。
*   **（計画時）始点へ吸い付いている間の見た目**：始点に吸い付いて青い正方形が出ている間の付いてくる線は「始点へ戻る開いた曲線」の形（始点のところは仮の点で曲がる）で、クリックして閉じた後に始点のところもなめらかな形へ変わる。式の性質で、閉じる直前と後で形が少し変わる（テストプレイの確認項目3.に添える）。
*   **（計画時）当たり判定の計算量**：曲線の区間1つにつき100分割の折れ線で当たり・範囲選択・塗りの内側を判定する（今の曲線と同程度）。区間の多い曲線のパスが多数あると、ホバーのたびの計算が増える（性能の改善は本作業の範囲外）。
*   **（計画時）書き出しの描画要素の名前**：曲線のパスの描画要素の`kind`は`"bezierPath"`、区間の種類は`'line'`・`'cubic'`とした（作業データの`'smooth'`とは別の語彙。Phase 09-03で今の曲線・弧を3次ベジェの区間として表すため、Catmull-Romの規則を書き出しに出さない）。エンジンへの連絡票は Phase 09-04 で出す（エンジンは`draw(ctx)`だけを読むため、版3のJSもエンジンのコードの変更なしで描ける見込み）。
*   **（計画時）式の性質**：打った点の間隔が大きく違うと曲線が膨らむ・小さな輪ができることがある（REQで許容済み。発注者に伝え済み）。
*   **（タスク12）資料の記述の根拠と目視推奨**：`16_test.md`の追加テストの内訳はタスク1〜8の記録とテストファイルのdescribe/it名（git diff）で裏取りしたが、`test/edit/EndpointSnapper.test.js`・`DocumentSerializer.roundtrip.test.js`の件数の内訳（7件・10件）はRESの記録に従った（`it`の名前の細部は資料に書いていない）。今後、区間の直線⇔曲線の切り替え（09-02）・曲線のパスの結合（09-01b）を足すときは、`PROJECT_ARCHITECTURE.md`の2章`path`・3章11.・12.・22.と`12_shapes.md`の`isJoinableLine`の項を見直すこと（この箇所に「後半で外す予定」と書いてある）。`PROJECT_ARCHITECTURE.md`の3章16.・17.・22.のうち、当時の決定（Phase 07-05の「曲線の制御点は丸めない」等）は履歴として残し、括弧で09-01aでの変化を添えた。
