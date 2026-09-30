# Deterministic image fixtures

Fixtures enter this directory when a real tool test first needs them. Batch 1
adds the convention only; no conversion or image product fixture is implied.

Each fixture must have a record alongside it documenting:

| Field | Required evidence |
| --- | --- |
| Purpose | Exact behavior and edge case being tested |
| Provenance | Generated or sourced; creator/source and reproducible generation recipe or source reference |
| License/ownership | Known rights and any attribution requirement |
| Format | Actual encoding and expected MIME type, not just extension |
| Dimensions | Pixel width, height and decoded area |
| Transparency | Presence/absence of alpha and the intended transparent region |
| Consumer | Named tool and test file |
| Identity | SHA-256 checksum for the committed binary |

Prefer tiny, deterministic generated geometric fixtures. Later batches may add
JPEG, transparent PNG, WebP and HEIC when their tests require them. A HEIC fixture
must have known provenance before Batch 5 functional conversion acceptance.
Tests must use committed local fixtures, never download arbitrary internet images.
Do not commit large photographs for realism. Keep fixture generation separate
from measured processing behavior so a generator cannot hide a decoder failure.
