
/**
 * Load attack values
 *
 * @param  entityInfo  Raw information about an entity, taken from loadTemplate()
 *
 * @return  Attack values
 */
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

/**
 * Load armour values
 *
 * @param  entityInfo  Raw information about an entity, taken from loadTemplate()
 *
 * @return  Armour values
 */
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

/**
 * Derive gather rates
 *
 * All available rates that have a value greater than 0 are summed and averaged
 *
 * @param  unitInfo  Raw information about a unit, taken from loadTemplate()
 *
 * @return  Gather rates
 */
function derive_gatherRates (unitInfo)
{
	var gatherTypes = {
			"Food"  : [ "food", "food.fish", "food.fruit", "food.grain", "food.meat", "food.milk" ]
		,	"Wood"  : [ "wood", "wood.tree"/*, "wood.ruins"*/ ]
		,	"Stone" : [ "stone", "stone.rock"/*, "stone.ruins"*/ ]
		,	"Metal" : [ "metal", "metal.ore" ]
	/*	,	"treasure" : [ "treasure", "treasure.food", "treasure.wood", "treasure.stone", "treasure.metal" ] */
		};
	var gatherRates = {};
	
	for (var gType in gatherTypes)
	{
		var gCount = 0;
		gatherRates[gType] = 0;
		for (var gather of gatherTypes[gType])
		{
			var rate = +fetchValue(unitInfo, "ResourceGatherer/Rates/"+gather);
			if (rate > 0)
			{
				gatherRates[gType] += rate;
				gCount++;
			}
		}
		if (gCount > 0)
			gatherRates[gType] = Math.round(gatherRates[gType] / gCount * 100) / 100;
	}
	return gatherRates;
}

/**
 * Load Unit
 *
 * @param  unitCode  Identifying code of a unit. Also known as its subpath within the simulation/templates directory
 *
 * @return  Pertinent unit information
 */
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
				,	"speed"  : {
							"Walk" : +fetchValue(unitInfo, "UnitMotion/WalkSpeed")
						,	"Run"  : +fetchValue(unitInfo, "UnitMotion/Run/Speed")
						}
				}
		};
	
	if (unitInfo.Identity["RequiredTechnology"] !== undefined)
		unit["reqTech"] = unitInfo.Identity["RequiredTechnology"];
	
	var gatherer = derive_gatherRates(unitInfo);
	for (var gType in gatherer)
		if (gatherer[gType] > 0)
		{
			unit.gather = gatherer;
			break;
		}
	
	var healer = fetchValue(unitInfo, "Heal");
	if (Object.keys(healer).length > 0)
		unit.stats["healer"] = {
				"Range": (healer.Range) ? +healer.Range : 0
			,	"HP"   : (healer.HP)    ? +healer.HP    : 0
			,	"Rate" : (healer.Rate)  ? +healer.Rate  : 0
			};
	
	if (unitInfo.Auras)
	{
		unit.auras = [];
		for (var auraID in unitInfo.Auras)
		{
			unit.auras.push({
					"name"        : unitInfo.Auras[auraID].AuraName
				,	"description" : unitInfo.Auras[auraID].AuraDescription
				});
		}
	}
	
	for (var build of fetchValue(unitInfo, "Builder/Entities", true))
	{
		build = build.replace("{civ}", g_SelectedCiv);
		if (g_Lists.structures.indexOf(build) < 0)
			g_Lists.structures.push(build);
	}
	
	return unit;
}

/**
 * Load Structure
 *
 * @param  structCode  Identifying code of a structure. Also known as its subpath within the simulation/templates directory
 *
 * @return  Pertinent structure information
 */
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
	
	var auras = fetchValue(structInfo, "Auras");
	if (Object.keys(auras).length > 0)
	{
		structure.auras = [];
		for (var auraID in auras)
			structure.auras.push({
					"name"        : (auras[auraID].AuraName) ? auras[auraID].AuraName : "Aura"
				,	"description" : (auras[auraID].AuraDescription) ? auras[auraID].AuraDescription : "?"
				});
	}
	
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

/**
 * Load Technology
 *
 * @param  techCode  Identifying code of a technology. Also known as its subpath within the simulation/data/technologies directory
 *
 * @return  Pertinent technology information
 */
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

/**
 * Load Phase Technology
 *
 * @param  phaseCode  Identifying code of a phase. Also known as its subpath within the simulation/data/technologies directory
 *
 * @return  Pertinent phase information
 */
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

/**
 * Load Technology Pair
 *
 * @param  pairCode  Identifying code of a phase. Also known as its subpath within the simulation/data/technologies directory
 *
 * @return  Pertinent phase information
 */
function load_pair (pairCode)
{
	var pairInfo = loadTechData(pairCode);
	
	return {
			"techs" : [ pairInfo.top, pairInfo.bottom ]
		,	"req"   : (pairInfo.supersedes !== undefined) ? pairInfo.supersedes : ""
		};
}

/**
 * Calculate the prerequisite requirements of a technology.
 *   Works recursively if needed.
 *
 * @param  op  The base operation. Can be "civ", "tech", "all" or "any"
 * @param  val  The value associated with the above operation.
 *
 * @return  Sorted requirments.
 */
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

/**
 * Unravel phases
 *
 * @param  techs  The current available store of techs
 *
 * @return  List of phases
 */
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

