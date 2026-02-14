# ReportController Documentation

The `ReportController` manages the conversation logic for the Lark bot. It handles user commands, maintains session state, and coordinates actions between `MicoClient`, `LarkBot`, and `ExcelProcessor`.

## 🧠 Core Concept: State Machine

The controller uses a simple state machine to manage user interactions. Each user has a `UserSession` object tracked by their `userId`.

### States
- **IDLE**: Default state, waiting for commands.
- **WAITING_UNION_DATE**: User commanded `/union`, bot is waiting for date input (MM/YYYY).
- **WAITING_VJ_DATE**: User commanded `/vj`, bot is waiting for date input.
- **WAITING_EXPORT_DATE**: User commanded `/export`, bot is waiting for date input.
- **WAITING_USER_ID**: User commanded `/income`, bot is waiting for a numeric User ID.
- **WAITING_USER_DETAIL_MONTH**: User selected a specific VJ from `/income`, bot is waiting for month selection.

## 🎮 Commands

| Command | Description | Flow |
| :--- | :--- | :--- |
| `/union` | Show Union statistics | State -> `WAITING_UNION_DATE` -> User sends Date -> Bot replies with Card |
| `/vj` | Show Top VJ Ranking | State -> `WAITING_VJ_DATE` -> User sends Date -> Bot replies with Ranking Card |
| `/export` | Export CSV/Excel | State -> `WAITING_EXPORT_DATE` -> User sends Date -> Bot processes export -> Bot sends File |
| `/income` | Check individual income | State -> `WAITING_USER_ID` -> User sends ID -> Bot replies with Profile Card |
| `/cancel` | Cancel current operation | Resets state to `IDLE` |

## 🧩 Interactive Cards

The controller uses `LarkCardContent` to render rich, interactive messages.

Key helper methods:
- `sendDateSelectCard(chatId, title)`: Sends a card with buttons for the last 6 months.
- `renderVJRankingCard(results, displayDate)`: Renders a table of top VJs.
- `renderDetailedIncomeCard(...)`: Renders a complex profile card with avatar, family info, and income history.

## 🔄 Logic Flow

1.  **`handleMessage(chatId, userId, text)`**: Entry point for text messages. Checks for `/commands` first, then delegates based on current session state.
2.  **`handleAction(chatId, userId, action)`**: Entry point for button clicks (card interactions). Updates state or triggers specific flows like `view_history`.
