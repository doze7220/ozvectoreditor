/**
 * 責務：Altキーの単独押下・単独解放でブラウザのメニューへフォーカスが移る標準動作を、Altキー自身のkeydown・keyupの
 * preventDefault()で抑止することのみを担う。状態を持たず、操作の実体（Alt+ドラッグ等）は持たない。
 */

import { isTextInputElement } from './InputTracker.js';

/**
 * Altキーの単独押下・単独解放の抑止（メニューへのフォーカス移動の防止）。
 * 抑止の対象は「event.keyが'Alt'のkeydown・keyup」のうち、Ctrlが押されておらず（event.ctrlKeyが偽）、
 * フォーカスがテキスト入力中の要素（isTextInputElement）でないものだけ。
 * 対象外：AltGr（event.keyが'AltGraph'）、Ctrlと同時の押下、テキスト入力中、Alt+ほかのキー
 * （ほかのキーのイベントのkeyは'Alt'ではないため奪わない）。
 * 状態を持たず、公開メソッドもない。生成した時点から購読が有効になり、解除しない（アプリの存続中は有効）。
 * InputTrackerへは入れない（Alt+ドラッグのAltの読み取りとは別の関心事）。KeyboardShortcutsへも入れない
 * （KeyboardShortcutsはkeyupを購読せず、「Alt押下中は常に不一致」の規則も変えないため）。
 */
export class AltKeyGuard {
    /**
     * documentのkeydown・keyupを購読して抑止を有効にする。モジュールの最上位ではDOMに触れず、
     * documentの参照はここ（コンストラクタ）の中だけで行う。
     */
    constructor() {
        /**
         * Altキー自身のkeydown・keyupで、対象のときだけpreventDefault()する。状態を持たない。
         * 対象：event.keyが'Alt'、かつevent.ctrlKeyが偽、かつdocument.activeElementがテキスト入力中の要素でない。
         * @param {KeyboardEvent} event keydownまたはkeyupのイベント
         * @returns {void}
         */
        const handleAltKey = (event) => {
            if (event.key !== 'Alt' || event.ctrlKey || isTextInputElement(document.activeElement)) {
                return;
            }
            event.preventDefault();
        };

        document.addEventListener('keydown', handleAltKey);
        document.addEventListener('keyup', handleAltKey);
    }
}
