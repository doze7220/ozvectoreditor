*   **KeyboardShortcuts.js**：キー→操作の対応表（`SHORTCUT_BINDINGS`）と`keydown`の受理判定のみを担う。判定順序と`preventDefault()`の規則は`#handleKeyDown`のJSDoc、キー識別と修飾キーの規則は`#findBinding`のJSDoc、コールバックの契約はtypedef`ShortcutActions`を正とする。
    *   **公開メソッド**：なし（コンストラクタのみ。`main.js`がインスタンスを保持しない）。
    *   **追加の仕方**：新しいショートカットは対応表へのエントリ追加（＋必要なら注入コールバックの追加）で対応する。Shift規則は必ず`ShiftRule`の値を指定する（`ANY`・`REQUIRED`以外の値は書き忘れも含めて`FORBIDDEN`として扱われる）。図形種別のエントリは`SHAPE_TYPES`の並びから生成する。`Space`は対応表に含めない。`Shift`+`V`・`Ctrl`+`Shift`+`C`等は将来のShift併用操作のために予約している。
    *   **知らないこと**：`VectorModel`・`ViewTransform`・`InputTracker`インスタンス・DOMのボタン要素。`InputTracker.js`からは定数`OperationMode`/`SHAPE_TYPES`と関数`isTextInputElement`のみをimportする。`keyup`は購読しない。操作の実体は注入されたコールバックへ委譲する（コンストラクタで全action名の注入を検証し、欠落時は`Error`をthrow）。
    *   **UI同期**：ショートカット専用のUI同期・再描画は持たない（3章「同期の経路」）。
