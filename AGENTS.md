- Create a design document for the patterns you want followed for nextjs projects. use speech islands as a reference
- Put logic into pure functions when you can so that they can be tested
- Alwasy make sure the user understands what you are doing
- always write a test before you start. End to end and unit
- always run tests after your done so you dindt break any thing
- always split new work into a worktree or branch outside of git
- Follow engineering best practices for performant and seucre software
- Write tests that test behavior over implementation details
- PUsh back against me if I tell you think is wrong

Database

- Always put database query logic inside of a function
- Always keep business logic outside of the database functions to keep it reusable and organized
- Use transactions for atomicitiy, be weary of concurrency race conditions

API endpoints
Todo:

- Input is sanitized
- Error handling is correct with correct response codes

Testing

- E2E tests with Playwright
- Unit/Integration tests with RTL
- Api route testing with???

Cleaning up orphan processes
Warning: Node.js 20 actions are deprecated. The following actions are running on Node.js 20 and may not work as expected: actions/checkout@v4, oven-sh/setup-bun@3d267786b128fe76c2f16a390aa2448b815359f3. Actions will be forced to run with Node.js 24 by default starting June 2nd, 2026. Please check if updated versions of these actions are available that support Node.js 24. To opt into Node.js 24 now, set the FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true environment variable on the runner or in your workflow file. Once Node.js 24 becomes the default, you can temporarily opt out by setting ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
