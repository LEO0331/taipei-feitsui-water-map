# Policy #13 geographic evidence audit

**Map admission: zero Policy #13 station pins.** All 16 admitted station labels have `coordinateStatus: "unverified"` in this independent policy audit. River/station tables and period charts remain available without invented points. Existing map modules and their coordinate contracts are preserved.

The [official Taipei station context](https://www.tldep.gov.taipei/Public/DetInformation/RiverQuality.aspx) is retained as original HTML. Its default selected station is 永福橋 on 新店溪; that rendering displays coordinate text `121.52838333, 25.01198333`, area 中正區, and location 新北市永和區福和路. These are current page context, not coordinates for all 16 annual station identities. The retained rendering does not independently establish a coordinate reference system, historical source edition applicability, relocation history or a complete verified station-coordinate registry. No coordinates are inferred for the other stations from river names or dropdown order.

| Criterion | Status |
| --- | --- |
| Official river/station labels | Annual CSV relationships retained; 15 exact current station-label matches and one unmatched spelling |
| Numerical coordinate evidence | One default-rendered current context pair; not admitted for historical policy map use |
| CRS independently verified | Not established by the retained coordinate field |
| Historical station/coordinate continuity | Unverified for all 16 |
| Source-backed policy coordinate registry | Not available |
| Policy map pins | 0 included / 16 excluded |

Any future admission must provide an explicit station-bound official coordinate source and CRS, validate numeric longitude/latitude and geographic plausibility, resolve spelling/identity discrepancies, record source edition and date applicability, and set `coordinateStatus: "verified"` in the appropriate accepted location registry. A successful map rendering or plausible river proximity is insufficient evidence. No river centerlines, geocoded approximations or arbitrary centroids are generated.

This absence of admitted map pins is a documentary limitation, not a conclusion that the official monitoring program lacks locations. Proximity cannot establish pollution transport, catchment membership, upstream/downstream causation, public safety or regulatory compliance.
