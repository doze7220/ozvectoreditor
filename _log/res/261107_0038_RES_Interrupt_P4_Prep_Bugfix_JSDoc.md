# RES: 作業計画・作業レポート (Interrupt) : P4前の不具合修正（E-1〜E-8）とJSDoc・用語の修正
* 参照元REQ: `./_log/req/261107_0038_REQ_Interrupt_P4_Prep_Bugfix_JSDoc.md`

## 1. 作業目的
P4（薄い書き出し）へ進む前に、実測で確認された不具合E-1〜E-8を修正し、続けてJSDoc・用語の誤り（`_doc/COWORK_STATUS.md`2章D。全項目を本RES要件8へ転記済みのため、タスク実行時に同ファイルを読む必要はない）を直す。

守るべき動作（E-2・E-3）：**保存に失敗した変更は、利用者が明示的に捨てない限り失われない。**

発注者の決定（変更不可）：
| 項目 | 決定 |
| --- | --- |
| E-2：保存できない状態が続くとき | 別のキャンバスへの移動（開く・新規作成・開く（ファイル））は止めるだけ。変更を捨てて移るための確認の小窓は**足さない**。「書き出し」でファイルへ逃がせる。再読み込み・タブを閉じるときだけ`beforeunload`の確認を出す |
| E-3：開いているキャンバスは保存済みで、新しい記録の書き込みだけが失敗したとき | 確認の小窓「新しいキャンバスを保存できませんでした。保存しないまま開きますか？」。「いいえ」：新しいキャンバスを作らず（一覧にも残さず）開いているキャンバスのまま。「はい」：保存されていないキャンバスを開き、保存できるまで別のキャンバスへは移れない |
| E-7：弧の向き | ボタンの絵`◠`が正しい。**描画を画面の上半分へ変える**（保存済みの弧も上下が逆に表示されることは了承済み。`index.html`は変えない。作業データ形式の版は上げない） |
| E-8：つぶれた円・弧 | **クリックでも選べる**ようにそろえる（範囲選択の動きは変えない） |

範囲外：新機能の追加、Phase 03-05のテストプレイの項目の完了扱い、`index.html`の変更、`DocumentSerializer`の版の変更、`#segmentIntersectsRect`・`#validateData`の重複の解消、型定義の二重化の解消、開発資料・`_doc/COWORK_STATUS*.md`の更新（現場設計AIが行う）。

動作確認（ブラウザ）は現場設計AIが行う。実装AIは変更した各ファイルに`node --check <パス>`を実行して構文のみ確かめる（このリポジトリのES Modulesの`.js`でそのまま動くことを計画時に確認済み）。

## 2. アーキテクチャ設計
行番号は計画時点のもの。作業時点の内容へ読み替えること。コードの骨子は設計の意図を示すもので、JSDocを省いている（実装ではJSDocを必ず書く）。

### 要件1: E-2 保存に失敗した変更を保持する（`js/edit/CanvasLibrary.js`）
**状態の表現**
| 状態 | 表現 | 真になる／消える契機 |
| --- | --- | --- |
| 保留（まだ確定していない保存がある） | `#pendingSaveCanvasId`が非`null`。タイマーがあれば待ち時間中、タイマーが無ければ失敗後の再試行待ち、または記録を書けずに開いたキャンバス（要件2） | 設定：`#scheduleSave`・最新の書き込みの失敗・`#enterCanvas`（記録を書けずに開いたとき）。消える：`#saveOpenCanvasNow`の開始（失敗すれば再設定）・`#enterCanvas`の手順6・開いているキャンバスの削除の開始 |
| 未保存（ページを離れると失われる変更がある） | 新しいprivateフィールド`#hasUnsaved`（`boolean`）。`hasUnsavedChanges()`が返す | 真：最新の書き込みの失敗・記録を書けずに開いた・`'unavailable'`で編集があった。偽：有効な書き込みの成功・`#enterCanvas`の手順6（記録を書けずに開いた場合を除く）・開いているキャンバスの削除の開始 |

タイマー待ちの変更は`pagehide`の`flushPendingSave()`で書かれるため、未保存に含めない（REQの定義どおり）。書き込み中の再試行は、結果が出るまで未保存のまま（真のまま）である。

**`flushPendingSave()`**（現在の判定`#pendingSaveTimer !== null`を変える）
```js
flushPendingSave() {
    if (this.#pendingSaveCanvasId !== null) {
        return this.#saveOpenCanvasNow();   // タイマーの有無によらず書き込み、その結果を返す
    }
    if (this.#inFlightSave !== null) {
        return this.#inFlightSave;
    }
    return Promise.resolve(true);
}
```

**`#saveOpenCanvasNow()`の完了処理**（失敗時にタイマーでの自動再試行はしない。再試行の契機は次の編集・切り替え・ページ非表示時）
```js
const saving = writing.then(
    () => {
        const isCurrent = this.#isCurrentWrite(saving, canvasId);
        this.#finishInFlightSave(saving);
        if (isCurrent) {
            this.#hasUnsaved = false;
            if (this.#issue === 'writeFailed') {
                this.#setIssue(null);
                this.#notifyChange();
            }
        }
        return true;
    },
    (error) => {
        const isCurrent = this.#isCurrentWrite(saving, canvasId);
        this.#finishInFlightSave(saving);
        console.warn('CanvasLibrary: キャンバスの自動保存に失敗しました。', canvasId, error);
        if (isCurrent) {
            this.#pendingSaveCanvasId = canvasId;
            this.#hasUnsaved = true;
            this.#setIssue('writeFailed');
            this.#notifyChange();
        }
        return false;
    }
);
```
`#isCurrentWrite(saving, canvasId)`（新設のprivate）は`this.#inFlightSave === saving && canvasId === this.#openCanvasId && !this.#isSwitching`を返す。**必ず`#finishInFlightSave`より前に評価する**（後だと`#inFlightSave`が`null`になっていて常に偽になる）。各条件の理由：
*   `#inFlightSave === saving`：REQ指定。古い書き込みの失敗で新しい成功を打ち消さない。成功側にも適用する：`putRecord`の同期例外・E-6の`serialize`例外は即座にrejectされるため、先に書き始めた古い書き込みの成功が後から届くことがあり、新しい失敗の記録を消してはならない。
*   `!#isSwitching`：**削除の順序保証のために必須**。開いているキャンバスの削除の`await`中に、削除前に書き始めた書き込みの失敗で保留を記録すると、その間のページ非表示で`flushPendingSave()`が削除より後に書き込み、削除した記録が復活する。削除が失敗した場合は`#deleteOpenCanvas`が`#scheduleSave()`で予約し直すので変更は失われない。
*   `canvasId === #openCanvasId`：別のキャンバス宛ての書き込みの結果で、開いているキャンバスの状態を変えない（通常の切り替えは書き込み中の保存を待つため、起こり得るのは削除後のみ）。

**`#scheduleSave()`**
```js
if (this.#openCanvasId === null || this.#isSwitching) { return; }
if (this.#issue === 'unavailable') { this.#hasUnsaved = true; return; }
// 以下は現行どおり（タイマーの張り直しと#pendingSaveCanvasIdの設定）
```
`#isSwitching`の判定を先に置くことで、切り替え中の通知（手順5の`clear()`）では立たない。

**確定手順と手順4（`#settleAndEnter`を新設）**：手順3の完了後・手順4の直前に置く非同期の確定手順。**確定手順を抜けてから手順4へ入る間に`await`を挟まないよう、確定手順と`#enterCanvas`の呼び出しを1つのメソッドにまとめる**（確定手順だけを`async`メソッドにして呼び出し側で`await`すると、その`await`が間に入るため、分けてはならない）。
```js
async #settleAndEnter(summary, shapes, loadIssue, isRecordWritten = true) {
    try {
        for (;;) {
            this.#prepareSwitch();
            if (this.#pendingSaveCanvasId === null && this.#inFlightSave === null) {
                break;
            }
            if (!(await this.flushPendingSave())) {
                return false;   // 'writeFailed'は#saveOpenCanvasNowが設定済み
            }
        }
    } catch (error) {
        console.warn('CanvasLibrary: 切り替え前の保存の確定で予期しないエラーが発生しました。', error);
        return false;           // この手順の例外は中止として扱う
    }
    this.#enterCanvas(summary, shapes, loadIssue, isRecordWritten);   // awaitを挟まない
    return true;
}
```
*   `#enterCanvas`の呼び出しは`try`の外に置く（手順4以降の例外を「中止」扱いにしない。従来どおり呼び出し側の`catch`へ渡す）。
*   通るのは開く・新規作成・開く（ファイル）のみ。起動時の復元・削除後の切り替えは`#enterCanvas`を直接呼ぶ（起動時は開いているキャンバスが無く、削除後は`#isSwitching`で予約が止まっていて保留が無いため）。
*   `openCanvas`：現在の`this.#enterCanvas(summary, result.shapes, ...); return true;`を`return await this.#settleAndEnter(summary, result.shapes, result.skipped.length > 0 ? 'partialLoad' : null);`へ変える。

**`#enterCanvas(summary, shapes, loadIssue = null, isRecordWritten = true)`**
*   手順4から「`if (this.#pendingSaveTimer !== null) { void this.#saveOpenCanvasNow(); }`」を削除する。`prepareSwitch()`→`#isSwitching = true`の順は変えない（`#isSwitching`の区間の規則を崩さない）。
*   手順6（`#openCanvasId`の更新の直後）に次を置く（`await`を挟まない）：
```js
if (this.#pendingSaveTimer !== null) {
    clearTimeout(this.#pendingSaveTimer);
    this.#pendingSaveTimer = null;
}
this.#pendingSaveCanvasId = isRecordWritten ? null : summary.id;
this.#hasUnsaved = !isRecordWritten;
```

**開いているキャンバスの削除（`#deleteOpenCanvas`）**：保留の破棄（現行の(2)）と同時に未保存も破棄する。**削除に失敗したら未保存を元に戻す**（確認の小窓で捨てることを選んだが実際には捨てられておらず、キャンバスが開いたまま残るため。再予約の待ち時間中にページを閉じる場合に備える）。
```js
const hadUnsaved = this.#hasUnsaved;
// (2) タイマーの解除・#pendingSaveCanvasId = null（現行どおり）
this.#hasUnsaved = false;
// (3) #isSwitching = true / (4) 記録の削除。失敗時：
//     #isSwitching = false → warn → 'writeFailed' → this.#hasUnsaved = hadUnsaved → this.#scheduleSave() → return false
```

**公開メソッド`hasUnsavedChanges()`**：`#hasUnsaved`を返す（同期で`boolean`）。`getState()`・typedef`CanvasLibraryState`には足さない。

**崩さないこと**：`#isSwitching`を真・偽にする箇所を増やさない。開いていないキャンバスの削除は保留・未保存に触れない。

**動作確認の観点**：`IDBObjectStore.prototype.put`を例外にして、(a)編集→保存失敗→別のキャンバスを2回続けて開こうとしても移れず変更が残る (b)`put`を戻して再度開くと保存されて移れる (c)手順3の`await`中の編集の保存が失敗しても移らない (d)`put`を戻さないまま削除の確認で「OK」→削除後に記録が復活しない (e)失敗後に再読み込みで`beforeunload`が出る。

### 要件2: E-3 新しい記録を書けないとき（`js/edit/CanvasLibrary.js`・`js/main.js`・`js/palette/CanvasPalette.js`）
**`CanvasLibrary`のコンストラクタ**：注入関数`confirmOpenUnsaved: () => boolean`を追加し、`#confirmOpenUnsaved`へ保持する。関数でなければ既存の注入関数と同じく`Error`を投げる（検査は既存の`if`へ統合し、文言にも足す）。本クラスはDOMに触れない。

**`#createAndEnter(loadIssue, rawName = null, shapes = [], isUserOperation = false)`**（戻り値を`Promise<boolean>`＝開いたか、へ変える）
```js
const summary = { /* 現行どおり */ };
this.#summaries.set(summary.id, summary);
let isRecordWritten = true;
let issueAfterEnter = loadIssue;
try {
    await this.#storage.putRecord({ /* 現行どおり */ });
} catch (error) {
    console.warn('CanvasLibrary: 新しいキャンバスの記録に失敗しました。', summary.id, error);
    this.#setIssue('writeFailed');
    issueAfterEnter = null;
    isRecordWritten = false;
}
if (!isUserOperation) {
    // 起動時・削除後：開く先が他に無いため確認せずに開き、未保存として保持する
    this.#enterCanvas(summary, shapes, issueAfterEnter, isRecordWritten);
    return true;
}
if (!isRecordWritten && !this.#askOpenUnsaved()) {
    this.#summaries.delete(summary.id);   // 開いているキャンバス・図形一式・履歴はそのまま
    return false;
}
if (await this.#settleAndEnter(summary, shapes, issueAfterEnter, isRecordWritten)) {
    return true;
}
// 確定手順で中止：登録した要約を除き、書き込み済みの新しい記録を削除する
this.#summaries.delete(summary.id);
if (isRecordWritten) {
    try {
        await this.#storage.deleteRecord(summary.id);
    } catch (error) {
        console.warn('CanvasLibrary: 中止したキャンバスの記録を削除できませんでした。', summary.id, error);
    }
}
return false;
```
*   `#askOpenUnsaved()`（新設のprivate）：`#confirmOpenUnsaved()`の結果を`boolean`で返す。例外は捕捉して`console.warn`し`false`とする（例外が`createCanvasFromShapes`の`catch`まで飛ぶと、要約が一覧に残るため）。
*   `createCanvasFromShapes`：`await this.#createAndEnter(null, rawName, shapes); return true;`を`return await this.#createAndEnter(null, rawName, shapes, true);`へ変える。`createCanvas()`は委譲のまま。
*   `#openFirstLoadable`の呼び出し`await this.#createAndEnter(hadFailure ? 'loadFailed' : null)`は変えない（`isUserOperation`は`false`）。起動時の`#createAndEnter`では`confirmOpenUnsaved`は呼ばれない。
*   「はい」で開いたキャンバスは`#enterCanvas`の手順6で保留（タイマー無し）・未保存となる。離れようとすると手順2の`flushPendingSave()`が記録全体を書き込み（名前は要約、図形は`model.getShapes()`。開く（ファイル）の図形も保持される）、失敗なら中止する。`'writeFailed'`は手順6で解除されない（現行どおり）。
*   `CanvasFileOperations.openFile`は変更しない：`false`かつ`issue`が`'writeFailed'`のときは通知を出さないため、「いいえ」でも正しく動く。

**`CanvasPalette`**
*   公開メソッド`confirmOpenUnsaved()`を追加する：`return window.confirm('新しいキャンバスを保存できませんでした。保存しないまま開きますか？');`。文言はパレットが持つ。配線の有無（`#isWired`）によらず動く。クラスJSDocの「■ 操作」にも1行足す。
*   `ISSUE_MESSAGES.writeFailed`を`'保存に失敗しました。最新の変更は保存されていない可能性があります。「書き出し」でファイルに残せます。'`とする。

**`main.js`**（ブロック`// 7.6.`）
*   `new CanvasLibrary({...})`へ`confirmOpenUnsaved: () => canvasPalette.confirmOpenUnsaved()`を足す。コメントに「`canvasPalette`は後で`const`宣言されるが、呼ばれるのは起動後の利用者の操作のみ（起動時の`#createAndEnter`では呼ばれない）」と書く。
*   ページ非表示時の確定の配線の直後に次を足す。`returnValue`は空文字列では旧ブラウザで確認が出ない場合があるため`true`を代入する。
```js
window.addEventListener('beforeunload', (event) => {
    if (canvasLibrary.hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = true;
    }
});
```

**動作確認の観点**：`put`を例外にして新規作成→小窓「いいえ」で一覧に残らず元のまま／「はい」で開いて、別のキャンバスを開こうとしても移れない。`put`を戻して移ると記録ができ、戻って開ける（`'loadFailed'`にならない）。開く（ファイル）も同様で、ファイルの図形が残る。`put`を例外にしたまま再読み込みすると起動時に確認の小窓が出ない。

### 要件3: E-1 キャンバスがウィンドウに追従する（`js/core/CanvasManager.js`）
`resize()`の`style.width`/`style.height`のpx固定（:134-135の2行）と、その説明のコメント（:133）を削除する。表示サイズは`index.html`のCSS（`#editor-canvas`の`100vw`/`100vh`）に任せる。`index.html`は変更しない。`resize()`のJSDocに「表示サイズはCSSに任せて固定せず、呼ばれた時点の`clientWidth/Height`へ内部バッファを同期する」旨を足す（2章Dの`CanvasManager.js`の項目はここで解消する）。

**動作確認の観点**：ウィンドウを広げると再読み込みなしでキャンバスが追従し、描画がぼやけない。

### 要件4: E-4 ウィンドウのドラッグの追従の残留（`js/core/WindowManager.js`）
*   private`#endDrag()`を新設する（`#draggingWindow = null`）。`#handleWindowMouseUp`はこれを呼ぶ。
*   コンストラクタで`window.addEventListener('blur', this.#endDrag.bind(this));`を足す（`DragTracker`と同じく第3引数なし）。
*   `#handleWindowMouseMove`：`#draggingWindow`の確認の直後に、`event.buttons === 0`なら`#endDrag()`を呼んで移動せず`return`する。
*   `#handleWindowMouseMove`・`#handleWindowMouseUp`のJSDocを修正後の動作に合わせる（「確実に解除される」をやめ、取りこぼしは`blur`と`mousemove`の`buttons`で解除すると書く。2章Dの該当項目はここで解消する）。

**動作確認の観点**：ヘッダーをドラッグ中にタブを切り替えて戻っても追従しない。ウィンドウ外でボタンを離して戻っても追従しない。通常のドラッグは変わらない。

### 要件5: E-6 例外時の停止（`js/edit/CanvasLibrary.js`）
*   `#notifyChange`：リスナーごとに`try/catch`し、例外は`console.warn`して残りのリスナーへの通知を続ける。`CanvasFileOperations`の通知は変更しない。
*   `#saveOpenCanvasNow`：記録の組み立て（`getShapes`・`serialize`を含む）を`putRecord`と同じ`try`へ入れ、例外は書き込みの失敗と同じ扱い（`writing = Promise.reject(error)`）にする。`const updatedAt = Date.now();`は`try`の前のまま。同期で例外を投げない。
*   `#enterCanvas`の手順4の`prepareSwitch()`：`try/catch`で捕捉して`console.warn`し、切り替えを続ける（削除の後は戻る先が無いため）。`#settleAndEnter`内の`prepareSwitch()`は別物で、例外は中止として扱う（要件1）。混同しないこと。

**動作確認の観点**：リスナー・`getShapes`・`prepareSwitch`に例外を仕込み、起動時に読み込み中のまま止まらない／保存の例外が失敗と同じに扱われる／削除後に`#isSwitching`が真のまま残らず自動保存が動く。

### 要件6: E-5（`js/shapes/Rect.js`）
`setVertex`の条件を`Number.isInteger(vertexIndex) && vertexIndex >= 0 && vertexIndex <= 3`にする（`null`・文字列・小数を無視する）。JSDocに「0〜3の整数以外は何もしない」と書く（2章Dの`Rect.js`の:213の項目はここで解消する）。

### 要件7: E-8・E-7（`js/shapes/Ellipse.js`）
**E-7（角度と頂点）**
*   コンストラクタ：`this.startAngle = (this.type === 'circle') ? 0 : Math.PI;`、`this.endAngle = Math.PI * 2;`。`ctx.ellipse`は既定の時計回りで、`π`→`3π/2`（画面の上）→`2π`を描く。`draw`・`drawHover`・`intersectsRect`は角度を読むだけなので変更不要。
*   `points[3]`（開始角制御点）・`points[4]`（終了角制御点）：弧では左端・右端、円では従来どおり両方とも右端。コンストラクタと`#updatePointsFromRadii`の両方を、`points[3].x = (円) ? xc + rx : xc - rx`、`points[4].x = xc + rx`（`y`は`yc`）へ変える。
*   保存済みの図形：`fromJSON`は現行どおり`points`を`data`の値のまま採用し書き換えない（描画は`points[0..2]`と角度のみに依存）。角度はコンストラクタが`type`から求めるので上半分で描かれる。`DocumentSerializer`の版は上げない。
*   `hitTest`の角度の判定：`if (angle < 0)`を`if (angle <= 0)`へ変えて角度を`(0, 2π]`へ写す。`atan2`が`0`（弧の右端）のときに`2π`となって当たり、`atan2`が`π`（左端）もそのまま当たる。

**E-8（`hitTest`の縮退時）**：`rx < 1 || ry < 1`のガードを次へ変える。比率の式には入れない。
```js
if (rx < 1 || ry < 1) {
    return this.#distanceToOutline(x, y, xc, yc, rx, ry) <= tolerance + this.strokeWidth / 2;
}
```
private`#distanceToOutline(x, y, xc, yc, rx, ry)`を新設する：`intersectsRect`と同じパラメータ化（`θ = startAngle + (endAngle − startAngle) × i / ELLIPSE_INTERSECT_SEGMENTS`、`i = 0..N`）で折れ線を作り、各線分への最短距離の最小値を返す（弧は描かれている部分のみになる）。点と線分の距離は長さ0の線分で0除算しないこと（`Rect`の`#distanceToSegment`と同じ考え方）。`intersectsRect`は変更しない。

**JSDoc（ここで解消する2章Dの項目）**：`startAngle`/`endAngle`の型コメント（:48・:51）、`points`の型コメント（:57）、`#updatePointsFromRadii`、`hitTest`（`strokeWidth/2`の加算と`rx<1||ry<1`での折れ線判定を明記）、新設メソッド。弧の範囲が変わるため、`intersectsRect`の対象が上半分へ移るのは決定どおりである（判定の方法は変えない）。

**動作確認の観点**：弧の作図・再読み込み後の表示が上半分。右端・左端・頂上を押して選べ、下半分の空隙では当たらない。`up`ハンドルは弧の頂上に重なる。`rx`または`ry`が1未満の円・弧をクリックで選べる。範囲選択は変わらない（弧は上半分が対象）。保存済みの弧を開いても`toJSON`の`points[3]`/`[4]`は書き換わらない。

### 要件8: 2章DのJSDoc・用語の修正（動作は変えない）
実コードの変更は「改名」と「`renameCanvas`の重複判定の除去」のみ。項目の転記と修正後の内容は次のとおり。

**改名（タスク7）**：`VectorModel`の`#draftLine`→`#draftShape`、`getDraftLine()`→`getDraftShape()`、`CanvasManager.render()`の分割代入`draftLine`→`draftShape`（JSDocの`state.draftLine`と本文の変数名も）、`main.js`の`renderCurrentState`の渡し方（`draftShape: model.getDraftShape()`）・そのJSDoc・`syncHistoryButtonState`。計画時に`DraftLine`/`draftLine`が現れるのはこの3ファイルのみ（`InputTracker`・`index.html`には無い）。

**`CanvasLibrary.js`（タスク8）**
| 場所 | 修正後の内容 |
| --- | --- |
| typedef`CanvasIssue`の`'unavailable'`（:38）・クラスJSDoc「起動時の復元」（:130） | 条件に「最後に開いていたキャンバスの識別子を読み出せない」を足す |
| typedef`CanvasIssue`の`'writeFailed'` | 解除条件は「次に自動保存が成功した時点」のまま。保留の再試行で解除されることが読めるようにする |
| typedef`openCanvasName`（:55） | 「読み込み完了前と、開いているキャンバスの記録の削除に成功してから切り替えが完了するまでは`null`」 |
| クラスJSDoc「■ 自動保存」 | 書き込み中の保存の説明を現在の`flushPendingSave()`へ合わせ、失敗の保持（下の新節）への参照を足す |
| クラスJSDoc「■ 順序の保証」の2（:90-91） | 入れ替えの前に確定手順で保留・書き込み中の保存を確定すること。切り替え前のキャンバスへの書き込みが残ったまま入れ替えないこと |
| クラスJSDoc「■ 切り替え処理」の見出し（:97-98）と`start()`（:320） | 起動時の復元・削除後の切り替えは手順3から（`'unavailable'`のメモリ上の「無題 1」のみ手順4から）。開く・新規作成・開く（ファイル）のみ手順3と手順4の間の確定手順を通る |
| 手順2（:101-103） | 保留（タイマーの有無によらない）を`flushPendingSave()`で確定する。失敗後の再試行も同じ経路で、失敗する限り何度でも中止する |
| 手順3（:104-106） | 開く・削除後は従来どおり。新規作成・開く（ファイル）で書き込みに失敗したら`'writeFailed'`を設定して確認する（要件2。「次の自動保存で記録が作られる」をやめる）。起動時・削除後は確認せずに開いて未保存として保持する |
| 手順3と4の間（新設） | 確定手順（要件1）。繰り返す内容・`await`を挟まず手順4へ入ること・例外は中止・中止時の新しい記録の後始末 |
| 手順4（:107-113） | 保存を行わない。`prepareSwitch()`の例外は`console.warn`して続ける。`#isSwitching = true`。`replaceAllShapes`（図形のidは記録されたものを保持する。欠落・重複は`replaceAllShapes`が振り直す＝:109の無条件の記述を直す）。手順2との違いの段落は削除する |
| 手順6（:116） | 保留・未保存の状態を消す（記録を書けずに開いたときは未保存として保持する）ことを足す。`'unavailable'`では識別子を書かない |
| 「■ `#isSwitching`」（:120-124） | (a)について：`#isSwitching`は、切り替え処理では`replaceAllShapes`の直前から手順5の終わりまで真にする（手順5の`clear()`の通知を保存の契機にしないため）とだけ書く。手順4の先頭へ動かしてはならない旨は書かない |
| 「■ 開く（ファイル）」（:148-150）・「■ 削除」（:171-178） | 要件1・2の動作に合わせる（確定手順・確認の小窓・未保存の破棄と削除失敗時の復元・書き込みの失敗の扱いと`#isSwitching`） |
| 「■ 処理中の直列化」（:180-182） | 「処理中もキャンバスの編集は止めない（手順4で整合を取る）」を「処理中もキャンバスの編集は止めない（確定手順で整合を取る）」へ直す（修正後の手順4は保存を行わない） |
| 「■ 公開メソッドのPromise」（:184-185） | 「想定した失敗でrejectしない（`console.warn`＋`issue`）。予期しない例外は`console.warn`のみで`issue`を立てない。リスナーの例外は`#notifyChange`が捕捉して`console.warn`し、残りのリスナーへの通知を続ける」 |
| クラスJSDocへ新節「■ 保存に失敗した変更の保持」 | 守るべき動作、保留と未保存の表現（要件1の表）、最新の書き込みのみ失敗を記録すること、再試行の契機、`hasUnsavedChanges()`の真偽の条件 |
| 「依存の制約」 | 注入に`confirmOpenUnsaved`を足す（文言と`window.confirm`はパレット） |
| `renameCanvas`（**実コード**） | `if (!summary || name === summary.name)`から`!summary`を除く（同じ同期区間の先頭で`#summaries.has(id)`を確認済み） |

`CanvasPalette.js`のtypedef`CanvasLibraryState`の`openCanvasName`（:42）も同じ内容へ揃える（形を変えない。二重定義の記述を揃えるだけ）。メソッド単位のJSDocのうちタスク1・4で変更したものは、そのタスクで直してある前提で読み合わせる。

**`core/`（タスク9）**
| ファイル | 場所 | 修正後の内容 |
| --- | --- | --- |
| `WindowManager.js` | 責務JSDoc（:3） | 「ツール状態」→「操作モード」 |
| `VectorModel.js` | クラスJSDoc（:23） | 「図形の生成はShapeFactoryへ委譲する（復元は`DocumentSerializer`→`ShapeFactory.fromJSON`が行い、本クラスは復元済みの図形一式を受け取るのみ）」 |
| `VectorModel.js` | `replaceAllShapes`（:338,:347） | 用途は「`?dev`の復元・取り消し/やり直し・キャンバスの切り替え」。前処理は「進行中の入力操作の中断は呼び出し側の責務（`InputTracker.abortOngoingOperation()`、または`CanvasLibrary`では`prepareSwitch()`経由の`setMode`）」。「受け取ったインスタンスの`id`を直接書き換える。idの重複判定は値で行うため、同一インスタンスを配列に重複して渡さない（既存インスタンスを渡す場合は呼び出し側で複製する）」を足す |
| `VectorModel.js` | `addShapesWithNewIds` | 「受け取ったインスタンスをそのまま保持して`id`を書き換えるため、呼び出し側は追加後にそのインスタンスを他の用途に流用しない」を足す |
| `VectorModel.js` | `addShape`（:88） | 「使わないこと（id採番を通らず`#shapes`へ追加するだけで、呼び出し元はない。図形の追加は`commitDraft`・`addShapesWithNewIds`を使う）」を足す |
| `HistoryManager.js` | `clear()`（:212） | 「呼び出し元は`CanvasLibrary`の切り替え処理のみ（開く・開く（ファイル）・新規作成・削除後の切り替え・起動時の復元）」 |
| `InputTracker.js` | クラスJSDoc（:137-138）・`deleteSelection`（:374-375） | 利用者に「切り取り（`ClipboardController.cut()`へ`main.js`が注入）」を足す |
| `InputTracker.js` | `abortOngoingOperation` | 「`performUndo`（`main.js`）がこの戻り値で作成途中の図形の破棄を判定している。中断する対象を増やす場合は`performUndo`の判定を見直す」を足す |
| `InputTracker.js` | typedef`EditRecorder` | 「`edit/ShapeInserter.js`に同じ内容の定義がある（二重定義。形を変える場合は両方を揃えること）」を足す |
| `DragTracker.js` | `begin`・typedef`DragHandlers`の`onStart` | 「`begin()`内では`onStart`を同期的に呼ばない（閾値超過時の`mousemove`で呼ぶ。`InputTracker`がこれに依存する）」を足す |

**`edit/`・`main.js`（タスク10）**
| ファイル | 場所 | 修正後の内容 |
| --- | --- | --- |
| `CanvasFileOperations.js` | クラスJSDoc「■ インポート」（:69） | 「手順3の同一性の確認から手順5までは`await`を挟まない同期区間」 |
| `CanvasFileOperations.js` | クラスJSDoc「■ 開く（ファイル）」（:51-54） | 切り替え前の保存の失敗・確定手順の失敗・新しい記録を書けずに「いいえ」のいずれで中止しても一覧に残らないことへ直す。通知の判定（`'writeFailed'`なら出さない）は変えない |
| `ShapeInserter.js` | `insertDocument`の`documentData`（:85） | 「作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値。インポートも読めた図形を`serialize`し直して渡す）」 |
| `ShapeInserter.js` | typedef`EditRecorder` | 「`core/InputTracker.js`に同じ内容の定義がある（二重定義。形を変える場合は両方を揃えること）」を足す |
| `main.js` | ブロック`// 3.5.`のコメント（:44-45） | 「唯一の履歴配線ブロック」「生成と注入のみ」をやめ、ここは生成と注入に加えて`performUndo`/`performRedo`を置くこと、ボタンの配線は`// 6.`、`?dev`の復元の記録は`onImport`であることを書く |
| `main.js` | `syncCanvasNameDisplay`（:321） | `openCanvasName`が`null`のとき（読み込み中と、開いているキャンバスの記録の削除に成功してから切り替えが完了するまで）「読み込み中…」と表示することを足す |

**`shapes/`（タスク11）**
| ファイル | 場所 | 修正後の内容 |
| --- | --- | --- |
| `Line.js`・`Curve.js`・`Rect.js` | `@param`の「論理座標系」（各12箇所、計36箇所） | `（論理座標系）`→`（ワールド座標）`。`tolerance`は`許容誤差（ワールド座標の長さ。呼び出し側が画面上の許容誤差をワールド換算して渡す）`。完了後に`論理座標系`のGrepが`js/`で0件であること |
| 4図形クラス共通 | `id`の型宣言（`Line.js`:28,:257、`Curve.js`:36,:314、`Rect.js`:29,:283、`Ellipse.js`:42,:420） | 型は`{*}`（`@returns`内は`id: *`）。説明は「図形の一意なID。作成中は`null`。`VectorModel`の採番・正規化の後は文字列。`fromJSON`直後は`data.id`のまま（欠落なら`undefined`、任意の型を取り得る）」 |
| `Rect.js` | `#distanceToSegment`（:84） | 「9メソッド契約」→「12メソッド契約」 |
| `Rect.js` | `draw`の`t`（:45） | 「将来のモーフィング機能用の予約引数（本Phaseでは未使用）」（`Curve.js`:51・`Ellipse.js`:73と同じ文言） |
| `Ellipse.js` | `ELLIPSE_INTERSECT_SEGMENTS`（:8） | 「hitTestの100分割と同程度の計算量」を削除し、用途を「範囲選択の交差判定（`intersectsRect`）と、縮退時の当たり判定（`hitTest`）の輪郭サンプリングの分割数」とする |
| `Ellipse.js` | `fromJSON`（:438） | 「`right`/`up`/`left`/`down`のハンドル操作で正準位置へ再計算され、`move`では平行移動されるだけ」 |
| `Ellipse.js` | `ELLIPSE_TYPES`（:20-23） | 「種別を増やす場合に揃える箇所：本一覧・種別で分岐する全箇所（コンストラクタ、`draw`、`drawHover`、`#updatePointsFromRadii`、`hitTest`。`!== 'circle'`の分岐は弧として扱われる）・`ShapeFactory`の対応表・`index.html`のボタン」を足す |

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/edit/`（キャンバス一覧・ファイル操作・貼り付け）、`./js/core/`、`./js/shapes/`、`./js/palette/`、`./js/main.js`
*   **関連する論理クラス**: `CanvasLibrary`、`CanvasPalette`、`CanvasFileOperations`、`ShapeInserter`、`VectorModel`、`CanvasManager`、`WindowManager`、`HistoryManager`、`InputTracker`、`DragTracker`、`Line`、`Curve`、`Rect`、`Ellipse`
*   **変更してよいファイルはこれらの`js`のみ**（`index.html`・`DocumentSerializer.js`・`CanvasStorage.js`・開発資料は変更しない）。新しいファイルは作らない。

### 参照する責務
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`をimportしない。`core/`・`io/`は`edit/`をimportしない。外部ライブラリを導入しない。
*   **`CanvasLibrary`**：キャンバス一覧の管理（起動時の復元・開く・新規作成・開く（ファイル）の受け口・名前の変更・削除・切り替え処理・自動保存・保存失敗の状態）。DOMに触れない。importは`DocumentSerializer`のみで、他は注入で受け取る。`setTimeout`/`clearTimeout`/`Date.now`/`Math.random`以外のブラウザAPI（`document`・`window`のイベント等）を使わない。`model`は`getShapes`・`replaceAllShapes`、`historyManager`は`onChange`・`clear`のみ使う。操作モードを知らない。`#isSwitching`は真・偽にする箇所を増やさない。細則の正本はクラスJSDoc。
*   **`#isSwitching`の規則**：真にするのは (a)切り替え処理の手順4の途中（`prepareSwitch()`の後）から手順5の終わりまで、(b)開いているキャンバスの削除の開始から、削除後の切り替えの手順5の終わりまたは削除の中止まで、の2箇所のみ。偽へ戻すのは手順5の終わりと削除の中止時のみ。
*   **削除の順序保証**：保留の破棄・予約の停止・書き込みの生成順（`CanvasStorage`はトランザクションを呼び出し時点で同期的に生成し、IndexedDBは生成順に実行する）により、削除したキャンバスの記録が削除後に復活しない。
*   **`CanvasFileOperations`**：ファイル操作の組み立てと、パレットの表示同期用の状態・通知。DOMに触れない。
*   **`CanvasPalette`**：DOM操作専任の自己完結UI部品。文言の対応表はこのファイルが唯一の定義箇所。`CanvasLibrary`・`VectorModel`・図形データ・IndexedDBを知らない。importを持たない。
*   **`main.js`**：インスタンス化・依存の注入・イベントバインド。判定ロジック・作業データの中身の解釈を持たない。
*   **`CanvasManager`**：Canvasへの純粋な描画。図形データ・選択状態・ビュー変換状態を持たない。`render()`を`resize()`から呼ばない（再描画は`main.js`）。
*   **`WindowManager`**：`.float-window`のドラッグ移動・最前面化・イベント遮断を担うDOM操作専任。図形データ・操作モードを知らない。
*   **`shapes/`**：図形種別ごとのデータ保持・描画・当たり判定・図形データとの相互変換。座標はすべてワールド座標。12メソッド契約（`draw`・`drawHandles`・`drawHover`・`hitTest`・`hitTestHandle`・`setVertex`・`translate`・`updateDraftEnd`・`getVertexIndexForHandle`・`intersectsRect`・`toJSON`・`static fromJSON`）を自律実装し、共通基底クラスは無い。図形データの形を変えない。
*   **`VectorModel`**：図形・選択集合・ホバー・作成中の図形・選択矩形のSSOT。図形固有の頂点構造を知らない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
資料本体は修正しない。反映は現場設計AIが行う（本計画に反映のタスクは含めない）。各タスクの実行時に影響が判明した場合も、この欄へ追記する。
*   **`PROJECT_ARCHITECTURE.md`3章8.**：
    *   「切り替え処理の手順」の手順2〜4・6を修正後へ（保留の定義、手順3の確認の小窓、手順3と4の間の確定手順、手順4は保存しない、手順6で保留・未保存を消す）。通り方の記述（`#openFirstLoadable`の言及はJSDocが直ったので見直す）。
    *   「順序保証の現状の制約」（E-2・E-3）と「`try`の外にある例外の制約」（E-6）を削除する。
    *   「非同期保存と切り替えの順序の保証」の「手順2・手順4で確定する」を「手順2と確定手順で確定する」へ。
    *   「自動保存」「ページ非表示時の確定」に、失敗後の保留の保持・再試行の契機・`beforeunload`・`hasUnsavedChanges()`を足す。「`Promise`」のリスナーの例外の扱い。削除の未保存の破棄・削除失敗時の復元。`'writeFailed'`の説明。
    *   `#isSwitching`の(a)：区間を「`replaceAllShapes`の直前から手順5の終わりまで」へ直す（手順5の`clear()`の通知を保存の契機にしないため、は残す）。「(a)を手順4の先頭へ動かしてはならない」の禁止とその理由を削除する。
    *   「処理中の直列化」の「処理中もキャンバスの編集は止めない（手順4で整合を取る）」を「（確定手順で整合を取る）」へ直す。
    *   冒頭の「ただし`_doc/COWORK_STATUS.md`2章Dの誤りを除く」と記載基準の「JSDocが実コードと食い違う項目は…」の見直し。
*   **`_doc/arch/02_main.md`**：注入の一覧の`CanvasLibrary`へ`confirmOpenUnsaved`＝`() => canvasPalette.confirmOpenUnsaved()`。生成順の制約（`canvasPalette`は後で宣言されるが起動後のみ呼ばれる）。ページ非表示時の確定のブロックへ`beforeunload`。行数。
*   **`_doc/arch/03_VectorModel.md`**：`getDraftLine`→`getDraftShape`。`addShape`の「JSDocにはこの禁止が書かれていない」を削除する。
*   **`_doc/arch/04_CanvasManager.md`**：`render`の引数と描画順の`draftLine`→`draftShape`。「既知の不具合」を削除し、表示サイズはCSSに任せる旨へ。
*   **`_doc/arch/08_HistoryManager.md`**：「JSDocの『開く・新規作成時に呼ぶ前提』は古い」を削除する。
*   **`_doc/arch/11_WindowManager.md`**：「制約」を`blur`・`buttons`で解除する旨へ。
*   **`_doc/arch/12_shapes.md`**：`Rect`の`setVertex`の範囲外（E-5）。`Ellipse`の`[3]`/`[4]`の位置、「弧は画面の上半分」（`down`ハンドルが線上にない）、`hitTest`の縮退時（折れ線への距離。E-8の記述を削除）、`intersectsRect`の説明に`hitTest`の縮退時の分割の共用。
*   **`_doc/arch/13_palette.md`**：`CanvasPalette`の公開メソッドに`confirmOpenUnsaved`。確認の小窓の文言の置き場。
*   **`_doc/arch/14_edit.md`**：`CanvasLibrary`の公開メソッドに`hasUnsavedChanges`（`flushPendingSave()`の判定は保留（`#pendingSaveCanvasId`）基準へ変更）、注入に`confirmOpenUnsaved`。「書き込み中の保存は宛先のキャンバスを区別しない…」の注意は確定手順により通常の切り替えでは起きなくなるため見直す。`ShapeInserter`の二重定義の「コードに注記は無い」を削除する。

## 3. タスクリスト
**全タスク共通の作業**：(1)「2. アーキテクチャ設計」の該当要件と「参照する責務」に従う (2)`node --check`で変更した各ファイルの構文を確かめる（ブラウザでの確認は現場設計AIが行う）(3)コード修正完了後、追加・変更した要素のJSDocに記載漏れがないことを確認する (4)本RESの該当タスクを`[x]`にし、「4. 詳細作業内容」へ記載する (5)開発資料への影響は資料本体を修正せず「開発資料の更新予定」欄へ追記する。

*   [x] タスク1: E-2・E-3 保存に失敗した変更の保持と、新しい記録を書けないときの確認（要件1・要件2）
    *   **対象ファイル** :
        *   `./js/edit/CanvasLibrary.js` : 更新
        *   `./js/main.js` : 更新
        *   `./js/palette/CanvasPalette.js` : 更新
    *   **作業内容** :
        *   `CanvasLibrary`：`confirmOpenUnsaved`の注入と検査、`#hasUnsaved`、`hasUnsavedChanges()`、`flushPendingSave()`の判定の変更、`#saveOpenCanvasNow`の完了処理と`#isCurrentWrite`の新設、`#scheduleSave`の`'unavailable'`の記録、`#settleAndEnter`の新設と`openCanvas`からの呼び出し、`#enterCanvas`の手順4の保存の削除と手順6の状態の更新、`#createAndEnter`の変更と`#askOpenUnsaved`の新設、`createCanvasFromShapes`の変更、`#deleteOpenCanvas`の未保存の破棄と削除失敗時の復元。
        *   `CanvasPalette`：`confirmOpenUnsaved()`の追加、`ISSUE_MESSAGES.writeFailed`の文言、クラスJSDocの「■ 操作」に1行。
        *   `main.js`：注入と`beforeunload`の配線、コメント。
        *   本タスクで追加・本体を変更したメソッド・フィールドのJSDocをここで修正後の動作に合わせる（`#pendingSaveTimer`・`#pendingSaveCanvasId`・`#inFlightSave`、コンストラクタの`@param`/`@throws`、`openCanvas`、`createCanvasFromShapes`、`flushPendingSave`、`#scheduleSave`、`#saveOpenCanvasNow`、`#deleteOpenCanvas`、`#prepareLeave`、`#enterCanvas`、`#createAndEnter`、`#openFirstLoadable`の記述に矛盾があれば）。クラスJSDocはタスク8で直すので触らない。
        *   要件5（E-6）の変更（`#notifyChange`・`serialize`の`try`・手順4の`prepareSwitch()`の捕捉）は本タスクで行わない。
*   [x] タスク2: E-1 キャンバスがウィンドウに追従する（要件3）
    *   **対象ファイル** :
        *   `./js/core/CanvasManager.js` : 更新
    *   **作業内容** :
        *   `resize()`のpx固定の2行とその説明のコメントを削除し、`resize()`のJSDocを修正後の動作に合わせる。
*   [x] タスク3: E-4 ウィンドウのドラッグの追従の残留（要件4）
    *   **対象ファイル** :
        *   `./js/core/WindowManager.js` : 更新
    *   **作業内容** :
        *   `#endDrag`の新設、`blur`の購読、`mousemove`の`buttons === 0`の検知。`#handleWindowMouseMove`・`#handleWindowMouseUp`・新設メソッドのJSDocを書く。責務JSDocの用語はタスク9で直す。
*   [x] タスク4: E-6 例外時の停止（要件5）
    *   **対象ファイル** :
        *   `./js/edit/CanvasLibrary.js` : 更新
    *   **作業内容** :
        *   `#notifyChange`のリスナーごとの捕捉、`#saveOpenCanvasNow`の記録の組み立てを`try`へ、`#enterCanvas`の手順4の`prepareSwitch()`の捕捉。各メソッドのJSDocを修正後の動作に合わせる。
        *   （タスク1の監査の指摘への追加）`#enterCanvas`：`isRecordWritten`が偽のとき、手順6の最後（`loadIssue`の設定より後）で`#setIssue('writeFailed')`を設定する。`#createAndEnter`が設定した`'writeFailed'`は確定手順での切り替え前のキャンバスの保存成功で解除されるため、未保存のキャンバスで`⚠`と文言が消える経路を塞ぐ。
*   [x] タスク5: E-5 `Rect.setVertex`の範囲外（要件6）
    *   **対象ファイル** :
        *   `./js/shapes/Rect.js` : 更新
    *   **作業内容** :
        *   `setVertex`の条件の変更とJSDoc。
*   [ ] タスク6: E-8・E-7 つぶれた円・弧の当たり判定と弧の向き（要件7）
    *   **対象ファイル** :
        *   `./js/shapes/Ellipse.js` : 更新
    *   **作業内容** :
        *   角度・`points[3]`/`[4]`（コンストラクタ・`#updatePointsFromRadii`）、`hitTest`の角度の判定、縮退時の判定と`#distanceToOutline`の新設。要件7の「JSDoc」に挙げた箇所を修正後の動作に合わせる。`intersectsRect`・`fromJSON`のコードは変更しない。
*   [ ] タスク7: 改名 `draftLine` → `draftShape`（要件8）
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` : 更新
        *   `./js/core/CanvasManager.js` : 更新
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   要件8の「改名」のとおり3ファイルを同時に変更する。完了後に`DraftLine`・`draftLine`のGrepが`js/`と`index.html`で0件であることを確かめる。改名以外のJSDocの修正は行わない。
*   [ ] タスク8: JSDoc修正 `CanvasLibrary`（要件8）
    *   **対象ファイル** :
        *   `./js/edit/CanvasLibrary.js` : 更新
        *   `./js/palette/CanvasPalette.js` : 更新（typedefの`openCanvasName`の記述のみ）
    *   **作業内容** :
        *   要件8の「`CanvasLibrary.js`」の表の全項目を修正する。実コードの変更は`renameCanvas`の`!summary`の除去のみ。JSDocの記述はタスク1・4で実装されたコードを読んで合わせる。
*   [ ] タスク9: JSDoc修正 `core/`（要件8）
    *   **対象ファイル** :
        *   `./js/core/WindowManager.js`・`./js/core/VectorModel.js`・`./js/core/HistoryManager.js`・`./js/core/InputTracker.js`・`./js/core/DragTracker.js` : 更新（コメントのみ）
    *   **作業内容** :
        *   要件8の「`core/`」の表の全項目を修正する。実コードは変更しない。
*   [ ] タスク10: JSDoc修正 `edit/`・`main.js`（要件8）
    *   **対象ファイル** :
        *   `./js/edit/CanvasFileOperations.js`・`./js/edit/ShapeInserter.js`・`./js/main.js` : 更新（コメントのみ）
    *   **作業内容** :
        *   要件8の「`edit/`・`main.js`」の表の全項目を修正する。実コードは変更しない。
*   [ ] タスク11: JSDoc修正 `shapes/`（要件8）
    *   **対象ファイル** :
        *   `./js/shapes/Line.js`・`./js/shapes/Curve.js`・`./js/shapes/Rect.js`・`./js/shapes/Ellipse.js` : 更新（コメントのみ）
    *   **作業内容** :
        *   要件8の「`shapes/`」の表の全項目を修正する。実コードは変更しない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: E-2・E-3 保存に失敗した変更の保持と、新しい記録を書けないときの確認（要件1・要件2）
*   **作業内容** :
    *   `CanvasLibrary.js`：`confirmOpenUnsaved`の注入・検査・`#confirmOpenUnsaved`、`#hasUnsaved`、`hasUnsavedChanges()`、`flushPendingSave()`の判定を`#pendingSaveCanvasId`へ変更、`#saveOpenCanvasNow`の完了処理（`#isCurrentWrite`新設・失敗時の保留再設定）、`#scheduleSave`の`'unavailable'`で未保存、`#settleAndEnter`新設と`openCanvas`からの呼び出し、`#enterCanvas`の手順4の保存の削除と手順6の状態更新（`isRecordWritten`引数）、`#createAndEnter`（`isUserOperation`・`Promise<boolean>`）と`#askOpenUnsaved`新設、`createCanvasFromShapes`の変更、`#deleteOpenCanvas`の未保存の破棄と失敗時の復元。関連JSDoc（各フィールド・コンストラクタ・`openCanvas`・`createCanvasFromShapes`・`flushPendingSave`・`#scheduleSave`・`#saveOpenCanvasNow`・`#deleteOpenCanvas`・`#enterCanvas`・`#createAndEnter`）を更新。クラスJSDocは触っていない（タスク8）。
    *   `CanvasPalette.js`：`confirmOpenUnsaved()`追加、`ISSUE_MESSAGES.writeFailed`の文言、クラスJSDocの「■ 操作」に1項目。
    *   `main.js`：`confirmOpenUnsaved`の注入（コメント付き）、`beforeunload`の配線。
    *   `node --check`は3ファイルとも成功。

### タスク2: E-1 キャンバスがウィンドウに追従する（要件3）
*   **作業内容** :
    *   `CanvasManager.js`の`resize()`から`style.width`/`style.height`のpx固定の2行と説明コメントを削除。`resize()`のJSDocに「表示サイズはCSSに任せて固定せず、呼ばれた時点の`clientWidth/Height`へ内部バッファを同期する」を追記。`node --check`成功。ブラウザ確認は未実施（現場設計AI）。

### タスク3: E-4 ウィンドウのドラッグの追従の残留（要件4）
*   **作業内容** :
    *   `WindowManager.js`：private`#endDrag()`を新設、`#handleWindowMouseUp`から呼ぶ。コンストラクタで`window`の`blur`を購読（第3引数なし）。`#handleWindowMouseMove`は`#draggingWindow`確認の直後に`event.buttons === 0`なら`#endDrag()`して`return`。`#handleWindowMouseMove`・`#handleWindowMouseUp`・`#endDrag`・コンストラクタのJSDocを修正後の動作に合わせた（「確実に解除される」を削除）。責務JSDocの用語はタスク9のため未変更。`node --check`成功。ブラウザ確認は未実施（現場設計AI）。

### タスク4: E-6 例外時の停止（要件5）
*   **作業内容** :
    *   `CanvasLibrary.js`：`#notifyChange`をリスナーごとの`try/catch`（`console.warn`して続行）へ。`#saveOpenCanvasNow`の`record`の組み立て（`getShapes`・`serialize`）を`putRecord`と同じ`try`へ入れ（`updatedAt`は`try`の前のまま）、例外は`writing = Promise.reject(error)`。`#enterCanvas`の手順4の`prepareSwitch()`を`try/catch`で捕捉し`console.warn`して続行（`#settleAndEnter`内のものは変更なし）。
    *   追加：`#enterCanvas`の手順6の最後（`loadIssue`設定の後・`#notifyChange`の前）に、`!isRecordWritten`なら`#setIssue('writeFailed')`。
    *   JSDoc：`#notifyChange`・`#saveOpenCanvasNow`・`#enterCanvas`を更新。`node --check`成功。ブラウザ確認は未実施（現場設計AI）。

### タスク5: E-5 `Rect.setVertex`の範囲外（要件6）
*   **作業内容** :
    *   `Rect.js`の`setVertex`の条件を`Number.isInteger(vertexIndex) && vertexIndex >= 0 && vertexIndex <= 3`へ変更。JSDocに「0〜3の整数以外（null・文字列・小数・範囲外）は何もしない」を追記。`node --check`は成功。ブラウザ確認は未実施（現場設計AI）。

### タスク6: E-8・E-7 つぶれた円・弧の当たり判定と弧の向き（要件7）
*   **作業内容** :
    *   (タスク実行時に記入)

### タスク7: 改名 `draftLine` → `draftShape`（要件8）
*   **作業内容** :
    *   (タスク実行時に記入)

### タスク8: JSDoc修正 `CanvasLibrary`（要件8）
*   **作業内容** :
    *   (タスク実行時に記入)

### タスク9: JSDoc修正 `core/`（要件8）
*   **作業内容** :
    *   (タスク実行時に記入)

### タスク10: JSDoc修正 `edit/`・`main.js`（要件8）
*   **作業内容** :
    *   (タスク実行時に記入)

### タスク11: JSDoc修正 `shapes/`（要件8）
*   **作業内容** :
    *   (タスク実行時に記入)

## 5. 懸念事項・要確認ポイント
計画時点のもの（実装時に判明したものはここへ追記する）。
*   **REQに明記のない、計画で足した設計**（守るべき動作と削除の順序保証から導いたもの）：
    *   失敗の記録の条件へ`!#isSwitching`と`canvasId === #openCanvasId`を足し、成功側にも同じ条件を適用する（要件1）。REQの「最新の書き込みのみ」だけでは、削除の`await`中の書き込みの失敗＋ページ非表示で、削除した記録が復活する。
    *   削除の失敗時に未保存を元へ戻す（要件1）。
    *   `confirmOpenUnsaved`の例外は「いいえ」と同じに扱う（要件2）。
*   **E-3の「いいえ」の後の表示**：REQのとおり`'writeFailed'`を残すため、開いているキャンバスは保存済みでもパレットの文言と`⚠ `が次の自動保存の成功まで残る（編集しない限り消えない）。動作確認で気になれば別REQで判断する。
*   **`setLastOpenedId`の失敗**：手順6の識別子の書き込みの失敗も`'writeFailed'`になるが、保留・未保存にはならない（失う変更が無いため）。次の自動保存の成功で解除される点は現行どおり。
*   **`'unavailable'`の未保存**：編集で一度真になると、取り消しで元の内容へ戻しても偽へ戻らない（REQの定義どおり）。
*   **`beforeunload`の確認**：ブラウザの仕様で、そのページで利用者の操作が一度も無いと確認が出ない場合がある。動作確認では先にページを操作しておくこと。
*   **範囲外の残存**：E-6の対象は手順4の`prepareSwitch()`のみ。削除後の`#openFirstLoadable`の`deserialize`など`#enterCanvas`に入る前の例外では`#isSwitching`が真のまま残り、`replaceAllShapes`の例外では`#isSwitching`は`finally`で偽へ戻るが手順6へ進まず開いているキャンバスが一覧に無いまま残る。どちらも通常は例外を投げない。
*   **保存済みの弧の`points[3]`/`[4]`**：描画に使わないため古い位置のまま残り、ハンドル操作（`move`を除く）で正準位置へ変わる。`toJSON`の往復は一致する。
*   **[タスク1実装時]** クラスJSDocの「■ 切り替え処理」「■ 自動保存」「■ 新規キャンバス…」「■ 開く（ファイル）」等は、保留・未保存・確認の小窓・`#settleAndEnter`の新設と食い違う記述が残っている（タスク8で修正）。`#prepareLeave`（手順1〜2）は変更せず残し、`#settleAndEnter`の確定手順は読み込み後の再確定として追加した。`#askOpenUnsaved`は`confirmOpenUnsaved() === true`のときのみ「はい」とする。目視確認推奨：put失敗下での新規作成（いいえ／はい）・開く（ファイル）・再読み込み時の`beforeunload`。
*   **[タスク4実装時]** `#enterCanvas`の`!isRecordWritten`での`'writeFailed'`の再設定は、`#setIssue`が`'unavailable'`を上書きしないため`'unavailable'`中は影響しない。`#enterCanvas`の手順4の`prepareSwitch()`の捕捉は、`#settleAndEnter`内（例外は中止）と挙動が異なる点に注意。目視確認推奨：put失敗下での新規作成「はい」の後、切り替え前のキャンバスに保留があった場合でも`⚠`と文言が残ること。
