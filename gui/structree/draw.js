/* global g_ParsedData, g_CivData, g_SelectedCiv */
/* exported draw */

var g_drawLimits = {}; // GUI limits. Populated by predraw()
var costIcons = {
		"food"       : "[icon=\"iconFood\"]"
	,	"wood"       : "[icon=\"iconWood\"]"
	,	"stone"      : "[icon=\"iconStone\"]"
	,	"metal"      : "[icon=\"iconMetal\"]"
	,	"time"       : "[icon=\"iconTime\"]"
	,	"population" : "[icon=\"iconPopulation\"]"
};
var txtFormats = {
		"body"      : [ '[font="sans-13"]', '[/font]' ]
	,	"subheader" : [ '[font="sans-bold-13"]', '[/font]' ]
	,	"subtext"   : [ '[font="sans-10"][color="orange"]', '[/color][/font]' ]
	,	"resources" : [ '[font="sans-12"]', '[/font]' ]
};

/**
 * Draw the structree
 *
 * (Actually resizes and changes visibility of elements, and populates text)
 */
function draw ()
{
	// Set basic state (positioning of elements mainly), but only once
	if (Object.keys(g_drawLimits).length <= 0)
		predraw();
	
	var defWidth = 96;
	var defMargin = 4;
	var phaseList = g_ParsedData.phaseList;
	
	Engine.GetGUIObjectByName("civEmblem").sprite = "stretched:"+g_CivData[g_SelectedCiv].Emblem;
	Engine.GetGUIObjectByName("civName").caption = g_CivData[g_SelectedCiv].Name;
	Engine.GetGUIObjectByName("civHistory").caption = g_CivData[g_SelectedCiv].History;
	
	for (let pha of phaseList)
	{
		let s = 0;
		let y = 0;
		
		for (let stru of g_CivData[g_SelectedCiv].buildList[pha])
		{
			let thisEle = Engine.GetGUIObjectByName(pha+"_struct["+s+"]");
			if (thisEle === undefined)
			{
				error("\""+g_SelectedCiv+"\" has more structures in the \""+pha+"\" phase than can be supported by the current GUI layout");
				break;
			}
			
			let c = 0;
			let rowCounts = [];
			stru = g_ParsedData.structures[stru];
			Engine.GetGUIObjectByName(pha+"_struct["+s+"]_icon").sprite = "stretched:session/portraits/"+stru.icon;
			Engine.GetGUIObjectByName(pha+"_struct["+s+"]_icon").tooltip = assembleTooltip(stru);
			Engine.GetGUIObjectByName(pha+"_struct["+s+"]_name").caption = translate(stru.name.specific);
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
						if (!draw_prodIcon(pha, s, r, p, prod))
							break;
						p++;
					}
				}
				if (stru.wallset && prod_pha == pha)
				{
					for (let prod of [stru.wallset.Gate, stru.wallset.Tower])
					{
						if (!draw_prodIcon(pha, s, r, p, prod))
							break;
						p++;
					}
				}
				if (stru.production.technology[prod_pha])
				{
					for (let prod of stru.production.technology[prod_pha])
					{
						prod = (prod.slice(0,5) == "phase") ? g_ParsedData.phases[prod] : g_ParsedData.techs[prod];
						if (!draw_prodIcon(pha, s, r, p, prod))
							break;
						p++;
					}
				}
				rowCounts[r] = p;
				if (p>c)
					c = p;
				for (p; p<g_drawLimits[pha].prodQuant[r]; p++)
					Engine.GetGUIObjectByName(pha+"_struct["+s+"]_row["+r+"]_prod["+p+"]").hidden = true;
			}
			
			let size = thisEle.size;
			size.left = y;
			size.right = size.left + ((c*24 < defWidth)?defWidth:c*24)+4;
			y = size.right + defMargin;
			thisEle.size = size;
			
			let eleWidth = size.right - size.left;
			for (let r in rowCounts)
			{
				let wid = rowCounts[r] * 24 - 4;
				let phaEle = Engine.GetGUIObjectByName(pha+"_struct["+s+"]_row["+r+"]");
				size = phaEle.size;
				size.left = (eleWidth - wid)/2;
				phaEle.size = size;
			}
			
			s++;
		}
		for (s; s<g_drawLimits[pha].structQuant; s++)
		{
			Engine.GetGUIObjectByName(pha+"_struct["+s+"]").hidden = true;
		}
	}
}

function draw_prodIcon (pha, s, r, p, prod)
{
	var prodEle = Engine.GetGUIObjectByName(pha+"_struct["+s+"]_row["+r+"]_prod["+p+"]");
	if (prodEle === undefined)
	{
		error("The structures of \""+g_SelectedCiv+"\" have more production icons in the \""+pha+"\" phase than can be supported by the current GUI layout");
		return false;
	}
	
	prodEle.sprite = "stretched:session/portraits/"+prod.icon;
	prodEle.tooltip = assembleTooltip(prod);
	prodEle.hidden = false;
	return true;
}

/**
 * Positions certain elements that only need to be positioned once
 *   (as `<repeat>` doesn't reposition automatically)
 * 
 * Also detects limits on what the GUI can display by iterating through the set
 *   elements of the GUI. These limits are then used by the draw() function
 *   above
 */
function predraw ()
{
	var phaseList = g_ParsedData.phaseList;
	var initIconSize = Engine.GetGUIObjectByName(phaseList[0]+"_struct[0]_row[0]_prod[0]").size;
	
	for (let pha of phaseList)
	{
		let s = 0;
		let ele = Engine.GetGUIObjectByName(pha+"_struct["+s+"]");
		g_drawLimits[pha] = {
				structQuant: 0
			,	prodQuant: []
			};
		
		do
		{
			// Position production icons
			for (let r in phaseList.slice(phaseList.indexOf(pha)))
			{
				let p=1;
				let prodEle = Engine.GetGUIObjectByName(pha+"_struct["+s+"]_row["+r+"]_prod["+p+"]");
				
				do
				{
					let prodsize = prodEle.size;
					prodsize.left = (initIconSize.right+4) * p;
					prodsize.right = (initIconSize.right+4) * (p+1) - 4;
					prodEle.size = prodsize;
					
					p++;
					prodEle = Engine.GetGUIObjectByName(pha+"_struct["+s+"]_row["+r+"]_prod["+p+"]");
				} while (prodEle !== undefined);
				
				// Set quantity of productions in this row
				g_drawLimits[pha].prodQuant[r] = p;
			}
			
			let size = ele.size;
			size.bottom += Object.keys(g_drawLimits[pha].prodQuant).length*24;
			ele.size = size;
			
			s++;
			ele = Engine.GetGUIObjectByName(pha+"_struct["+s+"]");
		} while (ele !== undefined);
		
		// Set quantity of structures in each phase
		g_drawLimits[pha].structQuant = s;
	}
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
	
	if (info.stats)
	{
		// Auras
		if (info.auras)
		{ // E084
			for (let aura of info.auras)
				txt += "\n" + txtFormats.subheader[0] + translate(aura.name) + ":" + txtFormats.subheader[1] +
						" " + txtFormats.body[0] + translate(aura.description) + txtFormats.body[1];
		}
		
		// Health
		txt += "\n" + txtFormats.subheader[0] + translate("Health:") + txtFormats.subheader[1] + " " + txtFormats.body[0];
		if (Array.isArray(info.stats.health))
			if (Array.min(info.stats.health) == Array.max(info.stats.health))
				txt += info.stats.health[0];
			else
				txt += Array.min(info.stats.health) +"-"+ Array.max(info.stats.health);
		else
			txt += info.stats.health;
		txt += txtFormats.body[1];
		
		// Healer
		if (info.stats.healer)
		{
			txt += "\n" + txtFormats.subheader[0] + translate("Heal:") + txtFormats.subheader[1] + " ";
			var healer = [];
			healer.push(
					txtFormats.body[0] + info.stats.healer.HP + txtFormats.body[1] +
					" " + txtFormats.subtext[0] + translate("HP") + txtFormats.subtext[1]
				);
			healer.push(
					txtFormats.subheader[0] + translate("Range:") + txtFormats.subheader[1] + " " +
					txtFormats.body[0] + info.stats.healer.Range + txtFormats.body[1] +
					" " + txtFormats.subtext[0] + translate("metres") + txtFormats.subtext[1]
				);
			healer.push(
					txtFormats.subheader[0] + translate("Rate:") + txtFormats.subheader[1] + " " +
					txtFormats.body[0] + (info.stats.healer.Rate/1000) + txtFormats.body[1] +
					" " + txtFormats.subtext[0] + translate("seconds") + txtFormats.subtext[1]
				);
			txt += healer.join(", ");
		}
		
		// Attack
		for (let atkType in info.stats.attack)
		{
			txt += "\n" + txtFormats.subheader[0] + translate(atkType +" Attack:") + txtFormats.subheader[1] + " ";
			let damage = [];
			
			for (let stat of ["Hack", "Pierce", "Crush"])
				if (info.stats.attack[atkType][stat] > 0)
					damage.push(
							txtFormats.body[0] + info.stats.attack[atkType][stat] + txtFormats.body[1] +
							" " + txtFormats.subtext[0] + translate(stat) + txtFormats.subtext[1]
						);
			/*
			if (info.stats.attack[atkType].RepeatTime > 0)
				damage.push(
						txtFormats.subheader[0] + translate("Rate:") + txtFormats.subheader[1] + " " +
						txtFormats.body[0] + info.stats.attack[atkType].RepeatTime/1000 + txtFormats.body[1] +
						" " + txtFormats.subtext[0] + translate("seconds") + txtFormats.subtext[1]
					);
			*/
			if (atkType == "Ranged")
			{
				damage.push(
						txtFormats.subheader[0] + translate("Range:") + txtFormats.subheader[1] + " " +
						txtFormats.body[0] +
						((info.stats.attack.Ranged.MinRange > 0) ? info.stats.attack.Ranged.MinRange + "-" : "") +
						info.stats.attack.Ranged.MaxRange + txtFormats.body[1] +
						" " + txtFormats.subtext[0] + translate("metres") + txtFormats.subtext[1]
					);
			}
			
			txt += damage.join(", ");
		}
		
		// Armour
		txt += "\n" + txtFormats.subheader[0] + translate("Armor:") + txtFormats.subheader[1] + " ";
		var armour = [];
		for (let stat in info.stats.armour)
		{
			armour.push(
					txtFormats.body[0] + 
					((Array.isArray(info.stats.armour[stat])) ? info.stats.armour[stat][0] : info.stats.armour[stat]) +
					txtFormats.body[1] +
					" " + txtFormats.subtext[0] + translate(stat) + txtFormats.subtext[1]
				);
		}
		txt += armour.join(", ");
		
		// Speed
		if (info.stats.speed)
		{
			txt += "\n" + txtFormats.subheader[0] + translate("Speed:") + txtFormats.subheader[1] + " ";
			var speed = [];
			for (let stat in info.stats.speed)
				speed.push(
						txtFormats.body[0] + info.stats.speed[stat] + txtFormats.body[1] +
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
		
	}
	
	return txt;
}