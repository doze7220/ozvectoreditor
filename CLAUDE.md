# OZ Vector Editor

HTML5 Canvas / Vanilla JS（ES Modules、ビルドツールなし）のゲーム用ベクターエディタ。コードを変更する者は必ず `./PROJECT_CONSTITUTION.md` に従うこと。

開発は REQ/RES 駆動で行う（REQ: `_log/req/`、RES: `_log/res/`、DIR: `_log/dir/`）。

* **リード設計セッション**（ゲームのルールや次の Phase の目的を相談し、DIR を策定する）では、スキル `oz-dir-session` の手順に従う。
* **現場設計セッション**（DIR をもとにサブフェイズごとの REQ を1つずつ作り、実装セッションを起動する。単発の Interrupt / Survey の REQ もここで作る）では、スキル `oz-req-session` の手順に従う。
* **実装セッション**（現場設計セッションから1つの REQ を渡されて起動された子）では、スキル `oz-impl-session` の手順に従う（実装はサブエージェント `oz-implementer`、監査は `oz-auditor` に任せる）。
* **サブエージェントとして起動された場合**は、渡された指示とエージェント定義だけに従い、上記スキル・手順書は参照しない。
