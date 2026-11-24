# RES: 作業計画・作業レポート (Phase 11-01) : 下準備（図形の一覧のためのデータの土台）
* 参照元REQ: `./_log/req/261124_1400_REQ_Phase11-01_List_Data_Base.md`

## 1. 作業目的
図形の名前・表示・ロックと、フォルダの入れ子を、エディタの中（`VectorModel`）と作業データ（版4）に持てるようにする。後の作業で、図形の一覧・フォルダ・表示/非表示・ロックの画面がこの土台の上に載る。

* 画面の見た目・操作は変えない。表示・ロックの値は持つだけで、描画・当たり判定・選択・書き出しに効かせない。
* `shapes/`・`InputTracker.js`・`CanvasManager.js`・`index.html`・`palette/`・`wiring/`・`HistoryManager.js`・`CodeExporter.js`・`CanvasStorage.js`は変更しない（変える必要は無いと確かめた）。
* 名前を変える・フォルダを作る等の、画面の操作のための公開操作は足さない。
* 計画時に、作業領域の外の写しで本計画の形を試作し、既存テスト2470件のうち書き換えが要るものを実測した（下の「既存テストの書き換え」がその全部）。試作は計画の根拠であり、リポジトリには何も入れていない。

## 2. アーキテクチャ設計
### 用語と、並びの要素（アイテム）の形（全タスク共通）
書き出しの「描画要素」（`elements`）と区別するため、入れ子の並びの1つ分をコード上で **アイテム（item）** と呼ぶ。プレーンオブジェクトで、次の2種類。

```js
// 図形のアイテム
{ kind: 'shape', shape: <図形クラスのインスタンス>, name, visible, locked }
// フォルダのアイテム
{ kind: 'group', id, name, visible, locked, children: [アイテム, ...] }
```

* 図形の`id`は今までどおり`item.shape.id`（アイテムには写さない＝二重に持たない）。フォルダの`id`は`item.id`。
* 「描画順」＝入れ子を深さ優先・前順（フォルダ自身 → その中身）で平らにした並び。図形だけを取り出した並びが重なり順。
* `kind`はエディタの中だけの値で、作業データには出さない。作業データのフォルダは`type: 'group'`（`DocumentSerializer`だけが知る）。
* **素の図形インスタンスも受ける入口**：図形の配列を受け取っている今の入口（`VectorModel.replaceAllShapes`・`addShapesWithNewIds`・`addShape`、`DocumentSerializer.serialize`・`serializeToString`、`SpriteSerializer.serialize`）は、名前・引数の形・戻り値を保ったまま、配列の要素に「アイテム」または「素の図形インスタンス」を受ける。素の図形インスタンスは「名前の無い図形のアイテム」として扱い、自動の名前が付く。理由：既存テスト（2470件の多く）が素の図形インスタンスを渡しており、REQ要件7・制約により既存テストの値・呼び方を変えられないため、また同じ働きの入口を2つずつ作らないため。**製品コードの保存・復元の経路は必ずアイテムを渡す**（`model.getItems()`・`result.items`。素の図形を渡すと名前・フォルダが失われる。JSDocに明記する）。

### 要件1: ふるまいを変えない
* `getShapes()`が返す平らな配列・図形インスタンス・`id`の採番の順（`shape-<連番>`）・選択・ホバー・通知の回数・`console.warn`の文面と回数は、入れ子を含まない並びで今と同じ。
* `SpriteSerializer.serialize`の`elements`・`bounds`は平らにした図形から求める（今と同じ値）。`formatVersion`は4のまま。
* 表示・ロックの値を読むのは、`DocumentSerializer`（書く・読む）と`ItemAttributeRules`（不備の補い）だけ。

### 要件2: 作業データの形（版4）
* `DocumentSerializer`の`CURRENT_DOCUMENT_VERSION`を4にする。最上位は`{ format, version, shapes }`のまま。
* 図形の要素＝`{ ...shape.toJSON(), name, visible, locked }`（今のキーの後に3つ足す）。フォルダの要素＝`{ type: 'group', id, name, visible, locked, children }`（このキー順）。
* 知らないキーは、最上位・図形の要素・フォルダの要素とも読まない（無視する）。
* `MIGRATIONS[3]`＝`migrateVersion3To4`：`shapes`のプレーンオブジェクトの要素ごとに、新しいオブジェクトで`name: ''`・`visible: true`・`locked: false`を入れる（版3以前に意味の無かったキーなので、値を持っていても置き換える。版1→2の`fillColor`と同じ考え方）。`name: ''`は「名前なし」で、読み込みの共通の規則が自動の名前を付ける（番号の規則を`MIGRATIONS`に書かない）。
  * 版3以前の`type: 'group'`の要素は「未知の図形種別」として1件の読み飛ばしだった。版4の読み方でフォルダとして受理されないよう、`children: null`を入れる（「`children`が配列でないフォルダ」として`index`・`type`が今と同じ1件の読み飛ばしになる。`reason`の文字列だけが変わる）。
  * 版1〜3は`MIGRATIONS`を順に通るため、版1→2→3→4の経路はそのまま。プレーンオブジェクトでない要素・配列でない`shapes`は今と同じくそのまま残す。引数を書き換えない。
* フォルダの`id`の形式は`group-<連番>`。連番は図形の`id`と同じ1つのカウンタ（`#nextId`）から取り、`VectorModel`の`#issueId`に閉じる。

### 要件3: エディタの中での持ち方
* `VectorModel`は**アイテムの入れ子の配列`#items`だけを状態として持つ**。今の`#shapes`は状態（フィールド）をやめ、`#items`を平らにして毎回求める非公開のgetterにする（平らな配列をキャッシュしない＝食い違う状態を作れない）。
* 入れ子を扱う計算は、状態を持たない新しいファイル`js/core/ItemTreeRules.js`に置く。名前・表示・ロックの規則は、状態を持たない新しいファイル`js/core/ItemAttributeRules.js`に置く。
* `VectorModel`に足す公開操作は照会`getItems()`だけ。入れ子ごと入れ替えるのは今の`replaceAllShapes`、作業データへ入れ子ごと書き出すのは`DocumentSerializer.serialize(model.getItems())`。

| 経路 | 今 | 変更後 |
| --- | --- | --- |
| 自動保存（`CanvasLibrary#saveOpenCanvasNow`） | `serialize(getShapes())` | `serialize(getItems())` |
| キャンバスを開く・起動時の復元（`CanvasLibrary`） | `result.shapes` → `replaceAllShapes` | `result.items` → `replaceAllShapes` |
| 開く（ファイル）（`CanvasFileOperations` → `CanvasLibrary.createCanvasFromShapes`） | `result.shapes` | `result.items` |
| 出力（作業ファイル）・出力（エンジン用） | `getShapes()` | `getItems()` |
| インポート | `insertDocument(serialize(result.shapes))` | `insertDocument(serialize(result.items))` |
| 取り消し/やり直し（`SnapshotAdapter`） | `serialize(getShapes())`・`replaceAllShapes(result.shapes)` | `serialize(getItems())`・`replaceAllShapes(result.items)` |
| コピー・切り取り・複製（`ClipboardController`） | 選択図形を`serialize` | 選択図形の図形のアイテムを平らに`serialize` |
| 貼り付け・複製・インポートの追加（`ShapeInserter`） | `addShapesWithNewIds(shapes)` | `addShapesWithNewIds(result.items)` |
| `?dev`の書き出し・復元（`main.js`） | `getShapes()`・`result.shapes` | `getItems()`・`result.items` |

### 要件4: 名前の付き方
* 種類の呼び名は`SHAPE_REGISTRY`の各エントリの項目`label`（`line`＝直線、`curve`＝曲線、`arc`＝弧、`rect`＝矩形、`circle`＝円、`path`＝パス）。`ShapeFactory.getTypeLabel(type)`で引く。未知の`type`（テストの偽物の図形等）は例外にせず`'図形'`を返す（防御）。
* 名前の規則は`ItemAttributeRules.resolveItems(values, existingItems)`の1か所：
  1. `values`のすべてのアイテム（フォルダとその中身を含む）の名前を整える：文字列でなければ名前なし、文字列なら前後の空白を除く → 先頭100文字（`Array.from`。サロゲートペアを分断しない）→ 切った後の前後の空白を除く。空なら名前なし。**番号を数えるより先に行う**（整えて初めて自動の名前の形になる名前、例：`' パス 1 '`や、100文字で切って形に一致する名前も、手順2で数えるため）。
  2. 手順1で整えた`values`の名前と、`existingItems`（今のキャンバス。書き換えず、同じ整え方をした値で数える）の名前から、自動の名前の形`<呼び名><半角空白><番号>`（番号は`[1-9][0-9]*`で、`+1`しても安全な整数）の**呼び名ごとの最大番号**を数える。図形の`type`ではなく**名前の文字列**で数える（種別が変わった図形「直線 2」も直線の番号として数える）。フォルダの名前も同じ1回で数える。
  3. `visible`が真偽値でなければ`true`、`locked`が真偽値でなければ`false`。
  4. 手順1で名前なしになったアイテムに、描画順（奥から。フォルダはその中身より先）で、呼び名ごとの最大番号＋1を順に付ける。図形の呼び名は`getTypeLabel(shape.type)`、フォルダは`フォルダ`。
  * 毎回新しいアイテムを返し、引数を書き換えない。2回通しても値が変わらない（同じ状態からは同じJSON）。
* 新しく描いた図形（`commitDraft`。通常の確定・線を続けて引いて終えたときの両方が通る）は`resolveItems([draft], #items)`の結果を末尾に足す。種類は確定した図形の`type`で決まる。
* 読み込み（`deserialize`）は、読めた要素だけを集めてから`resolveItems(読めた要素)`を1回通す（ファイルの中だけで番号を決める）。
* 作り直す操作（`replaceShape`・`replaceShapesKeepingIds`）は、アイテムの`shape`だけを差し替えるため、名前・表示・ロック・所属が位置ごとそのまま引き継がれる。

### 要件5: 入れ子を含む並びと今の操作
* 新規・貼り付け・複製・インポートは`#items`のいちばん外側の末尾に足す。
* 削除は`filterShapes`（図形のアイテムだけを除き、フォルダは空になっても残す）。
* `reorderShapes`は、フォルダの位置と入れ子を保ったまま、**図形のアイテム（名前・表示・ロックごと）**を新しい順に図形の位置へ置き直す（`placeShapeItems`）。名前は図形について動き、所属は位置のものになる。

### 要件6: 読み込みの失敗の扱い
* `deserialize`の結果は`{ ok, items, shapes, skipped, error }`。`items`＝アイテムの入れ子、`shapes`＝`listShapes(items)`（今までと同じ平らな図形の配列）。使う側の件数の判定（`shapes.length`・`skipped.length`）は変えない。
* `skipped`の記録は`{ index, path, type, reason }`。`index`は今までどおり**最上位の`shapes`の中での位置**（入れ子の中なら、それを含む最上位の要素の位置）。`path`は最上位からの位置の並び（例：`[1, 2]`＝`shapes[1].children[2]`。最上位なら`[index]`）。警告文は`図形 #1/2（…）を読み飛ばしました: …`（最上位の要素では今と同じ文面`図形 #1（…）…`）。
* `children`が配列でないフォルダは1件の読み飛ばし（`type: 'group'`）。中身は読まない。
* 入れ子の再帰が実行環境の限界を超えた場合（`RangeError`）は、`deserialize`の中で捕捉して全体の読み込み失敗にする（例外を投げない約束を保つ。深さの制限は設けない。試作では1000段が往復し、20000段は全体失敗で例外なし）。
* フォルダだけで図形0個・読み飛ばし0件なら`shapes`が0個のため、`CanvasFileOperations`の判定は「空」（開くは空のキャンバスと同じ扱いでフォルダごと開く、インポートは`noShapes`）。`ShapeInserter`は今と同じく図形0個なら何もしない。

### 要件7: 自動テスト
* 各タスクの終わりで`node --test`が全件合格する（計画時2470件合格・Node.js v24.15.0）。

**既存テストの書き換え（これ以外の既存テストは書き換えない）**

| ファイル | 行（計画時） | 書き換え | タスク |
| --- | --- | --- | --- |
| `test/io/DocumentSerializer.roundtrip.test.js` | 229 | `doc.shapes`の期待値に`name`（順に`矩形 1`・`弧 1`・`直線 1`・`円 1`・`曲線 1`）・`visible: true`・`locked: false`を足す | 4 |
| 同上 | 542・544・545・648・651・703・720・721・779・789・903・906・969・973 | 版の数字3→4（題名の「版は3」「3 である」「版3」も） | 4 |
| 同上 | 652〜654・907〜914 | キーの一覧の末尾に`'name', 'visible', 'locked'`を足す（題名の「図形データのキーは増えない」は「図形データのキーは名前・表示・ロックのほかに増えない」に） | 4 |
| `test/io/DocumentSerializer.migration.test.js` | 2〜4行目の責務・290（題名） | 題名「現行版（版3）の作業データは変換されず」→「版3の作業データは円・弧の点が変換されず」。責務に版3→版4を足す。**入力の`version: 3`・期待値は変えない** | 4 |
| `test/io/SpriteSerializer.test.js` | 61・138・1003 | `source.version`・`source`の版の数字3→4 | 4 |
| `test/edit/TransformInputEditor.test.js` | 380 | `source.version`3→4 | 4 |
| `test/edit/CanvasFileOperations.test.js` | 279・293〜296 | `documentData.shapes`の期待値に`name`（順に`直線 1`・`曲線 1`・`矩形 1`・`弧 1`・`円 1`のうち該当分）・`visible`・`locked`を足す | 4 |
| 同上 | 81〜84・102〜107 | 偽物だけ：`createCanvasFromShapes`の記録を`shapes: listShapes(items)`にする（確かめる値は今のまま図形）。`model`の偽物に`getItems: () => []`を足す | 7 |
| `test/edit/CanvasFileOperations.export.test.js` | 122〜127（`getShapes`は126） | 偽物だけ：`model`の偽物に`getItems: () => toItems(shapes)`を足す | 7 |

偽物への追加は、入れ子の照会（要件3）を使う側が呼ぶことに伴う最小限のもので、確かめている値は変えない。偽物のJSDocも合わせて直す。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/core/`（規則・モデル）、`./js/io/`（作業データ・スプライト）、`./js/edit/`（手順）、`./js/main.js`（`?dev`）、`./test/`
*   **関連する論理クラス**:
    *   新規：`core/ItemTreeRules`（入れ子の計算の規則）、`core/ItemAttributeRules`（名前・表示・ロックの規則）
    *   変更：`core/ShapeFactory`・`core/VectorModel`・`io/DocumentSerializer`・`io/FileContentReader`・`io/SpriteSerializer`・`edit/SnapshotAdapter`・`edit/ShapeInserter`・`edit/ClipboardController`・`edit/CanvasLibrary`・`edit/CanvasFileOperations`・`main.js`
    *   依存（すべて今の向き）：`ItemTreeRules`はimportなし。`ItemAttributeRules → ItemTreeRules・ShapeFactory`。`VectorModel → ItemTreeRules・ItemAttributeRules・ShapeFactory`。`DocumentSerializer → ItemTreeRules・ItemAttributeRules・ShapeFactory`、`SpriteSerializer → ItemTreeRules`（`io → core`）。`ClipboardController → ItemTreeRules`（`edit → core`の状態を持たない規則）。循環importなし。

### 参照する責務
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`・`palette/`・`wiring/`・`asset/`をimportしない。`io/`は`edit/`をimportしない。`edit/`から`core/`は状態を持たない規則の関数だけをimportする（`VectorModel`・`HistoryManager`は注入で受け取る）。`core/`から`shapes/`をimportするのは`ShapeFactory`・`RotationRules`だけ。
*   **`core/VectorModel`**：図形データ・選択集合等の単一の真実（SSOT）。図形固有の頂点構造・内部プロパティ名、図形データ・作業データ形式・`DocumentSerializer`を知らない。`id`の採番と形式の知識は本クラスに閉じる（他は`id`を不透明な文字列として扱う）。連番カウンタは単調増加で減らさない。
*   **`core/ShapeFactory`**：図形種別一覧の正本（対応表`SHAPE_REGISTRY`）。`core/`で図形種別の対応づけを許す唯一の例外。対応づけは表引きだけで、if/switch分岐を持たない。`shapes/`だけをimportし、`core/`内の他モジュールをimportしない（循環importを避けるため）。
*   **`core/HistoryManager`**（変更しない）：`capture`/`restore`は注入。前後の`document`の`JSON.stringify`を比べ、同じなら記録しない。作業データの中身を解釈しない。
*   **`io/DocumentSerializer`**：作業データ形式の変換と旧版からの移行。デシリアライズ系は例外をthrowせず結果オブジェクトを返す。図形単位の例外の捕捉はここだけ。`serialize`系は入力を検証しない。引数を書き換えない。図形種別の分岐・図形固有のプロパティ名を持たない（例外は`MIGRATIONS`の中だけ）。
*   **`io/FileContentReader`**：テキストの中身で判別し`DocumentSerializer.deserialize`へ渡す入口。結果は`DeserializeResult`と同じ形。全体失敗の警告は1回。
*   **`io/SpriteSerializer`**：書き出し形式の組み立て。`source`は`DocumentSerializer.serialize`の戻り値そのもの。書き出し形式の版は`SPRITE_FORMAT_VERSION`（4のまま）。
*   **`edit/SnapshotAdapter`**：`capture`＝作業データ＋選択集合。`restore`は全体失敗または1件でもスキップがあれば`console.warn`してキャンバスを変えず`false`。
*   **`edit/ShapeInserter`**：作業データの図形を平行移動して新しい`id`で最前面へ追加し、追加した図形だけを選ぶ1件の編集操作（記録しない入口`insertDocumentWithinEdit`も）。図形0個なら何もせず記録しない。
*   **`edit/ClipboardController`**：クリップボードを作業データ形式で保持。モデルへの依存は読み取りだけ。追加は`ShapeInserter`、削除は注入された`deleteSelection`。
*   **`edit/CanvasLibrary`**：キャンバス一覧の管理。作業データ・図形を不透明に扱う。`createCanvasFromShapes(rawName, 図形の配列)`・`createCanvas()`（`createCanvasFromShapes(null, [])`への委譲）。
*   **`edit/CanvasFileOperations`**：ファイル操作の手順と通知。件数の判定は`result.shapes`・`result.skipped`で行い、作業データの中身は見ない。
*   **共通メソッド契約（変えない）**：図形は`toJSON`・`fromJSON`・`createTransformed`・`toDrawElement`・`translate`等を持つ。`toJSON()`のキーは`{ type, id, points, (closed, segments, corners), strokeColor, strokeWidth, fillColor }`。
*   **テストの決まり**：置き場所は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。`node:test`・`node:assert/strict`だけを使う。先頭に単一責務のJSDoc（3行以内）、補助関数にもJSDoc。公開APIだけを通す。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止する。`test/`以下に共有の補助ファイルを置かない（すべてテストとして実行されるため）。
*   **行末**：計画時の実測（CR数／LF数）。`VectorModel.js` 0/955・`ShapeFactory.js` 0/98・`DocumentSerializer.js` 0/300はLF。`FileContentReader.js` 92/92・`SpriteSerializer.js` 374/374・`CanvasFileOperations.js` 430/430・`CanvasLibrary.js` 1176/1176・`ClipboardController.js` 226/226・`ShapeInserter.js` 148/148・`SnapshotAdapter.js` 91/91・`main.js` 1183/1183はCRLF。`test/edit/CanvasFileOperations*.test.js`・`TransformInputEditor.test.js`はCRLF、他の書き換えるテストはLF。**行末を保つ**（測るときは`tr -cd '\r' < ファイル | wc -c`。Git Bashの`grep`は正しく数えない）。新しいファイルはLF。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章**
    *   構成図：`core/`に`ItemTreeRules.js`・`ItemAttributeRules.js`、`test/`に新しいテストファイルを足す。
    *   フォルダ分割の方針：`core/`の規則の説明に2ファイルを足す。`edit/`から使う`core/`の規則の列挙に`ItemTreeRules`（`ClipboardController`）を足す。
    *   依存方向：「`io/`のimportは`io/`内と`core/ShapeFactory`のみ」→`core/ItemTreeRules`・`core/ItemAttributeRules`を足す。例外(3)`edit/ → core/`に`ClipboardController → core/ItemTreeRules`を足す（「この6ファイルだけ」の数も）。規則どうしのimport`ItemAttributeRules → ItemTreeRules・ShapeFactory`。
    *   「存在しないもの」：名前・表示・ロック・フォルダは**データとして持つだけで、画面（一覧・名前の変更・フォルダの作成/解除・目や鍵）は無く、表示・ロックは描画・当たり判定・選択・書き出しに効かない**こと。折りたたみの状態・フォルダの役割・不透明度・点の共有・フォルダの形を保ったコピー＆ペーストが無いこと。
*   **2章**
    *   図形データ：作業データの図形の要素は図形データに`name`・`visible`・`locked`を足したもの（図形クラスの`toJSON`・`fromJSON`は知らない）。
    *   アイテム（並びの要素）の形・`VectorModel`が`#items`だけを持つこと・平らな並びは毎回求めること。
    *   作業データ形式：版4の形（フォルダの要素・空のフォルダ・深さの制限なし・知らないキーは無視）、現行版3→4、`migrateVersion3To4`、`MIGRATIONS`は`{ 1, 2, 3 }`、「版4の作業データを古いエディタで開くと全体が断られる」、保存対象（「図形データのみ」→名前・表示・ロック・フォルダを含む）、読み飛ばしの`index`・`path`、`children`の不備、入れ子が深すぎる場合の全体失敗。
    *   名前の規則（自動の名前・番号・100文字・不備の扱い・重複を許す・引き継ぎ・コピー/複製/インポート）。
    *   `id`の採番（`group-<連番>`、図形と同じカウンタ、合わせて一意）。`fromJSON`直後の`id`の項にフォルダの`id`も。
    *   スプライトの`source`（版4の形）・「2つの版」の版の履歴。描画要素の描画順＝平らにした並び。
    *   「今は3」等の現行版の記述（250行目）、744行目（3章26.）「作業データの現行版は3」、258〜262行目。714行目ほか「時点」を書いた記述は変えない。
*   **3章**：5.（変換・`?dev`の復元＝`items`）、6.（スナップショットに入れ子・名前等が入る、`replaceAllShapes(result.items)`、`addShapesWithNewIds(result.items)`）、7.（クリップボードは選んだ図形のアイテムを平らに写す・名前は元のまま）、8.（記録の作業データ・`createCanvasFromShapes`に渡すもの）、9.（`getItems()`・`result.items`・フォルダだけのファイルの扱い）、11.（結合は基準の線の名前・表示・ロック・所属を引き継ぐ）、14.（並びの正本・`reorderShapes`がフォルダの位置を保ち図形のアイテムを置き直すこと・「図形データの形・版も変えない」の時点）。
*   **`_doc/arch/`**：`03_VectorModel.md`（`#items`・`getItems`・受け取る要素・`id`・知らないこと）、`10_ShapeFactory.md`（`label`・`getTypeLabel`・図形種別の追加手順）、`14_edit.md`（`SnapshotAdapter`・`ShapeInserter`・`ClipboardController`・`CanvasLibrary`・`CanvasFileOperations`）、`15_io.md`（`DocumentSerializer`・`FileContentReader`・`SpriteSerializer`）、`16_test.md`（新しいテスト・書き換えたテスト・件数）、`02_main.md`（`?dev`）。新規`46_ItemTreeRules.md`・`47_ItemAttributeRules.md`（`PROJECT_ARCHITECTURE.md` 4章の表にも足す）。`08_HistoryManager.md`は影響なしの見込み（スナップショットの中身を解釈しない）。
*   （各タスクの実行時に影響が判明した場合も、この欄へ追記する）

## 3. タスクリスト
各タスクで必ず行うこと（以下「共通の締め」）：
* 書いた・変えたファイルの先頭の責務定義（3行以内）とJSDoc（`@param`・`@returns`・`@typedef`）の漏れが無いことを確かめる。変更したクラス・メソッドの既存JSDocの記述が実コードと食い違わないように直す。
* `node --test`を実行し全件合格を確かめる。
* 本RESのタスクを`[x]`にし、「4. 詳細作業内容」に作業レポートを書く。開発資料に影響が判明したら本体は直さず「開発資料の更新予定」へ追記する。

*   [x] タスク1: 入れ子の計算の規則（`core/ItemTreeRules`）
    *   **対象ファイル** :
        *   `./js/core/ItemTreeRules.js` : 新規
        *   `./test/core/ItemTreeRules.test.js` : 新規
    *   **作業内容** :
        *   責務：アイテムの入れ子を扱う計算（状態なし・DOMなし・importなし。図形を不透明に扱う＝アイテムか素の図形かを判定するために値の`kind`を見ることを除き、図形のプロパティを読まない）。
        *   typedef`ShapeItem`・`GroupItem`・`Item`（2章の形）を定義し、次を`export`する。どれも引数の配列・アイテムを書き換えない。
            *   `ITEM_KIND`：凍結した`{ SHAPE: 'shape', GROUP: 'group' }`。
            *   `toItems(values)`：アイテムまたは素の図形インスタンスの配列から、新しいアイテムの入れ子を作る（アイテムかは`kind`が`ITEM_KIND`の値かで判定する非公開関数の1か所。アイテムは入れ子まで新しいオブジェクトへ写し、図形インスタンスは共有する。それ以外は`{ kind: 'shape', shape: 値 }`＝名前・表示・ロックが未定）。
            *   `listItems(items)`：全アイテムを前順（フォルダ → その中身）で並べた新しい配列（要素は引数のアイテムそのもの）。
            *   `listShapeItems(items)`：そのうち図形のアイテムだけ。`listShapes(items)`：その`shape`だけ（＝重なり順の図形の配列）。
            *   `placeShapeItems(items, shapeItems)`：フォルダの位置と入れ子を保ち、図形のアイテムの位置へ`shapeItems`を前から順に置いた新しい入れ子（前提：`shapeItems`の数が図形のアイテムの数と同じ）。
            *   `filterShapes(items, keep)`：`keep(shape)`が偽の図形のアイテムだけを除いた新しい入れ子（フォルダは空になっても残す。`keep`は図形1つにつき1回、前順で呼ぶ）。
        *   テスト：素の図形・アイテム・空のフォルダ・3段以上の入れ子での各関数、前順、`toItems`の写し（書き換えても元が変わらない・図形は共有）、`placeShapeItems`でフォルダの`id`・属性・入れ子が保たれ図形の名前が図形について動くこと、`filterShapes`で空になったフォルダが残ること・`keep`の呼び出し回数、空配列、引数を書き換えないこと。
        *   共通の締め。
*   [x] タスク2: 種類の呼び名と、名前・表示・ロックの規則（`ShapeFactory`・`core/ItemAttributeRules`）
    *   **対象ファイル** :
        *   `./js/core/ShapeFactory.js` : 更新
        *   `./js/core/ItemAttributeRules.js` : 新規
        *   `./test/core/ShapeFactory.test.js` : 更新（追記のみ）
        *   `./test/core/ItemAttributeRules.test.js` : 新規
    *   **作業内容** :
        *   `ShapeFactory.js`：`SHAPE_REGISTRY`の各エントリに`label`（2章要件4の呼び名）を足し、`ShapeRegistryEntry`のtypedefと対応表のJSDoc（図形種別を追加する際は`label`も決めること）を直す。静的メソッド`getTypeLabel(type)`（`REGISTRY_BY_TYPE`の表引き。未知なら`'図形'`。throwしない。`Object.prototype`のキー名は`Map`のため当たらない）を足す。`create`・`fromJSON`・`SHAPE_TYPES`・並びは変えない。
        *   `ItemAttributeRules.js`：責務＝アイテムの名前・表示・ロックの規則（名前の整え方・自動の名前の番号・不備の補い。状態なし・DOMなし）。`export`は`resolveItems(values, existingItems = [])`（2章要件4の手順1〜4をこの順で行う。最初に`toItems(values)`で写し、写しの上で名前を整えてから番号を数え、値を入れて返す）と`normalizeItemName(value)`（整えた名前、名前なしは空文字列）。非公開の定数：名前の上限100・フォルダの呼び名`'フォルダ'`・自動の名前の形の正規表現（呼び名を第1グループ、番号を第2グループに取り、改行を含む名前でも例外・誤一致を起こさないこと）。図形種別の分岐を持たず、呼び名は`ShapeFactory.getTypeLabel(item.shape.type)`から取る。
        *   `edit/CanvasLibrary`のキャンバス名の正規化（`#normalizeName`）とは別の規則であり、共通化しない（REQの範囲外。JSDocに一言書く）。
        *   テスト：種類ごとの呼び名（6種）・未知の種別、空の並びで1から・最大番号の次・欠番を埋めない、種別と食い違う名前（`path`の図形「直線 2」）が直線の番号に数えられること、`existingItems`の名前を避けること、名前のある要素（後ろにあるものも）と重ならないこと、前後に空白のある名前と名前なしが混ざる場合（`[{ name: ' パス 1 ' }, 名前なしのpath]`が`パス 1`・`パス 2`になる。順が逆の場合・フォルダの名前・入れ子の中・`existingItems`側の名前でも重ならない）、100文字で切って初めて自動の名前の形になる名前（例：`パス 1`の後に空白96個以上と文字が続くもの）と名前なしが混ざる場合、フォルダの自動の名前、自動の名前の形でないもの（「パス」「パス  3」「パス 03」「パス ３」「パス 0」）を数えないこと、非常に大きい番号で壊れないこと、名前が無い・数値・`null`・空・空白だけ・前後の空白・101文字以上・100文字目の前後の空白・サロゲートペア、`visible`・`locked`の不備（無い・文字列・数値）、2回通しても同じ、引数を書き換えない、入れ子。`ShapeFactory.test.js`に`getTypeLabel`を追記。
        *   共通の締め。
*   [x] タスク3: `VectorModel`が入れ子の並びを持つ
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` : 更新
        *   `./test/core/VectorModel.items.test.js` : 新規
    *   **作業内容** :
        *   フィールド`#shapes`をやめ`#items`（アイテムの入れ子の配列。初期値`[]`）にする。非公開getter`get #shapes()`＝`listShapes(this.#items)`を置き、**読む側の`this.#shapes`はそのまま使う**。書く側はすべて`#items`の入れ替えにする（`#shapes`への代入・`push`を残さない。getterへの`push`は黙って失われるため、`grep -n "#shapes.push\|this.#shapes = "`が0件であることを確かめる）。`updateShapeStyles`・`updateVertices`・`moveShapesBy`のループでは、ループの前に平らな配列を1回だけ取り出して使う（1件ごとに平らにし直さない）。
        *   公開の照会`getItems()`：`toItems(this.#items)`（入れ子まで新しいオブジェクト。図形インスタンスは共有）。
        *   `addShape(shape)`：`#items`の末尾へ`resolveItems([shape], this.#items)`を足す（既存のテストが使うため残す。採番しないことは今のまま）。
        *   `commitDraft`：採番の後、`resolveItems([this.#draftShape], this.#items)`を末尾に足す。
        *   `deleteShapes`：`filterShapes`で除く（フォルダの`id`が渡されても無視する）。
        *   `replaceAllShapes(values)`：`resolveItems(values)`で新しい入れ子を作り、`listItems`の前順で図形（`item.shape.id`）とフォルダ（`item.id`）の`id`を**合わせて**今の手順(2)〜(4)で正規化する（先に出現した方を保つ。振り直しは図形なら`shape-`、フォルダなら`group-`）。採番形式の正規表現は`shape-`・`group-`の両方に一致させ、連番の繰り上げに使う。戻り値は`id`を振り直した図形とフォルダの合計件数（入れ子が無ければ今と同じ）。残りの手順（選択等のクリア・通知1回）は今のまま。
        *   `addShapesWithNewIds(values)`：`toItems(values)` → `filterShapes`で重複インスタンスを除く（警告文・回数は今のまま）→ **図形が1つも残らなければ（フォルダだけの場合を含む）何も変えず空配列を返す** → `resolveItems(残り, this.#items)` → 前順に、図形は`item.shape.id`・フォルダは`item.id`を`#issueId`で発行して入れる → `#items`の末尾へ足す。戻り値・選択は図形の`id`だけ。
        *   `replaceShape`：`placeShapeItems`で対象のアイテムの`shape`だけを差し替え（`{ ...item, shape }`）、`filterShapes`で`removeIds`を除く（`s === shape`は残す＝今の条件と同じ）。
        *   `replaceShapesKeepingIds`：今の手順で作業用の平らな配列を作り、最後に`placeShapeItems`で各アイテムの`shape`だけを差し替える。
        *   `reorderShapes`：検査・「同じ並びなら何もしない」は今のまま。最後に、図形インスタンスから図形のアイテムを引き、`placeShapeItems`で新しい順に置き直す。
        *   `#issueId(prefix = ID_PREFIX)`：フォルダの接頭辞`group-`の定数を足す。カウンタは1つのまま。
        *   クラスの責務・各JSDocを実態に合わせる（「図形固有の頂点構造・作業データ形式を知らない」ことは変わらない）。
        *   テスト：`commitDraft`の名前（各ツールの種別・続けて引く線の`replaceDraft`→`commitDraft`。表示・ロックなし）、入れ子の`replaceAllShapes`→`getItems`・`getShapes`（描画順）、`getItems`を書き換えてもモデルが変わらない、図形とフォルダの`id`の重複・欠落・連番の繰り上げ（`group-9`を保持した後の採番）、削除（空のフォルダが残る・フォルダの`id`は無視）、`reorderShapes`（フォルダの位置・入れ子・空のフォルダが保たれ、図形が消えない・二重にならない・名前が図形について動く）、`replaceShape`（`keepId`の有無・`removeIds`が別のフォルダの中・結果が`targetId`の名前・表示・ロック・所属を持つ・種別が変わっても名前が変わらない）、`replaceShapesKeepingIds`、`addShapesWithNewIds`（入れ子ごと外側の末尾・新しい`id`・名前の引き継ぎ・素の図形は既存の名前と重ならない・フォルダだけなら何も変えず通知なし）、通知の回数。
        *   共通の締め。既存の`VectorModel.*.test.js`は書き換えずに合格すること。
*   [x] タスク4: 作業データの版4（`DocumentSerializer`・`FileContentReader`）
    *   **対象ファイル** :
        *   `./js/io/DocumentSerializer.js` : 更新
        *   `./js/io/FileContentReader.js` : 更新（失敗の結果オブジェクトに`items: []`を足し、JSDocを直すだけ）
        *   `./test/io/DocumentSerializer.items.test.js` : 新規
        *   `./test/io/FileContentReader.test.js` : 更新（追記のみ）
        *   `./test/io/DocumentSerializer.roundtrip.test.js`・`./test/io/DocumentSerializer.migration.test.js`・`./test/io/SpriteSerializer.test.js`・`./test/edit/TransformInputEditor.test.js`・`./test/edit/CanvasFileOperations.test.js` : 更新（2章「既存テストの書き換え」のタスク4の行だけ）
    *   **作業内容** :
        *   非公開の定数`GROUP_TYPE = 'group'`、`CURRENT_DOCUMENT_VERSION = 4`、`migrateVersion3To4`（2章要件2）、`MIGRATIONS`に`3`を足す。
        *   `serialize(values)`：`resolveItems(values)`の各アイテムを要素へ変換する（2章要件2のキー順。フォルダは再帰）。JSDocに「アイテムまたは素の図形インスタンスの配列。名前・表示・ロック・フォルダを保つには`model.getItems()`または`deserialize`の`items`を渡す」と書く。
        *   `deserialize`：`shapes`の配列を再帰で読む非公開メソッドを作る（`type`が`GROUP_TYPE`のプレーンオブジェクトはフォルダ。`children`が配列でなければ読み飛ばし。それ以外は今の`try`/`catch`で`ShapeFactory.fromJSON`）。読み飛ばしは非公開の1か所にまとめ、`{ index: path[0], path, type, reason }`と警告1回（2章要件6）。読めた要素に`resolveItems`を1回通して`items`とし、`shapes`は`listShapes(items)`。再帰の限界の例外は`#failure`にする。全体失敗の結果にも`items: []`を入れる。フォルダの`id`は検証せずそのまま持つ（`replaceAllShapes`が正規化する）。
        *   typedef`DocumentData`・`SkippedShape`（`path`を足す）・`DeserializeResult`（`items`を足す）と、責務・クラスのJSDoc（保存対象・現行版4・`MIGRATIONS`の登録）を直す。
        *   新規テスト：版1・2・3→4（名前・表示・ロックの補い、番号が描画順、版3の図形が持つ`name`等は使わない、版3の`type: 'group'`は1件の読み飛ばし）、版4の往復（空のフォルダ・多段・表示なし・ロックあり。オブジェクト層・文字列層。書き出し→読み込み→書き出しのJSONが一致）、キー順、知らないキー（最上位・図形・フォルダ）の無視、`name`・`visible`・`locked`の不備、`children`の不備（無い・`null`・オブジェクト）、入れ子の中の読み飛ばし（`index`・`path`・`type`・警告の回数、フォルダと他の図形が残る）、フォルダだけ・空のフォルダだけのデータ、名前のある要素と番号が重ならない、同じデータを2回読んで同じ名前、深い入れ子（例：200段の往復・極端に深いデータと循環参照で例外を投げず全体失敗）、引数を書き換えない、素の図形の`serialize`。
        *   `FileContentReader.test.js`へ追記：版4の`source`を持つJSの入れ子・名前が`items`で戻る、失敗時に`items`が`[]`。この時点の`SpriteSerializer.serialize`はまだアイテムを受けない（タスク5で対応）ため、テストデータは、素の図形の配列を`SpriteSerializer.serialize`へ渡して作ったスプライトデータの`source`を、`DocumentSerializer.serialize(アイテムの入れ子)`の戻り値に差し替えて組む（`{ ...spriteData, source }`）。
        *   共通の締め。
*   [x] タスク5: スプライトの書き出し（`SpriteSerializer`）
    *   **対象ファイル** :
        *   `./js/io/SpriteSerializer.js` : 更新
        *   `./test/io/SpriteSerializer.items.test.js` : 新規
    *   **作業内容** :
        *   `serialize(values)`：`elements`を`listShapes(toItems(values))`から作り、`source`は`DocumentSerializer.serialize(values)`。キー順・`bounds`の計算・`SPRITE_FORMAT_VERSION`は変えない。`computeShapesBounds`・`computeShapesGeometryBounds`は変えない。JSDocを直す。
        *   テスト：入れ子・表示なし・ロックあり・長い名前を含むアイテムの`elements`・`bounds`が、同じ図形を素の配列で渡したものと一致し、各図形の`toDrawElement()`の並び（平らにした重なり順）と一致する／`elements`に名前・表示・ロックのキーが出ない／`elements`・`bounds`の値を文字どおり書いた期待値（5種＋パス）と一致する（本作業の前の値の固定）／`formatVersion`が4／`source`が`DocumentSerializer.serialize(items)`と同じで、`deserialize`で入れ子が戻る／改行・`;`・引用符・`const spriteData = `を含む名前でも`CodeExporter.toModuleText` → `extractSpriteDataText` → `JSON.parse`で元に戻る。
        *   共通の締め。
*   [x] タスク6: 取り消し/やり直し・コピー/貼り付け/複製・追加（`SnapshotAdapter`・`ShapeInserter`・`ClipboardController`）
    *   **対象ファイル** :
        *   `./js/edit/SnapshotAdapter.js`・`./js/edit/ShapeInserter.js`・`./js/edit/ClipboardController.js` : 更新
        *   `./test/edit/SnapshotAdapter.items.test.js`・`./test/edit/ShapeInserter.items.test.js`・`./test/edit/ClipboardController.items.test.js` : 新規
    *   **作業内容** :
        *   `SnapshotAdapter`：`capture`は`serialize(this.#model.getItems())`、`restore`は`replaceAllShapes(result.items)`。条件・順序は変えない。
        *   `ShapeInserter`：`addShapesWithNewIds(result.items)`にする。図形0個の判定・`translate`は`result.shapes`のまま（`items`と同じインスタンス）。
        *   `ClipboardController`：`#serializeSelection`は`listShapeItems(this.#model.getItems())`のうち`isSelected(item.shape.id)`のものを平らに`serialize`する（選ばれていなければ`null`）。JSDocの「`getShapes`・`isSelected`のみ使用」を`getItems`に直し、依存の制約に「選んだ図形のアイテムを平らに写す（フォルダは写さない。名前・表示・ロックは元のまま）」を書く。
        *   テスト：取り消し/やり直しで入れ子・フォルダの`id`・名前・表示・ロックがJSONの一致で戻る（削除・重なり順・結合・追加）、閾値以内等で変化が無いときに記録されない（前後のJSONが一致）、まとめの鍵のふるまいが変わらない（`NudgeEditor`を使わず`commitEdit(鍵)`で確認）、`restore`は入れ子の中の1件の読み飛ばしでも適用しない、コピー→貼り付け・複製・`Alt`+ドラッグの複製・同じ位置に貼り付けの名前・表示・ロックが元と同じでフォルダの中の図形が外側の末尾に平らに入る、切り取り→貼り付け、インポート相当の`insertDocument`で入れ子ごと入り`id`が新しくなり名前の重複が許される、フォルダだけの作業データでは何も起きず記録されない、`insertDocument`の`dx`・`dy`が入れ子の中の図形にも効く。
        *   共通の締め。既存の`ClipboardController.test.js`は書き換えずに合格すること。
*   [x] タスク7: キャンバス管理・ファイル操作・`?dev`（`CanvasLibrary`・`CanvasFileOperations`・`main.js`）
    *   **対象ファイル** :
        *   `./js/edit/CanvasLibrary.js`・`./js/edit/CanvasFileOperations.js`・`./js/main.js` : 更新
        *   `./test/edit/CanvasFileOperations.test.js`・`./test/edit/CanvasFileOperations.export.test.js` : 更新（2章「既存テストの書き換え」のタスク7の行だけ）
        *   `./test/edit/CanvasFileOperations.items.test.js`・`./test/edit/CanvasLibrary.items.test.js` : 新規
    *   **作業内容** :
        *   `CanvasLibrary`：保存は`serialize(this.#model.getItems())`。`openCanvas`（467行）・`#openFirstLoadable`（1030行）は`result.items`を渡す。`createCanvasFromShapes`・`#settleAndEnter`・`#enterCanvas`・`#createAndEnter`の引数名を`items`にし（不透明に扱うことは同じ。**メソッド名は変えない**＝既存テスト・呼び出し元が使うため）、JSDoc（9・68・134・167〜176・228・493〜496・726・898・934・1046行付近）を直す。手順・順序・`issue`の扱いは変えない。
        *   `CanvasFileOperations`：出力2種は`getItems()`、`openFile`は`result.items`、`importFile`は`serialize(result.items)`。`#classifyRead`は変えない。JSDoc（`model`の型・「`getShapes`のみ使用」・判定の表に「フォルダだけのファイルは空と同じ」）を直す。
        *   `main.js`：`?dev`の`onExport`は`serializeToString(model.getItems())`、`onImport`は`replaceAllShapes(result.items)`（`restoredCount: result.shapes.length`は変えない。`reassignedCount`はフォルダも含む件数になる）。214行・954行の`getShapes()`は変えない。
        *   残りの確認：`js/`で`serialize(`・`serializeToString(`・`SpriteSerializer.serialize(`・`replaceAllShapes(`・`addShapesWithNewIds(`の呼び出し元（JSDocを除く）がすべてアイテムを渡していることを`grep`で確かめ、結果をレポートに書く。
        *   テスト：`CanvasFileOperations`＝出力（作業ファイル）→開く・インポートで入れ子・名前・表示・ロックが保たれる、出力（エンジン用）のJS→開く・インポートも同じ、フォルダだけのファイル（開く＝フォルダごと開く・通知なし／インポート＝`noShapes`）、`children`が不備のフォルダと入れ子の中の読めない図形で`partialRead`の件数、図形がすべて読めないフォルダで`readFailed`。実物の`VectorModel`・`ShapeInserter`・`HistoryManager`・`SnapshotAdapter`を組み合わせたインポートの取り消し。`CanvasLibrary`＝メモリ上の偽の保存先で、開く（ファイル）→編集→`flushPendingSave`→別のキャンバス→戻るで、記録の`document`と`getItems()`が保たれる。
        *   共通の締め。
*   [x] タスク8: 図形を作り直す操作での引き継ぎのテスト
    *   **対象ファイル** :
        *   `./test/edit/PathJoiner.items.test.js`・`./test/edit/EndpointSnapper.items.test.js`・`./test/edit/PathCornerEditor.items.test.js`・`./test/edit/TransformInputEditor.items.test.js`・`./test/edit/ShapeOrderEditor.items.test.js` : 新規（`js/`は変更しない）
    *   **作業内容** :
        *   実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`と各手順のクラスを組み合わせ、フォルダの中の図形（名前を変えた・`visible: false`・`locked: true`）に対して次を確かめる：結合（2本＝基準の線の名前等を引き継ぎ新しい`id`になる・閉じる＝元の`id`のまま・直線「直線 2」の結合がパスになっても名前が変わらない・除かれた側の名前が消える・除かれた側が別のフォルダにあっても壊れない）、端点の吸い付き（描き足し・閉じる・描いた線での2本の結合・端点のドラッグでの結合）、線を続けて引いて終えたとき・始点で閉じたときの新しい名前、角の切り替え・区間の切り替え、幅/高さ/角度の数値入力・反転、重なり順の4操作（平らな並びが指定どおり・フォルダが残る）。それぞれ取り消し/やり直しで作業データのJSONが一致する。記録は1件。
        *   `InputTracker`を通す拡大縮小・回転・移動のドラッグは、`VectorModel.replaceShapesKeepingIds`・`moveShapes`のテスト（タスク3）で担保し、画面の確認はテストプレイに任せる（`InputTracker`の自動テストは今も無い）。
        *   失敗が見つかった場合は`js/`を直さず、最終報告の「質問」で指示を求める。
        *   共通の締め。
*   [x] タスク9（固定）: 開発資料の反映その1（`PROJECT_ARCHITECTURE.md`）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
    *   **作業内容** :
        *   「開発資料の更新予定」の1章〜3章・4章の表を反映する。REQの固定タスクとして資料の書き換えが明示的に許されている（各実装タスクでは書き換えない）。
        *   書き換える前に行末を実測し（計画時 CR 820／LF 820）、行末（CRLF）を保つ。必要のない箇所は変えない。時点を書いた過去の記述（「その時点の作業データの版は2のまま」等）は変えない。
        *   反映の前に`grep`で「現行版は3」「今は3」「版は3」「`io/`のimport」「`replaceAllShapes(`」「`addShapesWithNewIds(`」「`getShapes()`」「図形の一覧」を洗い、漏れが無いか確かめる。実コードと照合して書く。
        *   作業レポートを書き、タスクを`[x]`にする。
*   [ ] タスク10（固定）: 開発資料の反映その2（`_doc/arch/`）
    *   **対象ファイル** :
        *   `./_doc/arch/02_main.md`・`03_VectorModel.md`・`10_ShapeFactory.md`・`14_edit.md`・`15_io.md`・`16_test.md` : 更新
        *   `./_doc/arch/46_ItemTreeRules.md`・`./_doc/arch/47_ItemAttributeRules.md` : 新規（LF。書き方は`41_NudgeTargetRules.md`等の規則の資料に合わせる）
        *   （タスクの実行中に「開発資料の更新予定」へ足されたファイルがあればそれも）
    *   **作業内容** :
        *   書き換える前に各ファイルの行末を実測し保つ（計画時：`10_ShapeFactory.md`はLF（0/9）、他の5つはCRLF＝`02` 84・`03` 16・`14` 118・`15` 37・`16` 237）。
        *   テストの件数は`node --test`の実測で書く。実コードと照合して書く。
        *   `node --test`の全件合格を確かめ、作業レポートを書き、タスクを`[x]`にする。

## 4. 詳細作業内容
※ タスク実行時にそれぞれ記入する。

### タスク1: 入れ子の計算の規則
*   **作業内容** :
    *   `js/core/ItemTreeRules.js`（新規・LF）に`ITEM_KIND`・`toItems`・`listItems`・`listShapeItems`・`listShapes`・`placeShapeItems`・`filterShapes`と typedef `ShapeItem`・`GroupItem`・`Item`を実装した。`test/core/ItemTreeRules.test.js`（新規）を追加した。`node --test`は2496件全件合格（2470 + 新規26）。
    *   `toItems`はアイテムを`{ ...item }`（フォルダは`children`を再帰）で写し、図形インスタンスは共有する。素の図形は`{ kind: 'shape', shape }`（name/visible/lockedのキー自体が無い）。
    *   `placeShapeItems`は置いた図形のアイテム自体（引数の`shapeItems`の要素）をそのまま入れ、フォルダだけ新しいオブジェクトにする。`filterShapes`は残す図形のアイテムを新しく写さず同じ参照で返す（フォルダは新しい）。

### タスク2: 種類の呼び名と、名前・表示・ロックの規則
*   **作業内容** :
    *   `js/core/ShapeFactory.js`（LF）：`SHAPE_REGISTRY`の各エントリに`label`（直線・曲線・弧・矩形・円・パス）、typedef・JSDoc、静的メソッド`getTypeLabel(type)`（未知は`'図形'`）を足した。`test/core/ShapeFactory.test.js`へ`getTypeLabel`のテスト2件を追記。
    *   `js/core/ItemAttributeRules.js`（新規・LF）：`resolveItems(values, existingItems = [])`・`normalizeItemName(value)`を実装。自動の名前の形の正規表現は`/^(.*[^\s]) ([1-9][0-9]*)$/`（改行を含む名前・呼び名の末尾が空白の名前には一致しない）。番号は`Number.isSafeInteger(番号 + 1)`で安全なものだけ数える。`test/core/ItemAttributeRules.test.js`（新規）を追加。
    *   `node --test`は2527件全件合格（2496 + 31）。

### タスク3: `VectorModel`が入れ子の並びを持つ
*   **作業内容** :
    *   `js/core/VectorModel.js`（LFのまま）：フィールド`#shapes`を`#items`に替え、非公開getter`get #shapes()`（`listShapes(this.#items)`）を置いた。書く側はすべて`#items`の入れ替え（`grep "#shapes.push\|this.#shapes = "`は0件）。`updateShapeStyles`・`updateVertices`・`moveShapesBy`はループ前に平らな配列を1回取り出す。公開の照会`getItems()`を追加。`addShape`・`commitDraft`は`resolveItems([..], this.#items)`の結果を末尾に足す。`deleteShapes`・`replaceAllShapes`（図形とフォルダのidを合わせて正規化・戻り値は合計件数）・`addShapesWithNewIds`（図形が残らなければ何も変えず空配列）・`replaceShape`・`replaceShapesKeepingIds`・`reorderShapes`を2章・3章どおりにした。`#issueId(prefix = ID_PREFIX)`と`GROUP_ID_PREFIX = 'group-'`を足し、`ID_PATTERN`を`shape-`・`group-`の両方に一致させた。責務・JSDocを実態に合わせた。
    *   `test/core/VectorModel.items.test.js`（新規・LF）22件を追加。既存の`VectorModel.*.test.js`は書き換えずに合格。`node --test`は2549件全件合格（2527 + 22）。
    *   `reorderShapes`は平らな配列を最初に1回だけ取り出し、長さの検査・Mapの作成・比較に使う（1件ごとに平らにし直す2乗の計算を避けた。ふるまい・警告文・戻り値は変えていない）。

### タスク4: 作業データの版4
*   **作業内容** :
    *   `js/io/DocumentSerializer.js`（LF）：`GROUP_TYPE`・`CURRENT_DOCUMENT_VERSION = 4`・`migrateVersion3To4`・`MIGRATIONS[3]`を足した。`serialize`は`resolveItems(values)`の結果を要素へ変換（非公開`#itemToElement`。図形＝`{...toJSON(), name, visible, locked}`、フォルダ＝`{type:'group', id, name, visible, locked, children}`）。`deserialize`は非公開`#readElements`（再帰）で読み、読み飛ばしは非公開`#recordSkip`の1か所（`{ index: path[0], path, type, reason }`・警告1回、文面は`図形 #1/2（type）…`）。読めた要素に`resolveItems`を1回通して`items`、`shapes = listShapes(items)`。`RangeError`は`#readElements`内の図形単位の`catch`では再送出し（変えない）、`deserialize`の外側の`catch`（`#readElements`・`resolveItems`・`listShapes`を1つの`try`に含む）で例外の種類によらず`#failure`にする（`RangeError`は「入れ子が深すぎて読み込めません: …」、それ以外は「図形を読み込めません: …」。`throw`は残さない）。`#failure`の結果に`items: []`。typedef・責務・JSDocを更新。
    *   `js/io/FileContentReader.js`（CRLF保持）：失敗の結果に`items: []`、JSDocのみ。
    *   既存テストの書き換えは2章の表のタスク4の行だけ（roundtrip・migration・SpriteSerializer・TransformInputEditor・CanvasFileOperations）。新規`test/io/DocumentSerializer.items.test.js`、`test/io/FileContentReader.test.js`へ3件追記。`node --test`は2578件全件合格（2549 + 29）。
    *   行末：`DocumentSerializer.js`・roundtrip・新規テストはLF、`FileContentReader.js`・`CanvasFileOperations.test.js`・`TransformInputEditor.test.js`はCRLFのまま。

### タスク5: スプライトの書き出し
*   **作業内容** :
    *   `js/io/SpriteSerializer.js`（CRLF保持）：`serialize(values)`が`elements`を`listShapes(toItems(values))`から作り、`source`を`DocumentSerializer.serialize(values)`にした（`ItemTreeRules`をimport追加）。キー順・`bounds`・`SPRITE_FORMAT_VERSION`・`computeShapesBounds`・`computeShapesGeometryBounds`は変更なし。JSDocを直した。
    *   新規`test/io/SpriteSerializer.items.test.js`（LF）9件。`elements`・`bounds`の期待値は、変更前のコードで実測した値を文字どおり固定した。`node --test`は2587件全件合格（2578 + 9）。

### タスク6: 取り消し/やり直し・コピー/貼り付け/複製・追加
*   **作業内容** :
    *   `js/edit/SnapshotAdapter.js`（CRLF保持）：`capture`は`serialize(getItems())`、`restore`は`replaceAllShapes(result.items)`。JSDocを直した。
    *   `js/edit/ShapeInserter.js`（CRLF保持）：`addShapesWithNewIds(result.items)`。図形0個の判定・`translate`は`result.shapes`のまま。JSDocを直した。
    *   `js/edit/ClipboardController.js`（CRLF保持）：`ItemTreeRules.listShapeItems`をimportし、`#serializeSelection`は選択された図形のアイテムを平らに`serialize`。JSDoc（`getItems`・`isSelected`のみ使用、依存の制約）を直した。
    *   新規テスト（LF）：`test/edit/SnapshotAdapter.items.test.js`・`ShapeInserter.items.test.js`・`ClipboardController.items.test.js`（計24件）。既存テストは書き換えていない。`node --test`は2611件全件合格（2587 + 24）。

### タスク7: キャンバス管理・ファイル操作・`?dev`
*   **作業内容** :
    *   `js/edit/CanvasLibrary.js`（CRLF保持）：保存は`serialize(getItems())`、`openCanvas`・`#openFirstLoadable`は`result.items`を渡す。`createCanvasFromShapes`・`#settleAndEnter`・`#enterCanvas`・`#createAndEnter`の引数名を`items`にした（メソッド名は変えず）。JSDocを直した。
    *   `js/edit/CanvasFileOperations.js`（CRLF保持）：出力2種は`getItems()`、`openFile`は`result.items`、`importFile`は`serialize(result.items)`。`#classifyRead`は変えず。JSDoc（`model`の型・`getItems`のみ使用・判定の表に「フォルダだけのファイルも空と同じ」）を直した。
    *   `js/main.js`（CRLF保持）：`?dev`の`onExport`は`serializeToString(model.getItems())`、`onImport`は`replaceAllShapes(result.items)`（`restoredCount: result.shapes.length`はそのまま）。214行・954行の`getShapes()`は変えず。
    *   既存テストの書き換えは2章の表のタスク7の行だけ（`CanvasFileOperations.test.js`の偽物＝`createCanvasFromShapes`の記録を`listShapes(items)`・`getItems: () => []`、`CanvasFileOperations.export.test.js`の偽物＝`getItems: () => toItems(shapes)`。いずれもCRLF保持）。新規`test/edit/CanvasFileOperations.items.test.js`（8件）・`test/edit/CanvasLibrary.items.test.js`（3件）（LF）。`node --test`は2622件全件合格（2611 + 11）。
    *   `grep`の確認（JSDoc・コメントを除く`js/`の呼び出し元）：`DocumentSerializer.serializeToString/serialize`・`SpriteSerializer.serialize`・`replaceAllShapes`・`addShapesWithNewIds`の呼び出し元は、`CanvasFileOperations`（`getItems()`・`result.items`）、`CanvasLibrary`（`getItems()`・`items`＝`result.items`または呼び出し元からのアイテム）、`ClipboardController`（選択図形のアイテム）、`SnapshotAdapter`（`getItems()`・`result.items`）、`ShapeInserter`（`result.items`）、`main.js`（`getItems()`・`result.items`）のすべてがアイテムを渡している。`getShapes()`を渡す箇所は無い。

### タスク8: 図形を作り直す操作での引き継ぎのテスト
*   **作業内容** :
    *   `js/`は変更せず、新規テスト5ファイル（LF・計28件）を追加した。いずれも実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`と各手順のクラスを組み合わせ、フォルダの中の図形（名前あり・`visible: false`・`locked: true`）で、操作後のid・名前・表示・ロック・フォルダの入れ子（`outline`）と、取り消し/やり直しでの作業データJSONの一致、記録が1件（取り消し後に`canUndo()`が偽）を確かめる。
    *   `test/edit/PathJoiner.items.test.js`（5件）：2本の結合（奥の線の名前等を引き継ぎ新しいid・除かれた側の名前が消える）、閉じる（元のid）、「直線 2」の結合がパスになっても名前が変わらない、選択の順に依らず奥が基準、除かれた側が別のフォルダ（空のフォルダが残る）。
    *   `test/edit/EndpointSnapper.items.test.js`（9件）：描き足し・描き始めが端点の描き足し・閉じる・描いた線での2本の結合・端点のドラッグでの結合と閉じる、線を続けて引いて終える（点2つ＝「直線 4」、点4つ＝「パス 6」）・始点で閉じる（「パス 3」。いずれもフォルダの中の名前も数え、新しい図形は最外の末尾・表示・ロックなし）。
    *   `test/edit/PathCornerEditor.items.test.js`（4件）：角の切り替え、区間の切り替え（曲線に・直線に・別のフォルダの2つを同時に）。
    *   `test/edit/TransformInputEditor.items.test.js`（5件）：幅・高さ・角度の数値入力、反転（横・縦。フォルダの中と外の図形を同時に）。
    *   `test/edit/ShapeOrderEditor.items.test.js`（5件）：4操作で平らな並びが指定どおり・入れ子の骨組み（フォルダの位置・id・名前等）が不変・名前等が図形について動く、フォルダの中の図形を最前面へ送っても各フォルダが残り所属は位置のものになる。
    *   `InputTracker`を通すドラッグは本タスクでは試験せず（タスク3の`VectorModel`のテストで担保）。失敗は無く、`js/`は直していない。`node --test`は2650件全件合格（2622 + 28）。

### タスク9: 開発資料の反映その1
*   **作業内容** :
    *   `PROJECT_ARCHITECTURE.md`のみ更新（行末CRLF保持：CR 820／LF 820 → CR 849／LF 849）。反映前に「現行版は3」「今は3」「版は3」「`io/`のimport」「`replaceAllShapes(`」「`addShapesWithNewIds(`」「`getShapes()`」「図形の一覧」を洗い、実コード（`DocumentSerializer`・`ItemTreeRules`・`ItemAttributeRules`・`ShapeFactory`・各importとテストファイル名）と照合した。
    *   1章：構成図（`core/`に`ItemTreeRules.js`・`ItemAttributeRules.js`、`test/`に新しいテスト25ファイル）、「存在しないもの」（名前・表示・ロック・フォルダはデータだけで画面・効果なし、折りたたみ等が無いこと）、フォルダ分割の方針（`core/`の2規則の説明、`edit/`から使う規則に`ItemTreeRules`）、依存方向（`io/`のimport、例外(3)に`ClipboardController → core/ItemTreeRules`・「この7ファイル」、規則どうしのimportの例外）。
    *   2章：アイテム（形・`#items`・`getItems`・素の図形も受ける入口・名前の規則・表示/ロック・フォルダ・`id`）、`Ellipse`項の版、「今は3」3か所を「今は4」（「その時点は2のまま」は変更せず）、`fromJSON`直後の`id`にフォルダ、作業データ形式（版4の要素の形・保存対象・現行版4・版3→4の移行・版4の読み方・読み飛ばしの`index`/`path`・入れ子の失敗・古いエディタで断られること）、スプライトの`source`（版4）・描画順・版の履歴。
    *   3章：5.（変換・`?dev`の復元＝`result.items`）、6.（スナップショット・`addShapesWithNewIds(result.items)`・`replaceAllShapes(result.items)`）、7.（選んだ図形のアイテムを平らに写す・名前は元のまま）、8.（保存・切り替えの`replaceAllShapes`）、9.（`getItems()`・`result.items`・「アイテムを渡すこと」・フォルダだけのファイル）、11.（結合は基準の線Aの位置の名前等を引き継ぐ）、14.（正本は入れ子・`reorderShapes`・「図形データの形・版も変えない」は「この時点」と明記）、26.（現行版の記述を「この時点は3・今は4」へ）、4章の表に46・47の2行。`_doc/arch/46_…`・`47_…`のファイル自体はタスク10で作る。
    *   変更しなかったもの：714行目ほか「時点」を書いた記述（「その時点の版は2のまま」・「作業データ形式（版3）」＝Phase 10-03の時点の記述）、3章27.・1章の他の「Phase 10-xx」の記述。

### タスク10: 開発資料の反映その2
*   **作業内容** :
    *   （未実施）

## 5. 懸念事項・要確認ポイント
* **曲線のツールで点を2つだけ打って終えた線は「直線 n」になる**：REQは「曲線のツールで描いた図形は、データ上`path`のため『パス n』」としているが、今のコードは、続けて引く線を点2つで終えると区間の種類によらず直線（`type: 'line'`）を作る（`PathJoinRules.buildLineOrPath`）。名前は図形データの`type`で決まるため「直線 n」になる。同じ理由で、直線のツールで点を3つ以上打った線は「パス n」。ふるまいは変えず、この計画のまま進める。
* **名前の無いファイルをインポートしたときの番号**：要件4の「名前の無いデータを読んだとき」のとおりファイルの中だけで番号を決めるため、キャンバスに「パス 1」があっても、読んだ図形にも「パス 1」が付くことがある（重複は許す。「ファイルの中の名前のまま」の規則とそろう）。
* **既存テストの偽物への追加**：`CanvasFileOperations`の2つのテストは`model`・`canvasLibrary`の偽物を使うため、`getItems`の追加と、渡されたアイテムを図形に直して記録する書き換えが要る（確かめる値は変えない。2章の表）。版の数字・項目の追加そのものではないが、入れ子の照会を使うことに伴う最小限として計画した。
* **入口が素の図形インスタンスも受けること**：製品コードで誤って`getShapes()`を`serialize`等へ渡すと、例外なく名前が振り直され、フォルダが失われる。タスク7の`grep`の確認と各経路のテストで防ぐ。
* **`?dev`の確認用ウィンドウの表示**：`palette/`を変えないため、読み飛ばしの表示`#n`は最上位の位置だけで、入れ子の中の位置（`path`）は出ない。「振り直したid」の件数にはフォルダも入る。
* **極端に深い入れ子**：読み込みは例外を投げず全体失敗になるが、読み込みの限界のすぐ手前の深さ（数千段）では、履歴の`JSON.stringify`・凍結（再帰。変更しない）が限界に達し得る。画面からフォルダは作れず、現実のデータでは起きない。
* **キャンバスの記録**：版3の記録は、開いただけでは書き換わらない（自動保存は編集操作だけ）。編集して保存されると版4になり、本作業の前のエディタでは開けなくなる（許容。REQ要件2）。念のため、確認の前に作業データファイルを残しておくこと（下の0.）。

* **タスク3の実装メモ**：`#shapes`は毎回`listShapes`で平らにするため、`getSelectedIds`・`setSelection`等の読み取りは呼ぶたびに全図形を走査する（図形数が多いと計算量は増えるが状態の食い違いは起きない）。`replaceShape`の`removeIds`は図形のアイテムだけを除き、フォルダは空でも残す。`addShapesWithNewIds`はフォルダのidも`group-<連番>`で新しく発行する。

* **タスク5の実装メモ**：`computeShapesBounds`・`computeShapesGeometryBounds`は図形の配列のまま（アイテムは受けない。変更指示なし）。`SpriteSerializer`の責務文は変更していない。

* **タスク4の実装メモ**：フォルダの読み飛ばしの`reason`は`フォルダのchildrenが配列ではありません`。版3以前のフォルダ要素は`children: null`を入れるため、同じ文面になる。`RangeError`は`ShapeFactory.fromJSON`が投げた場合も全体失敗になる（図形の不備は通常`Error`）。再帰の限界はブラウザで`RangeError`とは限らない（Firefoxは`InternalError`）ため、外側の`catch`は種類で分けず全体失敗にする。`SpriteSerializer.serialize`は未対応のため、アイテムを渡すスプライトの書き出しはタスク5まで未対応（`FileContentReader`のテストは`source`を差し替えて組んだ）。

### テストプレイの確認項目（発注者がブラウザで確かめる手順）
0. **準備**：本作業の前に保存した、いつもの絵の作業データファイル（`.ozve.json`）と書き出したJSを1つずつ用意する。画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。
    * 注意：以後に編集した絵は新しい版（版4）で保存され、本作業の前のエディタでは開けない。用意した2つのファイルは上書きせずに残しておく。
1. **これまでの絵**：ブラウザ内に保存されている絵・準備した作業データファイル・書き出したJSが、今までどおりの見た目で開ける（ファイルはキャンバスパレットの「開く」から）。
2. **いつもの操作**：描く・選ぶ・動かす・拡大縮小・回転・反転・頂点を動かす・角の切り替え・区間の切り替え・線の結合・端点からの描き足し・色の変更・重なり順・整列・コピー＆ペースト・複製・`Alt`＋ドラッグの複製が、今までどおりできる。
3. **取り消し/やり直し**：2.の操作を続けて行い、取り消しを最後まで戻し、やり直しを最後まで進めると、形・並びが今までどおり戻る。
    * 注意：取り消せるのは今までどおり最大100件で、それより前の操作へは戻らない。キャンバスの切り替え・ページの開き直しで履歴は消える。
4. **キャンバスの切り替えと保存**：別のキャンバスへ切り替えて戻る・ページを開き直すと、絵がそのまま残っている。
5. **ファイル**：「出力（作業ファイル）」→「開く」、「インポート」、「出力（エンジン用）」で書き出したJSを「開く」、ができる。書き出したJSを確認用ページ（`sprite-check.html`）で開くと、今までどおり描かれる。
6. **名前のデータ（任意）**：新しく描いた図形を含む絵を「出力（作業ファイル）」で出し、テキストエディタで開くと、`"version": 4`と、各図形の`"name"`（「パス 1」など）・`"visible": true`・`"locked": false`が入っている。複製した図形は元と同じ名前になっている。
    * 注意：名前の種類はデータ上の種類で決まる。直線のツールで点を3つ以上打った線は「パス n」、曲線のツールで点を2つだけ打って終えた線は「直線 n」になる（懸念事項の1つ目）。準備した古いファイルを開いて出力すると、奥の図形から順に種類ごとの番号が付く。

* **タスク8の実装メモ**：端点のドラッグでの結合は、奥の線（先頭の図形）の名前・表示・ロックを引き継ぎ新しいidになる（`planEndpointDragJoin`の対象が奥側）ことを実測して固定した。区間の切り替えを別々の図形の点にまたがって行うには、各図形で2点以上選ぶ必要がある（1点だけだと切り替え対象にならない場合がある）。テストの補助関数（`setupReal`・`outline`等）は、`test/`に共有の補助ファイルを置かない決まりのため、各ファイルに重複して持つ。

* **タスク7の実装メモ**：`CanvasFileOperations`の`downloadText`の引数順は`(text, name)`、`downloadSpriteModule`は`(text, name)`（新規テストの偽物はこれに合わせた）。`CanvasLibrary.items.test.js`は`flushPendingSave`で保留を確定してから終えるため、タイマーは残らない。

* **タスク9の実装メモ**：版3→4の移行の「版を上げた理由」は、RESの要件2に理由の記述が無かったため、実コードの動き（古いエディタは`type: 'group'`を未知の図形種別として読み飛ばし、フォルダの中の図形ごと失う）から書いた。表現が発注者の意図と合うか、目視で確認してほしい。1章構成図のテストの一覧は既存の並びに合わせて新規テストを近い名前の隣へ足した（一覧は元から網羅ではない）。`_doc/arch/46_ItemTreeRules.md`・`47_ItemAttributeRules.md`は4章の表に先に行を足しただけで、実体はタスク10で作る（それまで表のパスは存在しない）。将来この資料を直すときは、2章の「アイテム」の項と3章9.の「アイテムを渡すこと」を正とし、`getShapes()`を`serialize`系へ渡す記述を足さないこと。
