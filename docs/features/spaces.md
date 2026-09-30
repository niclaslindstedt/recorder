# Spaces

A space is a separate library — its own recordings, its own folders, its own
index on a backend. Personal and Work, or one per client. The **space glyph**
on the top bar, beside the cog, is the active space's own symbol in its own
colour, so it says which space is open without a label. Press it for the
spaces sheet, which switches between spaces, makes new ones, renames them,
sets each one's colour and symbol, and forgets them.

Every space is its own file on a backend (`recorder-<space>.json`) with its
own folder of files beside it, so two spaces never meet in a merge and a
backend can carry as many as you make. Forgetting a space on a device removes
it from this device only; the copy on the backend is not touched.

The list of spaces is kept per device. A space made on another device is
found again through **Settings → Storage → Look for spaces**, which lists the
indexes the backend holds; open one and it syncs here.

Moving a recording between spaces is not offered, on purpose: it would be a
copy of the bytes and a deletion, and a merge has no way to say "moved".
