/**
 * 責務: スプライトJS（ESモジュール）のテキストの組み立て（スプライトデータの埋め込みと、データを読む共通の描画処理の埋め込み）を担う。
 * DOMに依存しない。
 */
import { SpriteSerializer, DEFAULT_STROKE_WIDTH } from './SpriteSerializer.js';

/**
 * 書き出すJSの先頭に置く固定の説明コメント（キャンバス名等の利用者の入力は含めない）。
 * @type {string}
 */
const HEADER_COMMENT = [
    '/**',
    ' * OZ Vector Editor が出力したスプライト（ESモジュール）。他のファイルに依存しない。',
    ' * 既定のexportは、スプライトデータ（format・formatVersion・bounds・elements・source）と、',
    ' * それを描く draw(ctx) を持つ1つのオブジェクト。座標の単位はpx、基準点は原点(0, 0)、y軸は下向き。',
    ' */',
].join('\n');

/**
 * 書き出すJSへそのまま埋め込む共通の描画処理（`draw`・`drawElement`・`export default`の行）のテキスト。
 * スプライトデータ（`spriteData`）と`DEFAULT_STROKE_WIDTH`は、このテキストの前に別途埋め込まれる。
 * 保守上の注意: 内容はスプライトデータ形式の描画要素の表・描き方（RES 2章要件3・要件7）と、
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
    ' * 描画要素1つの線を描く。strokeColor が文字列でない場合は線を描かない（線のパスと stroke() を呼ばない）。',
    ' * 形の項目が足りない要素・未知の kind の要素も描かない。',
    ' * @param {CanvasRenderingContext2D} ctx - 描画先の2Dコンテキスト',
    ' * @param {Object} element - 描画要素',
    ' */',
    'function drawElement(ctx, element) {',
    "    if (typeof element.strokeColor !== 'string') {",
    '        return;',
    '    }',
    '    switch (element.kind) {',
    "        case 'polyline': {",
    '            const points = element.points;',
    '            if (!Array.isArray(points) || points.length < 2) {',
    '                return;',
    '            }',
    '            ctx.beginPath();',
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
    '            if (!Array.isArray(points) || points.length < 3) {',
    '                return;',
    '            }',
    '            ctx.beginPath();',
    '            ctx.moveTo(points[0].x, points[0].y);',
    '            ctx.quadraticCurveTo(points[1].x, points[1].y, points[2].x, points[2].y);',
    '            break;',
    '        }',
    "        case 'ellipse': {",
    "            if (typeof element.radiusX !== 'number' || !(element.radiusX >= 0)",
    "                || typeof element.radiusY !== 'number' || !(element.radiusY >= 0)) {",
    '                return;',
    '            }',
    '            ctx.beginPath();',
    '            ctx.ellipse(element.x, element.y, element.radiusX, element.radiusY, 0, element.startAngle, element.endAngle);',
    '            if (element.closed === true) {',
    '                ctx.closePath();',
    '            }',
    '            break;',
    '        }',
    '        default:',
    '            return;',
    '    }',
    '    ctx.strokeStyle = element.strokeColor;',
    "    ctx.lineWidth = typeof element.strokeWidth === 'number' && Number.isFinite(element.strokeWidth) && element.strokeWidth > 0",
    '        ? element.strokeWidth',
    '        : DEFAULT_STROKE_WIDTH;',
    '    ctx.stroke();',
    '}',
    '',
    'export default { ...spriteData, draw };',
].join('\n');

/**
 * スプライトJS（ESモジュール）のテキストを組み立てる静的メソッド群。インスタンス状態を持たず、DOMにも依存しない。
 * 図形・図形種別・キャンバス名を知らない（引数はスプライトデータのみ）。
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
            `const spriteData = ${SpriteSerializer.stringify(spriteData)};`,
            '',
            `const DEFAULT_STROKE_WIDTH = ${JSON.stringify(DEFAULT_STROKE_WIDTH)};`,
            '',
            DRAW_SOURCE,
            '',
        ].join('\n');
    }
}
