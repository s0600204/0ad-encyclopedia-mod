/* global g_Lists, g_SelectedCiv, fetchValue, loadTemplate, loadTechData, depath */
/* exported load_unit, load_structure, load_tech, load_phase, load_pair, unravel_phases */

/**
 * Load attack values
 *
 * @param  entityInfo  Raw information about an entity, taken from loadTemplate()
 *
 * @return  Attack values
 */
function getAttackValues(entityInfo)
{
	var attacks = {};
	var atkMethods = ["Melee", "Ranged", "Charge"];
	var atkDamages = ["Crush", "Hack", "Pierce", "MinRange", "MaxRange", "RepeatTime"];
	for (let meth of atkMethods)
	{
		let atk = {};
		let keep = false;
		for (let dama of atkDamages)
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
function getArmourValues(entityInfo)
{
	var armours = {};
	var armResists = ["Crush", "Hack", "Pierce"];
	for (let resist of armResists)
		armours[resist] = +fetchValue(entityInfo, "Armour/"+resist);

	return armours;
}

/**
 * Derive gather rates
 *
 * All available rates that have a value greater than 0 are summed and averaged
 *
 * @param  template  Template name
 *
 * @return  Gather rates
 */
function derive_gatherRates(template)
{
	var gatherTypes = {
		"Food"  : [ "food", "food.fish", "food.fruit", "food.grain", "food.meat", "food.milk" ],
		"Wood"  : [ "wood", "wood.tree"/*, "wood.ruins"*/ ],
		"Stone" : [ "stone", "stone.rock"/*, "stone.ruins"*/ ],
		"Metal" : [ "metal", "metal.ore" ]
	};
	var gatherRates = {};

	for (let gType in gatherTypes)
	{
		let gCount = 0;
		gatherRates[gType] = 0;
		for (let gather of gatherTypes[gType])
		{
			let rate = +fetchValue(template, "ResourceGatherer/Rates/"+gather);
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
 * Load Attributes common to Units and Structures
 *
 * @param  template Template name
 *
 * @return  Object with common attributes filled
 */
function load_common_fromEnt (template)
{
	var entity = {
		"name": {
			"generic": fetchValue(template, "Identity/GenericName"),
			"specific": fetchValue(template, "Identity/SpecificName")
		},
		"icon": fetchValue(template, "Identity/Icon"),
		"cost": {
			"food": +fetchValue(template, "Cost/Resources/food"),
			"wood": +fetchValue(template, "Cost/Resources/wood"),
			"stone": +fetchValue(template, "Cost/Resources/stone"),
			"metal": +fetchValue(template, "Cost/Resources/metal"),
			"time": +fetchValue(template, "Cost/BuildTime")
		},
		"tooltip": fetchValue(template, "Identity/Tooltip"),
		"stats": {
			"health": +fetchValue(template, "Health/Max"),
			"attack": getAttackValues(template),
			"armour": getArmourValues(template)
		},
		"phase": false,
		"auras": []
	};

	var auras = fetchValue(template, "Auras");
	for (let auraID in auras)
		entity.auras.push({
			"name"        : (auras[auraID].AuraName) ? auras[auraID].AuraName : "Aura",
			"description" : (auras[auraID].AuraDescription) ? auras[auraID].AuraDescription : "?"
		});

	var reqTech = fetchValue(template, "Identity/RequiredTechnology");
	if (typeof reqTech == "string" && reqTech.slice(0, 5) == "phase")
		entity.phase = reqTech;
	else if (typeof reqTech == "string" || reqTech.length > 0)
		entity.required = reqTech;

	return entity;
}

/**
 * Load Unit
 *
 * @param  template Template name
 *
 * @return  Pertinent unit information
 */
function load_unit(template)
{
	var unit = load_common_fromEnt(template);

	unit.stats.speed = {
		"Walk": +fetchValue(template, "UnitMotion/WalkSpeed"),
		"Run": +fetchValue(template, "UnitMotion/Run/Speed")
	};
	unit.cost.population = +fetchValue(template, "Cost/Population");

	var gatherer = derive_gatherRates(template);
	for (let gType in gatherer)
		if (gatherer[gType] > 0)
		{
			unit.gather = gatherer;
			break;
		}

	var healer = fetchValue(template, "Heal");
	if (Object.keys(healer).length > 0)
		unit.stats.healer = {
			"Range": (healer.Range) ? +healer.Range : 0,
			"HP"   : (healer.HP)    ? +healer.HP    : 0,
			"Rate" : (healer.Rate)  ? +healer.Rate  : 0
		};

	for (let build of fetchTokens(template, "Builder/Entities"))
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
 * @param  template Template name
 *
 * @return  Pertinent structure information
 */
function load_structure(template)
{
	var structure = load_common_fromEnt(template);
	structure.production = {
		"technology": [],
		"units": []
	};

	for (let build of fetchTokens(template, "ProductionQueue/Entities"))
	{
		build = build.replace("{civ}", g_SelectedCiv);
		structure.production.units.push(build);
		if (g_Lists.units.indexOf(build) < 0)
			g_Lists.units.push(build);
	}

	for (let research of fetchTokens(template, "ProductionQueue/Technologies"))
	{
		structure.production.technology.push(research);
		if (g_Lists.techs.indexOf(research) < 0)
			g_Lists.techs.push(research);
	}

	var wallSet = fetchValue(template, "WallSet");
	if ("Templates" in wallSet)
	{
		structure.wallset = {};
		for (let res in structure.cost)
			structure.cost[res] = [];

		for (let wSegm in wallSet.Templates)
		{
			let wCode = wallSet.Templates[wSegm];
			let wPart = load_structure(wCode);
			structure.wallset[wSegm] = wPart;
			structure.wallset[wSegm].code = wCode;

			for (let research of wPart.production.technology)
				structure.production.technology.push(research);

			if (wSegm.slice(0,4) == "Wall")
			{
				for (let res in wPart.cost)
					if (wPart.cost[res] > 0)
						structure.cost[res].push(wPart.cost[res]);

				for (let armourType in wPart.stats.armour)
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

		for (let res in structure.cost)
			structure.cost[res] = structure.cost[res].sort(function (a,b) { return a-b; });
	}

	return structure;
}

/**
 * Load Attributes common to Techs and Phases
 *
 * @param  techData  Object containing either a tech or a phase
 *
 * @return  Object with common attributes filled
 */
function load_common_fromjson(techData)
{
	var tech = {
	   "name": {
	   		"generic" : techData.genericName
	   	},
		"cost": (techData.cost) ? techData.cost : "",
		"tooltip": (techData.tooltip) ? techData.tooltip : ""
	};

	if (techData.specificName !== undefined)
		if (typeof techData.specificName == "string")
			tech.name.specific = techData.specificName;
		else
		{ // E048
			for (let sn in techData.specificName)
				tech.name[sn] = techData.specificName[sn];
		}

	return tech;
}

/**
 * Load Technology
 *
 * @param  techCode  Identifying code of a technology. Also known as its subpath within the simulation/data/technologies directory
 *
 * @return  Pertinent technology information
 */
function load_tech(techCode)
{
	var techInfo = loadTechData(techCode);
	var tech = load_common_fromjson(techInfo);

	tech.reqs = {};
	tech.icon = (techInfo.icon) ? "technologies/"+techInfo.icon : "";

	if (techInfo.pair !== undefined)
		tech.pair = techInfo.pair;

	if (techInfo.researchTime !== undefined)
		tech.cost.time = techInfo.researchTime;

	if (techInfo.requirements !== undefined)
	{
		for (let op in techInfo.requirements)
		{
			let val = techInfo.requirements[op];	
			let req = calcReqs(op, val);

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
				{ // E084
					for (let r of req[0])
					{
						let v = req[0][r];
						if (typeof r == "number")
							tech.reqs[v] = [];
						else
							tech.reqs[r] = v;
					}
				}
				if (req[1].length > 0)
					tech.reqs.generic = req[1];
				break;

			case "all":
				for (let r of req[0])
					tech.reqs[r] = req[1];
				break;
			}
		}
	}

	if (techInfo.supersedes !== undefined)
		if (tech.reqs.generic !== undefined)
			tech.reqs.generic.push(techInfo.supersedes);
		else
		{ // E048
			for (let ck of Object.keys(tech.reqs))
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
function load_phase(phaseCode)
{
	var phaseInfo = loadTechData(phaseCode);
	var phase = load_common_fromjson(phaseInfo);
	phase.actualPhase = "";

	if (phaseInfo.researchTime !== undefined)
		phase.cost.time = phaseInfo.researchTime;

	if (phaseInfo.icon !== undefined)
		phase.icon = "technologies/" + phaseInfo.icon;
	else
	{
		phase.icon = phaseCode.indexOf("_");
		phase.icon = "technologies/" + phaseCode.slice(phase.icon+1) +"_"+ phaseCode.slice(0, phase.icon) +".png";
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
function load_pair(pairCode)
{
	var pairInfo = loadTechData(pairCode);

	return {
		"techs" : [ pairInfo.top, pairInfo.bottom ],
		"req"   : (pairInfo.supersedes !== undefined) ? pairInfo.supersedes : ""
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
function calcReqs(op, val)
{
	switch (op)
	{
	case "civ":
	case "tech":
		// nothing needs doing
		break;

	case "all":
	case "any":
		let t = [];
		let c = [];
		for (let nv of val)
		{
			for (let o in nv)
			{
				let v = nv[o];
				let r = calcReqs(o, v);
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
					for (let ci in r[0])
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

	for (let techcode in techs)
	{
		let techdata = techs[techcode];

		if (!("generic" in techdata.reqs) || techdata.reqs.generic.length < 2)
			continue;

		let reqTech = techs[techcode].reqs.generic[1];

		// Tech that can't be researched anywhere
		if (!(reqTech in techs))
			continue;

		if (!("generic" in techs[reqTech].reqs))
			continue;

		let reqPhase = techs[reqTech].reqs.generic[0];
		let myPhase = techs[techcode].reqs.generic[0];

		if(reqPhase == myPhase || depath(reqPhase).slice(0,5) !== "phase" || depath(myPhase).slice(0,5) !== "phase")
			continue;

		let reqPhasePos = phaseList.indexOf(reqPhase);
		let myPhasePos = phaseList.indexOf(myPhase);

		if (phaseList.length === 0)
			phaseList = [reqPhase, myPhase];
		else if (reqPhasePos < 0 && myPhasePos > -1)
			phaseList.splice(myPhasePos, 0, reqPhase);
		else if (myPhasePos < 0 && reqPhasePos > -1)
			phaseList.splice(reqPhasePos+1, 0, myPhase);
	}
	return phaseList;
}
