*   **UnitSnapRules.js**：スナップ（座標・移動量を刻みの倍数へ丸めること。端点への吸い付きとは別）の規則を、状態を持たない関数として提供する（Phase 07-05で新設。`MoveDirectionRules`と同じ形）。
    *   **公開**：`resolveUnitSnapStep(activeStep, suppressed)` → `number|null`、`roundPointToUnit(point, step)` → `{x, y}`、`roundDeltaToUnit(delta, step)` → `{dx, dy}`、`roundConstrainedDeltaToUnit(delta, step)` → `{dx, dy}`、`roundPointFromOriginToUnit(origin, target, step)` → `{x, y}`（いずれも新しいオブジェクト。引数を書き換えない）。有限の数値を前提とする（NaN・Infinityは扱わない）。
    *   **契約**：
        *   **刻み（`step`）の約束**：正の有限の数値なら丸める。それ以外（`null`＝スナップOFF・`Ctrl`を押している間、ほかの値も同じ扱い）は**丸めない**＝入力と同じ値（`-0`の入力もそのまま）を新しいオブジェクトで返す。単位の値（1・10）はこのファイルに書かない（唯一の定義箇所は`core/UnitSnapSettings.js`の`UNIT_SNAP_STEPS`）。
        *   **1つの値の丸め**：**ちょうど中間の値は0から遠い側へ丸める**（`2.5`→`3`、`-2.5`→`-3`。符号について対称で、同じ入力には常に同じ結果）。丸めた結果が0のときは`0`（`-0`を返さない）。
        *   `resolveUnitSnapStep`：今効いている刻み（`UnitSnapSettings.getActiveStep()`）と「一時無効か」（呼び出し側が読んだ`Ctrl`の有無）を組み合わせる**唯一の箇所**。`suppressed`が真なら`null`、偽なら`activeStep`をそのまま返す。
        *   `roundPointToUnit`・`roundDeltaToUnit`：軸ごとに独立に丸める。
        *   `roundConstrainedDeltaToUnit`：`MoveDirectionRules.constrainMoveDirection`の結果（横・縦・斜め45°の直線へ限定した移動量）を、限定した直線の上に保ったまま丸める。横（`dy === 0`）は`dx`だけ、縦（`dx === 0`）は`dy`だけを丸め、斜めは`s = round((|dx| + |dy|) / 2)`として`{ sign(dx) * s, sign(dy) * s }`（`|dx| === |dy|`が厳密に成り立つ）。`dx`・`dy`とも0なら`{ 0, 0 }`。`|dx| === |dy|`が厳密に成り立つ入力（`constrainMoveDirection`の結果）なら、軸ごとに独立に丸める`roundDeltaToUnit`でも45°は崩れず、本関数と同じ結果になる。別に持つ理由は、`|dx|`と`|dy|`が厳密には等しくない斜めの入力でも結果を必ず45°（`|dx| === |dy|`）にするため（刻み1で`{ dx: 2.4, dy: 2.6 }` → `roundDeltaToUnit`は`{ dx: 2, dy: 3 }`、本関数は`{ dx: 3, dy: 3 }`）。`MoveDirectionRules`をimportしない。
        *   `roundPointFromOriginToUnit`：基準点`origin`から目標`target`への移動量を丸めた位置`origin + 丸めた移動量`を返す（頂点のハンドルのドラッグ。基準点が小数の座標でも小数の部分が保たれる）。丸めないときは`{ x: target.x, y: target.y }`をそのまま返し、`origin + (target − origin)`は計算しない（浮動小数の誤差で今の値と変わらないため）。
    *   **読むもの・知らないこと**：なし（何もimportしない。DOM・図形・`VectorModel`・表示倍率・修飾キー・スナップの設定・`Shift`キーを知らない）。
    *   **使う側**：`core/InputTracker`（5つの関数すべてを、点を打つ・図形を動かす・頂点を動かす入力の丸めに使う）と`main.js`（`resolveUnitSnapStep`・`roundPointToUnit`をステータスバーの座標の表示に使う）。`SelectionRules`と同じく両方が使う位置づけ（1章「フォルダ分割の方針」）。座標の表示は点を打つ位置と同じ規則の関数を通る（丸めるか＝`getActiveStep`と`resolveUnitSnapStep`、丸め＝`roundPointToUnit`）。
    *   **注意**：丸める箇所の一覧・`Ctrl`を見る時点・端点への吸い付きとの優先は`PROJECT_ARCHITECTURE.md`3章17.。規則を変えると点を打つ位置・移動量・座標の表示が同時に変わる。
    *   **テスト**：`test/core/UnitSnapRules.test.js`（`_doc/arch/16_test.md`）。
