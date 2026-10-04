# Review with Bugbot, then fix real bugs

Run one Bugbot review of the current branch, fix only findings that are clearly real bugs, and report the outcome.

## Review

Follow the `review-bugbot` skill exactly:

- Launch exactly one `bugbot` subagent.
- `description`: `Bugbot`
- `run_in_background`: false
- Prompt:

```text
Full Repository Path: <absolute git repository path>
Diff: branch changes
```

Do not compute the diff yourself before launching it. Do not pass `Base Branch` unless this branch should be compared to something other than the repository default.

If the subagent fails, follow the skill’s retry rules once. If it still fails, stop and report the error. Do not fix anything.

## Decide what to fix

After the review, judge each finding from the code, not from the severity label.

Fix a finding only when all of these are true:

- The code path is wrong for a user who hits it (broken action, wrong data, clipped or unreachable control, lost state).
- You can name the function or branch that causes it.
- The fix stays inside that bug. Do not refactor nearby code.

Leave a finding alone when any of these are true:

- It is a guess, a style note, or a possible future problem.
- It describes intended product behavior.
- The fix would change money, auth, or order rules beyond the bug.
- You are not sure it happens.

## Fix

Apply the sure fixes. Do not launch Bugbot again.

## Report

Reply with two lists. If a list is empty, say so.

**Fixed**

| Location | Bug | Change |
| --- | --- | --- |
| `file:line` | What was wrong | What you changed |

**Left**

| Location | Finding | Why it was left |
| --- | --- | --- |
| `file:line` | Bugbot’s finding | Not sure / intended / out of scope |
