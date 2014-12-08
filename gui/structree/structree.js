
var g_ParsedData = {};
var g_Lists = {};
var g_CivData = {};
var g_SelectedCiv = "";
var g_drawPhases = { // hard-coded values. See comment of draw() for reason
		"village" : {
			"structQuant": 10
		,	"prodQuant": {"village":9, "town":4, "city":4}
		,	"prodCount": {}
		}
	,	"town" : {
			"structQuant": 10
		,	"prodQuant": {"town":6, "city":8}
		,	"prodCount": {}
		}
	,	"city" : {
			"structQuant": 5
		,	"prodQuant": {"city":16}
		,	"prodCount": {}
		}
	};
var costIcons = {
		"food"       : "[icon=\"iconFood\"]"
	,	"wood"       : "[icon=\"iconWood\"]"
	,	"stone"      : "[icon=\"iconStone\"]"
	,	"metal"      : "[icon=\"iconMetal\"]"
	,	"time"       : "[icon=\"iconTime\"]"
	,	"population" : "[icon=\"iconPopulation\"]"
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
		
		for (var stru of g_CivData[g_SelectedCiv].buildList["phase_"+pha])
		{
			var thisEle = Engine.GetGUIObjectByName(pha+"_struct["+i+"]");
			var c = 0;
			
			var stru = g_ParsedData.structures[stru];
			Engine.GetGUIObjectByName(pha+"_struct_icon["+i+"]").sprite = "stretched:session/portraits/"+stru.icon;
			Engine.GetGUIObjectByName(pha+"_struct_icon["+i+"]").tooltip = assembleTooltip(stru);
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
						Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_"+prod_pha+"["+p+"]").tooltip = assembleTooltip(prod);
						Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_"+prod_pha+"["+p+"]").hidden = false;
						p++;
					}
				}
				if (stru.wallset && prod_pha == pha)
				{
					for (var prod of [stru.wallset.Gate, stru.wallset.Tower])
					{
						Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_"+prod_pha+"["+p+"]").sprite = "stretched:session/portraits/"+prod.icon;
						Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_"+prod_pha+"["+p+"]").tooltip = assembleTooltip(prod);
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
						Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_"+prod_pha+"["+p+"]").tooltip = assembleTooltip(prod);
						Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_"+prod_pha+"["+p+"]").hidden = false;
						p++;
					}
				}
				g_drawPhases[pha].prodCount[prod_pha] = p;
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
			
			var eleWidth = size.right - size.left;
			for (var prod_pha in g_drawPhases[pha].prodCount)
			{
				var wid = g_drawPhases[pha].prodCount[prod_pha] * 24 - 4;
				var phaEle = Engine.GetGUIObjectByName(pha+"_struct["+i+"]_prod_row_"+prod_pha);
				var size = phaEle.size;
				size.left = (eleWidth - wid)/2;
				phaEle.size = size;
			}
			
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

function assembleTooltip (info)
{
	var txt = "";
	var speciName = (info.name[g_SelectedCiv]) ? info.name[g_SelectedCiv] : info.name.specific;
	
	if (speciName !== undefined)
	{
		txt = '[font="sans-bold-16"]' + speciName[0] + '[/font]';
		txt += '[font="sans-bold-12"]' + speciName.slice(1).toUpperCase() + '[/font]';
		txt += '[font="sans-bold-12"] (' + info.name.generic + ')[/font]';
	}
	else
		txt = '[font="sans-bold-16"]' + info.name.generic + '[/font]';
	
	txt += '\n[font="sans-12"]';
	for (var res in info.cost)
	{
		if (info.cost[res] > 0 || Array.isArray(info.cost[res]) && info.cost[res].length > 1)
		{
			txt += costIcons[res];
			
			if (Array.isArray(info.cost[res]))
				txt += Array.min(info.cost[res]) +"-"+ Array.max(info.cost[res]);
			else
				txt += info.cost[res];
			txt += "  ";
		}
	}
	txt += "[/font]";
	
	if (info.tooltip && !Array.isArray(info.tooltip))
		txt += '\n[font="sans-13"]' + info.tooltip + '[/font]';
	
	if (info.stats)
	{
		// Health
		txt += '\n[font="sans-bold-13"]Health:[/font] ';
		if (Array.isArray(info.stats.health))
			if (Array.min(info.stats.health) == Array.max(info.stats.health))
				txt += info.stats.health[0];
			else
				txt += Array.min(info.stats.health) +"-"+ Array.max(info.stats.health);
		else
			txt += info.stats.health;
		
		// Healer
		if (info.stats.healer)
		{
			txt += '\n[font="sans-bold-13"]Heal:[/font] ';
			var healer = [];
			healer.push(
					info.stats.healer["HP"] +
					' [font="sans-10"][color="orange"]'+ "HP" +"[/color][/font]"
				);
			healer.push(
					'[font="sans-bold-13"]Range:[/font] ' +
					info.stats.healer["Range"] +
					' [font="sans-10"][color="orange"]metres[/color][/font]'
				);
			healer.push(
					'[font="sans-bold-13"]Rate:[/font] ' +
					(info.stats.healer["Rate"]/1000) +
					' [font="sans-10"][color="orange"]seconds[/color][/font]'
				);
			txt += healer.join(", ");
		}
		
		// Attack
		for (var atkType in info.stats.attack)
		{
			txt += '\n[font="sans-bold-13"]' + atkType +" Attack:[/font] ";
			var damage = [];
			
			for (var stat of ["Hack", "Pierce", "Crush"])
				if (info.stats.attack[atkType][stat] > 0)
					damage.push(
							info.stats.attack[atkType][stat] + ' [font="sans-10"][color="orange"]'+ stat +"[/color][/font]"
						);
			
		/*	if (info.stats.attack[atkType].RepeatTime > 0)
				damage.push(
						'[font="sans-bold-13"]Rate:[/font] ' +
						info.stats.attack[atkType].RepeatTime/1000 +
						' [font="sans-10"][color="orange"]seconds[/color][/font]'
					);	*/
			
			if (atkType == "Ranged")
			{
				damage.push(
						'[font="sans-bold-13"]Range:[/font] ' +
						((info.stats.attack["Ranged"].MinRange > 0) ? info.stats.attack["Ranged"].MinRange + "-" : "") +
						info.stats.attack["Ranged"].MaxRange + ' [font="sans-10"][color="orange"]metres[/color][/font]'
					);
			}
			
			txt += damage.join(", ");
		}
		
		// Armour
		txt += '\n[font="sans-bold-13"]Armour:[/font] ';
		var armour = [];
		for (var stat in info.stats.armour)
		{
			armour.push(
					((Array.isArray(info.stats.armour[stat])) ? info.stats.armour[stat][0] : info.stats.armour[stat]) +
					' [font="sans-10"][color="orange"]'+ stat +"[/color][/font]"
				);
		}
		txt += armour.join(", ");
		
	}
	
	return txt;
}

function getAttackValues (entityInfo)
{
	var attacks = {};
	var atkMethods = ["Melee", "Ranged", "Charge"];
	var atkDamages = ["Crush", "Hack", "Pierce", "MinRange", "MaxRange", "RepeatTime"];
	for (var meth of atkMethods)
	{
		var atk = {};
		var keep = false;
		for (var dama of atkDamages)
		{
			atk[dama] = +fetchValue(entityInfo, "Attack/"+meth+"/"+dama);
			if (atk[dama] > 0)
				keep = true;
		}
		if (keep)
			attacks[meth] = atk;
	}
	return attacks;
}
function getArmourValues (entityInfo)
{
	var armours = {};
	var armResists = ["Crush", "Hack", "Pierce"];
	for (var resist of armResists)
	{
		armours[resist] = +fetchValue(entityInfo, "Armour/"+resist);
	}
	return armours;
}

function load_unit (unitCode)
{
	var unitInfo = loadTemplate(unitCode);
	
	var unit = {
			"name"    : {
					"generic" : fetchValue(unitInfo, "Identity/GenericName")
				,	"specific" : fetchValue(unitInfo, "Identity/SpecificName")
				}
		,	"icon"    : fetchValue(unitInfo, "Identity/Icon")
		,	"cost"       : {
					"food"       : +fetchValue(unitInfo, "Cost/Resources/food")
				,	"wood"       : +fetchValue(unitInfo, "Cost/Resources/wood")
				,	"stone"      : +fetchValue(unitInfo, "Cost/Resources/stone")
				,	"metal"      : +fetchValue(unitInfo, "Cost/Resources/metal")
				,	"population" : +fetchValue(unitInfo, "Cost/Population")
				,	"time"       : +fetchValue(unitInfo, "Cost/BuildTime")
				}
		,	"tooltip" : fetchValue(unitInfo, "Identity/Tooltip")
		,	"stats"      : {
					"health" : +fetchValue(unitInfo, "Health/Max")
				,	"attack" : getAttackValues(unitInfo)
				,	"armour" : getArmourValues(unitInfo)
				}
		};
	
	if (unitInfo.Identity["RequiredTechnology"] !== undefined)
		unit["reqTech"] = unitInfo.Identity["RequiredTechnology"];
	
	var healer = fetchValue(unitInfo, "Heal");
	if (Object.keys(healer).length > 0)
		unit.stats["healer"] = {
				"Range": (healer.Range) ? +healer.Range : 0
			,	"HP"   : (healer.HP)    ? +healer.HP    : 0
			,	"Rate" : (healer.Rate)  ? +healer.Rate  : 0
			};
	
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
		,	"cost"       : {
					"food"  : +fetchValue(structInfo, "Cost/Resources/food")
				,	"wood"  : +fetchValue(structInfo, "Cost/Resources/wood")
				,	"stone" : +fetchValue(structInfo, "Cost/Resources/stone")
				,	"metal" : +fetchValue(structInfo, "Cost/Resources/metal")
				,	"time"  : +fetchValue(structInfo, "Cost/BuildTime")
				}
		,	"tooltip"    : fetchValue(structInfo, "Identity/Tooltip")
		,	"stats"      : {
					"health" : +fetchValue(structInfo, "Health/Max")
				,	"attack" : getAttackValues(structInfo) //fetchValue(structInfo, "Attack")
				,	"armour" : getArmourValues(structInfo) //fetchValue(structInfo, "Armour")
				}
		};
	
	var reqTech = fetchValue(structInfo, "Identity/RequiredTechnology");
	if (typeof reqTech == "string" && reqTech.slice(0, 5) == "phase")
		structure.phase = reqTech;
	else if (typeof reqTech == "string" || reqTech.length > 0)
		structure.required = reqTech;
	
	if (structure.stats.armour["Foundation"])
		delete structure.stats.armour["Foundation"];
	
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
	
	if (structInfo["WallSet"] !== undefined)
	{
		structure.wallset = {};
		for (var res in structure.cost)
			structure.cost[res] = [];
		
		for (var wSegm in structInfo.WallSet.Templates)
		{
			var wCode = structInfo.WallSet.Templates[wSegm];
			var wPart = load_structure(wCode);
			structure.wallset[wSegm] = wPart;
			structure.wallset[wSegm].code = wCode;
			
			for (var research of wPart.production.technology)
				structure.production.technology.push(research);
			
			if (wSegm.slice(0,4) == "Wall")
			{
				for (var res in wPart.cost)
					if (wPart.cost[res] > 0)
						structure.cost[res].push(wPart.cost[res]);
				
				for (var armourType in wPart.stats.armour)
				{
					if (!Array.isArray(structure.stats.armour[armourType]))
						structure.stats.armour[armourType] = [];
					structure.stats.armour[armourType].push(wPart.stats.armour[armourType]);
				}
				if (!Array.isArray(structure.stats.health))
					structure.stats.health = [];
				structure.stats.health.push(wPart.stats.health);
			}
		}
		
		for (var res in structure.cost)
			structure.cost[res] = structure.cost[res].sort(function (a,b) { return a-b; });
	}
	
	return structure;
}

function load_tech (techCode)
{
	var techInfo = loadTechData(techCode);
	
	var tech = {
			"reqs"    : {}
		,	"name"    : {
					"generic" : techInfo.genericName
				}
		,	"icon"    : (techInfo.icon) ? techInfo.icon : ""
		,	"cost"    : (techInfo.cost) ? techInfo.cost : ""
		,	"tooltip" : (techInfo.tooltip) ? techInfo.tooltip : ""
		};
	
	if (techInfo.pair !== undefined)
		tech.pair = techInfo.pair;
	
	if (techInfo.specificName !== undefined)
		if (typeof techInfo.specificName == "string")
			tech.name.specific = techInfo.specificName;
		else
			for (var sn in techInfo.specificName)
				tech.name[sn] = techInfo.specificName[sn];
	
	if (techInfo.researchTime !== undefined)
		tech.cost["time"] = techInfo.researchTime;
	
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
		,	"cost"        : (phaseInfo.cost) ? phaseInfo.cost : ""
		,	"tooltip"     : (phaseInfo.tooltip) ? phaseInfo.tooltip : ""
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
	
	if (phaseInfo.researchTime !== undefined)
		phase.cost["time"] = phaseInfo.researchTime;
	
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
