
var g_drawPhases = { // hard-coded values. See comment of draw() for reason
		"phase_village" : {
			"structQuant": 11
		,	"prodQuant": [ 9, 4, 4 ]
		,	"prodCount": []
		}
	,	"phase_town" : {
			"structQuant": 9
		,	"prodQuant": [ 6,  8 ]
		,	"prodCount": []
		}
	,	"phase_city" : {
			"structQuant": 5
		,	"prodQuant": [ 16 ]
		,	"prodCount": []
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
var txtFormats = {
		"body"      : [ '[font="sans-13"]', '[/font]' ]
	,	"subheader" : [ '[font="sans-bold-13"]', '[/font]' ]
	,	"subtext"   : [ '[font="sans-10"][color="orange"]', '[/color][/font]' ]
	,	"resources" : [ '[font="sans-12"]', '[/font]' ]
};

/**
 * Draw the structree
 *
 * (Actually moves and changes visibility of elements, and populates text)
 *
 * This is one of two functions in the mod where the phases are hard-coded. The hard-coding
 *   is due to limitations in the GUI Engine preventing dynamic creation of UI Elements.
 */
function draw ()
{
	var defWidth = 96;
	var defMargin = 4;
	var phaseList = Object.keys(g_drawPhases);
	
	for (var pha in g_drawPhases)
	{
		var s = 0;
		var y = 0;
		
		for (var stru of g_CivData[g_SelectedCiv].buildList[pha])
		{
			var thisEle = Engine.GetGUIObjectByName(pha+"_struct["+s+"]");
			var c = 0;
			
			var stru = g_ParsedData.structures[stru];
			Engine.GetGUIObjectByName(pha+"_struct["+s+"]_icon").sprite = "stretched:session/portraits/"+stru.icon;
			Engine.GetGUIObjectByName(pha+"_struct["+s+"]_icon").tooltip = assembleTooltip(stru);
			Engine.GetGUIObjectByName(pha+"_struct["+s+"]_name").caption = stru.name.specific;
			thisEle.hidden = false;
			
			for (var r in g_drawPhases[pha].prodQuant)
			{
				var p = 0;
				var prod_pha = phaseList[phaseList.indexOf(pha) + +r];
				if (stru.production.units[prod_pha])
				{
					for (var prod of stru.production.units[prod_pha])
					{
						var prod = g_ParsedData.units[prod];
						var prodEle = Engine.GetGUIObjectByName(pha+"_struct["+s+"]_row["+r+"]_prod["+p+"]");
						prodEle.sprite = "stretched:session/portraits/"+prod.icon;
						prodEle.tooltip = assembleTooltip(prod);
						prodEle.hidden = false;
						p++;
					}
				}
				if (stru.wallset && prod_pha == pha)
				{
					for (var prod of [stru.wallset.Gate, stru.wallset.Tower])
					{
						var prodEle = Engine.GetGUIObjectByName(pha+"_struct["+s+"]_row["+r+"]_prod["+p+"]");
						prodEle.sprite = "stretched:session/portraits/"+prod.icon;
						prodEle.tooltip = assembleTooltip(prod);
						prodEle.hidden = false;
						p++;
					}
				}
				if (stru.production.technology[prod_pha])
				{
					for (var prod of stru.production.technology[prod_pha])
					{
						if (prod.slice(0,5) == "phase")
							var prod = g_ParsedData.phases[prod];
						else
							var prod = g_ParsedData.techs[prod];
						var prodEle = Engine.GetGUIObjectByName(pha+"_struct["+s+"]_row["+r+"]_prod["+p+"]");
						prodEle.sprite = "stretched:session/portraits/technologies/"+prod.icon;
						prodEle.tooltip = assembleTooltip(prod);
						prodEle.hidden = false;
						p++;
					}
				}
				g_drawPhases[pha].prodCount[r] = p;
				if (p>c)
					c = p;
				for (p; p<g_drawPhases[pha].prodQuant[r]; p++)
					Engine.GetGUIObjectByName(pha+"_struct["+s+"]_row["+r+"]_prod["+p+"]").hidden = true;
			}
			
			var size = thisEle.size;
			size.left = y;
			size.right = size.left + ((c*24 < defWidth)?defWidth:c*24)+4;
			y = size.right + defMargin;
			thisEle.size = size;
			
			var eleWidth = size.right - size.left;
			for (var r in g_drawPhases[pha].prodCount)
			{
				var wid = g_drawPhases[pha].prodCount[r] * 24 - 4;
				var phaEle = Engine.GetGUIObjectByName(pha+"_struct["+s+"]_row["+r+"]");
				var size = phaEle.size;
				size.left = (eleWidth - wid)/2;
				phaEle.size = size;
			}
			
			s++;
		}
		for (s; s<g_drawPhases[pha].structQuant; s++)
		{
			Engine.GetGUIObjectByName(pha+"_struct["+s+"]").hidden = true;
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
		"phase_village": Engine.GetGUIObjectByName("phase_village_struct[0]_row[0]_prod[0]").size
	,	"phase_town": Engine.GetGUIObjectByName("phase_town_struct[0]_row[0]_prod[0]").size
	,	"phase_city": Engine.GetGUIObjectByName("phase_city_struct[0]_row[0]_prod[0]").size
	};
	
	for (var pha in g_drawPhases)
	{
		for (var s=0; s<g_drawPhases[pha].structQuant; s++)
		{
			var ele = Engine.GetGUIObjectByName(pha+"_struct["+s+"]");
			var size = ele.size;
			size.bottom += Object.keys(g_drawPhases[pha].prodQuant).length*24;
			ele.size = size;
			
			for (var r in g_drawPhases[pha].prodQuant)
			{
				for (var p=1; p<g_drawPhases[pha].prodQuant[r]; p++)
				{
					var prodEle = Engine.GetGUIObjectByName(pha+"_struct["+s+"]_row["+r+"]_prod["+p+"]");
					var prodsize = prodEle.size;
					prodsize.left = (initSizes[pha].right+4) * p;
					prodsize.right = (initSizes[pha].right+4) * (p+1) - 4;
					prodEle.size = prodsize;
				}
			}
		}
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
	
	if (speciName !== undefined)
	{
		txt = '[font="sans-bold-16"]' + speciName[0] + '[/font]';
		txt += '[font="sans-bold-12"]' + speciName.slice(1).toUpperCase() + '[/font]';
		txt += '[font="sans-bold-12"] (' + info.name.generic + ')[/font]';
	}
	else
		txt = '[font="sans-bold-16"]' + info.name.generic + '[/font]';
	
	txt += "\n" + txtFormats.resources[0];
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
	txt += txtFormats.resources[1];
	
	if (info.tooltip && !Array.isArray(info.tooltip))
		txt += "\n" + txtFormats.body[0] + info.tooltip + txtFormats.body[1];
	
	if (info.stats)
	{
		// Auras
		if (info.auras)
		{
			for (var aura of info.auras)
				txt += "\n" + txtFormats.subheader[0] + aura.name + ":" + txtFormats.subheader[1] +
						" " + txtFormats.body[0] + aura.description + txtFormats.body[1];
		}
		
		// Health
		txt += "\n" + txtFormats.subheader[0] + "Health:" + txtFormats.subheader[1] + " " + txtFormats.body[0];
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
			txt += "\n" + txtFormats.subheader[0] + "Heal:" + txtFormats.subheader[1] + " ";
			var healer = [];
			healer.push(
					txtFormats.body[0] + info.stats.healer["HP"] + txtFormats.body[1] +
					" " + txtFormats.subtext[0] + "HP" + txtFormats.subtext[1]
				);
			healer.push(
					txtFormats.subheader[0] + "Range:" + txtFormats.subheader[1] + " " +
					txtFormats.body[0] + info.stats.healer["Range"] + txtFormats.body[1] +
					" " + txtFormats.subtext[0] + "metres" + txtFormats.subtext[1]
				);
			healer.push(
					txtFormats.subheader[0] + "Rate:" + txtFormats.subheader[1] + " " +
					txtFormats.body[0] + (info.stats.healer["Rate"]/1000) + txtFormats.body[1] +
					" " + txtFormats.subtext[0] + "seconds" + txtFormats.subtext[1]
				);
			txt += healer.join(", ");
		}
		
		// Attack
		for (var atkType in info.stats.attack)
		{
			txt += "\n" + txtFormats.subheader[0] + atkType +" Attack:" + txtFormats.subheader[1] + " ";
			var damage = [];
			
			for (var stat of ["Hack", "Pierce", "Crush"])
				if (info.stats.attack[atkType][stat] > 0)
					damage.push(
							txtFormats.body[0] + info.stats.attack[atkType][stat] + txtFormats.body[1] +
							" " + txtFormats.subtext[0] + stat + txtFormats.subtext[1]
						);
			/*
			if (info.stats.attack[atkType].RepeatTime > 0)
				damage.push(
						txtFormats.subheader[0] + "Rate:" + txtFormats.subheader[1] + " " +
						txtFormats.body[0] + info.stats.attack[atkType].RepeatTime/1000 + txtFormats.body[1] +
						" " + txtFormats.subtext[0] + "seconds" + txtFormats.subtext[1]
					);
			*/
			if (atkType == "Ranged")
			{
				damage.push(
						txtFormats.subheader[0] + "Range:" + txtFormats.subheader[1] + " " +
						txtFormats.body[0] +
						((info.stats.attack["Ranged"].MinRange > 0) ? info.stats.attack["Ranged"].MinRange + "-" : "") +
						info.stats.attack["Ranged"].MaxRange + txtFormats.body[1] +
						" " + txtFormats.subtext[0] + "metres" + txtFormats.subtext[1]
					);
			}
			
			txt += damage.join(", ");
		}
		
		// Armour
		txt += "\n" + txtFormats.subheader[0] + "Armour:" + txtFormats.subheader[1] + " ";
		var armour = [];
		for (var stat in info.stats.armour)
		{
			armour.push(
					txtFormats.body[0] + 
					((Array.isArray(info.stats.armour[stat])) ? info.stats.armour[stat][0] : info.stats.armour[stat]) +
					txtFormats.body[1] +
					" " + txtFormats.subtext[0] + stat + txtFormats.subtext[1]
				);
		}
		txt += armour.join(", ");
		
		// Speed
		if (info.stats.speed)
		{
			txt += "\n" + txtFormats.subheader[0] + "Movement Speed:" + txtFormats.subheader[1] + " ";
			var speed = [];
			for (var stat in info.stats.speed)
				speed.push(
						txtFormats.body[0] + info.stats.speed[stat] + txtFormats.body[1] +
						" " + txtFormats.subtext[0] + stat + txtFormats.subtext[1]
					);
			txt += speed.join(", ");
		}
		
		// Gather
		if (info.gather)
		{
			txt += "\n" + txtFormats.subheader[0] + "Gather Rates:" + txtFormats.subheader[1] + " ";
			var rates = [];
			for (var gType in info.gather)
			{
				if (info.gather[gType] > 0)
					rates.push(
							txtFormats.body[0] + info.gather[gType] + txtFormats.body[1] +
							" " + txtFormats.subtext[0] + gType + txtFormats.subtext[1]
						);
			}
			txt += rates.join(", ");
		}
		
	}
	
	return txt;
}