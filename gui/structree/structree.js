
var g_ParsedData = {};
var g_Lists = {};
var g_CivData = {};
var g_SelectedCiv = "";

function init (settings)
{
	// Initialize civ list
	initCivNameList();
}

// Initialize the dropdown containing all the available civs
function initCivNameList ()
{
	// Cache map data
	g_CivData = loadCivData(true);

	var civList = [ { "name": civ.Name, "code": civ.Code } for each (civ in g_CivData) ];

	// Alphabetically sort the list, ignoring case
	civList.sort(sortNameIgnoreCase);
	
	var civListNames = [ civ.name for each (civ in civList) ];
	var civListCodes = [ civ.code for each (civ in civList) ];

	// Set civ control
	var civSelection = Engine.GetGUIObjectByName("civSelection");
	civSelection.list = civListNames;
	civSelection.list_data = civListCodes;
	civSelection.selected = 0;
}

function selectCiv (civCode)
{
	warn(civCode + " has been selected in the structree page");
	g_SelectedCiv = civCode;
	
	g_ParsedData["units"] = {};
	g_ParsedData["structures"] = {};
	g_Lists["units"] = [];
	g_Lists["structures"] = [];
	
	// get initial units
	for (var entity of g_CivData[civCode].StartEntities)
	{
		if (entity.Template.slice(0, 5) == "units")
			g_Lists.units.push(entity.Template);
	}
	
	do {
		for (var u of g_Lists.units)
		{
			if (!g_ParsedData.units[u])
				g_ParsedData.units[u] = loadUnit(u);
		}
		
		for (var s of g_Lists.structures)
		{
			if (!g_ParsedData.structures[s])
				g_ParsedData.structures[s] = loadStructure(s);
		}
	} while (Object.keys(g_ParsedData.units).length < g_Lists.units.length);
	
}

function loadUnit (unitCode)
{
	var unitInfo = loadTemplate(unitCode);
	
	var unit = {
			"genericName":  fetchValue(unitInfo, "Identity/GenericName")
		,	"specificName": fetchValue(unitInfo, "Identity/SpecificName")
		,	"icon":         fetchValue(unitInfo, "Identity/Icon")
	};
	
	for (var build of fetchValue(unitInfo, "Builder/Entities", true))
	{
		build = build.replace("{civ}", g_SelectedCiv);
		if (g_Lists.structures.indexOf(build) < 0)
			g_Lists.structures.push(build);
	}
	
	return unit;
}

function loadStructure (structCode)
{
	var structInfo = loadTemplate(structCode);
	
	var structure = {
			"genericName"  : fetchValue(structInfo, "Identity/GenericName")
		,	"specificName" : (structInfo.Identity.SpecificName) ? structInfo.Identity.SpecificName : "?"
		,	"icon"         : fetchValue(structInfo, "Identity/Icon")
		,	"production"   : {
					"technology" : fetchValue(structInfo, "ProductionQueue/Technologies", true)
				,	"units"      : []
				}
		,	"phase"        : false
	}
	
	var reqTech = fetchValue(structInfo, "Identity/RequiredTechnology");
	if (typeof reqTech == "string" && reqTech.slice(0, 5) == "phase")
		structure.phase = reqTech;
	else if (typeof reqTech == "string" || reqTech.length > 0)
		structure.required = reqTech;
	
	for (var build of fetchValue(structInfo, "ProductionQueue/Entities", true))
	{
		build = build.replace("{civ}", g_SelectedCiv);
		structure.production.units.push(build);
		if (g_Lists.units.indexOf(build) < 0)
			g_Lists.units.push(build);
	}
	
	return structure;
}
