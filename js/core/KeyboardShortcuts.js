/**
 * 責務：キーボードショートカットのキー→操作の対応表と、keydownの受理判定（IME変換中・テキスト入力中・修飾キー・
 * ドラッグ中・キーリピート・preventDefaultの要否）のみを担う。操作の実体はmain.jsから注入されたコールバックへ委譲する。
 */

import { OperationMode, SHAPE_TYPES, isTextInputElement } from './InputTracker.js';

/**
 * 対応表エントリのShift規則（3値）。本ファイル内でのみ用いる（exportしない）。
 * ・FORBIDDEN：shiftKeyが偽であること（通常のショートカット。Shift+V等は将来のShift併用操作のために予約）
 * ・ANY：shiftKeyを問わない（拡大・縮小。JIS配列のCtrl+Shift+;、US配列のCtrl+Shift+=に対応するため）
 * ・REQUIRED：shiftKeyが真であること（Ctrl+Shift+Zのやり直し）
 * @readonly
 * @enum {string}
 */
const ShiftRule = Object.freeze({
    FORBIDDEN: 'forbidden',
    ANY: 'any',
    REQUIRED: 'required',
});

/**
 * ショートカット対応表の1エントリ（データのみ。操作の実体は持たない）。
 * @typedef {Object} ShortcutBinding
 * @property {string[]} codes 一致とみなすevent.code（物理キー位置）の一覧
 * @property {boolean} ctrl CtrlまたはMeta（⌘）の押下を要するか。true：ctrlKey || metaKeyが真であること、
 *     false：ctrlKey・metaKeyがともに偽であること
 * @property {string} shift Shift規則（ShiftRuleの値）。FORBIDDEN：shiftKeyが偽であること、
 *     ANY：shiftKeyを問わない、REQUIRED：shiftKeyが真であること
 * @property {boolean} repeatable キーリピート（event.repeat）でも実行するか
 * @property {string} action 実行する注入コールバック名（ShortcutActionsのプロパティ名）
 * @property {*} [arg] コールバックへ渡す引数（省略時はundefined）
 */

/**
 * main.jsから注入する操作コールバック群。isDragging以外はショートカットの操作の実体であり、
 * 戻り値true＝受理（preventDefault()する）、false＝受理せず（preventDefault()しない）を表す。
 * @typedef {Object} ShortcutActions
 * @property {() => boolean} isDragging ドラッグ中（InputTrackerのDragTrackerセッション中。閾値以前を含む）か。受理判定専用
 * @property {(mode: string) => boolean} setMode 操作モード（OperationModeの値）へ切り替える
 * @property {(type: string) => boolean} setShapeType 図形種別（SHAPE_TYPESの値）へ切り替える（図形作成モード以外では図形作成モードへも切り替える）
 * @property {(direction: 1|-1) => boolean} zoomStep 表示中キャンバスの中心基準で1刻み拡大（1）・縮小（-1）する
 * @property {() => boolean} resetView ビュー変換をリセットする
 * @property {() => boolean} cancel 作成途中の図形の破棄、または選択解除を行う
 * @property {() => boolean} selectAll 全図形を選択する（選択モード以外では選択モードへ切り替えた後）
 * @property {() => boolean} deleteSelection 選択集合の全図形を削除する
 * @property {() => boolean} undo 直前の編集操作を取り消す。作成途中の図形があれば、その破棄のみを行い履歴は変化させない。
 *     取り消せる履歴がなくても、ドラッグ中でなければ常にtrue（ブラウザ標準のCtrl+Zを起こさないため）
 * @property {() => boolean} redo 取り消した編集操作をやり直す。作成途中の図形があれば破棄したうえでやり直す。
 *     やり直せる履歴がなくても、ドラッグ中でなければ常にtrue（ブラウザ標準のCtrl+Y等を起こさないため）
 * @property {() => boolean} copy 選択集合の図形をクリップボードへ記録する。記録した場合のみtrue
 *     （選択集合が空ならfalse＝ページ上の文字の標準のコピーを妨げない）
 * @property {() => boolean} cut 選択集合の図形をクリップボードへ記録して削除する。切り取った場合のみtrue
 *     （選択集合が空・削除の非受理ならfalse）
 * @property {() => boolean} paste クリップボードの図形を貼り付ける。クリップボードが空なら何もしない（操作モードも切り替えない）。
 *     選択モード以外では選択モードへ切り替えてから貼り付ける。クリップボードが空でも常にtrue（ブラウザ標準の貼り付けを起こさないため。
 *     ドラッグ中は受理判定（#handleKeyDownの手順4）によりそもそも呼ばれない）
 * @property {() => boolean} duplicate 選択集合の図形をその場で複製する。ブラウザ標準のブックマーク追加を抑止するため常にtrue
 */

/**
 * ショートカットの対応表（キー→操作の対応はここ1箇所のみで定義する）。
 * ・図形種別のエントリはSHAPE_TYPESの並びから生成する（Digit{n}/Numpad{n} → SHAPE_TYPES[n-1]）。
 *   SHAPE_TYPESの並び＝図形パレットのボタンの並び順であることを前提とする。
 * ・Spaceは含めない（スペースパンはInputTrackerの担当であり、同一キーを二重に解釈しないため）。
 * ・同一のcode・修飾キーの組み合わせに一致するエントリが2件以上存在しないこと（#findBindingは最初の一致を返す）。
 * ・新しいショートカットはエントリの追加（＋必要なら注入コールバックの追加）で対応する。
 * ・修飾キー規則：Shiftはshiftプロパティの3値（ShiftRule）で指定する。通常はFORBIDDEN、拡大・縮小のみANY、
 *   やり直しのCtrl+Shift+ZのみREQUIRED。KeyZはShiftの有無で取り消し（FORBIDDEN）とやり直し（REQUIRED）に排他的に分かれる。
 *   KeyVはctrlの値でV単体（ctrl: false。選択モードへの切り替え）とCtrl+V（ctrl: true。貼り付け）に排他的に区別される。
 * ・index.htmlの各ボタンのtitle属性（例：「選択 (V)」）はこの表と手動で一致させている。
 * @type {ReadonlyArray<Readonly<ShortcutBinding>>}
 */
const SHORTCUT_BINDINGS = Object.freeze([
    { codes: ['KeyV'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'setMode', arg: OperationMode.SELECT },
    { codes: ['KeyP'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'setMode', arg: OperationMode.CREATE },
    { codes: ['KeyH'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'setMode', arg: OperationMode.PAN },
    ...SHAPE_TYPES.map((type, i) => ({
        codes: [`Digit${i + 1}`, `Numpad${i + 1}`],
        ctrl: false,
        shift: ShiftRule.FORBIDDEN,
        repeatable: false,
        action: 'setShapeType',
        arg: type,
    })),
    { codes: ['Digit0', 'Numpad0'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'resetView' },
    { codes: ['Equal', 'Semicolon', 'NumpadAdd'], ctrl: true, shift: ShiftRule.ANY, repeatable: true, action: 'zoomStep', arg: 1 },
    { codes: ['Minus', 'NumpadSubtract'], ctrl: true, shift: ShiftRule.ANY, repeatable: true, action: 'zoomStep', arg: -1 },
    { codes: ['Escape'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'cancel' },
    { codes: ['KeyA'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'selectAll' },
    { codes: ['Delete', 'Backspace'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'deleteSelection' },
    // 取り消し・やり直し（押しっぱなしで連続実行できるようrepeatable: true）
    { codes: ['KeyZ'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'undo' },
    { codes: ['KeyZ'], ctrl: true, shift: ShiftRule.REQUIRED, repeatable: true, action: 'redo' },
    { codes: ['KeyY'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'redo' },
    // コピー・切り取り（キーリピートでは実行しない）・貼り付け・複製（押しっぱなしで連続実行できるようrepeatable: true）
    { codes: ['KeyC'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'copy' },
    { codes: ['KeyX'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'cut' },
    { codes: ['KeyV'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'paste' },
    { codes: ['KeyD'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'duplicate' },
].map((binding) => Object.freeze(binding)));

/**
 * documentのkeydownを購読し、対応表（SHORTCUT_BINDINGS）に一致したキーを注入コールバックへ振り分ける。
 * VectorModel・ViewTransform・InputTrackerインスタンス・DOMのボタン要素は参照しない
 * （documentのkeydown購読とdocument.activeElementの読み取りのみ）。keyupは購読しない。
 * 図形種別・操作モードごとの分岐は持たず、action名によるコールバック呼び出しのみを行う。
 */
export class KeyboardShortcuts {
    /**
     * main.jsから注入された操作コールバック群。
     * @type {ShortcutActions}
     */
    #actions;

    /**
     * @param {ShortcutActions} actions - 操作コールバック群。isDraggingと対応表の全action名が関数であること
     * @throws {Error} 必要なコールバックが欠けている場合（起動時に配線漏れを検出するため）
     */
    constructor(actions) {
        const requiredNames = new Set(['isDragging', ...SHORTCUT_BINDINGS.map((binding) => binding.action)]);
        const missingNames = [...requiredNames].filter((name) => typeof actions?.[name] !== 'function');
        if (missingNames.length > 0) {
            throw new Error(`KeyboardShortcuts: 操作コールバックが注入されていません: ${missingNames.join(', ')}`);
        }
        this.#actions = actions;

        document.addEventListener('keydown', (event) => this.#handleKeyDown(event));
    }

    /**
     * keydownイベントのハンドラ。以下の順で判定する（順序は固定）。
     * 1. IME変換中（event.isComposing）なら何もしない。
     * 2. テキスト入力中（isTextInputElement(document.activeElement)）なら何もしない。
     * 3. 対応表から一致エントリを探す（#findBinding）。一致なしなら何もしない。
     * 4. ドラッグ中（isDragging()が真）なら実行しない。
     * 5. キーリピート（event.repeat）かつrepeatable: falseのエントリなら実行しない。
     * 6. 注入コールバックactions[binding.action](binding.arg)を呼び、trueが返った場合のみpreventDefault()する。
     * preventDefault()の原則：受理した（コールバックがtrueを返した）キーのみpreventDefault()し、受理しなかったキーは
     * preventDefault()しない（IME変換中・テキスト入力中・対応表に一致なし・コールバックがfalseを含む）。
     * 唯一の例外：ctrl: trueのエントリが、ドラッグ中（手順4）またはキーリピート（手順5）で実行されなかった場合は、
     * 操作は実行せずpreventDefault()のみ行う（Ctrl+=/-/0/A/Z/Y/C/X/V/Dでブラウザのズーム・ページ全選択・標準の取り消し/やり直し・
     * 標準のコピー・切り取り・貼り付け・ブックマーク追加が起きないようにするため）。
     * ctrl: falseのエントリが手順4・5で実行されなかった場合はpreventDefault()もしない。
     * @param {KeyboardEvent} event
     */
    #handleKeyDown(event) {
        if (event.isComposing) {
            return;
        }
        if (isTextInputElement(document.activeElement)) {
            return;
        }

        const binding = this.#findBinding(event);
        if (binding === null) {
            return;
        }

        // 手順4・5：ドラッグ中、またはリピート不可エントリのキーリピートは実行しない（例外判定はここ1箇所のみ）
        if (this.#actions.isDragging() || (event.repeat && !binding.repeatable)) {
            if (binding.ctrl) {
                event.preventDefault();
            }
            return;
        }

        if (this.#actions[binding.action](binding.arg) === true) {
            event.preventDefault();
        }
    }

    /**
     * 対応表を走査し、イベントに一致する最初のエントリを返す。キー識別・修飾キー判定はこのメソッドでのみ行う。
     * ・キーはevent.code（物理キー位置）で識別する。event.keyは大文字小文字・Shift併用時の記号化（Shift+1→!）・
     *   キーボード配列・IMEの影響を受けるため用いない（例：JIS配列の;/+キーはkeyが揺れるがcodeはSemicolonで一定）。
     * ・Alt押下時は常に不一致（AltGr＝Ctrl+Altによる文字入力を奪わないため）。
     * ・Meta（⌘）はCtrlと同一視する（macOS対応）。ctrl: trueはctrlKey || metaKeyが真、ctrl: falseは両方が偽であること。
     * ・Shift：エントリのshift（ShiftRule）の3値で判定する。FORBIDDENはshiftKeyが偽であること、
     *   ANY（拡大・縮小のみ）はshiftKeyを問わない（JIS配列のCtrl+Shift+;、US配列のCtrl+Shift+=に対応するため）、
     *   REQUIRED（やり直しのCtrl+Shift+Zのみ）はshiftKeyが真であること。Shift+V等は引き続き不一致であり、
     *   将来のShift併用操作のために予約する。
     * @param {KeyboardEvent} event
     * @returns {Readonly<ShortcutBinding> | null} 一致したエントリ（なければnull）
     */
    #findBinding(event) {
        if (event.altKey) {
            return null;
        }
        const ctrlPressed = event.ctrlKey || event.metaKey;
        return SHORTCUT_BINDINGS.find((binding) =>
            binding.codes.includes(event.code)
            && binding.ctrl === ctrlPressed
            && KeyboardShortcuts.#matchesShiftRule(binding.shift, event.shiftKey)
        ) ?? null;
    }

    /**
     * Shift規則（ShiftRule）とshiftKeyの押下状態が一致するかを返す。
     * @param {string} rule - エントリのShift規則（ShiftRuleの値）
     * @param {boolean} shiftPressed - event.shiftKey
     * @returns {boolean} ANY：常にtrue、REQUIRED：shiftPressed、FORBIDDEN：!shiftPressed
     *     （ANY・REQUIRED以外の値（shiftの書き忘れ・綴りの誤りを含む）はすべてFORBIDDENとして扱う）
     */
    static #matchesShiftRule(rule, shiftPressed) {
        if (rule === ShiftRule.ANY) {
            return true;
        }
        if (rule === ShiftRule.REQUIRED) {
            return shiftPressed;
        }
        return !shiftPressed;
    }
}
