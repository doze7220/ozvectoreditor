*   **ShapeFactory.js**：図形種別一覧の正本（対応表）と、種別に応じたインスタンス生成・図形データからの復元の振り分けを担うFactory。`core/`層で図形種別の対応づけを許容する唯一の例外モジュール。対応づけは対応表の表引きのみで行い、if/switch分岐は持たない。状態は持たない。
    *   **公開**：静的メソッド`create`・`fromJSON`、export`SHAPE_TYPES`。いずれのメソッドも不正な入力で`Error`をthrowし、`try/catch`を持たない（図形単位の例外の捕捉は`DocumentSerializer`の1箇所のみ）。
    *   **対応表と種別一覧**：`SHAPE_REGISTRY`が唯一の正本で、`SHAPE_TYPES`はこれから導出する。他モジュールは種別一覧を自前で列挙しない（`InputTracker`は再export、`PaletteController`はコンストラクタ引数で受け取る）。対応関係は`circle`/`arc`→`Ellipse`、その他は同名の図形クラス。
    *   **並び順**：図形パレットのボタン順であり、同時に数字キーの割り当て順（`KeyboardShortcuts`）・`InputTracker`の図形種別の初期値・`VectorModel.startDraft`の既定値（いずれも先頭要素）を決める。並びを変える場合は`index.html`のパレットのボタン順と各ボタンの`title`（ショートカット併記）も手動で揃える。
    *   **依存の制約**：`shapes/`のみをimportし、`core/`内の他モジュールをimportしない。`InputTracker`（および経由して`KeyboardShortcuts`）が`ShapeFactory`をimportしているため、逆向きのimportは循環importとなり、`KeyboardShortcuts`のモジュール最上位での`SHAPE_TYPES`参照が未初期化で失敗し得る。`shapes/`も`ShapeFactory`・`core/`をimportしない。
    *   **図形種別の追加手順**：①図形クラスを`shapes/`に追加（13メソッド契約を満たす。4章`shapes/`）②`SHAPE_REGISTRY`へ1エントリ追加 ③`index.html`のパレットに`id="palette-<type>"`のボタン（アイコン・表示名・`title`のショートカット併記）を手で追加する。③を忘れると起動時に`PaletteController`の警告が出て、その種別はパレットから選べない（数字キーでは選べる）。
