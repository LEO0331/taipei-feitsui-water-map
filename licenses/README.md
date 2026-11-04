# Version-pinned supplemental source

The installed `victory-vendor@37.3.6` package declares `MIT AND ISC` but omits its wrapper's license file from the package root. `victory-vendor-37.3.6-LICENSE.txt` retains the corresponding upstream wrapper license from:

https://raw.githubusercontent.com/FormidableLabs/victory/v37.3.6/LICENSE.txt

The notice builder also retains all thirteen license files shipped under that installed package's `lib-vendor/` directory. The generated inventory records the source path, package version, URL where supplemental, and SHA-256 of each included text. A different installed Victory version requires an explicit source review instead of silently reusing this version's supplemental text.

This is factual notice preservation, not a license compatibility or use certification. In particular, the installed `react-leaflet` and `@react-leaflet/core` license texts are Hippocratic 2.1 and are retained verbatim.
