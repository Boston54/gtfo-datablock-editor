# v0.3.2
- Re-added Enums.json (oops)
- Changed some entries in definitions.json
- Added defaults for ChainedPuzzleDataBlock

# v0.3.1
- Added some missing field definitions.
- Added some missing datablock linkages.
- Fixed a bug where trying to input a TextDataBlock ID into name fields would save it as a string literal instead of properly linking.
- Fixed a bug where switching datablock and switching back would change the block that was being viewed back to the first block in the list.
- Added a sidebar when viewing the LevelLayoutDataBlock with temp text about planned features.

# v0.3
- Added definitions for almost all fields in almost all datablocks that can be viewed by hovering the field name.
- Added the ability to edit the text in the JSON view, allowing copy-and-pasting blocks and configs.
- Added a search bar to all dropdowns, allowing you to search datablocks by name or persistentID, or enums by value.
- Added a bunch of missing or incorrect datablock linkages. They *should* all be there now. (TextDataBlock is odd, support will come in a future update)
- Added a search bar to the datablock editor dropdowns.
- Added a 'Revert to Last Save' button to revert the project to its last save.
- Added a changelog tab.
- Added a vanilla datablocks tab.
- Added parsing so the PlayerOfflineGearDataBlock.GearJSON is easier to work with in the tree view.
- Changed the appearance of the hover text.
- Fixed a bug where /r and /n characters were being stripped away from string input fields.
- Fixed an issue with LocalizedText types in the datablocks.
- Fixed a bug where lists of enums were being displayed as a single enum in the tree view.

# v0.2.1
- Fixed a bug with not being able to open projects on Firefox
- Added some missing datablock linkages.

# v0.2
- UI Overhaul
- Added the configs tab so users can edit their mod configs.
- Added saving and loading projects in-browser
- Added opening entire projects instead of having to upload datablocks one folder at a time.
- Added some missing datablock linkages.
- Added the ability for users to input custom values instead of being restricted to those in the dropdowns.
- Added proper information to the Home tab
- Added support for loading jsonc datablocks.

# v0.1
- Initial in-dev test release.