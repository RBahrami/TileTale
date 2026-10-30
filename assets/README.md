# Image assets

The four starter images are personal photographs supplied by the project
owner and bundled into the repository, so the game never depends on remote
URLs at runtime.

| File | Puzzle | Subject | Size |
| --- | --- | --- | --- |
| `puzzle-1.jpg` | puzzle-1 | Hiking group in a rocky valley | 1280x960 |
| `puzzle-2.jpg` | puzzle-2 | Picnic by a mountain stream | 1280x960 |
| `puzzle-3.jpg` | puzzle-3 | Group dinner in a traditional restaurant | 775x771 |
| `puzzle-4.jpg` | puzzle-4 | Hiking group under a big tree | 1280x853 |

Notes:

- These are the owner's own photos — all rights reserved by them.
- Images were re-saved through Pillow to bake orientation and strip all
  EXIF metadata (including GPS coordinates); pixel content is unchanged.
- How images are displayed: each picture is scaled to **fill the whole
  puzzle board, edge to edge** (stretched/shrunk in both directions to
  match the board shape, currently 4x3). The completed puzzle reproduces
  the full picture.

You can replace any of them with your own pictures — see "Replace an image"
in the main [README](../README.md).
