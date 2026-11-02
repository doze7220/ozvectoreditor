# OZ Vector Editor

HTML5 Canvas / Vanilla JS（ES Modules、ビルドツールなし）のゲーム用ベクターエディタ。コードを変更する者は必ず `./PROJECT_CONSTITUTION.md` に従うこと。

開発は REQ/RES 駆動で行う（REQ: `_log/req/`、RES: `_log/res/`、DIR: `_log/dir/`）。

* **Phase の親セッション**（DIR策定・サブフェイズ管理）では、スキル `oz-dir-session` の手順に従う。
* **REQ／サブフェイズのセッション**（親から起動された子、または単独の Interrupt / Survey）では、スキル `oz-req-session` の手順に従う（実装はサブエージェント `oz-implementer`、監査は `oz-auditor` に任せる）。
* **サブエージェントとして起動された場合**は、渡された指示とエージェント定義だけに従い、上記スキルは参照しない。
