/* global g_ParsedData, g_CivData, g_SelectedCiv, translate */
/* exported draw */

var g_drawLimits = {}; // GUI limits. Populated by predraw()
const costIcons = {
	"food": "[icon=\"iconFood\"]",
	"wood": "[icon=\"iconWood\"]",
	"stone": "[icon=\"iconStone\"]",
	"metal": "[icon=\"iconMetal\"]",
	"time": "[icon=\"iconTime\"]",
	"population": "[icon=\"iconPopulation\"]"
};
const txtFormats = {
	"body": [ '[font="sans-13"]', '[/font]' ],
	"subheader": [ '[font="sans-bold-13"]', '[/font]' ],
	"subtext": [ '[font="sans-10"][color="orange"]', '[/color][/font]' ],
	"resources": [ '[font="sans-12"]', '[/font]' ]
};

/**
 * Draw the structree
 *
 * (Actually resizes and changes visibility of elements, and populates text)
 */
function draw()
{
	// Set basic state (positioning of elements mainly), but only once
	if (!Object.keys(g_drawLimits).length)
		predraw();
	
	var defWidth = 96;
	var defMargin = 4;
	var phaseList = g_ParsedData.phaseList;
	
	Engine.GetGUIObjectByName("civEmblem").sprite = "stretched:"+g_CivData[g_SelectedCiv].Emblem;
	Engine.GetGUIObjectByName("civName").caption = g_CivData[g_SelectedCiv].Name;
	Engine.GetGUIObjectByName("civHistory").caption = g_CivData[g_SelectedCiv].History;
	
	let i = 0;
	for (let pha of phaseList)
	{
		let s = 0;
		let y = 0;
		
		for (let stru of g_CivData[g_SelectedCiv].buildList[pha])
		{
			let thisEle = Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]");
			if (thisEle === undefined)
			{
				error("\""+g_SelectedCiv+"\" has more structures in phase "+pha+" than can be supported by the current GUI layout");
				break;
			}
			
			let c = 0;
			let rowCounts = [];
			stru = g_ParsedData.structures[stru];
			Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]_icon").sprite = "stretched:session/portraits/"+stru.icon;
			Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]_icon").tooltip = assembleTooltip(stru);
			Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]_name").caption = translate(stru.name.specific);
			thisEle.hidden = false;
			
			for (let r in g_drawLimits[pha].prodQuant)
			{
				let p = 0;
				r = +r; // force int
				let prod_pha = phaseList[phaseList.indexOf(pha) + r];
				if (stru.production.units[prod_pha])
				{
					for (let prod of stru.production.units[prod_pha])
					{
						prod = g_ParsedData.units[prod];
						if (!draw_prodIcon(i, s, r, p, prod))
							break;
						p++;
					}
				}
				if (stru.wallset && prod_pha == pha)
				{
					for (let prod of [stru.wallset.gate, stru.wallset.tower])
					{
						if (!draw_prodIcon(i, s, r, p, prod))
							break;
						p++;
					}
				}
				if (stru.production.technology[prod_pha])
				{
					for (let prod of stru.production.technology[prod_pha])
					{
						// TODO check if we need both phases and techs
						prod = (prod.slice(0,5) == "phase") ? g_ParsedData.phases[prod] : g_ParsedData.techs[prod];
						if (!draw_prodIcon(i, s, r, p, prod))
							break;
						p++;
					}
				}
				rowCounts[r] = p;
				if (p>c)
					c = p;
				hideRemaining("phase["+i+"]_struct["+s+"]_row["+r+"]_prod[", p, "]");
			}

			let size = thisEle.size;
			size.left = y;
			size.right = size.left + ((c*24 < defWidth)?defWidth:c*24)+4;
			y = size.right + defMargin;
			thisEle.size = size;
			
			let eleWidth = size.right - size.left;
			let r;
			for (r in rowCounts)
			{
				let wid = rowCounts[r] * 24 - 4;
				let phaEle = Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]_row["+r+"]");
				size = phaEle.size;
				size.left = (eleWidth - wid)/2;
				phaEle.size = size;
			}
			++r;
			hideRemaining("phase["+i+"]_struct["+s+"]_row[", r, "]");
			++s;
		}
		hideRemaining("phase["+i+"]_struct[", s, "]");
		++i;
	}
}

function draw_prodIcon(pha, s, r, p, prod)
{
	var prodEle = Engine.GetGUIObjectByName("phase["+pha+"]_struct["+s+"]_row["+r+"]_prod["+p+"]");
	if (prodEle === undefined)
	{
		error("The structures of \""+g_SelectedCiv+"\" have more production icons in phase "+pha+" than can be supported by the current GUI layout");
		return false;
	}
	
	prodEle.sprite = "stretched:session/portraits/"+prod.icon;
	prodEle.tooltip = assembleTooltip(prod);
	prodEle.hidden = false;
	return true;
}

/**
 * Calculate row position offset (accounting for different number of prod rows per phase)
 */
function getPositionOffset(idx)
{
	var phases = g_ParsedData.phaseList.length;

	var size = 92*idx; // text, image and offset
	size += 24 * (phases*idx - (idx-1)*idx/2); // phase rows (phase-currphase+1 per row)

	return size;
}

function hideRemaining(prefix, idx, suffix)
{
	let obj = Engine.GetGUIObjectByName(prefix+idx+suffix);
	while (obj)
	{
		obj.hidden = true;
		++idx;
		obj = Engine.GetGUIObjectByName(prefix+idx+suffix);
	}
}


/**
 * Positions certain elements that only need to be positioned once
 *   (as `<repeat>` doesn't reposition automatically)
 * 
 * Also detects limits on what the GUI can display by iterating through the set
 *   elements of the GUI. These limits are then used by the draw() function
 *   above
 */
function predraw()
{
	var phaseList = g_ParsedData.phaseList;
	var initIconSize = Engine.GetGUIObjectByName("phase[0]_struct[0]_row[0]_prod[0]").size;

	let phaseCount = phaseList.length;
	let i = 0;
	for (let pha of phaseList)
	{
		let offset = getPositionOffset(i);
		// Align the phase row
		Engine.GetGUIObjectByName("phase["+i+"]").size = "8 16+"+offset+" 100% 100%";

		// Set phase icon
		let phaseIcon = Engine.GetGUIObjectByName("phase["+i+"]_phase");
		phaseIcon.sprite = "stretched:session/portraits/"+g_ParsedData.phases[pha].icon;
		phaseIcon.size = "16 32+"+offset+" 48+16 48+32+"+offset;

		// Position prod bars
		let j = 1;
		for (; j < phaseCount - i; ++j)
		{
			let prodBar = Engine.GetGUIObjectByName("phase["+i+"]_bar["+(j-1)+"]");
			prodBar.size = "40 1+"+(24*j)+"+98+"+offset+" 100%-8 1+"+(24*j)+"+98+"+offset+"+22";
			// Set phase icon
			let prodBarIcon = Engine.GetGUIObjectByName("phase["+i+"]_bar["+(j-1)+"]_icon");
			prodBarIcon.sprite = "stretched:session/portraits/"+g_ParsedData.phases[phaseList[i+j]].icon;
		}
		// Hide remaining prod bars
		hideRemaining("phase["+i+"]_bar[", j-1, "]");

		let s = 0;
		let ele = Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]");
		g_drawLimits[pha] = {
				structQuant: 0,
				prodQuant: []
			};

		do
		{
			// Position production icons
			for (let r in phaseList.slice(phaseList.indexOf(pha)))
			{
				let p=1;
				let prodEle = Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]_row["+r+"]_prod["+p+"]");

				do
				{
					let prodsize = prodEle.size;
					prodsize.left = (initIconSize.right+4) * p;
					prodsize.right = (initIconSize.right+4) * (p+1) - 4;
					prodEle.size = prodsize;

					p++;
					prodEle = Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]_row["+r+"]_prod["+p+"]");
				} while (prodEle !== undefined);

				// Set quantity of productions in this row
				g_drawLimits[pha].prodQuant[r] = p;

				// Position the prod row
				Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]_row["+r+"]").size = "4 100%-"+24*(phaseCount - i - r)+" 100%-4 100%";
			}

			// Hide unused struct rows
			for (let j = phaseCount - i; j < phaseCount; ++j)
				Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]_row["+j+"]").hidden = true;

			let size = ele.size;
			size.bottom += Object.keys(g_drawLimits[pha].prodQuant).length*24;
			ele.size = size;

			s++;
			ele = Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]");
		} while (ele !== undefined);

		// Set quantity of structures in each phase
		g_drawLimits[pha].structQuant = s;
		++i;
	}
	hideRemaining("phase[", i, "]");
	hideRemaining("phase[", i, "]_bar");
}

/**
 * Assemble a tooltip text
 *
 * @param  info  Information about a Unit, a Structure or a Technology
 *
 * @return  The tooltip text, formatted.
 */
function assembleTooltip (info)
{
// TODO i18n
// TODO reuse in-game gui tooltip code
	var txt = "";
	var speciName = (info.name[g_SelectedCiv]) ? info.name[g_SelectedCiv] : info.name.specific;
	var generiName = translate(info.name.generic);

	if (speciName !== undefined)
	{
		speciName = translate(speciName).split(" ");
		for (let word of speciName)
		{
			let wordCaps = word.toUpperCase();
			if (word[0].toLowerCase() !== word[0])
			{
				txt += '[font="sans-bold-16"]' + wordCaps[0] + '[/font]';
				wordCaps = wordCaps.slice(1);
			}
			txt += '[font="sans-bold-12"]' + wordCaps + '[/font] ';
		}
		txt += '[font="sans-bold-12"](' + generiName + ')[/font]';
	}
	else
		txt = '[font="sans-bold-16"]' + generiName + '[/font]';

	txt += "\n" + txtFormats.resources[0];
	for (let res in info.cost)
	{
		if (res == "populationBonus")
			continue;

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
	txt += txtFormats.resources[1];

	if (info.tooltip && !Array.isArray(info.tooltip))
		txt += "\n" + txtFormats.body[0] + translate(info.tooltip) + txtFormats.body[1];

	// Auras
	if (info.auras)
	{ // E084
		for (let aura in info.auras)
			txt += "\n" + txtFormats.subheader[0] + translate(aura) + ":" + txtFormats.subheader[1] +
					" " + txtFormats.body[0] + translate(info.auras[aura]) + txtFormats.body[1];
	}

	if (info.health)
	{
		// Health
		txt += "\n" + txtFormats.subheader[0] + translate("Health:") + txtFormats.subheader[1] + " " + txtFormats.body[0];
		if (Array.isArray(info.health))
			if (Array.min(info.health) == Array.max(info.health))
				txt += info.health[0];
			else
				txt += Array.min(info.health) +"-"+ Array.max(info.health);
		else
			txt += info.health;
		txt += txtFormats.body[1];
	}

	// Healer
	if (info.healer)
	{
		txt += "\n" + txtFormats.subheader[0] + translate("Heal:") + txtFormats.subheader[1] + " ";
		var healer = [];
		healer.push(
				txtFormats.body[0] + info.healer.HP + txtFormats.body[1] +
				" " + txtFormats.subtext[0] + translate("HP") + txtFormats.subtext[1]
			);
		healer.push(
				txtFormats.subheader[0] + translate("Range:") + txtFormats.subheader[1] + " " +
				txtFormats.body[0] + info.healer.Range + txtFormats.body[1] +
				" " + txtFormats.subtext[0] + translate("metres") + txtFormats.subtext[1]
			);
		healer.push(
				txtFormats.subheader[0] + translate("Rate:") + txtFormats.subheader[1] + " " +
				txtFormats.body[0] + (info.healer.Rate/1000) + txtFormats.body[1] +
				" " + txtFormats.subtext[0] + translate("seconds") + txtFormats.subtext[1]
			);
		txt += healer.join(", ");
	}

	if (info.attack)
	{
		// Attack
		for (let atkType in info.attack)
		{
			if (atkType == "Slaughter")
				continue;

			txt += "\n" + txtFormats.subheader[0] + translate(atkType +" Attack:") + txtFormats.subheader[1] + " ";
			let damage = [];

			for (let stat of ["hack", "pierce", "crush"])
				if (info.attack[atkType][stat] > 0)
					damage.push(
							txtFormats.body[0] + info.attack[atkType][stat] + txtFormats.body[1] +
							" " + txtFormats.subtext[0] + translate(stat) + txtFormats.subtext[1]
						);

			if (atkType == "Ranged")
			{
				damage.push(
						txtFormats.subheader[0] + translate("Range:") + txtFormats.subheader[1] + " " +
						txtFormats.body[0] +
						((info.attack.Ranged.minRange > 0) ? info.attack.Ranged.minRange + "-" : "") +
						info.attack.Ranged.maxRange + txtFormats.body[1] +
						" " + txtFormats.subtext[0] + translate("meters") + txtFormats.subtext[1]
					);
			}

			txt += damage.join(", ");
		}
	}

	if (info.armour)
	{
		// Armour
		txt += "\n" + txtFormats.subheader[0] + translate("Armor:") + txtFormats.subheader[1] + " ";
		var armour = [];
		for (let stat in info.armour)
		{
			armour.push(
					txtFormats.body[0] + 
					((Array.isArray(info.armour[stat])) ? info.armour[stat][0] : info.armour[stat]) +
					txtFormats.body[1] +
					" " + txtFormats.subtext[0] + translate(stat) + txtFormats.subtext[1]
				);
		}
		txt += armour.join(", ");
	}

	// Speed
	if (info.speed)
	{
		txt += "\n" + txtFormats.subheader[0] + translate("Speed:") + txtFormats.subheader[1] + " ";
		var speed = [];
		for (let stat in info.speed)
			speed.push(
					txtFormats.body[0] + info.speed[stat] + txtFormats.body[1] +
					" " + txtFormats.subtext[0] + translate(stat) + txtFormats.subtext[1]
				);
		txt += speed.join(", ");
	}

	// Gather
	if (info.gather)
	{
		txt += "\n" + txtFormats.subheader[0] + translate("Gather Rates:") + txtFormats.subheader[1] + " ";
		var rates = [];
		for (let gType in info.gather)
			if (info.gather[gType] > 0)
				rates.push(
						txtFormats.body[0] + info.gather[gType] + txtFormats.body[1] +
						" " + txtFormats.subtext[0] + translate(gType) + txtFormats.subtext[1]
					);
		txt += rates.join(", ");
	}

	return txt;
}
