*   **ItemAttributeRules.js**：アイテムの名前・表示・ロックの規則（名前の整え方・自動の名前の番号・不備の補い）を、状態を持たない関数として提供する（Phase 11-01で新設。名前の付き方は2章「アイテム」）。
    *   **公開**：`normalizeItemName(value)` → 整えた名前（名前なしは空文字列）。`resolveItems(values, existingItems = [])` → 名前・表示・ロックが決まった新しいアイテムの入れ子。
    *   **`normalizeItemName`**：文字列でなければ名前なし。文字列なら前後の空白を除く → 先頭100文字（`Array.from`。サロゲートペアを分断しない）→ 切った後の前後の空白を除く。空なら名前なし。`edit/CanvasLibrary`のキャンバス名の正規化とは別の規則で、共通化しない。
    *   **`resolveItems`の手順**（名前の規則の1か所）：①`values`のすべてのアイテム（フォルダとその中身を含む）の名前を整える。番号を数えるより先に行う（整えて初めて自動の名前の形になる名前も数えるため）。②整えた名前と、`existingItems`（今のキャンバス。書き換えず、同じ整え方をした値で数える）の名前から、自動の名前の形`<呼び名><半角空白><番号>`（正規表現`/^(.*[^\s]) ([1-9][0-9]*)$/`。番号は`+1`しても安全な整数）の**呼び名ごとの最大番号**を数える。図形の`type`ではなく名前の文字列で数える（種別が変わった図形「直線 2」も直線の番号として数える）。フォルダの名前も同じ1回で数える。③`visible`が真偽値でなければ`true`、`locked`が真偽値でなければ`false`。④名前なしになったアイテムに、描画順（フォルダはその中身より先）で、呼び名ごとの最大番号＋1を順に付ける。呼び名は図形が`ShapeFactory.getTypeLabel(shape.type)`（`10_ShapeFactory.md`）、フォルダが`フォルダ`。
    *   **契約**：毎回新しいアイテムを返し、引数（`values`・`existingItems`）を書き換えない。素の図形インスタンスも受け、名前の無い図形のアイテムとして扱う。2回通しても値が変わらない（同じ状態からは同じJSON）。重複した名前は許す。欠番は埋めない（最大番号の次）。
    *   **どこで通るか**：`VectorModel`の`commitDraft`・`addShape`・`addShapesWithNewIds`（`existingItems`に今のキャンバスの`#items`を渡す）・`replaceAllShapes`（`existingItems`なし）、`DocumentSerializer.serialize`（素の図形の名前の補い）・`deserialize`（読めた要素に1回。ファイルの中だけで番号を決める）。名前の無いファイルをインポートすると、キャンバスにある番号と重なる名前が付くことがある（ファイルの中の名前のまま入るため）。
    *   **読むもの**：渡されたアイテムの`name`・`visible`・`locked`と、図形の`type`（呼び名を引くためだけ）。表示・ロックの値を読むのはここ（不備の補い）と`DocumentSerializer`（書く・読む）だけで、描画・当たり判定・選択・書き出しには効かない。
    *   **知らないこと**：DOM・`VectorModel`・作業データ形式・図形固有のプロパティ名。importは`core/ItemTreeRules`（`ITEM_KIND`・`toItems`・`listItems`）と`core/ShapeFactory`のみ（`core/`の規則どうしのimportの例外。循環しない）。
    *   **使う側**：`core/VectorModel`・`io/DocumentSerializer`。
    *   **テスト**：`test/core/ItemAttributeRules.test.js`（29件。`_doc/arch/16_test.md`）。
