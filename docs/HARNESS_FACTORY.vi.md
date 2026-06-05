# Port Harness Factory

Repo này port phần logic hữu ích từ `revfactory/harness` mà không vendor toàn bộ
Claude Code plugin.

## Đã Port

- thiết kế harness theo phase,
- pattern kiến trúc agent/team,
- nguyên tắc tạo skill,
- thiết kế workflow orchestrator,
- validation và trigger testing,
- quy tắc tiến hóa harness.

## Không Port

- cài đặt qua Claude Code plugin marketplace,
- bắt buộc output vào `.claude/agents/`,
- bắt buộc output vào `.claude/skills/`,
- giả định runtime Agent Teams của Claude.

## Đích Repo-Native

| Đích | Dùng cho |
| --- | --- |
| `.agents/skills/harness-factory/SKILL.md` | Skill project-local cho Codex đọc |
| `.agents/skills/harness-factory/references/` | Tham chiếu pattern, artifact và validation |
| `.kiro/steering/harness-factory.md` | Policy Kiro cho yêu cầu thiết kế harness |
| `docs/HARNESS.md` | Mô hình project harness tổng quát |
| `docs/demo/` | Ví dụ nhỏ về flow harness |
| `docs/templates/` | Artifact harness dùng lại |

## Khi Nào Dùng

Dùng skill đã port khi yêu cầu nói về:

- agent team mới,
- harness theo domain,
- tạo skill,
- thiết kế orchestrator,
- audit các file harness hiện có,
- chuyển ý tưởng `revfactory/harness` sang Codex hoặc Kiro.

## Nguồn

Project gốc mô tả Harness là team-architecture factory sinh agent definition và
skill theo domain, dựa trên sáu pattern kiến trúc. Repo này chuyển các ý tưởng
đó thành project-local skills, Kiro steering và artifact tài liệu.
