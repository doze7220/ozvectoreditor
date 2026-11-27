/**
 * 責務: スプライトJS（ESモジュール）のテキストの形を担う：組み立て（スプライトデータと共通の描画処理の埋め込み）と、
 * 実行せずにテキストから埋め込んだスプライトデータ（JSONのテキスト）を取り出すこと。DOMに依存しない。
 */
import { SpriteSerializer, DEFAULT_STROKE_WIDTH } from './SpriteSerializer.js';

/**
 * スプライトデータの宣言の開始（行頭から、JSONのテキストの直前まで）。
 * 組み立て（`toModuleText`）と取り出し（`extractSpriteDataText`）の両方が使う。
 * @type {string}
 */
const SPRITE_DATA_DECLARATION_START = 'const spriteData = ';

/**
 * スプライトデータの宣言の終わり（JSONのテキストの直後）。取り出しでは、これに改行が続く位置を終わりとする。
 * 組み立て（`toModuleText`）と取り出し（`extractSpriteDataText`）の両方が使う。
 * @type {string}
 */
const SPRITE_DATA_DECLARATION_END = ';';

/**
 * 書き出すJSの先頭に置く固定の説明コメント（キャンバス名等の利用者の入力は含めない）。
 * 注意: `const spriteData = `で始まる行を置かないこと（`extractSpriteDataText`が宣言の開始を探す目印のため）。
 * @type {string}
 */
const HEADER_COMMENT = [
    '/**',
    ' * OZ Vector Editor が出力したスプライト（ESモジュール）。他のファイルに依存しない。',
    ' * 既定のexportは、スプライトデータ（format・formatVersion・bounds・elements）と、',
    ' * それを描く draw(ctx) を持つ1つのオブジェクト。座標の単位はpx、基準点は原点(0, 0)、y軸は下向き。',
    ' */',
].join('\n');

/**
 * 書き出すJSへそのまま埋め込む共通の描画処理（`draw`・`drawElement`・`export default`の行）のテキスト。
 * スプライトデータ（`spriteData`）と`DEFAULT_STROKE_WIDTH`は、このテキストの前に別途埋め込まれる。
 * 保守上の注意: 内容は開発資料（`PROJECT_ARCHITECTURE.md` 2章「スプライト（書き出し形式）」）の描画要素の表・描き方（塗りの規則を含む）と、
 * `shapes/`の各図形の`draw`（描画命令・引数・順序）に揃えること。変更したら`test/io/CodeExporter.test.js`の見た目の一致のテストを確認する。
 * このテキストの中で`import`・テンプレート文字列・外部の名前（`window`等）を使わない。
 * @type {string}
 */
const DRAW_SOURCE = [
    '/**',
    ' * スプライトを ctx へ描く。ctx の現在の変換の上に、原点(0, 0)を基準に描く。呼び出し前後で ctx の状態は変わらない。',
    ' * @param {CanvasRenderingContext2D} ctx - 描画先の2Dコンテキスト',
    ' */',
    'function draw(ctx) {',
    '    ctx.save();',
    '    try {',
    "        ctx.lineCap = 'butt';",
    "        ctx.lineJoin = 'miter';",
    '        ctx.miterLimit = 10;',
    '        ctx.setLineDash([]);',
    '        for (const element of spriteData.elements) {',
    '            drawElement(ctx, element);',
    '        }',
    '    } finally {',
    '        ctx.restore();',
    '    }',
    '}',
    '',
    '/**',
    ' * 描画要素1つの形の項目が足りているか（パスを組み立てられるか）を返す。kind ごとの条件は次のとおり。',
    ' * polyline は points が2点以上の配列、quadratic は points が3点以上の配列、',
    ' * bezierPath は points が2点以上の配列で segments の数が一致し（閉じていれば points の数、開いていれば points の数 - 1）、各区間が line、または control1・control2 を持つ cubic、',
    ' * ellipse は radiusX・radiusY が0以上の数値。未知の kind は false。fillColor・strokeColor・closed の値は見ない。',
    ' * @param {Object} element - 描画要素',
    ' * @returns {boolean} 形の項目が足りていれば true',
    ' */',
    'function canTrace(element) {',
    '    switch (element.kind) {',
    "        case 'polyline':",
    '            return Array.isArray(element.points) && element.points.length >= 2;',
    "        case 'quadratic':",
    '            return Array.isArray(element.points) && element.points.length >= 3;',
    "        case 'bezierPath': {",
    '            const points = element.points;',
    '            const segments = element.segments;',
    '            if (!Array.isArray(points) || points.length < 2 || !Array.isArray(segments)',
    '                || segments.length !== (element.closed === true ? points.length : points.length - 1)) {',
    '                return false;',
    '            }',
    '            for (const segment of segments) {',
    "                if (typeof segment !== 'object' || segment === null) {",
    '                    return false;',
    '                }',
    "                if (segment.kind === 'cubic') {",
    "                    if (typeof segment.control1 !== 'object' || segment.control1 === null",
    "                        || typeof segment.control2 !== 'object' || segment.control2 === null) {",
    '                        return false;',
    '                    }',
    "                } else if (segment.kind !== 'line') {",
    '                    return false;',
    '                }',
    '            }',
    '            return true;',
    '        }',
    "        case 'ellipse':",
    "            return typeof element.radiusX === 'number' && element.radiusX >= 0",
    "                && typeof element.radiusY === 'number' && element.radiusY >= 0;",
    '        default:',
    '            return false;',
    '    }',
    '}',
    '',
    '/**',
    ' * 描画要素1つの形のパスを ctx へ足す（beginPath は呼ばない。canTrace が true の要素だけに使う）。',
    ' * 始点への moveTo から、線・曲線・楕円の命令、閉じた要素の closePath まで。',
    ' * ellipse の rotation（ラジアン）が有限の数値でなければ0として描く（rotation の無い版3以前の要素も描ける）。',
    ' * @param {CanvasRenderingContext2D} ctx - 描画先の2Dコンテキスト',
    ' * @param {Object} element - 描画要素（canTrace が true）',
    ' */',
    'function traceElement(ctx, element) {',
    '    switch (element.kind) {',
    "        case 'polyline': {",
    '            const points = element.points;',
    '            ctx.moveTo(points[0].x, points[0].y);',
    '            for (let i = 1; i < points.length; i++) {',
    '                ctx.lineTo(points[i].x, points[i].y);',
    '            }',
    '            if (element.closed === true) {',
    '                ctx.closePath();',
    '            }',
    '            break;',
    '        }',
    "        case 'quadratic': {",
    '            const points = element.points;',
    '            ctx.moveTo(points[0].x, points[0].y);',
    '            ctx.quadraticCurveTo(points[1].x, points[1].y, points[2].x, points[2].y);',
    '            break;',
    '        }',
    "        case 'bezierPath': {",
    '            const points = element.points;',
    '            const segments = element.segments;',
    '            ctx.moveTo(points[0].x, points[0].y);',
    '            for (let i = 0; i < segments.length; i++) {',
    '                const end = points[(i + 1) % points.length];',
    "                if (segments[i].kind === 'cubic') {",
    '                    ctx.bezierCurveTo(segments[i].control1.x, segments[i].control1.y, segments[i].control2.x, segments[i].control2.y, end.x, end.y);',
    '                } else if (!(element.closed === true && i === points.length - 1)) {',
    '                    ctx.lineTo(end.x, end.y);',
    '                }',
    '            }',
    '            if (element.closed === true) {',
    '                ctx.closePath();',
    '            }',
    '            break;',
    '        }',
    "        case 'ellipse': {",
    '            ctx.ellipse(element.x, element.y, element.radiusX, element.radiusY, Number.isFinite(element.rotation) ? element.rotation : 0, element.startAngle, element.endAngle);',
    '            if (element.closed === true) {',
    '                ctx.closePath();',
    '            }',
    '            break;',
    '        }',
    '        default:',
    '            break;',
    '    }',
    '}',
    '',
    '/**',
    ' * 描画要素 compoundPath（複数の輪郭を持つ1つの要素）を描く（beginPath → 輪郭ごとのパス → 塗り → 線の順）。',
    " * 塗るのは fillColor が文字列のとき（輪郭の種類・closed を問わない。開いた輪郭も塗りでは始点と終点を結んだ形として数える）、fill('evenodd') で塗る。",
    ' * 線を描くのは strokeColor が文字列のときだけ。どちらも描かない要素はパスも組み立てない。',
    ' * outlines が配列でない・空、または canTrace が false の輪郭（形の項目が足りない・未知の kind・入れ子の compoundPath）が1つでもあれば何も描かない',
    ' * （一部だけ描くと穴が塗られた形になり、何も描かないより見た目を誤らせるため）。',
    ' * ellipse の輪郭は、前の輪郭の終点とつながる直線ができないよう、先に始点へ moveTo してから楕円を足す。',
    ' * @param {CanvasRenderingContext2D} ctx - 描画先の2Dコンテキスト',
    ' * @param {Object} element - compoundPath の描画要素',
    ' */',
    'function drawCompoundPath(ctx, element) {',
    "    const shouldStroke = typeof element.strokeColor === 'string';",
    "    const shouldFill = typeof element.fillColor === 'string';",
    '    if (!shouldStroke && !shouldFill) {',
    '        return;',
    '    }',
    '    const outlines = element.outlines;',
    '    if (!Array.isArray(outlines) || outlines.length === 0) {',
    '        return;',
    '    }',
    '    for (const outline of outlines) {',
    "        if (typeof outline !== 'object' || outline === null || !canTrace(outline)) {",
    '            return;',
    '        }',
    '    }',
    '    ctx.beginPath();',
    '    for (const outline of outlines) {',
    "        if (outline.kind === 'ellipse') {",
    '            const rotation = Number.isFinite(outline.rotation) ? outline.rotation : 0;',
    '            const ex = outline.radiusX * Math.cos(outline.startAngle);',
    '            const ey = outline.radiusY * Math.sin(outline.startAngle);',
    '            const cosR = Math.cos(rotation);',
    '            const sinR = Math.sin(rotation);',
    '            ctx.moveTo(outline.x + ex * cosR - ey * sinR, outline.y + ex * sinR + ey * cosR);',
    '        }',
    '        traceElement(ctx, outline);',
    '    }',
    '    if (shouldFill) {',
    '        ctx.fillStyle = element.fillColor;',
    "        ctx.fill('evenodd');",
    '    }',
    '    if (shouldStroke) {',
    '        ctx.strokeStyle = element.strokeColor;',
    "        ctx.lineWidth = typeof element.strokeWidth === 'number' && Number.isFinite(element.strokeWidth) && element.strokeWidth > 0",
    '            ? element.strokeWidth',
    '            : DEFAULT_STROKE_WIDTH;',
    '        ctx.stroke();',
    '    }',
    '}',
    '',
    '/**',
    ' * 描画要素1つの塗りと線を描く（パス → 塗り → 線の順）。',
    ' * kind が compoundPath の要素は drawCompoundPath で描く（塗りの規則はそちらに書く）。',
    ' * ほかの要素で塗るのは、fillColor が文字列で、かつ kind が polyline・ellipse・bezierPath のいずれかで closed が true の要素だけ（fill() は引数なし）。',
    ' * 線を描くのは strokeColor が文字列の要素だけ。どちらも描かない要素はパスも組み立てない。',
    ' * 形の項目が足りない要素・未知の kind の要素は塗りも線も描かない。',
    ' * @param {CanvasRenderingContext2D} ctx - 描画先の2Dコンテキスト',
    ' * @param {Object} element - 描画要素',
    ' */',
    'function drawElement(ctx, element) {',
    "    if (element.kind === 'compoundPath') {",
    '        drawCompoundPath(ctx, element);',
    '        return;',
    '    }',
    "    const shouldStroke = typeof element.strokeColor === 'string';",
    "    const shouldFill = typeof element.fillColor === 'string' && element.closed === true",
    "        && (element.kind === 'polyline' || element.kind === 'ellipse' || element.kind === 'bezierPath');",
    '    if (!shouldStroke && !shouldFill) {',
    '        return;',
    '    }',
    '    if (!canTrace(element)) {',
    '        return;',
    '    }',
    '    ctx.beginPath();',
    '    traceElement(ctx, element);',
    '    if (shouldFill) {',
    '        ctx.fillStyle = element.fillColor;',
    '        ctx.fill();',
    '    }',
    '    if (shouldStroke) {',
    '        ctx.strokeStyle = element.strokeColor;',
    "        ctx.lineWidth = typeof element.strokeWidth === 'number' && Number.isFinite(element.strokeWidth) && element.strokeWidth > 0",
    '            ? element.strokeWidth',
    '            : DEFAULT_STROKE_WIDTH;',
    '        ctx.stroke();',
    '    }',
    '}',
    '',
    'export default { ...spriteData, draw };',
].join('\n');

/**
 * スプライトJS（ESモジュール）のテキストの組み立てと、テキストからのスプライトデータの取り出し（実行しない）を行う静的メソッド群。
 * インスタンス状態を持たず、DOMにも依存しない。図形・図形種別・キャンバス名を知らない（引数はスプライトデータまたはJSのテキストのみ）。
 */
export class CodeExporter {
    /**
     * スプライトデータからスプライトJS（ESモジュール）のテキストを組み立てる。
     * `import`文を含まず、既定のexportのみを持つ（値はスプライトデータの全キーと`draw`を持つ1つのオブジェクト）。
     * @param {import('./SpriteSerializer.js').SpriteData} spriteData - `SpriteSerializer.serialize`の戻り値
     * @returns {string} JSのテキスト（末尾は改行）
     */
    static toModuleText(spriteData) {
        return [
            HEADER_COMMENT,
            SPRITE_DATA_DECLARATION_START + SpriteSerializer.stringify(spriteData) + SPRITE_DATA_DECLARATION_END,
            '',
            `const DEFAULT_STROKE_WIDTH = ${JSON.stringify(DEFAULT_STROKE_WIDTH)};`,
            '',
            DRAW_SOURCE,
            '',
        ].join('\n');
    }

    /**
     * `toModuleText`が書き出したJSのテキストから、埋め込まれたスプライトデータのJSONのテキストを取り出す。
     * JSを実行せず（`import`・`eval`・`Function`を使わない）、`JSON.parse`もしない（呼び出し側が行う）。例外を投げない。
     *
     * 手順: 文字列でなければ`null` → 改行コードを`\n`へそろえる（`CRLF`・`CR`のJSも可）
     * → 行頭の`const spriteData = `（テキストの先頭、または`\n`の直後の最初の出現）を探す。無ければ`null`
     * → その直後から、最初の`;`＋改行までをJSONのテキストとして返す。見つからなければ`null`。
     *
     * この手順が正しい理由: `SpriteSerializer.stringify`（`JSON.stringify`）の出力は、文字列の値の中に改行を生のまま含まず
     * （`\n`等へエスケープされる）、`;`は文字列の値の中にしか現れない。そのため宣言の開始の後の最初の「`;`＋改行」が宣言の終わりである。
     * 先頭の説明コメント（`HEADER_COMMENT`）には`const spriteData = `で始まる行を置かないこと。
     *
     * 本アプリが書き出した形から外れたJS（手で整形し直したもの等）は`null`になり得る。
     * 呼び出し元: `FileContentReader`（エディタの「開く」「インポート」）。
     * @param {*} moduleText - JSのテキスト（文字列以外は`null`を返す）
     * @returns {string|null} スプライトデータのJSONのテキスト。取り出せなければ`null`
     */
    static extractSpriteDataText(moduleText) {
        if (typeof moduleText !== 'string') {
            return null;
        }
        const text = moduleText.replace(/\r\n?/g, '\n');
        let start;
        if (text.startsWith(SPRITE_DATA_DECLARATION_START)) {
            start = SPRITE_DATA_DECLARATION_START.length;
        } else {
            const found = text.indexOf('\n' + SPRITE_DATA_DECLARATION_START);
            if (found === -1) {
                return null;
            }
            start = found + 1 + SPRITE_DATA_DECLARATION_START.length;
        }
        const end = text.indexOf(SPRITE_DATA_DECLARATION_END + '\n', start);
        if (end === -1) {
            return null;
        }
        return text.slice(start, end);
    }
}
