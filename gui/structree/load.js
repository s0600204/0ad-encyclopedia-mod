/* global g_Lists, g_SelectedCiv, fetchValue, loadTemplate, loadTechData, GetTemplateDataHelper, GetTechnologyDataHelper, depath */
/* exported load_unit, load_structure, load_tech, load_phase, load_pair, unravel_phases */

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
 * Load Unit
 *
 * @param  template Template name
 *
 * @return  Pertinent unit information
 */
function load_unit(templateName)
{
	var template = loadTemplate(templateName);
	var unit = GetTemplateDataHelper(template);
	unit.phase = false;

	if (unit.requiredTechnology)
	{
		if (typeof unit.requiredTechnology == "string" && unit.requiredTechnology.slice(0, 5) == "phase")
			unit.phase = unit.requiredTechnology;
		else if (typeof unit.requiredTechnology == "string" || unit.requiredTechnology.length > 0)
			unit.required = unit.requiredTechnology;
	}

	var gatherer = derive_gatherRates(templateName);
	for (let gType in gatherer)
		if (gatherer[gType] > 0)
		{
			unit.gather = gatherer;
			break;
		}

	if (template.Heal)
		unit.healer = {
			"Range": +template.Heal.Range || 0,
			"HP": +template.Heal.HP || 0,
			"Rate": +template.Heal.Rate || 0
		};

	if (template.Builder && template.Builder.Entities._string)
	{ // E084
		for (let build of template.Builder.Entities._string.split(" "))
		{
			build = build.replace("{civ}", g_SelectedCiv);
			if (g_Lists.structures.indexOf(build) < 0)
				g_Lists.structures.push(build);
		}
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
function load_structure(templateName)
{
	var template = loadTemplate(templateName);
	var structure = GetTemplateDataHelper(template);
	structure.phase = false;

	if (structure.requiredTechnology)
	{
		if (typeof structure.requiredTechnology == "string" && structure.requiredTechnology.slice(0, 5) == "phase")
			structure.phase = structure.requiredTechnology;
		else if (typeof structure.requiredTechnology == "string" || structure.requiredTechnology.length > 0)
			structure.required = structure.requiredTechnology;
	}

	structure.production = {
		"technology": [],
		"units": []
	};
	if (template.ProductionQueue)
	{
		if (template.ProductionQueue.Entities && template.ProductionQueue.Entities._string)
		{ // E084
			for (let build of template.ProductionQueue.Entities._string.split(" "))
			{
				build = build.replace("{civ}", g_SelectedCiv);
				structure.production.units.push(build);
				if (g_Lists.units.indexOf(build) < 0)
					g_Lists.units.push(build);
			}
		}

		if (template.ProductionQueue.Technologies && template.ProductionQueue.Technologies._string)
		{ // E084
			for (let research of template.ProductionQueue.Technologies._string.split(" "))
			{
				structure.production.technology.push(research);
				if (g_Lists.techs.indexOf(research) < 0)
					g_Lists.techs.push(research);
			}
		}
	}

	if (structure.wallSet)
	{
		structure.wallset = {};
		// Note: Assume wall segments of all lengths have the same armor
		structure.armour = load_structure(structure.wallSet.templates["long"]).armour;

		let health;

		for (let wSegm in structure.wallSet.templates)
		{
			let wPart = load_structure(structure.wallSet.templates[wSegm]);
			structure.wallset[wSegm] = wPart;

			for (let research of wPart.production.technology)
				structure.production.technology.push(research);

			if (["gate", "tower"].indexOf(wSegm) != -1)
				continue;

			if (!health)
			{
				health = { "min": wPart.health, "max": wPart.health };
				continue;
			}

			if (health.min > wPart.health)
				health.min = wPart.health;
			else if (health.max < wPart.health)
				health.max = wPart.health;
		}
		if (health.min == health.max)
			structure.health = health.min;
		else
			structure.health = sprintf(translate("%(val1)s to %(val2)s"), {
				val1: health.min,
				val2: health.max
			});
	}

	return structure;
}

/**
 * Load Technology
 *
 * @param  techName  Identifying code of a technology. Also known as its subpath within the simulation/data/technologies directory
 *
 * @return  Pertinent technology information
 */
function load_tech(techName)
{
	var template = loadTechData(techName);
	var tech = GetTechnologyDataHelper(template, g_SelectedCiv);
// TODO do translation here? (see GetTechnologyData)

	tech.reqs = {};

	if (template.pair !== undefined)
		tech.pair = template.pair;

	if (template.requirements !== undefined)
	{
		for (let op in template.requirements)
		{
			let val = template.requirements[op];	
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

	if (template.supersedes !== undefined)
		if (tech.reqs.generic !== undefined)
			tech.reqs.generic.push(template.supersedes);
		else
		{ // E048
			for (let ck of Object.keys(tech.reqs))
				tech.reqs[ck].push(template.supersedes);
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
	var template = loadTechData(phaseCode);
	var phase = GetTechnologyDataHelper(template, g_SelectedCiv);
	phase.actualPhase = "";

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
		"techs": [ pairInfo.top, pairInfo.bottom ],
		"req": (pairInfo.supersedes !== undefined) ? pairInfo.supersedes : ""
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
