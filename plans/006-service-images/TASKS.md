# 006 — Service: images — tasks

## Schemas

- [ ] `src/lib/schemas/images/Image.ts` DTO
- [ ] `src/lib/schemas/images/{ListImages,GetImage,ListDeviceImages,ToggleFavorite,AddTag,RemoveTag,SoftDeleteImage,BlacklistImage,RestoreImage}.ts`
- [ ] `index.ts` barrel
- [ ] Unit test: `ListImagesRequest` accepts every filter; rejects unknown keys

## Services

- [ ] `service/images/base.ts`
- [ ] 9 operation mixins per Decisions
- [ ] `ListImages` builds query via Drizzle + raw FTS5 IN-subquery when `search` set
- [ ] `BlacklistImage` clears `favorited` and `user_tags` join rows
- [ ] `RestoreImage` refuses on blacklisted with `AppError("validation.blacklisted", …)`
- [ ] `service/images/index.ts` barrel + `runtime.services.images`

## Routes

- [ ] `src/routes/api/v1/images/+server.ts` — GET
- [ ] `src/routes/api/v1/images/[id]/+server.ts` — GET + DELETE (`?blacklist=true` honoured)
- [ ] `src/routes/api/v1/images/[id]/favorite/+server.ts` — POST
- [ ] `src/routes/api/v1/images/[id]/tags/+server.ts` — POST
- [ ] `src/routes/api/v1/images/[id]/tags/[tag]/+server.ts` — DELETE
- [ ] `src/routes/api/v1/images/[id]/restore/+server.ts` — POST
- [ ] `src/routes/api/v1/devices/[slug]/images/+server.ts` — GET
- [ ] All gated by auth, error-mapped

## Test fixtures

- [ ] `src/test/fixtures/seed_images.ts` seeds 20 rows across 2 devices, 2 sources, mixed nsfw

## Service tests

- [ ] `ListImages.test.ts` — empty / populated / filter device / filter source / favorited / nsfw matrix / include_deleted / include_blacklisted / search
- [ ] FTS5 test: two rows, distinct `search_text`; query for one term returns one row in expected order
- [ ] `GetImage.test.ts` — happy / soft-deleted hidden by default / `include_deleted=true` returns it
- [ ] `ListDeviceImages.test.ts`
- [ ] `ToggleFavorite.test.ts`
- [ ] `AddTag.test.ts` — happy, idempotent on duplicate, normalised lower-case
- [ ] `RemoveTag.test.ts`
- [ ] `SoftDeleteImage.test.ts`
- [ ] `BlacklistImage.test.ts`
- [ ] `RestoreImage.test.ts` — happy + refuses on blacklisted

## Route tests

- [ ] One per endpoint
- [ ] Unauth → 401 (003 gate)

## Verification gates

- [ ] `bun run check` clean
- [ ] `bun test` green
- [ ] `bunx eslint .` zero errors
- [ ] `bunx prettier --check .` clean
- [ ] Smoke: list / search / favorite / tag / soft-delete / restore via curl
- [ ] `lefthook` pre-commit + commit-msg pass

## Commit + push

- [ ] `feat(service-images): list/search/get/favorite/tag/delete/blacklist/restore + per-device images`
- [ ] Co-author trailer + push
- [ ] `Status: done`
- [ ] README index updated
- [ ] `chore(plans): mark 006-service-images done` committed + pushed
