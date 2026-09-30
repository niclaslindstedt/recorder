# Recordings

**Recordings** is the list, newest first, grouped under day headings
("Today", "Yesterday", the weekday, then the date). A row is the shape of
the sound as a thumbnail, the title (with a star when it is a favorite), the
time and — where the heading has not already said it — the folder, and the
length on the right, lined up so a long interview stands out from a
thirty-second memo.

The heading is the **scope**: where you are (**All recordings**,
**Favorites**, a folder's path, or **Recently deleted**) and how many
recordings are in it. Press it and the folder picker opens: All, Favorites,
the folder tree with counts, **New folder** and Recently deleted — and each
folder's own menu, for arranging the tree (see [`folders.md`](folders.md)).
A folder shows what is filed in it and in the folders under it.

The **search** glyph beside the scope opens a sheet with the field at the
top. It looks through every folder in the space — titles, notes and folder
names — because the reason to search is not knowing where something was
filed. A result opens the player; closing it comes back to the results.

## The player

Tap a row and the player opens, a recording's page:

- the **title**, editable in place, with the favorite **star** and a close
  glyph beside it;
- when it was recorded, and the **folder** as a chip — tap it to move the
  recording, with the same folder picker;
- the recording's shape with the playhead over it (tap or drag to seek);
- play and pause, skip back and forward by the length set under **Settings →
  Playback**, and a **speed** button that steps through the rates;
- a **note**;
- the facts about the take, always in view: the container and how it was
  kept (compact or lossless), the sample rate, mono or stereo and the size
  on one line, and the loudest peak and whether it clipped (and how often)
  on the next;
- **Export…**, and a trash glyph at the other end to delete it.

Swipe a row left to bare its red trash button, and press it to delete;
hold one (or use the right button) for the rest:
favorite, move to a folder, export, delete. The export sheet is also where
the original file is shared as it is (see [`export.md`](export.md)).

## Recently deleted

Deleting a recording moves it to **Recently deleted**, where it stays for
thirty days — the line under the scope says so — and can be **put back**
from its menu. After that it is removed from this device and from every
synced copy — or sooner, with **Delete for good**. The reason it waits is
that the recording's file may be on other devices too, and they need to hear
about the deletion before the file goes; see [`../sync.md`](../sync.md).

## Not on this device yet

A recording whose index arrived from a backend before its file did says so in
the list and in the player, and plays the moment the sweep has fetched it.
