/**
 * 責務：キャンバス一覧の管理（起動時の復元・開く・新規作成（ファイルの図形からの作成を含む）・名前の変更・削除・切り替え処理・開いているキャンバスの自動保存・保存失敗の状態）を担う。DOMに触れない。
 */
import { DocumentSerializer } from '../io/DocumentSerializer.js';

/**
 * 自動保存の待ち時間（ミリ秒）。最後の変更通知（historyManager.onChange）からこの時間が経ったら1回保存する。
 * 唯一の定義箇所（exportしない）。
 * @type {number}
 */
const AUTOSAVE_DELAY_MS = 500;

/**
 * 新規キャンバスの名前の接頭辞。新しい名前は`'無題 ' + n`（半角スペース1つ。nは一覧の名前と一致しない最小の正の整数）。
 * 唯一の定義箇所（exportしない）。
 * @type {string}
 */
const UNTITLED_NAME_PREFIX = '無題 ';

/**
 * キャンバス名の最大文字数（`Array.from`で数えた文字数。サロゲートペアを1文字と数える）。
 * 名前の変更・開く（ファイル）で、前後の空白を除いた名前がこれを超える場合は先頭からこの文字数に切り詰めて受理する。
 * 唯一の定義箇所（exportしない）。
 * @type {number}
 */
const CANVAS_NAME_MAX_LENGTH = 100;

/**
 * キャンバスの要約：キャンバス一覧（メモリ上）の1件。作業データは保持しない。
 * @typedef {Object} CanvasSummary
 * @property {string} id キャンバスの識別子（`canvas-<Date.now()の36進>-<Math.randomの36進8文字>`。形式は本クラスに閉じる）
 * @property {string} name キャンバス名（メモリ上の現在名）
 * @property {number} updatedAt 最終更新日時（`Date.now()`のミリ秒）
 */

/**
 * 利用者に示す保存・読み込みの問題（最後に起きたものを1つだけ保持する）。
 *   - `'unavailable'`: 起動時に保存先を開けない・一覧を読み出せない・最後に開いていたキャンバスの識別子を読み出せない。メモリ上だけのキャンバスで編集を続ける。
 *     開く・新規作成・開く（ファイル）・名前の変更・削除を受け付けず、自動保存も行わない。解除しない。
 *   - `'writeFailed'`: 自動保存・新規作成・開く（ファイル）の記録・名前の変更・削除・最後に開いていたキャンバスの識別子の書き込みに失敗した。
 *     次に自動保存が成功した時点で解除する（失敗した自動保存は保留として保持され、次の編集・切り替え・ページ非表示時の再試行が成功すると解除される）。
 *   - `'loadFailed'`: 開こうとしたキャンバスの作業データが全体として読み込めない・記録が見つからない。
 *     次の切り替えの成功で解除する（読み込みに失敗して別のキャンバスを開いた場合は残す）。
 *   - `'partialLoad'`: 一部の図形をスキップして開いた。編集すると、その図形は保存から失われる。次の切り替えの成功で解除する。
 * @typedef {null|'unavailable'|'writeFailed'|'loadFailed'|'partialLoad'} CanvasIssue
 */

/**
 * `getState()`の戻り値（毎回新しいオブジェクト）。CanvasPalette・main.jsの表示同期が読み取る。
 * @typedef {Object} CanvasLibraryState
 * @property {boolean} loading 起動時の読み込み中か（`start()`の完了まで真。`start()`の呼び出し前も真）
 * @property {boolean} busy 開く・新規作成・開く（ファイル）・名前の変更・削除・起動時の復元の処理中か（処理中は新たな操作を受け付けない）
 * @property {boolean} canManage キャンバスの管理操作ができるか（`'unavailable'`でない）
 * @property {string|null} openCanvasId 開いているキャンバスの識別子（読み込み完了前は`null`）
 * @property {string|null} openCanvasName 開いているキャンバスの名前（読み込み完了前と、開いているキャンバスの記録の削除に成功してから切り替えが完了するまでは`null`）
 * @property {Array<{id: string, name: string, updatedAt: number, isOpen: boolean}>} canvases
 *     キャンバス一覧（最終更新日時の新しい順。同値はid順）
 * @property {CanvasIssue} issue 保存・読み込みの問題（無ければ`null`）
 * @property {boolean} hasSaveProblem 保存の問題（`'unavailable'`・`'writeFailed'`）があるか
 */

/**
 * キャンバス一覧の管理クラス。ブラウザ内に保存された複数のキャンバスのうち1枚を開き、
 * 開く（ファイル含む）・新規作成・名前の変更・削除・切り替え・自動保存を行う。main.jsが1つだけ生成する。
 *
 * ■ キャンバス記録と保存しないもの
 *   - 保存単位は記録`{ id, name, updatedAt, document }`（typedefは`io/CanvasStorage.js`の`CanvasRecord`）。
 *     `document`は`DocumentSerializer.serialize(model.getShapes())`の戻り値で、本クラスは中身を解釈しない
 *     （読み込みは`DocumentSerializer.deserialize`を通し、旧版のマイグレーションはその仕組みに任せる）。
 *   - 保存しないもの：Undo/Redoの履歴、選択集合・ホバー・作成中の図形・選択矩形、ビュー変換（倍率・表示位置）、
 *     クリップボード、操作モード。
 *   - キャンバスの識別子は`canvas-<Date.now()の36進>-<Math.randomの36進8文字>`（`#issueCanvasId()`に閉じる。
 *     一覧に同じidがあれば採り直す）。図形のid（`shape-<連番>`）とは別体系で、他のモジュールは形式を解釈しない。
 *
 * ■ 自動保存
 *   - 契機は`historyManager.onChange`のみ（編集操作の記録・取り消し・やり直しの適用成功・`clear()`での破棄）。
 *     選択の変更・ホバー・パン・ズーム・作成途中の図形の開始/破棄・ドラッグ中の途中経過では通知されないため保存しない。
 *     `model.onChange`は使わない。
 *   - 通知のたびに保留中のタイマーを張り直し、最後の通知から`AUTOSAVE_DELAY_MS`後に1回保存する。
 *   - 予約しない条件：開いているキャンバスが無い（読み込み完了前）／`'unavailable'`／`#isSwitching`が真。
 *   - ページ非表示時の確定：main.jsが`visibilitychange`（hidden）・`pagehide`で`flushPendingSave()`を呼ぶ
 *     （本クラスは`document`・`window`のイベントを購読しない）。保留中の保存の作業データの取得と書き込みの呼び出しは
 *     `flushPendingSave()`内で同期的に行われる。
 *   - 保留：まだ確定していない保存があること（`#pendingSaveCanvasId`が非`null`）。タイマー待ちのほか、失敗後の再試行待ち・
 *     記録を書けずに開いたキャンバス（いずれもタイマー無し）を含む。`flushPendingSave()`はタイマーの有無によらず保留を直ちに書く。
 *   - 書き込み中の保存：タイマーが発火して書き込み中（`putRecord`の完了待ち）の自動保存は`#inFlightSave`に保持する。
 *     `flushPendingSave()`は保留が無くても書き込み中の保存があればその完了を待って成否を返すため、
 *     切り替え処理の手順2は書き込み中の保存の失敗でも切り替えを中止する（保存できていない変更を画面から消さない）。
 *   - 保存に失敗した変更の保持は「■ 保存に失敗した変更の保持」を参照。
 *
 * ■ 保存に失敗した変更の保持
 *   - 守るべき動作：保存に失敗した変更は、利用者が明示的に捨てない限り失われない。切り替えでは失わず、ページを離れる前に警告できる。
 *     開いているキャンバスの削除の確認は明示的に捨てる操作で、削除の開始で保留と未保存を破棄する（削除に失敗したら未保存を元へ戻し、自動保存を予約し直す）。
 *   - 未保存：`#hasUnsaved`が真（`hasUnsavedChanges()`が返す）。保留（`#pendingSaveCanvasId`が非`null`）とは別の状態。
 *   - 失敗した自動保存は保留として保持する（`#pendingSaveCanvasId`を設定し直す。タイマーは張らない）。記録を書けずに開いたキャンバスも
 *     同じく保留（タイマー無し）・未保存として保持する（`#enterCanvas`の手順6）。
 *   - 失敗を記録するのは最新の書き込み（`#inFlightSave`が自分自身）で、開いているキャンバス宛てで、`#isSwitching`が偽のものだけ
 *     （古い書き込み・別のキャンバス宛て・切り替え中・削除の`await`中の結果で、状態の保持や削除済みの記録の復活を起こさないため）。
 *     成功の反映にも同じ条件を適用する。
 *   - 再試行の契機：次の編集（`#scheduleSave`でタイマーを張り直す）・切り替え処理（手順2・確定手順の`flushPendingSave()`。失敗する限り
 *     何度でも切り替えを中止する）・ページ非表示時（main.jsの`flushPendingSave()`）。
 *   - `hasUnsavedChanges()`が真になる条件：最新の書き込みの失敗・記録を書けずに開いた・`'unavailable'`で編集があった。
 *     偽に戻る条件：有効な書き込みの成功・`#enterCanvas`の手順6（記録を書けずに開いた場合を除く）・開いているキャンバスの削除の開始
 *     （削除に失敗したら元へ戻す）。タイマー待ちだけの変更は含めない（`pagehide`の`flushPendingSave()`で書かれるため）。
 *
 * ■ 非同期保存と切り替えの順序の保証
 *   1. 保存の作業データは呼び出し時点で同期的に取得し、予約時点のキャンバスidと一致する場合のみ、そのidの記録へ書く。
 *   2. 開く・新規作成・開く（ファイル）の切り替え処理は図形一式を入れ替える前に、確定手順（手順3と手順4の間。`#settleAndEnter`）で保留・書き込み中の保存を確定させる
 *      （手順2でも確定する）。確定手順を抜けたら`await`を挟まずに入れ替える（手順4）ため、`await`中に行われた編集も
 *      切り替え前のキャンバスへ書かれ、切り替え前のキャンバスへの書き込みが残ったまま入れ替えることはない。
 *   3. CanvasStorageはトランザクションを呼び出し時点で同期的に生成し、IndexedDBは生成順に実行するため、
 *      切り替え前のキャンバスへの書き込みが後発の書き込みより後に反映されることはない。
 *   4. 例：Aの保留中の保存がBへ切り替えた後にBの内容でAを上書きすることはない（入れ替え前に確定済み、
 *      または`#pendingSaveCanvasId`の不一致で破棄）。Bの記録へAの内容を書くこともない（Aの作業データはAのidと組で同期的に取得）。
 *
 * ■ 切り替え処理（開く・新規作成・開く（ファイル）・起動時の復元・開いているキャンバスの削除後の切り替えが共通して通る手順。
 *   起動時の復元・削除後の切り替えは手順3から通る（`'unavailable'`でのメモリ上の「無題 1」のみ手順4から）。
 *   開く・新規作成・開く（ファイル）のみ、手順3と手順4の間に確定手順を通る）
 *   1. `prepareSwitch()`（実体は選択モードへの切り替え。進行中の入力操作を中断し、作成途中の図形は破棄。
 *      本体ドラッグ・ハンドル操作で動かした分は1件の編集操作として記録され、自動保存が予約される）。
 *   2. 切り替え前のキャンバスの保留（タイマーの有無によらない）と書き込み中の保存を`await flushPendingSave()`で確定する
 *      （保留は直ちに書き、書き込み中の保存はその完了を待つ）。失敗後の再試行も同じ経路で、失敗する限り何度でも切り替えを中止する
 *      （開いているキャンバスのまま。`'writeFailed'`。保存できていない変更を画面から消さないため）。
 *   3. 切り替え先の読み込み（開く：記録の取得→`deserialize`。記録が無い・全体失敗なら中止して`'loadFailed'`。
 *      新規作成・開く（ファイル）：記録を作成して書き込む。失敗したら`'writeFailed'`を設定して`confirmOpenUnsaved`で確認し、
 *      「はい」なら記録の無いまま開いて未保存として保持し、「いいえ」（確認の例外を含む）なら中止する。
 *      開く（ファイル）の図形は呼び出し側が読み取り済みのものを使う。起動時・削除後は確認せず、開いて未保存として保持する）。
 *   確定手順（手順3と手順4の間。開く・新規作成・開く（ファイル）のみ。`#settleAndEnter`）：手順3の`await`中に行われた編集を含め、
 *      `prepareSwitch()`のうえ保留・書き込み中の保存が無くなるまで`flushPendingSave()`で確定することを繰り返す。保存の失敗、または
 *      確定手順内の例外で中止する。抜けたら`await`を挟まずに手順4へ入る（挟むと、その間の編集が切り替え前のキャンバスへ書かれなくなる）。
 *      中止時、新規作成・開く（ファイル）で書き込み済みの新しい記録は削除し（失敗は`console.warn`のみ）、一覧からも除く。
 *   4. 同期区間の開始（ここから手順6まで`await`を挟まない）：もう一度`prepareSwitch()`を呼ぶ（例外は`console.warn`して続ける）。
 *      この手順では保存を行わない（開く・新規作成・開く（ファイル）は確定手順が済んでいる。起動時の復元・削除後の切り替えには確定すべき保留が無い）。続けて`#isSwitching = true`とし、
 *      図形一式を`model.replaceAllShapes(shapes)`で入れ替える（図形のidは記録されたものを保持する。欠落・重複は`replaceAllShapes`が振り直す）。
 *   5. 履歴のリセット`historyManager.clear()`（切り替えは編集操作として記録しない。`beginEdit`/`commitEdit`を呼ばない）
 *      → ビュー変換を初期表示（倍率100%・原点を表示領域の中央）へ`resetView()` → `#isSwitching = false`。
 *   6. 開いているキャンバスを更新し、保留・未保存の状態を消し（記録を書けずに開いたときは保留・未保存として保持する）、
 *      最後に開いていたキャンバスの識別子を書き込み（`'unavailable'`では書かない。完了は待たない）、`issue`を更新して変更通知する。
 *   - 再描画・ボタン同期は`replaceAllShapes`・`clear()`・`reset()`の既存の通知経路のみで行う（本クラスは描画しない）。
 *   - クリップボードには触れない（切り替えで消えず、貼り付けの段数もリセットしない）。
 *
 * ■ `#isSwitching`（自動保存の予約を止める区間。唯一の仕組み）
 *   - 真の間は`historyManager.onChange`の通知を受けても自動保存を予約しない（手順5の`clear()`による通知を無視するため等）。
 *   - 真にするのは (a)切り替え処理の`replaceAllShapes`の直前から手順5の終わりまで（手順5の`clear()`の通知を保存の契機にしないため）と (b)開いているキャンバスの削除の開始から、削除後の切り替え処理の
 *     手順5の終わり（`#enterCanvas`内）または削除の中止まで、の2箇所のみ。
 *   - 偽へ戻すのは切り替え処理の手順5の終わり（`#enterCanvas`内）と削除の中止時のみ。
 *
 * ■ 起動時の復元（`start()`）
 *   - 開くキャンバスの決定規則：候補を「最後に開いていたキャンバス（一覧にあれば）→ 残りを最終更新日時の新しい順」に並べ、
 *     先頭から`deserialize`を試し、全体として読めた最初の1枚を開く。読めない記録は`console.warn`して次へ（記録は消さず一覧に残し、
 *     `'loadFailed'`を立てる）。候補が無い・すべて読めない場合は新しい空のキャンバスを作成して開く（初回起動を含む）。
 *   - 保存先を開けない・一覧を読み出せない・最後に開いていたキャンバスの識別子を読み出せない場合は`'unavailable'`とし、メモリ上だけの空のキャンバス「無題 1」を開く
 *     （保存先への書き込みを一切行わない）。
 *   - 読み込み完了前の操作の扱い：`loading`の間は、main.jsが覆い要素でキャンバスへのマウス入力を止める前提
 *     （読み込み完了時の切り替えで利用者の操作が消されないため）。本クラスも読み込み中の開く・新規作成等を受理しない。
 *     読み込み完了前は開いているキャンバスが無いため自動保存も予約されない。
 *
 * ■ 壊れた作業データ
 *   - 全体が読み込めない（`ok: false`）キャンバスは開かない（起動時は次の候補へ、開く操作では開いているキャンバスのまま）。
 *     `console.warn`と`'loadFailed'`。記録は削除しない。
 *   - 一部の図形がスキップされた場合は読めた図形で開き、`console.warn`（スキップ一覧）と`'partialLoad'`を残す。
 *     開いただけでは記録を書き換えない（自動保存は編集操作でのみ予約される）。編集するとスキップした図形は記録から消える。
 *
 * ■ 新規キャンバスの命名規則
 *   - 「無題 1」「無題 2」…のうち、キャンバス一覧の名前と一致しない最小の番号。`'unavailable'`時のメモリ上のキャンバスも同じ規則。
 *
 * ■ 開く（ファイル）（`createCanvasFromShapes(rawName, shapes)`。`createCanvas()`は`createCanvasFromShapes(null, [])`への委譲）
 *   - 呼び出し側（ファイル操作）が作業データファイルから読み取った図形を、新しいキャンバスとして一覧へ登録して開く。
 *   - 受理条件：読み込み中・処理中・`'unavailable'`でない。受理しなければ何もせず`false`。
 *   - 通る手順：切り替え処理の手順1〜6と確定手順のすべて。手順2（切り替え前の保存）に失敗したら中止して`false`
 *     （`#summaries`へ登録する前のため一覧に載らない。`'writeFailed'`）。手順3は新しい記録の書き込みで、失敗したら`'writeFailed'`を設定して
 *     `confirmOpenUnsaved`で確認し、「はい」なら記録の無いまま未保存として開き（保存できるまで別のキャンバスへは移れない）、
 *     「いいえ」なら要約を一覧から除いて中止して`false`。確定手順の失敗で中止した場合も要約を除き、書き込み済みの新しい記録を削除する。
 *     切り替えは編集操作として記録しない。
 *   - 名前：`rawName`を名前の変更と同じ規則（前後の空白を除く・100文字へ切り詰め）で正規化し、空なら「無題 n」。重複は許す。
 *   - 記録の作業データ：`shapes`を現行版で`serialize`したもの（読めなかった図形は含まれない）。
 *   - `'partialLoad'`は立てない：それはブラウザ内の記録を開いた際に一部の図形が読めなかった旨の予告であり、
 *     ファイル側の記録には読めた図形しか入らないため。読めない図形の通知は呼び出し側（ファイル操作の通知）が行う。
 *     手順6の既存の働きにより、残っていた`'loadFailed'`/`'partialLoad'`は解除される。
 *
 * ■ 名前の変更（`renameCanvas(id, rawName)`）
 *   - 対象は一覧の任意のキャンバス。受理条件：読み込み中・処理中・`'unavailable'`でない、`id`が一覧にある、
 *     `rawName`が文字列で、前後の空白を除いて空でない（キャンセルは呼び出し側で何も呼ばない）。
 *   - `CANVAS_NAME_MAX_LENGTH`（100文字）を超える場合は先頭100文字（`Array.from`でサロゲートペアを分断しない）に切り詰めて受理する。
 *     変更後の名前が現在の名前と同じなら書き込まない（`false`）。名前の重複は許す。
 *   - 受理時はメモリ上の要約の名前を更新して通知し、保存先は名前のみ書き換える（`renameRecord`）。失敗時は`'writeFailed'`
 *     （メモリ上の名前は新しいまま。開いているキャンバスなら次の自動保存で記録の名前も揃う）。
 *   - 最終更新日時は更新しない（図形一式の変更ではなく、一覧の並び（最終更新日時の新しい順）が名前の変更で入れ替わると
 *     押そうとした行が動いて紛らわしいため）。
 *
 * ■ 削除（`deleteCanvas(id)`）
 *   - 対象は一覧の任意のキャンバス。受理条件：読み込み中・処理中・`'unavailable'`でない、`id`が一覧にある（確認の小窓は呼び出し側）。
 *   - 開いていないキャンバス：記録を削除し、成功で一覧から除いて通知する。失敗なら`'writeFailed'`で一覧に残す。
 *     開いているキャンバス・図形一式・履歴・自動保存には触れない。
 *   - 開いているキャンバス：(1)`prepareSwitch()` (2)保留中の保存と未保存を破棄（確定しない。破棄する未保存は削除の失敗に備えて控える）(3)`#isSwitching = true`
 *     (4)記録を削除。失敗したら`#isSwitching = false`へ戻して中止し（開いているキャンバスのまま。`'writeFailed'`）、
 *     控えた未保存を元へ戻し、破棄した保留分と削除の`await`中の編集を保存するため自動保存を予約し直す（記録は残っているため、そのキャンバス自身へ書く）
 *     (5)成功したら一覧から除き、残りを最終更新日時の新しい順に読み込みを試して最初に読めたものを開く（切り替え処理の手順3〜6。
 *     手順2は不要）。1枚も残らない・すべて読めない場合は新しい空のキャンバスを作成して開く。
 *   - 削除したキャンバスの記録が復活しない理由：保留中の保存は(2)で破棄され、削除の開始から削除後の切り替え処理の手順5の終わり
 *     （`#enterCanvas`内）までの予約は`#isSwitching`で止められ（それ以降の予約は新しく開いたキャンバスのidで行われる）、
 *     削除前に生成済みの書き込みは削除より先に実行される（生成順）。削除のために`#openCanvasId`を`null`にする処理は設けない。
 *
 * ■ 処理中の直列化
 *   - 開く・新規作成・開く（ファイル）・名前の変更・削除・起動時の復元は`#isBusy`で直列化し、処理中・読み込み中・`'unavailable'`では
 *     新たな操作を受け付けない（`false`で解決）。処理中もキャンバスの編集は止めない（確定手順で整合を取る）。
 *
 * ■ 公開メソッドのPromise
 *   - rejectしない。想定した失敗は内部で捕捉して`console.warn`＋`issue`で示す。予期しない例外は`console.warn`のみで`issue`を立てない。
 *   - リスナー（`onChange`で登録した関数）の例外は`#notifyChange`が捕捉して`console.warn`し、残りのリスナーへの通知を続ける
 *     （リスナーの例外で公開メソッドがrejectすることはない）。
 *
 * 依存の制約:
 *   - importはDocumentSerializerのみ。CanvasStorage・VectorModel・HistoryManagerは注入で受け取る。
 *     新しい記録を書けないときの確認は`confirmOpenUnsaved`の注入で行う（文言と`window.confirm`はパレット側にあり、本クラスは知らない）。
 *   - DOMに触れない。`setTimeout`/`clearTimeout`/`Date.now`/`Math.random`以外のブラウザAPIを使わない。
 *   - 図形種別の分岐・図形固有のプロパティ名・図形のid形式の知識を持たない（作業データは不透明に扱う）。
 *   - InputTrackerに依存せず操作モードを知らない（進行中の入力操作の中断は注入された`prepareSwitch()`へ委ねる）。
 */
export class CanvasLibrary {
    /**
     * ブラウザ内保存先への読み書き。
     * @type {import('../io/CanvasStorage.js').CanvasStorage}
     */
    #storage;

    /**
     * 開いているキャンバスの図形一式を保持するVectorModel（getShapes・replaceAllShapesのみ使用）。
     * @type {import('../core/VectorModel.js').VectorModel}
     */
    #model;

    /**
     * 編集操作の履歴（onChange・clearのみ使用）。
     * @type {import('../core/HistoryManager.js').HistoryManager}
     */
    #historyManager;

    /**
     * 進行中の入力操作を中断して選択モードへ切り替える注入関数（実体はmain.jsの`applyMode(OperationMode.SELECT)`）。
     * @type {() => void}
     */
    #prepareSwitch;

    /**
     * ビュー変換を初期表示（倍率100%・原点を表示領域の中央）へ戻す注入関数（実体はmain.jsの`resetViewToCenter()`）。
     * @type {() => void}
     */
    #resetView;

    /**
     * 新しいキャンバスの記録を書けなかったとき、保存しないまま開くかを利用者に確認する注入関数（実体はmain.jsの`canvasPalette.confirmOpenUnsaved()`）。
     * @type {() => boolean}
     */
    #confirmOpenUnsaved;

    /**
     * キャンバス一覧（メモリ上の要約。作業データは保持しない）。キーはキャンバスの識別子。
     * @type {Map<string, CanvasSummary>}
     */
    #summaries = new Map();

    /**
     * 開いているキャンバスの識別子（読み込み完了前は`null`）。
     * @type {string|null}
     */
    #openCanvasId = null;

    /**
     * 起動時の読み込み中か。`start()`前も真（起動直後の初回の表示同期から読み込み中として扱うため）。
     * @type {boolean}
     */
    #isLoading = true;

    /**
     * 開く・新規作成・開く（ファイル）・名前の変更・削除・起動時の復元の処理中か（直列化のため）。
     * @type {boolean}
     */
    #isBusy = false;

    /**
     * 自動保存の予約を止める区間か（クラスJSDocの「#isSwitching」参照）。
     * @type {boolean}
     */
    #isSwitching = false;

    /**
     * `start()`を呼んだか（2回目以降の呼び出しを無視するため）。
     * @type {boolean}
     */
    #hasStarted = false;

    /**
     * 保存・読み込みの問題（最後に起きたもの1つ）。
     * @type {CanvasIssue}
     */
    #issue = null;

    /**
     * 保留中の自動保存のタイマーid（タイマー待ちでなければ`null`。保留があってもタイマーが無い場合がある：失敗後の再試行待ち・
     * 記録を書けずに開いたキャンバス）。
     * @type {ReturnType<typeof setTimeout>|null}
     */
    #pendingSaveTimer = null;

    /**
     * 保留中（まだ確定していない保存がある）の自動保存の対象キャンバスの識別子（保留が無ければ`null`）。
     * `#scheduleSave`が設定し、`#saveOpenCanvasNow`の開始で解除する（最新の書き込みが失敗すれば設定し直す）。
     * `#enterCanvas`の手順6で更新し（記録を書けずに開いたときのみ非`null`）、開いているキャンバスの削除の開始で破棄する。
     * @type {string|null}
     */
    #pendingSaveCanvasId = null;

    /**
     * ページを離れると失われる変更があるか（`hasUnsavedChanges()`が返す）。
     * 真：最新の書き込みの失敗・記録を書けずに開いた・`'unavailable'`で編集があった。
     * 偽：有効な書き込みの成功・`#enterCanvas`の手順6（記録を書けずに開いた場合を除く）・開いているキャンバスの削除の開始。
     * @type {boolean}
     */
    #hasUnsaved = false;

    /**
     * 書き込み中（`putRecord`の完了待ち）の自動保存の`Promise`（書き込み中でなければ`null`）。
     * `#saveOpenCanvasNow()`が書き込みを開始したときに設定し、完了時（成功・失敗とも）に、それが自分自身である場合のみ`null`へ戻す
     * （後から開始した保存で上書きされていれば戻さない）。`flushPendingSave()`が、保留が無いときにその完了を待つために使う。
     * @type {Promise<boolean>|null}
     */
    #inFlightSave = null;

    /**
     * 状態の変化時に呼び出すリスナーの配列。
     * @type {Array<Function>}
     */
    #listeners = [];

    /**
     * @param {Object} deps - 依存オブジェクト
     * @param {import('../io/CanvasStorage.js').CanvasStorage} deps.storage - ブラウザ内保存先への読み書き
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - 開いているキャンバスの図形一式を保持するVectorModel
     * @param {import('../core/HistoryManager.js').HistoryManager} deps.historyManager - 編集操作の履歴（自動保存の契機・切り替え時のリセット）
     * @param {() => void} deps.prepareSwitch - 進行中の入力操作を中断して選択モードへ切り替える関数
     * @param {() => void} deps.resetView - ビュー変換を初期表示（原点を表示領域の中央・倍率100%）へ戻す関数
     * @param {() => boolean} deps.confirmOpenUnsaved - 新しいキャンバスの記録を書けないとき、保存しないまま開くかを確認する関数（開くなら`true`）
     * @throws {Error} prepareSwitch・resetView・confirmOpenUnsavedのいずれかが関数でない場合
     */
    constructor({ storage, model, historyManager, prepareSwitch, resetView, confirmOpenUnsaved }) {
        if (typeof prepareSwitch !== 'function' || typeof resetView !== 'function'
            || typeof confirmOpenUnsaved !== 'function') {
            throw new Error('CanvasLibrary: prepareSwitch・resetView・confirmOpenUnsaved には関数を指定してください。');
        }
        this.#confirmOpenUnsaved = confirmOpenUnsaved;
        this.#storage = storage;
        this.#model = model;
        this.#historyManager = historyManager;
        this.#prepareSwitch = prepareSwitch;
        this.#resetView = resetView;
        this.#historyManager.onChange(() => {
            this.#scheduleSave();
        });
    }

    /**
     * 起動時の復元：保存先を開き、キャンバス一覧を作り、開くキャンバスの決定規則（クラスJSDoc参照）に従って1枚を開く。
     * 2回目以降の呼び出しは何もしない。rejectしない。
     * 手順：読み込み中として通知 → `open`・`getAllRecords`・`getLastOpenedId`（失敗なら`'unavailable'`でメモリ上の
     * 「無題 1」を切り替え処理の手順4から開く）→ 記録の検証（`id`・`name`が文字列、`updatedAt`が有限の数値。外れた記録は`console.warn`して一覧から除外。
     * 保存先からは消さない）→ 候補を順に読み込み、読めた最初の1枚を切り替え処理の手順3から開く → 読み込み完了として通知。
     * @returns {Promise<void>}
     */
    async start() {
        if (this.#hasStarted) {
            return;
        }
        this.#hasStarted = true;
        this.#isLoading = true;
        this.#isBusy = true;
        this.#notifyChange();
        try {
            let records;
            let lastOpenedId;
            try {
                await this.#storage.open();
                records = await this.#storage.getAllRecords();
                lastOpenedId = await this.#storage.getLastOpenedId();
            } catch (error) {
                console.warn('CanvasLibrary: ブラウザ内の保存先を利用できないため、保存せずに編集を続けます。', error);
                this.#issue = 'unavailable';
                const summary = { id: this.#issueCanvasId(), name: this.#nextUntitledName(), updatedAt: Date.now() };
                this.#summaries.set(summary.id, summary);
                this.#enterCanvas(summary, []);
                return;
            }

            /** @type {Map<string, Object>} 検証を通った記録（キーはキャンバスの識別子） */
            const recordsById = new Map();
            for (const record of Array.isArray(records) ? records : []) {
                if (!CanvasLibrary.#isValidRecord(record)) {
                    console.warn('CanvasLibrary: 形式が正しくないキャンバス記録を一覧から除外します。', record);
                    continue;
                }
                recordsById.set(record.id, record);
                this.#summaries.set(record.id, { id: record.id, name: record.name, updatedAt: record.updatedAt });
            }

            const sorted = this.#sortedSummaries();
            const lastOpened = typeof lastOpenedId === 'string' ? this.#summaries.get(lastOpenedId) : undefined;
            const candidates = lastOpened
                ? [lastOpened, ...sorted.filter((summary) => summary.id !== lastOpened.id)]
                : sorted;
            await this.#openFirstLoadable(candidates, (summary) => {
                const record = recordsById.get(summary.id);
                return record ? record.document : null;
            });
        } catch (error) {
            console.warn('CanvasLibrary: 起動時の読み込み中に予期しないエラーが発生しました。', error);
        } finally {
            this.#isBusy = false;
            this.#isLoading = false;
            this.#notifyChange();
        }
    }

    /**
     * キャンバス一覧から指定したキャンバスを開く（切り替え処理の手順1〜6）。
     * 受理条件：読み込み中・処理中・`'unavailable'`でない、`id`が一覧にある、開いているキャンバス自身でない。
     * 受理しなければ何もせず`false`。切り替え前のキャンバスの保存（手順2・読み込み後の確定手順`#settleAndEnter`）に失敗した（`'writeFailed'`）・記録が無い・
     * 全体として読み込めない（`'loadFailed'`）場合は中止し、開いているキャンバスのまま`false`。rejectしない。
     * @param {string} id 開くキャンバスの識別子
     * @returns {Promise<boolean>} 開いたか
     */
    async openCanvas(id) {
        if (!this.#canAcceptOperation() || !this.#summaries.has(id) || id === this.#openCanvasId) {
            return false;
        }
        this.#isBusy = true;
        this.#notifyChange();
        try {
            if (!(await this.#prepareLeave())) {
                return false;
            }
            let record;
            try {
                record = await this.#storage.getRecord(id);
            } catch (error) {
                console.warn('CanvasLibrary: キャンバスの記録を読み出せませんでした。', id, error);
                this.#setIssue('loadFailed');
                return false;
            }
            if (!record) {
                console.warn('CanvasLibrary: キャンバスの記録が見つかりません。', id);
                this.#setIssue('loadFailed');
                return false;
            }
            const result = DocumentSerializer.deserialize(record.document);
            if (!result.ok) {
                console.warn('CanvasLibrary: キャンバスの作業データを読み込めませんでした。', id, result.error);
                this.#setIssue('loadFailed');
                return false;
            }
            const summary = this.#summaries.get(id);
            if (!summary) {
                return false;
            }
            if (result.skipped.length > 0) {
                console.warn('CanvasLibrary: 一部の図形を読み込めませんでした。', id, result.skipped);
            }
            return await this.#settleAndEnter(summary, result.shapes, result.skipped.length > 0 ? 'partialLoad' : null);
        } catch (error) {
            console.warn('CanvasLibrary: キャンバスを開く処理で予期しないエラーが発生しました。', error);
            return false;
        } finally {
            this.#isBusy = false;
            this.#notifyChange();
        }
    }

    /**
     * 新しい空のキャンバスを作成して開く（切り替え処理の手順1〜6）。名前は新規キャンバスの命名規則に従う。
     * `createCanvasFromShapes(null, [])`への委譲（受理条件・中止条件・rejectしない点は同メソッドに従う）。
     * @returns {Promise<boolean>} 作成して開いたか
     */
    createCanvas() {
        return this.createCanvasFromShapes(null, []);
    }

    /**
     * 指定の名前・図形で新しいキャンバスを作成して開く（切り替え処理の手順1〜6。クラスJSDocの「開く（ファイル）」参照）。
     * 受理条件：読み込み中・処理中・`'unavailable'`でない。受理しなければ何もせず`false`。
     * 手順2（切り替え前のキャンバスの保存）に失敗した場合は中止して`false`（`#summaries`へ登録する前なので一覧に載らない。`'writeFailed'`）。
     * 新しい記録の書き込みに失敗した場合は`confirmOpenUnsaved`で確認し、「いいえ」なら要約を一覧から除いて`false`（開いているキャンバスのまま）、
     * 「はい」なら`'writeFailed'`・未保存として開く（保存できるまで別のキャンバスへは移れない）。
     * 切り替え前の保存の確定（`#settleAndEnter`）に失敗した場合も中止して`false`。
     * 名前は`rawName`を正規化し、空なら「無題 n」（重複は許す）。記録の作業データは`shapes`を現行版で`serialize`したもの。
     * `'partialLoad'`は立てない（`loadIssue`は`null`）。rejectしない。
     * @param {*} rawName キャンバス名の候補（`null`・空なら「無題 n」）
     * @param {Array<*>} shapes 開く図形の配列（不透明に扱う）
     * @returns {Promise<boolean>} 作成して開いたか
     */
    async createCanvasFromShapes(rawName, shapes) {
        if (!this.#canAcceptOperation()) {
            return false;
        }
        this.#isBusy = true;
        this.#notifyChange();
        try {
            if (!(await this.#prepareLeave())) {
                return false;
            }
            return await this.#createAndEnter(null, rawName, shapes, true);
        } catch (error) {
            console.warn('CanvasLibrary: キャンバスの新規作成で予期しないエラーが発生しました。', error);
            return false;
        } finally {
            this.#isBusy = false;
            this.#notifyChange();
        }
    }

    /**
     * キャンバスの名前を変更する（クラスJSDocの「名前の変更」参照）。
     * 受理条件：読み込み中・処理中・`'unavailable'`でない、`id`が一覧にある、`rawName`が文字列で前後の空白を除いて空でない。
     * `CANVAS_NAME_MAX_LENGTH`を超える名前は先頭から切り詰めて受理する（切り詰めで末尾に残った空白も除く）。
     * 変更後の名前が現在の名前と同じなら書き込まず`false`。受理時はメモリ上の名前を更新して通知し、保存先の名前のみを書き換える
     * （最終更新日時は変えない）。書き込みの失敗・記録が無い場合は`console.warn`＋`'writeFailed'`（メモリ上の名前は新しいまま）。
     * rejectしない。
     * @param {string} id 名前を変更するキャンバスの識別子
     * @param {*} rawName 利用者が入力した名前（前後の空白を除いて使う）
     * @returns {Promise<boolean>} 名前を変更したか（保存先への書き込みに失敗した場合も、メモリ上で変更していれば`true`）
     */
    async renameCanvas(id, rawName) {
        if (!this.#canAcceptOperation() || !this.#summaries.has(id) || typeof rawName !== 'string') {
            return false;
        }
        const name = CanvasLibrary.#normalizeName(rawName);
        if (name === '') {
            return false;
        }
        const summary = this.#summaries.get(id);
        if (name === summary.name) {
            return false;
        }
        this.#isBusy = true;
        this.#summaries.set(id, { ...summary, name });
        this.#notifyChange();
        try {
            let renamed;
            try {
                renamed = await this.#storage.renameRecord(id, name);
            } catch (error) {
                console.warn('CanvasLibrary: キャンバスの名前の保存に失敗しました。', id, error);
                this.#setIssue('writeFailed');
                return true;
            }
            if (renamed !== true) {
                console.warn('CanvasLibrary: 名前を変更するキャンバスの記録が見つかりません。', id);
                this.#setIssue('writeFailed');
            }
            return true;
        } catch (error) {
            console.warn('CanvasLibrary: 名前の変更で予期しないエラーが発生しました。', error);
            return true;
        } finally {
            this.#isBusy = false;
            this.#notifyChange();
        }
    }

    /**
     * キャンバスを削除する（クラスJSDocの「削除」参照）。
     * 受理条件：読み込み中・処理中・`'unavailable'`でない、`id`が一覧にある。受理しなければ何もせず`false`。
     * 開いていないキャンバスは記録を削除して一覧から除く（開いているキャンバス・図形一式・履歴・自動保存には触れない）。
     * 開いているキャンバスは、保留中の保存を破棄し`#isSwitching = true`にしてから記録を削除し、成功したら残りのうち
     * 最終更新日時の新しい順で最初に読めたものを開く（無ければ新しい空のキャンバスを作成して開く）。
     * 削除に失敗した場合は`console.warn`＋`'writeFailed'`で一覧に残し（開いているキャンバスなら`#isSwitching = false`へ戻して
     * 自動保存を予約し直す）、`false`。rejectしない。
     * @param {string} id 削除するキャンバスの識別子
     * @returns {Promise<boolean>} 削除したか
     */
    async deleteCanvas(id) {
        if (!this.#canAcceptOperation() || !this.#summaries.has(id)) {
            return false;
        }
        this.#isBusy = true;
        this.#notifyChange();
        try {
            if (id !== this.#openCanvasId) {
                return await this.#deleteClosedCanvas(id);
            }
            return await this.#deleteOpenCanvas(id);
        } catch (error) {
            console.warn('CanvasLibrary: キャンバスの削除で予期しないエラーが発生しました。', error);
            return false;
        } finally {
            this.#isBusy = false;
            this.#notifyChange();
        }
    }

    /**
     * 保留中の自動保存・書き込み中の自動保存を確定する（main.jsがページ非表示時に呼ぶ。切り替え処理の手順2・確定手順でも使う）。
     *   - 保留（`#pendingSaveCanvasId`が非`null`。タイマー待ち、または失敗後の再試行待ち・記録を書けずに開いたキャンバス）があれば、
     *     タイマーの有無によらず直ちに`#saveOpenCanvasNow()`で保存し、その結果を返す（作業データの取得と書き込みの呼び出しは
     *     本メソッド内で同期的に行われる。ページ非表示時の確定はこれに依存する）。
     *   - 保留が無く書き込み中の保存（`#inFlightSave`）があれば、その完了を待って成否を返す（書き込み中の
     *     保存の失敗でも、切り替え処理が切り替えを中止できるようにするため）。
     *   - どちらも無ければ`true`で解決する。
     * rejectしない。
     * @returns {Promise<boolean>} 保存が成功した（または保存すべきものが無かった）か
     */
    flushPendingSave() {
        if (this.#pendingSaveCanvasId !== null) {
            return this.#saveOpenCanvasNow();
        }
        if (this.#inFlightSave !== null) {
            return this.#inFlightSave;
        }
        return Promise.resolve(true);
    }

    /**
     * ページを離れると失われる変更があるか（保存に失敗した変更・記録を書けずに開いたキャンバス・`'unavailable'`での編集）。
     * タイマー待ちの変更は`pagehide`の`flushPendingSave()`で書かれるため含めない。main.jsの`beforeunload`が使う。
     * @returns {boolean}
     */
    hasUnsavedChanges() {
        return this.#hasUnsaved;
    }

    /**
     * 現在の状態を返す（毎回新しいオブジェクト）。
     * @returns {CanvasLibraryState}
     */
    getState() {
        const openSummary = this.#openCanvasId !== null ? this.#summaries.get(this.#openCanvasId) : undefined;
        return {
            loading: this.#isLoading,
            busy: this.#isBusy,
            canManage: this.#issue !== 'unavailable',
            openCanvasId: this.#openCanvasId,
            openCanvasName: openSummary ? openSummary.name : null,
            canvases: this.#sortedSummaries().map((summary) => ({
                id: summary.id,
                name: summary.name,
                updatedAt: summary.updatedAt,
                isOpen: summary.id === this.#openCanvasId
            })),
            issue: this.#issue,
            hasSaveProblem: this.#issue === 'unavailable' || this.#issue === 'writeFailed'
        };
    }

    /**
     * 状態（一覧・開いているキャンバス・読み込み中・処理中・issue）の変化時に呼び出されるリスナーを登録する。
     * @param {Function} listener 登録するリスナー（関数以外は無視する）
     */
    onChange(listener) {
        if (typeof listener === 'function') {
            this.#listeners.push(listener);
        }
    }

    /**
     * 開く・新規作成・開く（ファイル）・名前の変更・削除の操作を受理できるか（読み込み中・処理中・`'unavailable'`でない）。
     * @returns {boolean}
     */
    #canAcceptOperation() {
        return !this.#isLoading && !this.#isBusy && this.#issue !== 'unavailable';
    }

    /**
     * 新しいキャンバスの識別子を採番する（`canvas-<Date.now()の36進>-<Math.randomの36進8文字>`）。
     * キャンバス一覧に同じidがあれば採り直す。形式の知識は本メソッドに閉じる。
     * @returns {string}
     */
    #issueCanvasId() {
        let id;
        do {
            const randomPart = Math.random().toString(36).slice(2).padEnd(8, '0').slice(0, 8);
            id = `canvas-${Date.now().toString(36)}-${randomPart}`;
        } while (this.#summaries.has(id));
        return id;
    }

    /**
     * 新規キャンバスの名前を返す：「無題 1」「無題 2」…のうち、キャンバス一覧の名前と一致しない最小の番号。
     * @returns {string}
     */
    #nextUntitledName() {
        const names = new Set(Array.from(this.#summaries.values(), (summary) => summary.name));
        let n = 1;
        while (names.has(UNTITLED_NAME_PREFIX + n)) {
            n += 1;
        }
        return UNTITLED_NAME_PREFIX + n;
    }

    /**
     * 自動保存を予約する（`historyManager.onChange`の通知ごとに呼ばれる）。保留中のタイマーを解除して張り直す。
     * 予約しない条件：開いているキャンバスが無い／`#isSwitching`が真／`'unavailable'`（この場合は保存せず、未保存だけを真にする）。
     * @returns {void}
     */
    #scheduleSave() {
        if (this.#openCanvasId === null || this.#isSwitching) {
            return;
        }
        if (this.#issue === 'unavailable') {
            this.#hasUnsaved = true;
            return;
        }
        if (this.#pendingSaveTimer !== null) {
            clearTimeout(this.#pendingSaveTimer);
        }
        this.#pendingSaveCanvasId = this.#openCanvasId;
        this.#pendingSaveTimer = setTimeout(() => {
            void this.#saveOpenCanvasNow();
        }, AUTOSAVE_DELAY_MS);
    }

    /**
     * 保留中の自動保存を直ちに実行する。タイマーを解除し、予約時点のキャンバスidが開いているキャンバスと一致しなければ
     * 破棄して`true`（別のキャンバスの記録へ書かない防御）。一致すれば同期的に記録を組み立てて書き込みを呼び
     * （トランザクションはこの時点で生成される）、要約の最終更新日時を更新して通知する。
     * 保留（`#pendingSaveCanvasId`）はこの開始時に解除する。完了時は`#isCurrentWrite`が真の場合のみ状態へ反映する：
     * 書き込み成功で未保存を偽にし`'writeFailed'`を解除して通知、失敗で`console.warn`＋保留を設定し直す（タイマーは張らない。
     * 再試行の契機は次の編集・切り替え・ページ非表示時）＋未保存を真＋`'writeFailed'`＋通知（`console.warn`は常に出す）。rejectしない。
     * 記録の組み立て（`getShapes`・`serialize`）で例外が起きた場合も`putRecord`の失敗と同じ扱いにする（同期で例外を投げない）。
     * 書き込みを開始したときに、その完了を表す`Promise`を`#inFlightSave`へ設定し、完了時（成功・失敗とも）に`#inFlightSave`が
     * それ自身である場合のみ`null`へ戻す（`flushPendingSave()`が書き込み中の保存の完了を待てるようにするため）。
     * 書くべきものが無く破棄した場合は`#inFlightSave`に触れない。
     * @returns {Promise<boolean>} 書き込みに成功した（または書くべきものが無かった）か
     */
    #saveOpenCanvasNow() {
        if (this.#pendingSaveTimer !== null) {
            clearTimeout(this.#pendingSaveTimer);
            this.#pendingSaveTimer = null;
        }
        const canvasId = this.#pendingSaveCanvasId;
        this.#pendingSaveCanvasId = null;
        if (canvasId === null || canvasId !== this.#openCanvasId) {
            return Promise.resolve(true);
        }
        const summary = this.#summaries.get(canvasId);
        if (!summary) {
            return Promise.resolve(true);
        }

        const updatedAt = Date.now();
        let writing;
        try {
            const record = {
                id: canvasId,
                name: summary.name,
                updatedAt,
                document: DocumentSerializer.serialize(this.#model.getShapes())
            };
            writing = this.#storage.putRecord(record);
        } catch (error) {
            writing = Promise.reject(error);
        }
        this.#summaries.set(canvasId, { ...summary, updatedAt });
        this.#notifyChange();

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
        this.#inFlightSave = saving;
        return saving;
    }

    /**
     * 書き込みの完了結果を開いているキャンバスの状態へ反映してよいか（最新の書き込みで、開いているキャンバス宛てで、切り替え中でない）。
     * 古い書き込みの結果で新しい結果を打ち消さない・削除の`await`中に保留を記録して削除した記録を復活させない・
     * 別のキャンバス宛ての結果で状態を変えないための判定。`#finishInFlightSave`より前に評価すること（後だと常に偽になる）。
     * @param {Promise<boolean>} saving 完了した書き込みの`Promise`
     * @param {string} canvasId 書き込み先のキャンバスの識別子
     * @returns {boolean} 反映してよいか
     */
    #isCurrentWrite(saving, canvasId) {
        return this.#inFlightSave === saving && canvasId === this.#openCanvasId && !this.#isSwitching;
    }

    /**
     * 書き込み中の自動保存の完了時に呼ぶ：`#inFlightSave`が完了した保存自身である場合のみ`null`へ戻す
     * （後から開始した保存で上書きされていれば、そちらの完了を待てるよう残す）。
     * @param {Promise<boolean>} saving 完了した保存の`Promise`（`#saveOpenCanvasNow()`の戻り値）
     * @returns {void}
     */
    #finishInFlightSave(saving) {
        if (this.#inFlightSave === saving) {
            this.#inFlightSave = null;
        }
    }

    /**
     * 開いていないキャンバスを削除する（`deleteCanvas`の一部。`#isBusy`の設定・解除と最後の通知は呼び出し側）。
     * 記録を削除し、成功で一覧から除いて通知する。失敗なら`console.warn`＋`'writeFailed'`で一覧に残す。
     * 開いているキャンバス・図形一式・履歴・自動保存には触れない。
     * @param {string} id 削除するキャンバスの識別子（開いているキャンバスでないこと）
     * @returns {Promise<boolean>} 削除したか
     */
    async #deleteClosedCanvas(id) {
        try {
            await this.#storage.deleteRecord(id);
        } catch (error) {
            console.warn('CanvasLibrary: キャンバスの削除に失敗しました。', id, error);
            this.#setIssue('writeFailed');
            return false;
        }
        this.#summaries.delete(id);
        this.#notifyChange();
        return true;
    }

    /**
     * 開いているキャンバスを削除し、残りのキャンバスへ切り替える（`deleteCanvas`の一部。`#isBusy`の設定・解除と最後の通知は呼び出し側）。
     * 手順：(1)`prepareSwitch()` (2)保留中の保存と未保存（`#hasUnsaved`）を破棄（確定しない）(3)`#isSwitching = true`（削除後の切り替え処理の手順5の終わり
     * （`#enterCanvas`内）で`false`に戻る）(4)記録を削除。失敗したら`#isSwitching = false`へ戻して中止し、`'writeFailed'`とし、
     * 未保存を元へ戻し（キャンバスが開いたまま残るため）、破棄した保留分と`await`中の編集を保存するため`#scheduleSave()`で予約し直す (5)成功したら一覧から除き、残りを最終更新日時の
     * 新しい順に`#openFirstLoadable`で開く（作業データは保存先から取得。読めるものが無ければ新しい空のキャンバスを作成して開く）。
     * @param {string} id 削除するキャンバスの識別子（開いているキャンバスであること）
     * @returns {Promise<boolean>} 削除したか
     */
    async #deleteOpenCanvas(id) {
        // (1)
        this.#prepareSwitch();
        // (2)
        const hadUnsaved = this.#hasUnsaved;
        if (this.#pendingSaveTimer !== null) {
            clearTimeout(this.#pendingSaveTimer);
            this.#pendingSaveTimer = null;
        }
        this.#pendingSaveCanvasId = null;
        this.#hasUnsaved = false;
        // (3)
        this.#isSwitching = true;
        // (4)
        try {
            await this.#storage.deleteRecord(id);
        } catch (error) {
            this.#isSwitching = false;
            console.warn('CanvasLibrary: キャンバスの削除に失敗しました。', id, error);
            this.#setIssue('writeFailed');
            this.#hasUnsaved = hadUnsaved;
            this.#scheduleSave();
            return false;
        }
        // (5)
        this.#summaries.delete(id);
        await this.#openFirstLoadable(this.#sortedSummaries(), async (summary) => {
            const record = await this.#storage.getRecord(summary.id);
            return record ? record.document : null;
        });
        return true;
    }

    /**
     * 切り替え処理の手順1〜2：進行中の入力操作を中断して選択モードへ切り替え、切り替え前のキャンバスの保留中の保存を確定する。
     * 保留（タイマー待ち・失敗後の再試行待ち・記録を書けずに開いたキャンバスの再書き込み）は直ちに書き、
     * 保留が無く書き込み中の保存があればその完了を待つ（`flushPendingSave()`）。
     * 保存に失敗した場合は`false`（呼び出し側は切り替えを中止する。`'writeFailed'`は`#saveOpenCanvasNow()`が設定済み）。
     * @returns {Promise<boolean>} 切り替えを続けてよいか
     */
    async #prepareLeave() {
        this.#prepareSwitch();
        return this.flushPendingSave();
    }

    /**
     * 切り替え処理の手順3の完了後・手順4の直前の確定手順と、手順4〜6（`#enterCanvas`）をまとめて行う（開く・新規作成・開く（ファイル）が通る）。
     * `prepareSwitch()`のうえ保留中の保存・書き込み中の保存が無くなるまで`flushPendingSave()`で確定し（保存の失敗、または確定手順内の
     * 予期しない例外で中止して`false`。`'writeFailed'`は`#saveOpenCanvasNow()`が設定済み）、確定手順を抜けたら`await`を挟まずに
     * `#enterCanvas`を呼ぶ（確定手順と手順4の間に`await`を挟むと、その間の編集が切り替え前のキャンバスへ書かれなくなるため、分けてはならない）。
     * `#enterCanvas`の例外は捕捉せず呼び出し側へ渡す。
     * @param {CanvasSummary} summary 開くキャンバスの要約（キャンバス一覧に登録済みであること）
     * @param {Array<Object>} shapes 開く図形インスタンス
     * @param {CanvasIssue} loadIssue 開いた後に残す読み込みの問題
     * @param {boolean} [isRecordWritten=true] 開くキャンバスの記録が保存先に書き込み済みか
     * @returns {Promise<boolean>} 開いたか（中止なら`false`）
     */
    async #settleAndEnter(summary, shapes, loadIssue, isRecordWritten = true) {
        try {
            for (;;) {
                this.#prepareSwitch();
                if (this.#pendingSaveCanvasId === null && this.#inFlightSave === null) {
                    break;
                }
                if (!(await this.flushPendingSave())) {
                    return false;
                }
            }
        } catch (error) {
            console.warn('CanvasLibrary: 切り替え前の保存の確定で予期しないエラーが発生しました。', error);
            return false;
        }
        this.#enterCanvas(summary, shapes, loadIssue, isRecordWritten);
        return true;
    }

    /**
     * 切り替え処理の手順4〜6（`await`を挟まない同期区間）。
     * 手順4：もう一度`prepareSwitch()`を呼び（例外は`console.warn`して続行する。削除の後は戻る先が無いため）、
     * `#isSwitching = true`として図形一式を入れ替える（切り替え前の保存の確定は
     * 呼び出し側の`#settleAndEnter`が済ませている。起動時の復元・削除後の切り替えは確定すべき保留が無い）。
     * 手順5：履歴のリセット → ビュー変換の初期化 → `#isSwitching = false`。
     * 手順6：開いているキャンバスを更新し、残っていた自動保存のタイマーを解除し、保留・未保存を更新する
     * （記録を書けずに開いた場合は保留（タイマー無し）・未保存とし、それ以外は保留なし・未保存でない）。
     * 最後に開いていたキャンバスの識別子を書き込み（`'unavailable'`では書かない。完了は待たない）、
     * `'loadFailed'`/`'partialLoad'`を解除したうえで`loadIssue`があれば設定し、記録を書けずに開いた場合は最後に`'writeFailed'`を設定し直し
     * （確定手順での保存成功による解除を打ち消す）、変更通知する。
     * @param {CanvasSummary} summary 開くキャンバスの要約（キャンバス一覧に登録済みであること）
     * @param {Array<Object>} shapes 開くキャンバスの図形インスタンス（`deserialize`の結果。新規作成なら空配列、開く（ファイル）ならファイルから読めた図形）
     * @param {CanvasIssue} [loadIssue=null] 開いた後に残す読み込みの問題（`'loadFailed'`/`'partialLoad'`。無ければ`null`）
     * @param {boolean} [isRecordWritten=true] 開くキャンバスの記録が保存先に書き込み済みか（偽なら保留・未保存として開く）
     * @returns {void}
     */
    #enterCanvas(summary, shapes, loadIssue = null, isRecordWritten = true) {
        // 手順4
        try {
            this.#prepareSwitch();
        } catch (error) {
            console.warn('CanvasLibrary: 切り替え時の入力操作の中断で例外が発生しました。', error);
        }
        this.#isSwitching = true;
        try {
            this.#model.replaceAllShapes(shapes);
            // 手順5
            this.#historyManager.clear();
            this.#resetView();
        } finally {
            this.#isSwitching = false;
        }

        // 手順6
        this.#openCanvasId = summary.id;
        if (this.#pendingSaveTimer !== null) {
            clearTimeout(this.#pendingSaveTimer);
            this.#pendingSaveTimer = null;
        }
        this.#pendingSaveCanvasId = isRecordWritten ? null : summary.id;
        this.#hasUnsaved = !isRecordWritten;
        if (this.#issue !== 'unavailable') {
            let writing;
            try {
                writing = this.#storage.setLastOpenedId(summary.id);
            } catch (error) {
                writing = Promise.reject(error);
            }
            writing.catch((error) => {
                console.warn('CanvasLibrary: 最後に開いていたキャンバスの記録に失敗しました。', error);
                this.#setIssue('writeFailed');
                this.#notifyChange();
            });
        }
        if (this.#issue === 'loadFailed' || this.#issue === 'partialLoad') {
            this.#setIssue(null);
        }
        if (loadIssue !== null) {
            this.#setIssue(loadIssue);
        }
        if (!isRecordWritten) {
            // 確定手順で切り替え前のキャンバスの保存が成功すると'writeFailed'が解除されるため、未保存で開いたここで設定し直す
            this.#setIssue('writeFailed');
        }
        this.#notifyChange();
    }

    /**
     * 候補を先頭から順に読み込み、全体として読めた最初の1枚を開く（切り替え処理の手順3〜6。起動時・削除後の共通）。
     * 作業データの取得失敗・`null`・`ok: false`は`console.warn`して次の候補へ進み、開いた後に`'loadFailed'`を残す。
     * 一部の図形がスキップされた場合は読めた図形で開き`'partialLoad'`を残す。読めた候補が無ければ新しい空のキャンバスを作成して開く。
     * @param {CanvasSummary[]} candidates 開く候補（試す順）
     * @param {(summary: CanvasSummary) => (Object|null|Promise<Object|null>)} loadDocument
     *     候補の作業データを取得する関数（起動時は読み出し済みの記録から、削除後は保存先から取得。記録が無ければ`null`）
     * @returns {Promise<void>}
     */
    async #openFirstLoadable(candidates, loadDocument) {
        let hadFailure = false;
        for (const summary of candidates) {
            let documentData;
            try {
                documentData = await loadDocument(summary);
            } catch (error) {
                console.warn('CanvasLibrary: キャンバスの記録を読み出せませんでした。', summary.id, error);
                hadFailure = true;
                continue;
            }
            if (documentData === null || documentData === undefined) {
                console.warn('CanvasLibrary: キャンバスの記録が見つかりません。', summary.id);
                hadFailure = true;
                continue;
            }
            const result = DocumentSerializer.deserialize(documentData);
            if (!result.ok) {
                console.warn('CanvasLibrary: キャンバスの作業データを読み込めませんでした。', summary.id, result.error);
                hadFailure = true;
                continue;
            }
            const current = this.#summaries.get(summary.id);
            if (!current) {
                continue;
            }
            let loadIssue = hadFailure ? 'loadFailed' : null;
            if (result.skipped.length > 0) {
                console.warn('CanvasLibrary: 一部の図形を読み込めませんでした。', summary.id, result.skipped);
                loadIssue = 'partialLoad';
            }
            this.#enterCanvas(current, result.shapes, loadIssue);
            return;
        }
        await this.#createAndEnter(hadFailure ? 'loadFailed' : null);
    }

    /**
     * 指定の名前・図形で新しいキャンバスを作成して開く（切り替え処理の手順3〜6）。記録を一覧へ加えて書き込み、`shapes`の図形一式で切り替える
     * （既定は空の図形一式＝新しい空のキャンバス）。
     * 書き込みに失敗した場合（`'writeFailed'`。このとき`loadIssue`より後に起きた問題として`'writeFailed'`を残す）：
     *   - 利用者の操作（`isUserOperation`）：`confirmOpenUnsaved`で確認し、「いいえ」（例外を含む）なら要約を一覧から除いて`false`
     *     （開いているキャンバス・図形一式・履歴はそのまま）。「はい」なら記録の無いまま開き、未保存として保持する。
     *   - 起動時・削除後（`isUserOperation`が偽）：開く先が他に無いため確認せず、記録の無いまま開いて未保存として保持する。
     * 利用者の操作では切り替え前の保存の確定（`#settleAndEnter`）に失敗すると中止し、要約を除き、書き込み済みの記録を削除して`false`。
     * @param {CanvasIssue} loadIssue 開いた後に残す読み込みの問題（無ければ`null`）
     * @param {*} [rawName=null] キャンバス名の候補（`#normalizeName`で正規化し、空なら「無題 n」。重複は許す）
     * @param {Array<*>} [shapes=[]] 開く図形の配列（不透明。`serialize`で記録の作業データにし、`replaceAllShapes`へ渡す）
     * @param {boolean} [isUserOperation=false] 利用者の操作（新規作成・開く（ファイル））か（起動時・削除後は偽）
     * @returns {Promise<boolean>} 開いたか
     */
    async #createAndEnter(loadIssue, rawName = null, shapes = [], isUserOperation = false) {
        const summary = {
            id: this.#issueCanvasId(),
            name: CanvasLibrary.#normalizeName(rawName) || this.#nextUntitledName(),
            updatedAt: Date.now()
        };
        this.#summaries.set(summary.id, summary);
        let isRecordWritten = true;
        let issueAfterEnter = loadIssue;
        try {
            await this.#storage.putRecord({
                id: summary.id,
                name: summary.name,
                updatedAt: summary.updatedAt,
                document: DocumentSerializer.serialize(shapes)
            });
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
            this.#summaries.delete(summary.id);
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
    }

    /**
     * 新しいキャンバスの記録を書けなかったとき、保存しないまま開くかを注入関数`confirmOpenUnsaved`で確認する。
     * 例外は`console.warn`して`false`（「いいえ」と同じ）とする。
     * @returns {boolean} 保存しないまま開くなら`true`
     */
    #askOpenUnsaved() {
        try {
            return this.#confirmOpenUnsaved() === true;
        } catch (error) {
            console.warn('CanvasLibrary: 保存しないまま開くかの確認で予期しないエラーが発生しました。', error);
            return false;
        }
    }

    /**
     * キャンバス名の正規化（名前の変更とファイルからの作成で共通の唯一の規則）。
     * 前後の空白を除き、`CANVAS_NAME_MAX_LENGTH`を超える場合は先頭から切り詰め（`Array.from`でサロゲートペアを分断しない）、
     * 切り詰めで末尾に残った空白も除く。
     * @param {*} rawName 名前の候補
     * @returns {string} 正規化した名前（文字列でない・空白のみなら空文字列）
     */
    static #normalizeName(rawName) {
        if (typeof rawName !== 'string') {
            return '';
        }
        return Array.from(rawName.trim()).slice(0, CANVAS_NAME_MAX_LENGTH).join('').trimEnd();
    }

    /**
     * 保存・読み込みの問題を設定する（最後に起きたもの1つを保持）。`'unavailable'`は解除・上書きしない。
     * 変更通知は呼び出し側が行う。
     * @param {CanvasIssue} issue 設定する問題（解除は`null`）
     * @returns {void}
     */
    #setIssue(issue) {
        if (this.#issue === 'unavailable') {
            return;
        }
        this.#issue = issue;
    }

    /**
     * キャンバス一覧を最終更新日時の新しい順（同値はid順）に並べた配列を返す。
     * @returns {CanvasSummary[]}
     */
    #sortedSummaries() {
        return Array.from(this.#summaries.values()).sort((a, b) => {
            if (a.updatedAt !== b.updatedAt) {
                return b.updatedAt - a.updatedAt;
            }
            return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
        });
    }

    /**
     * 登録されたすべてのリスナーに変更を通知する。リスナーごとに例外を捕捉して`console.warn`し、残りのリスナーへの通知を続ける。
     * @returns {void}
     */
    #notifyChange() {
        for (const listener of this.#listeners) {
            try {
                listener();
            } catch (error) {
                console.warn('CanvasLibrary: 変更通知のリスナーで例外が発生しました。', error);
            }
        }
    }

    /**
     * キャンバス記録の形式を検証する（`id`・`name`が文字列、`updatedAt`が有限の数値）。作業データの中身は検証しない。
     * @param {*} record 検証する値
     * @returns {boolean} 一覧に含めてよい記録か
     */
    static #isValidRecord(record) {
        return record !== null
            && typeof record === 'object'
            && typeof record.id === 'string'
            && typeof record.name === 'string'
            && Number.isFinite(record.updatedAt);
    }
}
