/**
 * 責務: 図形と頂点の、クリック・範囲選択の次の選択と、図形の選択の反転の結果を、状態を持たない関数として提供する。
 * 引数を書き換えず新しい配列を返す。importなし・DOMなし。
 */

/**
 * 選択の変更の指示。`VectorModel`への受け渡しの形を区別するために使う。
 * - `{ type: 'set', ids }`：`setSelectionByUser(ids)`へ渡す（置き換え。利用者の選ぶ操作）。
 * - `{ type: 'clear' }`：`setSelectionByUser([])`を呼ぶ（全解除。利用者の外す操作で、描き込む先も無しになる）。
 * - `null`：何もしない。
 * @typedef {({type: 'set', ids: string[]} | {type: 'clear'} | null)} SelectionChange
 */

/**
 * クリックで当たった図形から、次の選択の変更を決める。
 * `additive`が偽のときの結果は、従来の`InputTracker`の呼び出し（`setSelection([bodyId])`／選択が空でないときだけ`clearSelection()`／何もしない）と1対1で一致する。
 * `additive`が真のとき、空白は解除しない。当たった図形が選択中なら外し、未選択なら末尾へ追加する。
 * @param {string[]} selectedIds 現在の選択中の図形id（書き換えない）
 * @param {string|null} hitId クリックした位置の図形本体のid（空白ならnull）
 * @param {boolean} additive 追加・解除モードか（`Ctrl`押下）
 * @returns {SelectionChange} 選択の変更（新しい配列を含む）
 */
export function resolveClickSelection(selectedIds, hitId, additive) {
    if (!additive) {
        if (hitId) {
            return { type: 'set', ids: [hitId] };
        }
        return selectedIds.length > 0 ? { type: 'clear' } : null;
    }
    if (!hitId) {
        return null;
    }
    if (selectedIds.includes(hitId)) {
        return { type: 'set', ids: selectedIds.filter((id) => id !== hitId) };
    }
    return { type: 'set', ids: [...selectedIds, hitId] };
}

/**
 * 利用者のクリックで当たった図形から、次の選択の変更を決める（`resolveClickSelection`との違いは空いている所のクリックだけ）。
 * `additive`が偽で`hitId`が無ければ、選択の有無によらず`{ type: 'clear' }`（何も選んでいなくても、描き込む先を外すため）。
 * それ以外は`resolveClickSelection`の結果と同じ。
 * @param {string[]} selectedIds 現在の選択中の図形id（書き換えない）
 * @param {string|null} hitId クリックした位置の図形本体のid（空白ならnull）
 * @param {boolean} additive 追加・解除モードか（`Ctrl`押下）
 * @returns {SelectionChange} 選択の変更（新しい配列を含む）
 */
export function resolveUserClickSelection(selectedIds, hitId, additive) {
    if (!additive && !hitId) {
        return { type: 'clear' };
    }
    return resolveClickSelection(selectedIds, hitId, additive);
}

/**
 * 範囲選択で当たった図形から、次の選択の変更を決める。
 * `additive`が偽のときは当たった図形で置き換える（0件でも`set([])`。従来の`setSelection(ids)`と同じ）。
 * `additive`が真のときは既存の選択へ未選択のものだけを足す（重複しない）。0件なら何もしない。
 * @param {string[]} selectedIds 現在の選択中の図形id（書き換えない）
 * @param {string[]} hitIds 範囲に当たった図形id（書き換えない）
 * @param {boolean} additive 追加モードか（`Ctrl`押下）
 * @returns {SelectionChange} 選択の変更（新しい配列を含む）
 */
export function resolveMarqueeSelection(selectedIds, hitIds, additive) {
    if (!additive) {
        return { type: 'set', ids: [...hitIds] };
    }
    if (hitIds.length === 0) {
        return null;
    }
    const merged = [...selectedIds];
    for (const id of hitIds) {
        if (!merged.includes(id)) {
            merged.push(id);
        }
    }
    return { type: 'set', ids: merged };
}

/**
 * 選択を反転する。全図形のうち選択中でないものを、全図形の並びで返す。
 * @param {string[]} allIds 全図形のid（描画順。書き換えない）
 * @param {string[]} selectedIds 選択中の図形id（書き換えない）
 * @returns {string[]} 反転後の選択（新しい配列）
 */
export function invertSelection(allIds, selectedIds) {
    return allIds.filter((id) => !selectedIds.includes(id));
}

/**
 * 頂点の選択の変更の指示。`VectorModel`への受け渡しの形を区別するために使う（図形用の`SelectionChange`と同じ約束）。
 * - `{ type: 'set', vertices }`：`setSelectedVertices(vertices)`へ渡す（置き換え）。
 * - `{ type: 'clear' }`：`clearSelectedVertices()`を呼ぶ（全解除）。
 * - `null`：何もしない。
 * @typedef {({type: 'set', vertices: Array<{shapeId: string, handle: string}>} | {type: 'clear'} | null)} VertexSelectionChange
 */

/**
 * 2つの頂点の組が同じ頂点か（図形のidとハンドル名の両方が一致するか）を返す。
 * @param {{shapeId: string, handle: string}} a 頂点の組
 * @param {{shapeId: string, handle: string}} b 頂点の組
 * @returns {boolean} 同じ頂点なら真
 */
function isSameVertex(a, b) {
    return a.shapeId === b.shapeId && a.handle === b.handle;
}

/**
 * クリックで当たった頂点から、次の頂点の選択の変更を決める。
 * `additive`が偽のときは、当たった頂点があればその1つだけで置き換える。当たっていなければ、選んでいる頂点があるときだけ全解除し、無ければ何もしない。
 * `additive`が真のときは、当たっていなければ何もしない。当たった頂点が選択中なら外し（残りの並びは保つ）、未選択なら末尾へ追加する。
 * 戻り値は`VectorModel`の`setSelectedVertices`／`clearSelectedVertices`の呼び分けを想定した形。
 * @param {Array<{shapeId: string, handle: string}>} selectedVertices 現在選んでいる頂点（選んだ順。書き換えない）
 * @param {{shapeId: string, handle: string}|null} hitVertex クリックした位置の頂点（無ければnull）
 * @param {boolean} additive 追加・解除モードか（`Ctrl`押下）
 * @returns {VertexSelectionChange} 頂点の選択の変更（新しい配列を含む）
 */
export function resolveVertexClickSelection(selectedVertices, hitVertex, additive) {
    if (!additive) {
        if (hitVertex) {
            return { type: 'set', vertices: [hitVertex] };
        }
        return selectedVertices.length > 0 ? { type: 'clear' } : null;
    }
    if (!hitVertex) {
        return null;
    }
    if (selectedVertices.some((v) => isSameVertex(v, hitVertex))) {
        return { type: 'set', vertices: selectedVertices.filter((v) => !isSameVertex(v, hitVertex)) };
    }
    return { type: 'set', vertices: [...selectedVertices, hitVertex] };
}

/**
 * 範囲選択で当たった頂点から、次の頂点の選択の変更を決める。
 * `additive`が偽のときは当たった頂点で置き換える（0件でも`set`で空になる）。
 * `additive`が真のときは既存の選択へ未選択のものだけを足す（重複しない。並びは既存→当たった順）。0件なら何もしない。
 * 戻り値は`VectorModel`の`setSelectedVertices`を呼ぶ想定の形。
 * @param {Array<{shapeId: string, handle: string}>} selectedVertices 現在選んでいる頂点（選んだ順。書き換えない）
 * @param {Array<{shapeId: string, handle: string}>} hitVertices 範囲に入った頂点（書き換えない）
 * @param {boolean} additive 追加モードか（`Ctrl`押下）
 * @returns {VertexSelectionChange} 頂点の選択の変更（新しい配列を含む）
 */
export function resolveVertexMarqueeSelection(selectedVertices, hitVertices, additive) {
    if (!additive) {
        return { type: 'set', vertices: [...hitVertices] };
    }
    if (hitVertices.length === 0) {
        return null;
    }
    const merged = [...selectedVertices];
    for (const v of hitVertices) {
        if (!merged.some((m) => isSameVertex(m, v))) {
            merged.push(v);
        }
    }
    return { type: 'set', vertices: merged };
}
