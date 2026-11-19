# PROJECT_ARCHITECTURE.md
## OZ Vector Editor 全体仕様および実装定義書

**読者**：このリポジトリのコードを読めるAI。

**記載基準**
*   第一の目的はハルシネーションの防止、第二がコンテキストの削減。第二のために第一を犠牲にしない。
*   残す：責務と「何を知らないか」という境界、依存方向、複数モジュールにまたがる流れと順序の保証、誰が呼ぶか・誰が注入するか、保存形式、設計判断の理由、やらないと決めたこと、未実装のもの、呼んではいけない経路、公開メソッド名の一覧。
*   書かない：1つのファイルのJSDocを読めば分かること（引数と戻り値、private項目、typedefの中身、定数の値、1クラス内の処理順）。
*   JSDocが実コードと食い違う項目を見つけたら、JSDocが直るまで正しい記述をここに残す。
*   消すか迷ったら残す。誤った記述は長さに関係なく直すか消す。

---

### 1. プロジェクトフォルダ構造
新規にファイルを作成、あるいはログを記録する際、必ずこの構造に準拠すること。各ファイルの責務は4章を正とする。

```text
/oz-vector-editor/
├── index.html                  # スタイルはCSSファイル分割せず<style>タグに内包。フロートウィンドウも静的に置く（ツールパレットにはスポイトのボタン`#tool-eyedropper`（💉。仮）を含む。選択のボタン`#tool-select`と頂点の選択のボタン`#tool-vertex`の中身はJSが描く`<canvas>`）。上端にツールバー（左に操作のボタン、続けてオプションバー）・その下（横）と左端（縦）に定規（固定）・下端にステータスバー（固定。右側に表示の切り替え・スナップのまとまり（`#unit-snap-group`。ON/OFFのボタン🧲（仮）と単位のボタン）・表示倍率のまとまりが並ぶ。ツールバー・定規・ステータスバーはフロートウィンドウではない）。キャンバスの領域の寸法は<style>の:rootのカスタムプロパティが唯一の定義箇所
├── sprite-check.html           # 確認用ページ。index.htmlとは別に開く。スタイルは<style>に内包
├── js/
│   ├── main.js
│   ├── core/
│   │   ├── VectorModel.js
│   │   ├── CanvasManager.js
│   │   ├── ViewTransform.js
│   │   ├── InputTracker.js
│   │   ├── InputModes.js       # 入力の状態（InputState）と操作モード（OperationMode）の値の定義（状態なし・importなし）。InputTracker・KeyboardShortcuts・ToolRules・CursorShapeRules・VertexHandleRules・NudgeTargetRules・wiring/ToolIconWiring・main.jsから使う
│   │   ├── FocusKeyYieldRules.js # フォーカスしている要素がキー（Space・ショートカット）を部品に譲るべきかの規則（状態なし。DOMの型は関数の中でだけ参照）。InputTracker・KeyboardShortcuts・AltKeyGuardから使う
│   │   ├── PressActionRules.js # 選択モード・頂点の選択モードでマウスを押したときに何を始めるかの判定表（状態なし）。InputTrackerから使う
│   │   ├── CursorShapeRules.js # キャンバスのカーソルの形の規則（状態なし）。InputTrackerから使う
│   │   ├── PointHitRules.js    # 当たり分類の規則（状態なし）。InputTrackerから使う
│   │   ├── SelectionRules.js   # 図形と頂点の両方のクリック・範囲選択の次の選択の規則と、図形の選択の反転の規則（選択の反転は図形のみ。状態なし）。InputTracker・main.jsから使う
│   │   ├── MoveDirectionRules.js # 移動方向（横・縦・斜め45°）の限定の規則（状態なし）。InputTrackerから使う
│   │   ├── UnitSnapRules.js    # スナップ（座標・移動量を単位の倍数へ丸めること。端点への吸い付きとは別）の規則（状態なし）。InputTracker・wiring/DisplayWiringから使う
│   │   ├── UnitSnapSettings.js # スナップの設定（ON/OFF・単位）の持ち主。保存しない・履歴の対象外
│   │   ├── AltKeyGuard.js      # Altキーの単独押下・単独解放の抑止（DOMの購読。状態なし）
│   │   ├── ToolRules.js        # ツールの一覧と押し込みにするツールの規則（状態なし）。main.jsから使う
│   │   ├── SpriteFitRules.js   # スプライトの外枠を描画先の余白の内側へ収める倍率と平行移動の規則（状態なし・importなし）。wiring/ToolIconWiringから使う
│   │   ├── VertexHandleRules.js # 頂点の選択モードで描く頂点のハンドルの一覧・ハンドル名が頂点のハンドルかの規則・矩形に入る頂点を集める規則・選んでいる頂点の範囲を求める規則（状態なし）。InputTracker・main.js・edit/PositionInputEditorから使う
│   │   ├── NudgeTargetRules.js # 矢印キーの微調整で動かす対象を決める規則とまとめの鍵の組み立て（状態なし。importは`InputModes`のみ）。`edit/NudgeEditor`・`edit/PositionInputEditor`から使う
│   │   ├── DisplayState.js     # 表示の状態（アウトライン・背景の白/黒・グリッド・フロートウィンドウの表示）の持ち主。表示専用
│   │   ├── GridSpacingRules.js # グリッドの間隔の規則（状態なし）。CanvasManager・RulerRenderer・wiring/DisplayWiringから使う
│   │   ├── RulerTickRules.js   # 定規の目盛りの規則（状態なし）。RulerRendererから使う
│   │   ├── RulerRenderer.js    # 定規のレンダラー
│   │   ├── CanvasCursorTracker.js # キャンバス上のカーソル位置
│   │   ├── ViewFitRules.js     # 全体を画面に収める計算（状態なし）。wiring/DisplayWiringから使う
│   │   ├── StatusReadoutRules.js # ステータスバーの表示の文字列の規則と数字の形（小数第1位）の規則（状態なし）。wiring/DisplayWiring・edit/PositionInputRulesから使う
│   │   ├── KeyboardShortcuts.js
│   │   ├── DragTracker.js
│   │   ├── HistoryManager.js
│   │   ├── ShapeFactory.js
│   │   └── WindowManager.js
│   ├── shapes/
│   │   ├── Line.js
│   │   ├── Curve.js
│   │   ├── Rect.js
│   │   ├── Ellipse.js
│   │   ├── Path.js             # 図形クラスは種別ごとに1ファイル
│   │   ├── ShapeGeometry.js    # 以下2つは図形クラスではない。図形クラスだけが使う共通の関数
│   │   ├── ShapeDataValidation.js
│   │   ├── PathJoinRules.js    # 図形クラスではない。図形をまたぐ規則（結合と、直線・曲線のツールで続けて引く線の点の並び）。shapes/の外から使う
│   │   └── EndpointSnapRules.js # 図形クラスではない。図形をまたぐ規則（端点への吸い付き）。shapes/の外から使う
│   ├── palette/
│   │   ├── ToolPalette.js
│   │   ├── DevPanel.js
│   │   ├── CanvasPalette.js
│   │   ├── OptionBarStyleGroup.js # ツールバーのオプションバーの「スタイル」のまとまり。まとまりごとに1ファイル
│   │   ├── OptionBarOrderGroup.js # オプションバーの「重なり順」のまとまり
│   │   ├── OptionBarPositionGroup.js # オプションバーの「位置」のまとまり（X・Yの数値の欄）
│   │   ├── OptionBarAlignGroup.js # オプションバーの「整列・分布」のまとまり（8つのボタン。押せる・押せないの表示と押されたときの操作の通知のみ）
│   │   ├── ViewToggleGroup.js  # ステータスバーの表示の切り替えのまとまり
│   │   ├── UnitSnapGroup.js    # ステータスバーのスナップのまとまり（ON/OFFのボタンと単位のボタン）
│   │   └── PaletteLauncher.js  # 自己完結するUI部品をここに追加する
│   ├── wiring/
│   │   ├── DisplayWiring.js    # main.jsから切り出した表示の配線（ステータスバーの座標・大きさ・グリッドの表示、表示の切り替え・スナップのまとまり・🧰・⛶の購読と同期）。main.jsだけが使う
│   │   └── ToolIconWiring.js   # ツールパレットの選択・頂点の選択のボタンへ、スプライトJSを描いた<canvas>を入れる配線（起動時に1回）。main.jsだけが使う
│   ├── edit/
│   │   ├── ShapeInserter.js
│   │   ├── PathJoiner.js
│   │   ├── EndpointSnapper.js
│   │   ├── ClipboardController.js
│   │   ├── StylePanelRules.js
│   │   ├── ShapeStyleEditor.js
│   │   ├── StyleEyedropper.js  # スポイトの待ち受けの状態と、手本の図形からの取り込みの手順
│   │   ├── ShapeOrderRules.js
│   │   ├── ShapeOrderEditor.js
│   │   ├── NudgeEditor.js      # 矢印キーでの微調整と位置の数値入力の両方が使う、選択中の図形・頂点を指定量だけ動かす1件の編集操作の手順
│   │   ├── PositionInputRules.js # オプションバーの位置の欄（X・Y）に出す内容と、入力値から動かす量を求める規則（状態なし。importは`core/StatusReadoutRules`のみ）。`PositionInputEditor`から使う
│   │   ├── PositionInputEditor.js # 位置の数値入力（選択中の図形・頂点を欄の値の位置へ動かす1件の編集操作）の手順。移動と記録は`NudgeEditor`へ任せる
│   │   ├── ShapeAlignRules.js  # 整列・分布の操作の値（8操作）と、操作ごとの図形ごとの移動量・押せるかの規則（状態なし・importなし）。`ShapeAlignEditor`から使う
│   │   ├── ShapeAlignEditor.js # 整列・分布（選んでいる図形の外枠をそろえる）の1件の編集操作の手順と8操作の可否の照会。移動と記録は`VectorModel.moveShapesBy`と`HistoryManager`の`beginEdit`／`commitEdit`の対で行う
│   │   ├── ShapeExtentReader.js # 選択中の図形・全図形の外枠の照会（選択中の図形1つずつの外枠も）
│   │   ├── SnapshotAdapter.js
│   │   ├── CanvasLibrary.js
│   │   └── CanvasFileOperations.js
│   ├── io/
│   │   ├── DocumentSerializer.js
│   │   ├── CanvasStorage.js
│   │   ├── DocumentFileIO.js
│   │   ├── SpriteSerializer.js
│   │   ├── CodeExporter.js
│   │   └── FileContentReader.js
│   └── check/
│       ├── SpriteCheckPage.js
│       ├── SpriteCheckCanvas.js
│       └── SpriteCheckInspector.js
├── asset/
│   └── sprite/                 # ツールのアイコンの仮のスプライトJS（select-arrow.js・vertex-arrow.js）。本アプリの書き出し（CodeExporter）が作った生成物で、手で書き換えない。何もimportしない。wiring/ToolIconWiringだけが使う
├── test/                       # 自動テスト（node --test でのみ実行。index.html・js/からは参照しない）。中はjs/の構成に合わせる
│   ├── core/
│   │   ├── CursorShapeRules.test.js
│   │   ├── DisplayState.test.js
│   │   ├── GridSpacingRules.test.js
│   │   ├── HistoryManager.test.js
│   │   ├── KeyboardShortcuts.test.js
│   │   ├── MoveDirectionRules.test.js
│   │   ├── NudgeTargetRules.test.js
│   │   ├── PointHitRules.test.js
│   │   ├── PressActionRules.test.js
│   │   ├── RulerTickRules.test.js
│   │   ├── SelectionRules.test.js
│   │   ├── ShapeFactory.test.js
│   │   ├── SpriteFitRules.test.js
│   │   ├── StatusReadoutRules.test.js
│   │   ├── ToolRules.test.js
│   │   ├── UnitSnapRules.test.js
│   │   ├── UnitSnapSettings.test.js
│   │   ├── VectorModel.reorderShapes.test.js
│   │   ├── VectorModel.replaceDraft.test.js
│   │   ├── VectorModel.replaceShape.test.js
│   │   ├── VectorModel.selectedVertices.test.js
│   │   ├── VectorModel.snapPoint.test.js
│   │   ├── VectorModel.style.test.js
│   │   ├── VectorModel.moveShapesBy.test.js
│   │   ├── VectorModel.updateVertices.test.js
│   │   ├── VertexHandleRules.test.js
│   │   ├── ViewFitRules.test.js
│   │   └── ViewTransform.setView.test.js
│   ├── shapes/
│   │   ├── Line.test.js
│   │   ├── Curve.test.js
│   │   ├── Rect.test.js
│   │   ├── Ellipse.test.js
│   │   ├── Path.test.js
│   │   ├── PathJoinRules.test.js
│   │   ├── ShapeGeometry.test.js
│   │   └── EndpointSnapRules.test.js
│   ├── io/
│   │   ├── DocumentSerializer.roundtrip.test.js
│   │   ├── DocumentSerializer.errors.test.js
│   │   ├── DocumentSerializer.migration.test.js
│   │   ├── SpriteSerializer.test.js
│   │   ├── CodeExporter.test.js
│   │   ├── CodeExporter.assembly.test.js
│   │   ├── FileContentReader.test.js
│   │   └── DocumentFileIO.test.js
│   ├── edit/
│   │   ├── CanvasFileOperations.test.js
│   │   ├── CanvasFileOperations.export.test.js
│   │   ├── ClipboardController.test.js
│   │   ├── PathJoiner.test.js
│   │   ├── EndpointSnapper.test.js
│   │   ├── NudgeEditor.test.js
│   │   ├── PositionInputRules.test.js
│   │   ├── PositionInputEditor.test.js
│   │   ├── StylePanelRules.test.js
│   │   ├── ShapeStyleEditor.test.js
│   │   ├── StyleEyedropper.test.js
│   │   ├── ShapeOrderRules.test.js
│   │   ├── ShapeOrderEditor.test.js
│   │   ├── ShapeAlignRules.test.js
│   │   ├── ShapeAlignEditor.test.js
│   │   └── ShapeExtentReader.test.js
│   └── check/
│       └── SpriteCheckInspector.test.js
│
├── PROJECT_CONSTITUTION.md
├── PROJECT_ARCHITECTURE.md
│
├── _doc/
│   ├── arch/                   # 本資料4章の本文。本資料を読む許可がある作業では、4章の一覧をパス指定として該当ファイルを読む
│   # arch/以外は人間・設計AI用の資料。明示的な指示がない限り読んで行動してはならない
│
└── _log/
    ├── req/
    │   └── closed/    # フェイズ大番号移行時にアーカイブ済みREQの退避先
    └── res/
        └── closed/    # フェイズ大番号移行時にアーカイブ済みRESの退避先
```

**存在しないもの**：エディタでのJSの実行（スプライトのJSはテキストから取り出すだけ）、本アプリが書き出した形以外のJSの読み込み・スプライトの`elements`からの図形の作り直し（`CodeImporter`は作らない。`_doc/PROJECT_MILESTONE.md`の将来の野望）、確認用ページでの拡大縮小・移動・編集・複数ファイルの同時表示・組み立て用のJSの表示、エディタから確認用ページへのリンク、組み立て用のJSの書き出し（アニメーションエディタモードのPhase）、スプライトのJSON（`<名前>.json`）の出力・読み込み・確認用ページでのJSONの表示（Phase 04-04でやめた。スプライトはJSだけ。`.json`は作業データファイル）、複数キャンバスの一括出力、PNG・SVG等の形式、独自のカラーピッカー（色はブラウザ標準の`<input type="color">`）、図形の大きさ・角度の数値の欄（変形のPhase。位置の数値の欄はPhase 08-04で実装済みで、置き場所と欄の作りはそれにそろえる。3章20.）、プロパティパネル（Phase 07-02でツールバーのオプションバーへ移してなくした）、オプションバーの「選択中：n個」「次に描く図形」の表示（07-02でなくした。選択の有無はキャンバス上のハンドルで見分ける）、重なっている図形だけを数える前へ・後ろへ、離れた選択図形をまとめる重なり順の変更、図形の一覧・ドラッグによる並べ替え（図形の一覧のPhase）、直前に使った値（新しく描く図形のスタイル）の保存・キャンバスごとの既定の色、塗った内側による範囲選択（範囲選択は輪郭のみ）、弧・曲線（今の曲線`curve`）・直線・開いたパス（開いた曲線のパスを含む）の塗り（塗れるのは`rect`・`circle`・閉じた`path`のみ。閉じた曲線のパスは塗れる）、透明度・グラデーション、ツールバー・ステータスバーの折り返し・横スクロール・項目の省略メニュー（1行固定で、収まらない右側は切れる）、フロートウィンドウの位置・表示状態の保存、フロートウィンドウを動かせる範囲の制限、レイヤー、グループ化、`package.json`・`node_modules`・ビルド手順、テストの自動実行（保存時・コミット時のフック、CI）、画面の操作や描画のテスト、表示の状態（アウトライン・背景・グリッド・パレットの表示）の保存・履歴の対象化、定規の表示・非表示の切り替え・ガイド・定規からのドラッグ・定規の原点の変更・単位の切り替え、全体を画面に収めるキー・100%で表示する専用のキー（`Ctrl`+`1`。表示のリセットの`Ctrl`+`0`は表示倍率を100%へ戻す）・選択中の図形だけを画面に収める操作、白・黒以外の背景・図形の色を背景に合わせて変えること・ダークモード（定規・バー・ウィンドウの配色の切り替え）、カーソルがキャンバスの外へ出たときのホバーの強調の解除、`Shift`+クリックでの選択の追加、`Ctrl`+範囲選択での解除（範囲選択の`Ctrl`は追加だけ）、選択集合外の図形の押してそのままのドラッグ・`Alt`+ドラッグ（1回クリックで選んでから）、`Shift`での正方形・正円の作成、ドラッグの途中での`Alt`の切り替え（押した時点の`Alt`で決まる）、スポイトの連続の取り込み（1回取り込むと待ち受けがやむ）・取り込む項目を選ぶUI・画面の色からの取り込み・押している間だけ働く一時的なスポイト、`D`での太さの変更（`D`は色だけ）、スナップの設定（ON/OFF・単位）の保存・履歴の対象化・キャンバスごとの設定、1px・グリッド10px以外の単位・単位の数値の入力欄・画面のグリッドの線の間隔に合わせる単位、スナップのキー、`Ctrl`以外の修飾キーでの一時無効・キーの購読による即時の反映（`Ctrl`を押した・離しただけでは反映せず、次のマウスの移動・`wheel`で切り替わる）、丸めた位置を示す表示・定規の印を丸めた位置へ動かすこと、既存の図形・読み込み・出力・貼り付けのずらし量の丸め、曲線の作成時の制御点の丸め（今の曲線`curve`は曲線のツールで作られなくなったため該当する操作が無い。Phase 09-01a）、ツールごとのカーソルの形の切り替え（カーソルの形の規則は操作モードの分岐だけ）、選択・頂点の選択以外のツールのアイコンの差し替え（スポイト・キャンバス移動・図形のボタンは今までの文字のアイコン）、アイコンの`devicePixelRatio`の変化・ウィンドウの移動での描き直し（起動時に1回だけ描く）、`main.js`への操作モードの判定の追加（削除ボタンの見た目を頂点の選択で変えない。3章18.）、頂点の追加・削除、パスの分割、区間の直線／曲線の切り替え（Phase 09-02）、曲線の連なりの途中に角を立てる「この点は角」という情報・描いている間に元の線を含めた結合後の形を見せる仕組み（Phase 09-01b）、今の曲線・弧の結合と曲線の区間としての取り込み（Phase 09-03）、エンジンでの版3の確認と連絡票（Phase 09-04）、曲線の方向のハンドル・区間をクリックして選ぶ仕組み・引きながらの直線と曲線の切り替え、パスを開く／閉じる、拡大縮小・回転・反転・外枠のハンドル、基準点の指定、複数選択の比率の保持、頂点の選択の保存・履歴の対象化・書き出し、頂点のハンドルのドラッグでの`Shift`の限定（`Shift`が効くのは本体・moveハンドルの移動と、直線・曲線のツールで線を引いている途中の付いてくる線の先だけ。3章3.・16.・22.）、頂点のドラッグでの`Shift`による方向の限定、複数の頂点（2つ以上）を選んでいるときの端点への吸い付き（1つだけ選んでいるときだけ働く）、範囲選択で図形そのものを選ぶこと・頂点が出ていない図形（選択集合に無い図形）の頂点を範囲選択で選ぶこと、`Ctrl`＋矢印・`Alt`＋矢印への割り当て（ブラウザ・OSの操作を通すため一致させない。`Shift`＋矢印は「10px動かす」で占めたため、方向の限定など別の操作は割り当てられない）、ツールパレット等への微調整のボタンの追加、整列・分布へのキーの割り当て（ボタンだけ）、頂点の選択（`A`）で選んだ頂点をそろえる機能（整列・分布の対象は図形だけ。後のPhaseで足せる作り）、基準にする図形（キーオブジェクト）・キャンバスを基準にした整列、指定した間隔の分布（すき間の数値入力）、中心の間隔をそろえる分布（そろえるのは外枠どうしのすき間）、微調整・位置の欄・整列・分布の結果でのスナップの丸め・端点への吸い付き、位置の欄の値の保存、書き出しの際の座標の丸め、性能の改善を目的とした変更、ドラッグによるフリーハンドの線・`Enter`や`Ctrl`＋クリックでの線の終了・線を引いている途中の「やり直し」で点を戻す仕組み（取り消しは点を戻す。やり直しは捨てる）。どのサブフェイズで「今回やらないこと」と決めたかは`_log/req/`・`_log/res/`とgitが正本（同じ項目が複数のサブフェイズに挙がっていたものは1つにまとめた）。作業データ・書き出し・履歴のエントリの形・版は、Phase 8のどのサブフェイズでも変えていない。

**フォルダ分割の方針**
*   `core/`：横断的な処理（入力→状態→描画の複数層にまたがるもの）、状態を持たない規則の関数、状態を持つ設定・表示専用の状態のクラス、状態を持たないレンダラー、DOMの購読を含む小さな部品を置く。規則の関数は使う側で3種類に分かれる：`core/`の処理（主に`InputTracker`・`CanvasManager`・`RulerRenderer`）から使うもの、`main.js`・`wiring/`の配線から使うUI・表示の規則、その両方から使うもの。どれも状態・DOMを持たない関数で、`node --test`で確かめられる形にするために切り出している。`NudgeTargetRules`だけは`edit/`から使う（下の「依存方向」(3)）。置く理由：規則は操作モード（`InputModes`の`OperationMode`）と図形種別（`ShapeFactory`の`SHAPE_TYPES`）の知識を要し、`edit/`は操作モードを知らない・`palette/`はimportを持たない・`main.js`は判定・計算を持たない・`CanvasManager`は位置を引数で受け取るだけ・`InputTracker`へは入れない（状態の所有者設計の再分離はしない）ため、ほかに置き場所が無く`core/`の規則にする。状態を持つものは、表示専用の`DisplayState`と入力の設定の`UnitSnapSettings`（どちらも`ViewTransform`と同じ形で、保持・切り替え・変更通知のみ）、カーソル位置の`CanvasCursorTracker`。`UnitSnapSettings`を`DisplayState`へ足さなかった理由：`DisplayState`は表示専用の状態だが、スナップの設定は入力の座標を変える設定で、表示専用ではないため。`CanvasCursorTracker`・`AltKeyGuard`はDOMの購読を含むため`InputTracker`・`KeyboardShortcuts`へ入れず、小さな部品として分けた。`InputTracker`から切り出した共有の定数・判定・分岐の表（`InputModes`・`FocusKeyYieldRules`・`PressActionRules`・`CursorShapeRules`）も、ふるまいを変えない切り出しで、状態の所有者設計の再分離ではない。用語は「スナップ」（丸め。本節と3章17.）と「端点への吸い付き」（3章12.）を使い分け、混ぜない。各ファイルの使う側は1章の構成図、importと契約の詳細は`_doc/arch/`の各ファイルの資料にある。
*   `shapes/`：1種類の図形（図形クラス。種別ごとに1ファイル）と、図形クラスだけが使う共通の関数（幾何の計算（`ShapeGeometry`。3次ベジェの点と、点を通るなめらかな曲線の区間の制御点＝形の決め方の式の唯一の箇所を含む。2章`path`）・図形データの検証。継承ではなく関数の切り出し。詳細は4章`shapes/`）、図形をまたぐ規則（`PathJoinRules`（結合の規則と、直線・曲線のツールで続けて引く線の点の並びの規則＝直線とパスの作り分け。結合できる線（`isJoinableLine`）は続けて引く線の形（`isDrawnLineShape`）と同じ条件＝直線・開いたパス（区間の種類を問わない。Phase 09-01bで広げた。名前は意味の違いのため分けて残す）。結合・描き足し・閉じるの結果は元の区間の種類を保つ）・`EndpointSnapRules`（端点への吸い付きの規則）。第3の種類で、`shapes/`の外から使う。3章11.・12.）。`palette/`：1つのUI部品（ツールバーのオプションバーはまとまり（`.toolbar-group`）ごとに1つのUI部品。ツールバー自体を配線するクラスは無い）。
*   `io/`：作業データ形式の変換（`DocumentSerializer`）、IndexedDBへの読み書き（`CanvasStorage`）、作業データファイル・スプライトのJSのブラウザ内での読み書き（`DocumentFileIO`）、スプライト（書き出し形式）の組み立て（`SpriteSerializer`）とスプライトJSのテキストの組み立てと実行しない取り出し（`CodeExporter`）、開く・インポートで選ばれたファイルの中身の判別と作業データの取り出し（`FileContentReader`）のみ。
*   `check/`：確認用ページ（`sprite-check.html`）専用。DOM・選んだJSの実行・描画を含む。importは`check/`内と`io/`の`SpriteSerializer`のみ。`main.js`・`edit/`・`palette/`・`core/`の状態を持つモジュールをimportせず、`js/`の他のモジュール・`index.html`は`check/`をimportしない。
*   `edit/`：`io/`・`core/`の機能（結合の手順`PathJoiner`と吸い付きの手順`EndpointSnapper`のみ`shapes/`の規則も）を組み合わせて図形一式を扱う手順。貼り付け・複製、履歴のスナップショットの取得・適用、キャンバス一覧の管理、ファイル操作の組み立て、パスの結合、端点への吸い付きと描き足し、選択中の図形のスタイルの変更（オプションバー。スタイルをまとめて当てる入口`applyStyle`・`D`用の`resetColors`を含む）、スポイトの待ち受けと取り込み（`StyleEyedropper`）、同じ位置に貼り付け・`Alt`+ドラッグの複製（`ClipboardController`）、選択中の図形の重なり順の変更（規則`ShapeOrderRules`＋手順`ShapeOrderEditor`）、矢印キーと位置の数値入力での移動（手順`NudgeEditor`。対象の決定は`core/NudgeTargetRules`）、位置の数値の欄の規則`PositionInputRules`と手順`PositionInputEditor`、整列・分布の規則`ShapeAlignRules`と手順`ShapeAlignEditor`、選択中の図形・全図形の外枠の照会（`ShapeExtentReader`。`core/`は`io/`をimportできないため、`SpriteSerializer`の外枠の入口を使うこの照会は`edit/`に置く）。**操作モードを知らない**：操作モードに依存する判定・処理は`shouldRestoreSelection`・`prepareSwitch`・`prepareInsert`のような中立な注入関数で受け取り、`NudgeEditor`・`PositionInputEditor`は`getMode`の戻り値を解釈せず`core/NudgeTargetRules`の規則へ渡すだけにしてこの約束を守る。1件の編集操作の手順（`ShapeOrderEditor`・`NudgeEditor`・`ShapeAlignEditor`）は`VectorModel`・`HistoryManager`（`EditRecorder`）を注入で受け取り、規則の関数だけをimportする。`PositionInputEditor`は`HistoryManager`を持たず、動かす操作と履歴の記録を`NudgeEditor`へ任せる。`ShapeExtentReader`は`wiring/DisplayWiring`が内部に1つ持ち、`main.js`の`// 7.10.`がもう1つ生成して`PositionInputEditor`と`ShapeAlignEditor`が共有する（2か所。状態を持たない照会で値は同じ。一本化するなら`DisplayWiring`の構成を触るPhaseで行う）。
*   `wiring/`：`main.js`から切り出した、DOMの取得・購読の登録・同期の配線。`DisplayWiring`＝ステータスバーの座標・大きさ・グリッドの表示、表示の切り替え・スナップのまとまり・🧰・⛶。`ToolIconWiring`＝ツールパレットの選択・頂点の選択のボタンへスプライトJSの絵を描く。判定・計算の規則は持たない。呼ぶのは`core/`の規則・`palette/`の部品・`edit/`の照会・`asset/sprite/`のスプライトの`draw`と、注入で受け取った`core/`の状態（`DisplayState`・`UnitSnapSettings`・`ViewTransform`・`CanvasCursorTracker`・`VectorModel`）の切り替え・照会・購読のメソッド。`main.js`だけが使い、`js/`の他のフォルダは`wiring/`をimportしない。`main.js`の他の配線ブロックは切り出していない（4章の`main.js`の行数の項）。
*   `test/`：自動テスト。Node.jsはテストの実行（`node --test`）にのみ使い、エディタのビルド・配信には使わない。依存は`test/ → js/`の一方向で、`index.html`・`js/`は`test/`を参照しない。規則は4章`test/`。
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`main.js`は加えて`wiring/`をimportし、`wiring/`は`palette/`・`edit/`・`core/`・`asset/sprite/`をimportする（`main.js → wiring → palette / edit / core / asset`。`js/`の他のフォルダは`wiring/`をimportしない）。`core/`は`io/`・`edit/`・`palette/`・`wiring/`・`asset/`をimportしない。`io/`は`edit/`をimportしない（`io/`のimportは`io/`内と`core/ShapeFactory`のみ）。`palette/`は何もimportしない。`asset/sprite/`は何もimportしない葉のモジュール。`core/`から`shapes/`をimportするのは`core/ShapeFactory`の1ファイルだけ。`check/ → io`（確認用ページ専用。エディタ本体の依存の列とは独立）。**一方向の列から外れるimportは次の3種だけ**：(1)`edit/ → shapes/`：`edit/PathJoiner → shapes/PathJoinRules`、`edit/EndpointSnapper → shapes/EndpointSnapRules`・`shapes/PathJoinRules`（下向き。`edit/`の他のクラスは`shapes/`をimportしない）。(2)`shapes/`内：`shapes/EndpointSnapRules → shapes/PathJoinRules`（`PathJoinRules`は`Line`・`Path`のみimportするため循環しない。`Line`のimportは`ShapeGeometry`・`ShapeDataValidation`だけ）。(3)`edit/ → core/`：`edit/NudgeEditor`・`edit/PositionInputEditor` → `core/NudgeTargetRules`（`PositionInputEditor`は`core/VertexHandleRules`も）、`edit/PositionInputRules → core/StatusReadoutRules`。この3ファイルだけで、importするのは`core/`の状態を持たない規則の関数のみ（`VectorModel`・`HistoryManager`・`ShapeExtentReader`は注入で受け取る）。`edit/`内のimportは、1件の編集操作の手順・UIの手順がその規則をimportする形だけ（`ShapeStyleEditor`・`StyleEyedropper` → `StylePanelRules`、`ShapeOrderEditor → ShapeOrderRules`、`ShapeAlignEditor → ShapeAlignRules`、`PositionInputEditor → PositionInputRules`）。`core/`内のimportは、処理・レンダラー・小さな部品が状態を持たない規則の関数をimportする向きだけで、逆向き（規則が状態を持つクラスをimportする）は無い。規則の関数は何もimportしないか、`InputModes`の値だけ（`ToolRules`は加えて`ShapeFactory`の`SHAPE_TYPES`）をimportする。**循環importは無い。** `core/InputTracker`は`edit/`をimportせず、`main.js`が注入した`EndpointSnapper`のメソッドと第7引数の補助（`duplicateSelection`・`isPickingShape`・`pickShape`・`getUnitSnapStep`）を呼ぶだけ（`editRecorder`と同じ形）。各ファイルのimportの詳細は`_doc/arch/`の各ファイルの資料にある。

---

### 2. データ構造（Model）の概要
*   **図形（Shape）**：`shapes/`の図形クラスのインスタンス。
    *   共通プロパティ：`type`（`ShapeFactory`が受理する文字列と一致）・`id`（`VectorModel`が採番）・`strokeColor`（色の文字列、または`null`＝線なし）・`strokeWidth`・`fillColor`（色の文字列、または`null`＝塗りなし）。
    *   **スタイル3つ（`strokeColor`・`strokeWidth`・`fillColor`）の読み書き**：図形固有のプロパティ（頂点の保持形式等）ではなく共通プロパティのため、`VectorModel`が書き（`updateShapeStyles`・`startDraft`・`updateNewShapeStyle`の作成途中の図形）、`edit/StylePanelRules`・`edit/ShapeStyleEditor`が読む。各モジュールの「図形固有のプロパティ名を知らない」約束の例外として扱う（`ShapeStyleEditor`は書き換えを`model.updateShapeStyles`へ渡すだけで図形へ直接代入しない。図形クラスにメソッドは足さない＝共通メソッド契約は、Phase 06-03で`hitTestFill`を足して15メソッドになり、Phase 07-03で`drawOutline`（アウトライン表示）を足して16メソッドになり、Phase 07-05で`getHandlePosition`（ハンドルの位置の照会。スナップが頂点のハンドルの移動量を丸めるため）を足して17メソッドになり、Phase 08-02aで`getVertexHandleNames`（頂点として扱えるハンドル名の一覧。頂点の選択の表示と当たりの絞り込みのため）を足して18メソッドになった。スタイルの読み書きのためのメソッドは無い）。
    *   頂点の保持形式は図形クラスごとに異なる（`Line`は`x1, y1, x2, y2`、`Curve`/`Rect`/`Ellipse`/`Path`は`points`配列（`Path`は頂点数が可変で、`closed`・`segments`も持つ）。4章`shapes/`）。
    *   **塗れる形**：`rect`・`circle`・閉じた`path`。公開メソッド`isFillable()`が返す（`Line`・`Curve`・弧は常に偽、`Rect`は常に真、`Ellipse`は`type === 'circle'`、`Path`は`closed === true`。データには保存しない。オプションバーのスタイルの表示と変更（`StylePanelRules`・`ShapeStyleEditor`。Phase 06-02で追加）が使う。内側の当たり判定（各図形クラスの`hitTestFill`）も使う）。
    *   **`fillColor`は塗れない形でも保持し、塗れる形のときだけ描く**（DIR Phase 06の決定。後続のPhaseでパスを開く・閉じる等をしても塗りが壊れないため）。`toJSON`は保持している値をそのまま出力する。線なし（`strokeColor: null`）で塗れない形（または塗りなし）の図形は何も描かれないが、データとして受理し、従来どおり選べる。
*   **図形データ**（1図形のJSON表現）：全図形共通で`{ type, id, points: [{ x, y }, ...], strokeColor, strokeWidth, fillColor }`を共通の項目とし（`fillColor`は最後のキー）、種別により項目を足す（`path`）。
    *   **色・太さの読み込み**：`strokeColor`は文字列または`null`（線なし）。`fillColor`は文字列または`null`（塗りなし。キーが無ければ`null`として読む）。それ以外の型は不正。`strokeWidth`は正の有限の数値で、キーが無ければ（`undefined`）2pxとして読む（既定値の`shapes/`内の定義は`ShapeDataValidation.js`の`DEFAULT_STROKE_WIDTH`。`SpriteSerializer`の同名の定数と同じ値であるべき別の定義で、`shapes/`が`io/`をimportできないため。図形クラスのコンストラクタの`strokeWidth = 2`とも別の定義）。色の文字列の中身はCSSの色として正しいかを検証しない。
    *   **線の太さ2pxの4つの定義と位置づけ**：(1) `core/VectorModel.js`の`DEFAULT_NEW_SHAPE_STYLE.strokeWidth`＝新しく描く図形の既定の太さ（起動時の直前に使った値）の唯一の定義。(2) 各図形クラスのコンストラクタの既定値`strokeWidth = 2`＝引数を省略して生成したときの値（`ShapeFactory.create`はスタイルを渡さないが`startDraft`が直後に(1)で上書きするため、新しく描く図形の太さを決めない。(1)と同じ値である必要はない）。(3) `ShapeDataValidation.js`の`DEFAULT_STROKE_WIDTH`＝読み込みでキーが無いときの値。(4) `io/SpriteSerializer.js`の`DEFAULT_STROKE_WIDTH`＝書き出し形式の読む側の既定値（(3)と同じ値であるべき）。
    *   **`path`**：`{ type: 'path', id, points, closed, segments: [{ kind: 'line' }, ...], strokeColor, strokeWidth, fillColor }`（キー順）。`closed`は真偽値のみ。作られるのは結合・描き足し・閉じる、および直線・曲線のツールで点を3つ以上打って終えたとき（開いた／閉じた。直線のツールは区間がすべて`'line'`、曲線のツールはすべて`'smooth'`。22.）と、曲線のツールの作成途中（頂点2つ・区間1つ`'smooth'`の開いたパス。`ShapeFactory.create('curve')`）。結合・描き足し・閉じるの結果は元の各区間の種類を保つ（Bを逆順にするときは区間の種類も逆順。端点をまとめるときは除いた端点につながっていた区間の種類を保つ）。曲線の区間どうしがつながるとつなぎ目はなめらかになる（データに新しい情報は足さない。11.）。
        *   区間の約束：`segments[i]`＝`points[i]`→`points[i+1]`、閉じたパスの最後＝`points[n-1]`→`points[0]`。要素数は開いた`n - 1`・閉じた`n`。`kind`は`'line'`（直線の区間）と`'smooth'`（曲線の区間。Phase 09-01a）。区間の要素の余分なキーは無視する。`'smooth'`は制御点を作業データに持たず、頂点から式で求める。
        *   **曲線の区間の形の決め方**（式の唯一の箇所は`shapes/ShapeGeometry.computeSmoothSegmentControls`。一様なCatmull-Romを3次ベジェに直したもの。描画・当たり判定・範囲選択・塗りの内側・書き出しの`bezierPath`はすべてこの式の結果を使い、式を二重に持たない）：区間`i`（頂点`a`→`b`）の制御点は、`control1 = a + (b − Q0)/6`・`control2 = b − (Q3 − a)/6`。`Q0`＝前の区間が曲線の区間ならその区間の始点の頂点、そうでなければ折り返した仮の点`2a − b`。`Q3`＝次の区間が曲線の区間ならその区間の終点の頂点、そうでなければ`2b − a`。**曲線の連なり**（曲線の区間が途切れず続く部分。前後が直線の区間・開いたパスの端で区切られる。閉じたパスで全区間が曲線なら1周がひとつの連なり）で決まり、前後の区間を直線へ切り替えても連なりの外の区間は変わらない。制御点は頂点の座標の1次式（拡大縮小・回転・平行移動に追従する）。連なりの区間が1つだけなら直線と同じ形。直線の区間とのつなぎ目は角が立つ。打った点の間隔が大きく違うと膨らむ・小さな輪ができることがある（式の性質。許容）。分割数は`Path`の`SMOOTH_SEGMENT_SAMPLE_COUNT`（100。当たり判定・範囲選択・塗りの内側の折れ線近似の唯一の定義）。
        *   頂点数の下限は開いた2・閉じた3、上限なし。長さ0の区間は可。
        *   パスの追加では作業データの版を上げていない（古いエディタでは未知の図形種別として図形単位でスキップされる。発注者の決定）。曲線の区間（`'smooth'`）の追加でも作業データの版は2のまま（古いエディタでは未知の区間の種類としてその図形だけがスキップされる）。
    *   各図形クラスの`toJSON()`/`static fromJSON(data)`で相互変換する。
    *   `Line`も`points`2点＝[始点, 終点]で表す。`points`の並びは各図形クラスの頂点の並びと同じ。
    *   `fromJSON`直後の`id`は未検証・未正規化（欠落なら`undefined`、任意の型を取り得る）。`VectorModel.replaceAllShapes`の正規化を経て初めて一意な文字列になる。
*   **作業データ形式**（キャンバス全体の版番号付きJSON表現）：`{ format: "oz-vector-editor", version, shapes: [図形データ, ...] }`（`shapes`は描画順）。
    *   変換は`io/DocumentSerializer.js`が担う。
    *   保存対象は図形データのみ。選択集合・頂点の選択・ホバー・作成中の図形・選択矩形・吸い付きの表示・ビュー変換・新しく描く図形のスタイル（直前に使った値）・表示の状態（アウトライン・背景・グリッド・パレットの表示）・スナップの設定（ON/OFF・単位）は含めない。
    *   図形クラスは常に現行版の図形データのみを扱う。旧版の知識は`DocumentSerializer`のマイグレーション表に閉じる。
    *   **現行版は2**。版1→版2の移行（`migrateVersion1To2`）は、全図形の`fillColor`を`null`にする（版1に塗りの意味はないため、`fillColor`を持っていても`null`）。`strokeColor`・`strokeWidth`には触れない。プレーンオブジェクトでない要素はそのまま残し、後の図形単位の検証でスキップされる。
    *   **版2の作業データを古いエディタ（版1まで対応）で開くと「対応していない版」として全体が断られる**（DIRの決定。許容）。版を上げた理由：上げないと`strokeColor: null`の図形が古いエディタで黙って捨てられるため。
    *   版1の作業データの`strokeColor: null`は版1では不正だったが、移行は`strokeColor`に触れないため版2の規則で線なしとして読まれる（エディタが書き出した版1のファイルには現れない値。許容）。
*   **作業データファイル**：作業データ形式のJSON文字列を内容とするファイル（既定の拡張子`.ozve.json`。読み込みは従来の`.json`も可）。キャンバス名は内容に含まれない。ファイル名との変換は`io/DocumentFileIO`が担う（3章9.。規則は下記「ファイル名の規則」）。
*   **スプライト（書き出し形式）**：開いているキャンバスをゲームが`import`して描けるようにしたもの。`<名前>.js`（ESモジュール）だけ（スプライトのJSONは出力も読み込みもしない。Phase 04-04でやめた）。既定のexportにスプライトデータの全キーと`draw(ctx)`を持つ。組み立ては`io/SpriteSerializer`（データ・JSに埋め込むJSON文字列）と`io/CodeExporter`（JSのテキスト）が担う。本項がスプライトの形の唯一の記載箇所（他の箇所はここを参照する）。
    *   **エンジン（OZ Engine、`D:\ozlab\ozengine-web`）との約束**：(a) エンジンの`oz/ENGINE_API.md` 23章「スプライトJS」（エンジンの`PROJECT_ARCHITECTURE.md` 2.1章がここを指す）は、本項を書き出し形式の唯一の定義として参照し、形式を書き写していない。(b) エンジンが読むのは既定のexportの`draw(ctx)`だけ（`format`・`formatVersion`・`bounds`・`elements`・`source`は現在エンジンでは読んでいない）。エンジンは`import sprite from '…'`と既定のimportで受け取り、位置・回転を`ctx`に設定してから`draw(ctx)`だけを呼ぶ。(c) 書き出し形式の版（`formatVersion`）を上げるとき、JSのexportの形や`draw`の約束を変えるときは、エンジンへ連絡票を出す（版2への版上げは連絡済み。エンジンのコードの変更なしで表示できた。Phase 06-05）。**版3への版上げ（Phase 09-01a。`bezierPath`の追加）の連絡票は未送付**（Phase 09-04で出す。エンジンは既定のexportの`draw(ctx)`だけを読むため、版3のJSもエンジンのコードの変更なしで描ける見込みだが、09-04で確かめる）。(d) エンジンの機体`assets/sprites/ship.js`は本アプリの書き出し（版2。白の塗りのみ・線なしの閉じたパスと円2つ）で、エンジン側では手で編集しない。直すときは、そのJSを本アプリの「開く」で開いて編集し、書き出し直したJSをエンジンへ渡す（連絡票を添える）。
    *   **スプライトデータ（書き出し形式の版3）**：`{ format: "oz-vector-editor-sprite", formatVersion: 3, bounds: {minX, minY, maxX, maxY} | null, elements: [描画要素, ...], source: 作業データ }`。キーはこの順で出力するが、読む側はキーの順に依存しないこと。
        *   `source`：`DocumentSerializer.serialize`の戻り値そのもの（作業データ形式。`source.version`は作業データの版）。`DocumentSerializer.deserialize`で元の図形に戻せる。JSの中に`elements`と`source`の両方を持つため図形の情報を2重に持つ（薄い書き出しとして許容）。
        *   含めないもの：スプライトごとの変わらないID、キャンバス名、作成日時（参照はファイル名で行う）。
        *   単位はpx、角度はラジアン。基準点はワールド座標の原点(0, 0)、y軸は下向き。エディタのワールド座標をそのまま使い、平行移動・拡大・丸めをしない。
    *   **描画要素**（`elements`の1要素＝図形1つ。描画順＝`model.getShapes()`の並び。`id`は図形の`id`そのまま、頂点は作業データの`points`の並び順のまま。回転のキーは持たない）。図形クラスの`toDrawElement()`が作る。共通のキーは`kind`・`id`・`strokeColor`・`strokeWidth`・`fillColor`（各`kind`のキー列の最後）。`strokeColor`は文字列または`null`（線なし）。`fillColor`は、塗れる形（`isFillable()`が真）なら図形の`fillColor`、塗れない形なら`null`（図形に`fillColor`が残っていても出さない。`source`には元の値が残る）。
        *   `"polyline"`（`line`・`rect`・区間がすべて直線の`path`）：`kind, id, points: [{x, y}, ...], closed, strokeColor, strokeWidth, fillColor`。`line`は`closed: false`・2点、`rect`は`closed: true`・4点、`path`は`closed`のとおり・全頂点（閉じたパスも始点を重複させない）。区間の種類は描画要素に出さない（区間がすべて直線の間のみ`polyline`で表せる）。`beginPath` → `moveTo(points[0])` → `lineTo`（i=1…）→ `closed`なら`closePath`。
        *   `"bezierPath"`（曲線の区間を1つ以上持つ`path`。版3で追加）：`kind, id, points: [{x, y}, ...], closed, segments, strokeColor, strokeWidth, fillColor`。`segments[i]`は`points[i]`→`points[(i+1) % n]`の区間（閉じたパスの要素数は`n`、開いたパスは`n-1`）で、直線は`{kind: 'line'}`、曲線は`{kind: 'cubic', control1: {x, y}, control2: {x, y}}`（3次ベジェ。制御点は作業データの式の結果を書き出す。区間の種類の名前は作業データの`'smooth'`とは別の語彙で、Catmull-Romの規則を書き出しに出さない。Phase 09-03で今の曲線・弧を3次ベジェの区間として表すため）。`beginPath` → `moveTo(points[0])` → 区間ごとに`bezierCurveTo`／`lineTo` → `closed`なら`closePath`（閉じた要素の最後の区間が`line`なら`lineTo`なしで`closePath`）。
        *   `"quadratic"`（`curve`）：`kind, id, points: [始点, 制御点, 終点], strokeColor, strokeWidth, fillColor`（`fillColor`は常に`null`）。`beginPath` → `moveTo` → `quadraticCurveTo(制御点, 終点)`。
        *   `"ellipse"`（`circle`・`arc`）：`kind, id, x, y, radiusX, radiusY, startAngle, endAngle, closed, strokeColor, strokeWidth, fillColor`。`ellipse(x, y, radiusX, radiusY, 0, startAngle, endAngle)`（回転は常に0）→ `closed`なら`closePath`。`circle`は`closed: true`・0〜2π、`arc`は`closed: false`・π〜2π。値は`Ellipse.draw`と同じ式（読む側は`Ellipse`の`points`の約束を知らなくてよい）。
        *   描き方の順序（エディタの各図形の`draw`と同じ順・同じ命令）：形のパス → 塗り（`fillStyle` → `fill()`。引数なし＝nonzero）→ 線（`strokeStyle` → `lineWidth` → `stroke()`）。塗りは線より先（線が塗りの上に重なる）。塗る/線を描くが両方偽の要素は、パスも組み立てない（`beginPath`も呼ばない）。
    *   **読む側の規則**（着色・パス等のPhaseで項目を足しても既存の項目の意味を変えないための規則。書き出したJSの`draw`もこれに従う）：
        *   未知のキー（最上位・描画要素とも）は無視する。未知の`kind`の要素は描かない。
        *   `strokeWidth`が正の有限の数値でない（キーが無い・`undefined`を含む）要素は線の太さ2pxとして扱う（描画・外枠とも。`DEFAULT_STROKE_WIDTH`の唯一の定義箇所は`SpriteSerializer.js`）。
        *   `strokeColor`が文字列でない要素は**線を描かない**（`strokeStyle`・`lineWidth`・`stroke()`を呼ばない）。これは線についての規則であり、要素を捨てる規則ではなく、塗りには影響しない。
        *   **塗るのは**、`fillColor`が文字列で、かつ`kind`が`polyline`・`ellipse`・`bezierPath`のいずれかで`closed === true`の要素だけ。`quadratic`・`closed`が`true`でない要素・`fillColor`が無い／文字列でない要素は塗らない（版1のJSは`fillColor`を持たないため塗らず、従来どおり描かれる。`checkFormat`は版1も`'supported'`）。
        *   塗りも線も描かない要素はパスも組み立てない。
        *   `draw(ctx)`の明示設定（下記）に塗りの分（`fillStyle`等）は足さない：塗る要素は描くたびに`fillStyle`を設定するため、ゲーム側の`ctx`の値に左右されない。
        *   形の項目が足りない要素は塗りも線も描かない：`polyline`は`points`が2点以上、`bezierPath`は`points`が2点以上かつ`segments`の要素数が合い各区間の形（`cubic`の`control1`・`control2`を含む）が足りている（足りなければパスの組み立てより前に`return`）、`quadratic`は3点以上、`ellipse`は`radiusX`・`radiusY`が0以上の数値（`NaN`不可）。
        *   **外枠（`bounds`）**：`bezierPath`は全頂点と、`cubic`の区間の各軸の極値の範囲（制御点そのものは含めない。極値の計算は`SpriteSerializer`の非公開の`cubicAxisRange`で、`ShapeGeometry.cubicBezierPoint`とは別の定義。`io/`は`shapes/`をimportできず、`quadraticAxisRange`と同じ扱いのため）。線の太さの半分を外側へ広げる規則は他の`kind`と同じ。
    *   **2つの版**：書き出し形式の版は`formatVersion`（唯一の定義箇所は`SpriteSerializer.js`）、作業データの版は`source.version`（`DocumentSerializer`）。最上位に`version`キーは置かない。書き出し形式の版は、エンジンが読む部分（`format`・`formatVersion`・`bounds`・`elements`の形と意味、JSのexportの形）が変わったとき（項目の追加で、古い読み手が未知の項目として無視すると正しく描けなくなる場合を含む）に上げる。作業データの版（`source.version`）は、作業データの保存形式が変わったとき（`DocumentSerializer`の`MIGRATIONS`へ関数を足すとき）に上げる。作業データだけ版が上がっても書き出し形式の版は上げなくてよい。**版の履歴**：版2＝`fillColor`の追加（Phase 06）、版3＝描画要素`bezierPath`の追加（Phase 09-01a。古い読み手は未知の`kind`として描かず正しく描けないため上げた。`checkFormat`は版1〜3を受理する）。作業データの版は2のまま（曲線の区間の追加では上げていない）。`asset/sprite/`のツールのアイコンは版2のまま（`checkFormat`が版2を受理し、`ToolIconWiring`は`bounds`と`draw`だけを使うため差し替え不要）。
    *   **識別子**：`format: "oz-vector-editor-sprite"`（作業データの`"oz-vector-editor"`とは別の値）。本アプリが書き出したものかを見分ける手がかり（エディタの「開く」「インポート」ではJSに埋め込まれたデータ、確認用ページではJSの既定のexport）。判別は`SpriteSerializer.checkFormat`（`'supported'`・`'notSprite'`・`'unsupportedVersion'`）が唯一の入口。
    *   **エディタで開くときの規則**（入口は`io/FileContentReader.deserializeFromText`。エディタの「開く」「インポート」の読み込みはすべてここを通る）：
        *   中身で判定する（拡張子に頼らない）。`JSON.parse`できればJSONとして**作業データとしてのみ**扱い、そのまま`DocumentSerializer.deserialize`へ渡す（スプライトのJSONは`format`の不一致で読み込み不可。Phase 04-04で読まなくなった：`.json`＝作業データファイル、`.js`＝スプライト。`DocumentSerializer`はスプライトの識別子を知らずに落とす）。できなければ本アプリのJSの形からスプライトデータのJSONを取り出す。
        *   取り出したデータの`format`が`"oz-vector-editor-sprite"`なら`source`だけを使い（JSのみ）、作業データファイルと同じ`DocumentSerializer.deserialize`へ渡す（旧版の変換・図形単位のスキップ・`CanvasFileOperations`の判定の表も同じ。`elements`・`bounds`は使わない）。
        *   JSは実行しない。`CodeExporter.extractSpriteDataText`がテキストから取り出す（取り出しの知識は組み立てと同じ`CodeExporter`。`CRLF`も可）。
        *   受け付ける書き出し形式の版は1以上・現行版以下の整数。
        *   読み込み不可（通知`readFailed`）：`format`が違うJSに埋め込まれたデータ・`source`が無い・版が範囲外・取り出しや解析の失敗・スプライトのJSON（上の規則により作業データとして判定され、`format`の不一致で`DocumentSerializer`が全体失敗にする）。
        *   本アプリが書き出した形から外れたJS（手で整形し直したもの等）は取り出せず読み込み不可になる（許容）。
    *   **外枠`bounds`**：ワールド座標の最小・最大（`minX ≤ maxX`・`minY ≤ maxY`。幅・高さは読む側で引き算する）。図形0個のとき`null`（0×0の原点の点にするとアニメーションエディタモードで外枠の和を取るとき原点が誤って含まれるため）。読む側は`null`を確かめること。外枠は書き出し時にエディタが計算した値であり、読む側は再計算しない。
        *   求め方：描画要素ごとの形の範囲（中心線の外接矩形）を、`strokeColor`が文字列の要素だけ線の太さの半分（太さが不正なら2pxの半分）だけ四方へ広げ（線を描かない要素は形の範囲のまま。線なしで塗れない要素の形の範囲も和に含める）、全要素の和を取る。`polyline`は全頂点、`quadratic`は端点と各軸の極値（制御点は含めない）、`ellipse`は弧の両端と軸上の端点（`closed`の弦は影響しない）。未知の`kind`は`Error`をthrowする。
        *   近似：鋭い角の継ぎ目（`miter`）の尖りは考慮しない（はみ出すことがある）。線の端・長さ0の線も太さの半分を広げるため実際より大きくなることがある（保守的な値）。弧の両端は三角関数の誤差（1e-15程度）を含む。
    *   **JSに埋め込むデータの文字列の形**：`JSON.stringify(data, null, 2)`（`SpriteSerializer.stringify`。JSの中の`const spriteData = <JSON>;`の`<JSON>`。字下げ2。最小化しない。関数は含まない）。
    *   **JSの形**（`CodeExporter.toModuleText`）：`import`文を含まず単体で`import`できる。固定の説明コメント → `const spriteData = <JSON>;` → `const DEFAULT_STROKE_WIDTH = 2;` → `function draw(ctx)`・`function drawElement(ctx, element)` → `export default { ...spriteData, draw };`。**既定のexportのみ**（名前付きexportなし。`import body from './body.js'`と`import`する側が名前を付けるため衝突しない）。値はスプライトデータの全キーと`draw`。`draw`は`this`を使わず、`const { draw } = body`と取り出しても動く。スプライトデータはJSONのまま式として埋め込む（ES2019以降が前提。キーは本アプリが組み立てる固定のもの。利用者の入力を含む値はJSONの文字列としてのみ埋め込まれ、コードとして解釈されない）。
        *   `draw(ctx)`：`ctx.save()` → `try { 明示設定 → 各要素を順に描く } finally { ctx.restore() }`。明示する設定は`lineCap='butt'` → `lineJoin='miter'` → `miterLimit=10` → `setLineDash([])`（エディタの図形の線が既定値で描かれているため、ゲーム側の`ctx`の値に左右されないよう明示する）。
        *   明示しないもの：`globalAlpha`・`globalCompositeOperation`・影・`filter`・変換。ゲーム側が意図して使う合成・効果と配置であり、`ctx`の現在の変換の上に描く要件のため。配置は`ctx`の変換で行う。
        *   図形0個：`draw`は`save`・設定の明示・`restore`のみで、パスも`stroke`も呼ばない。JSを図形があるときと同じく1つダウンロードし、専用の通知は出さない。
        *   組み立て用のJSからの使い方の例（アニメーションエディタモードのPhaseで書き出す想定。名前の頭に`_`を付ける。配置は`ctx`の変換）：
            ```js
            // _hero.js
            import body from './body.js';
            import head from './head.js';
            export default {
                draw(ctx) {
                    body.draw(ctx);              // 原点(0, 0)を基準に描く
                    ctx.save();
                    ctx.translate(0, -40);
                    head.draw(ctx);
                    ctx.restore();
                }
            };
            ```
    *   **本アプリ自身のツールのアイコン（Phase 08-02a）**：ツールパレットの選択・頂点の選択のボタンのアイコンは、書き出し形式のスプライトJS（`asset/sprite/select-arrow.js`・`vertex-arrow.js`）を`wiring/ToolIconWiring`が`<canvas>`へ描いたもの。**後日、本アプリで描き直して差し替える仮のもの**（矢印の形も仮）。JSは本アプリの書き出し（`Path.fromJSON` → `SpriteSerializer.serialize` → `CodeExporter.toModuleText`）が作った生成物をそのまま置いたもので、先頭は`CodeExporter`の固定のヘッダコメントであり「責務:」の語を含まない（憲法3章の責務コメントの書き方とは別。手で書き換えない。`_doc/arch/40_asset_sprite.md`）。書き出し形式の版は2のまま・作業データの版も2のままで、**エンジンへの連絡票は不要**（形式を変えていない）。
*   **ファイル名の規則**（唯一の定義箇所は`io/DocumentFileIO`。`CanvasFileOperations`はキャンバス名を渡すだけで拡張子・MIMEタイプを知らない）：
    *   共通の手順：使えない文字（`\ / : * ? " < > |`と制御文字）を`_`へ置換 → 前後の空白を除く → 末尾のピリオドと空白を除く → 空なら`無題`。
    *   作業データファイル：`<名前>.ozve.json`（先頭の`_`は除かない）。開くときは末尾の`.ozve.json`・`.json`・`.js`のいずれかを**1回だけ**除く（大文字小文字を区別しない。`ship.js` → `ship`、`a.js.ozve.json` → `a.js`、`a.json.js` → `a.json`）ため、キャンバス名がどのような拡張子らしい文字列で終わっても作業データファイルの往復で変わらない（`a.json` → `a.json.ozve.json` → `a.json`。`.ozve.json`が末尾にあるため`.js`の分岐は当たらない）。従来の`ship.json`も読め、名前は`ship`になる。末尾のピリオド・使えない文字を含む名前は従来どおり往復で変わる。
    *   スプライト：`<名前>.js`。共通の手順に加え、使えない文字の置換の後に先頭の`_`と空白をすべて除く（`_hero` → `hero`、`___` → `無題`）。DIRの組み立て用のJSは名前の頭に`_`を付け、パーツのJSは付けないため。
*   **キャンバス**：名前を持ち、ブラウザ内に保存される1つの作品の単位。画面に開くキャンバスは常に1枚。
*   **キャンバス記録**（キャンバスの保存単位）：`{ id, name, updatedAt, document }`（typedef`CanvasRecord`は`io/CanvasStorage.js`）。
    *   `id`：形式`canvas-<Date.now()の36進>-<Math.randomの36進8文字>`。採番と形式の知識は`CanvasLibrary`に閉じ、他のモジュールは解釈しない。図形のid`shape-<連番>`とは別体系。
    *   `name`：前後の空白を除いた1〜100文字。重複は許す。
    *   `updatedAt`：`Date.now()`のミリ秒。名前の変更では更新しない。
    *   `document`：作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値）。保存処理・キャンバス一覧の管理とも中身を解釈しない。読み込みは`DocumentSerializer.deserialize`を通す。
    *   保存しないもの：Undo/Redoの履歴・選択集合・頂点の選択・ホバー・作成中の図形・選択矩形・吸い付きの表示・ビュー変換・クリップボード・操作モード・新しく描く図形のスタイル（直前に使った値）・表示の状態（アウトライン・背景・グリッド・パレットの表示）・スナップの設定（ON/OFF・単位）。
*   **保存先**：IndexedDB。設定は`CanvasStorage.js`の`STORAGE_CONFIG`が唯一の定義箇所。ストアはキャンバス記録と、「最後に開いていたキャンバスの識別子」を保持するメタ情報の2つ。
    *   オリジン単位のため、`file://`で開いた場合とローカルサーバー経由で開いた場合、ポート番号が違う場合は別のキャンバス一覧になる。
    *   複数タブで同時に開いた場合の整合は扱わない（後から書き込んだ側が残る）。
*   **座標**：図形の座標はすべてワールド座標。ビュー変換（表示倍率・オフセット）は図形データに含まれず、表示専用の状態として`core/ViewTransform.js`が保持する。パン・ズームで図形データは書き換わらない。
*   **選択状態**：`core/VectorModel.js`が保持する。
    *   **選択集合**：選択中の図形idの集合。0個以上で、常に現存図形のidのみを含む。選択モード・頂点の選択モード以外では空（不変条件。Phase 08-02aで「選択モード以外では空」から広げた）。
    *   **頂点の選択**（Phase 08-02a）：`VectorModel`が持つ「図形のid＋ハンドル名」の組の配列（選んだ順。`{ shapeId, handle }`）。頂点の選択モードで選んだ頂点を表す。**保存しない・履歴の対象外・書き出しに入れない**（ホバー・選択矩形・吸い付きの表示の点と同じ扱い）。不変条件：**選択集合に含まれる図形の組だけを持つ**（選択集合・図形一式が変わる既存の操作の通知の前に、集合に無い図形の組を落とす。専用の通知は足さず、既存の`#notifyChange()`に相乗りする）。**Phase 08-02bで2つ以上の組が入るようになった**（入れる操作は`Ctrl`＋クリックでの追加・解除、範囲選択、頂点を選び直すクリック・押下。選び直しでは1つだけになる）。状態の形・不変条件・保存しないことは変えていない。3章18.。
    *   **選択矩形**：範囲選択中の表示用。ワールド座標の対角2点（押下点と現在のカーソル位置）。正規化しない。
*   **吸い付きの表示の点**：`core/VectorModel.js`が保持するワールド座標の1点（`null`＝表示なし）。表示専用で、保存対象外・履歴の対象外。`InputTracker`が設定・消去する（3章12.）。
*   **新しく描く図形のスタイル（直前に使った値）**：`core/VectorModel.js`が保持する（`NewShapeStyle`＝`strokeEnabled`・`strokeColor`・`strokeWidth`・`fillEnabled`・`fillColor`の5項目）。
    *   **有無と色を分けて持つ理由**：「なし」にしても色の欄に直前の色を表示でき、「あり」に戻すとその色が入るため。
    *   **既定**（起動時）：線あり`#000000`・太さ2・塗りなし・塗りの色`#ffffff`（`DEFAULT_NEW_SHAPE_STYLE`）。既定のまま描いた図形のスタイルは従来と同じ（`fillColor: null`）。
    *   **当てる場所**：`VectorModel.startDraft`が`ShapeFactory.create`の直後の図形へ、`VectorModel.replaceDraft`（22.。作成途中の線の組み立て直し）が渡された図形へ当てる（`InputTracker`・`ShapeFactory`・図形クラスを変えずに済むため。作成途中の図形を作る・置き換えるのはこの2つだけ）。作成途中に直前に使った値を変えると作成途中の図形も変わる（確定する図形は確定時点の値）。塗れない形も`fillColor`を持つ（描かれないが保持する）。
    *   **更新**：`ShapeStyleEditor`からだけ（オプションバーでの変更と、`applyStyle`を通る`D`・スポイト）。図形を選んだだけ・`getPanelView()`を呼んだだけでは変わらない。
    *   **保存しない・履歴の対象外・キャンバスごとに持たない**：作業データにもスナップショットにも含まれず、`replaceAllShapes`（取り消し/やり直し・キャンバスの切り替え・`?dev`の復元）も触れない。ページを開き直すと既定に戻る。直前に使った値を`VectorModel`に置く理由：(1) `startDraft`が使う、(2) 変更を既存の`model.onChange`で通知でき表示の同期に新しい経路が要らない、(3) 上記の「含まれない」が自然に満たされる。
    *   **当てないもの**：貼り付け・複製・インポート・開く（ファイル）・取り消し/やり直し・直線・曲線のツールで線を引いた結果の描き足し・つながり・既存の線を閉じる（Phase 09-01b）（作成途中の線は捨てられ、`PathJoinRules`の基準の線Aのスタイルになる）。吸い付きなしで終えた線・始点で閉じた線は直前に使った値（`startDraft`／`replaceDraft`）。

---

### 3. 描画・操作フロー（実行サイクル）
**同期の経路（全機能共通）**：再描画・UI同期は既存の経路（`model.onChange`・`viewTransform.onChange`・`historyManager.onChange`・`canvasLibrary.onChange`・`canvasFileOperations.onChange`、モードと図形種別は`applyMode`・`applyShapeType`。ツールパレットの押し込みの表示もこの2つの中と、Phase 07-04で足した`styleEyedropper.onChange`（スポイトの待ち受けの変化。登録先はツールパレットの押し込みの`syncToolPalette`だけで、キャンバスは再描画しない。取り込みはキャンバスのクリックで起き`applyMode`・`applyShapeType`を通らないため。16.）で同期する。Phase 07-03で`displayState.onChange`（表示の状態。キャンバスの再描画・表示の切り替えのボタン・パレットの表示。15.）と`cursorTracker.onChange`（カーソル位置。定規とステータスバーの座標の文字だけを更新し、キャンバスは再描画しない）を足した。Phase 07-05で`unitSnapSettings.onChange`（スナップの設定。登録先は`wiring/DisplayWiring`の`syncUnitSnapGroup`（ステータスバーのスナップのまとまりの表示）と`syncCursorReadout`（座標の表示）の2つだけで、キャンバスは再描画しない。17.）を足した）のみで行う。機能専用の再描画・同期処理を足さない。オプションバー（スタイル・重なり順・位置・整列・分布のまとまり）の表示は`model.onChange`で同期する（直前に使った値の変更も`model.onChange`で通知される。13.・20.・21.）。

1.  **起動処理 (`main.js`)**：DOMの読み込み完了後、インスタンス化・依存の注入・イベントバインドを行う（配線は4章`main.js`）。URLに`?dev`があるときのみ`DevPanel`も生成・表示する。
    *   **キャンバスの非同期の読み込み**：初期化の最後に`canvasLibrary.start()`を呼ぶ（`await`しない）。起動直後は空のキャンバスで描画され、読み込み完了時に切り替え処理（8.）で図形一式が入る（倍率100%・選択モード・履歴は空）。
    *   **開くキャンバスの決定**：候補は「最後に開いていたキャンバス（一覧にあれば）→ 残りを最終更新日時の新しい順」。先頭から読み込みを試し、全体として読めた最初の1枚を開く。読めない記録は一覧に残し、保存先からも消さない。形式不正の記録（`id`・`name`・`updatedAt`の型が違う）は一覧から除外し、保存先からは消さない。候補が無い・すべて読めない場合は新しい空のキャンバスを作成して開く（初回起動を含む）。
    *   **保存先を利用できない場合**：保存先へ一切書き込まず、メモリ上だけの空のキャンバス「無題 1」を開く（`'unavailable'`。8.）。
    *   **読み込み完了前の操作**：`index.html`で表示状態から始まる覆い要素`#canvas-loading-cover`がキャンバスの領域を覆ってキャンバスへのマウス入力を遮る（読み込み完了時の切り替えで利用者の操作が消されたり別のキャンバスに保存されたりしないため）。キーボードショートカットとツールバー・ステータスバー・フロートウィンドウ上のボタンは働く（覆いより手前にある）。読み込み中は図形0個・クリップボード空・履歴空のため図形一式を変えない（結合・重なり順の変更も、図形0個・選択集合が空のため何もしない。専用の判定は無い）。唯一図形一式を変え得る`?dev`の「復元」は読み込み中は受理しない。`CanvasLibrary`も読み込み中の開く・新規作成等を受理しない。図形一式を変える操作を新しく足す場合は読み込み中の扱いが要る。オプションバーは読み込み中も操作でき（ツールバーは覆いより手前）、選択集合が空のため直前に使った値だけを変える（図形一式を変えない。専用の判定は無い）。表示の切り替え（`Z`・`X`・`C`・`Tab`・ステータスバーのボタン・🧰・⛶）も図形一式を変えないため読み込み中も働く（専用の判定は無い）。覆い要素の間はキャンバスの`mousemove`が来ないため、ステータスバーの座標の表示は`—`のまま。
2.  **描画サイクル (`CanvasManager.js`)**：常時ループ（rAF）は持たない。`VectorModel.onChange`・`ViewTransform.onChange`・`DisplayState.onChange`・ウィンドウリサイズの4経路から同一関数`renderCurrentState()`（`main.js`）で同期的に再描画する（`displayState.getState()`の表示の状態を`CanvasManager.render`へ渡す）。定規は`viewTransform.onChange`・`cursorTracker.onChange`・ウィンドウリサイズから`renderRulers()`（`main.js`）で描く（リサイズは`canvasManager.resize()` → `rulerRenderer.resize()` → `renderCurrentState()` → `renderRulers()`の順）。描画順は4章`CanvasManager.js`。
3.  **入力監視 (`InputTracker.js`・`KeyboardShortcuts.js` → `VectorModel.js`)**：状態が更新されると`VectorModel`が更新イベントを発火し、再描画を促す。
    *   **端点への吸い付き**：直線・曲線のツールで線を描くとき、および頂点の選択モードで線の端点のハンドルをドラッグするときの吸い付きは12.。
    *   **当たり分類（クリック・押下・ホバー・カーソル）**：規則の正本は`core/PointHitRules.classifyPointHit`（`InputTracker`の`#classifyPoint`は図形配列・選択中かの照会・許容誤差を渡すだけ）。ハンドル（選択集合の図形のみ・手前優先・Phase 06-03前のまま）→ 本体（選択集合の図形の輪郭・手前優先 → それ以外は手前から、輪郭または塗った内側（`hitTestFill`）。選択集合の図形の内側を優先しない）。塗った内側で押しても範囲選択は始まらない。選択集合外の図形は押してそのままドラッグでは動かない（1回クリックで選んでからドラッグ）。範囲選択は輪郭のみ（`intersectsRect`。塗った内側が矩形にかかっても選ばれない。頂点の選択モードの範囲選択は`intersectsRect`を呼ばず頂点の位置で判定する。18.）。見えない図形（塗られていない）は輪郭の当たりだけで選ばれる（2026-11-12 発注者の決定）。`Ctrl`+クリック・`Alt`+ドラッグの押下・スポイトのクリックも、同じ`#classifyPoint`の結果を通る（別の当たり判定を持たない）。**アウトライン表示の間は塗った内側を当たりに含めない**（`classifyPointHit`の第6引数`includeFill`が偽。塗った内側は空白になり範囲選択を始められ、手前の塗った図形に隠れていた奥の図形の輪郭が見えているとおりに選ばれる。選択集合の図形の輪郭の優先とハンドルは変わらない。`InputTracker`は注入された照会`isFillHitExcluded`の否定を渡すだけで、表示の状態・アウトライン表示を知らない。2026-11-13 発注者の決定）。**Phase 08-02aの`includeHandles`**：`classifyPointHit`の第7引数`includeHandles`（既定は真）が偽なら`handle`は常に`null`（`bodyId`・`includeFill`の意味は変えない）。`InputTracker`の`#classifyPoint`は**頂点の選択モードのときだけ**真を渡し、選択モードでは偽（選択モードはハンドルを当たりに含めない）。頂点の選択モードでは、当たったハンドルが頂点のハンドル（`VertexHandleRules.isVertexHandle`）でなければ`{ handle: null, bodyId }`へ絞り込む（円・弧のハンドル・直線の中点のハンドルは頂点として扱わない）。**Phase 06-03での振る舞いの変化（発注者了承済み）**：塗りのない図形どうしの輪郭の重なる所、および選択集合の図形が複数当たる場合に、今までの奥（図形配列の先頭側）ではなく手前が選ばれるようになった。
    *   **ドラッグのライフサイクル**：左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）とパンの、押下から解放まで（開始ボタン・移動量閾値・追従/終了検知・中断・終了直後のclick抑止）は`DragTracker`が`window`へのcapture購読で一元管理する。ドラッグの意味の解釈（パン量・頂点変形・選択集合の平行移動・範囲選択）は`InputTracker`が行う。閾値判定のみスクリーン座標で行い、当たり判定・移動量・選択矩形はワールド座標で扱う。
    *   **範囲選択の流れ**：選択モードで空白を左ボタンで押下（頂点の選択モードは下の注記） → 閾値超過後、押下点と現在のカーソル位置で`VectorModel`の選択矩形を更新（描画は`CanvasManager`）→ 解放時に矩形を正規化し、各図形の`intersectsRect`をポリモーフィックに呼んで掛かった図形のidを求め、選択矩形を破棄する。選択集合へどう反映するかは`SelectionRules.resolveMarqueeSelection`（`Ctrl`なし＝掛かった図形で置き換える（0件なら全解除）、`Ctrl`あり＝既存の選択へ未選択のものだけ足す（0件なら選択を変えない。解除はしない））で、`InputTracker`は結果を`#applySelectionChange`で`model`へ渡すだけ。`Ctrl`を見るのは範囲選択の終了のイベント（確定の時点。途中で押す・離すは離した時点の`Ctrl`で決まる）。中断（blur・モード切替）時は選択矩形を破棄するのみで確定しない。**頂点の選択モード（Phase 08-02b）**：空白からでも図形の本体の上からでも始められ（図形は動かない）、確定では**図形の選択を変えず**（`intersectsRect`・`resolveMarqueeSelection`を呼ばない）、正規化した矩形（正規化は確定処理`#commitMarquee`の1箇所のまま）で`VertexHandleRules.collectVertexHandlesInRect`が選択集合の図形の頂点だけを集め、`SelectionRules.resolveVertexMarqueeSelection`（`Ctrl`なし＝集めた頂点で置き換える（0件なら空）、`Ctrl`あり＝未選択のものだけ足す（0件なら変えない））の結果を`#applyVertexSelectionChange`で`model`へ渡す。選択矩形の破棄と頂点の選択の変更で通知は最大2回。
    *   **クリックの解釈**：選択モードの`handleClick`。ハンドルの上は何もしない（`Ctrl`の有無によらない）。それ以外は`SelectionRules.resolveClickSelection`（`Ctrl`なし＝従来どおり（当たれば`setSelection([id])`・空白で選択があれば全解除）、`Ctrl`あり＝当たった図形が選択中なら外し未選択なら末尾へ追加、空白は解除しない）。`Ctrl`を見るのは`click`イベント（確定の時点）。**頂点の選択モードの`handleClick`（Phase 08-02b）**：頂点のハンドルの上は`SelectionRules.resolveVertexClickSelection`（`Ctrl`なし＝その頂点だけを選ぶ、`Ctrl`あり＝頂点の選択へ追加・解除）、頂点でなく`Ctrl`ありは`resolveClickSelection(…, true)`（図形の本体＝図形の選択へ追加・解除。**頂点の選択は空にしない**。空白＝何もしない）、頂点でなく`Ctrl`なしは頂点の選択を空にしてから図形のクリックの規則（従来どおり）。詳細は18.。選択モードの押下時の分岐の表（`handleMouseDown`が呼ぶ`core/PressActionRules.resolvePressAction`）は`Ctrl`で変えない（選択中の図形を`Ctrl`で押して閾値以内で離すと、直後の`click`で外れる。閾値を超えると移動する。2026-11-14 発注者の決定）。ホバー・カーソルも`Ctrl`で変えない。マウスのイベントで見る「`Ctrl`」はすべてmacOSの`⌘`を含む（`event.ctrlKey || event.metaKey`。`AltKeyGuard`が見る`Ctrl`は`event.ctrlKey`だけで、`⌘`を含まない）。
    *   **本体ドラッグの移動量**：押した位置`#moveOrigin`からの移動量を求め → `#resolveMoveDelta`で加工（**押した位置からの移動量を加工する唯一の箇所**。`Shift`が押されていれば`MoveDirectionRules.constrainMoveDirection`で横・縦・斜め45°の直線へ限定し、その後にスナップの丸め（`UnitSnapRules`。順序は移動量 → `Shift`の限定 → 丸め。`Ctrl`の間は丸めず、`Shift`の限定は効く。`Shift`時は限定した直線の上に保つ`roundConstrainedDeltaToUnit`で、45°では両軸が同じ量になる。3章17.））→ すでに反映した移動量`#appliedMoveDelta`との差分を`model.moveShapes`へ渡す（更新1回につき1回。差分0でも呼ぶ）。直前カーソルとの差分を積み上げない（公開フィールド`lastCursor`は廃止した）。`Shift`を見るのは追従のたびのイベント（`mousemove`・ドラッグ中の`wheel`の`shiftKey`。キーの購読は足さない）ため、途中で`Shift`を離すとカーソルの位置へ戻り、押すとその時点から限定される。`Shift`が効くのは本体・moveハンドルの移動だけ（頂点のハンドル・範囲選択・パン・弧・矩形・円の作成では何もしない）。例外として、直線・曲線のツールで線を引いている途中の付いてくる線の先も限定される（最後の点を基準に。2026-11-18 発注者の決定。曲線のツールにも同じ。Phase 09-01a。22.）。閾値分は閾値超過時の最初の更新でまとめて反映される。履歴の単位・click抑止・中断の扱いは変えない。
    *   **頂点のハンドルのドラッグ・図形の作成で打つ点（Phase 07-05）**：頂点のハンドルは、更新のたびに「ドラッグを始めた時点のそのハンドルの位置（図形の`getHandlePosition`で得る。`InputTracker`の作業用フィールド`#unitSnapHandleOrigin`）＋丸めた移動量」を頂点の目標にする（`Shift`は効かない。位置が得られなければ丸めない）。**Phase 08-02b**：この頂点は**アンカー（押した頂点）**で、アンカーの行き先を上のとおり丸めて求め、選んでいる頂点（アンカーを含む）すべてへ「アンカーの移動量（行き先−押下時の位置）」を各自の押下時の位置へ足した座標を渡す（`model.updateVertices`へ1回の呼び出し＝通知1回）。**アンカー自身には足し算を通さず行き先そのものを渡す**（`origin+(target−origin)`は浮動小数で`target`と厳密に一致しないため。頂点を1つだけ選んだときの結果を前半と完全に同じにする要点）。押下時に求めて記憶する作業用フィールド`#vertexDragOrigins`（各頂点の押下時の位置と頂点インデックス）を追従で使う。**端点への吸い付きは頂点を1つだけ選んでいるときだけ働く**（2つ以上では吸い付かず、スナップの丸めだけ働く）。図形の作成で打つ点（直線・曲線のツールでは打つ点のそれぞれ、ほかは描き始め・描いている途中の終点）は、端点へ吸い付かなかったときだけ座標を丸める（図形種別によらない）。`Ctrl`の間はどちらも丸めない。詳細は17.。
    *   **`Alt`+ドラッグ（複製して動かす）**：選択集合の本体・moveハンドルの押下で`#beginMoveSelection`が押した時点の`event.altKey`を`#duplicateOnMove`へ記憶する（頂点のハンドル・範囲選択では立てない。押した後の`Alt`は見ない）。閾値超過の`#onLeftDragStart`で`beginEdit()`の後に、注入された補助`duplicateSelection`（実体は`ClipboardController.duplicateInPlaceWithinEdit`。選択中の図形を同じ位置・新しいid・最前面で追加し複製だけを選択。記録しない・クリップボードを変えない）を呼び、以後の追従は複製を動かす（元の図形は元の位置に残る）。閾値以内で離したときは複製しない。履歴は閾値超過時の`beginEdit` → 複製 → 移動 → `#finishLeftDrag`の`commitEdit`で1件（入れ子にしない）。
    *   **スポイトの待ち受け中の入力**：待ち受けの持ち主は`edit/StyleEyedropper`（16.）。`InputTracker`は注入された補助`isPickingShape`・`pickShape`だけで関わり、スポイト・スタイルという言葉も図形のスタイルのプロパティも知らない。待ち受け中は、選択モード・IDLEの左ボタンの押下で何も始めず（中ボタン・`Space`・キャンバス移動モードのパンは働く）、`click`は当たった本体のidを`pickShape`へ渡して終わり（選択を変えない。`Ctrl`も見ない。空白では何もせず待ち受けが続く。ハンドルの判定より前）、カーソルは`'cell'`（パン中・`Space`押下中の`'grabbing'`・`'grab'`は優先）。`handleMouseMove`は変えない（ホバーの強調は待ち受け中も働く）。取り込んだ直後・`I`を押した直後のカーソルの形は、次にマウスを動かすまで前のまま（待ち受けの開始・終了ではカーソルを再評価しない。選択モード以外から`I`を押したときは、`ensureSelectMode()`の`setMode`が`'default'`へ変える）。
    *   **キーボード操作**：`Esc`・`Backspace`/`Delete`・`Ctrl`+`Z`は、直線・曲線のツールで線を引いている途中だけ意味が広がる（`Esc`＝描いた分を開いたまま残して終える、`Backspace`/`Delete`・`Ctrl`+`Z`＝最後の点を消す。対応表`SHORTCUT_BINDINGS`は変えず、注入された実体の側で切り替える。`Backspace`/`Delete`の実体は`inputTracker.deleteLastLinePointOrSelection()`。22.）。`document`の`keydown`は、`Space`を`InputTracker`（スペースパン）、それ以外のキーを`KeyboardShortcuts`が排他的に担当する（同一キーを二重に解釈しない）。数字キーとツールパレットの図形のボタンは、どちらも`main.js`の`selectShapeTool`（同一経路）を呼ぶ。`Z`・`X`・`C`（アウトライン・背景・グリッドの切り替え）は`ctrl`の値で`Ctrl`付きの取り消し・切り取り・コピーと排他的に区別される。`Tab`（フロートウィンドウをまとめて隠す/出す）は、ボタン・フォーカスなし（`body`）では実行され、テキスト入力扱いの欄（手順2）・色の欄（手順4）ではブラウザのフォーカスの移動になる。`Shift`+`Tab`は一致せずブラウザのフォーカスの移動（2026-11-13 発注者の決定）。ボタンとキーは同じ`displayState`のメソッドを呼ぶ（15.）。`keyup`は`Space`を`InputTracker`が購読し、`Alt`は`AltKeyGuard`が`keydown`・`keyup`を購読する（`Alt`キー自身のイベントで、`Ctrl`が押されておらずテキスト入力扱いの欄にフォーカスが無いときだけ`preventDefault()`して、`Alt`の単独押下・解放でブラウザのメニューへフォーカスが移るのを防ぐ。`AltGr`（`event.key`が`'AltGraph'`）・`Ctrl`同時・`Alt`+ほかのキーは対象外で奪わない。`KeyboardShortcuts`は`keyup`を購読せず、「`Alt`押下中は常に不一致」の規則も変えない）。Phase 08-02aで`A`（頂点の選択モードへ切り替え。`setMode`・`OperationMode.VERTEX`。`Shift`不可・リピート不可）を足した（`KeyA`は`ctrl`の値で`Ctrl`+`A`（全選択。`selectAll`）と排他的に区別される）。Phase 07-04で`Ctrl`+`I`（選択の反転）・`Ctrl`+`Shift`+`V`（同じ位置に貼り付け）・`D`（線を黒・塗りを白にする）・`I`（スポイト）を足した（`KeyV`・`KeyD`・`KeyI`は`ctrl`・`shift`の組で既存のキーと排他的に区別される）。**入力欄の規則**：テキスト入力扱いの`input`（太さの欄を含む）にフォーカスがあるときはスペースパンとすべてのショートカットが働かない。`type`が`checkbox`・`color`の`input`（色の欄）にフォーカスがあるときは、`Space`のパンをせず`preventDefault()`もしない（部品の標準動作＝チェックの切り替え・ピッカーを開く）、`Ctrl`なしのショートカットは働かず、`Ctrl`付きは働く。ON/OFFのボタン（`aria-pressed`を持つ`button`）にフォーカスがあるときも`Space`のパンをせず`preventDefault()`もしない（ボタンの標準の操作で切り替わる）が、`Ctrl`なしのショートカットは働く（`checkbox`・`color`の`input`とは異なる。2026-11-13 発注者の決定）。判定は`core/FocusKeyYieldRules.js`の`isTextInputElement`・`isSpaceOperatedInputElement`（部品のidに結びつけず`type`全般に当てる）と、`export`された関数`isSpaceYieldedElement`（`isSpaceOperatedInputElement`＋`isToggleButtonElement`。`InputTracker`のスペースパンの処理が呼ぶため公開。`isToggleButtonElement`は同ファイル内だけの非公開）。`KeyboardShortcuts`の手順4は`isSpaceOperatedInputElement`のまま（import元は`FocusKeyYieldRules.js`）。操作の実体は`main.js`から注入されたコールバック（`applyMode`/`applyShapeType`/`viewTransform`/`InputTracker`の公開メソッド（`Esc`だけは実体が`styleEyedropper.cancelPicking`で、`inputTracker.cancelDraftOrClearSelection`はその`fallback`として渡されるだけ。16.）/`performUndo`・`performRedo`/`ClipboardController`の`copy`・`cut`・`paste`・`pasteInPlace`・`duplicate`/`performInvertSelection`・`startEyedropper`・`shapeStyleEditor.resetColors`/`performJoin`/`performShapeOrder`（重なり順の変更。14.）/`displayState`の`toggleOutline`・`toggleBackground`・`toggleGrid`・`toggleFloatWindows`（15.）/`nudgeSelection`（実体は`nudgeEditor.nudge`。19.））で実行する。
4.  **座標系とビュー変換 (`ViewTransform.js`)**：図形データが保持する座標を「ワールド座標」、キャンバス要素の左上を原点とするCSSピクセル座標を「スクリーン座標」と呼ぶ。`スクリーン = ワールド × 倍率 ＋ オフセット`。原点は画面の左上ではなくキャンバス要素（キャンバスの領域）の左上。キャンバスの領域は定規（横は`--toolbar-height`の下、縦は左端。太さ`--ruler-size`）の分だけ狭い（`--canvas-area-top`・`--canvas-area-left`）。定規の位置はキャンバスのスクリーン座標の同じ軸の値にそろえてある。`ViewTransform.setView`（倍率とオフセットの一括設定。全体を画面に収めるが使う。15.）。`InputTracker.getScreenCoordinate`が`getBoundingClientRect`で差し引くため、キャンバスの領域が動いても入力の座標は変わらない（そのためキャンバスに枠線・内側の余白を付けない）。
    *   **入力**：`InputTracker`がマウスイベントからスクリーン座標を取得し、`ViewTransform.screenToWorld`でワールド座標へ逆変換して`VectorModel`・当たり判定へ渡す。パン量・ズーム中心はスクリーン座標のまま`ViewTransform`へ渡す。
    *   **描画**：`renderCurrentState()`が`viewTransform.getState()`を`CanvasManager.render()`へ渡し、`CanvasManager`がdprと合成した描画変換を毎回設定する。
5.  **作業データの変換・`?dev`の復元 (`DocumentSerializer.js` ⇔ `VectorModel.js`)**
    *   **変換**：`DocumentSerializer`が各図形の`toJSON()`から作業データを組み立てる。
    *   **図形インスタンスの生成**：`DocumentSerializer`のデシリアライズ（`ShapeFactory.fromJSON`→各図形クラスの`fromJSON`）。
    *   **`?dev`の「JSONから復元」の順序**：成功時のみ`InputTracker.abortOngoingOperation()` → `styleEyedropper.stop()`（スポイトの待ち受けをやめる。16.）→ `HistoryManager.beginEdit()` → `VectorModel.replaceAllShapes(shapes)` → `HistoryManager.commitEdit()`。中断を先に行うのは、ドラッグ中だった場合にその中断分を先に1件確定させるため。全体の読み込みに失敗したらキャンバスを変更せず、履歴にも記録しない。
    *   この順序は`?dev`の復元専用。キャンバスの切り替えは8.（履歴を消す）、貼り付け等は`ShapeInserter.insertDocument`（7.）を通る。
6.  **履歴（取り消し・やり直し） (`InputTracker.js`・`edit/ShapeInserter.js`・`main.js` → `HistoryManager.js`)**：編集操作（図形一式を変化させる利用者の1回の操作）の前後の図形一式を丸ごと記録するスナップショット方式。スナップショットは`{ document: 作業データ, selectedIds: 選択集合 }`。取得・適用の実体は`edit/SnapshotAdapter`（`HistoryManager`へ`capture`/`restore`として注入）。
    *   **記録の規則**：変更処理を`HistoryManager.beginEdit()`と`commitEdit()`で挟む。`model.onChange`ごとの記録はしない。後続の編集操作も挟むだけで履歴の対象になる。前後の作業データ部分の`JSON.stringify`が一致する場合（閾値以内のクリック・元の位置へ戻したドラッグ等）は記録せず、やり直しの履歴も破棄しない（選択集合は比較しない）。
    *   **記録する操作と時点**：
        *   図形の作成：`InputTracker.handleClick`の`DRAWING`確定時、`model.commitDraft()`の前後。直線・曲線のツールでは、`InputTracker`の`DRAWING`のクリック・`Esc`・ツールの切り替えで線を終えたときに`EndpointSnapper`の中で1回の終わり方につき1件（吸い付きなし＝`model.replaceDraft` → `beginEdit` → `model.commitDraft()` → `commitEdit`、描き足し・つながり・閉じる＝`cancelDraft` → `beginEdit` → `model.replaceShape` → `commitEdit`。何も起きない場合は記録しない。点を打つ・最後の点を消すは記録しない。12.・22.）。
        *   削除（削除ボタン・`Delete`/`Backspace`（線を引いていないとき。線を引いている途中は最後の点を消す）。22.）と切り取り（`Ctrl`+`X`）：`InputTracker.deleteSelection()`の受理時、`model.deleteShapes(ids)`の前後。
        *   本体ドラッグ・moveハンドルによる移動、ハンドルによる変形：閾値超過時に開始し、ドラッグの終了・中断の共通後始末で確定。中断（`blur`・モード切替・`abortOngoingOperation()`）で残った変化も1件として記録する（記録しないと次の編集操作の前の状態に混ざり、単独で取り消せなくなるため）。端点のハンドルを吸い付いた状態で離した場合の結合・閉じるは、同じ1件の中で`#finishLeftDrag`の確定の前に行う（12.）。
        *   `?dev`の「JSONから復元」：5.の順序。
        *   矢印キーでの微調整（Phase 08-03。19.）：`NudgeEditor.nudge`で、`model.moveShapes`（選択中の図形）または`model.updateVertices`（選択中の頂点）の前後。動かす対象がないときは`beginEdit`も呼ばない。**`commitEdit`へ「まとめの鍵」を渡す**（鍵を渡すのは`NudgeEditor.nudge`だけ。他の呼び出し元は引数なしのまま。Phase 08-04：位置の数値入力（20.）は`NudgeEditor.nudgeWithoutGrouping`で、同じ`beginEdit`→移動→`commitEdit()`を鍵なしで行う）。
        *   結合（結合ボタン・`J`）：`PathJoiner.join`で、`model.replaceShape`の前後。結合できない選択では記録しない（11.）。
        *   貼り付け・複製（`Ctrl`+`V`／`Ctrl`+`D`）・同じ位置に貼り付け（`Ctrl`+`Shift`+`V`）・インポート：`ShapeInserter.insertDocument`で、`model.addShapesWithNewIds(shapes)`の前後。追加0件では記録しない。
        *   `Alt`+ドラッグ：閾値超過時の`beginEdit`の後に複製（`ShapeInserter.insertDocumentWithinEdit`。`beginEdit`/`commitEdit`を呼ばない記録しない入口で、開いている編集操作の中で呼ぶ）→ 移動 → 確定の1件（3.）。
        *   `D`・スポイトの取り込み（`ShapeStyleEditor.applyStyle`。13.・16.）：選択中の図形があるときだけ`model.updateShapeStyles`の前後で1件（変わらなければ記録しない）。
        *   整列・分布（Phase 08-05。オプションバーの整列・分布のボタン。21.）：`ShapeAlignEditor.apply`で、`model.moveShapesBy`の前後。動く図形が無い操作（すでにそろっている・図形の数が足りない）では`beginEdit`も呼ばない。**鍵なし**（`commitEdit()`。1回の操作が取り消し1件）。
        *   重なり順の変更（オプションバーの重なり順のボタン・`Home`/`PageUp`/`PageDown`/`End`）：`ShapeOrderEditor.apply`で、`model.reorderShapes`の前後。並びが変わらない操作では記録しない（14.）。
        *   オプションバーのスタイルの変更（`ShapeStyleEditor`。13.）：ON/OFFのボタン・太さは`model.updateShapeStyles`の前後。色の欄はピッカー操作中は記録せず図形へ反映し、確定（`change`・`blur`・`keydown`・他の変更）のときに開始時の色へ戻してから`beginEdit` → 最後の色 → `commitEdit`の1件（図形が入れ替わっていれば捨てる）。
    *   **記録しない操作**：直前に使った値の変更、選択中の図形が無いときのオプションバーの変更（`D`・スポイトの選択なしを含む）、範囲選択・クリック選択（`Ctrl`+クリック・`Ctrl`+範囲選択を含む）・全選択・選択の反転（`Ctrl`+`I`）・選択解除・スポイトの待ち受けの開始/終了・ホバー・パン・ズーム・ビューのリセット・表示の切り替え（アウトライン・背景・グリッド・パレットを隠す/出す）・全体を画面に収める・操作モード/図形種別の切り替え、作成途中の図形の開始・破棄、線を引いている途中の点を打つ・最後の点を消す、コピー、出力（作業ファイル・エンジン用）、開く（ファイル）・キャンバスの切り替え。
    *   **まとめの鍵（Phase 08-03。`HistoryManager.commitEdit(groupKey)`の省略できる引数。位置の数値入力は渡さない＝20.）**：同じ鍵で続けて記録された編集操作を、新しいエントリを足さず**直前の1件へ畳む**（`before`はまとまりの先頭のまま、`after`だけを更新）。続けた矢印キーを取り消し1件にするための入口で、`HistoryManager`は鍵の中身を解釈しない（図形・操作を知らない）。まとめの区切りの判断は`HistoryManager`の中だけで完結し、呼び出し側は「まとまりが開いているか」を持たない（`beginEdit`と`commitEdit`の対を崩さないため）。
        *   **畳む条件**：鍵が空でない文字列で、直前に記録したエントリの鍵と同じで、位置 > 0（取り消せるエントリがある）。覚えている鍵は直前に記録したエントリの鍵1つだけ。
        *   **往復で消える**：畳んだ結果、`before`と`after`の作業データが同一（動かして元へ戻った）なら、そのエントリを取り除き位置を1つ戻して鍵を忘れる（鍵を残すと、次の同じ鍵の記録が**さらに前の無関係なエントリへ畳まれ**、その`after`が壊れるため。発注者の決定ではなく計画の設計判断）。
        *   **鍵を忘れる契機**：`undo`・`redo`・`clear`・鍵なし（省略・空文字列）または別の鍵での記録・上記の往復で取り除いたとき。不変条件：鍵を覚えている間は常に「位置＝エントリ数」（直前に記録したエントリが末尾で、やり直しの履歴が無い）で、畳む処理はこれに依存してやり直しの履歴の破棄・`HISTORY_LIMIT`の判定を行わない。前後が同じで記録しなかった`commitEdit`は鍵を変えない。
        *   **通知**：畳んだとき・往復で取り除いたときも`historyManager.onChange`を通知する（ボタンの可否と自動保存の契機のため）。戻り値は「履歴に記録として残ったか」（新しいエントリ・畳んで残ったエントリ＝`true`、前後が同じ・往復で消えた・`beginEdit`なし＝`false`）。既存の呼び出し元は戻り値を使っていない。
    *   **適用の流れ**：ショートカット（`Ctrl`+`Z`／`Ctrl`+`Y`・`Ctrl`+`Shift`+`Z`）とボタン（`#history-undo`／`#history-redo`）は、どちらも`main.js`の`performUndo()`／`performRedo()`を呼ぶ（`historyManager.undo()`/`redo()`を直接呼ばない）。
        1.  ドラッグ中（`inputTracker.isDragging()`）なら不受理。
        1b. （取り消しのみ）`inputTracker.removeLastLinePoint()`が真（直線・曲線のツールで線を引いている途中の最後の点を消した）ならそこで終了し、履歴を変化させない。
        2.  `inputTracker.abortOngoingOperation()`。取り消しは、作成途中の図形（直線・曲線のツール以外＝弧・矩形・円。直線・曲線のツールの作成途中の線は1b.で扱う）を破棄した場合はそこで終了し履歴を変化させない。やり直しは破棄したうえで続行する（線を引いている途中のやり直しでも点は戻さず、線を捨てる）。
        3.  `HistoryManager.undo()`／`redo()` → 注入された`restore`＝`SnapshotAdapter.restore(snapshot)`。
        4.  `DocumentSerializer.deserialize`。失敗・スキップ1件以上なら`console.warn`してキャンバスを変更せず、履歴の位置も動かさない。
        5.  `model.replaceAllShapes`。
        6.  注入関数`shouldRestoreSelection()`が真（実体は`main.js`の「選択モード・頂点の選択モードのときのみ」。Phase 08-02aで広げた）のときのみ`model.setSelection(snapshot.selectedIds)`。
    *   **戻り値**：ドラッグ中でなければ、履歴がなくても受理（`true`）を返し、ブラウザ標準の動作を抑止する。
    *   **適用後の選択集合**：記録時点のもの（前の状態＝操作開始時、後の状態＝操作完了時。選択モード・頂点の選択モード以外では空）。
    *   **適用時の通知**：`model.onChange`（選択モードでは2回、それ以外では1回）→`historyManager.onChange`（1回）。
    *   **履歴のリセット**：`HistoryManager.clear()`の呼び出し元は`CanvasLibrary`の切り替え処理（8.）のみ。キャンバスを開く・開く（ファイル）・新規作成・削除後の切り替え・起動時の復元で履歴を空にする。切り替えそのものは編集操作として記録しない（`beginEdit`/`commitEdit`を呼ばない）。
7.  **コピー・貼り付け・複製 (`KeyboardShortcuts.js` → `main.js` → `ClipboardController.js` → `ShapeInserter.js` → `VectorModel.js`)**：`Ctrl`+`C`／`X`／`V`／`D`と`Ctrl`+`Shift`+`V`（同じ位置に貼り付け）で操作する（ボタンはない）。段数・ずらし量の規則は`ClipboardController`のクラスJSDoc。
    *   **クリップボード**：アプリ内部（メモリ上）。OSのクリップボードは使わない。作業データ形式で保持するため図形インスタンスを参照しない。履歴の対象外。インスタンスは`main.js`が1つだけ生成し、キャンバスを切り替えても消えない（ページの再読み込みで空になる）。
    *   **コピー・切り取り**：選択集合の図形を描画順で`serialize`して記録する。切り取りは先に`serialize`したうえで唯一の削除経路`InputTracker.deleteSelection()`（`main.js`が注入）を呼び、受理された場合のみクリップボードを置き換える。選択集合が空（選択モード以外を含む）なら何もせず`false`を返し、`preventDefault()`しない（ページ上の文字の標準のコピーを妨げないため）。
    *   **貼り付け・複製**：貼り付けはクリップボードの内容を、複製は選択集合の図形を`serialize`した作業データを（クリップボードを経由せず）、`ShapeInserter.insertDocument`へ渡す。追加した図形は毎回新しいインスタンス・新しいidで最前面へ追加され、追加した図形だけが選択される。
    *   **同じ位置に貼り付け**（`Ctrl`+`Shift`+`V`）：`ClipboardController.pasteInPlace`。クリップボードの内容を（ずらさず）`ShapeInserter.insertDocument(documentData, 0, 0)`へ渡す。段数を読まず・変えない（続けて`Ctrl`+`V`すると1段ずれて貼り付く）。クリップボードが空なら何もしない。
    *   **`Alt`+ドラッグの複製**：`ClipboardController.duplicateInPlaceWithinEdit`（選択集合を`#serializeSelection`で作業データにし、記録しない`ShapeInserter.insertDocumentWithinEdit(…, 0, 0)`で同じ位置に追加）。クリップボードの内容・段数を変えない。呼ぶのは`InputTracker`の注入された補助だけ（3.）。
    *   **選択モード以外での貼り付け**：`paste`・`pasteInPlace`のコールバックは共通の前処理`performPaste(pasteDocument)`（`main.js`）を通る：クリップボードが空なら何もしない（モードも切り替えない）。空でなければ`ensureSelectMode()`（選択モード以外のとき先に`applyMode(OperationMode.SELECT)`で切り替える。作成途中の図形は`setMode`の強制中断で破棄される。全選択・選択の反転・スポイトの開始も同じ前処理を使う）→ 貼り付けの手順。コールバックは常に`true`を返す。選択の状態での貼り付けは`applyMode`を通らないため、スポイトの待ち受けは続く。
    *   **`insertDocument`の前提**：進行中の入力操作の中断・モード切り替えは行わない（呼び出し側の責務）。
8.  **キャンバス管理（自動保存・切り替え） (`CanvasPalette.js` → `main.js` → `CanvasLibrary.js` → `CanvasStorage.js`・`DocumentSerializer.js`・`VectorModel.js`・`HistoryManager.js`)**：受理判定と処理本体は`CanvasLibrary`が担う。細則の正本は`CanvasLibrary`のクラスJSDoc（手順・`#isSwitching`・削除・直列化・`Promise`・`issue`の種類と解除条件）。本節は主にモジュールをまたぐ流れを書く。
    *   **表示の同期**：開いているキャンバスの名前の表示・ページのタイトル・覆い要素は`canvasLibrary.onChange`の通知で`canvasLibrary.getState()`から同期する。パレットの一覧は`canvasFileOperations.onChange`（`canvasLibrary.onChange`の転送を含む1経路）で`canvasFileOperations.getState()`から同期する。
    *   **自動保存**：
        *   契機は`historyManager.onChange`のみ（`model.onChange`は使わない）。選択の変更・ホバー・パン・ズーム・作成途中の図形の開始/破棄・ドラッグ中の途中経過では保存しない。
        *   通知のたびに待ち時間を張り直し、最後の通知から待ち時間後に1回、開いているキャンバスの記録全体を書き込む。
        *   予約しないのは、開いているキャンバスが無い（読み込み完了前）・`'unavailable'`・`#isSwitching`のとき。
        *   保存の作業データは書き込みの呼び出し時点で同期的に取得する。予約時点のキャンバスと開いているキャンバスが一致する場合のみ、そのキャンバスの記録へ書く。
    *   **ページ非表示時の確定**：`main.js`が`document`の`visibilitychange`（`hidden`のとき）と`window`の`pagehide`で`canvasLibrary.flushPendingSave()`を呼ぶ（`CanvasLibrary`自体は`document`・`window`のイベントを購読しない）。作業データの取得と書き込みの開始はハンドラ内で同期的に行われる。
    *   **保存に失敗した変更**：利用者が明示的に捨てない限り失わない（発注者の決定）。
        *   失敗した変更は保留のまま残り、次の編集・切り替え・ページ非表示時に書き込みを再試行する。タイマーでの自動再試行はしない。
        *   失敗する限り、開く・開く（ファイル）・新規作成は切り替えを中止する。変更を捨てて移るための確認の小窓は無い（発注者の決定）。逃げ道は出力（作業ファイル）、再読み込み・タブを閉じるときのブラウザの確認、開いているキャンバスの削除（確認の小窓が明示的に捨てる操作に当たる）。
        *   再読み込み・タブを閉じるとき：`main.js`が`window`の`beforeunload`で`canvasLibrary.hasUnsavedChanges()`が真なら`preventDefault()`する。
        *   新規作成・開く（ファイル）で新しい記録を書けないとき：`CanvasLibrary` → 注入された`confirmOpenUnsaved`（実体`canvasPalette.confirmOpenUnsaved()`。文言と`window.confirm`はパレット）で確認する。「いいえ」は作らず今のキャンバスのまま（ファイルの中身はファイルに残る）。「はい」は記録の無いまま開き、保存できるまで別のキャンバスへは移れない。起動時・削除後は開く先が他に無いため確認せずに開く。
    *   **切り替え処理の順序**：開く・開く（ファイル）・新規作成・開いているキャンバスの削除後の切り替え・起動時の復元が共通して通る。手順の番号と細則はクラスJSDoc「■ 切り替え処理」。起動時の復元・削除後の切り替えは読み込みから入り、確定手順を通らない。
        *   モジュールをまたぐ順序：`prepareSwitch()`（実体`applyMode(OperationMode.SELECT)`）→ 切り替え前の保存の確定（`flushPendingSave()`）→ 切り替え先の読み込み（`CanvasStorage`・`DocumentSerializer`）→ もう一度`prepareSwitch()`のうえ保留・書き込み中の保存が無くなるまで確定（確定手順）→ `await`を挟まずに`model.replaceAllShapes` → `historyManager.clear()` → `resetView()` → 開いているキャンバスの更新と変更通知。
        *   中止しても最初の`prepareSwitch()`の副作用は残る（選択モードへの切り替え・選択解除・作成途中の図形の破棄）。
        *   クリップボードには触れない。
    *   **非同期保存と切り替えの順序の保証**：次の3点により、切り替え前のキャンバスの記録を切り替え後の内容で上書きすることも、切り替え後のキャンバスの記録へ切り替え前の内容を書くことも起きない。
        *   `CanvasStorage`はすべての書き込みのトランザクションを呼び出し時点で同期的に生成し、IndexedDBはそれを生成順に実行するため、書き込みは呼び出し順に反映される。
        *   切り替え前の保存の確定と確定手順で、図形一式の入れ替え前に保留中の保存を確定する。
        *   保存の作業データの同期取得と、予約時点のキャンバスとの一致の確認（上記「自動保存」）。
    *   **名前の変更**：一覧の任意のキャンバスが対象。保存先へは名前のみを書き、最終更新日時は更新しない（一覧の並びが入れ替わると押そうとした行が動いて紛らわしいため）。
    *   **削除**：一覧の任意のキャンバスが対象（確認の小窓は`CanvasPalette`）。
        *   開いていないキャンバス：開いているキャンバス・図形一式・履歴・自動保存に触れない。
        *   開いているキャンバス：進行中の入力操作の中断 → 保留中の保存の破棄（確定しない）→ 予約の停止（`#isSwitching`）→ 記録の削除。成功したら残りを最終更新日時の新しい順に試して開く（無ければ新しい空のキャンバス）。失敗したら中止して開いているキャンバスのままとし、自動保存を予約し直す。
        *   記録の削除に成功してから切り替えが完了するまでは、`openCanvasName`が`null`で、`openCanvasId`は一覧に無いidを指す。
    *   **処理中の直列化**：ファイルの読み取り中は`CanvasFileOperations`の処理中によりパレットの全操作が押せなくなる。処理中もキャンバスの編集は止めない（確定手順で整合を取る）。
    *   **保存・読み込みの問題（`issue`）**：アプリは停止せず、最後に起きた問題を1つだけ保持する。種類と解除条件はtypedef`CanvasIssue`。キャンバスパレットの文言（`CanvasPalette`の`ISSUE_MESSAGES`）と、保存の問題（`'unavailable'`・`'writeFailed'`）ではステータスバーのキャンバス名の先頭の`⚠ `で示す。`'unavailable'`でも出力（作業ファイル・エンジン用）・インポートは使える（インポートは履歴に記録されるが保存されない）。
9.  **ファイル入出力（出力（作業ファイル）・出力（エンジン用）・開く（ファイル）・インポート） (`CanvasPalette.js` → `main.js` → `CanvasFileOperations.js` → `DocumentFileIO.js`・`FileContentReader.js`・`DocumentSerializer.js`・`SpriteSerializer.js`・`CodeExporter.js`・`CanvasLibrary.js`・`ShapeInserter.js`・`VectorModel.js`)**：`CanvasFileOperations`（DOMに触れない）が手順の組み立てと通知の状態を担う。ブラウザAPI（`Blob`・`File`）は`DocumentFileIO`（`CanvasFileOperations`へ注入。作業データの中身は解釈しない）に閉じる。読み込みの判定の表・通知の解除条件の正本は`CanvasFileOperations`のクラスJSDoc。
    *   **用語**：**出力（作業ファイル）**（コード上は`exportCanvas`）＝開いているキャンバスを作業データファイルとしてダウンロードする。**出力（エンジン用）**（`exportSprite`）＝開いているキャンバスをスプライトのJS（`<名前>.js`）としてダウンロードする。**開く（ファイル）**＝ファイルを新しいキャンバスとして一覧へ登録し、開いているキャンバスと入れ替える（一覧の行を押す`openCanvas`とは別）。**インポート**＝ファイルの図形を開いているキャンバスへ追加する。
    *   **出力（作業ファイル）**：`serializeToString(model.getShapes())`を`DocumentFileIO.downloadText`へ渡す。図形・選択集合・履歴・ビュー変換・操作モードに触れず、`beginEdit`/`commitEdit`も呼ばないため自動保存の契機にならない。
    *   **出力（エンジン用）**：形式を選ぶ小窓は出さない。受理条件・通知の消去は出力（作業ファイル）と同じ。`SpriteSerializer.serialize(model.getShapes())` → `CodeExporter.toModuleText`でJSのテキストを組み立て → `DocumentFileIO.downloadSpriteModule`の1回。組み立ての失敗ではダウンロードしない。失敗は通知`spriteExportFailed`。図形・選択集合・履歴・ビュー変換・操作モードに触れず、`beginEdit`/`commitEdit`も呼ばないため自動保存の契機にならない。成功時は通知を出さない。スプライトの形は2章「スプライト（書き出し形式）」。
    *   **開く（ファイル）**：読み取り → `FileContentReader.deserializeFromText`（作業データファイル・スプライトのJS。スプライトのJSONは読み込み不可。規則は2章「エディタで開くときの規則」）→ 判定 → 読めた場合のみ`CanvasLibrary.createCanvasFromShapes(toCanvasName(ファイル名), 読めた図形)`（切り替え処理をすべて通る。編集操作として記録しない）。`issue`は`'partialLoad'`にせず、一部が読めない旨は通知`partialRead`で示す。
    *   **インポート**：読み取り → `FileContentReader.deserializeFromText` → 判定 → キャンバスの同一性の確認（読み取り中に開いているキャンバスが変わっていない・読み込み中でない・処理中でない。`canvasLibrary.getState()`の値で判定する）→ `prepareInsert()`（実体`applyMode(OperationMode.SELECT)`）→ `ShapeInserter.insertDocument(serialize(読めた図形), 0, 0)`。読めた図形を`serialize`し直して渡すのは、`insertDocument`内の再`deserialize`でスキップの`console.warn`が重複しないため。失敗・図形0個では図形一式・選択集合・履歴・操作モード・作成途中の図形に一切触れない。
    *   **ファイル操作の通知**：`fileNotice`は`CanvasFileOperations`が1つだけ保持し、`getState()`でパレットへ渡す。`CanvasLibrary`の`issue`には種類を足さない（解除条件が異なるため）。互いに隠さず別々に表示する。
    *   **読み取り中**：`getState().busy`が真になり、パレットの全操作が押せなくなる。図形の編集（キャンバス操作・ショートカット）は止めない。
    *   **ファイル名とキャンバス名の変換**：`DocumentFileIO`が拡張子（作業データファイル`.ozve.json`・スプライト`.js`）と使えない文字・スプライトの先頭の`_`を扱う（規則は2章「ファイル名の規則」。開くときはスプライトの`.js`も除く）。長さの切り詰め・空の場合の「無題 n」は`CanvasLibrary`が名前の変更と同じ規則で行う。
    *   **旧版のファイル**：読み込みは必ず`FileContentReader.deserializeFromText`を通し、作業データ（スプライトの`source`を含む）は`DocumentSerializer.deserialize`で読む。`DocumentFileIO`・`CanvasFileOperations`・`CanvasLibrary`・`CanvasPalette`は版の知識もスプライト形式の知識も持たない。
10. **確認用ページ（`sprite-check.html`） (`SpriteCheckPage.js` → `SpriteCheckInspector.js`・`SpriteCheckCanvas.js`・`io/SpriteSerializer.js`（`SpriteCheckInspector`経由）)**：書き出したスプライトを、エディタの状態とは無関係に「読み込み→描画」で確かめる別ページ。`index.html`・`main.js`・`edit/`とは状態を共有しない。ページの役割・要素・注意点は`_doc/arch/17_sprite_check.md`。
    *   **流れ**：ファイル選択（1ファイル。選択直後に`input`の値を空に戻す）→ `File.text()` → `SpriteCheckInspector.parseText`でJSONかを中身で判定 → JSONなら`import`を試みず`notSprite`として表示／JSならテキストのままBlob URL（`type: 'text/javascript'`）の動的`import`（成否にかかわらず`finally`でURLを解放）→ 既定のexportを`inspectModuleExport`で判定 → `summarize`で要約 → 描画（背景 → 外枠 → 原点の印 → `draw`）と情報欄の表示。
    *   **選び直しの競合**：読み込みごとに連番を振り、`await`の後で連番が最新でなければ結果を捨てる（遅れて終わった前のファイルの結果で新しい表示を上書きしない）。
    *   **失敗時**：ページは止めず、前の表示（絵・外枠・情報欄）を消してファイル名と「読み込めませんでした：」＋理由を出す。理由の区分は`readFailed`・`notSprite`・`unsupportedVersion`・`importFailed`・`drawFailed`（文言の唯一の定義箇所は`SpriteCheckPage`。`notSprite`はJSONを選んだ場合も含む）。詳細は`console.warn`。
    *   **ウィンドウの大きさの変化**：`window`の`resize`で描画領域の大きさを合わせ、表示中のスプライトがあれば`draw`をもう一度呼んで描き直す（`draw`が例外を投げたら`drawFailed`として表示を消す）。

11. **結合（選択中の線の結合） (`index.html`の`#selection-join`（ツールバー）・`KeyboardShortcuts.js` → `main.js` → `edit/PathJoiner.js` → `shapes/PathJoinRules.js`・`VectorModel.js`・`HistoryManager.js`)**：選択モードで選んだ線（直線・開いたパス）を結合する。開いたパス1本（頂点3つ以上）は閉じたパスになり、線2本は1本の開いたパスになる。
    *   **流れ**：ボタン`#selection-join`／キー`J` → `main.js`の`performJoin()`（ドラッグ中は不受理。ボタンとキーは`performJoin()`を呼ぶのみで`pathJoiner.join()`を直接呼ばない）→ `PathJoiner.join()` → `PathJoinRules.planJoin(重なり順の選択図形, 画面上5pxのワールド換算)` → `HistoryManager.beginEdit` → `model.replaceShape` → `commitEdit`。結合できない選択では何もせず記録しない。結合は1件の編集操作で、Undo1回・Redo1回で往復する（6.）。
    *   **押せる/押せないの同期**：`model.onChange`に登録した`syncJoinButtonState`が`PathJoiner.canJoin()`でボタンの`disabled`を更新する。`canJoin`は表示倍率を見ない（受理する選択かの判定のみ）。
    *   **発注者の決定**：
        *   基準の線A＝重なり順で奥の図形。結果の向き・色・太さ・塗り（`fillColor`）はAのもの。開いたパスを結合で閉じると塗れる形になるため、持っていた塗りが現れる（直線の`fillColor`は描かれないが結果のパスに引き継がれる）。
        *   2本の結合は、Aの位置に新しいidで結果を置き、Bを除く。閉じるは元のidと位置を保つ。
        *   端点が重なっている＝画面上5px以内（ちょうどを含む）。結合を行う時点の表示倍率でワールドの長さへ換算する（`main.js`が`screenLengthToWorld`を注入）。重なる端点は1つにまとめ、離れていればそのまま区間でつなぐ。
        *   結合後は結果の図形だけを選択する。
    *   **結合できる線**：直線、または開いたパス（区間の種類によらない。曲線のパスを含む。Phase 09-01bで広げた）。`isJoinableLine`が`isDrawnLineShape`（続けて引く線の形。22.）に任せる1か所の判定。
    *   **区間の種類（Phase 09-01b）**：結果は元の各区間の種類を保つ。Bを逆順にするときは区間の種類も逆順（形は変わらない）。端点が重なりまとめるときは、除いた端点につながっていた区間の種類を保つ。**間を埋める区間**の種類＝結合のボタン・`J`では直線（`JOIN_GAP_SEGMENT_KIND`。閉じる区間も直線。発注者の決定 2026-11-19）、線を描いて終えたとき（`planDrawnLineJoin`）は描いた区間の種類、端点のドラッグでは端点が重なるため生じない。閉じるで両端が重なれば閉じる区間は最後の区間の種類のまま（全区間が曲線なら1周なめらかな輪）。直線の区間と曲線の区間のつなぎ目は角（09-01aの決定）、曲線の区間どうしのつなぎ目はなめらか（発注者の決定 2026-11-19）で、確定した瞬間につなぎ目の近くの形が少し変わるのは許容（描いている間に元の線を含めた形を見せる仕組みは作らない）。
    *   **やらないこと**：自動で閉じない（2本の結合の結果の両端が重なっていても閉じない）、3本以上の結合、今の曲線（`curve`）・矩形・円・弧・閉じたパスの結合、閉じたパスを開く。
    *   **規則の詳細の正本**は`PathJoinRules.js`のJSDoc（端点の組の優先順・まとめ方の手順）。規則の関数は表示倍率を知らないため、`tolerance`は呼び出し側がワールドの長さへ換算して渡す。`InputTracker`の`hitTolerance`は同じ5pxだが別の定義。
    *   **端点を指定する入口（Phase 05-04）**：公開の`buildJoinedPathAt`（つなぐ端点を指定して結合）・`buildExtendedPath`（描き足し）・`canCloseByMergingEnds`（もう一方の端点へ重ねて閉じられるか）・`planDrawnLineJoin`（直線・曲線のツールの描き終えの計画。省ける第6引数`drawnKindSource`で描いた区間の種類を読む作成途中の線を受け取る）・`planEndpointDragJoin`（ハンドルのドラッグの計画）を、`JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`buildJoinedPath`・`buildClosedPath`と同じ規則・同じ組み立て関数で実装している（規則を二重に書かない）。`buildClosedPath`・`buildJoinedPathAt`・`buildExtendedPath`は間を埋める区間（描き足す区間）の種類を省ける末尾の引数で受け取る（既定は直線）。
    *   **描き足しの規則**：描き足す区間は描いた区間の種類。元のid・色・太さ・塗り（`fillColor`）・重なり順の位置を保つ。元の線の向きを保つ（描いた線の向きは使わない）。足す頂点が端点と重なる（`tolerance`以内）場合は何も起きない。
    *   **吸い付きでの結合**：つなぐ端点は吸い付いた端点であり、いちばん近い端点の組ではない（`planJoin`の優先順とは別）。結果の扱い（基準の線A・向き・色・太さ・塗り・idの扱い）は選択の結合と同じ。

12. **端点への吸い付きと描き足し (`InputTracker.js` → `edit/EndpointSnapper.js` → `shapes/EndpointSnapRules.js`・`shapes/PathJoinRules.js`・`VectorModel.js`・`HistoryManager.js`、表示は`VectorModel`の吸い付きの表示の点 → `main.js`の`renderCurrentState` → `CanvasManager.js`)**：直線・曲線のツールで描くとき、および頂点の選択モードで線の端点のハンドルをドラッグするとき、結合できる線の端点へ吸い付き、吸い付いた端点で描き足し・結合・閉じる操作を行う。吸い付いている端点には中を青で塗った正方形を表示する。
    *   **モジュールの分担**：規則＝`EndpointSnapRules`（対象・距離・候補の選び方）と`PathJoinRules`（結果の組み立て・計画）。手順＝`edit/EndpointSnapper`（照会とモデルへの反映）。配線＝`InputTracker`（注入された`EndpointSnapper`を呼ぶだけ。候補の探索・距離の判定・結果の組み立てを持たず、描く図形種別と端点のハンドルの判定も`EndpointSnapper`に委ねる）。表示の状態＝`VectorModel`の吸い付きの表示の点。描画＝`CanvasManager`（`render`の`snapPoint`）。線を引く手順・点の並びの規則・`replaceDraft`は22.の「モジュールの分担」を参照。
    *   **流れ（直線・曲線の描き始め）**：図形作成モード・IDLEのmousemoveで照会して表示 → クリックで描き始めるとき、クリック位置で照会した結果を保持して表示し、吸い付いていれば端点の座標から`startDraft`（吸い付かなければスナップがONで`Ctrl`なしなら丸めたクリック位置。17.）。
    *   **流れ（描いている途中。直線・曲線のツール）**：直線・曲線のツールの線を引いている途中は、クリックごとに点を打つ別の流れ（22.）。mousemoveの照会は`findDrawnLineSnap`（描き始めの端点を除き、打った点が3つ以上で描き始めが端点でなければ自分の始点も対象。始点の結果は`kind: 'drawnStart'`で区別し、`commitDrawnLine`・`joinDraggedEndpoint`へは渡らず`clickDrawnLine`が先に扱う）。保持（描き終えの端点）・表示 → 付いてくる線の先を吸い付いた端点の座標（なければカーソル位置。スナップがONで`Ctrl`なしなら丸めた位置。`Shift`なら最後の点を基準に限定した位置。17.）に追従。
    *   **流れ（描いている途中。直線・曲線のツール以外＝弧・矩形・円）**：mousemoveごとに照会 → 保持（描き終えの端点）・表示 → 作成途中の終点を吸い付いた端点の座標（なければカーソル位置。スナップがONで`Ctrl`なしなら丸めた位置。17.）に追従。（弧・矩形・円の`DRAWING`の`mousemove`も`findDrawSnap(this.currentShapeType, point)`を呼んで照会するが、`isSnapDrawShapeType`が`'line'`・`'curve'`でないとき`null`を返すため吸い付かない。線を引いている途中（`isDrawingLine`）は別の経路で`findDrawnLineSnap`を呼ぶ。）
    *   **流れ（描き終え）**：直線・曲線のツールの線は、22.のクリックの判定の順の3.（描き終えの端点へ吸い付いている＝`endSnap`が`null`でない）のときだけ`EndpointSnapper.commitDrawnLine(描き始めの結果, 描き終えの結果)`を呼ぶ（点が1つなら従来の2クリックの直線の描き終えと入力も結果も同じ。点が複数なら途中の点も含めた計画）。描き終えの端点は**直前のmousemoveの照会結果**を使う（クリック位置で取り直さない。従来も終点は直前のmousemoveの位置で確定しており、取り直すと吸い付きなしの直線の終点が変わるため）。`commitDrawnLine`の中で両方`null`なら何もしない（従来の確定`commitDraft`は直線以外のツールの`handleClick`で、`commitDrawnLine`が何もしなかったときに起きる）。それ以外は作成途中の直線を捨て、`beginEdit` → `model.replaceShape` → `commitEdit`（描き足し・結合・閉じる）。計画が何も起こさない場合（同じ端点・頂点2つの線の閉じる・足す頂点が端点と重なる）は記録せず作成途中の直線を捨てるだけ。
    *   **流れ（端点のハンドルのドラッグ）**：ドラッグ開始時に`resolveDragEndpoint`でドラッグ中の端点を解決（端点のハンドルでなければ`null`で吸い付かない）。更新のたびに`findDragSnap`（ドラッグ中の端点を除く）→ 表示 → 頂点を吸い付いた端点の座標（吸い付かなければ、スナップがONで`Ctrl`なしなら丸めた位置。17.）へ動かす（`model.updateVertices`へ組の配列を1回で渡す。端点の吸い付きは動かす頂点が1つのときだけ）。閾値超過で移動した状態で離したとき、`#finishLeftDrag`の確定の前に`joinDraggedEndpoint`が`model.replaceShape`（`select: true`）で結合・閉じる。記録は移動と同じ1件（`beginEdit`/`commitEdit`は呼び出し側の移動の開始・確定）。結果だけが選択される。
    *   **発注者の決定**：
        *   吸い付く距離＝画面上8px（ちょうどを含む）。`main.js`が注入する`screenLengthToWorld`で表示倍率に応じてワールドの長さへ換算する。
        *   対象は結合できる線（直線・開いたパス。曲線のパスを含む。11.）の端点だけ。候補の選び方は`findSnapTarget`のJSDocが正本。
        *   **曲線のツールも吸い付く**（Phase 09-01b）：描き始めは`isSnapDrawShapeType`が`'curve'`でも真。引いている途中は`findDrawnLineSnapTarget`の`isJoinableLine(drawn)`が曲線のツールの作成途中の線でも真になるため既存の端点を候補にする。開いたまま終えた描き足しでは、`EndpointSnapper.finishDrawnLine`が作成途中の線を`planDrawnLineJoin`の第6引数へ渡して描いた区間の種類を伝える（点2つで終えた線は`Line`で区間の種類を持たないため）。
        *   表示＝中を青で塗った8pxの正方形（画面上で一定）。
        *   ハンドルのドラッグで吸い付いて離すと結合・閉じる。閉じられない場合は自身のもう一方の端点に吸い付かない。頂点2つの線は閉じない。
        *   選択集合：作成モードでは`replaceShape`の`select: false`により空のまま。ドラッグでは結果だけを選択する。
    *   **表示を消す箇所**：`InputTracker`の`#resetSnapState()`（描き終え・`Esc`等の作成途中の破棄・図形種別の切り替え・中断（`abortOngoingOperation`。モードの切り替えを含む）・左ドラッグの後始末・`finishLineDrawing`）、点を打った直後・最後の点を消した直後（`#drawEndSnap`を`null`にして表示を消す）、パンの開始、図形作成モードのIDLEで直線・曲線以外の図形種別のmousemove。`VectorModel.replaceAllShapes`も表示の点を消す（呼ばれるのは取り消し/やり直し・キャンバスの切り替え・`?dev`の「JSONから復元」）。インポートは`replaceAllShapes`を通らず、`prepareInsert`→`applyMode`→`#abortOngoingOperation`→`#resetSnapState()`で消える。表示を消す責任は`InputTracker`にあり、吸い付きの作業用フィールドは入力状態（`DRAWING`・`DRAGGING_HANDLE`）と寿命が同じ。状態の所有者を分けるときは遷移のたびに消す対応を崩さないこと。
    *   **`Ctrl`の間は照会しない（Phase 07-05。発注者の決定「`Ctrl`の間は何にも吸い付かない」）**：`Ctrl`（`⌘`を含む）を押している間は、端点への吸い付きもスナップ（17.）も働かない。照会しない場面は、描き始めの`click`・描いている途中の`mousemove`・図形作成モードのIDLEの`mousemove`の表示・端点のハンドルのドラッグの更新（`mousemove`・`wheel`）。いずれも「照会しない」ではなく「照会結果が`null`だったとき」と同じ経路を通る（保持の作業用フィールドを`null`にし、`#showSnap(null)`で表示を消す）。吸い付かなかったとき（照会結果が`null`のとき）の座標は、`Ctrl`なしならスナップで丸める（17.）、`Ctrl`ありなら丸めない。吸い付いたときは端点の座標をそのまま使い、丸めない（照会はいつも丸めていないカーソル位置で行う）。`Ctrl`を見る時点（発注者の決定ではなく、本作業の指示書（REQ）で決まっていた点。17.）は、描き始め＝その`click`、描いている途中・IDLEの表示＝その`mousemove`、ハンドルのドラッグ＝追従のたびのイベント（キーの購読は足さない）。
    *   **注意（`Ctrl`を押す前の吸い付きが描き終え・離したときに残る）**：描き終えと離したときは**直前の照会結果**で決まる（上の「流れ（描き終え）」）ため、吸い付いた状態で止めてから`Ctrl`を押してクリックする（離す）と、結合・描き足し（ハンドルのドラッグでは結合・閉じる）になる。マウスを動かせば外れる。この動きは変えていない。
    *   **やらないこと**：今の曲線（`curve`）・矩形・円・弧・閉じたパスの点・途中の頂点への吸い付き、本体・moveハンドルのドラッグでの端点への吸い付き、自動で閉じる。以前の「やらないこと」にあった修飾キーでの一時無効は、Phase 07-05で`Ctrl`で行うようになった（上記）。整数px・グリッドへの丸めは吸い付きではなく、スナップとして座標の入口で行う（3章17.。端点への吸い付きとは別の機能で、用語を混ぜない）。
    *   **発注者の決定（2026-11-18。連続引き）**：既存の線の端点から引き始めたときは自分の始点（描き始めの端点）に吸い付かない（青い正方形が出ない。同じ線のもう一方の端点には吸い付く）／始点への吸い付きは打った点が3つ以上のときだけ。
    *   **別の定義**：`SNAP_TOLERANCE_SCREEN_PX`（8px）・`JOIN_TOLERANCE_SCREEN_PX`（5px。端点が重なっているとみなす距離）・`InputTracker`の`hitTolerance`（5px）・表示の大きさ（`CanvasManager`の定数）は互いに別の定義で、どれを変えても他は変わらない。
    *   **注意（パン／ズームの後）**：パンの開始で表示は消すが描き終えの端点の保持は残すため、パンの後にカーソルを動かさずに描き終えると、表示の無いまま直前の照会結果で結合・描き足しになり得る。ズーム（`handleWheel`）は、描いている途中・図形作成モードのIDLEでは照会し直さないため表示を消さず、ズームの後も表示が残る（作成途中の終点・保持した端点も更新されない）。端点のハンドルを閾値を超えてドラッグしている最中のズームは`#applyLeftDragUpdate`で照会し直す（吸い付く距離をその時点の表示倍率で換算し直す）ため、吸い付きが外れて表示が消えることがある。

13. **オプションバー（スタイルのまとまり） (`palette/OptionBarStyleGroup.js` ⇄ `main.js` → `edit/ShapeStyleEditor.js` → `edit/StylePanelRules.js`・`core/VectorModel.js`・`HistoryManager.js`)**：ツールバーのオプションバーの「スタイル」のまとまり（`#option-style-group`）で、選択中の図形のスタイル（線の有無・色・太さ、塗りの有無・色）を変える。図形を選んでいないときは新しく描く図形のスタイル（直前に使った値。2章）を表示・変更する。
    *   **モジュールの分担**：DOM＝`OptionBarStyleGroup`（表示と、操作のコールバックへの通知のみ。importなし・`VectorModel`・図形データ・選択状態・`ShapeStyleEditor`を知らない）。配線＝`main.js`（コールバックを`ShapeStyleEditor`のメソッドへつなぐだけ。判定を持たない）。手順＝`ShapeStyleEditor`（DOMなし。反映の範囲・履歴の記録・色の欄のピッカー操作中の扱い・パネルが覚えている色）。規則＝`StylePanelRules`（オプションバーに出す値の算出・色の文字列の表示用の変換・太さの入力の受理・ON/OFFのボタンを押したときの次の有無。状態なし・DOMなし・importなし）。typedef`StylePanelView`は`StylePanelRules.js`と`OptionBarStyleGroup.js`の二重定義（形を変えるときは両方を揃える）。識別子の「Panel」（`StylePanelRules`・`getPanelView`・「パネルが覚えている色」）は改名せず、表示の部品一般を指す名前として残した（規則と手順を変えない方針・テストを書き換えないため）。以下の「パネル」もこの意味（実体はオプションバー）。
    *   **表示の流れ**：`model.onChange` → `syncOptionBarStyleGroup()` → `shapeStyleEditor.getPanelView()` → `optionBarStyleGroup.render(view)`。起動時にも1回呼ぶ。選択の変更・取り消し/やり直し・キャンバスの切り替え・図形の作成/削除・パネルでの変更・直前に使った値の変更はすべて`model.onChange`を通知するため、既存の経路だけで追従する。
    *   **表示の規則**：図形を選んでいるときは、線・塗りの有無・色・太さを選択中の図形から決める。線・塗りのON/OFFはアイコンのボタンの3つの表示（OFF＝通常、ON＝押し込み（`.tool-btn.active`と同じルール）、そろっていない＝破線の枠）。`aria-pressed`（`"true"`／`"false"`／`"mixed"`）が状態の唯一の持ち方で、見た目のCSSはその値で決める。色がそろっていない・表示できない色のときは、色の欄の上に**グレーの地に赤の斜線**を重ね（2つの状態は見た目で区別せず`title`の`（混在）`／`（表示できない色）`で区別）、文字の「混在」「表示できない色」は置かない。太さが違えば欄を空にして`placeholder`（混在）。塗りは塗れる形（`isFillable()`が真）だけで決め、塗れる形が無ければ塗りのON/OFFのボタンと塗りの色の欄を`disabled`にする（ボタンの表示はOFFと同じ。`fillColor`は消さない）。「選択中：n個」「次に描く図形」の表示はなく、`StylePanelView`の`source`・`selectedCount`も削除した。複数の図形の色は重なり順で最も手前の図形の色を表示する。`<input type="color">`は`#rrggbb`しか表示できないため、`#rrggbb`・`#rgb`は表示用に変換し、変換できない色（色名・`rgb(...)`等）は「パネルが覚えている色」を表示して（色の欄に斜線の覆いを重ね）`title`に「表示できない色」と添える。表示のために図形の値は書き換えない。混在は文字列の完全一致で判定する（`#fff`と`#ffffff`は混在）。
    *   **パネルが覚えている色**：`ShapeStyleEditor`が保持する「色の欄に最後に表示した色」（線・塗り）。`getPanelView()`が内容を求めるたびに更新するため、**`getPanelView()`は純粋な照会ではない**（表示の同期と`ShapeStyleEditor`の内部以外から呼ばない。同じ状態なら何度呼んでも結果は同じ）。色が決まらない項目（すべて線なし・塗れる形なし・変換できない色）は直前の表示を保つ。これにより、線を「なし」→ 選択を変えずに「あり」で元の色に戻る。
    *   **反映の範囲**：選択中の図形があるとき、変えた項目だけを反映する（線の有無・色・太さは選択中の全図形、塗りの有無・色は塗れる形だけ。塗れない形の`fillColor`は変えない）。あわせて直前に使った値の同じ項目を更新する。選択中の図形が無いときは直前に使った値だけを変える（履歴に記録しない。読み込み中もこちら）。線の「あり」は表示中の色を入れ、色を選ぶと選んだ色が入って線なしの図形にも線が付く（「あり」になる）。塗れる形が無い選択での塗りの変更は受理しない（`false`）。ON/OFFのボタンを押したときの規則：ONならOFF、OFFまたはそろっていないならON（`StylePanelRules.nextEnabledOnToggle`）。`ShapeStyleEditor.toggleStrokeEnabled`・`toggleFillEnabled`がピッカー操作中の記録を確定してから`getPanelView()`の有無に規則を当て、`setStrokeEnabled`・`setFillEnabled`と同じ`#setEnabled`で反映する（反映の範囲・履歴1件・直前に使った値・塗れる形が無い選択の不受理は同じ）。`setStrokeEnabled`・`setFillEnabled`は公開のまま残す（Phase 07-04の`D`・スポイトは使わず、次の`applyStyle`を使う）。
    *   **スタイルをまとめて当てる入口（Phase 07-04）**：`ShapeStyleEditor.applyStyle(style)`（`StyleApplication`＝`strokeColor`・`fillColor`・`strokeWidth`のうち自身のプロパティとして持つ項目だけを当てる。`null`＝線なし・塗りなし）と、`D`用の`resetColors()`（`applyStyle(RESET_COLORS_STYLE)`。`main.js`が値を知らずに済む）。選択中の図形があれば、`updateShapeStyles`の1回で1件の編集操作として反映する（線の色・太さは全図形、塗りの色は塗れる形だけ。変わらなければ記録しない）。選択の有無によらず、直前に使った値へ`updateNewShapeStyle`の1回で写す（色が`null`なら有無を偽にして色は保つ、文字列なら有無を真にして色、太さはその値）。選択が無ければ直前に使った値だけ（記録しない）。値の検証・変換はしない（スポイトの「そのまま写す」のため）。既存の公開メソッドの働きは変えず、既存のメソッドを続けて呼ぶ形にもしない。`RESET_COLORS_STYLE`（`D`の値＝線あり黒・塗りあり白・太さは含めない）は`StylePanelRules`にあり、起動時の既定`DEFAULT_NEW_SHAPE_STYLE`（`core/VectorModel`。線あり黒・**塗りなし**・塗りの色は白）とは色の値が重なるだけの別の定義（`edit/`と`core/`の依存方向と塗りの有無の違いのため。両方のコメントに互いの存在を書いてある）。`D`は選択の有無・操作モードによらず働き、操作モードを切り替えない（作成途中の図形は`updateNewShapeStyle`の既存の規則で追従）。スポイトの取り込み（16.）の値は`StylePanelRules.sampleStyleFromShape`（線の色・太さ、塗れる形だけ塗りの色。検証・変換をしない）。**表示の規則**：選択なしで変換できない色（`'red'`・`rgb(...)`等）を取り込むと、オプションバーは覚えている色を斜線なしで表示し、次に描く図形には取り込んだ色がそのまま入る（既存の`newShapeColorView`の規則。選択ありでは斜線の覆い）。
    *   **履歴の単位**：ON/OFFのボタン1回・太さの確定1回で1件。色の欄はピッカーを開いてから閉じるまでを1件にする。`input`の間は履歴を開かずに図形へ反映し、確定の契機（`change`・色の欄の`blur`・`keydown`・`ShapeStyleEditor`の他の変更メソッドの冒頭）で、開始時の色へ戻してから`beginEdit` → 最後の色 → `commitEdit`として記録する。編集操作を`input`から`change`まで開いたままにしないため、他の操作と`beginEdit`/`commitEdit`の対が崩れることが構造上ない。記録した図形が入れ替わっていた（取り消し/やり直し・キャンバスの切り替え・`?dev`の復元・削除）場合は、記録せず捨てる。
    *   **確定前に他の操作が起きた場合**：`blur`・`keydown`の来ない操作（フォーカスを移さないボタンの押下、非同期に終わった読み込みによるキャンバスの切り替え）が確定の前に起きると、ピッカーで入れた色は他の操作のスナップショットに含まれる、または図形が入れ替わってその色の変化が履歴に残らないことがある（`console.warn`は出ず、アプリは停止しない）。ブラウザによっては1回のピッカーの操作が複数件に分かれる（`blur`で途中確定した後の`input`は新しい1件）。
    *   **太さの受理**：1以上100以下の整数のみ（空・0・負・小数・100超・数値でない入力は受理しない。受理しなければ図形を変えず欄を元の値へ書き戻す）。太さの欄はフォーカスがある間は表示を書き換えず（打ち込み途中の値が`model.onChange`で消えないため）、フォーカスが外れたとき最後の表示へ書き戻す。
    *   **ドラッグ中のオプションバーの変更は拒まない（REQ要件3の「受け付けない、または起こり得ない」のどちらにも当たらない判断）**：`main.js`のコールバックも`ShapeStyleEditor`も`inputTracker.isDragging()`を見ない。理由：`isDragging()`はドラッグのセッション中（閾値以前を含む）に真になり、太さの欄に打って`Enter`を押さずにキャンバスを押すと、キャンバスの`mousedown`の後にフォーカスが移って太さの欄の`change`が来るため、拒むと打ち込んだ値が失われる。閾値以前・パンの間は他の編集操作が開いていないため、受け付けても履歴の対は崩れない。**残る経路**：閾値を超えた左ドラッグ中（`InputTracker`が編集操作を開いている間）に、`Tab`でオプションバーの部品へフォーカスを移して値を変えた場合。`ShapeStyleEditor`の`beginEdit()`がドラッグの「前の状態」を上書きし（`console.warn`）、その後のドラッグの`commitEdit()`は対を失って記録されない（ドラッグを始める前の位置へは取り消しで戻れなくなる）。アプリは停止せず、通常のマウス操作では起こりにくいため対処していない。**将来防ぐ場合の案**：`InputTracker`に「編集操作を開いているか」の照会を足して`main.js`が`ShapeStyleEditor`へ注入し、開いている間は変更を受理しない（`false`を返しオプションバーは書き戻す）。またはドラッグの開始時にオプションバーの部品からフォーカスを外す。`isDragging()`では判定しない。
    *   **発注者の決定**：混在は、太さの欄では欄を空にして`placeholder`の「混在」で示す（文字の入力欄）。色の欄は文字を置かず、混在・表示できない色ともグレーの地に赤の斜線を重ね、`title`（「（混在）」「（表示できない色）」）で区別する（Phase 07-02、2026-11-13の決定）。塗りは塗れる形だけで決め、塗れる形だけへ反映する。「あり」にしたときは表示中の色を入れる。太さは1〜100の整数。線を「なし」にした結果の見えない図形（何も描かれない図形）も受け付ける（選び方は06-01のまま。扱いの見直しは06-03）。直前に使った値は、オプションバーで変えたときと`D`・スポイトのとき（いずれも`ShapeStyleEditor`）だけ更新し、保存しない。2026-11-13（Phase 07-02）：線・塗りのON/OFFはアイコン（仮。後で差し替える）のボタンにし、3つの表示（そろっていない＝破線の枠）とし、押したときの結果は上記のとおり。混在・表示できない色はグレーの地に赤の斜線にし、選択の対象（「選択中：n個」「次に描く図形」）の表示はなくす。
    *   **まとまりごとの分け方**：オプションバーはまとまり（`.toolbar-group`）ごとに`palette/`のUI部品1つと`main.js`の配線ブロック1つを持つ（現在は「スタイル」（`#option-style-group`）・「重なり順」（`#option-order-group`。14.）・「位置」（`#option-position-group`。Phase 08-04。20.）・「整列・分布」（`#option-align-group`。Phase 08-05。21.））。各UI部品は自分のまとまりの要素をルート要素として受け取り、要素idは接頭辞`option-`。数値の欄を足すときは、まとまり・UI部品・ブロックを足すだけで既存のものを変えない（位置の欄は、この分け方どおりに足した＝Phase 08-04。20.。大きさ・角度の欄を足すときも同じ）。
    *   **やらないこと**：図形の大きさ・角度の数値の欄（精度のPhase。位置の欄はPhase 08-04で実装済み。20.）、透明度、独自のカラーピッカー、直前に使った値の保存、スポイトの取り込む項目を選ぶUI（スポイトそのものはPhase 07-04で入れた。16.）。

14. **重なり順の変更 (`index.html`の`#option-order-group`・`KeyboardShortcuts.js` → `main.js` → `edit/ShapeOrderEditor.js` → `edit/ShapeOrderRules.js`・`VectorModel.js`・`HistoryManager.js`)**：選択中の図形の重なり順（描画順）を「最前面へ」「前へ」「後ろへ」「最背面へ」で変える（機体の絵で円を多角形より手前に描くため）。操作はオプションバーの重なり順のまとまりの4ボタンと、キー`Home`（最前面へ）・`PageUp`（前へ）・`PageDown`（後ろへ）・`End`（最背面へ）。
    *   **モジュールの分担**：規則＝`ShapeOrderRules`（選択の有無の並びから新しい並びを求める。状態なし・DOMなし・importなし・要素を不透明に扱う。押せる/押せないと手順の「何もしない」の判定は`canReorderSelected`の1か所）。手順＝`ShapeOrderEditor`（規則で求めた並びを履歴の記録で挟んで`VectorModel`へ渡す1件の編集操作）。並びの正本と公開操作＝`VectorModel.reorderShapes`（新しい並び全体をidで受け取る）。表示＝`OptionBarOrderGroup`（DOMのみ）。配線＝`main.js`。typedef`ShapeOrderAvailability`は`ShapeOrderEditor.js`と`OptionBarOrderGroup.js`の二重定義（形を変えるときは両方を揃える）。
    *   **流れ**：ボタン／キー → `main.js`の`performShapeOrder(operation)`（ドラッグ中は不受理。ボタンとキーは`performShapeOrder`を呼ぶのみで`shapeOrderEditor.apply()`を直接呼ばない）→ `ShapeOrderEditor.apply` → `canReorderSelected`が偽なら何もせず記録しない → `HistoryManager.beginEdit` → `model.reorderShapes` → `commitEdit`。1回の操作は1件の編集操作で、Undo1回・Redo1回で往復する（6.）。
    *   **押せる/押せないの同期**：`model.onChange` → `syncOptionBarOrderGroup()` → `shapeOrderEditor.getAvailability()` → `optionBarOrderGroup.render(view)`。起動時にも1回呼ぶ。ボタンは`disabled`で始まる。
    *   **規則（発注者の決定）**：選択中の各図形は並びの上で隣の1つ分だけ動く（重なっているかは見ない）。離れた選択図形はまとめず、それぞれ1つずつ動く。連続した選択図形は一緒に動く（動けなければ動かない）。選択図形どうし・非選択図形どうしの相対的な順は4操作とも保つ。最前面へ・最背面へは選択図形をまとめて端へ寄せる。何も選んでいない・すでに端にある・全図形が選択中のときは何もしない。操作は常にオプションバーの重なり順のまとまりに置く。キーは修飾キーなし・`Shift`不可で、前へ・後ろへのみ押しっぱなし（キーリピート）で繰り返す。
    *   **並びが正本であること**：「重なり順」は`model.getShapes()`の並び（先頭＝最も奥、末尾＝最も手前）で、作業データの`shapes`・書き出しの`elements`・描画順・当たり分類の手前優先の順と同じ。並びを変えるだけで保存・書き出し・描画・クリックで選ばれる図形のすべてが追従するため、`io/`・`shapes/`・`check/`・`PointHitRules`・`InputTracker`・`CanvasManager`は変えない。図形データの形・版も変えない。
    *   **`reorderShapes`が並び全体で受ける理由**：操作の種類を渡さず、並びの規則を`core/`へ持ち込まないため。図形の一覧のPhaseで、一覧のドラッグによる任意の並べ替えからも同じ公開操作を使う見込み。その場合は、履歴の記録を呼び出し側で挟む・ドラッグ中の扱いを決める・選択集合は変えない（変えるなら別の公開操作）ことに注意する。
    *   **やらないこと（Non-goals）**：重なっている図形だけを数える前へ・後ろへ、離れた選択図形をまとめる操作、図形の一覧・ドラッグによる並べ替え（図形の一覧のPhase）、レイヤー・グループ化。

15. **表示（アウトライン・背景・グリッド・定規・座標の表示・パレットを隠す・全体を画面に収める） (`core/DisplayState.js` ⇄ `main.js`・`wiring/DisplayWiring.js` → `CanvasManager.js`・`RulerRenderer.js`・`palette/ViewToggleGroup.js`・`palette/PaletteLauncher.js`)**：座標と見え方を画面で確かめるための表示の機能。表示の状態は作業データ・書き出し・履歴・ブラウザの保存先のいずれにも入れない（作業データの版・書き出し形式の版は2のまま）。
    *   **表示の状態の持ち主と通知**：`core/DisplayState`（アウトライン・背景の白/黒・グリッドの表示・フロートウィンドウの表示の4つ）。`main.js`が1つだけ生成し、キャンバスの切り替え（開く・新規作成・開く（ファイル）・削除後・取り消し/やり直し・`?dev`の復元）では触れないため保たれる。ページを開き直すと初期値（アウトラインOFF・白・グリッド表示・ウィンドウ表示）に戻る。`VectorModel`・`InputTracker`・`CanvasManager`・`CanvasLibrary`・`SnapshotAdapter`・`HistoryManager`・`DocumentSerializer`は表示の状態を知らない。通知`displayState.onChange` → `renderCurrentState`（再描画。`main.js`）・`syncViewToggleGroup`（▢◐▦の押し込み）・`syncFloatWindowVisibility`（`body`のクラスと🧰の押し込み）（この2つの登録は`wiring/DisplayWiring`）。ボタンとキーは同じ`displayState`のメソッドを呼び（同一経路。削除ボタンとキーが`inputTracker.deleteSelection()`を呼ぶのと同じ形）、ボタンの表示は操作の中ではなく通知で同期する（キーで切り替えてもボタンが追従する。起動時にも各同期関数を明示的に1回呼ぶ。`wiring/DisplayWiring`へ移した分は`displayWiring.syncAll()`が呼ぶ）。
    *   **配色の組**：白・黒の2組（`CanvasManager`内の`COLOR_SCHEMES`。背景・グリッドの細線/太線・軸線・原点マーク・アウトラインの線の色）。`render`の`darkBackground`で選ぶ。白の組は07-03前の見た目と同じ値。背景の色はCSSに置かず配色の組が唯一の定義箇所（`index.html`の`#editor-canvas`に背景色を付けない）。背景は内部バッファ全体を`fillRect`で塗る。図形の色は変えない（黒い線の図形は黒の背景で見えない。仕様）。ハンドル・ホバーの強調・範囲選択の矩形・吸い付きの表示の色は変えない（`Curve.drawHandles`の点線は黒の背景でほぼ見えないが、ハンドル自体は見える。**現在`drawHandles`はどのモードからも呼ばれない**（`main.js`が`render`の`showHandles`へ常に`false`を渡すため。去就は変形のPhaseで決める。18.）。`drawHandles`の変更はやらないこと）。
    *   **アウトライン表示**：`render`の`outline`が真なら各図形（作成途中の図形も）を`drawOutline(ctx, viewScale, color)`で描き、偽なら`draw`（`CanvasManager`は図形種別を知らず、ポリモーフィックに呼ぶだけ）。輪郭のパスは`draw`・`drawHover`と同じで、塗らず、図形のスタイルを読まず、線は画面上1pxで一定（`1 / viewScale`）。ホバー・ハンドル・範囲選択・吸い付きは今のまま描く。当たり分類との関係は3.の当たり分類。
    *   **グリッドの表示**：`showGrid`が偽のとき細線・太線だけを描かない。軸線・原点マークは常に描き、定規も消さない。
    *   **定規**：常に表示（切り替えない）。ツールバーの下（横）と左端（縦）の別の`<canvas>`（`#ruler-horizontal`・`#ruler-vertical`と角`#ruler-corner`。`index.html`の静的な要素でフロートウィンドウではない。`z-index` 8）で、`core/RulerRenderer`が引数（ビュー変換値・カーソル位置）だけから毎回描く。グリッドの太線の位置にワールド座標の数字、細線の位置に短い目盛り、カーソル位置の印。目盛りの間隔は`GridSpacingRules.computeGridSpacing`でグリッド・ステータスバーのグリッド1マスの表示と共有する（ズームで繰り上がると同時に変わる）。目盛りの位置と数字の文字列は`RulerTickRules`。配色（目盛り・数字・印）は背景の白/黒によらず一定で、地はCSSの`--frame-background-color`（ツールバー・ステータスバー・角と共有）。再描画は`viewTransform.onChange`・`cursorTracker.onChange`・ウィンドウリサイズの`renderRulers()`のみ。定規の位置はキャンバスのスクリーン座標の同じ軸の値で、`RulerRenderer`はビュー変換値を行列として組みその逆行列で写す（変換式を手で書かない。ビューに回転を足す場合は`CanvasManager`の可視範囲と同じく見直す）。定規の上の押下・クリック・ホイールはキャンバスへ届かない（兄弟要素）。定規の上の`Ctrl`+ホイールのブラウザの拡大縮小は抑止しない。
    *   **カーソル位置の座標・選択中の図形の大きさ・グリッド1マスの大きさ（ステータスバー）**：カーソル位置は`core/CanvasCursorTracker`（キャンバスの`mousemove`で記録、`mouseleave`で「なし」。スクリーン座標の求め方とワールド座標への変換は`main.js`が既存の`inputTracker.getScreenCoordinate`・`viewTransform.screenToWorld`を注入する）。ドラッグ・パン中もカーソルがキャンバスの上にある間は追跡が続き、ツールバー・定規・ステータスバー・フロートウィンドウの上へ出ると「なし」になる。読み込み中は覆い要素のため「なし」のまま。選択中の図形の大きさは`edit/ShapeExtentReader` → `SpriteSerializer.computeShapesBounds`（書き出しの外枠`bounds`と同じ求め方。外枠の求め方を二重に書かない）→ 幅・高さ。表示の文字列（文言・記号の唯一の定義箇所）は`StatusReadoutRules`。座標・大きさは小数第1位まで固定で、対象が無い・有限でないときは`—`（座標：カーソルがキャンバスの外／まだ`mousemove`が無い、大きさ：選択が無い）。グリッド1マスは整数の`px`で、グリッドを非表示にしている間も表示する。更新するのはステータスバーの文字と定規だけで、マウスの移動のたびに`model.onChange`を通知せず、キャンバス全体も再描画しない。**座標の丸め（Phase 07-05。発注者の決定）**：スナップがONで最後の`mousemove`で`Ctrl`が押されていなかったときは、丸めた値を表示する（OFFのときと`Ctrl`を押しながら動かしているときは丸めない値）。丸めは点を打つ位置と同じ規則の関数（`UnitSnapRules`）で行い、`Ctrl`の読み取りは`CanvasCursorTracker`が`InputTracker`の`hasCtrlModifier`（`main.js`が注入）で記録する。端点への吸い付きの結果は反映せず、定規の赤い印はカーソルの位置のまま（丸めない。この2点は発注者の決定ではなく、本作業の指示書（REQ）で決まっていた点。17.）。詳細は17.・`_doc/arch/24_CanvasCursorTracker.md`。
    *   **パレットをまとめて隠す/出す**：`Tab`・ツールバーの🧰（`#float-windows-toggle`）。対象はすべての`.float-window`（ツールパレット・キャンバスパレット・`?dev`の確認用ウィンドウ）で、ツールバー・定規・ステータスバーは隠れない。隠し方は`body.float-windows-hidden .float-window { display: none; }`のCSSで、各ウィンドウの`hidden`属性・位置・重なり順には触れないため、外すと隠す前の状態に戻る。クラス名は`index.html`のCSSと`wiring/DisplayWiring`の`#syncFloatWindowVisibility`（🧰の`click`の登録も`DisplayWiring`）の2か所だけ（DOMのクラス名を`core/`へ持ち込まない）。隠している間もツールのショートカットは働く。`WindowManager`は変えない。隠している間の📁（`PaletteLauncher`の規則。`main.js`が`isFloatWindowsVisible`・`showFloatWindows`を注入する）：押すと`showFloatWindows()`で出したうえでパレットを必ず開く（隠す前に開いていた場合も閉じない）。
    *   **全体を画面に収める**：ステータスバーの⛶（`#view-fit`。キーなし）→ `wiring/DisplayWiring`の`#fitViewToShapes()`（⛶の`click`の登録も`DisplayWiring`） → `ShapeExtentReader.getAllBounds()`（見えない図形も含む）→ `ViewFitRules.computeFitView`（画面上の余白40px・倍率は`ViewTransform`の下限・上限に収める。図形0個は表示のリセットと同じ結果）→ `ViewTransform.setView`。再描画・倍率表示・定規・座標の表示は既存の`viewTransform.onChange`が追従する。操作モード・選択集合・図形一式・履歴に触れない。フロートウィンドウに隠れる部分は考慮せず、押した時点のキャンバスの大きさで求める。
    *   **ボタンに`aria-pressed`を付けない理由**：▢◐▦・🧰・（Phase 07-05の）スナップの🧲は押し込みを`.active`で表し、`aria-pressed`は付けない。付けると`core/FocusKeyYieldRules`の`isToggleButtonElement`が真になり、フォーカス中の`Space`がパンにならなくなるため（オプションバーのON/OFFのボタンとは逆の選択）。
    *   **発注者の決定（2026-11-13。いずれも発注者が決めたことで、実装側の判断で変えてはならない）**：
        *   **表示の状態はキャンバスを切り替えても保つ**：別のキャンバスを開く・新規作成・開く（ファイル）・削除後の切り替え・取り消し/やり直し・`?dev`の復元で、表示の状態（アウトライン・背景・グリッド・パレットの表示）は変わらない。ページを開き直すと初期値に戻る（保存しない）。持ち主は上記「表示の状態の持ち主と通知」。
        *   **アウトライン表示の見え方**：ONの間、すべての図形（線なしの図形・塗りだけの図形・何も描かれない図形を含む）の輪郭を、画面上で常に1pxの一定の細い線で描く。塗りは描かず、図形の線の色・太さ・塗りの色は表示に使わない。線の色は背景が白のとき黒・黒のとき白。作成途中の図形も同じ線で描く（上記「アウトライン表示」「配色の組」）。
        *   **アウトライン表示の間は塗った内側を当たりに含めない**：輪郭の近くを押したときだけ選ばれる。OFFに戻すと元の規則（3.の当たり分類）。
        *   **`C`（グリッドの表示）で消すのは細線・太線だけ**：軸線（`x = 0`・`y = 0`）と原点マークは残す（原点はスプライトの基準点のため。上記「グリッドの表示」）。
        *   **`Tab`の扱い**：入力欄（テキスト入力扱いの欄・色の欄）にフォーカスがある間は従来どおりフォーカスの移動。ボタンにフォーカスがある間（マウスで押した直後を含む）と、何にもフォーカスが無い間は、パレットを隠す/出す（このため`Tab`でボタンからボタンへフォーカスを移すことはできない）。`Shift`+`Tab`は今までどおりブラウザのフォーカスの移動（3.のキーボード操作）。
        *   **隠している間に📁（キャンバスパレットの開閉）を押したとき**：隠している状態をやめてパレットをすべて出し、キャンバスパレットは必ず開いた状態にする（隠す前に開いていた場合も閉じない。上記「パレットをまとめて隠す/出す」）。
        *   **押し込みの表示は`.active`で行い、`aria-pressed`は付けない**：▢◐▦・🧰にフォーカスがある間（マウスで押した直後）の`Space`はパンの扱いとする（📁と同じ。上記「ボタンに`aria-pressed`を付けない理由」）。Phase 07-05のスナップのボタン（🧲・単位のボタンとも`aria-pressed`なし）も同じ扱いにそろえた（3章17.。単位のボタンを押し込みの表示にしないことは、2026-11-13の発注者の決定ではなく、Phase 07-05の指示書（REQ）で決まっていた点）。
        *   **全体を画面に収める（⛶）にキーは割り当てない**（ボタンのみ。上記「全体を画面に収める」）。
        *   **配色をひと組にまとめて切り替える**：背景の色・グリッドの細線/太線・軸線・原点マーク・アウトライン表示の線の色を、白の背景用・黒の背景用の2組として持つ（上記「配色の組」）。
    *   **やらないこと**：1章「存在しないもの」の07-03の分のとおり（表示の状態の保存・履歴の対象化、定規の切り替え・ガイド・原点の変更・単位の切り替え、全体を画面に収めるキー、白黒以外の背景・ダークモード、カーソルがキャンバスの外へ出たときのホバーの強調の解除）。アウトライン表示の間も、範囲選択（輪郭のみ）・ハンドルの当たり・結合・吸い付きの規則は変えない（変わるのは塗った内側を当たりに含めるかどうかだけ）。

16. **選択と移動の操作（`Ctrl`+クリック・`Ctrl`+範囲選択・`Shift`+ドラッグ・`Alt`+ドラッグ・`Ctrl`+`I`・`Ctrl`+`Shift`+`V`・`D`・スポイト・`Alt`の単独押下の抑止） (`core/InputTracker.js`・`core/SelectionRules.js`・`core/MoveDirectionRules.js`・`core/AltKeyGuard.js`・`core/KeyboardShortcuts.js` → `main.js` → `edit/ClipboardController.js`・`edit/ShapeInserter.js`・`edit/ShapeStyleEditor.js`・`edit/StyleEyedropper.js`・`edit/StylePanelRules.js`)**（Phase 07-04）：選択と移動を修飾キーで速くする操作。作業データ形式・書き出し形式は変えない（版は2のまま）。足した状態（スポイトの待ち受け・ドラッグ中の`Alt`の記憶・移動量の作業用フィールド）は作業データ・履歴・ブラウザの保存先に入れない。修飾キーを押さず・足したキーを使わず・スポイトの待ち受けでないときの結果は今までと同じ（変わるのはツールパレットのボタンが1つ増えることと、`Alt`の単独押下でメニューへフォーカスが移らなくなることだけ）。
    *   **モジュールの分担**：規則＝`SelectionRules`（クリック・範囲選択の次の選択の指示`SelectionChange`＝`set`/`clear`/`null`と、選択の反転`invertSelection`）・`MoveDirectionRules`（移動量を横・縦・斜め45°へ限定）。いずれも状態なし・DOMなし・importなし・引数を書き換えない。配線＝`InputTracker`（修飾キーの読み取り・規則の呼び出し・注入された補助の呼び出し・作業用フィールドだけ。公開メソッドは足さない）。手順＝`ClipboardController`（`pasteInPlace`・`duplicateInPlaceWithinEdit`）・`ShapeInserter`（記録しない入口`insertDocumentWithinEdit`）・`ShapeStyleEditor`（`applyStyle`・`resetColors`）・`StyleEyedropper`（待ち受けの状態と取り込み）。抑止＝`AltKeyGuard`。配線＝`main.js`（`ensureSelectMode`・`performPaste`・`performInvertSelection`・`startEyedropper`と注入）。
    *   **修飾キーを見る時点**：`Ctrl`（macOSは`⌘`。`event.ctrlKey || event.metaKey`）＝選択の確定は`click`・範囲選択の終了のイベント、頂点の選択モードの押下（選ばれていない頂点を押したときに何も始めないかの判定。18.）は`mousedown`、スナップ・端点への吸い付きを止める読み取りは描き始めの`click`・描いている途中と図形作成モードのIDLEの`mousemove`・ドラッグの追従のたびのイベント（17.）、キーボードは`KeyboardShortcuts`の対応表を引く`keydown`と、`AltKeyGuard`が`Alt`の抑止を除く条件として読む`Alt`自身の`keydown`・`keyup`（`event.ctrlKey`だけ。3.）。`Shift`＝ドラッグ中の追従のたびのイベント（キーの購読なし）、および直線・曲線のツールで線を引いている途中の付いてくる線の先＝その`mousemove`（17.・22.）。矢印キーの`Shift`＝その`keydown`の`event.shiftKey`（`KeyboardShortcuts`の対応表で1px／10pxのエントリが決まる。19.）。`Alt`＝押した時点（`handleMouseDown`）。
    *   **発注者の決定（2026-11-14。実装側の判断で変えてはならない）**：選択モードの押下時の分岐の表（`handleMouseDown`。正本は`core/PressActionRules.resolvePressAction`）を`Ctrl`で変えない／`Shift`は移動だけ（頂点のハンドル・範囲選択・作成・パンには効かない。**2026-11-18の発注者の決定で、直線のツールで線を引いている途中の付いてくる線の先だけが加わり、Phase 09-01aで曲線のツールの線を引いている途中にも当てはまる**。22.）／`Alt`+ドラッグは選択中の図形だけ（選択集合外の図形の`Alt`+ドラッグは何も起きない）／`D`とスポイトの動きは次のとおり。
    *   **発注者の承認済みで決まっていた点（2026-11-14の決定ではない。いずれも実装側の判断で変えてはならない）**：`Ctrl`+範囲選択は追加のみで解除（反転）は行わない（Phaseの設計指針（DIR）の「やらないこと」。2026-11-13 発注者の決定）／`Ctrl`を押したまま空白をクリックしても選択を解除しない（DIRのPhase 07-04の実装要件。発注者の承認済み）／`Ctrl`+範囲選択でかかった図形が0件なら選択を変えない（本作業のREQ要件1。発注者の承認済みのREQ）。
    *   **`D`（線を黒・塗りを白にする）**：`KeyD`・`ctrl: false`・`Shift`不可・キーリピートなし → `shapeStyleEditor.resetColors()`（13.）。選択ありは選択中の全図形の線を黒・塗れる形の塗りを白にする1件の記録、直前に使った値を線あり黒・塗りあり白（塗れる形が無い選択でも塗りの直前に使った値は更新）。選択なしは直前に使った値だけ（記録しない）。太さは変えない。操作モードを切り替えない。常に`true`を返す。
    *   **選択の反転（`Ctrl`+`I`）**：`main.js`の`performInvertSelection()`が`ensureSelectMode()`の後、`SelectionRules.invertSelection(全図形のid, 選択中のid)`の結果を`model.setSelection`へ渡す（判定を持たない・記録しない）。選択モード以外では先に選択モードへ切り替わるため結果は全選択（作成途中の図形は破棄）。`InputTracker`へは入れない。
    *   **スポイト（`I`・ツールパレットの💉）**：待ち受けの持ち主は`edit/StyleEyedropper`（待ち受けか否かの真偽値と変更の通知だけ。作業データ・履歴・`VectorModel`に入れない）。経路：`I`・ボタン → `main.js`の`startEyedropper()`（`ensureSelectMode()` → `styleEyedropper.start()`。同一経路。すでに待ち受けなら何も変わらない）。クリック → `InputTracker`（3.）→ 注入された`pickShape` → `StyleEyedropper.pickFrom(shapeId)` → 注入された`applyStyle`（実体`shapeStyleEditor.applyStyle(sampleStyleFromShape(shape))`。13.）→ `stop()`（待ち受けは1回の取り込みでやむ。図形が無いidでは何もせず続く）。`Esc`は`styleEyedropper.cancelPicking(fallback)`（待ち受け中なら待ち受けだけをやめて`true`、でなければ`fallback`＝`inputTracker.cancelDraftOrClearSelection()`の結果。判定を`main.js`に置かないため）。`applyMode`は必ず`styleEyedropper.stop()`を呼ぶ。通知 → `syncToolPalette`（押し込みは`resolveActiveTool(モード, 図形種別, 待ち受け中か)`。待ち受け中は操作モードによらずスポイトが押し込み）。`applyMode`中の待ち受け終了では`stop()`の通知と`applyMode`末尾で`syncToolPalette`が2回呼ばれ得るが同じ結果で害はない。**4つ目の操作モードにしない**：操作モードを切り替えると選択集合が解除され（`setMode`は無条件に選択集合をクリアする）、取り込んだスタイルを選択中の図形へ反映できないため。また、選択を保ったまま別の操作モードにすると、不変条件「選択集合は選択モード・頂点の選択モード以外では空」が崩れるため。待ち受けは操作モード（`OperationMode`・`setMode`・不変条件「選択集合は選択モード・頂点の選択モード以外では空」）に入れず、選択モードのまま`StyleEyedropper`が持つ（`InputTracker`は照会`isPickingShape`と、注入された`pickShape`の呼び出しで関わるだけ。選択集合・ホバーの強調は待ち受け中も保たれ、取り込み後は選択の状態のまま元の図形のツールへは戻らない）。
    *   **待ち受けが続く／やめる操作**：やめる＝`Esc`（待ち受けだけ。選択は残る）・`V`・`H`・`P`・数字キー・ツールパレットのほかのボタン・`applyMode`を通る操作（インポート・キャンバスの切り替え・選択の状態以外からの貼り付け等）・取り込み・`?dev`の「JSONから復元」の成功（`applyMode`を通らないため、`main.js`の`onImport`が`styleEyedropper.stop()`を直接呼ぶ。待ち受けだけをやめ、操作モードは変えない。復元に失敗したときは続く）。続く＝取り消し・やり直し（`abortOngoingOperation`は`applyMode`ではない）・全選択・選択の反転・削除・`D`・表示の切り替え・複製（`Ctrl`+`D`）・選択の状態での貼り付け（`applyMode`を通らない）。
    *   **生成順の制約**：`styleEyedropper`は`inputTracker`より先に生成する（`InputTracker`のコンストラクタが`#updateCursor()` → `isPickingShape()`を呼ぶため。後に宣言すると一時的デッドゾーンで`ReferenceError`）。`shapeStyleEditor`・`clipboardController`は後で宣言されるが、注入した関数が呼ばれるのは起動完了後（取り込み・`Alt`+ドラッグの閾値超過）だけ。
    *   **`Alt`の抑止**：`AltKeyGuard`（`main.js`が`KeyboardShortcuts`の後に`new AltKeyGuard()`。インスタンスを保持しない）。対象・対象外は3.のキーボード操作。
    *   **やらないこと**：1章「存在しないもの」のPhase 07-04の分のとおり。

17. **スナップ（点を打つとき・図形や頂点を動かすときの丸め、`Ctrl`での一時無効、ステータスバーの部品、座標の表示） (`core/UnitSnapSettings.js`・`core/UnitSnapRules.js` ⇄ `core/InputTracker.js`・`main.js`・`wiring/DisplayWiring.js` → `palette/UnitSnapGroup.js`・`core/CanvasCursorTracker.js`、図形クラスの`getHandlePosition`)**（Phase 07-05）：座標・移動量を単位（1pxまたはグリッド10px）の倍数へ**丸める**機能。吸い付き先は探さない。作業データ形式・書き出し形式は変えない（版はどちらも2のまま）。スナップの設定は作業データ・履歴・ブラウザの保存先に入れず、取り消し/やり直しの対象にしない。**スナップがOFFで`Ctrl`を押していないとき**の結果は今までと同じ（`VectorModel`へ渡す座標・呼び出しの回数と順を含む。変わるのはステータスバーにまとまりが1つ増えること、ページを開いたときにスナップがON・1pxであること、`Ctrl`を押している間は端点への吸い付きが働かなくなることだけ）。
    *   **用語**：**スナップ**＝本節の丸め。**端点への吸い付き**＝Phase 05-04の機能（12.。`EndpointSnapRules`・`EndpointSnapper`・`InputTracker`の`#snapAssist`・`#drawStartSnap`・`#drawEndSnap`・`#dragEndpoint`・`#dragSnap`・`#showSnap`・`#resetSnapState`・`VectorModel`の`setSnapPoint`等）。既存の識別子の`snap`はすべて端点への吸い付きを指す。スナップの識別子は`UnitSnap`・`unitSnap`・`unit-snap`を含み、`round…ToUnit`（丸めの関数）もそれで区別する。
    *   **モジュールの分担**：規則＝`core/UnitSnapRules`（`resolveUnitSnapStep`・`roundPointToUnit`・`roundDeltaToUnit`・`roundConstrainedDeltaToUnit`・`roundPointFromOriginToUnit`・`roundConstrainedPointFromOriginToUnit`。状態なし・DOMなし・importなし。`_doc/arch/30_UnitSnapRules.md`）。設定の持ち主＝`core/UnitSnapSettings`（ON/OFF・単位の保持・切り替え・変更通知。`_doc/arch/31_UnitSnapSettings.md`）。入力への適用＝`InputTracker`（第7引数`inputAssist`の項目`getUnitSnapStep`を呼び、規則の関数へ渡すだけ。規則・設定を持たず、スナップの設定を知らない）。座標の表示＝`CanvasCursorTracker`（`Ctrl`の記録）と`wiring/DisplayWiring`の`#syncCursorReadout`。ステータスバーの部品＝`palette/UnitSnapGroup`（生成・注入・同期は`wiring/DisplayWiring`）。ハンドルの位置の照会＝図形クラス5つの共通メソッド`getHandlePosition(handleName)`（第17メソッド）。配線＝`wiring/DisplayWiring`（座標の表示・`UnitSnapGroup`の生成と同期）・`main.js`（`UnitSnapSettings`の生成と`InputTracker`への`getUnitSnapStep`の注入）・`index.html`（いずれも判定・計算を持たない）。
    *   **丸める箇所**（丸めは座標・移動量の入口で行い、`VectorModel`・図形クラスは丸めを知らない）：
        *   図形の作成で打つ点（描き始め＝`handleClick`、描いている途中の終点＝`handleMouseMove`の`DRAWING`。直線・曲線のツールでは打つ点のそれぞれ＝描き始めと付いてくる線の先。点を打つ位置は直前の`mousemove`で決めた付いてくる線の先）を`roundPointToUnit`で丸める。図形種別によらない（図形種別の分岐を持たない）。結果として直線は両端、矩形は4隅、円・弧は中心と半径、曲線のパスは打った点のそれぞれが単位の倍数になる（曲線のツールは作成時に`curve`を作らなくなったため、始点と終点の中点の制御点は無い。曲線のパスの制御点は作業データに持たず、頂点から式で求める。2章。今の曲線（`curve`）は`fromJSON`で読んだものだけ）。作成途中の図形は丸めた位置に表示される。確定（`DRAWING`の`click`）は作成途中の図形をそのまま登録する（座標を取り直さない）。
        *   本体・moveハンドルの移動（`MOVING_SELECTION`）は`#resolveMoveDelta`（3.）で丸める。移動量の合計が単位の倍数になり、小数の座標を持つ図形は小数の部分を保ったまま動く。
        *   頂点のハンドルの移動（`DRAGGING_HANDLE`）は`roundPointFromOriginToUnit`で、「ドラッグを始めた時点のそのハンドルの位置＋丸めた移動量」を頂点の目標にする（`#beginLeftDrag`が`#unitSnapHandleOrigin`へ記憶し、`#finishLeftDrag`で必ず消す）。位置が得られないときは丸めない。
        *   ステータスバーのカーソル位置の座標の表示（`syncCursorReadout`）。
        *   丸めないもの：既存の図形の座標（開いただけ・スナップを切り替えただけでは変わらない）、読み込み・出力（作業ファイル・エンジン用）・貼り付け・複製のずらし量、（今の曲線の作成時の制御点。Phase 09-01a以降は今の曲線を作らないため該当する操作が無い）、定規のカーソル位置の印、**矢印キーでの微調整の移動量（Phase 08-03。発注者の決定。スナップがONでもグリッドの刻みでも1px／10pxのまま動かし、動かした後に刻みへ丸めない。19.）**。
    *   **丸め方**：正の有限の数値の刻みなら丸め、それ以外（`null`＝スナップOFF・`Ctrl`を押している間を含む）は丸めない（入力と同じ値を新しいオブジェクトで返す）。**ちょうど中間の値は0から遠い側へ丸める**（`2.5`→`3`、`-2.5`→`-3`。`Math.round`の`-2.5`→`-2`の非対称を避け、符号について対称にするため）。移動は「`Shift`の方向の限定 → 丸め」の順で、45°では両軸が同じ量になる（`roundConstrainedDeltaToUnit`。限定の結果は`|dx| === |dy|`が厳密に成り立つため、軸ごとに独立に丸める`roundDeltaToUnit`でも45°は崩れず同じ結果になる。別に持つのは、`|dx|`と`|dy|`が厳密には等しくない斜めの入力でも結果を必ず45°にするため）。小数の座標に整数を足すため、`0.1`のような値は`1e-15`程度の誤差を含み得る（今の移動と同じ性質）。
    *   **ハンドルの位置の照会（第17メソッド`getHandlePosition(handleName)`）**：`hitTestHandle`が返し得る名前（`Line`・`Ellipse`は移動用の`'move'`を含む）に対してそのハンドルの位置を新しいオブジェクト`{x, y}`で返し、**ハンドル名でない値（`null`・`undefined`・未知の文字列・文字列以外・`Object.prototype`のキー名（`'constructor'`等））には例外を投げず`null`を返す**（`@param`の型は`{*}`）。`Line`・`Curve`・`Ellipse`は名前の厳密比較、`Rect`・`Path`は`getVertexIndexForHandle`の番号が範囲内の整数であることを確かめてから`points[番号]`を写す（`Rect`は対応表の添字が文字列へ変換されるため、先に引数が文字列であることを確かめる。`Path`は`getVertexIndexForHandle`が文字列以外に`null`を返す）。`Ellipse`の`'left'`・`'down'`は`points`に実体のない計算上の位置。**この形を採る理由**：円・弧の`setVertex(1, x, y)`は`y`を、`setVertex(2, x, y)`は`x`を無視し中心からの距離として半径を求めるため、`points[頂点の番号]`を基準にすると左端・下端のドラッグで半径の変化が単位の倍数にならない。ハンドルの位置を基準に「位置＋丸めた移動量」を渡せば、左端でも半径の変化が単位の倍数になる。図形種別の知識は各図形クラスに閉じ、`InputTracker`はポリモーフィックに呼ぶだけ（`getVertexIndexForHandle`と同じ）。`Rect`の隅は`setVertex`でその隅だけが動く（矩形を保たない今の約束のまま）ため、丸めはその隅の移動量に掛かる。
    *   **`Ctrl`を見る時点**（`event.ctrlKey || event.metaKey`。**マウスのイベントの`Ctrl`（`⌘`を含む）の読み取りは`InputTracker.js`が`export`する`hasCtrlModifier`に寄せ、二重に書かない**（`main.js`が`CanvasCursorTracker`へ注入する）。キーボードの`Ctrl`は`hasCtrlModifier`を使わず別に読む（`KeyboardShortcuts`の`#findBinding`は同じ式、`AltKeyGuard`は`event.ctrlKey`だけを`Alt`の抑止を除く条件に）。キーの購読は足さない）：描き始め＝その`click`、描いている途中・図形作成モードのIDLEの表示＝その`mousemove`、ドラッグ（本体・moveハンドル・頂点のハンドル）＝追従のたびのイベント（`mousemove`・ドラッグ中の`wheel`）、座標の表示＝最後の`mousemove`。`Shift`を見る時点は、線を引いている途中（直線・曲線のツール）の付いてくる線の先＝その`mousemove`（キーの購読なし）。`Ctrl`を押した・離しただけでは反映せず、次の`mousemove`（または`wheel`）で切り替わる。`handleKeyDown`・`handleKeyUp`は`Space`専用のまま、`KeyboardShortcuts`・`AltKeyGuard`は変えない。選択モードの押下時の分岐の表（`handleMouseDown`。正本は`core/PressActionRules.resolvePressAction`）と選択の`Ctrl`（3.）は変えない。
    *   **`Shift`との組み合わせ（直線・曲線のツールで線を引いている途中の付いてくる線の先）**：吸い付かなかったとき、最後の点を基準に`constrainMoveDirection`で限定した移動量を`roundConstrainedPointFromOriginToUnit`で丸める（基準点が刻みの倍数なら結果も倍数で、限定した横・縦・斜め45°の向きが崩れない）。吸い付いたら端点の座標をそのまま使い（`Shift`でも吸い付きが優先）、`Ctrl`の間は吸い付きもスナップも働かず`Shift`の限定だけ働く。
    *   **端点への吸い付きとの優先**：`Ctrl`なし＝丸めていないカーソル位置で照会し、吸い付けば端点の座標をそのまま使い（丸めない）、吸い付かなかったときだけ丸める。`Ctrl`あり＝照会せず（照会結果`null`と同じ経路。12.）丸めない。スナップOFFでも`Ctrl`の間は照会しない。丸めは座標の入口で行い、`commitDrawnLine`・`joinDraggedEndpoint`へは吸い付きの結果だけが渡るため、丸めは結合として扱われない。`EndpointSnapRules`・`EndpointSnapper`は、この Phase 07-05 の時点では変えていない（のちの連続引きで`EndpointSnapRules`に線を引いている途中の吸い付き（`findDrawnLineSnapTarget`・始点への吸い付きの種類）を、`EndpointSnapper`に線を引く手順を足した。22.）。
    *   **設定の持ち主と同期の経路**：`core/UnitSnapSettings`（スナップのON/OFF・単位。初期値はON・1px）を`main.js`が1つだけ`// 3.3.`で生成する（`InputTracker`より前）。キャンバスの切り替え・取り消し/やり直し・`?dev`の復元では触れないため保たれ、ページを開き直すと初期値に戻る。`VectorModel`・`CanvasManager`・`CanvasLibrary`・`SnapshotAdapter`・`HistoryManager`・`DocumentSerializer`・`DisplayState`・`InputTracker`は設定を知らない（`InputTracker`は注入された照会`getUnitSnapStep`＝`unitSnapSettings.getActiveStep()`で刻み（ONなら単位の値、OFFなら`null`）を受け取るだけ）。通知は`unitSnapSettings.onChange`の**1つだけ**で、登録先は`wiring/DisplayWiring`の`syncUnitSnapGroup`（`unitSnapGroup.render`）と`syncCursorReadout`の2つ。キャンバスは再描画しない（作成途中・ドラッグ中の図形は次の入力で更新される）。ボタンの表示は操作の中ではなく通知で同期し、起動時にも`displayWiring.syncAll()`が`syncUnitSnapGroup`を明示的に1回呼ぶ。`DisplayState`へ足さなかった理由は1章「フォルダ分割の方針」。
    *   **単位の値の定義**：`UnitSnapSettings.js`の`UNIT_SNAP_STEPS`（1px・グリッド10px）が単位の値の**唯一の定義箇所**。グリッドの10pxは表示倍率で変わらない固定値で、画面のグリッドの線の間隔の規則（`GridSpacingRules.computeGridSpacing`）とは**別の定義**（表示倍率80%未満では画面の細線は100px間隔になり、丸めの10pxとは一致しない。`GridSpacingRules`は新たにimportしない）。単位のボタンの`title`の文言は`palette/UnitSnapGroup.js`の`UNIT_TITLE_FORMATS`が唯一の定義箇所（数値は`unitStep`から作り、単位の値を二重に書かない）。
    *   **ステータスバーの部品**：`index.html`の`#unit-snap-group`（`.status-bar-group`。`#view-toggle-group`の次・表示倍率のまとまりの前）の中に、ON/OFFのボタン`#unit-snap-toggle`（🧲。仮。`title="スナップ"`）と単位のボタン`#unit-snap-unit-toggle`（押すたびに1px⇄グリッド10pxが入れ替わる。文字は今の単位の数字`1`・`10`、`title`は`スナップの単位: 1px`／`スナップの単位: グリッド (10px)`で、どちらも起動時に`wiring/DisplayWiring`の`syncAll()`（`#syncUnitSnapGroup`）が付ける。`index.html`には書かない）。表示（ON/OFFの押し込み`.active`・単位のボタンの文字と`title`）と押下の通知は`UnitSnapGroup`が持つ。押し込みは`.active`で表し、**2つとも`aria-pressed`を付けない**（付けるとフォーカス中の`Space`がパンにならない。15.）。単位のボタンは押し込みにしない（文字で状態を表す）。スナップがOFFの間も単位のボタンは押せて、単位だけが変わる（ONにはならない）。スナップにキーは割り当てない。幅は`.status-bar .icon-btn`の24pxで固定され、文字が`1`・`10`で変わっても隣の⛶の位置は動かない（`#unit-snap-unit-toggle`の`font-variant-numeric: tabular-nums`）。押した直後の`Space`はパン、`Tab`はパレットの隠す/出す、`Ctrl`なしのショートカットは働く。
    *   **座標の表示**：15.のとおり。`wiring/DisplayWiring`の`#syncCursorReadout`は`resolveUnitSnapStep(unitSnapSettings.getActiveStep(), cursorTracker.isCtrlPressed())`の刻みで`roundPointToUnit`した値を`formatCursorReadout`へ渡す（`world === null`の分岐は「位置なし」の受け渡しで、丸めるかの判定ではない）。`StatusReadoutRules`の表示の形式は変えない。ドラッグ中・端点へ吸い付いているときは、表示（カーソル位置を丸めた値）と実際の点（移動量の丸め・ハンドルの元の位置を基準にした格子・吸い付いた端点）が一致しないことがある。
    *   **発注者の決定（2026-11-14。本作業の指示書の作成時に発注者が決めたこと。実装側の判断で変えてはならない）**：(1) `Ctrl`を押している間は、スナップに加えて端点への吸い付きも働かない（「`Ctrl`の間は何にも吸い付かない」）。(2) ステータスバーのカーソル位置の座標は、スナップがONの間は丸めた値を表示する（スナップがOFFの間と、`Ctrl`を押しながら動かしている間は丸めない値）。(3) スナップの操作部品は、ON/OFFのボタン（🧲）と、押すたびに1px⇄グリッド10pxが入れ替わる単位のボタン1つ（文字は今の単位の数字）とする（プルダウン等の入力部品は使わない）。
    *   **Phaseの設計指針（DIR）の決定（2026-11-13 発注者の決定。実装側の判断で変えてはならない）**：単位は「1px」と「グリッド（10pxの固定値。表示倍率で変わらない）」の2つ／ページを開いたときはON・1px／図形・頂点を動かすときは移動量を丸め、点を打つときは座標を丸める／端点への吸い付きを優先する／`Ctrl`を押しながらのドラッグ＝スナップを一時的に無効にする／スナップの設定は作業データに入れず、取り消し/やり直しの対象にせず、ブラウザにも保存しない／スナップのON/OFFのボタンに`aria-pressed`を付けない（押した直後の`Space`はパン）／既存の図形の座標の丸め・書き出し時の丸めは行わない／端点への吸い付きの対象は広げない。
    *   **本作業の指示書（REQ）で決まっていた点（発注者の承認済みの指示書。上の2つの決定とは区別する。いずれも実装側の判断で変えてはならない）**：丸める点は図形の作成で打つ2点（描き始め・描いている途中の終点）で、図形種別によらない／作成途中の図形は丸めた位置に表示される／`Ctrl`を見る時点（描き始め＝その`click`、描いている途中＝その`mousemove`、ドラッグ＝追従のたびのイベント。キーの購読は足さない）／移動は「`Shift`の方向の限定 → 丸め」の順で、45°では両軸が同じ量／頂点のハンドルは「ドラッグを始めた時点のハンドルの位置＋丸めた移動量」／ハンドルの位置は図形クラスの共通メソッド（17番目）で求める／単位のボタンはスナップがOFFの間も押せて単位だけが変わる／スナップの設定はキャンバスを切り替えても保つ（ページを開き直すと初期値）／曲線の作成時の制御点（中点）は丸めない（当時の今の曲線の話。Phase 09-01aで曲線のツールは曲線のパスを作るようになり、打つ点のそれぞれを丸める）／スナップにキーは割り当てない／定規のカーソル位置の印は丸めない／`main.js`の配線ブロックの切り出しは行わない。
    *   **注意**：(a) トラックパッドのピンチは`ctrlKey`が真の`wheel`として届くため、ドラッグ中のピンチの直後の追従のし直し（`handleWheel` → `#applyLeftDragUpdate`）だけは丸められない位置・端点へ吸い付かない状態になり、次の`mousemove`で戻る（許容）。(b) 描き終え・離したときは直前の照会結果で決まる（12.の注意）。(c) `Ctrl`を押した・離しただけでは作成途中の図形・ドラッグ中の図形・座標の表示は切り替わらない（上記）。(d) `cursorTracker.onChange`は`Ctrl`の状態だけが変わったときも通知するため、`renderRulers`も呼ばれる（定規の描画は位置から毎回描くため結果は同じ）。
    *   **確認の状況**：実際のマウス・キーでの操作は、発注者のテストプレイ（2026-11-14。問題なし）で確かめた。macOSの`⌘`・トラックパッドのピンチは「環境があれば」と依頼した項目で、実施したかは確認していない。以下は、現場設計AIが**合成イベント（プログラムから送ったマウス操作）で確認**した事実：1280px幅でステータスバーの最後のボタン（🎯）の右端は左から1272px（全項目が収まる）、`#unit-snap-group`は左から1107〜1168px、表示の切り替えのまとまりは1019〜1099px、ツールバーの最後のボタンの右端は637pxのまま。単位のボタンの幅は24pxで、文字が`1`・`10`で変わっても⛶の位置は動かない。合成イベントのマウスの座標は整数になるため、表示倍率100%ではワールド座標も整数になる（丸めの確認は、表示倍率110%・グリッド10px・`?dev`の復元で入れた小数の座標の図形で行った）。
    *   **やらないこと**：1章「存在しないもの」のPhase 07-05の分のとおり（スナップの設定の保存・履歴の対象化・キャンバスごとの設定、1px・グリッド10px以外の単位・単位の数値の入力欄・画面のグリッドの線の間隔に合わせる単位、スナップのキー、`Ctrl`以外の修飾キーでの一時無効・キーの購読による即時の反映、丸めた位置を示す表示・定規の印を丸めた位置へ動かすこと、既存の図形・読み込み・出力・貼り付けのずらし量の丸め、曲線の作成時の制御点の丸め）。端点への吸い付きの対象は広げない（12.）。
18. **頂点の選択（ツールの分割・頂点のハンドルの表示と操作） (`core/InputModes.js`・`core/ToolRules.js`・`core/KeyboardShortcuts.js`・`core/PointHitRules.js`・`core/VertexHandleRules.js`・`core/SelectionRules.js`・`core/PressActionRules.js`・`core/CursorShapeRules.js`・`core/InputTracker.js`・`core/VectorModel.js`・`core/CanvasManager.js`・`shapes/`・`wiring/ToolIconWiring.js`・`core/SpriteFitRules.js`・`asset/sprite/`)**（Phase 08-02a。図形を選ぶ「選択（`V`）」と、図形の頂点を選ぶ「頂点の選択（`A`）」を分ける。前半＝ツールの骨組みと頂点を1つ選んで動かすまで。Phase 08-02b＝後半：頂点を複数選んで、まとめて動かす）：
    *   **ツール・操作モードの一覧**：操作モード`OperationMode`に`VERTEX: 'vertex'`を1つ足した（`SELECT`・`VERTEX`・`CREATE`・`PAN`）。ツールの識別子は操作モードの値と同じ`'vertex'`（`ToolRules`に新しい定数を足さない）。`TOOL_IDS`の並び＝ツールパレットのボタンの並び＝`[select, vertex, pan, eyedropper, ...SHAPE_TYPES]`（`#tool-select`の次が`#tool-vertex`。スポイトは3番目から4番目になった）。ボタンもキーも`main.js`の`applyMode(OperationMode.VERTEX)`を呼ぶ（同一経路）。`ensureSelectMode`は今のまま（全選択・貼り付け・選択の反転・スポイトの開始は、頂点の選択モードからでも選択モードへ切り替わる）。`InputTracker.setMode`は切り替えのたびに無条件で選択集合をクリアするため、`V`⇄`A`の切り替えで選択は解除される（`setMode`の既存のふるまい）。
    *   **選択（`V`）の変更**：ハンドルを描かず（`CanvasManager.render`の`showHandles`が偽）、当たりにも含めない（`includeHandles`が偽。3.）。図形の移動は本体のドラッグ。この結果、選択モードでは図形の外枠のハンドルのドラッグ（矩形の角・円の半径・直線の端点・パスの頂点を動かす操作）ができなくなった（意図した変更。頂点を動かすのは頂点の選択モード）。`PressActionRules`・`CursorShapeRules`の選択モードの判定表そのものは変えていない（ハンドルの枝が通らなくなっただけ）。
    *   **頂点の選択モード（`A`）の操作**：頂点のハンドルは**選択集合の図形のものだけ**描き、当てる。頂点のハンドルとは、図形が`getVertexHandleNames()`で返す名前のハンドル（`Line`＝`start`・`end`（中点`move`は含めない）、`Curve`＝`start`・`control`・`end`、`Rect`＝4隅、`Path`＝`vertex-<i>`すべて、`Ellipse`（円・弧）＝なし。**円・弧にはハンドルが出ない**。発注者の決定）。
        *   クリック（Phase 08-02bで`Ctrl`の約束を足した。`Ctrl`は`⌘`を含み、見るのは`click`イベント）：頂点のハンドル → `SelectionRules.resolveVertexClickSelection(現在の頂点の選択, 当たった頂点, Ctrl)`の結果を`#applyVertexSelectionChange`で反映（図形の選択は変えない。`Ctrl`なし＝その頂点だけの単一選択、`Ctrl`あり＝未選択なら末尾へ追加・選択中なら外す）。頂点でなく`Ctrl`あり → `resolveClickSelection(選択集合, bodyId, true)`の結果を反映（図形の本体＝図形の選択へ追加・解除。**頂点の選択は空にしない**。選択から外れた図形の頂点は`VectorModel`が落とす。空白＝何もしない）。頂点でなく`Ctrl`なし → `clearSelectedVertices()`の後、`resolveClickSelection(…, false)`（本体＝その図形だけを選ぶ。空白＝選択があれば全解除。前半のまま）。**`Ctrl`＋選ばれている頂点を押して閾値以内で離すと、その頂点は選択から外れる**（押下の判定表が、選ばれている頂点なら`Ctrl`によらずドラッグを始めるため。図形側と同じ約束で、REQどおりの正しいふるまい。不整合に見えても直さない・ガード処理を足さない。閾値を超えて動かした場合は移動し、直後の`click`は抑止されるので選択は変わらない）。
        *   押下（Phase 08-02bで判定表を広げた。**判定表の正本は`core/PressActionRules.resolveVertexPressAction(hit, isVertexSelected, additive)`**。`additive`は`Ctrl`。この順に判定）：①頂点のハンドルで、その頂点が選ばれている → 選んでいる頂点すべてのドラッグを始める（`dragSelectedVertices`。`Ctrl`によらない。選択は変えない）。②頂点のハンドルで選ばれておらず`Ctrl`なし → その頂点だけを選び直してドラッグを始める（`selectVertexAndDrag`）。③頂点のハンドルで選ばれておらず`Ctrl`あり → 何も始めない（`null`。離した後の`click`で追加する）。④頂点のハンドルでない（図形の本体の上・空白のどちらでも）→ 範囲選択（`marquee`。**図形は動かない**）。ドラッグは既存の`DRAGGING_HANDLE`、範囲選択は既存の`MARQUEE_SELECTING`で、新しい入力状態は足していない。頂点の移動は既存の`#beginLeftDrag`・`#applyLeftDragUpdate`・`#finishLeftDrag`の経路にそのまま載り、スナップ（17.）・`Ctrl`での一時無効・取り消し1件・閾値以内で離したときのクリック扱いが効く。
        *   まとめ移動（Phase 08-02b）：押した頂点が**アンカー**（スナップの丸めの基準）。`#beginLeftDrag`が押下時に1回だけ、動かす頂点それぞれの押下時の位置と頂点インデックスを`#vertexDragOrigins`へ記憶する（押した頂点が頂点の選択に含まれていればその全体、含まれていなければ押した1つだけ）。追従でアンカーの行き先（端点へ吸い付く／丸める／カーソル位置。3章3.・17.）を求め、ほかの頂点には「アンカーの移動量」を各自の押下時の位置へ足し、`model.updateVertices`へ1回で渡す（通知1回・取り消し1件）。アンカー自身には行き先そのものを渡す（足し算を通さない）。頂点を1つだけ選んだときの結果は前半と完全に同じ。**端点への吸い付きは頂点を1つだけ選んでいるときだけ働く**（2つ以上では吸い付かない。スナップの丸めは働く。発注者の決定）。
        *   範囲選択（Phase 08-02b）：空白からでも図形の本体の上からでも始められる。確定では図形の選択を変えず、選択集合の図形の頂点だけを`VertexHandleRules.collectVertexHandlesInRect`で集め、`SelectionRules.resolveVertexMarqueeSelection`の結果（`Ctrl`なし＝置き換え（0件なら空）、`Ctrl`あり＝追加（0件なら変えない））を反映する（3章3.）。円・弧・選択集合に無い図形の頂点は対象外。
        *   `Esc`（`cancelDraftOrClearSelection`）：作成中・ドラッグ中の扱いは今のまま。頂点の選択が1つ以上あれば**頂点の選択だけを解除**（図形の選択・頂点の表示は残す）。なければ図形の選択を解除（選択モード・頂点の選択モードで共通）。
        *   `Delete`・`Backspace`（`deleteSelection`）：**何もしない**（受理条件が選択モードのままのため`false`。図形は消えない。発注者の決定）。コピー・複製・結合・重なり順・スタイルの変更は、選択集合に対して働くため頂点の選択モードでも働く（切り取りは削除が受理されないため何も起きない）。
        *   ホバー・カーソル：ホバーの強調（`drawHover`）は選択モードと同じ（図形の線の上で強調する。当たり分類の`bodyId`で決まる）。カーソルの形は、頂点の上は`'move'`・図形の本体の上は`'pointer'`（選択中かで変えない）・空白は`'default'`・ハンドルのドラッグ中は`'move'`（`CursorShapeRules`の判定表の(2a)。パン中・`Space`押下中の優先は変えない。**ツールごとにカーソルの形を変えることはしない**）。
    *   **モジュールの分担**：頂点の選択の状態は`VectorModel`（`setSelectedVertices`・`clearSelectedVertices`・`getSelectedVertices`・`isVertexSelected`。2章）。複数の頂点の座標のまとめ更新は`VectorModel.updateVertices`（通知1回。`updateVertex`はこれへ委譲する）。頂点の選択の変更の規則は`SelectionRules`の2つの関数（`resolveVertexClickSelection`・`resolveVertexMarqueeSelection`。頂点の同一性は図形のidとハンドル名の両方の一致）、押下の判定表は`PressActionRules.resolveVertexPressAction`。頂点のハンドルの一覧の組み立て・「頂点のハンドルか」の照会・矩形に入る頂点の収集・頂点の範囲は`core/VertexHandleRules`（`collectVertexHandles`・`isVertexHandle`・`collectVertexHandlesInRect`・`computeVertexHandlesBounds`（Phase 08-04。20.）。状態なし。図形種別の分岐を持たず、図形の共通メソッド`getVertexHandleNames`・`getHandlePosition`を呼ぶだけ）。`InputTracker`は`#classifyPoint`の結果を頂点のハンドルだけに絞って、クリック・押下・ホバー・カーソルで共用する。`main.js`の`renderCurrentState`は`collectVertexHandles(…)`の結果を`CanvasManager.render`の`vertexHandles`として渡すだけで、判定・計算を持たない。`CanvasManager`は位置と選ばれているかを引数で受け取って描くだけ（状態・図形種別を知らない）。再描画は既存の`model.onChange`の経路のみ（機能専用の経路を足さない）。
    *   **頂点のハンドルの表示**：`CanvasManager.render`の描画順は、全図形の描画の後・作成中の図形の前（今までの`drawHandles`と同じ位置）。選ばれていない頂点は画面上8pxの白い四角・青い枠`#4a90e2`・線幅1.5px、**選ばれている頂点は塗りを青（枠と同じ`#4a90e2`）にして見分ける**。大きさ・線幅は`÷ view.scale`で画面上一定。各図形の`drawHandles`と同じ値だが別の定義（定数は`CanvasManager`内）。
    *   **`drawHandles`が呼ばれなくなること（変形のPhaseで決める）**：`main.js`は`render`の`showHandles`へ常に`false`を渡すため、各図形の`drawHandles`と`CanvasManager`の`showHandles`の分岐は**本作業の後はどのモードでも呼ばれない**（共通メソッド契約は据え置き。消していない）。変形のPhaseで外枠のハンドル（拡大縮小・回転）を入れるときに、`drawHandles`・`showHandles`の去就を決めること。
    *   **履歴・保存**：頂点の選択は履歴・作業データ・書き出しの対象外（`io/DocumentSerializer`・`edit/SnapshotAdapter`・`io/SpriteSerializer`は変更していない。版は作業データ・書き出し形式とも2のまま）。取り消し・やり直しで図形の選択を戻す条件（`shouldRestoreSelection`）は選択モード・頂点の選択モードのとき。頂点の選択は、取り消し・やり直し・削除・キャンバスの切り替え・結合・端点への吸い付きの確定・貼り付け・複製（`Ctrl`+`D`）・`?dev`の復元・`setMode`で、選択集合から図形が消えたときに`VectorModel`が落とす（取り残さない）。
    *   **ツールのアイコン**：選択・頂点の選択のボタンのアイコンは、書き出し形式のスプライトJS（`asset/sprite/`。黒い矢印＝選択、白い矢印＝頂点の選択。Photoshopと同じ色の約束）を`wiring/ToolIconWiring.drawToolIcons()`が起動時に1回だけ`<canvas>`へ描く（`main.js`の`// 7.`で`ToolPalette`の生成の直後に呼ぶ）。外枠を余白の内側へ収める計算は`core/SpriteFitRules.computeSpriteFitTransform`（`ToolIconWiring`だけが使う）。他のボタンのアイコンは今までの文字のまま。
    *   **発注者の決定（2026-11-16。実装側の判断で変えてはならない）**：(1) 選択（`V`）ではハンドルを出さない。(2) 頂点の選択（`A`）で、本体の上・空白の押下は図形を動かさない（前半では何も始めないとしたが、Phase 08-02bから範囲選択が始まる。図形は動かない）。(3) 円・弧はハンドルを出さず頂点の選択の対象にしない。直線の中点のハンドル（`move`）も頂点として扱わない。(4) `A`で`Delete`は何もしない。(5) ツールごとにカーソルの形を変えない。(6) 複数の頂点の選択・まとめ移動は後半（Phase 08-02bで行った）。**テストプレイの結果の確認で次の2点を発注者が承認した（現状のままでよい）**：(7) 頂点の選択（`A`）でも、図形の線の上のホバーの強調表示を選択（`V`）と同じに出す。(8) 頂点の選択（`A`）のとき、ツールバーの削除ボタンは押せる見た目のままとし、押しても何も起きない（`main.js`の`syncDeleteButtonState`へ操作モードの判定を足さない。`main.js`に判定を持たせない方針のため）。
    *   **やらないこと（08-02a）**：1章「存在しないもの」のPhase 08-02aの分のとおり（頂点の追加・削除、矢印キーの微調整、ツールごとのカーソルの形、他のアイコンの差し替え、アイコンの`devicePixelRatio`の変化での描き直し）。（Phase 08-03で「矢印キーの微調整」は入った。頂点の微調整は`NudgeEditor`が`VectorModel.updateVertices`の既存の経路に載せて動かす＝通知1回・取り消し1件。19.）
    *   **注意**：(a) 頂点の選択のモードのクリックで、`Ctrl`なしで図形の本体・空白を押すと、頂点の解除と選択集合の変更で変更通知が2回出て再描画も2回になる（`Ctrl`ありの本体のクリックは頂点の選択を空にしないため通知は1回。既存の経路だけを使う方を優先した結果。見た目・結果に違いは無い。1回にまとめるには`VectorModel`へ専用のメソッドが要る）。(b) 頂点のハンドルの一覧は図形のメソッド`getVertexHandleNames`が正本で、一覧の名前は`hitTestHandle`が返しうる名前であり`getVertexIndexForHandle`が番号を、`getHandlePosition`が位置を返すものに限る（`_doc/arch/12_shapes.md`の「ハンドル名の契約」）。図形を足すときはこの一覧も実装する。(c) 頂点の選択を足す・変えるときは`PointHitRules`の`includeHandles`・`InputTracker`の絞り込み・`VertexHandleRules`・`CursorShapeRules`の4か所の整合を保つ（ハンドルの優先順位は`CanvasManager`の描画順と一致させる）。
    *   **テストプレイの結果（2026-11-16 発注者の回答）**：確認項目（起動時の表示・ツールの切り替え・選択（`V`）のハンドルなし・頂点の選択（`A`）の表示と選択と移動・スナップ・端点への吸い付き・本体のドラッグ・`Esc`・`Delete`・取り消し/やり直し・カーソルの形・ほかの操作・入力欄との競合）は**全項目OK**。上の(7)・(8)も承認された。アイコンの大きさの見た目・選ばれている頂点の青い塗りの見分けやすさもこのテストプレイで確かめた。自動テストの件数は`_doc/arch/16_test.md`。
    *   **Phase 08-02b（後半：頂点を複数選んで、まとめて動かす）**：上の各項に反映済み。要点：複数選択の入口は`Ctrl`＋クリック・範囲選択・選んでいる頂点のうち1つを押してのドラッグ。まとめ移動は`updateVertices`で通知1回・取り消し1件。端点への吸い付きは頂点を1つだけ選んでいるときだけ。`A`のまま`Ctrl`＋クリックで図形そのものを選択へ追加・解除できる（頂点の選択は空にならない）。頂点の選択の状態の形・不変条件・保存しないこと・履歴の対象外・作業データと書き出しの版（どちらも2）・選択（`V`）のふるまいは変えていない。`js/main.js`・`CanvasManager`・`CursorShapeRules`は変更していない（複数の頂点が選ばれた色で並ぶ表示・カーソルの形は既存の経路のまま。範囲選択中のカーソルは既存の構造により矢印のまま）。
    *   **発注者の決定（2026-11-16。Phase 08-02b。実装側の判断で変えてはならない）**：(1) 頂点の範囲選択の枠は、空白からでも図形の本体（線の上）からでも引き始められる。(2) 範囲選択で選べる頂点は、頂点が出ている図形（選択集合の図形）の頂点だけ。範囲選択で図形そのものの選択は変わらない。(3) 端点への吸い付きは、頂点を1つだけ選んでいるときだけ働く（2つ以上では吸い付かない。スナップの丸めは働く）。(4) `A`のまま`Ctrl`（`⌘`）＋クリックで図形そのものを選択へ追加・解除できる。(5) 頂点のドラッグに`Shift`での移動方向の限定は入れない。(6) 前半の決定はそのまま（円・弧はハンドルを出さない／`A`で`Delete`・`Backspace`は何もしない／`Esc`はまず頂点の選択だけを解除し、もう一度で図形の選択も解除する）。
    *   **やらないこと（08-02b）**：1章「存在しないもの」のPhase 08-02bの分のとおり。（Phase 08-03で「矢印キーでの微調整」は入った。19.）（Phase 08-04で「位置の数値入力」は入った。20.）
    *   **前半の記述の訂正**：前半の「本体の上・空白の押下は何も始めない」は「どちらからでも範囲選択が始まる（図形は動かない）」へ、「クリックで`Ctrl`を見ない」は「頂点の選択モードのクリックは`Ctrl`を見る（上のクリックの約束）」へ、「最大1つ」は「2つ以上の組が入る」へ改めた。
    *   **テストプレイの結果（Phase 08-02b。2026-11-16 発注者の回答）**：全項目OK。自動テストの件数は`_doc/arch/16_test.md`（tests 1411）。

19. **矢印キーでの微調整（ナッジ） (`core/KeyboardShortcuts.js` → `main.js` → `edit/NudgeEditor.js` → `core/NudgeTargetRules.js`・`core/VectorModel.js`・`core/HistoryManager.js`)**（Phase 08-03）：選んでいる図形、または選んでいる頂点を、矢印キーで1px（`Shift`併用で10px）ずつ動かす。新しい経路を作らず、既存のキーの対応表と受理判定（`KeyboardShortcuts`）・既存の移動の入口（`moveShapes`・`updateVertices`）・既存の履歴の入口（`beginEdit`／`commitEdit`）に載せる。作業データ形式・書き出し形式・履歴のエントリの形は変えない（版はどちらも2のまま）。`InputTracker`・`VectorModel`・図形クラスは変更していない。
    *   **流れ**：矢印キーの`keydown` → `KeyboardShortcuts`（対応表の8エントリ＋既存の受理判定）→ 注入コールバック`nudgeSelection({dx, dy})`（`main.js`の`// 7.9.`で生成した`NudgeEditor`の`nudge(dx, dy)`を呼んで戻り値を返すだけ）→ `NudgeEditor.nudge`：①`NudgeTargetRules.resolveNudgeTarget(モード, 図形の選択, 頂点の選択)`で対象を決める（無ければ`false`で終わり、記録先に触れない）②`buildNudgeGroupKey(対象)`で鍵を作る ③`beginEdit()` → `moveShapes`または`updateVertices`（通知1回）→ `commitEdit(鍵)`。再描画・ステータスバー・ボタンの同期は既存の`model.onChange`・`historyManager.onChange`の経路のみ（微調整専用の経路は無い）。キーの購読は`KeyboardShortcuts`の既存の1つのまま。
    *   **モジュールの分担**：キーと動く量＝`KeyboardShortcuts`（**動く量（1px・`Shift`で10px）と4方向の符号の定義は`KeyboardShortcuts.js`の非公開定数`NUDGE_STEPS`・`NUDGE_DIRECTIONS`の1か所だけ**。他に同じ値を書かない）。対象の決定とまとめの鍵の組み立て＝`core/NudgeTargetRules`（状態なし。`_doc/arch/41_NudgeTargetRules.md`）。1件の編集操作の手順＝`edit/NudgeEditor`（`_doc/arch/14_edit.md`）。まとめの鍵を畳む記録＝`HistoryManager`（6.）。配線＝`main.js`（生成・注入・受け渡しだけ。判定を持たない）。 **Phase 08-04：`NudgeEditor`の呼び出し元が2つになった**（矢印キー＝`nudge`＝まとめの鍵あり／位置の数値入力＝`nudgeWithoutGrouping`＝鍵なし。20.）。対象の決め方・移動の手順は共通で、違うのは`commitEdit`へ鍵を渡すかだけ。
    *   **対象の決め方**：操作モードが選択（`V`）なら選んでいる図形（すべて同じだけ動く）、頂点の選択（`A`）なら選んでいる頂点（すべて同じだけ動く）。**他方の選択は見ない**（`A`で図形だけ選んでいて頂点が0件なら対象なし。`V`では頂点の選択が残っていても見ない）。作成・キャンバス移動のモードでは対象なし。頂点の位置は各図形の`getVertexIndexForHandle`・`getHandlePosition`（今の位置）に移動量を足した絶対座標で`updateVertices`へ渡す。位置か頂点インデックスが求まらない組（線の中点`'move'`等）は飛ばし、1件も残らなければ対象なしと同じ扱い。
    *   **対象がないときは受理しない**：コールバックが`false`を返し、`KeyboardShortcuts`は`preventDefault()`しない（ブラウザ側の既定の動き＝スクロール等を妨げない。発注者の決定）。`beginEdit`も呼ばないため履歴にも通知にも触れない。
    *   **まとめの区切り（続けて押した分が取り消し1件になる条件）**：鍵は`JSON.stringify`した対象（種類・図形idの並び・頂点の並び）で、同じ対象を続けて動かしたときだけ同じ鍵になる（区切り文字を自前で決めず、idやハンドル名の文字との衝突を避けるため）。区切りになるのは、(1)**別の編集操作**（鍵なし・別の鍵での記録）(2)**選ぶ対象の変更**（次の微調整の鍵が変わる）(3)**取り消し/やり直し**（`undo`・`redo`が鍵を忘れる）(4)**キャンバスの切り替え**（`CanvasLibrary`の切り替え処理が`HistoryManager.clear()`で履歴と鍵を空にする。6.）。**パン・ズーム・表示の切り替えでは区切らない**（履歴に触れないため）。注意：(2)は「次の微調整の時点で対象が違うこと」で判定し、選択の変更そのものは`HistoryManager`に届かない。間に別の編集操作が挟まらない限り、いったん別の対象を選んでから同じ対象を選び直して動かすと、直前の微調整のまとまりへ畳まれる。往復して元へ戻ったときはエントリが消える（6.）。
    *   **スナップ・端点への吸い付きと無関係**：移動量は**ワールド座標のpx**（表示倍率・スクロールを読まない）で、`UnitSnapRules`・`UnitSnapSettings`を読まず（17.）、動かした後に刻みへ丸めない（座標が小数の図形は小数のまま動く）。端点への吸い付き（12.）も働かせない（頂点を1つだけ選んでいても）。
    *   **キーリピート**：押しっぱなしで連続して動く（対応表の`repeatable: true`）。1回ごとに作業データの直列化と前後の比較が走るが、既存の編集操作1件と同じ仕組みで、性能の改善を目的とした変更は行っていない。
    *   **キーの受理**：矢印キーは`ctrl: false`のエントリのみ（`Ctrl`・`Alt`付きは一致せず、ブラウザ・OSの操作をそのまま通す）。`Shift`なしが`FORBIDDEN`で1px、`Shift`ありが`REQUIRED`で10px。本作業の`Shift`は「10px動かす」の意味だけを持ち、移動方向の限定（16.の`Shift`+ドラッグ）とは別。入力欄にフォーカスがある間・ドラッグ中は既存の受理判定（手順2・4・5）で動かない。
    *   **発注者の決定（2026-11-17。実装側の判断で変えてはならない）**：(1) 動く量はスナップの設定に関係なく1px、`Shift`と一緒なら10px。動かした後に刻みへ丸めない。(2) まとめの区切りは別の編集操作・選ぶ対象の変更・取り消し/やり直しのいずれか（キャンバスの切り替えも`HistoryManager.clear()`で区切りになる）。パン・ズーム・表示の切り替えでは区切らない。(3) 動かす対象がないときは何もせず、ブラウザ側の既定の動きを妨げない。(4) 矢印キーの押しっぱなしで連続して動く。(5) `Shift`は「10px動かす」の意味だけを持つ。
    *   **やらないこと**：1章「存在しないもの」のPhase 08-03の分のとおり（整列と分布（Phase 08-05で入った。21.）、拡大縮小・回転・反転・外枠のハンドル、頂点の追加・削除ほか、`Ctrl`＋矢印・`Alt`＋矢印への割り当て、微調整でのスナップの丸め・端点への吸い付き、ボタンの追加、性能の改善、書き出しの際の座標の丸め）。（Phase 08-04で「位置の数値入力」は入った。20.）
    *   **確認の状況**：矢印キーの受理判定（`event.code`での一致・`Shift`の分かれ方・キーリピート・入力欄とドラッグ中の見送り・`preventDefault()`の有無）と`main.js`の`// 7.9.`の配線は`node --test`で確かめられない（`document`・`KeyboardEvent`に依存）。実際のキー操作は、発注者のテストプレイ（2026-11-17）で確認項目のすべてが問題なしだった。自動テストの件数は`_doc/arch/16_test.md`（tests 1457）。
20. **位置の数値入力 (`palette/OptionBarPositionGroup.js` ⇄ `main.js` → `edit/PositionInputEditor.js` → `edit/PositionInputRules.js`・`edit/NudgeEditor.js`・`edit/ShapeExtentReader.js`・`core/VertexHandleRules.js`・`core/NudgeTargetRules.js`)**（Phase 08-04）：選んでいる図形、または選んでいる頂点の位置を、ツールバーのオプションバーの「位置」のまとまり（`#option-position-group`）のX・Yの数値の欄で指定する。マウスでの移動（16.）・矢印キーでの微調整（19.）に続く「狙った位置に置く」入口で、新しい判定・外枠の求め方・同期の経路を作らず、既存のオプションバーの部品の作り（13.）と既存の移動・履歴の仕組み（`VectorModel.moveShapes`／`updateVertices`・`HistoryManager`の`beginEdit`／`commitEdit`）に載せる。作業データ形式・書き出し形式・履歴のエントリの形は変えない（版はどちらも2のまま。欄の値は保存しない）。`InputTracker`・`KeyboardShortcuts`・`FocusKeyYieldRules`・`SpriteSerializer`・`ShapeExtentReader`・`VectorModel`・図形クラスは変更していない。
    *   **流れ（表示）**：`model.onChange` → `syncOptionBarPositionGroup()`（`main.js`の`// 7.10.`。起動時にも1回呼ぶ）→ `PositionInputEditor.getPositionView()` → `OptionBarPositionGroup.render(view)`。選択の変更・モードの切り替え・マウスでの移動・矢印キーでの微調整・取り消し／やり直し・線の太さの変更・キャンバスの切り替えは、すべて既存の`model.onChange`の通知で追従する（位置の欄専用の再描画経路・`document`の購読は無い）。
    *   **流れ（入力）**：X・Yの欄の`change` → `OptionBarPositionGroup`が`onPositionChange(軸, 欄の文字列)` → `main.js`のコールバックが`PositionInputEditor.setPosition(軸, 文字列)`の戻り値をそのまま返す → ①`resolveNudgeTarget`で対象を決める（19.と同じ）②対象に応じた範囲（図形＝`ShapeExtentReader.getSelectedBounds()`、頂点＝`computeVertexHandlesBounds`）を求める ③`resolvePositionDelta`で「範囲の左上を入力値へ動かす量」を求める（受理しなければ`null`＝`false`）④`NudgeEditor.nudgeWithoutGrouping(dx, dy)`が`beginEdit` → `moveShapes`または`updateVertices`（通知1回）→ `commitEdit()`。`false`が返ると（受理しない・対象なし・移動量0）`OptionBarPositionGroup`が最後に表示した内容で欄を書き戻す。
    *   **モジュールの分担**：DOM＝`palette/OptionBarPositionGroup`（表示と通知のみ。importなし。`_doc/arch/13_palette.md`）。規則＝`edit/PositionInputRules`（欄に出す内容と移動量。状態なし）。手順＝`edit/PositionInputEditor`（対象と範囲の解決、規則の呼び出し、`NudgeEditor`への受け渡し。`HistoryManager`を持たない）。移動と記録＝`edit/NudgeEditor`（`nudgeWithoutGrouping`）。対象の決定＝`core/NudgeTargetRules.resolveNudgeTarget`（19.と同じ規則）。頂点の範囲＝`core/VertexHandleRules.computeVertexHandlesBounds`。配線＝`main.js`の`// 7.10.`（生成・注入・同期のみ。判定を持たない。`ShapeExtentReader`はここでも1つ生成するため、`wiring/DisplayWiring`の内部と合わせて2か所にある）。`_doc/arch/14_edit.md`・`_doc/arch/38_VertexHandleRules.md`。
    *   **位置の定義**：図形（`V`）は**選択集合全体の外枠の左上**で、外枠には**線の太さを含める**（ステータスバーの「大きさ」・書き出しの`bounds`と同じ求め方。求め方の正本は`SpriteSerializer.computeShapesBounds`で、`ShapeExtentReader`経由。2通りにしない）。このため**線の太さを変えると、図形を動かしていなくてもX・Yの表示が変わる**（仕様。不具合として直さない）。頂点（`A`）は**選んだ頂点全体の範囲の左上**（頂点の位置だけを囲む。線の太さは無関係）で、複数の頂点・図形は位置関係を保ったまま全部が動く。**円・弧も外枠の左上**で表し（中心にしない）、座標の規則に図形種別の分岐を持たせない。指定しなかった軸は動かない（Xに入れたらX方向だけ動く）。
    *   **数字の形と丸め**：欄に出す数字は`StatusReadoutRules.formatReadoutNumber`（小数第1位。`-0`・`-0.04`は`0.0`。ステータスバーの座標と同じ正本）。入力は小数・負の値をそのまま受け付ける。**表示の丸めを移動量へ持ち込まない**：移動量は「入れた値 − 範囲の左上（丸める前の実値）」で、座標が`10.04`の図形に`10`を入れると`0.04`動く（見た目の表示は`10.0`のままだが実際には位置が変わるため取り消しが1件増える。仕様）。スナップ（刻みへの丸め。17.）・端点への吸い付き（12.）は位置の欄に働かせない（`UnitSnapSettings`を読まない）。
    *   **確定の契機**：`change`（`Enter`・欄から出たとき・欄の上下の矢印の操作）だけ。`input`は購読しない（1文字打つごとに図形が動いたり取り消しの記録が増えないように）。欄はフォーカスがある間は`model.onChange`で書き換えず（打ち込み途中の値が消えないため）、`blur`で最後の表示へ書き戻す。受理されなかった入力（空・数値でない・同じ値）は図形を変えず欄を実際の値へ戻す。欄の矢印は`step="any"`のためブラウザ既定（1px）で、1回ごとに確定される。
    *   **確定1回が取り消し1件**：`nudgeWithoutGrouping`は`commitEdit()`を引数なしで呼び、まとめの鍵（`HistoryManager.commitEdit(groupKey)`）を渡さない。続けて確定した分は畳まれず、1回ごとに1件（19.の矢印キーが畳むのとは別）。
    *   **欄を押せない見た目になる条件**：動かす対象がないとき（何も選んでいない／`A`で頂点を1つも選んでいない＝図形だけを選んでいる場合を含む／図形作成（`P`）・キャンバス移動（`H`）のモード）、または範囲が求まらないとき。欄は`disabled`で空になる（`resolveNudgeTarget`の「対象なし」と同じ判定で、`getPositionView`と`setPosition`が同じ対象の解決を共有する）。有限でない値（`formatReadoutNumber`が`—`を返す場合）は数値の欄に入れられないため、`PositionInputRules`が先に弾いて空＋押せないにする。
    *   **キーとの関係**：位置の欄は`<input type="number">`で、`FocusKeyYieldRules.isTextInputElement`の一覧に`number`があるためテキスト入力扱いになる。したがって欄にフォーカスがある間は、`KeyboardShortcuts`の受理判定の手順2により**すべてのショートカット（`V`・`A`・`P`・`Ctrl`+`Z`・`Delete`・矢印の微調整を含む）が働かない**（`KeyboardShortcuts`・`FocusKeyYieldRules`・`InputTracker`は変更していない。判定を足していない）。欄にフォーカスが残ったままの`Ctrl`+`Z`はアプリの取り消しではなくブラウザの欄の文字の取り消しになる（アプリの取り消しはキャンバスのクリック等で欄の外へフォーカスを出してから）。
    *   **ドラッグ中は拒まない**：`main.js`のコールバックも`PositionInputEditor`も`inputTracker.isDragging()`を見ない（太さの欄と同じ判断。13.）。理由：拒むと打ち込んだ値が失われる。ドラッグ中に`Tab`で欄へフォーカスを移して確定すると、ドラッグの編集操作の`beginEdit`と対を崩し得る（13.の「残る経路」と同じ。通常のマウス操作では起こりにくく、対処していない）。
    *   **発注者の決定（2026-11-17。実装側の判断で変えてはならない）**：(1) 図形の位置は外枠の左上で、外枠には線の太さを含める（線の太さを変えると表示が変わるのは仕様）。(2) 頂点を複数選んでいるときは頂点全体の範囲の左上で、位置関係を保って全部が動く。(3) 円・弧も外枠の左上。(4) 欄の数字は小数第1位まで、入力は小数・負の値をそのまま受け付ける。(5) 動かす対象がないときは欄を押せない見た目にして空にする。(6) 数値の確定1回が取り消し1件（まとめの鍵を使わない）。
    *   **やらないこと**：1章「存在しないもの」のPhase 08-04の分のとおり（整列と分布（Phase 08-05で入った。21.）、大きさ・角度の数値の欄、基準点の指定、変形、頂点の追加・削除、位置の欄でのスナップの丸め・端点への吸い付き、欄の値の保存）。
    *   **確認の状況**：`OptionBarPositionGroup`（DOM）・`main.js`の`// 7.10.`の配線・`index.html`の位置のまとまりの見た目と1280px幅での収まり・`type="number"`の`change`／`blur`／矢印の操作は`node --test`で確かめられない（`document`・DOMに依存）。確認項目を発注者へ提示済み（テストプレイで確かめる範囲）。規則・手順は自動テストで確かめている（件数は`_doc/arch/16_test.md`。tests 1496）。

21. **整列・分布 (`palette/OptionBarAlignGroup.js` ⇄ `main.js` → `edit/ShapeAlignEditor.js` → `edit/ShapeAlignRules.js`・`edit/ShapeExtentReader.js`・`core/VectorModel.js`・`core/HistoryManager.js`、`main.js` → `core/InputTracker.js`（ドラッグ中の判定）・`core/VectorModel.js`（同期の購読）)**（Phase 08-05）：選んでいる複数の図形の位置を、ツールバーのオプションバーの「整列・分布」のまとまり（`#option-align-group`）の8つのボタンでそろえる（整列6種＝左・左右中央・右・上・上下中央・下、分布2種＝横方向に均等・縦方向に均等）。マウスでの移動（16.）・矢印キーの微調整（19.）・位置の数値入力（20.）に続く「狙った位置に置く」4つめの入口。新しい外枠の求め方・同期の経路は作らず、14.（重なり順）と同じ3層（規則＋編集操作＋DOM専任のUI部品）に、既存の移動の入口と履歴の入口に載せる。作業データ形式・書き出し形式・履歴のエントリの形は変えない（版はどちらも2のまま。結果は図形の座標そのものに入り、別のデータを持たない）。`InputTracker`・`KeyboardShortcuts`・`FocusKeyYieldRules`・`HistoryManager`・`SpriteSerializer`・図形クラス・`DisplayWiring`は変更していない。
    *   **流れ（表示）**：`model.onChange` → `syncOptionBarAlignGroup()`（`main.js`の`// 7.11.`。起動時にも1回呼ぶ）→ `ShapeAlignEditor.getAvailability()`（`ShapeExtentReader.getSelectedBoundsPerShape()`を1回だけ求め、8操作それぞれ`canApplyAlign`）→ `OptionBarAlignGroup.render(availability)`（8ボタンの`disabled`を当てるだけ）。選択の変更・移動・取り消し／やり直し・線の太さの変更・キャンバスの切り替えは、すべて既存の`model.onChange`で追従する（専用の再描画経路・`document`の購読は無い）。
    *   **流れ（入力）**：ボタンの`click` → `OptionBarAlignGroup`が`onAlign(操作の文字列)` → `main.js`の`performShapeAlign(operation)`（ドラッグ中は不受理で`false`。それ以外は`ShapeAlignEditor.apply`の戻り値を返すだけ）→ `ShapeAlignEditor.apply`：①`getSelectedBoundsPerShape()`②`canApplyAlign`が偽なら`false`（記録先に一切触れない。未知の操作はここで`Error`）③`computeAlignMoves`で動く図形だけの`{ id, dx, dy }`を求める④`beginEdit()` → `model.moveShapesBy(moves)`（通知1回）→ `commitEdit()`。
    *   **モジュールの分担**：規則＝`edit/ShapeAlignRules`（操作の値の唯一の定義・移動量・押せるかの判定。状態なし・DOMなし・importなし。受け取るのは`id`と外枠の数値だけ）。手順＝`edit/ShapeAlignEditor`（操作モードを知らない・DOMなし）。外枠の照会＝`edit/ShapeExtentReader.getSelectedBoundsPerShape`（選択中の図形1つずつ。描画順）。移動の反映＝`VectorModel.moveShapesBy`（図形ごとに違う移動量をまとめて当てる。`shape.translate`へ委譲し、通知は1回）。DOM＝`palette/OptionBarAlignGroup`（`_doc/arch/13_palette.md`）。配線＝`main.js`の`// 7.11.`（生成・注入・同期と、`performShapeAlign`のドラッグ中の受理判定（`inputTracker.isDragging()`なら`false`）。そのほかの判定・計算を持たない）。typedef`ShapeAlignAvailability`は`ShapeAlignEditor.js`と`OptionBarAlignGroup.js`の二重定義、操作の値（文字列）は`ShapeAlignRules`・`ShapeAlignAvailability`のキー・`OptionBarAlignGroup`の対応表の3か所で同じ文字列（変えるときはそろえる。ずれるとボタンが黙って押せない表示になる）。
    *   **整列の基準は選択全体の外枠**：全体の範囲は**`ShapeAlignRules`の中で各図形の外枠の和として求める**（別の引数で受け取らない。`getSelectedBounds()`と同じ値）。基準にする図形・キャンバスを基準にする仕組みは作らない。左・右・上・下は各図形の端を全体の端へ、左右中央・上下中央は各図形の中央を全体の中央へ動かす。
    *   **外枠に線の太さを含める**：外枠の求め方の正本は`SpriteSerializer.computeShapesBounds`（線を描く図形は線の太さの半分だけ外側へ広げる。書き出しの`bounds`・ステータスバーの「大きさ」・位置の欄（20.）と同じ値）で、2通りにしない。線の太さが違う図形を混ぜると「線の外側」がそろう（仕様）。円・弧・パス・曲線も外枠でそろえ、中心にしない（規則に図形種別の分岐を持たない）。
    *   **分布は外枠どうしのすき間をそろえる（中心の間隔ではない）**：軸の`min`の昇順（同じ値は元の順。`sort`は安定）に並べ、すき間＝（全体の長さ − 各図形の長さの合計）÷（件数 − 1）。先頭は全体の端に置き、以降は直前の図形の置いた後の端＋すき間に置く。したがって**並べた先頭は動かず、末尾の右端（下端）が全体の右端（下端）にそろう**。重なっていてすき間が負でも同じ手順で計算する（異常として扱わない）。入れ子などで`max`が最大の図形が並べた末尾でないときは、末尾の図形が動いて右端が全体の右端にそろい、`max`が最大だった図形が動く場合がある（図形が横に並んでいる通常の場合は両端の図形が動かない）。
    *   **押せない条件**：その操作で**1pxも動く図形が無い**とき、または図形の数が足りないとき（整列は2つ未満、分布は3つ未満）は、そのボタンが`disabled`（押せない見た目）。判定は`canApplyAlign`（`computeAlignMoves(...).length > 0`）の1か所で、表示と手順の「何もしない」が同じ判定を共有する。移動量0は許容量`1e-9`で判定する（分布は割り算・累積の足し算を使い、すでに均等でも誤差で極小の移動量が出ると「押せるのに見た目が変わらない」ボタンが残るため。含める移動量は計算した値のまま丸めない）。ボタンは`disabled`で始まる。
    *   **操作1回＝取り消し1件**：`commitEdit()`へまとめの鍵を渡さない（6.）。続けて2回そろえれば取り消しも2回必要。動く図形が無い操作は`beginEdit`も呼ばず履歴に触れない。
    *   **スナップ・端点への吸い付き・表示倍率と無関係**：移動量はワールド座標のpxで、`UnitSnapSettings`を読まず（17.）、そろえた結果の座標を刻みへ丸めない。端点への吸い付き（12.）も働かせない。表示倍率・スクロールを読まない。
    *   **ドラッグ中は受理しない**：`performShapeAlign`が`inputTracker.isDragging()`を見て`false`を返す（重なり順（14.）と同じ。ドラッグが開いている編集操作と`beginEdit`／`commitEdit`の対を崩さないため。位置の欄（20.）・スタイル（13.）のように拒まない方針とは異なる）。
    *   **操作モードを見ない**：`ShapeAlignEditor`は`getMode`を持たず、選択中の図形の集合だけを対象にする。頂点の選択（`A`）でも、図形を選んでいれば押せる（`A`へ切り替えた直後は`InputTracker.setMode`が選択を空にするため押せない。`A`のまま`Ctrl`+クリックで図形を2つ以上選べば押せる）。頂点（`A`で選んだ頂点）をそろえる機能は作らない（後のPhaseで足せる作り）。
    *   **キーを割り当てない**：ボタンだけ（`KeyboardShortcuts`・`InputTracker`・`FocusKeyYieldRules`は変更していない。ボタンの`title`にキーを書かない）。
    *   **発注者の決定（2026-11-17。実装側の判断で変えてはならない）**：(1) 間隔を均等にするのは外枠どうしのすき間をそろえること（両端の図形を動かさず、間の図形を動かす）。(2) 対象は図形だけ（頂点の選択をそろえる機能は作らない）。(3) すでにそろっていて1pxも動かない操作、図形の数が足りない操作のボタンは押せない見た目。(4) キーボードショートカットは割り当てない。(5) 整列の基準は選択全体の外枠（2026-11-16の決定）。(6) 操作1回が取り消し1件。
    *   **やらないこと**：1章「存在しないもの」のPhase 08-05の分のとおり（頂点をそろえる機能、基準にする図形・キャンバスを基準にした整列、指定した間隔の分布、中心の間隔をそろえる分布、キー、大きさ・角度の欄、基準点、変形、頂点の追加・削除、結果へのスナップの丸め・端点への吸い付き）。
    *   **確認の状況**：`OptionBarAlignGroup`（DOM）・`main.js`の`// 7.11.`の配線・`index.html`の整列・分布のまとまりの見た目と1280px幅での収まり（約1138px）・記号の見分けやすさ（記号は`⬅ ↔ ➡ ⬆ ↕ ⬇ ⋯ ⋮`の仮で、`index.html`のボタンの中身の1か所ずつで差し替えられる。環境によって絵文字表示になり大きさがそろわない可能性がある）は`node --test`で確かめられない（DOMに依存）。確認項目を発注者へ提示済み（テストプレイで確かめる範囲）。規則・手順・`moveShapesBy`・外枠の照会は自動テストで確かめている（件数は`_doc/arch/16_test.md`。tests 1543）。

22. **直線・曲線のツールで線を続けて引く (`core/InputTracker.js` → `edit/EndpointSnapper.js` → `shapes/PathJoinRules.js`・`shapes/EndpointSnapRules.js`・`core/VectorModel.js`（`replaceDraft`）・`core/HistoryManager.js`、配線は`main.js`・`core/KeyboardShortcuts.js`、丸めは`core/UnitSnapRules.js`・`core/MoveDirectionRules.js`)**（Interrupt。2026-11-18。12.の端点への吸い付きに載せた別の流れ）：直線のツール（`1`）は、クリックごとに点を打ち、決まった操作で終える。点2つで終えれば今と同じ直線（`line`）、3つ以上ならパス（区間はすべて`'line'`の`path`。開いたまま終えれば開いたパス、始点に吸い付いて終えれば閉じたパス）。作業データ・書き出し・履歴のエントリの形・版は変えない（2のまま。新しい図形種別・区間の種類も無い。これは直線のツールだけだった当時の記述で、Phase 09-01aで区間の種類`'smooth'`が加わり書き出し形式の版は3になった。2章）。直線以外のツール・選択（`V`）・頂点の選択（`A`）・キャンバス移動（`H`）は変えない。
    *   **曲線のツール（Phase 09-01a）**：曲線のツール（〜・`2`）も同じ操作・同じ流れで、足す区間の種類だけが違う（`'smooth'`＝曲線の区間。2章`path`）。作成途中の線は`ShapeFactory.create('curve', …)`が作る頂点2つ・区間1つ（`'smooth'`）の開いたパスから始まり（点1つの間は両側が仮の点で直線と同じ形）、足す区間の種類は作成途中の線の区間が持つ（`buildDrawnDraft`・`drawnSegmentKind`）。点2つで終えたら直線（`line`）、3つ以上なら曲線のパス（全区間`'smooth'`の開いた／始点で閉じた。閉じたパスは1周がひとつの連なりで始点のところもなめらかになるため、始点へ吸い付いている間の形と閉じた後の形は始点付近で少し変わる）。曲線のパスも、直線のツールの線と同じ操作で既存の線とつながる（Phase 09-01b。描き足し・つながる・閉じるで描いた区間は曲線の区間。描き始めが端点で点2つで開いたまま終えたときは、`line`を作らず元の線に曲線の区間を1つ描き足す。11.・12.）。今の曲線（`curve`）は新しく作られず、読み込んだものだけが残る。
    *   **用語**：**線を引いている途中**＝直線・曲線のツールで1点目を打ってから終えるまで（`DRAWING`で、作成途中の図形が続けて引く線の形＝直線・開いたパス（区間の種類は問わない）のとき。`isDrawnLineShape`）。**曲線の区間**＝区間の種類`'smooth'`の区間、**直線の区間**＝`'line'`の区間。**曲線のパス**＝曲線の区間を1つ以上持つパス。**今の曲線**＝図形種別`curve`（1本の2次の曲線）。**打った点**＝クリックで確定した点（1点目＝始点を含む。最後に打った点＝最後の点）。**付いてくる線**＝最後の点からカーソルまでの未確定の区間、その先の点＝**付いてくる線の先**。**開いたまま終える**＝打った点だけで確定（付いてくる線は捨てる）。**始点への吸い付き**＝作成途中の線の自分の始点への端点への吸い付き（12.と同じ表示・距離で、結果の種類`kind: 'drawnStart'`で区別する。スナップ（17.）とは別）。
    *   **状態の持ち主（二重に持たない）**：打った点の並びは`VectorModel`の作成途中の図形（`#draftShape`）だけが持つ。打った点が`k`個のとき頂点は`k + 1`個（末尾＝付いてくる線の先）。`k = 1`は`Line`（曲線のツールでは頂点2つの曲線のパス。形は直線と同じ）、`k ≥ 2`は開いた`Path`（曲線のツールでは全区間が曲線の区間）。付いてくる線の先の追従は既存の`model.updateDraft` → 図形の`updateDraftEnd`（`Path`では最後の頂点を動かす）。`InputTracker`は点の並びも吸い付きの新しい作業用フィールドも持たない（既存の`#drawStartSnap`＝描き始めの端点、`#drawEndSnap`＝直前の`mousemove`の照会結果だけを使う）。描画（アウトライン表示を含む）は`CanvasManager`が作成途中の図形をポリモーフィックに描くため変更なし。
    *   **モジュールの分担**：点の並びの規則＝`PathJoinRules`（作成途中の線から点を打った線・最後の点を消した線・終えた線を組み立てる＝**直線とパスの作り分けは非公開の`buildLineOrPath`の1箇所**（第4引数で足す区間の種類を受ける。作成途中の線の組み立ては非公開の`buildDrawnDraft`、足す区間の種類の取り出しは`drawnSegmentKind`）。最後の点の照会・付いてくる線の先が最後の点と重なるかの判定・閉じられるか（打った点が3つ以上か）の判定。`planDrawnLineJoin`は途中の点が複数の線へ広がり、頂点2つでは従来と同じ結果）。**置き場所の理由**：作り分けを使うのは`edit/EndpointSnapper`だけで`shapes/PathJoinRules`は既にimport済み（`ShapeFactory`へ入口を足すと`edit/ → core/ShapeFactory`の例外の追加か、`VectorModel`が点の並びを読む＝図形固有の構造を知る、ことになる）／閉じたパスの頂点数の下限・結合できる線の判定・描き足しの組み立てを同じファイルで共有し二重定義を避ける。`ShapeFactory`は作り分けの入口にせず、09-01aで変えたのは`curve`の`create`だけ。吸い付きの規則＝`EndpointSnapRules.findDrawnLineSnapTarget`（描き始めの端点を除いた端点＋条件を満たせば始点。`findSnapTarget`と走査を共有）。丸め＝`UnitSnapRules.roundConstrainedPointFromOriginToUnit`、向きの限定＝`MoveDirectionRules.constrainMoveDirection`（変更なし）。作成途中の図形の置き換え＝`VectorModel.replaceDraft(shape)`（呼び出し元は`edit/EndpointSnapper`のみ）。手順＝`EndpointSnapper`（`isDrawingLine`・`findDrawnLineSnap`・`getDrawnLineLastPoint`・`clickDrawnLine`・`finishDrawnLine`・`removeDrawnLinePoint`。判定は規則の関数を呼ぶだけ）。配線＝`InputTracker`（注入された補助へ`isDrawingLine()`で照会するだけで図形種別を知らない。補助が注入されない既定値では常に偽で従来の2クリックの直線のまま）・`main.js`・`KeyboardShortcuts`（対応表は変えていない）。
    *   **操作ごとの流れ**：
        *   1点目（描き始め）のクリック：従来のまま（12.の「流れ（直線・曲線の描き始め）」）。
        *   `mousemove`：`Ctrl`の間は照会せず`null`、それ以外は`findDrawnLineSnap(描き始めの結果, 丸めていないカーソル位置)` → `#drawEndSnap`へ保持・表示 → 付いてくる線の先＝吸い付けばその座標、吸い付かず`Shift`なら最後の点を基準に限定して丸めた位置（17.）、それ以外は従来どおり`roundPointToUnit`。
        *   クリック：`EndpointSnapper.clickDrawnLine`の判定の順（下）。終えたなら`IDLE`へ戻して`#resetSnapState()`、点を打ったなら`#drawEndSnap`を`null`・表示を消して続ける。
        *   `Esc`（`cancelDraftOrClearSelection`の`DRAWING`の枝）：線を引いている途中なら`finishDrawnLine`（開いたまま終える。始点だけなら何も残らない）。直線以外は従来どおり破棄。
        *   `Backspace`/`Delete`・`Ctrl`+`Z`（・取り消しボタン）：最後の点を消す（`removeDrawnLinePoint`。始点だけなら引くのをやめる）。`Backspace`/`Delete`は`deleteLastLinePointOrSelection()`（引いていなければ従来の`deleteSelection()`）、`Ctrl`+`Z`は`performUndo`の1b.（6.）。点を消した後、付いてくる線の先は消す前の位置のまま・照会結果と表示は消す（キーのイベントはカーソル位置を持たない）。
        *   ツールの切り替え（`V`・`A`・`P`・`H`・`I`・数字キー・ツールパレットのボタン）：`main.js`の`selectModeTool`・`selectShapeTool`・`startEyedropper`が先に`inputTracker.finishLineDrawing()`（線を引いている途中なら開いたまま終える）を呼んでから切り替える。**ドラッグ中（中ボタンのパン中）でも終える**（終えないと続く`setMode`の中断が線を捨て「ツールを切り替えたら描いた分を残す」に反するため。パンは記録先・図形・選択集合に触れず、記録は1件のまま。パンのドラッグそのものは中断しない。続く`setMode`が中断するのは`selectModeTool`・`startEyedropper`などモードが変わる経路だけで、図形作成モードのまま図形のツールを選ぶ`selectShapeTool`は`applyMode`を呼ばず`setShapeType`もドラッグを中断しないため、パンは離すまで続く）。`ensureSelectMode`の経路（全選択・貼り付け・同じ位置に貼り付け・選択の反転）・`prepareSwitch`・`prepareInsert`・`performRedo`・`onImport`は通らず、従来どおり`setMode`・`abortOngoingOperation`が線を捨てる。
        *   パン・ズーム：従来のまま`DRAWING`を保つ。
    *   **クリックの判定の順（`clickDrawnLine`）**：1. `#drawEndSnap`が始点への吸い付きで閉じられる（打った点が3つ以上）→ 閉じて終える。2. 付いてくる線の先が最後の点と重なる（距離は`JOIN_TOLERANCE_SCREEN_PX`の画面上5pxをその時点の表示倍率でワールドへ換算）→ 開いたまま終える（点が1つならやめる。「同じ位置で2回クリック」＝ダブルクリックはこれ。`dblclick`のリスナーは無く2回の`click`として扱う）。3. `#drawEndSnap`が端点への吸い付き → その線とつながって終える（`commitDrawnLine`。点が1つなら従来の2クリックの直線の描き終えと同じ）。4. それ以外 → 点を打つ（記録しない）。
    *   **記録（取り消し1件）**：終えるたびに`EndpointSnapper`の中で`beginEdit`/`commitEdit`の1組（6.）。点を打つ・消すは`model.replaceDraft`（点が1つで消したときは`cancelDraft`）だけで記録先に触れず、選択集合も変えない。5点打って終えた線は`Ctrl`+`Z`1回で丸ごと消え、`Ctrl`+`Y`で丸ごと戻る。
    *   **`replaceDraft`の約束**：作成途中の図形があるときだけ働き（無い／`#shapes`の図形のときは何もしない）、渡された図形のidを`null`にし、直前に使った値（スタイル3つ）を当て、`#shapes`へは入れず、通知は1回。
    *   **既存の線とつながる・閉じる**：開いた線の端点から引き始め点を打って終えると、その線の続きとして伸びた1本（元のid・色・太さ・塗り・位置を保つ）。別の線の端点で終えるとつながった1本、両端とも別の線なら3本が1本。同じ線のもう一方の端点で終えると閉じる（頂点が3つ以上の開いたパスなら途中の点なしでも閉じる。途中の点が要るのは相手が直線のとき＝頂点2つの線は閉じない）。計画は`planDrawnLineJoin`（途中の点を足すときは端点と重なる点を足さない）。結果は元の区間の種類を保ち、足す区間・間を埋める区間は描いた区間の種類（11.）。
    *   **発注者の決定（2026-11-19。Phase 09-01b）**：曲線の区間どうしのつなぎ目はなめらか／結合（ボタン・`J`）の間を埋める区間は直線。
    *   **発注者の決定（2026-11-18）**：点が2つなら直線・3つ以上ならパス／終え方は「最後の点をもう1回クリック」「始点で閉じる」「`Esc`」「ほかのツールへの切り替え」／`Shift`は線を引いている途中の付いてくる線の先も限定する／既存の線の端点から引き始めたときは自分の始点に吸い付かない／始点への吸い付きは打った点が3つ以上のとき／ツールを切り替えたら描いた分を残す。
    *   **現場設計セッションが決めた点**：直線とパスの作り分けの置き場所は`PathJoinRules`（上記）／線を引いているかの判定は「作成途中の図形が続けて引く線の形か」（`isDrawingLine`。図形種別の文字列を新たに比べない）。当初は「結合できる線か」で判定していたが、曲線のツールの作成途中の線が曲線の区間を持ち結合できる線でなくなるため、Phase 09-01aで`isDrawnLineShape`（直線・開いたパス。区間の種類を問わない）へ見直した。Phase 09-01bで結合できる線は続けて引く線の形と同じ条件になった（11.）。
    *   **注意**：(a) クリックの判定の順により、`Ctrl`で吸い付きを止めて端点の上に点を打った直後、`Ctrl`を離して少し動かしその点でクリックすると、つながらず開いたまま終わる（2.が3.より先）。(b) 閉じる・つながるの1回目で終わった後のダブルクリックの2回目は、新しい線の描き始めになる（従来の直線の描き終えと同じ）。(c) 最後の点を消した直後にマウスを動かさずクリックすると、その位置に点が打たれる（吸い付かない）。(d) 打った点の間隔が狭いまま縮小すると、点を打つつもりのクリックが「最後の点と重なる」で終わることがある。(e) `Ctrl`+`Z`を押し続けると点が1つずつ消え、始点だけで引くのをやめた後は続くリピートで履歴の取り消しが進む。(f) 表示倍率・パンの扱いは12.の注意と同じ。
    *   **確認の状況**：`InputTracker`・`main.js`の配線・カーソルの追従と表示・ダブルクリック・`Shift`/`Ctrl`の読み取り・パン・ズームとの組み合わせは自動テストの対象外（`InputTracker`・`main.js`はテストを置かない）。規則・手順は`test/shapes/`・`test/core/`・`test/edit/`のテストで確かめた（`_doc/arch/16_test.md`）。
    *   **やらないこと**：1章「存在しないもの」の連続引きの分のとおり（ドラッグによるフリーハンドの線・`Enter`・`Ctrl`＋クリックでの線の終了・やり直しで点を戻す仕組み。曲線の連続作成はPhase 09-01aで曲線のツールとして入った）。新しい図形種別・区間の種類・新しいソースのファイルは足さない（当時の直線のツールの作業。区間の種類はPhase 09-01aで足した。テストファイル`test/core/VectorModel.replaceDraft.test.js`は新しく作った）。

---

### 4. 各モジュールの責務リファレンス
本文はモジュールごとのファイルに分かれている。**作業では、該当するモジュールのファイルだけを読むこと。開発資料への反映も該当するモジュールのファイルに対して行うこと。** 新しいモジュールは`_doc/arch/`に同じ形式のファイルを作り、下の一覧に1行追加する。

| モジュール | ファイル |
| --- | --- |
| `index.html` | `_doc/arch/01_index_html.md` |
| `main.js` | `_doc/arch/02_main.md` |
| `VectorModel.js` | `_doc/arch/03_VectorModel.md` |
| `CanvasManager.js` | `_doc/arch/04_CanvasManager.md` |
| `ViewTransform.js` | `_doc/arch/05_ViewTransform.md` |
| `InputTracker.js` | `_doc/arch/06_InputTracker.md` |
| `KeyboardShortcuts.js` | `_doc/arch/07_KeyboardShortcuts.md` |
| `HistoryManager.js` | `_doc/arch/08_HistoryManager.md` |
| `DragTracker.js` | `_doc/arch/09_DragTracker.md` |
| `ShapeFactory.js` | `_doc/arch/10_ShapeFactory.md` |
| `WindowManager.js` | `_doc/arch/11_WindowManager.md` |
| `shapes/` | `_doc/arch/12_shapes.md` |
| `palette/` | `_doc/arch/13_palette.md` |
| `edit/` | `_doc/arch/14_edit.md` |
| `io/` | `_doc/arch/15_io.md` |
| `test/`（自動テスト） | `_doc/arch/16_test.md` |
| `sprite-check.html`・`check/`（確認用ページ） | `_doc/arch/17_sprite_check.md` |
| `PointHitRules.js` | `_doc/arch/18_PointHitRules.md` |
| `ToolRules.js` | `_doc/arch/19_ToolRules.md` |
| `DisplayState.js` | `_doc/arch/20_DisplayState.md` |
| `GridSpacingRules.js` | `_doc/arch/21_GridSpacingRules.md` |
| `RulerTickRules.js` | `_doc/arch/22_RulerTickRules.md` |
| `RulerRenderer.js` | `_doc/arch/23_RulerRenderer.md` |
| `CanvasCursorTracker.js` | `_doc/arch/24_CanvasCursorTracker.md` |
| `ViewFitRules.js` | `_doc/arch/25_ViewFitRules.md` |
| `StatusReadoutRules.js` | `_doc/arch/26_StatusReadoutRules.md` |
| `SelectionRules.js` | `_doc/arch/27_SelectionRules.md` |
| `MoveDirectionRules.js` | `_doc/arch/28_MoveDirectionRules.md` |
| `AltKeyGuard.js` | `_doc/arch/29_AltKeyGuard.md` |
| `UnitSnapRules.js` | `_doc/arch/30_UnitSnapRules.md` |
| `UnitSnapSettings.js` | `_doc/arch/31_UnitSnapSettings.md` |
| `InputModes.js` | `_doc/arch/32_InputModes.md` |
| `FocusKeyYieldRules.js` | `_doc/arch/33_FocusKeyYieldRules.md` |
| `PressActionRules.js` | `_doc/arch/34_PressActionRules.md` |
| `CursorShapeRules.js` | `_doc/arch/35_CursorShapeRules.md` |
| `wiring/DisplayWiring.js` | `_doc/arch/36_DisplayWiring.md` |
| `SpriteFitRules.js` | `_doc/arch/37_SpriteFitRules.md` |
| `VertexHandleRules.js` | `_doc/arch/38_VertexHandleRules.md` |
| `wiring/ToolIconWiring.js` | `_doc/arch/39_ToolIconWiring.md` |
| `asset/sprite/` | `_doc/arch/40_asset_sprite.md` |
| `NudgeTargetRules.js` | `_doc/arch/41_NudgeTargetRules.md` |
