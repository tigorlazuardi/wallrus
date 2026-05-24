# 006 — Service: images — tasks

## Schemas

- [x] `src/lib/schemas/images/Image.ts` DTO
- [x] `src/lib/schemas/images/{ListImages,GetImage,ListDeviceImages,ToggleFavorite,AddTag,RemoveTag,SoftDeleteImage,BlacklistImage,RestoreImage}.ts`
- [x] `index.ts` barrel
- [x] Unit test: `ListImagesRequest` accepts every filter; rejects unknown keys

## Services

- [x] `service/images/base.ts` — verified
- [x] 9 operation mixins per Decisions — verified (ListImages.ts bugs fixed: images.rowid qualified, \_list_images_page1 inlined, ListDeviceImages extends Sup not ListImages(Sup))
- [x] `ListImages` builds query via Drizzle + raw FTS5 IN-subquery when `search` set — verified
- [x] `BlacklistImage` clears `favorited` and `user_tags` join rows — verified
- [x] `RestoreImage` refuses on blacklisted with `AppError("validation.blacklisted", …)` — verified
- [x] `service/images/index.ts` barrel + `runtime.services.images` — verified (18 test files updated with images mock)

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

- [x] `src/test/fixtures/seed_images.ts` seeds 20 rows across 2 devices, 2 sources, mixed nsfw — verified

## Service tests

- [x] `ListImages.test.ts` — empty / populated / filter device / filter source / favorited / nsfw matrix / include_deleted / include_blacklisted / search
- [x] FTS5 test: two rows, distinct `search_text`; query for one term returns one row in expected order
- [x] `GetImage.test.ts` — happy / soft-deleted hidden by default / `include_deleted=true` returns it
- [x] `ListDeviceImages.test.ts`
- [x] `ToggleFavorite.test.ts`
- [x] `AddTag.test.ts` — happy, idempotent on duplicate, normalised lower-case
- [x] `RemoveTag.test.ts`
- [x] `SoftDeleteImage.test.ts`
- [x] `BlacklistImage.test.ts`
- [x] `RestoreImage.test.ts` — happy + refuses on blacklisted

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
