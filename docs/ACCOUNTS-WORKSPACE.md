# Accounts & Transactions

`/account-support` uses `BankingCases` and the workspace's department-scoped `BankingCase` records. `AccountsWorkspace` presents the queue and uses the existing case editor, role checks and local save handler. The search fields and category groups retain their existing meanings. The theme toggle uses the existing stored preference. The eNL palette applies through the banking shell class and Qalo keeps its own palette.

KPI cards and status counts cover all permitted account cases in the active workspace and department. Search, status and category filters affect the matching case count and queue. Activity sorting uses the latest recorded event or creation time when the case has no newer event.

The supplied brief provided written direction for the hero and empty state. Both use CSS and existing vector assets. The case list loads from local workspace state, with a pending indicator for saves.
