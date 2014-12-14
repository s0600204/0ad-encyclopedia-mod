
var g_ParsedData = {};
var g_Lists = {};
var g_CivData = {};
var g_SelectedCiv = "";

/**
 * Run when UI Page loaded.
 */
function init (settings)
{
	predraw();
	
	// Set base, empty state
	g_ParsedData["units"] = {};
	g_ParsedData["structures"] = {};
	g_ParsedData["techs"] = {};
	g_ParsedData["phases"] = {};
	
	// Initialize civ list
	initCivNameList();
}

/**
 * Initialize the dropdown containing all the available civs
 */
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

/**
 * Select Civilisation from dropdown menu
 */
function selectCiv (civCode)
{
	warn(civCode + " has been selected in the structree page");
	g_SelectedCiv = civCode;
	
	/* If a buildList already exists,
		then this civ has already been parsed */
	if (g_CivData[g_SelectedCiv].buildList)
	{
		draw();
		return;
	}
	
	g_Lists["units"] = [];
	g_Lists["structures"] = [];
	g_Lists["techs"] = [];
	
	/* get initial units */
	var startStructs = [];
	for (var entity of g_CivData[civCode].StartEntities)
	{
		if (entity.Template.slice(0, 5) == "units")
			g_Lists.units.push(entity.Template);
		else if (entity.Template.slice(0, 6) == "struct")
			startStructs.push(entity.Template);
	}
	
	/* Load units and structures */
	var unitCount = 0;
	do {
		for (var u of g_Lists.units)
		{
			if (!g_ParsedData.units[u])
				g_ParsedData.units[u] = load_unit(u);
		}
		unitCount = g_Lists.units.length;
		
		for (var s of g_Lists.structures)
		{
			if (!g_ParsedData.structures[s])
				g_ParsedData.structures[s] = load_structure(s);
		}
	} while (unitCount < g_Lists.units.length);
	
	/* Load technologies */
	var techPairs = {};
	for (var techcode of g_Lists["techs"])
	{
		var realcode = depath(techcode);
		
		if (realcode.slice(0,4) == "pair")
			techPairs[techcode] = load_pair(techcode);
		else if (realcode.slice(0,5) == "phase")
			g_ParsedData.phases[techcode] = load_phase(techcode);
		else
			g_ParsedData.techs[techcode] = load_tech(techcode);
	}
	
	/* Expand tech pairs */
	for (var paircode in techPairs)
	{
		var pairinfo = techPairs[paircode];
		for (var techcode of pairinfo.techs)
		{
			var newTech = load_tech(techcode);
			
			if (pairinfo.req !== "")
			{
				if ("generic" in newTech.reqs)
					newTech.reqs.generic.concat(techPairs[pairinfo.req].techs);
				else
					for (var civkey of Object.keys(newTech.reqs))
						newTech.reqs[civkey].concat(techPairs[pairinfo.req].techs);
			}
			g_ParsedData.techs[techcode] = newTech;
		}
	}
	
	/* Establish phase order */
	g_ParsedData["phaseList"] = unravel_phases(g_ParsedData.techs);
	for (var phasecode of g_ParsedData["phaseList"])
	{
		var phaseInfo = loadTechData(phasecode);
		g_ParsedData.phases[phasecode] = load_phase(phasecode);
		
		if ("requirements" in phaseInfo)
		{
			for (var op in phaseInfo.requirements)
			{
				var val = phaseInfo.requirements[op];
				if (op == "any")
				{
					for (var v of val)
					{
						var k = Object.keys(v);
						k = k[0];
						v = v[k];
						if (k == "tech" && v in g_ParsedData.phases)
							g_ParsedData.phases[v].actualPhase = phasecode;
					}
				}
			}
		}
	}
	
	/* Group production lists of structures by phase */
	for (var structCode of g_Lists.structures)
	{
		var structInfo = g_ParsedData.structures[structCode]
		
		/* If this building is shared with another civ,
			it may have already gone through the grouping process already */
		if (!Array.isArray(structInfo.production.technology))
			continue;
		
		/* Expand tech pairs */
		for (var prod of structInfo.production.technology)
			if (prod.slice(0,4) == "pair" || prod.indexOf("/pair") > -1)
				structInfo.production.technology.splice(
						structInfo.production.technology.indexOf(prod), 1,
						techPairs[prod].techs[0], techPairs[prod].techs[1]
					);
		
		/* Sort Techs by Phase */
		var newProdTech = {};
		for (var prod of structInfo.production.technology)
		{
			var phase = "";
			
			if (prod.slice(0,5) == "phase")
			{
				phase = g_ParsedData.phaseList.indexOf(g_ParsedData.phases[prod].actualPhase);
				if (phase > 0)
					phase = g_ParsedData.phaseList[phase - 1];
			}
			else if (g_SelectedCiv in g_ParsedData.techs[prod].reqs)
			{
				if (g_ParsedData.techs[prod].reqs[g_SelectedCiv].length > 0)
					phase = g_ParsedData.techs[prod].reqs[g_SelectedCiv][0];
			}
			else if ("generic" in g_ParsedData.techs[prod].reqs)
			{
				phase = g_ParsedData.techs[prod].reqs.generic[0];
			}
			
			if (depath(phase).slice(0,5) !== "phase")
			{
				warn(prod+" doesn't have a specific phase set ("+structCode+")");
				phase = structInfo.phase;
			}
			
			if (!(phase in newProdTech))
				newProdTech[phase] = [];
			
			newProdTech[phase].push(prod);
		}
		
		/* Determine phase for units */
		var newProdUnits = {};
		for (var prod of structInfo.production.units)
		{
			if (!(prod in g_ParsedData.units))
			{
				error(prod+" doesn't exist! ("+structCode+")");
				continue;
			}
			var unit = g_ParsedData.units[prod];
			var phase = "";
			
			if (reqTech in unit)
			{
				var reqTech = unit.reqTech;
				if (reqTech.slice(0,5) == "phase")
					phase = reqTech;
				else if (g_SelectedCiv in g_ParsedData.techs[reqTech].reqs)
					phase = g_ParsedData.techs[reqTech].reqs[g_SelectedCiv][0];
				else
					phase = g_ParsedData.techs[reqTech].reqs.generic[0];
			}
			else
			{
				// hack so it works with civil centres
				if (structCode.indexOf("civil_centre") > -1 || structInfo.phase === false)
					phase = g_ParsedData.phaseList[0];
				else
					phase = structInfo.phase;
			}
			
			if (!(phase in newProdUnits))
				newProdUnits[phase] = [];
			
			newProdUnits[phase].push(prod);
		}
		
		g_ParsedData.structures[structCode].production = {
				"technology": newProdTech
			,	"units"		: newProdUnits
			};
	}
	
	/* Determine the Build List for the Civ (grouped by phase) */
	var buildList = {};
	for (var structCode of g_Lists.structures)
	{
		if (!g_ParsedData.structures[structCode].phase || startStructs.indexOf(structCode) > -1)
			g_ParsedData.structures[structCode].phase = g_ParsedData.phaseList[0];
		
		var myPhase = g_ParsedData.structures[structCode].phase; 
		
		if (!(myPhase in buildList))
			buildList[myPhase] = [];
		buildList[myPhase].push(structCode);
	}
	
	g_CivData[g_SelectedCiv].buildList = buildList;
	
	/* Draw tree */
	draw();
}
