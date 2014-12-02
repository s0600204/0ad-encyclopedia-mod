
var g_ParsedData = {};
var g_Lists = {};
var g_CivData = {};
var g_SelectedCiv = "";
var g_drawPhases = { // hard-coded values. See comment of draw() for reason
		"village" : {
			"structQuant": 10
		,	"prodQuant": {"village":9, "town":4, "city":4}
		}
	,	"town" : {
			"structQuant": 10
		,	"prodQuant": {"town":6, "city":8}
		}
	,	"city" : {
			"structQuant": 5
		,	"prodQuant": {"city":16}
		}
	};

function init (settings)
{
	predraw();
	
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
	g_ParsedData["techs"] = {};
	g_ParsedData["phases"] = {};
	g_Lists["units"] = [];
	g_Lists["structures"] = [];
	g_Lists["techs"] = [];
	
	// get initial units
	for (var entity of g_CivData[civCode].StartEntities)
	{
		if (entity.Template.slice(0, 5) == "units")
			g_Lists.units.push(entity.Template);
	}
	
	/* Load units and structures */
	do {
		for (var u of g_Lists.units)
		{
			if (!g_ParsedData.units[u])
				g_ParsedData.units[u] = load_unit(u);
		}
		
		for (var s of g_Lists.structures)
		{
			if (!g_ParsedData.structures[s])
				g_ParsedData.structures[s] = load_structure(s);
		}
	} while (Object.keys(g_ParsedData.units).length < g_Lists.units.length);
	
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
		if (!g_ParsedData.structures[structCode].phase)
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

/**
 * Draw the structree
 *
 * (Actually moves and changes visibility of elements, and populates text)
 *
 * This is one of two functions in the mod where the phases are hard-coded. The hard-coding
 *   is due to limitations in the GUI Engine preventing dynamic creation of UI Elements.
 */
function draw () {
	var defWidth = 96;
	var defMargin = 4;
	
	for (var pha in g_drawPhases)
	{
		var i = 0;
		var y = 0;
		var c = 0;
		
		for (var stru of g_CivData[g_SelectedCiv].buildList["phase_"+pha])
		{
			var thisEle = Engine.GetGUIObjectByName(pha+"_struct["+i+"]");
			
			var stru = g_ParsedData.structures[stru];
			Engine.GetGUIObjectByName(pha+"_struct_icon["+i+"]").sprite = "stretched:session/portraits/"+stru.icon;
			Engine.GetGUIObjectByName(pha+"_struct_name_speci["+i+"]").caption = stru.name.specific;
			thisEle.hidden = false;
			
			for (var prod_pha in g_drawPhases[pha].prodQuant)
			{
				var p = 0;
				if (stru.production.units["phase_"+prod_pha])
				{
					for (var prod of stru.production.units["phase_"+prod_pha])
					{
						var prod = g_ParsedData.units[prod];
						Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_"+prod_pha+"["+p+"]").sprite = "stretched:session/portraits/"+prod.icon;
						Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_"+prod_pha+"["+p+"]").hidden = false;
						p++;
					}
				}
				if (stru.production.technology["phase_"+prod_pha])
				{
					for (var prod of stru.production.technology["phase_"+prod_pha])
					{
						if (prod.slice(0,5) == "phase")
							var prod = g_ParsedData.phases[prod];
						else
							var prod = g_ParsedData.techs[prod];
						Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_"+prod_pha+"["+p+"]").sprite = "stretched:session/portraits/technologies/"+prod.icon;
						Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_"+prod_pha+"["+p+"]").hidden = false;
						p++;
					}
				}
				if (p>c)
					c = p;
				for (p; p<g_drawPhases[pha].prodQuant[prod_pha]; p++)
					Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_"+prod_pha+"["+p+"]").hidden = true;
			}
			
			var size = thisEle.size;
			size.left = y;
			size.right = size.left + ((c*24 < defWidth)?defWidth:c*24)+4;
			y = size.right + defMargin;
			thisEle.size = size;
			
			i++;
		}
		for (i; i<g_drawPhases[pha].structQuant; i++)
		{
			Engine.GetGUIObjectByName(pha+"_struct["+i+"]").hidden = true;
		//	Engine.GetGUIObjectByName(pha+"_struct_icon["+i+"]").sprite = "stretched:pregame/shell/logo/wfg_logo_white.png";
		//	Engine.GetGUIObjectByName(pha+"_struct_name_speci["+i+"]").caption = "--";
		}
	}
}

/**
 * Positions certain elements that only need to be positioned once
 *   (as `<repeat>` doesn't reposition automatically)
 *
 * Again, phases are hard coded :-(
 */
function predraw ()
{
	var initSizes = {
		"village": Engine.GetGUIObjectByName("village_struct[0]_prod_village[0]").size
	,	"town": Engine.GetGUIObjectByName("town_struct[0]_prod_town[0]").size
	,	"city": Engine.GetGUIObjectByName("city_struct[0]_prod_city[0]").size
	};
	
	for (var pha in g_drawPhases)
	{
		for (var i=0; i<g_drawPhases[pha].structQuant; i++)
		{
			var ele = Engine.GetGUIObjectByName(pha+"_struct["+i+"]");
			var size = ele.size;
			size.bottom += Object.keys(g_drawPhases[pha].prodQuant).length*24;
			ele.size = size;
			
			for (var prod_pha in g_drawPhases[pha].prodQuant)
			{
				for (var p=1; p<g_drawPhases[pha].prodQuant[prod_pha]; p++)
				{
					var prodEle = Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_"+prod_pha+"["+p+"]");
					var prodsize = prodEle.size;
					prodsize.left = (initSizes[pha].right+4) * p;
					prodsize.right = (initSizes[pha].right+4) * (p+1) - 4;
					prodEle.size = prodsize;
				}
			}
		}
	}
}

function load_unit (unitCode)
{
	var unitInfo = loadTemplate(unitCode);
	
	var unit = {
			"name" : {
					"generic" : fetchValue(unitInfo, "Identity/GenericName")
				,	"specific" : fetchValue(unitInfo, "Identity/SpecificName")
				}
		,	"icon" : fetchValue(unitInfo, "Identity/Icon")
		};
	
	if (unitInfo.Identity["RequiredTechnology"] !== undefined)
		unit["reqTech"] = unitInfo.Identity["RequiredTechnology"];

	for (var build of fetchValue(unitInfo, "Builder/Entities", true))
	{
		build = build.replace("{civ}", g_SelectedCiv);
		if (g_Lists.structures.indexOf(build) < 0)
			g_Lists.structures.push(build);
	}
	
	return unit;
}

function load_structure (structCode)
{
	var structInfo = loadTemplate(structCode);
	
	var structure = {
			"name"       : {
					"generic"  : fetchValue(structInfo, "Identity/GenericName")
				,	"specific" : (structInfo.Identity.SpecificName) ? structInfo.Identity.SpecificName : "?"
				}
		,	"icon"       : fetchValue(structInfo, "Identity/Icon")
		,	"production" : {
					"technology" : []
				,	"units"      : []
				}
		,	"phase"      : false
		};
	
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
	
	for (var research of fetchValue(structInfo, "ProductionQueue/Technologies", true))
	{
		structure.production.technology.push(research);
		if (g_Lists.techs.indexOf(research) < 0)
			g_Lists.techs.push(research);
	}
	
	return structure;
}

function load_tech (techCode)
{
	var techInfo = loadTechData(techCode);
	
	var tech = {
			"reqs" : {}
		,	"name" : {
					"generic" : techInfo.genericName
				}
		,	"icon" : (techInfo.icon) ? techInfo.icon : ""
		};
	
	if (techInfo.pair !== undefined)
		tech.pair = techInfo.pair;
	
	if (techInfo.specificName !== undefined)
		if (typeof techInfo.specificName == "string")
			tech.name.specific = techInfo.specificName;
		else
			for (var sn in techInfo.specificName)
				tech.name[sn] = techInfo.specificName[sn];
	
	if (techInfo.requirements !== undefined)
	{
		for (var op in techInfo.requirements)
		{
			var val = techInfo.requirements[op];	
			var req = calcReqs(op, val);
			
			switch (op)
			{
			case "tech":
				tech.reqs.generic = [ req ];
				break;
			
			case "civ":
				tech.reqs[req] = [];
				break;
			
			case "any":
				if (req[0].length > 0)
					for (var r of req[0])
					{
						var v = req[0][r];
						if (typeof r == "number")
							tech.reqs[v] = [];
						else
							tech.reqs[r] = v;
					}
				if (req[1].length > 0)
					tech.reqs["generic"] = req[1];
				break;
			
			case "all":
				for (var r of req[0])
					tech.reqs[r] = req[1];
				break;
			}
		}
	}
	
	if (techInfo.supersedes !== undefined)
	{
		if (tech.reqs.generic !== undefined)
			tech.reqs.generic.push(techInfo.supersedes);
		else
			for (var ck of Object.keys(tech.reqs))
				tech.reqs[ck].push(techInfo.supersedes);
	}
	
	return tech;
}

function load_phase (phaseCode)
{
	var phaseInfo = loadTechData(phaseCode);
	
	var phase = {
			"name"        : {
					"generic"  : phaseInfo.genericName
				}
		,	"actualPhase" : ""
		};
	
	if (phaseInfo.specificName !== undefined)
		for (var sn in phaseInfo.specificName)
			phase.name[sn] = phaseInfo.specificName[sn];
	
	if (phaseInfo.specificName !== undefined)
		if (typeof phaseInfo.specificName == "string")
			phase.name.specific = phaseInfo.specificName;
		else
			for (var sn in phaseInfo.specificName)
				phase.name[sn] = phaseInfo.specificName[sn];
	
	if (phaseInfo.icon !== undefined)
		phase.icon = phaseInfo.icon;
	else
	{
		phase.icon = phaseCode.indexOf("_");
		phase.icon = phaseCode.slice(phase.icon+1) +"_"+ phaseCode.slice(0, phase.icon) +".png";
	}
	
	return phase;
}

function load_pair (pairCode)
{
	var pairInfo = loadTechData(pairCode);
	
	return {
			"techs" : [ pairInfo.top, pairInfo.bottom ]
		,	"req"   : (pairInfo.supersedes !== undefined) ? pairInfo.supersedes : ""
		};
}

function calcReqs (op, val)
{
	switch (op)
	{
	case "civ":
	case "tech":
		// nothing needs doing
		break;
	
	case "all":
	case "any":
		var t = [];
		var c = [];
		for (var nv of val)
		{
			for (var o in nv)
			{
				var v = nv[o];
				var r = calcReqs(o, v);
				switch (o)
				{
				case "civ":
					c.push(r);
					break;
				
				case "tech":
					t.push(r);
					break;
				
				case "any":
					c = c.concat(r[0]);
					t = t.concat(r[1]);
					break;
				
				case "all":
					for (var ci in r[0])
						c[ci] = r[1];
					t = t;
				}
			}
		}
		return [ c, t ];
	
	default:
		warn("Unknown reqs operator: "+op);
	}
	return val;
}

function unravel_phases (techs)
{
	var phaseList = [];
	
	for (var techcode in techs)
	{
		var techdata = techs[techcode];
		
		if ("generic" in techdata.reqs && techdata.reqs.generic.length > 1)
		{
			var reqTech = techs[techcode].reqs.generic[1];
			if (!("generic" in techs[reqTech].reqs))
				continue;
			
			var reqPhase = techs[reqTech].reqs.generic[0];
			var myPhase = techs[techcode].reqs.generic[0];
			
			if(reqPhase == myPhase || depath(reqPhase).slice(0,5) !== "phase" || depath(myPhase).slice(0,5) !== "phase")
				continue;
			
			var reqPhasePos = phaseList.indexOf(reqPhase);
			var myPhasePos = phaseList.indexOf(myPhase);
			
			if (phaseList.length == 0)
			{
				phaseList = [reqPhase, myPhase];
			}
			else if (reqPhasePos < 0 && myPhasePos > -1)
			{
				phaseList.splice(myPhasePos, 0, reqPhase);
			}
			else if (myPhasePos < 0 && reqPhasePos > -1)
			{
				phaseList.splice(reqPhasePos+1, 0, myPhase);
			}
		}
	}
	return phaseList;
}
