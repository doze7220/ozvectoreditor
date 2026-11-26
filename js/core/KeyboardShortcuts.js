/**
 * 責務：キーボードショートカットのキー→操作の対応表と、keydownの受理判定（IME変換中・テキスト入力中・修飾キー・
 * Spaceで操作する入力部品（typeがcheckbox・colorのinput。色の欄）の操作中・ドラッグ中（拡大縮小・回転・一覧の行のドラッグ中のcancelの例外を含む）・
 * キーリピート・preventDefaultの要否）のみを担う。操作の実体はmain.jsから注入されたコールバックへ委譲する。
 */

import { OperationMode } from './InputModes.js';
import { SHAPE_TYPES } from './ShapeFactory.js';
import { isTextInputElement, isSpaceOperatedInputElement } from './FocusKeyYieldRules.js';

/**
 * 対応表エントリのShift規則（3値）。本ファイル内でのみ用いる（exportしない）。
 * ・FORBIDDEN：shiftKeyが偽であること（通常のショートカット）
 * ・ANY：shiftKeyを問わない（拡大・縮小。JIS配列のCtrl+Shift+;、US配列のCtrl+Shift+=に対応するため）
 * ・REQUIRED：shiftKeyが真であること（Ctrl+Shift+Zのやり直し、Ctrl+Shift+Vの同じ位置に貼り付け、Ctrl+Shift+Gのフォルダの解除、Shift+矢印キーの10px微調整、Shift+H・Shift+Vの反転）
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
 * main.jsから注入する操作コールバック群。isDragging・isCancelableDrag以外はショートカットの操作の実体であり、
 * 戻り値true＝受理（preventDefault()する）、false＝受理せず（preventDefault()しない）を表す。
 * @typedef {Object} ShortcutActions
 * @property {() => boolean} isDragging ドラッグ中（InputTrackerのDragTrackerセッション中、または一覧の行のドラッグ中。閾値以前を含む）か。受理判定専用
 * @property {() => boolean} isCancelableDrag Esc（cancel）で中断できるドラッグ＝拡大縮小・回転のドラッグ、または一覧の行のドラッグの最中か（閾値以前を含む）。受理判定専用。
 *     真の間は、cancelだけがShift・Alt・Ctrl（Meta）の押下を問わずisDraggingによる不実行を受けず呼ばれる（findCancelableDragBinding）
 * @property {(mode: string) => boolean} setMode 操作モード（OperationModeの値）へ切り替える
 *     （直線・曲線のツールで線を引いている途中なら、描いた分を残して終えてから切り替える）
 * @property {(type: string) => boolean} setShapeType 図形種別（SHAPE_TYPESの値）へ切り替える（図形作成モード以外では図形作成モードへも切り替える。
 *     直線・曲線のツールで線を引いている途中なら、描いた分を残して終えてから切り替える）
 * @property {(direction: 1|-1) => boolean} zoomStep 表示中キャンバスの中心基準で1刻み拡大（1）・縮小（-1）する
 * @property {() => boolean} resetView ビュー変換をリセットする
 * @property {() => boolean} cancel 作成途中の図形の破棄、または選択解除を行う
 *     （直線・曲線のツールで線を引いている途中は、描いた分を開いたまま残して終える）。
 *     拡大縮小・回転のドラッグ中（isCancelableDragが真）は、修飾キーを問わず呼ばれ、引き始めの形に戻して中断する。一覧の行のドラッグ中も同じく呼ばれ、並びを変えずに取りやめる
 * @property {() => boolean} selectAll 変えられる図形を全て選択する（選択モード以外では選択モードへ切り替えた後）
 * @property {() => boolean} deleteSelection 選択中の変えられる図形と選んでいるフォルダを削除する（頂点の選択では選んだ点を消す。振り分けは注入された実体の側）
 *     （直線・曲線のツールで線を引いている途中は、代わりに最後の点を消す。始点だけならやめる）
 * @property {() => boolean} join 選択中の線を結合する（開いたパス1本を閉じる・2本を1本の開いたパスにする）。
 *     結合した場合のみtrue（結合できない選択ではfalse）
 * @property {() => boolean} bringToFront 選択中の図形を最前面へ移す。並びを変えた場合のみtrue
 *     （何も選んでいない・すでに最前面・ドラッグ中ではfalse）
 * @property {() => boolean} bringForward 選択中の図形を1つ手前へ移す。並びを変えた場合のみtrue
 *     （何も選んでいない・すでに最前面・ドラッグ中ではfalse）
 * @property {() => boolean} sendBackward 選択中の図形を1つ後ろへ移す。並びを変えた場合のみtrue
 *     （何も選んでいない・すでに最背面・ドラッグ中ではfalse）
 * @property {() => boolean} sendToBack 選択中の図形を最背面へ移す。並びを変えた場合のみtrue
 *     （何も選んでいない・すでに最背面・ドラッグ中ではfalse）
 * @property {() => boolean} undo 直前の編集操作を取り消す。直線・曲線のツールで線を引いている途中なら、最後の点を消すだけで履歴は変化させない。
 *     それ以外の作成途中の図形があれば、その破棄のみを行い履歴は変化させない。
 *     取り消せる履歴がなくても、ドラッグ中でなければ常にtrue（ブラウザ標準のCtrl+Zを起こさないため）
 * @property {() => boolean} redo 取り消した編集操作をやり直す。作成途中の図形があれば破棄したうえでやり直す。
 *     やり直せる履歴がなくても、ドラッグ中でなければ常にtrue（ブラウザ標準のCtrl+Y等を起こさないため）
 * @property {() => boolean} copy 選択集合の図形をクリップボードへ記録する。記録した場合のみtrue
 *     （選択集合が空ならfalse＝ページ上の文字の標準のコピーを妨げない）
 * @property {() => boolean} cut 選択集合の図形をクリップボードへ記録して削除する。切り取った場合のみtrue
 *     （選択集合が空・削除の非受理ならfalse）
 * @property {() => boolean} paste クリップボードの図形を貼り付ける。クリップボードが空なら何もしない（操作モードも切り替えない）。
 *     選択モード以外では選択モードへ切り替えてから貼り付ける。クリップボードが空でも常にtrue（ブラウザ標準の貼り付けを起こさないため。
 *     ドラッグ中は受理判定（#handleKeyDownの手順5）によりそもそも呼ばれない）
 * @property {() => boolean} pasteInPlace クリップボードの図形を元と同じ位置に貼り付ける（Ctrl+Shift+V。貼り付けのずらしの段数は読まず変えない）。
 *     クリップボードが空なら何もしない（操作モードも切り替えない）。選択モード以外では選択モードへ切り替えてから貼り付ける。
 *     クリップボードが空でも常にtrue（ブラウザ標準の書式なし貼り付けを起こさないため。ドラッグ中・キーリピートは受理判定により呼ばれない）
 * @property {() => boolean} invertSelection 選択を反転する（Ctrl+I。変えられる図形のうち選択されていないものを選択する）。
 *     選択モード以外では選択モードへ切り替えた後（選択が空になるため結果は全選択）。編集操作として記録しない。
 *     図形0個でも常にtrue（ブラウザ標準のCtrl+I（Firefoxのページの情報等）を起こさないため）
 * @property {() => boolean} duplicate 選択集合の図形をその場で複製する。ブラウザ標準のブックマーク追加を抑止するため常にtrue
 * @property {() => boolean} resetColors 線を黒・塗りを白にする（D。選択中の図形があればその変えられる図形へ記録し、直前に使った値も更新する。
 *     選択がなければ直前に使った値だけ更新して記録しない。太さは変えない）。操作モードは切り替えず、どの状態でも働く。
 *     ブラウザ標準の動作を起こさないよう常にtrue（ドラッグ中・キーリピートは受理判定により呼ばれない）
 * @property {() => boolean} toggleOutline アウトライン表示を切り替える。表示の状態を切り替えるだけで常にtrue
 * @property {() => boolean} toggleBackground 背景の白/黒を切り替える。表示の状態を切り替えるだけで常にtrue
 * @property {() => boolean} toggleGrid グリッドの表示を切り替える。表示の状態を切り替えるだけで常にtrue
 * @property {() => boolean} toggleFloatWindows フロートウィンドウをまとめて隠す/出す。表示の状態を切り替えるだけで常にtrue
 * @property {() => boolean} startEyedropper スポイトの待ち受けを始める（I。ツールパレットのスポイトのボタンと同一経路）。
 *     選択モード以外では選択モードへ切り替えた後に始める。すでに待ち受け中でも何も変わらず、常にtrue
 *     （ドラッグ中・キーリピートは受理判定により呼ばれない）
 * @property {(delta: {dx: number, dy: number}) => boolean} nudgeSelection 選んでいる図形または頂点を、受け取った移動量（ワールド座標のpx）だけ動かす。
 *     動かした場合のみtrue（動かす対象がないときはfalse＝ブラウザ側の既定の動きを妨げない）
 * @property {() => boolean} flipHorizontal 選んでいる図形を、基準点を通る縦の線を軸に左右に反転する（Shift+H。オプションバーの横の反転のボタンと同一経路）。
 *     反転した場合のみtrue（選択（V）で図形を選んでいない・外枠が求まらない・ドラッグ中はfalse＝preventDefault()しない）
 * @property {() => boolean} flipVertical 選んでいる図形を、基準点を通る横の線を軸に上下に反転する（Shift+V。オプションバーの縦の反転のボタンと同一経路）。
 *     反転した場合のみtrue（選択（V）で図形を選んでいない・外枠が求まらない・ドラッグ中はfalse＝preventDefault()しない）
 * @property {() => boolean} group 選んでいるまとまり（図形・フォルダ）を新しいフォルダにまとめる（Ctrl+G。⌘+G）。
 *     ドラッグ中は実行せず、実行した後も（まとめられなくても）ブラウザの標準の動作を起こさないよう常にtrue
 * @property {() => boolean} ungroup 選んでいるフォルダを解除して中身を1段外へ出す（Ctrl+Shift+G。⌘+Shift+G）。
 *     ドラッグ中は実行せず、実行した後も（解除できなくても）ブラウザの標準の動作を起こさないよう常にtrue
 */

/**
 * 矢印キーによる微調整の1回あたりの移動量（ワールド座標のpx）。Shiftなしが1px、Shiftありが10px。
 * スナップの設定には関係しない。矢印キーのエントリの組み立て（NUDGE_DIRECTIONSとの組み合わせ）でのみ用いる（exportしない）。
 * @type {Readonly<{normal: number, shift: number}>}
 */
const NUDGE_STEPS = Object.freeze({ normal: 1, shift: 10 });

/**
 * 矢印キーの4方向（event.codeと移動の符号）。上が縦方向のマイナス、下が縦方向のプラス、左が横方向のマイナス、
 * 右が横方向のプラスで、画面の見た目と一致する。矢印キーのエントリの組み立てでのみ用いる（exportしない）。
 * @type {ReadonlyArray<Readonly<{code: string, x: number, y: number}>>}
 */
const NUDGE_DIRECTIONS = Object.freeze([
    Object.freeze({ code: 'ArrowLeft', x: -1, y: 0 }),
    Object.freeze({ code: 'ArrowRight', x: 1, y: 0 }),
    Object.freeze({ code: 'ArrowUp', x: 0, y: -1 }),
    Object.freeze({ code: 'ArrowDown', x: 0, y: 1 }),
]);

/**
 * ショートカットの対応表（キー→操作の対応はここ1箇所のみで定義する）。
 * ・図形種別のエントリはSHAPE_TYPESの並びから生成する（Digit{n}/Numpad{n} → SHAPE_TYPES[n-1]）。
 *   SHAPE_TYPESの並び＝ツールパレットの図形のボタンの並び順であることを前提とする。
 * ・Spaceは含めない（スペースパンはInputTrackerの担当であり、同一キーを二重に解釈しないため）。
 * ・同一のcode・修飾キーの組み合わせに一致するエントリが2件以上存在しないこと（#findBindingは最初の一致を返す）。
 * ・新しいショートカットはエントリの追加（＋必要なら注入コールバックの追加）で対応する。
 * ・修飾キー規則：Shiftはshiftプロパティの3値（ShiftRule）で指定する。通常はFORBIDDEN、拡大・縮小のみANY、
 *   やり直しのCtrl+Shift+Zと同じ位置に貼り付けのCtrl+Shift+V、フォルダの解除のCtrl+Shift+G、10px微調整のShift+矢印キー（4つ）、反転のShift+H・Shift+VのみREQUIRED。
 *   矢印キー（ArrowLeft・ArrowRight・ArrowUp・ArrowDown）はShiftの有無で1px（FORBIDDEN）と10px（REQUIRED）に排他的に分かれる
 *   （ctrl: falseのみ。Ctrl付き・Alt付きの矢印キーは一致せず、ブラウザ・OSの操作のまま）。KeyZはShiftの有無で取り消し（FORBIDDEN）とやり直し（REQUIRED）に排他的に分かれる。
 *   KeyVはctrlの値とShift規則でV単体（ctrl: false・FORBIDDEN。選択モードへの切り替え）・Ctrl+V（ctrl: true・FORBIDDEN。貼り付け）・
 *   Ctrl+Shift+V（ctrl: true・REQUIRED。同じ位置に貼り付け）・Shift+V（ctrl: false・REQUIRED。縦に反転）の4通りに排他的に区別される。
 *   KeyHはShiftの有無でH単体（FORBIDDEN。キャンバス移動への切り替え）とShift+H（REQUIRED。横に反転）の2通りに排他的に分かれる（ctrl: falseのみ。Ctrl+Hは一致しない）。
 *   KeyIはctrlの値でI単体（ctrl: false。スポイトの待ち受けを始める）とCtrl+I（ctrl: true。選択の反転）に排他的に分かれる（いずれもFORBIDDEN）。
 *   KeyDはctrlの値でD単体（ctrl: false。線を黒・塗りを白にする）とCtrl+D（ctrl: true。複製）に排他的に分かれる（いずれもFORBIDDEN）。
 *   KeyZ・KeyX・KeyCも同様にctrlの値で区別される（Z・X・C単体＝表示の切り替え：ctrl: false、Ctrl+Z（取り消し）・Ctrl+X（切り取り）・Ctrl+C（コピー）：ctrl: true）。
 *   KeyAはctrlの値でA単体（ctrl: false。頂点の選択モードへの切り替え）とCtrl+A（ctrl: true。全選択）に排他的に分かれる（いずれもFORBIDDEN）。
 *   KeyZのCtrl付きはShiftで取り消し・やり直しに分かれるが、Ctrlなしは単体（FORBIDDEN）のみでShift+Zは一致しない。
 *   KeyGはCtrl付きのみで、Shiftの有無でCtrl+G（FORBIDDEN。フォルダにまとめる）とCtrl+Shift+G（REQUIRED。フォルダの解除）に排他的に分かれる（G単体・Shift+Gは一致しない）。
 * ・Tab（フロートウィンドウをまとめて隠す/出す）は、テキスト入力扱いの欄（太さの欄・テキスト欄＝受理判定の手順2）と
 *   色の欄（手順4）にフォーカスがある間は何もせず、ブラウザのフォーカスの移動になる。ボタン・フォーカスなしでは実行され、
 *   受理するためpreventDefault()されてフォーカスは移らない。Shift+Tabは一致せず（FORBIDDEN）ブラウザのフォーカスの移動、
 *   Ctrl+Tabはctrlが一致せず、Alt+Tabは#findBindingがnullを返す。
 * ・index.htmlの各ボタンのtitle属性（例：「選択 (V)」「横に反転 (Shift+H)」）はこの表と手動で一致させている。
 * @type {ReadonlyArray<Readonly<ShortcutBinding>>}
 */
const SHORTCUT_BINDINGS = Object.freeze([
    { codes: ['KeyV'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'setMode', arg: OperationMode.SELECT },
    { codes: ['KeyP'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'setMode', arg: OperationMode.CREATE },
    { codes: ['KeyH'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'setMode', arg: OperationMode.PAN },
    { codes: ['KeyA'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'setMode', arg: OperationMode.VERTEX },
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
    // 選択中の線の結合。キーリピートでは実行しない
    { codes: ['KeyJ'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'join' },
    // 重なり順の変更。前へ・後ろへは押しっぱなしで連続実行できるようrepeatable: true、最前面へ・最背面へは繰り返さない
    { codes: ['Home'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'bringToFront' },
    { codes: ['PageUp'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'bringForward' },
    { codes: ['PageDown'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'sendBackward' },
    { codes: ['End'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'sendToBack' },
    // 取り消し・やり直し（押しっぱなしで連続実行できるようrepeatable: true）
    { codes: ['KeyZ'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'undo' },
    { codes: ['KeyZ'], ctrl: true, shift: ShiftRule.REQUIRED, repeatable: true, action: 'redo' },
    { codes: ['KeyY'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'redo' },
    // コピー・切り取り（キーリピートでは実行しない）・貼り付け・複製（押しっぱなしで連続実行できるようrepeatable: true）
    { codes: ['KeyC'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'copy' },
    { codes: ['KeyX'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'cut' },
    { codes: ['KeyV'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'paste' },
    { codes: ['KeyD'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'duplicate' },
    // 同じ位置に貼り付け（Ctrl+Shift+V。Ctrl+V（FORBIDDEN）と排他的）・選択の反転（Ctrl+I）。キーリピートでは実行しない
    { codes: ['KeyV'], ctrl: true, shift: ShiftRule.REQUIRED, repeatable: false, action: 'pasteInPlace' },
    { codes: ['KeyI'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'invertSelection' },
    // フォルダにまとめる（Ctrl+G）・フォルダの解除（Ctrl+Shift+G。Shift規則で排他的）。キーリピートでは実行しない
    { codes: ['KeyG'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'group' },
    { codes: ['KeyG'], ctrl: true, shift: ShiftRule.REQUIRED, repeatable: false, action: 'ungroup' },
    // 表示の切り替え（アウトライン・背景の白/黒・グリッド。キーリピートでは実行しない）
    { codes: ['KeyZ'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'toggleOutline' },
    { codes: ['KeyX'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'toggleBackground' },
    { codes: ['KeyC'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'toggleGrid' },
    // フロートウィンドウをまとめて隠す/出す（キーリピートでは実行しない）
    { codes: ['Tab'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'toggleFloatWindows' },
    // 線を黒・塗りを白にする（D。Ctrl+D（複製）とctrlの値で排他的）。キーリピートでは実行しない
    { codes: ['KeyD'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'resetColors' },
    // スポイトの待ち受けを始める（I。Ctrl+I（選択の反転）とctrlの値で排他的）。キーリピートでは実行しない
    { codes: ['KeyI'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'startEyedropper' },
    // 矢印キーによる微調整（選んでいる図形・頂点を動かす）。Shiftなしが1px、Shift併用が10px（NUDGE_STEPS）。
    // 左・右が横方向のマイナス・プラス、上・下が縦方向のマイナス・プラス（NUDGE_DIRECTIONS）。押しっぱなしで連続して動くようrepeatable: true。
    // コールバックは方向によらずnudgeSelection1つで、移動量をargで渡す。Ctrl（⌘）付きのエントリは作らず（ブラウザ・OSの操作を通す）、Alt付きは#findBindingが常に不一致
    ...NUDGE_DIRECTIONS.flatMap((direction) => [
        { step: NUDGE_STEPS.normal, shift: ShiftRule.FORBIDDEN },
        { step: NUDGE_STEPS.shift, shift: ShiftRule.REQUIRED },
    ].map(({ step, shift }) => ({
        codes: [direction.code],
        ctrl: false,
        shift,
        repeatable: true,
        action: 'nudgeSelection',
        arg: Object.freeze({ dx: direction.x * step, dy: direction.y * step }),
    }))),
    // 反転（Shift+H＝横に反転、Shift+V＝縦に反転）。H（キャンバス移動）・V（選択）とはShift規則で、Ctrl+V・Ctrl+Shift+Vとはctrlの値で排他的。
    // キーリピートでは実行しない。actionを2つに分けるのはcore/がedit/の反転の軸（FLIP_AXIS）を知らないため（main.jsがperformFlipへつなぐ）
    { codes: ['KeyH'], ctrl: false, shift: ShiftRule.REQUIRED, repeatable: false, action: 'flipHorizontal' },
    { codes: ['KeyV'], ctrl: false, shift: ShiftRule.REQUIRED, repeatable: false, action: 'flipVertical' },
].map((binding) => Object.freeze(binding)));

/**
 * 対応表のcancel（Esc）のエントリ。拡大縮小・回転・一覧の行のドラッグ中の例外（findCancelableDragBinding）が返す唯一のエントリで、
 * キーの識別はこのエントリのcodesから取る（'Escape'をほかの箇所に書き写さない）。exportしない。
 * @type {Readonly<ShortcutBinding>}
 */
const CANCEL_BINDING = SHORTCUT_BINDINGS.find((binding) => binding.action === 'cancel');

/**
 * 拡大縮小・回転・一覧の行のドラッグ中のcancel（Esc）の例外の判定（この判定はここ1箇所のみ）。#findBindingの照合より前に使われる。
 * event.codeがcancelのエントリのcodesに含まれ、かつisCancelableDrag()が真のときだけcancelのエントリを返す。
 * Shift・Alt・Ctrl・Metaとevent.repeatは読まない（拡大縮小・回転のドラッグ中は修飾キーを押したままでも中断できるようにするため。
 * 今の#findBindingはAlt押下で常に不一致、cancelはctrl: false・shift: FORBIDDENのため、その照合では拾えない）。
 * documentに触れず、eventを書き換えない。対応表の照合（#findBinding）の結果には影響しない。
 * @param {{code: string}} event keydownイベント（codeのみ読む）
 * @param {() => boolean} isCancelableDrag Escで中断できるドラッグの最中かの照会。codeが一致したときだけ1回呼ぶ
 * @returns {Readonly<ShortcutBinding> | null} cancelのエントリ（例外が当たらなければnull）
 */
export function findCancelableDragBinding(event, isCancelableDrag) {
    if (!CANCEL_BINDING.codes.includes(event.code)) {
        return null;
    }
    return isCancelableDrag() ? CANCEL_BINDING : null;
}

/**
 * documentのkeydownを購読し、対応表（SHORTCUT_BINDINGS）に一致したキーを注入コールバックへ振り分ける。
 * VectorModel・ViewTransform・InputTrackerインスタンス・DOMのボタン要素は参照しない
 * （documentのkeydown購読とdocument.activeElementの読み取りのみ）。keyupは購読しない。
 * 図形種別・操作モードごとの分岐は持たず、action名によるコールバック呼び出しのみを行う。
 * ドラッグ中は原則として何も実行しないが、拡大縮小・回転・一覧の行のドラッグ中のcancel（Esc）だけは修飾キーを問わず通す
 * （問い合わせは注入されたisCancelableDragのみ。判定はfindCancelableDragBindingの1か所）。
 */
export class KeyboardShortcuts {
    /**
     * main.jsから注入された操作コールバック群。
     * @type {ShortcutActions}
     */
    #actions;

    /**
     * @param {ShortcutActions} actions - 操作コールバック群。isDragging・isCancelableDragと対応表の全action名が関数であること
     * @throws {Error} 必要なコールバックが欠けている場合（起動時に配線漏れを検出するため）
     */
    constructor(actions) {
        const requiredNames = new Set(['isDragging', 'isCancelableDrag', ...SHORTCUT_BINDINGS.map((binding) => binding.action)]);
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
     * 3. 一致エントリを求める。まず拡大縮小・回転・一覧の行のドラッグ中のcancelの例外（findCancelableDragBinding。Shift・Alt・Ctrl・Metaを問わず
     *    Escにcancelのエントリを返す）、当たらなければ対応表から探す（#findBinding）。一致なしなら何もしない。
     * 4. ctrl: falseのエントリで、Spaceで操作する入力部品（isSpaceOperatedInputElement(document.activeElement)。
     *    typeがcheckbox・colorのinput。色の欄）にフォーカスがあるなら何もしない（Ctrl付きのエントリは対象外）。
     *    ON/OFFのボタン（aria-pressedを持つbutton）はこの手順の対象外（Spaceの扱いはInputTrackerが決める）。
     * 5. ドラッグ中（isDragging()が真）なら実行しない。ただし手順3の例外が当たったとき（拡大縮小・回転・一覧の行のドラッグ中のEsc）は実行する
     *    （手順4・6は例外のときもcancelのエントリの値のまま効く＝色の欄にフォーカスがある間・キーリピートは実行しない）。
     * 6. キーリピート（event.repeat）かつrepeatable: falseのエントリなら実行しない。
     * 7. 注入コールバックactions[binding.action](binding.arg)を呼び、trueが返った場合のみpreventDefault()する。
     * preventDefault()の原則：受理した（コールバックがtrueを返した）キーのみpreventDefault()し、受理しなかったキーは
     * preventDefault()しない（IME変換中・テキスト入力中・対応表に一致なし・Spaceで操作する入力部品の操作中・コールバックがfalseを含む）。
     * 唯一の例外：ctrl: trueのエントリが、ドラッグ中（手順5）またはキーリピート（手順6）で実行されなかった場合は、
     * 操作は実行せずpreventDefault()のみ行う（Ctrl+=/-/0/A/Z/Y/C/X/V/D/I/Gでブラウザのズーム・ページ全選択・標準の取り消し/やり直し・
     * 標準のコピー・切り取り・貼り付け（Ctrl+Shift+Vの書式なし貼り付けを含む）・ブックマーク追加・ページの情報・ページ内検索（Ctrl+G）が起きないようにするため）。
     * ctrl: falseのエントリが手順5・6で実行されなかった場合はpreventDefault()もしない。
     * @param {KeyboardEvent} event
     */
    #handleKeyDown(event) {
        if (event.isComposing) {
            return;
        }
        if (isTextInputElement(document.activeElement)) {
            return;
        }

        // 手順3：拡大縮小・回転・一覧の行のドラッグ中のcancelの例外（修飾キーを問わない）を先に判定し、当たらなければ対応表の照合
        const dragCancelBinding = findCancelableDragBinding(event, () => this.#actions.isCancelableDrag());
        const binding = dragCancelBinding ?? this.#findBinding(event);
        if (binding === null) {
            return;
        }

        // 手順4：Spaceで操作する入力部品（typeがcheckbox・colorのinput。色の欄）の操作中は、Ctrlなしのショートカットを働かせない
        if (!binding.ctrl && isSpaceOperatedInputElement(document.activeElement)) {
            return;
        }

        // 手順5・6：ドラッグ中（手順3の例外が当たったときを除く）、またはリピート不可エントリのキーリピートは実行しない
        // （例外の判定は手順3のfindCancelableDragBindingの結果を使うだけで、ここに写さない）
        if ((dragCancelBinding === null && this.#actions.isDragging()) || (event.repeat && !binding.repeatable)) {
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
     * 対応表を走査し、イベントに一致する最初のエントリを返す。キー識別・修飾キー判定はこのメソッドでのみ行う
     * （ただし拡大縮小・回転・一覧の行のドラッグ中のcancel（Esc）の例外はfindCancelableDragBindingが先に判定し、修飾キーを問わない。
     * 例外が当たったときはこのメソッドは呼ばれない。例外が当たらなければ以下の規則のまま）。
     * ・キーはevent.code（物理キー位置）で識別する。event.keyは大文字小文字・Shift併用時の記号化（Shift+1→!）・
     *   キーボード配列・IMEの影響を受けるため用いない（例：JIS配列の;/+キーはkeyが揺れるがcodeはSemicolonで一定）。
     * ・Alt押下時は常に不一致（AltGr＝Ctrl+Altによる文字入力を奪わないため）。
     * ・Meta（⌘）はCtrlと同一視する（macOS対応）。ctrl: trueはctrlKey || metaKeyが真、ctrl: falseは両方が偽であること。
     * ・Shift：エントリのshift（ShiftRule）の3値で判定する。FORBIDDENはshiftKeyが偽であること、
     *   ANY（拡大・縮小のみ）はshiftKeyを問わない（JIS配列のCtrl+Shift+;、US配列のCtrl+Shift+=に対応するため）、
     *   REQUIRED（やり直しのCtrl+Shift+Zと同じ位置に貼り付けのCtrl+Shift+V、フォルダの解除のCtrl+Shift+G、10px微調整のShift+矢印キー、反転のShift+H・Shift+Vのみ）はshiftKeyが真であること。
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
