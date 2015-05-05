var g_DrawLimits = {}; // GUI limits. Populated by predraw()

/**
 * Draw the structree
 *
 * (Actually resizes and changes visibility of elements, and populates text)
 */
function draw()
{
	// Set basic state (positioning of elements mainly), but only once
	if (!Object.keys(g_DrawLimits).length)
		predraw();
	
	var defWidth = 96;
	var defMargin = 4;
	var iconMargin = getProdIconDimen().margin;
	var iconWidth = getProdIconDimen().width + iconMargin;
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

			for (let r in g_DrawLimits[pha].prodQuant)
			{
				let p = 0;
				r = +r; // force int
				let prod_pha = phaseList[phaseList.indexOf(pha) + r];
				if (stru.production.units[prod_pha])
				{
					for (let prod of stru.production.units[prod_pha])
					{
						prod = g_ParsedData.units[prod];
						if (!drawProdIcon(i, s, r, p, prod))
							break;
						p++;
					}
				}
				if (stru.wallset && prod_pha == pha)
				{
					for (let prod of [stru.wallset.gate, stru.wallset.tower])
					{
						if (!drawProdIcon(i, s, r, p, prod))
							break;
						p++;
					}
				}
				if (stru.production.technology[prod_pha])
				{
					for (let prod of stru.production.technology[prod_pha])
					{
						prod = (depath(prod).slice(0,5) == "phase") ? g_ParsedData.phases[prod] : g_ParsedData.techs[prod];
						if (!drawProdIcon(i, s, r, p, prod))
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
			size.right = y + ((c*iconWidth < defWidth)?defWidth:c*iconWidth)+iconMargin;
			y = size.right + defMargin;
			thisEle.size = size;

			let eleWidth = size.right - size.left;
			let r;
			for (r in rowCounts)
			{
				let wid = rowCounts[r] * iconWidth - iconMargin;
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

function drawProdIcon(pha, s, r, p, prod)
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
 * Calculate row position offset (accounting for different number of prod rows per phase).
 */
function getPositionOffset(idx)
{
	var phases = g_ParsedData.phaseList.length;

	var size = 92*idx; // text, image and offset
	size += (getProdIconDimen().adjWidth+4) * (phases*idx - (idx-1)*idx/2); // phase rows (phase-currphase+1 per row)

	return size;
}

function getProdIconDimen()
{
	var pIcon = Engine.GetGUIObjectByName("phase[0]_struct[0]_row[0]_prod[0]").size;
	pIcon.width = pIcon.right - pIcon.left;
	pIcon.height = pIcon.bottom - pIcon.top;
	pIcon.margin = 4;
	pIcon.adjWidth = pIcon.width + pIcon.margin * 2;
	pIcon.adjHeight = pIcon.height + pIcon.margin * 2;
	return pIcon;
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
 * (as <repeat> does not reposition automatically).
 * 
 * Also detects limits on what the GUI can display by iterating through the set
 * elements of the GUI. These limits are then used by draw().
 */
function predraw()
{
	var phaseList = g_ParsedData.phaseList;
	var initIconSize = getProdIconDimen();

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
			prodBar.size = "40 98+"+ ((initIconSize.adjHeight+2)*j+offset+1) +" 100%-8 98+"+ ((initIconSize.adjHeight+2)*(j+1)+offset-1);
			
			// Set phase icon
			let prodBarIcon = Engine.GetGUIObjectByName("phase["+i+"]_bar["+(j-1)+"]_icon");
			prodBarIcon.sprite = "stretched:session/portraits/"+g_ParsedData.phases[phaseList[i+j]].icon;
			prodBarIcon.size = "4 "+initIconSize.margin+" 4+"+initIconSize.width+" "+(initIconSize.height+initIconSize.margin);
		}
		// Hide remaining prod bars
		hideRemaining("phase["+i+"]_bar[", j-1, "]");

		let s = 0;
		let ele = Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]");
		g_DrawLimits[pha] = {
			structQuant: 0,
			prodQuant: []
		};

		do
		{
			// Position production icons
			for (let r in phaseList.slice(phaseList.indexOf(pha)))
			{
				let p=0;
				let prodEle = Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]_row["+r+"]_prod["+p+"]");

				do
				{
					let prodsize = prodEle.size;
					prodsize.left = (initIconSize.right+initIconSize.margin) * p;
					prodsize.right = (initIconSize.right+initIconSize.margin) * (p+1) - initIconSize.margin;
					prodsize.top = initIconSize.margin;
					prodsize.bottom = initIconSize.height + initIconSize.margin;
					prodEle.size = prodsize;

					p++;
					prodEle = Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]_row["+r+"]_prod["+p+"]");
				} while (prodEle !== undefined);

				// Set quantity of productions in this row
				g_DrawLimits[pha].prodQuant[r] = p;

				// Position the prod row
				Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]_row["+r+"]").size = "4 100%-"+(initIconSize.adjHeight+2)*(phaseCount - i - r)+"-1 100%-4 100%";
			}

			// Hide unused struct rows
			for (let j = phaseCount - i; j < phaseCount; ++j)
				Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]_row["+j+"]").hidden = true;

			let size = ele.size;
			size.bottom += Object.keys(g_DrawLimits[pha].prodQuant).length*(initIconSize.adjHeight+2);
			ele.size = size;

			s++;
			ele = Engine.GetGUIObjectByName("phase["+i+"]_struct["+s+"]");
		} while (ele !== undefined);

		// Set quantity of structures in each phase
		g_DrawLimits[pha].structQuant = s;
		++i;
	}
	hideRemaining("phase[", i, "]");
	hideRemaining("phase[", i, "]_bar");
}

/**
 * Assemble a tooltip text
 *
 * @param  template Information about a Unit, a Structure or a Technology
 *
 * @return  The tooltip text, formatted.
 */
function assembleTooltip(template)
{
	var txt = getEntityNamesFormatted(template);
	txt += "\n" + getEntityCostTooltip(template, 1);

	if (template.tooltip)
		txt += "\n" + txtFormats.body[0] +  translate(template.tooltip) + txtFormats.body[1];

	if (template.auras)
		for (let aura in template.auras)
			txt += "\n" + sprintf(translate("%(auralabel)s %(aurainfo)s"), {
				auralabel: txtFormats.header[0] + sprintf(translate("%(auraname)s:"), {
						auraname: translate(aura)
					}) + txtFormats.header[1],
				aurainfo: txtFormats.body[0] + translate(template.auras[aura]) + txtFormats.body[1]
			});

	if (template.health)
		txt += "\n" + sprintf(translate("%(label)s %(details)s"), {
			label: txtFormats.header[0] + translate("Health:") + txtFormats.header[1],
			details: template.health
		});

	if (template.healer)
		txt += "\n" + getHealerTooltip(template);

	if (template.attack)
		txt += "\n" + getAttackTooltip(template);

	if (template.armour)
		txt += "\n" + getArmorTooltip(template.armour);

	txt += "\n" + getSpeedTooltip(template);

	if (template.gather)
	{
		var rates = [];
		for (let type in template.gather)
			rates.push(sprintf(translate("%(resourceIcon)s %(rate)s"), {
				resourceIcon: getCostComponentDisplayName(type),
				rate: template.gather[type]
			}));

		txt += "\n" + sprintf(translate("%(label)s %(details)s"), {
			label: txtFormats.header[0] + translate("Gather Rates:") + txtFormats.header[1],
			details: rates.join("  ")
		});
	}

	return txt;
}
