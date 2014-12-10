
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