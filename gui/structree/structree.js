
var g_Data = {};
var g_CivData = {};

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
	
	// todo: do something
	
	
	
		
}

