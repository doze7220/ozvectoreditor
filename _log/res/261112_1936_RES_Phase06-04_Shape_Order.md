# RES: 作業計画・作業レポート (Phase 06-04) : 重なり順の変更
* 参照元REQ: `./_log/req/261112_1920_REQ_Phase06-04_Shape_Order.md`

## 1. 作業目的
選択中の図形の重なり順（描画順）を「最前面へ」「前へ」「後ろへ」「最背面へ」の4つの操作で変えられるようにする（機体の絵で円を多角形より手前に描くため）。操作はプロパティパネルの新しい段「重なり順」の4つのボタンと、キー`Home`・`PageUp`・`PageDown`・`End`で行う。

「重なり順」は`VectorModel`の図形の並び（`model.getShapes()`。先頭＝最も奥、末尾＝最も手前）であり、作業データの`shapes`の並び・書き出しの`elements`の並び・描画順・当たり分類の「手前優先」の順と同じである。**並びを変えるだけで保存・書き出し・描画・クリックで選ばれる図形のすべてが追従する**ため、`io/`・`shapes/`・`check/`・`core/PointHitRules.js`・`core/InputTracker.js`・`core/CanvasManager.js`は変えない。図形データの形・作業データの版・書き出し形式の版・描画・当たり分類の規則も変えない。

1回の操作（ボタン1回・キー1回）は1件の編集操作として履歴に記録し、Undo1回で元の並びに戻り、Redo1回でやり直せる。並びが変わらない操作（何も選んでいない・すでに端にある等）は何もせず、履歴も増やさない。

## 2. アーキテクチャ設計

### 用語（本RESでの意味）
*   **並び**：`VectorModel`の図形の配列の順（先頭＝最も奥、末尾＝最も手前）。
*   **操作**：`bringToFront`（最前面へ）・`bringForward`（前へ）・`sendBackward`（後ろへ）・`sendToBack`（最背面へ）の4つ。値の唯一の定義は新設の`edit/ShapeOrderRules.js`の`ShapeOrderOperation`。
*   **規則**：選択の有無の並びから新しい並びを求める関数（状態なし・DOMなし・importなし）。
*   **手順**：規則で求めた並びを、履歴の記録で挟んで`VectorModel`へ渡す1件の編集操作。

### 要件1: 並べ替えの規則（`js/edit/ShapeOrderRules.js`・新設）
*   **置き場所**：`edit/`の新しいモジュール`ShapeOrderRules.js`（`StylePanelRules`と`ShapeStyleEditor`、`PathJoinRules`と`PathJoiner`の「規則と手順を分ける」形に合わせる）。
    *   `core/`に置かない理由：`core/`の規則の関数は「`core/`の横断的な処理だけが使うもの」（`PointHitRules`）に限っている。本規則は`edit/`の手順だけが使う。
    *   `shapes/`に置かない理由：図形を一切知らない（並べるのは不透明な要素で、図形の形・種別・プロパティを読まない）。
    *   `VectorModel`に置かない理由：`VectorModel`は「新しい並び全体」を受け取るだけにし、操作の種類を知らせない（下の要件2。図形の一覧のPhaseのドラッグによる並べ替えからも同じ公開操作を使うため）。`core/`は`edit/`をimportできないため、規則を`edit/`に置いても依存方向は崩れない。
*   **公開するもの**（`export`。importは持たない。DOMに触れない。状態を持たない）：
    *   `ShapeOrderOperation`：凍結したオブジェクト`{ BRING_TO_FRONT: 'bringToFront', BRING_FORWARD: 'bringForward', SEND_BACKWARD: 'sendBackward', SEND_TO_BACK: 'sendToBack' }`（`@readonly`・`@enum {string}`）。操作の値の唯一の定義。
    *   `reorderSelected(items, isSelected, operation)`：新しい並びの配列を返す。
        *   `items`：並び（`ReadonlyArray<T>`。先頭＝最も奥）。要素は不透明に扱う（`===`でのみ比べる）。書き換えない。
        *   `isSelected`：`(item) => boolean`。冒頭で各要素について1回ずつだけ呼び、結果の配列で処理する（以後は呼ばない）。
        *   `operation`：`ShapeOrderOperation`の値。それ以外なら`Error`をthrowする（文言：`ShapeOrderRules: 未知の重なり順の操作です: ${String(operation)}`。配線の誤りを早く見つけるため。`items`が空でも判定する）。
        *   戻り値：新しい配列（`items`と同じ要素の並べ替え。並びが変わらない場合も新しい配列）。
    *   `canReorderSelected(items, isSelected, operation)`：`reorderSelected`の結果が`items`と1か所でも違う（`!==`）とき`true`。**押せる/押せないの判定と、手順の「何もしない」の判定はこの関数だけで行う**（規則を二重に書かない）。未知の操作は`reorderSelected`と同じく`Error`。
*   **規則**（発注者の決定。`sel[i]`＝`items[i]`が選択中か）：
    *   `bringToFront`：`[選択されていない要素（元の順）..., 選択中の要素（元の順）...]`。
    *   `sendToBack`：`[選択中の要素（元の順）..., 選択されていない要素（元の順）...]`。
    *   `bringForward`：結果の配列（`items`のコピー）と`sel`のコピーに対して、`i = n - 2`から`0`へ（手前側から奥側へ）走査し、`sel[i]`が真かつ`sel[i + 1]`が偽なら、要素と`sel`の両方の`i`と`i + 1`を入れ替える。
    *   `sendBackward`：同様に`i = 1`から`n - 1`へ（奥側から手前側へ）走査し、`sel[i]`が真かつ`sel[i - 1]`が偽なら、`i`と`i - 1`を入れ替える。
    *   上の走査により、選択中の各要素は**並びの上で隣の1つ分**だけ動き（重なっているかは見ない）、離れた選択中の要素はまとまらずにそれぞれ1つずつ動き、連続した選択中の要素は一緒に動く（動けなければ動かない）。選択中どうし・選択されていないどうしの相対的な順は4操作とも保たれる。
    *   確認用の例（テストに入れる）：`[A, B*, C, D*, E]`で前へ→`[A, C, B*, E, D*]`、`[A, B*, C*]`で前へ→不変、`[A*, B, C*]`で前へ→`[B, A*, C*]`、`[A*, B*, C]`で前へ→`[C, A*, B*]`。後ろへは対称：`[A, B*, C, D*, E]`→`[B*, A, D*, C, E]`、`[A*, B*, C]`→不変、`[A*, B, C*]`→`[A*, C*, B]`。
    *   空の並び・選択なし・全要素が選択中のときは、4操作とも並びが変わらない（`canReorderSelected`は偽）。

### 要件2: モデルの変更と履歴
#### 2-1. `VectorModel.reorderShapes(orderedIds)`（`js/core/VectorModel.js`・公開操作の追加）
*   **渡す形**：新しい並び全体を、**現在の全図形のidをちょうど1回ずつ並べた配列**で渡す（先頭＝最も奥）。
    *   操作の種類を渡さない理由：図形の一覧のPhaseで、一覧のドラッグによる並べ替え（任意の並び）からも同じ公開操作を使うため。並べ替えの規則を`core/`へ持ち込まないため（規則は`edit/`の1か所）。
    *   idで渡す理由：図形の一覧も図形をidで扱う見込みであること、`VectorModel`の他の公開操作（`moveShapes`・`deleteShapes`・`setSelection`）と同じ形であること。インスタンスは並び替えるだけで作り直さない。
*   **処理**：
    1.  `orderedIds`が配列でない・要素数が今の図形の数と違う・今の図形に無いidを含む・同じidを2回以上含む場合は、`console.warn('VectorModel.reorderShapes: 現在の全図形のidをちょうど1回ずつ並べた配列ではないため、並びを変えません。', orderedIds)`のうえ、何も変えず通知もせず`false`を返す（並びを壊さない）。
    2.  idから今の図形インスタンスを引いて新しい配列を作る。今の並びとすべての位置で同じインスタンスなら、何も変えず通知もせず`false`を返す（`console.warn`は出さない）。
    3.  `#shapes`を新しい配列に置き換え、変更を1回通知して`true`を返す。
*   **触れないもの**（JSDocに列挙する）：選択集合・ホバー・作成中の図形・選択矩形・吸い付きの表示の点・新しく描く図形のスタイル（直前に使った値）・idの採番（`#nextId`）・図形インスタンスの中身（id・頂点・スタイル）。並べ替え後も同じidの図形が選ばれたまま（`getSelectedIds()`は並びの順で返すため、返る順は新しい並びに従う）。
*   **履歴の記録は呼び出し側の責務**（他の公開操作と同じ）。呼び出し元は`edit/ShapeOrderEditor`のみ（将来、図形の一覧のPhaseで一覧のドラッグからも使う見込み）。
*   図形0個で`[]`を渡すのは正しい入力で、並びが変わらないため`false`（警告なし）。

#### 2-2. 手順（`js/edit/ShapeOrderEditor.js`・新設、クラス`ShapeOrderEditor`）
*   `PathJoiner`・`ShapeStyleEditor`と同じ位置づけ（`edit/`の1件の編集操作の手順。DOMなし・`InputTracker`に依存しない・操作モードを知らない・`try/catch`なし）。`InputTracker`へは入れない（DIRの持ち越し事項・`_doc/COWORK_STATUS.md` 2章C「`InputTracker`の肥大化防止」）。
*   **importは`./ShapeOrderRules.js`のみ**（`edit/`内。`ShapeStyleEditor`→`StylePanelRules`と同じ例外）。`VectorModel`・`HistoryManager`は注入で受け取る。
*   **コンストラクタ**：`new ShapeOrderEditor({ model, editRecorder })`。`model`は`getShapes`・`isSelected`・`reorderShapes`だけを使う。`editRecorder`の型は`import('./ShapeInserter.js').EditRecorder`（実体は`historyManager`）。
*   **公開メソッド**：
    *   `apply(operation)`：選択中の図形の重なり順を変える1件の編集操作。戻り値は並びを変えたか（`boolean`）。
        1.  `ids = model.getShapes().map((shape) => shape.id)`、`isSelected = (id) => model.isSelected(id)`。
        2.  `canReorderSelected(ids, isSelected, operation)`が偽なら、何も呼ばずに`false`（**何もしない場合は`beginEdit`も呼ばないため、履歴は増えない**。仮に呼んでも`HistoryManager.commitEdit`は前後の作業データが同じなら記録しないが、それに頼らない）。未知の操作は規則が`Error`をthrowし、`beginEdit`より前のため対が崩れない。
        3.  `nextIds = reorderSelected(ids, isSelected, operation)`。
        4.  `editRecorder.beginEdit()` → `changed = model.reorderShapes(nextIds)` → `editRecorder.commitEdit()`。
        5.  `changed`を返す。
    *   `getAvailability()`：4つの操作それぞれについて`canReorderSelected`の結果を持つオブジェクトを返す（typedef`ShapeOrderAvailability`＝`{ bringToFront: boolean, bringForward: boolean, sendBackward: boolean, sendToBack: boolean }`。キーは`ShapeOrderOperation`の値。`Object.values(ShapeOrderOperation)`から組み立てる）。モデル・履歴を変えない純粋な照会。ボタンの押せる/押せないの表示に使う。
*   **前提（呼び出し側の責務）**：ドラッグ中でないこと（`main.js`の`performShapeOrder`が判定する）。選択モード以外では選択集合が空のため何もしない（操作モードは知らない）。キャンバスの読み込み中も選択集合が空のため何もしない（専用の判定は不要。開発資料3章1.）。進行中の入力操作の中断・モード切り替えは行わない（選択モードで選択集合が空でないときは作成途中の図形が無い）。
*   **履歴**：スナップショットの作業データは並び順を含むため、Undoで`replaceAllShapes`により元の並びに戻る。選択集合は記録時点のもの（操作の前後で同じ）が選択モードのとき復元される。自動保存の契機は既存どおり`historyManager.onChange`（記録した場合のみ）。

### 要件3: 操作の置き場所（プロパティパネルの新しい段「重なり順」）
#### 3-1. `index.html`
*   `#window-property-panel`の本体の`#property-shape-section`の後に、新しい段を足す（`PropertyShapeSection`・「図形」の段のマークアップは変えない）：
    ```html
    <section id="property-order-section" class="property-section">
        <h3 class="property-section-title">重なり順</h3>
        <div class="order-button-grid">
            <button type="button" id="order-bring-to-front" class="tool-btn" title="最前面へ (Home)" disabled>最前面へ</button>
            <button type="button" id="order-bring-forward" class="tool-btn" title="前へ (PageUp)" disabled>前へ</button>
            <button type="button" id="order-send-backward" class="tool-btn" title="後ろへ (PageDown)" disabled>後ろへ</button>
            <button type="button" id="order-send-to-back" class="tool-btn" title="最背面へ (End)" disabled>最背面へ</button>
        </div>
    </section>
    ```
    *   **要素idの接頭辞は`order-`**（段のルートは「図形」の段の`property-shape-section`、開発資料にある将来の`property-vertex-section`と同じ`property-<段>-section`の形）。「図形」の段の接頭辞`property-`の要素（`property-stroke-*`・`property-fill-*`・`property-shape-source`）と重ならない。`order-`にした理由：`property-order-…`にすると「図形」の段の接頭辞`property-`に含まれて紛らわしいため。
    *   **並べ方は2×2**（1行目「最前面へ」「前へ」、2行目「後ろへ」「最背面へ」。左上から右下へ手前→奥の順）。幅：パネルの内側196px（幅220px−左右の余白24px）を間隔8pxで2等分し各94px。最長の「最前面へ」「最背面へ」は文字13px×4字＝52px＋左右の余白20px＋枠2px＝約74px＜94pxで1行に収まる。絵文字は付けない（幅とフォントによる高さの揺れを避けるため）。
    *   **初期状態は`disabled`**（結合ボタン`#selection-join`と同じ扱い。`main.js`の実行前・初期化に失敗した場合に押せないようにするため。起動時に`main.js`が1回同期する）。開発資料の「`checked`・`value`等の初期値は書かない」は入力欄の値の二重定義を避ける規則で、ボタンの押せない状態は結合ボタンの前例に従う。
    *   `title`にキー割り当てを書く（`SHORTCUT_BINDINGS`と手で同期する。`_doc/COWORK_STATUS.md` 2章C「キー割り当ての手動同期」）。
*   **スタイル**（`<style>`に足す。`.tool-btn`・`.tool-btn:disabled`はそのまま使う）：
    ```css
    /* プロパティパネルの「重なり順」の段の4ボタン（2×2。内側196pxを間隔8pxで2等分＝各94px。最長の4字のボタンは約74pxで収まる） */
    .order-button-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }
    .order-button-grid .tool-btn {
        text-align: center;
        white-space: nowrap;
    }
    ```
*   **コメントの更新**：
    *   `#window-property-panel`のコメントの「パネル自身は1280×800に収まる（幅は508＋220＝728＜1280、高さは約200px・下端は約216pxで800px未満）」を、段を足した後の高さ・下端へ改める。見積もり：足す高さ＝段の間の`.window-body`の`gap` 8px＋`margin-top` 4px＋罫線1px＋`padding-top` 12px＋見出し約16px＋`gap` 8px＋ボタン2行（各約35px＝文字約17px＋上下の余白16px＋枠2px）＋行の間8px＝約127px。高さは約330px・下端は約345pxで800px未満（実装時に式を見直して丸めた値を書く。テストプレイで確かめる）。横方向の位置（`right: 508px`・幅220px）は変えないため、コントロールパネル・図形選択パレット・キャンバスパレットとは高さによらず重ならないこと、`?dev`の確認用ウィンドウとは画面幅1104px以上なら重ならないことは今のコメントのまま成り立つ（1280×800では重ならない）。
    *   `.property-section + .property-section`のコメント「今は1段のため効かない」を、「「図形」と「重なり順」の段の間に効く」の趣旨へ改める。
*   コントロールパネル・図形選択パレット・キャンバスパレット・`?dev`の確認用ウィンドウは変えない（`#window-shape-palette`の`top`も変えない）。

#### 3-2. UI部品（`js/palette/PropertyOrderSection.js`・新設、クラス`PropertyOrderSection`）
*   **責務**：「重なり順」の段（`#property-order-section`）の4つのボタンの押せる/押せないの表示と、押下のコールバックへの通知。importを持たない。`VectorModel`・選択集合・図形データ・`ShapeOrderEditor`・並べ替えの規則・操作の値（`ShapeOrderOperation`）を知らない。
*   **コンストラクタ**：`new PropertyOrderSection(sectionElement, actions)`。
    *   `actions`＝`{ onBringToFront, onBringForward, onSendBackward, onSendToBack }`（typedef`PropertyOrderSectionActions`。引数なし・戻り値は使わない）。どれかが関数でなければ`Error`をthrow（文言は`PropertyShapeSection`と同じ形：`PropertyOrderSection: actions.${name}は関数である必要があります。`）。
    *   要素はルート要素内の`querySelector('#order-bring-to-front')`等で解決する。1つでも欠ければ`console.warn`して配線しない（以後の`render`は何もしない）。
    *   各ボタンの`click`で対応するコールバックを呼ぶ（`disabled`のボタンは`click`が来ないため、押せない判定はしない）。
*   **公開メソッド**：`render(view)`。`view`はtypedef`ShapeOrderAvailability`（`{ bringToFront, bringForward, sendBackward, sendToBack }`の真偽値。**`edit/ShapeOrderEditor.js`と同じ内容の二重定義**。形を変えるときは両方を揃える）。各ボタンの`disabled`を`view.<キー> !== true`にする。
*   キーと要素・コールバックの対応は、このファイル内の1つの表（例：`[{ key: 'bringToFront', id: '#order-bring-to-front', action: 'onBringToFront' }, ...]`）に閉じる。

#### 3-3. 配線（`js/main.js`・新しいブロック`// 7.8.`）
*   `// 7.7.`（「図形」の段）の後、`// 8.`の前に、段のブロック`// 7.8. プロパティパネル（「重なり順」の段）配線`を足す（`// 7.7.`のブロック・`PropertyShapeSection`の配線は変えない）。内容は生成・注入・同期の登録だけ：
    *   `const shapeOrderEditor = new ShapeOrderEditor({ model, editRecorder: historyManager });`
    *   関数`performShapeOrder(operation)`（JSDoc付き）：(1) `inputTracker.isDragging()`が真なら何もせず`false`（ボタンはショートカット以外の呼び出し元のため、中ボタンのパン中に左クリックで押される場合に備える。`performJoin`と同じ）。(2) それ以外は`shapeOrderEditor.apply(operation)`の結果を返す。**ボタンとキーの共通の入口**（どちらもこの関数だけを呼び、`shapeOrderEditor.apply`を直接呼ばない）。判定・並べ替えのロジックは持たない。
    *   `const propertyOrderSection = new PropertyOrderSection(document.getElementById('property-order-section'), { onBringToFront: () => performShapeOrder(ShapeOrderOperation.BRING_TO_FRONT), onBringForward: () => performShapeOrder(ShapeOrderOperation.BRING_FORWARD), onSendBackward: () => performShapeOrder(ShapeOrderOperation.SEND_BACKWARD), onSendToBack: () => performShapeOrder(ShapeOrderOperation.SEND_TO_BACK) });`
    *   関数`syncPropertyOrderSection()`（JSDoc付き）：`propertyOrderSection.render(shapeOrderEditor.getAvailability())`。`model.onChange(syncPropertyOrderSection)`で登録する（既存の経路だけ。結合ボタンの`syncJoinButtonState`と同じ形。選択の変更・取り消し/やり直し・キャンバスの切り替え・モードの切り替え・図形の作成/削除・並べ替えはすべて`model.onChange`を通知する）。
*   `// 8.`の`KeyboardShortcuts`の注入に、`bringToFront`・`bringForward`・`sendBackward`・`sendToBack`の4つのコールバックを足す（それぞれ`() => performShapeOrder(ShapeOrderOperation.…)`。コメント「重なり順の変更（ボタンと同一経路。並びを変えた場合のみtrue）」）。
*   起動時の同期：`syncPropertyShapeSection();`の後に`syncPropertyOrderSection();`を明示的に1回呼ぶ（コメント付き）。
*   importを3行足す：`import { ShapeOrderEditor } from './edit/ShapeOrderEditor.js';`・`import { ShapeOrderOperation } from './edit/ShapeOrderRules.js';`・`import { PropertyOrderSection } from './palette/PropertyOrderSection.js';`。
*   **タスクの順序と起動時の例外**：`KeyboardShortcuts`のコンストラクタは対応表の全action名のコールバックを要求するが、余分なコールバックは検査しない。そこで**`main.js`の配線（4つのコールバックの注入を含む）を先のタスク、`KeyboardShortcuts`の対応表への追加を後のタスク**とする。各タスクの完了時点で起動時の例外は起きない。

### 要件4: キー割り当て（`js/core/KeyboardShortcuts.js`）
*   `SHORTCUT_BINDINGS`の`join`（`KeyJ`）の後に4エントリを足す（コメント「重なり順の変更。前へ・後ろへは押しっぱなしで連続実行できるようrepeatable: true、最前面へ・最背面へは繰り返さない」）：
    *   `{ codes: ['Home'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'bringToFront' }`
    *   `{ codes: ['PageUp'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'bringForward' }`
    *   `{ codes: ['PageDown'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'sendBackward' }`
    *   `{ codes: ['End'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'sendToBack' }`
*   **actionを4つに分ける理由**：`core/`は`edit/`をimportできないため、1つのactionに`arg`で操作の値を渡すと、操作の値（`ShapeOrderOperation`）を`core/`にも書くことになり二重定義になる。actionを分ければ、操作の値は`main.js`のコールバックで`edit/`の定数から渡すだけになる。
*   **repeatable**：REQのとおり（前へ・後ろへは受け付け、最前面へ・最背面へは受け付けない。異論なし。押しっぱなしで前へ・後ろへが繰り返し動き、端に着くと並びが変わらず`false`になって止まる）。
*   **typedef`ShortcutActions`**に4つを足す：`@property {() => boolean} bringToFront 選択中の図形を最前面へ移す。並びを変えた場合のみtrue（何も選んでいない・すでに最前面・ドラッグ中ではfalse）`等。
*   **何もしなかったときの戻り値**：`false`（`join`と同じ。受理したときだけ`preventDefault()`する約束）。`false`のときはブラウザ標準の動作（スクロール）が起きるが、`body`は`overflow: hidden`でページはスクロールしない（フォーカスがキャンバスパレットの一覧の中のボタンにあるときは一覧がスクロールし得る。5章）。
*   **入力欄の規則は今のまま**：太さの欄（テキスト入力扱い）にフォーカス中は判定順序の手順2で働かない。`checkbox`・`color`の入力欄にフォーカス中は4つとも`ctrl: false`のため手順4で働かない（`preventDefault()`もしない）。`KeyboardShortcuts`の判定順序・`#findBinding`は変えない。
*   **衝突の確認**：既存の対応表に`Home`・`End`・`PageUp`・`PageDown`のコードは無い（`codes`は`KeyV`・`KeyP`・`KeyH`・`Digit1`〜`Digit5`・`Numpad1`〜`Numpad5`・`Digit0`・`Numpad0`・`Equal`・`Semicolon`・`NumpadAdd`・`Minus`・`NumpadSubtract`・`Escape`・`KeyA`・`Delete`・`Backspace`・`KeyJ`・`KeyZ`・`KeyY`・`KeyC`・`KeyX`・`KeyD`）。`Space`は`InputTracker`の担当で対象外。
*   クラスJSDoc・判定順序のJSDocの`preventDefault()`の例外の列挙（`Ctrl+=/-/0/A/Z/Y/C/X/V/D`）は`ctrl: true`のエントリの話のため変えない。

### 要件5: 保存・書き出し・クリックで選ばれる図形
*   保存（作業データファイル・自動保存）と書き出し（スプライトJS）は`model.getShapes()`の並びをそのまま使う（`DocumentSerializer.serialize`・`SpriteSerializer.serialize`）ため、`io/`は変えない。自動保存の契機は既存どおり`historyManager.onChange`。
*   クリック・ホバーで選ばれる図形は`PointHitRules.classifyPointHit`が`model.getShapes()`の後ろ（手前）から探すため、並べ替えた後は新しい並びで手前の図形が選ばれる。`PointHitRules.js`・`InputTracker.js`は変えない。
*   描画は`CanvasManager.render`が`model.getShapes()`の順で描くため追従する（`model.onChange`→`renderCurrentState`）。ハンドルは今どおり全図形の描画後にまとめて描かれる（`_doc/COWORK_STATUS.md` 2章Bの件。変えない）。

### 要件6: 自動テスト（`_doc/arch/16_test.md`の規則に従う）
*   **新設**：
    *   `test/edit/ShapeOrderRules.test.js`：規則（要素は文字列`'A'`〜、`isSelected`は`Set`による関数）。4操作それぞれについて、単一選択・連続した複数選択・離れた複数選択・すでに端にある場合（不変）・選択なし（不変）・全要素を選択（不変）・要素0個（不変）、選択されていない要素どうしと選択中の要素どうしの相対的な順が保たれること、要件1の例（`[A, B*, C, D*, E]`等の全例）、`canReorderSelected`が`reorderSelected`の結果（並びが変わるか）と一致すること（列挙した全ケース×4操作で照合）、引数の配列を書き換えないこと、戻り値が新しい配列であること、`isSelected`が各要素1回ずつ呼ばれること、未知の操作で`Error`（要素0個でも）、`ShapeOrderOperation`の4つの値と凍結。
    *   `test/core/VectorModel.reorderShapes.test.js`：並びが変わり`true`、インスタンスがそのまま（同じ参照・`toJSON()`が同じ）、選択集合（`getSelectedIds()`は新しい並びの順で同じidの集合）・ホバー・作成中の図形・選択矩形・吸い付きの表示の点・直前に使った値が変わらないこと、idの採番が変わらないこと（並べ替えの後の`addShapesWithNewIds`が並べ替え前と同じ次のidを発行する）、変わったときだけ通知が1回、同じ並びでは`false`・通知なし・警告なし、図形0個で`[]`は`false`、不正な入力（配列でない（`null`・文字列）・要素数が少ない／多い・現存しないid・重複したid（数は同じ））で`false`・並びが不変・通知なし・`console.warn`が1回。
    *   `test/edit/ShapeOrderEditor.test.js`：
        *   偽の`model`・`editRecorder`で：並びが変わる操作で`beginEdit` → `reorderShapes(新しいidの並び)` → `commitEdit`の順と引数、戻り値が`reorderShapes`の戻り値であること、並びが変わらない操作（選択なし・すでに端）では何も呼ばず`false`、未知の操作で`Error`かつ`beginEdit`を呼ばないこと、`getAvailability()`の4つの値が各操作の`canReorderSelected`と一致し`model`・`editRecorder`を変えないこと（何も呼ばないこと）。
        *   実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`ShapeOrderEditor`を組み合わせて：4操作それぞれで履歴が1件（`canUndo()`が真、undo1回で`canUndo()`が偽）、undoで元の並び・redoで変えた並び、`shouldRestoreSelection`が真ならundo/redo後も同じ図形が選ばれていること、並べ替えの直後も選択集合が同じこと、何もしない場合（選択なし・すでに最前面で最前面へ／前へ・すでに最背面で最背面へ／後ろへ・全図形を選択）に図形の並び・選択集合・履歴（`canUndo()`・`historyManager.onChange`の通知回数）が変わらないこと。
        *   保存の往復：並べ替えた後の`model.getShapes()`を`DocumentSerializer.serialize`→`deserialize`したidの並びが新しい並びと同じこと、`SpriteSerializer.serialize(model.getShapes()).elements`のidの並びが新しい並びと同じこと。
*   **保存の往復を既存のテストに足さない根拠**：`test/io/DocumentSerializer.roundtrip.test.js`は「混在の描画順・`id`」が往復で保たれることを、`test/io/SpriteSerializer.test.js`は描画要素の描画順を既に確かめている。並べ替えは`model.getShapes()`の配列の順を変えるだけで、`io/`へ渡る形は変わらないため、`io/`のテストは変えない。並べ替えの後の並びがそのまま渡ることだけを`test/edit/ShapeOrderEditor.test.js`で確かめる。
*   **実物の組み合わせの例外**：`test/edit/ShapeOrderEditor.test.js`は`PathJoiner.test.js`・`ShapeStyleEditor.test.js`と同じ条件（対象がDOM・ブラウザのAPIに依存しない、公開APIだけを通す）で、実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`ShapeOrderEditor`と、保存の往復のために`DocumentSerializer`・`SpriteSerializer`を使う（開発資料`16_test.md`の例外の列挙へ追記する）。
*   **テストできない箇所**：`PropertyOrderSection`（DOM）、`main.js`の配線（`performShapeOrder`のドラッグ中の不受理・`syncPropertyOrderSection`）、`index.html`の段、`KeyboardShortcuts`の4つのキー・押しっぱなし・入力欄の規則（`document`に依存）。テストプレイで確かめる。
*   **既存のテストの書き換え**：無い見込み（既存のケースは変えずに追加のみ）。書き換えが必要になった場合は、テストファイル・ケース名・理由を詳細作業内容と5章に列挙する。
*   各タスクの完了時に`node --test`が`fail 0`であること（計画時点：tests 913・pass 913・fail 0）。

### 要件7: テストプレイの準備と確認項目
*   テストプレイ用のファイルは作らない（現場設計AIがテストプレイ時に用意する）。確認項目は5章「テストプレイで確認すべき項目」に列挙する。

### 要件8: 開発資料への記載
*   「開発資料の更新予定」に列挙し、最終タスク（タスク9）で反映する。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/edit/` - `ShapeOrderRules.js`（新設。並べ替えの規則）、`ShapeOrderEditor.js`（新設。重なり順の変更の手順）
    *   `./js/core/` - `VectorModel.js`（`reorderShapes`の追加）、`KeyboardShortcuts.js`（対応表とtypedefの追加）
    *   `./js/palette/` - `PropertyOrderSection.js`（新設。「重なり順」の段のUI部品）
    *   `./js/main.js` - 配線（`// 7.8.`のブロック・`KeyboardShortcuts`への4つのコールバック・起動時の同期）
    *   `./index.html` - 段・ボタン・スタイル・コメント
    *   `./test/edit/`・`./test/core/` - 自動テスト（新設3ファイル）
*   **関連する論理クラス**: `ShapeOrderRules`（新設。状態を持たない関数群）、`ShapeOrderEditor`（新設。1件の編集操作の手順）、`PropertyOrderSection`（新設。UI部品）、`VectorModel`（並びの正本）、`HistoryManager`・`SnapshotAdapter`（履歴。変更しない）、`KeyboardShortcuts`（対応表）、`PathJoiner`・`ShapeStyleEditor`（手順のクラスの前例。変更しない）、`PropertyShapeSection`（段のUI部品の前例。変更しない）、`PointHitRules`・`CanvasManager`・`DocumentSerializer`・`SpriteSerializer`（並びを読むだけ。変更しない）
*   **新設のファイル**：`js/edit/ShapeOrderRules.js`・`js/edit/ShapeOrderEditor.js`・`js/palette/PropertyOrderSection.js`・`test/edit/ShapeOrderRules.test.js`・`test/core/VectorModel.reorderShapes.test.js`・`test/edit/ShapeOrderEditor.test.js`。
*   **変更しないファイル**：`js/shapes/`・`js/io/`・`js/check/`・`js/core/InputTracker.js`・`js/core/PointHitRules.js`・`js/core/CanvasManager.js`・`js/core/HistoryManager.js`・その他の`js/core/`の既存ファイル（`VectorModel.js`・`KeyboardShortcuts.js`以外）・`js/palette/PropertyShapeSection.js`ほか`js/palette/`の既存ファイル・`js/edit/`の既存ファイル・`sprite-check.html`・既存のテストファイル。

### 参照する責務
（`PROJECT_ARCHITECTURE.md`と`_doc/arch/`からの抜粋。以後のタスク実行は、この項目を責務の情報源とする）
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`をimportしない。`palette/`のUI部品はimportを持たない。`edit/`のimportは`DocumentSerializer`のみが原則で、例外は個別に列挙する（`ShapeStyleEditor`は`edit/`内の`./StylePanelRules.js`のみをimportし、`StylePanelRules`はimportを持たない）。本作業で`edit/ShapeOrderEditor` → `edit/ShapeOrderRules`（`edit/`内。`ShapeOrderRules`は何もimportしない）を足す。`main.js`は`edit/ShapeOrderEditor`・`edit/ShapeOrderRules`（定数`ShapeOrderOperation`）・`palette/PropertyOrderSection`をimportする。
*   **同期の経路（全機能共通）**：再描画・UI同期は既存の経路（`model.onChange`・`viewTransform.onChange`・`historyManager.onChange`・`canvasLibrary.onChange`・`canvasFileOperations.onChange`、モードと図形種別は`applyMode`・`applyShapeType`）のみで行う。機能専用の再描画・同期処理を足さない。プロパティパネルの表示は`model.onChange`で同期する。
*   **VectorModel.js**：描画データ（Shape配列）と、選択集合・ホバー状態・作成中図形・選択矩形・吸い付きの表示の点・新しく描く図形のスタイル（直前に使った値）を保持する単一の真実（SSOT）。状態を変更するAPIは変更後に`onChange`の登録リスナーへ通知する。知らないこと：図形固有の頂点構造・内部プロパティ名、図形データ・作業データ形式・`DocumentSerializer`。id形式の知識は`VectorModel`内に閉じる。選択集合は常に現存図形のidのみを含み、選択モード以外では空（不変条件）。公開操作の通知は「変わったときだけ1回」の形が多い（`moveShapes`・`deleteShapes`・`updateShapeStyles`）。
*   **履歴（開発資料3章6.）**：編集操作（図形一式を変化させる利用者の1回の操作）の前後の図形一式を丸ごと記録するスナップショット方式。スナップショットは`{ document: 作業データ, selectedIds: 選択集合 }`。変更処理を`HistoryManager.beginEdit()`と`commitEdit()`で挟む。`model.onChange`ごとの記録はしない。前後の作業データ部分の`JSON.stringify`が一致する場合は記録しない（選択集合は比較しない）。適用は`model.replaceAllShapes` → `shouldRestoreSelection()`が真（選択モード）のときのみ`model.setSelection(snapshot.selectedIds)`。自動保存の契機は`historyManager.onChange`のみ。
*   **作業データ形式**：`{ format: "oz-vector-editor", version, shapes: [図形データ, ...] }`（`shapes`は描画順）。スプライトの描画要素の並び＝`model.getShapes()`の並び。
*   **当たり分類**：規則の正本は`core/PointHitRules.classifyPointHit`。いずれも図形配列の後ろ（手前）優先。変えない。
*   **edit/**：`io/`・`core/`の機能を組み合わせて図形一式を扱う手順。知らないこと（全クラス共通）：DOM、図形種別の分岐、図形固有のプロパティ名、図形のid形式、操作モード。`InputTracker`に依存しない。操作モードに依存する判定・処理は中立な注入関数で受け取る。`VectorModel`・`HistoryManager`等は注入で受け取る。
    *   **PathJoiner.js**（前例）：選択中の線の結合の1件の編集操作と、結合できる選択かの照会。公開メソッド`canJoin`・`join`。呼び出し元は`main.js`（`performJoin`・`syncJoinButtonState`）。`editRecorder`（実体`historyManager`）は注入。契約：結合できない選択では何もせず記録しない。ドラッグ中でないことは呼び出し側（`performJoin`）の責務。進行中の入力操作の中断・モード切り替えは行わない（選択モード以外では選択集合が空のため何もしない）。
    *   **ShapeStyleEditor.js / StylePanelRules.js**（前例）：手順と規則を分ける。規則は状態を持たない`export`した関数と定数のみ・importなし・DOMに触れない。使う側は手順のクラスのみ。
*   **palette/**：自己完結するUI部品。いずれもDOM操作専任で、`VectorModel`・図形データ・選択状態に関与しない（受け取るのは注入された値とコールバックのみ）。importを持たない。
    *   **PropertyShapeSection.js**（前例）：コンストラクタで段のルート要素とコールバックを受け取る。コールバックが関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない（`render`は何もしない）。typedefの二重定義は「形を変える場合は両方を揃える」と明記する。
    *   **段の足し方（開発資料3章13.「2段構成」）**：ウィンドウの本体に段ごとの`<section class="property-section">`（見出し付き）を置き、段ごとに`palette/`のUI部品1つと`main.js`の配線ブロック1つを持つ。段を足すときは`index.html`に`<section>`、`palette/`にその段のUI部品、`main.js`にその段のブロックを足すだけで、`PropertyShapeSection`・既存の段・既存のブロックを変えない。各段のUI部品は自分の`<section>`をルート要素として受け取り、要素はルート要素内の`querySelector('#id')`で解決する。要素idは段ごとの接頭辞（「図形」の段は`property-`）で重複させない。
*   **main.js**：インスタンス化・依存の注入・イベントバインドと、既存モジュールのAPIを決められた順に呼ぶ連携を担う。判定ロジック・作業データの中身の解釈を持たない。配線ブロックはコメント番号の順に置き、`// 7.7.`（プロパティパネル「図形」の段）の後に段ごとのブロックを足す。同一経路の原則：結合ボタンとショートカットは`performJoin()`を呼ぶのみ（ドラッグ中の判定は`performJoin`が行う）。押せる/押せない状態は`model.onChange`に登録した同期関数で行い、起動時にも明示的に1回呼ぶ。キーボードショートカットのコールバックの戻り値の意味はtypedef`ShortcutActions`を正とする。
*   **KeyboardShortcuts.js**：キー→操作の対応表（`SHORTCUT_BINDINGS`）と`keydown`の受理判定のみを担う。新しいショートカットは対応表へのエントリ追加（＋必要なら注入コールバックの追加）で対応する。Shift規則は必ず`ShiftRule`の値を指定する。コンストラクタで全action名の注入を検証し、欠落時は`Error`をthrow。`InputTracker.js`からは定数`OperationMode`/`SHAPE_TYPES`と関数`isTextInputElement`・`isSpaceOperatedInputElement`のみをimportする（`edit/`はimportしない）。入力欄の規則：テキスト入力扱いの`input`（太さの欄を含む）にフォーカスがあるときはすべてのショートカットが働かない。`checkbox`・`color`の`input`にフォーカスがあるときは`Ctrl`なしのショートカットは働かない。ショートカット専用のUI同期・再描画は持たない。
*   **index.html**：スタイルは`<style>`に内包。ボタン単体の押せない状態はHTMLの`disabled`属性と`.tool-btn:disabled`で表す（ウィンドウ全体の`.disabled`と混用しない）。各ボタンの`title`にショートカットキーを併記し、`SHORTCUT_BINDINGS`と手動で同期する。プロパティパネル`#window-property-panel`は静的に置き常に表示、×なし、`.disabled`は使わない。初期位置は`top: 16px; right: 508px; width: 220px`（位置の根拠はCSSコメント）。
*   **読み込み中（開発資料3章1.）**：キーボードショートカットとフロートウィンドウ上のボタンは働く。読み込み中は図形0個・選択集合が空。図形一式を変える操作を新しく足す場合は読み込み中の扱いが要る（本作業は選択集合が空のため何もしない＝専用の判定は不要）。
*   **test/**：`node:test`・`node:assert/strict`のみ。置き場所と命名は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。先頭行に単一責務のJSDoc（3行以内）、補助関数にもJSDoc。公開APIのみを通し、テストのためにソースを書き換えない。`globalThis`・`window`へ代入しない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止する。注入される依存は偽物が原則（実物の組み合わせは例外として列挙）。図形の`id`は公開プロパティ`id`へ文字列を直接代入して設定する。画面の操作や描画のテストは行わない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（資料本体への反映は最終タスク（タスク9）で行う。各タスクで判明した事項はここへ追記する）
*   **`PROJECT_ARCHITECTURE.md` 1章**：
    *   フォルダ構造：`palette/`に`PropertyOrderSection.js`（`PropertyShapeSection.js`の後。コメント「プロパティパネルの「重なり順」の段」程度）、`edit/`に`ShapeOrderRules.js`・`ShapeOrderEditor.js`（`ShapeStyleEditor.js`の後）、`test/core/`に`VectorModel.reorderShapes.test.js`、`test/edit/`に`ShapeOrderRules.test.js`・`ShapeOrderEditor.test.js`を追加。
    *   「存在しないもの」に「重なっている図形だけを数える前へ・後ろへ、離れた選択図形をまとめる重なり順の変更、図形の一覧・ドラッグによる並べ替え（図形の一覧のPhase）」を加える（レイヤー・グループ化は既に記載あり）。
    *   「フォルダ分割の方針」の`edit/`の列挙に「選択中の図形の重なり順の変更」を加える。
    *   依存方向の段落に「`edit/ShapeOrderEditor`は例外として`edit/ShapeOrderRules`を（`edit/`内）importする（`ShapeOrderRules`は何もimportしない）」を加える。
*   **`PROJECT_ARCHITECTURE.md` 3章**：
    *   新しい節「14. 重なり順の変更 (`index.html`の`#property-order-section`・`KeyboardShortcuts.js` → `main.js` → `edit/ShapeOrderEditor.js` → `edit/ShapeOrderRules.js`・`VectorModel.js`・`HistoryManager.js`)」：モジュールの分担（規則＝`ShapeOrderRules`、手順＝`ShapeOrderEditor`、並びの正本と公開操作＝`VectorModel.reorderShapes`（新しい並び全体をidで受け取る）、表示＝`PropertyOrderSection`、配線＝`main.js`）、流れ（ボタン／キー → `performShapeOrder(operation)`（ドラッグ中は不受理）→ `ShapeOrderEditor.apply` → `canReorderSelected`が偽なら何もせず記録しない → `beginEdit` → `model.reorderShapes` → `commitEdit`）、押せる/押せないの同期（`model.onChange` → `syncPropertyOrderSection` → `getAvailability()`。規則は`canReorderSelected`の1か所）、発注者の決定（4つの規則・隣の1つ分・離れた選択はまとめない・連続した選択は一緒に動く・相対的な順を保つ・プロパティパネルの段に置く・キー割り当てと押しっぱなし）、並びが正本のため保存・書き出し・描画・当たり分類が追従し`io/`・`PointHitRules`を変えないこと、`reorderShapes`を操作の種類でなく並び全体で受ける理由（図形の一覧のPhaseのドラッグからも使う見込み）、やらないこと（Non-goals）。
    *   6.「記録する操作と時点」に「重なり順の変更（「重なり順」の段のボタン・`Home`/`PageUp`/`PageDown`/`End`）：`ShapeOrderEditor.apply`で、`model.reorderShapes`の前後。並びが変わらない操作では記録しない（14.）」を追加。
    *   3.「キーボード操作」の注入コールバックの列挙に`performShapeOrder`（重なり順の変更）を追加。
    *   13.「2段構成（段の足し方）」に、現在の段は「図形」（`#property-shape-section`・接頭辞`property-`）と「重なり順」（`#property-order-section`・接頭辞`order-`）であることを追記（「頂点」の段の足し方の記述は変えない）。
    *   1.「読み込み完了前の操作」の列挙に、重なり順の変更も選択集合が空のため何もしない（専用の判定は無い）ことを追記。
*   **`PROJECT_ARCHITECTURE.md` 4章の一覧**：変更なし（新設モジュールは既存の`_doc/arch/13_palette.md`・`14_edit.md`に追記する）。
*   **`_doc/arch/01_index_html.md`**：「プロパティパネルの2段構成」を「図形」と「重なり順」の2段へ（`#property-order-section`、要素idの接頭辞`order-`、4ボタンを`.order-button-grid`で2×2、ボタンは`disabled`で始まり`main.js`の`syncPropertyOrderSection`が同期する（入力欄の「初期値は書かない」の例外ではなく、結合ボタンと同じ扱い））。「ショートカットの表記」に「重なり順」の4ボタンの`title`（`Home`・`PageUp`・`PageDown`・`End`）を追加。「プロパティパネル」の高さ・下端の記述がCSSコメントにあることは今のまま（必要なら値に触れない）。
*   **`_doc/arch/02_main.md`**：配線ブロックの表に`// 7.8.`（プロパティパネル「重なり順」の段。`ShapeOrderEditor`・`PropertyOrderSection`の生成、`performShapeOrder`、`syncPropertyOrderSection`と`model.onChange`への登録）を追加。主な関数に`performShapeOrder`・`syncPropertyOrderSection`を追加。注入の一覧に`ShapeOrderEditor`（`model`・`editRecorder`＝`historyManager`）・`PropertyOrderSection`（`#property-order-section`の要素・4つのコールバック→`performShapeOrder(ShapeOrderOperation.…)`）を追加し、`KeyboardShortcuts`の行に`bringToFront`/`bringForward`/`sendBackward`/`sendToBack`を追加。同一経路の原則に「重なり順のボタンとショートカットは`performShapeOrder()`を呼ぶのみ（`shapeOrderEditor.apply()`を直接呼ばない。ドラッグ中の判定は`performShapeOrder`が行う）」を追加。押せる/押せない状態に「重なり順」の4ボタン（`shapeOrderEditor.getAvailability()`）を追加。「行数」を実装後の行数へ更新（`// 7.8.`は`applyMode`・`viewTransform`等への依存の受け渡しを伴わない独立したブロックのため切り出さなかった旨）。
*   **`_doc/arch/03_VectorModel.md`**：公開メソッドに`reorderShapes`を追加。`reorderShapes`の項（現在の全図形のidをちょうど1回ずつ並べた配列で新しい並びを受け取る・不正な入力は`console.warn`して何もしない・同じ並びでは通知しない・変わったときだけ1回通知・触れない状態の列挙・履歴の記録は呼び出し側・呼び出し元は`ShapeOrderEditor`のみ（図形の一覧のPhaseで一覧のドラッグからも使う見込み）・操作の種類を受け取らない理由）を追加。
*   **`_doc/arch/07_KeyboardShortcuts.md`**：「追加の仕方」の後に、`Home`（`bringToFront`）・`PageUp`（`bringForward`）・`PageDown`（`sendBackward`）・`End`（`sendToBack`）は修飾キーなし・`Shift`不可、前へ・後ろへのみキーリピートで実行、コールバックは並びを変えた場合のみ`true`、actionを4つに分けた理由（`core/`が`edit/`の操作の値を知らないため）を追加。
*   **`_doc/arch/13_palette.md`**：`PropertyOrderSection.js`の項（公開メソッド`render`、注入（段のルート要素・コールバック4つ。関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない）、知らないこと（importなし・`VectorModel`・選択集合・図形データ・`ShapeOrderEditor`・規則・操作の値）、二重定義（typedef`ShapeOrderAvailability`は`edit/ShapeOrderEditor.js`と同じ内容））を追加。
*   **`_doc/arch/14_edit.md`**：`ShapeOrderRules.js`（公開：`ShapeOrderOperation`・`reorderSelected`・`canReorderSelected`。importなし・DOMなし・状態なし・要素を不透明に扱う。使う側は`ShapeOrderEditor`と`main.js`（定数のみ））と`ShapeOrderEditor.js`（公開メソッド`apply`・`getAvailability`、呼び出し元は`main.js`（`performShapeOrder`・`syncPropertyOrderSection`）、依存（`model`は`getShapes`・`isSelected`・`reorderShapes`のみ、`editRecorder`は注入、importは`./ShapeOrderRules.js`のみ）、契約（並びが変わらない操作では何もせず記録しない・履歴へは1件・ドラッグ中でないことは呼び出し側・進行中の入力操作の中断・モード切り替えは行わない）、二重定義（typedef`ShapeOrderAvailability`は`palette/PropertyOrderSection.js`と同じ内容））の項を追加。「依存」の段落の例外の列挙に`ShapeOrderEditor` → `./ShapeOrderRules.js`を追加。冒頭の「流れは3章6.〜9.・11.〜13.」を「11.〜14.」へ。
*   **`_doc/arch/16_test.md`**：既存のテストファイルと検証範囲に`test/edit/ShapeOrderRules.test.js`・`test/core/VectorModel.reorderShapes.test.js`・`test/edit/ShapeOrderEditor.test.js`を追加。実物の組み合わせの例外に`test/edit/ShapeOrderEditor.test.js`（実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`ShapeOrderEditor`、保存の往復のため`DocumentSerializer`・`SpriteSerializer`）を追加。テストできない箇所（06-04の追加）として`PropertyOrderSection`（DOM）・`main.js`の重なり順の配線（`performShapeOrder`のドラッグ中の不受理・`syncPropertyOrderSection`）・`index.html`の段・`KeyboardShortcuts`の4つのキー（押しっぱなし・入力欄の規則を含む）を追加。書き換えた既存のテスト（06-04）を記録（計画時点では無し）。保存の往復を`io/`のテストに足さなかった根拠（2章要件6）を1行で残す。

## 3. タスクリスト
*   [x] タスク1: 並べ替えの規則（`edit/ShapeOrderRules.js`）とそのテスト
    *   **対象ファイル** :
        *   `./js/edit/ShapeOrderRules.js` : 新規
        *   `./test/edit/ShapeOrderRules.test.js` : 新規
    *   **作業内容** :
        *   2章要件1のとおり、先頭行の責務（3行以内。例「責務：選択中の要素の重なり順（並び）の変更の規則（最前面へ・前へ・後ろへ・最背面へ）を、状態を持たずDOMに触れない関数として担う。」）、`ShapeOrderOperation`、`reorderSelected`、`canReorderSelected`を作る。何もimportしない。規則の文面（4操作の走査の向き・隣の1つ分・離れた選択はまとめない・連続した選択は一緒に動く・相対的な順を保つ・未知の操作は`Error`）と、要件1の例をJSDocに書く。各関数・定数にJSDoc（`@param`・`@returns`・`@throws`）を書く。並べ替えの判定を他の関数へ重複して書かない（`canReorderSelected`は`reorderSelected`の結果との比較のみ）。
        *   テスト：2章要件6の`test/edit/ShapeOrderRules.test.js`の観点をすべて入れる。補助関数（`Set`から`isSelected`を作る等）にもJSDocを書く。
        *   プロジェクトのルートで`node --test`を実行し、`fail 0`と件数を詳細作業内容に記録する。詳細作業内容を記入し、本タスクを`[x]`にする。開発資料に影響があれば更新予定欄へ追記する。
*   [ ] タスク2: `VectorModel.reorderShapes`とそのテスト
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` : 更新（公開メソッドの追加）
        *   `./test/core/VectorModel.reorderShapes.test.js` : 新規
    *   **作業内容** :
        *   2章2-1のとおり`reorderShapes(orderedIds)`を`replaceShape`の後（`onChange`の前）に足す。JSDoc（処理の順序、不正な入力の条件と扱い（`console.warn`・`false`・何も変えない）、同じ並びでは通知しないこと、変わったときだけ1回通知、触れない状態の列挙（選択集合・ホバー・作成中の図形・選択矩形・吸い付きの表示の点・直前に使った値・idの採番・図形インスタンスの中身）、履歴の記録は呼び出し側の責務、操作の種類を受け取らない理由、`@param`・`@returns`）を書く。他のメソッド・先頭の責務の記述・クラスJSDocは変えない（責務の範囲内のため。クラスJSDocに公開操作の列挙は無い）。`edit/`をimportしない。
        *   テスト：2章要件6の`test/core/VectorModel.reorderShapes.test.js`の観点をすべて入れる（図形は`Line`等を`id`の直接代入で作り`replaceAllShapes`で入れる。`console.warn`は`t.mock.method`で抑止し呼び出し回数を確かめる）。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。開発資料に影響があれば更新予定欄へ追記する。
*   [ ] タスク3: 重なり順の変更の手順（`edit/ShapeOrderEditor.js`）とそのテスト
    *   **対象ファイル** :
        *   `./js/edit/ShapeOrderEditor.js` : 新規
        *   `./test/edit/ShapeOrderEditor.test.js` : 新規
    *   **作業内容** :
        *   2章2-2のとおり、先頭行の責務（3行以内。例「責務: 選択中の図形の重なり順の変更を、並べ替えの規則（`./ShapeOrderRules.js`）で求めた並びに従ってモデルへ反映する1件の編集操作と、各操作で並びが変わるかの照会を担う。DOMに触れない。」）、typedef`ShapeOrderAvailability`（`palette/PropertyOrderSection.js`と同じ内容の二重定義である旨を明記）、クラス`ShapeOrderEditor`（コンストラクタ・`apply`・`getAvailability`）を作る。importは`./ShapeOrderRules.js`のみ。クラスJSDocに依存の制約（`model`は`getShapes`・`isSelected`・`reorderShapes`のみ、`InputTracker`に依存しない、DOMなし、`try/catch`なし、図形種別・図形固有のプロパティ名・id形式・操作モードを知らない（読むのは共通プロパティ`id`のみ））と前提（ドラッグ中でないことは呼び出し側、選択モード以外・読み込み中は選択集合が空のため何もしない、進行中の入力操作の中断・モード切り替えを行わない）を書く。各メソッドにJSDoc（処理順・`@param`・`@returns`・`@throws`）。
        *   テスト：2章要件6の`test/edit/ShapeOrderEditor.test.js`の観点をすべて入れる（偽物の手順・実物の組み合わせ・保存の往復）。`PathJoiner.test.js`の形を参考にする。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。開発資料に影響があれば更新予定欄へ追記する。
*   [ ] タスク4: 「重なり順」の段のUI部品（`palette/PropertyOrderSection.js`）
    *   **対象ファイル** :
        *   `./js/palette/PropertyOrderSection.js` : 新規
    *   **作業内容** :
        *   2章3-2のとおり、先頭行の責務（3行以内。例「責務：プロパティパネルの「重なり順」の段（`#property-order-section`）の4つのボタンの押せる/押せないの表示と、押下のコールバックへの通知を担う。選択状態・並べ替えの規則には関与しない。DOM操作専任。」）、typedef`ShapeOrderAvailability`（`edit/ShapeOrderEditor.js`と同じ内容の二重定義である旨を明記）・`PropertyOrderSectionActions`、ボタンの対応表、クラス`PropertyOrderSection`（コンストラクタ・`render`）を作る。importを持たない。クラスJSDocに段の構成（ルート要素は自分の`<section>`・要素はルート要素内の`querySelector('#id')`で解決・既存の段を変えない）と知らないことを書く。各メソッド・private項目にJSDoc。
        *   この時点では`main.js`から使われない（画面は変わらない）。`node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。開発資料に影響があれば更新予定欄へ追記する。
*   [ ] タスク5: `index.html`に「重なり順」の段を足す
    *   **対象ファイル** :
        *   `./index.html` : 更新（段・ボタン・スタイル・コメント）
    *   **作業内容** :
        *   2章3-1のとおり、`#property-shape-section`の後に`#property-order-section`（見出し「重なり順」・`.order-button-grid`に4ボタン・`title`にキー・`disabled`で始める）を足し、`.order-button-grid`のスタイル（コメント付き）を`.property-row input[type="color"]`の後に足す。`#window-property-panel`のコメントの高さ・下端の記述と、`.property-section + .property-section`のコメントを更新する。「図形」の段・他のウィンドウ・他のスタイルは変えない。
        *   この時点ではボタンは`disabled`のまま押せない（配線はタスク6）。`node --test`の`fail 0`と件数を記録し、詳細作業内容（見積もった高さ・下端の値と式）を記入して`[x]`にする。開発資料に影響があれば更新予定欄へ追記する。
*   [ ] タスク6: `main.js`の配線（「重なり順」の段とキーのコールバック）
    *   **対象ファイル** :
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   2章3-3のとおり、import 3行、`// 7.8.`のブロック（`ShapeOrderEditor`の生成・`performShapeOrder`・`PropertyOrderSection`の生成・`syncPropertyOrderSection`と`model.onChange`への登録。ブロックの先頭コメントに、表示は`PropertyOrderSection`・手順は`ShapeOrderEditor`・規則は`ShapeOrderRules`が持ちここは生成・注入・同期のみ、同期は`model.onChange`のみ、段を足すときの形は`// 7.7.`と同じ、を書く）、`KeyboardShortcuts`への4つのコールバック、起動時の`syncPropertyOrderSection()`の1回の呼び出しを足す。`performShapeOrder`・`syncPropertyOrderSection`にJSDocを書く。判定・並べ替えのロジックを`main.js`に持ち込まない（ドラッグ中の判定のみ。`performJoin`と同じ）。`// 7.7.`のブロック・既存の配線は変えない。
        *   この時点では`KeyboardShortcuts`の対応表に4つのキーが無く、注入した4つのコールバックは呼ばれない（コンストラクタは余分なコールバックを検査しないため起動時の例外は起きない）。ボタンはこのタスクで働くようになる。
        *   `node --test`の`fail 0`と件数を記録し、実装後の`main.js`の行数を詳細作業内容に記録する（開発資料の「行数」の更新に使う）。詳細作業内容を記入して`[x]`にする。開発資料に影響があれば更新予定欄へ追記する。
*   [ ] タスク7: `KeyboardShortcuts`の対応表に4つのキーを足す
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` : 更新
    *   **作業内容** :
        *   2章要件4のとおり、`SHORTCUT_BINDINGS`の`join`の後に4エントリ（コメント付き）を足し、typedef`ShortcutActions`に`bringToFront`・`bringForward`・`sendBackward`・`sendToBack`（戻り値の意味：並びを変えた場合のみtrue）を足す。判定順序・`#findBinding`・既存のエントリ・`import`は変えない。`edit/`をimportしない。
        *   `index.html`の4ボタンの`title`（`最前面へ (Home)`・`前へ (PageUp)`・`後ろへ (PageDown)`・`最背面へ (End)`）と対応表が一致することを確かめる。タスク6で`main.js`が4つのコールバックを渡していることを確かめる（欠けると起動時に`Error`）。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。開発資料に影響があれば更新予定欄へ追記する。
*   [ ] タスク8: JSDocの記載漏れの確認
    *   **対象ファイル** :
        *   タスク1〜7で変更・新設したファイル（確認のみ。漏れがあればそのファイルを修正）
    *   **作業内容** :
        *   新設・変更したクラス・メソッド・関数・typedefのJSDoc（`@param`・`@returns`・`@throws`）、新設ファイル（`ShapeOrderRules.js`・`ShapeOrderEditor.js`・`PropertyOrderSection.js`・新設テスト3ファイル）の先頭行の責務（3行以内）、`VectorModel.reorderShapes`のJSDocの触れない状態の列挙、typedef`ShapeOrderAvailability`の二重定義の明記（2ファイルで同じ内容）、`KeyboardShortcuts`の対応表とボタンの`title`の一致（`Home`・`PageUp`・`PageDown`・`End`）、`ShortcutActions`の4つの戻り値の記述、`main.js`の`performShapeOrder`・`syncPropertyOrderSection`のJSDocを確認する。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。
*   [ ] タスク9: 開発資料への反映（最終タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（1章・3章。4章の一覧は変更なしの見込み）
        *   `./_doc/arch/01_index_html.md` : 更新
        *   `./_doc/arch/02_main.md` : 更新
        *   `./_doc/arch/03_VectorModel.md` : 更新
        *   `./_doc/arch/07_KeyboardShortcuts.md` : 更新
        *   `./_doc/arch/13_palette.md` : 更新
        *   `./_doc/arch/14_edit.md` : 更新
        *   `./_doc/arch/16_test.md` : 更新
    *   **作業内容** :
        *   2章「開発資料の更新予定」の各項目（タスク実行中に追記された項目を含む）を、`PROJECT_ARCHITECTURE.md`冒頭の記載基準（1つのファイルのJSDocを読めば分かることは書かない・責務と境界・流れ・設計判断の理由・やらないと決めたことを残す）に従って反映する。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、本最終タスクのみ明示的な例外とする（後続タスクが無く、他タスクの前提が動く危険が無いため）。
        *   `node --test`の`fail 0`と件数を記録し、詳細作業内容を記入して`[x]`にする。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 並べ替えの規則（`edit/ShapeOrderRules.js`）とそのテスト
*   **作業内容** :
    *   対象ファイル：`./js/edit/ShapeOrderRules.js`（新規）、`./test/edit/ShapeOrderRules.test.js`（新規）。
    *   `ShapeOrderRules.js`：先頭に責務、`ShapeOrderOperation`（凍結・`@enum`）、`reorderSelected`、`canReorderSelected`を実装。importなし。未知の操作の判定は非公開関数`assertKnownOperation`に集約（`reorderSelected`冒頭で呼ぶ。空配列でもthrow）。`canReorderSelected`は`reorderSelected`の結果との`!==`比較のみ。規則の文面と要件1の例をJSDocに記載。
    *   追加仕様：`ShapeOrderOperation`のJSDocに、値が`ShapeOrderAvailability`のキーと`PropertyOrderSection`の対応表のキーにも使われるため、変えるときは両方を揃える旨を明記（値・設計は不変）。
    *   テスト：4操作×（単一・連続・離れた・端・選択なし・全選択・0個）、要件1の全例、相対順の保持・`canReorderSelected`との一致（全ケース×4操作）、引数不変・新配列、`isSelected`1回ずつ、未知操作のError（0個でも）、`ShapeOrderOperation`の値と凍結。
    *   `node --test`（プロジェクトルート）：tests 953 / pass 953 / fail 0。
    *   開発資料への影響：新設ファイル`edit/ShapeOrderRules.js`・`test/edit/ShapeOrderRules.test.js`は、既存の更新予定欄（タスク9）のとおりで追加の影響なし。

### タスク2: `VectorModel.reorderShapes`とそのテスト
*   **作業内容** :
    *   （未記入）

### タスク3: 重なり順の変更の手順（`edit/ShapeOrderEditor.js`）とそのテスト
*   **作業内容** :
    *   （未記入）

### タスク4: 「重なり順」の段のUI部品（`palette/PropertyOrderSection.js`）
*   **作業内容** :
    *   （未記入）

### タスク5: `index.html`に「重なり順」の段を足す
*   **作業内容** :
    *   （未記入）

### タスク6: `main.js`の配線（「重なり順」の段とキーのコールバック）
*   **作業内容** :
    *   （未記入）

### タスク7: `KeyboardShortcuts`の対応表に4つのキーを足す
*   **作業内容** :
    *   （未記入）

### タスク8: JSDocの記載漏れの確認
*   **作業内容** :
    *   （未記入）

### タスク9: 開発資料への反映
*   **作業内容** :
    *   （未記入）

## 5. 懸念事項・要確認ポイント

### 計画時の判断・注意
*   **`reorderShapes`は並び全体（id）で受け取る**：操作の種類を`VectorModel`へ渡さないため、図形の一覧のPhaseで一覧のドラッグによる並べ替え（任意の並び）にもそのまま使える。一覧から使うときは、(1) 履歴の記録（`beginEdit`/`commitEdit`）を呼び出し側で挟むこと、(2) ドラッグ中（キャンバスの`inputTracker.isDragging()`）の扱いを決めること、(3) 並びが変わらない場合は`reorderShapes`が`false`を返し通知しないこと、(4) 選択集合を変えないこと（一覧で並べ替えたときに選択も変えるなら別の公開操作を呼ぶ）に注意する。
*   **規則の置き場所**：`edit/ShapeOrderRules.js`は要素を不透明に扱う一般的な関数のため、一覧のPhaseで「選択中の図形を一覧の上で動かす」操作にも再利用できる。一覧のドラッグ（任意の位置への移動）の規則を足す場合も、このファイルへ足して`canReorderSelected`と同じく判定を1か所に保つこと。
*   **何もしない場合の保証**：`ShapeOrderEditor.apply`は`canReorderSelected`が偽なら`beginEdit`を呼ばない（`HistoryManager.commitEdit`の作業データの比較による「記録しない」に頼らない）。`reorderShapes`も同じ並びなら通知しないため、何もしない操作では`model.onChange`・`historyManager.onChange`とも通知されない。
*   **押せる/押せないの計算量**：`syncPropertyOrderSection`は`model.onChange`ごと（ホバー・ドラッグの途中経過を含む）に4操作分の規則を計算する（図形の数に比例）。結合ボタンの`syncJoinButtonState`と同じ形で、図形の数が少ない今は問題にならない見込み。図形が極端に多いキャンバスでドラッグが重くなったら見直す。
*   **キーボードの`Numpad`**：`NumLock`を切った状態のテンキーの`1`（`End`）・`9`（`PageUp`）・`3`（`PageDown`）・`7`（`Home`）は`event.code`が`Numpad1`等のため、重なり順の操作にならない（`Numpad1`〜`Numpad5`は既存どおり図形種別の切り替え）。キーは`event.code`で識別する既存の規則のまま変えない。
*   **何もしなかったときのブラウザ標準の動作**：コールバックが`false`のとき`preventDefault()`しないため、フォーカスがキャンバスパレットの一覧（`.canvas-list`。縦スクロールする）の中のボタンにあると、`PageUp`等で一覧がスクロールし得る。`join`の`J`と同じ扱い（受理したときだけ`preventDefault()`）を優先した。ページ全体は`body`の`overflow: hidden`でスクロールしない。
*   **押せないボタンの`title`**：ブラウザによっては`disabled`のボタンの上で`title`のツールチップが出ない。キー割り当ては押せる状態のときに確かめられる。
*   **ハンドルと重なり順**：ハンドルは全図形の描画後にまとめて描くため（`_doc/COWORK_STATUS.md` 2章Bの件。本作業では変えない）、最背面へ移した図形のハンドルも手前の図形の上に描かれる。ホバーの強調（`drawHover`）は図形の直後に描かれるため、奥へ移した図形の強調は手前の塗りに隠れることがある（今の振る舞いのまま）。
*   **色の欄のピッカー操作中の押下**：ボタンを押すとフォーカスが移り、色の欄の`blur`で先に色の変更が1件として確定してから重なり順の変更が記録される見込み（`PROJECT_ARCHITECTURE.md`3章13.「確定前に他の操作が起きた場合」の対象外）。テストプレイで確かめる。
*   **REQからの逸脱**：無し（計画時点）。`index.html`のボタンに`disabled`を初期値として書くのは、入力欄の値の「初期値は書かない」規則ではなく結合ボタンの前例に従う判断（2章3-1）。

### テストプレイで確認すべき項目（操作手順 → 期待する結果）
*   **DIRの実装要件**：
    1.  矩形・円・閉じたパスを重ねて描き（塗りを付ける）、1つを選んで「最前面へ」「前へ」「後ろへ」「最背面へ」を順に押す → キャンバスの重なりがそのとおりに変わる。
    2.  重なり順を変えたキャンバスを「出力（作業ファイル）」→「開く」で開き直す → 変えた重なり順のまま描かれる。ページを再読み込みして自動保存されたキャンバスを開き直す → 変えた重なり順のまま描かれる。
    3.  重なり順を変えたキャンバスを「出力（エンジン用）」で書き出し、`sprite-check.html`で開く → エディタと同じ重なり順で描かれる。
    4.  重なり順を変えた直後に「取り消し」（`Ctrl`+`Z`）1回 → 元の並びに戻る（選択中の図形は選ばれたまま）。「やり直し」1回 → 変えた並びに戻る。
    5.  何も選んでいない状態で4つのキー（`Home`・`PageUp`・`PageDown`・`End`）を押す → アプリは停止せず、図形・履歴（取り消しボタンの状態）は変わらない。最前面にある図形を選んで「最前面へ」「前へ」（キー）→ 何も変わらない。最背面にある図形で「最背面へ」「後ろへ」→ 何も変わらない。
*   **4つの操作の規則**：
    6.  単一選択：4つ重ねた図形の2番目（奥から）を選んで「前へ」→ 3番目の上に出る（隣の1つ分だけ。重なっていない図形も1つと数える）。「後ろへ」→ 元に戻る。「最前面へ」→ 一番手前。「最背面へ」→ 一番奥。
    7.  離れた複数選択：5つの図形`A`〜`E`（奥から）で`B`と`D`を選んで「前へ」→ 並びが`A, C, B, E, D`になる（`B`と`D`がそれぞれ1つずつ手前へ動き、まとまらない）。「後ろへ」で戻る。「最前面へ」→ `A, C, E, B, D`（選んだ図形どうしの順は保つ）。「最背面へ」→ `B, D, A, C, E`。
    8.  連続した複数選択が端にある：手前の2つを選んで「前へ」→ 変わらない（ボタンは押せない表示）。
*   **押せる/押せないの表示**：
    9.  何も選んでいない・図形作成モード・キャンバス移動モード → 4つとも押せない表示。
    10. 最前面の図形を選ぶ → 「最前面へ」「前へ」は押せず、「後ろへ」「最背面へ」は押せる。最背面の図形は逆。図形が1つだけのキャンバスでその図形を選ぶ → 4つとも押せない。全選択（`Ctrl`+`A`）→ 4つとも押せない。
    11. 並べ替えの後・取り消し/やり直しの後・選択を変えた後に、表示がすぐ追従する。
*   **キー**：
    12. 図形を選んで`Home`・`PageUp`・`PageDown`・`End` → それぞれ最前面へ・前へ・後ろへ・最背面へと同じ結果。`Shift`・`Ctrl`・`Alt`を押しながらでは働かない。
    13. 図形を選んで`PageUp`を押しっぱなし → 1つずつ繰り返し手前へ動き、最前面で止まる（アプリは停止しない）。`PageDown`も同様。`Home`・`End`の押しっぱなしでは繰り返さない（1回だけ）。
    14. 押しっぱなしで動かした後に取り消し → 1回の取り消しで1つ分ずつ戻る（キーリピート1回＝1件）。
    15. 太さの欄にフォーカスがある状態で4つのキー → 図形の重なり順は変わらない（欄の標準の動作のまま）。線・塗りのチェックボックス、色の欄にフォーカスがある状態で4つのキー → 重なり順は変わらない。
*   **クリック・ホバー**：
    16. 塗った2つの図形を重ね、奥の図形を「最前面へ」→ 重なっている所をクリックすると、新しく手前になった図形が選ばれる。ホバーの強調も手前の図形に出る。塗りのない図形どうしの輪郭の重なる所でも、新しい並びで手前の図形が選ばれる。
*   **ドラッグ中・モード**：
    17. 図形作成モード・キャンバス移動モード中に4つのキーを押す → 何も起きない（選択集合が空のため）。
    18. 図形を選んだまま中ボタンでパンしながら「前へ」ボタンを左クリック → 何も起きない（ドラッグ中は受理しない）。
*   **画面の配置**：
    19. 1280×800の画面で、プロパティパネルが画面に収まり（「重なり順」の段の4ボタンが2×2で1行の文字のまま収まる）、コントロールパネル・図形選択パレット・開いた状態のキャンバスパレットと重ならない。`?dev`の確認用ウィンドウとも重ならない。
    20. 各ボタンの上にカーソルを置くと`title`にキー（`Home`・`PageUp`・`PageDown`・`End`）が表示される（押せる状態で確かめる）。
*   **既存の振る舞い**：
    21. 図形の作成・選択（クリック・範囲選択・全選択）・移動・変形・削除・結合・描き足し・端点への吸い付き・コピー/貼り付け/複製・取り消し/やり直し・プロパティパネルの「図形」の段（線・塗り・太さ・色）が、これまでと同じに動く。
    22. 色の欄のピッカーを開いて色を動かしている途中で「重なり順」のボタンを押す → アプリは停止しない。取り消しで色の変更と重なり順の変更がそれぞれ1件ずつ戻る（色の変更が重なり順の変更に混ざらない）ことを確かめる。
    23. キャンバスの読み込み中（起動直後）に4つのキーを押す → 何も起きない。
