


## Issues We Ran Into

### 1. BIGGEST ISSUE: Actual API Doesn't Match Documentation

**What the docs say for POST /task/create:**
```json
{
  "id": "...",
  "title": "...",
  "description": "...",    // ← Documented
  "status": "...",         // ← Documented
  "createdAt": "...",
  "updatedAt": "...",
  "organizationId": "..."  // ← Documented
}
```

**What the API ACTUALLY returns:**
```json
{
  "id": "...",
  "title": "...",
  "prompt": "...",         // ← NOT "description"!
  // NO "status" field at all!
  "organizationId": "...", // ← This one matches
  "agent": "...",
  "hash": "...",
  "metadata": {},
  "issueSourceId": "...",
  "level": 1,
  // ... 20+ other undocumented fields
}
```

Example response we got: 

```json

{
  "id": "fb5a8438-762b-4327-afdd-917754c28430",
  "metadata": {},
  "createdAt": "2025-11-15T05:52:00.534Z",
  "updatedAt": "2025-11-15T05:52:00.534Z",
  "organizationId": "org_32ZBYjmTM5hnE2hDJI21w9nfFTn",
  "title": "Verify status field test",
  "hash": "5170ce563f6ad5d30b7b3ff588b9bf6be0e2566daeb6f02d0651c6288059e420",
  "prompt": "Verify status field test",
  "context": null,
  "jsonContent": null,
  "externalId": null,
  "externalUrl": null,
  "kind": "user-supplied",
  "data": {},
  "targetBranch": null,
  "sourceBranch": null,
  "issueSourceId": "38a2c3d1-09fc-4206-8e35-f4e6a2b8944f",
  "level": 1,
  "levelReasoning": null,
  "lastSeenAt": "2025-11-15T05:52:00.527Z",
  "lastQueuedAt": null,
  "lastQueuedBy": null,
  "createdBy": "user_32ZBYgcxBaR0jFkbM0CBPOEsAhr",
  "agent": "claudeCode:claude-4-5-sonnet",
  "sandboxType": null,
  "mcpServers": [],
  "solutionType": null,
  "workflowId": null
}
```


Even within documented API, there are inconsistencies:

**Problem: `orgId` vs `organizationId`**
```typescript
// GET /me returns (per docs):
{ userId: "...", orgId: "..." }      // ← uses "orgId"

// POST /task/create returns (per docs):
{ ..., organizationId: "..." }        // ← uses "organizationId"


```

**Problem: `repositories` vs `codeRepositories`**
```typescript
// GET /repository/list returns:
{ codeRepositories: [...] }          // ← verbose

// But POST /task/create accepts:
{ repositories: [...] }               // ← simple


```



Undocumented Fields & Missing Fields 

**Missing from create response (but documented):**
- `status` field - Docs say it should be there, but it's not
- `description` field - Docs say it's there, but API returns `prompt` instead

**Present but undocumented:**
- `hash`, `metadata`, `kind`, `data`, `targetBranch`, `sourceBranch`
- `issueSourceId`, `level`, `levelReasoning`, `lastSeenAt`, `lastQueuedAt`
- `createdBy`, `sandboxType`, `mcpServers`, `solutionType`, `workflowId`
- And more...


Discord (and most chat platforms) have a **3-second timeout** for interactions. Tembo's task creation endpoint takes **~3.7 seconds**:

```bash
$ time create_task()
Task created in 3729ms  # 3.7 seconds!
```

This meant we had to:
- Use background processing with `waitUntil()`
- Return immediate acknowledgment without waiting for the task
- Tell users to check `/list-tasks` later

**Suggestion:**
- Make task creation async/webhook-based (return immediately with task ID, update via webhook)
- Or optimize the endpoint to respond in < 1 second
- Or add a "quick create" endpoint that just queues the task

**Example API Design:**
```typescript
// POST /task/create - Returns immediately
{ 
  id: "task-123",
  status: "queued",
  message: "Task is being processed"
}

// Then either:
// - Poll GET /task/{id} for status
// - Or receive webhook when task is ready
```

---
Missing TypeScript Types / Type Mismatches 

The `@tembo-io/sdk` package has TypeScript support which is great! But the types don't always match what the API actually returns:

**Issues:**
- Optional fields aren't marked as optional in types
- Some fields in the API response aren't in the TypeScript types
- Type definitions lag behind API changes

**💡 Suggestion:**
- Auto-generate TypeScript types from your API schema (OpenAPI/Swagger)
- Make sure optional fields are marked with `?`


---


## Example: Ideal Task Creation Flow

Here's what would make life easier:

```typescript
// 1. Fast create (< 1 second)
const task = await client.task.create({
  prompt: "Build feature X",
  agent: "claudeCode:claude-4-5-sonnet",
  repositories: ["https://github.com/org/repo"],
  branch: "main"
});

// 2. Consistent response shape
console.log(task);
// {
//   id: "task-123",
//   title: "Build feature X",
//   description: "Build feature X",  // Same as prompt
//   status: "queued",                // Always present
//   agent: "claudeCode:claude-4-5-sonnet",
//   repositories: [...],             // Not codeRepositories
//   organizationId: "org-456",       // Not orgId
//   createdAt: "2025-11-15T...",
//   updatedAt: "2025-11-15T..."
// }

// 3. Poll or webhook for completion
client.task.onStatusChange(task.id, (updatedTask) => {
  console.log(`Task ${updatedTask.id} is now ${updatedTask.status}`);
});
```

**Built with:** Discord API v10 (discord-api-types + discord-interactions), Hono.js, Cloudflare Workers, Tembo SDK
**Integration:** HTTP-based Discord interactions (serverless) 



