*   **MoveDirectionRules.js**：移動量を、原点を通る横・縦・斜め45°（右下がり・右上がり）の4本の直線のうち最も近いものへ限定する規則を、状態を持たない関数として提供する（Phase 07-04で新設）。
    *   **公開**：`constrainMoveDirection(dx, dy)` → `{ dx, dy }`（新しいオブジェクト）。有限の数値を前提とする（NaN・Infinityは扱わない）。
    *   **契約**：移動量0（`dx`・`dy`とも0）はそのまま。横（`|dy| <= |dx| * T`、`T = Math.SQRT2 - 1`＝tan 22.5°）は`{ dx, dy: 0 }`、縦（`|dx| <= |dy| * T`）は`{ dx: 0, dy }`、それ以外は斜めで`s = (|dx| + |dy|) / 2`として`{ sign(dx) * s, sign(dy) * s }`（`|dx| === |dy|`が厳密に成り立つ）。三角関数を使わず場合分けするため、浮動小数の誤差で直線から外れない。22.5°ちょうどの境界は`<=`により横・縦の側に決まり、同じ入力に常に同じ結果を返す。引数を書き換えない。
    *   **読むもの・知らないこと**：なし（何もimportしない。DOM・`Shift`キー・移動の対象・図形を知らない）。
    *   **使う側**：`core/InputTracker`の非公開の`#resolveMoveDelta`のみ（`event.shiftKey`のとき、押した位置からの移動量へ適用する。`Shift`を見るのは追従のたびのイベント）。`MoveDirectionRules`は`InputTracker`だけが使う（`PointHitRules`と同じ位置づけ。1章「フォルダ分割の方針」）。
    *   **注意**：押した位置からの移動量を加工する箇所は`#resolveMoveDelta`の1か所だけ（Phase 07-05の移動量の丸めもそこへ足す。丸めと本規則の順序はそのとき決める）。
    *   **テスト**：`test/core/MoveDirectionRules.test.js`（`_doc/arch/16_test.md`）。
